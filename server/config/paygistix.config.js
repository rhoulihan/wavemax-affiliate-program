const logger = require('../utils/logger');

class PaygistixConfig {
  constructor() {
    this.validateEnvironment();
  }

  /**
   * Validate required environment variables
   */
  validateEnvironment() {
    const required = [
      'PAYGISTIX_API_KEY',
      'PAYGISTIX_API_SECRET',
      'PAYGISTIX_WEBHOOK_SECRET'
    ];

    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
      logger.warn(`Missing Paygistix environment variables: ${missing.join(', ')}`);
    }
  }

  /**
   * Get API environment (production or sandbox)
   * @returns {string}
   */
  getEnvironment() {
    return process.env.PAYGISTIX_ENVIRONMENT || 'sandbox';
  }

  /**
   * Get API base URL based on environment
   * @returns {string}
   */
  getApiUrl() {
    const environment = this.getEnvironment();
    
    if (environment === 'production') {
      return process.env.PAYGISTIX_API_URL || 'https://api.paygistix.com/v1';
    }
    
    return process.env.PAYGISTIX_SANDBOX_URL || 'https://sandbox-api.paygistix.com/v1';
  }

  /**
   * Get API key
   * @returns {string}
   */
  getApiKey() {
    const environment = this.getEnvironment();
    
    if (environment === 'production') {
      return process.env.PAYGISTIX_API_KEY;
    }
    
    return process.env.PAYGISTIX_SANDBOX_API_KEY || process.env.PAYGISTIX_API_KEY;
  }

  /**
   * Get API secret
   * @returns {string}
   */
  getApiSecret() {
    const environment = this.getEnvironment();
    
    if (environment === 'production') {
      return process.env.PAYGISTIX_API_SECRET;
    }
    
    return process.env.PAYGISTIX_SANDBOX_API_SECRET || process.env.PAYGISTIX_API_SECRET;
  }

  /**
   * Get webhook secret
   * @returns {string}
   */
  getWebhookSecret() {
    const environment = this.getEnvironment();
    
    if (environment === 'production') {
      return process.env.PAYGISTIX_WEBHOOK_SECRET;
    }
    
    return process.env.PAYGISTIX_SANDBOX_WEBHOOK_SECRET || process.env.PAYGISTIX_WEBHOOK_SECRET;
  }

  /**
   * Get webhook endpoint URL
   * @returns {string}
   */
  getWebhookEndpoint() {
    return process.env.PAYGISTIX_WEBHOOK_ENDPOINT || '/api/payments/webhook';
  }

  /**
   * Check if auto-capture is enabled
   * @returns {boolean}
   */
  isAutoCapture() {
    return process.env.PAYGISTIX_AUTO_CAPTURE === 'true';
  }

  /**
   * Get payment timeout in milliseconds
   * @returns {number}
   */
  getPaymentTimeout() {
    return parseInt(process.env.PAYGISTIX_PAYMENT_TIMEOUT || '30000', 10);
  }

  /**
   * Get retry configuration
   * @returns {Object}
   */
  getRetryConfig() {
    return {
      maxRetries: parseInt(process.env.PAYGISTIX_MAX_RETRIES || '3', 10),
      retryDelay: parseInt(process.env.PAYGISTIX_RETRY_DELAY || '1000', 10),
      retryBackoff: process.env.PAYGISTIX_RETRY_BACKOFF === 'true'
    };
  }

  /**
   * Get supported currencies
   * @returns {Array<string>}
   */
  getSupportedCurrencies() {
    const currencies = process.env.PAYGISTIX_SUPPORTED_CURRENCIES || 'USD,EUR,GBP,CAD,AUD';
    return currencies.split(',').map(c => c.trim().toUpperCase());
  }

  /**
   * Get minimum payment amount (in cents)
   * @returns {number}
   */
  getMinimumAmount() {
    return parseInt(process.env.PAYGISTIX_MINIMUM_AMOUNT || '50', 10);
  }

  /**
   * Get maximum payment amount (in cents)
   * @returns {number}
   */
  getMaximumAmount() {
    return parseInt(process.env.PAYGISTIX_MAXIMUM_AMOUNT || '99999999', 10);
  }

  /**
   * Check if 3D Secure is required
   * @returns {boolean}
   */
  is3DSecureRequired() {
    return process.env.PAYGISTIX_3DS_REQUIRED === 'true';
  }

  /**
   * Get 3D Secure threshold amount (in cents)
   * @returns {number}
   */
  get3DSecureThreshold() {
    return parseInt(process.env.PAYGISTIX_3DS_THRESHOLD || '10000', 10);
  }

  /**
   * Check if tokenization is enabled
   * @returns {boolean}
   */
  isTokenizationEnabled() {
    return process.env.PAYGISTIX_TOKENIZATION_ENABLED !== 'false';
  }

  /**
   * Get statement descriptor
   * @returns {string}
   */
  getStatementDescriptor() {
    return process.env.PAYGISTIX_STATEMENT_DESCRIPTOR || 'WAVEMAX';
  }

  /**
   * Get metadata prefix for all transactions
   * @returns {string}
   */
  getMetadataPrefix() {
    return process.env.PAYGISTIX_METADATA_PREFIX || 'wavemax_';
  }

  /**
   * Check if test mode is enabled
   * @returns {boolean}
   */
  isTestMode() {
    return this.getEnvironment() !== 'production';
  }

  /**
   * Get rate limiting configuration
   * @returns {Object}
   */
  getRateLimits() {
    return {
      requests: parseInt(process.env.PAYGISTIX_RATE_LIMIT_REQUESTS || '100', 10),
      windowMs: parseInt(process.env.PAYGISTIX_RATE_LIMIT_WINDOW || '60000', 10)
    };
  }

  /**
   * Get logging configuration for Paygistix
   * @returns {Object}
   */
  getLoggingConfig() {
    return {
      logRequests: process.env.PAYGISTIX_LOG_REQUESTS === 'true',
      logResponses: process.env.PAYGISTIX_LOG_RESPONSES === 'true',
      logErrors: process.env.PAYGISTIX_LOG_ERRORS !== 'false',
      sanitizeFields: ['card_number', 'cvv', 'cvc', 'api_key', 'api_secret']
    };
  }

  /**
   * Get webhook retry configuration
   * @returns {Object}
   */
  getWebhookRetryConfig() {
    return {
      maxAttempts: parseInt(process.env.PAYGISTIX_WEBHOOK_MAX_ATTEMPTS || '5', 10),
      initialDelay: parseInt(process.env.PAYGISTIX_WEBHOOK_INITIAL_DELAY || '60000', 10),
      maxDelay: parseInt(process.env.PAYGISTIX_WEBHOOK_MAX_DELAY || '3600000', 10)
    };
  }

  /**
   * Get fraud detection settings
   * @returns {Object}
   */
  getFraudSettings() {
    return {
      enabled: process.env.PAYGISTIX_FRAUD_DETECTION_ENABLED !== 'false',
      riskThreshold: process.env.PAYGISTIX_FRAUD_RISK_THRESHOLD || 'medium',
      requireCvv: process.env.PAYGISTIX_REQUIRE_CVV !== 'false',
      requireAddress: process.env.PAYGISTIX_REQUIRE_ADDRESS === 'true'
    };
  }
}

module.exports = new PaygistixConfig();