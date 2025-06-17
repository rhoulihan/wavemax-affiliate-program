const express = require('express');
const request = require('supertest');
const fs = require('fs');
const path = require('path');

// Mock the controllers
jest.mock('../../server/controllers/paymentController', () => ({
  getConfig: jest.fn((req, res) => res.json({ success: true })),
  logSubmission: jest.fn((req, res) => res.json({ logged: true })),
  createPaymentToken: jest.fn((req, res) => res.json({ token: 'test-token' })),
  checkPaymentStatus: jest.fn((req, res) => res.json({ status: 'pending' })),
  cancelPaymentToken: jest.fn((req, res) => res.json({ cancelled: true })),
  updatePaymentStatus: jest.fn((req, res) => res.json({ updated: true })),
  getPoolStats: jest.fn((req, res) => res.json({ stats: {} })),
  handleFormCallback: jest.fn((req, res) => res.json({ callback: true }))
}));

// Mock fs module
jest.mock('fs');

describe('Payment Routes', () => {
  let app;
  let paymentController;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create fresh express app for each test
    app = express();
    app.use(express.json());
    
    // Mock the config file read
    const mockConfig = {
      callbackPaths: [
        '/api/v1/payments/callback/handler-1',
        '/api/v1/payments/callback/handler-2'
      ]
    };
    
    fs.readFileSync.mockReturnValue(JSON.stringify(mockConfig));
    
    // Import routes after mocking
    const paymentRoutes = require('../../server/routes/paymentRoutes');
    app.use('/api/v1/payments', paymentRoutes);
    
    // Get reference to mocked controller
    paymentController = require('../../server/controllers/paymentController');
  });

  describe('GET /api/v1/payments/config', () => {
    it('should call getConfig controller', async () => {
      const response = await request(app)
        .get('/api/v1/payments/config');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true });
      expect(paymentController.getConfig).toHaveBeenCalled();
    });
  });

  describe('POST /api/v1/payments/log-submission', () => {
    it('should call logSubmission controller', async () => {
      const response = await request(app)
        .post('/api/v1/payments/log-submission')
        .send({ data: 'test' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ logged: true });
      expect(paymentController.logSubmission).toHaveBeenCalled();
    });
  });

  describe('POST /api/v1/payments/create-token', () => {
    it('should call createPaymentToken controller', async () => {
      const response = await request(app)
        .post('/api/v1/payments/create-token')
        .send({ amount: 100 });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ token: 'test-token' });
      expect(paymentController.createPaymentToken).toHaveBeenCalled();
    });
  });

  describe('GET /api/v1/payments/check-status/:token', () => {
    it('should call checkPaymentStatus controller with token param', async () => {
      const response = await request(app)
        .get('/api/v1/payments/check-status/test-token-123');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: 'pending' });
      expect(paymentController.checkPaymentStatus).toHaveBeenCalled();
      
      // Check that token was passed in params
      const call = paymentController.checkPaymentStatus.mock.calls[0];
      expect(call[0].params.token).toBe('test-token-123');
    });
  });

  describe('POST /api/v1/payments/cancel-token/:token', () => {
    it('should call cancelPaymentToken controller with token param', async () => {
      const response = await request(app)
        .post('/api/v1/payments/cancel-token/test-token-456');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ cancelled: true });
      expect(paymentController.cancelPaymentToken).toHaveBeenCalled();
      
      // Check that token was passed in params
      const call = paymentController.cancelPaymentToken.mock.calls[0];
      expect(call[0].params.token).toBe('test-token-456');
    });
  });

  describe('POST /api/v1/payments/update-status/:token', () => {
    it('should call updatePaymentStatus controller with token param', async () => {
      const response = await request(app)
        .post('/api/v1/payments/update-status/test-token-789')
        .send({ status: 'completed' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ updated: true });
      expect(paymentController.updatePaymentStatus).toHaveBeenCalled();
      
      // Check that token was passed in params
      const call = paymentController.updatePaymentStatus.mock.calls[0];
      expect(call[0].params.token).toBe('test-token-789');
    });
  });

  describe('GET /api/v1/payments/pool-stats', () => {
    it('should call getPoolStats controller', async () => {
      const response = await request(app)
        .get('/api/v1/payments/pool-stats');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ stats: {} });
      expect(paymentController.getPoolStats).toHaveBeenCalled();
    });
  });

  describe('Dynamic callback routes', () => {
    it('should register GET routes for callback paths', async () => {
      const response = await request(app)
        .get('/api/v1/payments/callback/handler-1');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ callback: true });
      expect(paymentController.handleFormCallback).toHaveBeenCalled();
      
      // Check callback path was passed
      const call = paymentController.handleFormCallback.mock.calls[0];
      expect(call[2]).toBe('/api/v1/payments/callback/handler-1');
    });

    it('should register POST routes for callback paths', async () => {
      const response = await request(app)
        .post('/api/v1/payments/callback/handler-2')
        .send({ payment: 'data' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ callback: true });
      expect(paymentController.handleFormCallback).toHaveBeenCalled();
      
      // Check callback path was passed
      const call = paymentController.handleFormCallback.mock.calls[0];
      expect(call[2]).toBe('/api/v1/payments/callback/handler-2');
    });
  });

  describe('Error handling', () => {
    it('should handle missing config file gracefully', () => {
      // Clear module cache to force re-require
      jest.resetModules();
      
      // Mock fs to throw error
      jest.doMock('fs', () => ({
        readFileSync: jest.fn().mockImplementation(() => {
          throw new Error('File not found');
        })
      }));
      
      // Mock console.error to verify it's called
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      // Re-require routes - should not throw
      expect(() => {
        require('../../server/routes/paymentRoutes');
      }).not.toThrow();
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error loading callback routes:',
        expect.any(Error)
      );
      
      consoleErrorSpy.mockRestore();
    });

    it('should handle invalid JSON in config file', () => {
      // Clear module cache to force re-require
      jest.resetModules();
      
      // Mock fs to return invalid JSON
      jest.doMock('fs', () => ({
        readFileSync: jest.fn().mockReturnValue('{ invalid json }')
      }));
      
      // Mock console.error to verify it's called
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      // Re-require routes - should not throw
      expect(() => {
        require('../../server/routes/paymentRoutes');
      }).not.toThrow();
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error loading callback routes:',
        expect.any(Error)
      );
      
      consoleErrorSpy.mockRestore();
    });
  });

  describe('Route registration', () => {
    it('should log registered callback routes', () => {
      // Mock console.log to verify logging
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      
      // Clear module cache and re-require to trigger logging
      jest.resetModules();
      jest.doMock('fs', () => ({
        readFileSync: jest.fn().mockReturnValue(JSON.stringify({
          callbackPaths: ['/api/v1/payments/callback/test']
        }))
      }));
      
      require('../../server/routes/paymentRoutes');
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Registered payment callback route: /api/v1/payments/callback/test'
      );
      
      consoleLogSpy.mockRestore();
    });

    it('should correctly strip base path from callback routes', async () => {
      // The route should work without the base path prefix
      const response = await request(app)
        .get('/api/v1/payments/callback/handler-1');

      expect(response.status).toBe(200);
    });
  });
});