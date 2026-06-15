// WaveMAX Laundry Affiliate Program
// API Controllers for handling all API endpoints

const Affiliate = require('../models/Affiliate');
const Customer = require('../models/Customer');
const Order = require('../models/Order');
const emailService = require('../utils/emailService');
const { escapeRegex } = require('../utils/securityUtils');

// Utility modules for consistent error handling and responses
const ControllerHelpers = require('../utils/controllerHelpers');
const AuthorizationHelpers = require('../middleware/authorizationHelpers');
const Formatters = require('../utils/formatters');
const logger = require('../utils/logger');
const { canTransition } = require('../modules/orders/orderStateMachine');
const { applyReadyGate } = require('../services/orderReadyGateService');
const { applyW9ThresholdCheck } = require('../modules/onboarding/w9ThresholdService');

// ============================================================================
// Order Controllers
// ============================================================================

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
    actualTotal: Formatters.currency(order.actualTotal),
    addOns: order.addOns,
    addOnTotal: Formatters.currency(order.addOnTotal),
    wdfCreditApplied: Formatters.currency(order.wdfCreditApplied),
    wdfCreditGenerated: Formatters.currency(order.wdfCreditGenerated),
    affiliateCommission: Formatters.currency(order.affiliateCommission),
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

    // ready_for_pickup has exactly one writer — orderReadyGateService.applyReadyGate.
    // A direct PUT to it is always rejected (design §6.4).
    if (status === 'ready_for_pickup') {
      return res.status(400).json({
        success: false,
        message: 'ready_for_pickup is set by the ready gate and cannot be set directly'
      });
    }

    if (!canTransition(order.status, status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status transition from ${order.status} to ${status}`
      });
    }

    // Find customer and affiliate first
    const customer = await Customer.findOne({ customerId: order.customerId });
    const affiliate = await Affiliate.findOne({ affiliateId: order.affiliateId });

    // Update order status (pre-save stamps the lifecycle timestamp set-once).
    order.status = status;
    if (actualWeight) {
      order.actualWeight = parseFloat(actualWeight);
    }

    // Spec §6.6: admin override to delivered = manual_confirm proof.
    // Only when no proof exists — never clobber a code/PIN-confirmed proof.
    if (status === 'delivered'
        && ['admin', 'administrator'].includes(req.user.role)
        && !(order.proofOfDelivery && order.proofOfDelivery.method)) {
      order.proofOfDelivery = {
        method: 'manual_confirm',
        confirmedByRole: 'admin',
        confirmedById: String(req.user.id),
        confirmedAt: new Date()
      };
    }

    await order.save();

    // Commission realizes at delivered (Order pre-save set-once stamp) —
    // best-effort W-9 threshold re-check (spec §6.2/§8); the service never throws.
    if (status === 'delivered') {
      await applyW9ThresholdCheck(order.affiliateId, { req });
    }

    // The processed transition runs the canonical ready gate, which now
    // promotes processed -> ready_for_pickup unconditionally (payment removed).
    if (status === 'processed') {
      await applyReadyGate(order, { trigger: 'status_put' });
    }

    // Send status update email to customer
    if (customer && ['processed', 'picked_up', 'delivered'].includes(status)) {
      await emailService.sendOrderStatusUpdateEmail(customer, order, status);

      // Commission realizes at delivered (design §6.4)
      if (status === 'delivered' && affiliate) {
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

  // Cancellable only from in_progress or processed (shared TRANSITIONS map).
  if (!canTransition(order.status, 'cancelled')) {
    return ControllerHelpers.sendError(res,
      `Orders in ${order.status} status cannot be cancelled. Only in_progress or processed orders can be cancelled.`,
      400
    );
  }

  // PR 6 HANDOFF (explicit, do not implement here): when the durable Bag module
  // lands (PR 6), cancellation must release this order's bag back to 'active'
  // via bagService.releaseForCancelledOrder({ bagId: order.bagId }). The Bag
  // model does not exist in this PR, so there is deliberately no call here —
  // PR 6's plan adds it and its test.

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
      user: req.user
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
      actualWeight: Formatters.weight(order.actualWeight),
      actualTotal: Formatters.currency(order.actualTotal),
      createdAt: Formatters.datetime(order.createdAt),
      wdfCreditApplied: Formatters.currency(order.wdfCreditApplied),
      wdfCreditGenerated: Formatters.currency(order.wdfCreditGenerated)
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
    const { affiliateId } = req.query;

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
      in_progress: 0,
      processed: 0,
      ready_for_pickup: 0,
      picked_up: 0,
      delivered: 0,
      cancelled: 0
    };

    let totalRevenue = 0;
    let deliveredCount = 0;
    let totalActualWeight = 0;
    let orderWithWeightCount = 0;

    orders.forEach(order => {
      // Count by status
      if (Object.prototype.hasOwnProperty.call(ordersByStatus, order.status)) {
        ordersByStatus[order.status]++;
      }

      // Calculate revenue from delivered orders
      if (order.status === 'delivered') {
        totalRevenue += order.actualTotal || 0;
        deliveredCount++;
      }

      // Calculate average weight
      if (order.actualWeight) {
        totalActualWeight += order.actualWeight;
        orderWithWeightCount++;
      }
    });

    const averageOrderValue = deliveredCount > 0 ? totalRevenue / deliveredCount : 0;
    const averageWeight = orderWithWeightCount > 0 ? totalActualWeight / orderWithWeightCount : 0;

    const statistics = {
      totalOrders,
      ordersByStatus,
      totalRevenue,
      averageOrderValue,
      averageWeight
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

module.exports = exports;