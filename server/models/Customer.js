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
  // PR 7: registration-only — no customer login/portal in Phase 1, so there is
  // no username or password. Verified contact info is the only identity stored.
  // (PR 6 removed the customer auth surface; PR 7 removes the dead credentials.)
  emailVerifiedAt: Date,   // set when the email OTP is confirmed
  phoneVerifiedAt: Date,   // set when the Firebase phone token verifies (flag on)
  // Payment is handled externally in Cents. No payment information is stored.
  isActive: { type: Boolean, default: true },
  registrationDate: { type: Date, default: Date.now },
  lastLogin: Date,
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

// No longer need encryption middleware as payment data is not stored.
// No login lockout machinery: Phase 1 customers have no password/login (PR 7).

// Create model
const Customer = mongoose.model('Customer', customerSchema);

module.exports = Customer;