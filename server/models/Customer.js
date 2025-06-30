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
  // Social authentication accounts
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
  registrationMethod: {
    type: String,
    enum: ['traditional', 'google', 'facebook', 'linkedin', 'social'],
    default: 'traditional'
  },
  // Payment is now handled entirely by Paygistix
  // No payment information is stored in our database
  // Bag information
  numberOfBags: { type: Number, default: 1 },
  bagCredit: { type: Number, default: 0 }, // Credit to be applied on first order
  bagCreditApplied: { type: Boolean, default: false }, // Track if credit has been used
  isActive: { type: Boolean, default: true },
  registrationDate: { type: Date, default: Date.now },
  lastLogin: Date,
  // Language preference for communications
  languagePreference: {
    type: String,
    enum: ['en', 'es', 'pt', 'de'],
    default: 'en'
  }
}, { timestamps: true });

// No longer need encryption middleware as payment data is not stored

// Create model
const Customer = mongoose.model('Customer', customerSchema);

module.exports = Customer;