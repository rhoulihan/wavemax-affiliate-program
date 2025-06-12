const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');

// Payment configuration endpoint (public)
router.get('/config', paymentController.getConfig);

// Payment submission logging endpoint (for debugging)
router.post('/log-submission', paymentController.logSubmission);

// Payment token endpoints
router.post('/create-token', paymentController.createPaymentToken);
router.get('/check-status/:token', paymentController.checkPaymentStatus);
router.post('/cancel-token/:token', paymentController.cancelPaymentToken);

// Payment callback endpoint (handles return from Paygistix)
router.post('/callback', paymentController.handleCallback);
router.get('/callback', paymentController.handleCallback);

module.exports = router;