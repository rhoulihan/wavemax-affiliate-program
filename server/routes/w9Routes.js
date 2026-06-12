// W-9 routes (redesign PR 10 — GREENFIELD). Mounted at /api/v1/w9.
// The upload route lives in affiliateRoutes.js (path is /affiliates/:id/w9).
const express = require('express');
const router = express.Router();
const w9Controller = require('../modules/onboarding/w9Controller');
const { authenticate, authorize } = require('../middleware/auth');
const { checkAdminPermission } = require('../middleware/rbac');

// Affiliate self-service
router.get('/status', authenticate, authorize('affiliate'), w9Controller.getW9Status);

// Admin review surface — single permission key for the whole
// admin-manages-affiliates workflow: manage_affiliates (spec §6.1 rationale).
router.get('/admin/pending', authenticate,
  checkAdminPermission(['manage_affiliates']), w9Controller.getPendingW9s);
router.get('/admin/:affiliateId/document', authenticate,
  checkAdminPermission(['manage_affiliates']), w9Controller.downloadW9);
router.post('/admin/:affiliateId/verify', authenticate,
  checkAdminPermission(['manage_affiliates']), w9Controller.verifyW9);
router.post('/admin/:affiliateId/reject', authenticate,
  checkAdminPermission(['manage_affiliates']), w9Controller.rejectW9);

module.exports = router;
