// Administrator Model for WaveMAX Laundry Affiliate Program
// Handles system administrators who manage operators and system configuration

const mongoose = require('mongoose');
const crypto = require('crypto');
const { encrypt, decrypt } = require('../utils/encryption');
const { validatePasswordStrength } = require('../utils/passwordValidator');

const administratorSchema = new mongoose.Schema({
  adminId: { 
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
    default: 'administrator',
    immutable: true 
  },
  permissions: [{
    type: String,
    enum: [
      'all', // Super admin - has all permissions
      'system_config', 
      'operator_management', 
      'view_analytics', 
      'manage_affiliates',
      'administrators.read',
      'administrators.create',
      'administrators.update',
      'administrators.delete',
      'operators.read',
      'operators.create',
      'operators.update',
      'operators.delete',
      'operators.manage',
      'customers.read',
      'customers.manage',
      'affiliates.read',
      'affiliates.manage',
      'orders.read',
      'orders.manage',
      'reports.view',
      'system.configure'
    ]
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
  requirePasswordChange: {
    type: Boolean,
    default: false
  },
  passwordHistory: [{
    password: String,
    changedAt: Date
  }],
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
  
  // Validate and hash password if modified
  if (this.isModified('password')) {
    // Validate password strength
    const validation = validatePasswordStrength(this.password, {
      username: this.email.split('@')[0], // Use email prefix as username
      email: this.email
    });
    
    if (!validation.success) {
      const error = new Error(validation.errors.join('; '));
      error.name = 'ValidationError';
      throw error;
    }
    
    const salt = crypto.randomBytes(16);
    const hashedPassword = crypto.pbkdf2Sync(this.password, salt, 100000, 64, 'sha512')
      .toString('hex') + ':' + salt.toString('hex');
    
    // Store the old password in history before updating
    if (!this.isNew && this._id) {
      // Get the current (old) password from database
      const currentAdmin = await this.constructor.findById(this._id).select('+password');
      if (currentAdmin && currentAdmin.password) {
        if (!this.passwordHistory) {
          this.passwordHistory = [];
        }
        this.passwordHistory.push({
          password: currentAdmin.password, // Store the OLD hashed password
          changedAt: new Date()
        });
        // Keep only last 5 passwords
        if (this.passwordHistory.length > 5) {
          this.passwordHistory = this.passwordHistory.slice(-5);
        }
      }
      // Clear requirePasswordChange flag when password is changed
      this.requirePasswordChange = false;
    }
    
    this.password = hashedPassword;
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

// Method to check if password has been used before
administratorSchema.methods.isPasswordInHistory = function(password) {
  if (!this.passwordHistory || this.passwordHistory.length === 0) {
    return false;
  }
  
  return this.passwordHistory.some(historyEntry => {
    const [hash, salt] = historyEntry.password.split(':');
    const verifyHash = crypto.pbkdf2Sync(password, Buffer.from(salt, 'hex'), 100000, 64, 'sha512')
      .toString('hex');
    return hash === verifyHash;
  });
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
  // If admin has 'all' permission, they can do anything
  if (this.permissions.includes('all')) return true;
  return this.permissions.includes(permission);
};

// Method to check multiple permissions (AND operation)
administratorSchema.methods.hasAllPermissions = function(permissions) {
  // If admin has 'all' permission, they can do anything
  if (this.permissions.includes('all')) return true;
  return permissions.every(permission => this.permissions.includes(permission));
};

// Method to check multiple permissions (OR operation)
administratorSchema.methods.hasAnyPermission = function(permissions) {
  // If admin has 'all' permission, they can do anything
  if (this.permissions.includes('all')) return true;
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