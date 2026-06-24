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

// /monitoring/status now serves the REAL connectivity-monitor data (no more
// fabricated Math.random metrics or phantom 'Payment Gateway'). Mock the module
// so the route's shape + error handling are deterministic.
jest.mock('../../server/monitoring/connectivity-monitor', () => ({
  getMonitoringStatus: jest.fn()
}));
const monitoringModule = require('../../server/monitoring/connectivity-monitor');

describe('Monitoring Routes', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    // Default: the real summary shape (empty services before any check cycle).
    monitoringModule.getMonitoringStatus.mockReturnValue({
      uptime: 12345,
      services: {},
      overallHealth: 'healthy',
      criticalServicesDown: []
    });

    app = express();
    app.use((req, res, next) => {
      res.locals.cspNonce = 'test-nonce-123';
      next();
    });

    const monitoringRoutes = require('../../server/routes/monitoringRoutes');
    app.use('/api/monitoring', monitoringRoutes);
  });

  describe('Security Headers Middleware', () => {
    it('should add security headers to all monitoring routes', async () => {
      const response = await request(app).get('/api/monitoring/status');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
    });
  });

  describe('GET /api/monitoring/status', () => {
    it('serves the real connectivity-monitor summary', async () => {
      const response = await request(app).get('/api/monitoring/status');
      expect(response.status).toBe(200);
      expect(monitoringModule.getMonitoringStatus).toHaveBeenCalled();
      expect(response.body).toMatchObject({
        overallHealth: 'healthy',
        uptime: expect.any(Number),
        services: expect.any(Object),
        criticalServicesDown: expect.any(Array)
      });
    });

    it('does NOT fabricate a Payment Gateway service (money is external in Cents)', async () => {
      monitoringModule.getMonitoringStatus.mockReturnValue({
        uptime: 1, overallHealth: 'healthy', criticalServicesDown: [],
        services: { 'MongoDB Atlas': { status: 'up', critical: true } }
      });
      const response = await request(app).get('/api/monitoring/status');
      expect(response.body.services).not.toHaveProperty('Payment Gateway');
    });

    it('handles errors gracefully', async () => {
      monitoringModule.getMonitoringStatus.mockImplementation(() => {
        throw new Error('monitor error');
      });
      const response = await request(app).get('/api/monitoring/status');
      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        success: false,
        message: 'Failed to retrieve monitoring status'
      });
    });
  });

  describe('GET /api/monitoring/', () => {
    it('should serve monitoring dashboard HTML with CSP nonce', async () => {
      const response = await request(app).get('/api/monitoring/');
      expect(response.status).toBe(200);
      expect(response.text).toContain('monitoring-dashboard.html');
    });
  });

  describe('GET /api/monitoring/dashboard', () => {
    it('should serve monitoring dashboard HTML with CSP nonce', async () => {
      const response = await request(app).get('/api/monitoring/dashboard');
      expect(response.status).toBe(200);
      expect(response.text).toContain('monitoring-dashboard.html');
    });
  });

  describe('404 Handler', () => {
    it('should return 404 for non-existent monitoring endpoints', async () => {
      const response = await request(app).get('/api/monitoring/non-existent');
      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        success: false,
        message: 'Monitoring endpoint not found'
      });
    });
  });
});
