// WaveMAX Laundry Affiliate Program
// Customer Controller - Migrated to use utility modules
// This reduces code duplication and improves maintainability

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

// Import new utility modules
const ControllerHelpers = require('../utils/controllerHelpers');
const AuthorizationHelpers = require('../middleware/authorizationHelpers');
const Formatters = require('../utils/formatters');

// ============================================================================
// Customer Controllers - Refactored with Utilities
// ============================================================================

/**
 * Register a new customer
 * Refactored to use ControllerHelpers for error handling and response formatting
 */
exports.registerCustomer = ControllerHelpers.asyncWrapper(async (req, res) => {
  // Check for validation errors
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

  // Check payment version for V2 system
  const paymentVersion = await SystemConfig.getValue('payment_version', 'v1');
  const isV2Registration = paymentVersion === 'v2';
  
  // Determine registration version and initial bags
  let registrationVersion = 'v1';
  let initialBagsRequested = numberOfBags || 1;
  
  if (isV2Registration) {
    // V2 Registration: No payment, free bags
    registrationVersion = 'v2';
    const freeInitialBags = await SystemConfig.getValue('free_initial_bags', 2);
    initialBagsRequested = Math.min(numberOfBags || 1, freeInitialBags);
    console.log(`V2 registration: ${initialBagsRequested} free bags, no payment required`);
  }

  // Create new customer with formatted data
  const newCustomer = new Customer({
    customerId: `CUST-${uuidv4()}`,
    affiliateId,
    firstName: Formatters.name(firstName),
    lastName: Formatters.name(lastName),
    email: email.toLowerCase(),
    phone: Formatters.phone(phone, 'us'),
    address,
    city,
    state: state.toUpperCase(),
    zipCode,
    specialInstructions,
    affiliateSpecialInstructions,
    username: finalUsername,
    passwordSalt,
    passwordHash,
    languagePreference: languagePreference || 'en',
    numberOfBags: initialBagsRequested,
    registrationVersion: registrationVersion,
    initialBagsRequested: isV2Registration ? initialBagsRequested : undefined,
    bagCredit: isV2Registration ? 0 : (numberOfBags || 1) * 10, // V1 uses credit system
    registrationMethod: socialToken ? 'oauth' : 'traditional'
  });

  // Encrypt payment info if provided
  if (savePaymentInfo && cardNumber) {
    const paymentData = {
      cardholderName,
      cardNumber,
      expiryDate,
      cvv,
      billingZip: billingZip || zipCode
    };
    newCustomer.encryptedPaymentInfo = encryptionUtil.encrypt(paymentData);
  }

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

  // Prepare bag info for emails (V2 doesn't have bag purchases)
  const bagInfo = {
    numberOfBags: 0,  // V2 doesn't require bag purchases
    totalCredit: 0,   // V2 has no upfront payment
    bagFee: 0         // V2 has no bag fees
  };

  // Send welcome email to customer with proper error handling
  try {
    await emailService.sendCustomerWelcomeEmail(
      newCustomer,  // Pass the full customer object
      affiliate,    // Pass the full affiliate object
      bagInfo      // Pass bag information
    );
  } catch (emailError) {
    console.error('Failed to send welcome email:', emailError);
    // Don't fail registration if email fails
  }

  // Send new customer notification to affiliate
  try {
    await emailService.sendAffiliateNewCustomerEmail(
      affiliate,    // Pass the full affiliate object
      newCustomer,  // Pass the full customer object
      bagInfo      // Pass bag information
    );
  } catch (emailError) {
    console.error('Failed to send affiliate notification:', emailError);
    // Don't fail registration if notification fails
  }

  // Send success response
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
 * Get customer profile
 * Uses authorization middleware and response helpers
 */
exports.getCustomerProfile = [
  AuthorizationHelpers.checkCustomerAccess,
  ControllerHelpers.asyncWrapper(async (req, res) => {
    const { customerId } = req.params;

    const customer = await Customer.findOne({ customerId })
      .select('-passwordHash -passwordSalt -encryptedPaymentInfo');

    if (!customer) {
      return ControllerHelpers.sendError(res, 'Customer not found', 404);
    }

    // Format customer data for response
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
 * Update customer profile
 * Uses authorization middleware and input sanitization
 */
exports.updateCustomerProfile = [
  AuthorizationHelpers.checkCustomerAccess,
  ControllerHelpers.asyncWrapper(async (req, res) => {
    const { customerId } = req.params;
    
    // Sanitize input
    const sanitizedBody = ControllerHelpers.sanitizeInput(req.body);
    
    const customer = await Customer.findOne({ customerId });
    if (!customer) {
      return ControllerHelpers.sendError(res, 'Customer not found', 404);
    }

    // Define allowed updates with formatters
    const allowedUpdates = {
      firstName: (val) => Formatters.name(val),
      lastName: (val) => Formatters.name(val),
      phone: (val) => Formatters.phone(val, 'us'),
      address: (val) => val,
      city: (val) => val,
      state: (val) => val.toUpperCase(),
      zipCode: (val) => val,
      specialInstructions: (val) => val,
      languagePreference: (val) => val
    };

    // Apply updates with formatting
    let hasUpdates = false;
    Object.keys(allowedUpdates).forEach(field => {
      if (sanitizedBody[field] !== undefined) {
        const formatter = allowedUpdates[field];
        customer[field] = formatter(sanitizedBody[field]);
        hasUpdates = true;
      }
    });

    if (!hasUpdates) {
      return ControllerHelpers.sendError(res, 'No valid fields to update', 400);
    }

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
 * Get customer orders with pagination
 * Uses pagination helpers and formatters
 */
exports.getCustomerOrders = [
  AuthorizationHelpers.checkCustomerAccess,
  ControllerHelpers.asyncWrapper(async (req, res) => {
    const { customerId } = req.params;
    
    // Parse pagination parameters
    const { page, limit, skip, sortBy } = ControllerHelpers.parsePagination(req.query, {
      sortBy: '-createdAt'
    });
    
    // Build query with filters
    const query = ControllerHelpers.buildQuery(
      { ...req.query, customerId },
      {
        customerId: 'customerId',
        status: 'status',
        startDate: 'createdAt',
        endDate: 'createdAt',
        paymentStatus: 'v2PaymentStatus'
      }
    );

    // Get orders with pagination
    const [orders, totalOrders] = await Promise.all([
      Order.find(query)
        .sort(sortBy)
        .skip(skip)
        .limit(limit),
      Order.countDocuments(query)
    ]);

    // Format orders for response
    const formattedOrders = orders.map(order => ({
      orderId: order.orderId,
      status: order.status,
      formattedStatus: Formatters.status(order.status, 'order'),
      pickupDate: order.pickupDate,
      formattedDate: Formatters.date(order.pickupDate, 'medium'),
      estimatedWeight: order.estimatedWeight,
      actualWeight: order.actualWeight,
      formattedWeight: Formatters.weight(order.actualWeight),
      actualTotal: order.actualTotal,
      formattedTotal: Formatters.currency(order.actualTotal),
      numberOfBags: order.numberOfBags,
      bagsSummary: Formatters.plural(order.numberOfBags, 'bag'),
      v2PaymentStatus: order.v2PaymentStatus,
      formattedPaymentStatus: Formatters.status(order.v2PaymentStatus, 'payment'),
      createdAt: order.createdAt,
      timeAgo: Formatters.relativeTime(order.createdAt)
    }));

    // Calculate pagination metadata
    const pagination = ControllerHelpers.calculatePagination(totalOrders, page, limit);

    // Send paginated response
    return ControllerHelpers.sendPaginated(res, formattedOrders, pagination, 'orders');
  })
];

/**
 * Get customer dashboard statistics
 * Uses parallel data fetching and formatters
 */
exports.getCustomerDashboardStats = [
  AuthorizationHelpers.checkCustomerAccess,
  ControllerHelpers.asyncWrapper(async (req, res) => {
    const { customerId } = req.params;

    // Parallel data fetching for performance
    const [customer, recentOrders, stats, activeOrder] = await Promise.all([
      Customer.findOne({ customerId })
        .select('-passwordHash -passwordSalt -encryptedPaymentInfo'),
      Order.find({ customerId })
        .sort('-createdAt')
        .limit(5),
      Order.aggregate([
        { $match: { customerId } },
        {
          $group: {
            _id: null,
            totalOrders: { $sum: 1 },
            totalSpent: { $sum: '$actualTotal' },
            totalWeight: { $sum: '$actualWeight' },
            completedOrders: {
              $sum: {
                $cond: [{ $eq: ['$status', 'complete'] }, 1, 0]
              }
            }
          }
        }
      ]),
      Order.findOne({
        customerId,
        status: { $in: ['pending', 'scheduled', 'processing', 'processed'] }
      }).sort('-createdAt')
    ]);

    if (!customer) {
      return ControllerHelpers.sendError(res, 'Customer not found', 404);
    }

    // Format dashboard data
    const dashboardData = {
      customer: {
        customerId: customer.customerId,
        fullName: Formatters.fullName(customer.firstName, customer.lastName),
        email: customer.email,
        phone: Formatters.phone(customer.phone),
        address: Formatters.address(customer),
        wdfCredits: customer.wdfCredit || 0,
        formattedCredits: Formatters.currency(customer.wdfCredit || 0),
        numberOfBags: customer.numberOfBags,
        memberSince: Formatters.date(customer.createdAt, 'medium'),
        memberDuration: Formatters.relativeTime(customer.createdAt)
      },
      statistics: {
        totalOrders: stats[0]?.totalOrders || 0,
        completedOrders: stats[0]?.completedOrders || 0,
        totalSpent: stats[0]?.totalSpent || 0,
        formattedSpent: Formatters.currency(stats[0]?.totalSpent || 0),
        totalWeight: stats[0]?.totalWeight || 0,
        formattedWeight: Formatters.weight(stats[0]?.totalWeight || 0),
        averageOrderValue: stats[0]?.totalOrders > 0 
          ? (stats[0].totalSpent / stats[0].totalOrders)
          : 0,
        formattedAverageValue: Formatters.currency(
          stats[0]?.totalOrders > 0 
            ? (stats[0].totalSpent / stats[0].totalOrders)
            : 0
        )
      },
      recentOrders: recentOrders.map(order => ({
        orderId: Formatters.orderId(order.orderId, true),
        date: Formatters.date(order.pickupDate),
        status: Formatters.status(order.status, 'order'),
        total: Formatters.currency(order.actualTotal),
        bags: order.numberOfBags
      })),
      activeOrder: activeOrder ? {
        orderId: activeOrder.orderId,
        status: Formatters.status(activeOrder.status, 'order'),
        pickupDate: Formatters.date(activeOrder.pickupDate),
        timeUntilPickup: Formatters.relativeTime(activeOrder.pickupDate),
        paymentStatus: Formatters.status(activeOrder.v2PaymentStatus, 'payment')
      } : null
    };

    return ControllerHelpers.sendSuccess(res, dashboardData);
  })
];

/**
 * Update payment information
 * Uses authorization and encryption utilities
 */
exports.updatePaymentInfo = [
  AuthorizationHelpers.checkCustomerAccess,
  ControllerHelpers.asyncWrapper(async (req, res) => {
    const { customerId } = req.params;
    const {
      cardholderName,
      cardNumber,
      expiryDate,
      cvv,
      billingZip
    } = req.body;

    // Validate required fields
    const validationErrors = ControllerHelpers.validateRequiredFields(req.body, [
      'cardholderName',
      'cardNumber',
      'expiryDate',
      'cvv'
    ]);

    if (validationErrors) {
      return ControllerHelpers.sendError(res, 'Missing required payment fields', 400, validationErrors);
    }

    const customer = await Customer.findOne({ customerId });
    if (!customer) {
      return ControllerHelpers.sendError(res, 'Customer not found', 404);
    }

    // Encrypt payment information
    const paymentData = {
      cardholderName,
      cardNumber,
      expiryDate,
      cvv,
      billingZip: billingZip || customer.zipCode
    };

    customer.encryptedPaymentInfo = encryptionUtil.encrypt(paymentData);
    await customer.save();

    return ControllerHelpers.sendSuccess(
      res,
      { message: 'Payment information updated successfully' },
      'Payment information updated successfully'
    );
  })
];

/**
 * Delete customer data (GDPR compliance)
 * Uses authorization middleware
 */
exports.deleteCustomerData = [
  AuthorizationHelpers.checkCustomerAccess,
  ControllerHelpers.asyncWrapper(async (req, res) => {
    const { customerId } = req.params;

    // Only allow customers to delete their own data or admin
    if (req.user.role !== 'admin' && req.user.customerId !== customerId) {
      return ControllerHelpers.sendError(res, 'Unauthorized to delete this account', 403);
    }

    // Check for active orders
    const activeOrders = await Order.countDocuments({
      customerId,
      status: { $in: ['pending', 'scheduled', 'processing', 'processed'] }
    });

    if (activeOrders > 0) {
      return ControllerHelpers.sendError(
        res,
        `Cannot delete account with ${activeOrders} active orders`,
        400
      );
    }

    // Delete customer and related data
    await Promise.all([
      Customer.deleteOne({ customerId }),
      Order.deleteMany({ customerId })
    ]);

    return ControllerHelpers.sendSuccess(
      res,
      { message: 'Customer account deleted successfully' },
      'Customer account deleted successfully'
    );
  })
];

/**
 * Update customer password
 * Uses authorization and encryption utilities
 */
exports.updateCustomerPassword = [
  AuthorizationHelpers.checkCustomerAccess,
  ControllerHelpers.asyncWrapper(async (req, res) => {
    const { customerId } = req.params;
    const { currentPassword, newPassword } = req.body;

    // Validate required fields
    const validationErrors = ControllerHelpers.validateRequiredFields(req.body, [
      'currentPassword',
      'newPassword'
    ]);

    if (validationErrors) {
      return ControllerHelpers.sendError(res, 'Missing required fields', 400, validationErrors);
    }

    // Only allow customers to change their own password
    if (req.user.customerId !== customerId) {
      return ControllerHelpers.sendError(res, 'Unauthorized to change this password', 403);
    }

    const customer = await Customer.findOne({ customerId });
    if (!customer) {
      return ControllerHelpers.sendError(res, 'Customer not found', 404);
    }

    // Verify current password
    const isValidPassword = encryptionUtil.verifyPassword(
      currentPassword,
      customer.passwordSalt,
      customer.passwordHash
    );

    if (!isValidPassword) {
      return ControllerHelpers.sendError(res, 'Current password is incorrect', 400);
    }

    // Hash new password
    const { salt, hash } = encryptionUtil.hashPassword(newPassword);
    customer.passwordSalt = salt;
    customer.passwordHash = hash;
    await customer.save();

    return ControllerHelpers.sendSuccess(
      res,
      { message: 'Password updated successfully' },
      'Password updated successfully'
    );
  })
];

/**
 * Get all customers (Admin only)
 * Uses role-based filtering and pagination
 */
exports.getCustomersForAdmin = [
  AuthorizationHelpers.requireRole(['admin', 'administrator']),
  ControllerHelpers.asyncWrapper(async (req, res) => {
    // Parse pagination and filters
    const { page, limit, skip, sortBy } = ControllerHelpers.parsePagination(req.query, {
      sortBy: '-createdAt',
      maxLimit: 100
    });

    // Build query from filters
    const query = ControllerHelpers.buildQuery(req.query, {
      affiliateId: 'affiliateId',
      email: 'email',
      firstName: 'firstName',
      lastName: 'lastName',
      city: 'city',
      state: 'state',
      status: 'status',
      createdAfter: 'createdAt',
      createdBefore: 'createdAt'
    });

    // Get customers with pagination
    const [customers, totalCustomers] = await Promise.all([
      Customer.find(query)
        .select('-passwordHash -passwordSalt -encryptedPaymentInfo')
        .populate('affiliateId', 'businessName')
        .sort(sortBy)
        .skip(skip)
        .limit(limit),
      Customer.countDocuments(query)
    ]);

    // Format customers for response
    const formattedCustomers = customers.map(customer => ({
      customerId: customer.customerId,
      fullName: Formatters.fullName(customer.firstName, customer.lastName),
      email: customer.email,
      phone: Formatters.phone(customer.phone),
      address: Formatters.address(customer, 'short'),
      affiliateId: customer.affiliateId,
      affiliateName: customer.affiliateId?.businessName || 'N/A',
      wdfCredits: Formatters.currency(customer.wdfCredits || 0),
      registrationDate: Formatters.date(customer.createdAt),
      lastActive: customer.lastLogin ? Formatters.relativeTime(customer.lastLogin) : 'Never'
    }));

    // Calculate pagination
    const pagination = ControllerHelpers.calculatePagination(totalCustomers, page, limit);

    // Send paginated response
    return ControllerHelpers.sendPaginated(res, formattedCustomers, pagination, 'customers');
  })
];

module.exports = exports;