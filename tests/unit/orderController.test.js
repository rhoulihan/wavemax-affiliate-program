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

describe('Order Controller', () => {
  let req, res;

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
    jest.clearAllMocks();
  });

  describe('createOrder', () => {
    it('should successfully create a new order', async () => {
      const mockCustomer = {
        customerId: 'CUST123',
        firstName: 'Jane',
        lastName: 'Smith'
      };

      const mockAffiliate = {
        affiliateId: 'AFF123',
        deliveryFee: 5.99
      };

      const mockOrder = {
        orderId: 'ORD123456',
        estimatedTotal: 49.46,
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
        numberOfBags: 2,
        serviceNotes: 'Handle with care',
        deliveryDate: '2025-05-27',
        deliveryTime: 'afternoon',
        specialDeliveryInstructions: 'Leave at door'
      };
      req.user = { role: 'customer', customerId: 'CUST123' };

      Customer.findOne.mockResolvedValue(mockCustomer);
      Affiliate.findOne.mockResolvedValue(mockAffiliate);
      Order.prototype.save = jest.fn().mockImplementation(function() {
        Object.assign(this, mockOrder);
        return Promise.resolve(this);
      });
      emailService.sendCustomerOrderConfirmationEmail.mockResolvedValue();
      emailService.sendAffiliateNewOrderEmail.mockResolvedValue();

      await orderController.createOrder(req, res);

      expect(Customer.findOne).toHaveBeenCalledWith({ customerId: 'CUST123' });
      expect(Affiliate.findOne).toHaveBeenCalledWith({ affiliateId: 'AFF123' });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        orderId: 'ORD123456',
        estimatedTotal: 49.46,
        message: 'Pickup scheduled successfully!'
      });
    });

    it('should handle email sending failures gracefully', async () => {
      const mockCustomer = { customerId: 'CUST123' };
      const mockAffiliate = { affiliateId: 'AFF123', deliveryFee: 5.99 };
      const mockOrder = {
        orderId: 'ORD123456',
        estimatedTotal: 49.46,
        save: jest.fn()
      };
      mockOrder.save.mockResolvedValue(mockOrder);

      req.body = {
        customerId: 'CUST123',
        affiliateId: 'AFF123',
        pickupDate: '2025-05-25',
        pickupTime: 'morning',
        estimatedWeight: 30,
        numberOfBags: 2,
        deliveryDate: '2025-05-27',
        deliveryTime: 'afternoon'
      };
      req.user = { role: 'customer', customerId: 'CUST123' };

      Customer.findOne.mockResolvedValue(mockCustomer);
      Affiliate.findOne.mockResolvedValue(mockAffiliate);
      Order.prototype.save = jest.fn().mockImplementation(function() {
        Object.assign(this, mockOrder);
        return Promise.resolve(this);
      });
      emailService.sendCustomerOrderConfirmationEmail.mockRejectedValue(new Error('Email failed'));
      emailService.sendAffiliateNewOrderEmail.mockRejectedValue(new Error('Email failed'));

      await orderController.createOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        orderId: 'ORD123456',
        estimatedTotal: 49.46,
        message: 'Pickup scheduled successfully!'
      });
    });

    it('should return error for invalid customer', async () => {
      req.body = {
        customerId: 'INVALID',
        affiliateId: 'AFF123'
      };
      req.user = { role: 'admin' };

      Customer.findOne.mockResolvedValue(null);

      await orderController.createOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid customer ID'
      });
    });

    it('should return error for invalid affiliate', async () => {
      const mockCustomer = { customerId: 'CUST123' };

      req.body = {
        customerId: 'CUST123',
        affiliateId: 'INVALID'
      };
      req.user = { role: 'admin' };

      Customer.findOne.mockResolvedValue(mockCustomer);
      Affiliate.findOne.mockResolvedValue(null);

      await orderController.createOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid affiliate ID'
      });
    });

    it('should enforce authorization', async () => {
      req.body = {
        customerId: 'CUST456',
        affiliateId: 'AFF123'
      };
      req.user = { role: 'customer', customerId: 'CUST123' };

      Customer.findOne.mockResolvedValue({ customerId: 'CUST456' });
      Affiliate.findOne.mockResolvedValue({ affiliateId: 'AFF123' });

      await orderController.createOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Unauthorized'
      });
    });
  });

  describe('getOrderDetails', () => {
    it('should return order details for authorized user', async () => {
      const mockOrder = {
        orderId: 'ORD123',
        customerId: 'CUST123',
        affiliateId: 'AFF123',
        status: 'processing',
        pickupDate: '2025-05-25',
        deliveryDate: '2025-05-27'
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
      expect(res.json).toHaveBeenCalledWith({
        success: true,
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
      });
    });

    it('should return 404 for non-existent order', async () => {
      req.params.orderId = 'NONEXISTENT';
      req.user = { role: 'admin' };

      Order.findOne.mockResolvedValue(null);

      await orderController.getOrderDetails(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Order not found'
      });
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
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Unauthorized'
      });
    });
  });

  describe('updateOrderStatus', () => {
    it('should successfully update order status', async () => {
      const mockOrder = {
        orderId: 'ORD123',
        customerId: 'CUST123',
        affiliateId: 'AFF123',
        status: 'scheduled',
        save: jest.fn()
      };

      const mockCustomer = { customerId: 'CUST123' };
      const mockAffiliate = { affiliateId: 'AFF123' };

      req.params.orderId = 'ORD123';
      req.body = { status: 'picked_up' };
      req.user = { role: 'affiliate', affiliateId: 'AFF123' };

      Order.findOne.mockResolvedValue(mockOrder);
      Customer.findOne.mockResolvedValue(mockCustomer);
      Affiliate.findOne.mockResolvedValue(mockAffiliate);
      emailService.sendOrderStatusUpdateEmail.mockResolvedValue();

      await orderController.updateOrderStatus(req, res);

      expect(mockOrder.status).toBe('picked_up');
      expect(mockOrder.save).toHaveBeenCalled();
      expect(emailService.sendOrderStatusUpdateEmail).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          status: 'picked_up'
        })
      );
    });

    it('should update actual weight when processing', async () => {
      const mockOrder = {
        orderId: 'ORD123',
        status: 'picked_up',
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
        status: 'delivered'
      };

      req.params.orderId = 'ORD123';
      req.body = { status: 'scheduled' };
      req.user = { role: 'admin' };

      Order.findOne.mockResolvedValue(mockOrder);

      await orderController.updateOrderStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid status transition from delivered to scheduled'
      });
    });

    it('should send commission email when delivered', async () => {
      const mockOrder = {
        orderId: 'ORD123',
        status: 'ready_for_delivery',
        save: jest.fn()
      };

      const mockCustomer = { customerId: 'CUST123' };
      const mockAffiliate = { affiliateId: 'AFF123' };

      req.params.orderId = 'ORD123';
      req.body = { status: 'delivered' };
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
        status: 'scheduled',
        save: jest.fn()
      };

      const mockCustomer = { customerId: 'CUST123' };
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
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Order cancelled successfully'
      });
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
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Orders in processing status cannot be cancelled'
      });
    });
  });
});