/**
 * Rate Limiting Middleware for WaveMAX
 * Implements different rate limits for various endpoint types
 * 
 * Configuration:
 * - NODE_ENV=test : Rate limiting is disabled
 * - RELAX_RATE_LIMITING=true : Higher limits for development/staging
 * - Production: Strict limits enforced
 */

const rateLimit = require('express-rate-limit');
const MongoStore = require('rate-limit-mongo');

// Check if rate limiting should be relaxed
const isRelaxed = process.env.RELAX_RATE_LIMITING === 'true';
const isTest = process.env.NODE_ENV === 'test';

// MongoDB store for distributed rate limiting
const createMongoStore = () => {
  if (isTest) {
    return undefined; // Use memory store for tests
  }
  
  try {
    return new MongoStore({
      uri: process.env.MONGODB_URI,
      collectionName: 'rate_limits',
      expireTimeMs: 15 * 60 * 1000, // 15 minutes
      errorHandler: console.error.bind(null, 'Rate limit store error:')
    });
  } catch (error) {
    console.error('Failed to create MongoDB rate limit store:', error);
    return undefined; // Fall back to memory store
  }
};

// Helper to skip rate limiting in test environment
const skipInTest = () => isTest;

// Authentication endpoints - strict limits
exports.authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isRelaxed ? 50 : 5, // Relaxed: 50, Production: 5 requests per window
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again in 15 minutes',
    retryAfter: 15 * 60 // seconds
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  skip: skipInTest,
  store: createMongoStore()
});

// Password reset - very strict limits
exports.passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: isRelaxed ? 10 : 3, // Relaxed: 10, Production: 3 requests per hour
  message: {
    success: false,
    message: 'Too many password reset attempts, please try again in 1 hour',
    retryAfter: 60 * 60 // seconds
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  skip: skipInTest,
  store: createMongoStore()
});

// Registration - moderate limits
exports.registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: isRelaxed ? 50 : 10, // Relaxed: 50, Production: 10 registrations per hour per IP
  message: {
    success: false,
    message: 'Too many registration attempts from this IP, please try again later',
    retryAfter: 60 * 60 // seconds
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTest,
  store: createMongoStore()
});

// API endpoints - general limits
exports.apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isRelaxed ? 500 : (process.env.RATE_LIMIT_MAX_REQUESTS || 100),
  message: {
    success: false,
    message: 'Too many requests, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip in test environment or for authenticated admin users
    return skipInTest() || (req.user && req.user.role === 'admin');
  },
  store: createMongoStore()
});

// Sensitive operations - strict limits
exports.sensitiveOperationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 operations per hour
  message: {
    success: false,
    message: 'Too many sensitive operations, please try again later',
    retryAfter: 60 * 60 // seconds
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Rate limit by user ID if authenticated, otherwise by IP
    return req.user ? `user_${req.user.id}` : req.ip;
  },
  store: createMongoStore()
});

// Email verification - prevent abuse
exports.emailVerificationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 verification emails per hour
  message: {
    success: false,
    message: 'Too many email verification requests, please try again later',
    retryAfter: 60 * 60 // seconds
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Rate limit by email or user ID
    return req.body.email || (req.user && req.user.id) || req.ip;
  },
  store: createMongoStore()
});

// OAuth callback - prevent abuse
exports.oauthCallbackLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 OAuth attempts per 15 minutes
  message: {
    success: false,
    message: 'Too many OAuth authentication attempts, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: createMongoStore()
});

// File upload - strict limits
exports.fileUploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 uploads per hour
  message: {
    success: false,
    message: 'Too many file uploads, please try again later',
    retryAfter: 60 * 60 // seconds
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Rate limit by user ID if authenticated, otherwise by IP
    return req.user ? `user_${req.user.id}` : req.ip;
  },
  store: createMongoStore()
});

// Admin operations - looser limits for authenticated admins
exports.adminOperationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // 200 operations per 15 minutes
  message: {
    success: false,
    message: 'Rate limit exceeded for admin operations'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Only apply to admin users
    return !req.user || req.user.role !== 'admin';
  },
  store: createMongoStore()
});

// Administrator login - more lenient limits to prevent lockout
exports.adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isRelaxed ? 100 : 20, // Relaxed: 100, Production: 20 login attempts
  message: {
    success: false,
    message: 'Too many login attempts, please try again in 15 minutes',
    retryAfter: 15 * 60 // seconds
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  skip: skipInTest,
  keyGenerator: (req) => {
    // Rate limit by IP + username combination to prevent lockout of legitimate users
    const username = req.body.username || req.body.email || '';
    return `admin_login_${req.ip}_${username}`;
  },
  store: createMongoStore()
});

// Create a custom rate limiter with specific settings
exports.createCustomLimiter = (options) => {
  const defaults = {
    standardHeaders: true,
    legacyHeaders: false,
    store: createMongoStore(),
    message: {
      success: false,
      message: 'Too many requests, please try again later'
    }
  };
  
  return rateLimit({ ...defaults, ...options });
};