// W-9 Document Routes for WaveMAX Laundry Affiliate Program

const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { body, param } = require('express-validator');
const w9ControllerDocuSign = require('../controllers/w9ControllerDocuSign');

// ===== DocuSign Routes =====

/**
 * @route   GET /api/v1/w9/check-auth
 * @desc    Check if DocuSign is authorized
 * @access  Private (Affiliate or Admin)
 */
router.get('/check-auth',
  authenticate,
  authorize(['affiliate', 'administrator']),
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
 * @access  Private (Affiliate or Admin)
 */
router.get('/authorization-status',
  authenticate,
  authorize(['affiliate', 'administrator']),
  w9ControllerDocuSign.checkAuthorizationStatus
);

// All legacy W9 upload/download routes have been removed
// W9 management is now exclusively handled through DocuSign integration

/**
 * @route   POST /api/w9/send-docusign
 * @desc    Send W-9 DocuSign envelope to affiliate (Admin only)
 * @access  Private (Admin)
 */
router.post('/send-docusign',
  authenticate,
  authorize(['administrator']),
  [
    body('affiliateId').notEmpty().withMessage('Affiliate ID is required')
  ],
  w9ControllerDocuSign.sendW9ToAffiliate
);


module.exports = router;