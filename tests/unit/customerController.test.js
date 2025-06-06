const customerController = require('../../server/controllers/customerController');
const Customer = require('../../server/models/Customer');
const Affiliate = require('../../server/models/Affiliate');
const Order = require('../../server/models/Order');
const SystemConfig = require('../../server/models/SystemConfig');
const encryptionUtil = require('../../server/utils/encryption');
const emailService = require('../../server/utils/emailService');
const { getFilteredData } = require('../../server/utils/fieldFilter');
const { validationResult } = require('express-validator');

// Mock dependencies
jest.mock('../../server/models/Customer');
jest.mock('../../server/models/Affiliate');
jest.mock('../../server/models/Order');
jest.mock('../../server/models/SystemConfig');
jest.mock('express-validator');
jest.mock('../../server/utils/encryption', () => ({
  generateUniqueCustomerId: jest.fn(),
  hashPassword: jest.fn(),
  encryptData: jest.fn(),
  decryptData: jest.fn()
}));
jest.mock('../../server/utils/emailService');
jest.mock('../../server/utils/fieldFilter');

describe('Customer Controller', () => {
  let req, res;

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
    jest.clearAllMocks();
  });

  describe('registerCustomer', () => {
    beforeEach(() => {
      // Mock validation result to return no errors
      validationResult.mockReturnValue({
        isEmpty: () => true,
        array: () => []
      });
    });

    it('should successfully register a new customer', async () => {
      const mockAffiliate = {
        affiliateId: 'AFF123',
        firstName: 'John',
        lastName: 'Doe',
        deliveryFee: 5.99
      };

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

      const mockCustomer = {
        customerId: 'CUST123456',
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@example.com',
        affiliateId: 'AFF123',
        save: jest.fn().mockResolvedValue(true)
      };


      Affiliate.findOne.mockResolvedValue(mockAffiliate);
      Customer.findOne.mockResolvedValue(null);
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

      await customerController.registerCustomer(req, res);

      expect(Affiliate.findOne).toHaveBeenCalledWith({ affiliateId: 'AFF123' });
      expect(Customer.findOne).toHaveBeenCalledWith({
        $or: [{ email: 'jane@example.com' }, { username: 'janesmith' }]
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        customerId: 'CUST123456',
        customerData: expect.objectContaining({
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane@example.com',
          affiliateId: 'AFF123',
          affiliateName: 'John Doe',
          minimumDeliveryFee: undefined,
          perBagDeliveryFee: undefined
        }),
        message: 'Customer registered successfully!'
      });
    });

    it('should return error for invalid affiliate', async () => {
      req.body = {
        affiliateId: 'INVALID'
      };

      Affiliate.findOne.mockResolvedValue(null);

      await customerController.registerCustomer(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid affiliate ID'
      });
    });

    it('should return error for duplicate email', async () => {
      const mockAffiliate = { affiliateId: 'AFF123' };
      const existingCustomer = { email: 'jane@example.com' };

      req.body = {
        email: 'jane@example.com',
        username: 'newusername',
        affiliateId: 'AFF123'
      };

      Affiliate.findOne.mockResolvedValue(mockAffiliate);
      Customer.findOne.mockResolvedValue(existingCustomer);

      await customerController.registerCustomer(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Email or username already in use'
      });
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
      };

      const mockCustomer = {
        ...mockCustomerData,
        toObject: jest.fn().mockReturnValue(mockCustomerData)
      };

      const mockAffiliateData = {
        affiliateId: 'AFF123',
        firstName: 'John',
        lastName: 'Doe',
        deliveryFee: 5.99
      };

      const mockAffiliate = {
        ...mockAffiliateData,
        toObject: jest.fn().mockReturnValue(mockAffiliateData)
      };


      req.params.customerId = 'CUST123';
      req.user = { role: 'customer', customerId: 'CUST123' };

      Customer.findOne.mockResolvedValue(mockCustomer);
      Affiliate.findOne.mockResolvedValue(mockAffiliate);

      // Mock getFilteredData to return expected data
      getFilteredData.mockImplementation((type, data, role, options) => {
        if (type === 'customer') {
          return mockCustomerData;
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

      await customerController.getCustomerProfile(req, res);

      expect(Customer.findOne).toHaveBeenCalledWith({ customerId: 'CUST123' });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        customer: expect.objectContaining({
          customerId: 'CUST123',
          firstName: 'Jane',
          lastName: 'Smith',
          affiliate: expect.objectContaining({
            affiliateId: 'AFF123',
            name: 'John Doe',
            deliveryFee: 5.99
          })
        })
      });
    });

    it('should return 403 for unauthorized access', async () => {
      req.params.customerId = 'CUST123';
      req.user = { role: 'customer', customerId: 'CUST456' };

      Customer.findOne.mockResolvedValue({ customerId: 'CUST123' });

      await customerController.getCustomerProfile(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Unauthorized'
      });
    });

    it('should return 404 for non-existent customer', async () => {
      req.params.customerId = 'NONEXISTENT';
      req.user = { role: 'admin' };

      Customer.findOne.mockResolvedValue(null);

      await customerController.getCustomerProfile(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Customer not found'
      });
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
        save: jest.fn()
      };

      req.params.customerId = 'CUST123';
      req.user = { role: 'customer', customerId: 'CUST123' };
      req.body = {
        phone: '555-987-6543',
        address: '456 Oak Ave'
      };

      Customer.findOne.mockResolvedValue(mockCustomer);

      await customerController.updateCustomerProfile(req, res);

      expect(mockCustomer.phone).toBe('555-987-6543');
      expect(mockCustomer.address).toBe('456 Oak Ave');
      expect(mockCustomer.save).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Customer profile updated successfully!'
      });
    });

    it('should prevent updating protected fields', async () => {
      const mockCustomer = {
        customerId: 'CUST123',
        username: 'originalusername',
        email: 'original@example.com',
        affiliateId: 'AFF123',
        save: jest.fn()
      };

      req.params.customerId = 'CUST123';
      req.user = { role: 'customer', customerId: 'CUST123' };
      req.body = {
        customerId: 'CUST999',
        username: 'newusername',
        email: 'new@example.com',
        affiliateId: 'AFF999'
      };

      Customer.findOne.mockResolvedValue(mockCustomer);

      await customerController.updateCustomerProfile(req, res);

      expect(mockCustomer.customerId).toBe('CUST123');
      expect(mockCustomer.username).toBe('originalusername');
      expect(mockCustomer.email).toBe('original@example.com');  // Email is not updatable
      expect(mockCustomer.affiliateId).toBe('AFF123');
      expect(mockCustomer.save).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('getCustomerOrders', () => {
    it('should return customer orders with pagination', async () => {
      const mockCustomer = { customerId: 'CUST123', affiliateId: 'AFF123' };
      const mockOrders = [
        { 
          orderId: 'ORD001', 
          customerId: 'CUST123', 
          status: 'delivered',
          toObject: jest.fn().mockReturnValue({ orderId: 'ORD001', customerId: 'CUST123', status: 'delivered' })
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

      Customer.findOne.mockResolvedValue(mockCustomer);

      const mockOrderQuery = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(mockOrders)
      };

      Order.find.mockReturnValue(mockOrderQuery);
      Order.countDocuments.mockResolvedValue(2);
      
      // Setup getFilteredData mock
      getFilteredData.mockImplementation((type, data) => data);

      await customerController.getCustomerOrders(req, res);

      expect(Order.find).toHaveBeenCalledWith({ customerId: 'CUST123' });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        orders: expect.arrayContaining([
          expect.objectContaining({ orderId: 'ORD001' }),
          expect.objectContaining({ orderId: 'ORD002' })
        ]),
        pagination: {
          total: 2,
          page: 1,
          currentPage: 1,
          limit: 10,
          perPage: 10,
          pages: 1
        }
      });
    });
  });


  describe('deleteCustomerData', () => {
    beforeEach(() => {
      req.user = { customerId: 'CUST123' };
      req.params = { customerId: 'CUST123' };
    });

    it('should delete all customer data in development environment', async () => {
      process.env.ENABLE_DELETE_DATA_FEATURE = 'true';
      const mockCustomer = { _id: 'customer_id', customerId: 'CUST123' };

      Customer.findOne.mockResolvedValue(mockCustomer);
      Order.deleteMany.mockResolvedValue({ deletedCount: 3 });
      Customer.deleteOne.mockResolvedValue({ deletedCount: 1 });

      await customerController.deleteCustomerData(req, res);

      expect(Order.deleteMany).toHaveBeenCalledWith({ customerId: 'CUST123' });
      expect(Customer.deleteOne).toHaveBeenCalledWith({ customerId: 'CUST123' });

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'All data has been deleted successfully',
        deletedData: {
          customer: 1,
          orders: 3
        }
      });
    });

    it('should reject deletion in production environment', async () => {
      process.env.ENABLE_DELETE_DATA_FEATURE = 'false';

      await customerController.deleteCustomerData(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'This operation is not allowed'
      });
    });

    it('should reject unauthorized deletion', async () => {
      process.env.ENABLE_DELETE_DATA_FEATURE = 'true';
      req.user.customerId = 'CUST456';
      req.params.customerId = 'CUST123';

      Customer.findOne.mockResolvedValue({ customerId: 'CUST123' });

      await customerController.deleteCustomerData(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'You can only delete your own data'
      });
    });

    it('should handle deletion errors', async () => {
      process.env.ENABLE_DELETE_DATA_FEATURE = 'true';
      req.params.customerId = 'CUST123';

      Customer.findOne.mockRejectedValue(new Error('Database error'));

      await customerController.deleteCustomerData(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'An error occurred while deleting data'
      });
    });
  });
});
