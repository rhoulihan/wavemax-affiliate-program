/**
 * CSRF Configuration and Middleware
 * Implements defense-in-depth with JWT + CSRF tokens
 */

const csrf = require('csurf');
const auditLogger = require('../utils/auditLogger');

// CSRF token generation middleware
const csrfProtection = csrf({
  cookie: false, // Use req.session instead of cookies
  value: (req) => {
    // Check multiple locations for CSRF token
    return req.body._csrf || 
           req.query._csrf || 
           req.headers['csrf-token'] || 
           req.headers['xsrf-token'] || 
           req.headers['x-csrf-token'] || 
           req.headers['x-xsrf-token'];
  }
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
    '/api/v1/auth/customer/linkedin/callback'
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
    '/api/v1/auth/social/register',
    '/api/v1/auth/customer/social/register'
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

  // For authenticated requests without session cookies (iframe context),
  // skip CSRF check as we rely on bearer token authentication
  if (req.headers.authorization && !req.headers.cookie?.includes('wavemax.sid')) {
    console.log('Skipping CSRF for authenticated request without session cookie');
    return next();
  }

  // Debug session state
  console.log('CSRF check for:', req.path, {
    sessionID: req.sessionID,
    hasSession: !!req.session,
    sessionCookie: req.headers.cookie,
    hasCsrfSecret: !!req.session?.csrfSecret,
    hasAuth: !!req.headers.authorization,
    origin: req.headers.origin,
    referer: req.headers.referer,
    userAgent: req.headers['user-agent']?.substring(0, 50)
  });

  // Apply CSRF protection
  csrfProtection(req, res, (err) => {
    if (err && err.code === 'EBADCSRFTOKEN') {
      // Log CSRF violation with more details
      console.error('CSRF validation failed:', {
        error: err.message,
        sessionID: req.sessionID,
        hasSession: !!req.session,
        hasCsrfSecret: !!req.session?.csrfSecret,
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

      // Return clear error message
      return res.status(403).json({
        success: false,
        error: 'Invalid or missing CSRF token',
        code: 'CSRF_VALIDATION_FAILED',
        message: 'Your request was rejected due to security validation. Please refresh and try again.'
      });
    }
    
    if (err) {
      // Other CSRF errors
      console.error('CSRF middleware error:', err);
      return res.status(500).json({
        success: false,
        error: 'Security validation error',
        message: 'An error occurred during security validation.'
      });
    }

    next();
  });
};

// CSRF token generation endpoint
const csrfTokenEndpoint = (req, res, next) => {
  // Initialize session if it doesn't exist
  if (!req.session) {
    return res.status(500).json({ 
      success: false,
      error: 'Session not initialized' 
    });
  }

  console.log('CSRF token generation:', {
    sessionID: req.sessionID,
    hasSession: !!req.session,
    hasCsrfSecret: !!req.session?.csrfSecret
  });

  // Apply CSRF protection to generate token
  csrfProtection(req, res, (err) => {
    if (err) {
      console.error('CSRF token generation error:', err);
      return res.status(500).json({ 
        success: false,
        error: 'Failed to generate CSRF token' 
      });
    }
    
    const token = req.csrfToken();
    console.log('=== Generated CSRF token ===');
    console.log('Token:', token);
    console.log('Session ID:', req.sessionID);
    console.log('CSRF Secret:', req.session?.csrfSecret?.substring(0, 10) + '...');
    console.log('===========================');
    
    // Return token
    res.json({ 
      success: true,
      csrfToken: token
    });
  });
};

// Export configuration and middleware
module.exports = {
  CSRF_CONFIG,
  csrfProtection,
  conditionalCsrf,
  csrfTokenEndpoint,
  shouldEnforceCsrf
};