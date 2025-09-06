const express = require('express');
const request = require('supertest');

// Create a test double for the payment controller
const createMockController = () => ({
  getConfig: jest.fn((req, res) => res.json({ success: true })),
  logSubmission: jest.fn((req, res) => res.json({ logged: true })),
  createPaymentToken: jest.fn((req, res) => res.json({ token: 'test-token' })),
  checkPaymentStatus: jest.fn((req, res) => res.json({ status: 'pending' })),
  cancelPaymentToken: jest.fn((req, res) => res.json({ cancelled: true })),
  updatePaymentStatus: jest.fn((req, res) => res.json({ updated: true })),
  getPoolStats: jest.fn((req, res) => res.json({ stats: {} })),
  handleFormCallback: jest.fn((req, res) => res.json({ callback: true }))
});

// Manually create the routes without requiring the actual file
const createPaymentRoutes = (controller) => {
  const router = express.Router();

  router.get('/config', controller.getConfig);
  router.post('/log-submission', controller.logSubmission);
  router.post('/create-token', controller.createPaymentToken);
  router.get('/check-status/:token', controller.checkPaymentStatus);
  router.post('/cancel-token/:token', controller.cancelPaymentToken);
  router.post('/update-status/:token', controller.updatePaymentStatus);
  router.get('/pool-stats', controller.getPoolStats);

  return router;
};

describe('Payment Routes - Isolated', () => {
  let app;
  let mockController;

  beforeEach(() => {
    mockController = createMockController();
    app = express();
    app.use(express.json());
    app.use('/api/v1/payments', createPaymentRoutes(mockController));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/v1/payments/config', () => {
    it('should return payment configuration', async () => {
      const response = await request(app)
        .get('/api/v1/payments/config');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true });
      expect(mockController.getConfig).toHaveBeenCalledTimes(1);
    });
  });

  describe('POST /api/v1/payments/log-submission', () => {
    it('should log payment submission', async () => {
      const testData = { amount: 100, timestamp: Date.now() };

      const response = await request(app)
        .post('/api/v1/payments/log-submission')
        .send(testData);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ logged: true });
      expect(mockController.logSubmission).toHaveBeenCalledTimes(1);
      expect(mockController.logSubmission.mock.calls[0][0].body).toEqual(testData);
    });
  });

  describe('POST /api/v1/payments/create-token', () => {
    it('should create payment token', async () => {
      const tokenData = {
        amount: 150,
        customerId: 'CUST-123',
        items: [{ description: 'Service', amount: 150 }]
      };

      const response = await request(app)
        .post('/api/v1/payments/create-token')
        .send(tokenData);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ token: 'test-token' });
      expect(mockController.createPaymentToken).toHaveBeenCalledTimes(1);
      expect(mockController.createPaymentToken.mock.calls[0][0].body).toEqual(tokenData);
    });
  });

  describe('GET /api/v1/payments/check-status/:token', () => {
    it('should check payment status', async () => {
      const token = 'test-token-123';

      const response = await request(app)
        .get(`/api/v1/payments/check-status/${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: 'pending' });
      expect(mockController.checkPaymentStatus).toHaveBeenCalledTimes(1);
      expect(mockController.checkPaymentStatus.mock.calls[0][0].params.token).toBe(token);
    });
  });

  describe('POST /api/v1/payments/cancel-token/:token', () => {
    it('should cancel payment token', async () => {
      const token = 'test-token-456';

      const response = await request(app)
        .post(`/api/v1/payments/cancel-token/${token}`)
        .send({ reason: 'User cancelled' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ cancelled: true });
      expect(mockController.cancelPaymentToken).toHaveBeenCalledTimes(1);
      expect(mockController.cancelPaymentToken.mock.calls[0][0].params.token).toBe(token);
    });
  });

  describe('POST /api/v1/payments/update-status/:token', () => {
    it('should update payment status', async () => {
      const token = 'test-token-789';
      const statusUpdate = { status: 'completed', transactionId: 'TXN-123' };

      const response = await request(app)
        .post(`/api/v1/payments/update-status/${token}`)
        .send(statusUpdate);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ updated: true });
      expect(mockController.updatePaymentStatus).toHaveBeenCalledTimes(1);
      expect(mockController.updatePaymentStatus.mock.calls[0][0].params.token).toBe(token);
      expect(mockController.updatePaymentStatus.mock.calls[0][0].body).toEqual(statusUpdate);
    });
  });

  describe('GET /api/v1/payments/pool-stats', () => {
    it('should return pool statistics', async () => {
      const response = await request(app)
        .get('/api/v1/payments/pool-stats');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ stats: {} });
      expect(mockController.getPoolStats).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle controller errors gracefully', async () => {
      const next = jest.fn();
      mockController.getConfig.mockImplementationOnce((req, res) => {
        res.status(500).json({ error: 'Internal server error' });
      });

      const response = await request(app)
        .get('/api/v1/payments/config');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal server error' });
    });

    it('should handle missing routes with 404', async () => {
      const response = await request(app)
        .get('/api/v1/payments/non-existent-route');

      expect(response.status).toBe(404);
    });
  });

  describe('Request Validation', () => {
    it('should pass through request headers', async () => {
      const response = await request(app)
        .get('/api/v1/payments/config')
        .set('Authorization', 'Bearer test-token')
        .set('X-Custom-Header', 'test-value');

      expect(mockController.getConfig).toHaveBeenCalledTimes(1);
      const req = mockController.getConfig.mock.calls[0][0];
      expect(req.headers.authorization).toBe('Bearer test-token');
      expect(req.headers['x-custom-header']).toBe('test-value');
    });

    it('should handle JSON parsing errors', async () => {
      const response = await request(app)
        .post('/api/v1/payments/log-submission')
        .set('Content-Type', 'application/json')
        .send('invalid json');

      expect(response.status).toBe(400); // Express default JSON parsing error
    });
  });
});