/**
 * Test utilities for handling middleware arrays and other test helpers
 */

/**
 * Extracts the actual handler function from a middleware array
 * @param {Function|Array} endpoint - The endpoint which may be a function or middleware array
 * @returns {Function} The handler function
 */
function extractHandler(endpoint) {
  if (typeof endpoint === 'function') {
    return endpoint;
  }
  
  if (Array.isArray(endpoint)) {
    // Find the last function in the array (usually the actual handler)
    for (let i = endpoint.length - 1; i >= 0; i--) {
      if (typeof endpoint[i] === 'function') {
        // Check if it's wrapped in asyncWrapper
        const func = endpoint[i];
        // If it looks like a middleware (takes 3 params), return it
        // Otherwise, it might be wrapped, so return it as is
        return func;
      }
    }
  }
  
  throw new Error('Could not extract handler from endpoint');
}

/**
 * Extracts middleware functions from an endpoint
 * @param {Function|Array} endpoint - The endpoint which may be a function or middleware array
 * @returns {Array} Array of middleware functions (excluding the handler)
 */
function extractMiddleware(endpoint) {
  if (typeof endpoint === 'function') {
    return [];
  }
  
  if (Array.isArray(endpoint)) {
    // Return all but the last function (which is the handler)
    return endpoint.slice(0, -1).filter(item => typeof item === 'function');
  }
  
  return [];
}

/**
 * Calls a controller method that may be wrapped in middleware
 * @param {Function|Array} controllerMethod - The controller method (may be array with middleware)
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Function} next - Next function (optional)
 */
async function callControllerMethod(controllerMethod, req, res, next = jest.fn()) {
  const handler = extractHandler(controllerMethod);
  
  // If the handler is wrapped in asyncWrapper, it returns a function
  // that needs to be called with req, res, next
  if (handler.length === 1) {
    // This is likely asyncWrapper which takes a function and returns middleware
    const middleware = handler;
    if (typeof middleware === 'function') {
      // This is the wrapped function, call it directly
      return await handler(req, res, next);
    }
  }
  
  // Normal async function
  return await handler(req, res, next);
}

/**
 * Creates a mock next function with proper error handling
 */
function createMockNext() {
  const next = jest.fn((error) => {
    if (error) {
      // Simulate Express error handling
      console.error('Error passed to next:', error);
    }
  });
  return next;
}

/**
 * Creates mock request object with common properties
 */
function createMockRequest(overrides = {}) {
  return {
    body: {},
    params: {},
    query: {},
    user: null,
    headers: {},
    get: jest.fn(),
    ...overrides
  };
}

/**
 * Creates mock response object with common properties
 */
function createMockResponse() {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    redirect: jest.fn().mockReturnThis(),
    render: jest.fn().mockReturnThis(),
    locals: {}
  };
  return res;
}

module.exports = {
  extractHandler,
  extractMiddleware,
  callControllerMethod,
  createMockNext,
  createMockRequest,
  createMockResponse
};