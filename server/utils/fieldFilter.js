// Field Filtering Utility for API Responses
// Prevents sensitive data exposure in API responses

/**
 * Filter object fields based on allowed field list
 * @param {Object} obj - Object to filter
 * @param {Array} allowedFields - Array of field names to include
 * @returns {Object} Filtered object
 */
const filterFields = (obj, allowedFields) => {
  if (!obj || typeof obj !== 'object') return obj;

  const filtered = {};
  allowedFields.forEach(field => {
    if (obj.hasOwnProperty(field)) {
      filtered[field] = obj[field];
    }
  });

  return filtered;
};

/**
 * Filter array of objects
 * @param {Array} arr - Array of objects to filter
 * @param {Array} allowedFields - Array of field names to include
 * @returns {Array} Array of filtered objects
 */
const filterArray = (arr, allowedFields) => {
  if (!Array.isArray(arr)) return arr;
  return arr.map(item => filterFields(item, allowedFields));
};

// Field definitions for different models
const fieldDefinitions = {
  // Affiliate fields visible to different roles
  affiliate: {
    public: ['affiliateId', 'firstName', 'lastName', 'businessName', 'deliveryFee'],
    self: ['affiliateId', 'firstName', 'lastName', 'email', 'phone', 'businessName',
      'deliveryFee', 'commissionRate', 'isActive', 'registrationDate', 'lastLogin'],
    admin: ['_id', 'affiliateId', 'firstName', 'lastName', 'email', 'phone',
      'businessName', 'address', 'city', 'state', 'zipCode', 'deliveryFee',
      'commissionRate', 'isActive', 'registrationDate', 'lastLogin',
      'totalEarnings', 'totalCustomers', 'totalOrders']
  },

  // Customer fields visible to different roles
  customer: {
    public: ['customerId', 'firstName', 'lastName'],
    self: ['customerId', 'firstName', 'lastName', 'email', 'phone', 'address',
      'city', 'state', 'zipCode', 'deliveryInstructions',
      'specialInstructions', 'affiliateSpecialInstructions', 'lastFourDigits',
      'savePaymentInfo', 'isActive', 'registrationDate', 'lastLogin'],
    affiliate: ['customerId', 'firstName', 'lastName', 'email', 'phone', 'address',
      'city', 'state', 'zipCode', 'specialInstructions', 'affiliateSpecialInstructions', 'isActive', 'registrationDate'],
    admin: ['_id', 'customerId', 'affiliateId', 'firstName', 'lastName', 'email',
      'phone', 'address', 'city', 'state', 'zipCode', 'deliveryInstructions',
      'specialInstructions', 'affiliateSpecialInstructions',
      'username', 'lastFourDigits', 'billingZip', 'savePaymentInfo', 'isActive',
      'registrationDate', 'lastLogin']
  },

  // Order fields visible to different roles
  order: {
    customer: ['orderId', 'pickupDate', 'pickupTime', 'deliveryDate', 'deliveryTime',
      'status', 'estimatedSize', 'actualWeight', 'estimatedTotal', 'actualTotal',
      'deliveryFee', 'paymentStatus', 'createdAt'],
    affiliate: ['orderId', 'customerId', 'pickupDate', 'pickupTime', 'deliveryDate',
      'deliveryTime', 'status', 'estimatedSize', 'actualWeight', 'baseRate',
      'deliveryFee', 'estimatedTotal', 'actualTotal', 'affiliateCommission',
      'paymentStatus', 'specialPickupInstructions', 'specialDeliveryInstructions',
      'serviceNotes', 'washInstructions', 'createdAt', 'pickedUpAt',
      'processedAt', 'readyForDeliveryAt', 'deliveredAt'],
    admin: ['_id', 'orderId', 'customerId', 'affiliateId', 'pickupDate', 'pickupTime',
      'deliveryDate', 'deliveryTime', 'status', 'estimatedSize', 'actualWeight',
      'baseRate', 'deliveryFee', 'estimatedTotal', 'actualTotal', 'affiliateCommission',
      'paymentStatus', 'specialPickupInstructions', 'specialDeliveryInstructions',
      'serviceNotes', 'washInstructions', 'bagIDs', 'createdAt', 'pickedUpAt',
      'processedAt', 'readyForDeliveryAt', 'deliveredAt', 'cancelledAt']
  },

  // Bag fields visible to different roles
  bag: {
    customer: ['bagId', 'barcode', 'status'],
    affiliate: ['bagId', 'barcode', 'customerId', 'status', 'issueDate', 'lastUsedDate'],
    admin: ['_id', 'bagId', 'barcode', 'customerId', 'affiliateId', 'status',
      'issueDate', 'lastUsedDate', 'lostReportedDate', 'notes']
  }
};

/**
 * Get filtered data based on user role and data type
 * @param {String} dataType - Type of data (affiliate, customer, order, bag)
 * @param {Object|Array} data - Data to filter
 * @param {String} userRole - Role of the requesting user (admin, affiliate, customer, public)
 * @param {Object} context - Additional context (e.g., userId for self checks)
 * @returns {Object|Array} Filtered data
 */
const getFilteredData = (dataType, data, userRole, context = {}) => {
  if (!data || !fieldDefinitions[dataType]) return data;

  let fields;

  // Determine which fields to use based on role and context
  if (userRole === 'admin') {
    fields = fieldDefinitions[dataType].admin || fieldDefinitions[dataType].public;
  } else if (userRole === 'affiliate') {
    fields = fieldDefinitions[dataType].affiliate || fieldDefinitions[dataType].public;
  } else if (userRole === 'customer') {
    // Check if it's the customer's own data
    if (context.isSelf) {
      fields = fieldDefinitions[dataType].self || fieldDefinitions[dataType].customer || fieldDefinitions[dataType].public;
    } else {
      fields = fieldDefinitions[dataType].customer || fieldDefinitions[dataType].public;
    }
  } else {
    fields = fieldDefinitions[dataType].public || [];
  }

  // Handle arrays
  if (Array.isArray(data)) {
    return filterArray(data, fields);
  }

  // Handle single objects
  return filterFields(data, fields);
};

/**
 * Express middleware for automatic response filtering
 */
const responseFilter = (req, res, next) => {
  // Store the original json method
  const originalJson = res.json;

  // Override the json method
  res.json = function(data) {
    // If the response has a specific data type marker, filter it
    if (data && data._filterType) {
      const filterType = data._filterType;
      delete data._filterType;

      // Get user role from request
      const userRole = req.user ? req.user.role : 'public';
      const userId = req.user ? (req.user.affiliateId || req.user.customerId || req.user.id) : null;

      // Filter the response data
      if (data.data) {
        data.data = getFilteredData(filterType, data.data, userRole, { userId });
      }
    }

    // Call the original json method
    return originalJson.call(this, data);
  };

  next();
};

module.exports = {
  filterFields,
  filterArray,
  getFilteredData,
  responseFilter,
  fieldDefinitions
};