const affiliateController = require('../../server/controllers/affiliateController');
const Affiliate = require('../../server/models/Affiliate');
const Customer = require('../../server/models/Customer');
const Order = require('../../server/models/Order');
const Transaction = require('../../server/models/Transaction');
const encryptionUtil = require('../../server/utils/encryption');
const emailService = require('../../server/utils/emailService');
const { validationResult } = require('express-validator');

// Mock dependencies
jest.mock('../../server/models/Affiliate');
jest.mock('../../server/models/Customer');
jest.mock('../../server/models/Order');
jest.mock('../../server/models/Transaction');
jest.mock('../../server/utils/encryption');
jest.mock('../../server/utils/emailService');
jest.mock('express-validator');

describe('Affiliate Controller', () => {
  let req, res;

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
    jest.clearAllMocks();
  });

  describe('registerAffiliate', () => {
    it('should successfully register a new affiliate', async () => {
      const mockAffiliate = {
        affiliateId: 'AFF123456',
        save: jest.fn().mockResolvedValue(true)
      };

      req.body = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '123-456-7890',
        businessName: 'Johns Laundry',
        address: '123 Main St',
        city: 'Anytown',
        state: 'CA',
        zipCode: '12345',
        serviceArea: '10 miles',
        deliveryFee: '5.99',
        username: 'johndoe',
        password: 'password123',
        paymentMethod: 'directDeposit',
        accountNumber: '123456789',
        routingNumber: '987654321'
      };

      validationResult.mockReturnValue({
        isEmpty: jest.fn().mockReturnValue(true),
        array: jest.fn().mockReturnValue([])
      });

      Affiliate.findOne.mockResolvedValue(null);
      encryptionUtil.hashPassword.mockReturnValue({
        salt: 'salt',
        hash: 'hashedPassword'
      });
      Affiliate.prototype.save = jest.fn().mockResolvedValue(mockAffiliate);
      emailService.sendAffiliateWelcomeEmail.mockResolvedValue(true);

      await affiliateController.registerAffiliate(req, res);

      expect(Affiliate.findOne).toHaveBeenCalledWith({
        $or: [{ email: 'john@example.com' }, { username: 'johndoe' }]
      });
      expect(encryptionUtil.hashPassword).toHaveBeenCalledWith('password123');
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        affiliateId: 'AFF123456',
        message: 'Affiliate registered successfully!'
      });
    });

    it('should return validation errors', async () => {
      validationResult.mockReturnValue({
        isEmpty: jest.fn().mockReturnValue(false),
        array: jest.fn().mockReturnValue([{ msg: 'Email is required' }])
      });

      await affiliateController.registerAffiliate(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        errors: [{ msg: 'Email is required' }]
      });
    });

    it('should handle duplicate email or username', async () => {
      req.body = {
        email: 'existing@example.com',
        username: 'existing'
      };

      validationResult.mockReturnValue({
        isEmpty: jest.fn().mockReturnValue(true)
      });

      Affiliate.findOne.mockResolvedValue({ email: 'existing@example.com' });

      await affiliateController.registerAffiliate(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Email or username already in use'
      });
    });

    it('should handle email service failure gracefully', async () => {
      const mockAffiliate = {
        affiliateId: 'AFF123456',
        save: jest.fn().mockResolvedValue(true)
      };

      req.body = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        username: 'johndoe',
        password: 'password123',
        paymentMethod: 'paypal',
        paypalEmail: 'john@paypal.com',
        deliveryFee: '5.99'
      };

      validationResult.mockReturnValue({
        isEmpty: jest.fn().mockReturnValue(true)
      });

      Affiliate.findOne.mockResolvedValue(null);
      encryptionUtil.hashPassword.mockReturnValue({
        salt: 'salt',
        hash: 'hashedPassword'
      });
      Affiliate.prototype.save = jest.fn().mockResolvedValue(mockAffiliate);
      emailService.sendAffiliateWelcomeEmail.mockRejectedValue(new Error('Email failed'));

      await affiliateController.registerAffiliate(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        affiliateId: 'AFF123456',
        message: 'Affiliate registered successfully!'
      });
    });

    it('should handle database errors', async () => {
      validationResult.mockReturnValue({
        isEmpty: jest.fn().mockReturnValue(true)
      });

      Affiliate.findOne.mockRejectedValue(new Error('Database error'));

      await affiliateController.registerAffiliate(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'An error occurred during registration'
      });
    });
  });

  describe('getAffiliateProfile', () => {
    it('should return affiliate profile for authorized user', async () => {
      const mockAffiliate = {
        affiliateId: 'AFF123',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '123-456-7890',
        businessName: 'Johns Laundry',
        address: '123 Main St',
        city: 'Anytown',
        state: 'CA',
        zipCode: '12345',
        serviceArea: '10 miles',
        deliveryFee: 5.99,
        paymentMethod: 'paypal',
        paypalEmail: { encrypted: 'data' },
        isActive: true,
        dateRegistered: new Date(),
        lastLogin: new Date()
      };

      req.params.affiliateId = 'AFF123';
      req.user = { role: 'affiliate', affiliateId: 'AFF123' };

      Affiliate.findOne.mockResolvedValue(mockAffiliate);
      encryptionUtil.decrypt.mockReturnValue('john@paypal.com');

      await affiliateController.getAffiliateProfile(req, res);

      expect(Affiliate.findOne).toHaveBeenCalledWith({ affiliateId: 'AFF123' });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        affiliate: expect.objectContaining({
          affiliateId: 'AFF123',
          firstName: 'John',
          lastName: 'Doe',
          paypalEmail: 'john@paypal.com'
        })
      });
    });

    it('should return 404 for non-existent affiliate', async () => {
      req.params.affiliateId = 'NONEXISTENT';
      req.user = { role: 'admin' };

      Affiliate.findOne.mockResolvedValue(null);

      await affiliateController.getAffiliateProfile(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Affiliate not found'
      });
    });

    it('should return 403 for unauthorized access', async () => {
      req.params.affiliateId = 'AFF123';
      req.user = { role: 'affiliate', affiliateId: 'AFF456' };

      Affiliate.findOne.mockResolvedValue({ affiliateId: 'AFF123' });

      await affiliateController.getAffiliateProfile(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Unauthorized'
      });
    });

    it('should handle decryption errors gracefully', async () => {
      const mockAffiliate = {
        affiliateId: 'AFF123',
        paymentMethod: 'paypal',
        paypalEmail: { encrypted: 'data' }
      };

      req.params.affiliateId = 'AFF123';
      req.user = { role: 'admin' };

      Affiliate.findOne.mockResolvedValue(mockAffiliate);
      encryptionUtil.decrypt.mockImplementation(() => {
        throw new Error('Decryption failed');
      });

      await affiliateController.getAffiliateProfile(req, res);

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
        deliveryFee: 7.99
      };

      Affiliate.findOne.mockResolvedValue(mockAffiliate);

      await affiliateController.updateAffiliateProfile(req, res);

      expect(mockAffiliate.firstName).toBe('Jane');
      expect(mockAffiliate.phone).toBe('987-654-3210');
      expect(mockAffiliate.deliveryFee).toBe(7.99);
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

      Affiliate.findOne.mockResolvedValue(mockAffiliate);
      encryptionUtil.verifyPassword.mockReturnValue(true);
      encryptionUtil.hashPassword.mockReturnValue({
        salt: 'newSalt',
        hash: 'newHash'
      });

      await affiliateController.updateAffiliateProfile(req, res);

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
        passwordHash: 'hash'
      };

      req.params.affiliateId = 'AFF123';
      req.user = { role: 'affiliate', affiliateId: 'AFF123' };
      req.body = {
        currentPassword: 'wrongPassword',
        newPassword: 'newPassword'
      };

      Affiliate.findOne.mockResolvedValue(mockAffiliate);
      encryptionUtil.verifyPassword.mockReturnValue(false);

      await affiliateController.updateAffiliateProfile(req, res);

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
        paymentMethod: 'directDeposit',
        accountNumber: '123456789',
        routingNumber: '987654321'
      };

      Affiliate.findOne.mockResolvedValue(mockAffiliate);

      await affiliateController.updateAffiliateProfile(req, res);

      expect(mockAffiliate.paymentMethod).toBe('directDeposit');
      expect(mockAffiliate.accountNumber).toBe('123456789');
      expect(mockAffiliate.routingNumber).toBe('987654321');
      expect(mockAffiliate.save).toHaveBeenCalled();
    });
  });

  describe('getAffiliateEarnings', () => {
    it('should return earnings for specified period', async () => {
      const mockAffiliate = { affiliateId: 'AFF123' };
      const mockOrders = [
        {
          orderId: 'ORD001',
          customerId: 'CUST001',
          deliveredAt: new Date(),
          actualWeight: 10,
          actualTotal: 50,
          affiliateCommission: 5
        },
        {
          orderId: 'ORD002',
          customerId: 'CUST002',
          deliveredAt: new Date(),
          actualWeight: 15,
          actualTotal: 75,
          affiliateCommission: 7.5
        }
      ];
      const mockCustomers = [
        { customerId: 'CUST001', firstName: 'John', lastName: 'Doe' },
        { customerId: 'CUST002', firstName: 'Jane', lastName: 'Smith' }
      ];
      const mockTransactions = [
        { affiliateId: 'AFF123', amount: 12.5, status: 'pending' }
      ];

      req.params.affiliateId = 'AFF123';
      req.user = { role: 'affiliate', affiliateId: 'AFF123' };
      req.query.period = 'month';

      Affiliate.findOne.mockResolvedValue(mockAffiliate);
      Order.find.mockResolvedValue(mockOrders);
      Customer.find.mockResolvedValue(mockCustomers);
      Transaction.find.mockResolvedValue(mockTransactions);

      await affiliateController.getAffiliateEarnings(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        totalEarnings: 12.5,
        pendingAmount: 12.5,
        orderCount: 2,
        orders: expect.arrayContaining([
          expect.objectContaining({
            orderId: 'ORD001',
            customerName: 'John Doe',
            affiliateCommission: 5
          }),
          expect.objectContaining({
            orderId: 'ORD002',
            customerName: 'Jane Smith',
            affiliateCommission: 7.5
          })
        ])
      });
    });

    it('should handle different time periods', async () => {
      req.params.affiliateId = 'AFF123';
      req.user = { role: 'admin' };
      req.query.period = 'week';

      Affiliate.findOne.mockResolvedValue({ affiliateId: 'AFF123' });
      Order.find.mockResolvedValue([]);
      Customer.find.mockResolvedValue([]);
      Transaction.find.mockResolvedValue([]);

      await affiliateController.getAffiliateEarnings(req, res);

      const orderFindCall = Order.find.mock.calls[0][0];
      expect(orderFindCall.deliveredAt.$gte).toBeDefined();
      expect(orderFindCall.deliveredAt.$lte).toBeDefined();

      // Check that date range is approximately 7 days
      const dateDiff = orderFindCall.deliveredAt.$lte - orderFindCall.deliveredAt.$gte;
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

      Affiliate.findOne.mockResolvedValue({ affiliateId: 'AFF123' });
      Order.find.mockResolvedValue(mockOrders);
      Customer.find.mockResolvedValue([]);
      Transaction.find.mockResolvedValue([]);

      await affiliateController.getAffiliateEarnings(req, res);

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

      Customer.countDocuments.mockResolvedValue(2);
      Customer.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(mockCustomers)
      });
      Order.aggregate.mockResolvedValue([
        { _id: 'CUST001', count: 5 },
        { _id: 'CUST002', count: 3 }
      ]);

      await affiliateController.getAffiliateCustomers(req, res);

      expect(Customer.find).toHaveBeenCalledWith(expect.objectContaining({
        affiliateId: 'AFF123',
        $or: expect.arrayContaining([
          { firstName: { $regex: 'john', $options: 'i' } }
        ])
      }));

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        customers: expect.arrayContaining([
          expect.objectContaining({
            customerId: 'CUST001',
            orderCount: 5
          }),
          expect.objectContaining({
            customerId: 'CUST002',
            orderCount: 3
          })
        ]),
        totalItems: 2,
        pagination: {
          total: 2,
          page: 1,
          limit: 10,
          pages: 1
        }
      });
    });

    it('should handle different sort options', async () => {
      req.params.affiliateId = 'AFF123';
      req.user = { role: 'admin' };
      req.query = { sort: 'recent' };
      req.pagination = { page: 1, limit: 10, skip: 0 };

      Customer.countDocuments.mockResolvedValue(0);
      Customer.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([])
      });
      Order.aggregate.mockResolvedValue([]);

      await affiliateController.getAffiliateCustomers(req, res);

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
          status: 'scheduled',
          estimatedSize: 'medium',
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
        status: 'scheduled',
        date: 'today',
        page: '1',
        limit: '10'
      };

      Order.countDocuments.mockResolvedValue(1);
      Order.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(mockOrders)
      });
      Customer.find.mockResolvedValue(mockCustomers);

      await affiliateController.getAffiliateOrders(req, res);

      expect(Order.find).toHaveBeenCalledWith(expect.objectContaining({
        affiliateId: 'AFF123',
        status: 'scheduled',
        pickupDate: expect.any(Object)
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

      Order.countDocuments.mockResolvedValue(0);
      Order.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([])
      });

      await affiliateController.getAffiliateOrders(req, res);

      const findCall = Order.find.mock.calls[0][0];
      expect(findCall.pickupDate).toBeDefined();
      expect(findCall.pickupDate.$gte).toBeDefined();
      expect(findCall.pickupDate.$lte).toBeDefined();

      // Check that the date is tomorrow
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const filterDate = new Date(findCall.pickupDate.$gte);
      expect(filterDate.getDate()).toBe(tomorrow.getDate());
    });
  });

  describe('getAffiliateTransactions', () => {
    it('should return paginated transactions', async () => {
      const mockTransactions = [
        {
          transactionId: 'TXN001',
          affiliateId: 'AFF123',
          amount: 100,
          status: 'completed',
          createdAt: new Date()
        },
        {
          transactionId: 'TXN002',
          affiliateId: 'AFF123',
          amount: 50,
          status: 'pending',
          createdAt: new Date()
        }
      ];

      req.params.affiliateId = 'AFF123';
      req.user = { role: 'affiliate', affiliateId: 'AFF123' };
      req.query = { status: 'pending', page: '1', limit: '10' };

      Transaction.countDocuments.mockResolvedValue(1);
      Transaction.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockTransactions[1]])
      });

      await affiliateController.getAffiliateTransactions(req, res);

      expect(Transaction.find).toHaveBeenCalledWith({
        affiliateId: 'AFF123',
        status: 'pending'
      });

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        transactions: [mockTransactions[1]],
        pagination: {
          total: 1,
          page: '1',
          limit: '10',
          pages: 1
        }
      });
    });
  });

  describe('getAffiliateDashboardStats', () => {
    it('should return comprehensive dashboard statistics', async () => {
      const mockDeliveredOrders = [
        {
          affiliateId: 'AFF123',
          affiliateCommission: 10,
          deliveredAt: new Date()
        },
        {
          affiliateId: 'AFF123',
          affiliateCommission: 15,
          deliveredAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) // 10 days ago
        }
      ];
      const mockPendingTransactions = [
        { amount: 25 }
      ];

      req.params.affiliateId = 'AFF123';
      req.user = { role: 'affiliate', affiliateId: 'AFF123' };

      Customer.countDocuments.mockResolvedValue(10);
      Order.countDocuments.mockResolvedValue(3);
      Order.find.mockResolvedValue(mockDeliveredOrders);
      Transaction.find.mockResolvedValue(mockPendingTransactions);

      await affiliateController.getAffiliateDashboardStats(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const response = res.json.mock.calls[0][0];
      expect(response.stats).toMatchObject({
        customerCount: 10,
        activeOrderCount: 3,
        totalEarnings: 25,
        monthEarnings: 10,
        weekEarnings: 10,
        pendingEarnings: 25,
        monthlyOrders: 1,
        weeklyOrders: 1
      });
      expect(response.stats.nextPayoutDate).toBeDefined();
    });

    it('should handle empty data gracefully', async () => {
      req.params.affiliateId = 'AFF123';
      req.user = { role: 'admin' };

      Customer.countDocuments.mockResolvedValue(0);
      Order.countDocuments.mockResolvedValue(0);
      Order.find.mockResolvedValue([]);
      Transaction.find.mockResolvedValue([]);

      await affiliateController.getAffiliateDashboardStats(req, res);

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
        affiliateId: 'AFF123',
        firstName: 'John',
        lastName: 'Doe',
        businessName: 'Johns Laundry',
        deliveryFee: 5.99,
        serviceArea: '10 miles',
        email: 'private@example.com',
        phone: '123-456-7890',
        accountNumber: 'PRIVATE'
      };

      req.params.affiliateId = 'AFF123';

      Affiliate.findOne.mockResolvedValue(mockAffiliate);

      await affiliateController.getPublicAffiliateInfo(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const response = res.json.mock.calls[0][0];
      expect(response.affiliate).toEqual({
        affiliateId: 'AFF123',
        firstName: 'John',
        lastName: 'Doe',
        businessName: 'Johns Laundry',
        deliveryFee: 5.99,
        serviceArea: '10 miles'
      });
      expect(response.affiliate.email).toBeUndefined();
      expect(response.affiliate.phone).toBeUndefined();
      expect(response.affiliate.accountNumber).toBeUndefined();
    });

    it('should return 404 for non-existent affiliate', async () => {
      req.params.affiliateId = 'NONEXISTENT';

      Affiliate.findOne.mockResolvedValue(null);

      await affiliateController.getPublicAffiliateInfo(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Affiliate not found'
      });
    });
  });

  describe('Error handling', () => {
    it('should handle database connection errors', async () => {
      req.params.affiliateId = 'AFF123';
      req.user = { role: 'admin' };

      Affiliate.findOne.mockRejectedValue(new Error('Database connection lost'));

      await affiliateController.getAffiliateProfile(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'An error occurred while retrieving affiliate profile'
      });
    });
  });
});