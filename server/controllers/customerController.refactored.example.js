/**
 * EXAMPLE: Refactored Customer Controller using new utility modules
 * This demonstrates how to reduce code duplication using the new utilities
 * 
 * Original file: customerController.js
 * This example shows the registerCustomer and getCustomerProfile methods refactored
 */

const Affiliate = require('../models/Affiliate');
const Customer = require('../models/Customer');
const Order = require('../models/Order');
const SystemConfig = require('../models/SystemConfig');
const encryptionUtil = require('../utils/encryption');
const emailService = require('../utils/emailService');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { getFilteredData } = require('../utils/fieldFilter');
const { validationResult } = require('express-validator');

// NEW UTILITY IMPORTS
const ControllerHelpers = require('../utils/controllerHelpers');
const AuthorizationHelpers = require('../middleware/authorizationHelpers');
const Formatters = require('../utils/formatters');

/**
 * BEFORE: Original registerCustomer with duplicate error handling
 */
exports.registerCustomerOriginal = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    // ... lots of logic ...

    // Verify affiliate exists
    const affiliate = await Affiliate.findOne({ affiliateId });
    if (!affiliate) {
      return res.status(400).json({
        success: false,
        message: 'Invalid affiliate ID'
      });
    }

    // ... more logic ...

    // Success response
    res.status(201).json({
      success: true,
      message: 'Customer registration successful',
      customerId: newCustomer.customerId,
      token: token
    });

  } catch (error) {
    console.error('Customer registration error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred during registration'
    });
  }
};

/**
 * AFTER: Refactored registerCustomer using utility functions
 */
exports.registerCustomer = ControllerHelpers.asyncWrapper(async (req, res) => {
  // Check for validation errors using helper
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return ControllerHelpers.sendError(res, 'Validation failed', 400, errors.array());
  }

  const {
    affiliateId,
    firstName,
    lastName,
    email,
    phone,
    address,
    city,
    state,
    zipCode,
    specialInstructions,
    affiliateSpecialInstructions,
    username,
    password,
    cardholderName,
    cardNumber,
    expiryDate,
    cvv,
    billingZip,
    savePaymentInfo,
    numberOfBags,
    languagePreference,
    paymentConfirmed,
    socialToken
  } = req.body;

  // Use validateRequiredFields helper
  const requiredFieldsCheck = ControllerHelpers.validateRequiredFields(req.body, [
    'affiliateId',
    'firstName',
    'lastName',
    'email',
    'phone',
    'address',
    'city',
    'state',
    'zipCode'
  ]);

  if (requiredFieldsCheck) {
    return ControllerHelpers.sendError(res, 'Missing required fields', 400, requiredFieldsCheck);
  }

  // Log if this is a post-payment registration
  if (paymentConfirmed) {
    console.log(`Post-payment registration for email: ${email}, affiliate: ${affiliateId}`);
  }

  // Verify affiliate exists
  const affiliate = await Affiliate.findOne({ affiliateId });
  if (!affiliate) {
    return ControllerHelpers.sendError(res, 'Invalid affiliate ID', 400);
  }

  // Check if email or username already exists
  const existingCustomer = await Customer.findOne({
    $or: [{ email }, { username }]
  });

  if (existingCustomer) {
    return ControllerHelpers.sendError(res, 'Email or username already in use', 400);
  }

  // For OAuth registrations, generate a username from email if not provided
  let finalUsername = username;
  let passwordSalt = null;
  let passwordHash = null;
  
  if (socialToken) {
    // OAuth registration - generate username from email if not provided
    if (!username) {
      finalUsername = email.split('@')[0] + '_' + Date.now().toString(36);
    }
    console.log(`OAuth registration for email: ${email}, generated username: ${finalUsername}`);
  } else {
    // Traditional registration - hash password
    const { salt, hash } = encryptionUtil.hashPassword(password);
    passwordSalt = salt;
    passwordHash = hash;
  }

  // Create customer object with formatted data
  const customerData = {
    customerId: `CUST-${uuidv4()}`,
    affiliateId,
    firstName: Formatters.name(firstName),
    lastName: Formatters.name(lastName),
    email: email.toLowerCase(),
    phone: Formatters.phone(phone, 'us'),
    address,
    city,
    state,
    zipCode,
    specialInstructions,
    affiliateSpecialInstructions,
    username: finalUsername,
    passwordSalt,
    passwordHash,
    languagePreference: languagePreference || 'en',
    numberOfBags: numberOfBags || 1,
    registrationMethod: socialToken ? 'oauth' : 'traditional'
  };

  // Handle payment info if provided
  if (savePaymentInfo && cardNumber) {
    const encryptedPayment = encryptionUtil.encrypt({
      cardholderName,
      cardNumber,
      expiryDate,
      cvv,
      billingZip
    });
    customerData.encryptedPaymentInfo = encryptedPayment;
  }

  // Create the customer
  const newCustomer = new Customer(customerData);
  await newCustomer.save();

  // Generate JWT token
  const token = jwt.sign(
    { 
      id: newCustomer._id, 
      customerId: newCustomer.customerId,
      role: 'customer'
    },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );

  // Send welcome email
  await emailService.sendWelcomeEmail(
    email,
    {
      firstName: Formatters.name(firstName),
      affiliateName: affiliate.businessName
    }
  );

  // Use success helper for response
  return ControllerHelpers.sendSuccess(
    res,
    {
      customerId: newCustomer.customerId,
      token
    },
    'Customer registration successful',
    201
  );
});

/**
 * BEFORE: Original getCustomerProfile with duplicate authorization logic
 */
exports.getCustomerProfileOriginal = async (req, res) => {
  try {
    const { customerId } = req.params;

    // Authorization check - duplicated across many methods
    const isAuthorized = 
      req.user.role === 'admin' ||
      req.user.customerId === customerId ||
      (req.user.role === 'affiliate' && req.user.affiliateId === customer.affiliateId);

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    const customer = await Customer.findOne({ customerId })
      .select('-passwordHash -passwordSalt -encryptedPaymentInfo');

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    res.json({
      success: true,
      customer
    });

  } catch (error) {
    console.error('Get customer profile error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while fetching customer profile'
    });
  }
};

/**
 * AFTER: Refactored getCustomerProfile using authorization helpers
 */
exports.getCustomerProfile = [
  // Use authorization middleware
  AuthorizationHelpers.checkCustomerAccess,
  
  // Wrapped handler with error handling
  ControllerHelpers.asyncWrapper(async (req, res) => {
    const { customerId } = req.params;

    // Customer might already be attached by middleware
    let customer = req.customer;
    
    if (!customer) {
      customer = await Customer.findOne({ customerId })
        .select('-passwordHash -passwordSalt -encryptedPaymentInfo');
    }

    if (!customer) {
      return ControllerHelpers.sendError(res, 'Customer not found', 404);
    }

    // Format the response data
    const formattedCustomer = {
      ...customer.toObject(),
      fullName: Formatters.fullName(customer.firstName, customer.lastName),
      formattedAddress: Formatters.address(customer),
      formattedPhone: Formatters.phone(customer.phone),
      memberSince: Formatters.date(customer.createdAt, 'medium')
    };

    return ControllerHelpers.sendSuccess(res, { customer: formattedCustomer });
  })
];

/**
 * BEFORE: Original getCustomerOrders with duplicate pagination logic
 */
exports.getCustomerOrdersOriginal = async (req, res) => {
  try {
    const { customerId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Duplicate authorization check
    if (req.user.role !== 'admin' && req.user.customerId !== customerId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    const totalOrders = await Order.countDocuments({ customerId });
    const orders = await Order.find({ customerId })
      .sort('-createdAt')
      .skip(skip)
      .limit(limit);

    const totalPages = Math.ceil(totalOrders / limit);

    res.json({
      success: true,
      orders,
      pagination: {
        page,
        limit,
        totalPages,
        totalOrders,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });

  } catch (error) {
    console.error('Get customer orders error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while fetching orders'
    });
  }
};

/**
 * AFTER: Refactored getCustomerOrders using utility helpers
 */
exports.getCustomerOrders = [
  // Use authorization middleware
  AuthorizationHelpers.checkCustomerAccess,
  
  ControllerHelpers.asyncWrapper(async (req, res) => {
    const { customerId } = req.params;
    
    // Use pagination helper
    const { page, limit, skip, sortBy } = ControllerHelpers.parsePagination(req.query);
    
    // Build query with filters
    const query = ControllerHelpers.buildQuery(
      { ...req.query, customerId },
      {
        customerId: 'customerId',
        status: 'status',
        startDate: 'createdAt',
        endDate: 'createdAt'
      }
    );

    const totalOrders = await Order.countDocuments(query);
    const orders = await Order.find(query)
      .sort(sortBy)
      .skip(skip)
      .limit(limit);

    // Format orders for response
    const formattedOrders = orders.map(order => ({
      ...order.toObject(),
      formattedTotal: Formatters.currency(order.actualTotal),
      formattedWeight: Formatters.weight(order.actualWeight),
      formattedStatus: Formatters.status(order.status, 'order'),
      formattedDate: Formatters.date(order.pickupDate, 'medium'),
      bagsSummary: Formatters.plural(order.numberOfBags, 'bag')
    }));

    // Calculate pagination metadata
    const pagination = ControllerHelpers.calculatePagination(totalOrders, page, limit);

    // Send paginated response
    return ControllerHelpers.sendPaginated(res, formattedOrders, pagination, 'orders');
  })
];

/**
 * BEFORE: Original updateCustomerProfile with duplicate validation
 */
exports.updateCustomerProfileOriginal = async (req, res) => {
  try {
    const { customerId } = req.params;
    
    // Duplicate authorization
    if (req.user.role !== 'admin' && req.user.customerId !== customerId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    const customer = await Customer.findOne({ customerId });
    
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    // Update fields
    const allowedUpdates = ['firstName', 'lastName', 'phone', 'address', 'city', 'state', 'zipCode'];
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        customer[field] = req.body[field];
      }
    });

    await customer.save();

    res.json({
      success: true,
      message: 'Profile updated successfully',
      customer
    });

  } catch (error) {
    console.error('Update customer profile error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while updating profile'
    });
  }
};

/**
 * AFTER: Refactored updateCustomerProfile using utilities
 */
exports.updateCustomerProfile = [
  // Use authorization middleware
  AuthorizationHelpers.checkCustomerAccess,
  
  ControllerHelpers.asyncWrapper(async (req, res) => {
    const { customerId } = req.params;
    
    // Sanitize input
    const sanitizedBody = ControllerHelpers.sanitizeInput(req.body);
    
    const customer = await Customer.findOne({ customerId });
    
    if (!customer) {
      return ControllerHelpers.sendError(res, 'Customer not found', 404);
    }

    // Update fields with formatting
    const allowedUpdates = {
      firstName: (val) => Formatters.name(val),
      lastName: (val) => Formatters.name(val),
      phone: (val) => Formatters.phone(val, 'us'),
      address: (val) => val,
      city: (val) => val,
      state: (val) => val.toUpperCase(),
      zipCode: (val) => val,
      languagePreference: (val) => val
    };

    Object.keys(allowedUpdates).forEach(field => {
      if (sanitizedBody[field] !== undefined) {
        const formatter = allowedUpdates[field];
        customer[field] = formatter(sanitizedBody[field]);
      }
    });

    await customer.save();

    // Format response
    const formattedCustomer = {
      ...customer.toObject(),
      fullName: Formatters.fullName(customer.firstName, customer.lastName),
      formattedAddress: Formatters.address(customer)
    };

    return ControllerHelpers.sendSuccess(
      res,
      { customer: formattedCustomer },
      'Profile updated successfully'
    );
  })
];

/**
 * Example of using batch operations for dashboard data
 */
exports.getCustomerDashboard = [
  AuthorizationHelpers.checkCustomerAccess,
  
  ControllerHelpers.asyncWrapper(async (req, res) => {
    const { customerId } = req.params;

    // Parallel data fetching
    const [customer, recentOrders, stats] = await Promise.all([
      Customer.findOne({ customerId }).select('-passwordHash -passwordSalt'),
      Order.find({ customerId }).sort('-createdAt').limit(5),
      Order.aggregate([
        { $match: { customerId } },
        {
          $group: {
            _id: null,
            totalOrders: { $sum: 1 },
            totalSpent: { $sum: '$actualTotal' },
            totalWeight: { $sum: '$actualWeight' }
          }
        }
      ])
    ]);

    if (!customer) {
      return ControllerHelpers.sendError(res, 'Customer not found', 404);
    }

    // Format dashboard data
    const dashboardData = {
      customer: {
        ...customer.toObject(),
        fullName: Formatters.fullName(customer.firstName, customer.lastName),
        memberSince: Formatters.relativeTime(customer.createdAt)
      },
      recentOrders: recentOrders.map(order => ({
        orderId: Formatters.orderId(order.orderId, true),
        date: Formatters.date(order.pickupDate),
        status: Formatters.status(order.status),
        total: Formatters.currency(order.actualTotal)
      })),
      statistics: {
        totalOrders: stats[0]?.totalOrders || 0,
        totalSpent: Formatters.currency(stats[0]?.totalSpent || 0),
        totalWeight: Formatters.weight(stats[0]?.totalWeight || 0),
        averageOrderValue: Formatters.currency(
          stats[0] ? stats[0].totalSpent / stats[0].totalOrders : 0
        )
      }
    };

    return ControllerHelpers.sendSuccess(res, dashboardData);
  })
];

module.exports = exports;