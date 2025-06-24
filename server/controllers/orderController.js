// WaveMAX Laundry Affiliate Program
// API Controllers for handling all API endpoints

const Affiliate = require('../models/Affiliate');
const Customer = require('../models/Customer');
const Order = require('../models/Order');
const SystemConfig = require('../models/SystemConfig');
const encryptionUtil = require('../utils/encryption');
const emailService = require('../utils/emailService');
const jwt = require('jsonwebtoken');

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate delivery fee based on number of bags and affiliate settings
 * @param {Number} numberOfBags - Number of bags for the order
 * @param {Object} affiliate - Affiliate object with fee overrides
 * @returns {Object} Fee calculation breakdown
 */
async function calculateDeliveryFee(numberOfBags, affiliate = null) {
  // Get system defaults
  const systemMinimumFee = await SystemConfig.getValue('delivery_minimum_fee', 10.00);
  const systemPerBagFee = await SystemConfig.getValue('delivery_per_bag_fee', 2.00);

  // Use affiliate overrides if available, otherwise use system defaults
  const minimumFee = affiliate?.minimumDeliveryFee ?? systemMinimumFee;
  const perBagFee = affiliate?.perBagDeliveryFee ?? systemPerBagFee;

  // Calculate fee based on bags
  const calculatedFee = numberOfBags * perBagFee;
  const totalFee = Math.max(minimumFee, calculatedFee);

  return {
    numberOfBags,
    minimumFee,
    perBagFee,
    totalFee,
    minimumApplied: totalFee === minimumFee
  };
}

// ============================================================================
// Order Controllers
// ============================================================================

/**
 * Create a new order
 */
exports.createOrder = async (req, res) => {
  try {
    // Check for validation errors first
    const { validationResult } = require('express-validator');
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Validation errors:', errors.array());
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    console.log('Creating order with data:', req.body);

    const {
      customerId,
      affiliateId,
      pickupDate,
      pickupTime,
      specialPickupInstructions,
      estimatedWeight,
      numberOfBags
    } = req.body;

    // Verify customer exists
    console.log('Looking for customer with ID:', customerId);
    const customer = await Customer.findOne({ customerId });

    if (!customer) {
      console.log('Customer not found with ID:', customerId);
      return res.status(400).json({
        success: false,
        message: 'Invalid customer ID'
      });
    }
    console.log('Found customer:', customer.firstName, customer.lastName);

    // Verify affiliate exists
    console.log('Looking for affiliate with ID:', affiliateId);
    const affiliate = await Affiliate.findOne({ affiliateId });

    if (!affiliate) {
      console.log('Affiliate not found with ID:', affiliateId);
      return res.status(400).json({
        success: false,
        message: 'Invalid affiliate ID'
      });
    }
    console.log('Found affiliate:', affiliate.firstName, affiliate.lastName);

    // Check authorization (admin, affiliate, or customer self)
    const isAuthorized =
      req.user.role === 'admin' ||
      req.user.customerId === customerId ||
      (req.user.role === 'affiliate' && req.user.affiliateId === affiliateId);

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    // Calculate delivery fee based on number of bags
    const bagCount = parseInt(numberOfBags) || 1; // Default to 1 bag if not specified
    const feeCalculation = await calculateDeliveryFee(bagCount, affiliate);

    // Create new order
    const newOrder = new Order({
      customerId,
      affiliateId,
      pickupDate,
      pickupTime,
      specialPickupInstructions,
      estimatedWeight,
      numberOfBags: bagCount,
      feeBreakdown: {
        numberOfBags: feeCalculation.numberOfBags,
        minimumFee: feeCalculation.minimumFee,
        perBagFee: feeCalculation.perBagFee,
        totalFee: feeCalculation.totalFee,
        minimumApplied: feeCalculation.minimumApplied
      },
      status: 'pending'
    });

    await newOrder.save();

    // Update customer isActive to true on first order
    if (!customer.isActive) {
      customer.isActive = true;
      await customer.save();
      console.log('Updated customer isActive status to true for customer:', customer.customerId);
    }

    // Send notification emails (don't let email failures stop the order)
    try {
      await emailService.sendCustomerOrderConfirmationEmail(customer, newOrder, affiliate);
      await emailService.sendAffiliateNewOrderEmail(affiliate, customer, newOrder);
    } catch (emailError) {
      console.error('Failed to send notification emails:', emailError);
      // Continue with the response even if emails fail
    }

    res.status(201).json({
      success: true,
      orderId: newOrder.orderId,
      estimatedTotal: newOrder.estimatedTotal,
      message: 'Pickup scheduled successfully!'
    });
  } catch (error) {
    console.error('Order creation error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while scheduling the pickup'
    });
  }
};

/**
 * Get bags for an order (for label printing)
 */
exports.getOrderBags = async (req, res) => {
  try {
    const { orderId } = req.params;
    
    // Find order
    const order = await Order.findOne({ orderId })
      .populate('customerId', 'firstName lastName')
      .populate('affiliateId', 'businessName');
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }
    
    // Check authorization
    const isAuthorized = 
      req.user.role === 'admin' ||
      req.user.role === 'operator' ||
      (req.user.role === 'affiliate' && req.user.affiliateId === order.affiliateId.affiliateId) ||
      (req.user.role === 'customer' && req.user.customerId === order.customerId.customerId);
    
    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized'
      });
    }
    
    // Get bags for the order
    const Bag = require('../models/Bag');
    const bags = await Bag.find({ orderId }).sort({ bagNumber: 1 });
    
    res.json({
      success: true,
      order: {
        orderId: order.orderId,
        customerName: `${order.customerId.firstName} ${order.customerId.lastName}`,
        affiliateName: order.affiliateId.businessName,
        pickupDate: order.pickupDate,
        numberOfBags: order.numberOfBags,
        status: order.status
      },
      bags: bags.map(bag => ({
        bagId: bag.bagId,
        bagNumber: bag.bagNumber,
        qrCode: bag.qrCode,
        status: bag.status,
        weight: bag.weight
      }))
    });
  } catch (error) {
    console.error('Get order bags error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch order bags'
    });
  }
};

/**
 * Get order details
 */
exports.getOrderDetails = async (req, res) => {
  try {
    const { orderId } = req.params;

    // Find order
    const order = await Order.findOne({ orderId });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Check authorization (admin, associated affiliate, or customer)
    const isAuthorized =
      req.user.role === 'admin' ||
      (req.user.role === 'affiliate' && req.user.affiliateId === order.affiliateId) ||
      (req.user.role === 'customer' && req.user.customerId === order.customerId);

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    // Get customer details
    const customer = await Customer.findOne({ customerId: order.customerId });

    // Get affiliate details
    const affiliate = await Affiliate.findOne({ affiliateId: order.affiliateId });

    res.status(200).json({
      success: true,
      order: {
        orderId: order.orderId,
        customerId: order.customerId,
        customer: customer ? {
          name: `${customer.firstName} ${customer.lastName}`,
          phone: customer.phone,
          email: customer.email,
          address: `${customer.address}, ${customer.city}, ${customer.state} ${customer.zipCode}`,
          bagCredit: customer.bagCredit,
          bagCreditApplied: customer.bagCreditApplied
        } : null,
        affiliateId: order.affiliateId,
        affiliate: affiliate ? {
          name: `${affiliate.firstName} ${affiliate.lastName}`,
          phone: affiliate.phone,
          email: affiliate.email
        } : null,
        pickupDate: order.pickupDate,
        pickupTime: order.pickupTime,
        specialPickupInstructions: order.specialPickupInstructions,
        estimatedWeight: order.estimatedWeight,
        serviceNotes: order.serviceNotes,
        deliveryDate: order.deliveryDate,
        deliveryTime: order.deliveryTime,
        specialDeliveryInstructions: order.specialDeliveryInstructions,
        status: order.status,
        baseRate: order.baseRate,
        feeBreakdown: order.feeBreakdown,
        actualWeight: order.actualWeight,
        washInstructions: order.washInstructions,
        estimatedTotal: order.estimatedTotal,
        actualTotal: order.actualTotal,
        affiliateCommission: order.affiliateCommission,
        paymentStatus: order.paymentStatus,
        createdAt: order.createdAt,
        pickedUpAt: order.pickedUpAt,
        processedAt: order.processedAt,
        readyForDeliveryAt: order.readyForDeliveryAt,
        deliveredAt: order.deliveredAt,
        cancelledAt: order.cancelledAt
      }
    });
  } catch (error) {
    console.error('Get order details error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while retrieving order details'
    });
  }
};

/**
 * Update order status
 */
exports.updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, actualWeight } = req.body;

    // Find order
    const order = await Order.findOne({ orderId });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Check authorization (admin or associated affiliate)
    const isAuthorized =
      req.user.role === 'admin' ||
      (req.user.role === 'affiliate' && req.user.affiliateId === order.affiliateId);

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    // Check for valid status transition
    const validTransitions = {
      pending: ['scheduled', 'cancelled'],
      scheduled: ['processing', 'cancelled'],
      processing: ['processed'],
      processed: ['complete'],
      complete: [],
      cancelled: []
    };

    if (!validTransitions[order.status].includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status transition from ${order.status} to ${status}`
      });
    }

    // Update order status
    order.status = status;

    // Update actual weight when transitioning to processing or processed
    if ((status === 'processing' || status === 'processed') && actualWeight) {
      order.actualWeight = parseFloat(actualWeight);
    }

    await order.save();

    // Find customer and affiliate
    const customer = await Customer.findOne({ customerId: order.customerId });
    const affiliate = await Affiliate.findOne({ affiliateId: order.affiliateId });

    // Send status update email to customer
    if (customer && ['scheduled', 'processing', 'processed', 'complete'].includes(status)) {
      await emailService.sendOrderStatusUpdateEmail(customer, order, status);

      // If order is complete, also notify affiliate of commission
      if (status === 'complete' && affiliate) {
        await emailService.sendAffiliateCommissionEmail(affiliate, order, customer);
      }
    }

    res.status(200).json({
      success: true,
      orderId: order.orderId,
      status: order.status,
      actualWeight: order.actualWeight,
      actualTotal: order.actualTotal,
      affiliateCommission: order.affiliateCommission,
      message: 'Order status updated successfully!'
    });
  } catch (error) {
    console.error('Order status update error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while updating the order status'
    });
  }
};

/**
 * Cancel order
 */
exports.cancelOrder = async (req, res) => {
  try {
    const { orderId } = req.params;

    // Find order
    const order = await Order.findOne({ orderId });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Check if order can be cancelled
    if (!['pending', 'scheduled'].includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: `Orders in ${order.status} status cannot be cancelled`
      });
    }

    // Check authorization (admin, associated affiliate, or customer)
    const isAuthorized =
      req.user.role === 'admin' ||
      (req.user.role === 'affiliate' && req.user.affiliateId === order.affiliateId) ||
      (req.user.role === 'customer' && req.user.customerId === order.customerId);

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    // Update order status
    order.status = 'cancelled';
    order.cancelledAt = new Date();
    await order.save();

    // Find customer and affiliate
    const customer = await Customer.findOne({ customerId: order.customerId });
    const affiliate = await Affiliate.findOne({ affiliateId: order.affiliateId });

    // Send cancellation emails
    if (customer) {
      await emailService.sendOrderCancellationEmail(customer, order);
    }

    if (affiliate) {
      await emailService.sendAffiliateOrderCancellationEmail(affiliate, order, customer);
    }

    res.status(200).json({
      success: true,
      message: 'Order cancelled successfully'
    });
  } catch (error) {
    console.error('Cancel order error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while cancelling the order'
    });
  }
};

/**
 * Bulk update order status
 */
exports.bulkUpdateOrderStatus = async (req, res) => {
  try {
    const { orderIds, status } = req.body;

    // Validate input
    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Order IDs must be provided as an array'
      });
    }

    // Validate status
    const validStatuses = ['pending', 'scheduled', 'processing', 'processed', 'complete', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
    }

    // Find all orders
    const orders = await Order.find({ orderId: { $in: orderIds } });

    if (orders.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No orders found'
      });
    }

    // Check authorization (admin or affiliated affiliate)
    const isAuthorized = req.user.role === 'admin' ||
      (req.user.role === 'affiliate' && orders.every(order => order.affiliateId === req.user.affiliateId));

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    // Update orders
    const results = [];
    let updated = 0;
    let failed = 0;

    for (const order of orders) {
      try {
        // Check if status transition is valid
        const currentStatus = order.status;
        const canTransition = checkStatusTransition(currentStatus, status);

        if (!canTransition) {
          results.push({
            orderId: order.orderId,
            success: false,
            message: `Cannot transition from ${currentStatus} to ${status}`
          });
          failed++;
          continue;
        }

        // Update order
        order.status = status;

        // Update status timestamps (these are now handled in the model middleware)
        // The model's pre-save hook will automatically set the appropriate timestamps

        await order.save();

        results.push({
          orderId: order.orderId,
          success: true,
          message: 'Order updated successfully'
        });
        updated++;
      } catch (error) {
        results.push({
          orderId: order.orderId,
          success: false,
          message: error.message
        });
        failed++;
      }
    }

    res.status(200).json({
      success: true,
      updated,
      failed,
      results
    });
  } catch (error) {
    console.error('Bulk update order status error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while updating orders'
    });
  }
};

/**
 * Bulk cancel orders
 */
exports.bulkCancelOrders = async (req, res) => {
  try {
    const { orderIds } = req.body;

    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order IDs provided'
      });
    }

    // Check authorization (admin or affiliated affiliate)
    const orders = await Order.find({ orderId: { $in: orderIds } });

    if (orders.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No orders found'
      });
    }

    // Check if user is authorized for all orders
    const unauthorized = orders.some(order => {
      return req.user.role !== 'admin' &&
        !(req.user.role === 'affiliate' && req.user.affiliateId === order.affiliateId);
    });

    if (unauthorized) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to cancel one or more orders'
      });
    }

    let cancelled = 0;
    let failed = 0;
    const results = [];

    for (const order of orders) {
      // Check if order can be cancelled
      if (['processing', 'processed', 'complete', 'cancelled'].includes(order.status)) {
        results.push({
          orderId: order.orderId,
          success: false,
          error: `Cannot cancel order with status: ${order.status}`
        });
        failed++;
      } else {
        order.status = 'cancelled';
        order.cancelledAt = new Date();
        order.cancelledBy = req.user.id;
        order.cancelReason = 'Bulk cancellation';
        await order.save();

        results.push({
          orderId: order.orderId,
          success: true
        });
        cancelled++;
      }
    }

    res.status(200).json({
      success: true,
      cancelled,
      failed,
      results
    });
  } catch (error) {
    console.error('Bulk cancel orders error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while cancelling orders'
    });
  }
};

/**
 * Export orders
 */
exports.exportOrders = async (req, res) => {
  try {
    const { format = 'csv', startDate, endDate, affiliateId, status } = req.query;

    // Build query
    const query = {};

    // Date range filter
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    // Affiliate filter
    if (affiliateId) {
      query.affiliateId = affiliateId;
    }

    // Status filter
    if (status) {
      query.status = status;
    }

    // Check authorization
    if (req.user.role === 'affiliate') {
      // Affiliates can only export their own orders
      query.affiliateId = req.user.affiliateId;
    } else if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions for this export'
      });
    }

    // Get orders
    const orders = await Order.find(query)
      .sort({ createdAt: -1 });

    // Get unique customer IDs
    const customerIds = [...new Set(orders.map(order => order.customerId))];

    // Fetch customer data
    const customers = await Customer.find({ customerId: { $in: customerIds } });
    const customerMap = {};
    customers.forEach(customer => {
      customerMap[customer.customerId] = customer;
    });

    // Format based on requested format
    if (format === 'csv') {
      // Generate CSV
      const csvHeaders = [
        'Order ID',
        'Customer Name',
        'Customer Email',
        'Affiliate ID',
        'Status',
        'Estimated Weight',
        'Actual Weight',
        'Estimated Total',
        'Actual Total',
        'Commission',
        'Pickup Date',
        'Delivery Date',
        'Created At'
      ].join(',');

      const csvRows = orders.map(order => {
        const customer = customerMap[order.customerId];
        return [
          order.orderId,
          customer ? `${customer.firstName} ${customer.lastName}` : '',
          customer ? customer.email : '',
          order.affiliateId,
          order.status,
          order.estimatedWeight || '',
          order.actualWeight || '',
          order.estimatedTotal || '',
          order.actualTotal || '',
          order.affiliateCommission || '',
          order.pickupDate ? new Date(order.pickupDate).toISOString() : '',
          order.deliveryDate ? new Date(order.deliveryDate).toISOString() : '',
          new Date(order.createdAt).toISOString()
        ].join(',');
      });

      const csv = [csvHeaders, ...csvRows].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=orders-export-${Date.now()}.csv`);
      res.send(csv);
    } else if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=orders-export-${Date.now()}.json`);
      res.json({
        success: true,
        exportDate: new Date().toISOString(),
        filters: { startDate, endDate, affiliateId, status },
        totalOrders: orders.length,
        orders: orders.map(order => {
          const customer = customerMap[order.customerId];
          return {
            orderId: order.orderId,
            customer: customer ? {
              name: `${customer.firstName} ${customer.lastName}`,
              email: customer.email
            } : null,
            affiliateId: order.affiliateId,
            status: order.status,
            estimatedWeight: order.estimatedWeight,
            actualWeight: order.actualWeight,
            estimatedTotal: order.estimatedTotal,
            actualTotal: order.actualTotal,
            commission: order.affiliateCommission,
            pickupDate: order.pickupDate,
            deliveryDate: order.deliveryDate,
            createdAt: order.createdAt
          };
        })
      });
    } else if (format === 'excel') {
      // For Excel format, we'll return JSON with a note
      // In production, you'd use a library like exceljs
      res.status(501).json({
        success: false,
        message: 'Excel export not yet implemented'
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Invalid export format. Supported formats: csv, json'
      });
    }
  } catch (error) {
    console.error('Export orders error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while exporting orders'
    });
  }
};

/**
 * Update payment status
 */
exports.updatePaymentStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const {
      paymentStatus,
      paymentMethod,
      paymentReference,
      paymentError,
      refundAmount,
      refundReason,
      refundReference
    } = req.body;

    // Find order
    const order = await Order.findOne({ orderId });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Check authorization (admin or affiliated affiliate)
    const isAuthorized =
      req.user.role === 'admin' ||
      (req.user.role === 'affiliate' && req.user.affiliateId === order.affiliateId);

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    // Check if order is complete (payment status can only be updated for complete orders)
    if (order.status !== 'complete') {
      return res.status(400).json({
        success: false,
        message: 'Cannot update payment status for non-complete orders'
      });
    }

    // Validate payment status
    const validPaymentStatuses = ['pending', 'processing', 'completed', 'failed', 'refunded'];
    if (!validPaymentStatuses.includes(paymentStatus)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment status'
      });
    }

    // Update payment information
    order.paymentStatus = paymentStatus;
    if (paymentMethod) order.paymentMethod = paymentMethod;
    if (paymentReference) order.paymentReference = paymentReference;
    if (paymentError) order.paymentError = paymentError;

    if (paymentStatus === 'completed') {
      order.paymentDate = new Date();
    }

    if (paymentStatus === 'refunded') {
      order.refundedAt = new Date();
      if (refundAmount) order.refundAmount = refundAmount;
      if (refundReason) order.refundReason = refundReason;
      if (refundReference) order.refundReference = refundReference;
    }

    await order.save();

    res.status(200).json({
      success: true,
      message: 'Payment status updated successfully',
      order: {
        orderId: order.orderId,
        paymentStatus: order.paymentStatus,
        paymentMethod: order.paymentMethod,
        paymentReference: order.paymentReference,
        paymentDate: order.paymentDate,
        paymentError: order.paymentError,
        refundAmount: order.refundAmount,
        refundReason: order.refundReason,
        refundReference: order.refundReference,
        refundedAt: order.refundedAt
      }
    });
  } catch (error) {
    console.error('Update payment status error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while updating payment status'
    });
  }
};

/**
 * Search orders
 */
exports.searchOrders = async (req, res) => {
  try {
    const { search, affiliateId, startDate, endDate, status } = req.query;
    const { page = 1, limit = 10 } = req.pagination || req.query;

    // Build query
    const query = {};

    // Date range filter
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    // Status filter
    if (status) {
      query.status = status;
    }

    // Affiliate filter
    if (affiliateId) {
      query.affiliateId = affiliateId;
    }

    // Check authorization
    if (req.user.role === 'affiliate') {
      // Affiliates can only search their own orders
      query.affiliateId = req.user.affiliateId;
    } else if (req.user.role !== 'admin' && req.user.role !== 'administrator') {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    // Search filter - search in customer names
    let orders;
    if (search) {
      // First find customers matching the search term
      const customers = await Customer.find({
        $or: [
          { firstName: { $regex: search, $options: 'i' } },
          { lastName: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } }
        ]
      }).select('customerId');

      const customerIds = customers.map(c => c.customerId);
      query.customerId = { $in: customerIds };
    }

    // Get total count
    const totalResults = await Order.countDocuments(query);

    // Get paginated results
    orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    // Get customer data
    const customerIds = [...new Set(orders.map(order => order.customerId))];
    const customers = await Customer.find({ customerId: { $in: customerIds } });
    const customerMap = {};
    customers.forEach(customer => {
      customerMap[customer.customerId] = customer;
    });

    res.status(200).json({
      success: true,
      orders: orders.map(order => {
        const customer = customerMap[order.customerId];
        return {
          orderId: order.orderId,
          customer: customer ? {
            customerId: customer.customerId,
            name: `${customer.firstName} ${customer.lastName}`,
            email: customer.email
          } : null,
          affiliateId: order.affiliateId,
          status: order.status,
          estimatedWeight: order.estimatedWeight,
          actualWeight: order.actualWeight,
          estimatedTotal: order.estimatedTotal,
          actualTotal: order.actualTotal,
          createdAt: order.createdAt
        };
      }),
      totalResults,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(totalResults / limit)
      }
    });
  } catch (error) {
    console.error('Search orders error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while searching orders'
    });
  }
};

/**
 * Get order statistics
 */
exports.getOrderStatistics = async (req, res) => {
  try {
    const { affiliateId, includeStats = 'true' } = req.query;

    // Build query
    const query = {};

    // Affiliate filter
    if (affiliateId) {
      query.affiliateId = affiliateId;
    }

    // Check authorization
    if (req.user.role === 'affiliate') {
      // Affiliates can only view their own statistics
      query.affiliateId = req.user.affiliateId;
    } else if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    // Get all orders
    const orders = await Order.find(query);

    // Calculate statistics
    const totalOrders = orders.length;

    // Orders by status
    const ordersByStatus = {
      pending: 0,
      scheduled: 0,
      processing: 0,
      processed: 0,
      complete: 0,
      cancelled: 0
    };

    let totalRevenue = 0;
    let deliveredCount = 0;
    let totalEstimatedWeight = 0;
    let orderWithWeightCount = 0;

    orders.forEach(order => {
      // Count by status
      if (ordersByStatus.hasOwnProperty(order.status)) {
        ordersByStatus[order.status]++;
      }

      // Calculate revenue from complete orders
      if (order.status === 'complete') {
        totalRevenue += order.actualTotal || order.estimatedTotal || 0;
        deliveredCount++;
      }

      // Calculate average weight
      if (order.estimatedWeight) {
        totalEstimatedWeight += order.estimatedWeight;
        orderWithWeightCount++;
      }
    });

    const averageOrderValue = deliveredCount > 0 ? totalRevenue / deliveredCount : 0;
    const averageEstimatedWeight = orderWithWeightCount > 0 ? totalEstimatedWeight / orderWithWeightCount : 0;

    const statistics = {
      totalOrders,
      ordersByStatus,
      totalRevenue,
      averageOrderValue,
      averageEstimatedWeight
    };

    res.status(200).json({
      success: true,
      statistics
    });
  } catch (error) {
    console.error('Get order statistics error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while retrieving statistics'
    });
  }
};

/**
 * Helper function to check if status transition is valid
 */
function checkStatusTransition(currentStatus, newStatus) {
  const validTransitions = {
    'pending': ['scheduled', 'processing', 'cancelled'],
    'scheduled': ['processing', 'cancelled'],
    'processing': ['processed'],
    'processed': ['complete'],
    'complete': [],
    'cancelled': []
  };

  return validTransitions[currentStatus]?.includes(newStatus) || false;
}

module.exports = exports;