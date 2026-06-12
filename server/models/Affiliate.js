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
  passwordSalt: {
    type: String,
    required: function() {
      return this.registrationMethod === 'traditional' || !this.registrationMethod;
    }
  },
  passwordHash: {
    type: String,
    required: function() {
      return this.registrationMethod === 'traditional' || !this.registrationMethod;
    }
  },
  // Encrypted payment fields
  paymentMethod: {
    type: String,
    required: function() {
      return this.registrationMethod === 'traditional' || !this.registrationMethod;
    },
    enum: ['check', 'paypal', 'venmo'],
    default: function() {
      if (this.registrationMethod && this.registrationMethod !== 'traditional') {
        return 'check'; // Default for social registrations
      }
      return undefined;
    }
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
  // Social media account connections
  socialAccounts: {
    google: {
      id: String,
      email: String,
      name: String,
      accessToken: String,
      refreshToken: String,
      linkedAt: Date
    },
    facebook: {
      id: String,
      email: String,
      name: String,
      accessToken: String,
      linkedAt: Date
    },
    linkedin: {
      id: String,
      email: String,
      name: String,
      accessToken: String,
      refreshToken: String,
      linkedAt: Date
    }
  },
  // Registration method
  registrationMethod: {
    type: String,
    enum: ['traditional', 'google', 'facebook', 'linkedin', 'social'],
    default: 'traditional'
  },
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
  },
  // W-9 tax info (in-app encrypted upload + admin review — spec §4.3)
  w9Status: {
    type: String,
    enum: ['not_required', 'required', 'pending_review', 'on_file', 'rejected'],
    default: 'not_required'
  },
  w9OnFileAt: Date,
  taxIdLast4: String,                  // last 4 digits, for admin display only
  // Encrypted W-9 document metadata — the bytes live in secureFileStore
  // under W9_STORAGE_PATH, never in the DB (spec §13 #7).
  w9Document: {
    storageKey: String,                // e.g. aff/<affiliateId>/<uuid>.enc
    filename: String,                  // sanitized original filename
    contentType: { type: String, enum: ['application/pdf', 'image/jpeg', 'image/png'] },
    sizeBytes: Number,
    sha256: String,                    // integrity hash of the plaintext bytes
    submittedAt: Date
  },
  w9SubmittedAt: Date,
  w9VerifiedAt: Date,
  w9VerifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Administrator' },
  w9RejectedAt: Date,
  w9RejectedReason: String,
  // Payment processing lock (set automatically when YTD earnings cross the W-9
  // reporting threshold; cleared manually by an admin after the W-9 is on file)
  paymentProcessingLocked: { type: Boolean, default: false },
  paymentLockedAt: Date,
  paymentLockReason: String,           // e.g. 'w9_required', 'admin_hold', 'compliance_review'
  paymentUnlockedAt: Date,
  paymentUnlockedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Administrator' },
  paymentUnlockNotes: String,
  // QuickBooks vendor linkage
  quickbooksVendorId: String,
  quickbooksData: {
    displayName: String,
    vendorType: { type: String, default: '1099 Contractor' },
    terms: { type: String, default: 'Net 15' },
    defaultExpenseAccount: { type: String, default: 'Commission Expense' }
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

// Middleware for password hashing before saving
affiliateSchema.pre('save', function(next) {
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
  return !this.paymentProcessingLocked && this.isActive;
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