// Affiliate Model for WaveMAX Laundry Affiliate Program

const mongoose = require('mongoose');
const crypto = require('crypto');
const encryptionUtil = require('../utils/encryption');

// Affiliate Schema
const affiliateSchema = new mongoose.Schema({
  affiliateId: {
    type: String,
    default: () => 'AFF' + Math.floor(100000 + Math.random() * 900000),
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
  deliveryFee: { type: Number, required: true },
  username: { type: String, required: true, unique: true },
  passwordSalt: { type: String, required: true },
  passwordHash: { type: String, required: true },
  // Encrypted payment fields
  paymentMethod: {
    type: String,
    required: true,
    enum: ['directDeposit', 'check', 'paypal']
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
  lastLogin: Date
}, { timestamps: true });

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