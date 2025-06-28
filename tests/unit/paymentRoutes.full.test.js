// Full test for payment routes including dynamic route loading
const express = require('express');
const request = require('supertest');

// Mock payment controller before requiring routes
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

describe('Payment Routes - Full Coverage', () => {
  let app;
  let paymentController;
  const originalEnv = process.env.NODE_ENV;
  let originalReadFileSync;
  let originalConsoleLog;
  let originalConsoleError;

  beforeEach(() => {
    // Reset modules to ensure fresh imports
    jest.resetModules();
    
    // Clear all mocks
    jest.clearAllMocks();
    
    // Get the mocked controller
    paymentController = require('../../server/controllers/paymentController');
    
    // Create express app
    app = express();
    app.use(express.json());
    
    // Store original functions
    const fs = require('fs');
    originalReadFileSync = fs.readFileSync;
    originalConsoleLog = console.log;
    originalConsoleError = console.error;
  });

  afterEach(() => {
    // Restore original NODE_ENV
    process.env.NODE_ENV = originalEnv;
    
    // Restore original functions
    const fs = require('fs');
    fs.readFileSync = originalReadFileSync;
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });

  describe('Dynamic Route Loading', () => {
    it('should load dynamic callback routes when not in test environment', () => {
      // Set NODE_ENV to development
      process.env.NODE_ENV = 'development';
      
      // Mock the config file content
      const mockConfig = {
        callbackPaths: [
          '/api/v1/payments/callback/handler-1',
          '/api/v1/payments/callback/handler-2',
          '/api/v1/payments/callback/handler-3'
        ]
      };
      
      // Mock fs.readFileSync
      const fs = require('fs');
      fs.readFileSync = jest.fn().mockReturnValue(JSON.stringify(mockConfig));
      
      // Mock console.log to verify routes are registered
      const logSpy = jest.fn();
      console.log = logSpy;
      
      // Load the routes
      const paymentRoutes = require('../../server/routes/paymentRoutes');
      app.use('/api/v1/payments', paymentRoutes);
      
      // Verify console.log was called for each callback path
      expect(logSpy).toHaveBeenCalledWith('Registered payment callback route: /api/v1/payments/callback/handler-1');
      expect(logSpy).toHaveBeenCalledWith('Registered payment callback route: /api/v1/payments/callback/handler-2');
      expect(logSpy).toHaveBeenCalledWith('Registered payment callback route: /api/v1/payments/callback/handler-3');
    });

    it('should handle GET requests on dynamic callback routes', async () => {
      // Set NODE_ENV to development
      process.env.NODE_ENV = 'development';
      
      // Mock the config file content
      const mockConfig = {
        callbackPaths: ['/api/v1/payments/callback/test-handler']
      };
      
      const fs = require('fs');
      fs.readFileSync = jest.fn().mockReturnValue(JSON.stringify(mockConfig));
      console.log = jest.fn(); // Suppress console output
      
      // Load the routes
      const paymentRoutes = require('../../server/routes/paymentRoutes');
      app.use('/api/v1/payments', paymentRoutes);
      
      // Test the dynamic route
      const response = await request(app)
        .get('/api/v1/payments/callback/test-handler');
        
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ callback: true });
      expect(paymentController.handleFormCallback).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Object),
        '/api/v1/payments/callback/test-handler'
      );
    });

    it('should handle POST requests on dynamic callback routes', async () => {
      // Set NODE_ENV to development
      process.env.NODE_ENV = 'development';
      
      // Mock the config file content
      const mockConfig = {
        callbackPaths: ['/api/v1/payments/callback/post-handler']
      };
      
      const fs = require('fs');
      fs.readFileSync = jest.fn().mockReturnValue(JSON.stringify(mockConfig));
      console.log = jest.fn(); // Suppress console output
      
      // Load the routes
      const paymentRoutes = require('../../server/routes/paymentRoutes');
      app.use('/api/v1/payments', paymentRoutes);
      
      // Test the dynamic route
      const response = await request(app)
        .post('/api/v1/payments/callback/post-handler')
        .send({ test: 'data' });
        
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ callback: true });
      expect(paymentController.handleFormCallback).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Object),
        '/api/v1/payments/callback/post-handler'
      );
    });

    it('should handle errors when loading config file', () => {
      // Set NODE_ENV to development
      process.env.NODE_ENV = 'development';
      
      // Mock fs.readFileSync to throw an error
      const fs = require('fs');
      fs.readFileSync = jest.fn().mockImplementation(() => {
        throw new Error('File not found');
      });
      
      // Mock console.error
      const errorSpy = jest.fn();
      console.error = errorSpy;
      
      // Load the routes - should not throw
      const paymentRoutes = require('../../server/routes/paymentRoutes');
      app.use('/api/v1/payments', paymentRoutes);
      
      // Verify error was logged
      expect(errorSpy).toHaveBeenCalledWith(
        'Error loading callback routes:',
        expect.any(Error)
      );
    });

    it('should handle invalid JSON in config file', () => {
      // Set NODE_ENV to development
      process.env.NODE_ENV = 'development';
      
      // Mock fs.readFileSync to return invalid JSON
      const fs = require('fs');
      fs.readFileSync = jest.fn().mockReturnValue('{ invalid json }');
      
      // Mock console.error
      const errorSpy = jest.fn();
      console.error = errorSpy;
      
      // Load the routes - should not throw
      const paymentRoutes = require('../../server/routes/paymentRoutes');
      app.use('/api/v1/payments', paymentRoutes);
      
      // Verify error was logged
      expect(errorSpy).toHaveBeenCalledWith(
        'Error loading callback routes:',
        expect.any(Error)
      );
    });

    it('should skip dynamic route loading in test environment', () => {
      // Ensure NODE_ENV is test
      process.env.NODE_ENV = 'test';
      
      // Mock console.log to verify routes are NOT registered
      const logSpy = jest.fn();
      console.log = logSpy;
      
      const fs = require('fs');
      const readFileSpy = jest.fn();
      fs.readFileSync = readFileSpy;
      
      // Load the routes
      const paymentRoutes = require('../../server/routes/paymentRoutes');
      app.use('/api/v1/payments', paymentRoutes);
      
      // Verify fs.readFileSync was not called
      expect(readFileSpy).not.toHaveBeenCalled();
      
      // Verify no routes were registered
      expect(logSpy).not.toHaveBeenCalledWith(expect.stringContaining('Registered payment callback route'));
    });
  });

  describe('Static Routes', () => {
    beforeEach(() => {
      // Load routes in test mode (no dynamic routes)
      process.env.NODE_ENV = 'test';
      const paymentRoutes = require('../../server/routes/paymentRoutes');
      app.use('/api/v1/payments', paymentRoutes);
    });

    it('should handle GET /config', async () => {
      const response = await request(app)
        .get('/api/v1/payments/config');
        
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true });
      expect(paymentController.getConfig).toHaveBeenCalled();
    });

    it('should handle POST /log-submission', async () => {
      const response = await request(app)
        .post('/api/v1/payments/log-submission')
        .send({ test: 'data' });
        
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ logged: true });
      expect(paymentController.logSubmission).toHaveBeenCalled();
    });

    it('should handle POST /create-token', async () => {
      const response = await request(app)
        .post('/api/v1/payments/create-token')
        .send({ amount: 100 });
        
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ token: 'test-token' });
      expect(paymentController.createPaymentToken).toHaveBeenCalled();
    });

    it('should handle GET /check-status/:token', async () => {
      const response = await request(app)
        .get('/api/v1/payments/check-status/test-token-123');
        
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: 'pending' });
      expect(paymentController.checkPaymentStatus).toHaveBeenCalled();
    });

    it('should handle POST /cancel-token/:token', async () => {
      const response = await request(app)
        .post('/api/v1/payments/cancel-token/test-token-456');
        
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ cancelled: true });
      expect(paymentController.cancelPaymentToken).toHaveBeenCalled();
    });

    it('should handle POST /update-status/:token', async () => {
      const response = await request(app)
        .post('/api/v1/payments/update-status/test-token-789')
        .send({ status: 'completed' });
        
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ updated: true });
      expect(paymentController.updatePaymentStatus).toHaveBeenCalled();
    });

    it('should handle GET /pool-stats', async () => {
      const response = await request(app)
        .get('/api/v1/payments/pool-stats');
        
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ stats: {} });
      expect(paymentController.getPoolStats).toHaveBeenCalled();
    });
  });
});