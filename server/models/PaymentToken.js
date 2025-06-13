const mongoose = require('mongoose');

const paymentTokenSchema = new mongoose.Schema({
  token: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'success', 'failed', 'cancelled'],
    default: 'pending'
  },
  customerData: {
    type: Object,
    required: true
  },
  paymentData: {
    amount: Number,
    items: [{
      code: String,
      description: String,
      price: Number,
      quantity: Number
    }],
    formId: String,
    merchantId: String
  },
  // Removed assignedFormId - all use same Paygistix form
  callbackPath: {
    type: String,
    default: null
  },
  paygistixResponse: {
    type: Object,
    default: null
  },
  errorMessage: {
    type: String,
    default: null
  },
  transactionId: {
    type: String,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 3600 // Token expires after 1 hour
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt timestamp on save
paymentTokenSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Static method to generate unique token
paymentTokenSchema.statics.generateToken = function() {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 9);
  return `${timestamp}-${randomStr}`;
};

const PaymentToken = mongoose.model('PaymentToken', paymentTokenSchema);

module.exports = PaymentToken;