// Create a new file
const logger = require('../utils/logger');

// Central error handling middleware
const errorHandler = (err, req, res, next) => {
  // Ensure err is an object
  if (!err) {
    err = new Error('Unknown error occurred');
  } else if (typeof err === 'string') {
    err = new Error(err);
  }

  // Console log for immediate debugging
  console.error('=== API ERROR ===');
  console.error('Error message:', err.message);
  console.error('Error stack:', err.stack);
  console.error('Request path:', req.path);
  console.error('Request method:', req.method);
  console.error('Error type:', err.name);
  console.error('Error code:', err.code);
  console.error('================');

  // Log the error with additional context
  try {
    logger.error('API Error:', {
      error: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
      ip: req.ip,
      userId: req.user ? (req.user.id || req.user.affiliateId || req.user.customerId) : null,
      errorType: err.name,
      errorCode: err.code
    });
  } catch (logError) {
    // If logging fails, continue with error handling
    console.error('Failed to log error:', logError);
  }

  // Handle specific error types
  let statusCode = err.statusCode || 500;
  let message = 'An error occurred. Please try again later.';

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Invalid input data';
  }

  // MongoDB duplicate key error
  else if (err.code === 11000) {
    statusCode = 400;
    message = 'This record already exists';
  }

  // JWT errors
  else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Authentication failed';
  }

  else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Session expired. Please login again';
  }

  // Rate limiting error
  else if (err.status === 429) {
    statusCode = 429;
    message = 'Too many requests. Please try again later';
  }

  // CastError (invalid MongoDB ObjectId)
  else if (err.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid data format';
  }

  // Multer errors
  else if (err.name === 'MulterError') {
    statusCode = 400;
    if (err.code === 'LIMIT_FILE_SIZE') {
      statusCode = 413;
      message = 'File too large';
    } else if (err.code === 'LIMIT_FILE_COUNT') {
      message = 'Too many files';
    } else if (err.code === 'LIMIT_FIELD_KEY') {
      message = 'Field name too long';
    } else if (err.code === 'LIMIT_FIELD_VALUE') {
      message = 'Field value too long';
    } else if (err.code === 'LIMIT_FIELD_COUNT') {
      message = 'Too many fields';
    } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      message = 'Unexpected file field';
    } else {
      message = err.message;
    }
  }

  // Custom multer file filter errors
  else if (err.message && err.message.includes('Only PDF files are allowed')) {
    statusCode = 400;
    message = err.message;
  }

  // For non-500 errors in production, use the original message if it's safe
  else if (statusCode !== 500 && process.env.NODE_ENV === 'production') {
    message = err.message || message;
  }

  // Prepare error response
  const errorResponse = {
    success: false,
    message,
    ...(process.env.NODE_ENV !== 'production' && {
      error: {
        details: err.message,
        type: err.name,
        stack: err.stack
      }
    })
  };

  // Send error response
  res.status(statusCode).json(errorResponse);
};

// Custom error class
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = {
  errorHandler,
  AppError
};