// System health service
//
// Admin-only introspection: environment variables (sanitized + optionally
// desanitized for super-admins), and rate-limit collection reset. Both are
// audit-logged. The env-var allowlist is the source of truth for what the
// UI renders — add new vars here, not in the controller.

const mongoose = require('mongoose');
const { logAuditEvent, AuditEvents } = require('../utils/auditLogger');
const logger = require('../utils/logger');

const ALLOWED_ENV_VARS = [
  // Application
  'NODE_ENV', 'PORT', 'BASE_URL', 'FRONTEND_URL', 'BACKEND_URL',
  'CORS_ORIGIN', 'OAUTH_CALLBACK_URI', 'TRUST_PROXY', 'COOKIE_SECURE',
  // Database
  'MONGODB_URI',
  // Security & Authentication
  'JWT_SECRET', 'SESSION_SECRET', 'ENCRYPTION_KEY',
  // Email
  'EMAIL_PROVIDER', 'EMAIL_FROM', 'EMAIL_HOST', 'EMAIL_PORT',
  'EMAIL_USER', 'EMAIL_PASS', 'EMAIL_SECURE',
  // AWS (optional)
  'AWS_S3_BUCKET', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_REGION',
  // Stripe (deprecated but still in env)
  'STRIPE_PUBLISHABLE_KEY', 'STRIPE_SECRET_KEY',
  // Feature flags
  'SHOW_DOCS', 'ENABLE_TEST_PAYMENT_FORM', 'ENABLE_DELETE_DATA_FEATURE',
  'CSRF_PHASE', 'RELAX_RATE_LIMITING',
  // Rate limiting
  'RATE_LIMIT_WINDOW_MS', 'RATE_LIMIT_MAX_REQUESTS', 'AUTH_RATE_LIMIT_MAX',
  // Social login
  'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET',
  'FACEBOOK_APP_ID', 'FACEBOOK_APP_SECRET',
  'LINKEDIN_CLIENT_ID', 'LINKEDIN_CLIENT_SECRET',
  // Logging
  'LOG_LEVEL', 'LOG_DIR',
  // Business configuration
  'BAG_FEE',
  // Default accounts
  'DEFAULT_ADMIN_EMAIL'
];

class SystemHealthError extends Error {
  constructor(code, message, status = 500) {
    super(message);
    this.code = code;
    this.status = status;
    this.isSystemHealthError = true;
  }
}

function isSuperAdmin(user) {
  return user.permissions?.includes('*')
    || user.isSuperAdmin
    || user.email === process.env.DEFAULT_ADMIN_EMAIL;
}

function isSensitiveVarName(varName) {
  return varName.includes('SECRET')
    || varName.includes('PASSWORD')
    || varName.includes('KEY')
    || varName.includes('TOKEN');
}

async function getEnvironmentVariables({ user, req }) {
  const superAdmin = isSuperAdmin(user);

  const variables = {};
  const sensitiveValues = {};

  for (const varName of ALLOWED_ENV_VARS) {
    const value = process.env[varName] || '';
    if (isSensitiveVarName(varName) && superAdmin && value) {
      sensitiveValues[varName] = value;
      variables[varName] = '••••••••';
    } else {
      variables[varName] = value;
    }
  }

  let paygistixConfig = {};
  try {
    const paygistixForms = require('../config/paygistix-forms.json');
    paygistixConfig = {
      'PAYGISTIX_MERCHANT_ID (from JSON)': paygistixForms.merchantId || 'Not configured',
      'PAYGISTIX_FORM_ID (from JSON)': paygistixForms.form?.formId || 'Not configured',
      'PAYGISTIX_FORM_HASH (from JSON)': superAdmin
        ? (paygistixForms.form?.formHash || 'Not configured')
        : '••••••••',
      'PAYGISTIX_CONFIG_SOURCE': 'paygistix-forms.json'
    };
  } catch (error) {
    paygistixConfig = { 'PAYGISTIX_CONFIG_ERROR': 'Failed to load paygistix-forms.json' };
  }

  await logAuditEvent(AuditEvents.ADMIN_VIEW_ENV_VARS, user, {
    action: 'view_environment_variables',
    viewedSensitive: superAdmin && Object.keys(sensitiveValues).length > 0
  }, req);

  return {
    variables: { ...variables, ...paygistixConfig },
    sensitiveValues: superAdmin ? sensitiveValues : {},
    isSuperAdmin: superAdmin
  };
}

async function resetRateLimits({ type, ip, user, req }) {
  const db = mongoose.connection.db;
  if (!db) {
    logger.error('Database connection not available');
    throw new SystemHealthError('db_unavailable', 'Database connection not available');
  }

  const filter = {};
  if (ip) {
    const escapedIp = ip.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.key = new RegExp(escapedIp);
  } else if (type) {
    filter.key = new RegExp(`^${type}:`);
  }

  const result = await db.collection('rate_limits').deleteMany(filter);

  await logAuditEvent(AuditEvents.ADMIN_RESET_RATE_LIMITS, user, {
    type, ip, deletedCount: result.deletedCount
  }, req);

  return { deletedCount: result.deletedCount };
}

module.exports = {
  getEnvironmentVariables,
  resetRateLimits,
  SystemHealthError,
  ALLOWED_ENV_VARS
};
