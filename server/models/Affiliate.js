// Affiliate Model for WaveMAX Laundry Affiliate Program

const mongoose = require('mongoose');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const encryptionUtil = require('../utils/encryption');

// Affiliate Schema
const affiliateSchema = new mongoose.Schema({
  affiliateId: {
    type: String,
    default: () => 'AFF-' + uuidv4(),
    unique: true
  },
  // 'standard' = independent commission-earning affiliate.
  // 'location'  = WaveMAX-operated collection point (a contact + address where
  // bags are dropped/collected on a schedule) — earns ZERO commission, ever.
  // Created manually by an administrator, never via invite.
  affiliateType: {
    type: String,
    enum: ['standard', 'location'],
    default: 'standard'
  },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String, required: true },
  businessName: String,
  address: { type: String, required: true },
  city: { type: String, required: true },
  state: { type: String, required: true },
  zipCode: { type: String, required: true }, // Keep required for now - can geocode later
  // Delivery fee structure
  minimumDeliveryFee: {
    type: Number,
    required: true,
    default: 25,
    min: 0,
    max: 100
  },
  perBagDeliveryFee: {
    type: Number,
    required: true,
    default: 5,
    min: 0,
    max: 50
  },
  // Vendor (affiliate) delivery code — short secret used to confirm door
  // deliveries on the overloaded claim URL (spec §4.6/§6.6). Verified only
  // against THIS order's affiliate. "pbkdf2hash:salt" via utils/roleCodes.
  // NOT the login password.
  affiliateDeliveryCodeHash: { type: String, select: false },
  affiliateDeliveryCodeSetAt: Date,
  username: { type: String, required: true, unique: true },
  passwordSalt: { type: String, required: true },
  passwordHash: { type: String, required: true },
  // Encrypted payment fields
  paymentMethod: {
    type: String,
    required: true,
    enum: ['check', 'paypal', 'venmo']
  },
  paypalEmail: {
    type: mongoose.Schema.Types.Mixed,
    default: undefined
  },
  venmoHandle: {
    type: mongoose.Schema.Types.Mixed,
    default: undefined
  },
  isActive: { type: Boolean, default: true },
  dateRegistered: { type: Date, default: Date.now },
  lastLogin: Date,
  // H-5 per-account login lockout (mirrors Administrator). Five failed
  // password attempts in any window → 2-hour lock. Resets on success.
  // Closes the credential-stuffing-via-rotating-IPs path the per-IP
  // rate limiter alone doesn't catch. prod-lockdown-2026-05-20.
  loginAttempts: { type: Number, default: 0 },
  lockUntil: Date,
  // Password reset fields
  resetToken: String,
  resetTokenExpiry: Date,
  // Virtual password field for input (gets hashed into passwordSalt/passwordHash)
  password: {
    type: String,
    required: false // Will be hashed and removed in pre-save middleware
  },
  // Language preference for communications
  languagePreference: {
    type: String,
    enum: ['en', 'es', 'pt', 'de'],
    default: 'en'
  }
}, {
  timestamps: true,
  toObject: { virtuals: true },
  toJSON: { virtuals: true }
});

// Virtual field for full name
affiliateSchema.virtual('name').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Middleware for password hashing. Runs on validate (not save) so the derived
// passwordSalt/passwordHash are populated before the required-field validators
// run when a caller sets only the virtual `password`.
affiliateSchema.pre('validate', function(next) {
  // Hash password if it's modified and provided as plain text, but only if passwordHash is not already set
  if (this.isModified('password') && this.password && !this.passwordHash) {
    const { salt, hash } = encryptionUtil.hashPassword(this.password);
    this.passwordSalt = salt;
    this.passwordHash = hash;
    this.password = undefined; // Remove plain text password
  }

  next();
});

// Middleware for encrypting sensitive payment data before saving
affiliateSchema.pre('save', function(next) {
  if (this.isModified('paypalEmail') && this.paypalEmail && typeof this.paypalEmail === 'string') {
    this.paypalEmail = encryptionUtil.encrypt(this.paypalEmail);
  }

  if (this.isModified('venmoHandle') && this.venmoHandle && typeof this.venmoHandle === 'string') {
    this.venmoHandle = encryptionUtil.encrypt(this.venmoHandle);
  }

  next();
});

// Method to check if affiliate can receive commission payouts
affiliateSchema.methods.canReceivePayments = function() {
  return this.isActive;
};

// ── H-5 account lockout (mirrors Administrator) ────────────────────────
affiliateSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

affiliateSchema.methods.incLoginAttempts = function() {
  // Lock has expired → reset to a fresh count of 1
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

affiliateSchema.methods.resetLoginAttempts = function() {
  return this.updateOne({
    $set: { loginAttempts: 0, lastLogin: new Date() },
    $unset: { lockUntil: 1 }
  });
};

// Create model
const Affiliate = mongoose.model('Affiliate', affiliateSchema);

module.exports = Affiliate;