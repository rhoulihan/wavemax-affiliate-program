// Affiliate Model for WaveMAX Laundry Affiliate Program

const mongoose = require('mongoose');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const encryptionUtil = require('../utils/encryption');

// Affiliate Schema
const affiliateSchema = new mongoose.Schema({
  affiliateId: {
    type: String,
    default: () => 'AFF-' + uuidv4(),
    unique: true
  },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String, required: true },
  businessName: String,
  address: { type: String, required: true },
  city: { type: String, required: true },
  state: { type: String, required: true },
  zipCode: { type: String, required: true }, // Keep required for now - can geocode later
  // Location fields for map-based service area
  serviceLocation: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: false,
      default: undefined
    }
  },
  serviceLatitude: {
    type: Number,
    required: function() {
      // Only required for new affiliates or traditional registration
      return this.isNew || this.registrationMethod === 'traditional';
    }
  },
  serviceLongitude: {
    type: Number,
    required: function() {
      // Only required for new affiliates or traditional registration
      return this.isNew || this.registrationMethod === 'traditional';
    }
  },
  serviceRadius: { type: Number, required: true, default: 5, min: 1, max: 50 }, // Service radius in miles
  // Delivery fee structure
  minimumDeliveryFee: {
    type: Number,
    required: true,
    default: 25,
    min: 0,
    max: 100
  },
  perBagDeliveryFee: {
    type: Number,
    required: true,
    default: 5,
    min: 0,
    max: 50
  },
  username: { type: String, required: true, unique: true },
  passwordSalt: {
    type: String,
    required: function() {
      return this.registrationMethod === 'traditional' || !this.registrationMethod;
    }
  },
  passwordHash: {
    type: String,
    required: function() {
      return this.registrationMethod === 'traditional' || !this.registrationMethod;
    }
  },
  // Encrypted payment fields
  paymentMethod: {
    type: String,
    required: function() {
      return this.registrationMethod === 'traditional' || !this.registrationMethod;
    },
    enum: ['check', 'paypal', 'venmo'],
    default: function() {
      if (this.registrationMethod && this.registrationMethod !== 'traditional') {
        return 'check'; // Default for social registrations
      }
      return undefined;
    }
  },
  paypalEmail: {
    type: mongoose.Schema.Types.Mixed,
    default: undefined
  },
  venmoHandle: {
    type: mongoose.Schema.Types.Mixed,
    default: undefined
  },
  isActive: { type: Boolean, default: true },
  dateRegistered: { type: Date, default: Date.now },
  lastLogin: Date,
  // Social media account connections
  socialAccounts: {
    google: {
      id: String,
      email: String,
      name: String,
      accessToken: String,
      refreshToken: String,
      linkedAt: Date
    },
    facebook: {
      id: String,
      email: String,
      name: String,
      accessToken: String,
      linkedAt: Date
    },
    linkedin: {
      id: String,
      email: String,
      name: String,
      accessToken: String,
      refreshToken: String,
      linkedAt: Date
    }
  },
  // Registration method
  registrationMethod: {
    type: String,
    enum: ['traditional', 'google', 'facebook', 'linkedin', 'social'],
    default: 'traditional'
  },
  // Password reset fields
  resetToken: String,
  resetTokenExpiry: Date,
  // Virtual password field for input (gets hashed into passwordSalt/passwordHash)
  password: {
    type: String,
    required: false // Will be hashed and removed in pre-save middleware
  },
  // Language preference for communications
  languagePreference: {
    type: String,
    enum: ['en', 'es', 'pt', 'de'],
    default: 'en'
  },
  // W-9 Tax Information
  w9Information: {
    status: {
      type: String,
      enum: ['not_submitted', 'pending_review', 'verified', 'rejected', 'expired'],
      default: 'not_submitted'
    },
    submittedAt: Date,
    verifiedAt: Date,
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Administrator' },
    rejectedAt: Date,
    rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Administrator' },
    rejectionReason: String,
    expiryDate: Date,
    documentId: String, // Reference to W9Document
    taxIdType: { type: String, enum: ['SSN', 'EIN'] },
    taxIdLast4: String, // Store only last 4 digits for display
    businessName: String, // Legal business name from W-9
    quickbooksVendorId: String,
    quickbooksData: {
      displayName: String,
      vendorType: { type: String, default: '1099 Contractor' },
      terms: { type: String, default: 'Net 15' },
      defaultExpenseAccount: { type: String, default: 'Commission Expense' }
    },
    // DocuSign fields
    docusignEnvelopeId: String,
    docusignStatus: String,
    docusignInitiatedAt: Date,
    docusignCompletedAt: Date
  }
}, {
  timestamps: true,
  toObject: { virtuals: true },
  toJSON: { virtuals: true }
});

// Virtual field for full name
affiliateSchema.virtual('name').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Middleware for password hashing before saving
affiliateSchema.pre('save', function(next) {
  // Hash password if it's modified and provided as plain text, but only if passwordHash is not already set
  if (this.isModified('password') && this.password && !this.passwordHash) {
    const { salt, hash } = encryptionUtil.hashPassword(this.password);
    this.passwordSalt = salt;
    this.passwordHash = hash;
    this.password = undefined; // Remove plain text password
  }

  next();
});

// Middleware for encrypting sensitive payment data before saving
affiliateSchema.pre('save', function(next) {
  if (this.isModified('paypalEmail') && this.paypalEmail && typeof this.paypalEmail === 'string') {
    this.paypalEmail = encryptionUtil.encrypt(this.paypalEmail);
  }

  if (this.isModified('venmoHandle') && this.venmoHandle && typeof this.venmoHandle === 'string') {
    this.venmoHandle = encryptionUtil.encrypt(this.venmoHandle);
  }

  next();
});

// Create 2dsphere index for location-based queries
affiliateSchema.index({ serviceLocation: '2dsphere' });

// Method to check if affiliate can receive payments
affiliateSchema.methods.canReceivePayments = function() {
  return this.w9Information.status === 'verified' && this.isActive;
};

// Method to get W-9 status display text
affiliateSchema.methods.getW9StatusDisplay = function() {
  const statusMap = {
    'not_submitted': 'Waiting for Upload',
    'pending_review': 'Awaiting Review',
    'verified': 'Approved',
    'rejected': 'Rejected',
    'expired': 'Expired - Update Required'
  };
  return statusMap[this.w9Information.status] || 'Unknown Status';
};

// Update serviceLocation when lat/lng changes
affiliateSchema.pre('save', function(next) {
  // Update serviceLocation from lat/lng if they exist
  if (this.serviceLatitude && this.serviceLongitude && (this.isModified('serviceLatitude') || this.isModified('serviceLongitude'))) {
    this.serviceLocation = {
      type: 'Point',
      coordinates: [this.serviceLongitude, this.serviceLatitude]
    };
  }
  next();
});

// Create model
const Affiliate = mongoose.model('Affiliate', affiliateSchema);

module.exports = Affiliate;