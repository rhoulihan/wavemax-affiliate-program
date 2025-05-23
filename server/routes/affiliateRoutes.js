// Affiliate Routes for WaveMAX Laundry Affiliate Program

const express = require('express');
const router = express.Router();
const affiliateController = require('../controllers/affiliateController');
const { authenticate, authorize } = require('../middleware/auth');
const { body } = require('express-validator');
const paginationMiddleware = require('../utils/paginationMiddleware');

/**
 * @route   POST /api/affiliates/register
 * @desc    Register a new affiliate
 * @access  Public
 */
router.post('/register', [
  body('firstName').notEmpty().withMessage('First name is required'),
  body('lastName').notEmpty().withMessage('Last name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('phone').notEmpty().withMessage('Phone number is required'),
  body('address').notEmpty().withMessage('Address is required'),
  body('city').notEmpty().withMessage('City is required'),
  body('state').notEmpty().withMessage('State is required'),
  body('zipCode').notEmpty().withMessage('ZIP code is required'),
  body('serviceArea').notEmpty().withMessage('Service area is required'),
  body('deliveryFee').isNumeric().withMessage('Delivery fee must be a number'),
  body('username').notEmpty().withMessage('Username is required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters long'),
  body('paymentMethod').isIn(['directDeposit', 'check', 'paypal']).withMessage('Invalid payment method')
], affiliateController.registerAffiliate);

/**
 * @route   GET /api/affiliates/:affiliateId/public
 * @desc    Get public affiliate information (for customer registration)
 * @access  Public
 */
router.get('/:affiliateId/public', affiliateController.getPublicAffiliateInfo);

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

module.exports = router;