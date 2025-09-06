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

  describe('createOrder', () => {
    it('should successfully create a new order', async () => {
      const mockCustomer = {
        customerId: 'CUST123',
        firstName: 'Jane',
        lastName: 'Smith',
        save: jest.fn().mockResolvedValue(true)
      };

      const mockAffiliate = {
        affiliateId: 'AFF123',
        deliveryFee: 5.99,
        perBagFee: 2.00,
        firstName: 'Test',
        lastName: 'Affiliate'
      };

      const mockOrder = {
        orderId: 'ORD123456',
        estimatedTotal: 49.46,
        _id: 'mockOrderId',
        bagCreditApplied: 0,
        wdfCreditApplied: 0,
        addOns: undefined,
        addOnTotal: undefined,
        toObject: jest.fn().mockReturnValue({
          orderId: 'ORD123456',
          estimatedTotal: 49.46,
          bagCreditApplied: 0,
          wdfCreditApplied: 0
        }),
        save: jest.fn()
      };
      mockOrder.save.mockResolvedValue(mockOrder);

      req.body = {
        customerId: 'CUST123',
        affiliateId: 'AFF123',
        pickupDate: '2025-05-25',
        pickupTime: 'morning',
        specialPickupInstructions: 'Ring doorbell',
        estimatedWeight: 30,
        numberOfBags: 2
      };

      req.user = { role: 'customer', customerId: 'CUST123' };

      Customer.findOne.mockResolvedValue(mockCustomer);
      Affiliate.findOne.mockResolvedValue(mockAffiliate);
      Order.findOne = jest.fn().mockResolvedValue(null); // No active order
      Order.mockImplementation(() => mockOrder);
      Order.prototype.save = jest.fn().mockImplementation(function() {
        Object.assign(this, mockOrder);
        return Promise.resolve(this);
      });
      Order.findById = jest.fn().mockResolvedValue(mockOrder);
      emailService.sendCustomerOrderConfirmationEmail.mockResolvedValue();
      emailService.sendAffiliateNewOrderEmail.mockResolvedValue();

      await orderController.createOrder(req, res);

      expect(Customer.findOne).toHaveBeenCalledWith({ customerId: 'CUST123' });
      expect(Affiliate.findOne).toHaveBeenCalledWith({ affiliateId: 'AFF123' });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expectSuccessResponse({
          orderId: 'ORD123456',
          estimatedTotal: '$49.46',
          bagCreditApplied: '$0.00',
          wdfCreditApplied: '$0.00',
          addOns: undefined,
          addOnTotal: '$0.00'
        }, 'Pickup scheduled successfully!')
      );
    });

    it('should handle email sending failures gracefully', async () => {
      const mockCustomer = { customerId: 'CUST123', save: jest.fn().mockResolvedValue(true) };
      const mockAffiliate = {
        affiliateId: 'AFF123',
        deliveryFee: 5.99,
        perBagFee: 2.00,
        firstName: 'Test',
        lastName: 'Affiliate'
      };
      const mockOrder = {
        orderId: 'ORD123456',
        estimatedTotal: 49.46,
        _id: 'mockOrderId',
        bagCreditApplied: 0,
        wdfCreditApplied: 0,
        addOns: undefined,
        addOnTotal: undefined,
        toObject: jest.fn().mockReturnValue({
          orderId: 'ORD123456',
          estimatedTotal: 49.46,
          bagCreditApplied: 0,
          wdfCreditApplied: 0
        }),
        save: jest.fn()
      };
      mockOrder.save.mockResolvedValue(mockOrder);

      req.body = {
        customerId: 'CUST123',
        affiliateId: 'AFF123',
        pickupDate: '2025-05-25',
        pickupTime: 'morning',
        estimatedWeight: 30,
        numberOfBags: 2};
      req.user = { role: 'customer', customerId: 'CUST123' };

      Customer.findOne.mockResolvedValue(mockCustomer);
      Affiliate.findOne.mockResolvedValue(mockAffiliate);
      Order.findOne = jest.fn().mockResolvedValue(null); // No active order
      Order.mockImplementation(() => mockOrder);
      Order.prototype.save = jest.fn().mockImplementation(function() {
        Object.assign(this, mockOrder);
        return Promise.resolve(this);
      });
      Order.findById = jest.fn().mockResolvedValue(mockOrder);
      emailService.sendCustomerOrderConfirmationEmail.mockRejectedValue(new Error('Email failed'));
      emailService.sendAffiliateNewOrderEmail.mockRejectedValue(new Error('Email failed'));

      await orderController.createOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expectSuccessResponse({
          orderId: 'ORD123456',
          estimatedTotal: '$49.46',
          bagCreditApplied: '$0.00',
          wdfCreditApplied: '$0.00',
          addOns: undefined,
          addOnTotal: '$0.00'
        }, 'Pickup scheduled successfully!')
      );
    });

    it('should return error for invalid customer', async () => {
      req.body = {
        customerId: 'INVALID',
        affiliateId: 'AFF123',
        pickupDate: '2025-05-25',
        pickupTime: 'morning'
      };
      req.user = { role: 'admin' };

      Customer.findOne.mockResolvedValue(null);

      await orderController.createOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expectErrorResponse('Invalid customer ID')
      );
    });

    it('should return error for invalid affiliate', async () => {
      const mockCustomer = { customerId: 'CUST123', save: jest.fn().mockResolvedValue(true) };

      req.body = {
        customerId: 'CUST123',
        affiliateId: 'INVALID',
        pickupDate: '2025-05-25',
        pickupTime: 'morning'
      };
      req.user = { role: 'admin' };

      Customer.findOne.mockResolvedValue(mockCustomer);
      Order.findOne = jest.fn().mockResolvedValue(null); // No active order
      Affiliate.findOne.mockResolvedValue(null);

      await orderController.createOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expectErrorResponse('Invalid affiliate ID')
      );
    });

    it('should enforce authorization', async () => {
      req.body = {
        customerId: 'CUST456',
        affiliateId: 'AFF123',
        pickupDate: '2025-05-25',
        pickupTime: 'morning'
      };
      req.user = { role: 'customer', customerId: 'CUST123' };

      Customer.findOne.mockResolvedValue({ customerId: 'CUST456' });
      Order.findOne = jest.fn().mockResolvedValue(null); // No active order  
      Affiliate.findOne.mockResolvedValue({ affiliateId: 'AFF123' });

      await orderController.createOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expectErrorResponse('Unauthorized')
      );
    });
  });

  describe('getOrderDetails', () => {
    it('should return order details for authorized user', async () => {
      const mockOrder = {
        orderId: 'ORD123',
        customerId: 'CUST123',
        affiliateId: 'AFF123',
        status: 'processing',
        pickupDate: '2025-05-25'};

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
        status: 'pending',
        save: jest.fn()
      };

      const mockCustomer = { customerId: 'CUST123', save: jest.fn().mockResolvedValue(true) };
      const mockAffiliate = { affiliateId: 'AFF123' };

      req.params.orderId = 'ORD123';
      req.body = { status: 'processing' }; // Use valid status
      req.user = { role: 'affiliate', affiliateId: 'AFF123' };

      Order.findOne.mockResolvedValue(mockOrder);
      Customer.findOne.mockResolvedValue(mockCustomer);
      Affiliate.findOne.mockResolvedValue(mockAffiliate);
      emailService.sendOrderStatusUpdateEmail.mockResolvedValue();

      await orderController.updateOrderStatus(req, res);

      expect(mockOrder.status).toBe('processing');
      expect(mockOrder.save).toHaveBeenCalled();
      expect(emailService.sendOrderStatusUpdateEmail).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expectSuccessResponse({
          orderId: 'ORD123',
          status: 'processing',
          actualWeight: undefined,
          actualTotal: undefined,
          affiliateCommission: undefined
        }, 'Order status updated successfully!')
      );
    });

    it('should update actual weight when processing', async () => {
      const mockOrder = {
        orderId: 'ORD123',
        status: 'pending', // Use valid status
        save: jest.fn()
      };

      req.params.orderId = 'ORD123';
      req.body = { status: 'processing', actualWeight: 25.5 };
      req.user = { role: 'admin' };

      Order.findOne.mockResolvedValue(mockOrder);
      Customer.findOne.mockResolvedValue({});
      Affiliate.findOne.mockResolvedValue({});
      emailService.sendOrderStatusUpdateEmail.mockResolvedValue();

      await orderController.updateOrderStatus(req, res);

      expect(mockOrder.status).toBe('processing');
      expect(mockOrder.actualWeight).toBe(25.5);
      expect(mockOrder.save).toHaveBeenCalled();
    });

    it('should validate status transitions', async () => {
      const mockOrder = {
        orderId: 'ORD123',
        status: 'complete'
      };

      req.params.orderId = 'ORD123';
      req.body = { status: 'pending' };
      req.user = { role: 'admin' };

      Order.findOne.mockResolvedValue(mockOrder);

      await orderController.updateOrderStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expectErrorResponse('Invalid status transition from complete to pending')
      );
    });

    it('should send commission email when complete', async () => {
      const mockOrder = {
        orderId: 'ORD123',
        status: 'processed', // Use valid status (ready for delivery)
        save: jest.fn()
      };

      const mockCustomer = { customerId: 'CUST123', save: jest.fn().mockResolvedValue(true) };
      const mockAffiliate = { affiliateId: 'AFF123' };

      req.params.orderId = 'ORD123';
      req.body = { status: 'complete' };
      req.user = { role: 'admin' };

      Order.findOne.mockResolvedValue(mockOrder);
      Customer.findOne.mockResolvedValue(mockCustomer);
      Affiliate.findOne.mockResolvedValue(mockAffiliate);
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
        status: 'pending',
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
        status: 'processing'
      };

      req.params.orderId = 'ORD123';
      req.user = { role: 'admin' };

      Order.findOne.mockResolvedValue(mockOrder);

      await orderController.cancelOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expectErrorResponse('Orders in processing status cannot be cancelled. Only pending orders can be cancelled.')
      );
    });
  });
});