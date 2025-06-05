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
  body('numberOfBags').isInt({ min: 1 }).withMessage('Number of bags must be at least 1'),
  body('estimatedWeight').isFloat({ min: 0.1 }).withMessage('Estimated weight must be a positive number'),
  body('deliveryDate').isISO8601().withMessage('Valid delivery date is required'),
  body('deliveryTime').isIn(['morning', 'afternoon', 'evening']).withMessage('Invalid delivery time')
], authenticate, orderController.createOrder);

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
  body('status').isIn(['scheduled', 'picked_up', 'processing', 'ready_for_delivery', 'delivered', 'cancelled']).withMessage('Invalid status')
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
  body('paymentStatus').isIn(['pending', 'paid', 'failed', 'refunded']).withMessage('Invalid payment status')
], orderController.updatePaymentStatus);

module.exports = router;