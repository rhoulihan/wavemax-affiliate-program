// Order Routes for WaveMAX Laundry Affiliate Program

const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { authenticate, authorize } = require('../middleware/auth');
const { checkRole } = require('../middleware/rbac');
const { body } = require('express-validator');

/**
 * @route   GET /api/orders/export
 * @desc    Export orders in various formats
 * @access  Private (affiliate or admin)
 */
router.get('/export', authenticate, orderController.exportOrders);

/**
 * @route   GET /api/orders/search
 * @desc    Search orders
 * @access  Private (affiliate or admin)
 */
router.get('/search', authenticate, orderController.searchOrders);

/**
 * @route   GET /api/orders/statistics
 * @desc    Get order statistics
 * @access  Private (affiliate or admin)
 */
router.get('/statistics', authenticate, orderController.getOrderStatistics);

/**
 * @route   PUT /api/orders/bulk/status
 * @desc    Bulk update order status
 * @access  Private (affiliate or admin)
 */
router.put('/bulk/status', authenticate, [
  body('orderIds').isArray().withMessage('Order IDs must be an array'),
  body('status').isIn(['processed', 'picked_up', 'delivered', 'cancelled']).withMessage('Invalid status')
], orderController.bulkUpdateOrderStatus);

/**
 * @route   POST /api/orders/bulk/cancel
 * @desc    Bulk cancel orders
 * @access  Private (affiliate or admin)
 */
router.post('/bulk/cancel', authenticate, [
  body('orderIds').isArray().withMessage('Order IDs must be an array')
], orderController.bulkCancelOrders);

/**
 * @route   GET /api/orders/:orderId
 * @desc    Get order details
 * @access  Private (involved customer, affiliate, or admin)
 */
router.get('/:orderId', authenticate, orderController.getOrderDetails);

/**
 * @route   GET /api/orders/:orderId/bags
 * @desc    Get bags for an order (for label printing)
 * @access  Private (operator, affiliate, or admin)
 */

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

/**
 * @route   PUT /api/orders/:orderId/payment-status
 * @desc    Update payment status
 * @access  Private (affiliate or admin)
 */
router.put('/:orderId/payment-status', authenticate, [
  body('paymentStatus').isIn(['pending', 'awaiting', 'confirming', 'verified', 'failed']).withMessage('Invalid payment status')
], orderController.updatePaymentStatus);

/**
 * @route   POST /api/orders/confirm-payment
 * @desc    Customer confirms they have already paid
 * @access  Public (with order validation)
 */
router.post('/confirm-payment', [
  body('orderId').notEmpty().withMessage('Order ID is required'),
  body('paymentMethod').optional().isIn(['venmo', 'paypal', 'cashapp']).withMessage('Invalid payment method')
], orderController.confirmPayment);

/**
 * @route   PUT /api/orders/:orderId/verify-payment
 * @desc    Manually verify payment (admin only)
 * @access  Private (admin only)
 */
router.put('/:orderId/verify-payment', authenticate, checkRole(['admin', 'administrator']), [
  body('transactionId').optional(),
  body('notes').optional()
], orderController.verifyPaymentManually);

module.exports = router;