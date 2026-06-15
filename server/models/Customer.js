// Customer Model for WaveMAX Laundry Affiliate Program

const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

// Customer Schema
const customerSchema = new mongoose.Schema({
  customerId: {
    type: String,
    default: () => 'CUST-' + uuidv4(),
    unique: true
  },
  affiliateId: { type: String, required: true, ref: 'Affiliate' },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String, required: true },
  address: { type: String, required: true },
  city: { type: String, required: true },
  state: { type: String, required: true },
  zipCode: { type: String, required: true },
  serviceFrequency: { type: String, enum: ['weekly', 'biweekly', 'monthly'], default: 'weekly' },
  deliveryInstructions: String,
  specialInstructions: String,
  affiliateSpecialInstructions: String,
  username: { type: String, required: true, unique: true },
  passwordSalt: { type: String, required: true },
  passwordHash: { type: String, required: true },
  // Payment is handled externally in Cents. No payment information is stored.
  isActive: { type: Boolean, default: true },
  registrationDate: { type: Date, default: Date.now },
  lastLogin: Date,
  // H-5 per-account login lockout (mirrors Administrator + Affiliate).
  // Five failed password attempts in any window → 2-hour lock. Resets on
  // success. Closes the credential-stuffing-via-rotating-IPs path.
  // prod-lockdown-2026-05-20.
  loginAttempts: { type: Number, default: 0 },
  lockUntil: Date,
  // Language preference for communications
  languagePreference: {
    type: String,
    enum: ['en', 'es', 'pt', 'de'],
    default: 'en'
  },
  // Bag label tracking
  bagLabelsGenerated: {
    type: Boolean,
    default: false
  },
  bagLabelsGeneratedAt: Date,
  bagLabelsGeneratedBy: String // operatorId who printed
}, { timestamps: true });

// No longer need encryption middleware as payment data is not stored

// ── H-5 account lockout (mirrors Administrator + Affiliate) ────────────
customerSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

customerSchema.methods.incLoginAttempts = function() {
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $set: { loginAttempts: 1 },
      $unset: { lockUntil: 1 }
    });
  }
  const updates = { $inc: { loginAttempts: 1 } };
  const maxAttempts = 5;
  const lockTime = 2 * 60 * 60 * 1000; // 2 hours
  if (this.loginAttempts + 1 >= maxAttempts && !this.isLocked) {
    updates.$set = { lockUntil: new Date(Date.now() + lockTime) };
  }
  return this.updateOne(updates);
};

customerSchema.methods.resetLoginAttempts = function() {
  return this.updateOne({
    $set: { loginAttempts: 0, lastLogin: new Date() },
    $unset: { lockUntil: 1 }
  });
};

// Create model
const Customer = mongoose.model('Customer', customerSchema);

module.exports = Customer;