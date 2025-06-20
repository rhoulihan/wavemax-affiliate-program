const mongoose = require('mongoose');

const CardSchema = new mongoose.Schema({
  last4: {
    type: String,
    required: true,
    minlength: 4,
    maxlength: 4
  },
  brand: {
    type: String,
    required: true,
    enum: ['visa', 'mastercard', 'amex', 'discover', 'diners', 'jcb', 'unionpay']
  },
  expiryMonth: {
    type: Number,
    required: true,
    min: 1,
    max: 12
  },
  expiryYear: {
    type: Number,
    required: true,
    min: new Date().getFullYear()
  },
  fingerprint: {
    type: String,
    required: true,
    index: true
  }
}, { _id: false });

const BankAccountSchema = new mongoose.Schema({
  last4: {
    type: String,
    required: true,
    minlength: 4,
    maxlength: 4
  },
  bankName: {
    type: String,
    required: true
  },
  accountType: {
    type: String,
    enum: ['checking', 'savings'],
    required: true
  },
  fingerprint: {
    type: String,
    required: true,
    index: true
  }
}, { _id: false });

const PaymentMethodSchema = new mongoose.Schema({
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true,
    index: true
  },
  paygistixId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  type: {
    type: String,
    required: true,
    enum: ['card', 'bank_account', 'wallet'],
    default: 'card'
  },
  card: {
    type: CardSchema,
    required: function() {
      return this.type === 'card';
    }
  },
  bankAccount: {
    type: BankAccountSchema,
    required: function() {
      return this.type === 'bank_account';
    }
  },
  walletType: {
    type: String,
    enum: ['apple_pay', 'google_pay', 'paypal'],
    required: function() {
      return this.type === 'wallet';
    }
  },
  isDefault: {
    type: Boolean,
    default: false,
    index: true
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  verifiedAt: {
    type: Date
  },
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  },
  lastUsedAt: {
    type: Date
  },
  deletedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Compound indexes
PaymentMethodSchema.index({ customerId: 1, isActive: 1, isDefault: -1 });
PaymentMethodSchema.index({ customerId: 1, type: 1, isActive: 1 });

// Virtual for display name
PaymentMethodSchema.virtual('displayName').get(function() {
  if (this.type === 'card' && this.card) {
    return `${this.card.brand.toUpperCase()} •••• ${this.card.last4}`;
  } else if (this.type === 'bank_account' && this.bankAccount) {
    return `${this.bankAccount.bankName} •••• ${this.bankAccount.last4}`;
  } else if (this.type === 'wallet') {
    return this.walletType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  }
  return 'Unknown Payment Method';
});

// Virtual to check if expired (for cards)
PaymentMethodSchema.virtual('isExpired').get(function() {
  if (this.type !== 'card' || !this.card) {
    return false;
  }

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  if (this.card.expiryYear < currentYear) {
    return true;
  }

  if (this.card.expiryYear === currentYear && this.card.expiryMonth < currentMonth) {
    return true;
  }

  return false;
});

// Method to check if payment method can be used
PaymentMethodSchema.methods.canUse = function() {
  if (!this.isActive) {
    return { canUse: false, reason: 'Payment method is inactive' };
  }

  if (this.isExpired) {
    return { canUse: false, reason: 'Payment method is expired' };
  }

  if (this.type === 'bank_account' && !this.isVerified) {
    return { canUse: false, reason: 'Bank account needs verification' };
  }

  return { canUse: true };
};

// Method to mark as used
PaymentMethodSchema.methods.markAsUsed = function() {
  this.lastUsedAt = new Date();
  return this.save();
};

// Static method to find default payment method for customer
PaymentMethodSchema.statics.findDefault = function(customerId) {
  return this.findOne({
    customerId,
    isActive: true,
    isDefault: true
  });
};

// Static method to find active payment methods for customer
PaymentMethodSchema.statics.findActiveByCustomer = function(customerId) {
  return this.find({
    customerId,
    isActive: true
  }).sort({ isDefault: -1, createdAt: -1 });
};

// Static method to check for duplicate cards
PaymentMethodSchema.statics.checkDuplicate = async function(customerId, fingerprint) {
  const existing = await this.findOne({
    customerId,
    'card.fingerprint': fingerprint,
    isActive: true
  });

  return existing;
};

// Middleware to ensure only one default payment method per customer
PaymentMethodSchema.pre('save', async function(next) {
  if (this.isModified('isDefault') && this.isDefault) {
    // Remove default from other payment methods
    await this.constructor.updateMany(
      {
        customerId: this.customerId,
        _id: { $ne: this._id },
        isDefault: true
      },
      { isDefault: false }
    );
  }

  // Prevent modification of certain fields
  if (this.isModified('paygistixId') && !this.isNew) {
    return next(new Error('Paygistix ID cannot be modified'));
  }

  if (this.isModified('customerId') && !this.isNew) {
    return next(new Error('Customer ID cannot be modified'));
  }

  next();
});

// Middleware to set first payment method as default
PaymentMethodSchema.pre('save', async function(next) {
  if (this.isNew && this.isActive) {
    const count = await this.constructor.countDocuments({
      customerId: this.customerId,
      isActive: true
    });

    if (count === 0) {
      this.isDefault = true;
    }
  }

  next();
});

// JSON transformation
PaymentMethodSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    delete ret.__v;
    delete ret.paygistixId; // Don't expose external IDs
    return ret;
  }
});

module.exports = mongoose.model('PaymentMethod', PaymentMethodSchema);