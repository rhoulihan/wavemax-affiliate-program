/**
 * Test helpers for standardized response format from ControllerHelpers
 */

/**
 * Creates an expected success response matching ControllerHelpers.sendSuccess format
 * @param {any} data - The data payload
 * @param {string} [message] - Optional message
 * @returns {Object} Expected response object
 */
function expectSuccessResponse(data, message = 'Success') {
  // ControllerHelpers.sendSuccess spreads the data object
  const response = {
    success: true,
    message,
    ...(data || {})
  };
  
  return response;
}

/**
 * Creates an expected error response matching ControllerHelpers.sendError format
 * @param {string} message - Error message
 * @param {Object} [details] - Optional error details
 * @returns {Object} Expected response object
 */
function expectErrorResponse(message, details) {
  const response = {
    success: false,
    message: message
  };
  
  if (details) {
    response.details = details;
  }
  
  return response;
}

/**
 * Creates an expected paginated response matching ControllerHelpers.sendPaginated format
 * @param {Array} items - Array of items
 * @param {Object} pagination - Pagination metadata
 * @returns {Object} Expected response object
 */
function expectPaginatedResponse(items, pagination) {
  return {
    success: true,
    data: items,
    pagination: {
      page: pagination.page || 1,
      limit: pagination.limit || 10,
      total: pagination.total || items.length,
      pages: pagination.pages || Math.ceil((pagination.total || items.length) / (pagination.limit || 10))
    }
  };
}

module.exports = {
  expectSuccessResponse,
  expectErrorResponse,
  expectPaginatedResponse
};