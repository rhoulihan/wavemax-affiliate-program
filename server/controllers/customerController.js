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
  const existingEmail = await Customer.findOne({ email });
  const existingUsername = await Customer.findOne({ username });

  if (existingEmail && existingUsername) {
    return res.status(400).json({
      success: false,
      message: 'Both email and username are already in use',
      errors: {
        email: 'Email already registered',
        username: 'Username already taken'
      }
    });
  } else if (existingEmail) {
    return res.status(400).json({
      success: false,
      message: 'Email already registered',
      field: 'email'
    });
  } else if (existingUsername) {
    return res.status(400).json({
      success: false,
      message: 'Username already taken',
      field: 'username'
    });
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

// ============================================================================
// V2 Payment Integration
// ============================================================================

const paymentController = require('./paymentController');
const logger = require('../utils/logger');

/**
 * Build consolidated line items for Paygistix payment form
 * Uses WDF codes with add-on variants as expected by Paygistix
 * @param {Object} order - The V2 order document
 * @returns {Array} Consolidated line items for Paygistix
 */
function buildPaygistixLineItems(order) {
  const items = [];
  
  // Use actual weight from order (either from bags or actualWeight field)
  let totalWeight = order.actualWeight || 0;
  if (!totalWeight && order.bags && order.bags.length > 0) {
    totalWeight = order.bags.reduce((sum, bag) => sum + (bag.weight || 0), 0);
  }
  
  // Calculate laundry service cost using the order's baseRate from SystemConfig
  const laundryServiceCost = totalWeight * (order.baseRate || 0);
  
  // Count active add-ons and use the order's calculated addOnTotal
  let addOnCount = 0;
  if (order.addOns) {
    if (order.addOns.premiumDetergent) addOnCount++;
    if (order.addOns.fabricSoftener) addOnCount++;
    if (order.addOns.stainRemover) addOnCount++;
  }
  const addOnTotal = order.addOnTotal || 0;
  
  // For WDF services, we need to calculate the per-pound rate for Paygistix
  // The form expects WDF items to be priced per pound with quantity being the weight
  if (totalWeight > 0 && (laundryServiceCost > 0 || addOnTotal > 0)) {
    // Calculate the effective per-pound rate including add-ons
    const effectiveRate = (laundryServiceCost + addOnTotal) / totalWeight;
    
    // WDF for no add-ons, WDF1 for 1 add-on, WDF2 for 2, WDF3 for 3+
    let wdfCode = 'WDF';
    if (addOnCount > 0) {
      wdfCode = `WDF${Math.min(addOnCount, 3)}`;
    }
    
    // The Paygistix form expects: price = per-pound rate, quantity = weight in pounds
    items.push({
      code: wdfCode,
      description: 'Wash Dry Fold Service',
      price: effectiveRate,
      quantity: Math.round(totalWeight) // Round weight to nearest pound for Paygistix
    });
  }
  
  // Delivery fees - MDF or PBF with specific price codes
  if (order.feeBreakdown) {
    if (order.feeBreakdown.minimumApplied && order.feeBreakdown.minimumFee > 0) {
      // Map the minimum fee to the correct MDF code
      const mdfFee = order.feeBreakdown.minimumFee;
      let mdfCode = 'MDF10'; // Default
      
      // Map to specific MDF codes based on price
      if (mdfFee === 10) mdfCode = 'MDF10';
      else if (mdfFee === 15) mdfCode = 'MDF15';
      else if (mdfFee === 20) mdfCode = 'MDF20';
      else if (mdfFee === 25) mdfCode = 'MDF25';
      else if (mdfFee === 30) mdfCode = 'MDF30';
      else if (mdfFee === 35) mdfCode = 'MDF35';
      else if (mdfFee === 40) mdfCode = 'MDF40';
      else if (mdfFee === 45) mdfCode = 'MDF45';
      else if (mdfFee === 50) mdfCode = 'MDF50';
      else {
        // Find the closest MDF code
        const mdfOptions = [10, 15, 20, 25, 30, 35, 40, 45, 50];
        const closest = mdfOptions.reduce((prev, curr) => 
          Math.abs(curr - mdfFee) < Math.abs(prev - mdfFee) ? curr : prev
        );
        mdfCode = `MDF${closest}`;
      }
      
      items.push({
        code: mdfCode,
        description: 'Minimum Delivery Fee',
        price: mdfFee,
        quantity: 1
      });
    } else if (order.feeBreakdown.perBagFee > 0 && order.feeBreakdown.numberOfBags > 0) {
      // Map the per bag fee to the correct PBF code
      const pbfFee = order.feeBreakdown.perBagFee;
      let pbfCode = 'PBF5'; // Default
      
      // Map to specific PBF codes based on price
      if (pbfFee === 5) pbfCode = 'PBF5';
      else if (pbfFee === 10) pbfCode = 'PBF10';
      else if (pbfFee === 15) pbfCode = 'PBF15';
      else if (pbfFee === 20) pbfCode = 'PBF20';
      else if (pbfFee === 25) pbfCode = 'PBF25';
      else {
        // Find the closest PBF code
        const pbfOptions = [5, 10, 15, 20, 25];
        const closest = pbfOptions.reduce((prev, curr) => 
          Math.abs(curr - pbfFee) < Math.abs(prev - pbfFee) ? curr : prev
        );
        pbfCode = `PBF${closest}`;
      }
      
      items.push({
        code: pbfCode,
        description: 'Per Bag Fee',
        price: pbfFee,
        quantity: order.feeBreakdown.numberOfBags
      });
    }
  }
  
  // Credits reduce the total but aren't sent as line items to Paygistix
  // The total amount will be adjusted when calculating
  
  console.log('[V2 Payment] Generated Paygistix line items:', JSON.stringify(items, null, 2));
  
  return items;
}

/**
 * Build detailed line items from V2 order for customer display
 * @param {Object} order - The V2 order document
 * @returns {Array} Detailed line items for display
 */
function buildLineItemsFromOrder(order) {
  const items = [];
  
  // Use actual weight from order (either from bags or actualWeight field)
  let totalWeight = order.actualWeight || 0;
  if (!totalWeight && order.bags && order.bags.length > 0) {
    totalWeight = order.bags.reduce((sum, bag) => sum + (bag.weight || 0), 0);
  }
  
  // Main laundry service using the order's baseRate from SystemConfig
  const laundryServiceCost = totalWeight * (order.baseRate || 0);
  
  if (laundryServiceCost > 0) {
    items.push({
      code: 'LAUNDRY',
      description: `Laundry Service (${totalWeight} lbs @ $${(order.baseRate || 0).toFixed(2)}/lb)`,
      price: laundryServiceCost,
      quantity: 1
    });
  }
  
  // Add-ons as separate line items - calculate individual add-on prices
  // The Order model uses $0.10 per pound per add-on
  const addOnPricePerLb = 0.10; // This matches the Order model calculation
  if (order.addOns && totalWeight > 0) {
    const addOnPrice = totalWeight * addOnPricePerLb;
    
    if (order.addOns.premiumDetergent) {
      items.push({
        code: 'ADDON_PD',
        description: `Premium Detergent (${totalWeight} lbs @ $${addOnPricePerLb.toFixed(2)}/lb)`,
        price: addOnPrice,
        quantity: 1
      });
    }
    if (order.addOns.fabricSoftener) {
      items.push({
        code: 'ADDON_FS',
        description: `Fabric Softener (${totalWeight} lbs @ $${addOnPricePerLb.toFixed(2)}/lb)`,
        price: addOnPrice,
        quantity: 1
      });
    }
    if (order.addOns.stainRemover) {
      items.push({
        code: 'ADDON_SR',
        description: `Stain Remover (${totalWeight} lbs @ $${addOnPricePerLb.toFixed(2)}/lb)`,
        price: addOnPrice,
        quantity: 1
      });
    }
  }
  
  // Delivery fees
  if (order.feeBreakdown) {
    // Either minimum fee or per bag fee is charged, not both
    if (order.feeBreakdown.minimumApplied && order.feeBreakdown.minimumFee > 0) {
      items.push({
        code: 'MDF',
        description: 'Minimum Delivery Fee',
        price: order.feeBreakdown.minimumFee,
        quantity: 1
      });
    } else if (order.feeBreakdown.perBagFee > 0 && order.feeBreakdown.numberOfBags > 0) {
      items.push({
        code: 'PBF',
        description: `Per Bag Fee (${order.feeBreakdown.numberOfBags} bags)`,
        price: order.feeBreakdown.perBagFee,
        quantity: order.feeBreakdown.numberOfBags
      });
    }
  }
  
  // Apply any credits
  if (order.wdfCreditApplied && order.wdfCreditApplied > 0) {
    items.push({
      code: 'CREDIT',
      description: 'WDF Credit Applied',
      price: -order.wdfCreditApplied,
      quantity: 1
    });
  }
  
  if (order.bagCreditApplied && order.bagCreditApplied > 0) {
    items.push({
      code: 'BAGCREDIT',
      description: 'Bag Credit Applied',
      price: -order.bagCreditApplied,
      quantity: 1
    });
  }
  
  return items;
}

/**
 * Initiate V2 payment for an order
 * POST /api/v2/customers/initiate-payment
 */
exports.initiateV2Payment = ControllerHelpers.asyncWrapper(async (req, res) => {
  const { orderId } = req.body;
  const customerObjectId = req.user.id;
  
  // Get the customer's customerId (CUST-xxx format)
  const customer = await Customer.findById(customerObjectId);
  if (!customer) {
    return ControllerHelpers.sendError(res, 'Customer not found', 404);
  }
  
  const customerId = customer.customerId;
  
  console.log('[V2 Payment] Initiating payment for order:', orderId, 'Customer:', customerId);
  
  // Validate order exists and belongs to customer
  const order = await Order.findOne({ 
    orderId: orderId,
    customerId: customerId,
    v2PaymentStatus: { $in: ['pending', 'awaiting'] }
  });
  
  if (!order) {
    // Debug: Check if order exists without payment status filter
    const orderDebug = await Order.findOne({ orderId: orderId });
    if (orderDebug) {
      console.log('[V2 Payment] Order found but not eligible. customerId:', orderDebug.customerId, 'v2PaymentStatus:', orderDebug.v2PaymentStatus);
      console.log('[V2 Payment] Expected customerId:', customerId);
    } else {
      console.log('[V2 Payment] Order not found with orderId:', orderId);
    }
    return ControllerHelpers.sendError(res, 'Order not found or already paid', 404);
  }
  
  // Build line items - detailed for display, consolidated for Paygistix
  const displayLineItems = buildLineItemsFromOrder(order);
  const paygistixLineItems = buildPaygistixLineItems(order);
  
  // Calculate total amount from display items (includes credits)
  const totalAmount = displayLineItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  
  // Prepare payment data for Paygistix with consolidated WDF codes
  const paymentData = {
    customerData: {
      customerId: customer.customerId,
      email: customer.email,
      firstName: customer.firstName,
      lastName: customer.lastName,
      phone: customer.phone,
      orderId: order.orderId
    },
    paymentData: {
      amount: totalAmount,
      items: paygistixLineItems, // Use consolidated items for Paygistix
      orderId: order.orderId
    }
  };
  
  // Create payment token using existing V1 infrastructure
  const tokenReq = {
    body: paymentData
  };
  
  const tokenRes = {
    json: (data) => {
      // Return payment configuration to frontend
      // The PaymentToken collection handles all status tracking
      res.json({
        success: data.success,
        token: data.token,
        formConfig: data.formConfig,
        amount: totalAmount,
        lineItems: displayLineItems, // Send detailed items for display
        paygistixItems: paygistixLineItems, // Send Paygistix-formatted items for form submission
        message: data.message || 'Payment initiated successfully'
      });
    },
    status: (code) => ({
      json: (data) => res.status(code).json(data)
    })
  };
  
  // Use existing payment token creation
  // This creates a record in PaymentToken collection with all necessary data
  await paymentController.createPaymentToken(tokenReq, tokenRes);
});

/**
 * Update V2 order after successful payment
 * This is called internally after payment callback
 */
exports.updateV2OrderPayment = async (paymentToken) => {
  try {
    // Extract order ID from customerData stored in PaymentToken
    const orderId = paymentToken.customerData?.orderId;
    
    if (!orderId) {
      logger.warn('No order ID found in payment token customerData:', paymentToken.token);
      return false;
    }
    
    // Find order by ID
    const order = await Order.findById(orderId);
    
    if (!order) {
      logger.warn('No V2 order found for order ID:', orderId);
      return false;
    }
    
    // Extract payment details from Paygistix response
    const paygistixResponse = paymentToken.paygistixResponse || {};
    
    // Update order based on payment status
    if (paymentToken.status === 'success') {
      // Extract card details from response
      const cardType = paygistixResponse.CardType || paygistixResponse.cardType || '';
      const last4 = paygistixResponse.Last4 || paygistixResponse.last4 || '';
      const authCode = paygistixResponse.AuthCode || paygistixResponse.authCode || '';
      const amount = paygistixResponse.Amount || paygistixResponse.amount || order.estimatedTotal;
      
      // Update V2 payment fields
      order.v2PaymentStatus = 'verified';
      order.v2PaymentMethod = 'credit_card';
      order.v2PaymentAmount = parseFloat(amount) || order.estimatedTotal;
      order.v2PaymentTransactionId = paymentToken.transactionId;
      order.v2PaymentVerifiedAt = new Date();
      
      // Store card details in notes field for reference
      const cardDetails = cardType && last4 ? `${cardType} ending in ${last4}` : 'Credit Card';
      const authDetails = authCode ? ` (Auth: ${authCode})` : '';
      order.v2PaymentNotes = `Payment via ${cardDetails}${authDetails}`;
      
      // Also update legacy payment fields for compatibility
      order.paymentStatus = 'completed';
      order.isPaid = true;
      order.paymentReference = paymentToken.transactionId;
      order.paymentDate = new Date();
      order.transactionId = paymentToken.transactionId;
      
      logger.info('V2 order payment verified:', {
        orderId: order._id,
        transactionId: paymentToken.transactionId,
        amount: order.v2PaymentAmount,
        cardType: cardType,
        last4: last4
      });
    } else if (paymentToken.status === 'failed') {
      order.v2PaymentStatus = 'failed';
      order.paymentError = paymentToken.errorMessage || paygistixResponse.Message || 'Payment declined';
      order.paymentStatus = 'failed';
      
      // Store failure details in notes
      const failureCode = paygistixResponse.Result || paygistixResponse.result || '';
      const failureMsg = paygistixResponse.Message || paygistixResponse.message || paymentToken.errorMessage;
      order.v2PaymentNotes = `Payment failed: ${failureMsg}${failureCode ? ` (Code: ${failureCode})` : ''}`;
      
      logger.error('V2 order payment failed:', {
        orderId: order._id,
        error: paymentToken.errorMessage
      });
    } else if (paymentToken.status === 'cancelled') {
      order.v2PaymentStatus = 'pending';
      order.paymentStatus = 'pending';
      order.v2PaymentNotes = 'Payment cancelled by user';
      
      logger.info('V2 order payment cancelled:', {
        orderId: order._id
      });
    }
    
    await order.save();
    return true;
  } catch (error) {
    logger.error('Error updating V2 order payment:', error);
    return false;
  }
};

/**
 * Get V2 payment status for an order
 * GET /api/v2/customers/payment-status/:orderId
 */
exports.getV2PaymentStatus = ControllerHelpers.asyncWrapper(async (req, res) => {
  const { orderId } = req.params;
  const customerId = req.user.id;
  
  // Get order with payment status
  const order = await Order.findOne({ 
    _id: orderId,
    customerId: customerId 
  }).select('v2PaymentStatus paymentStatus transactionId paymentError paymentDate');
  
  if (!order) {
    return ControllerHelpers.sendError(res, 'Order not found', 404);
  }
  
  // Also check if there's an active payment token for real-time status
  const PaymentToken = require('../models/PaymentToken');
  const activeToken = await PaymentToken.findOne({
    'customerData.orderId': orderId,
    status: { $in: ['pending', 'processing'] }
  }).sort('-createdAt');
  
  // If there's an active payment token, return its status
  if (activeToken) {
    res.json({
      success: true,
      paymentStatus: activeToken.status,
      token: activeToken.token,
      transactionId: activeToken.transactionId,
      paymentDate: activeToken.updatedAt,
      error: activeToken.errorMessage,
      isActive: true
    });
  } else {
    // Return order's stored payment status
    res.json({
      success: true,
      paymentStatus: order.v2PaymentStatus || order.paymentStatus,
      transactionId: order.transactionId,
      paymentDate: order.paymentDate,
      error: order.paymentError,
      isActive: false
    });
  }
});

module.exports = exports;