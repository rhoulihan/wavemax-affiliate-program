// WaveMAX Laundry Affiliate Program
// API Controllers for handling all API endpoints

const Affiliate = require('../models/Affiliate');
const Customer = require('../models/Customer');
const Order = require('../models/Order');
const SystemConfig = require('../models/SystemConfig');
const encryptionUtil = require('../utils/encryption');
const emailService = require('../utils/emailService');
const jwt = require('jsonwebtoken');
const { escapeRegex } = require('../utils/securityUtils');

// Utility modules for consistent error handling and responses
const ControllerHelpers = require('../utils/controllerHelpers');
const AuthorizationHelpers = require('../middleware/authorizationHelpers');
const Formatters = require('../utils/formatters');
const logger = require('../utils/logger');
const { calculateDeliveryFee } = require('../services/orderPricingService');

// ============================================================================
// Order Controllers
// ============================================================================

/**
 * Check if customer has active orders
 */
exports.checkActiveOrders = ControllerHelpers.asyncWrapper(async (req, res) => {
  // Get customer ID from authenticated user
  const customerId = req.user.customerId;
  
  if (!customerId) {
    return ControllerHelpers.sendError(res, 'Customer ID not found in session', 400);
  }

  // Check for active orders
  const activeOrder = await Order.findOne({
    customerId: customerId,
    status: { $in: ['pending', 'processing', 'processed'] }
  }).select('orderId status createdAt pickupDate pickupTime');

  if (activeOrder) {
    return ControllerHelpers.sendSuccess(res, {
      hasActiveOrder: true,
      activeOrder: {
        orderId: activeOrder.orderId,
        status: Formatters.status(activeOrder.status, 'order'),
        createdAt: Formatters.datetime(activeOrder.createdAt),
        pickupDate: Formatters.date(activeOrder.pickupDate),
        pickupTime: activeOrder.pickupTime
      }
    }, 'Active order found');
  }

  ControllerHelpers.sendSuccess(res, {
    hasActiveOrder: false
  }, 'No active orders found');
});

/**
 * Create a new order
 */
exports.createOrder = ControllerHelpers.asyncWrapper(async (req, res) => {
  // Check for validation errors first
  const { validationResult } = require('express-validator');
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.info('Validation errors:', errors.array());
    return ControllerHelpers.sendError(res, 'Validation failed', 400, errors.array());
  }

  logger.info('Creating order with data:', JSON.stringify(req.body, null, 2));

  // Validate required fields using ControllerHelpers
  const requiredFields = ['customerId', 'affiliateId', 'pickupDate', 'pickupTime'];
  const fieldErrors = ControllerHelpers.validateRequiredFields(req.body, requiredFields);
  
  if (fieldErrors) {
    return ControllerHelpers.sendError(res, 'Missing required fields', 400, fieldErrors);
  }

  const {
    customerId,
    affiliateId,
    pickupDate,
    pickupTime,
    specialPickupInstructions,
    estimatedWeight,
    numberOfBags,
    addOns
  } = req.body;

  logger.info('AddOns received:', addOns);

  // Verify customer exists
  logger.info('Looking for customer with ID:', customerId);
  const customer = await Customer.findOne({ customerId });

  if (!customer) {
    logger.info('Customer not found with ID:', customerId);
    return ControllerHelpers.sendError(res, 'Invalid customer ID', 400);
  }
  logger.info('Found customer:', customer.firstName, customer.lastName);

  // Check if customer already has an active order
  const activeOrder = await Order.findOne({
    customerId: customerId,
    status: { $in: ['pending', 'processing', 'processed'] }
  });

  if (activeOrder) {
    logger.info('Customer already has an active order:', activeOrder.orderId);
    return ControllerHelpers.sendError(res, 
      'You already have an active order. Please wait for it to be completed before placing a new order.', 
      400, 
      {
        activeOrderId: activeOrder.orderId,
        activeOrderStatus: activeOrder.status
      }
    );
  }

  // Verify affiliate exists
  logger.info('Looking for affiliate with ID:', affiliateId);
  const affiliate = await Affiliate.findOne({ affiliateId });

  if (!affiliate) {
    logger.info('Affiliate not found with ID:', affiliateId);
    return ControllerHelpers.sendError(res, 'Invalid affiliate ID', 400);
  }
  logger.info('Found affiliate:', affiliate.firstName, affiliate.lastName);

  // Validate affiliate availability for the requested pickup slot
  if (affiliate.availabilitySchedule && affiliate.isAvailable) {
    const pickupDateObj = new Date(pickupDate);
    const isAvailable = affiliate.isAvailable(pickupDateObj, pickupTime);

    if (!isAvailable) {
      logger.info(`Affiliate ${affiliateId} is not available for ${pickupDate} during ${pickupTime}`);
      const formattedDate = pickupDateObj.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      return res.status(400).json({
        success: false,
        message: 'Selected pickup time is not available',
        error: {
          code: 'TIMESLOT_UNAVAILABLE',
          details: `The affiliate is not available for pickups on ${formattedDate} during the ${pickupTime} time slot. Please select a different date or time.`
        }
      });
    }
    logger.info(`Availability check passed: ${pickupDate} ${pickupTime}`);
  }

  // Check authorization using AuthorizationHelpers
  const isAuthorized =
    AuthorizationHelpers.isAdmin(req.user) ||
    req.user.customerId === customerId ||
    (req.user.role === 'affiliate' && req.user.affiliateId === affiliateId);

  if (!isAuthorized) {
    return ControllerHelpers.sendError(res, 'Unauthorized', 403);
  }

    // Calculate delivery fee based on number of bags
    const bagCount = parseInt(numberOfBags) || 1; // Default to 1 bag if not specified
    const feeCalculation = await calculateDeliveryFee(bagCount, affiliate);

    // Check if customer has WDF credit to apply
    let wdfCreditToApply = 0;
    if (customer.wdfCredit && customer.wdfCredit !== 0) {
      wdfCreditToApply = customer.wdfCredit;
      logger.info(`Applying WDF credit of $${wdfCreditToApply} to order for customer ${customerId}`);
    }

    // Create new order — post-weigh payment workflow
    const orderData = {
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
      wdfCreditApplied: wdfCreditToApply, // Store the credit applied to this order
      addOns: addOns || {
        premiumDetergent: false,
        fabricSoftener: false,
        stainRemover: false
      },
      status: 'pending',
      // Post-weigh payment is collected after bags are weighed
      paymentStatus: 'pending',
      paymentMethod: 'pending',
      paymentAmount: 0
    };

    logger.info('Creating order with data:', JSON.stringify(orderData, null, 2));
    const newOrder = new Order(orderData);
    await newOrder.save();

    // Reset customer's WDF credit after applying it to the order
    if (wdfCreditToApply !== 0) {
      customer.wdfCredit = 0;
      customer.wdfCreditUpdatedAt = new Date();
      await customer.save();
      logger.info(`Reset WDF credit for customer ${customerId} after applying to order ${newOrder.orderId}`);
    }

    // Update customer isActive to true on first order
    if (!customer.isActive) {
      customer.isActive = true;
      await customer.save();
      logger.info('Updated customer isActive status to true for customer:', customer.customerId);
    }

    // Send notification emails (don't let email failures stop the order)
    try {
      await emailService.sendCustomerOrderConfirmationEmail(customer, newOrder, affiliate);
      await emailService.sendAffiliateNewOrderEmail(affiliate, customer, newOrder);
    } catch (emailError) {
      logger.error('Failed to send notification emails:', emailError);
      // Continue with the response even if emails fail
    }

    ControllerHelpers.sendSuccess(res, {
      orderId: newOrder.orderId,
      estimatedTotal: Formatters.currency(newOrder.estimatedTotal),
      wdfCreditApplied: Formatters.currency(newOrder.wdfCreditApplied),
      addOns: newOrder.addOns,
      addOnTotal: Formatters.currency(newOrder.addOnTotal)
    }, 'Pickup scheduled successfully!', 201);
});

/**
 * Get bags for an order (for label printing)
 */
/**
 * Get order details
 */
exports.getOrderDetails = ControllerHelpers.asyncWrapper(async (req, res) => {
  const { orderId } = req.params;

  // Find order
  const order = await Order.findOne({ orderId });

  if (!order) {
    return ControllerHelpers.sendError(res, 'Order not found', 404);
  }

  // Check authorization using AuthorizationHelpers
  if (!AuthorizationHelpers.canAccessOrder(req.user, order)) {
    return ControllerHelpers.sendError(res, 'Unauthorized', 403);
  }

  // Get customer details
  const customer = await Customer.findOne({ customerId: order.customerId });

  // Get affiliate details
  const affiliate = await Affiliate.findOne({ affiliateId: order.affiliateId });

  const orderData = {
    orderId: order.orderId,
    customerId: order.customerId,
    customer: customer ? {
      name: Formatters.fullName(customer.firstName, customer.lastName),
      phone: Formatters.phone(customer.phone),
      email: customer.email,
      address: Formatters.address(customer),
      wdfCredit: Formatters.currency(customer.wdfCredit)
    } : null,
    affiliateId: order.affiliateId,
    affiliate: affiliate ? {
      name: Formatters.fullName(affiliate.firstName, affiliate.lastName),
      phone: Formatters.phone(affiliate.phone),
      email: affiliate.email,
      minimumDeliveryFee: Formatters.currency(affiliate.minimumDeliveryFee),
      perBagDeliveryFee: Formatters.currency(affiliate.perBagDeliveryFee)
    } : null,
    pickupDate: Formatters.date(order.pickupDate),
    pickupTime: order.pickupTime,
    specialPickupInstructions: order.specialPickupInstructions,
    estimatedWeight: Formatters.weight(order.estimatedWeight),
    numberOfBags: order.numberOfBags,
    serviceNotes: order.serviceNotes,
    deliveryDate: Formatters.date(order.deliveryDate),
    deliveryTime: order.deliveryTime,
    specialDeliveryInstructions: order.specialDeliveryInstructions,
    status: Formatters.status(order.status, 'order'),
    baseRate: Formatters.currency(order.baseRate),
    deliveryFee: Formatters.currency(order.feeBreakdown?.totalFee || 0),
    feeBreakdown: order.feeBreakdown,
    actualWeight: Formatters.weight(order.actualWeight),
    washInstructions: order.washInstructions,
    estimatedTotal: Formatters.currency(order.estimatedTotal),
    actualTotal: Formatters.currency(order.actualTotal),
    addOns: order.addOns,
    addOnTotal: Formatters.currency(order.addOnTotal),
    wdfCreditApplied: Formatters.currency(order.wdfCreditApplied),
    wdfCreditGenerated: Formatters.currency(order.wdfCreditGenerated),
    weightDifference: Formatters.weight(order.weightDifference),
    affiliateCommission: Formatters.currency(order.affiliateCommission),
    paymentStatus: Formatters.status(order.paymentStatus, 'payment'),
    createdAt: Formatters.datetime(order.createdAt),
    pickedUpAt: Formatters.datetime(order.pickedUpAt),
    processedAt: Formatters.datetime(order.processedAt),
    readyForDeliveryAt: Formatters.datetime(order.readyForDeliveryAt),
    deliveredAt: Formatters.datetime(order.deliveredAt),
    cancelledAt: Formatters.datetime(order.cancelledAt)
  };

  ControllerHelpers.sendSuccess(res, { order: orderData }, 'Order details retrieved successfully');
});

/**
 * Update order status
 */
exports.updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, actualWeight } = req.body;

    // Find order by orderId or _id
    let order;
    if (orderId.match(/^[0-9a-fA-F]{24}$/)) {
      // MongoDB ObjectId format
      order = await Order.findById(orderId);
    } else {
      // Order ID format (ORD123456)
      order = await Order.findOne({ orderId });
    }

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Check authorization (admin, operator, or associated affiliate)
    const isAuthorized =
      req.user.role === 'admin' ||
      req.user.role === 'operator' ||
      (req.user.role === 'affiliate' && req.user.affiliateId === order.affiliateId);


    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    // Check for valid status transition
    const validTransitions = {
      pending: ['processing', 'cancelled'],
      processing: ['processed', 'cancelled'],
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

    // Find customer and affiliate first
    const customer = await Customer.findOne({ customerId: order.customerId });
    const affiliate = await Affiliate.findOne({ affiliateId: order.affiliateId });

    // Update order status
    order.status = status;

    // Update actual weight when transitioning to processing or processed
    if ((status === 'processing' || status === 'processed') && actualWeight) {
      order.actualWeight = parseFloat(actualWeight);
      
      
      // Generate post-weigh payment request if this order is still pending payment
      if (customer && order.paymentStatus === 'pending') {
        // Calculate total with actual weight
        const actualTotal = req.body.actualTotal || order.actualTotal || order.estimatedTotal;
        
        // Generate payment links
        const paymentLinkService = require('../services/paymentLinkService');
        const { links, qrCodes, shortOrderId, amount } = await paymentLinkService.generatePaymentLinks(
          order._id,
          actualTotal,
          customer.name || `${customer.firstName} ${customer.lastName}`
        );
        
        // Update order with payment information
        order.paymentStatus = 'awaiting';
        order.paymentAmount = parseFloat(amount);
        order.paymentLinks = links;
        order.paymentQRCodes = qrCodes;
        order.paymentRequestedAt = new Date();
        
        logger.info(`Generated V2 payment links for order ${order.orderId} - Amount: $${amount}`);

        // Send payment request email to customer
        try {
          await emailService.sendV2PaymentRequest({
            customer,
            order,
            paymentAmount: parseFloat(amount),
            paymentLinks: links,
            qrCodes
          });
          logger.info(`V2 payment request email sent to ${customer.email} for order ${order.orderId}`);
        } catch (emailError) {
          logger.error('Error sending payment request email:', emailError);
        }
      }
    }

    await order.save();

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
    logger.error('Order status update error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while updating the order status'
    });
  }
};

/**
 * Cancel order
 */
exports.cancelOrder = ControllerHelpers.asyncWrapper(async (req, res) => {
  const { orderId } = req.params;

  // Find order
  const order = await Order.findOne({ orderId });

  if (!order) {
    return ControllerHelpers.sendError(res, 'Order not found', 404);
  }

  // Check if order can be cancelled - only pending orders can be cancelled
  if (order.status !== 'pending') {
    return ControllerHelpers.sendError(res, 
      `Orders in ${order.status} status cannot be cancelled. Only pending orders can be cancelled.`, 
      400
    );
  }

  // Check authorization using AuthorizationHelpers
  if (!AuthorizationHelpers.canAccessOrder(req.user, order)) {
    return ControllerHelpers.sendError(res, 'Unauthorized', 403);
  }

  // Update order status
  order.status = 'cancelled';
  order.cancelledAt = new Date();
  await order.save();

  // Find customer and affiliate for email notifications
  const customer = await Customer.findOne({ customerId: order.customerId });
  const affiliate = await Affiliate.findOne({ affiliateId: order.affiliateId });

  // Send cancellation emails (don't let email failures stop the cancellation)
  try {
    if (customer) {
      await emailService.sendOrderCancellationEmail(customer, order);
    }

    if (affiliate) {
      await emailService.sendAffiliateOrderCancellationEmail(affiliate, order, customer);
    }
  } catch (emailError) {
    logger.error('Failed to send cancellation emails:', emailError);
    // Continue with success response even if emails fail
  }

  ControllerHelpers.sendSuccess(res, {
    orderId: order.orderId,
    status: Formatters.status(order.status, 'order'),
    cancelledAt: Formatters.datetime(order.cancelledAt)
  }, 'Order cancelled successfully');
});

/**
 * Bulk update order status
 */
exports.bulkUpdateOrderStatus = async (req, res) => {
  const orderBulkService = require('../services/orderBulkService');
  try {
    const summary = await orderBulkService.bulkUpdateStatus({
      orderIds: req.body.orderIds,
      status: req.body.status,
      user: req.user,
      checkStatusTransition
    });
    res.status(200).json({ success: true, ...summary });
  } catch (err) {
    if (err.isBulkError) return res.status(err.status || 400).json({ success: false, message: err.message });
    logger.error('Bulk update order status error:', err);
    res.status(500).json({ success: false, message: 'An error occurred while updating orders' });
  }
};

/**
 * Bulk cancel orders
 */
exports.bulkCancelOrders = async (req, res) => {
  const orderBulkService = require('../services/orderBulkService');
  try {
    const summary = await orderBulkService.bulkCancel({
      orderIds: req.body.orderIds,
      user: req.user
    });
    res.status(200).json({ success: true, ...summary });
  } catch (err) {
    if (err.isBulkError) return res.status(err.status || 400).json({ success: false, message: err.message });
    logger.error('Bulk cancel orders error:', err);
    res.status(500).json({ success: false, message: 'An error occurred while cancelling orders' });
  }
};

/**
 * Export orders (CSV or JSON)
 */
exports.exportOrders = async (req, res) => {
  const orderExportService = require('../services/orderExportService');
  const { format = 'csv', startDate, endDate, affiliateId, status } = req.query;
  const filters = { startDate, endDate, affiliateId, status };

  try {
    const { orders, customerMap } = await orderExportService.collectExportData({
      format,
      filters,
      user: req.user
    });

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=orders-export-${Date.now()}.csv`);
      return res.send(orderExportService.formatCsv({ orders, customerMap }));
    }
    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=orders-export-${Date.now()}.json`);
      return res.json(orderExportService.formatJson({ orders, customerMap, filters }));
    }
  } catch (err) {
    if (err.isExportError) return res.status(err.status || 400).json({ success: false, message: err.message });
    logger.error('Export orders error:', err);
    res.status(500).json({ success: false, message: 'An error occurred while exporting orders' });
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
      paymentTransactionId,
      paymentNotes,
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

    // Validate payment status against the Order schema enum
    const validPaymentStatuses = ['pending', 'awaiting', 'confirming', 'verified', 'failed'];
    if (!validPaymentStatuses.includes(paymentStatus)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment status'
      });
    }

    // Update payment information
    order.paymentStatus = paymentStatus;
    if (paymentMethod) order.paymentMethod = paymentMethod;
    if (paymentTransactionId) order.paymentTransactionId = paymentTransactionId;
    if (paymentNotes) order.paymentNotes = paymentNotes;

    if (paymentStatus === 'verified' && !order.paymentVerifiedAt) {
      order.paymentVerifiedAt = new Date();
    }

    // Refund fields are tracked separately and can accompany any status update
    if (refundAmount !== undefined) order.refundAmount = refundAmount;
    if (refundReason) order.refundReason = refundReason;
    if (refundReference) order.refundReference = refundReference;
    if (refundAmount !== undefined) order.refundedAt = new Date();

    await order.save();

    res.status(200).json({
      success: true,
      message: 'Payment status updated successfully',
      order: {
        orderId: order.orderId,
        paymentStatus: order.paymentStatus,
        paymentMethod: order.paymentMethod,
        paymentTransactionId: order.paymentTransactionId,
        paymentVerifiedAt: order.paymentVerifiedAt,
        paymentNotes: order.paymentNotes,
        refundAmount: order.refundAmount,
        refundReason: order.refundReason,
        refundReference: order.refundReference,
        refundedAt: order.refundedAt
      }
    });
  } catch (error) {
    logger.error('Update payment status error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while updating payment status'
    });
  }
};

/**
 * Search orders
 */
exports.searchOrders = ControllerHelpers.asyncWrapper(async (req, res) => {
  const { search, affiliateId, startDate, endDate, status } = req.query;
  
  // Parse pagination parameters
  const pagination = ControllerHelpers.parsePagination(req.query);

  // Build query filters
  const allowedFields = {
    'status': 'status',
    'affiliateId': 'affiliateId',
    'startDate': 'createdAt',
    'endDate': 'createdAt'
  };
  
  const query = ControllerHelpers.buildQuery({ status, affiliateId }, allowedFields);

  // Date range filter
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }

  // Check authorization and apply role-based filters
  if (req.user.role === 'affiliate') {
    query.affiliateId = req.user.affiliateId;
  } else if (!AuthorizationHelpers.isAdmin(req.user)) {
    return ControllerHelpers.sendError(res, 'Unauthorized', 403);
  }

  // Search filter - search in customer names
  if (search) {
    const escapedSearch = escapeRegex(search);
    const customers = await Customer.find({
      $or: [
        { firstName: { $regex: escapedSearch, $options: 'i' } },
        { lastName: { $regex: escapedSearch, $options: 'i' } },
        { email: { $regex: escapedSearch, $options: 'i' } }
      ]
    }).select('customerId');

    const customerIds = customers.map(c => c.customerId);
    query.customerId = { $in: customerIds };
  }

  // Get total count for pagination
  const totalResults = await Order.countDocuments(query);

  // Get paginated results
  const orders = await Order.find(query)
    .sort({ createdAt: -1 })
    .skip(pagination.skip)
    .limit(pagination.limit);

  // Get customer data
  const customerIds = [...new Set(orders.map(order => order.customerId))];
  const customers = await Customer.find({ customerId: { $in: customerIds } });
  const customerMap = {};
  customers.forEach(customer => {
    customerMap[customer.customerId] = customer;
  });

  const ordersData = orders.map(order => {
    const customer = customerMap[order.customerId];
    return {
      orderId: order.orderId,
      customer: customer ? {
        customerId: customer.customerId,
        name: Formatters.fullName(customer.firstName, customer.lastName),
        email: customer.email
      } : null,
      affiliateId: order.affiliateId,
      status: Formatters.status(order.status, 'order'),
      estimatedWeight: Formatters.weight(order.estimatedWeight),
      actualWeight: Formatters.weight(order.actualWeight),
      estimatedTotal: Formatters.currency(order.estimatedTotal),
      actualTotal: Formatters.currency(order.actualTotal),
      createdAt: Formatters.datetime(order.createdAt),
      wdfCreditApplied: Formatters.currency(order.wdfCreditApplied),
      wdfCreditGenerated: Formatters.currency(order.wdfCreditGenerated),
      weightDifference: Formatters.weight(order.weightDifference)
    };
  });

  const paginationMeta = ControllerHelpers.calculatePagination(totalResults, pagination.page, pagination.limit);

  ControllerHelpers.sendPaginated(res, ordersData, paginationMeta, 'orders');
});

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
    logger.error('Get order statistics error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while retrieving statistics'
    });
  }
};

/**
 * Customer payment confirmation - when they click "already paid?"
 */
exports.confirmPayment = async (req, res) => {
  try {
    const { orderId, paymentMethod, paymentDetails, amount } = req.body;
    
    // Find order by short ID or full ID
    let order;
    if (orderId.length === 8) {
      // Short order ID
      const orders = await Order.find({ paymentStatus: 'awaiting' });
      for (const o of orders) {
        const shortId = o._id.toString().slice(-8).toUpperCase();
        if (shortId === orderId.toUpperCase()) {
          order = o;
          break;
        }
      }
    } else {
      // Full order ID
      order = await Order.findById(orderId);
    }
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
        error: 'Order not found'
      });
    }
    
    // Check if payment is already verified - return 409 for duplicate
    if (order.paymentStatus === 'verified') {
      return res.status(409).json({
        success: false,
        message: 'Payment already verified',
        error: 'Payment already verified',
        alreadyVerified: true
      });
    }
    
    // Validate payment amount if provided
    if (amount !== undefined) {
      const expectedAmount = order.paymentAmount || order.actualTotal || order.estimatedTotal;
      
      // Check if amount is way off (more than 100% difference)
      if (Math.abs(amount - expectedAmount) > expectedAmount) {
        return res.status(400).json({
          success: false,
          message: 'Invalid payment amount',
          error: 'Invalid payment amount provided',
          expectedAmount,
          providedAmount: amount
        });
      }
    }
    
    // Log customer confirmation
    logger.info(`Customer confirmed payment for order ${order._id}:`, {
      paymentMethod,
      paymentDetails
    });
    
    // Update order with customer confirmation
    order.paymentStatus = 'confirming';
    order.paymentConfirmedAt = new Date();
    order.paymentNotes = `Customer confirmed payment via ${paymentMethod}. Details: ${paymentDetails || 'None provided'}. Awaiting manual verification.`;
    order.paymentMethod = paymentMethod || 'pending';
    await order.save();
    
    // Immediately escalate to admin for manual verification
    const paymentVerificationJob = require('../jobs/paymentVerificationJob');
    await paymentVerificationJob.escalateToAdmin(order);
    
    // Also trigger an immediate payment check
    const paymentEmailScanner = require('../services/paymentEmailScanner');
    const verified = await paymentEmailScanner.checkOrderPayment(order._id);
    
    if (verified) {
      return res.json({
        success: true,
        message: 'Payment has been verified!',
        verified: true
      });
    }
    
    res.json({
      success: true,
      message: 'Thank you for confirming your payment. We are verifying it now and will update you shortly.',
      escalated: true
    });
    
  } catch (error) {
    logger.error('Payment confirmation error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while processing your payment confirmation'
    });
  }
};

/**
 * Manual payment verification by admin
 */
exports.verifyPaymentManually = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { transactionId, notes } = req.body;
    
    // Admin only
    if (req.user.role !== 'admin' && req.user.role !== 'administrator') {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized - admin access required'
      });
    }
    
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }
    
    // Update payment status
    order.paymentStatus = 'verified';
    order.paymentVerifiedAt = new Date();
    order.paymentTransactionId = transactionId || `MANUAL-${Date.now()}`;
    order.paymentNotes = `Manually verified by admin${req.user.email ? ` (${req.user.email})` : ''}. ${notes || ''}`;
    await order.save();
    
    // If order is ready, send pickup notification
    if (order.status === 'processed') {
      const customer = await Customer.findOne({ customerId: order.customerId });
      const affiliate = await Affiliate.findOne({ affiliateId: order.affiliateId });
      
      // Send notifications
      logger.info(`Sending pickup notification after manual verification for order ${orderId}`);
      // await emailService.sendPickupReadyNotification(order, customer, affiliate);
    }
    
    res.json({
      success: true,
      message: 'Payment verified successfully',
      order: {
        orderId: order.orderId,
        paymentStatus: order.paymentStatus,
        paymentVerifiedAt: order.paymentVerifiedAt
      }
    });
    
  } catch (error) {
    logger.error('Manual payment verification error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while verifying payment'
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

// ============================================================================
// Immediate Pickup ("Pickup Now!") Feature
// ============================================================================
//
// Scheduling helpers (getCDTHour, getPickupTimeSlot, calculatePickupDeadline,
// calculatePickupDate, isWithinOperatingHours, calculateNextAvailableTime)
// now live in server/services/orderImmediatePickupHours.

const {
  IMMEDIATE_PICKUP_HOURS,
  getCDTHour,
  getCurrentCDTTime,
  getPickupTimeSlot,
  calculatePickupDeadline,
  calculatePickupDate,
  isWithinOperatingHours,
  calculateNextAvailableTime
} = require('../services/orderImmediatePickupHours');

// Re-export for test code that still imports _getCurrentCDTTime from the controller.
exports._getCurrentCDTTime = getCurrentCDTTime;

/**
 * Check immediate pickup availability
 * GET /api/orders/immediate/availability
 */
exports.checkImmediateAvailability = ControllerHelpers.asyncWrapper(async (req, res) => {
  const { affiliateId } = req.query;
  const customerId = req.user.customerId;

  if (!affiliateId) {
    return ControllerHelpers.sendError(res, 'Affiliate ID is required', 400);
  }

  const cdtTime = exports._getCurrentCDTTime();

  // Check operating hours
  if (!isWithinOperatingHours(cdtTime)) {
    return ControllerHelpers.sendSuccess(res, {
      available: false,
      reason: 'Immediate pickup is not available outside operating hours (7 AM - 7 PM CDT)',
      nextAvailableTime: calculateNextAvailableTime(cdtTime).toISOString()
    });
  }

  // Check affiliate settings
  const affiliate = await Affiliate.findOne({ affiliateId });
  if (!affiliate) {
    return ControllerHelpers.sendError(res, 'Affiliate not found', 404);
  }

  if (!affiliate.allowImmediatePickup) {
    return ControllerHelpers.sendSuccess(res, {
      available: false,
      reason: 'Your service provider does not currently accept immediate pickup requests'
    });
  }

  // Check for active orders
  const activeOrder = await Order.findOne({
    customerId: customerId,
    status: { $in: ['pending', 'processing', 'processed'] }
  });

  if (activeOrder) {
    return ControllerHelpers.sendSuccess(res, {
      available: false,
      reason: 'You already have an active order. Please wait for it to complete before requesting another pickup.',
      activeOrderId: activeOrder.orderId
    });
  }

  // All checks passed
  ControllerHelpers.sendSuccess(res, {
    available: true,
    currentTime: cdtTime.toISOString(),
    operatingHours: '7 AM - 7 PM CDT'
  });
});

/**
 * Create immediate pickup order
 * POST /api/orders/immediate
 */
exports.createImmediateOrder = ControllerHelpers.asyncWrapper(async (req, res) => {
  const {
    customerId,
    affiliateId,
    numberOfBags,
    specialPickupInstructions,
    addOns
  } = req.body;

  // Validate required fields
  const requiredFields = ['customerId', 'affiliateId', 'numberOfBags'];
  const fieldErrors = ControllerHelpers.validateRequiredFields(req.body, requiredFields);

  if (fieldErrors) {
    return ControllerHelpers.sendError(res, 'Missing required fields', 400, fieldErrors);
  }

  const cdtTime = exports._getCurrentCDTTime();

  // Check operating hours
  if (!isWithinOperatingHours(cdtTime)) {
    return ControllerHelpers.sendError(res,
      'Immediate pickup is not available outside operating hours (7 AM - 7 PM CDT)',
      400,
      { code: 'OUTSIDE_OPERATING_HOURS' }
    );
  }

  // Verify customer exists
  const customer = await Customer.findOne({ customerId });
  if (!customer) {
    return ControllerHelpers.sendError(res, 'Customer not found', 404);
  }

  // Verify affiliate exists and has feature enabled
  const affiliate = await Affiliate.findOne({ affiliateId });
  if (!affiliate) {
    return ControllerHelpers.sendError(res, 'Affiliate not found', 404);
  }

  if (!affiliate.allowImmediatePickup) {
    return ControllerHelpers.sendError(res,
      'Your service provider does not currently accept immediate pickup requests',
      400,
      { code: 'AFFILIATE_DISABLED' }
    );
  }

  // Check authorization
  const isAuthorized =
    AuthorizationHelpers.isAdmin(req.user) ||
    req.user.customerId === customerId;

  if (!isAuthorized) {
    return ControllerHelpers.sendError(res, 'Unauthorized', 403);
  }

  // Check for active orders
  const activeOrder = await Order.findOne({
    customerId: customerId,
    status: { $in: ['pending', 'processing', 'processed'] }
  });

  if (activeOrder) {
    return ControllerHelpers.sendError(res,
      'You already have an active order. Please wait for it to complete before placing a new order.',
      400,
      { code: 'ACTIVE_ORDER_EXISTS', activeOrderId: activeOrder.orderId }
    );
  }

  // Calculate pickup details - cdtTime is now a UTC Date, use getCDTHour for business logic
  const orderTime = new Date(cdtTime.getTime()); // Copy to avoid mutation
  const pickupDeadline = calculatePickupDeadline(cdtTime);
  const pickupDate = calculatePickupDate(cdtTime);
  const pickupTime = getPickupTimeSlot(getCDTHour(cdtTime));

  // Calculate delivery fee
  const bagCount = parseInt(numberOfBags) || 1;
  const feeCalculation = await calculateDeliveryFee(bagCount, affiliate);

  // Check if this is customer's first order by counting existing orders
  const existingOrderCount = await Order.countDocuments({ customerId });
  const isFirstOrder = existingOrderCount === 0;

  // Apply WDF credit if available
  let wdfCreditToApply = 0;
  if (customer.wdfCredit && customer.wdfCredit !== 0) {
    wdfCreditToApply = customer.wdfCredit;
  }

  // Create order data - default estimated weight based on bag count (avg 20 lbs per bag)
  const defaultEstimatedWeight = bagCount * 20;
  const orderData = {
    customerId,
    affiliateId,
    pickupDate,
    pickupTime,
    specialPickupInstructions: specialPickupInstructions || customer.deliveryInstructions,
    estimatedWeight: defaultEstimatedWeight,
    numberOfBags: bagCount,
    feeBreakdown: {
      numberOfBags: feeCalculation.numberOfBags,
      minimumFee: feeCalculation.minimumFee,
      perBagFee: feeCalculation.perBagFee,
      totalFee: feeCalculation.totalFee,
      minimumApplied: feeCalculation.minimumApplied
    },
    wdfCreditApplied: wdfCreditToApply,
    addOns: addOns || {
      premiumDetergent: false,
      fabricSoftener: false,
      stainRemover: false
    },
    status: 'pending',
    // Immediate pickup specific fields
    isImmediatePickup: true,
    pickupDeadline,
    immediatePickupRequestedAt: orderTime,
    // Post-weigh payment
    paymentStatus: 'pending',
    paymentMethod: 'pending',
    paymentAmount: 0
  };

  // Create and save order
  const newOrder = new Order(orderData);
  await newOrder.save();

  if (wdfCreditToApply !== 0) {
    customer.wdfCredit = 0;
    customer.wdfCreditUpdatedAt = new Date();
    await customer.save();
  }

  // Update customer isActive if first order
  if (!customer.isActive) {
    customer.isActive = true;
    await customer.save();
  }

  // Send notification emails
  try {
    // Send urgent email to affiliate
    await emailService.sendAffiliateUrgentPickupEmail(affiliate, customer, newOrder);
    // Send confirmation to customer
    await emailService.sendCustomerOrderConfirmationEmail(customer, newOrder, affiliate);
  } catch (emailError) {
    logger.error('Failed to send immediate pickup notification emails:', emailError);
    // Continue even if emails fail
  }

  // Prepare response
  const response = {
    orderId: newOrder.orderId,
    pickupDeadline: newOrder.pickupDeadline.toISOString(),
    pickupDate: Formatters.date(newOrder.pickupDate),
    pickupTime: newOrder.pickupTime,
    estimatedTotal: Formatters.currency(newOrder.estimatedTotal),
    isFirstOrder,
    wdfCreditApplied: Formatters.currency(newOrder.wdfCreditApplied)
  };

  // Add first order note if applicable
  if (isFirstOrder) {
    response.firstOrderNote = 'Please leave your laundry in tall kitchen bags. It will be returned in WaveMAX laundry bags.';
  }

  ControllerHelpers.sendSuccess(res, response, 'Immediate pickup scheduled successfully!', 201);
});

module.exports = exports;