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
  // Real client IP: Cloudflare fronts nginx (trust proxy = 1), so req.ip is
  // the CF edge IP — keying on it would throttle everyone behind one edge.
  // Same pattern as accessGate.js clientIp. (express-rate-limit 7.1.4 has no
  // IPv6 keyGenerator validation; raw-IP custom keys match rateLimiting.js.)
  keyGenerator: (req) => req.headers['cf-connecting-ip'] || req.ip,
  skip: () => process.env.NODE_ENV === 'test' // lockout still enforced in tests
});

router.post('/:bagToken/intake', bagActionLimiter, bagActionController.intakeWithCode);
router.post('/:bagToken/advance', bagActionLimiter, bagActionController.advanceWithCode);
router.post('/:bagToken/confirm-delivery', bagActionLimiter, bagActionController.confirmDelivery);

module.exports = router;
