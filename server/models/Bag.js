// Bag Model for WaveMAX Laundry Affiliate Program

const mongoose = require('mongoose');
const crypto = require('crypto');

// Bag Schema
const bagSchema = new mongoose.Schema({
  bagId: {
    type: String,
    unique: true
  },
  tagNumber: {
    type: String,
    trim: true
  },
  barcode: { 
    type: String, 
    unique: true,
    sparse: true
  },
  customer: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Customer',
    required: true
  },
  affiliate: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Affiliate',
    required: true
  },
  type: {
    type: String,
    enum: ['laundry', 'dryClean', 'alterations', 'washFold'],
    required: true
  },
  weight: {
    type: Number,
    min: 0
  },
  status: {
    type: String,
    enum: ['pending', 'pickedUp', 'processing', 'ready', 'delivered', 'lost'],
    default: 'pending'
  },
  notes: {
    type: String,
    trim: true
  },
  specialInstructions: {
    type: String,
    trim: true
  },
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order'
  },
  pickedUpAt: Date,
  processedAt: Date,
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Operator'
  },
  processingStartedAt: Date,
  readyAt: Date,
  deliveredAt: Date,
  isActive: { type: Boolean, default: true },
  creditStatus: {
    type: String,
    enum: ['pending', 'paid'],
    default: 'pending'
  },
  creditAmount: { type: Number, default: 0 },
  lostDetails: {
    reportedAt: Date,
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'lostDetails.reportedByModel'
    },
    reportedByModel: {
      type: String,
      enum: ['Customer', 'Affiliate', 'Administrator']
    },
    reason: String
  }
}, { timestamps: true });

// Pre-save middleware to generate bagId and barcode
bagSchema.pre('save', function(next) {
  if (this.isNew && !this.bagId) {
    this.bagId = 'BG' + Date.now().toString(36).toUpperCase() + 
                 crypto.randomBytes(3).toString('hex').toUpperCase();
  }
  
  if (this.isNew && !this.barcode) {
    this.barcode = 'WM-' + crypto.randomBytes(4).toString('hex').toUpperCase();
  }
  
  next();
});

// Create model
const Bag = mongoose.model('Bag', bagSchema);

module.exports = Bag;