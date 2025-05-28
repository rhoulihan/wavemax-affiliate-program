// Audit Logger for Security Events
// Logs important security events for compliance and monitoring

const winston = require('winston');
const path = require('path');

// Create audit logger with separate file
const auditLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    // Audit log file
    new winston.transports.File({
      filename: path.join(__dirname, '../../logs/audit.log'),
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 30 // Keep 30 days of logs
    }),
    // Critical security events also go to error log
    new winston.transports.File({
      filename: path.join(__dirname, '../../logs/security-critical.log'),
      level: 'error',
      maxsize: 10 * 1024 * 1024,
      maxFiles: 90 // Keep 90 days of critical logs
    })
  ]
});

// Add console transport in development
if (process.env.NODE_ENV !== 'production') {
  auditLogger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

// Audit event types
const AuditEvents = {
  // Authentication events
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_FAILED: 'LOGIN_FAILED',
  LOGOUT: 'LOGOUT',
  PASSWORD_RESET_REQUEST: 'PASSWORD_RESET_REQUEST',
  PASSWORD_RESET_SUCCESS: 'PASSWORD_RESET_SUCCESS',
  PASSWORD_RESET_FAILED: 'PASSWORD_RESET_FAILED',
  TOKEN_REFRESH: 'TOKEN_REFRESH',
  TOKEN_REFRESH_FAILED: 'TOKEN_REFRESH_FAILED',

  // Authorization events
  UNAUTHORIZED_ACCESS: 'UNAUTHORIZED_ACCESS',
  PERMISSION_DENIED: 'PERMISSION_DENIED',

  // Data access events
  SENSITIVE_DATA_ACCESS: 'SENSITIVE_DATA_ACCESS',
  PAYMENT_INFO_ACCESS: 'PAYMENT_INFO_ACCESS',
  PAYMENT_INFO_UPDATE: 'PAYMENT_INFO_UPDATE',

  // Account management
  ACCOUNT_CREATED: 'ACCOUNT_CREATED',
  ACCOUNT_UPDATED: 'ACCOUNT_UPDATED',
  ACCOUNT_DELETED: 'ACCOUNT_DELETED',
  ACCOUNT_SUSPENDED: 'ACCOUNT_SUSPENDED',

  // Security events
  SUSPICIOUS_ACTIVITY: 'SUSPICIOUS_ACTIVITY',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  INVALID_CSRF_TOKEN: 'INVALID_CSRF_TOKEN',
  SQL_INJECTION_ATTEMPT: 'SQL_INJECTION_ATTEMPT',
  XSS_ATTEMPT: 'XSS_ATTEMPT',

  // Order events
  ORDER_CREATED: 'ORDER_CREATED',
  ORDER_CANCELLED: 'ORDER_CANCELLED',
  ORDER_STATUS_CHANGED: 'ORDER_STATUS_CHANGED',

  // Financial events
  COMMISSION_CALCULATED: 'COMMISSION_CALCULATED',
  PAYMENT_PROCESSED: 'PAYMENT_PROCESSED',
  REFUND_ISSUED: 'REFUND_ISSUED'
};

/**
 * Log an audit event
 * @param {string} eventType - Type of event from AuditEvents
 * @param {Object} details - Event details
 * @param {Object} req - Express request object (optional)
 */
const logAuditEvent = (eventType, details, req = null) => {
  const auditEntry = {
    eventType,
    timestamp: new Date().toISOString(),
    ...details
  };

  // Add request context if available
  if (req && typeof req.get === 'function') {
    auditEntry.ip = req.ip || (req.connection && req.connection.remoteAddress) || 'unknown';
    auditEntry.userAgent = req.get('user-agent');
    auditEntry.method = req.method;
    auditEntry.path = req.path;

    // Add user context if authenticated
    if (req.user) {
      auditEntry.userId = req.user.id || req.user._id;
      auditEntry.userRole = req.user.role;
      auditEntry.username = req.user.username || req.user.email;

      // Only add affiliateId/customerId if not already in details
      if (req.user.affiliateId && !auditEntry.affiliateId) {
        auditEntry.affiliateId = req.user.affiliateId;
      }
      if (req.user.customerId && !auditEntry.customerId) {
        auditEntry.customerId = req.user.customerId;
      }
    }
  }

  // Determine log level based on event type
  const criticalEvents = [
    AuditEvents.UNAUTHORIZED_ACCESS,
    AuditEvents.PERMISSION_DENIED,
    AuditEvents.SUSPICIOUS_ACTIVITY,
    AuditEvents.SQL_INJECTION_ATTEMPT,
    AuditEvents.XSS_ATTEMPT,
    AuditEvents.INVALID_CSRF_TOKEN
  ];

  const level = criticalEvents.includes(eventType) ? 'error' : 'info';

  auditLogger.log(level, auditEntry);
};

/**
 * Express middleware for automatic audit logging
 */
const auditMiddleware = (eventType) => {
  return (req, res, next) => {
    // Log at the end of request
    res.on('finish', () => {
      if (res.statusCode < 400) {
        logAuditEvent(eventType, {
          statusCode: res.statusCode,
          success: true
        }, req);
      }
    });

    next();
  };
};

/**
 * Log login attempts
 */
const logLoginAttempt = (success, userType, username, req, reason = null) => {
  logAuditEvent(
    success ? AuditEvents.LOGIN_SUCCESS : AuditEvents.LOGIN_FAILED,
    {
      userType,
      username,
      success,
      reason
    },
    req
  );
};

/**
 * Log sensitive data access
 */
const logSensitiveDataAccess = (dataType, dataId, action, req) => {
  logAuditEvent(
    AuditEvents.SENSITIVE_DATA_ACCESS,
    {
      dataType,
      dataId,
      action
    },
    req
  );
};

/**
 * Log payment information access/updates
 */
const logPaymentActivity = (action, customerId, req, details = {}) => {
  const eventType = action === 'access'
    ? AuditEvents.PAYMENT_INFO_ACCESS
    : AuditEvents.PAYMENT_INFO_UPDATE;

  logAuditEvent(
    eventType,
    {
      customerId,
      action,
      ...details
    },
    req
  );
};

/**
 * Log suspicious activity
 */
const logSuspiciousActivity = (activityType, details, req) => {
  logAuditEvent(
    AuditEvents.SUSPICIOUS_ACTIVITY,
    {
      activityType,
      ...details,
      severity: 'high'
    },
    req
  );
};

module.exports = {
  auditLogger,
  AuditEvents,
  logAuditEvent,
  auditMiddleware,
  logLoginAttempt,
  logSensitiveDataAccess,
  logPaymentActivity,
  logSuspiciousActivity
};