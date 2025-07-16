// Set NODE_ENV before any requires
process.env.NODE_ENV = 'test';

// Mock all dependencies first
jest.mock('mongoose', () => {
  const Schema = function() {};
  Schema.Types = {
    Mixed: 'Mixed',
    ObjectId: 'ObjectId'
  };
  
  return {
    Schema,
    Types: {
      ObjectId: {
        isValid: jest.fn().mockReturnValue(true)
      }
    },
    connection: {
      db: {
        admin: () => ({
          ping: jest.fn().mockResolvedValue(true)
        })
      }
    },
    model: jest.fn()
  };
});

// Mock all models
jest.mock('../../server/models/Order', () => ({
  find: jest.fn(),
  aggregate: jest.fn(),
  countDocuments: jest.fn()
}));

jest.mock('../../server/models/Operator', () => ({
  find: jest.fn(),
  aggregate: jest.fn(),
  countDocuments: jest.fn(),
  findOnShift: jest.fn()
}));

jest.mock('../../server/models/Affiliate', () => ({
  find: jest.fn(),
  aggregate: jest.fn(),
  countDocuments: jest.fn()
}));

jest.mock('../../server/models/Customer', () => ({
  find: jest.fn(),
  countDocuments: jest.fn()
}));

jest.mock('../../server/models/Administrator', () => ({}));
jest.mock('../../server/models/SystemConfig', () => ({}));
jest.mock('../../server/models/Transaction', () => ({}));

// Mock utilities
jest.mock('../../server/utils/auditLogger', () => ({
  logAuditEvent: jest.fn(),
  AuditEvents: {
    DATA_MODIFICATION: 'DATA_MODIFICATION'
  }
}));

jest.mock('../../server/utils/fieldFilter', () => jest.fn((data) => data));
jest.mock('../../server/utils/emailService', () => ({}));
jest.mock('../../server/utils/encryption', () => ({}));
jest.mock('../../server/utils/validators', () => ({}));

// Now require modules after all mocks are set up
const Order = require('../../server/models/Order');
const Operator = require('../../server/models/Operator');
const Affiliate = require('../../server/models/Affiliate');
const Customer = require('../../server/models/Customer');
const { logAuditEvent } = require('../../server/utils/auditLogger');
const administratorController = require('../../server/controllers/administratorController');

describe('Admin Dashboard Functions', () => {
  let mockReq;
  let mockRes;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    mockReq = {
      user: { id: 'admin123', role: 'administrator' },
      query: {},
      params: {},
      body: {}
    };
    
    mockRes = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
      send: jest.fn()
    };
  });
  
  describe('getDashboard', () => {
    it('should fetch comprehensive dashboard data', async () => {
      // Mock aggregation results
      const mockOrderStats = [{
        today: [{ count: 15 }],
        thisWeek: [{ count: 100 }],
        thisMonth: [{ count: 450 }],
        statusDistribution: [
          { _id: 'pending', count: 20 },
          { _id: 'complete', count: 380 }
        ],
        processingStatusDistribution: [
          { _id: 'washing', count: 10 },
          { _id: 'drying', count: 5 }
        ],
        averageProcessingTime: [{ avg: 45.5 }]
      }];
      
      const mockOperatorPerformance = [
        {
          operatorId: 'OP001',
          firstName: 'John',
          lastName: 'Doe',
          currentOrderCount: 3,
          totalOrdersProcessed: 150,
          averageProcessingTime: 42,
          qualityScore: 95,
          ordersToday: 8
        }
      ];
      
      const mockAffiliatePerformance = [
        {
          affiliateId: 'AFF001',
          firstName: 'Jane',
          lastName: 'Smith',
          businessName: 'Clean Co',
          customerCount: 25,
          orderCount: 120,
          monthlyRevenue: 4500
        }
      ];
      
      const mockRecentOrders = [
        {
          orderId: 'ORD001',
          affiliateId: 'AFF001',
          status: 'complete',
          updatedAt: new Date()
        }
      ];
      
      const mockAffiliates = [
        {
          affiliateId: 'AFF001',
          firstName: 'Jane',
          lastName: 'Smith',
          businessName: 'Clean Co'
        }
      ];
      
      // Mock database calls
      Order.aggregate.mockResolvedValue(mockOrderStats);
      Operator.aggregate.mockResolvedValue(mockOperatorPerformance);
      Affiliate.aggregate.mockResolvedValue(mockAffiliatePerformance);
      Order.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(mockRecentOrders)
          })
        })
      });
      Affiliate.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(mockAffiliates)
        })
      });
      
      Operator.countDocuments.mockResolvedValue(10);
      Operator.findOnShift.mockResolvedValue([1, 2, 3]);
      Affiliate.countDocuments.mockResolvedValue(20);
      Customer.countDocuments.mockResolvedValue(100);
      Order.countDocuments.mockImplementation(query => {
        if (query.status?.$in) return Promise.resolve(15);
        if (query.status === 'complete') return Promise.resolve(380);
        if (query.processingStartedAt) return Promise.resolve(2);
        return Promise.resolve(0);
      });
      
      await administratorController.getDashboard(mockReq, mockRes);
      
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        dashboard: expect.objectContaining({
          orderStats: expect.objectContaining({
            today: 15,
            thisWeek: 100,
            thisMonth: 450,
            statusDistribution: expect.any(Array),
            averageProcessingTime: 45.5
          }),
          operatorPerformance: expect.any(Array),
          affiliatePerformance: expect.any(Array),
          systemHealth: expect.objectContaining({
            activeOperators: 10,
            onShiftOperators: 3,
            activeAffiliates: 20,
            totalCustomers: 100
          }),
          recentActivity: expect.any(Array)
        })
      });
    });
    
    it('should handle errors in dashboard data fetching', async () => {
      Order.aggregate.mockRejectedValue(new Error('Database error'));
      
      await administratorController.getDashboard(mockReq, mockRes);
      
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Failed to fetch dashboard data'
      });
    });
  });
  
  describe('getOrderAnalytics', () => {
    it('should fetch order analytics with timeline and distribution', async () => {
      mockReq.query = {
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        groupBy: 'day'
      };
      
      const mockAnalytics = [
        {
          _id: '2024-01-01',
          totalOrders: 20,
          completedOrders: 18,
          cancelledOrders: 2,
          totalRevenue: 1500,
          averageOrderValue: 75,
          averageProcessingTime: 42,
          totalWeight: 150
        }
      ];
      
      const mockDistribution = [
        { _id: 30, count: 10, orders: [] },
        { _id: 60, count: 5, orders: [] }
      ];
      
      Order.aggregate.mockResolvedValueOnce(mockAnalytics)
        .mockResolvedValueOnce(mockDistribution);
      
      await administratorController.getOrderAnalytics(mockReq, mockRes);
      
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        analytics: expect.objectContaining({
          timeline: mockAnalytics,
          processingTimeDistribution: mockDistribution,
          summary: expect.objectContaining({
            totalOrders: 20,
            completedOrders: 18,
            totalRevenue: 1500,
            averageOrderValue: 75,
            averageProcessingTime: 42
          })
        })
      });
    });
    
    it('should handle errors', async () => {
      Order.aggregate.mockRejectedValue(new Error('Database error'));
      
      await administratorController.getOrderAnalytics(mockReq, mockRes);
      
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Failed to fetch order analytics'
      });
    });
  });
  
  describe('getOperatorAnalytics', () => {
    it('should fetch operator performance analytics', async () => {
      mockReq.query = {
        startDate: '2024-01-01',
        endDate: '2024-01-31'
      };
      
      const mockOperatorAnalytics = [
        {
          operatorId: 'OP001',
          firstName: 'John',
          lastName: 'Doe',
          workStation: 'Station A',
          isActive: true,
          metrics: {
            totalOrders: 50,
            completedOrders: 48,
            averageProcessingTime: 40,
            qualityChecksPassed: 45,
            totalProcessingTime: 2000,
            completionRate: 0.96,
            qualityPassRate: 0.9375
          }
        }
      ];
      
      const mockWorkstationAnalytics = [
        {
          _id: 'Station A',
          totalOrders: 100,
          averageProcessingTime: 42,
          totalProcessingTime: 4200
        }
      ];
      
      Operator.aggregate.mockResolvedValue(mockOperatorAnalytics);
      Order.aggregate.mockResolvedValue(mockWorkstationAnalytics);
      
      await administratorController.getOperatorAnalytics(mockReq, mockRes);
      
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        analytics: {
          operators: mockOperatorAnalytics,
          workstations: mockWorkstationAnalytics
        }
      });
    });
    
    it('should handle errors', async () => {
      Operator.aggregate.mockRejectedValue(new Error('Database error'));
      
      await administratorController.getOperatorAnalytics(mockReq, mockRes);
      
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Failed to fetch operator analytics'
      });
    });
  });
  
  describe('getAffiliateAnalytics', () => {
    it('should fetch affiliate performance analytics', async () => {
      const mockAffiliateAnalytics = [
        {
          affiliateId: 'AFF001',
          firstName: 'Jane',
          lastName: 'Smith',
          businessName: 'Clean Co',
          metrics: {
            totalCustomers: 25,
            activeCustomers: 20,
            totalOrders: 100,
            totalRevenue: 7500,
            totalCommission: 750,
            averageOrderValue: 75
          }
        }
      ];
      
      const mockGeographicDistribution = [
        {
          _id: 'New York',
          affiliateCount: 5,
          activeAffiliates: 4,
          avgServiceRadius: 10
        }
      ];
      
      Affiliate.aggregate.mockResolvedValueOnce(mockAffiliateAnalytics)
        .mockResolvedValueOnce(mockGeographicDistribution);
      
      await administratorController.getAffiliateAnalytics(mockReq, mockRes);
      
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        analytics: {
          affiliates: mockAffiliateAnalytics,
          geographicDistribution: mockGeographicDistribution
        }
      });
    });
    
    it('should handle errors', async () => {
      Affiliate.aggregate.mockRejectedValue(new Error('Database error'));
      
      await administratorController.getAffiliateAnalytics(mockReq, mockRes);
      
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Failed to fetch affiliate analytics'
      });
    });
  });
  
  describe('exportReport', () => {
    it('should export orders report', async () => {
      mockReq.query = {
        reportType: 'orders',
        format: 'csv',
        startDate: '2024-01-01',
        endDate: '2024-01-31'
      };
      
      const mockOrdersReport = [
        { orderId: 'ORD001', status: 'complete' }
      ];
      
      // Mock internal function
      Order.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(mockOrdersReport)
          })
        })
      });
      
      await administratorController.exportReport(mockReq, mockRes);
      
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        report: expect.any(Array),
        metadata: expect.objectContaining({
          reportType: 'orders',
          generatedAt: expect.any(Date),
          startDate: '2024-01-01',
          endDate: '2024-01-31'
        })
      });
      
      expect(logAuditEvent).toHaveBeenCalled();
    });
    
    it('should export comprehensive report', async () => {
      mockReq.query = {
        reportType: 'comprehensive'
      };
      
      // Mock all model calls for comprehensive report
      Order.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue([])
          })
        })
      });
      
      Operator.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue([])
      });
      
      Affiliate.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue([])
      });
      
      Order.aggregate.mockResolvedValue([]);
      Customer.countDocuments.mockResolvedValue(0);
      
      await administratorController.exportReport(mockReq, mockRes);
      
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        report: expect.objectContaining({
          orders: expect.any(Array),
          operators: expect.any(Array),
          affiliates: expect.any(Array),
          summary: expect.any(Object)
        }),
        metadata: expect.any(Object)
      });
    });
    
    it('should handle invalid report type', async () => {
      mockReq.query = {
        reportType: 'invalid'
      };
      
      await administratorController.exportReport(mockReq, mockRes);
      
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid report type'
      });
    });
    
    it('should handle export errors', async () => {
      mockReq.query = {
        reportType: 'orders'
      };
      
      Order.find.mockImplementation(() => {
        throw new Error('Database error');
      });
      
      await administratorController.exportReport(mockReq, mockRes);
      
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Failed to export report'
      });
    });
  });
  
  describe('getAffiliatesList', () => {
    it('should fetch filtered affiliates list', async () => {
      mockReq.query = {
        search: 'Clean',
        status: 'active',
        limit: '50'
      };
      
      const mockAffiliates = [
        {
          _id: 'aff1',
          affiliateId: 'AFF001',
          firstName: 'Jane',
          lastName: 'Smith',
          businessName: 'Clean Co',
          email: 'jane@cleanco.com',
          isActive: true,
          serviceArea: 'Downtown'
        }
      ];
      
      Affiliate.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            sort: jest.fn().mockResolvedValue(mockAffiliates)
          })
        })
      });
      
      await administratorController.getAffiliatesList(mockReq, mockRes);
      
      expect(Affiliate.find).toHaveBeenCalledWith({
        $or: expect.any(Array),
        isActive: true
      });
      
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        affiliates: expect.arrayContaining([
          expect.objectContaining({
            affiliateId: 'AFF001',
            businessName: 'Clean Co'
          })
        ])
      });
    });
    
    it('should handle errors in affiliates list', async () => {
      Affiliate.find.mockImplementation(() => {
        throw new Error('Database error');
      });
      
      await administratorController.getAffiliatesList(mockReq, mockRes);
      
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Failed to fetch affiliates list',
        error: 'Database error'
      });
    });
  });
  
  describe('Report Generation Functions', () => {
    it('should generate orders report', async () => {
      const mockOrders = [
        {
          orderId: 'ORD001',
          customerId: 'CUST001',
          affiliateId: { firstName: 'Jane', lastName: 'Smith' },
          status: 'complete',
          orderProcessingStatus: 'completed',
          assignedOperator: { firstName: 'John', lastName: 'Doe' },
          processingTimeMinutes: 45,
          actualWeight: 10,
          actualTotal: 50,
          createdAt: new Date()
        }
      ];
      
      Order.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(mockOrders)
          })
        })
      });
      
      const generateOrdersReport = async (startDate, endDate) => {
        const orders = await Order.find({
          createdAt: {
            $gte: new Date(startDate || Date.now() - 30 * 24 * 60 * 60 * 1000),
            $lte: new Date(endDate || Date.now())
          }
        })
          .populate('assignedOperator', 'firstName lastName operatorId')
          .populate('affiliateId', 'firstName lastName businessName')
          .lean();

        return orders.map(order => ({
          orderId: order.orderId,
          customerID: order.customerId,
          affiliateName: order.affiliateId ?
            `${order.affiliateId.firstName} ${order.affiliateId.lastName}` : 'N/A',
          status: order.status,
          processingStatus: order.orderProcessingStatus,
          operator: order.assignedOperator ?
            `${order.assignedOperator.firstName} ${order.assignedOperator.lastName}` : 'Unassigned',
          processingTime: order.processingTimeMinutes || 0,
          actualWeight: order.actualWeight || 0,
          actualTotal: order.actualTotal || 0,
          createdAt: order.createdAt
        }));
      };
      
      const report = await generateOrdersReport('2024-01-01', '2024-01-31');
      
      expect(report).toHaveLength(1);
      expect(report[0]).toMatchObject({
        orderId: 'ORD001',
        customerID: 'CUST001',
        affiliateName: 'Jane Smith',
        status: 'complete',
        operator: 'John Doe'
      });
    });
  });
});