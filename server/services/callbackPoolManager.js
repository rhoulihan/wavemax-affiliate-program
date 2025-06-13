const CallbackPool = require('../models/CallbackPool');
const logger = require('../utils/logger');

class CallbackPoolManager {
  constructor() {
    this.config = require('../config/paygistix-forms.json');
    this.baseUrl = this.config.baseUrl;
    this.lockTimeoutMinutes = this.config.lockTimeoutMinutes;
    this.formId = this.config.form.formId;
    this.formHash = this.config.form.formHash;
    this.cleanupInterval = null;
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
      throw new Error('No callback handlers available. All handlers are currently in use.');
    }
    
    const callbackUrl = `${this.baseUrl}${callback.callbackPath}`;
    
    logger.info(`Acquired callback handler for payment token ${paymentToken}:`, {
      callbackPath: callback.callbackPath,
      callbackUrl
    });
    
    // Return form config with the assigned callback URL
    return {
      formId: this.formId,
      formHash: this.formHash,
      callbackPath: callback.callbackPath,
      callbackUrl: callbackUrl
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

module.exports = new CallbackPoolManager();