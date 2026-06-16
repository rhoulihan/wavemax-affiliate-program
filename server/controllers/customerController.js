// WaveMAX Laundry Affiliate Program
// Customer Controller
//
// Phase 1: the customer surface is bag-claim registration only. There is no
// customer login, dashboard, profile, orders, or password portal — those
// endpoints were removed (preserved on the `phase2-reference` tag). The only
// authenticated reader here is the administrator customer list.

const Customer = require('../models/Customer');
const { validationResult } = require('express-validator');

// Extracted services
const customerRegistrationService = require('../services/customerRegistrationService');
const bagClaimService = require('../services/bagClaimService');
const emailOtpService = require('../services/emailOtpService');

// Utility modules
const ControllerHelpers = require('../utils/controllerHelpers');
const AuthorizationHelpers = require('../middleware/authorizationHelpers');
const Formatters = require('../utils/formatters');

// ============================================================================
// Customer Controllers
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
 * Request a 6-digit email-verification OTP for (bagToken, email).
 * Generic success regardless of state (anti-enumeration).
 * @route POST /api/v1/customers/claim/:bagToken/email-otp/request
 */
exports.requestEmailOtp = ControllerHelpers.asyncWrapper(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return ControllerHelpers.sendError(res, 'Validation failed', 400, errors.array());
  }
  await emailOtpService.requestOtp({
    bagToken: req.params.bagToken,
    email: req.body.email,
    languagePreference: req.body.languagePreference
  });
  // Generic success — never reveals whether the bag/email is valid.
  return res.json({ success: true, message: 'If the email is valid, a code has been sent.' });
});

/**
 * Verify an email OTP and mint a one-time emailVerificationToken.
 * @route POST /api/v1/customers/claim/:bagToken/email-otp/verify
 */
exports.verifyEmailOtp = ControllerHelpers.asyncWrapper(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return ControllerHelpers.sendError(res, 'Validation failed', 400, errors.array());
  }
  const result = await emailOtpService.verifyOtp({
    bagToken: req.params.bagToken,
    email: req.body.email,
    code: req.body.code,
    req
  });
  if (result.lockedOut) {
    return res.status(429).json({ success: false, code: 'locked_out', message: 'Too many attempts — please try again later' });
  }
  if (!result.success) {
    return res.status(400).json({ success: false, code: 'invalid_code', message: 'Invalid or expired code' });
  }
  return res.json({ success: true, emailVerificationToken: result.verificationToken });
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
    const { customer, affiliate, bag } = await customerRegistrationService.registerCustomer({
      ...req.body,
      bagToken: req.params.bagToken
    });

    return ControllerHelpers.sendSuccess(
      res,
      {
        customerId: customer.customerId,
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
      const body = { success: false, code: err.code, message: err.message, ...err.extras };
      return res.status(err.status || 400).json(body);
    }
    throw err;
  }
});

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
