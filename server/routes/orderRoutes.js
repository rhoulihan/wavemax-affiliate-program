// Order Routes for WaveMAX Laundry Affiliate Program

const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { authenticate } = require('../middleware/auth');
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
  body('status').isIn(['in_progress', 'out_for_delivery', 'complete', 'cancelled']).withMessage('Invalid status')
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

module.exports = router;