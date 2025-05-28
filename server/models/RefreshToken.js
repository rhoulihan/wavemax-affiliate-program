const mongoose = require('mongoose');

// RefreshToken Schema
const refreshTokenSchema = new mongoose.Schema({
  token: { type: String, required: true, unique: true },
  userId: { type: mongoose.Schema.Types.ObjectId, required: true },
  userType: { type: String, enum: ['affiliate', 'customer', 'administrator', 'operator'], required: true },
  expiryDate: { type: Date, required: true },
  isRevoked: { type: Boolean, default: false },
  createdByIp: String
}, { timestamps: true });

// Add index for fast lookups and automatic cleanup
refreshTokenSchema.index({ expiryDate: 1 }, { expireAfterSeconds: 0 });

// Create model
const RefreshToken = mongoose.model('RefreshToken', refreshTokenSchema);

module.exports = RefreshToken;