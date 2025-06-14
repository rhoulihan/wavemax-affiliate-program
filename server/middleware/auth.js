// Authentication Middleware for WaveMAX Laundry Affiliate Program

const jwt = require('jsonwebtoken');
const Affiliate = require('../models/Affiliate');
const Customer = require('../models/Customer');
const Administrator = require('../models/Administrator');
const Operator = require('../models/Operator');
const TokenBlacklist = require('../models/TokenBlacklist');

const rateLimit = require('express-rate-limit');

// Rate limiter for authentication
exports.authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'test' ? 1000 : 20, // Higher limit for tests
  message: { success: false, message: 'Too many login attempts, please try again later' },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  // Skip successful requests
  skipSuccessfulRequests: true,
  skip: () => process.env.NODE_ENV === 'test' // Skip rate limiting in test environment
});

/**
 * Middleware to authenticate requests using JWT
 */
exports.authenticate = async (req, res, next) => {
  try {
    // Get the token from the request headers
    let token;

    // Check Authorization header with Bearer token
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }

    // Check x-auth-token header as fallback
    if (!token && req.headers['x-auth-token']) {
      token = req.headers['x-auth-token'];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token provided'
      });
    }

    // Verify the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check if token is blacklisted
    const isBlacklisted = await TokenBlacklist.isBlacklisted(token);
    if (isBlacklisted) {
      return res.status(401).json({
        success: false,
        message: 'Token has been blacklisted'
      });
    }

    // Add user data to the request object
    req.user = {
      id: decoded.id,
      role: decoded.role,
      ...(decoded.affiliateId && { affiliateId: decoded.affiliateId }),
      ...(decoded.customerId && { customerId: decoded.customerId }),
      ...(decoded.adminId && { adminId: decoded.adminId }),
      ...(decoded.operatorId && { operatorId: decoded.operatorId }),
      ...(decoded.permissions && { permissions: decoded.permissions }),
      ...(decoded.requirePasswordChange && { requirePasswordChange: decoded.requirePasswordChange })
    };

    // Check if password change is required
    if (decoded.requirePasswordChange && 
        req.path !== '/change-password' && 
        !req.path.includes('/auth/') &&
        req.method !== 'GET') {
      return res.status(403).json({
        success: false,
        message: 'Password change required before accessing other resources',
        requirePasswordChange: true
      });
    }

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired'
      });
    }

    console.error('Authentication error:', error);

    res.status(500).json({
      success: false,
      message: 'An error occurred during authentication.'
    });
  }
};

/**
 * Middleware to authorize requests based on user roles
 * @param {...string} roles - Allowed roles (can be multiple arguments or an array)
 */
exports.authorize = (...roles) => {
  // If first argument is an array, use it; otherwise use all arguments
  const allowedRoles = Array.isArray(roles[0]) ? roles[0] : roles;

  return (req, res, next) => {
    if (!req.user) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
    }

    if (!req.user.role || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
    }

    next();
  };
};

/**
 * Middleware to validate request body
 * @param {object} schema - Joi schema for validation
 */
exports.validateRequest = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body);

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    next();
  };
};

module.exports = exports;