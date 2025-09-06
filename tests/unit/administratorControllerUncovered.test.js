const administratorController = require('../../server/controllers/administratorController');
const Administrator = require('../../server/models/Administrator');
const Operator = require('../../server/models/Operator');
const Order = require('../../server/models/Order');
const Transaction = require('../../server/models/Transaction');
const Affiliate = require('../../server/models/Affiliate');
const Customer = require('../../server/models/Customer');
const emailService = require('../../server/utils/emailService');
const encryptionUtil = require('../../server/utils/encryption');

// Mock all dependencies
jest.mock('../../server/models/Administrator');
jest.mock('../../server/models/Operator');
jest.mock('../../server/models/Order');
jest.mock('../../server/models/Transaction');
jest.mock('../../server/models/Affiliate');
jest.mock('../../server/models/Customer');
jest.mock('../../server/utils/emailService');
jest.mock('../../server/utils/encryption');
jest.mock('../../server/utils/auditLogger');

describe('Administrator Controller - Uncovered Functions', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      params: {},
      body: {},
      query: {},
      user: { id: 'admin-id-123', role: 'administrator' }
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  describe('createAdministrator - Additional Error Cases', () => {
    it('should handle pre-save validation errors', async () => {
      req.body = {
        email: 'admin@example.com',
        firstName: 'Admin',
        lastName: 'User',
        password: 'Test123!',
        permissions: ['invalid_permission']
      };

      const validationError = new Error('Invalid permission: invalid_permission');
      validationError.name = 'ValidationError';
      
      Administrator.findOne.mockResolvedValue(null);
      Administrator.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue([])
        })
      });
      
      encryptionUtil.hashPassword.mockReturnValue({
        salt: 'salt',
        hash: 'hash'
      });

      const mockAdmin = {
        save: jest.fn().mockRejectedValue(validationError)
      };
      
      Administrator.mockImplementation(() => mockAdmin);

      await administratorController.createAdministrator(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid permission: invalid_permission'
      });
    });

    it('should handle duplicate email error (11000)', async () => {
      req.body = {
        email: 'existing@example.com',
        firstName: 'Admin',
        lastName: 'User',
        password: 'Test123!',
        permissions: ['system_config']
      };

      const duplicateError = new Error('E11000 duplicate key error');
      duplicateError.code = 11000;
      
      Administrator.findOne.mockResolvedValue(null);
      Administrator.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue([])
        })
      });
      
      encryptionUtil.hashPassword.mockReturnValue({
        salt: 'salt',
        hash: 'hash'
      });

      const mockAdmin = {
        save: jest.fn().mockRejectedValue(duplicateError)
      };
      
      Administrator.mockImplementation(() => mockAdmin);

      await administratorController.createAdministrator(req, res, next);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Email already exists'
      });
    });
  });

  describe('deleteAdministrator - Last Admin Check', () => {
    it('should prevent deleting the last administrator with full permissions', async () => {
      req.params.id = '507f1f77bcf86cd799439011';

      const adminToDelete = {
        _id: '507f1f77bcf86cd799439011',
        permissions: ['all'],
        isActive: true,
        toObject: jest.fn().mockReturnValue({
          _id: '507f1f77bcf86cd799439011',
          permissions: ['all'],
          isActive: true
        })
      };

      Administrator.find.mockResolvedValue([]); // No other admins with 'all' permissions
      Administrator.findById.mockResolvedValue(adminToDelete);

      await administratorController.deleteAdministrator(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Cannot delete the last administrator with full permissions'
      });
    });
  });

  describe('getDashboard - All Statistics', () => {
    it('should return dashboard with all statistics', async () => {
      // Mock all count queries
      Administrator.countDocuments.mockImplementation((query) => {
        if (query && query.isActive) return Promise.resolve(5);
        return Promise.resolve(10);
      });
      
      Operator.countDocuments.mockImplementation((query) => {
        if (query && query.isActive) return Promise.resolve(8);
        return Promise.resolve(15);
      });
      
      Affiliate.countDocuments.mockImplementation((query) => {
        if (query && query.isActive === true) return Promise.resolve(30);
        return Promise.resolve(30);
      });
      
      Customer.countDocuments.mockImplementation((query) => {
        if (query && query.isActive) return Promise.resolve(100);
        return Promise.resolve(150);
      });
      
      Order.countDocuments.mockImplementation((query) => {
        if (query && query.status === 'complete') return Promise.resolve(500);
        if (query && query.status === 'pending') return Promise.resolve(50);
        if (query && query.status === 'processing') return Promise.resolve(30);
        return Promise.resolve(580);
      });

      // Mock findOnShift for operators
      Operator.findOnShift = jest.fn().mockResolvedValue([{}, {}, {}]); // 3 on shift
      
      // Mock order aggregation for dashboard
      Order.aggregate.mockResolvedValue([{
        today: [{ count: 10 }],
        thisWeek: [{ count: 50 }],
        thisMonth: [{ count: 200 }],
        statusDistribution: [
          { _id: 'pending', count: 50 },
          { _id: 'complete', count: 500 }
        ],
        processingStatusDistribution: [],
        averageProcessingTime: [{ avg: 120 }]
      }]);

      // Mock recent orders
      Order.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue([])
          })
        })
      });

      // Mock affiliates
      Affiliate.find = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([])
        })
      });

      await administratorController.getDashboard(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        dashboard: expect.objectContaining({
          orderStats: expect.any(Object),
          systemHealth: expect.objectContaining({
            activeOperators: 8,
            onShiftOperators: 3,
            activeAffiliates: 30,
            totalCustomers: 150
          })
        })
      });
    });
  });

  describe('getOrderAnalytics - With Date Filters', () => {
    it('should handle date range in analytics', async () => {
      req.query = {
        startDate: '2025-01-01',
        endDate: '2025-01-31',
        groupBy: 'day'
      };

      const mockAnalytics = [
        {
          _id: { day: 1, month: 1, year: 2025 },
          totalOrders: 10,
          completedOrders: 8,
          totalRevenue: 500,
          averageOrderValue: 50,
          averageProcessingTime: 120
        }
      ];

      Order.aggregate
        .mockResolvedValueOnce(mockAnalytics)  // First call for timeline
        .mockResolvedValueOnce([]);  // Second call for processingTimeDistribution

      await administratorController.getOrderAnalytics(req, res, next);

      expect(Order.aggregate).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            $match: expect.objectContaining({
              createdAt: {
                $gte: expect.any(Date),
                $lte: expect.any(Date)
              }
            })
          })
        ])
      );

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        analytics: expect.objectContaining({
          timeline: expect.any(Array),
          processingTimeDistribution: expect.any(Array),
          summary: expect.any(Object)
        })
      });
    });
  });

  describe('exportReport - Different Formats', () => {
    it('should export orders report', async () => {
      req.query = {
        reportType: 'orders',
        format: 'csv'
      };

      // Mock Order.find for generateOrdersReport with chained populate
      const mockPopulate = {
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([
          {
            orderId: 'ORD001',
            customerId: 'CUST001',
            totalAmount: 100
          }
        ])
      };
      mockPopulate.populate.mockReturnValue(mockPopulate);
      
      Order.find.mockReturnValue(mockPopulate);

      await administratorController.exportReport(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        report: expect.arrayContaining([
          expect.objectContaining({
            orderId: 'ORD001'
          })
        ]),
        metadata: expect.objectContaining({
          reportType: 'orders'
        })
      });
    });

    it('should handle invalid report type', async () => {
      const next = jest.fn();
      req.query = {
        reportType: 'invalid_type'
      };

      await administratorController.exportReport(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid report type'
      });
    });
  });

  describe('getAffiliatesList - With Filters', () => {
    it('should get filtered affiliates list', async () => {
      req.query = {
        status: 'active',
        search: 'john'
      };

      const mockAffiliates = [
        {
          affiliateId: 'AFF001',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          isActive: true,
          businessName: 'John Doe LLC'
        }
      ];

      Affiliate.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            sort: jest.fn().mockResolvedValue(mockAffiliates)
          })
        })
      });

      await administratorController.getAffiliatesList(req, res, next);

      expect(Affiliate.find).toHaveBeenCalledWith(
        expect.objectContaining({
          isActive: true,
          $or: expect.any(Array)
        })
      );

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        affiliates: expect.arrayContaining([
          expect.objectContaining({
            affiliateId: 'AFF001',
            firstName: 'John',
            lastName: 'Doe'
          })
        ])
      });
    });
  });
});