// Customer Routes for WaveMAX Laundry Affiliate Program

const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');
const { authenticate, authorize } = require('../middleware/auth');

/**
 * @route   POST /api/customers/register
 * @desc    Register a new customer
 * @access  Public
 */
router.post('/register', customerController.registerCustomer);

/**
 * @route   GET /api/customers/:customerId
 * @desc    Get customer profile
 * @access  Private (self, affiliated affiliate, or admin)
 */
router.get('/:customerId', authenticate, customerController.getCustomerProfile);

/**
 * @route   PUT /api/customers/:customerId
 * @desc    Update customer profile
 * @access  Private (self, affiliated affiliate, or admin)
 */
router.put('/:customerId', authenticate, customerController.updateCustomerProfile);

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
 * @route   POST /api/customers/:customerId/bags/:bagId/report-lost
 * @desc    Report a lost bag
 * @access  Private (self, affiliated affiliate, or admin)
 */
router.post('/:customerId/bags/:bagId/report-lost', authenticate, customerController.reportLostBag);

module.exports = router;