/**
 * Controller Helper Utilities
 * Provides common error handling, response formatting, and async wrapper functions
 * to reduce code duplication across controllers
 */

class ControllerHelpers {
  /**
   * Standard error handler for controller methods
   * @param {Object} res - Express response object
   * @param {Error} error - Error object
   * @param {string} operation - Description of the operation that failed
   * @param {number} statusCode - HTTP status code (default: 500)
   */
  static handleError(res, error, operation, statusCode = 500) {
    // Log the error with context
    console.error(`${operation} error:`, {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });

    // Send appropriate error response
    const isProduction = process.env.NODE_ENV === 'production';
    const message = isProduction 
      ? `An error occurred during ${operation}`
      : error.message || `An error occurred during ${operation}`;

    res.status(statusCode).json({
      success: false,
      message,
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }

  /**
   * Async wrapper to catch errors in async route handlers
   * @param {Function} fn - Async function to wrap
   */
  static asyncWrapper(fn) {
    return (req, res, next) => {
      Promise.resolve(fn(req, res, next))
        .catch(next);
    };
  }

  /**
   * Send success response with consistent format
   * @param {Object} res - Express response object
   * @param {Object} data - Data to send in response
   * @param {string} message - Success message
   * @param {number} statusCode - HTTP status code (default: 200)
   */
  static sendSuccess(res, data = {}, message = 'Success', statusCode = 200) {
    res.status(statusCode).json({
      success: true,
      message,
      ...data
    });
  }

  /**
   * Send error response with consistent format
   * @param {Object} res - Express response object
   * @param {string} message - Error message
   * @param {number} statusCode - HTTP status code (default: 400)
   * @param {Object} errors - Additional error details
   */
  static sendError(res, message, statusCode = 400, errors = null) {
    const response = {
      success: false,
      message
    };
    
    if (errors) {
      response.errors = errors;
    }
    
    res.status(statusCode).json(response);
  }

  /**
   * Send paginated response
   * @param {Object} res - Express response object
   * @param {Array} items - Array of items
   * @param {Object} pagination - Pagination info
   * @param {string} itemsKey - Key name for items array
   */
  static sendPaginated(res, items, pagination, itemsKey = 'items') {
    res.status(200).json({
      success: true,
      [itemsKey]: items,
      pagination: {
        page: pagination.page || 1,
        limit: pagination.limit || 10,
        totalPages: pagination.totalPages,
        totalItems: pagination.totalItems,
        hasNext: pagination.hasNext || false,
        hasPrev: pagination.hasPrev || false
      }
    });
  }

  /**
   * Validate required fields in request body
   * @param {Object} body - Request body
   * @param {Array} requiredFields - Array of required field names
   * @returns {Object|null} - Validation errors or null if valid
   */
  static validateRequiredFields(body, requiredFields) {
    const missingFields = [];
    const emptyFields = [];

    requiredFields.forEach(field => {
      if (!(field in body)) {
        missingFields.push(field);
      } else if (!body[field] && body[field] !== 0 && body[field] !== false) {
        emptyFields.push(field);
      }
    });

    if (missingFields.length > 0 || emptyFields.length > 0) {
      return {
        missingFields: missingFields.length > 0 ? missingFields : undefined,
        emptyFields: emptyFields.length > 0 ? emptyFields : undefined
      };
    }

    return null;
  }

  /**
   * Parse pagination parameters from request
   * @param {Object} query - Request query parameters
   * @param {Object} defaults - Default pagination values
   */
  static parsePagination(query, defaults = {}) {
    const page = parseInt(query.page) || defaults.page || 1;
    const limit = Math.min(
      parseInt(query.limit) || defaults.limit || 10,
      defaults.maxLimit || 100
    );
    const skip = (page - 1) * limit;
    const sortBy = query.sortBy || defaults.sortBy || '-createdAt';
    
    return {
      page,
      limit,
      skip,
      sortBy
    };
  }

  /**
   * Build MongoDB query from filter parameters
   * @param {Object} filters - Filter parameters
   * @param {Object} allowedFields - Map of allowed fields to MongoDB field names
   */
  static buildQuery(filters, allowedFields) {
    const query = {};

    Object.keys(filters).forEach(key => {
      if (allowedFields[key] && filters[key] !== undefined && filters[key] !== '') {
        const mongoField = allowedFields[key];
        
        // Handle different filter types
        if (key.endsWith('_min') || key.endsWith('_max')) {
          // Range filters
          const baseKey = key.replace(/_min$|_max$/, '');
          const field = allowedFields[baseKey];
          if (field) {
            query[field] = query[field] || {};
            if (key.endsWith('_min')) {
              query[field].$gte = filters[key];
            } else {
              query[field].$lte = filters[key];
            }
          }
        } else if (Array.isArray(filters[key])) {
          // Array filters (for $in queries)
          query[mongoField] = { $in: filters[key] };
        } else if (typeof filters[key] === 'string' && filters[key].includes('*')) {
          // Wildcard search
          const regex = new RegExp(filters[key].replace(/\*/g, '.*'), 'i');
          query[mongoField] = regex;
        } else {
          // Exact match
          query[mongoField] = filters[key];
        }
      }
    });

    return query;
  }

  /**
   * Handle file upload validation
   * @param {Object} file - Uploaded file object
   * @param {Object} options - Validation options
   */
  static validateFileUpload(file, options = {}) {
    const {
      maxSize = 5 * 1024 * 1024, // 5MB default
      allowedTypes = [],
      allowedExtensions = []
    } = options;

    const errors = [];

    if (!file) {
      errors.push('No file uploaded');
      return errors.length > 0 ? errors : null;
    }

    if (file.size > maxSize) {
      errors.push(`File size exceeds maximum of ${maxSize / (1024 * 1024)}MB`);
    }

    if (allowedTypes.length > 0 && !allowedTypes.includes(file.mimetype)) {
      errors.push(`File type ${file.mimetype} not allowed`);
    }

    if (allowedExtensions.length > 0) {
      const ext = file.originalname.split('.').pop().toLowerCase();
      if (!allowedExtensions.includes(ext)) {
        errors.push(`File extension .${ext} not allowed`);
      }
    }

    return errors.length > 0 ? errors : null;
  }

  /**
   * Sanitize user input to prevent XSS
   * @param {any} input - User input to sanitize
   */
  static sanitizeInput(input) {
    if (typeof input === 'string') {
      return input
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
    } else if (typeof input === 'object' && input !== null) {
      const sanitized = {};
      for (const key in input) {
        if (input.hasOwnProperty(key)) {
          sanitized[key] = this.sanitizeInput(input[key]);
        }
      }
      return sanitized;
    }
    return input;
  }

  /**
   * Calculate pagination metadata
   * @param {number} totalItems - Total number of items
   * @param {number} page - Current page
   * @param {number} limit - Items per page
   */
  static calculatePagination(totalItems, page, limit) {
    const totalPages = Math.ceil(totalItems / limit);
    
    return {
      page,
      limit,
      totalItems,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
      nextPage: page < totalPages ? page + 1 : null,
      prevPage: page > 1 ? page - 1 : null
    };
  }
}

module.exports = ControllerHelpers;