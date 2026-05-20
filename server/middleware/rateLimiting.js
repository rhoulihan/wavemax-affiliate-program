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
const logger = require('../utils/logger');

// Check if rate limiting should be relaxed
const isRelaxed = process.env.RELAX_RATE_LIMITING === 'true';
const isTest = process.env.NODE_ENV === 'test';

// Rate-limit store factory.
//
// HISTORY: previously returned a `rate-limit-mongo` MongoStore so the
// limiters could share a counter across the PM2 cluster workers. That
// package is unmaintained and pulls a vulnerable `underscore` chain
// (6 high-severity CVEs as of 2026-05-20), so we removed the dependency.
// Returning `undefined` here falls back to express-rate-limit's built-in
// in-memory store, which is per-worker — meaning the configured `max`
// is effectively multiplied by the cluster size in production.
//
// This is acceptable WHILE THE AFFILIATE PROGRAM IS OFFLINE: there's
// no authenticated traffic the limiters guard, the public Austin
// content pages aren't rate-limited (they don't go through these
// middlewares), and Cloudflare provides upstream bot/burst protection.
// WHEN THE AFFILIATE PROGRAM COMES BACK ONLINE, swap in a maintained
// shared store before exposing the auth/registration/payment surfaces
// publicly: `@express-rate-limit/mongo-store` is the official option,
// `rate-limit-redis` if Redis joins the stack. The function signature
// stays compatible so the swap is one-file.
const createMongoStore = (_windowMs, _name) => undefined;

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
  store: createMongoStore(15 * 60 * 1000, 'auth')
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
  store: createMongoStore(60 * 60 * 1000, 'pwreset')
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
  store: createMongoStore(60 * 60 * 1000, 'register')
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
  store: createMongoStore(15 * 60 * 1000, 'api')
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
  skip: skipInTest,
  keyGenerator: (req) => {
    // Rate limit by user ID if authenticated, otherwise by IP
    return req.user ? `user_${req.user.id}` : req.ip;
  },
  store: createMongoStore(60 * 60 * 1000, 'sensitive')
});

// Public contact form — burst guard. Catches double-clicks and basic
// flood attempts: 1 submission per 30 seconds per IP. Stacked under
// contactFormLimiter for hourly volume control.
exports.contactFormBurstLimiter = rateLimit({
  windowMs: 30 * 1000, // 30 seconds
  max: isRelaxed ? 30 : 1,
  message: {
    success: false,
    message: 'Please wait a moment before sending another message.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTest,
  keyGenerator: (req) => req.ip,
  store: createMongoStore(30 * 1000, 'contact_burst')
});

// Public contact form — hourly cap. 5 submissions per IP per hour
// is enough for legitimate use (a customer + a follow-up question +
// edge cases) while making spam runs visibly painful. Tightened from
// the shared sensitiveOperationLimiter (10/hr) because contact is
// unauthenticated and the most-abused surface on the site.
exports.contactFormLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: isRelaxed ? 50 : 5,
  message: {
    success: false,
    message: "You've sent the maximum number of messages for now — please try again later, or call us directly.",
    retryAfter: 60 * 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTest,
  keyGenerator: (req) => req.ip,
  store: createMongoStore(60 * 60 * 1000, 'contact_hourly')
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
  store: createMongoStore(60 * 60 * 1000, 'email_verify')
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
  store: createMongoStore(15 * 60 * 1000, 'oauth')
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
  store: createMongoStore(60 * 60 * 1000, 'upload')
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
  store: createMongoStore(15 * 60 * 1000, 'admin_op')
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
  store: createMongoStore(15 * 60 * 1000, 'admin_login')
});

// Create a custom rate limiter with specific settings
exports.createCustomLimiter = (options) => {
  const defaults = {
    standardHeaders: true,
    legacyHeaders: false,
    store: createMongoStore(options.windowMs || 15 * 60 * 1000, options.name || 'custom'),
    message: {
      success: false,
      message: 'Too many requests, please try again later'
    }
  };
  
  return rateLimit({ ...defaults, ...options });
};