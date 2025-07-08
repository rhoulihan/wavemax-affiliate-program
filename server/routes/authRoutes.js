// Authentication Routes for WaveMAX Laundry Affiliate Program

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { authLimiter, passwordResetLimiter, registrationLimiter, adminLoginLimiter } = require('../middleware/rateLimiting');
const { body, validationResult } = require('express-validator');
const { customPasswordValidator } = require('../utils/passwordValidator');

// Validation middleware
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(err => err.msg)
    });
  }
  next();
};

/**
 * @route   GET /api/auth/docusign/callback
 * @desc    DocuSign OAuth callback for consent
 * @access  Public
 */
// Import the w9 controller for DocuSign OAuth
const w9ControllerDocuSign = require('../controllers/w9ControllerDocuSign');

router.get('/docusign/callback', w9ControllerDocuSign.handleOAuthCallback);

/**
 * @route   POST /api/auth/affiliate/login
 * @desc    Login affiliate
 * @access  Public
 */
router.post('/affiliate/login',
  authLimiter,
  [
    body('username').trim().notEmpty().withMessage('Username is required')
      .isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
    body('password').notEmpty().withMessage('Password is required')
  ],
  validate,
  authController.affiliateLogin
);

/**
 * @route   POST /api/auth/customer/login
 * @desc    Login customer
 * @access  Public
 */
router.post('/customer/login',
  authLimiter,
  [
    // Support both username and emailOrUsername fields
    body('emailOrUsername').optional().trim(),
    body('username').optional().trim(),
    body('password').notEmpty().withMessage('Password is required'),
    // Custom validation to ensure at least one identifier is provided
    body().custom((value, { req }) => {
      const { username, emailOrUsername } = req.body;
      if (!username && !emailOrUsername) {
        throw new Error('Username or email is required');
      }
      return true;
    })
  ],
  validate,
  authController.customerLogin
);

/**
 * @route   POST /api/auth/administrator/login
 * @desc    Login administrator
 * @access  Public
 */
router.post('/administrator/login',
  adminLoginLimiter,
  [
    body('email').trim().isEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required')
  ],
  validate,
  authController.administratorLogin
);

/**
 * @route   GET /api/auth/operator/login
 * @desc    Auto-login operator from store IP
 * @access  Public (restricted by IP)
 */
router.get('/operator/login', authController.operatorAutoLogin);

/**
 * @route   POST /api/auth/operator/login
 * @desc    Login operator
 * @access  Public
 */
router.post('/operator/login',
  authLimiter,
  [
    body('email').trim().isEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required')
  ],
  validate,
  authController.operatorLogin
);

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Request password reset
 * @access  Public
 */
router.post('/forgot-password',
  passwordResetLimiter,
  [
    body('email').trim().isEmail().withMessage('Valid email is required'),
    body('userType').isIn(['affiliate', 'customer', 'administrator', 'operator']).withMessage('Invalid user type')
  ],
  validate,
  authController.forgotPassword
);

/**
 * @route   POST /api/auth/reset-password
 * @desc    Reset password with token
 * @access  Public
 */
router.post('/reset-password',
  passwordResetLimiter,
  [
    body('token').trim().notEmpty().withMessage('Reset token is required')
      .isLength({ min: 64, max: 64 }).withMessage('Invalid reset token'),
    body('userType').isIn(['affiliate', 'customer', 'administrator', 'operator']).withMessage('Invalid user type'),
    body('password').custom(customPasswordValidator())
  ],
  validate,
  authController.resetPassword
);

/**
 * @route   GET /api/auth/verify
 * @desc    Verify user token
 * @access  Private
 */
router.get('/verify', authenticate, authController.verifyToken);

router.post('/refresh-token',
  [
    body('refreshToken').trim().notEmpty().withMessage('Refresh token is required')
      .isLength({ min: 80, max: 80 }).withMessage('Invalid refresh token format')
  ],
  validate,
  authController.refreshToken
);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user
 * @access  Private
 */
router.post('/logout',
  authenticate,
  [
    body('refreshToken').trim().notEmpty().withMessage('Refresh token is required')
  ],
  validate,
  authController.logout
);

/**
 * @route   GET /api/auth/oauth-session/:sessionId
 * @desc    Poll for OAuth session result
 * @access  Public
 */
router.get('/oauth-session/:sessionId',
  authController.pollOAuthSession
);

/**
 * @route   GET /api/auth/test-oauth-callback
 * @desc    Test OAuth callback
 * @access  Public
 */
router.get('/test-oauth-callback', async (req, res) => {
  console.log('[Test] OAuth callback test route hit');
  res.send('OAuth callback test successful');
});

/**
 * @route   POST /api/auth/check-username
 * @desc    Check if username is available
 * @access  Public
 */
router.post('/check-username',
  [
    body('username').trim().notEmpty().withMessage('Username is required')
      .isLength({ min: 3 }).withMessage('Username must be at least 3 characters')
  ],
  validate,
  authController.checkUsername
);

/**
 * @route   POST /api/auth/check-email
 * @desc    Check if email is available
 * @access  Public
 */
router.post('/check-email',
  [
    body('email').trim().notEmpty().withMessage('Email is required')
      .isEmail().withMessage('Must be a valid email')
  ],
  validate,
  authController.checkEmail
);

module.exports = router;