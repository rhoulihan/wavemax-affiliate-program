// WaveMAX Laundry Affiliate Program
// Customer Controller - Migrated to use utility modules
// This reduces code duplication and improves maintainability

const Customer = require('../models/Customer');
const Order = require('../models/Order');
const encryptionUtil = require('../utils/encryption');
const { getFilteredData } = require('../utils/fieldFilter');
const { validationResult } = require('express-validator');

// Extracted services
const customerRegistrationService = require('../services/customerRegistrationService');
const bagClaimService = require('../services/bagClaimService');

// Utility modules
const ControllerHelpers = require('../utils/controllerHelpers');
const AuthorizationHelpers = require('../middleware/authorizationHelpers');
const Formatters = require('../utils/formatters');

// ============================================================================
// Customer Controllers - Refactored with Utilities
// ============================================================================

/**
 * Resolve a scanned bag token into a claim-page state.
 * Public; anti-enumeration — minted/retired/unknown all map to 'invalid'.
 * @route GET /api/v1/customers/claim/:bagToken
 */
exports.resolveClaim = ControllerHelpers.asyncWrapper(async (req, res) => {
  const resolved = await bagClaimService.resolveClaimToken(req.params.bagToken);
  if (resolved.state === 'claimable') {
    const { affiliate } = resolved;
    return ControllerHelpers.sendSuccess(res, {
      state: 'claimable',
      affiliate: {
        businessName: affiliate.businessName,
        firstName: affiliate.firstName,
        lastName: affiliate.lastName,
        city: affiliate.city,
        state: affiliate.state
      }
    });
  }
  if (resolved.state === 'claimed') {
    // order slot populated by PR 9 ({ status, awaitingDelivery }); no customer PII
    return ControllerHelpers.sendSuccess(res, { state: 'claimed', order: resolved.order });
  }
  return ControllerHelpers.sendSuccess(res, { state: 'invalid' });
});

/**
 * Claim-bound customer registration — the affiliate is derived from the bag.
 * @route POST /api/v1/customers/claim/:bagToken/register
 */
exports.claimRegister = ControllerHelpers.asyncWrapper(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return ControllerHelpers.sendError(res, 'Validation failed', 400, errors.array());
  }

  try {
    const { customer, affiliate, bag, token } = await customerRegistrationService.registerCustomer({
      ...req.body,
      bagToken: req.params.bagToken
    });

    return ControllerHelpers.sendSuccess(
      res,
      {
        customerId: customer.customerId,
        token,
        bag: { bagId: bag.bagId },
        customerData: {
          firstName: customer.firstName,
          lastName: customer.lastName,
          email: customer.email,
          phone: customer.phone,
          address: customer.address,
          city: customer.city,
          state: customer.state,
          zipCode: customer.zipCode,
          affiliateId: customer.affiliateId
        },
        affiliateData: {
          businessName: affiliate.businessName,
          firstName: affiliate.firstName,
          lastName: affiliate.lastName
        }
      },
      'Customer registration successful',
      201
    );
  } catch (err) {
    if (err.isRegistrationError) {
      // Match the old response shape so frontends and tests keep working.
      const body = { success: false, message: err.message, ...err.extras };
      return res.status(err.status || 400).json(body);
    }
    throw err;
  }
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
        endDate: 'createdAt'
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
      numberOfBags: order.numberOfBags,
      bagsSummary: Formatters.plural(order.numberOfBags, 'bag'),
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
    const [customer, recentOrders, stats, activeOrder, activeOrdersCount] = await Promise.all([
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
        status: { $in: ['pending', 'in_progress', 'out_for_delivery'] }
      }).sort('-createdAt'),
      // Count active orders (not complete or cancelled)
      Order.countDocuments({
        customerId,
        status: { $in: ['pending', 'in_progress', 'out_for_delivery'] }
      })
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
        memberSince: Formatters.date(customer.createdAt, 'medium'),
        memberDuration: Formatters.relativeTime(customer.createdAt)
      },
      statistics: {
        totalOrders: stats[0]?.totalOrders || 0,
        completedOrders: stats[0]?.completedOrders || 0,
        activeOrders: activeOrdersCount || 0
      },
      recentOrders: recentOrders.map(order => ({
        orderId: Formatters.orderId(order.orderId, true),
        date: Formatters.date(order.pickupDate),
        status: Formatters.status(order.status, 'order'),
        bags: order.numberOfBags
      })),
      activeOrder: activeOrder ? {
        orderId: activeOrder.orderId,
        status: Formatters.status(activeOrder.status, 'order'),
        pickupDate: Formatters.date(activeOrder.pickupDate),
        timeUntilPickup: Formatters.relativeTime(activeOrder.pickupDate)
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
      status: { $in: ['pending', 'in_progress', 'out_for_delivery'] }
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

    // Get customers with pagination (without populate)
    const [customers, totalCustomers] = await Promise.all([
      Customer.find(query)
        .select('-passwordHash -passwordSalt -encryptedPaymentInfo')
        .sort(sortBy)
        .skip(skip)
        .limit(limit),
      Customer.countDocuments(query)
    ]);

    // Get unique affiliate IDs and customer IDs
    const affiliateIds = [...new Set(customers.map(c => c.affiliateId).filter(Boolean))];
    const customerIds = customers.map(c => c.customerId);

    // Fetch affiliates
    const Affiliate = require('../models/Affiliate');
    const affiliates = await Affiliate.find({ affiliateId: { $in: affiliateIds } })
      .select('affiliateId businessName');

    // Get order counts for each customer
    const Order = require('../models/Order');
    const orderCounts = await Order.aggregate([
      { $match: { customerId: { $in: customerIds } } },
      { $group: { _id: '$customerId', count: { $sum: 1 } } }
    ]);

    // Create lookup maps
    const affiliateMap = {};
    affiliates.forEach(aff => {
      affiliateMap[aff.affiliateId] = aff.businessName;
    });

    const orderCountMap = {};
    orderCounts.forEach(oc => {
      orderCountMap[oc._id] = oc.count;
    });

    // Format customers for response - include raw fields for frontend
    const formattedCustomers = customers.map(customer => ({
      _id: customer._id,
      customerId: customer.customerId,
      firstName: customer.firstName,
      lastName: customer.lastName,
      fullName: Formatters.fullName(customer.firstName, customer.lastName),
      email: customer.email,
      phone: customer.phone,
      address: customer.address,
      city: customer.city,
      state: customer.state,
      zipCode: customer.zipCode,
      formattedAddress: Formatters.address(customer, 'short'),
      affiliateId: customer.affiliateId,
      affiliateName: affiliateMap[customer.affiliateId] || 'N/A',
      registrationDate: Formatters.date(customer.createdAt),
      createdAt: customer.createdAt,
      lastActive: customer.lastLogin ? Formatters.relativeTime(customer.lastLogin) : 'Never',
      orderCount: orderCountMap[customer.customerId] || 0
    }));

    // Calculate pagination
    const pagination = ControllerHelpers.calculatePagination(totalCustomers, page, limit);

    // Send paginated response
    return ControllerHelpers.sendPaginated(res, formattedCustomers, pagination, 'customers');
  })
];

module.exports = exports;