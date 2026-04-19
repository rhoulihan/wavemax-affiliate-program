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
  // W-9 tax info (collected out-of-band; admin sets status here)
  w9Status: {
    type: String,
    enum: ['not_required', 'required', 'on_file', 'rejected'],
    default: 'not_required'
  },
  w9OnFileAt: Date,
  taxIdLast4: String,                  // last 4 digits, for admin display only
  // Payment processing lock (set automatically when YTD earnings cross the W-9
  // reporting threshold; cleared manually by an admin after the W-9 is on file)
  paymentProcessingLocked: { type: Boolean, default: false },
  paymentLockedAt: Date,
  paymentLockReason: String,           // e.g. 'w9_required', 'admin_hold', 'compliance_review'
  paymentUnlockedAt: Date,
  paymentUnlockedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Administrator' },
  paymentUnlockNotes: String,
  // QuickBooks vendor linkage
  quickbooksVendorId: String,
  quickbooksData: {
    displayName: String,
    vendorType: { type: String, default: '1099 Contractor' },
    terms: { type: String, default: 'Net 15' },
    defaultExpenseAccount: { type: String, default: 'Commission Expense' }
  },
  // Availability schedule for pickup management
  availabilitySchedule: {
    // Default weekly template
    weeklyTemplate: {
      monday: {
        enabled: { type: Boolean, default: true },
        timeSlots: {
          morning: { type: Boolean, default: true },
          afternoon: { type: Boolean, default: true },
          evening: { type: Boolean, default: true }
        }
      },
      tuesday: {
        enabled: { type: Boolean, default: true },
        timeSlots: {
          morning: { type: Boolean, default: true },
          afternoon: { type: Boolean, default: true },
          evening: { type: Boolean, default: true }
        }
      },
      wednesday: {
        enabled: { type: Boolean, default: true },
        timeSlots: {
          morning: { type: Boolean, default: true },
          afternoon: { type: Boolean, default: true },
          evening: { type: Boolean, default: true }
        }
      },
      thursday: {
        enabled: { type: Boolean, default: true },
        timeSlots: {
          morning: { type: Boolean, default: true },
          afternoon: { type: Boolean, default: true },
          evening: { type: Boolean, default: true }
        }
      },
      friday: {
        enabled: { type: Boolean, default: true },
        timeSlots: {
          morning: { type: Boolean, default: true },
          afternoon: { type: Boolean, default: true },
          evening: { type: Boolean, default: true }
        }
      },
      saturday: {
        enabled: { type: Boolean, default: true },
        timeSlots: {
          morning: { type: Boolean, default: true },
          afternoon: { type: Boolean, default: true },
          evening: { type: Boolean, default: true }
        }
      },
      sunday: {
        enabled: { type: Boolean, default: false },
        timeSlots: {
          morning: { type: Boolean, default: false },
          afternoon: { type: Boolean, default: false },
          evening: { type: Boolean, default: false }
        }
      }
    },
    // Date-specific overrides and exceptions
    dateExceptions: [{
      date: { type: Date, required: true },
      type: {
        type: String,
        enum: ['block', 'override'],
        required: true
      },
      // For type='block': entire day blocked
      // For type='override': custom availability
      timeSlots: {
        morning: { type: Boolean, default: false },
        afternoon: { type: Boolean, default: false },
        evening: { type: Boolean, default: false }
      },
      reason: String, // Optional note (e.g., "Holiday", "Vacation")
      createdAt: { type: Date, default: Date.now }
    }],
    // Settings
    scheduleSettings: {
      advanceBookingDays: {
        type: Number,
        default: 1,
        min: 0,
        max: 30
      }, // How many days in advance customers must book
      maxBookingDays: {
        type: Number,
        default: 30,
        min: 1,
        max: 90
      }, // How far in advance customers can book
      timezone: {
        type: String,
        default: 'America/Chicago'
      }
    }
  },
  // Immediate Pickup ("Pickup Now!") feature control
  allowImmediatePickup: {
    type: Boolean,
    default: true
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

// Method to check if affiliate can receive commission payouts
affiliateSchema.methods.canReceivePayments = function() {
  return !this.paymentProcessingLocked && this.isActive;
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

// Helper: Get day of week key from date
affiliateSchema.methods.getDayOfWeekKey = function(date) {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return days[date.getDay()];
};

/**
 * Check if affiliate is available for a specific date and time
 * @param {Date} date - The pickup date
 * @param {String} timeSlot - 'morning', 'afternoon', or 'evening'
 * @returns {Boolean}
 */
affiliateSchema.methods.isAvailable = function(date, timeSlot) {
  // If no availability schedule configured, default to available
  if (!this.availabilitySchedule || !this.availabilitySchedule.weeklyTemplate) {
    return true;
  }

  const dayOfWeek = this.getDayOfWeekKey(date);

  // Check date-specific exceptions first (default to empty array if not set)
  const dateExceptions = this.availabilitySchedule.dateExceptions || [];
  const exception = dateExceptions.find(
    ex => ex.date && ex.date.toDateString() === date.toDateString()
  );

  if (exception) {
    if (exception.type === 'block') {
      return false; // Entire day blocked
    }
    // Override - use exception's time slots
    return exception.timeSlots && exception.timeSlots[timeSlot] === true;
  }

  // Fall back to weekly template
  const dayTemplate = this.availabilitySchedule.weeklyTemplate[dayOfWeek];
  if (!dayTemplate) {
    return true; // If day template not configured, default to available
  }
  return dayTemplate.enabled && dayTemplate.timeSlots && dayTemplate.timeSlots[timeSlot] === true;
};

/**
 * Get available time slots for a specific date
 * @param {Date} date - The date to check
 * @returns {Array} - Array of available time slot strings
 */
affiliateSchema.methods.getAvailableTimeSlots = function(date) {
  const slots = [];
  const timeSlotOptions = ['morning', 'afternoon', 'evening'];

  for (const slot of timeSlotOptions) {
    if (this.isAvailable(date, slot)) {
      slots.push(slot);
    }
  }

  return slots;
};

/**
 * Get all available dates in a date range
 * @param {Date} startDate
 * @param {Date} endDate
 * @returns {Array} - Array of available date objects with time slots
 */
affiliateSchema.methods.getAvailableDates = function(startDate, endDate) {
  const availableDates = [];
  const currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    const timeSlots = this.getAvailableTimeSlots(currentDate);

    if (timeSlots.length > 0) {
      availableDates.push({
        date: new Date(currentDate),
        timeSlots: timeSlots,
        allDay: timeSlots.length === 3
      });
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return availableDates;
};

/**
 * Validate schedule change doesn't conflict with existing orders
 * @param {Date} date
 * @param {String} timeSlot
 * @returns {Object} { valid: Boolean, conflicts: Array }
 */
affiliateSchema.methods.validateScheduleChange = async function(date, timeSlot) {
  const Order = require('./Order');

  // Create date range for the entire day
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const conflicts = await Order.find({
    affiliateId: this.affiliateId,
    pickupDate: {
      $gte: startOfDay,
      $lt: endOfDay
    },
    pickupTime: timeSlot,
    status: { $in: ['pending', 'processing', 'processed'] }
  });

  return {
    valid: conflicts.length === 0,
    conflicts: conflicts
  };
};

// Create index for date exceptions for faster queries
affiliateSchema.index({ 'availabilitySchedule.dateExceptions.date': 1 });

// Create model
const Affiliate = mongoose.model('Affiliate', affiliateSchema);

module.exports = Affiliate;