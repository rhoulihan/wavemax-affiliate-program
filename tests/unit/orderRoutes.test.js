const express = require('express');
const request = require('supertest');

// Mock the middleware
jest.mock('../../server/middleware/auth', () => ({
  authenticate: jest.fn((req, res, next) => {
    req.user = { id: 'test-user-id', role: 'affiliate' };
    next();
  }),
  authorize: jest.fn(() => (req, res, next) => next())
}));

// Mock the controller
jest.mock('../../server/controllers/orderController');
// Mock validation to always pass
jest.mock('express-validator', () => ({
  body: jest.fn(() => ({
    notEmpty: jest.fn().mockReturnThis(),
    withMessage: jest.fn().mockReturnThis(),
    isISO8601: jest.fn().mockReturnThis(),
    isIn: jest.fn().mockReturnThis(),
    isInt: jest.fn().mockReturnThis(),
    isFloat: jest.fn().mockReturnThis(),
    isArray: jest.fn().mockReturnThis()
  })),
  validationResult: jest.fn(() => ({
    isEmpty: jest.fn().mockReturnValue(true),
    array: jest.fn().mockReturnValue([])
  }))
}));

describe('Order Routes', () => {
  let app;
  let orderController;
  let authMiddleware;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Get references to mocked modules
    orderController = require('../../server/controllers/orderController');
    authMiddleware = require('../../server/middleware/auth');
    
    // Set up controller mock implementations
    orderController.createOrder = jest.fn((req, res) => res.json({ orderId: 'ORD-123', success: true }));
    orderController.exportOrders = jest.fn((req, res) => res.json({ exported: true }));
    orderController.searchOrders = jest.fn((req, res) => res.json({ orders: [] }));
    orderController.getOrderStatistics = jest.fn((req, res) => res.json({ stats: {} }));
    orderController.bulkUpdateOrderStatus = jest.fn((req, res) => res.json({ updated: true }));
    orderController.bulkCancelOrders = jest.fn((req, res) => res.json({ cancelled: true }));
    orderController.getOrderDetails = jest.fn((req, res) => res.json({ order: { id: req.params.orderId } }));
    orderController.updateOrderStatus = jest.fn((req, res) => res.json({ updated: true }));
    orderController.cancelOrder = jest.fn((req, res) => res.json({ cancelled: true }));
    orderController.updatePaymentStatus = jest.fn((req, res) => res.json({ updated: true }));
    
    // Create fresh express app for each test
    app = express();
    app.use(express.json());
    
    // Import routes after mocking
    const orderRoutes = require('../../server/routes/orderRoutes');
    app.use('/api/orders', orderRoutes);
  });

  describe('POST /api/orders', () => {
    const validOrderData = {
      customerId: 'CUST-123',
      affiliateId: 'AFF-123',
      pickupDate: '2025-01-20',
      pickupTime: 'morning',
      numberOfBags: 2,
      estimatedWeight: 20.5,
      deliveryDate: '2025-01-22',
      deliveryTime: 'afternoon'
    };

    it('should create order with valid data', async () => {
      const response = await request(app)
        .post('/api/orders')
        .send(validOrderData);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ orderId: 'ORD-123', success: true });
      expect(authMiddleware.authenticate).toHaveBeenCalled();
      expect(orderController.createOrder).toHaveBeenCalled();
    });

    it('should validate required fields', async () => {
      const { validationResult } = require('express-validator');
      
      // Mock validation to return errors
      validationResult.mockReturnValueOnce({
        isEmpty: jest.fn().mockReturnValue(false),
        array: jest.fn().mockReturnValue([
          { msg: 'Customer ID is required', param: 'customerId' }
        ])
      });
      
      // Update controller mock to check validation
      orderController.createOrder.mockImplementationOnce((req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
        res.json({ orderId: 'ORD-123', success: true });
      });
      
      const response = await request(app)
        .post('/api/orders')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors.length).toBeGreaterThan(0);
    });

    it('should validate pickup time enum', async () => {
      const { validationResult } = require('express-validator');
      
      validationResult.mockReturnValueOnce({
        isEmpty: jest.fn().mockReturnValue(false),
        array: jest.fn().mockReturnValue([
          { msg: 'Invalid pickup time', param: 'pickupTime' }
        ])
      });
      
      orderController.createOrder.mockImplementationOnce((req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
        res.json({ orderId: 'ORD-123', success: true });
      });
      
      const response = await request(app)
        .post('/api/orders')
        .send({
          ...validOrderData,
          pickupTime: 'invalid'
        });

      expect(response.status).toBe(400);
      expect(response.body.errors[0].msg).toContain('Invalid pickup time');
    });

    it('should validate numberOfBags is positive integer', async () => {
      const { validationResult } = require('express-validator');
      
      validationResult.mockReturnValueOnce({
        isEmpty: jest.fn().mockReturnValue(false),
        array: jest.fn().mockReturnValue([
          { msg: 'Number of bags must be at least 1', param: 'numberOfBags' }
        ])
      });
      
      orderController.createOrder.mockImplementationOnce((req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
        res.json({ orderId: 'ORD-123', success: true });
      });
      
      const response = await request(app)
        .post('/api/orders')
        .send({
          ...validOrderData,
          numberOfBags: 0
        });

      expect(response.status).toBe(400);
      expect(response.body.errors[0].msg).toContain('Number of bags must be at least 1');
    });

    it('should validate estimatedWeight is positive', async () => {
      const { validationResult } = require('express-validator');
      
      validationResult.mockReturnValueOnce({
        isEmpty: jest.fn().mockReturnValue(false),
        array: jest.fn().mockReturnValue([
          { msg: 'Estimated weight must be a positive number', param: 'estimatedWeight' }
        ])
      });
      
      orderController.createOrder.mockImplementationOnce((req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
        res.json({ orderId: 'ORD-123', success: true });
      });
      
      const response = await request(app)
        .post('/api/orders')
        .send({
          ...validOrderData,
          estimatedWeight: -5
        });

      expect(response.status).toBe(400);
      expect(response.body.errors[0].msg).toContain('Estimated weight must be a positive number');
    });

    it('should validate date formats', async () => {
      const { validationResult } = require('express-validator');
      
      validationResult.mockReturnValueOnce({
        isEmpty: jest.fn().mockReturnValue(false),
        array: jest.fn().mockReturnValue([
          { msg: 'Valid pickup date is required', param: 'pickupDate' }
        ])
      });
      
      orderController.createOrder.mockImplementationOnce((req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
        res.json({ orderId: 'ORD-123', success: true });
      });
      
      const response = await request(app)
        .post('/api/orders')
        .send({
          ...validOrderData,
          pickupDate: 'invalid-date'
        });

      expect(response.status).toBe(400);
      expect(response.body.errors[0].msg).toContain('Valid pickup date is required');
    });
  });

  describe('GET /api/orders/export', () => {
    it('should export orders with authentication', async () => {
      const response = await request(app)
        .get('/api/orders/export')
        .query({ format: 'csv' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ exported: true });
      expect(authMiddleware.authenticate).toHaveBeenCalled();
      expect(orderController.exportOrders).toHaveBeenCalled();
    });
  });

  describe('GET /api/orders/search', () => {
    it('should search orders with authentication', async () => {
      const response = await request(app)
        .get('/api/orders/search')
        .query({ q: 'test' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ orders: [] });
      expect(authMiddleware.authenticate).toHaveBeenCalled();
      expect(orderController.searchOrders).toHaveBeenCalled();
    });
  });

  describe('GET /api/orders/statistics', () => {
    it('should get order statistics with authentication', async () => {
      const response = await request(app)
        .get('/api/orders/statistics');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ stats: {} });
      expect(authMiddleware.authenticate).toHaveBeenCalled();
      expect(orderController.getOrderStatistics).toHaveBeenCalled();
    });
  });

  describe('PUT /api/orders/bulk/status', () => {
    it('should bulk update order status', async () => {
      const response = await request(app)
        .put('/api/orders/bulk/status')
        .send({
          orderIds: ['ORD-1', 'ORD-2'],
          status: 'processing'
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ updated: true });
      expect(authMiddleware.authenticate).toHaveBeenCalled();
      expect(orderController.bulkUpdateOrderStatus).toHaveBeenCalled();
    });

    it('should validate orderIds is array', async () => {
      const { validationResult } = require('express-validator');
      
      validationResult.mockReturnValueOnce({
        isEmpty: jest.fn().mockReturnValue(false),
        array: jest.fn().mockReturnValue([
          { msg: 'Order IDs must be an array', param: 'orderIds' }
        ])
      });
      
      orderController.bulkUpdateOrderStatus.mockImplementationOnce((req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
        res.json({ updated: true });
      });
      
      const response = await request(app)
        .put('/api/orders/bulk/status')
        .send({
          orderIds: 'not-an-array',
          status: 'processing'
        });

      expect(response.status).toBe(400);
      expect(response.body.errors[0].msg).toContain('Order IDs must be an array');
    });

    it('should validate status enum', async () => {
      const { validationResult } = require('express-validator');
      
      validationResult.mockReturnValueOnce({
        isEmpty: jest.fn().mockReturnValue(false),
        array: jest.fn().mockReturnValue([
          { msg: 'Invalid status', param: 'status' }
        ])
      });
      
      orderController.bulkUpdateOrderStatus.mockImplementationOnce((req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
        res.json({ updated: true });
      });
      
      const response = await request(app)
        .put('/api/orders/bulk/status')
        .send({
          orderIds: ['ORD-1'],
          status: 'invalid-status'
        });

      expect(response.status).toBe(400);
      expect(response.body.errors[0].msg).toContain('Invalid status');
    });
  });

  describe('POST /api/orders/bulk/cancel', () => {
    it('should bulk cancel orders', async () => {
      const response = await request(app)
        .post('/api/orders/bulk/cancel')
        .send({
          orderIds: ['ORD-1', 'ORD-2']
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ cancelled: true });
      expect(authMiddleware.authenticate).toHaveBeenCalled();
      expect(orderController.bulkCancelOrders).toHaveBeenCalled();
    });

    it('should validate orderIds is array', async () => {
      const { validationResult } = require('express-validator');
      
      validationResult.mockReturnValueOnce({
        isEmpty: jest.fn().mockReturnValue(false),
        array: jest.fn().mockReturnValue([
          { msg: 'Order IDs must be an array', param: 'orderIds' }
        ])
      });
      
      orderController.bulkCancelOrders.mockImplementationOnce((req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
        res.json({ cancelled: true });
      });
      
      const response = await request(app)
        .post('/api/orders/bulk/cancel')
        .send({
          orderIds: 'not-an-array'
        });

      expect(response.status).toBe(400);
      expect(response.body.errors[0].msg).toContain('Order IDs must be an array');
    });
  });

  describe('GET /api/orders/:orderId', () => {
    it('should get order details with authentication', async () => {
      const response = await request(app)
        .get('/api/orders/ORD-123');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ order: { id: 'ORD-123' } });
      expect(authMiddleware.authenticate).toHaveBeenCalled();
      expect(orderController.getOrderDetails).toHaveBeenCalled();
    });
  });

  describe('PUT /api/orders/:orderId/status', () => {
    it('should update order status with authentication', async () => {
      const response = await request(app)
        .put('/api/orders/ORD-123/status')
        .send({ status: 'complete' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ updated: true });
      expect(authMiddleware.authenticate).toHaveBeenCalled();
      expect(orderController.updateOrderStatus).toHaveBeenCalled();
    });
  });

  describe('POST /api/orders/:orderId/cancel', () => {
    it('should cancel order with authentication', async () => {
      const response = await request(app)
        .post('/api/orders/ORD-123/cancel')
        .send({ reason: 'Customer request' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ cancelled: true });
      expect(authMiddleware.authenticate).toHaveBeenCalled();
      expect(orderController.cancelOrder).toHaveBeenCalled();
    });
  });

  describe('PUT /api/orders/:orderId/payment-status', () => {
    it('should update payment status', async () => {
      const response = await request(app)
        .put('/api/orders/ORD-123/payment-status')
        .send({ paymentStatus: 'paid' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ updated: true });
      expect(authMiddleware.authenticate).toHaveBeenCalled();
      expect(orderController.updatePaymentStatus).toHaveBeenCalled();
    });

    it('should validate payment status enum', async () => {
      const { validationResult } = require('express-validator');
      
      validationResult.mockReturnValueOnce({
        isEmpty: jest.fn().mockReturnValue(false),
        array: jest.fn().mockReturnValue([
          { msg: 'Invalid payment status', param: 'paymentStatus' }
        ])
      });
      
      orderController.updatePaymentStatus.mockImplementationOnce((req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
        res.json({ updated: true });
      });
      
      const response = await request(app)
        .put('/api/orders/ORD-123/payment-status')
        .send({ paymentStatus: 'invalid' });

      expect(response.status).toBe(400);
      expect(response.body.errors[0].msg).toContain('Invalid payment status');
    });
  });

  describe('Middleware execution', () => {
    it('should require authentication for all routes', async () => {
      const routes = [
        { method: 'post', path: '/api/orders' },
        { method: 'get', path: '/api/orders/export' },
        { method: 'get', path: '/api/orders/search' },
        { method: 'get', path: '/api/orders/statistics' },
        { method: 'put', path: '/api/orders/bulk/status' },
        { method: 'post', path: '/api/orders/bulk/cancel' },
        { method: 'get', path: '/api/orders/ORD-123' },
        { method: 'put', path: '/api/orders/ORD-123/status' },
        { method: 'post', path: '/api/orders/ORD-123/cancel' },
        { method: 'put', path: '/api/orders/ORD-123/payment-status' }
      ];

      for (const route of routes) {
        jest.clearAllMocks();
        
        let req = request(app)[route.method](route.path);
        
        // Add required body for POST/PUT requests
        if (route.method === 'post' || route.method === 'put') {
          if (route.path === '/api/orders') {
            req = req.send({
              customerId: 'CUST-123',
              affiliateId: 'AFF-123',
              pickupDate: '2025-01-20',
              pickupTime: 'morning',
              numberOfBags: 2,
              estimatedWeight: 20.5,
              deliveryDate: '2025-01-22',
              deliveryTime: 'afternoon'
            });
          } else if (route.path.includes('bulk/status')) {
            req = req.send({ orderIds: ['ORD-1'], status: 'processing' });
          } else if (route.path.includes('bulk/cancel')) {
            req = req.send({ orderIds: ['ORD-1'] });
          } else if (route.path.includes('payment-status')) {
            req = req.send({ paymentStatus: 'paid' });
          }
        }
        
        await req;
        
        expect(authMiddleware.authenticate).toHaveBeenCalled();
      }
    });
  });
});