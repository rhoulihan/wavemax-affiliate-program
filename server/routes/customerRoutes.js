// Customer Routes for WaveMAX Laundry Affiliate Program

const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');
const { authenticate, authorize } = require('../middleware/auth');
const { checkRole } = require('../middleware/rbac');
const { body } = require('express-validator');
const { customPasswordValidator } = require('../utils/passwordValidator');
const { registrationLimiter } = require('../middleware/rateLimiting');
const { profileAddressValidation, handleValidationErrors } = require('../middleware/locationValidation');

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
 * @access  Public (rate-limited globally; anti-enumeration)
 */
router.get('/claim/:bagToken', customerController.resolveClaim);

/**
 * @route   POST /api/v1/customers/claim/:bagToken/register
 * @desc    Register a new customer against an issued bag (affiliate derived from the bag)
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
  // Only require username/password if NOT using OAuth (no socialToken)
  body('username').custom((value, { req }) => {
    if (!req.body.socialToken && !value) {
      throw new Error('Username is required');
    }
    return true;
  }),
  body('password').custom((value, { req }) => {
    if (!req.body.socialToken) {
      return customPasswordValidator()(value, { req });
    }
    return true;
  })
], handleValidationErrors, customerController.claimRegister);


/**
 * @route   GET /api/customers/:customerId/profile
 * @desc    Get customer profile (public for success page, authenticated for full profile)
 * @access  Public (limited) / Private (full)
 */
router.get('/:customerId/profile', (req, res, next) => {
  // Try to authenticate if token is provided, but don't require it
  if (req.headers.authorization || req.headers['x-auth-token']) {
    authenticate(req, res, (err) => {
      if (err) {
        // Authentication failed, continue without user
        req.user = null;
      }
      next();
    });
  } else {
    next();
  }
}, customerController.getCustomerProfile);

/**
 * @route   GET /api/customers/:customerId
 * @desc    Get customer profile
 * @access  Private (self, affiliated affiliate, or admin)
 */
router.get('/:customerId', authenticate, customerController.getCustomerProfile);

/**
 * @route   PUT /api/customers/:customerId/profile
 * @desc    Update customer profile
 * @access  Private (self, affiliated affiliate, or admin)
 */
router.put('/:customerId/profile', 
  authenticate, 
  profileAddressValidation,
  handleValidationErrors,
  customerController.updateCustomerProfile
);

/**
 * @route   GET /api/customers/:customerId/orders
 * @desc    Get customer orders
 * @access  Private (self, affiliated affiliate, or admin)
 */
router.get('/:customerId/orders', authenticate, customerController.getCustomerOrders);

/**
 * @route   GET /api/customers/:customerId/dashboard
 * @desc    Get customer dashboard stats
 * @access  Private (self, affiliated affiliate, or admin)
 */
router.get('/:customerId/dashboard', authenticate, customerController.getCustomerDashboardStats);

/**
 * @route   PUT /api/customers/:customerId/password
 * @desc    Update customer password
 * @access  Private (self or admin)
 */
router.put('/:customerId/password', authenticate, [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').custom(customPasswordValidator())
], customerController.updateCustomerPassword);


// Payment information is now handled entirely by Paygistix
// No payment update endpoint needed

/**
 * @route   DELETE /api/customers/:customerId/delete-all-data
 * @desc    Delete all data for a customer (development/test only)
 * @access  Private (self only, development/test environments)
 */
router.delete('/:customerId/delete-all-data', authenticate, authorize(['customer']), customerController.deleteCustomerData);

/**
 * @route   GET /api/customers/admin/list
 * @desc    Get customers list for admin dashboard
 * @access  Admin only
 */
router.get('/admin/list', authenticate, checkRole(['administrator']), customerController.getCustomersForAdmin);

module.exports = router;