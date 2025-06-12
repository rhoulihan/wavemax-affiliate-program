const paygistixConfig = require('../config/paygistix.config');
const logger = require('../utils/logger');
const PaymentToken = require('../models/PaymentToken');
const Customer = require('../models/Customer');

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
      
      // Check if request is from localhost
      const isLocalhost = req.ip === '127.0.0.1' || 
                         req.ip === '::1' || 
                         req.ip === '::ffff:127.0.0.1' ||
                         req.hostname === 'localhost' ||
                         req.get('host')?.includes('localhost');
      
      // Get appropriate config based on request origin
      const config = isLocalhost 
        ? paygistixConfig.getFullConfig()  // Include hash for localhost
        : paygistixConfig.getClientConfig(); // Exclude hash for external requests
      
      // Log access for security monitoring
      if (isLocalhost && config.formHash) {
        logger.info('Payment config with hash accessed from localhost', {
          ip: req.ip,
          hostname: req.hostname,
          userAgent: req.get('user-agent')
        });
      }
      
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
      
      // Create payment token record
      const paymentToken = new PaymentToken({
        token,
        customerData,
        paymentData,
        status: 'pending'
      });
      
      await paymentToken.save();
      
      logger.info('Payment token created:', {
        token,
        customerEmail: customerData.email
      });
      
      res.json({
        success: true,
        token,
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
        
        logger.info('Payment token cancelled:', {
          token: token,
          customerId: paymentToken.customerId
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
   * Handle payment callback from hosted form
   * This endpoint processes the return from Paygistix after payment
   */
  async handleCallback(req, res) {
    try {
      // Log the callback for debugging
      logger.info('Payment callback received:', {
        method: req.method,
        query: req.query,
        body: req.body
      });

      // Extract token from callback parameters
      const token = req.query.token || req.body.token;
      
      if (!token) {
        logger.error('No payment token in callback');
        return res.redirect('/payment-callback-handler.html?error=no_token');
      }
      
      // Find the payment token
      const paymentToken = await PaymentToken.findOne({ token });
      
      if (!paymentToken) {
        logger.error('Payment token not found:', token);
        return res.redirect('/payment-callback-handler.html?error=invalid_token');
      }
      
      // Check payment status from Paygistix response
      // This will depend on Paygistix's callback parameters
      const isSuccess = req.query.status === 'success' || 
                       req.query.result === 'approved' ||
                       req.body.status === 'success' ||
                       req.body.result === 'approved';
      
      // Update payment token status
      paymentToken.status = isSuccess ? 'success' : 'failed';
      paymentToken.paygistixResponse = { ...req.query, ...req.body };
      
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
      
      // Redirect to callback handler with token
      res.redirect(`/payment-callback-handler.html?token=${token}&status=${paymentToken.status}`);
    } catch (error) {
      logger.error('Error handling payment callback:', error);
      res.redirect('/payment-callback-handler.html?error=processing_failed');
    }
  }
}

module.exports = new PaymentController();