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
  
  passport.authenticate('google', {
    scope: ['profile', 'email']
  })(req, res, next);
});

/**
 * @route   GET /api/auth/google/callback
 * @desc    Handle Google OAuth callback
 * @access  Public
 */
router.get('/google/callback', 
  passport.authenticate('google', { session: false }),
  authController.handleSocialCallback
);

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
  
  passport.authenticate('facebook', {
    scope: ['email']
  })(req, res, next);
});

/**
 * @route   GET /api/auth/facebook/callback
 * @desc    Handle Facebook OAuth callback
 * @access  Public
 */
router.get('/facebook/callback',
  passport.authenticate('facebook', { session: false }),
  authController.handleSocialCallback
);

/**
 * @route   GET /api/auth/linkedin
 * @desc    Start LinkedIn OAuth authentication
 * @access  Public
 */
router.get('/linkedin', (req, res, next) => {
  // Check if LinkedIn OAuth is configured
  if (!process.env.LINKEDIN_CLIENT_ID || !process.env.LINKEDIN_CLIENT_SECRET) {
    return res.status(404).json({
      success: false,
      message: 'LinkedIn OAuth is not configured'
    });
  }
  
  passport.authenticate('linkedin', {
    scope: ['r_emailaddress', 'r_liteprofile']
  })(req, res, next);
});

/**
 * @route   GET /api/auth/linkedin/callback
 * @desc    Handle LinkedIn OAuth callback
 * @access  Public
 */
router.get('/linkedin/callback',
  passport.authenticate('linkedin', { session: false }),
  authController.handleSocialCallback
);

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
  body('serviceArea').notEmpty().withMessage('Service area is required'),
  body('deliveryFee').isNumeric().withMessage('Delivery fee must be a number'),
  body('paymentMethod').isIn(['directDeposit', 'check', 'paypal']).withMessage('Invalid payment method'),
  // Username and password are still required for social registrations as backup
  body('username').notEmpty().withMessage('Username is required'),
  body('password').custom(customPasswordValidator)
], authController.completeSocialRegistration);

/**
 * @route   POST /api/auth/social/link
 * @desc    Link social media account to existing affiliate
 * @access  Private
 */
router.post('/social/link', [
  body('provider').isIn(['google', 'facebook', 'linkedin']).withMessage('Invalid social media provider'),
  body('socialToken').notEmpty().withMessage('Social authentication token is required')
], authController.linkSocialAccount);

/**
 * @route   POST /api/auth/social/callback
 * @desc    Handle social login callback for existing users
 * @access  Public
 */
router.post('/social/callback', [
  body('provider').isIn(['google', 'facebook', 'linkedin']).withMessage('Invalid social media provider'),
  body('socialId').notEmpty().withMessage('Social ID is required')
], authController.socialLogin);

module.exports = router;