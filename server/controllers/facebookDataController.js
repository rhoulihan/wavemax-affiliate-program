const DataDeletionRequest = require('../models/DataDeletionRequest');
const { 
  parseSignedRequest, 
  generateStatusUrl, 
  deleteFacebookData,
  findUsersByFacebookId,
  anonymizeUserData
} = require('../utils/facebookUtils');
const logger = require('../utils/logger');
const { logUserAction } = require('./administratorController');

/**
 * Handle Facebook data deletion callback
 * POST /api/auth/facebook/deletion-callback
 */
exports.handleDeletionCallback = async (req, res) => {
  try {
    const { signed_request } = req.body;
    
    if (!signed_request) {
      logger.error('Facebook deletion callback: missing signed_request');
      return res.status(400).json({ 
        error: 'Missing signed_request parameter' 
      });
    }

    // Get Facebook app secret from environment
    const appSecret = process.env.FACEBOOK_APP_SECRET;
    if (!appSecret) {
      logger.error('Facebook app secret not configured');
      return res.status(500).json({ 
        error: 'Server configuration error' 
      });
    }

    // Parse and verify the signed request
    const payload = parseSignedRequest(signed_request, appSecret);
    if (!payload) {
      logger.error('Invalid signed request received');
      return res.status(400).json({ 
        error: 'Invalid signed request' 
      });
    }

    const { user_id: facebookUserId } = payload;
    if (!facebookUserId) {
      logger.error('No user_id in signed request payload');
      return res.status(400).json({ 
        error: 'Invalid request payload' 
      });
    }

    // Generate confirmation code
    const confirmationCode = DataDeletionRequest.generateConfirmationCode();

    // Find users associated with this Facebook ID
    const { affiliate, customer } = await findUsersByFacebookId(facebookUserId);
    
    let userType;
    if (affiliate && customer) {
      userType = 'both';
    } else if (affiliate) {
      userType = 'affiliate';
    } else if (customer) {
      userType = 'customer';
    } else {
      // No users found - still need to create a deletion request for tracking
      userType = 'affiliate'; // Default to affiliate for "no user found" cases
    }

    // Create deletion request record
    const deletionRequest = new DataDeletionRequest({
      facebookUserId,
      confirmationCode,
      status: 'pending',
      userType,
      affectedUsers: {
        affiliateId: affiliate ? affiliate._id : null,
        customerId: customer ? customer._id : null
      },
      signedRequest: signed_request,
      requestIp: req.ip,
      metadata: {
        userAgent: req.get('user-agent'),
        algorithm: payload.algorithm,
        issuedAt: payload.issued_at
      }
    });

    await deletionRequest.save();

    // Process deletion immediately
    await processDeletion(deletionRequest);

    // Generate status URL
    const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
    const statusUrl = generateStatusUrl(confirmationCode, baseUrl);

    // Log the deletion request
    logger.info('Facebook data deletion request received', {
      facebookUserId,
      confirmationCode,
      userType,
      hasAffiliate: !!affiliate,
      hasCustomer: !!customer
    });

    // Return required response format
    res.json({
      url: statusUrl,
      confirmation_code: confirmationCode
    });

  } catch (error) {
    logger.error('Error handling Facebook deletion callback:', error);
    res.status(500).json({ 
      error: 'Internal server error' 
    });
  }
};

/**
 * Process the data deletion request
 * @param {Object} deletionRequest - DataDeletionRequest model instance
 */
async function processDeletion(deletionRequest) {
  try {
    await deletionRequest.markAsProcessing();

    const deletedData = [];
    const completedActions = [];
    const errors = [];

    // Find and process users
    const { affiliate, customer } = await findUsersByFacebookId(
      deletionRequest.facebookUserId
    );

    // Process affiliate account
    if (affiliate) {
      try {
        const affiliateDeleted = await deleteFacebookData(affiliate);
        deletedData.push(...affiliateDeleted.map(d => `affiliate_${d}`));
        completedActions.push('Deleted Facebook data from affiliate account');
        
        // Log action (Note: req is not available in this context)
        logger.info('Facebook data deleted for affiliate', {
          affiliateId: affiliate._id,
          action: 'facebook_data_deleted'
        });
      } catch (error) {
        logger.error('Error deleting affiliate Facebook data:', error);
        errors.push(`Failed to delete affiliate data: ${error.message}`);
      }
    }

    // Process customer account
    if (customer) {
      try {
        const customerDeleted = await deleteFacebookData(customer);
        deletedData.push(...customerDeleted.map(d => `customer_${d}`));
        completedActions.push('Deleted Facebook data from customer account');
        
        // Log action (Note: req is not available in this context)
        logger.info('Facebook data deleted for customer', {
          customerId: customer._id,
          action: 'facebook_data_deleted'
        });
      } catch (error) {
        logger.error('Error deleting customer Facebook data:', error);
        errors.push(`Failed to delete customer data: ${error.message}`);
      }
    }

    // Mark as completed or failed
    if (errors.length > 0) {
      await deletionRequest.markAsFailed(errors);
    } else {
      await deletionRequest.markAsCompleted({
        dataDeleted: deletedData,
        completedActions: completedActions
      });
    }

  } catch (error) {
    logger.error('Error processing deletion request:', error);
    await deletionRequest.markAsFailed([error.message]);
  }
}

/**
 * Check deletion request status
 * GET /api/auth/facebook/deletion-status/:code
 */
exports.checkDeletionStatus = async (req, res) => {
  try {
    const { code } = req.params;

    if (!code) {
      return res.status(400).json({
        error: 'Missing confirmation code'
      });
    }

    const deletionRequest = await DataDeletionRequest.findByConfirmationCode(code);

    if (!deletionRequest) {
      return res.status(404).json({
        error: 'Deletion request not found'
      });
    }

    res.json({
      confirmationCode: deletionRequest.confirmationCode,
      status: deletionRequest.status,
      formattedStatus: deletionRequest.formattedStatus,
      requestedAt: deletionRequest.requestedAt,
      completedAt: deletionRequest.completedAt,
      ageInHours: deletionRequest.ageInHours,
      deletionDetails: deletionRequest.status === 'completed' ? {
        dataDeleted: deletionRequest.deletionDetails.dataDeleted,
        completedActions: deletionRequest.deletionDetails.completedActions
      } : null,
      errors: deletionRequest.status === 'failed' ? 
        deletionRequest.deletionDetails.errors : null
    });

  } catch (error) {
    logger.error('Error checking deletion status:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
};

/**
 * Process stale deletion requests (for cron job)
 */
exports.processStaleRequests = async () => {
  try {
    const staleRequests = await DataDeletionRequest.findStaleRequests(24);
    
    logger.info(`Found ${staleRequests.length} stale deletion requests`);

    for (const request of staleRequests) {
      await processDeletion(request);
    }

  } catch (error) {
    logger.error('Error processing stale deletion requests:', error);
  }
};