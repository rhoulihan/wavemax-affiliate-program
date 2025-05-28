// Administrator Model for WaveMAX Laundry Affiliate Program
// Handles system administrators who manage operators and system configuration

const mongoose = require('mongoose');
const crypto = require('crypto');
const { encrypt, decrypt } = require('../utils/encryption');

const administratorSchema = new mongoose.Schema({
  adminId: { 
    type: String, 
    unique: true, 
    required: true
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
    default: 'administrator',
    immutable: true 
  },
  permissions: [{
    type: String,
    enum: ['system_config', 'operator_management', 'view_analytics', 'manage_affiliates']
  }],
  isActive: { 
    type: Boolean, 
    default: true 
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
administratorSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Indexes for performance
// Note: email already has a unique index from the schema definition
administratorSchema.index({ isActive: 1 });
administratorSchema.index({ createdAt: -1 });

// Pre-save middleware
administratorSchema.pre('save', async function(next) {
  // Update timestamp
  this.updatedAt = new Date();
  
  // Generate admin ID if new
  if (this.isNew && !this.adminId) {
    this.adminId = 'ADM' + Date.now().toString(36).toUpperCase() + 
                   crypto.randomBytes(3).toString('hex').toUpperCase();
  }
  
  // Hash password if modified
  if (this.isModified('password')) {
    const salt = crypto.randomBytes(16);
    this.password = crypto.pbkdf2Sync(this.password, salt, 100000, 64, 'sha512')
      .toString('hex') + ':' + salt.toString('hex');
  }
  
  // Set default permissions if none provided
  if (this.isNew && this.permissions.length === 0) {
    this.permissions = ['system_config', 'operator_management', 'view_analytics', 'manage_affiliates'];
  }
  
  next();
});

// Method to verify password
administratorSchema.methods.verifyPassword = function(password) {
  const [hash, salt] = this.password.split(':');
  const verifyHash = crypto.pbkdf2Sync(password, Buffer.from(salt, 'hex'), 100000, 64, 'sha512')
    .toString('hex');
  return hash === verifyHash;
};

// Method to handle failed login attempts
administratorSchema.methods.incLoginAttempts = function() {
  // Reset attempts if lock has expired
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $set: { loginAttempts: 1 },
      $unset: { lockUntil: 1 }
    });
  }
  
  const updates = { $inc: { loginAttempts: 1 } };
  
  // Lock account after 5 attempts for 2 hours
  const maxAttempts = 5;
  const lockTime = 2 * 60 * 60 * 1000; // 2 hours
  
  if (this.loginAttempts + 1 >= maxAttempts && !this.isLocked) {
    updates.$set = { lockUntil: new Date(Date.now() + lockTime) };
  }
  
  return this.updateOne(updates);
};

// Method to reset login attempts
administratorSchema.methods.resetLoginAttempts = function() {
  return this.updateOne({
    $set: { loginAttempts: 0, lastLogin: new Date() },
    $unset: { lockUntil: 1 }
  });
};

// Method to generate password reset token
administratorSchema.methods.generatePasswordResetToken = function() {
  const resetToken = crypto.randomBytes(32).toString('hex');
  
  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  
  this.passwordResetExpires = Date.now() + 30 * 60 * 1000; // 30 minutes
  
  return resetToken;
};

// Method to check permissions
administratorSchema.methods.hasPermission = function(permission) {
  return this.permissions.includes(permission);
};

// Method to check multiple permissions (AND operation)
administratorSchema.methods.hasAllPermissions = function(permissions) {
  return permissions.every(permission => this.permissions.includes(permission));
};

// Method to check multiple permissions (OR operation)
administratorSchema.methods.hasAnyPermission = function(permissions) {
  return permissions.some(permission => this.permissions.includes(permission));
};

// Static method to find active administrators
administratorSchema.statics.findActive = function() {
  return this.find({ isActive: true });
};

// Static method to find by email with password
administratorSchema.statics.findByEmailWithPassword = function(email) {
  return this.findOne({ email: email.toLowerCase() }).select('+password');
};

// Transform output
administratorSchema.set('toJSON', {
  transform: function(doc, ret) {
    delete ret.password;
    delete ret.passwordResetToken;
    delete ret.passwordResetExpires;
    delete ret.__v;
    return ret;
  }
});

// Create compound indexes
administratorSchema.index({ adminId: 1, isActive: 1 });

const Administrator = mongoose.model('Administrator', administratorSchema);

module.exports = Administrator;