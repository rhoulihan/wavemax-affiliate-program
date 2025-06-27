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

    it('should return 404 for non-existent customer', async () => {
      process.env.ENABLE_DELETE_DATA_FEATURE = 'true';

      Customer.findOne.mockResolvedValue(null);

      await customerController.deleteCustomerData(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Customer not found'
      });
    });
  });

  describe('getCustomerDashboardStats', () => {
    it('should return dashboard stats for authorized customer', async () => {
      const mockCustomer = {
        customerId: 'CUST123',
        affiliateId: 'AFF123',
        bagCredit: 20.00,
        bagCreditApplied: true,
        numberOfBags: 2
      };

      const mockAffiliate = {
        affiliateId: 'AFF123',
        firstName: 'John',
        lastName: 'Doe',
        minimumDeliveryFee: 5.00,
        perBagDeliveryFee: 2.50
      };

      const mockOrders = [
        {
          orderId: 'ORD001',
          customerId: 'CUST123',
          status: 'complete',
          actualTotal: 50,
          createdAt: new Date('2024-01-01'),
          deliveredAt: new Date('2024-01-02')
        },
        {
          orderId: 'ORD002',
          customerId: 'CUST123',
          status: 'complete',
          estimatedTotal: 75,
          createdAt: new Date('2024-01-10')
        },
        {
          orderId: 'ORD003',
          customerId: 'CUST123',
          status: 'processing',
          estimatedTotal: 60,
          createdAt: new Date('2024-01-15')
        },
        {
          orderId: 'ORD004',
          customerId: 'CUST123',
          status: 'scheduled',
          pickupDate: new Date('2024-02-01'),
          pickupTime: '10:00 AM',
          estimatedSize: 'Large',
          estimatedTotal: 80,
          createdAt: new Date('2024-01-20')
        }
      ];

      const mockUpcomingPickups = [{
        orderId: 'ORD004',
        pickupDate: new Date('2024-02-01'),
        pickupTime: '10:00 AM',
        estimatedSize: 'Large',
        estimatedTotal: 80
      }];

      req.params.customerId = 'CUST123';
      req.user = { role: 'customer', customerId: 'CUST123' };

      Customer.findOne.mockResolvedValue(mockCustomer);
      Affiliate.findOne.mockResolvedValue(mockAffiliate);
      
      // Mock Order.find for all orders
      const orderFindMock = {
        sort: jest.fn().mockResolvedValue(mockOrders)
      };
      Order.find.mockImplementation((query) => {
        if (query.status === 'scheduled') {
          return {
            sort: jest.fn().mockReturnThis(),
            limit: jest.fn().mockResolvedValue(mockUpcomingPickups)
          };
        }
        return orderFindMock;
      });

      await customerController.getCustomerDashboardStats(req, res);

      expect(Customer.findOne).toHaveBeenCalledWith({ customerId: 'CUST123' });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        dashboard: {
          statistics: {
            totalOrders: 4,
            completedOrders: 2,
            activeOrders: 2,
            totalSpent: 125,
            averageOrderValue: 62.5,
            lastOrderDate: expect.any(Date)
          },
          recentOrders: expect.arrayContaining([
            expect.objectContaining({ orderId: 'ORD001' }),
            expect.objectContaining({ orderId: 'ORD002' }),
            expect.objectContaining({ orderId: 'ORD003' }),
            expect.objectContaining({ orderId: 'ORD004' })
          ]),
          upcomingPickups: expect.arrayContaining([
            expect.objectContaining({
              orderId: 'ORD004',
              pickupTime: '10:00 AM'
            })
          ]),
          affiliate: {
            affiliateId: 'AFF123',
            firstName: 'John',
            lastName: 'Doe',
            minimumDeliveryFee: 5.00,
            perBagDeliveryFee: 2.50
          },
          bagCredit: {
            amount: 20.00,
            applied: true,
            numberOfBags: 2
          }
        }
      });
    });

    it('should return 404 for non-existent customer', async () => {
      req.params.customerId = 'NONEXISTENT';
      req.user = { role: 'admin' };

      Customer.findOne.mockResolvedValue(null);

      await customerController.getCustomerDashboardStats(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Customer not found'
      });
    });

    it('should return 403 for unauthorized access', async () => {
      req.params.customerId = 'CUST123';
      req.user = { role: 'customer', customerId: 'CUST456' };

      Customer.findOne.mockResolvedValue({ customerId: 'CUST123', affiliateId: 'AFF999' });

      await customerController.getCustomerDashboardStats(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Unauthorized'
      });
    });

    it('should allow affiliate access to their customer dashboard', async () => {
      const mockCustomer = {
        customerId: 'CUST123',
        affiliateId: 'AFF123',
        bagCredit: 0,
        bagCreditApplied: false,
        numberOfBags: 1
      };

      req.params.customerId = 'CUST123';
      req.user = { role: 'affiliate', affiliateId: 'AFF123' };

      Customer.findOne.mockResolvedValue(mockCustomer);
      Order.find.mockImplementation((query) => {
        if (query.status === 'scheduled') {
          return {
            sort: jest.fn().mockReturnThis(),
            limit: jest.fn().mockResolvedValue([])
          };
        }
        // For general query (all orders)
        return {
          sort: jest.fn().mockResolvedValue([])
        };
      });
      Affiliate.findOne.mockResolvedValue(null);

      await customerController.getCustomerDashboardStats(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        dashboard: expect.objectContaining({
          statistics: expect.objectContaining({
            totalOrders: 0,
            completedOrders: 0,
            activeOrders: 0,
            totalSpent: 0,
            averageOrderValue: 0
          })
        })
      });
    });

    it('should handle database errors gracefully', async () => {
      req.params.customerId = 'CUST123';
      req.user = { role: 'admin' };

      Customer.findOne.mockRejectedValue(new Error('Database error'));

      await customerController.getCustomerDashboardStats(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'An error occurred while retrieving dashboard statistics'
      });
    });
  });

  describe('updatePaymentInfo', () => {
    it('should successfully update payment information', async () => {
      const mockCustomer = {
        customerId: 'CUST123',
        save: jest.fn()
      };

      req.params.customerId = 'CUST123';
      req.user = { role: 'customer', customerId: 'CUST123' };
      req.body = {
        cardholderName: 'Jane Smith',
        cardNumber: '4111111111111111',
        expiryDate: '12/25',
        billingZip: '78701'
      };

      Customer.findOne.mockResolvedValue(mockCustomer);

      await customerController.updatePaymentInfo(req, res);

      expect(mockCustomer.cardholderName).toBe('Jane Smith');
      expect(mockCustomer.lastFourDigits).toBe('1111');
      expect(mockCustomer.expiryDate).toBe('12/25');
      expect(mockCustomer.billingZip).toBe('78701');
      expect(mockCustomer.savePaymentInfo).toBe(true);
      expect(mockCustomer.save).toHaveBeenCalled();

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Payment information updated successfully',
        lastFourDigits: '1111'
      });
    });

    it('should return 404 for non-existent customer', async () => {
      req.params.customerId = 'NONEXISTENT';
      req.user = { role: 'admin' };

      Customer.findOne.mockResolvedValue(null);

      await customerController.updatePaymentInfo(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Customer not found'
      });
    });

    it('should return 403 for unauthorized access', async () => {
      req.params.customerId = 'CUST123';
      req.user = { role: 'customer', customerId: 'CUST456' };

      Customer.findOne.mockResolvedValue({ customerId: 'CUST123' });

      await customerController.updatePaymentInfo(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Unauthorized'
      });
    });

    it('should allow admin to update customer payment info', async () => {
      const mockCustomer = {
        customerId: 'CUST123',
        save: jest.fn()
      };

      req.params.customerId = 'CUST123';
      req.user = { role: 'admin' };
      req.body = {
        cardholderName: 'Admin Update',
        cardNumber: '5555555555554444',
        expiryDate: '06/26',
        billingZip: '12345'
      };

      Customer.findOne.mockResolvedValue(mockCustomer);

      await customerController.updatePaymentInfo(req, res);

      expect(mockCustomer.lastFourDigits).toBe('4444');
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should handle database errors', async () => {
      req.params.customerId = 'CUST123';
      req.user = { role: 'admin' };

      Customer.findOne.mockRejectedValue(new Error('Database error'));

      await customerController.updatePaymentInfo(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'An error occurred while updating payment information'
      });
    });
  });

  describe('updateCustomerPassword', () => {
    it('should successfully update password', async () => {
      const mockCustomer = {
        customerId: 'CUST123',
        passwordSalt: 'oldsalt',
        passwordHash: 'oldhash',
        save: jest.fn()
      };

      req.params.customerId = 'CUST123';
      req.user = { role: 'customer', customerId: 'CUST123' };
      req.body = {
        currentPassword: 'oldpassword',
        newPassword: 'newpassword123'
      };

      Customer.findOne.mockResolvedValue(mockCustomer);
      encryptionUtil.verifyPassword = jest.fn().mockReturnValue(true);
      encryptionUtil.hashPassword.mockReturnValue({
        salt: 'newsalt',
        hash: 'newhash'
      });

      await customerController.updateCustomerPassword(req, res);

      expect(encryptionUtil.verifyPassword).toHaveBeenCalledWith(
        'oldpassword',
        'oldsalt',
        'oldhash'
      );
      expect(mockCustomer.passwordSalt).toBe('newsalt');
      expect(mockCustomer.passwordHash).toBe('newhash');
      expect(mockCustomer.save).toHaveBeenCalled();

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Password updated successfully'
      });
    });

    it('should reject incorrect current password', async () => {
      const mockCustomer = {
        customerId: 'CUST123',
        passwordSalt: 'salt',
        passwordHash: 'hash'
      };

      req.params.customerId = 'CUST123';
      req.user = { role: 'customer', customerId: 'CUST123' };
      req.body = {
        currentPassword: 'wrongpassword',
        newPassword: 'newpassword123'
      };

      Customer.findOne.mockResolvedValue(mockCustomer);
      encryptionUtil.verifyPassword = jest.fn().mockReturnValue(false);

      await customerController.updateCustomerPassword(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Current password is incorrect'
      });
    });

    it('should validate new password length', async () => {
      const mockCustomer = {
        customerId: 'CUST123',
        passwordSalt: 'salt',
        passwordHash: 'hash'
      };

      req.params.customerId = 'CUST123';
      req.user = { role: 'customer', customerId: 'CUST123' };
      req.body = {
        currentPassword: 'oldpass',
        newPassword: 'short'
      };

      Customer.findOne.mockResolvedValue(mockCustomer);
      encryptionUtil.verifyPassword = jest.fn().mockReturnValue(true);

      await customerController.updateCustomerPassword(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'New password must be at least 8 characters long'
      });
    });

    it('should return 404 for non-existent customer', async () => {
      req.params.customerId = 'NONEXISTENT';
      req.user = { role: 'admin' };

      Customer.findOne.mockResolvedValue(null);

      await customerController.updateCustomerPassword(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Customer not found'
      });
    });

    it('should return 403 for unauthorized access', async () => {
      req.params.customerId = 'CUST123';
      req.user = { role: 'customer', customerId: 'CUST456' };

      Customer.findOne.mockResolvedValue({ customerId: 'CUST123' });

      await customerController.updateCustomerPassword(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Unauthorized'
      });
    });

    it('should handle missing new password', async () => {
      const mockCustomer = {
        customerId: 'CUST123',
        passwordSalt: 'salt',
        passwordHash: 'hash'
      };

      req.params.customerId = 'CUST123';
      req.user = { role: 'customer', customerId: 'CUST123' };
      req.body = {
        currentPassword: 'oldpass',
        newPassword: ''
      };

      Customer.findOne.mockResolvedValue(mockCustomer);
      encryptionUtil.verifyPassword = jest.fn().mockReturnValue(true);

      await customerController.updateCustomerPassword(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'New password must be at least 8 characters long'
      });
    });

    it('should handle database errors', async () => {
      req.params.customerId = 'CUST123';
      req.user = { role: 'admin' };

      Customer.findOne.mockRejectedValue(new Error('Database error'));

      await customerController.updateCustomerPassword(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'An error occurred while updating password'
      });
    });
  });

  describe('getCustomersForAdmin', () => {
    beforeEach(() => {
      req.user = { role: 'admin' };
    });

    it('should return all customers for admin', async () => {
      const mockCustomers = [
        { customerId: 'CUST001', firstName: 'John', lastName: 'Doe', affiliateId: 'AFF001', toObject: jest.fn().mockReturnThis() },
        { customerId: 'CUST002', firstName: 'Jane', lastName: 'Smith', affiliateId: 'AFF002', toObject: jest.fn().mockReturnThis() }
      ];

      const mockAffiliates = [
        { affiliateId: 'AFF001', businessName: 'Biz1', firstName: 'Aff', lastName: 'One' },
        { affiliateId: 'AFF002', businessName: 'Biz2', firstName: 'Aff', lastName: 'Two' }
      ];

      const mockOrderCounts = [
        { _id: 'CUST001', count: 5 },
        { _id: 'CUST002', count: 0 }
      ];

      req.query = {};

      Customer.find.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(mockCustomers)
      });

      Affiliate.find.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockAffiliates)
      });

      Order.aggregate.mockResolvedValue(mockOrderCounts);

      await customerController.getCustomersForAdmin(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        customers: expect.arrayContaining([
          expect.objectContaining({
            customerId: 'CUST001',
            orderCount: 5,
            affiliate: expect.objectContaining({ affiliateId: 'AFF001' })
          }),
          expect.objectContaining({
            customerId: 'CUST002',
            orderCount: 0,
            affiliate: expect.objectContaining({ affiliateId: 'AFF002' })
          })
        ]),
        total: 2
      });
    });

    it('should filter customers by search query', async () => {
      req.query = { search: 'john' };

      const mockCustomers = [
        { customerId: 'CUST001', firstName: 'John', lastName: 'Doe', affiliateId: 'AFF001', toObject: jest.fn().mockReturnThis() }
      ];

      Customer.find.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(mockCustomers)
      });

      Affiliate.find.mockReturnValue({
        select: jest.fn().mockResolvedValue([])
      });

      Order.aggregate.mockResolvedValue([]);

      await customerController.getCustomersForAdmin(req, res);

      expect(Customer.find).toHaveBeenCalledWith({
        $or: expect.arrayContaining([
          { firstName: expect.any(RegExp) },
          { lastName: expect.any(RegExp) },
          { email: expect.any(RegExp) },
          { phone: expect.any(RegExp) },
          { customerId: expect.any(RegExp) }
        ])
      });
    });

    it('should filter customers by affiliate', async () => {
      req.query = { affiliateId: 'AFF001' };

      Customer.find.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([])
      });

      Affiliate.find.mockReturnValue({
        select: jest.fn().mockResolvedValue([])
      });

      Order.aggregate.mockResolvedValue([]);

      await customerController.getCustomersForAdmin(req, res);

      expect(Customer.find).toHaveBeenCalledWith({
        affiliateId: 'AFF001'
      });
    });

    it('should filter customers by active status', async () => {
      req.query = { status: 'active' };

      Customer.find.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([])
      });

      Affiliate.find.mockReturnValue({
        select: jest.fn().mockResolvedValue([])
      });

      Order.aggregate.mockResolvedValue([]);

      await customerController.getCustomersForAdmin(req, res);

      expect(Customer.find).toHaveBeenCalledWith({
        isActive: true
      });
    });

    it('should filter customers by inactive status', async () => {
      req.query = { status: 'inactive' };

      Customer.find.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([])
      });

      Affiliate.find.mockReturnValue({
        select: jest.fn().mockResolvedValue([])
      });

      Order.aggregate.mockResolvedValue([]);

      await customerController.getCustomersForAdmin(req, res);

      expect(Customer.find).toHaveBeenCalledWith({
        isActive: false
      });
    });

    it('should filter new customers with no orders', async () => {
      req.query = { status: 'new' };

      const mockCustomers = [
        { customerId: 'CUST001', firstName: 'John', affiliateId: 'AFF001', toObject: jest.fn().mockReturnThis() },
        { customerId: 'CUST002', firstName: 'Jane', affiliateId: 'AFF001', toObject: jest.fn().mockReturnThis() }
      ];

      Customer.find.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(mockCustomers)
      });

      Affiliate.find.mockReturnValue({
        select: jest.fn().mockResolvedValue([])
      });

      Order.aggregate.mockResolvedValue([
        { _id: 'CUST001', count: 5 }
      ]);

      await customerController.getCustomersForAdmin(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        customers: expect.arrayContaining([
          expect.objectContaining({
            customerId: 'CUST002',
            orderCount: 0
          })
        ]),
        total: 1
      });
    });

    it('should handle combined filters', async () => {
      req.query = {
        search: 'smith',
        affiliateId: 'AFF002',
        status: 'active'
      };

      Customer.find.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([])
      });

      Affiliate.find.mockReturnValue({
        select: jest.fn().mockResolvedValue([])
      });

      Order.aggregate.mockResolvedValue([]);

      await customerController.getCustomersForAdmin(req, res);

      expect(Customer.find).toHaveBeenCalledWith({
        $or: expect.any(Array),
        affiliateId: 'AFF002',
        isActive: true
      });
    });

    it('should handle database errors', async () => {
      Customer.find.mockImplementation(() => {
        throw new Error('Database error');
      });

      await customerController.getCustomersForAdmin(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Failed to retrieve customers'
      });
    });

    it('should ignore "all" filter values', async () => {
      req.query = {
        affiliateId: 'all',
        status: 'all'
      };

      Customer.find.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([])
      });

      Affiliate.find.mockReturnValue({
        select: jest.fn().mockResolvedValue([])
      });

      Order.aggregate.mockResolvedValue([]);

      await customerController.getCustomersForAdmin(req, res);

      expect(Customer.find).toHaveBeenCalledWith({});
    });
  });

  describe('validation errors', () => {
    it('should return validation errors for registerCustomer', async () => {
      validationResult.mockReturnValue({
        isEmpty: () => false,
        array: () => [
          { msg: 'Email is required', param: 'email' },
          { msg: 'Password is too short', param: 'password' }
        ]
      });

      await customerController.registerCustomer(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        errors: [
          { msg: 'Email is required', param: 'email' },
          { msg: 'Password is too short', param: 'password' }
        ]
      });
    });
  });

  describe('error handling for registration', () => {
    beforeEach(() => {
      validationResult.mockReturnValue({
        isEmpty: () => true,
        array: () => []
      });
    });

    it('should handle database save errors during registration', async () => {
      const mockAffiliate = { affiliateId: 'AFF123' };
      const mockCustomer = {
        save: jest.fn().mockRejectedValue(new Error('Database save failed'))
      };

      req.body = {
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        username: 'testuser',
        password: 'password123',
        affiliateId: 'AFF123'
      };

      Affiliate.findOne.mockResolvedValue(mockAffiliate);
      Customer.findOne.mockResolvedValue(null);
      Customer.mockImplementation(() => mockCustomer);
      SystemConfig.getValue.mockResolvedValue(10.00);
      encryptionUtil.generateUniqueCustomerId.mockResolvedValue('CUST999');
      encryptionUtil.hashPassword.mockReturnValue({ hash: 'hash', salt: 'salt' });

      await customerController.registerCustomer(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'An error occurred during registration'
      });
    });

    it('should handle missing payment info gracefully', async () => {
      const mockAffiliate = { affiliateId: 'AFF123' };

      req.body = {
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        username: 'testuser',
        password: 'password123',
        affiliateId: 'AFF123',
        savePaymentInfo: false
      };

      const mockCustomer = {
        customerId: 'CUST999',
        email: 'test@example.com',
        save: jest.fn().mockResolvedValue(true)
      };

      Affiliate.findOne.mockResolvedValue(mockAffiliate);
      Customer.findOne.mockResolvedValue(null);
      Customer.mockImplementation(() => mockCustomer);
      SystemConfig.getValue.mockResolvedValue(10.00);
      encryptionUtil.generateUniqueCustomerId.mockResolvedValue('CUST999');
      encryptionUtil.hashPassword.mockReturnValue({ hash: 'hash', salt: 'salt' });

      await customerController.registerCustomer(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(mockCustomer.savePaymentInfo).toBeUndefined();
    });
  });
});
