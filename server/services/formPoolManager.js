const FormPool = require('../models/FormPool');
const logger = require('../utils/logger');
const fs = require('fs');
const path = require('path');

class FormPoolManager {
  constructor() {
    this.formsConfig = null;
    this.initialized = false;
  }

  /**
   * Initialize the form pool from JSON configuration
   */
  async initializePool() {
    try {
      // Load configuration from JSON file
      const configPath = path.join(__dirname, '../config/paygistix-forms.json');
      const configData = fs.readFileSync(configPath, 'utf8');
      this.formsConfig = JSON.parse(configData);
      
      logger.info('Loading Paygistix forms configuration', {
        formCount: this.formsConfig.forms.length,
        lockTimeout: this.formsConfig.lockTimeoutMinutes
      });

      // Initialize forms in database
      for (const formConfig of this.formsConfig.forms) {
        try {
          // Use upsert to create or update form
          await FormPool.findOneAndUpdate(
            { formId: formConfig.formId },
            {
              $set: {
                formId: formConfig.formId,
                formHash: formConfig.formHash,
                callbackPath: formConfig.callbackPath
              },
              $setOnInsert: {
                isLocked: false,
                lockedBy: null,
                lockedAt: null,
                lastUsedAt: new Date()
              }
            },
            { upsert: true, new: true }
          );
          
          logger.info('Initialized form in pool', { formId: formConfig.formId });
        } catch (error) {
          logger.error('Error initializing form', {
            formId: formConfig.formId,
            error: error.message
          });
        }
      }

      this.initialized = true;
      logger.info('Form pool initialization complete');

      // Start cleanup job
      this.startCleanupJob();
      
      return true;
    } catch (error) {
      logger.error('Failed to initialize form pool', error);
      throw error;
    }
  }

  /**
   * Acquire an available form and lock it for a payment token
   */
  async acquireForm(paymentToken) {
    if (!this.initialized) {
      throw new Error('Form pool not initialized');
    }

    try {
      const form = await FormPool.acquireForm(
        paymentToken,
        this.formsConfig.lockTimeoutMinutes
      );

      if (form) {
        logger.info('Form acquired from pool', {
          formId: form.formId,
          paymentToken: paymentToken,
          callbackPath: form.callbackPath
        });
      } else {
        logger.warn('No forms available in pool', { paymentToken });
      }

      return form;
    } catch (error) {
      logger.error('Error acquiring form from pool', {
        paymentToken,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Release a form back to the pool
   */
  async releaseForm(formId) {
    try {
      const form = await FormPool.findOne({ formId });
      
      if (!form) {
        logger.warn('Form not found for release', { formId });
        return false;
      }

      if (!form.isLocked) {
        logger.warn('Form already released', { formId });
        return true;
      }

      await form.release();
      
      logger.info('Form released back to pool', {
        formId: form.formId,
        wasLockedBy: form.lockedBy
      });

      return true;
    } catch (error) {
      logger.error('Error releasing form', {
        formId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Release a form by payment token
   */
  async releaseFormByToken(paymentToken) {
    try {
      const form = await FormPool.findOne({ lockedBy: paymentToken });
      
      if (!form) {
        logger.warn('No form found locked by token', { paymentToken });
        return false;
      }

      return await this.releaseForm(form.formId);
    } catch (error) {
      logger.error('Error releasing form by token', {
        paymentToken,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get form by callback path
   */
  async getFormByCallbackPath(callbackPath) {
    try {
      const form = await FormPool.findOne({ callbackPath });
      
      if (!form) {
        logger.warn('Form not found for callback path', { callbackPath });
      }

      return form;
    } catch (error) {
      logger.error('Error getting form by callback path', {
        callbackPath,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Clean up expired locks
   */
  async cleanupExpiredLocks() {
    try {
      const releasedCount = await FormPool.releaseExpiredLocks(
        this.formsConfig.lockTimeoutMinutes
      );

      if (releasedCount > 0) {
        logger.info('Released expired form locks', { count: releasedCount });
      }

      return releasedCount;
    } catch (error) {
      logger.error('Error cleaning up expired locks', error);
      throw error;
    }
  }

  /**
   * Start periodic cleanup job
   */
  startCleanupJob() {
    // Run cleanup every 5 minutes
    const interval = 5 * 60 * 1000;
    
    setInterval(async () => {
      try {
        await this.cleanupExpiredLocks();
      } catch (error) {
        logger.error('Cleanup job error', error);
      }
    }, interval);

    logger.info('Form pool cleanup job started', {
      interval: '5 minutes'
    });
  }

  /**
   * Get pool statistics
   */
  async getPoolStats() {
    try {
      const total = await FormPool.countDocuments();
      const locked = await FormPool.countDocuments({ isLocked: true });
      const available = total - locked;
      
      const forms = await FormPool.find().select('formId isLocked lockedBy lockedAt');
      
      return {
        total,
        locked,
        available,
        forms: forms.map(f => ({
          formId: f.formId,
          isLocked: f.isLocked,
          lockedBy: f.lockedBy,
          lockedAt: f.lockedAt
        }))
      };
    } catch (error) {
      logger.error('Error getting pool stats', error);
      throw error;
    }
  }

  /**
   * Get form configuration including full URL
   */
  getFormConfig(form) {
    const baseUrl = this.formsConfig.baseUrl || process.env.BASE_URL || 'https://wavemax.promo';
    
    return {
      formId: form.formId,
      formHash: form.formHash,
      callbackUrl: `${baseUrl}${form.callbackPath}`
    };
  }
}

// Export singleton instance
module.exports = new FormPoolManager();