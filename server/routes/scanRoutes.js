// Scan-session routes (PR 4, spec §4). Mounted at /api/v1/scan.
//
// /session is public (credential-light: authorized by a one-time role code, no
// ambient cookie/session — same rationale as the bag-URL flow) so it is
// CSRF-exempt and instead protected by a tight per-IP limiter + the per-bag/IP
// codeAttemptLockout inside the service.
//
// /resolve, /apply, /undo are behind scanAuth (an operator JWT OR a scan-session
// token). They carry no ambient cookie credential either, so they are also
// CSRF-exempt; scanAuth + the limiter are the gate.

const express = require('express');
const router = express.Router();
const scanController = require('../modules/scan/scanController');
const scanAuth = require('../middleware/scanAuth');
const { createCustomLimiter } = require('../middleware/rateLimiting');

// Real client IP behind Cloudflare (matches accessGate / codeAttemptLockout).
const scanLimiter = createCustomLimiter({
  windowMs: 15 * 60 * 1000,
  max: 120,
  name: 'scan_actions',
  keyGenerator: (req) => req.headers['cf-connecting-ip'] || req.ip,
  skip: () => process.env.NODE_ENV === 'test' // lockout still enforced in tests
});

router.post('/session', scanLimiter, scanController.createSession);
router.post('/resolve', scanLimiter, scanAuth, scanController.resolve);
router.post('/apply', scanLimiter, scanAuth, scanController.apply);
router.post('/undo', scanLimiter, scanAuth, scanController.undo);

module.exports = router;
