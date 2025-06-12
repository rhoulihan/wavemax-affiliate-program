const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');

// Payment configuration endpoint (public)
router.get('/config', paymentController.getConfig);

// Payment callback endpoint (handles return from Paygistix)
router.post('/callback', paymentController.handleCallback);
router.get('/callback', paymentController.handleCallback);

module.exports = router;