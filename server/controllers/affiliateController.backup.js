// Affiliate Controller for WaveMAX Laundry Affiliate Program

const Affiliate = require('../models/Affiliate');
const Customer = require('../models/Customer');
const Order = require('../models/Order');
const Transaction = require('../models/Transaction');
const encryptionUtil = require('../utils/encryption');
const emailService = require('../utils/emailService');
const { validationResult } = require('express-validator');
const { escapeRegex } = require('../utils/securityUtils');

/**
 * Register a new affiliate
 */
exports.registerAffiliate = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const {
      firstName,
      lastName,
      email,
      phone,
      businessName,
      address,
      city,
      state,
      zipCode,
      serviceLatitude,
      serviceLongitude,
      serviceRadius,
      minimumDeliveryFee,
      perBagDeliveryFee,
      username,
      password,
      paymentMethod,
      paypalEmail,
      venmoHandle,
      languagePreference
    } = req.body;

    // Check if email or username already exists
    const existingAffiliate = await Affiliate.findOne({
      $or: [{ email }, { username }]
    });

    if (existingAffiliate) {
      return res.status(400).json({
        success: false,
        message: 'Email or username already in use'
      });
    }

    // Hash password
    const { salt, hash } = encryptionUtil.hashPassword(password);

    // Create new affiliate
    const newAffiliate = new Affiliate({
      firstName,
      lastName,
      email,
      phone,
      businessName,
      address,
      city,
      state,
      zipCode,
      serviceLatitude,
      serviceLongitude,
      serviceRadius,
      minimumDeliveryFee: parseFloat(minimumDeliveryFee) || 25,
      perBagDeliveryFee: parseFloat(perBagDeliveryFee) || 5,
      username,
      passwordSalt: salt,
      passwordHash: hash,
      paymentMethod,
      languagePreference: languagePreference || 'en'
    });

    // Add payment information if provided
    if (paymentMethod === 'paypal' && paypalEmail) {
      newAffiliate.paypalEmail = paypalEmail;
      // The encryption middleware will handle this automatically
    } else if (paymentMethod === 'venmo' && venmoHandle) {
      newAffiliate.venmoHandle = venmoHandle;
      // The encryption middleware will handle this automatically
    }

    await newAffiliate.save();

    // Send welcome email
    try {
      await emailService.sendAffiliateWelcomeEmail(newAffiliate);
      // Email sent successfully - no need to check result
    } catch (emailError) {
      console.warn('Welcome email could not be sent:', emailError);
      // Continue with registration process even if email fails
    }

    res.status(201).json({
      success: true,
      affiliateId: newAffiliate.affiliateId,
      message: 'Affiliate registered successfully!'
    });
  } catch (error) {
    console.error('Affiliate registration error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred during registration'
    });
  }
};

/**
 * Get affiliate profile
 */
exports.getAffiliateProfile = async (req, res) => {
  try {
    const { affiliateId } = req.params;

    // Verify affiliate exists
    const affiliate = await Affiliate.findOne({ affiliateId });

    if (!affiliate) {
      return res.status(404).json({
        success: false,
        message: 'Affiliate not found'
      });
    }

    // Check authorization (admin or self)
    if (req.user.role !== 'admin' && req.user.affiliateId !== affiliateId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    // Prepare response data
    const responseData = {
      affiliateId: affiliate.affiliateId,
      firstName: affiliate.firstName,
      lastName: affiliate.lastName,
      email: affiliate.email,
      phone: affiliate.phone,
      businessName: affiliate.businessName,
      address: affiliate.address,
      city: affiliate.city,
      state: affiliate.state,
      zipCode: affiliate.zipCode,
      serviceLatitude: affiliate.serviceLatitude,
      serviceLongitude: affiliate.serviceLongitude,
      serviceRadius: affiliate.serviceRadius,
      minimumDeliveryFee: affiliate.minimumDeliveryFee,
      perBagDeliveryFee: affiliate.perBagDeliveryFee,
      paymentMethod: affiliate.paymentMethod,
      registrationMethod: affiliate.registrationMethod,
      isActive: affiliate.isActive,
      dateRegistered: affiliate.dateRegistered,
      lastLogin: affiliate.lastLogin
    };

    // Include payment info if available (decrypt if necessary)
    if (affiliate.paymentMethod === 'paypal' && affiliate.paypalEmail) {
      try {
        // Decrypt PayPal email if it's encrypted
        responseData.paypalEmail = typeof affiliate.paypalEmail === 'object'
          ? encryptionUtil.decrypt(affiliate.paypalEmail)
          : affiliate.paypalEmail;
      } catch (error) {
        console.error('Error decrypting PayPal email:', error);
        // Don't include if decryption fails
      }
    }

    // Return affiliate data
    res.status(200).json({
      success: true,
      affiliate: responseData
    });
  } catch (error) {
    console.error('Get affiliate profile error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while retrieving affiliate profile'
    });
  }
};

/**
 * Update affiliate profile
 */
exports.updateAffiliateProfile = async (req, res) => {
  try {
    const { affiliateId } = req.params;
    const updates = req.body;

    // Check authorization (admin or self)
    if (req.user.role !== 'admin' && req.user.affiliateId !== affiliateId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    // Verify affiliate exists
    const affiliate = await Affiliate.findOne({ affiliateId });

    if (!affiliate) {
      return res.status(404).json({
        success: false,
        message: 'Affiliate not found'
      });
    }

    // Fields that can be updated
    const updatableFields = [
      'firstName', 'lastName', 'phone', 'businessName',
      'address', 'city', 'state', 'zipCode', 'serviceArea', 'serviceLatitude', 'serviceLongitude', 'serviceRadius',
      'minimumDeliveryFee', 'perBagDeliveryFee', 'paymentMethod'
    ];

    // Update fields
    updatableFields.forEach(field => {
      if (updates[field] !== undefined) {
        affiliate[field] = updates[field];
      }
    });

    // Special handling for payment info
    if (updates.paymentMethod) {
      affiliate.paymentMethod = updates.paymentMethod;

      if (updates.paymentMethod === 'paypal') {
        if (updates.paypalEmail) {
          affiliate.paypalEmail = updates.paypalEmail;
        }
      } else if (updates.paymentMethod === 'venmo') {
        if (updates.venmoHandle) {
          affiliate.venmoHandle = updates.venmoHandle;
        }
      }
    }

    // Handle password change if provided
    if (updates.currentPassword && updates.newPassword) {
      // Verify current password
      const isPasswordValid = encryptionUtil.verifyPassword(
        updates.currentPassword,
        affiliate.passwordSalt,
        affiliate.passwordHash
      );

      if (!isPasswordValid) {
        return res.status(400).json({
          success: false,
          message: 'Current password is incorrect'
        });
      }

      // Update password
      const { salt, hash } = encryptionUtil.hashPassword(updates.newPassword);
      affiliate.passwordSalt = salt;
      affiliate.passwordHash = hash;
    }

    await affiliate.save();

    res.status(200).json({
      success: true,
      message: 'Affiliate profile updated successfully'
    });
  } catch (error) {
    console.error('Update affiliate profile error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while updating affiliate profile'
    });
  }
};

/**
 * Get affiliate earnings
 */
exports.getAffiliateEarnings = async (req, res) => {
  try {
    const { affiliateId } = req.params;
    const { period } = req.query;

    // Check authorization (admin or self)
    if (req.user.role !== 'admin' && req.user.affiliateId !== affiliateId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    // Verify affiliate exists
    const affiliate = await Affiliate.findOne({ affiliateId });

    if (!affiliate) {
      return res.status(404).json({
        success: false,
        message: 'Affiliate not found'
      });
    }

    // Determine date range based on period
    let startDate = new Date();
    const endDate = new Date();

    if (period === 'week') {
      startDate.setDate(startDate.getDate() - 7);
    } else if (period === 'month') {
      startDate.setMonth(startDate.getMonth() - 1);
    } else if (period === 'year') {
      startDate.setFullYear(startDate.getFullYear() - 1);
    } else {
      // Default to all-time
      startDate = new Date(0);
    }

    // Find all delivered orders for this affiliate within the date range
    const orders = await Order.find({
      affiliateId,
      status: 'complete',
      deliveredAt: { $gte: startDate, $lte: endDate }
    }).sort({ deliveredAt: -1 });

    // Get customer details for each order
    const customerIds = [...new Set(orders.map(order => order.customerId))];
    const customers = await Customer.find({ customerId: { $in: customerIds } });

    // Map customers to a dictionary for quick lookup
    const customerMap = {};
    customers.forEach(customer => {
      customerMap[customer.customerId] = customer;
    });

    // Calculate total earnings
    let totalEarnings = 0;
    orders.forEach(order => {
      totalEarnings += order.affiliateCommission || 0;
    });

    // Find pending transactions (not yet paid out)
    const pendingTransactions = await Transaction.find({
      affiliateId,
      status: { $in: ['pending', 'processing'] }
    });

    let pendingAmount = 0;
    pendingTransactions.forEach(transaction => {
      pendingAmount += transaction.amount;
    });

    res.status(200).json({
      success: true,
      totalEarnings,
      pendingAmount,
      orderCount: orders.length,
      orders: orders.map(order => {
        const customer = customerMap[order.customerId];
        return {
          orderId: order.orderId,
          customerId: order.customerId,
          customerName: customer ? `${customer.firstName} ${customer.lastName}` : 'Unknown Customer',
          deliveredAt: order.deliveredAt,
          actualWeight: order.actualWeight,
          actualTotal: order.actualTotal,
          affiliateCommission: order.affiliateCommission
        };
      })
    });
  } catch (error) {
    console.error('Affiliate earnings error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while retrieving earnings information'
    });
  }
};

/**
 * Get affiliate customers
 */
exports.getAffiliateCustomers = async (req, res) => {
  try {
    const { affiliateId } = req.params;
    const { search, sort, customerId } = req.query;
    const { page, limit, skip } = req.pagination; // Use values from middleware

    // Check authorization (admin or self)
    if (req.user.role !== 'admin' && req.user.affiliateId !== affiliateId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    // Build query
    const query = { affiliateId };

    // Add customer ID filter if provided (for dashboard customer highlighting)
    if (customerId) {
      query.customerId = customerId;
    }

    // Add search if provided
    if (search) {
      const escapedSearch = escapeRegex(search);
      query.$or = [
        { firstName: { $regex: escapedSearch, $options: 'i' } },
        { lastName: { $regex: escapedSearch, $options: 'i' } },
        { email: { $regex: escapedSearch, $options: 'i' } },
        { phone: { $regex: escapedSearch, $options: 'i' } },
        { customerId: { $regex: escapedSearch, $options: 'i' } }
      ];
    }

    // Build sort options
    let sortOptions = {};

    if (sort) {
      switch (sort) {
      case 'name_asc':
        sortOptions = { firstName: 1, lastName: 1 };
        break;
      case 'name_desc':
        sortOptions = { firstName: -1, lastName: -1 };
        break;
      case 'recent':
        sortOptions = { registrationDate: -1 };
        break;
      default:
        sortOptions = { registrationDate: -1 };
      }
    } else {
      sortOptions = { registrationDate: -1 };
    }

    // Get total count for pagination
    const totalCustomers = await Customer.countDocuments(query);

    // Get paginated customers
    const customers = await Customer.find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(limit);

    // Get order counts for each customer
    const customerIds = customers.map(customer => customer.customerId);

    const orderCounts = await Order.aggregate([
      { $match: { customerId: { $in: customerIds } } },
      { $group: { _id: '$customerId', count: { $sum: 1 } } }
    ]);

    // Map order counts to customer objects
    const orderCountMap = {};
    orderCounts.forEach(item => {
      orderCountMap[item._id] = item.count;
    });

    // Prepare response data
    const customersData = customers.map(customer => ({
      customerId: customer.customerId,
      firstName: customer.firstName,
      lastName: customer.lastName,
      email: customer.email,
      phone: customer.phone,
      address: customer.address,
      city: customer.city,
      state: customer.state,
      zipCode: customer.zipCode,
      registrationDate: customer.registrationDate,
      lastLogin: customer.lastLogin,
      serviceFrequency: customer.serviceFrequency,
      orderCount: orderCountMap[customer.customerId] || 0
    }));

    res.status(200).json({
      success: true,
      customers: customersData,
      totalItems: totalCustomers,
      pagination: {
        total: totalCustomers,
        page,
        limit,
        pages: Math.ceil(totalCustomers / limit),
        currentPage: page,
        perPage: limit
      }
    });
  } catch (error) {
    console.error('Get affiliate customers error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while retrieving customers'
    });
  }
};

/**
 * Get affiliate orders
 */
exports.getAffiliateOrders = async (req, res) => {
  try {
    const { affiliateId } = req.params;
    const {
      status,
      date,
      search,
      page = 1,
      limit = 10
    } = req.query;

    // Check authorization (admin or self)
    if (req.user.role !== 'admin' && req.user.affiliateId !== affiliateId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    // Build query
    const query = { affiliateId };

    // Add status filter if provided
    if (status && status !== 'all') {
      query.status = status;
    }

    // Add date filter if provided
    if (date) {
      const now = new Date();
      let startDate, endDate;

      switch (date) {
      case 'today':
        startDate = new Date(now.setHours(0, 0, 0, 0));
        endDate = new Date(now.setHours(23, 59, 59, 999));
        break;
      case 'tomorrow':
        startDate = new Date(now.setHours(0, 0, 0, 0));
        startDate.setDate(startDate.getDate() + 1);
        endDate = new Date(startDate);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'week':
        startDate = new Date(now.setHours(0, 0, 0, 0));
        endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 7);
        break;
      case 'month':
        startDate = new Date(now.setHours(0, 0, 0, 0));
        endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + 1);
        break;
      }

      if (startDate && endDate) {
        query.pickupDate = { $gte: startDate, $lte: endDate };
      }
    }

    // Add search if provided
    if (search) {
      const escapedSearch = escapeRegex(search);
      query.$or = [
        { orderId: { $regex: escapedSearch, $options: 'i' } },
        { customerId: { $regex: escapedSearch, $options: 'i' } }
      ];
    }

    // Get total count for pagination
    const totalOrders = await Order.countDocuments(query);

    // Get paginated orders
    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    // Get customer details for each order
    const customerIds = [...new Set(orders.map(order => order.customerId))];
    const customers = await Customer.find({ customerId: { $in: customerIds } });

    // Map customers to a dictionary for quick lookup
    const customerMap = {};
    customers.forEach(customer => {
      customerMap[customer.customerId] = customer;
    });

    // Prepare response data
    const ordersData = orders.map(order => {
      const customer = customerMap[order.customerId];

      return {
        orderId: order.orderId,
        customerId: order.customerId,
        customer: customer ? {
          name: `${customer.firstName} ${customer.lastName}`,
          phone: customer.phone,
          address: `${customer.address}, ${customer.city}, ${customer.state} ${customer.zipCode}`
        } : null,
        pickupDate: order.pickupDate,
        pickupTime: order.pickupTime,
        deliveryDate: order.deliveryDate,
        deliveryTime: order.deliveryTime,
        status: order.status,
        estimatedSize: order.estimatedSize,
        actualWeight: order.actualWeight,
        estimatedTotal: order.estimatedTotal,
        actualTotal: order.actualTotal,
        createdAt: order.createdAt
      };
    });

    // Calculate total earnings from delivered orders
    const totalEarnings = orders.reduce((sum, order) => {
      if (order.status === 'complete' && order.affiliateCommission) {
        return sum + order.affiliateCommission;
      }
      return sum;
    }, 0);

    res.status(200).json({
      success: true,
      orders: ordersData,
      totalItems: totalOrders,
      totalEarnings: parseFloat(totalEarnings.toFixed(2)),
      pagination: {
        total: totalOrders,
        page,
        limit,
        pages: Math.ceil(totalOrders / limit)
      }
    });
  } catch (error) {
    console.error('Get affiliate orders error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while retrieving orders'
    });
  }
};

/**
 * Get affiliate transactions
 */
exports.getAffiliateTransactions = async (req, res) => {
  try {
    const { affiliateId } = req.params;
    const { status, page = 1, limit = 10 } = req.query;

    // Check authorization (admin or self)
    if (req.user.role !== 'admin' && req.user.affiliateId !== affiliateId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    // Build query
    const query = { affiliateId };

    // Add status filter if provided
    if (status && status !== 'all') {
      query.status = status;
    }

    // Get total count for pagination
    const totalTransactions = await Transaction.countDocuments(query);

    // Get paginated transactions
    const transactions = await Transaction.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    // Calculate summary
    const allTransactions = await Transaction.find({ affiliateId });
    const summary = {
      totalEarnings: 0,
      totalPayouts: 0,
      pendingAmount: 0
    };

    allTransactions.forEach(transaction => {
      if (transaction.type === 'commission') {
        summary.totalEarnings += transaction.amount;
        if (transaction.status === 'pending') {
          summary.pendingAmount += transaction.amount;
        }
      } else if (transaction.type === 'payout' && transaction.status === 'completed') {
        summary.totalPayouts += Math.abs(transaction.amount);
      }
    });

    res.status(200).json({
      success: true,
      transactions,
      summary: {
        totalEarnings: parseFloat(summary.totalEarnings.toFixed(2)),
        totalPayouts: parseFloat(summary.totalPayouts.toFixed(2)),
        pendingAmount: parseFloat(summary.pendingAmount.toFixed(2))
      },
      pagination: {
        total: totalTransactions,
        page,
        limit,
        pages: Math.ceil(totalTransactions / limit)
      }
    });
  } catch (error) {
    console.error('Get affiliate transactions error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while retrieving transactions'
    });
  }
};

/**
 * Get affiliate dashboard stats
 */
exports.getAffiliateDashboardStats = async (req, res) => {
  try {
    const { affiliateId } = req.params;

    // Check authorization (admin or self)
    if (req.user.role !== 'admin' && req.user.affiliateId !== affiliateId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    // Get customer count
    const customerCount = await Customer.countDocuments({ affiliateId });

    // Get active orders count
    const activeOrderCount = await Order.countDocuments({
      affiliateId,
      status: { $in: ['scheduled', 'picked_up', 'processing', 'ready_for_delivery'] }
    });

    // Get total earnings
    const deliveredOrders = await Order.find({
      affiliateId,
      status: 'complete'
    });

    let totalEarnings = 0;
    deliveredOrders.forEach(order => {
      totalEarnings += order.affiliateCommission || 0;
    });

    // Get earnings for this month
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const monthOrders = deliveredOrders.filter(order =>
      order.deliveredAt && order.deliveredAt >= firstDayOfMonth
    );

    let monthEarnings = 0;
    monthOrders.forEach(order => {
      monthEarnings += order.affiliateCommission || 0;
    });

    // Get earnings for this week
    const firstDayOfWeek = new Date(now);
    firstDayOfWeek.setDate(now.getDate() - now.getDay());
    firstDayOfWeek.setHours(0, 0, 0, 0);

    const weekOrders = deliveredOrders.filter(order =>
      order.deliveredAt && order.deliveredAt >= firstDayOfWeek
    );

    let weekEarnings = 0;
    weekOrders.forEach(order => {
      weekEarnings += order.affiliateCommission || 0;
    });

    // Get pending payments
    const pendingTransactions = await Transaction.find({
      affiliateId,
      status: { $in: ['pending', 'processing'] }
    });

    let pendingEarnings = 0;
    pendingTransactions.forEach(transaction => {
      pendingEarnings += transaction.amount;
    });

    // Calculate next payout date (typically weekly on Fridays)
    const nextPayoutDate = new Date();
    nextPayoutDate.setDate(nextPayoutDate.getDate() + ((5 - nextPayoutDate.getDay() + 7) % 7));

    res.status(200).json({
      success: true,
      stats: {
        customerCount,
        activeOrderCount,
        totalEarnings,
        monthEarnings,
        weekEarnings,
        pendingEarnings,
        monthlyOrders: monthOrders.length,
        weeklyOrders: weekOrders.length,
        nextPayoutDate
      }
    });
  } catch (error) {
    console.error('Get affiliate dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while retrieving dashboard statistics'
    });
  }
};


/**
 * Delete all data for an affiliate (development/test only)
 */
exports.deleteAffiliateData = async (req, res) => {
  try {
    // Only allow if feature is enabled
    if (process.env.ENABLE_DELETE_DATA_FEATURE !== 'true') {
      return res.status(403).json({
        success: false,
        message: 'This operation is not allowed'
      });
    }

    const { affiliateId } = req.params;
    const loggedInAffiliateId = req.user.affiliateId;

    // Verify the logged-in user is deleting their own data
    if (affiliateId !== loggedInAffiliateId) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own data'
      });
    }

    // Verify the affiliate exists
    const affiliate = await Affiliate.findOne({ affiliateId });
    if (!affiliate) {
      return res.status(404).json({
        success: false,
        message: 'Affiliate not found'
      });
    }

    // Find all customers associated with this affiliate
    const customers = await Customer.find({ affiliateId });
    const customerIds = customers.map(c => c.customerId);
    const customerObjectIds = customers.map(c => c._id);

    // Delete all related data
    // 1. Delete all orders for these customers
    await Order.deleteMany({
      $or: [
        { affiliateId },
        { customerId: { $in: customerIds } }
      ]
    });

    // 2. Delete all transactions for this affiliate
    await Transaction.deleteMany({ affiliateId });

    // 3. Delete all customers
    await Customer.deleteMany({ affiliateId });

    // 4. Delete the affiliate
    await Affiliate.deleteOne({ affiliateId });

    res.status(200).json({
      success: true,
      message: 'All data has been deleted successfully',
      deletedData: {
        affiliate: 1,
        customers: customers.length,
        orders: 'All related orders deleted',
        transactions: 'All transactions deleted'
      }
    });
  } catch (error) {
    console.error('Delete affiliate data error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while deleting data'
    });
  }
};

/**
 * Get public affiliate information by affiliate code
 * No authentication required - for customer landing pages
 */
exports.getPublicAffiliateInfo = async (req, res) => {
  try {
    const { affiliateCode } = req.params;

    // Find affiliate by code
    const affiliate = await Affiliate.findOne({ affiliateId: affiliateCode })
      .select('firstName lastName businessName minimumDeliveryFee perBagDeliveryFee serviceLatitude serviceLongitude serviceRadius city state');

    if (!affiliate) {
      return res.status(404).json({
        success: false,
        message: 'Affiliate not found'
      });
    }

    // Return public information only
    res.status(200).json({
      success: true,
      firstName: affiliate.firstName,
      lastName: affiliate.lastName,
      businessName: affiliate.businessName,
      minimumDeliveryFee: affiliate.minimumDeliveryFee,
      perBagDeliveryFee: affiliate.perBagDeliveryFee,
      serviceLatitude: affiliate.serviceLatitude,
      serviceLongitude: affiliate.serviceLongitude,
      serviceRadius: affiliate.serviceRadius,
      city: affiliate.city,
      state: affiliate.state
    });
  } catch (error) {
    console.error('Get public affiliate info error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while retrieving affiliate information'
    });
  }
};

// Get public affiliate info by ID (for customer success page)
exports.getPublicAffiliateInfoById = async (req, res) => {
  try {
    const { affiliateId } = req.params;

    // Find affiliate by ID
    const affiliate = await Affiliate.findOne({ affiliateId: affiliateId })
      .select('firstName lastName businessName minimumDeliveryFee perBagDeliveryFee serviceLatitude serviceLongitude serviceRadius city state');

    if (!affiliate) {
      return res.status(404).json({
        success: false,
        message: 'Affiliate not found'
      });
    }

    // Calculate delivery fee (use perBagDeliveryFee if set, otherwise minimumDeliveryFee)
    const deliveryFee = affiliate.perBagDeliveryFee || affiliate.minimumDeliveryFee || 0;

    // Return public information formatted for the success page
    res.status(200).json({
      success: true,
      affiliate: {
        firstName: affiliate.firstName,
        lastName: affiliate.lastName,
        businessName: affiliate.businessName,
        deliveryFee: deliveryFee,
        minimumDeliveryFee: affiliate.minimumDeliveryFee,
        perBagDeliveryFee: affiliate.perBagDeliveryFee,
        serviceArea: `${affiliate.city}, ${affiliate.state}`,
        serviceRadius: affiliate.serviceRadius
      }
    });
  } catch (error) {
    console.error('Get public affiliate info by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while retrieving affiliate information'
    });
  }
};

module.exports = exports;