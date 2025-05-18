// Order Routes for WaveMAX Laundry Affiliate Program

const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { authenticate, authorize } = require('../middleware/auth');
const { body } = require('express-validator');

/**
 * @route   POST /api/orders
 * @desc    Create a new order
 * @access  Private (customer, affiliate, or admin)
 */
router.post('/', [
  body('customerId').notEmpty().withMessage('Customer ID is required'),
  body('affiliateId').notEmpty().withMessage('Affiliate ID is required'),
  body('pickupDate').isISO8601().withMessage('Valid pickup date is required'),
  body('pickupTime').isIn(['morning', 'afternoon', 'evening']).withMessage('Invalid pickup time'),
  body('estimatedSize').isIn(['small', 'medium', 'large']).withMessage('Invalid size'),
  body('deliveryDate').isISO8601().withMessage('Valid delivery date is required'),
  body('deliveryTime').isIn(['morning', 'afternoon', 'evening']).withMessage('Invalid delivery time')
], authenticate, orderController.createOrder);

/**
 * @route   GET /api/orders/:orderId
 * @desc    Get order details
 * @access  Private (involved customer, affiliate, or admin)
 */
router.get('/:orderId', authenticate, orderController.getOrderDetails);

/**
 * @route   PUT /api/orders/:orderId/status
 * @desc    Update order status
 * @access  Private (affiliate or admin)
 */
router.put('/:orderId/status', authenticate, orderController.updateOrderStatus);

/**
 * @route   POST /api/orders/:orderId/cancel
 * @desc    Cancel order
 * @access  Private (involved customer, affiliate, or admin)
 */
router.post('/:orderId/cancel', authenticate, orderController.cancelOrder);

module.exports = router;