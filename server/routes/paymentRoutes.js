const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { authenticate } = require('../middleware/auth');
const { body, param, query } = require('express-validator');

// Webhook endpoint (no authentication required)
router.post('/webhook', 
  express.raw({ type: 'application/json' }), // Raw body for signature verification
  paymentController.handleWebhook
);

// All other routes require authentication
router.use(authenticate);

// Payment endpoints
router.post('/',
  [
    body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
    body('currency').isIn(['USD', 'EUR', 'GBP', 'CAD', 'AUD']).withMessage('Invalid currency'),
    body('orderId').isMongoId().withMessage('Invalid order ID'),
    body('paymentMethodId').isMongoId().withMessage('Invalid payment method ID'),
    body('description').optional().isString().trim()
  ],
  paymentController.createPayment
);

router.post('/:id/capture',
  [
    param('id').isMongoId().withMessage('Invalid payment ID'),
    body('amount').optional().isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0')
  ],
  paymentController.capturePayment
);

router.post('/:id/refund',
  [
    param('id').isMongoId().withMessage('Invalid payment ID'),
    body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
    body('reason').notEmpty().withMessage('Refund reason is required').trim()
  ],
  paymentController.refundPayment
);

router.get('/:id',
  param('id').isMongoId().withMessage('Invalid payment ID'),
  paymentController.getPayment
);

router.get('/',
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('status').optional().isIn(['pending', 'processing', 'authorized', 'captured', 'succeeded', 'failed', 'canceled', 'refunded', 'partially_refunded']),
    query('startDate').optional().isISO8601().withMessage('Invalid start date'),
    query('endDate').optional().isISO8601().withMessage('Invalid end date')
  ],
  paymentController.listPayments
);

// Tokenization endpoints
router.post('/tokenization/session',
  [
    body('successUrl').isURL().withMessage('Invalid success URL'),
    body('cancelUrl').isURL().withMessage('Invalid cancel URL'),
    body('metadata').optional().isObject()
  ],
  paymentController.createTokenizationSession
);

// Payment method endpoints
router.post('/methods',
  [
    body('token').notEmpty().withMessage('Token is required'),
    body('type').optional().isIn(['card', 'bank_account', 'wallet']).withMessage('Invalid payment method type'),
    body('isDefault').optional().isBoolean()
  ],
  paymentController.createPaymentMethod
);

router.get('/methods',
  paymentController.listPaymentMethods
);

router.get('/methods/:id',
  param('id').isMongoId().withMessage('Invalid payment method ID'),
  paymentController.getPaymentMethod
);

router.delete('/methods/:id',
  param('id').isMongoId().withMessage('Invalid payment method ID'),
  paymentController.deletePaymentMethod
);

router.put('/methods/:id/default',
  param('id').isMongoId().withMessage('Invalid payment method ID'),
  paymentController.setDefaultPaymentMethod
);

router.post('/methods/:id/verify',
  [
    param('id').isMongoId().withMessage('Invalid payment method ID'),
    body('amounts').isArray({ min: 2, max: 2 }).withMessage('Two amounts required for verification'),
    body('amounts.*').isFloat({ min: 0.01, max: 1.00 }).withMessage('Invalid verification amount')
  ],
  paymentController.verifyPaymentMethod
);

module.exports = router;