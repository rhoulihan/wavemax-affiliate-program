// Affiliate Routes for WaveMAX Laundry Affiliate Program

const express = require('express');
const router = express.Router();
const affiliateController = require('../controllers/affiliateController');
const { authenticate, authorize } = require('../middleware/auth');

/**
 * @route   POST /api/affiliates/register
 * @desc    Register a new affiliate
 * @access  Public
 */
router.post('/register', affiliateController.registerAffiliate);

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
router.get('/:affiliateId/customers', authenticate, affiliateController.getAffiliateCustomers);

/**
 * @route   GET /api/affiliates/:affiliateId/orders
 * @desc    Get affiliate orders
 * @access  Private (self or admin)
 */
router.get('/:affiliateId/orders', authenticate, affiliateController.getAffiliateOrders);

/**
 * @route   GET /api/affiliates/:affiliateId/transactions
 * @desc    Get affiliate transactions
 * @access  Private (self or admin)
 */
router.get('/:affiliateId/transactions', authenticate, affiliateController.getAffiliateTransactions);

/**
 * @route   GET /api/affiliates/:affiliateId/dashboard
 * @desc    Get affiliate dashboard stats
 * @access  Private (self or admin)
 */
router.get('/:affiliateId/dashboard', authenticate, affiliateController.getAffiliateDashboardStats);

module.exports = router;