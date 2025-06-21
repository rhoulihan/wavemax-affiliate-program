// DocuSign-enabled W9 Controller Methods
// These methods will replace the existing upload-based methods

const Affiliate = require('../models/Affiliate');
const W9Document = require('../models/W9Document');
const W9AuditLog = require('../models/W9AuditLog');
const docusignService = require('../services/docusignService');
const logger = require('../utils/logger');

/**
 * Check if DocuSign is authorized
 */
exports.checkDocuSignAuth = async (req, res) => {
  try {
    // Try to get access token
    const hasValidToken = await docusignService.hasValidToken();

    if (hasValidToken) {
      return res.json({ authorized: true });
    }

    // Generate authorization URL
    const authData = await docusignService.getAuthorizationUrl();

    res.json({
      authorized: false,
      authorizationUrl: authData.url,
      state: authData.state
    });
  } catch (error) {
    logger.error('Failed to check DocuSign auth:', error);
    res.status(500).json({
      error: 'Failed to check authorization status'
    });
  }
};

/**
 * Handle DocuSign OAuth callback
 */
exports.handleOAuthCallback = async (req, res) => {
  try {
    const { code, state } = req.query;

    if (!code) {
      return res.status(400).json({
        error: 'Authorization code not provided'
      });
    }

    if (!state) {
      return res.status(400).json({
        error: 'State parameter not provided'
      });
    }

    // Exchange code for token (passing state to retrieve PKCE verifier)
    const tokenData = await docusignService.exchangeCodeForToken(code, state);

    logger.info('OAuth callback - token exchange completed', {
      hasAccessToken: !!tokenData.access_token,
      hasRefreshToken: !!tokenData.refresh_token
    });

    // Return success page
    res.send(`
      <html>
        <head>
          <title>DocuSign Authorization</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
            h2 { color: #28a745; }
            p { color: #666; }
          </style>
        </head>
        <body>
          <h2>DocuSign Authorization Successful!</h2>
          <p>You can now close this window and return to the application.</p>
          <script>
            console.log('OAuth callback page loaded');
            console.log('window.opener:', window.opener);
            
            // Try multiple methods to notify the parent
            try {
              // Store auth success in localStorage for fallback
              localStorage.setItem('docusign-auth-success', JSON.stringify({
                success: true,
                state: '${state}',
                timestamp: Date.now()
              }));
              
              // Method 1: Direct opener
              if (window.opener && !window.opener.closed) {
                console.log('Posting message to opener');
                window.opener.postMessage({ 
                  type: 'docusign-auth-success',
                  state: '${state}'
                }, 'https://wavemax.promo');
                
                // Also try wildcard
                window.opener.postMessage({ 
                  type: 'docusign-auth-success',
                  state: '${state}'
                }, '*');
              }
              
              // Method 2: Try parent
              if (window.parent && window.parent !== window) {
                console.log('Posting message to parent');
                window.parent.postMessage({ 
                  type: 'docusign-auth-success',
                  state: '${state}'
                }, 'https://wavemax.promo');
              }
              
              // Method 3: Try top window (for deeply nested iframes)
              if (window.top && window.top !== window) {
                console.log('Posting message to top');
                window.top.postMessage({ 
                  type: 'docusign-auth-success',
                  state: '${state}'
                }, 'https://wavemax.promo');
              }
              
            } catch (e) {
              console.error('Failed to post message:', e);
            }
            
            // Close window after delay
            setTimeout(() => {
              console.log('Closing window');
              window.close();
            }, 2000);
          </script>
        </body>
      </html>
    `);
  } catch (error) {
    logger.error('OAuth callback error:', error);
    res.status(500).send(`
      <html>
        <head>
          <title>DocuSign Authorization Failed</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
            h2 { color: #dc3545; }
            p { color: #666; }
            .error { background: #f8d7da; border: 1px solid #f5c6cb; color: #721c24; padding: 10px; border-radius: 4px; margin: 20px auto; max-width: 500px; }
          </style>
        </head>
        <body>
          <h2>Authorization Failed</h2>
          <div class="error">
            <p>Error: ${error.message}</p>
          </div>
          <p>Please close this window and try again.</p>
        </body>
      </html>
    `);
  }
};

/**
 * Initiate W9 signing with DocuSign
 * Replaces the manual upload process
 */
exports.initiateW9Signing = async (req, res) => {
  try {
    const affiliateId = req.user.affiliateId || req.user.id;

    // Get affiliate details using affiliateId field
    const affiliate = await Affiliate.findOne({ affiliateId: affiliateId });
    if (!affiliate) {
      return res.status(404).json({
        error: 'Affiliate not found'
      });
    }

    // Check if DocuSign is authorized
    const hasToken = await docusignService.hasValidToken();
    if (!hasToken) {
      // Generate authorization URL
      const authData = await docusignService.getAuthorizationUrl();
      return res.status(401).json({
        error: 'DocuSign authorization required',
        authorizationUrl: authData.url,
        state: authData.state
      });
    }

    // Check if there's an existing envelope in progress
    if (affiliate.w9Information &&
        affiliate.w9Information.docusignEnvelopeId &&
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

    // Create new DocuSign envelope with embedded signing for affiliate-initiated
    const envelope = await docusignService.createW9Envelope(affiliate, true);

    // Get embedded signing URL
    const signingUrl = await docusignService.getEmbeddedSigningUrl(
      envelope.envelopeId,
      affiliate
    );

    // Update affiliate with envelope ID - but don't change status yet
    if (!affiliate.w9Information) {
      affiliate.w9Information = {};
    }
    affiliate.w9Information.docusignEnvelopeId = envelope.envelopeId;
    affiliate.w9Information.docusignStatus = 'sent';
    // Don't change the status until the document is actually signed
    // affiliate.w9Information.status remains as 'not_submitted' or current status
    affiliate.w9Information.docusignInitiatedAt = new Date();
    affiliate.markModified('w9Information');
    await affiliate.save();

    // Create audit log
    await W9AuditLog.create({
      action: 'upload_attempt',  // Using existing action enum value
      performedBy: {
        userId: affiliate._id.toString(),
        userType: 'affiliate',
        userEmail: affiliate.email,
        userName: `${affiliate.firstName} ${affiliate.lastName}`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      },
      target: {
        affiliateId: affiliate.affiliateId,
        affiliateName: `${affiliate.firstName} ${affiliate.lastName}`
      },
      details: {
        method: 'docusign',
        envelopeId: envelope.envelopeId,
        success: true
      }
    });

    res.json({
      signingUrl,
      envelopeId: envelope.envelopeId,
      message: 'W9 signing session created successfully'
    });
  } catch (error) {
    console.error('Failed to initiate W9 signing:', error);
    logger.error('Failed to initiate W9 signing:', error);
    res.status(500).json({
      error: 'Failed to create W9 signing session',
      details: error.message
    });
  }
};

/**
 * Get envelope status for polling
 */
exports.getEnvelopeStatus = async (req, res) => {
  try {
    const { envelopeId } = req.params;
    const affiliateId = req.user.affiliateId || req.user.id;

    // Get affiliate to check if they own this envelope
    const affiliate = await Affiliate.findOne({ affiliateId: affiliateId });
    if (!affiliate) {
      return res.status(404).json({ error: 'Affiliate not found' });
    }

    // Check if w9Information exists
    if (!affiliate.w9Information) {
      console.log('No w9Information found for affiliate:', affiliateId);
      return res.status(404).json({ error: 'No W9 information found' });
    }

    // Verify this envelope belongs to the affiliate
    if (!affiliate.w9Information.docusignEnvelopeId || affiliate.w9Information.docusignEnvelopeId !== envelopeId) {
      console.log('Envelope mismatch:', {
        expected: affiliate.w9Information.docusignEnvelopeId,
        received: envelopeId
      });
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Get envelope status from DocuSign
    try {
      const envelopeStatus = await docusignService.getEnvelopeStatus(envelopeId);

      // Update local status if it has changed
      if (envelopeStatus.status !== affiliate.w9Information.docusignStatus) {
        affiliate.w9Information.docusignStatus = envelopeStatus.status;

        // Update affiliate status based on DocuSign status
        if (envelopeStatus.status === 'completed') {
          affiliate.w9Information.status = 'pending_review';
          affiliate.w9Information.submittedAt = new Date();
        } else if (envelopeStatus.status === 'declined' || envelopeStatus.status === 'voided') {
          affiliate.w9Information.status = 'not_submitted';
          // Clear the envelope ID if declined/voided
          affiliate.w9Information.docusignEnvelopeId = null;
          affiliate.w9Information.docusignStatus = null;
        }

        affiliate.markModified('w9Information');
        await affiliate.save();
      }

      res.json({
        envelopeId: envelopeId,
        status: envelopeStatus.status
      });
    } catch (error) {
      // If DocuSign API fails, return local status
      logger.warn('Failed to get envelope status from DocuSign:', error);
      res.json({
        envelopeId: envelopeId,
        status: affiliate.w9Information.docusignStatus || 'sent'
      });
    }
  } catch (error) {
    console.error('Failed to get envelope status:', error);
    logger.error('Failed to get envelope status:', error);
    res.status(500).json({
      error: 'Failed to get envelope status'
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
      // verifiedBy is left empty for automatic DocuSign verification

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

    affiliate.markModified('w9Information');
    await affiliate.save();

    // Create audit log
    await W9AuditLog.create({
      action: 'upload_success',  // Using existing enum value
      performedBy: {
        userId: 'system',
        userType: 'system',
        userEmail: 'system@docusign',
        userName: 'DocuSign System',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      },
      target: {
        affiliateId: affiliate.affiliateId,
        affiliateName: `${affiliate.firstName} ${affiliate.lastName}`
      },
      details: {
        success: true,
        envelopeId: result.envelopeId,
        status: result.docusignStatus,
        event: event.event
      }
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
      action: 'delete',  // Using existing enum value
      performedBy: {
        userId: affiliate._id.toString(),
        userType: 'affiliate',
        userEmail: affiliate.email,
        userName: `${affiliate.firstName} ${affiliate.lastName}`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      },
      target: {
        affiliateId: affiliate.affiliateId,
        affiliateName: `${affiliate.firstName} ${affiliate.lastName}`
      },
      details: {
        success: true,
        errorMessage: 'Cancelled by affiliate'
      }
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
      action: 'upload_attempt',  // Using existing enum value
      performedBy: {
        userId: req.user.id,
        userType: 'administrator',
        userEmail: req.user.email,
        userName: req.user.name || 'Administrator',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      },
      target: {
        affiliateId: affiliate.affiliateId,
        affiliateName: `${affiliate.firstName} ${affiliate.lastName}`
      },
      details: {
        success: true,
        method: 'docusign-resent',
        envelopeId: envelope.envelopeId
      }
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

/**
 * Check authorization status endpoint
 * This is called by the client after OAuth callback to verify authorization
 */
exports.checkAuthorizationStatus = async (req, res) => {
  try {
    // Check if we have a valid token
    const hasToken = await docusignService.hasValidToken();

    res.json({
      authorized: hasToken,
      message: hasToken ? 'DocuSign authorization successful' : 'Not authorized'
    });
  } catch (error) {
    logger.error('Failed to check authorization status:', error);
    res.status(500).json({
      error: 'Failed to check authorization status'
    });
  }
};

/**
 * Admin: Send W-9 DocuSign envelope to affiliate
 */
exports.sendW9ToAffiliate = async (req, res) => {
  try {
    const { affiliateId } = req.body;
    const adminId = req.user.id;

    // Find affiliate
    const affiliate = await Affiliate.findOne({ affiliateId });
    if (!affiliate) {
      return res.status(404).json({
        success: false,
        message: 'Affiliate not found'
      });
    }

    // Check if affiliate already has a pending or completed W9
    if (affiliate.w9Information && 
        (affiliate.w9Information.status === 'verified' || 
         affiliate.w9Information.status === 'submitted')) {
      return res.status(400).json({
        success: false,
        message: 'Affiliate already has a submitted or verified W9'
      });
    }

    // Create and send DocuSign envelope
    const envelope = await docusignService.createW9Envelope(affiliate);

    // Update affiliate W9 information
    if (!affiliate.w9Information) {
      affiliate.w9Information = {};
    }
    affiliate.w9Information.status = 'pending_review';
    affiliate.w9Information.docusignEnvelopeId = envelope.envelopeId;
    affiliate.w9Information.docusignStatus = 'sent';
    affiliate.w9Information.submittedAt = new Date();
    affiliate.w9Information.docusignInitiatedAt = new Date();
    await affiliate.save();

    // Create audit log
    await W9AuditLog.create({
      action: 'upload_attempt',
      performedBy: {
        userId: adminId,
        userType: 'administrator',
        userEmail: req.user.email,
        userName: `${req.user.firstName} ${req.user.lastName}`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      },
      target: {
        affiliateId: affiliate.affiliateId,
        affiliateName: `${affiliate.firstName} ${affiliate.lastName}`
      },
      details: {
        method: 'docusign',
        envelopeId: envelope.envelopeId,
        sentBy: 'administrator',
        success: true
      }
    });

    res.json({
      success: true,
      message: 'W9 form sent successfully',
      envelopeId: envelope.envelopeId
    });

  } catch (error) {
    logger.error('Failed to send W9 to affiliate:', error);
    
    // Check if it's an authentication issue
    if (error.message.includes('authorization required') || error.message.includes('No valid access token')) {
      return res.status(401).json({
        success: false,
        message: 'DocuSign authorization required. Please authorize DocuSign integration in settings.',
        error: 'Authorization required'
      });
    }
    
    // Check if it's a template issue
    if (error.message.includes('template')) {
      return res.status(400).json({
        success: false,
        message: 'DocuSign template not configured. Please check W9 template ID in settings.',
        error: 'Template configuration error'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to send W9 form',
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};