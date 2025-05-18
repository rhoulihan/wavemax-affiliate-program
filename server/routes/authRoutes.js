// Authentication Routes for WaveMAX Laundry Affiliate Program

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authLimiter } = require('../middleware/auth');

/**
 * @route   POST /api/auth/affiliate/login
 * @desc    Login affiliate
 * @access  Public
 */
router.post('/affiliate/login', authLimiter, authController.affiliateLogin);

/**
 * @route   POST /api/auth/customer/login
 * @desc    Login customer
 * @access  Public
 */
router.post('/customer/login', authLimiter, authController.customerLogin);

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Request password reset
 * @access  Public
 */
router.post('/forgot-password', authController.forgotPassword);

/**
 * @route   POST /api/auth/reset-password
 * @desc    Reset password with token
 * @access  Public
 */
router.post('/reset-password', authController.resetPassword);

/**
 * @route   GET /api/auth/verify
 * @desc    Verify user token
 * @access  Private
 */
router.get('/verify', authController.verifyToken);

router.post('/refresh-token', authController.refreshToken);

module.exports = router;