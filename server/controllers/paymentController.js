const paygistixConfig = require('../config/paygistix.config');
const logger = require('../utils/logger');

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

      // TODO: Process the callback data based on Paygistix documentation
      // For now, redirect to a success or error page
      
      res.redirect('/payment-callback-handler.html');
    } catch (error) {
      logger.error('Error handling payment callback:', error);
      res.status(500).json({
        success: false,
        error: 'Callback processing failed'
      });
    }
  }
}

module.exports = new PaymentController();