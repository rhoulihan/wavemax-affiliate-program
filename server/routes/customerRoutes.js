// Customer Routes for WaveMAX Laundry Affiliate Program
//
// Phase 1: the customer surface is bag-claim registration only — there is no
// customer login, dashboard, profile, or order portal. The only authenticated
// reader is the administrator customer list. (Portal preserved on the
// `phase2-reference` tag.)

const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');
const { authenticate } = require('../middleware/auth');
const { checkRole } = require('../middleware/rbac');
const { body } = require('express-validator');
const { registrationLimiter, createCustomLimiter } = require('../middleware/rateLimiting');
const { handleValidationErrors } = require('../middleware/locationValidation');

// Tight limiter on top of the global apiLimiter for the public claim
// resolver (anti-enumeration, spec §9 — mirrors bagRoutes' bag-resolve).
const claimResolveLimiter = createCustomLimiter({
  windowMs: 15 * 60 * 1000,
  max: 60,
  name: 'claim-resolve',
  skip: () => process.env.NODE_ENV === 'test'
});

/**
 * @route   GET /api/customers/check-rate-limit
 * @desc    Check if registration rate limit would be exceeded
 * @access  Public
 */
router.get('/check-rate-limit', (req, res, next) => {
  // Apply the registration rate limiter to check
  registrationLimiter(req, res, (err) => {
    if (err) {
      // Rate limit would be exceeded
      return res.status(429).json({
        success: false,
        message: 'Too many registration attempts from this IP, please try again later',
        retryAfter: err.retryAfter || 3600
      });
    }
    // Rate limit check passed
    res.json({
      success: true,
      message: 'Rate limit check passed'
    });
  });
});

/**
 * @route   GET /api/v1/customers/claim/:bagToken
 * @desc    Resolve a scanned bag token (claimable | claimed | invalid)
 * @access  Public (rate-limited; anti-enumeration)
 */
router.get('/claim/:bagToken', claimResolveLimiter, customerController.resolveClaim);

/**
 * @route   POST /api/v1/customers/claim/:bagToken/email-otp/request
 * @desc    Send a 6-digit email-verification OTP for this bag + email
 * @access  Public (registrationLimiter; CSRF-exempt registration class)
 */
router.post('/claim/:bagToken/email-otp/request', registrationLimiter, [
  body('email').isEmail().withMessage('Valid email is required')
], handleValidationErrors, customerController.requestEmailOtp);

/**
 * @route   POST /api/v1/customers/claim/:bagToken/email-otp/verify
 * @desc    Verify the email OTP; mints a one-time emailVerificationToken
 * @access  Public (lockout-gated; CSRF-exempt registration class)
 */
router.post('/claim/:bagToken/email-otp/verify', registrationLimiter, [
  body('email').isEmail().withMessage('Valid email is required'),
  body('code').notEmpty().withMessage('Code is required')
], handleValidationErrors, customerController.verifyEmailOtp);

/**
 * @route   POST /api/v1/customers/claim/:bagToken/register
 * @desc    Register a new customer against an issued bag (affiliate derived from the bag).
 *          PR 7: requires a verified emailVerificationToken (always) and a Firebase
 *          phoneIdToken when phone verification is enabled. No username/password.
 * @access  Public (registrationLimiter; CSRF-exempt registration class)
 */
router.post('/claim/:bagToken/register', registrationLimiter, [
  body('firstName').notEmpty().withMessage('First name is required'),
  body('lastName').notEmpty().withMessage('Last name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('phone').notEmpty().withMessage('Phone number is required'),
  body('address').notEmpty().withMessage('Address is required'),
  body('city').notEmpty().withMessage('City is required'),
  body('state').notEmpty().withMessage('State is required'),
  body('zipCode').notEmpty().withMessage('ZIP code is required'),
  body('emailVerificationToken').notEmpty().withMessage('Email verification is required')
], handleValidationErrors, customerController.claimRegister);

/**
 * @route   GET /api/customers/admin/list
 * @desc    Get customers list for admin dashboard
 * @access  Admin only
 */
router.get('/admin/list', authenticate, checkRole(['administrator']), customerController.getCustomersForAdmin);

module.exports = router;
