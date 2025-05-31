// server/routes/bagRoutes.js
const express = require('express');
const router = express.Router();
const bagController = require('../controllers/bagController');
const { authenticate } = require('../middleware/auth');
const { checkRole } = require('../middleware/rbac');

/**
 * @route   GET /api/bags
 * @desc    Get all bags (filtered by user role)
 * @access  Private (customer, affiliate, or admin)
 */
router.get('/', authenticate, bagController.getAllBags);

/**
 * @route   POST /api/bags
 * @desc    Create a new bag
 * @access  Private (customer, affiliate or admin)
 */
router.post('/', authenticate, checkRole(['customer', 'affiliate', 'administrator']), bagController.createBag);

/**
 * @route   GET /api/bags/search
 * @desc    Search bags by tag number
 * @access  Private (affiliate, operator or admin)
 */
router.get('/search', authenticate, checkRole(['affiliate', 'operator', 'administrator']), bagController.searchBags);

/**
 * @route   GET /api/bags/barcode/:barcode
 * @desc    Get bag by barcode
 * @access  Private (affiliate or admin)
 */
router.get('/barcode/:barcode', authenticate, checkRole(['affiliate', 'administrator']), bagController.getBagByBarcode);

/**
 * @route   GET /api/bags/:id
 * @desc    Get bag details
 * @access  Private (involved customer, affiliate, or admin)
 */
router.get('/:id', authenticate, bagController.getBagById);

/**
 * @route   PATCH /api/bags/:id
 * @desc    Update bag details
 * @access  Private (affiliate, operator or admin)
 */
router.patch('/:id', authenticate, checkRole(['affiliate', 'operator', 'administrator']), bagController.updateBag);

/**
 * @route   DELETE /api/bags/:id
 * @desc    Delete bag
 * @access  Private (admin only)
 */
router.delete('/:id', authenticate, checkRole(['administrator']), bagController.deleteBag);

/**
 * @route   POST /api/bags/:id/report-lost
 * @desc    Report bag as lost
 * @access  Private (customer, affiliate or admin)
 */
router.post('/:id/report-lost', authenticate, checkRole(['customer', 'affiliate', 'administrator']), bagController.reportLostBag);

/**
 * @route   PATCH /api/bags/:id/report
 * @desc    Report bag as lost or damaged
 * @access  Private (customer, affiliate or admin)
 */
router.patch('/:id/report', authenticate, checkRole(['customer', 'affiliate', 'administrator']), bagController.reportBag);

module.exports = router;