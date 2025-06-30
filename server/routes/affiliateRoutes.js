// Affiliate Routes for WaveMAX Laundry Affiliate Program

const express = require('express');
const router = express.Router();
const affiliateController = require('../controllers/affiliateController');
const { authenticate, authorize } = require('../middleware/auth');
const { body } = require('express-validator');
const paginationMiddleware = require('../utils/paginationMiddleware');
const { customPasswordValidator } = require('../utils/passwordValidator');
const { registrationLimiter } = require('../middleware/rateLimiting');

/**
 * @route   POST /api/affiliates/register
 * @desc    Register a new affiliate
 * @access  Public
 */
router.post('/register', registrationLimiter, [
  body('firstName').notEmpty().withMessage('First name is required'),
  body('lastName').notEmpty().withMessage('Last name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
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
  body('username').notEmpty().withMessage('Username is required'),
  body('password').custom(customPasswordValidator()),
  body('paymentMethod').isIn(['directDeposit', 'check', 'paypal']).withMessage('Invalid payment method')
], affiliateController.registerAffiliate);

/**
 * @route   GET /api/affiliates/public/:affiliateCode
 * @desc    Get public affiliate information (for customer registration)
 * @access  Public
 */
router.get('/public/:affiliateCode', affiliateController.getPublicAffiliateInfo);

/**
 * @route   GET /api/affiliates/:affiliateId/public
 * @desc    Get public affiliate information by ID (for customer success page)
 * @access  Public
 */
router.get('/:affiliateId/public', affiliateController.getPublicAffiliateInfoById);

/**
 * @route   GET /api/affiliates/:affiliateId
 * @desc    Get affiliate profile
 * @access  Private (self or admin)
 */
router.get('/:affiliateId', authenticate, affiliateController.getAffiliateProfile);

/**
 * @route   PUT /api/affiliates/:affiliateId
 * @desc    Update affiliate profile
 * @access  Private (self or admin)
 */
router.put('/:affiliateId', authenticate, affiliateController.updateAffiliateProfile);

/**
 * @route   GET /api/affiliates/:affiliateId/earnings
 * @desc    Get affiliate earnings
 * @access  Private (self or admin)
 */
router.get('/:affiliateId/earnings', authenticate, affiliateController.getAffiliateEarnings);

/**
 * @route   GET /api/affiliates/:affiliateId/customers
 * @desc    Get affiliate customers
 * @access  Private (self or admin)
 */
router.get('/:affiliateId/customers', authenticate, paginationMiddleware, affiliateController.getAffiliateCustomers);

/**
 * @route   GET /api/affiliates/:affiliateId/orders
 * @desc    Get affiliate orders
 * @access  Private (self or admin)
 */
router.get('/:affiliateId/orders', authenticate, paginationMiddleware, affiliateController.getAffiliateOrders);

/**
 * @route   GET /api/affiliates/:affiliateId/transactions
 * @desc    Get affiliate transactions
 * @access  Private (self or admin)
 */
router.get('/:affiliateId/transactions', authenticate, paginationMiddleware, affiliateController.getAffiliateTransactions);

/**
 * @route   GET /api/affiliates/:affiliateId/dashboard
 * @desc    Get affiliate dashboard stats
 * @access  Private (self or admin)
 */
router.get('/:affiliateId/dashboard', authenticate, affiliateController.getAffiliateDashboardStats);

/**
 * @route   DELETE /api/affiliates/:affiliateId/delete-all-data
 * @desc    Delete all data for an affiliate (development/test only)
 * @access  Private (self only, development/test environments)
 */
router.delete('/:affiliateId/delete-all-data', authenticate, authorize(['affiliate']), affiliateController.deleteAffiliateData);

module.exports = router;