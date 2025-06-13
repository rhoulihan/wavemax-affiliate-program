const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const fs = require('fs');
const path = require('path');

// Payment configuration endpoint (public)
router.get('/config', paymentController.getConfig);

// Payment submission logging endpoint (for debugging)
router.post('/log-submission', paymentController.logSubmission);

// Payment token endpoints
router.post('/create-token', paymentController.createPaymentToken);
router.get('/check-status/:token', paymentController.checkPaymentStatus);
router.post('/cancel-token/:token', paymentController.cancelPaymentToken);

// Pool statistics endpoint
router.get('/pool-stats', paymentController.getPoolStats);

// Dynamic form-specific callback routes
try {
  const configPath = path.join(__dirname, '../config/paygistix-forms.json');
  const configData = fs.readFileSync(configPath, 'utf8');
  const formsConfig = JSON.parse(configData);
  
  // Create dynamic routes for each form
  formsConfig.forms.forEach(form => {
    // Remove /api/v1/payments prefix from callback path since it's already in the router base
    const routePath = form.callbackPath.replace('/api/v1/payments', '');
    
    router.get(routePath, (req, res) => 
      paymentController.handleFormCallback(req, res, form.callbackPath)
    );
    router.post(routePath, (req, res) => 
      paymentController.handleFormCallback(req, res, form.callbackPath)
    );
    
    console.log(`Registered payment callback route: ${form.callbackPath}`);
  });
} catch (error) {
  console.error('Error loading form routes:', error);
}

module.exports = router;