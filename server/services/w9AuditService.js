const W9AuditLog = require('../models/W9AuditLog');

/**
 * W9 Audit Service
 * Provides centralized audit logging for all W-9 related operations
 */
class W9AuditService {
  /**
     * Extract user information from request
     */
  static getUserInfo(req) {
    const user = req.user || {};
    const userType = user.role || (user.affiliateId ? 'affiliate' : 'system');

    return {
      userId: user._id || user.affiliateId || user.administratorId || 'system',
      userType,
      userEmail: user.email || 'unknown',
      userName: user.firstName ? `${user.firstName} ${user.lastName}` : user.username || 'System',
      ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
      userAgent: req.get('user-agent') || 'unknown'
    };
  }

  /**
     * Extract security information from request
     */
  static getSecurityInfo(req) {
    return {
      sessionId: req.sessionID || req.session?.id,
      csrfTokenUsed: !!req.csrfToken,
      tlsVersion: req.connection.encrypted ? req.connection.getCipher()?.version : null,
      encryptionKeyId: process.env.ENCRYPTION_KEY_ID || 'default'
    };
  }

  /**
     * Log W-9 upload attempt
     */
  static async logUploadAttempt(req, affiliateId, success, details = {}) {
    const action = success ? 'upload_success' : 'upload_failed';

    return W9AuditLog.logAction(
      action,
      this.getUserInfo(req),
      { affiliateId },
      {
        success,
        ...details
      },
      this.getSecurityInfo(req)
    );
  }

  /**
     * Log W-9 download
     */
  static async logDownload(req, affiliateId, documentId, isAdminDownload = false) {
    const action = isAdminDownload ? 'download_admin' : 'download_affiliate';

    return W9AuditLog.logAction(
      action,
      this.getUserInfo(req),
      { affiliateId, documentId },
      { success: true },
      this.getSecurityInfo(req)
    );
  }

  /**
     * Log W-9 verification
     */
  static async logVerification(req, affiliateId, documentId, verificationData) {
    return W9AuditLog.logAction(
      'verify_success',
      this.getUserInfo(req),
      { affiliateId, documentId },
      {
        success: true,
        verificationData: {
          taxIdType: verificationData.taxIdType,
          taxIdLast4: verificationData.taxIdLast4,
          businessName: verificationData.businessName,
          quickbooksVendorId: verificationData.quickbooksVendorId
        }
      },
      this.getSecurityInfo(req)
    );
  }

  /**
     * Log W-9 rejection
     */
  static async logRejection(req, affiliateId, documentId, reason) {
    return W9AuditLog.logAction(
      'reject',
      this.getUserInfo(req),
      { affiliateId, documentId },
      {
        success: true,
        rejectionReason: reason
      },
      this.getSecurityInfo(req)
    );
  }

  /**
     * Log QuickBooks export
     */
  static async logQuickBooksExport(req, exportType, exportId, details = {}) {
    return W9AuditLog.logAction(
      'quickbooks_export',
      this.getUserInfo(req),
      { exportId },
      {
        success: true,
        exportType,
        exportFormat: details.format || 'csv',
        recordCount: details.recordCount || 0,
        ...details
      },
      this.getSecurityInfo(req)
    );
  }

  /**
     * Log access denied
     */
  static async logAccessDenied(req, affiliateId, reason) {
    return W9AuditLog.logAction(
      'access_denied',
      this.getUserInfo(req),
      { affiliateId },
      {
        success: false,
        errorMessage: reason
      },
      this.getSecurityInfo(req)
    );
  }

  /**
     * Log encryption/decryption failures
     */
  static async logEncryptionFailure(req, affiliateId, documentId, operation, error) {
    const action = operation === 'encrypt' ? 'encryption_failed' : 'decryption_failed';

    return W9AuditLog.logAction(
      action,
      this.getUserInfo(req),
      { affiliateId, documentId },
      {
        success: false,
        errorMessage: error.message,
        errorCode: error.code
      },
      this.getSecurityInfo(req)
    );
  }

  /**
     * Get audit trail for compliance reporting
     */
  static async getComplianceAuditTrail(affiliateId, options = {}) {
    return W9AuditLog.getAffiliateAuditTrail(affiliateId, options);
  }

  /**
     * Generate compliance report
     */
  static async generateComplianceReport(startDate, endDate) {
    const report = await W9AuditLog.getComplianceReport(startDate, endDate);

    // Add summary statistics
    const summary = {
      totalActions: 0,
      successfulActions: 0,
      failedActions: 0,
      uniqueUsers: new Set(),
      actionBreakdown: {}
    };

    report.forEach(item => {
      summary.totalActions += item.total;
      summary.successfulActions += item.successful;
      summary.failedActions += item.failed;
      summary.actionBreakdown[item.action] = {
        total: item.total,
        successful: item.successful,
        failed: item.failed,
        successRate: item.total > 0 ? (item.successful / item.total * 100).toFixed(2) + '%' : '0%'
      };
    });

    return {
      period: {
        start: startDate,
        end: endDate
      },
      summary,
      details: report,
      generatedAt: new Date()
    };
  }

  /**
     * Check for suspicious activity
     */
  static async checkSuspiciousActivity(userId, action, timeWindow = 3600000) { // 1 hour
    const recentActions = await W9AuditLog.find({
      'performedBy.userId': userId,
      action,
      timestamp: { $gte: new Date(Date.now() - timeWindow) }
    }).countDocuments();

    const thresholds = {
      'upload_attempt': 10,
      'download_admin': 50,
      'download_affiliate': 20,
      'access_denied': 5
    };

    const threshold = thresholds[action] || 100;
    return recentActions > threshold;
  }

  /**
     * Archive old audit logs (for data retention)
     */
  static async archiveOldLogs(daysToKeep = 2555) { // 7 years default
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await W9AuditLog.updateMany(
      {
        timestamp: { $lt: cutoffDate },
        archived: false,
        'compliance.legalHold': false
      },
      {
        $set: {
          archived: true,
          archivedAt: new Date(),
          archivedBy: 'system_retention_policy'
        }
      }
    );

    return {
      archivedCount: result.modifiedCount,
      cutoffDate,
      policy: `${daysToKeep} days retention`
    };
  }
}

module.exports = W9AuditService;