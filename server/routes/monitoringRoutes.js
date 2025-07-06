// Monitoring Dashboard Routes
const express = require('express');
const router = express.Router();
const { serveHTMLWithNonce } = require('../utils/cspHelper');

// Middleware to add security headers
const securityHeaders = (req, res, next) => {
  // Prevent embedding
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
};

// Apply security headers to all monitoring routes
router.use(securityHeaders);

// API endpoint for monitoring status
router.get('/status', async (req, res) => {
  try {
    // Mock monitoring data for now - in production, this would gather real metrics
    const monitoringData = {
      overallHealth: 'healthy',
      uptime: process.uptime() * 1000, // Convert to milliseconds
      services: {
        'API Server': {
          status: 'up',
          critical: true,
          availability: '99.9%',
          responseTime: 45,
          totalChecks: 1440,
          failedChecks: 1,
          lastCheck: new Date().toISOString(),
          history: Array(60).fill(0).map((_, i) => ({
            timestamp: Date.now() - (59 - i) * 60000,
            responseTime: Math.floor(Math.random() * 50) + 30,
            success: Math.random() > 0.01
          }))
        },
        'Database': {
          status: 'up',
          critical: true,
          availability: '99.8%',
          responseTime: 12,
          totalChecks: 1440,
          failedChecks: 3,
          lastCheck: new Date().toISOString(),
          history: Array(60).fill(0).map((_, i) => ({
            timestamp: Date.now() - (59 - i) * 60000,
            responseTime: Math.floor(Math.random() * 20) + 10,
            success: Math.random() > 0.02
          }))
        },
        'Payment Gateway': {
          status: 'up',
          critical: true,
          availability: '99.9%',
          responseTime: 120,
          totalChecks: 1440,
          failedChecks: 1,
          lastCheck: new Date().toISOString(),
          history: Array(60).fill(0).map((_, i) => ({
            timestamp: Date.now() - (59 - i) * 60000,
            responseTime: Math.floor(Math.random() * 50) + 100,
            success: Math.random() > 0.01
          }))
        },
        'Email Service': {
          status: 'up',
          critical: false,
          availability: '99.7%',
          responseTime: 89,
          totalChecks: 1440,
          failedChecks: 4,
          lastCheck: new Date().toISOString(),
          history: Array(60).fill(0).map((_, i) => ({
            timestamp: Date.now() - (59 - i) * 60000,
            responseTime: Math.floor(Math.random() * 50) + 50,
            success: Math.random() > 0.03
          }))
        },
        'DocuSign API': {
          status: 'up',
          critical: false,
          availability: '99.5%',
          responseTime: 250,
          totalChecks: 1440,
          failedChecks: 7,
          lastCheck: new Date().toISOString(),
          history: Array(60).fill(0).map((_, i) => ({
            timestamp: Date.now() - (59 - i) * 60000,
            responseTime: Math.floor(Math.random() * 100) + 200,
            success: Math.random() > 0.05
          }))
        },
        'DNS Resolution': {
          status: 'up',
          critical: true,
          availability: '100%',
          responseTime: 5,
          totalChecks: 1440,
          failedChecks: 0,
          lastCheck: new Date().toISOString(),
          history: Array(60).fill(0).map((_, i) => ({
            timestamp: Date.now() - (59 - i) * 60000,
            responseTime: Math.floor(Math.random() * 5) + 3,
            success: true
          }))
        }
      }
    };

    res.json(monitoringData);
  } catch (error) {
    console.error('Error generating monitoring status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve monitoring status'
    });
  }
});

// Serve monitoring dashboard with CSP nonce
router.get('/', serveHTMLWithNonce('monitoring-dashboard.html'));
router.get('/dashboard', serveHTMLWithNonce('monitoring-dashboard.html'));

// Handle 404s within monitoring routes
router.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Monitoring endpoint not found'
  });
});

module.exports = router;