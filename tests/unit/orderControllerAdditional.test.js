const orderController = require('../../server/controllers/orderController');
const logger = require('../../server/utils/logger');
const Order = require('../../server/models/Order');
const Customer = require('../../server/models/Customer');
const Affiliate = require('../../server/models/Affiliate');
const emailService = require('../../server/utils/emailService');
const { extractHandler } = require('../helpers/testUtils');
const { expectSuccessResponse, expectErrorResponse } = require('../helpers/responseHelpers');
const { createFindOneMock, createFindMock, createMockDocument, createAggregateMock } = require('../helpers/mockHelpers');

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
      // Mock user with proper role
      req.user = { 
        role: 'admin',
        adminId: 'ADM123'
      };
    });

    it('should export orders as CSV', async () => {
      req.query.format = 'csv';
      
      const mockOrders = [{
        orderId: 'ORD001',
        customerId: 'CUST123', // Should be ID, not object
        affiliateId: 'AFF123',  // Should be ID, not object
        status: 'complete',
        actualTotal: 100,
        estimatedWeight: 20,
        actualWeight: 22,
        estimatedTotal: 50,
        affiliateCommission: 10,
        pickupDate: new Date('2025-05-26'),
        deliveryDate: new Date('2025-05-27'),
        createdAt: new Date('2025-05-24')
      }];
      
      Order.find = createFindMock([]);

      // Mock Customer.find for the CSV export
      Customer.find = jest.fn().mockResolvedValue([{
        customerId: 'CUST123',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com'
      }]);

      const handler = orderController.exportOrders;
      await handler(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv');
      expect(res.setHeader).toHaveBeenCalledWith('Content-Disposition', expect.stringContaining('attachment; filename=orders-export-'));
      expect(res.send).toHaveBeenCalled();
    });

    it('should export orders as JSON when format=json', async () => {
      req.query.format = 'json';
      
      const mockOrders = [{
        orderId: 'ORD001',
        customerId: 'CUST123',
        status: 'complete',
        estimatedWeight: 20,
        actualWeight: 22,
        estimatedTotal: 50,
        actualTotal: 55,
        affiliateCommission: 11,
        pickupDate: new Date('2025-05-26'),
        deliveryDate: new Date('2025-05-27'),
        createdAt: new Date('2025-05-24'),
        affiliateId: 'AFF123'
      }];
      
      Order.find = createFindMock([]);

      Customer.find = jest.fn().mockResolvedValue([{
        customerId: 'CUST123',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com'
      }]);

      const handler = extractHandler(orderController.exportOrders);
      await handler(req, res, next);

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
      const next = jest.fn();
      Order.find = createFindMock([]);

      const consoleSpy = jest.spyOn(logger, 'error').mockImplementation();

      const handler = extractHandler(orderController.exportOrders);
      await handler(req, res, next);

      expect(consoleSpy).toHaveBeenCalledWith('Export orders error:', expect.any(Error));
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'An error occurred while exporting orders'
      });
      
      consoleSpy.mockRestore();
    });

    it('should handle unauthorized access', async () => {
      const next = jest.fn();
      req.user = { role: 'customer' }; // Wrong role

      const handler = extractHandler(orderController.exportOrders);
      await handler(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Insufficient permissions for this export'
      });
    });
  });

  describe('updateOrderStatus edge cases', () => {
    it('should handle invalid status transitions', async () => {
      req.params.orderId = 'ORD001';
      req.body.status = 'processed'; // Invalid transition from delivered
      req.user = { role: 'admin' }; // Need admin role to update status

      const mockOrder = {
        orderId: 'ORD001',
        status: 'delivered',
      save: jest.fn()
      };

      Order.findOne = createFindOneMock(mockOrder);

      const handler = orderController.updateOrderStatus;
      await handler(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid status transition from delivered to processed'
      });
    });
  });

  describe('cancelOrder method', () => {
    it('should handle order not found', async () => {
      const next = jest.fn();
      req.params.orderId = 'ORD999';
      req.user = { customerId: 'CUST123' };

      Order.findOne = createFindOneMock(null);

      const handler = orderController.cancelOrder;
      await handler(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Order not found'
      });
    });

    it('should handle cancellation of non-cancellable order', async () => {
      req.params.orderId = 'ORD001';
      req.user = { customerId: 'CUST123' };

      const mockOrder = {
        orderId: 'ORD001',
        customerId: 'CUST123',
        status: 'delivered', // Cannot cancel delivered orders
        save: jest.fn().mockResolvedValue(true)
      };

      Order.findOne = createFindOneMock(mockOrder);

      const handler = extractHandler(orderController.cancelOrder);
      await handler(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Orders in delivered status cannot be cancelled. Only in_progress or processed orders can be cancelled.'
      });
    });
  });

  describe('bulkUpdateOrderStatus', () => {
    it('should handle invalid order IDs format', async () => {
      const next = jest.fn();
      req.body = {
        orderIds: 'not-an-array', // Should be array
        status: 'processed'
      };
      req.user = { role: 'operator' };

      const handler = orderController.bulkUpdateOrderStatus;
      await handler(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Order IDs must be provided as an array'
      });
    });

    it('should handle empty order IDs array', async () => {
      const next = jest.fn();
      req.body = {
        orderIds: [],
        status: 'processed'
      };
      req.user = { role: 'operator' };

      const handler = extractHandler(orderController.bulkUpdateOrderStatus);
      await handler(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Order IDs must be provided as an array'
      });
    });

    it('should handle unauthorized access', async () => {
      const next = jest.fn();
      req.body = {
        orderIds: ['ORD001'],
        status: 'processed'
      };
      req.user = { role: 'customer' }; // Wrong role

      // Mock finding orders
      Order.find = jest.fn().mockResolvedValue([
        { orderId: 'ORD001', affiliateId: 'AFF123' }
      ]);

      const handler = extractHandler(orderController.bulkUpdateOrderStatus);
      await handler(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Unauthorized'
      });
    });
  });
});