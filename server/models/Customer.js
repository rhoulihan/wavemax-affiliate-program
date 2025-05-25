// Customer Model for WaveMAX Laundry Affiliate Program

const mongoose = require('mongoose');
const encryptionUtil = require('../utils/encryption');

// Customer Schema
const customerSchema = new mongoose.Schema({
  customerId: {
    type: String,
    default: () => 'CUST' + Math.floor(100000 + Math.random() * 900000),
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
  deliveryInstructions: String,
  serviceFrequency: {
    type: String,
    enum: ['weekly', 'biweekly', 'monthly', 'onDemand'],
    required: true
  },
  preferredDay: String,
  preferredTime: String,
  specialInstructions: String,
  username: { type: String, required: true, unique: true },
  passwordSalt: { type: String, required: true },
  passwordHash: { type: String, required: true },
  // Encrypted payment fields
  cardholderName: {
    iv: String,
    encryptedData: String,
    authTag: String
  },
  lastFourDigits: String, // Only store last 4 digits of card
  expiryDate: {
    iv: String,
    encryptedData: String,
    authTag: String
  },
  billingZip: String,
  savePaymentInfo: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  registrationDate: { type: Date, default: Date.now },
  lastLogin: Date
}, { timestamps: true });

// Middleware for encrypting sensitive payment data before saving
customerSchema.pre('save', function(next) {
  if (this.isModified('cardholderName') && this.cardholderName && typeof this.cardholderName === 'string') {
    this.cardholderName = encryptionUtil.encrypt(this.cardholderName);
  }

  if (this.isModified('expiryDate') && this.expiryDate && typeof this.expiryDate === 'string') {
    this.expiryDate = encryptionUtil.encrypt(this.expiryDate);
  }

  next();
});

// Create model
const Customer = mongoose.model('Customer', customerSchema);

module.exports = Customer;