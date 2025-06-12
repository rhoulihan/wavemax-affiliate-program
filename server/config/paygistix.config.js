const logger = require('../utils/logger');

/**
 * Paygistix Hosted Form Configuration
 * This configuration is specifically for the hosted payment form solution
 * No API keys are required - only form configuration
 */
class PaygistixConfig {
  constructor() {
    this.validateEnvironment();
  }

  /**
   * Validate required environment variables for hosted form
   */
  validateEnvironment() {
    const required = [
      'PAYGISTIX_MERCHANT_ID',
      'PAYGISTIX_FORM_ID',
      'PAYGISTIX_FORM_HASH'
    ];

    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
      logger.warn(`Missing Paygistix hosted form configuration: ${missing.join(', ')}`);
    }
  }

  /**
   * Get environment (production or sandbox)
   * @returns {string}
   */
  getEnvironment() {
    return process.env.PAYGISTIX_ENVIRONMENT || 'production';
  }

  /**
   * Get merchant ID
   * @returns {string}
   */
  getMerchantId() {
    return process.env.PAYGISTIX_MERCHANT_ID || '';
  }

  /**
   * Get form ID
   * @returns {string}
   */
  getFormId() {
    return process.env.PAYGISTIX_FORM_ID || '';
  }

  /**
   * Get form hash
   * @returns {string}
   */
  getFormHash() {
    return process.env.PAYGISTIX_FORM_HASH || '';
  }

  /**
   * Get form action URL
   * @returns {string}
   */
  getFormActionUrl() {
    return process.env.PAYGISTIX_FORM_ACTION_URL || 'https://safepay.paymentlogistics.net/transaction.asp';
  }

  /**
   * Get return URL for payment callbacks
   * @returns {string}
   */
  getReturnUrl() {
    return process.env.PAYGISTIX_RETURN_URL || 'https://wavemax.promo/payment-callback-handler.html';
  }

  /**
   * Check if configuration is complete
   * @returns {boolean}
   */
  isConfigured() {
    return !!(this.getMerchantId() && this.getFormId() && this.getFormHash());
  }

  /**
   * Get full configuration object for client
   * @returns {Object}
   */
  getClientConfig() {
    return {
      merchantId: this.getMerchantId(),
      formId: this.getFormId(),
      formHash: this.getFormHash(),
      formActionUrl: this.getFormActionUrl(),
      returnUrl: this.getReturnUrl(),
      environment: this.getEnvironment()
    };
  }
}

module.exports = new PaygistixConfig();