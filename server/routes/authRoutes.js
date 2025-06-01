// Authentication Routes for WaveMAX Laundry Affiliate Program

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authLimiter, authenticate } = require('../middleware/auth');
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
    body('username').trim().notEmpty().withMessage('Username is required')
      .isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
    body('password').notEmpty().withMessage('Password is required')
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
  authLimiter,
  [
    body('email').trim().isEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required')
  ],
  validate,
  authController.administratorLogin
);

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
  authLimiter,
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
  authLimiter,
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

module.exports = router;