const { searchOrders, exportOrders, getOrderStatistics } = require('../../server/controllers/orderController');
const { getAffiliateDashboardStats } = require('../../server/controllers/affiliateController');
const Order = require('../../server/models/Order');
const Affiliate = require('../../server/models/Affiliate');
const Customer = require('../../server/models/Customer');
const Transaction = require('../../server/models/Transaction');

// Mock dependencies
jest.mock('../../server/models/Order');
jest.mock('../../server/models/Affiliate');
jest.mock('../../server/models/Customer');
jest.mock('../../server/models/Transaction');

describe('Controllers - Additional Function Coverage', () => {
  let req, res;

  beforeEach(() => {
    req = {
      params: {},
      body: {},
      query: {},
      user: { id: 'user-123', role: 'affiliate', affiliateId: 'AFF123' }
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      setHeader: jest.fn(),
      send: jest.fn()
    };
    jest.clearAllMocks();
  });

  describe('Order Controller - Additional Functions', () => {
    describe('searchOrders - Additional Cases', () => {
      it('should handle search with affiliate filter', async () => {
        req.query = {
          search: 'ORD',
          affiliateId: 'AFF123'
        };
        req.user.role = 'admin';

        const mockOrders = [
          { orderId: 'ORD001', affiliateId: 'AFF123', customerId: 'CUST001' }
        ];

        req.pagination = { page: 1, limit: 10 };
        
        const mockCustomers = [
          { customerId: 'CUST001', firstName: 'John', lastName: 'Doe', email: 'john@example.com' }
        ];
        
        // Mock for searching customers
        Customer.find.mockReturnValueOnce({
          select: jest.fn().mockResolvedValue(mockCustomers)
        });
        
        // Mock for getting customer data
        Customer.find.mockReturnValueOnce(Promise.resolve(mockCustomers));
        
        Order.countDocuments = jest.fn().mockResolvedValue(1);
        Order.find.mockReturnValue({
          sort: jest.fn().mockReturnValue({
            skip: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue(mockOrders)
            })
          })
        });

        await searchOrders(req, res);

        expect(Order.find).toHaveBeenCalledWith(
          expect.objectContaining({
            affiliateId: 'AFF123'
          })
        );
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
          success: true,
          orders: expect.any(Array),
          totalResults: 1,
          pagination: expect.any(Object)
        });
      });

      it('should handle empty search query', async () => {
        req.query = {};
        req.user.role = 'admin';

        req.pagination = { page: 1, limit: 10 };
        
        const mockOrders = [];
        
        Order.countDocuments = jest.fn().mockResolvedValue(0);
        Order.find.mockReturnValue({
          sort: jest.fn().mockReturnValue({
            skip: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue(mockOrders)
            })
          })
        });
        
        Customer.find.mockResolvedValue([]);

        await searchOrders(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
          success: true,
          orders: [],
          totalResults: 0,
          pagination: expect.any(Object)
        });
      });
    });

    describe('exportOrders - Edge Cases', () => {
      it('should handle export with date filters', async () => {
        req.query = {
          format: 'json',
          startDate: '2025-01-01',
          endDate: '2025-01-31'
        };
        req.user.role = 'admin';

        const mockOrders = [
          {
            orderId: 'ORD001',
            createdAt: new Date('2025-01-15')
          }
        ];

        Order.find.mockReturnValue({
          sort: jest.fn().mockResolvedValue(mockOrders)
        });
        
        Customer.find.mockResolvedValue([]);

        await exportOrders(req, res);

        expect(res.json).toHaveBeenCalledWith({
          success: true,
          exportDate: expect.any(String),
          filters: expect.any(Object),
          totalOrders: 1,
          orders: expect.any(Array)
        });
      });
    });

    describe('getOrderStatistics - Various Scenarios', () => {
      it('should get order statistics with time range', async () => {
        req.query = {
          startDate: '2025-01-01',
          endDate: '2025-01-31',
          groupBy: 'day'
        };
        req.user = { role: 'admin' };

        const mockOrders = [
          { status: 'complete', actualTotal: 50, estimatedWeight: 10 },
          { status: 'complete', actualTotal: 100, estimatedWeight: 15 },
          { status: 'pending', estimatedTotal: 75, estimatedWeight: 12 }
        ];
        
        Order.find.mockResolvedValue(mockOrders);

        await getOrderStatistics(req, res);

        expect(Order.find).toHaveBeenCalledWith({});
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
          success: true,
          statistics: expect.objectContaining({
            totalOrders: 3,
            ordersByStatus: expect.any(Object),
            totalRevenue: expect.any(Number),
            averageOrderValue: expect.any(Number)
          })
        });
      });

      it('should handle statistics for affiliate user', async () => {
        req.query = {};
        req.user = { role: 'affiliate', affiliateId: 'AFF123' };

        const mockOrders = [
          { status: 'complete', actualTotal: 100, estimatedWeight: 20, affiliateId: 'AFF123' },
          { status: 'complete', actualTotal: 200, estimatedWeight: 30, affiliateId: 'AFF123' }
        ];
        
        Order.find.mockResolvedValue(mockOrders);

        await getOrderStatistics(req, res);

        expect(Order.find).toHaveBeenCalledWith(
          expect.objectContaining({
            affiliateId: 'AFF123'
          })
        );
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
          success: true,
          statistics: expect.objectContaining({
            totalOrders: 2,
            totalRevenue: 300
          })
        });
      });
    });
  });

  describe('Affiliate Controller - Additional Functions', () => {
    describe('getAffiliateDashboardStats - Edge Cases', () => {
      it('should handle empty statistics', async () => {
        req.params = { affiliateId: 'AFF123' };
        req.user = { id: 'affiliate-123', affiliateId: 'AFF123', role: 'affiliate' };

        
        // Mock empty results
        Order.countDocuments = jest.fn().mockResolvedValue(0);
        Customer.countDocuments = jest.fn().mockResolvedValue(0);
        Order.find = jest.fn().mockResolvedValue([]);
        Transaction.find = jest.fn().mockResolvedValue([]);

        await getAffiliateDashboardStats(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
          success: true,
          stats: expect.objectContaining({
            customerCount: 0,
            activeOrderCount: 0,
            totalEarnings: 0,
            monthEarnings: 0,
            weekEarnings: 0,
            pendingEarnings: 0,
            monthlyOrders: 0,
            weeklyOrders: 0,
            nextPayoutDate: expect.any(Date)
          })
        });
      });

      it('should handle date range filters', async () => {
        req.params = { affiliateId: 'AFF123' };
        req.user = { id: 'affiliate-123', affiliateId: 'AFF123', role: 'affiliate' };
        req.query = {
          startDate: '2025-01-01',
          endDate: '2025-01-31'
        };


        const mockOrders = [
          { status: 'complete', actualTotal: 500, affiliateCommission: 50, createdAt: new Date('2025-01-15') },
          { status: 'complete', actualTotal: 500, affiliateCommission: 50, createdAt: new Date('2025-01-20') }
        ];

        Order.countDocuments = jest.fn()
          .mockResolvedValueOnce(2) // active orders
          .mockResolvedValueOnce(10); // total orders
        Customer.countDocuments = jest.fn().mockResolvedValue(10);
        Order.find = jest.fn().mockResolvedValue(mockOrders);
        Transaction.find = jest.fn().mockResolvedValue([]);

        await getAffiliateDashboardStats(req, res);

        expect(Order.find).toHaveBeenCalledWith({
          affiliateId: 'AFF123',
          status: 'complete'
        });
        expect(res.json).toHaveBeenCalledWith({
          success: true,
          stats: expect.objectContaining({
            customerCount: 10,
            activeOrderCount: 2,
            totalEarnings: 100,
            monthEarnings: expect.any(Number),
            weekEarnings: expect.any(Number),
            pendingEarnings: 0,
            monthlyOrders: expect.any(Number),
            weeklyOrders: expect.any(Number),
            nextPayoutDate: expect.any(Date)
          })
        });
      });
    });
  });
});