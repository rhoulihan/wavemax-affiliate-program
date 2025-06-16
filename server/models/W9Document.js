// W9Document Model for WaveMAX Laundry Affiliate Program
// Tracks uploaded W-9 tax forms for affiliates

const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

// W9Document Schema
const w9DocumentSchema = new mongoose.Schema({
  documentId: {
    type: String,
    default: () => 'W9DOC-' + uuidv4(),
    unique: true
  },
  affiliateId: { 
    type: String, 
    required: true, 
    ref: 'Affiliate',
    index: true 
  },
  filename: {
    type: String,
    required: true
  },
  originalName: {
    type: String,
    required: true
  },
  mimeType: {
    type: String,
    required: true,
    enum: ['application/pdf'] // Only accept PDFs
  },
  size: {
    type: Number,
    required: true,
    max: 5242880 // 5MB limit
  },
  storageKey: {
    type: String,
    required: true,
    unique: true // Encrypted file reference
  },
  uploadedAt: { 
    type: Date, 
    default: Date.now 
  },
  uploadedBy: {
    type: String,
    required: true // affiliateId or administratorId
  },
  uploadMethod: {
    type: String,
    enum: ['affiliate_upload', 'admin_upload', 'email_attachment'],
    default: 'affiliate_upload'
  },
  isActive: { 
    type: Boolean, 
    default: true 
  },
  // Audit fields
  metadata: {
    ipAddress: String,
    userAgent: String,
    sessionId: String
  },
  // Verification tracking
  verificationStatus: {
    type: String,
    enum: ['pending', 'verified', 'rejected'],
    default: 'pending'
  },
  verifiedAt: Date,
  verifiedBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Administrator' 
  },
  // Document expiry
  expiryDate: {
    type: Date,
    default: function() {
      // W-9 forms typically valid for 3 years
      const date = new Date();
      date.setFullYear(date.getFullYear() + 3);
      return date;
    }
  },
  // Soft delete support
  deleted: {
    type: Boolean,
    default: false
  },
  deletedAt: Date,
  deletedBy: String,
  deletionReason: String,
  // Legal hold
  legalHold: {
    type: Boolean,
    default: false
  },
  legalHoldReason: String,
  legalHoldDate: Date
}, { 
  timestamps: true 
});

// Indexes for efficient querying
w9DocumentSchema.index({ affiliateId: 1, isActive: 1 });
w9DocumentSchema.index({ verificationStatus: 1 });
w9DocumentSchema.index({ expiryDate: 1 });

// Method to check if document is valid
w9DocumentSchema.methods.isValid = function() {
  return this.isActive && 
         this.verificationStatus === 'verified' && 
         this.expiryDate > new Date() &&
         !this.deletedAt;
};

// Method to soft delete document
w9DocumentSchema.methods.softDelete = function(deletedBy, reason) {
  this.deletedAt = new Date();
  this.deletedBy = deletedBy;
  this.deletionReason = reason;
  this.isActive = false;
  return this.save();
};

// Static method to find active document for affiliate
w9DocumentSchema.statics.findActiveForAffiliate = function(affiliateId) {
  return this.findOne({
    affiliateId,
    isActive: true,
    deletedAt: null
  }).sort({ uploadedAt: -1 });
};

// Static method to find all documents needing review
w9DocumentSchema.statics.findPendingReview = function() {
  return this.find({
    verificationStatus: 'pending',
    isActive: true,
    deletedAt: null
  }).populate('affiliateId').sort({ uploadedAt: 1 });
};

// Create model
const W9Document = mongoose.model('W9Document', w9DocumentSchema);

module.exports = W9Document;