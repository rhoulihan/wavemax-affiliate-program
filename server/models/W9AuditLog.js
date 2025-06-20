const mongoose = require('mongoose');

/**
 * W9AuditLog Model
 * Tracks all actions related to W-9 documents for compliance and security
 */
const w9AuditLogSchema = new mongoose.Schema({
  // Unique log ID
  logId: {
    type: String,
    default: () => 'W9LOG-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
    unique: true,
    index: true
  },

  // Action performed
  action: {
    type: String,
    required: true,
    enum: [
      'initiated',           // DocuSign W-9 signing initiated
      'upload_attempt',
      'upload_success',
      'upload_failed',
      'download_affiliate',  // Affiliate downloading their own W-9
      'download_admin',      // Admin downloading any W-9
      'view_attempt',
      'verify_attempt',
      'verify_success',
      'reject',
      'delete',
      'expire',
      'encryption_failed',
      'decryption_failed',
      'access_denied',
      'quickbooks_export'
    ],
    index: true
  },

  // Who performed the action
  performedBy: {
    userId: { type: String },  // Can be affiliateId or administratorId
    userType: {
      type: String,
      enum: ['affiliate', 'administrator', 'system'],
      required: true
    },
    userEmail: String,
    userName: String,
    ipAddress: String,
    userAgent: String
  },

  // Target of the action
  target: {
    affiliateId: { type: String, index: true },
    affiliateName: String,
    documentId: { type: String },  // W9Document ID if applicable
    exportId: { type: String }     // PaymentExport ID if applicable
  },

  // Action details
  details: {
    success: { type: Boolean, default: true },
    errorMessage: String,
    errorCode: String,
    fileSize: Number,
    mimeType: String,
    encryptionMethod: String,
    verificationData: {
      taxIdType: String,
      taxIdLast4: String,
      businessName: String,
      quickbooksVendorId: String
    },
    rejectionReason: String,
    exportType: String,  // For QuickBooks exports
    exportFormat: String,
    recordCount: Number,
    // DocuSign specific fields
    method: String,      // 'docusign', 'docusign-resent', etc.
    envelopeId: String,  // DocuSign envelope ID
    status: String,      // DocuSign status
    event: String        // DocuSign webhook event
  },

  // Security information
  security: {
    sessionId: String,
    csrfTokenUsed: Boolean,
    tlsVersion: String,
    encryptionKeyId: String,
    integrityCheckPassed: Boolean
  },

  // Compliance tracking
  compliance: {
    dataRetentionPolicy: {
      type: String,
      default: '7_years'
    },
    gdprConsent: Boolean,
    dataLocation: {
      type: String,
      default: 'us-east-1'
    },
    legalHold: {
      type: Boolean,
      default: false
    }
  },

  // Timestamps
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },

  // Soft delete for audit logs (never actually delete)
  archived: {
    type: Boolean,
    default: false
  },

  archivedAt: Date,
  archivedBy: String
}, {
  timestamps: true,
  collection: 'w9auditlogs'
});

// Indexes for efficient querying
w9AuditLogSchema.index({ 'performedBy.userId': 1, timestamp: -1 });
w9AuditLogSchema.index({ 'target.affiliateId': 1, timestamp: -1 });
w9AuditLogSchema.index({ action: 1, timestamp: -1 });
w9AuditLogSchema.index({ 'details.success': 1, timestamp: -1 });
w9AuditLogSchema.index({ timestamp: -1 });

// Prevent modification of audit logs
w9AuditLogSchema.pre('save', function(next) {
  if (!this.isNew) {
    return next(new Error('Audit logs cannot be modified'));
  }
  next();
});

// Static method to create audit log entry
w9AuditLogSchema.statics.logAction = async function(action, performedBy, target, details = {}, security = {}) {
  try {
    const logEntry = new this({
      action,
      performedBy,
      target,
      details,
      security,
      compliance: {
        gdprConsent: performedBy.userType === 'affiliate' ? true : null
      }
    });

    await logEntry.save();
    return logEntry;
  } catch (error) {
    // Log to console if database logging fails
    console.error('Failed to create W9 audit log:', {
      action,
      performedBy: performedBy.userId,
      error: error.message
    });
    // Don't throw - audit logging should not break the main operation
    return null;
  }
};

// Static method to get audit trail for an affiliate
w9AuditLogSchema.statics.getAffiliateAuditTrail = async function(affiliateId, options = {}) {
  const {
    startDate,
    endDate,
    actions,
    limit = 100,
    skip = 0
  } = options;

  const query = { 'target.affiliateId': affiliateId };

  if (startDate || endDate) {
    query.timestamp = {};
    if (startDate) query.timestamp.$gte = startDate;
    if (endDate) query.timestamp.$lte = endDate;
  }

  if (actions && actions.length > 0) {
    query.action = { $in: actions };
  }

  return this.find(query)
    .sort({ timestamp: -1 })
    .limit(limit)
    .skip(skip)
    .lean();
};

// Static method to get compliance report
w9AuditLogSchema.statics.getComplianceReport = async function(startDate, endDate) {
  const pipeline = [
    {
      $match: {
        timestamp: { $gte: startDate, $lte: endDate },
        archived: false
      }
    },
    {
      $group: {
        _id: {
          action: '$action',
          success: '$details.success'
        },
        count: { $sum: 1 },
        users: { $addToSet: '$performedBy.userId' }
      }
    },
    {
      $group: {
        _id: '$_id.action',
        total: { $sum: '$count' },
        successful: {
          $sum: {
            $cond: [{ $eq: ['$_id.success', true] }, '$count', 0]
          }
        },
        failed: {
          $sum: {
            $cond: [{ $eq: ['$_id.success', false] }, '$count', 0]
          }
        },
        uniqueUsers: { $addToSet: '$users' }
      }
    },
    {
      $project: {
        action: '$_id',
        total: 1,
        successful: 1,
        failed: 1,
        uniqueUserCount: { $size: { $reduce: {
          input: '$uniqueUsers',
          initialValue: [],
          in: { $setUnion: ['$$value', '$$this'] }
        } } }
      }
    }
  ];

  return this.aggregate(pipeline);
};

// Instance method to archive (soft delete)
w9AuditLogSchema.methods.archive = async function(archivedBy) {
  this.archived = true;
  this.archivedAt = new Date();
  this.archivedBy = archivedBy;
  return this.save();
};

const W9AuditLog = mongoose.model('W9AuditLog', w9AuditLogSchema);

module.exports = W9AuditLog;