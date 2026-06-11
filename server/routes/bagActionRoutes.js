// Public bag-URL mutations (PR 9). CSRF-exempt (no ambient credential —
// authorized by role codes), but stacked behind a tight per-IP limiter and
// the per-bag/IP failed-attempt lockout enforced in the controller.
const express = require('express');
const router = express.Router();
const bagActionController = require('../controllers/bagActionController');
const { createCustomLimiter } = require('../middleware/rateLimiting');

const bagActionLimiter = createCustomLimiter({
  windowMs: 15 * 60 * 1000,
  max: 30,
  name: 'bag_actions',
  keyGenerator: (req) => req.ip,
  skip: () => process.env.NODE_ENV === 'test' // lockout still enforced in tests
});

router.post('/:bagToken/intake', bagActionLimiter, bagActionController.intakeWithCode);
router.post('/:bagToken/advance', bagActionLimiter, bagActionController.advanceWithCode);
router.post('/:bagToken/confirm-delivery', bagActionLimiter, bagActionController.confirmDelivery);

module.exports = router;
