// OAuthSession Model for WaveMAX Laundry Affiliate Program
// Stores temporary OAuth session results with automatic expiration

const mongoose = require('mongoose');

const oAuthSessionSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  result: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    default: function() {
      return new Date(Date.now() + 5 * 60 * 1000); // 5 minutes from now
    }
  }
});

// TTL index to automatically remove expired sessions after 5 minutes
oAuthSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Static method to create a new OAuth session
oAuthSessionSchema.statics.createSession = async function(sessionId, result) {
  try {
    const session = await this.create({
      sessionId,
      result
    });
    return session;
  } catch (error) {
    if (error.code === 11000) {
      // Session ID already exists
      throw new Error('Session ID already exists');
    }
    throw error;
  }
};

// Static method to retrieve OAuth session result
oAuthSessionSchema.statics.getSession = async function(sessionId) {
  const session = await this.findOne({ sessionId });
  return session ? session.result : null;
};

// Static method to consume (retrieve and delete) OAuth session
oAuthSessionSchema.statics.consumeSession = async function(sessionId) {
  const session = await this.findOneAndDelete({ sessionId });
  return session ? session.result : null;
};

// Static method to cleanup expired sessions (manual cleanup if needed)
oAuthSessionSchema.statics.cleanupExpired = async function() {
  const now = new Date();
  const result = await this.deleteMany({ expiresAt: { $lt: now } });
  return result.deletedCount;
};

const OAuthSession = mongoose.model('OAuthSession', oAuthSessionSchema);

module.exports = OAuthSession;