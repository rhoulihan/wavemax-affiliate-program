const request = require('supertest');
const express = require('express');

// Set NODE_ENV before any requires
process.env.NODE_ENV = 'test';

// Mock dependencies
jest.mock('../../server/utils/cspHelper', () => ({
  serveHTMLWithNonce: jest.fn((filename) => (req, res) => {
    res.send(`<html>Mocked ${filename}</html>`);
  })
}));

describe('Monitoring Routes', () => {
  let app;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create Express app
    app = express();
    
    // Add CSP nonce middleware
    app.use((req, res, next) => {
      res.locals.cspNonce = 'test-nonce-123';
      next();
    });
    
    // Add monitoring routes
    const monitoringRoutes = require('../../server/routes/monitoringRoutes');
    app.use('/api/monitoring', monitoringRoutes);
  });
  
  describe('Security Headers Middleware', () => {
    it('should add security headers to all monitoring routes', async () => {
      const response = await request(app)
        .get('/api/monitoring/status');
      
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
    });
  });
  
  describe('GET /api/monitoring/status', () => {
    it('should return monitoring status data', async () => {
      const response = await request(app)
        .get('/api/monitoring/status');
      
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        overallHealth: 'healthy',
        uptime: expect.any(Number),
        services: expect.objectContaining({
          'API Server': expect.objectContaining({
            status: 'up',
            critical: true,
            availability: expect.any(String),
            responseTime: expect.any(Number),
            totalChecks: expect.any(Number),
            failedChecks: expect.any(Number),
            lastCheck: expect.any(String),
            history: expect.any(Array)
          }),
          'Database': expect.any(Object),
          'Payment Gateway': expect.any(Object),
          'Email Service': expect.any(Object),
          'DocuSign API': expect.any(Object),
          'DNS Resolution': expect.any(Object)
        })
      });
    });
    
    it('should include service history with timestamps and response times', async () => {
      const response = await request(app)
        .get('/api/monitoring/status');
      
      const apiServerHistory = response.body.services['API Server'].history;
      expect(apiServerHistory).toHaveLength(60);
      
      apiServerHistory.forEach(entry => {
        expect(entry).toMatchObject({
          timestamp: expect.any(Number),
          responseTime: expect.any(Number),
          success: expect.any(Boolean)
        });
      });
    });
    
    it('should handle errors gracefully', async () => {
      // Mock process.uptime to throw an error
      const originalUptime = process.uptime;
      process.uptime = () => {
        throw new Error('Uptime error');
      };
      
      const response = await request(app)
        .get('/api/monitoring/status');
      
      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        success: false,
        message: 'Failed to retrieve monitoring status'
      });
      
      // Restore original uptime
      process.uptime = originalUptime;
    });
  });
  
  describe('GET /api/monitoring/', () => {
    it('should serve monitoring dashboard HTML with CSP nonce', async () => {
      const response = await request(app)
        .get('/api/monitoring/');
      
      expect(response.status).toBe(200);
      expect(response.text).toContain('monitoring-dashboard.html');
    });
  });
  
  describe('GET /api/monitoring/dashboard', () => {
    it('should serve monitoring dashboard HTML with CSP nonce', async () => {
      const response = await request(app)
        .get('/api/monitoring/dashboard');
      
      expect(response.status).toBe(200);
      expect(response.text).toContain('monitoring-dashboard.html');
    });
  });
  
  describe('404 Handler', () => {
    it('should return 404 for non-existent monitoring endpoints', async () => {
      const response = await request(app)
        .get('/api/monitoring/non-existent');
      
      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        success: false,
        message: 'Monitoring endpoint not found'
      });
    });
  });
  
  describe('Service Status Data Structure', () => {
    it('should return critical services with proper structure', async () => {
      const response = await request(app)
        .get('/api/monitoring/status');
      
      const criticalServices = ['API Server', 'Database', 'Payment Gateway', 'DNS Resolution'];
      
      criticalServices.forEach(serviceName => {
        const service = response.body.services[serviceName];
        expect(service.critical).toBe(true);
        expect(service.status).toBe('up');
        expect(service.history).toHaveLength(60);
      });
    });
    
    it('should return non-critical services with proper structure', async () => {
      const response = await request(app)
        .get('/api/monitoring/status');
      
      const nonCriticalServices = ['Email Service', 'DocuSign API'];
      
      nonCriticalServices.forEach(serviceName => {
        const service = response.body.services[serviceName];
        expect(service.critical).toBe(false);
        expect(service.status).toBe('up');
        expect(service.history).toHaveLength(60);
      });
    });
    
    it('should generate realistic service metrics', async () => {
      const response = await request(app)
        .get('/api/monitoring/status');
      
      // Check API Server metrics
      const apiServer = response.body.services['API Server'];
      expect(apiServer.responseTime).toBeGreaterThanOrEqual(30);
      expect(apiServer.responseTime).toBeLessThanOrEqual(80);
      expect(parseFloat(apiServer.availability)).toBeGreaterThanOrEqual(99);
      
      // Check Database metrics  
      const database = response.body.services['Database'];
      expect(database.responseTime).toBeGreaterThanOrEqual(10);
      expect(database.responseTime).toBeLessThanOrEqual(30);
      
      // Check DNS Resolution - should have 100% availability
      const dns = response.body.services['DNS Resolution'];
      expect(dns.availability).toBe('100%');
      expect(dns.failedChecks).toBe(0);
    });
  });
});