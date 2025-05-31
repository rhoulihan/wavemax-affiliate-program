// Operator Model for WaveMAX Laundry Affiliate Program
// Handles operators who process wash-dry-fold orders

const mongoose = require('mongoose');
const crypto = require('crypto');
const { encrypt, decrypt } = require('../utils/encryption');

const operatorSchema = new mongoose.Schema({
  operatorId: { 
    type: String, 
    unique: true
  },
  firstName: { 
    type: String, 
    required: true,
    trim: true 
  },
  lastName: { 
    type: String, 
    required: true,
    trim: true 
  },
  email: { 
    type: String, 
    unique: true, 
    required: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: { 
    type: String, 
    required: true,
    select: false 
  },
  role: { 
    type: String, 
    default: 'operator',
    immutable: true 
  },
  isActive: { 
    type: Boolean, 
    default: true 
  },
  workStation: {
    type: String,
    trim: true
  },
  shiftStart: {
    type: String, // e.g., "08:00"
    match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Please enter a valid time format (HH:MM)']
  },
  shiftEnd: {
    type: String, // e.g., "17:00"
    match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Please enter a valid time format (HH:MM)']
  },
  currentOrderCount: {
    type: Number,
    default: 0
  },
  totalOrdersProcessed: {
    type: Number,
    default: 0
  },
  averageProcessingTime: {
    type: Number, // in minutes
    default: 0
  },
  qualityScore: {
    type: Number, // 0-100
    default: 100,
    min: 0,
    max: 100
  },
  createdBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Administrator',
    required: true
  },
  lastLogin: Date,
  loginAttempts: { 
    type: Number, 
    default: 0 
  },
  lockUntil: Date,
  passwordResetToken: String,
  passwordResetExpires: Date,
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Virtual for account lock
operatorSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Virtual for checking if operator is on shift
operatorSchema.virtual('isOnShift').get(function() {
  if (!this.shiftStart || !this.shiftEnd) return true; // If no shift times set, always available
  
  const now = new Date();
  const currentTime = now.getHours() * 60 + now.getMinutes();
  
  const [startHour, startMin] = this.shiftStart.split(':').map(Number);
  const [endHour, endMin] = this.shiftEnd.split(':').map(Number);
  
  const shiftStartMinutes = startHour * 60 + startMin;
  const shiftEndMinutes = endHour * 60 + endMin;
  
  // Handle overnight shifts
  if (shiftEndMinutes < shiftStartMinutes) {
    return currentTime >= shiftStartMinutes || currentTime <= shiftEndMinutes;
  }
  
  return currentTime >= shiftStartMinutes && currentTime <= shiftEndMinutes;
});

// Indexes for performance
// Note: email already has a unique index from the schema definition
operatorSchema.index({ isActive: 1 });
operatorSchema.index({ createdBy: 1 });
operatorSchema.index({ workStation: 1 });
operatorSchema.index({ createdAt: -1 });

// Pre-save middleware
operatorSchema.pre('save', function(next) {
  // Update timestamp
  this.updatedAt = new Date();
  
  // Generate operator ID if new
  if (this.isNew && !this.operatorId) {
    this.operatorId = 'OPR' + Date.now().toString(36).toUpperCase() + 
                      crypto.randomBytes(3).toString('hex').toUpperCase();
  }
  
  // Hash password if modified
  if (this.isModified('password')) {
    const salt = crypto.randomBytes(16);
    this.password = crypto.pbkdf2Sync(this.password, salt, 100000, 64, 'sha512')
      .toString('hex') + ':' + salt.toString('hex');
  }
  
  next();
});

// Method to verify password
operatorSchema.methods.verifyPassword = function(password) {
  const [hash, salt] = this.password.split(':');
  const verifyHash = crypto.pbkdf2Sync(password, Buffer.from(salt, 'hex'), 100000, 64, 'sha512')
    .toString('hex');
  return hash === verifyHash;
};

// Method to handle failed login attempts
operatorSchema.methods.incLoginAttempts = function() {
  // Reset attempts if lock has expired
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $set: { loginAttempts: 1 },
      $unset: { lockUntil: 1 }
    });
  }
  
  const updates = { $inc: { loginAttempts: 1 } };
  
  // Lock account after 5 attempts for 30 minutes
  const maxAttempts = 5;
  const lockTime = 30 * 60 * 1000; // 30 minutes
  
  if (this.loginAttempts + 1 >= maxAttempts && !this.isLocked) {
    updates.$set = { lockUntil: new Date(Date.now() + lockTime) };
  }
  
  return this.updateOne(updates);
};

// Method to reset login attempts
operatorSchema.methods.resetLoginAttempts = function() {
  return this.updateOne({
    $set: { loginAttempts: 0, lastLogin: new Date() },
    $unset: { lockUntil: 1 }
  });
};

// Method to generate password reset token
operatorSchema.methods.generatePasswordResetToken = function() {
  const resetToken = crypto.randomBytes(32).toString('hex');
  
  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  
  this.passwordResetExpires = Date.now() + 30 * 60 * 1000; // 30 minutes
  
  return resetToken;
};

// Method to update processing statistics
operatorSchema.methods.updateProcessingStats = function(processingTimeMinutes) {
  const totalTime = this.averageProcessingTime * this.totalOrdersProcessed;
  this.totalOrdersProcessed += 1;
  this.averageProcessingTime = (totalTime + processingTimeMinutes) / this.totalOrdersProcessed;
  
  return this.save();
};

// Method to update quality score
operatorSchema.methods.updateQualityScore = function(passed) {
  // Simple weighted average: recent results have more impact
  const weight = 0.1; // 10% weight for new result
  const newScore = passed ? 100 : 0;
  this.qualityScore = (this.qualityScore * (1 - weight)) + (newScore * weight);
  
  return this.save();
};

// Static method to find active operators
operatorSchema.statics.findActive = function() {
  return this.find({ isActive: true });
};

// Static method to find operators on shift
operatorSchema.statics.findOnShift = function() {
  return this.findActive().then(operators => {
    return operators.filter(operator => operator.isOnShift);
  });
};

// Static method to find by email with password
operatorSchema.statics.findByEmailWithPassword = function(email) {
  return this.findOne({ email: email.toLowerCase() }).select('+password');
};

// Static method to find operators with low order count
operatorSchema.statics.findAvailableOperators = function(limit = 5) {
  return this.find({ 
    isActive: true,
    currentOrderCount: { $lt: 10 } // Max 10 concurrent orders per operator
  })
  .sort({ currentOrderCount: 1 })
  .limit(limit);
};

// Transform output
operatorSchema.set('toJSON', {
  transform: function(doc, ret) {
    delete ret.password;
    delete ret.passwordResetToken;
    delete ret.passwordResetExpires;
    delete ret.__v;
    return ret;
  }
});

// Create compound indexes
operatorSchema.index({ operatorId: 1, isActive: 1 });
operatorSchema.index({ workStation: 1, isActive: 1 });
operatorSchema.index({ currentOrderCount: 1, isActive: 1 });

const Operator = mongoose.model('Operator', operatorSchema);

module.exports = Operator;