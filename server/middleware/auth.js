// Authentication Middleware for WaveMAX Laundry Affiliate Program

const jwt = require('jsonwebtoken');
const Affiliate = require('../models/Affiliate');
const Customer = require('../models/Customer');

const rateLimit = require('express-rate-limit');

// Rate limiter for authentication
exports.authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per IP
  message: { success: false, message: 'Too many login attempts, please try again later' }
});

/**
 * Middleware to authenticate requests using JWT
 */
exports.authenticate = async (req, res, next) => {
  try {
    // Get the token from the request headers
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please provide a valid token.'
      });
    }
    
    // Extract the token
    const token = authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please provide a valid token.'
      });
    }
    
    // Verify the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check token expiration
    const currentTimestamp = Math.floor(Date.now() / 1000);
    if (decoded.exp <= currentTimestamp) {
      return res.status(401).json({
        success: false,
        message: 'Token has expired. Please login again.'
      });
    }
    
    // Find the user based on the token data
    let user = null;
    
    if (decoded.role === 'affiliate') {
      user = await Affiliate.findOne({ affiliateId: decoded.affiliateId });
    } else if (decoded.role === 'customer') {
      user = await Customer.findOne({ customerId: decoded.customerId });
    } else if (decoded.role === 'admin') {
      // For admin users, we could have a separate Admin model
      // For simplicity, we'll just use the decoded data
      user = { ...decoded, isAdmin: true };
    }
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found or token is invalid.'
      });
    }
    
    // Add user data to the request object
    req.user = {
      id: decoded.id,
      role: decoded.role,
      ...(decoded.affiliateId && { affiliateId: decoded.affiliateId }),
      ...(decoded.customerId && { customerId: decoded.customerId })
    };
    
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token. Please login again.'
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
 * @param {string[]} roles - Array of allowed roles
 */
exports.authorize = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required before authorization.'
      });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to access this resource.'
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