// Order Model for WaveMAX Laundry Affiliate Program

const mongoose = require('mongoose');
const SystemConfig = require('./SystemConfig');

// Order Schema
const orderSchema = new mongoose.Schema({
  orderId: {
    type: String,
    default: () => 'ORD' + Math.floor(100000 + Math.random() * 900000),
    unique: true
  },
  customerId: { type: String, required: true, ref: 'Customer' },
  affiliateId: { type: String, required: true, ref: 'Affiliate' },
  // Pickup information
  pickupDate: { type: Date, required: true },
  pickupTime: {
    type: String,
    enum: ['morning', 'afternoon', 'evening'],
    required: true
  },
  specialPickupInstructions: String,
  estimatedWeight: {
    type: Number,
    required: true,
    min: 0.1
  },
  serviceNotes: String,
  // Delivery information
  deliveryDate: { type: Date, required: true },
  deliveryTime: {
    type: String,
    enum: ['morning', 'afternoon', 'evening'],
    required: true
  },
  specialDeliveryInstructions: String,
  // Order status
  status: {
    type: String,
    enum: ['scheduled', 'picked_up', 'processing', 'ready_for_delivery', 'delivered', 'cancelled'],
    default: 'scheduled'
  },
  // Laundry details
  actualWeight: Number,
  washInstructions: String,
  // Bag information
  numberOfBags: { type: Number, default: 1, min: 1 },
  // Payment information
  baseRate: { type: Number }, // Per pound WDF rate - fetched from SystemConfig
  // Fee breakdown structure
  feeBreakdown: {
    numberOfBags: Number,
    minimumFee: Number,
    perBagFee: Number,
    totalFee: Number, // The actual fee charged (greater of minimum or calculated)
    minimumApplied: Boolean
  },
  estimatedTotal: Number,
  actualTotal: Number,
  affiliateCommission: { type: Number, default: 0 },
  paymentStatus: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'refunded', 'failed'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    enum: ['card', 'cash', 'other'],
    default: 'card'
  },
  paymentDate: Date,
  paymentReference: String,
  paymentError: String,
  refundAmount: Number,
  refundReason: String,
  refundReference: String,
  refundedAt: Date,
  // Operator processing fields
  assignedOperator: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Operator' 
  },
  processingStarted: Date,
  processingCompleted: Date,
  operatorNotes: String,
  qualityCheckPassed: { 
    type: Boolean, 
    default: null 
  },
  qualityCheckBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Operator' 
  },
  qualityCheckNotes: String,
  processingTimeMinutes: Number, // Auto-calculated
  orderProcessingStatus: {
    type: String,
    enum: ['pending', 'assigned', 'washing', 'drying', 'folding', 'quality_check', 'ready', 'completed'],
    default: 'pending'
  },
  // Timestamps
  scheduledAt: { type: Date, default: Date.now },
  pickedUpAt: Date,
  processedAt: Date,
  readyForDeliveryAt: Date,
  deliveredAt: Date,
  cancelledAt: Date
}, { timestamps: true });

// Middleware for calculating estimated total before saving
orderSchema.pre('save', async function(next) {
  // Fetch current WDF rate from system config if not explicitly set
  if (this.isNew && !this.baseRate) {
    try {
      this.baseRate = await SystemConfig.getValue('wdf_base_rate_per_pound', 1.25);
    } catch (error) {
      // If SystemConfig is not available, use default
      this.baseRate = 1.25;
    }
  }
  
  if (this.isNew || this.isModified('estimatedWeight') || this.isModified('baseRate') || this.isModified('feeBreakdown')) {
    // Calculate estimated total using the provided estimated weight
    const totalFee = this.feeBreakdown?.totalFee || 0;
    this.estimatedTotal = parseFloat((this.estimatedWeight * this.baseRate + totalFee).toFixed(2));
  }

  // Calculate actual total if actual weight is available
  if (this.isModified('actualWeight') && this.actualWeight) {
    const totalFee = this.feeBreakdown?.totalFee || 0;
    this.actualTotal = parseFloat((this.actualWeight * this.baseRate + totalFee).toFixed(2));
    // Calculate affiliate commission (10% of WDF + full delivery fee)
    // Commission = (WDF amount × 10%) + delivery fee
    const wdfAmount = this.actualWeight * this.baseRate;
    const wdfCommission = wdfAmount * 0.1;
    this.affiliateCommission = parseFloat((wdfCommission + totalFee).toFixed(2));
  }

  // Update status timestamps
  if (this.isModified('status')) {
    const now = new Date();
    switch (this.status) {
    case 'picked_up':
      this.pickedUpAt = now;
      break;
    case 'processing':
      this.processedAt = now;
      break;
    case 'ready_for_delivery':
      this.readyForDeliveryAt = now;
      break;
    case 'delivered':
      this.deliveredAt = now;
      break;
    case 'cancelled':
      this.cancelledAt = now;
      break;
    }
  }

  // Update order processing status timestamps
  if (this.isModified('orderProcessingStatus')) {
    const now = new Date();
    switch (this.orderProcessingStatus) {
    case 'washing':
    case 'drying':
    case 'folding':
      if (!this.processingStarted) {
        this.processingStarted = now;
      }
      break;
    case 'completed':
      this.processingCompleted = now;
      // Calculate processing time in minutes
      if (this.processingStarted) {
        const diffMs = now - this.processingStarted;
        this.processingTimeMinutes = Math.round(diffMs / 60000);
      }
      break;
    }
  }

  next();
});

// Create model
const Order = mongoose.model('Order', orderSchema);

module.exports = Order;