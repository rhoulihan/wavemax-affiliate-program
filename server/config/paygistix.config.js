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
   * @throws {Error} If merchant ID is not configured
   */
  getMerchantId() {
    if (!process.env.PAYGISTIX_MERCHANT_ID) {
      throw new Error('PAYGISTIX_MERCHANT_ID is required but not configured');
    }
    return process.env.PAYGISTIX_MERCHANT_ID;
  }

  /**
   * Get form ID
   * @returns {string}
   * @throws {Error} If form ID is not configured
   */
  getFormId() {
    if (!process.env.PAYGISTIX_FORM_ID) {
      throw new Error('PAYGISTIX_FORM_ID is required but not configured');
    }
    return process.env.PAYGISTIX_FORM_ID;
  }

  /**
   * Get form hash
   * @returns {string}
   * @throws {Error} If form hash is not configured
   */
  getFormHash() {
    if (!process.env.PAYGISTIX_FORM_HASH) {
      throw new Error('PAYGISTIX_FORM_HASH is required but not configured');
    }
    return process.env.PAYGISTIX_FORM_HASH;
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
    try {
      // Try to get all required values - will throw if any are missing
      this.getMerchantId();
      this.getFormId();
      this.getFormHash();
      return true;
    } catch (error) {
      logger.error('Paygistix configuration incomplete:', error.message);
      return false;
    }
  }

  /**
   * Get public configuration object for client
   * Note: For hosted form approach, the hash must be included in the HTML form
   * @returns {Object}
   * @throws {Error} If required configuration is missing
   */
  getClientConfig() {
    try {
      return {
        merchantId: this.getMerchantId(),
        formId: this.getFormId(),
        formActionUrl: this.getFormActionUrl(),
        returnUrl: this.getReturnUrl(),
        environment: this.getEnvironment(),
        formHash: this.getFormHash(), // Required for hosted form submission
        testModeEnabled: process.env.ENABLE_TEST_PAYMENT_FORM === 'true' // Add test mode flag
      };
    } catch (error) {
      logger.error('Failed to get client config:', error.message);
      throw error;
    }
  }

  /**
   * Get full configuration including sensitive data (for server use only)
   * @returns {Object}
   * @throws {Error} If required configuration is missing
   */
  getFullConfig() {
    try {
      return {
        ...this.getClientConfig(),
        formHash: this.getFormHash()
      };
    } catch (error) {
      logger.error('Failed to get full config:', error.message);
      throw error;
    }
  }
}

module.exports = new PaygistixConfig();