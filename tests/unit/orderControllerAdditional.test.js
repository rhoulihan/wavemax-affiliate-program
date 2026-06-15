// Order controller unit tests — additional coverage (Phase 1 PR 3, 4-state machine).
// Slim order records: no weight/price/commission anywhere.
const orderController = require('../../server/controllers/orderController');
const logger = require('../../server/utils/logger');
const Order = require('../../server/models/Order');
const Customer = require('../../server/models/Customer');
const Affiliate = require('../../server/models/Affiliate');
const emailService = require('../../server/utils/emailService');
const { extractHandler } = require('../helpers/testUtils');
const { createFindOneMock, createFindMock } = require('../helpers/mockHelpers');

// Mock dependencies
jest.mock('../../server/models/Order');
jest.mock('../../server/models/Customer');
jest.mock('../../server/models/Affiliate');
jest.mock('../../server/utils/emailService');
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
  }
}));

describe('Order Controller - Additional Coverage', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      user: {},
      params: {},
      body: {},
      query: {}
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      setHeader: jest.fn(),
      end: jest.fn(),
      send: jest.fn()
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  describe('exportOrders', () => {
    beforeEach(() => {
      req.user = { role: 'admin', adminId: 'ADM123' };
    });

    it('should export orders as CSV', async () => {
      req.query.format = 'csv';

      Order.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockResolvedValue([{
          orderId: 'ORD001',
          customerId: 'CUST123',
          affiliateId: 'AFF123',
          bagId: 'BAG-001',
          status: 'complete',
          createdAt: new Date('2025-05-24')
        }])
      });

      Customer.find = jest.fn().mockResolvedValue([{
        customerId: 'CUST123',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com'
      }]);

      await orderController.exportOrders(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv');
      expect(res.setHeader).toHaveBeenCalledWith('Content-Disposition', expect.stringContaining('attachment; filename=orders-export-'));
      expect(res.send).toHaveBeenCalled();
    });

    it('should export orders as JSON when format=json', async () => {
      req.query.format = 'json';

      Order.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockResolvedValue([{
          orderId: 'ORD001',
          customerId: 'CUST123',
          affiliateId: 'AFF123',
          bagId: 'BAG-001',
          status: 'complete',
          createdAt: new Date('2025-05-24')
        }])
      });

      Customer.find = jest.fn().mockResolvedValue([{
        customerId: 'CUST123',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com'
      }]);

      await orderController.exportOrders(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          exportDate: expect.any(String),
          filters: expect.any(Object),
          totalOrders: expect.any(Number),
          orders: expect.any(Array)
        })
      );
    });

    it('should handle export errors', async () => {
      Order.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockRejectedValue(new Error('Export failed'))
      });

      const consoleSpy = jest.spyOn(logger, 'error').mockImplementation();

      await orderController.exportOrders(req, res, next);

      expect(consoleSpy).toHaveBeenCalledWith('Export orders error:', expect.any(Error));
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'An error occurred while exporting orders'
      });

      consoleSpy.mockRestore();
    });

    it('should handle unauthorized access', async () => {
      req.user = { role: 'customer' }; // Wrong role

      await orderController.exportOrders(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Insufficient permissions for this export'
      });
    });
  });

  describe('updateOrderStatus edge cases', () => {
    it('should reject invalid status transitions', async () => {
      req.params.orderId = 'ORD001';
      req.body.status = 'in_progress'; // Invalid from complete (terminal)
      req.user = { role: 'admin' };

      const mockOrder = {
        orderId: 'ORD001',
        status: 'complete',
        save: jest.fn()
      };

      Order.findOne = createFindOneMock(mockOrder);

      await orderController.updateOrderStatus(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid status transition from complete to in_progress'
      });
    });
  });

  describe('cancelOrder method', () => {
    it('should handle order not found', async () => {
      req.params.orderId = 'ORD999';
      req.user = { customerId: 'CUST123' };

      Order.findOne = createFindOneMock(null);

      await orderController.cancelOrder(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Order not found'
      });
    });

    it('should handle cancellation of a closed (non-cancellable) order', async () => {
      req.params.orderId = 'ORD001';
      req.user = { customerId: 'CUST123' };

      const mockOrder = {
        orderId: 'ORD001',
        customerId: 'CUST123',
        status: 'complete', // terminal — cannot cancel
        save: jest.fn().mockResolvedValue(true)
      };

      Order.findOne = createFindOneMock(mockOrder);

      await orderController.cancelOrder(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Orders in complete status cannot be cancelled.'
      });
    });
  });

  describe('bulkUpdateOrderStatus', () => {
    it('should handle invalid order IDs format', async () => {
      req.body = { orderIds: 'not-an-array', status: 'in_progress' };
      req.user = { role: 'operator' };

      await orderController.bulkUpdateOrderStatus(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Order IDs must be provided as an array'
      });
    });

    it('should handle empty order IDs array', async () => {
      req.body = { orderIds: [], status: 'in_progress' };
      req.user = { role: 'operator' };

      await orderController.bulkUpdateOrderStatus(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Order IDs must be provided as an array'
      });
    });

    it('should handle unauthorized access', async () => {
      req.body = { orderIds: ['ORD001'], status: 'in_progress' };
      req.user = { role: 'customer' }; // Wrong role

      Order.find = jest.fn().mockResolvedValue([
        { orderId: 'ORD001', affiliateId: 'AFF123' }
      ]);

      await orderController.bulkUpdateOrderStatus(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Unauthorized'
      });
    });
  });
});
