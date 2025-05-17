// Affiliate Controller for WaveMAX Laundry Affiliate Program

const Affiliate = require('../models/Affiliate');
const Customer = require('../models/Customer');
const Order = require('../models/Order');
const Transaction = require('../models/Transaction');
const encryptionUtil = require('../utils/encryption');
const emailService = require('../utils/emailService');

/**
 * Register a new affiliate
 */
exports.registerAffiliate = async (req, res) => {
  try {
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
      serviceArea,
      deliveryFee,
      username,
      password,
      paymentMethod,
      accountNumber,
      routingNumber,
      paypalEmail
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
      serviceArea,
      deliveryFee: parseFloat(deliveryFee),
      username,
      passwordSalt: salt,
      passwordHash: hash,
      paymentMethod
    });
    
    // Add payment information if provided
    if (paymentMethod === 'directDeposit' && accountNumber && routingNumber) {
      newAffiliate.accountNumber = accountNumber;
      newAffiliate.routingNumber = routingNumber;
    } else if (paymentMethod === 'paypal' && paypalEmail) {
      newAffiliate.paypalEmail = paypalEmail;
    }
    
    await newAffiliate.save();
    
    // Send welcome email
    const emailResult = await emailService.sendAffiliateWelcomeEmail(newAffiliate);
    if (!emailResult.success) {
      console.warn('Welcome email could not be sent:', emailResult.error);
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
    
    // Return affiliate data (excluding sensitive info)
    res.status(200).json({
      success: true,
      affiliate: {
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
        serviceArea: affiliate.serviceArea,
        deliveryFee: affiliate.deliveryFee,
        paymentMethod: affiliate.paymentMethod,
        isActive: affiliate.isActive,
        dateRegistered: affiliate.dateRegistered,
        lastLogin: affiliate.lastLogin
      }
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
      'address', 'city', 'state', 'zipCode', 'serviceArea', 
      'deliveryFee', 'paymentMethod'
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
      
      if (updates.paymentMethod === 'directDeposit') {
        if (updates.accountNumber) {
          affiliate.accountNumber = updates.accountNumber;
        }
        if (updates.routingNumber) {
          affiliate.routingNumber = updates.routingNumber;
        }
      } else if (updates.paymentMethod === 'paypal') {
        if (updates.paypalEmail) {
          affiliate.paypalEmail = updates.paypalEmail;
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
      status: 'delivered',
      deliveredAt: { $gte: startDate, $lte: endDate }
    }).sort({ deliveredAt: -1 });
    
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
      orders: orders.map(order => ({
        orderId: order.orderId,
        customerId: order.customerId,
        deliveredAt: order.deliveredAt,
        actualWeight: order.actualWeight,
        actualTotal: order.actualTotal,
        affiliateCommission: order.affiliateCommission
      }))
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
    const { search, sort, page = 1, limit = 10 } = req.query;
    
    // Check authorization (admin or self)
    if (req.user.role !== 'admin' && req.user.affiliateId !== affiliateId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized'
      });
    }
    
    // Build query
    const query = { affiliateId };
    
    // Add search if provided
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { customerId: { $regex: search, $options: 'i' } }
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
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
      
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
      pagination: {
        total: totalCustomers,
        page,
        limit,
        pages: Math.ceil(totalCustomers / limit)
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
      query.$or = [
        { orderId: { $regex: search, $options: 'i' } },
        { customerId: { $regex: search, $options: 'i' } }
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
    
    res.status(200).json({
      success: true,
      orders: ordersData,
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
    
    res.status(200).json({
      success: true,
      transactions,
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
      status: 'delivered'
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

module.exports = exports;