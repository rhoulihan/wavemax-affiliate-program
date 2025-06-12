const paygistixService = require('../services/paygistix');
const logger = require('../utils/logger');

class PaymentController {
  /**
   * Get payment configuration for hosted form
   * GET /api/v1/payments/config
   */
  async getConfig(req, res) {
    try {
      const config = paygistixService.getConfig();
      
      if (!paygistixService.isConfigured()) {
        return res.status(500).json({
          success: false,
          message: 'Payment configuration not properly set up'
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