// Bag Model for WaveMAX Laundry Affiliate Program

const mongoose = require('mongoose');

// Bag Schema
const bagSchema = new mongoose.Schema({
  bagId: {
    type: String,
    default: () => 'BAG' + Math.floor(100000 + Math.random() * 900000),
    unique: true
  },
  barcode: { type: String, required: true, unique: true },
  customerId: { type: String, ref: 'Customer' },
  affiliateId: { type: String, ref: 'Affiliate' },
  isActive: { type: Boolean, default: true },
  status: {
    type: String,
    enum: ['available', 'assigned', 'in_use', 'lost', 'damaged'],
    default: 'available'
  },
  issueDate: Date,
  lastUsedDate: Date
}, { timestamps: true });

// Create model
const Bag = mongoose.model('Bag', bagSchema);

module.exports = Bag;