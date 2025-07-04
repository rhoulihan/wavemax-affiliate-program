// PaymentExport Model for WaveMAX Laundry Affiliate Program
// Tracks QuickBooks export generation for vendor and payment data

const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

// PaymentExport Schema
const paymentExportSchema = new mongoose.Schema({
  exportId: {
    type: String,
    default: () => 'EXP-' + uuidv4(),
    unique: true
  },
  type: {
    type: String,
    enum: ['vendor', 'payment_summary', 'commission_detail'],
    required: true
  },
  // Period covered by this export
  periodStart: {
    type: Date,
    required: function() {
      return this.type === 'payment_summary' || this.type === 'commission_detail';
    }
  },
  periodEnd: {
    type: Date,
    required: function() {
      return this.type === 'payment_summary' || this.type === 'commission_detail';
    }
  },
  // Affiliates included in this export
  affiliateIds: [{
    type: String,
    ref: 'Affiliate'
  }],
  // Orders included (for payment summaries)
  orderIds: [{
    type: String,
    ref: 'Order'
  }],
  // Export metadata
  generatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Administrator',
    required: true
  },
  generatedAt: {
    type: Date,
    default: Date.now
  },
  filename: {
    type: String,
    required: true
  },
  format: {
    type: String,
    enum: ['csv', 'qbo', 'iif', 'json'], // QuickBooks formats + json for API responses
    default: 'csv'
  },
  // Export content summary
  recordCount: {
    type: Number,
    default: 0
  },
  totalAmount: {
    type: Number,
    default: 0
  },
  // Tracking
  status: {
    type: String,
    enum: ['generated', 'downloaded', 'imported', 'failed'],
    default: 'generated'
  },
  downloadedAt: Date,
  downloadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Administrator'
  },
  downloadCount: {
    type: Number,
    default: 0
  },
  // QuickBooks import tracking
  quickbooksImportDate: Date,
  quickbooksImportedBy: String,
  quickbooksImportStatus: {
    type: String,
    enum: ['pending', 'success', 'partial', 'failed']
  },
  quickbooksImportNotes: String,
  // Export data snapshot (for regeneration if needed)
  exportData: {
    vendors: [{
      affiliateId: String,
      displayName: String,
      taxIdLast4: String,
      businessName: String,
      email: String,
      address: String,
      totalCommissions: Number
    }],
    payments: [{
      affiliateId: String,
      orderId: String,
      amount: Number,
      date: Date,
      description: String
    }],
    summary: {
      totalVendors: Number,
      totalPayments: Number,
      totalAmount: Number
    }
  },
  // Notes and error tracking
  notes: String,
  exportErrors: [{
    affiliateId: String,
    error: String,
    timestamp: Date
  }]
}, {
  timestamps: true
});

// Indexes
paymentExportSchema.index({ type: 1, generatedAt: -1 });
paymentExportSchema.index({ periodStart: 1, periodEnd: 1 });
paymentExportSchema.index({ status: 1 });

// Method to mark as downloaded
paymentExportSchema.methods.markDownloaded = function(adminId) {
  this.downloadedAt = new Date();
  this.downloadedBy = adminId;
  this.downloadCount += 1;
  if (this.status === 'generated') {
    this.status = 'downloaded';
  }
  return this.save();
};

// Method to update import status
paymentExportSchema.methods.updateImportStatus = function(status, importedBy, notes) {
  this.quickbooksImportDate = new Date();
  this.quickbooksImportedBy = importedBy;
  this.quickbooksImportStatus = status;
  this.quickbooksImportNotes = notes;
  if (status === 'success') {
    this.status = 'imported';
  }
  return this.save();
};

// Static method to find exports for a period
paymentExportSchema.statics.findByPeriod = function(startDate, endDate, type) {
  const query = {
    periodStart: { $gte: startDate },
    periodEnd: { $lte: endDate }
  };
  if (type) {
    query.type = type;
  }
  return this.find(query).sort({ generatedAt: -1 });
};

// Static method to check if export exists for period
paymentExportSchema.statics.existsForPeriod = function(startDate, endDate, type) {
  return this.findOne({
    periodStart: startDate,
    periodEnd: endDate,
    type: type,
    status: { $ne: 'failed' }
  });
};

// Virtual for export age
paymentExportSchema.virtual('ageInDays').get(function() {
  const now = new Date();
  const diffTime = Math.abs(now - this.generatedAt);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
});

// Create model
const PaymentExport = mongoose.model('PaymentExport', paymentExportSchema);

module.exports = PaymentExport;