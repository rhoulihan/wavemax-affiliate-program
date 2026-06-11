// Public affiliate-invite routes — token validation for the registration
// form. Anti-enumeration: all failures are one generic 410 shape (spec §9).

const express = require('express');
const router = express.Router();
const inviteController = require('../modules/onboarding/inviteController');

/**
 * @route   GET /api/v1/affiliate-invites/:token/validate
 * @desc    Validate an invite token for form prefill / email lock
 * @access  Public (rate-limited by the global apiLimiter on /api/)
 */
router.get('/:token/validate', inviteController.validateInvite);

module.exports = router;
