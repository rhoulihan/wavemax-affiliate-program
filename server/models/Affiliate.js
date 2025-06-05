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
  zipCode: { type: String, required: true },
  serviceArea: { type: String, required: true },
  deliveryFee: { type: Number, required: true }, // Legacy field for backward compatibility
  // New delivery fee structure (optional overrides)
  minimumDeliveryFee: { 
    type: Number, 
    default: null, // null means use system default
    min: 0,
    max: 100
  },
  perBagDeliveryFee: { 
    type: Number, 
    default: null, // null means use system default
    min: 0,
    max: 20
  },
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
    enum: ['directDeposit', 'check', 'paypal'],
    default: function() {
      if (this.registrationMethod && this.registrationMethod !== 'traditional') {
        return 'check'; // Default for social registrations
      }
      return undefined;
    }
  },
  accountNumber: {
    type: mongoose.Schema.Types.Mixed,
    default: undefined
  },
  routingNumber: {
    type: mongoose.Schema.Types.Mixed,
    default: undefined
  },
  paypalEmail: {
    type: mongoose.Schema.Types.Mixed,
    default: undefined
  },
  isActive: { type: Boolean, default: true },
  dateRegistered: { type: Date, default: Date.now },
  lastLogin: Date,
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
  if (this.isModified('accountNumber') && this.accountNumber && typeof this.accountNumber === 'string') {
    this.accountNumber = encryptionUtil.encrypt(this.accountNumber);
  }

  if (this.isModified('routingNumber') && this.routingNumber && typeof this.routingNumber === 'string') {
    this.routingNumber = encryptionUtil.encrypt(this.routingNumber);
  }

  if (this.isModified('paypalEmail') && this.paypalEmail && typeof this.paypalEmail === 'string') {
    this.paypalEmail = encryptionUtil.encrypt(this.paypalEmail);
  }

  next();
});

// Create model
const Affiliate = mongoose.model('Affiliate', affiliateSchema);

module.exports = Affiliate;