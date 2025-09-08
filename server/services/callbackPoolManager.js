const CallbackPool = require('../models/CallbackPool');
const logger = require('../utils/logger');

class CallbackPoolManager {
  constructor() {
    // Lazy load config to avoid issues in test environment
    this._config = null;
    this.cleanupInterval = null;
  }

  get config() {
    if (!this._config) {
      if (process.env.NODE_ENV === 'test') {
        // In test environment, use test config if set
        this._config = this._testConfig || { callbackPaths: [], baseUrl: '', lockTimeoutMinutes: 10, form: {} };
      } else {
        this._config = require('../config/paygistix-forms.json');
      }
    }
    return this._config;
  }

  // Method to set config for testing
  setTestConfig(config) {
    if (process.env.NODE_ENV === 'test') {
      this._testConfig = config;
      this._config = config; // Reset cached config
    }
  }

  get baseUrl() {
    return this.config.baseUrl;
  }

  get lockTimeoutMinutes() {
    return this.config.lockTimeoutMinutes;
  }

  get formId() {
    return this.config.form.formId;
  }

  get formHash() {
    return this.config.form.formHash;
  }

  async initializePool() {
    logger.info('Initializing callback pool...');

    // Create or update callback entries
    for (const callbackPath of this.config.callbackPaths) {
      await CallbackPool.findOneAndUpdate(
        { callbackPath },
        {
          $setOnInsert: {
            callbackPath,
            isLocked: false,
            lockedBy: null,
            lockedAt: null,
            lastUsedAt: null,
            usageCount: 0
          }
        },
        { upsert: true, new: true }
      );
    }

    logger.info(`Initialized ${this.config.callbackPaths.length} callback handlers`);

    // Start cleanup job
    this.startCleanupJob();
  }

  async acquireCallback(paymentToken) {
    const callback = await CallbackPool.acquireCallback(paymentToken, this.lockTimeoutMinutes);

    if (!callback) {
      logger.warn('No callback handlers available. All handlers are currently in use.');
      return null;
    }

    const callbackUrl = `${this.baseUrl}${callback.callbackPath}`;

    logger.info(`Acquired callback handler for payment token ${paymentToken}:`, {
      callbackPath: callback.callbackPath,
      callbackUrl
    });

    // Return form config with the assigned callback URL
    // Get the formActionUrl and merchantId from Paygistix config
    const paygistixConfig = require('../config/paygistix.config');
    
    return {
      formId: this.formId,
      formHash: this.formHash,
      callbackPath: callback.callbackPath,
      callbackUrl: callbackUrl,
      formActionUrl: paygistixConfig.getFormActionUrl(),
      merchantId: paygistixConfig.getMerchantId(),
      testModeEnabled: process.env.ENABLE_TEST_PAYMENT_FORM === 'true'
    };
  }

  async releaseCallback(paymentToken) {
    const callback = await CallbackPool.releaseCallback(paymentToken);

    if (callback) {
      logger.info(`Released callback handler for payment token ${paymentToken}:`, {
        callbackPath: callback.callbackPath
      });
    }

    return callback;
  }

  async getPoolStatus() {
    const callbacks = await CallbackPool.find({}).sort('callbackPath');

    const status = {
      total: callbacks.length,
      available: callbacks.filter(c => !c.isLocked).length,
      locked: callbacks.filter(c => c.isLocked).length,
      handlers: callbacks.map(c => ({
        path: c.callbackPath,
        isLocked: c.isLocked,
        lockedBy: c.lockedBy,
        lockedAt: c.lockedAt,
        usageCount: c.usageCount,
        lastUsedAt: c.lastUsedAt
      }))
    };

    return status;
  }

  startCleanupJob() {
    // Run cleanup every 5 minutes
    this.cleanupInterval = setInterval(async () => {
      try {
        const released = await CallbackPool.releaseExpiredLocks(this.lockTimeoutMinutes);

        if (released > 0) {
          logger.info(`Released ${released} expired callback locks`);
        }
      } catch (error) {
        logger.error('Error in callback pool cleanup job:', error);
      }
    }, 5 * 60 * 1000);

    logger.info('Callback pool cleanup job started (runs every 5 minutes)');
  }

  stopCleanupJob() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      logger.info('Callback pool cleanup job stopped');
    }
  }
}

// Create singleton instance
let instance = null;

// Export a function that returns the singleton instance
module.exports = (() => {
  if (!instance) {
    instance = new CallbackPoolManager();
  }
  return instance;
})();