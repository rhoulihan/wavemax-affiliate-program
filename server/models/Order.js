// Order Model for WaveMAX Laundry Affiliate Program

const mongoose = require('mongoose');

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
  estimatedSize: { 
    type: String,
    enum: ['small', 'medium', 'large'],
    required: true
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
  bagIDs: [String],
  washInstructions: String,
  // Payment information
  baseRate: { type: Number, default: 1.89 }, // Per pound WDF rate
  deliveryFee: { type: Number, required: true },
  estimatedTotal: Number,
  actualTotal: Number,
  affiliateCommission: Number,
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
  // Timestamps
  scheduledAt: { type: Date, default: Date.now },
  pickedUpAt: Date,
  processedAt: Date,
  readyForDeliveryAt: Date,
  deliveredAt: Date,
  cancelledAt: Date
}, { timestamps: true });

// Middleware for calculating estimated total before saving
orderSchema.pre('save', function(next) {
  if (this.isNew || this.isModified('estimatedSize') || this.isModified('baseRate') || this.isModified('deliveryFee')) {
    // Calculate estimated weight based on size
    let estimatedWeight = 0;
    if (this.estimatedSize === 'small') {
      estimatedWeight = 12.5; // average of 10-15 lbs
    } else if (this.estimatedSize === 'medium') {
      estimatedWeight = 23; // average of 16-30 lbs
    } else if (this.estimatedSize === 'large') {
      estimatedWeight = 35; // approximate for 31+ lbs
    }
    
    // Calculate estimated total
    this.estimatedTotal = parseFloat((estimatedWeight * this.baseRate + this.deliveryFee).toFixed(2));
  }
  
  // Calculate actual total if actual weight is available
  if (this.isModified('actualWeight') && this.actualWeight) {
    this.actualTotal = parseFloat((this.actualWeight * this.baseRate + this.deliveryFee).toFixed(2));
    // Calculate affiliate commission (10% of WDF + all delivery fee)
    this.affiliateCommission = parseFloat((this.actualWeight * this.baseRate * 0.1 + this.deliveryFee).toFixed(2));
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
  
  next();
});

// Create model
const Order = mongoose.model('Order', orderSchema);

module.exports = Order;