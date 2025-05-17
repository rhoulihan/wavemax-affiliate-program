// Bag Routes for WaveMAX Laundry Affiliate Program

const express = require('express');
const router = express.Router();
const bagController = require('../controllers/bagController');
const { authenticate, authorize } = require('../middleware/auth');

/**
 * @route   POST /api/bags
 * @desc    Register a new bag
 * @access  Private (affiliate or admin)
 */
router.post('/', authenticate, authorize(['affiliate', 'admin']), bagController.registerBag);

/**
 * @route   GET /api/bags/:bagId
 * @desc    Get bag details
 * @access  Private (involved customer, affiliate, or admin)
 */
router.get('/:bagId', authenticate, bagController.getBagDetails);

/**
 * @route   PUT /api/bags/:bagId/status
 * @desc    Update bag status
 * @access  Private (involved affiliate or admin)
 */
router.put('/:bagId/status', authenticate, authorize(['affiliate', 'admin']), bagController.updateBagStatus);

/**
 * @route   GET /api/bags/barcode/:barcode
 * @desc    Get bag by barcode
 * @access  Private (affiliate or admin)
 */
router.get('/barcode/:barcode', authenticate, authorize(['affiliate', 'admin']), bagController.getBagByBarcode);

module.exports = router;