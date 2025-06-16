// DocuSign-enabled W9 Controller Methods
// These methods will replace the existing upload-based methods

const Affiliate = require('../models/Affiliate');
const W9Document = require('../models/W9Document');
const W9AuditLog = require('../models/W9AuditLog');
const docusignService = require('../services/docusignService');
const logger = require('../utils/logger');

/**
 * Initiate W9 signing with DocuSign
 * Replaces the manual upload process
 */
exports.initiateW9Signing = async (req, res) => {
  try {
    const affiliateId = req.user.affiliateId || req.user.id;
    
    // Get affiliate details
    const affiliate = await Affiliate.findById(affiliateId);
    if (!affiliate) {
      return res.status(404).json({ 
        error: 'Affiliate not found' 
      });
    }

    // Check if there's an existing envelope in progress
    if (affiliate.w9Information.docusignEnvelopeId && 
        affiliate.w9Information.docusignStatus === 'sent') {
      // Get the existing signing URL
      try {
        const signingUrl = await docusignService.getEmbeddedSigningUrl(
          affiliate.w9Information.docusignEnvelopeId,
          affiliate
        );
        
        return res.json({
          signingUrl,
          envelopeId: affiliate.w9Information.docusignEnvelopeId,
          message: 'Existing W9 signing session retrieved'
        });
      } catch (error) {
        // If we can't get the URL, create a new envelope
        logger.warn('Failed to retrieve existing envelope, creating new one:', error);
      }
    }

    // Create new DocuSign envelope
    const envelope = await docusignService.createW9Envelope(affiliate);
    
    // Get embedded signing URL
    const signingUrl = await docusignService.getEmbeddedSigningUrl(
      envelope.envelopeId,
      affiliate
    );

    // Update affiliate with envelope ID
    affiliate.w9Information.docusignEnvelopeId = envelope.envelopeId;
    affiliate.w9Information.docusignStatus = 'sent';
    affiliate.w9Information.status = 'pending_review';
    affiliate.w9Information.submittedAt = new Date();
    await affiliate.save();

    // Create audit log
    await W9AuditLog.create({
      affiliateId: affiliate._id,
      action: 'initiated',
      performedBy: affiliate._id,
      performerRole: 'affiliate',
      details: {
        method: 'docusign',
        envelopeId: envelope.envelopeId
      },
      ipAddress: req.ip
    });

    res.json({
      signingUrl,
      envelopeId: envelope.envelopeId,
      message: 'W9 signing session created successfully'
    });
  } catch (error) {
    logger.error('Failed to initiate W9 signing:', error);
    res.status(500).json({ 
      error: 'Failed to create W9 signing session' 
    });
  }
};

/**
 * Handle DocuSign webhook events
 */
exports.handleDocuSignWebhook = async (req, res) => {
  try {
    // Verify webhook signature
    const signature = req.headers['x-docusign-signature-1'];
    const payload = JSON.stringify(req.body);
    
    if (!docusignService.verifyWebhookSignature(payload, signature)) {
      logger.warn('Invalid DocuSign webhook signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Process the webhook event
    const event = req.body;
    const result = await docusignService.processWebhookEvent(event);

    // Find affiliate by envelope ID
    const affiliate = await Affiliate.findOne({
      'w9Information.docusignEnvelopeId': result.envelopeId
    });

    if (!affiliate) {
      logger.warn('No affiliate found for envelope:', result.envelopeId);
      return res.status(404).json({ error: 'Affiliate not found' });
    }

    // Update affiliate W9 information
    affiliate.w9Information.docusignStatus = result.docusignStatus;
    affiliate.w9Information.status = result.status;
    
    if (result.status === 'verified' && result.taxInfo) {
      // Update tax information from completed form
      affiliate.w9Information.taxIdType = result.taxInfo.taxIdType;
      affiliate.w9Information.taxIdLast4 = result.taxInfo.taxIdLast4;
      affiliate.w9Information.verifiedAt = new Date();
      affiliate.w9Information.verifiedBy = 'docusign-auto';
      
      if (result.taxInfo.businessName) {
        affiliate.w9Information.businessName = result.taxInfo.businessName;
      }

      // Download and store the completed W9
      try {
        const w9File = await docusignService.downloadCompletedW9(result.envelopeId);
        
        // Create W9Document record
        const w9Document = new W9Document({
          affiliateId: affiliate._id,
          filename: w9File.filename,
          contentType: w9File.contentType,
          uploadedAt: new Date(),
          fileSize: w9File.data.length,
          metadata: {
            docusignEnvelopeId: result.envelopeId,
            completedAt: result.completedAt
          }
        });

        // Store file data
        w9Document.data = w9File.data;
        await w9Document.save();

        affiliate.w9Information.documentId = w9Document._id;
      } catch (error) {
        logger.error('Failed to download completed W9:', error);
      }
    }

    await affiliate.save();

    // Create audit log
    await W9AuditLog.create({
      affiliateId: affiliate._id,
      action: `docusign_${event.event}`,
      performedBy: 'system',
      performerRole: 'system',
      details: {
        envelopeId: result.envelopeId,
        status: result.docusignStatus,
        event: event.event
      },
      ipAddress: req.ip
    });

    res.json({ 
      message: 'Webhook processed successfully',
      envelopeId: result.envelopeId 
    });
  } catch (error) {
    logger.error('Failed to process DocuSign webhook:', error);
    res.status(500).json({ 
      error: 'Failed to process webhook' 
    });
  }
};

/**
 * Get W9 signing status
 * Enhanced to include DocuSign status
 */
exports.getW9SigningStatus = async (req, res) => {
  try {
    const affiliateId = req.user.affiliateId || req.user.id;
    
    const affiliate = await Affiliate.findById(affiliateId)
      .select('w9Information firstName lastName email');
    
    if (!affiliate) {
      return res.status(404).json({ 
        error: 'Affiliate not found' 
      });
    }

    const response = {
      status: affiliate.w9Information.status || 'not_submitted',
      statusDisplay: affiliate.getW9StatusDisplay(),
      docusignStatus: affiliate.w9Information.docusignStatus,
      envelopeId: affiliate.w9Information.docusignEnvelopeId,
      submittedAt: affiliate.w9Information.submittedAt,
      verifiedAt: affiliate.w9Information.verifiedAt,
      rejectedAt: affiliate.w9Information.rejectedAt,
      rejectionReason: affiliate.w9Information.rejectionReason
    };

    // If verified, include masked tax info
    if (affiliate.w9Information.status === 'verified') {
      response.taxInfo = {
        taxIdType: affiliate.w9Information.taxIdType,
        taxIdLast4: affiliate.w9Information.taxIdLast4,
        businessName: affiliate.w9Information.businessName
      };
    }

    // If in progress, check current status with DocuSign
    if (affiliate.w9Information.docusignEnvelopeId && 
        ['sent', 'delivered'].includes(affiliate.w9Information.docusignStatus)) {
      try {
        const envelopeStatus = await docusignService.getEnvelopeStatus(
          affiliate.w9Information.docusignEnvelopeId
        );
        response.docusignStatus = envelopeStatus.status;
        response.lastChecked = new Date();
      } catch (error) {
        logger.warn('Failed to check envelope status:', error);
      }
    }

    res.json(response);
  } catch (error) {
    logger.error('Error getting W9 status:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve W9 status' 
    });
  }
};

/**
 * Cancel W9 signing request
 * Allows affiliates to void their current envelope
 */
exports.cancelW9Signing = async (req, res) => {
  try {
    const affiliateId = req.user.affiliateId || req.user.id;
    
    const affiliate = await Affiliate.findById(affiliateId);
    if (!affiliate) {
      return res.status(404).json({ 
        error: 'Affiliate not found' 
      });
    }

    if (!affiliate.w9Information.docusignEnvelopeId) {
      return res.status(400).json({ 
        error: 'No W9 signing in progress' 
      });
    }

    // Void the envelope in DocuSign
    await docusignService.voidEnvelope(
      affiliate.w9Information.docusignEnvelopeId,
      'Cancelled by affiliate'
    );

    // Reset W9 information
    affiliate.w9Information.status = 'not_submitted';
    affiliate.w9Information.docusignStatus = 'voided';
    affiliate.w9Information.docusignEnvelopeId = null;
    await affiliate.save();

    // Create audit log
    await W9AuditLog.create({
      affiliateId: affiliate._id,
      action: 'cancelled',
      performedBy: affiliate._id,
      performerRole: 'affiliate',
      details: {
        reason: 'Cancelled by affiliate'
      },
      ipAddress: req.ip
    });

    res.json({ 
      message: 'W9 signing cancelled successfully' 
    });
  } catch (error) {
    logger.error('Failed to cancel W9 signing:', error);
    res.status(500).json({ 
      error: 'Failed to cancel W9 signing' 
    });
  }
};

/**
 * Admin: Resend W9 signing request
 */
exports.resendW9Request = async (req, res) => {
  try {
    const { affiliateId } = req.params;
    
    const affiliate = await Affiliate.findById(affiliateId);
    if (!affiliate) {
      return res.status(404).json({ 
        error: 'Affiliate not found' 
      });
    }

    // Void existing envelope if any
    if (affiliate.w9Information.docusignEnvelopeId) {
      try {
        await docusignService.voidEnvelope(
          affiliate.w9Information.docusignEnvelopeId,
          'Resent by administrator'
        );
      } catch (error) {
        logger.warn('Failed to void existing envelope:', error);
      }
    }

    // Create new envelope
    const envelope = await docusignService.createW9Envelope(affiliate);

    // Update affiliate
    affiliate.w9Information.docusignEnvelopeId = envelope.envelopeId;
    affiliate.w9Information.docusignStatus = 'sent';
    affiliate.w9Information.status = 'pending_review';
    affiliate.w9Information.submittedAt = new Date();
    await affiliate.save();

    // Create audit log
    await W9AuditLog.create({
      affiliateId: affiliate._id,
      action: 'resent',
      performedBy: req.user.id,
      performerRole: 'administrator',
      details: {
        newEnvelopeId: envelope.envelopeId
      },
      ipAddress: req.ip
    });

    res.json({ 
      message: 'W9 request resent successfully',
      envelopeId: envelope.envelopeId
    });
  } catch (error) {
    logger.error('Failed to resend W9 request:', error);
    res.status(500).json({ 
      error: 'Failed to resend W9 request' 
    });
  }
};