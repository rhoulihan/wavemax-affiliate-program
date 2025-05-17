// WaveMAX Laundry Affiliate Program
// API Controllers for handling all API endpoints

const Affiliate = require('../models/Affiliate');
const Customer = require('../models/Customer');
const Order = require('../models/Order');
const Bag = require('../models/Bag');
const Transaction = require('../models/Transaction');
const encryptionUtil = require('../utils/encryption');
const emailService = require('../utils/emailService');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

// ============================================================================
// Customer Controllers
// ============================================================================

/**
 * Register a new customer
 */
exports.registerCustomer = async (req, res) => {
  try {
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
      deliveryInstructions,
      serviceFrequency,
      preferredDay,
      preferredTime,
      specialInstructions,
      username,
      password,
      cardholderName,
      cardNumber,
      expiryDate,
      cvv,
      billingZip,
      savePaymentInfo
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
    
    // Create new customer
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
      deliveryInstructions,
      serviceFrequency,
      preferredDay: serviceFrequency !== 'onDemand' ? preferredDay : null,
      preferredTime: serviceFrequency !== 'onDemand' ? preferredTime : null,
      specialInstructions,
      username,
      passwordSalt: salt,
      passwordHash: hash,
      cardholderName,
      // Only store last 4 digits of card
      lastFourDigits: cardNumber.slice(-4),
      expiryDate,
      billingZip,
      savePaymentInfo: !!savePaymentInfo
    });
    
    await newCustomer.save();
    
    // Generate a unique bag barcode
    const bagBarcode = 'WM-' + uuidv4().substring(0, 8).toUpperCase();
    
    // Create a new bag and assign to customer
    const newBag = new Bag({
      barcode: bagBarcode,
      customerId: newCustomer.customerId,
      affiliateId,
      status: 'assigned',
      issueDate: new Date()
    });
    
    await newBag.save();
    
    // Update customer with bag info
    newCustomer.bags.push({
      bagId: newBag.bagId,
      barcode: bagBarcode,
      issuedDate: new Date(),
      isActive: true
    });
    
    await newCustomer.save();
    
    // Send welcome emails
    await emailService.sendCustomerWelcomeEmail(newCustomer, bagBarcode, affiliate);
    await emailService.sendAffiliateNewCustomerEmail(affiliate, newCustomer, bagBarcode);
    
    res.status(201).json({
      success: true,
      customerId: newCustomer.customerId,
      bagBarcode,
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
    
    // Get affiliate details
    const affiliate = await Affiliate.findOne({ affiliateId: customer.affiliateId });
    
    // Get customer's bag information
    const bags = await Bag.find({ customerId });
    
    // Return customer data (excluding sensitive info)
    res.status(200).json({
      success: true,
      customer: {
        customerId: customer.customerId,
        firstName: customer.firstName,
        lastName: customer.lastName,
        email: customer.email,
        phone: customer.phone,
        address: customer.address,
        city: customer.city,
        state: customer.state,
        zipCode: customer.zipCode,
        deliveryInstructions: customer.deliveryInstructions,
        serviceFrequency: customer.serviceFrequency,
        preferredDay: customer.preferredDay,
        preferredTime: customer.preferredTime,
        specialInstructions: customer.specialInstructions,
        lastFourDigits: customer.lastFourDigits,
        savePaymentInfo: customer.savePaymentInfo,
        isActive: customer.isActive,
        registrationDate: customer.registrationDate,
        lastLogin: customer.lastLogin,
        bags: customer.bags,
        affiliate: affiliate ? {
          affiliateId: affiliate.affiliateId,
          name: `${affiliate.firstName} ${affiliate.lastName}`,
          phone: affiliate.phone,
          email: affiliate.email,
          deliveryFee: affiliate.deliveryFee
        } : null,
        bagDetails: bags.map(bag => ({
          bagId: bag.bagId,
          barcode: bag.barcode,
          status: bag.status,
          issueDate: bag.issueDate,
          lastUsedDate: bag.lastUsedDate
        }))
      }
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
      'deliveryInstructions', 'serviceFrequency', 'preferredDay', 'preferredTime',
      'specialInstructions', 'cardholderName'
    ];
    
    // Update fields
    updatableFields.forEach(field => {
      if (updates[field] !== undefined) {
        customer[field] = updates[field];
      }
    });
    
    // Handle special case for service frequency
    if (updates.serviceFrequency === 'onDemand') {
      customer.preferredDay = null;
      customer.preferredTime = null;
    }
    
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
      message: 'Customer profile updated successfully'
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
        query.status = 'delivered';
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
    
    // Prepare response data
    const ordersData = orders.map(order => ({
      orderId: order.orderId,
      pickupDate: order.pickupDate,
      pickupTime: order.pickupTime,
      deliveryDate: order.deliveryDate,
      deliveryTime: order.deliveryTime,
      status: order.status,
      estimatedSize: order.estimatedSize,
      actualWeight: order.actualWeight,
      estimatedTotal: order.estimatedTotal,
      actualTotal: order.actualTotal,
      createdAt: order.createdAt,
      pickedUpAt: order.pickedUpAt,
      deliveredAt: order.deliveredAt
    }));
    
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
    
    // Get active orders count
    const activeOrdersCount = await Order.countDocuments({
      customerId,
      status: { $in: ['scheduled', 'picked_up', 'processing', 'ready_for_delivery'] }
    });
    
    // Get completed orders
    const completedOrders = await Order.find({
      customerId,
      status: 'delivered'
    });
    
    const completedOrdersCount = completedOrders.length;
    
    // Calculate total spent
    let totalSpent = 0;
    completedOrders.forEach(order => {
      totalSpent += order.actualTotal || order.estimatedTotal || 0;
    });
    
    // Get next scheduled pickup
    const nextPickup = await Order.findOne({
      customerId,
      status: 'scheduled',
      pickupDate: { $gte: new Date() }
    }).sort({ pickupDate: 1 });
    
    // Get affiliate info
    const affiliate = await Affiliate.findOne({ affiliateId: customer.affiliateId });
    
    // Get customer's bags
    const bags = await Bag.find({ customerId });
    
    // Calculate average order weight
    let totalWeight = 0;
    let weightedOrders = 0;
    
    completedOrders.forEach(order => {
      if (order.actualWeight) {
        totalWeight += order.actualWeight;
        weightedOrders++;
      }
    });
    
    const averageWeight = weightedOrders > 0 ? totalWeight / weightedOrders : 0;
    
    // Analyze order sizes
    const orderSizes = {
      small: 0,
      medium: 0,
      large: 0
    };
    
    completedOrders.forEach(order => {
      if (order.actualWeight) {
        if (order.actualWeight < 15) {
          orderSizes.small++;
        } else if (order.actualWeight < 30) {
          orderSizes.medium++;
        } else {
          orderSizes.large++;
        }
      } else if (order.estimatedSize) {
        orderSizes[order.estimatedSize]++;
      }
    });
    
    res.status(200).json({
      success: true,
      stats: {
        activeOrdersCount,
        completedOrdersCount,
        totalSpent,
        averageWeight,
        orderSizes,
        nextPickup: nextPickup ? {
          orderId: nextPickup.orderId,
          pickupDate: nextPickup.pickupDate,
          pickupTime: nextPickup.pickupTime,
          estimatedSize: nextPickup.estimatedSize,
          estimatedTotal: nextPickup.estimatedTotal
        } : null,
        affiliate: affiliate ? {
          name: `${affiliate.firstName} ${affiliate.lastName}`,
          phone: affiliate.phone,
          email: affiliate.email,
          deliveryFee: affiliate.deliveryFee
        } : null,
        bagCount: bags.length
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
 * Report a lost bag
 */
exports.reportLostBag = async (req, res) => {
  try {
    const { customerId, bagId } = req.params;
    
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
    
    // Find the bag
    const bag = await Bag.findOne({ bagId, customerId });
    
    if (!bag) {
      return res.status(404).json({
        success: false,
        message: 'Bag not found'
      });
    }
    
    // Update bag status
    bag.status = 'lost';
    await bag.save();
    
    // Update customer's bag record
    const bagIndex = customer.bags.findIndex(b => b.bagId === bagId);
    if (bagIndex !== -1) {
      customer.bags[bagIndex].isActive = false;
      await customer.save();
    }
    
    // Notify affiliate
    const affiliate = await Affiliate.findOne({ affiliateId: customer.affiliateId });
    if (affiliate) {
      await emailService.sendAffiliateLostBagEmail(
        affiliate,
        customer,
        bag.barcode
      );
    }
    
    res.status(200).json({
      success: true,
      message: 'Bag reported as lost successfully'
    });
  } catch (error) {
    console.error('Report lost bag error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while reporting lost bag'
    });
  }
};

module.exports = exports;