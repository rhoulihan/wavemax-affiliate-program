/**
 * CSRF Configuration and Middleware
 * Implements defense-in-depth with JWT + CSRF tokens.
 *
 * SEC M-5 (closed): migrated from the deprecated `csurf` package to
 * `csrf-csrf` (double-submit-cookie pattern, actively maintained).
 * The conditional-enforcement logic, allowlists, and error/audit
 * handling are unchanged — only the token generation/validation
 * primitives were swapped.
 */

const { doubleCsrf } = require('csrf-csrf');
const auditLogger = require('../utils/auditLogger');
const logger = require('../utils/logger');

const CSRF_COOKIE_NAME = process.env.NODE_ENV === 'production'
  ? '__Host-x-csrf'   // host-only secure cookie name in prod
  : 'x-csrf';         // dev (no HTTPS, __Host- requires Secure)

const {
  generateCsrfToken,
  doubleCsrfProtection,
  invalidCsrfTokenError
} = doubleCsrf({
  // Server secret for HMAC. Falls back to SESSION_SECRET (then JWT_SECRET)
  // so existing deployments don't need a new env var to function — but a
  // dedicated CSRF_SECRET is recommended for independent rotation.
  getSecret: () => process.env.CSRF_SECRET
                || process.env.SESSION_SECRET
                || process.env.JWT_SECRET
                || '',
  // Stable per-user identifier used to bind the cookie token to the
  // request origin. Express-session ID when available, else IP. The
  // identifier is hashed into the token, never echoed back.
  getSessionIdentifier: (req) => req.sessionID || req.ip || 'no-session',
  cookieName: CSRF_COOKIE_NAME,
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',  // 'strict' breaks OAuth-popup-back navigation
    path: '/'
  },
  size: 64,
  ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
  // Accept the token in any of the headers/body fields we historically
  // supported, so existing clients keep working.
  getCsrfTokenFromRequest: (req) =>
    req.body?._csrf ||
    req.query?._csrf ||
    req.headers['csrf-token'] ||
    req.headers['xsrf-token'] ||
    req.headers['x-csrf-token'] ||
    req.headers['x-xsrf-token']
});

// Define endpoint categories for CSRF protection
const CSRF_CONFIG = {
  // Truly public endpoints that should NEVER require CSRF
  PUBLIC_ENDPOINTS: [
    // Public information endpoints (GET only)
    '/api/v1/affiliates/:affiliateId/public',
    '/api/affiliates/:affiliateId/public',

    // Health check endpoints
    '/api/health',
    '/api/v1/health',

    // Username and email availability check (public endpoints)
    '/api/v1/auth/check-username',
    '/api/v1/auth/check-email',

    // OAuth endpoints (GET only - these handle their own security)
    '/api/v1/auth/google',
    '/api/v1/auth/facebook',
    '/api/v1/auth/linkedin',
    '/api/v1/auth/google/callback',
    '/api/v1/auth/facebook/callback',
    '/api/v1/auth/linkedin/callback',
    '/api/v1/auth/customer/google',
    '/api/v1/auth/customer/facebook',
    '/api/v1/auth/customer/linkedin',
    '/api/v1/auth/customer/google/callback',
    '/api/v1/auth/customer/facebook/callback',
    '/api/v1/auth/customer/linkedin/callback',

    // Facebook data deletion webhook (external callback)
    '/api/v1/auth/facebook/deletion-callback',

    // Public concierge — credential-free, no ambient cookie/session, so it is
    // not a CSRF target (an attacker's forged POST gains nothing). Same-origin
    // from the design-explorer pages; abuse is bounded by conciergeLimiter.
    '/api/concierge',

    // Test endpoints (development only)
    '/api/v1/test/customer',
    '/api/v1/test/order',
    '/api/v1/test/cleanup',
    
    // Service area endpoints (public for registration forms)
    '/api/v1/service-area/config',
    '/api/v1/service-area/autocomplete',
    '/api/v1/service-area/validate',
    '/api/v1/service-area/cities',
    '/api/v1/service-area/zip-codes',
    '/api/v1/service-area/city/:zipCode',
    '/api/v1/service-area/zip-codes/:city'
  ],

  // Authentication endpoints - will add rate limiting instead of CSRF
  AUTH_ENDPOINTS: [
    '/api/auth/affiliate/login',
    '/api/auth/customer/login',
    '/api/auth/administrator/login',
    '/api/auth/operator/login',
    '/api/auth/forgot-password',
    '/api/auth/reset-password',
    '/api/auth/refresh-token',
    '/api/v1/auth/affiliate/login',
    '/api/v1/auth/customer/login',
    '/api/v1/auth/administrator/login',
    '/api/v1/auth/operator/login',
    '/api/v1/auth/forgot-password',
    '/api/v1/auth/reset-password',
    '/api/v1/auth/refresh-token',
    '/api/v1/auth/oauth-session/:sessionId',
    // Password change endpoints (part of auth flow)
    '/api/v1/administrators/change-password',
    '/api/v1/affiliates/change-password',
    '/api/v1/customers/change-password',
    '/api/v1/operators/change-password'
  ],

  // Registration endpoints - will add CAPTCHA instead of CSRF
  REGISTRATION_ENDPOINTS: [
    '/api/affiliates/register',
    '/api/customers/register',
    '/api/v1/affiliates/register',
    '/api/v1/customers/register',
    '/api/v1/affiliates/beta-request',
    '/api/affiliates/beta-request',
    '/api/v1/auth/social/register',
    '/api/v1/auth/customer/social/register',
    // Payment token creation for registration (part of registration flow)
    // Excluded from CSRF due to cross-origin iframe limitations where sessions
    // may not be properly established. Protected by rate limiting and validation.
    '/api/v1/payments/create-token'
  ],

  // CRITICAL endpoints that MUST have CSRF protection (Phase 1)
  CRITICAL_ENDPOINTS: [
    // Logout (prevents logout CSRF)
    '/api/v1/auth/logout',

    // Order management
    '/api/v1/orders',
    '/api/v1/orders/:orderId',
    '/api/v1/orders/:orderId/status',
    '/api/v1/orders/:orderId/cancel',
    '/api/v1/orders/:orderId/payment-status',
    '/api/v1/orders/bulk/status',

    // Password changes
    '/api/v1/customers/:customerId/password',

    // Data deletion
    '/api/v1/affiliates/:affiliateId/delete-all-data',
    '/api/v1/customers/:customerId/delete-all-data',

    // Admin operations
    '/api/v1/administrators/operators',
    '/api/v1/administrators/operators/:operatorId',
    '/api/v1/administrators/operators/:operatorId/reset-pin',
    '/api/v1/administrators/config',

    // Operator critical actions
    '/api/v1/operators/orders/:orderId/claim',
    '/api/v1/operators/orders/:orderId/status',
    '/api/v1/operators/orders/:orderId/quality-check',
    '/api/v1/operators/shift/status'
  ],

  // HIGH priority endpoints (Phase 2)
  HIGH_PRIORITY_ENDPOINTS: [
    // Profile updates
    '/api/v1/customers/:customerId',
    '/api/v1/customers/:customerId/profile',
    '/api/v1/customers/:customerId/payment',
    '/api/v1/affiliates/:affiliateId'
  ],

  // READ-ONLY endpoints that can remain without CSRF
  READ_ONLY_ENDPOINTS: [
    // Dashboard data (GET only)
    '/api/v1/customers/:customerId/dashboard',
    '/api/v1/affiliates/:affiliateId/dashboard',
    '/api/v1/operators/dashboard',
    '/api/v1/administrators/dashboard',

    // List/search endpoints (GET only)
    '/api/v1/customers/:customerId/orders',
    '/api/v1/affiliates/:affiliateId/customers',
    '/api/v1/affiliates/:affiliateId/orders',
    '/api/v1/orders/search',
    '/api/v1/orders/statistics',
    '/api/v1/orders/export'
  ]
};

// Determine if endpoint should have CSRF protection
function shouldEnforceCsrf(req) {
  const path = req.path;
  const method = req.method;

  // Never enforce CSRF on GET, HEAD, OPTIONS
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    return false;
  }

  // Check if path matches any pattern
  const matchesPattern = (patterns) => {
    return patterns.some(pattern => {
      if (pattern.includes(':')) {
        // Convert Express route pattern to regex
        const regex = new RegExp('^' + pattern.replace(/:[^/]+/g, '[^/]+') + '$');
        return regex.test(path);
      }
      return path === pattern;
    });
  };

  // Public endpoints - never enforce
  if (matchesPattern(CSRF_CONFIG.PUBLIC_ENDPOINTS)) {
    return false;
  }

  // For now, still exclude auth and registration endpoints
  // These will be protected with rate limiting and CAPTCHA instead
  if (matchesPattern(CSRF_CONFIG.AUTH_ENDPOINTS) ||
      matchesPattern(CSRF_CONFIG.REGISTRATION_ENDPOINTS)) {
    return false;
  }

  // CRITICAL endpoints - always enforce
  if (matchesPattern(CSRF_CONFIG.CRITICAL_ENDPOINTS)) {
    return true;
  }

  // HIGH priority endpoints - enforce based on rollout phase
  if (matchesPattern(CSRF_CONFIG.HIGH_PRIORITY_ENDPOINTS)) {
    // Can be controlled by environment variable for gradual rollout
    return process.env.CSRF_PHASE >= 2;
  }

  // Read-only endpoints - don't enforce
  if (matchesPattern(CSRF_CONFIG.READ_ONLY_ENDPOINTS)) {
    return false;
  }

  // Default: enforce CSRF for all other state-changing requests
  return true;
}

// Enhanced CSRF middleware with better error handling
const conditionalCsrf = (req, res, next) => {
  // Determine if CSRF should be enforced
  if (!shouldEnforceCsrf(req)) {
    return next();
  }

  // SEC H-1 (closed): the previous "bearer-only" bypass — skipping CSRF
  // whenever an Authorization header was present and the wavemax.sid
  // cookie was absent — was removed because (a) the bypass keyed on a
  // single cookie name, so any future cookie-based session would silently
  // re-introduce the CSRF hole, and (b) the comment justifying it
  // assumed Bearer tokens are the only auth path, which is no longer
  // strictly true (httpOnly-cookie deployments and password-change /
  // logout flows can be cookie-driven). Defense in depth: every
  // state-changing request that isn't on the public/auth/registration
  // allowlist must present a CSRF token, regardless of how it
  // authenticates.

  // Debug session state
  logger.info('CSRF check for:', req.path, {
    sessionID: req.sessionID,
    hasSession: !!req.session,
    hasAuth: !!req.headers.authorization,
    origin: req.headers.origin,
    referer: req.headers.referer,
    userAgent: req.headers['user-agent']?.substring(0, 50)
  });

  // Apply CSRF protection (csrf-csrf double-submit-cookie validation)
  doubleCsrfProtection(req, res, (err) => {
    if (!err) return next();

    // csrf-csrf throws invalidCsrfTokenError instances rather than
    // EBADCSRFTOKEN strings, so identify by reference + by message.
    const isCsrfError = err === invalidCsrfTokenError
      || err?.code === 'EBADCSRFTOKEN'
      || /csrf/i.test(err?.message || '');

    if (isCsrfError) {
      logger.error('CSRF validation failed:', {
        error: err.message,
        sessionID: req.sessionID,
        receivedToken: req.headers['x-csrf-token'] || 'none',
        path: req.path,
        method: req.method
      });

      auditLogger.logSuspiciousActivity(
        'CSRF_VALIDATION_FAILED',
        {
          userId: req.user?.id || 'anonymous',
          userType: req.user?.role || 'unknown',
          path: req.path,
          method: req.method,
          ip: req.ip,
          userAgent: req.get('user-agent')
        },
        req
      );

      return res.status(403).json({
        success: false,
        error: 'Invalid or missing CSRF token',
        code: 'CSRF_VALIDATION_FAILED',
        message: 'Your request was rejected due to security validation. Please refresh and try again.'
      });
    }

    logger.error('CSRF middleware error:', err);
    return res.status(500).json({
      success: false,
      error: 'Security validation error',
      message: 'An error occurred during security validation.'
    });
  });
};

// CSRF token generation endpoint. csrf-csrf's generateCsrfToken sets the
// double-submit cookie on the response and returns the matching header
// token. Clients send that header back on mutations; the cookie is
// validated by doubleCsrfProtection.
const csrfTokenEndpoint = (req, res, next) => {
  try {
    if (!req.session) {
      return res.status(500).json({
        success: false,
        error: 'Session not initialized'
      });
    }
    const token = generateCsrfToken(req, res, { overwrite: true });
    logger.info('CSRF token issued:', {
      sessionID: req.sessionID,
      tokenPrefix: token.substring(0, 10) + '...'
    });
    res.json({ success: true, csrfToken: token });
  } catch (err) {
    logger.error('CSRF token generation error:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to generate CSRF token'
    });
  }
};

// Export configuration and middleware
module.exports = {
  CSRF_CONFIG,
  // Backwards-compat alias: callers that imported `csrfProtection` get
  // the doubleCsrfProtection middleware. Same call signature, same
  // request semantics.
  csrfProtection: doubleCsrfProtection,
  conditionalCsrf,
  csrfTokenEndpoint,
  shouldEnforceCsrf
};