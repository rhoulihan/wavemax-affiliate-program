// Customer Routes for WaveMAX Laundry Affiliate Program

const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');
const { authenticate, authorize } = require('../middleware/auth');
const { checkRole } = require('../middleware/rbac');
const { body } = require('express-validator');
const { customPasswordValidator } = require('../utils/passwordValidator');

/**
 * @route   POST /api/customers/register
 * @desc    Register a new customer
 * @access  Public
 */
router.post('/register', [
  body('affiliateId').notEmpty().withMessage('Affiliate ID is required'),
  body('firstName').notEmpty().withMessage('First name is required'),
  body('lastName').notEmpty().withMessage('Last name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('phone').notEmpty().withMessage('Phone number is required'),
  body('address').notEmpty().withMessage('Address is required'),
  body('city').notEmpty().withMessage('City is required'),
  body('state').notEmpty().withMessage('State is required'),
  body('zipCode').notEmpty().withMessage('ZIP code is required'),
  body('username').notEmpty().withMessage('Username is required'),
  body('password').custom(customPasswordValidator())
], customerController.registerCustomer);


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
router.put('/:customerId/profile', authenticate, customerController.updateCustomerProfile);

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



/**
 * @route   PUT /api/customers/:customerId/payment
 * @desc    Update customer payment information
 * @access  Private (self or admin)
 */
router.put('/:customerId/payment', authenticate, [
  body('cardholderName').notEmpty().withMessage('Cardholder name is required'),
  body('cardNumber').notEmpty().withMessage('Card number is required'),
  body('expiryDate').notEmpty().withMessage('Expiry date is required'),
  body('billingZip').notEmpty().withMessage('Billing ZIP code is required')
], customerController.updatePaymentInfo);

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