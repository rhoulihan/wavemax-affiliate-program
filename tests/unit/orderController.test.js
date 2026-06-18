// Order controller unit tests — 4-state scan-gate machine (Phase 1 PR 3).
// Orders are slim state records: no weight/price/commission/credit anywhere.
// status: pending -> in_progress -> out_for_delivery -> complete (+cancelled from any open state).
const orderController = require('../../server/controllers/orderController');
const Order = require('../../server/models/Order');
const Customer = require('../../server/models/Customer');
const Affiliate = require('../../server/models/Affiliate');
const emailService = require('../../server/utils/emailService');
const { expectSuccessResponse, expectErrorResponse } = require('../helpers/responseHelpers');

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

describe('Order Controller', () => {
  let req, res, next;

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
    next = jest.fn();
    jest.clearAllMocks();
  });

  describe('getOrderDetails', () => {
    it('should return order details for authorized user', async () => {
      const mockOrder = {
        orderId: 'ORD123',
        customerId: 'CUST123',
        affiliateId: 'AFF123',
        bagId: 'BAG-unit-1',
        status: 'in_progress',
        pickup: { at: new Date(), by: 'AFF123', role: 'affiliate' }
      };

      const mockCustomer = {
        customerId: 'CUST123',
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@example.com',
        phone: '555-123-4567',
        address: '123 Main St',
        city: 'Austin',
        state: 'TX',
        zipCode: '78701'
      };

      const mockAffiliate = {
        affiliateId: 'AFF123',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '555-987-6543'
      };

      req.params.orderId = 'ORD123';
      req.user = { role: 'customer', customerId: 'CUST123' };

      Order.findOne.mockResolvedValue(mockOrder);
      Customer.findOne.mockResolvedValue(mockCustomer);
      Affiliate.findOne.mockResolvedValue(mockAffiliate);

      await orderController.getOrderDetails(req, res);

      expect(Order.findOne).toHaveBeenCalledWith({ orderId: 'ORD123' });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expectSuccessResponse({
          order: expect.objectContaining({
            orderId: 'ORD123',
            customerId: 'CUST123',
            affiliateId: 'AFF123',
            bagId: 'BAG-unit-1',
            status: 'In Progress',
            customer: expect.objectContaining({
              name: 'Jane Smith',
              email: 'jane@example.com'
            }),
            affiliate: expect.objectContaining({
              name: 'John Doe',
              email: 'john@example.com'
            })
          })
        }, 'Order details retrieved successfully')
      );
    });

    it('should return 404 for non-existent order', async () => {
      req.params.orderId = 'NONEXISTENT';
      req.user = { role: 'admin' };

      Order.findOne.mockResolvedValue(null);

      await orderController.getOrderDetails(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expectErrorResponse('Order not found')
      );
    });

    it('should enforce authorization for customers', async () => {
      const mockOrder = {
        orderId: 'ORD123',
        customerId: 'CUST456',
        affiliateId: 'AFF123',
        status: 'in_progress'
      };

      req.params.orderId = 'ORD123';
      req.user = { role: 'customer', customerId: 'CUST123' };

      Order.findOne.mockResolvedValue(mockOrder);

      await orderController.getOrderDetails(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expectErrorResponse('Unauthorized')
      );
    });
  });

  describe('updateOrderStatus', () => {
    it('should advance pending -> in_progress and stamp intake', async () => {
      const mockOrder = {
        orderId: 'ORD123',
        customerId: 'CUST123',
        affiliateId: 'AFF123',
        status: 'pending',
        save: jest.fn()
      };

      const mockCustomer = { customerId: 'CUST123', emailVerified: true };

      req.params.orderId = 'ORD123';
      req.body = { status: 'in_progress' };
      req.user = { id: 'op1', role: 'operator' };

      Order.findOne.mockResolvedValue(mockOrder);
      Customer.findOne.mockResolvedValue(mockCustomer);
      emailService.sendOrderStatusUpdateEmail.mockResolvedValue();

      await orderController.updateOrderStatus(req, res);

      expect(mockOrder.status).toBe('in_progress');
      expect(mockOrder.intake).toBeDefined();
      expect(mockOrder.intake.role).toBe('operator');
      expect(mockOrder.save).toHaveBeenCalled();
      expect(emailService.sendOrderStatusUpdateEmail).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          orderId: 'ORD123',
          status: 'in_progress',
          message: 'Order status updated successfully!'
        })
      );
    });

    it('should advance out_for_delivery -> complete and stamp delivery + completedAt', async () => {
      const mockOrder = {
        orderId: 'ORD123',
        customerId: 'CUST123',
        affiliateId: 'AFF123',
        status: 'out_for_delivery',
        save: jest.fn()
      };

      req.params.orderId = 'ORD123';
      req.body = { status: 'complete' };
      req.user = { id: 'AFF123', role: 'affiliate', affiliateId: 'AFF123' };

      Order.findOne.mockResolvedValue(mockOrder);
      Customer.findOne.mockResolvedValue({ customerId: 'CUST123' });
      emailService.sendOrderStatusUpdateEmail.mockResolvedValue();

      await orderController.updateOrderStatus(req, res);

      expect(mockOrder.status).toBe('complete');
      expect(mockOrder.delivery).toBeDefined();
      expect(mockOrder.delivery.role).toBe('affiliate');
      expect(mockOrder.completedAt).toBeDefined();
      expect(mockOrder.save).toHaveBeenCalled();
    });

    it('should reject invalid status transitions', async () => {
      const mockOrder = {
        orderId: 'ORD123',
        affiliateId: 'AFF123',
        status: 'complete'
      };

      req.params.orderId = 'ORD123';
      req.body = { status: 'in_progress' };
      req.user = { role: 'admin' };

      Order.findOne.mockResolvedValue(mockOrder);

      await orderController.updateOrderStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'Invalid status transition from complete to in_progress'
        })
      );
    });

    it('should reject unauthorized affiliate', async () => {
      const mockOrder = {
        orderId: 'ORD123',
        affiliateId: 'AFF123',
        status: 'pending'
      };

      req.params.orderId = 'ORD123';
      req.body = { status: 'in_progress' };
      req.user = { role: 'affiliate', affiliateId: 'AFF999' };

      Order.findOne.mockResolvedValue(mockOrder);

      await orderController.updateOrderStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, message: 'Unauthorized' })
      );
    });
  });

  describe('cancelOrder', () => {
    it('should successfully cancel an open order', async () => {
      const mockOrder = {
        orderId: 'ORD123',
        customerId: 'CUST123',
        affiliateId: 'AFF123',
        status: 'in_progress',
        save: jest.fn()
      };

      const mockCustomer = { customerId: 'CUST123', emailVerified: true };
      const mockAffiliate = { affiliateId: 'AFF123' };

      req.params.orderId = 'ORD123';
      req.user = { id: 'CUST123', role: 'customer', customerId: 'CUST123' };

      Order.findOne.mockResolvedValue(mockOrder);
      Customer.findOne.mockResolvedValue(mockCustomer);
      Affiliate.findOne.mockResolvedValue(mockAffiliate);
      emailService.sendOrderCancellationEmail.mockResolvedValue();
      emailService.sendAffiliateOrderCancellationEmail.mockResolvedValue();

      await orderController.cancelOrder(req, res);

      expect(mockOrder.status).toBe('cancelled');
      expect(mockOrder.cancelledAt).toBeDefined();
      expect(mockOrder.save).toHaveBeenCalled();
      expect(emailService.sendOrderCancellationEmail).toHaveBeenCalled();
      expect(emailService.sendAffiliateOrderCancellationEmail).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expectSuccessResponse({
          orderId: 'ORD123',
          status: 'Cancelled',
          cancelledAt: expect.any(String)
        }, 'Order cancelled successfully')
      );
    });

    it('should prevent cancelling closed orders', async () => {
      const mockOrder = {
        orderId: 'ORD123',
        affiliateId: 'AFF123',
        status: 'complete'
      };

      req.params.orderId = 'ORD123';
      req.user = { role: 'admin' };

      Order.findOne.mockResolvedValue(mockOrder);

      await orderController.cancelOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expectErrorResponse('Orders in complete status cannot be cancelled.')
      );
    });
  });

  describe('getOrderStatistics', () => {
    it('should aggregate orders by the 4-state vocabulary', async () => {
      req.query = { affiliateId: 'AFF123' };
      req.user = { role: 'affiliate', affiliateId: 'AFF123' };

      Order.find = jest.fn().mockResolvedValue([
        { status: 'pending' },
        { status: 'in_progress' },
        { status: 'out_for_delivery' },
        { status: 'complete' },
        { status: 'complete' },
        { status: 'cancelled' }
      ]);

      await orderController.getOrderStatistics(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        statistics: {
          totalOrders: 6,
          ordersByStatus: {
            pending: 1,
            in_progress: 1,
            out_for_delivery: 1,
            complete: 2,
            cancelled: 1
          },
          completedCount: 2
        }
      });
    });

    it('should reject unauthorized roles', async () => {
      req.query = {};
      req.user = { role: 'customer', customerId: 'CUST123' };

      await orderController.getOrderStatistics(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, message: 'Unauthorized' })
      );
    });
  });
});
