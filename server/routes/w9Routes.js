// W-9 Document Routes for WaveMAX Laundry Affiliate Program

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { authenticate, authorize } = require('../middleware/auth');
const { body, param } = require('express-validator');
const w9Controller = require('../controllers/w9Controller');
const w9ControllerDocuSign = require('../controllers/w9ControllerDocuSign');

// Configure multer for W-9 uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Only accept PDFs
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  }
});

// ===== DocuSign Routes =====

/**
 * @route   GET /api/v1/w9/check-auth
 * @desc    Check if DocuSign is authorized
 * @access  Private (Affiliate)
 */
router.get('/check-auth',
  authenticate,
  authorize(['affiliate']),
  w9ControllerDocuSign.checkDocuSignAuth
);

/**
 * @route   POST /api/v1/w9/initiate-signing
 * @desc    Initiate W-9 signing with DocuSign
 * @access  Private (Affiliate)
 */
router.post('/initiate-signing',
  authenticate,
  authorize(['affiliate']),
  w9ControllerDocuSign.initiateW9Signing
);

/**
 * @route   GET /api/v1/w9/envelope-status/:envelopeId
 * @desc    Check DocuSign envelope status
 * @access  Private (Affiliate)
 */
router.get('/envelope-status/:envelopeId',
  authenticate,
  authorize(['affiliate']),
  param('envelopeId').notEmpty().withMessage('Envelope ID is required'),
  w9ControllerDocuSign.getEnvelopeStatus
);

/**
 * @route   POST /api/v1/w9/docusign-webhook
 * @desc    Handle DocuSign webhook events
 * @access  Public (webhook endpoint)
 */
router.post('/docusign-webhook',
  express.raw({ type: 'application/json' }), // Raw body for signature verification
  w9ControllerDocuSign.handleDocuSignWebhook
);

/**
 * @route   GET /api/v1/w9/authorization-status
 * @desc    Check if DocuSign authorization is complete
 * @access  Private (Affiliate)
 */
router.get('/authorization-status',
  authenticate,
  authorize(['affiliate']),
  w9ControllerDocuSign.checkAuthorizationStatus
);

/**
 * @route   POST /api/w9/upload
 * @desc    Upload W-9 document for authenticated affiliate
 * @access  Private (Affiliate)
 */
router.post('/upload',
  authenticate,
  authorize(['affiliate']),
  upload.single('w9document'),
  w9Controller.uploadW9Document
);

/**
 * @route   GET /api/w9/status
 * @desc    Get W-9 status for authenticated affiliate
 * @access  Private (Affiliate)
 */
router.get('/status',
  authenticate,
  authorize(['affiliate']),
  w9Controller.getW9Status
);

/**
 * @route   GET /api/w9/download
 * @desc    Download own W-9 document
 * @access  Private (Affiliate)
 */
router.get('/download',
  authenticate,
  authorize(['affiliate']),
  w9Controller.downloadOwnW9
);

// ===== Admin Routes =====

/**
 * @route   GET /api/w9/admin/pending
 * @desc    Get all pending W-9 documents for review
 * @access  Private (Admin)
 */
router.get('/admin/pending',
  authenticate,
  authorize(['administrator']),
  w9Controller.getPendingW9Documents
);

/**
 * @route   GET /api/w9/admin/:documentId/download
 * @desc    Download W-9 document for review
 * @access  Private (Admin)
 */
router.get('/admin/:documentId/download',
  authenticate,
  authorize(['administrator']),
  param('documentId').notEmpty().withMessage('Document ID is required'),
  w9Controller.downloadW9ForReview
);

/**
 * @route   POST /api/w9/admin/:affiliateId/verify
 * @desc    Verify affiliate W-9 and update tax information
 * @access  Private (Admin)
 */
router.post('/admin/:affiliateId/verify',
  authenticate,
  authorize(['administrator']),
  [
    param('affiliateId').notEmpty().withMessage('Affiliate ID is required'),
    body('taxIdType').isIn(['SSN', 'EIN']).withMessage('Tax ID type must be SSN or EIN'),
    body('taxIdLast4').matches(/^\d{4}$/).withMessage('Tax ID last 4 must be exactly 4 digits'),
    body('businessName').optional().notEmpty().withMessage('Business name cannot be empty if provided'),
    body('quickbooksVendorId').optional().notEmpty().withMessage('QuickBooks vendor ID cannot be empty if provided'),
    body('notes').optional().isString()
  ],
  w9Controller.verifyW9Document
);

/**
 * @route   POST /api/w9/admin/:affiliateId/reject
 * @desc    Reject W-9 document
 * @access  Private (Admin)
 */
router.post('/admin/:affiliateId/reject',
  authenticate,
  authorize(['administrator']),
  [
    param('affiliateId').notEmpty().withMessage('Affiliate ID is required'),
    body('reason').notEmpty().withMessage('Rejection reason is required')
  ],
  w9Controller.rejectW9Document
);

/**
 * @route   GET /api/w9/admin/affiliates/:affiliateId/history
 * @desc    Get W-9 submission history for an affiliate
 * @access  Private (Admin)
 */
router.get('/admin/affiliates/:affiliateId/history',
  authenticate,
  authorize(['administrator']),
  param('affiliateId').notEmpty().withMessage('Affiliate ID is required'),
  w9Controller.getW9History
);

/**
 * @route   GET /api/w9/admin/audit-logs
 * @desc    Get audit logs for W-9 operations
 * @access  Private (Admin)
 */
router.get('/admin/audit-logs',
  authenticate,
  authorize(['administrator']),
  w9Controller.getAuditLogs
);

/**
 * @route   GET /api/w9/admin/audit-logs/export
 * @desc    Export audit logs as CSV or JSON
 * @access  Private (Admin)
 */
router.get('/admin/audit-logs/export',
  authenticate,
  authorize(['administrator']),
  w9Controller.exportAuditLogs
);

module.exports = router;