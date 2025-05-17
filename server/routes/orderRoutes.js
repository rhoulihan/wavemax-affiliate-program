// Order Routes for WaveMAX Laundry Affiliate Program

const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { authenticate, authorize } = require('../middleware/auth');

/**
 * @route   POST /api/orders
 * @desc    Create a new order
 * @access  Private (customer, affiliate, or admin)
 */
router.post('/', authenticate, orderController.createOrder);

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