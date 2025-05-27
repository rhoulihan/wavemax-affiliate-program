// WaveMAX Laundry Affiliate Program
// API Controllers for handling all API endpoints

const Affiliate = require('../models/Affiliate');
const Customer = require('../models/Customer');
const Order = require('../models/Order');
const Bag = require('../models/Bag');
const encryptionUtil = require('../utils/encryption');
const emailService = require('../utils/emailService');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { getFilteredData } = require('../utils/fieldFilter');

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
      specialInstructions,
      username,
      passwordSalt: salt,
      passwordHash: hash,
      cardholderName: savePaymentInfo ? cardholderName : null,
      // Only store last 4 digits of card
      lastFourDigits: cardNumber && savePaymentInfo ? cardNumber.slice(-4) : null,
      expiryDate: savePaymentInfo ? expiryDate : null,
      billingZip: savePaymentInfo ? billingZip : null,
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

    // Send welcome emails
    try {
      await emailService.sendCustomerWelcomeEmail(newCustomer, bagBarcode, affiliate);
      await emailService.sendAffiliateNewCustomerEmail(affiliate, newCustomer, bagBarcode);
      // Email sent successfully - no need to check result
    } catch (emailError) {
      console.warn('Welcome email(s) could not be sent:', emailError);
      // Continue with registration process even if email fails
    }

    res.status(201).json({
      success: true,
      customerId: newCustomer.customerId,
      bagBarcode: bagBarcode,
      customerData: {
        firstName: newCustomer.firstName,
        lastName: newCustomer.lastName,
        email: newCustomer.email,
        affiliateId: newCustomer.affiliateId,
        affiliateName: affiliate.businessName || `${affiliate.firstName} ${affiliate.lastName}`,
        deliveryFee: affiliate.deliveryFee
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

    // Get customer's bag information
    const bags = await Bag.find({ customerId });

    // Determine user role and if viewing own profile
    const userRole = req.user ? req.user.role : 'public';
    const isSelf = req.user && (req.user.customerId === customerId || req.user.role === 'admin');

    // Filter customer data based on role
    const filteredCustomer = getFilteredData('customer', customer.toObject(), userRole, { isSelf });

    // Add affiliate info if authorized
    if (userRole === 'admin' || userRole === 'affiliate' || isSelf) {
      filteredCustomer.affiliate = affiliate ? getFilteredData('affiliate', affiliate.toObject(), 'public') : null;
    }

    // Add bag details based on role
    if (userRole === 'admin' || userRole === 'affiliate' || isSelf) {
      filteredCustomer.bagDetails = getFilteredData('bag', bags.map(b => b.toObject()), userRole);
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
      'firstName', 'lastName', 'email', 'phone', 'address', 'city', 'state', 'zipCode',
      'deliveryInstructions', 'serviceFrequency', 'specialInstructions', 'cardholderName'
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

    // No need to update customer record as bags are managed separately

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

module.exports = exports;