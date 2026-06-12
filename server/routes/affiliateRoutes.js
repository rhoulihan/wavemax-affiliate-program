// Affiliate Routes for WaveMAX Laundry Affiliate Program

const express = require('express');
const router = express.Router();
const affiliateController = require('../controllers/affiliateController');
const { authenticate, authorize } = require('../middleware/auth');
const { body } = require('express-validator');
const paginationMiddleware = require('../utils/paginationMiddleware');
const { customPasswordValidator } = require('../utils/passwordValidator');
const { registrationLimiter, sensitiveOperationLimiter } = require('../middleware/rateLimiting');
const { registrationAddressValidation, profileAddressValidation, handleValidationErrors } = require('../middleware/locationValidation');
const uploadW9 = require('../middleware/uploadW9');
const { fileUploadLimiter } = require('../middleware/rateLimiting');
const w9Controller = require('../modules/onboarding/w9Controller');

/**
 * @route   POST /api/affiliates/register
 * @desc    Register a new affiliate
 * @access  Public
 */
router.post('/register', registrationLimiter, uploadW9, [
  body('inviteToken').notEmpty().isString().withMessage('Invite token is required'),
  body('firstName').notEmpty().withMessage('First name is required'),
  body('lastName').notEmpty().withMessage('Last name is required'),
  // Email is OPTIONAL and IGNORED — the account email is forced from the invite.
  body('email').optional({ checkFalsy: true }).isEmail().withMessage('Valid email is required'),
  body('phone').notEmpty().withMessage('Phone number is required'),
  ...registrationAddressValidation,
  body('minimumDeliveryFee').optional().isNumeric().withMessage('Minimum delivery fee must be a number'),
  body('perBagDeliveryFee').optional().isNumeric().withMessage('Per-bag delivery fee must be a number'),
  body('username').notEmpty().withMessage('Username is required'),
  body('password').custom(customPasswordValidator()),
  body('paymentMethod').isIn(['check', 'paypal', 'venmo']).withMessage('Invalid payment method')
], handleValidationErrors, affiliateController.registerAffiliate);

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
router.put('/:affiliateId', 
  authenticate,
  profileAddressValidation,
  handleValidationErrors,
  affiliateController.updateAffiliateProfile
);

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

// Vendor delivery code (PR 9) — self/admin status + reset (reset returns
// the plaintext exactly once; CSRF enforced by default on the POST).
router.get('/:affiliateId/delivery-code', authenticate, affiliateController.getDeliveryCodeStatus);
router.post('/:affiliateId/delivery-code/reset', authenticate, sensitiveOperationLimiter, affiliateController.resetDeliveryCode);

/**
 * @route   GET /api/affiliates/:affiliateId/stats/ytd
 * @desc    Year-to-date earnings + revenue for this affiliate
 * @access  Private (self or admin)
 */
router.get('/:affiliateId/stats/ytd', authenticate, affiliateController.getAffiliateYtdStats);

/**
 * @route   DELETE /api/affiliates/:affiliateId/delete-all-data
 * @desc    Delete all data for an affiliate (development/test only)
 * @access  Private (self only, development/test environments)
 */
router.delete('/:affiliateId/delete-all-data', authenticate, authorize(['affiliate']), affiliateController.deleteAffiliateData);

/**
 * @route   POST /api/v1/affiliates/:affiliateId/w9
 * @desc    Upload (or re-upload) an encrypted W-9 — self affiliate or administrator
 * @access  Private (CSRF-enforced; multipart field 'w9'; fileUploadLimiter
 *          runs AFTER authenticate so its user-keyed keyGenerator sees req.user)
 */
router.post('/:affiliateId/w9', authenticate, fileUploadLimiter, uploadW9, w9Controller.uploadW9);

module.exports = router;