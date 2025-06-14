const paygistixConfig = require('../config/paygistix.config');
const logger = require('../utils/logger');
const PaymentToken = require('../models/PaymentToken');
const Customer = require('../models/Customer');
const callbackPoolManager = require('../services/callbackPoolManager');

class PaymentController {
  /**
   * Get payment configuration for hosted form
   * GET /api/v1/payments/config
   */
  async getConfig(req, res) {
    try {
      // Check if Paygistix is configured
      if (!paygistixConfig.isConfigured()) {
        return res.status(500).json({
          success: false,
          message: 'Payment configuration not properly set up'
        });
      }
      
      // Get payment configuration
      // Note: For hosted form approach, the hash is required in the client form
      const config = paygistixConfig.getClientConfig();
      
      // Log config access for monitoring
      logger.info('Payment config accessed', {
        ip: req.ip,
        hostname: req.hostname,
        userAgent: req.get('user-agent'),
        hasHash: !!config.formHash
      });
      
      res.json({
        success: true,
        config: config
      });
    } catch (error) {
      logger.error('Error getting payment config:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to load payment configuration'
      });
    }
  }

  /**
   * Log payment submission for debugging
   * POST /api/v1/payments/log-submission
   */
  async logSubmission(req, res) {
    try {
      logger.info('Paygistix payment submission:', {
        ...req.body,
        ip: req.ip,
        userAgent: req.get('user-agent')
      });
      
      res.json({ success: true, message: 'Payment submission logged' });
    } catch (error) {
      logger.error('Error logging payment submission:', error);
      res.status(500).json({ success: false, message: 'Failed to log submission' });
    }
  }

  /**
   * Create payment token for tracking payment status
   * POST /api/v1/payments/create-token
   */
  async createPaymentToken(req, res) {
    try {
      const { customerData, paymentData } = req.body;
      
      // Generate unique token
      const token = PaymentToken.generateToken();
      
      // Acquire callback handler from pool
      const callbackConfig = await callbackPoolManager.acquireCallback(token);
      
      if (!callbackConfig) {
        return res.status(503).json({
          success: false,
          message: 'No payment handlers available. Please try again in a moment.'
        });
      }
      
      // Create payment token record with callback assignment
      const paymentToken = new PaymentToken({
        token,
        customerData,
        paymentData,
        callbackPath: callbackConfig.callbackPath,
        status: 'pending'
      });
      
      await paymentToken.save();
      
      logger.info('Payment token created with callback assignment:', {
        token,
        customerEmail: customerData.email,
        callbackPath: callbackConfig.callbackPath
      });
      
      res.json({
        success: true,
        token,
        formConfig: callbackConfig,
        message: 'Payment token created successfully'
      });
    } catch (error) {
      logger.error('Error creating payment token:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create payment token'
      });
    }
  }

  /**
   * Check payment token status
   * GET /api/v1/payments/check-status/:token
   */
  async checkPaymentStatus(req, res) {
    try {
      const { token } = req.params;
      
      const paymentToken = await PaymentToken.findOne({ token });
      
      if (!paymentToken) {
        return res.status(404).json({
          success: false,
          message: 'Payment token not found'
        });
      }
      
      res.json({
        success: true,
        status: paymentToken.status,
        errorMessage: paymentToken.errorMessage
      });
    } catch (error) {
      logger.error('Error checking payment status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to check payment status'
      });
    }
  }

  /**
   * Cancel a payment token when user closes payment window
   * POST /api/v1/payments/cancel-token/:token
   */
  async cancelPaymentToken(req, res) {
    try {
      const { token } = req.params;
      
      const paymentToken = await PaymentToken.findOne({ token });
      
      if (!paymentToken) {
        return res.status(404).json({
          success: false,
          message: 'Payment token not found'
        });
      }
      
      // Only cancel if the token is still pending
      if (paymentToken.status === 'pending') {
        paymentToken.status = 'cancelled';
        paymentToken.errorMessage = 'Payment cancelled by user';
        await paymentToken.save();
        
        // Release the callback back to the pool
        if (paymentToken.callbackPath) {
          await callbackPoolManager.releaseCallback(paymentToken.token);
        }
        
        logger.info('Payment token cancelled:', {
          token: token,
          customerId: paymentToken.customerId,
          formReleased: paymentToken.assignedFormId
        });
      }
      
      res.json({
        success: true,
        message: 'Payment token cancelled',
        status: paymentToken.status
      });
    } catch (error) {
      logger.error('Error cancelling payment token:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to cancel payment token'
      });
    }
  }

  /**
   * Update payment status (for test mode)
   * POST /api/v1/payments/update-status/:token
   */
  async updatePaymentStatus(req, res) {
    try {
      const { token } = req.params;
      const { status, result, message } = req.body;
      
      const paymentToken = await PaymentToken.findOne({ token });
      
      if (!paymentToken) {
        return res.status(404).json({
          success: false,
          message: 'Payment token not found'
        });
      }
      
      // Update payment status
      paymentToken.status = status === 'success' ? 'completed' : 'failed';
      paymentToken.paygistixResponse = {
        Result: result || (status === 'success' ? '0' : '1'),
        testMode: true,
        message: message
      };
      
      if (status !== 'success') {
        paymentToken.errorMessage = message || 'Payment failed';
      }
      
      await paymentToken.save();
      
      // If payment was successful in test mode, create the customer
      if (status === 'success' && paymentToken.customerData) {
        try {
          const customerData = paymentToken.customerData;
          
          // Check if customer already exists
          const existingCustomer = await Customer.findOne({ email: customerData.email });
          if (!existingCustomer) {
            // Create customer with affiliate reference
            const customer = new Customer({
              firstName: customerData.firstName,
              lastName: customerData.lastName,
              email: customerData.email,
              phone: customerData.phone,
              username: customerData.username,
              password: customerData.password, // This should be hashed in the model
              address: {
                street: customerData.address,
                city: customerData.city,
                state: customerData.state,
                postalCode: customerData.zipCode
              },
              numberOfBags: customerData.numberOfBags,
              specialInstructions: customerData.specialInstructions,
              notificationPreference: customerData.notificationPreference || 'both',
              affiliateId: customerData.affiliateId,
              languagePreference: customerData.languagePreference || 'en',
              registrationDate: new Date()
            });
            
            await customer.save();
            
            logger.info('Customer created after successful test payment:', {
              customerId: customer._id,
              email: customer.email,
              affiliateId: customer.affiliateId,
              testMode: true
            });
          }
        } catch (customerError) {
          logger.error('Error creating customer after test payment:', customerError);
          // Don't fail the payment update, but log the error
        }
      }
      
      // Release the callback back to the pool
      if (paymentToken.callbackPath) {
        await callbackPoolManager.releaseCallback(paymentToken.token);
      }
      
      logger.info('Payment status updated (test mode):', {
        token: token,
        status: paymentToken.status,
        testMode: true
      });
      
      res.json({
        success: true,
        message: 'Payment status updated',
        status: paymentToken.status
      });
    } catch (error) {
      logger.error('Error updating payment status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update payment status'
      });
    }
  }

  /**
   * Handle form-specific payment callback
   * This method is called by dynamic routes for each form
   */
  async handleFormCallback(req, res, callbackPath) {
    try {
      // Log the callback for debugging
      logger.info('Form-specific payment callback received:', {
        method: req.method,
        callbackPath: callbackPath,
        query: req.query,
        body: req.body
      });

      // Find payment token associated with this callback path
      // There should only be one pending payment per callback path
      const paymentToken = await PaymentToken.findOne({
        callbackPath: callbackPath,
        status: 'pending'
      });
      
      if (!paymentToken) {
        logger.error('No pending payment found for callback path:', callbackPath);
        return res.redirect('/payment-callback-handler.html?error=no_pending_payment');
      }

      // Process the payment result
      await this.processCallbackResult(req, res, paymentToken);
      
      // Release callback back to pool
      await callbackPoolManager.releaseCallback(paymentToken.token);
      
    } catch (error) {
      logger.error('Error handling form callback:', error);
      res.redirect('/payment-callback-handler.html?error=processing_failed');
    }
  }

  /**
   * Process callback result (shared logic)
   */
  async processCallbackResult(req, res, paymentToken) {
    // Check payment status from Paygistix response
    // Paygistix sends Result=0 for success
    const isSuccess = req.query.Result === '0' || 
                     req.body.Result === '0' ||
                     req.query.status === 'success' || 
                     req.query.result === 'approved' ||
                     req.body.status === 'success' ||
                     req.body.result === 'approved';
    
    // Update payment token status
    paymentToken.status = isSuccess ? 'completed' : 'failed';
    paymentToken.paygistixResponse = { ...req.query, ...req.body };
    paymentToken.transactionId = req.query.PNRef || req.body.PNRef;
    
    if (!isSuccess) {
      paymentToken.errorMessage = req.query.error || req.body.error || 'Payment was not successful';
    }
    
    await paymentToken.save();
    
    // If payment was successful, create the customer
    if (isSuccess && paymentToken.customerData) {
      try {
        const customerData = paymentToken.customerData;
        
        // Create customer with affiliate reference
        const customer = new Customer({
          firstName: customerData.firstName,
          lastName: customerData.lastName,
          email: customerData.email,
          phone: customerData.phone,
          address: {
            street: customerData.address,
            city: customerData.city,
            state: customerData.state,
            postalCode: customerData.postalCode
          },
          numberOfBags: customerData.numberOfBags,
          notificationPreference: customerData.notificationPreference || 'both',
          affiliateId: customerData.affiliateId,
          registrationDate: new Date()
        });
        
        await customer.save();
        
        logger.info('Customer created after successful payment:', {
          customerId: customer._id,
          email: customer.email,
          affiliateId: customer.affiliateId
        });
      } catch (customerError) {
        logger.error('Error creating customer after payment:', customerError);
        // Don't fail the payment callback, but log the error
      }
    }
    
    // Redirect to callback handler with all parameters
    const queryString = new URLSearchParams({
      ...req.query,
      token: paymentToken.token,
      status: paymentToken.status,
      paymentToken: paymentToken.token
    }).toString();
    res.redirect(`/payment-callback-handler.html?${queryString}`);
  }


  /**
   * Get callback pool statistics
   * GET /api/v1/payments/pool-stats
   */
  async getPoolStats(req, res) {
    try {
      const stats = await callbackPoolManager.getPoolStatus();
      
      res.json({
        success: true,
        stats
      });
    } catch (error) {
      logger.error('Error getting pool stats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get pool statistics'
      });
    }
  }
}

module.exports = new PaymentController();