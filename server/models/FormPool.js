const mongoose = require('mongoose');

const formPoolSchema = new mongoose.Schema({
  formId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  formHash: {
    type: String,
    required: true
  },
  callbackPath: {
    type: String,
    required: true,
    unique: true
  },
  isLocked: {
    type: Boolean,
    default: false,
    index: true
  },
  lockedBy: {
    type: String,
    default: null,
    index: true
  },
  lockedAt: {
    type: Date,
    default: null
  },
  lastUsedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Compound index for finding available forms
formPoolSchema.index({ isLocked: 1, lastUsedAt: 1 });

// Instance method to lock form
formPoolSchema.methods.lock = function(paymentToken) {
  this.isLocked = true;
  this.lockedBy = paymentToken;
  this.lockedAt = new Date();
  this.lastUsedAt = new Date();
  return this.save();
};

// Instance method to release form
formPoolSchema.methods.release = function() {
  this.isLocked = false;
  this.lockedBy = null;
  this.lockedAt = null;
  return this.save();
};

// Static method to acquire available form
formPoolSchema.statics.acquireForm = async function(paymentToken, lockTimeoutMinutes = 10) {
  const lockExpiredTime = new Date(Date.now() - lockTimeoutMinutes * 60 * 1000);
  
  // Try to find and lock an available form atomically
  const form = await this.findOneAndUpdate(
    {
      $or: [
        { isLocked: false },
        { isLocked: true, lockedAt: { $lt: lockExpiredTime } }
      ]
    },
    {
      $set: {
        isLocked: true,
        lockedBy: paymentToken,
        lockedAt: new Date(),
        lastUsedAt: new Date()
      }
    },
    {
      new: true,
      sort: { lastUsedAt: 1 } // Use least recently used form
    }
  );
  
  return form;
};

// Static method to release expired locks
formPoolSchema.statics.releaseExpiredLocks = async function(lockTimeoutMinutes = 10) {
  const lockExpiredTime = new Date(Date.now() - lockTimeoutMinutes * 60 * 1000);
  
  const result = await this.updateMany(
    {
      isLocked: true,
      lockedAt: { $lt: lockExpiredTime }
    },
    {
      $set: { isLocked: false },
      $unset: { lockedBy: 1, lockedAt: 1 }
    }
  );
  
  return result.modifiedCount;
};

module.exports = mongoose.model('FormPool', formPoolSchema);