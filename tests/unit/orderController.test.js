const orderController = require('../../server/controllers/orderController');
const Order = require('../../server/models/Order');
const Customer = require('../../server/models/Customer');
const Affiliate = require('../../server/models/Affiliate');
const SystemConfig = require('../../server/models/SystemConfig');
const emailService = require('../../server/utils/emailService');
const { expectSuccessResponse, expectErrorResponse } = require('../helpers/responseHelpers');
const { extractHandler } = require('../helpers/testUtils');
const { createFindOneMock, createFindMock, createMockDocument, createAggregateMock } = require('../helpers/mockHelpers');

// Mock dependencies
jest.mock('../../server/models/Order');
jest.mock('../../server/models/Customer');
jest.mock('../../server/models/Affiliate');
jest.mock('../../server/models/SystemConfig');
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
    
    // Mock SystemConfig
    SystemConfig.getValue = jest.fn().mockImplementation((key, defaultValue) => {
      const values = {
        'delivery_minimum_fee': 10.00,
        'delivery_per_bag_fee': 2.00,
        'wdf_base_rate_per_pound': 1.25,
        'wdf_add_on_per_pound': 0.10
      };
      return Promise.resolve(values[key] || defaultValue);
    });
  });

  describe('getOrderDetails', () => {
    it('should return order details for authorized user', async () => {
      const mockOrder = {
        orderId: 'ORD123',
        customerId: 'CUST123',
        affiliateId: 'AFF123',
        status: 'in_progress',
        bagId: 'BAG-unit-1'};

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
        affiliateId: 'AFF123'
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
    it('should successfully update order status', async () => {
      const mockOrder = {
        orderId: 'ORD123',
        customerId: 'CUST123',
        affiliateId: 'AFF123',
        status: 'in_progress',
        save: jest.fn()
      };

      const mockCustomer = { customerId: 'CUST123', save: jest.fn().mockResolvedValue(true) };
      const mockAffiliate = { affiliateId: 'AFF123' };

      req.params.orderId = 'ORD123';
      req.body = { status: 'processed' }; // Use valid status
      req.user = { role: 'affiliate', affiliateId: 'AFF123' };

      Order.findOne.mockResolvedValue(mockOrder);
      Customer.findOne.mockResolvedValue(mockCustomer);
      Affiliate.findOne.mockResolvedValue(mockAffiliate);
      emailService.sendOrderStatusUpdateEmail.mockResolvedValue();

      await orderController.updateOrderStatus(req, res);

      // PR 1 interim: marking an order 'processed' runs orderReadyGateService
      // .applyReadyGate, which now promotes processed -> ready_for_pickup
      // unconditionally (payment gate removed). So the persisted status is
      // ready_for_pickup. (PR 3 rewrites the lifecycle.)
      expect(mockOrder.status).toBe('ready_for_pickup');
      expect(mockOrder.save).toHaveBeenCalled();
      expect(emailService.sendOrderStatusUpdateEmail).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expectSuccessResponse({
          orderId: 'ORD123',
          status: 'ready_for_pickup',
          actualWeight: undefined,
          actualTotal: undefined,
          affiliateCommission: undefined
        }, 'Order status updated successfully!')
      );
    });

    it('should update actual weight when marking processed', async () => {
      const mockOrder = {
        orderId: 'ORD123',
        status: 'in_progress', // Use valid status
        save: jest.fn()
      };

      req.params.orderId = 'ORD123';
      req.body = { status: 'processed', actualWeight: 25.5 };
      req.user = { role: 'admin' };

      Order.findOne.mockResolvedValue(mockOrder);
      Customer.findOne.mockResolvedValue({});
      Affiliate.findOne.mockResolvedValue({});
      emailService.sendOrderStatusUpdateEmail.mockResolvedValue();

      await orderController.updateOrderStatus(req, res);

      // PR 1 interim: 'processed' auto-advances via the ready gate (see above).
      expect(mockOrder.status).toBe('ready_for_pickup');
      expect(mockOrder.actualWeight).toBe(25.5);
      expect(mockOrder.save).toHaveBeenCalled();
    });

    it('should validate status transitions', async () => {
      const mockOrder = {
        orderId: 'ORD123',
        status: 'delivered'
      };

      req.params.orderId = 'ORD123';
      req.body = { status: 'processed' };
      req.user = { role: 'admin' };

      Order.findOne.mockResolvedValue(mockOrder);

      await orderController.updateOrderStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expectErrorResponse('Invalid status transition from delivered to processed')
      );
    });

    it('should send commission email when delivered', async () => {
      const mockOrder = {
        orderId: 'ORD123',
        status: 'picked_up', // delivered is reachable only from picked_up
        save: jest.fn()
      };

      const mockCustomer = { customerId: 'CUST123', save: jest.fn().mockResolvedValue(true) };
      const mockAffiliate = { affiliateId: 'AFF123' };

      req.params.orderId = 'ORD123';
      req.body = { status: 'delivered' };
      req.user = { role: 'admin' };

      Order.findOne.mockResolvedValue(mockOrder);
      Customer.findOne.mockResolvedValue(mockCustomer);
      // The controller calls Affiliate.findOne(...) directly (for the commission
      // email) AND applyW9ThresholdCheck (delivered only) calls it with .select().
      // Return a thenable that also exposes .select so both call sites resolve to
      // mockAffiliate and the non-blocking W-9 service doesn't log a mock-gap error.
      Affiliate.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockAffiliate),
        then: (resolve) => resolve(mockAffiliate)
      });
      emailService.sendOrderStatusUpdateEmail.mockResolvedValue();
      emailService.sendAffiliateCommissionEmail.mockResolvedValue();

      await orderController.updateOrderStatus(req, res);

      expect(emailService.sendAffiliateCommissionEmail).toHaveBeenCalledWith(
        mockAffiliate,
        mockOrder,
        mockCustomer
      );
    });
  });

  describe('cancelOrder', () => {
    it('should successfully cancel an order', async () => {
      const mockOrder = {
        orderId: 'ORD123',
        customerId: 'CUST123',
        affiliateId: 'AFF123',
        status: 'in_progress',
        save: jest.fn()
      };

      const mockCustomer = { customerId: 'CUST123', save: jest.fn().mockResolvedValue(true) };
      const mockAffiliate = { affiliateId: 'AFF123' };

      req.params.orderId = 'ORD123';
      req.user = { role: 'customer', customerId: 'CUST123' };

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

    it('should prevent cancelling non-cancellable orders', async () => {
      const mockOrder = {
        orderId: 'ORD123',
        status: 'picked_up'
      };

      req.params.orderId = 'ORD123';
      req.user = { role: 'admin' };

      Order.findOne.mockResolvedValue(mockOrder);

      await orderController.cancelOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expectErrorResponse('Orders in picked_up status cannot be cancelled. Only in_progress or processed orders can be cancelled.')
      );
    });
  });
});