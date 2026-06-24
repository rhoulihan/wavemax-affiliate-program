const affiliateController = require('../../server/controllers/affiliateController');
const Affiliate = require('../../server/models/Affiliate');
const Customer = require('../../server/models/Customer');
const Order = require('../../server/models/Order');
const Transaction = require('../../server/models/Transaction');
const encryptionUtil = require('../../server/utils/encryption');
const emailService = require('../../server/utils/emailService');
const { validationResult } = require('express-validator');
const { expectSuccessResponse, expectErrorResponse } = require('../helpers/responseHelpers');
const { extractHandler } = require('../helpers/testUtils');
const { createFindOneMock, createFindMock, createMockDocument, createAggregateMock } = require('../helpers/mockHelpers');
const inviteService = require('../../server/modules/onboarding/inviteService');

// Mock dependencies
jest.mock('../../server/models/Affiliate');
jest.mock('../../server/models/Customer');
jest.mock('../../server/models/Order');
jest.mock('../../server/models/Transaction');
jest.mock('../../server/utils/encryption');
jest.mock('../../server/utils/emailService');
jest.mock('express-validator');
jest.mock('../../server/modules/onboarding/inviteService', () => {
  class InviteError extends Error {
    constructor(code, statusCode) {
      super(code);
      this.name = 'InviteError';
      this.code = code;
      this.statusCode = statusCode;
    }
  }
  return {
    validateInvite: jest.fn(),
    consumeInvite: jest.fn(),
    InviteError
  };
});
jest.mock('../../server/utils/auditLogger', () => ({
  logAuditEvent: jest.fn(),
  AuditEvents: { INVITE_CONSUMED: 'INVITE_CONSUMED' }
}));

// Mock ControllerHelpers
jest.mock('../../server/utils/controllerHelpers', () => ({
  asyncWrapper: (fn) => async (req, res, next) => {
    try {
      await fn(req, res, next);
    } catch (error) {
      // Handle database errors consistently
      res.status(500).json({
        success: false,
        message: 'An error occurred while retrieving affiliate profile'
      });
    }
  },
  sendSuccess: (res, data, message, statusCode = 200) => {
    return res.status(statusCode).json({ success: true, message, ...data });
  },
  sendError: (res, message, statusCode = 400, errors = null) => {
    return res.status(statusCode).json({ success: false, message, ...(errors && { errors }) });
  },
  handleError: (res, error, operation, statusCode = 500) => {
    return res.status(statusCode).json({ 
      success: false, 
      message: `An error occurred during ${operation}`
    });
  },
  parsePagination: (query, defaults) => ({
    page: parseInt(query?.page) || 1,
    limit: parseInt(query?.limit) || 10,
    skip: ((parseInt(query?.page) || 1) - 1) * (parseInt(query?.limit) || 10),
    sortBy: defaults?.sortBy || '-createdAt'
  }),
  sendPaginated: (res, items, pagination, itemsKey = 'items') => {
    return res.status(200).json({
      success: true,
      [itemsKey]: items,
      pagination
    });
  },
  calculatePagination: (totalItems, page, limit) => ({
    page,
    limit,
    totalItems,
    totalPages: Math.ceil(totalItems / limit),
    hasNext: page < Math.ceil(totalItems / limit),
    hasPrev: page > 1
  })
}));

// Mock AuthorizationHelpers
jest.mock('../../server/middleware/authorizationHelpers', () => ({
  checkAffiliateAccess: (req, res, next) => {
    if (req.user && (req.user.role === 'admin' || req.user.affiliateId === req.params.affiliateId)) {
      return next();
    }
    res.status(403).json({ success: false, message: 'Unauthorized' });
  },
  canAccessAffiliate: (user, affiliateId) => {
    return user && (user.role === 'admin' || user.affiliateId === affiliateId);
  },
  canAccessCustomer: (user, customerId) => {
    return user && (user.role === 'admin' || user.customerId === customerId);
  }
}));

// Mock Formatters
jest.mock('../../server/utils/formatters', () => ({
  name: jest.fn((name) => name),
  phone: jest.fn((phone, format) => phone),
  currency: jest.fn((amount) => `$${amount}`),
  date: jest.fn((date) => date?.toISOString()),
  datetime: jest.fn((date) => date?.toISOString()),
  status: jest.fn((status) => status),
  fullName: jest.fn((first, last) => `${first} ${last}`),
  address: jest.fn((obj) => `${obj.address}, ${obj.city}, ${obj.state} ${obj.zipCode}`)
}));

// Mock security utils  
jest.mock('../../server/utils/securityUtils', () => ({
  escapeRegex: (str) => {
    if (!str) return '';
    return str.toString().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}));

describe('Affiliate Controller', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      body: {},
      params: {},
      query: {},
      user: {},
      pagination: { page: 1, limit: 10, skip: 0 }
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  describe('registerAffiliate', () => {
    const validBody = {
      inviteToken: 'a'.repeat(64),
      firstName: 'John',
      lastName: 'Doe',
      email: 'attacker@evil.com', // must be ignored
      phone: '123-456-7890',
      businessName: 'Johns Laundry',
      address: '123 Main St',
      city: 'Anytown',
      state: 'CA',
      zipCode: '12345',
      username: 'johndoe',
      password: 'password123',
      paymentMethod: 'venmo',
      venmoHandle: '@johndoe'
    };

    beforeEach(() => {
      validationResult.mockReturnValue({
        isEmpty: jest.fn().mockReturnValue(true),
        array: jest.fn().mockReturnValue([])
      });
      inviteService.validateInvite.mockResolvedValue({
        inviteId: 'INV-1',
        email: 'invitee@example.com',
        prefill: {}
      });
      inviteService.consumeInvite.mockResolvedValue({ inviteId: 'INV-1', status: 'accepted' });
      encryptionUtil.hashPassword.mockReturnValue({ hash: 'hashedPassword', salt: 'salt' });
      emailService.sendAffiliateWelcomeEmail.mockResolvedValue(true);
      Affiliate.deleteOne = jest.fn().mockResolvedValue({ deletedCount: 1 });
      Affiliate.prototype.save = jest.fn().mockImplementation(function () {
        this.affiliateId = 'AFF123456';
        return Promise.resolve(this);
      });
    });

    it('registers using the INVITE email, consumes the invite, returns 201', async () => {
      req.body = { ...validBody };
      Affiliate.findOne = jest.fn()
        .mockResolvedValueOnce(null)  // email check
        .mockResolvedValueOnce(null); // username check

      await affiliateController.registerAffiliate(req, res, next);

      // The duplicate check ran on the INVITE email, not the client email.
      expect(inviteService.validateInvite).toHaveBeenCalledWith(validBody.inviteToken);
      expect(Affiliate.findOne).toHaveBeenCalledWith({ email: 'invitee@example.com' });
      expect(inviteService.consumeInvite).toHaveBeenCalledWith(validBody.inviteToken, 'AFF123456');
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        affiliateId: 'AFF123456',
        deliveryCode: expect.any(String), // one-time delivery role code (PR 9)
        message: 'Affiliate registered successfully!'
      });
    });

    it('returns the InviteError status when the invite is invalid', async () => {
      const { InviteError } = inviteService;
      inviteService.validateInvite.mockRejectedValue(new InviteError('invalid', 410));
      req.body = { ...validBody };

      await affiliateController.registerAffiliate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(410);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        reason: 'invalid'
      }));
      expect(inviteService.consumeInvite).not.toHaveBeenCalled();
    });

    it('rolls back the affiliate and returns 409 when the consume race is lost', async () => {
      inviteService.consumeInvite.mockResolvedValue(null);
      req.body = { ...validBody };
      Affiliate.findOne = jest.fn().mockResolvedValue(null);

      await affiliateController.registerAffiliate(req, res, next);

      expect(Affiliate.deleteOne).toHaveBeenCalledTimes(1);
      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        reason: 'already_used'
      }));
    });

    it('returns validation errors before touching the invite', async () => {
      validationResult.mockReturnValue({
        isEmpty: jest.fn().mockReturnValue(false),
        array: jest.fn().mockReturnValue([{ msg: 'Invite token is required' }])
      });

      await affiliateController.registerAffiliate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(inviteService.validateInvite).not.toHaveBeenCalled();
    });

    it('handles duplicate email on the invite email with 400', async () => {
      req.body = { ...validBody };
      Affiliate.findOne = jest.fn()
        .mockResolvedValueOnce({ email: 'invitee@example.com' }) // email taken
        .mockResolvedValueOnce(null);

      await affiliateController.registerAffiliate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ field: 'email' }));
      expect(inviteService.consumeInvite).not.toHaveBeenCalled();
    });
  });

  // These three tests predate the invite rework — they exercise
  // getAffiliateProfile but historically lived inside the registerAffiliate
  // describe. Preserved here under their own block.
  describe('getAffiliateProfile (preserved legacy tests)', () => {

    it('should return 404 for non-existent affiliate', async () => {
      req.params.affiliateId = 'NONEXISTENT';
      req.user = { role: 'admin' };

      Affiliate.findOne = createFindOneMock(null);
      Affiliate.findOne.mockResolvedValue(null);

      await affiliateController.getAffiliateProfile(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Affiliate not found'
      });
    });

    it('should return 403 for unauthorized access', async () => {
      req.params.affiliateId = 'AFF123';
      req.user = { role: 'affiliate', affiliateId: 'AFF456' };

      Affiliate.findOne = jest.fn().mockResolvedValue({ affiliateId: 'AFF123' });

      await affiliateController.getAffiliateProfile(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Unauthorized'
      });
    });

    it('should handle decryption errors gracefully', async () => {
      const mockAffiliate = {
        affiliateId: 'AFF123',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '123-456-7890',
        businessName: 'Test Business',
        paymentMethod: 'paypal',
        paypalEmail: { encrypted: 'data' },
        dateRegistered: new Date(),
        lastLogin: new Date(),
        isActive: true,
        save: jest.fn().mockResolvedValue(true)
      };

      req.params.affiliateId = 'AFF123';
      req.user = { role: 'admin' };

      Affiliate.findOne = createFindOneMock(mockAffiliate);
      Affiliate.findOne.mockResolvedValue(mockAffiliate);
      encryptionUtil.decrypt.mockImplementation(() => {
        throw new Error('Decryption failed');
      });

      await affiliateController.getAffiliateProfile(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      const response = res.json.mock.calls[0][0];
      expect(response.success).toBe(true);
      expect(response.affiliate.paypalEmail).toBeUndefined();
    });
  });

  describe('updateAffiliateProfile', () => {
    it('should successfully update affiliate profile', async () => {
      const mockAffiliate = {
        affiliateId: 'AFF123',
        firstName: 'John',
        lastName: 'Doe',
        phone: '123-456-7890',
        save: jest.fn().mockResolvedValue(true)
      };

      req.params.affiliateId = 'AFF123';
      req.user = { role: 'affiliate', affiliateId: 'AFF123' };
      req.body = {
        firstName: 'Jane',
        phone: '987-654-3210',
        deliveryFee: 25
      };

      Affiliate.findOne = createFindOneMock(mockAffiliate);
      Affiliate.findOne.mockResolvedValue(mockAffiliate);

      const handler = affiliateController.updateAffiliateProfile;
      await handler(req, res, next);

      expect(mockAffiliate.firstName).toBe('Jane');
      expect(mockAffiliate.phone).toBe('987-654-3210');
      expect(mockAffiliate.deliveryFee).toBe(25);
      expect(mockAffiliate.save).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Affiliate profile updated successfully'
      });
    });

    it('should handle password change', async () => {
      const mockAffiliate = {
        affiliateId: 'AFF123',
        passwordSalt: 'oldSalt',
        passwordHash: 'oldHash',
        save: jest.fn().mockResolvedValue(true)
      };

      req.params.affiliateId = 'AFF123';
      req.user = { role: 'affiliate', affiliateId: 'AFF123' };
      req.body = {
        currentPassword: 'oldPassword',
        newPassword: 'newPassword'
      };

      Affiliate.findOne = createFindOneMock(mockAffiliate);
      Affiliate.findOne.mockResolvedValue(mockAffiliate);
      encryptionUtil.verifyPassword.mockReturnValue(true);
      encryptionUtil.hashPassword.mockReturnValue({
        salt: 'newSalt',
        hash: 'newHash'
      });

      await affiliateController.updateAffiliateProfile(req, res, next);

      expect(encryptionUtil.verifyPassword).toHaveBeenCalledWith(
        'oldPassword',
        'oldSalt',
        'oldHash'
      );
      expect(encryptionUtil.hashPassword).toHaveBeenCalledWith('newPassword');
      expect(mockAffiliate.passwordSalt).toBe('newSalt');
      expect(mockAffiliate.passwordHash).toBe('newHash');
      expect(mockAffiliate.save).toHaveBeenCalled();
    });

    it('should reject incorrect current password', async () => {
      const mockAffiliate = {
        affiliateId: 'AFF123',
        passwordSalt: 'salt',
        passwordHash: 'hash',
        save: jest.fn().mockResolvedValue(true)
      };

      req.params.affiliateId = 'AFF123';
      req.user = { role: 'affiliate', affiliateId: 'AFF123' };
      req.body = {
        currentPassword: 'wrongPassword',
        newPassword: 'newPassword'
      };

      Affiliate.findOne = createFindOneMock(mockAffiliate);
      Affiliate.findOne.mockResolvedValue(mockAffiliate);
      encryptionUtil.verifyPassword.mockReturnValue(false);

      await affiliateController.updateAffiliateProfile(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Current password is incorrect'
      });
    });

    it('should update payment method', async () => {
      const mockAffiliate = {
        affiliateId: 'AFF123',
        paymentMethod: 'paypal',
        save: jest.fn().mockResolvedValue(true)
      };

      req.params.affiliateId = 'AFF123';
      req.user = { role: 'admin' };
      req.body = {
        paymentMethod: 'venmo',
        venmoHandle: '@aff123-venmo'
      };

      Affiliate.findOne = createFindOneMock(mockAffiliate);
      Affiliate.findOne.mockResolvedValue(mockAffiliate);

      await affiliateController.updateAffiliateProfile(req, res, next);

      expect(mockAffiliate.paymentMethod).toBe('venmo');
      expect(mockAffiliate.venmoHandle).toBe('@aff123-venmo');
      expect(mockAffiliate.save).toHaveBeenCalled();
    });
  });

  describe('getAffiliateEarnings', () => {
    it('should return earnings for specified period', async () => {
      const mockAffiliate = { affiliateId: 'AFF123' , save: jest.fn().mockResolvedValue(true)};
      const mockOrders = [
        {
          orderId: 'ORD001',
          customerId: 'CUST001',
          completedAt: new Date()
        },
        {
          orderId: 'ORD002',
          customerId: 'CUST002',
          completedAt: new Date()
        }
      ];
      const mockCustomers = [
        { customerId: 'CUST001', firstName: 'John', lastName: 'Doe' },
        { customerId: 'CUST002', firstName: 'Jane', lastName: 'Smith' }
      ];

      req.params.affiliateId = 'AFF123';
      req.user = { role: 'affiliate', affiliateId: 'AFF123' };
      req.query.period = 'month';

      Affiliate.findOne = createFindOneMock(mockAffiliate);
      Affiliate.findOne.mockResolvedValue(mockAffiliate);
      Order.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue(mockOrders)
      });
      Customer.find = createFindMock(mockCustomers);
      Customer.find.mockResolvedValue(mockCustomers);

      const handler = affiliateController.getAffiliateEarnings;
      await handler(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        totalEarnings: 0,
        pendingAmount: 0,
        orderCount: 2,
        orders: expect.arrayContaining([
          expect.objectContaining({
            orderId: 'ORD001',
            customerName: 'John Doe'
          }),
          expect.objectContaining({
            orderId: 'ORD002',
            customerName: 'Jane Smith'
          })
        ])
      });
    });

    it('should handle different time periods', async () => {
      req.params.affiliateId = 'AFF123';
      req.user = { role: 'admin' };
      req.query.period = 'week';

      Affiliate.findOne = jest.fn().mockResolvedValue({ affiliateId: 'AFF123' });
      Order.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockResolvedValue([])
      });
      Customer.find = jest.fn().mockResolvedValue([]);
      Transaction.find = jest.fn().mockResolvedValue([]);

      await affiliateController.getAffiliateEarnings(req, res, next);

      const orderFindCall = Order.find.mock.calls[0][0];
      expect(orderFindCall.completedAt.$gte).toBeDefined();
      expect(orderFindCall.completedAt.$lte).toBeDefined();

      // Check that date range is approximately 7 days
      const dateDiff = orderFindCall.completedAt.$lte - orderFindCall.completedAt.$gte;
      const daysDiff = dateDiff / (1000 * 60 * 60 * 24);
      expect(daysDiff).toBeCloseTo(7, 0);
    });

    it('should handle missing customers gracefully', async () => {
      const mockOrders = [
        {
          orderId: 'ORD001',
          customerId: 'CUST_DELETED',
          deliveredAt: new Date(),
          affiliateCommission: 5
        }
      ];

      req.params.affiliateId = 'AFF123';
      req.user = { role: 'affiliate', affiliateId: 'AFF123' };

      Affiliate.findOne = jest.fn().mockResolvedValue({ affiliateId: 'AFF123' });
      Order.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockResolvedValue(mockOrders)
      });
      Customer.find = jest.fn().mockResolvedValue([]);
      Transaction.find = jest.fn().mockResolvedValue([]);

      await affiliateController.getAffiliateEarnings(req, res, next);

      const response = res.json.mock.calls[0][0];
      expect(response.orders[0].customerName).toBe('Unknown Customer');
    });
  });

  describe('getAffiliateCustomers', () => {
    it('should return paginated customers with search', async () => {
      const mockCustomers = [
        {
          customerId: 'CUST001',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          phone: '123-456-7890'
        },
        {
          customerId: 'CUST002',
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane@example.com',
          phone: '987-654-3210'
        }
      ];

      req.params.affiliateId = 'AFF123';
      req.user = { role: 'affiliate', affiliateId: 'AFF123' };
      req.query = { search: 'john', sort: 'name_asc' };
      req.pagination = { page: 1, limit: 10, skip: 0 };

      Customer.countDocuments = jest.fn().mockResolvedValue(2);
      Customer.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(mockCustomers)
      });
      Order.aggregate = jest.fn().mockResolvedValue([
        { _id: 'CUST001', count: 5 },
        { _id: 'CUST002', count: 3 }
      ]);

      const handler = affiliateController.getAffiliateCustomers;
      await handler(req, res, next);

      expect(Customer.find).toHaveBeenCalledWith(expect.objectContaining({
        affiliateId: 'AFF123',
        $or: expect.arrayContaining([
          { firstName: { $regex: 'john', $options: 'i' } }
        ])
      }));

      expect(res.status).toHaveBeenCalledWith(200);
      const response = res.json.mock.calls[0][0];
      expect(response.success).toBe(true);
      expect(response.customers).toBeDefined();
      expect(Array.isArray(response.customers)).toBe(true);
      expect(response.customers.length).toBeGreaterThanOrEqual(2);
      expect(response.pagination).toBeDefined();
    });

    it('should handle different sort options', async () => {
      req.params.affiliateId = 'AFF123';
      req.user = { role: 'admin' };
      req.query = { sort: 'recent' };
      req.pagination = { page: 1, limit: 10, skip: 0 };

      Customer.countDocuments = jest.fn().mockResolvedValue(0);
      Customer.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([])
      });
      Order.aggregate = jest.fn().mockResolvedValue([]);

      await affiliateController.getAffiliateCustomers(req, res, next);

      const sortCall = Customer.find().sort.mock.calls[0][0];
      expect(sortCall).toEqual({ registrationDate: -1 });
    });
  });

  describe('getAffiliateOrders', () => {
    it('should return filtered orders', async () => {
      const mockOrders = [
        {
          orderId: 'ORD001',
          customerId: 'CUST001',
          pickupDate: new Date(),
          status: 'pending',
          estimatedWeight: 30,
          numberOfBags: 2,
          createdAt: new Date()
        }
      ];
      const mockCustomers = [
        {
          customerId: 'CUST001',
          firstName: 'John',
          lastName: 'Doe',
          phone: '123-456-7890',
          address: '123 Main St',
          city: 'Anytown',
          state: 'CA',
          zipCode: '12345'
        }
      ];

      req.params.affiliateId = 'AFF123';
      req.user = { role: 'affiliate', affiliateId: 'AFF123' };
      req.query = {
        status: 'pending',
        date: 'today',
        page: '1',
        limit: '10'
      };

      Order.countDocuments = jest.fn().mockResolvedValue(1);
      Order.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(mockOrders)
      });
      Customer.find = createFindMock(mockCustomers);
      Customer.find.mockResolvedValue(mockCustomers);

      const handler = affiliateController.getAffiliateOrders;
      await handler(req, res, next);

      expect(Order.find).toHaveBeenCalledWith(expect.objectContaining({
        affiliateId: 'AFF123',
        status: 'pending',
        createdAt: expect.any(Object)
      }));

      expect(res.status).toHaveBeenCalledWith(200);
      const response = res.json.mock.calls[0][0];
      expect(response.success).toBe(true);
      expect(response.orders[0]).toMatchObject({
        orderId: 'ORD001',
        customer: {
          name: 'John Doe',
          phone: '123-456-7890',
          address: '123 Main St, Anytown, CA 12345'
        }
      });
    });

    it('should handle date filters correctly', async () => {
      req.params.affiliateId = 'AFF123';
      req.user = { role: 'admin' };
      req.query = { date: 'tomorrow' };

      Order.countDocuments = jest.fn().mockResolvedValue(0);
      Order.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([])
      });
      Customer.find = jest.fn().mockResolvedValue([]);

      await affiliateController.getAffiliateOrders(req, res, next);

      const findCall = Order.find.mock.calls[0][0];
      expect(findCall.createdAt).toBeDefined();
      expect(findCall.createdAt.$gte).toBeDefined();
      expect(findCall.createdAt.$lte).toBeDefined();

      // Check that the date is tomorrow
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const filterDate = new Date(findCall.createdAt.$gte);
      expect(filterDate.getDate()).toBe(tomorrow.getDate());
    });
  });

  describe('getAffiliateTransactions', () => {
    it('should return paginated transactions', async () => {
      const mockTransactions = [
        {
          transactionId: 'TXN001',
          affiliateId: 'AFF123',
          type: 'commission',
          amount: 100,
          status: 'completed',
          createdAt: new Date()
        },
        {
          transactionId: 'TXN002',
          affiliateId: 'AFF123',
          type: 'commission',
          amount: 50,
          status: 'pending',
          createdAt: new Date()
        }
      ];

      req.params.affiliateId = 'AFF123';
      req.user = { role: 'affiliate', affiliateId: 'AFF123' };
      req.query = { status: 'pending', page: 1, limit: 10 };

      Transaction.countDocuments.mockResolvedValue(1);

      // First call - for paginated results
      Transaction.find.mockReturnValueOnce({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockTransactions[1]])
      });

      // Second call - for all transactions (summary calculation)
      Transaction.find.mockResolvedValueOnce(mockTransactions);

      const handler = affiliateController.getAffiliateTransactions;
      await handler(req, res, next);

      expect(Transaction.find).toHaveBeenCalledWith({
        affiliateId: 'AFF123',
        status: 'pending'
      });

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        transactions: [mockTransactions[1]],
        summary: {
          totalEarnings: 150,
          totalPayouts: 0,
          pendingAmount: 50
        },
        pagination: {
          total: 1,
          page: 1,
          limit: 10,
          pages: 1
        }
      });
    });
  });

  describe('getAffiliateDashboardStats', () => {
    it('returns counts + commission (delivery fees) for the dashboard', async () => {
      req.params.affiliateId = 'AFF123';
      req.user = { role: 'affiliate', affiliateId: 'AFF123' };

      Customer.countDocuments = jest.fn().mockResolvedValue(10);
      // active orders, monthly complete, weekly complete
      Order.countDocuments = jest.fn()
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(1);
      // commission aggregation (month, then week)
      Order.aggregate = jest.fn().mockResolvedValue([]); // no delivery-fee commission

      const handler = affiliateController.getAffiliateDashboardStats;
      await handler(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      const response = res.json.mock.calls[0][0];

      expect(response.stats).toMatchObject({
        customerCount: 10,
        activeOrderCount: 3,
        totalEarnings: 0,
        monthEarnings: 0,
        weekEarnings: 0,
        pendingEarnings: 0,
        monthlyOrders: 2,
        weeklyOrders: 1
      });
      expect(response.stats.nextPayoutDate).toBeDefined();
    });

    it('should handle empty data gracefully', async () => {
      req.params.affiliateId = 'AFF123';
      req.user = { role: 'admin' };

      Customer.countDocuments = jest.fn().mockResolvedValue(0);
      Order.countDocuments = jest.fn().mockResolvedValue(0);
      Order.aggregate = jest.fn().mockResolvedValue([]);
      Order.find = jest.fn().mockResolvedValue([]);
      Transaction.find.mockResolvedValue([]);

      await affiliateController.getAffiliateDashboardStats(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      const response = res.json.mock.calls[0][0];
      expect(response.stats).toMatchObject({
        customerCount: 0,
        activeOrderCount: 0,
        totalEarnings: 0,
        monthEarnings: 0,
        weekEarnings: 0,
        pendingEarnings: 0,
        monthlyOrders: 0,
        weeklyOrders: 0
      });
    });
  });

  describe('getPublicAffiliateInfo', () => {
    it('should return only public affiliate information', async () => {
      const mockAffiliate = {
        firstName: 'John',
        lastName: 'Doe',
        businessName: 'Johns Laundry',
        deliveryFee: 25,
        city: 'New York',
        state: 'NY'
      , save: jest.fn().mockResolvedValue(true)};

      req.params.affiliateId = 'AFF123';

      Affiliate.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockAffiliate)
      });

      const handler = affiliateController.getPublicAffiliateInfo;
      await handler(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      const response = res.json.mock.calls[0][0];
      expect(response.success).toBe(true);
      expect(response.firstName).toBe('John');
      expect(response.lastName).toBe('Doe');
      expect(response.businessName).toBe('Johns Laundry');
      expect(response.deliveryFee).toBe(25);
      expect(response.email).toBeUndefined();
      expect(response.phone).toBeUndefined();
      expect(response.accountNumber).toBeUndefined();
    });

    it('should return 404 for non-existent affiliate', async () => {
      req.params.affiliateId = 'NONEXISTENT';

      Affiliate.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(null)
      });

      await affiliateController.getPublicAffiliateInfo(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Affiliate not found'
      });
    });
  });

  describe('Error handling', () => {
    it('should handle database connection errors', async () => {
      const next = jest.fn();
      req.params.affiliateId = 'AFF123';
      req.user = { role: 'admin' };

      Affiliate.findOne = jest.fn().mockRejectedValue(new Error('Database connection lost'));

      await affiliateController.getAffiliateProfile(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'An error occurred while retrieving affiliate profile'
      });
    });
  });

  describe('deleteAffiliateData', () => {
    beforeEach(() => {
      req.user = { affiliateId: 'AFF123' };
    });

    it('should delete all affiliate data in development environment', async () => {
      process.env.ENABLE_DELETE_DATA_FEATURE = 'true';
      req.params.affiliateId = 'AFF123';

      const mockAffiliate = { affiliateId: 'AFF123', _id: 'affiliate-object-id' , save: jest.fn().mockResolvedValue(true)};
      const mockCustomers = [
        { customerId: 'CUST1', _id: 'customer-object-id-1' },
        { customerId: 'CUST2', _id: 'customer-object-id-2' }
      ];

      Affiliate.findOne = createFindOneMock(mockAffiliate);
      Affiliate.findOne.mockResolvedValue(mockAffiliate);
      Customer.find = createFindMock(mockCustomers);
      Customer.find.mockResolvedValue(mockCustomers);
      Order.deleteMany = jest.fn().mockResolvedValue({ deletedCount: 5 });
      Transaction.deleteMany.mockResolvedValue({ deletedCount: 3 });
      Customer.deleteMany.mockResolvedValue({ deletedCount: 2 });
      Affiliate.deleteOne.mockResolvedValue({ deletedCount: 1 });

      const handler = affiliateController.deleteAffiliateData;
      await handler(req, res, next);

      expect(Order.deleteMany).toHaveBeenCalledWith({
        $or: [
          { affiliateId: 'AFF123' },
          { customerId: { $in: ['CUST1', 'CUST2'] } }
        ]
      });
      expect(Transaction.deleteMany).toHaveBeenCalledWith({ affiliateId: 'AFF123' });
      expect(Customer.deleteMany).toHaveBeenCalledWith({ affiliateId: 'AFF123' });
      expect(Affiliate.deleteOne).toHaveBeenCalledWith({ affiliateId: 'AFF123' });

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'All data has been deleted successfully',
        deletedData: {
          affiliate: 1,
          customers: 2,
          orders: 'All related orders deleted',
          transactions: 'All transactions deleted'
        }
      });
    });

    it('should reject deletion in production environment', async () => {
      const next = jest.fn();
      process.env.ENABLE_DELETE_DATA_FEATURE = 'false';

      await affiliateController.deleteAffiliateData(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'This operation is not allowed'
      });
    });

    it('should reject unauthorized deletion', async () => {
      const next = jest.fn();
      process.env.ENABLE_DELETE_DATA_FEATURE = 'true';
      req.params.affiliateId = 'AFF123';
      req.user.affiliateId = 'AFF456';

      await affiliateController.deleteAffiliateData(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'You can only delete your own data'
      });
    });

    it('should handle deletion errors', async () => {
      process.env.ENABLE_DELETE_DATA_FEATURE = 'true';
      req.params.affiliateId = 'AFF123';

      Affiliate.findOne = jest.fn().mockRejectedValue(new Error('Database error'));

      await affiliateController.deleteAffiliateData(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'An error occurred while deleting data'
      });
    });
  });
});