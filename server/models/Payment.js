const mongoose = require('mongoose');

const RefundSchema = new mongoose.Schema({
  refundId: {
    type: String,
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  reason: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const PaymentSchema = new mongoose.Schema({
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true,
    index: true
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true,
    index: true
  },
  paymentMethodId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PaymentMethod',
    required: true
  },
  paygistixId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  transactionId: {
    type: String,
    sparse: true,
    index: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    required: true,
    uppercase: true,
    default: 'USD',
    enum: ['USD', 'EUR', 'GBP', 'CAD', 'AUD']
  },
  status: {
    type: String,
    required: true,
    enum: [
      'pending',
      'processing',
      'authorized',
      'captured',
      'succeeded',
      'failed',
      'canceled',
      'refunded',
      'partially_refunded',
      'disputed'
    ],
    default: 'pending',
    index: true
  },
  capturedAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  refundedAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  refunds: [RefundSchema],
  failureReason: {
    type: String
  },
  failureCode: {
    type: String
  },
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  },
  response: {
    type: mongoose.Schema.Types.Mixed
  },
  capturedAt: {
    type: Date
  },
  failedAt: {
    type: Date
  },
  lastRefundAt: {
    type: Date
  },
  // Dispute tracking
  hasDispute: {
    type: Boolean,
    default: false
  },
  disputeStatus: {
    type: String,
    enum: ['warning_needs_response', 'warning_under_review', 'warning_closed', 'needs_response', 'under_review', 'charge_refunded', 'won', 'lost']
  },
  disputeReason: {
    type: String
  },
  disputeAmount: {
    type: Number,
    min: 0
  },
  disputeCreatedAt: {
    type: Date
  },
  disputeUpdatedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
PaymentSchema.index({ orderId: 1, status: 1 });
PaymentSchema.index({ customerId: 1, createdAt: -1 });
PaymentSchema.index({ status: 1, createdAt: -1 });
PaymentSchema.index({ paygistixId: 1 });

// Virtual for net amount (captured - refunded)
PaymentSchema.virtual('netAmount').get(function() {
  return this.capturedAmount - this.refundedAmount;
});

// Method to check if payment can be refunded
PaymentSchema.methods.canRefund = function(amount = null) {
  if (this.status !== 'captured' && this.status !== 'partially_refunded') {
    return false;
  }
  
  const availableAmount = this.capturedAmount - this.refundedAmount;
  
  if (amount === null) {
    return availableAmount > 0;
  }
  
  return amount <= availableAmount;
};

// Method to check if payment can be captured
PaymentSchema.methods.canCapture = function() {
  return this.status === 'authorized';
};

// Method to add refund
PaymentSchema.methods.addRefund = function(refundId, amount, reason) {
  this.refunds.push({
    refundId,
    amount,
    reason
  });
  
  this.refundedAmount += amount;
  this.lastRefundAt = new Date();
  
  if (this.refundedAmount >= this.capturedAmount) {
    this.status = 'refunded';
  } else {
    this.status = 'partially_refunded';
  }
};

// Static method to find payments by order
PaymentSchema.statics.findByOrder = function(orderId) {
  return this.find({ orderId }).sort({ createdAt: -1 });
};

// Static method to find successful payments by customer
PaymentSchema.statics.findSuccessfulByCustomer = function(customerId, limit = 10) {
  return this.find({ 
    customerId, 
    status: { $in: ['captured', 'succeeded'] } 
  })
  .sort({ createdAt: -1 })
  .limit(limit);
};

// Static method to calculate total revenue for a period
PaymentSchema.statics.calculateRevenue = async function(startDate, endDate) {
  const result = await this.aggregate([
    {
      $match: {
        status: { $in: ['captured', 'succeeded', 'partially_refunded'] },
        capturedAt: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: '$currency',
        totalCaptured: { $sum: '$capturedAmount' },
        totalRefunded: { $sum: '$refundedAmount' },
        count: { $sum: 1 }
      }
    },
    {
      $project: {
        currency: '$_id',
        totalCaptured: 1,
        totalRefunded: 1,
        netRevenue: { $subtract: ['$totalCaptured', '$totalRefunded'] },
        count: 1,
        _id: 0
      }
    }
  ]);

  return result;
};

// Middleware to prevent modification of certain fields
PaymentSchema.pre('save', function(next) {
  if (this.isModified('paygistixId') && !this.isNew) {
    return next(new Error('Paygistix ID cannot be modified'));
  }
  
  if (this.isModified('orderId') && !this.isNew) {
    return next(new Error('Order ID cannot be modified'));
  }
  
  next();
});

// JSON transformation
PaymentSchema.set('toJSON', {
  transform: function(doc, ret) {
    delete ret.__v;
    delete ret.response; // Don't expose raw API response
    return ret;
  }
});

module.exports = mongoose.model('Payment', PaymentSchema);