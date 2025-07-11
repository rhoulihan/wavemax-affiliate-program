const mongoose = require('mongoose');

const dataDeletionRequestSchema = new mongoose.Schema({
  // Facebook user ID requesting deletion
  facebookUserId: {
    type: String,
    required: true,
    index: true
  },
  
  // Unique confirmation code for status checking
  confirmationCode: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  // Status of the deletion request
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending',
    required: true
  },
  
  // Type of user account (affiliate or customer)
  userType: {
    type: String,
    enum: ['affiliate', 'customer', 'both'],
    required: true
  },
  
  // User IDs that were affected by this deletion
  affectedUsers: {
    affiliateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Affiliate'
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer'
    }
  },
  
  // Raw signed request from Facebook (for audit)
  signedRequest: {
    type: String,
    required: true
  },
  
  // Deletion details
  deletionDetails: {
    dataDeleted: [String], // List of data types deleted
    errors: [String], // Any errors during deletion
    completedActions: [String] // Successful deletion actions
  },
  
  // Timestamps
  requestedAt: {
    type: Date,
    default: Date.now,
    required: true
  },
  
  processedAt: {
    type: Date
  },
  
  completedAt: {
    type: Date
  },
  
  // IP address of the request (from Facebook)
  requestIp: {
    type: String
  },
  
  // Additional metadata
  metadata: {
    type: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
dataDeletionRequestSchema.index({ requestedAt: -1 });
dataDeletionRequestSchema.index({ status: 1, requestedAt: -1 });
dataDeletionRequestSchema.index({ facebookUserId: 1, requestedAt: -1 });

// Instance method to mark as processing
dataDeletionRequestSchema.methods.markAsProcessing = async function() {
  this.status = 'processing';
  this.processedAt = new Date();
  return this.save();
};

// Instance method to mark as completed
dataDeletionRequestSchema.methods.markAsCompleted = async function(details = {}) {
  this.status = 'completed';
  this.completedAt = new Date();
  if (details.dataDeleted) {
    this.deletionDetails.dataDeleted = details.dataDeleted;
  }
  if (details.completedActions) {
    this.deletionDetails.completedActions = details.completedActions;
  }
  return this.save();
};

// Instance method to mark as failed
dataDeletionRequestSchema.methods.markAsFailed = async function(errors = []) {
  this.status = 'failed';
  this.deletionDetails.errors = errors;
  return this.save();
};

// Static method to generate unique confirmation code
dataDeletionRequestSchema.statics.generateConfirmationCode = function() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 10; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

// Static method to find by confirmation code
dataDeletionRequestSchema.statics.findByConfirmationCode = function(code) {
  return this.findOne({ confirmationCode: code });
};

// Static method to find pending requests older than specified hours
dataDeletionRequestSchema.statics.findStaleRequests = function(hours = 24) {
  const cutoffDate = new Date();
  cutoffDate.setHours(cutoffDate.getHours() - hours);
  
  return this.find({
    status: 'pending',
    requestedAt: { $lt: cutoffDate }
  });
};

// Virtual for age of request
dataDeletionRequestSchema.virtual('ageInHours').get(function() {
  if (!this.requestedAt) return 0;
  const ageMs = Date.now() - this.requestedAt.getTime();
  return Math.floor(ageMs / (1000 * 60 * 60));
});

// Virtual for formatted status
dataDeletionRequestSchema.virtual('formattedStatus').get(function() {
  const statusMap = {
    pending: 'Pending Processing',
    processing: 'Currently Processing',
    completed: 'Completed Successfully',
    failed: 'Failed - Please Contact Support'
  };
  return statusMap[this.status] || this.status;
});

const DataDeletionRequest = mongoose.model('DataDeletionRequest', dataDeletionRequestSchema);

module.exports = DataDeletionRequest;