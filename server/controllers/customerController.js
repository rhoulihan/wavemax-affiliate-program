// WaveMAX Laundry Affiliate Program
// API Controllers for handling all API endpoints

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

// ============================================================================
// Customer Controllers
// ============================================================================

/**
 * Register a new customer
 */
exports.registerCustomer = async (req, res) => {
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
      languagePreference
    } = req.body;

    // Verify affiliate exists
    const affiliate = await Affiliate.findOne({ affiliateId });

    if (!affiliate) {
      return res.status(400).json({
        success: false,
        message: 'Invalid affiliate ID'
      });
    }

    // Check if email or username already exists
    const existingCustomer = await Customer.findOne({
      $or: [{ email }, { username }]
    });

    if (existingCustomer) {
      return res.status(400).json({
        success: false,
        message: 'Email or username already in use'
      });
    }

    // Hash password
    const { salt, hash } = encryptionUtil.hashPassword(password);

    // Get bag fee from system config
    const bagFee = await SystemConfig.getValue('laundry_bag_fee', 10.00);
    const bagCount = parseInt(numberOfBags) || 1;
    const totalBagCredit = bagFee * bagCount;

    // Create new customer with bag information
    console.log('Creating new customer with email:', email, 'username:', username);
    const newCustomer = new Customer({
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
      passwordSalt: salt,
      passwordHash: hash,
      cardholderName: savePaymentInfo ? cardholderName : null,
      // Only store last 4 digits of card
      lastFourDigits: cardNumber && savePaymentInfo ? cardNumber.slice(-4) : null,
      expiryDate: savePaymentInfo ? expiryDate : null,
      billingZip: savePaymentInfo ? billingZip : null,
      savePaymentInfo: !!savePaymentInfo,
      // Bag information
      numberOfBags: bagCount,
      bagCredit: totalBagCredit,
      bagCreditApplied: false,
      languagePreference: languagePreference || 'en',
      // Set isActive to false for new customers (will be set to true on first order)
      isActive: false
    });

    console.log('Saving customer to database...');
    await newCustomer.save();
    console.log('Customer saved successfully with ID:', newCustomer.customerId);

    // Send welcome emails with bag information
    try {
      await emailService.sendCustomerWelcomeEmail(newCustomer, affiliate, {
        numberOfBags: bagCount,
        bagFee: bagFee,
        totalCredit: totalBagCredit
      });
      await emailService.sendAffiliateNewCustomerEmail(affiliate, newCustomer, {
        numberOfBags: bagCount
      });
      // Email sent successfully - no need to check result
    } catch (emailError) {
      console.warn('Welcome email(s) could not be sent:', emailError);
      // Continue with registration process even if email fails
    }

    res.status(201).json({
      success: true,
      customerId: newCustomer.customerId,
      customerData: {
        firstName: newCustomer.firstName,
        lastName: newCustomer.lastName,
        email: newCustomer.email,
        affiliateId: newCustomer.affiliateId,
        affiliateName: affiliate.businessName || `${affiliate.firstName} ${affiliate.lastName}`,
        minimumDeliveryFee: affiliate.minimumDeliveryFee,
        perBagDeliveryFee: affiliate.perBagDeliveryFee
      },
      message: 'Customer registered successfully!'
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
 * Get customer profile
 */
exports.getCustomerProfile = async (req, res) => {
  try {
    const { customerId } = req.params;

    // Verify customer exists
    const customer = await Customer.findOne({ customerId });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    // Check authorization (admin, affiliate, or self) - skip for public profile endpoint
    if (req.user) {
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
    }

    // Get affiliate details
    const affiliate = await Affiliate.findOne({ affiliateId: customer.affiliateId });

    // Determine user role and if viewing own profile
    const userRole = req.user ? req.user.role : 'public';
    const isSelf = req.user && (req.user.customerId === customerId || req.user.role === 'admin');

    // Filter customer data based on role
    const filteredCustomer = getFilteredData('customer', customer.toObject(), userRole, { isSelf });

    // Add affiliate info if authorized
    if (userRole === 'admin' || userRole === 'affiliate' || isSelf) {
      filteredCustomer.affiliate = affiliate ? getFilteredData('affiliate', affiliate.toObject(), 'public') : null;
    }

    res.status(200).json({
      success: true,
      customer: filteredCustomer
    });
  } catch (error) {
    console.error('Get customer profile error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while retrieving customer profile'
    });
  }
};

/**
 * Update customer profile
 */
exports.updateCustomerProfile = async (req, res) => {
  try {
    const { customerId } = req.params;
    const updates = req.body;

    // Verify customer exists
    const customer = await Customer.findOne({ customerId });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    // Check authorization (admin, affiliate, or self)
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

    // Fields that can be updated
    const updatableFields = [
      'firstName', 'lastName', 'phone', 'address', 'city', 'state', 'zipCode',
      'serviceFrequency', 'specialInstructions', 'affiliateSpecialInstructions', 'cardholderName'
    ];

    // Update fields
    updatableFields.forEach(field => {
      if (updates[field] !== undefined) {
        customer[field] = updates[field];
      }
    });


    // Handle password change if provided
    if (updates.currentPassword && updates.newPassword) {
      // Verify current password
      const isPasswordValid = encryptionUtil.verifyPassword(
        updates.currentPassword,
        customer.passwordSalt,
        customer.passwordHash
      );

      if (!isPasswordValid) {
        return res.status(400).json({
          success: false,
          message: 'Current password is incorrect'
        });
      }

      // Update password
      const { salt, hash } = encryptionUtil.hashPassword(updates.newPassword);
      customer.passwordSalt = salt;
      customer.passwordHash = hash;
    }

    await customer.save();

    res.status(200).json({
      success: true,
      message: 'Customer profile updated successfully!'
    });
  } catch (error) {
    console.error('Update customer profile error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while updating customer profile'
    });
  }
};

/**
 * Get customer orders
 */
exports.getCustomerOrders = async (req, res) => {
  try {
    const { customerId } = req.params;
    const { status, page = 1, limit = 10 } = req.query;

    // Verify customer exists
    const customer = await Customer.findOne({ customerId });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    // Check authorization (admin, affiliate, or self)
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

    // Build query
    const query = { customerId };

    // Add status filter if provided
    if (status && status !== 'all') {
      if (status === 'active') {
        query.status = { $in: ['scheduled', 'picked_up', 'processing', 'ready_for_delivery'] };
      } else if (status === 'completed') {
        query.status = 'complete';
      } else if (status === 'cancelled') {
        query.status = 'cancelled';
      } else {
        query.status = status;
      }
    }

    // Get total count for pagination
    const totalOrders = await Order.countDocuments(query);

    // Get paginated orders
    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    // Determine user role
    const userRole = req.user ? req.user.role : 'public';

    // Filter orders based on role
    const filteredOrders = getFilteredData('order', orders.map(o => o.toObject()), userRole);

    res.status(200).json({
      success: true,
      orders: filteredOrders,
      pagination: {
        total: totalOrders,
        page: parseInt(page),
        currentPage: parseInt(page),
        limit: parseInt(limit),
        perPage: parseInt(limit),
        pages: Math.ceil(totalOrders / limit)
      }
    });
  } catch (error) {
    console.error('Get customer orders error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while retrieving orders'
    });
  }
};

/**
 * Get customer dashboard stats
 */
exports.getCustomerDashboardStats = async (req, res) => {
  try {
    const { customerId } = req.params;

    // Verify customer exists
    const customer = await Customer.findOne({ customerId });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    // Check authorization (admin, affiliate, or self)
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

    // Get all orders for statistics
    const allOrders = await Order.find({ customerId }).sort({ createdAt: -1 });

    // Get active orders (anything not complete or cancelled)
    const activeOrders = allOrders.filter(order =>
      ['pending', 'processing', 'processed'].includes(order.status)
    );

    // Get completed orders
    const completedOrders = allOrders.filter(order => order.status === 'complete');

    // Calculate statistics
    const totalOrders = allOrders.length;
    const activeOrdersCount = activeOrders.length;
    const completedOrdersCount = completedOrders.length;

    // Calculate total spent and average order value
    let totalSpent = 0;
    completedOrders.forEach(order => {
      totalSpent += order.actualTotal || order.estimatedTotal || 0;
    });

    const averageOrderValue = completedOrdersCount > 0 ? totalSpent / completedOrdersCount : 0;

    // Get recent orders (limit to 5)
    const recentOrders = allOrders.slice(0, 5).map(order => ({
      orderId: order.orderId,
      status: order.status,
      pickupDate: order.pickupDate,
      deliveryDate: order.deliveryDate,
      estimatedTotal: order.estimatedTotal,
      actualTotal: order.actualTotal,
      createdAt: order.createdAt
    }));

    // Get upcoming pickups
    const upcomingPickups = await Order.find({
      customerId,
      status: 'scheduled',
      pickupDate: { $gte: new Date() }
    }).sort({ pickupDate: 1 }).limit(5);

    // Get affiliate info
    const affiliate = await Affiliate.findOne({ affiliateId: customer.affiliateId });

    // Get last order date
    const lastOrder = completedOrders.length > 0 ? completedOrders[0] : null;
    const lastOrderDate = lastOrder ? lastOrder.deliveredAt || lastOrder.updatedAt : null;

    res.status(200).json({
      success: true,
      dashboard: {
        statistics: {
          totalOrders,
          completedOrders: completedOrdersCount,
          activeOrders: activeOrdersCount,
          totalSpent,
          averageOrderValue,
          ...(lastOrderDate && { lastOrderDate })
        },
        recentOrders,
        upcomingPickups: upcomingPickups.map(pickup => ({
          orderId: pickup.orderId,
          pickupDate: pickup.pickupDate,
          pickupTime: pickup.pickupTime,
          estimatedSize: pickup.estimatedSize,
          estimatedTotal: pickup.estimatedTotal
        })),
        affiliate: affiliate ? {
          affiliateId: affiliate.affiliateId,
          firstName: affiliate.firstName,
          lastName: affiliate.lastName,
          minimumDeliveryFee: affiliate.minimumDeliveryFee,
          perBagDeliveryFee: affiliate.perBagDeliveryFee
        } : null,
        bagCredit: {
          amount: customer.bagCredit || 0,
          applied: customer.bagCreditApplied || false,
          numberOfBags: customer.numberOfBags || 0
        },
        wdfCredit: {
          amount: customer.wdfCredit || 0,
          updatedAt: customer.wdfCreditUpdatedAt || null,
          fromOrderId: customer.wdfCreditFromOrderId || null
        }
      }
    });
  } catch (error) {
    console.error('Get customer dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while retrieving dashboard statistics'
    });
  }
};


/**
 * Update customer payment information
 */
exports.updatePaymentInfo = async (req, res) => {
  try {
    const { customerId } = req.params;
    const { cardholderName, cardNumber, expiryDate, billingZip } = req.body;

    // Verify customer exists
    const customer = await Customer.findOne({ customerId });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    // Check authorization (only self or admin)
    const isAuthorized =
      req.user.role === 'admin' ||
      req.user.customerId === customerId;

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    // Update payment information
    customer.cardholderName = cardholderName;
    customer.lastFourDigits = cardNumber.slice(-4);
    customer.expiryDate = expiryDate;
    customer.billingZip = billingZip;
    customer.savePaymentInfo = true;

    await customer.save();

    res.status(200).json({
      success: true,
      message: 'Payment information updated successfully',
      lastFourDigits: customer.lastFourDigits
    });
  } catch (error) {
    console.error('Update payment info error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while updating payment information'
    });
  }
};

/**
 * Delete all data for a customer (development/test only)
 */
exports.deleteCustomerData = async (req, res) => {
  try {
    // Only allow if feature is enabled
    if (process.env.ENABLE_DELETE_DATA_FEATURE !== 'true') {
      return res.status(403).json({
        success: false,
        message: 'This operation is not allowed'
      });
    }

    const { customerId } = req.params;
    const loggedInCustomerId = req.user.customerId;

    // Verify the logged-in user is deleting their own data
    if (customerId !== loggedInCustomerId) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own data'
      });
    }

    // Verify the customer exists
    const customer = await Customer.findOne({ customerId });
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    // Delete all related data
    // 1. Delete all orders for this customer
    const deletedOrders = await Order.deleteMany({ customerId });


    // 3. Delete the customer
    await Customer.deleteOne({ customerId });

    res.status(200).json({
      success: true,
      message: 'All data has been deleted successfully',
      deletedData: {
        customer: 1,
        orders: deletedOrders.deletedCount || 0
      }
    });
  } catch (error) {
    console.error('Delete customer data error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while deleting data'
    });
  }
};

/**
 * Update customer password
 */
exports.updateCustomerPassword = async (req, res) => {
  try {
    const { customerId } = req.params;
    const { currentPassword, newPassword } = req.body;

    // Verify customer exists
    const customer = await Customer.findOne({ customerId });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    // Check authorization (only self or admin)
    const isAuthorized =
      req.user.role === 'admin' ||
      req.user.customerId === customerId;

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    // Verify current password
    const isPasswordValid = encryptionUtil.verifyPassword(
      currentPassword,
      customer.passwordSalt,
      customer.passwordHash
    );

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Validate new password strength
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 8 characters long'
      });
    }

    // Update password
    const { salt, hash } = encryptionUtil.hashPassword(newPassword);
    customer.passwordSalt = salt;
    customer.passwordHash = hash;

    await customer.save();

    res.status(200).json({
      success: true,
      message: 'Password updated successfully'
    });
  } catch (error) {
    console.error('Update customer password error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while updating password'
    });
  }
};

/**
 * Get customers list for admin dashboard
 * @access Admin only
 */
exports.getCustomersForAdmin = async (req, res) => {
  try {
    // Build query
    const query = {};
    
    // Search filter
    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search, 'i');
      query.$or = [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { email: searchRegex },
        { phone: searchRegex },
        { customerId: searchRegex }
      ];
    }
    
    // Affiliate filter
    if (req.query.affiliateId && req.query.affiliateId !== 'all') {
      query.affiliateId = req.query.affiliateId;
    }
    
    // Status filter
    if (req.query.status && req.query.status !== 'all') {
      if (req.query.status === 'active') {
        query.isActive = true;
      } else if (req.query.status === 'inactive') {
        query.isActive = false;
      } else if (req.query.status === 'new') {
        // We'll handle this after the initial query
      }
    }
    
    // Get customers
    let customers = await Customer.find(query)
      .select('-passwordHash -passwordSalt -__v')
      .sort({ createdAt: -1 })
      .limit(500);
    
    // Get unique affiliate IDs from customers
    const affiliateIds = [...new Set(customers.map(c => c.affiliateId))];
    
    // Fetch all affiliates for these customers
    const affiliates = await Affiliate.find({ affiliateId: { $in: affiliateIds } })
      .select('affiliateId businessName firstName lastName');
    
    // Create a map of affiliates
    const affiliateMap = {};
    affiliates.forEach(aff => {
      affiliateMap[aff.affiliateId] = aff;
    });
    
    // Get order counts for each customer
    const customerIds = customers.map(c => c.customerId);
    const orderCounts = await Order.aggregate([
      { $match: { customerId: { $in: customerIds } } },
      { $group: { _id: '$customerId', count: { $sum: 1 } } }
    ]);
    
    // Create a map of order counts
    const orderCountMap = {};
    orderCounts.forEach(oc => {
      orderCountMap[oc._id] = oc.count;
    });
    
    // Add order counts and affiliate info to customers
    customers = customers.map(customer => {
      const customerObj = customer.toObject();
      customerObj.orderCount = orderCountMap[customer.customerId] || 0;
      // Add affiliate information
      customerObj.affiliate = affiliateMap[customer.affiliateId] || null;
      return customerObj;
    });
    
    // Filter for new customers if requested
    if (req.query.status === 'new') {
      customers = customers.filter(c => c.orderCount === 0);
    }
    
    res.status(200).json({
      success: true,
      customers,
      total: customers.length
    });
  } catch (error) {
    console.error('Get customers for admin error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve customers'
    });
  }
};



module.exports = exports;