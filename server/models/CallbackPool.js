const mongoose = require('mongoose');

const callbackPoolSchema = new mongoose.Schema({
  callbackPath: {
    type: String,
    required: true,
    unique: true,
    index: true
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
  },
  usageCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Compound index for finding available callbacks
callbackPoolSchema.index({ isLocked: 1, lastUsedAt: 1 });

// Instance method to lock callback
callbackPoolSchema.methods.lock = function(paymentToken) {
  this.isLocked = true;
  this.lockedBy = paymentToken;
  this.lockedAt = new Date();
  this.lastUsedAt = new Date();
  this.usageCount += 1;
  return this.save();
};

// Instance method to release callback
callbackPoolSchema.methods.release = function() {
  this.isLocked = false;
  this.lockedBy = null;
  this.lockedAt = null;
  return this.save();
};

// Static method to acquire available callback URL
callbackPoolSchema.statics.acquireCallback = async function(paymentToken, lockTimeoutMinutes = 10) {
  const lockExpiredTime = new Date(Date.now() - lockTimeoutMinutes * 60 * 1000);

  // Try to find and lock an available callback atomically
  const callback = await this.findOneAndUpdate(
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
      },
      $inc: { usageCount: 1 }
    },
    {
      new: true,
      sort: { lastUsedAt: 1 } // Use least recently used callback
    }
  );

  return callback;
};

// Static method to release a callback by payment token
callbackPoolSchema.statics.releaseCallback = async function(paymentToken) {
  const callback = await this.findOneAndUpdate(
    { lockedBy: paymentToken },
    {
      $set: {
        isLocked: false,
        lockedBy: null,
        lockedAt: null
      }
    },
    { new: true }
  );

  return callback;
};

// Static method to release expired locks
callbackPoolSchema.statics.releaseExpiredLocks = async function(lockTimeoutMinutes = 10) {
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

module.exports = mongoose.model('CallbackPool', callbackPoolSchema);