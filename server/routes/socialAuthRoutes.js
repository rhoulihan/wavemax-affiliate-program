// Social Media Authentication Routes for WaveMAX Laundry Affiliate Program

const express = require('express');
const router = express.Router();
const passport = require('../config/passport-config');
const authController = require('../controllers/authController');
const { body, validationResult } = require('express-validator');
const { customPasswordValidator } = require('../utils/passwordValidator');

/**
 * @route   GET /api/auth/google
 * @desc    Start Google OAuth authentication
 * @access  Public
 */
router.get('/google', (req, res, next) => {
  // Check if Google OAuth is configured
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.status(404).json({
      success: false,
      message: 'Google OAuth is not configured'
    });
  }

  // Pass state parameter through OAuth (includes sessionId for popup requests)
  const state = req.query.state || '';

  passport.authenticate('google', {
    scope: ['profile', 'email'],
    state: state
  })(req, res, next);
});

/**
 * @route   GET /api/auth/google/callback
 * @desc    Handle Google OAuth callback
 * @access  Public
 */
router.get('/google/callback', (req, res, next) => {
  passport.authenticate('google', { session: false }, (err, user, info) => {
    console.log('[OAuth] Google callback:', { 
      error: err ? err.message : null, 
      user: user ? 'exists' : 'null',
      userObject: user,
      isExistingAffiliate: user?.isExistingAffiliate,
      info: info 
    });
    
    // Handle errors
    if (err) {
      console.error('[OAuth] Google authentication error:', err);
      req.user = null;
    } else {
      req.user = user;
    }
    
    // Always proceed to handleSocialCallback, even if authentication failed
    authController.handleSocialCallback(req, res);
  })(req, res, next);
});

/**
 * @route   GET /api/auth/facebook
 * @desc    Start Facebook OAuth authentication
 * @access  Public
 */
router.get('/facebook', (req, res, next) => {
  // Check if Facebook OAuth is configured
  if (!process.env.FACEBOOK_APP_ID || !process.env.FACEBOOK_APP_SECRET) {
    return res.status(404).json({
      success: false,
      message: 'Facebook OAuth is not configured'
    });
  }

  const options = {
    scope: ['email']
  };
  
  // Pass state parameter if provided
  if (req.query.state) {
    options.state = req.query.state;
  }

  passport.authenticate('facebook', options)(req, res, next);
});

/**
 * @route   GET /api/auth/facebook/callback
 * @desc    Handle Facebook OAuth callback
 * @access  Public
 */
router.get('/facebook/callback', (req, res, next) => {
  passport.authenticate('facebook', { session: false }, (err, user, info) => {
    // Add user to request regardless of authentication result
    req.user = user;
    
    // Always proceed to handleSocialCallback, even if authentication failed
    authController.handleSocialCallback(req, res);
  })(req, res, next);
});

// LinkedIn OAuth routes removed - launching with Google and Facebook only
// /**
//  * @route   GET /api/auth/linkedin
//  * @desc    Start LinkedIn OAuth authentication
//  * @access  Public
//  */
// router.get('/linkedin', (req, res, next) => {
//   // Check if LinkedIn OAuth is configured
//   if (!process.env.LINKEDIN_CLIENT_ID || !process.env.LINKEDIN_CLIENT_SECRET) {
//     return res.status(404).json({
//       success: false,
//       message: 'LinkedIn OAuth is not configured'
//     });
//   }

//   passport.authenticate('linkedin', {
//     scope: ['r_emailaddress', 'r_liteprofile']
//   })(req, res, next);
// });

// /**
//  * @route   GET /api/auth/linkedin/callback
//  * @desc    Handle LinkedIn OAuth callback
//  * @access  Public
//  */
// router.get('/linkedin/callback', (req, res, next) => {
//   passport.authenticate('linkedin', { session: false }, (err, user, info) => {
//     // Add user to request regardless of authentication result
//     req.user = user;
//     
//     // Always proceed to handleSocialCallback, even if authentication failed
//     authController.handleSocialCallback(req, res);
//   })(req, res, next);
// });

/**
 * @route   POST /api/auth/social/register
 * @desc    Complete social media registration for affiliates
 * @access  Public
 */
router.post('/social/register', [
  body('socialToken').notEmpty().withMessage('Social authentication token is required'),
  body('phone').notEmpty().withMessage('Phone number is required'),
  body('address').notEmpty().withMessage('Address is required'),
  body('city').notEmpty().withMessage('City is required'),
  body('state').notEmpty().withMessage('State is required'),
  body('zipCode').notEmpty().withMessage('ZIP code is required'),
  body('serviceLatitude').notEmpty().isNumeric().withMessage('Service latitude is required'),
  body('serviceLongitude').notEmpty().isNumeric().withMessage('Service longitude is required'),
  body('serviceRadius').notEmpty().isNumeric().isInt({ min: 1, max: 50 }).withMessage('Service radius must be between 1 and 50 miles'),
  body('minimumDeliveryFee').optional().isNumeric().withMessage('Minimum delivery fee must be a number'),
  body('perBagDeliveryFee').optional().isNumeric().withMessage('Per-bag delivery fee must be a number'),
  body('paymentMethod').isIn(['check', 'paypal', 'venmo']).withMessage('Invalid payment method')
  // Username and password are NOT required for social registrations - OAuth provides authentication
  // These fields will be auto-generated if not provided
], authController.completeSocialRegistration);

/**
 * @route   GET /api/auth/customer/google
 * @desc    Start Google OAuth authentication for customers
 * @access  Public
 */
router.get('/customer/google', (req, res, next) => {
  // Check if Google OAuth is configured
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.status(404).json({
      success: false,
      message: 'Google OAuth is not configured'
    });
  }

  // Pass state parameter through OAuth (includes sessionId for popup requests)
  const state = req.query.state || '';

  // Add customer context to state parameter
  const customerState = state ? `customer_${state}` : 'customer';

  passport.authenticate('google', {
    scope: ['profile', 'email'],
    state: customerState
  })(req, res, next);
});

/**
 * @route   GET /api/auth/customer/google/callback
 * @desc    Handle Google OAuth callback for customers (redirects to main callback)
 * @access  Public
 */
router.get('/customer/google/callback', (req, res) => {
  // Redirect to main Google callback to avoid redirect_uri_mismatch
  const queryString = new URLSearchParams(req.query).toString();
  res.redirect(`/api/v1/auth/google/callback?${queryString}`);
});

/**
 * @route   GET /api/auth/customer/facebook
 * @desc    Start Facebook OAuth authentication for customers
 * @access  Public
 */
router.get('/customer/facebook', (req, res, next) => {
  // Check if Facebook OAuth is configured
  if (!process.env.FACEBOOK_APP_ID || !process.env.FACEBOOK_APP_SECRET) {
    return res.status(404).json({
      success: false,
      message: 'Facebook OAuth is not configured'
    });
  }

  const state = req.query.state || '';
  
  // Add customer context to state parameter
  const customerState = state ? `customer_${state}` : 'customer';

  passport.authenticate('facebook', {
    scope: ['email'],
    state: customerState
  })(req, res, next);
});

/**
 * @route   GET /api/auth/customer/facebook/callback
 * @desc    Handle Facebook OAuth callback for customers
 * @access  Public
 */
router.get('/customer/facebook/callback',
  passport.authenticate('facebook', { session: false }),
  authController.handleCustomerSocialCallback
);

// LinkedIn OAuth routes removed - launching with Google and Facebook only
// /**
//  * @route   GET /api/auth/customer/linkedin
//  * @desc    Start LinkedIn OAuth authentication for customers
//  * @access  Public
//  */
// router.get('/customer/linkedin', (req, res, next) => {
//   // Check if LinkedIn OAuth is configured
//   if (!process.env.LINKEDIN_CLIENT_ID || !process.env.LINKEDIN_CLIENT_SECRET) {
//     return res.status(404).json({
//       success: false,
//       message: 'LinkedIn OAuth is not configured'
//     });
//   }

//   const state = req.query.state || '';

//   passport.authenticate('linkedin', {
//     scope: ['r_emailaddress', 'r_liteprofile'],
//     state: state
//   })(req, res, next);
// });

// /**
//  * @route   GET /api/auth/customer/linkedin/callback
//  * @desc    Handle LinkedIn OAuth callback for customers
//  * @access  Public
//  */
// router.get('/customer/linkedin/callback',
//   passport.authenticate('linkedin', { session: false }),
//   authController.handleCustomerSocialCallback
// );

/**
 * @route   POST /api/auth/customer/social/register
 * @desc    Complete social media registration for customers
 * @access  Public
 */
router.post('/customer/social/register', [
  body('socialToken').notEmpty().withMessage('Social authentication token is required'),
  body('affiliateId').notEmpty().withMessage('Affiliate ID is required'),
  body('phone').notEmpty().withMessage('Phone number is required'),
  body('address').notEmpty().withMessage('Address is required'),
  body('city').notEmpty().withMessage('City is required'),
  body('state').notEmpty().withMessage('State is required'),
  body('zipCode').notEmpty().withMessage('ZIP code is required'),
  body('serviceFrequency').isIn(['weekly', 'biweekly', 'monthly']).withMessage('Invalid service frequency')
  // Username and password are NOT required for customer social registrations - OAuth provides authentication
  // These fields will be auto-generated if not provided
], authController.completeSocialCustomerRegistration);

/**
 * @route   GET /api/auth/oauth/result/:sessionId
 * @desc    Poll for OAuth authentication result (database polling approach)
 * @access  Public
 */
router.get('/oauth/result/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    console.log('[OAuth Result Poll] Checking for session:', sessionId);

    // Get the OAuthSession model
    const OAuthSession = require('../models/OAuthSession');

    // Consume session (retrieve and delete in one operation)
    const session = await OAuthSession.consumeSession(sessionId);

    if (session) {
      console.log('[OAuth Result Poll] Session found and consumed:', session);

      return res.json({
        completed: true,
        success: true,
        data: session
      });
    } else {
      // Session not found or not completed yet
      return res.json({
        completed: false
      });
    }
  } catch (error) {
    console.error('[OAuth Result Poll] Error:', error);
    return res.status(500).json({
      completed: false,
      error: 'Internal server error'
    });
  }
});

module.exports = router;