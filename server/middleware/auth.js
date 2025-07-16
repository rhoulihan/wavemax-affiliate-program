// Authentication Middleware for WaveMAX Laundry Affiliate Program

const jwt = require('jsonwebtoken');
const Affiliate = require('../models/Affiliate');
const Customer = require('../models/Customer');
const Administrator = require('../models/Administrator');
const Operator = require('../models/Operator');
const TokenBlacklist = require('../models/TokenBlacklist');

const storeIPConfig = require('../config/storeIPs');

// Import rate limiters from centralized configuration
const { authLimiter } = require('./rateLimiting');
exports.authLimiter = authLimiter;

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

    // Get client IP first
    const clientIP = req.headers['x-forwarded-for'] || 
                    req.headers['x-real-ip'] || 
                    req.connection.remoteAddress ||
                    req.socket.remoteAddress ||
                    req.ip;
    
    // Verify token normally - no special handling for store IPs
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (verifyError) {
      // Re-throw the error to be handled by the error handling block below
      throw verifyError;
    }
    // No special token renewal for store IPs - removed for security

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
      _id: decoded.id, // Add _id for compatibility
      role: decoded.role,
      ...(decoded.affiliateId && { affiliateId: decoded.affiliateId }),
      ...(decoded.customerId && { customerId: decoded.customerId }),
      ...(decoded.adminId && { adminId: decoded.adminId }),
      ...(decoded.operatorId && { operatorId: decoded.operatorId }),
      ...(decoded.permissions && { permissions: decoded.permissions }),
      ...(decoded.requirePasswordChange && { requirePasswordChange: decoded.requirePasswordChange })
    };

    // Debug logging for W9 endpoint
    if (req.path.includes('/w9/')) {
      console.log('Auth middleware - W9 endpoint accessed:', {
        path: req.path,
        userId: req.user.id,
        role: req.user.role,
        affiliateId: req.user.affiliateId
      });
    }

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
      console.log('Authorization failed - No user object on request for path:', req.path);
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
    }

    if (!req.user.role || !allowedRoles.includes(req.user.role)) {
      console.log('Authorization failed for path:', req.path, '- User role:', req.user.role, 'Allowed roles:', allowedRoles);
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