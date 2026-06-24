// Monitoring Dashboard Routes
const express = require('express');
const logger = require('../utils/logger');
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

// Real connectivity-monitor data — the SINGLE source for GET /monitoring/status.
// (Previously this served fabricated Math.random metrics + a phantom 'Payment
// Gateway' service and, being mounted before server.js's app.get('/monitoring/
// status'), shadowed the real handler. Money is external in Cents, so there is
// no payment-gateway service to monitor.)
const monitoringModule = require('../monitoring/connectivity-monitor');

// API endpoint for monitoring status
router.get('/status', (req, res) => {
  try {
    res.json(monitoringModule.getMonitoringStatus());
  } catch (error) {
    logger.error('Error generating monitoring status:', error);
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