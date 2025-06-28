const orderController = require('../../server/controllers/orderController');
const Order = require('../../server/models/Order');
const Customer = require('../../server/models/Customer');
const Affiliate = require('../../server/models/Affiliate');
const emailService = require('../../server/utils/emailService');

// Mock dependencies
jest.mock('../../server/models/Order');
jest.mock('../../server/models/Customer');
jest.mock('../../server/models/Affiliate');
jest.mock('../../server/utils/emailService');

describe('Order Controller - Additional Coverage', () => {
  let req, res;

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
    jest.clearAllMocks();
  });

  describe('checkActiveOrders', () => {
    it('should check active orders for authenticated customer', async () => {
      req.user.customerId = 'CUST123';
      
      const mockOrder = {
        orderId: 'ORD001',
        status: 'pending',
        createdAt: new Date(),
        pickupDate: new Date(),
        pickupTime: 'morning'
      };
      
      Order.findOne = jest.fn().mockReturnValue({
        select: jest.fn().mockResolvedValue(mockOrder)
      });

      await orderController.checkActiveOrders(req, res);

      expect(Order.findOne).toHaveBeenCalledWith({
        customerId: 'CUST123',
        status: { $in: ['pending', 'processing', 'processed'] }
      });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        hasActiveOrder: true,
        activeOrder: {
          orderId: mockOrder.orderId,
          status: mockOrder.status,
          createdAt: mockOrder.createdAt,
          pickupDate: mockOrder.pickupDate,
          pickupTime: mockOrder.pickupTime
        }
      });
    });

    it('should return no active orders when none exist', async () => {
      req.user.customerId = 'CUST123';
      
      Order.findOne = jest.fn().mockReturnValue({
        select: jest.fn().mockResolvedValue(null)
      });

      await orderController.checkActiveOrders(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        hasActiveOrder: false
      });
    });

    it('should handle missing customer ID', async () => {
      req.user = {}; // No customerId

      await orderController.checkActiveOrders(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Customer ID not found in session'
      });
    });

    it('should handle database errors', async () => {
      req.user.customerId = 'CUST123';
      
      Order.findOne = jest.fn().mockReturnValue({
        select: jest.fn().mockRejectedValue(new Error('DB Error'))
      });

      await orderController.checkActiveOrders(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Failed to check active orders'
      });
    });
  });

  describe('createOrder error handling', () => {
    it('should handle general errors during order creation', async () => {
      req.user.customerId = 'CUST123';
      req.body = {
        affiliateId: 'AFF123',
        pickupDate: '2025-05-25',
        pickupTime: 'morning',
        estimatedWeight: 20
      };

      Customer.findOne = jest.fn().mockRejectedValue(new Error('Database error'));
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await orderController.createOrder(req, res);

      expect(consoleSpy).toHaveBeenCalledWith('Order creation error:', expect.any(Error));
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'An error occurred while scheduling the pickup'
      });
      
      consoleSpy.mockRestore();
    });
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
        pickupDate: new Date('2025-05-25'),
        deliveryDate: new Date('2025-05-27'),
        createdAt: new Date('2025-05-24')
      }];
      
      Order.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockResolvedValue(mockOrders)
      });

      // Mock Customer.find for the CSV export
      Customer.find = jest.fn().mockResolvedValue([{
        customerId: 'CUST123',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com'
      }]);

      await orderController.exportOrders(req, res);

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
        pickupDate: new Date('2025-05-25'),
        deliveryDate: new Date('2025-05-27'),
        createdAt: new Date('2025-05-24'),
        affiliateId: 'AFF123'
      }];
      
      Order.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockResolvedValue(mockOrders)
      });

      Customer.find = jest.fn().mockResolvedValue([{
        customerId: 'CUST123',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com'
      }]);

      await orderController.exportOrders(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        exportDate: expect.any(String),
        filters: { startDate: undefined, endDate: undefined, affiliateId: undefined, status: undefined },
        totalOrders: 1,
        orders: expect.arrayContaining([
          expect.objectContaining({
            orderId: 'ORD001',
            customer: expect.objectContaining({
              name: 'John Doe',
              email: 'john@example.com'
            }),
            affiliateId: 'AFF123',
            status: 'complete'
          })
        ])
      });
    });

    it('should handle export errors', async () => {
      Order.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockRejectedValue(new Error('Export failed'))
      });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await orderController.exportOrders(req, res);

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

      await orderController.exportOrders(req, res);

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
      req.body.status = 'pending'; // Invalid transition from complete
      req.user = { role: 'admin' }; // Need admin role to update status

      const mockOrder = {
        orderId: 'ORD001',
        status: 'complete',
        save: jest.fn()
      };

      Order.findOne = jest.fn().mockResolvedValue(mockOrder);

      await orderController.updateOrderStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid status transition from complete to pending'
      });
    });
  });

  describe('cancelOrder method', () => {
    it('should handle order not found', async () => {
      req.params.orderId = 'ORD999';
      req.user = { customerId: 'CUST123' };

      Order.findOne = jest.fn().mockResolvedValue(null);

      await orderController.cancelOrder(req, res);

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
        status: 'complete' // Cannot cancel completed orders
      };

      Order.findOne = jest.fn().mockResolvedValue(mockOrder);

      await orderController.cancelOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Orders in complete status cannot be cancelled. Only pending orders can be cancelled.'
      });
    });
  });

  describe('updatePaymentStatus', () => {
    beforeEach(() => {
      req.user = { role: 'admin' }; // Need admin or affiliate role
    });

    it('should handle order not found', async () => {
      req.params.orderId = 'ORD999';
      req.body.paymentStatus = 'completed';

      Order.findOne = jest.fn().mockResolvedValue(null);

      await orderController.updatePaymentStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Order not found'
      });
    });

    it('should prevent payment updates on non-complete orders', async () => {
      req.params.orderId = 'ORD001';
      req.body.paymentStatus = 'completed';

      const mockOrder = {
        orderId: 'ORD001',
        status: 'pending' // Not complete
      };

      Order.findOne = jest.fn().mockResolvedValue(mockOrder);

      await orderController.updatePaymentStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Cannot update payment status for non-complete orders'
      });
    });

    it('should allow refund on complete orders regardless of payment status', async () => {
      req.params.orderId = 'ORD001';
      req.body.paymentStatus = 'refunded';
      req.body.refundAmount = 50;
      req.body.refundReason = 'Customer request';

      const mockOrder = {
        orderId: 'ORD001',
        status: 'complete',
        paymentStatus: 'pending', // Not completed but can still refund
        save: jest.fn().mockResolvedValue(true)
      };

      Order.findOne = jest.fn().mockResolvedValue(mockOrder);

      await orderController.updatePaymentStatus(req, res);

      expect(mockOrder.save).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Payment status updated successfully',
        order: expect.objectContaining({
          orderId: 'ORD001',
          paymentStatus: 'refunded'
        })
      });
    });
  });

  describe('bulkUpdateOrderStatus', () => {
    it('should handle invalid order IDs format', async () => {
      req.body = {
        orderIds: 'not-an-array', // Should be array
        status: 'processing'
      };
      req.user = { role: 'operator' };

      await orderController.bulkUpdateOrderStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Order IDs must be provided as an array'
      });
    });

    it('should handle empty order IDs array', async () => {
      req.body = {
        orderIds: [],
        status: 'processing'
      };
      req.user = { role: 'operator' };

      await orderController.bulkUpdateOrderStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Order IDs must be provided as an array'
      });
    });

    it('should handle unauthorized access', async () => {
      req.body = {
        orderIds: ['ORD001'],
        status: 'processing'
      };
      req.user = { role: 'customer' }; // Wrong role

      // Mock finding orders
      Order.find = jest.fn().mockResolvedValue([
        { orderId: 'ORD001', affiliateId: 'AFF123' }
      ]);

      await orderController.bulkUpdateOrderStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Unauthorized'
      });
    });
  });
});