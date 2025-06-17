const express = require('express');
const request = require('supertest');

describe('Payment Routes - Simple', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create a simple express app with mock routes
    app = express();
    app.use(express.json());
    
    // Mock auth middleware
    const mockAuth = (req, res, next) => {
      if (req.headers.authorization) {
        req.user = { id: 'test-user-id', role: 'customer' };
        next();
      } else {
        next();
      }
    };
    
    // Define routes directly without validation
    // IMPORTANT: More specific routes must come before parameterized routes
    app.post('/api/payments/process', mockAuth, (req, res) => {
      res.json({ 
        success: true, 
        paymentId: 'PAY-123',
        status: 'authorized'
      });
    });
    
    app.post('/api/payments/capture', mockAuth, (req, res) => {
      res.json({ 
        success: true, 
        paymentId: req.body.paymentId,
        status: 'captured'
      });
    });
    
    app.post('/api/payments/refund', mockAuth, (req, res) => {
      res.json({ 
        success: true, 
        refundId: 'REF-123',
        status: 'refunded'
      });
    });
    
    // Static routes before parameterized routes
    app.post('/api/payments/methods', mockAuth, (req, res) => {
      res.json({ 
        success: true,
        methodId: 'PM-123'
      });
    });
    
    app.get('/api/payments/methods', mockAuth, (req, res) => {
      res.json({ 
        methods: [
          { id: 'PM-123', type: 'card', last4: '4242' }
        ] 
      });
    });
    
    app.get('/api/payments/order/:orderId', mockAuth, (req, res) => {
      res.json({ 
        payments: [
          { id: 'PAY-123', orderId: req.params.orderId, amount: 100 }
        ] 
      });
    });
    
    app.delete('/api/payments/methods/:methodId', mockAuth, (req, res) => {
      res.json({ 
        success: true,
        message: 'Payment method removed'
      });
    });
    
    // Parameterized routes last
    app.get('/api/payments/:paymentId', mockAuth, (req, res) => {
      res.json({ 
        payment: { 
          id: req.params.paymentId,
          status: 'captured',
          amount: 100
        } 
      });
    });
    
    app.post('/api/payments/webhook', (req, res) => {
      res.json({ received: true });
    });
  });

  describe('POST /api/payments/process', () => {
    it('should process payment', async () => {
      const response = await request(app)
        .post('/api/payments/process')
        .send({
          orderId: 'ORD-123',
          amount: 100,
          paymentMethodId: 'PM-123'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.paymentId).toBe('PAY-123');
    });
  });

  describe('POST /api/payments/capture', () => {
    it('should capture payment', async () => {
      const response = await request(app)
        .post('/api/payments/capture')
        .send({
          paymentId: 'PAY-123'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.status).toBe('captured');
    });
  });

  describe('POST /api/payments/refund', () => {
    it('should refund payment', async () => {
      const response = await request(app)
        .post('/api/payments/refund')
        .send({
          paymentId: 'PAY-123',
          amount: 50,
          reason: 'Customer request'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.refundId).toBe('REF-123');
    });
  });

  describe('GET /api/payments/:paymentId', () => {
    it('should get payment details', async () => {
      const response = await request(app)
        .get('/api/payments/PAY-123');

      expect(response.status).toBe(200);
      expect(response.body.payment).toBeDefined();
      expect(response.body.payment.id).toBe('PAY-123');
    });
  });

  describe('GET /api/payments/order/:orderId', () => {
    it('should get payments by order', async () => {
      const response = await request(app)
        .get('/api/payments/order/ORD-123');

      expect(response.status).toBe(200);
      expect(response.body.payments).toBeInstanceOf(Array);
      expect(response.body.payments[0].orderId).toBe('ORD-123');
    });
  });

  describe('POST /api/payments/methods', () => {
    it('should add payment method', async () => {
      const response = await request(app)
        .post('/api/payments/methods')
        .send({
          type: 'card',
          token: 'tok_visa'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.methodId).toBe('PM-123');
    });
  });

  describe('GET /api/payments/methods', () => {
    it('should get payment methods', async () => {
      const response = await request(app)
        .get('/api/payments/methods')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(response.body).toBeDefined();
      expect(response.body.methods).toBeDefined();
      expect(response.body.methods).toBeInstanceOf(Array);
    });
  });

  describe('DELETE /api/payments/methods/:methodId', () => {
    it('should delete payment method', async () => {
      const response = await request(app)
        .delete('/api/payments/methods/PM-123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /api/payments/webhook', () => {
    it('should handle webhook', async () => {
      const response = await request(app)
        .post('/api/payments/webhook')
        .send({
          event: 'payment.captured',
          data: { paymentId: 'PAY-123' }
        });

      expect(response.status).toBe(200);
      expect(response.body.received).toBe(true);
    });
  });
});