// SystemConfig Model for WaveMAX Laundry Affiliate Program
// Manages system-wide configuration settings

const mongoose = require('mongoose');

const systemConfigSchema = new mongoose.Schema({
  key: {
    type: String,
    unique: true,
    required: true,
    trim: true
  },
  value: mongoose.Schema.Types.Mixed,
  description: {
    type: String,
    trim: true
  },
  category: {
    type: String,
    enum: ['operator', 'operations', 'processing', 'notification', 'payment', 'system', 'affiliate', 'customer', 'quality', 'performance'],
    required: true
  },
  dataType: {
    type: String,
    enum: ['string', 'number', 'boolean', 'array', 'object'],
    required: true
  },
  defaultValue: mongoose.Schema.Types.Mixed,
  isEditable: {
    type: Boolean,
    default: true
  },
  isPublic: {
    type: Boolean,
    default: false
  },
  validation: {
    min: Number,
    max: Number,
    regex: String,
    allowedValues: [mongoose.Schema.Types.Mixed]
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Administrator'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Pre-save middleware
systemConfigSchema.pre('save', function(next) {
  // Update timestamp
  this.updatedAt = new Date();

  // Validate value based on dataType
  if (this.isModified('value')) {
    switch (this.dataType) {
    case 'number':
      if (typeof this.value !== 'number') {
        return next(new Error(`Value must be a number for key: ${this.key}`));
      }
      // Check min/max validation
      if (this.validation) {
        if (this.validation.min !== undefined && this.value < this.validation.min) {
          return next(new Error(`Value must be at least ${this.validation.min} for key: ${this.key}`));
        }
        if (this.validation.max !== undefined && this.value > this.validation.max) {
          return next(new Error(`Value must be at most ${this.validation.max} for key: ${this.key}`));
        }
      }
      break;

    case 'boolean':
      if (typeof this.value !== 'boolean') {
        return next(new Error(`Value must be a boolean for key: ${this.key}`));
      }
      break;

    case 'string':
      if (typeof this.value !== 'string') {
        return next(new Error(`Value must be a string for key: ${this.key}`));
      }
      // Check regex validation
      if (this.validation && this.validation.regex) {
        const regex = new RegExp(this.validation.regex);
        if (!regex.test(this.value)) {
          return next(new Error(`Value does not match required format for key: ${this.key}`));
        }
      }
      break;

    case 'array':
      if (!Array.isArray(this.value)) {
        return next(new Error(`Value must be an array for key: ${this.key}`));
      }
      break;

    case 'object':
      if (typeof this.value !== 'object' || Array.isArray(this.value)) {
        return next(new Error(`Value must be an object for key: ${this.key}`));
      }
      break;
    }

    // Check allowed values
    if (this.validation && this.validation.allowedValues && this.validation.allowedValues.length > 0) {
      if (!this.validation.allowedValues.includes(this.value)) {
        return next(new Error(`Value must be one of: ${this.validation.allowedValues.join(', ')} for key: ${this.key}`));
      }
    }
  }

  next();
});

// Static method to get config value
systemConfigSchema.statics.getValue = async function(key, defaultValue = null) {
  const config = await this.findOne({ key });
  if (!config) {
    return defaultValue;
  }
  return config.value !== undefined ? config.value : config.defaultValue;
};

// Static method to set config value
systemConfigSchema.statics.setValue = async function(key, value, updatedBy = null) {
  const config = await this.findOne({ key });
  if (!config) {
    throw new Error(`Configuration key not found: ${key}`);
  }

  if (!config.isEditable) {
    throw new Error(`Configuration is not editable: ${key}`);
  }

  config.value = value;
  if (updatedBy) {
    config.updatedBy = updatedBy;
  }

  return config.save();
};

// Static method to get configs by category
systemConfigSchema.statics.getByCategory = function(category, publicOnly = false) {
  const query = { category };
  if (publicOnly) {
    query.isPublic = true;
  }
  return this.find(query).sort('key');
};

// Static method to get all public configs
systemConfigSchema.statics.getPublicConfigs = function() {
  return this.find({ isPublic: true }).sort('category key');
};

// Static method to initialize default configurations
systemConfigSchema.statics.initializeDefaults = async function() {
  const defaultConfigs = [
    // Operator settings
    {
      key: 'max_operators_per_shift',
      value: 10,
      defaultValue: 10,
      description: 'Maximum number of operators allowed per shift',
      category: 'operator',
      dataType: 'number',
      validation: { min: 1, max: 50 }
    },
    {
      key: 'max_concurrent_orders_per_operator',
      value: 10,
      defaultValue: 10,
      description: 'Maximum number of concurrent orders an operator can handle',
      category: 'operator',
      dataType: 'number',
      validation: { min: 1, max: 20 }
    },

    // Processing settings
    {
      key: 'order_processing_timeout_minutes',
      value: 120,
      defaultValue: 120,
      description: 'Timeout for order processing in minutes',
      category: 'processing',
      dataType: 'number',
      validation: { min: 30, max: 480 }
    },
    {
      key: 'quality_check_required',
      value: true,
      defaultValue: true,
      description: 'Whether quality check is required for all orders',
      category: 'processing',
      dataType: 'boolean'
    },
    {
      key: 'auto_assign_orders',
      value: true,
      defaultValue: true,
      description: 'Automatically assign orders to available operators',
      category: 'processing',
      dataType: 'boolean'
    },

    // Notification settings
    {
      key: 'operator_assignment_notification',
      value: true,
      defaultValue: true,
      description: 'Send notification when order is assigned to operator',
      category: 'notification',
      dataType: 'boolean'
    },
    {
      key: 'processing_delay_threshold_minutes',
      value: 30,
      defaultValue: 30,
      description: 'Send alert if processing is delayed by this many minutes',
      category: 'notification',
      dataType: 'number',
      validation: { min: 15, max: 120 }
    },

    // Pricing settings
    {
      key: 'wdf_base_rate_per_pound',
      value: 1.25,
      defaultValue: 1.25,
      description: 'Base rate per pound for Wash Dry Fold service',
      category: 'payment',
      dataType: 'number',
      validation: { min: 0.50, max: 10.00 },
      isPublic: true
    },
    {
      key: 'laundry_bag_fee',
      value: 10.00,
      defaultValue: 10.00,
      description: 'Fee per laundry bag for new customers',
      category: 'payment',
      dataType: 'number',
      validation: { min: 0.00, max: 50.00 },
      isPublic: true
    },

    // System settings
    {
      key: 'maintenance_mode',
      value: false,
      defaultValue: false,
      description: 'Enable maintenance mode',
      category: 'system',
      dataType: 'boolean',
      isPublic: true
    },
    {
      key: 'system_timezone',
      value: 'America/Chicago',
      defaultValue: 'America/Chicago',
      description: 'System timezone',
      category: 'system',
      dataType: 'string',
      validation: {
        allowedValues: ['America/Chicago', 'America/New_York', 'America/Los_Angeles', 'UTC']
      }
    }
  ];

  // Insert defaults if they don't exist
  for (const config of defaultConfigs) {
    await this.findOneAndUpdate(
      { key: config.key },
      { $setOnInsert: config },
      { upsert: true, new: true }
    );
  }
};

// Transform output
systemConfigSchema.set('toJSON', {
  transform: function(doc, ret) {
    delete ret.__v;
    // Return the actual value or default if value is not set
    ret.currentValue = ret.value !== undefined ? ret.value : ret.defaultValue;
    return ret;
  }
});

// Create indexes
systemConfigSchema.index({ key: 1, category: 1 });
systemConfigSchema.index({ category: 1, isPublic: 1 });

const SystemConfig = mongoose.model('SystemConfig', systemConfigSchema);

module.exports = SystemConfig;