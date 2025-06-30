const {
  createAdministrator,
  updateAdministrator,
  deleteAdministrator,
  getDashboard,
  getOrderAnalytics,
  updateOperatorStats
} = require('../../server/controllers/administratorController');
const Administrator = require('../../server/models/Administrator');
const Operator = require('../../server/models/Operator');
const Affiliate = require('../../server/models/Affiliate');
const Customer = require('../../server/models/Customer');
const Order = require('../../server/models/Order');
const Transaction = require('../../server/models/Transaction');
const emailService = require('../../server/utils/emailService');

// Mock all dependencies
jest.mock('../../server/models/Administrator');
jest.mock('../../server/models/Operator');
jest.mock('../../server/models/Affiliate');
jest.mock('../../server/models/Customer');
jest.mock('../../server/models/Order');
jest.mock('../../server/models/Transaction');
jest.mock('../../server/utils/emailService');
jest.mock('../../server/utils/auditLogger');

describe('Administrator Controller - Additional Coverage', () => {
  let req, res;

  beforeEach(() => {
    req = {
      params: {},
      body: {},
      query: {},
      user: { id: 'admin-id-123', role: 'administrator' }
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      setHeader: jest.fn(),
      send: jest.fn()
    };
    jest.clearAllMocks();
  });

  describe('createAdministrator - Error Handling', () => {
    it('should handle validation errors from pre-save hooks', async () => {
      req.body = {
        email: 'admin@example.com',
        firstName: 'Admin',
        lastName: 'User',
        password: 'Test123!@#',
        permissions: ['invalid_permission']
      };

      const validationError = new Error('Invalid permission');
      validationError.name = 'ValidationError';
      
      Administrator.findOne.mockResolvedValue(null);
      Administrator.prototype.save = jest.fn().mockRejectedValue(validationError);

      await createAdministrator(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid permission'
      });
    });

    it('should handle duplicate email errors', async () => {
      req.body = {
        email: 'existing@example.com',
        firstName: 'Admin',
        lastName: 'User',
        password: 'Test123!@#'
      };

      const duplicateError = new Error('Duplicate key');
      duplicateError.code = 11000;
      
      Administrator.findOne.mockResolvedValue(null);
      Administrator.prototype.save = jest.fn().mockRejectedValue(duplicateError);

      await createAdministrator(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Email already exists'
      });
    });
  });

  describe('updateAdministrator - Edge Cases', () => {
    it('should prevent self-deactivation', async () => {
      const validId = '507f1f77bcf86cd799439011';
      req.params.id = validId;
      req.body = { isActive: false };
      req.user.id = validId;

      await updateAdministrator(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Cannot deactivate your own account'
      });
    });

    it('should handle administrator not found', async () => {
      req.params.id = '507f1f77bcf86cd799439011';
      req.body = { firstName: 'Updated' };

      Administrator.findByIdAndUpdate.mockReturnValue({
        select: jest.fn().mockResolvedValue(null)
      });

      await updateAdministrator(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Administrator not found'
      });
    });
  });

  describe('deleteAdministrator - Error Cases', () => {
    it('should prevent deleting the last administrator with full permissions', async () => {
      req.params.id = '507f1f77bcf86cd799439011';

      const adminToDelete = {
        _id: '507f1f77bcf86cd799439011',
        permissions: ['all'],
        isActive: true
      };

      Administrator.find.mockResolvedValue([]);  // No other admins with 'all' permissions
      Administrator.findById.mockResolvedValue(adminToDelete);
      Administrator.findByIdAndDelete.mockResolvedValue(adminToDelete);

      await deleteAdministrator(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Cannot delete the last administrator with full permissions'
      });
    });

    it('should handle deletion errors', async () => {
      req.params.id = '507f1f77bcf86cd799439011';

      const adminToDelete = {
        _id: '507f1f77bcf86cd799439011',
        isActive: false,
        remove: jest.fn().mockRejectedValue(new Error('Database error'))
      };

      Administrator.findById.mockResolvedValue(adminToDelete);
      Administrator.countDocuments.mockResolvedValue(2);

      await deleteAdministrator(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Failed to delete administrator'
      });
    });
  });

  describe('getDashboard - Complex Scenarios', () => {
    it('should handle empty analytics data', async () => {
      Administrator.countDocuments.mockResolvedValue(0);
      Operator.countDocuments.mockResolvedValue(0);
      Operator.findOnShift = jest.fn().mockResolvedValue([]);
      Affiliate.countDocuments.mockResolvedValue(0);
      Customer.countDocuments.mockResolvedValue(0);
      Order.countDocuments.mockResolvedValue(0);
      Order.aggregate.mockResolvedValue([{
        today: [],
        thisWeek: [],
        thisMonth: [],
        statusDistribution: [],
        processingStatusDistribution: [],
        averageProcessingTime: []
      }]);
      Order.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue([])
          })
        })
      });
      Affiliate.find = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([])
        })
      });
      Transaction.aggregate.mockResolvedValue([]);

      await getDashboard(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        dashboard: expect.objectContaining({
          orderStats: expect.objectContaining({
            today: 0,
            thisWeek: 0,
            thisMonth: 0
          }),
          systemHealth: expect.objectContaining({
            activeOperators: 0,
            onShiftOperators: 0,
            activeAffiliates: 0,
            totalCustomers: 0
          })
        })
      });
    });

    it('should handle database errors gracefully', async () => {
      Order.aggregate.mockRejectedValue(new Error('Database connection lost'));

      await getDashboard(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Failed to fetch dashboard data'
      });
    });
  });

  describe('getOrderAnalytics - Date Range Handling', () => {
    it('should handle custom date range', async () => {
      req.query = {
        startDate: '2025-01-01',
        endDate: '2025-01-31'
      };

      const mockAnalytics = [
        { 
          _id: { date: '2025-01-15' },
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

      await getOrderAnalytics(req, res);

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
    });

    it('should handle invalid date format', async () => {
      req.query = {
        startDate: 'invalid-date'
      };

      Order.aggregate
        .mockResolvedValueOnce([])  // First call for timeline
        .mockResolvedValueOnce([]);  // Second call for processingTimeDistribution

      await getOrderAnalytics(req, res);

      // Should still work with default date range
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          analytics: expect.objectContaining({
            timeline: [],
            summary: expect.objectContaining({
              totalOrders: 0
            })
          })
        })
      );
    });
  });

  describe('Helper Functions', () => {
    it('should export updateOperatorStats function', () => {
      expect(typeof updateOperatorStats).toBe('function');
    });
  });
});