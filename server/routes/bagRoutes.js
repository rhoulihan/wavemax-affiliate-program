// Bag routes — mounted at /api/v1/bags (spec §5).

const express = require('express');
const router = express.Router();
const bagController = require('../modules/bags/bagController');
const { authenticate } = require('../middleware/auth');
const { checkAdminPermission } = require('../middleware/rbac');
const { sensitiveOperationLimiter, createCustomLimiter } = require('../middleware/rateLimiting');

// Tight limiter on top of the global apiLimiter for the public token
// resolver (anti-enumeration, spec §9).
const bagResolveLimiter = createCustomLimiter({
  windowMs: 15 * 60 * 1000,
  max: 60,
  name: 'bag-resolve',
  skip: () => process.env.NODE_ENV === 'test'
});

/**
 * @route   POST /api/v1/bags/mint
 * @access  administrator + manage_affiliates (CSRF enforced via csrf-config)
 */
router.post('/mint',
  authenticate,
  checkAdminPermission('manage_affiliates'),
  sensitiveOperationLimiter,
  bagController.mintBags);

/**
 * @route   POST /api/v1/bags/print-run
 * @access  administrator + manage_affiliates (CSRF enforced via csrf-config)
 * Combined mint+issue for the admin "Print Labels" flow.
 */
router.post('/print-run',
  authenticate,
  checkAdminPermission('manage_affiliates'),
  sensitiveOperationLimiter,
  bagController.printRun);

/**
 * @route   GET /api/v1/bags/batch/:batchId/labels
 * @access  short-lived labels token (?t=) OR administrator + manage_affiliates.
 * A browser tab navigation carries no auth header, so the print flow passes a
 * purpose-scoped token; an admin with a Bearer header still works. The access
 * decision lives in bagController.bagLabelsAccess (scoped to this route only).
 */
router.get('/batch/:batchId/labels',
  bagController.bagLabelsAccess,
  bagController.getBatchLabels);

/**
 * @route   POST /api/v1/bags/batch/:batchId/issue
 * @access  administrator + manage_affiliates (CSRF enforced via csrf-config)
 */
router.post('/batch/:batchId/issue',
  authenticate,
  checkAdminPermission('manage_affiliates'),
  bagController.issueBatch);

/**
 * @route   GET /api/v1/bags/resolve/:token
 * @access  public (rate-limited) — canonical scan-context resolver
 */
router.get('/resolve/:token', bagResolveLimiter, bagController.resolveBag);

/**
 * @route   GET /api/v1/bags
 * @access  affiliate (own) / administrator — inventory listing
 */
router.get('/', authenticate, bagController.getInventory);

module.exports = router;
