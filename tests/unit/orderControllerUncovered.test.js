const {
  exportOrders,
  searchOrders
} = require('../../server/controllers/orderController');
const Order = require('../../server/models/Order');
const { extractHandler } = require('../helpers/testUtils');
const { expectSuccessResponse, expectErrorResponse } = require('../helpers/responseHelpers');
const { createFindOneMock, createFindMock, createMockDocument, createAggregateMock } = require('../helpers/mockHelpers');

// Mock dependencies
jest.mock('../../server/models/Order');
jest.mock('../../server/models/Customer');
jest.mock('../../server/utils/controllerHelpers', () => ({
  asyncWrapper: (fn) => fn,
  sendSuccess: (res, data, message, statusCode = 200) => {
    return res.status(statusCode || 200).json({ success: true, message: message || 'Success', ...data });
  },
  sendError: (res, message, statusCode = 400, details) => {
    return res.status(statusCode).json({ success: false, message, ...(details && { ...details }) });
  },
  validateRequiredFields: (body, fields) => {
    const missing = fields.filter(field => !body[field]);
    return missing.length > 0 ? { missingFields: missing } : null;
  },
  parsePagination: (query, defaults = {}) => {
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || defaults.limit || 10;
    return {
      page,
      limit,
      skip: (page - 1) * limit
    };
  },
  calculatePagination: (total, page, limit) => ({
    total,
    page,
    pages: Math.ceil(total / limit)
  }),
  buildQuery: (params, allowedFields) => {
    const query = {};
    Object.keys(params).forEach(key => {
      if (params[key] && allowedFields[key]) {
        query[key] = params[key];
      }
    });
    return query;
  },
  sendPaginated: (res, items, pagination, message, extra = {}) => {
    return res.status(200).json({
      success: true,
      message: message || 'Success',
      data: items,
      pagination,
      ...extra
    });
  }
}));
const Customer = require('../../server/models/Customer');

describe('Order Controller - Uncovered Functions', () => {
  let req, res, next;

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
      send: jest.fn(),
      end: jest.fn()
    };
    next = jest.fn();
    jest.clearAllMocks();
    jest.resetModules();
    Order.countDocuments = jest.fn();
  });

  describe('exportOrders', () => {
    const mockOrders = [
      {
        orderId: 'ORD001',
        customerId: { customerId: 'CUST001', firstName: 'John', lastName: 'Doe' },
        affiliateId: { businessName: 'Test Business' },
        estimatedTotal: 50,
        status: 'complete',
        createdAt: new Date('2025-01-01')
      }
    ];

    it('should export orders as CSV', async () => {
      req.query = { format: 'csv' };
      req.user.role = 'admin';

      Order.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue(mockOrders)
      });
      
      Customer.find.mockResolvedValue([
        { customerId: mockOrders[0].customerId.customerId, firstName: 'John', lastName: 'Doe', email: 'john@example.com' }
      ]);

      await exportOrders(req, res);

      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv');
      expect(res.setHeader).toHaveBeenCalledWith('Content-Disposition', expect.stringContaining('orders-export'));
      expect(res.send).toHaveBeenCalled();
    });

    it('should export orders as Excel', async () => {
      req.query = { format: 'excel' };
      req.user.role = 'admin';

      // Mock Order.find even though Excel format should return early
      Order.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue([])
      });
      
      // Mock Customer.find
      Customer.find.mockResolvedValue([]);

      await exportOrders(req, res);

      expect(res.status).toHaveBeenCalledWith(501);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Excel export not yet implemented'
      });
    });

    it('should export orders as JSON by default', async () => {
      req.query = { format: 'json' };
      req.user.role = 'admin';

      Order.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue(mockOrders)
      });
      
      Customer.find.mockResolvedValue([
        { customerId: mockOrders[0].customerId.customerId, firstName: 'John', lastName: 'Doe', email: 'john@example.com' }
      ]);

      await exportOrders(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        exportDate: expect.any(String),
        filters: expect.any(Object),
        totalOrders: 1,
        orders: expect.any(Array)
      });
    });

    it('should handle export errors', async () => {
      req.query = { format: 'csv' };
      req.user.role = 'admin';

      Order.find.mockReturnValue({
        sort: jest.fn().mockRejectedValue(new Error('Export failed'))
      });

      await exportOrders(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'An error occurred while exporting orders'
      });
    });
  });

  describe('searchOrders', () => {
    it('should search orders by customer name', async () => {
      req.query = { search: 'john' };
      req.user.role = 'admin';

      const mockCustomers = [
        { customerId: 'CUST001', firstName: 'John', lastName: 'Doe', email: 'john@example.com' }
      ];
      
      const mockOrders = [
        { orderId: 'ORD001', customerId: 'CUST001', status: 'complete', createdAt: new Date() }
      ];

      // First call to find customers by search term
      Customer.find.mockReturnValueOnce({
        select: jest.fn().mockResolvedValue(mockCustomers)
      });
      
      // Second call to get customer details
      Customer.find.mockReturnValueOnce(Promise.resolve(mockCustomers));
      
      Order.countDocuments.mockResolvedValue(1);
      Order.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue(mockOrders)
          })
        })
      });

      await searchOrders(req, res);

      expect(Customer.find).toHaveBeenCalledWith({
        $or: [
          { firstName: { $regex: 'john', $options: 'i' } },
          { lastName: { $regex: 'john', $options: 'i' } },
          { email: { $regex: 'john', $options: 'i' } }
        ]
      });

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.any(Array),
          pagination: expect.any(Object)
        })
      );
    });

    it('should search orders without search term', async () => {
      req.query = {};
      req.user.role = 'admin';

      const mockOrders = [
        { orderId: 'ORD001', customerId: 'CUST001', status: 'complete', createdAt: new Date() }
      ];
      
      Order.countDocuments.mockResolvedValue(1);
      Order.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue(mockOrders)
          })
        })
      });
      
      Customer.find.mockResolvedValue([
        { customerId: 'CUST001', firstName: 'John', lastName: 'Doe', email: 'john@example.com' }
      ]);

      await searchOrders(req, res);

      expect(Order.find).toHaveBeenCalledWith({});
    });

    it('should handle search with no results', async () => {
      req.query = { search: 'nonexistent' };
      req.user.role = 'admin';

      // First call to find customers by search term
      Customer.find.mockReturnValueOnce({
        select: jest.fn().mockResolvedValue([])
      });
      
      // Second call to get customer details (empty since no customers found)
      Customer.find.mockReturnValueOnce(Promise.resolve([]));
      
      Order.countDocuments.mockResolvedValue(0);
      Order.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([])
          })
        })
      });

      await searchOrders(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: [],
          pagination: expect.any(Object)
        })
      );
    });

    it('should handle search errors', async () => {
      req.query = { search: 'test' };
      req.user.role = 'admin';

      Customer.find.mockReturnValue({
        select: jest.fn().mockRejectedValue(new Error('Search failed'))
      });

      // The real asyncWrapper would catch this error
      // Our mock just returns the fn, so the error will be thrown
      await expect(searchOrders(req, res)).rejects.toThrow('Search failed');
    });
  });
});