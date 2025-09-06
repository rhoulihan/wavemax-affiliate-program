const Customer = require('../../server/models/Customer');
const Affiliate = require('../../server/models/Affiliate');
const Order = require('../../server/models/Order');
const SystemConfig = require('../../server/models/SystemConfig');
const encryptionUtil = require('../../server/utils/encryption');
const emailService = require('../../server/utils/emailService');
const { getFilteredData } = require('../../server/utils/fieldFilter');
const { validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { expectSuccessResponse, expectErrorResponse } = require('../helpers/responseHelpers');
const { extractHandler } = require('../helpers/testUtils');
const { createFindOneMock, createFindMock, createMockDocument, createAggregateMock } = require('../helpers/mockHelpers');

// Mock dependencies
jest.mock('../../server/models/Customer');
jest.mock('../../server/models/Affiliate');
jest.mock('../../server/models/Order');
jest.mock('../../server/models/SystemConfig');
jest.mock('express-validator', () => ({
  validationResult: jest.fn(() => ({
    isEmpty: () => true,
    array: () => []
  }))
}));
jest.mock('../../server/utils/encryption', () => ({
  generateUniqueCustomerId: jest.fn(),
  hashPassword: jest.fn(),
  encryptData: jest.fn(),
  decryptData: jest.fn(),
  verifyPassword: jest.fn()
}));
jest.mock('../../server/utils/emailService');
jest.mock('../../server/utils/fieldFilter');
jest.mock('jsonwebtoken');
jest.mock('uuid', () => ({
  v4: jest.fn()
}));
jest.mock('../../server/utils/formatters', () => ({
  name: jest.fn((name) => name),
  phone: jest.fn((phone) => phone),
  status: jest.fn((status, type) => status),
  date: jest.fn((date, format) => date),
  currency: jest.fn((amount) => `$${amount}`),
  fullName: jest.fn((first, last) => `${first} ${last}`),
  address: jest.fn((addr) => addr),
  formatDeliveryFee: jest.fn((fee) => `$${fee}`),
  weight: jest.fn((weight) => `${weight} lbs`),
  plural: jest.fn((count, noun) => `${count} ${noun}${count !== 1 ? 's' : ''}`),
  relativeTime: jest.fn((date) => '2 days ago')
}));

// Mock ControllerHelpers - IMPORTANT: asyncWrapper should catch errors and pass to next
jest.mock('../../server/utils/controllerHelpers', () => {
  return {
    asyncWrapper: (fn) => (req, res, next) => {
      // The wrapped function only takes (req, res) not next
      return Promise.resolve(fn(req, res)).catch(next);
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
    sendPaginated: (res, items, pagination, itemsKey = 'items') => {
      return res.status(200).json({
        success: true,
        [itemsKey]: items,
        pagination
      });
    },
    sanitizeInput: (input) => input,
    parsePagination: (query, defaults) => ({
      page: parseInt(query?.page) || 1,
      limit: parseInt(query?.limit) || 10,
      skip: ((parseInt(query?.page) || 1) - 1) * (parseInt(query?.limit) || 10),
      sortBy: defaults?.sortBy || '-createdAt'
    }),
    validateRequiredFields: (body, fields) => {
      const missing = fields.filter(f => !body[f]);
      return missing.length > 0 ? missing : null;
    },
    buildQuery: (filters, allowedFields) => {
      // Build MongoDB query from filters
      const query = {};
      if (filters.customerId) {
        query.customerId = filters.customerId;
      }
      return query;
    },
    calculatePagination: (totalItems, page, limit) => ({
      page,
      limit,
      totalItems,
      totalPages: Math.ceil(totalItems / limit),
      hasNext: page < Math.ceil(totalItems / limit),
      hasPrev: page > 1
    })
  };
});

// Mock AuthorizationHelpers
jest.mock('../../server/middleware/authorizationHelpers', () => ({
  checkCustomerAccess: (req, res, next) => {
    // Check if user is authorized to access this customer's data
    if (req.user && (req.user.role === 'admin' || req.user.customerId === req.params.customerId)) {
      return next();
    }
    res.status(403).json({ success: false, message: 'Unauthorized' });
  },
  checkAdminAccess: (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
      return next();
    }
    res.status(403).json({ success: false, message: 'Unauthorized' });
  },
  requireRole: (roles) => (req, res, next) => {
    if (req.user && roles.includes(req.user.role)) {
      return next();
    }
    res.status(403).json({ success: false, message: 'Unauthorized' });
  }
}));

// After all mocks are set up, require the controller
const customerController = require('../../server/controllers/customerController');

// Helper to run middleware chain
async function runMiddlewareChain(middlewareOrFunction, req, res, next) {
  if (Array.isArray(middlewareOrFunction)) {
    for (const middleware of middlewareOrFunction) {
      // Call middleware and check if response was sent
      await middleware(req, res, next);
      if (res.status.mock.calls.length > 0 || res.json.mock.calls.length > 0) {
        break; // Response sent, stop processing
      }
      if (next.mock.calls.length > 0 && next.mock.calls[next.mock.calls.length - 1][0]) {
        break; // Error passed to next, stop processing
      }
    }
  } else {
    await middlewareOrFunction(req, res, next);
  }
}

describe('Customer Controller', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      body: {},
      params: {},
      user: {}
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  describe('registerCustomer', () => {
    beforeEach(() => {
      // Mock validation result to return no errors  
      const { validationResult: mockValidationResult } = require('express-validator');
      mockValidationResult.mockImplementation(() => ({
        isEmpty: () => true,
        array: () => []
      }));
    });

    it('should successfully register a new customer', async () => {
      const mockAffiliate = {
        affiliateId: 'AFF123',
        firstName: 'John',
        lastName: 'Doe',
        businessName: 'Test Business',
        deliveryFee: 5.99,
        minimumDeliveryFee: 10.00,
        perBagDeliveryFee: 2.50
,
      save: jest.fn().mockResolvedValue(true)};

      req.body = {
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@example.com',
        phone: '555-123-4567',
        address: '123 Main St',
        city: 'Austin',
        state: 'TX',
        zipCode: '78701',
        serviceFrequency: 'weekly',
        username: 'janesmith',
        password: 'securepassword123',
        affiliateId: 'AFF123',
        numberOfBags: 2
      };

      const mockCustomer = createMockDocument({
        customerId: 'CUST-123456',
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@example.com',
        affiliateId: 'AFF123',
        numberOfBags: 2,
        bagCredit: 20.00
      });
      mockCustomer.save.mockResolvedValue(mockCustomer);

      Affiliate.findOne = jest.fn().mockResolvedValue(mockAffiliate);
      Customer.findOne = jest.fn().mockResolvedValue(null);
      encryptionUtil.generateUniqueCustomerId.mockResolvedValue('CUST123456');
      encryptionUtil.hashPassword.mockReturnValue({
        hash: 'hashedPassword',
        salt: 'salt'
      });

      // Mock the Customer constructor to return our mockCustomer
      Customer.mockImplementation(() => mockCustomer);

      // Mock SystemConfig for bag fee
      SystemConfig.getValue.mockResolvedValue(10.00);

      emailService.sendCustomerWelcomeEmail.mockResolvedValue();
      emailService.sendAffiliateNewCustomerEmail.mockResolvedValue();
      
      // Mock JWT sign
      jwt.sign.mockReturnValue('mock-jwt-token');
      
      // Mock UUID
      uuidv4.mockReturnValue('123456');

      try {
        await customerController.registerCustomer(req, res, next);
      } catch (error) {
        console.error('Error calling registerCustomer:', error);
        throw error;
      }

      expect(Affiliate.findOne).toHaveBeenCalledWith({ affiliateId: 'AFF123' });
      expect(Customer.findOne).toHaveBeenCalledWith({
        $or: [{ email: 'jane@example.com' }, { username: 'janesmith' }]
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expectSuccessResponse(
          {
            customerId: 'CUST-123456',
            token: 'mock-jwt-token'
          },
          'Customer registration successful'
        )
      );
    });

    it('should return error for invalid affiliate', async () => {
      const next = jest.fn();
      req.body = {
        affiliateId: 'INVALID'
      };

      Affiliate.findOne = createFindOneMock(null);
      Affiliate.findOne.mockResolvedValue(null);

      await customerController.registerCustomer(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expectErrorResponse('Invalid affiliate ID')
      );
    });

    it('should return error for duplicate email', async () => {
      const mockAffiliate = { 
        affiliateId: 'AFF123',
        save: jest.fn().mockResolvedValue(true)
      };
      const existingCustomer = { email: 'jane@example.com' };

      req.body = {
        email: 'jane@example.com',
        username: 'newusername',
        affiliateId: 'AFF123'
      };

      Affiliate.findOne = createFindOneMock(mockAffiliate);
      Affiliate.findOne.mockResolvedValue(mockAffiliate);
      Customer.findOne = createFindOneMock(existingCustomer);
      Customer.findOne = createFindOneMock(existingCustomer);

      await customerController.registerCustomer(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expectErrorResponse('Email or username already in use')
      );
    });
  });

  describe('getCustomerProfile', () => {
    it('should return customer profile for authorized customer', async () => {
      const mockCustomerData = {
        customerId: 'CUST123',
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@example.com',
        phone: '555-123-4567',
        address: '123 Main St',
        city: 'Austin',
        state: 'TX',
        zipCode: '78701',
        serviceFrequency: 'weekly',
        affiliateId: 'AFF123'
,
      save: jest.fn().mockResolvedValue(true)};

      const mockCustomer = createMockDocument(mockCustomerData);

      const mockAffiliateData = {
        affiliateId: 'AFF123',
        firstName: 'John',
        lastName: 'Doe',
        deliveryFee: 5.99
,
      save: jest.fn().mockResolvedValue(true)};

      const mockAffiliate = createMockDocument(mockAffiliateData);


      req.params.customerId = 'CUST123';
      req.user = { role: 'customer', customerId: 'CUST123' };

      // Use createFindOneMock which handles chaining properly
      Customer.findOne = createFindOneMock(mockCustomer);
      Affiliate.findOne = createFindOneMock(mockAffiliate);

      // Mock getFilteredData to return expected data
      getFilteredData.mockImplementation((type, data, role, options) => {
        if (type === 'customer') {
          // Return customer data with affiliate nested
          return {
            ...mockCustomerData,
            affiliate: {
              affiliateId: mockAffiliateData.affiliateId,
              name: `${mockAffiliateData.firstName} ${mockAffiliateData.lastName}`,
              deliveryFee: mockAffiliateData.deliveryFee
            }
          };
        }
        if (type === 'affiliate') {
          return {
            affiliateId: mockAffiliateData.affiliateId,
            name: `${mockAffiliateData.firstName} ${mockAffiliateData.lastName}`,
            deliveryFee: mockAffiliateData.deliveryFee
          };
        }
        if (type === 'bag') {
          return data;
        }
        return data;
      });

      await runMiddlewareChain(customerController.getCustomerProfile, req, res, next);

      expect(Customer.findOne).toHaveBeenCalledWith({ customerId: 'CUST123' });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalled();
      expect(res.json.mock.calls[0][0].success).toBe(true);
      expect(res.json.mock.calls[0][0].customer).toBeDefined();
      expect(res.json.mock.calls[0][0].customer.customerId).toBe('CUST123');
    });

    it('should return 403 for unauthorized access', async () => {
      const next = jest.fn();
      req.params.customerId = 'CUST123';
      req.user = { role: 'customer', customerId: 'CUST456' }; // Different user

      // For middleware arrays, we need to run all middleware
      if (Array.isArray(customerController.getCustomerProfile)) {
        for (const middleware of customerController.getCustomerProfile) {
          await middleware(req, res, next);
          // If response was sent, stop processing
          if (res.status.mock.calls.length > 0) break;
        }
      } else {
        await customerController.getCustomerProfile(req, res, next);
      }

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expectErrorResponse('Unauthorized')
      );
    });

    it('should return 404 for non-existent customer', async () => {
      const next = jest.fn();
      req.params.customerId = 'NONEXISTENT';
      req.user = { role: 'admin' };

      Customer.findOne = createFindOneMock(null);

      await runMiddlewareChain(customerController.getCustomerProfile, req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expectErrorResponse('Customer not found')
      );
    });
  });

  describe('updateCustomerProfile', () => {
    it('should successfully update customer profile', async () => {
      const mockCustomer = {
        customerId: 'CUST123',
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@example.com',
        phone: '555-123-4567',
        address: '123 Main St',
        city: 'Austin',
        state: 'TX',
        zipCode: '78701',
        save: jest.fn().mockResolvedValue(true),
        toObject: jest.fn().mockReturnValue({
          customerId: 'CUST123',
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane@example.com',
          phone: '555-123-4567',
          address: '123 Main St',
          city: 'Austin',
          state: 'TX',
          zipCode: '78701'
        })
      };

      req.params.customerId = 'CUST123';
      req.user = { role: 'customer', customerId: 'CUST123' };
      req.body = {
        phone: '555-987-6543',
        address: '456 Oak Ave'
      };

      Customer.findOne = jest.fn().mockResolvedValue(mockCustomer);

      await runMiddlewareChain(customerController.updateCustomerProfile, req, res, next);
      
      // The controller should modify the object properties
      expect(mockCustomer.save).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expectSuccessResponse({ customer: expect.any(Object) }, 'Profile updated successfully')
      );
    });

    it('should prevent updating protected fields', async () => {
      const mockCustomer = {
        customerId: 'CUST123',
        username: 'originalusername',
        email: 'original@example.com',
        affiliateId: 'AFF123',
        firstName: 'John',
        lastName: 'Doe',
        save: jest.fn().mockResolvedValue(true),
        toObject: jest.fn().mockImplementation(function() {
          return {
            customerId: this.customerId,
            username: this.username,
            email: this.email,
            affiliateId: this.affiliateId,
            firstName: this.firstName,
            lastName: this.lastName
          };
        })
      };

      req.params.customerId = 'CUST123';
      req.user = { role: 'customer', customerId: 'CUST123' };
      req.body = {
        customerId: 'CUST999',
        username: 'newusername',
        email: 'new@example.com',
        affiliateId: 'AFF999',
        firstName: 'Jane'  // Include one valid field to update
      };

      Customer.findOne = jest.fn().mockResolvedValue(mockCustomer);

      await runMiddlewareChain(customerController.updateCustomerProfile, req, res, next);

      // Protected fields should not change
      expect(mockCustomer.customerId).toBe('CUST123');
      expect(mockCustomer.username).toBe('originalusername');
      expect(mockCustomer.email).toBe('original@example.com');  // Email is not updatable
      expect(mockCustomer.affiliateId).toBe('AFF123');
      
      // The controller should have called save and returned success
      expect(mockCustomer.save).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expectSuccessResponse({ customer: expect.any(Object) }, 'Profile updated successfully')
      );
    });
  });

  describe('getCustomerOrders', () => {
    it('should return customer orders with pagination', async () => {
      const mockCustomer = { customerId: 'CUST123', affiliateId: 'AFF123' ,
      save: jest.fn().mockResolvedValue(true)};
      const mockOrders = [
        {
          orderId: 'ORD001',
          customerId: 'CUST123',
          status: 'complete',
          toObject: jest.fn().mockReturnValue({ orderId: 'ORD001', customerId: 'CUST123', status: 'complete' })
        },
        {
          orderId: 'ORD002',
          customerId: 'CUST123',
          status: 'processing',
          toObject: jest.fn().mockReturnValue({ orderId: 'ORD002', customerId: 'CUST123', status: 'processing' })
        }
      ];

      req.params.customerId = 'CUST123';
      req.user = { role: 'customer', customerId: 'CUST123' };
      req.query = { page: 1, limit: 10 };

      Customer.findOne = jest.fn().mockResolvedValue(mockCustomer);

      const mockOrderQuery = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(mockOrders)
      };

      Order.find = jest.fn().mockReturnValue(mockOrderQuery);
      Order.countDocuments = jest.fn().mockResolvedValue(2);

      // Setup getFilteredData mock
      getFilteredData.mockImplementation((type, data) => data);

      await runMiddlewareChain(customerController.getCustomerOrders, req, res, next);

      expect(Order.find).toHaveBeenCalledWith({ customerId: 'CUST123' });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        orders: expect.any(Array),
        pagination: expect.objectContaining({
          page: 1,
          limit: 10,
          totalItems: 2,
          totalPages: 1
        })
      }));
    });
  });


  describe('deleteCustomerData', () => {
    beforeEach(() => {
      req.user = { customerId: 'CUST123' };
      req.params = { customerId: 'CUST123' };
    });

    it('should delete all customer data when authorized', async () => {
      const mockCustomer = { _id: 'customer_id', customerId: 'CUST123',
        save: jest.fn().mockResolvedValue(true)
      };

      Customer.findOne = jest.fn().mockResolvedValue(mockCustomer);
      Order.countDocuments = jest.fn().mockResolvedValue(0); // No active orders
      Order.deleteMany = jest.fn().mockResolvedValue({ deletedCount: 3 });
      Customer.deleteOne = jest.fn().mockResolvedValue({ deletedCount: 1 });

      const handler = extractHandler(customerController.deleteCustomerData);
      await handler(req, res, next);

      expect(Order.countDocuments).toHaveBeenCalledWith({
        customerId: 'CUST123',
        status: { $in: ['pending', 'scheduled', 'processing', 'processed'] }
      });
      expect(Order.deleteMany).toHaveBeenCalledWith({ customerId: 'CUST123' });
      expect(Customer.deleteOne).toHaveBeenCalledWith({ customerId: 'CUST123' });

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expectSuccessResponse({
          message: 'Customer account deleted successfully'
        }, 'Customer account deleted successfully')
      );
    });

    it('should reject deletion when there are active orders', async () => {
      const next = jest.fn();
      
      Order.countDocuments = jest.fn().mockResolvedValue(2); // Has 2 active orders

      const handler = extractHandler(customerController.deleteCustomerData);
      await handler(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expectErrorResponse('Cannot delete account with 2 active orders')
      );
    });

    it('should reject unauthorized deletion', async () => {
      req.user.customerId = 'CUST456'; // Different user
      req.params.customerId = 'CUST123';

      const handler = extractHandler(customerController.deleteCustomerData);
      await handler(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expectErrorResponse('Unauthorized to delete this account')
      );
    });

    it('should handle deletion errors', async () => {
      const next = jest.fn();
      req.params.customerId = 'CUST123';
      req.user.customerId = 'CUST123';

      Order.countDocuments = jest.fn().mockRejectedValue(new Error('Database error'));

      const handler = extractHandler(customerController.deleteCustomerData);
      await handler(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('registerCustomer with missing payment info', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      // Re-setup req, res, next for this test
      req = {
        body: {},
        params: {},
        user: {}
      };
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      next = jest.fn();
      
      // Mock validation result to return no errors  
      const { validationResult: mockValidationResult } = require('express-validator');
      mockValidationResult.mockImplementation(() => ({
        isEmpty: () => true,
        array: () => []
      }));
    });

    it('should handle missing payment info gracefully', async () => {
      const mockAffiliate = { 
        affiliateId: 'AFF123',
        businessName: 'Test Business',
        save: jest.fn().mockResolvedValue(true)
      };

      req.body = {
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        username: 'testuser',
        password: 'password123',
        phone: '555-123-4567',
        address: '123 Test St',
        city: 'Austin',
        state: 'TX',
        zipCode: '78701',
        affiliateId: 'AFF123',
        savePaymentInfo: false
      };

      const mockCustomer = {
        customerId: 'CUST999',
        email: 'test@example.com',
        save: jest.fn().mockResolvedValue(true)
      };

      Affiliate.findOne = jest.fn().mockResolvedValue(mockAffiliate);
      Customer.findOne = jest.fn().mockResolvedValue(null); // No existing customer
      Customer.mockImplementation(() => mockCustomer);
      SystemConfig.getValue = jest.fn().mockResolvedValue(10.00);
      encryptionUtil.generateUniqueCustomerId = jest.fn().mockResolvedValue('CUST999');
      encryptionUtil.hashPassword = jest.fn().mockReturnValue({ hash: 'hash', salt: 'salt' });
      jwt.sign = jest.fn().mockReturnValue('mock-token');
      uuidv4.mockReturnValue('123456');
      emailService.sendCustomerWelcomeEmail = jest.fn().mockResolvedValue(true);
      emailService.sendAffiliateNewCustomerEmail = jest.fn().mockResolvedValue(true);

      // Call the controller function directly
      await customerController.registerCustomer(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(mockCustomer.savePaymentInfo).toBeUndefined();
    });
  });
});
