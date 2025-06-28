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
      end: jest.fn()
    };
    jest.clearAllMocks();
  });

  describe('checkActiveOrders (lines 52-89)', () => {
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

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await orderController.checkActiveOrders(req, res);

      expect(consoleSpy).toHaveBeenCalledWith('Error checking active orders:', expect.any(Error));
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Failed to check active orders'
      });

      consoleSpy.mockRestore();
    });
  });

  describe('Error handling in various methods', () => {
    it('should handle error in createOrder when email service fails (lines 145-146)', async () => {
      req.body = {
        customerId: 'CUST123',
        pickupDate: new Date(),
        pickupTime: 'morning',
        estimatedBagCount: 2,
        estimatedWeight: 20,
        paymentIntent: 'pi_test123'
      };
      req.user = { affiliateId: 'AFF123' };

      const mockCustomer = {
        customerId: 'CUST123',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '555-1234'
      };

      const mockAffiliate = {
        affiliateId: 'AFF123',
        email: 'affiliate@example.com',
        minimumDeliveryFee: 25,
        perBagDeliveryFee: 5
      };

      Customer.findOne.mockResolvedValue(mockCustomer);
      Affiliate.findOne.mockResolvedValue(mockAffiliate);
      
      const mockOrder = {
        orderId: 'ORD123',
        save: jest.fn().mockResolvedValue(true),
        toJSON: jest.fn().mockReturnValue({ orderId: 'ORD123' })
      };
      Order.mockImplementation(() => mockOrder);
      
      // Mock email service to throw error
      emailService.sendOrderConfirmationEmail.mockRejectedValue(new Error('Email failed'));
      emailService.sendNewOrderNotificationToAffiliate.mockRejectedValue(new Error('Email failed'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await orderController.createOrder(req, res);

      expect(consoleSpy).toHaveBeenCalledWith('Failed to send order confirmation email:', expect.any(Error));
      expect(res.status).toHaveBeenCalledWith(201); // Order still created successfully
      
      consoleSpy.mockRestore();
    });
  });

  describe('exportOrders edge cases (lines 240-293)', () => {
    it('should handle CSV export with special characters', async () => {
      req.user = { affiliateId: 'AFF123' };
      req.query = { format: 'csv' };

      const mockOrders = [{
        orderId: 'ORD"001',
        customerId: 'CUST,123',
        status: 'pending',
        pickupDate: new Date('2024-01-01'),
        pickupTime: 'morning',
        estimatedWeight: 20,
        actualWeight: 22,
        estimatedTotal: 50,
        actualTotal: 55,
        affiliateCommission: 5.5,
        paymentStatus: 'completed',
        createdAt: new Date('2024-01-01')
      }];

      Order.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(mockOrders)
      });

      await orderController.exportOrders(req, res);

      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv');
      expect(res.setHeader).toHaveBeenCalledWith('Content-Disposition', 'attachment; filename=orders_export.csv');
      
      const csvContent = res.end.mock.calls[0][0];
      expect(csvContent).toContain('"ORD""001"'); // Escaped quotes
      expect(csvContent).toContain('"CUST,123"'); // Quoted because of comma
    });

    it('should handle JSON export', async () => {
      req.user = { affiliateId: 'AFF123' };
      req.query = { format: 'json' };

      const mockOrders = [{
        orderId: 'ORD001',
        customerId: 'CUST123',
        toJSON: jest.fn().mockReturnValue({ orderId: 'ORD001', customerId: 'CUST123' })
      }];

      Order.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(mockOrders)
      });

      await orderController.exportOrders(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        count: 1,
        orders: [{ orderId: 'ORD001', customerId: 'CUST123' }]
      });
    });

    it('should handle export errors', async () => {
      req.user = { affiliateId: 'AFF123' };
      req.query = { format: 'csv' };

      Order.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockRejectedValue(new Error('DB Error'))
      });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await orderController.exportOrders(req, res);

      expect(consoleSpy).toHaveBeenCalledWith('Error exporting orders:', expect.any(Error));
      expect(res.status).toHaveBeenCalledWith(500);
      
      consoleSpy.mockRestore();
    });
  });

  describe('updateOrderStatus edge cases', () => {
    it('should handle invalid status transitions (lines 381-382)', async () => {
      req.params.orderId = 'ORD123';
      req.body = { status: 'invalid-status' };
      req.user = { affiliateId: 'AFF123' };

      const mockOrder = {
        orderId: 'ORD123',
        affiliateId: 'AFF123',
        status: 'pending',
        save: jest.fn().mockRejectedValue(new Error('Validation failed'))
      };

      Order.findOne.mockResolvedValue(mockOrder);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await orderController.updateOrderStatus(req, res);

      expect(consoleSpy).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(500);
      
      consoleSpy.mockRestore();
    });
  });

  describe('cancelOrder method (lines 469-470, 488)', () => {
    it('should handle order not found', async () => {
      req.params.orderId = 'ORD999';
      req.user = { affiliateId: 'AFF123' };
      req.body = { reason: 'Customer request' };

      Order.findOne.mockResolvedValue(null);

      await orderController.cancelOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Order not found'
      });
    });

    it('should handle cancellation of already cancelled order', async () => {
      req.params.orderId = 'ORD123';
      req.user = { affiliateId: 'AFF123' };
      req.body = { reason: 'Customer request' };

      const mockOrder = {
        orderId: 'ORD123',
        affiliateId: 'AFF123',
        status: 'cancelled'
      };

      Order.findOne.mockResolvedValue(mockOrder);

      await orderController.cancelOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Order is already cancelled'
      });
    });
  });

  describe('updatePaymentStatus edge cases (lines 538-539, 555, 564, 574, 585)', () => {
    it('should handle missing payment data', async () => {
      req.params.orderId = 'ORD123';
      req.body = {}; // Missing payment data
      req.user = { role: 'admin' };

      await orderController.updatePaymentStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Payment status is required'
      });
    });

    it('should handle refund without completed payment', async () => {
      req.params.orderId = 'ORD123';
      req.body = { 
        status: 'refunded',
        refundAmount: 50,
        refundReason: 'Customer complaint'
      };
      req.user = { role: 'admin' };

      const mockOrder = {
        orderId: 'ORD123',
        paymentStatus: 'pending', // Not completed
        actualTotal: 100
      };

      Order.findOne.mockResolvedValue(mockOrder);

      await orderController.updatePaymentStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Can only refund completed payments'
      });
    });

    it('should handle refund amount greater than order total', async () => {
      req.params.orderId = 'ORD123';
      req.body = { 
        status: 'refunded',
        refundAmount: 150,
        refundReason: 'Customer complaint'
      };
      req.user = { role: 'admin' };

      const mockOrder = {
        orderId: 'ORD123',
        paymentStatus: 'completed',
        actualTotal: 100
      };

      Order.findOne.mockResolvedValue(mockOrder);

      await orderController.updatePaymentStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Refund amount cannot exceed order total'
      });
    });
  });

  describe('bulkUpdateOrderStatus edge cases (lines 627-632, 643-644)', () => {
    it('should handle empty order IDs array', async () => {
      req.body = { 
        orderIds: [],
        status: 'processing'
      };
      req.user = { affiliateId: 'AFF123' };

      await orderController.bulkUpdateOrderStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'No orders specified'
      });
    });

    it('should handle some orders not found', async () => {
      req.body = { 
        orderIds: ['ORD001', 'ORD002', 'ORD003'],
        status: 'processing'
      };
      req.user = { affiliateId: 'AFF123' };

      const mockOrders = [
        { orderId: 'ORD001', affiliateId: 'AFF123', status: 'pending', save: jest.fn() },
        { orderId: 'ORD002', affiliateId: 'AFF123', status: 'pending', save: jest.fn() }
        // ORD003 not found
      ];

      Order.find.mockResolvedValue(mockOrders);

      await orderController.bulkUpdateOrderStatus(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Orders updated',
        updatedCount: 2,
        notFoundCount: 1,
        results: expect.any(Array)
      });
    });
  });
});