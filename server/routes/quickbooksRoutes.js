const express = require('express');
const router = express.Router();
const quickbooksController = require('../controllers/quickbooksController');
const { authenticate, authorize } = require('../middleware/auth');

/**
 * QuickBooks Export Routes
 * All routes require administrator authentication
 */

// Export all verified vendors (affiliates with W-9s) to QuickBooks format
router.get('/vendors', 
    authenticate, 
    authorize(['administrator']), 
    quickbooksController.exportVendors
);

// Export payment summary for a date range
router.get('/payment-summary',
    authenticate,
    authorize(['administrator']),
    quickbooksController.exportPaymentSummary
);

// Export detailed commission report for a specific affiliate
router.get('/commission-detail',
    authenticate,
    authorize(['administrator']),
    quickbooksController.exportCommissionDetail
);

// Get export history
router.get('/history',
    authenticate,
    authorize(['administrator']),
    quickbooksController.getExportHistory
);

module.exports = router;