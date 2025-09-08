const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');
const { authenticate } = require('../middleware/auth');
const { checkRole } = require('../middleware/rbac');

// V2 Payment endpoints
router.post('/initiate-payment', 
  authenticate, 
  checkRole(['customer']),
  customerController.initiateV2Payment
);

router.get('/payment-status/:orderId',
  authenticate,
  checkRole(['customer']),
  customerController.getV2PaymentStatus
);

module.exports = router;