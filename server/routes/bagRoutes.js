// server/routes/bagRoutes.js
const express = require('express');
const router = express.Router();
const bagController = require('../controllers/bagController');
const { authenticate, authorize } = require('../middleware/auth');

/**
 * @route   POST /api/bags
 * @desc    Register a new bag
 * @access  Private (affiliate or admin)
 */
router.post('/', authenticate, authorize(['affiliate', 'admin']), bagController.createBag);

/**
 * @route   GET /api/bags/:bagId
 * @desc    Get bag details
 * @access  Private (involved customer, affiliate, or admin)
 */
router.get('/:bagId', authenticate, bagController.getBagById);

/**
 * @route   PUT /api/bags/:bagId/status
 * @desc    Update bag status
 * @access  Private (involved affiliate or admin)
 */
router.put('/:bagId/status', authenticate, authorize(['affiliate', 'admin']), bagController.updateBag);

/**
 * @route   GET /api/bags/barcode/:barcode
 * @desc    Get bag by barcode
 * @access  Private (affiliate or admin)
 */
router.get('/barcode/:barcode', authenticate, authorize(['affiliate', 'admin']), bagController.getBagById);

module.exports = router;