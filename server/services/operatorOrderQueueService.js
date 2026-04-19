// Operator order-queue service
//
// Covers the three queue-management endpoints the operator uses before the
// bag-scanning workflow starts: list pending orders, claim one, and move it
// through the wash/dry/fold/quality state machine.
//
// Extracted from operatorController in Phase 2. Controllers map QueueError
// instances to HTTP responses; unexpected errors bubble up.

const Operator = require('../models/Operator');
const Order = require('../models/Order');
const ControllerHelpers = require('../utils/controllerHelpers');
const { logAuditEvent, AuditEvents } = require('../utils/auditLogger');
const Formatters = require('../utils/formatters');

const MAX_CONCURRENT_ORDERS = 3;

const VALID_STATUS_TRANSITIONS = {
  assigned: ['washing'],
  washing: ['drying'],
  drying: ['folding'],
  folding: ['quality_check'],
  quality_check: ['ready', 'washing']
};

class QueueError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
    this.isQueueError = true;
  }
}

function formatOrder(order) {
  const base = order.toObject ? order.toObject() : order;
  return {
    ...base,
    customer: order.customer ? {
      ...(order.customer.toObject ? order.customer.toObject() : order.customer),
      name: Formatters.fullName(order.customer.firstName, order.customer.lastName),
      phone: Formatters.phone(order.customer.phone)
    } : null,
    scheduledPickup: order.scheduledPickup ? Formatters.datetime(order.scheduledPickup) : base.scheduledPickup,
    estimatedWeight: Formatters.weight(order.estimatedWeight),
    actualWeight: Formatters.weight(order.actualWeight)
  };
}

async function getOrderQueue({ status = 'pending', priority, dateFrom, dateTo, pagination }) {
  const query = { orderProcessingStatus: status };
  if (priority) query.priority = priority;
  if (dateFrom || dateTo) {
    query.scheduledPickup = {};
    if (dateFrom) query.scheduledPickup.$gte = new Date(dateFrom);
    if (dateTo) query.scheduledPickup.$lte = new Date(dateTo);
  }

  const [orders, total] = await Promise.all([
    Order.find(query)
      .populate('customer', 'firstName lastName email phone')
      .populate('assignedOperator', 'firstName lastName operatorId')
      .sort({ priority: -1, scheduledPickup: 1 })
      .skip(pagination.skip)
      .limit(pagination.limit),
    Order.countDocuments(query)
  ]);

  return {
    orders: orders.map(formatOrder),
    pagination: ControllerHelpers.calculatePagination(total, pagination.page, pagination.limit)
  };
}

async function claimOrder({ orderId, operatorId, req }) {
  const order = await Order.findById(orderId);
  if (!order) throw new QueueError('order_not_found', 'Order not found', 404);
  if (order.assignedOperator) throw new QueueError('already_assigned', 'Order already assigned');

  const operator = await Operator.findById(operatorId);
  const activeOrdersCount = await Order.countDocuments({
    assignedOperator: operatorId,
    orderProcessingStatus: { $in: ['assigned', 'washing', 'drying', 'folding'] }
  });

  if (activeOrdersCount >= MAX_CONCURRENT_ORDERS) {
    throw new QueueError('max_concurrent', 'Maximum concurrent orders reached');
  }

  order.assignedOperator = operatorId;
  order.orderProcessingStatus = 'assigned';
  order.processingStarted = new Date();
  await order.save();

  operator.updatedAt = new Date();
  await operator.save();

  await logAuditEvent(AuditEvents.ORDER_STATUS_CHANGED, {
    operatorId,
    orderId,
    orderNumber: order.orderNumber,
    action: 'order_claimed',
    newStatus: 'assigned'
  }, req);

  const populated = await order.populate('customer', 'firstName lastName email phone');
  return {
    ...populated.toObject(),
    customer: populated.customer ? {
      ...populated.customer.toObject(),
      name: Formatters.fullName(populated.customer.firstName, populated.customer.lastName),
      phone: Formatters.phone(populated.customer.phone)
    } : null,
    processingStarted: Formatters.datetime(order.processingStarted)
  };
}

async function updateOrderStatus({ orderId, operatorId, status, notes, workstation, req }) {
  const order = await Order.findById(orderId);
  if (!order) throw new QueueError('order_not_found', 'Order not found', 404);

  if (order.assignedOperator?.toString() !== operatorId) {
    throw new QueueError('not_authorized', 'Not authorized to update this order', 403);
  }

  if (!VALID_STATUS_TRANSITIONS[order.orderProcessingStatus]?.includes(status)) {
    throw new QueueError(
      'invalid_transition',
      `Invalid status transition from ${order.orderProcessingStatus} to ${status}`
    );
  }

  const previousStatus = order.orderProcessingStatus;
  order.orderProcessingStatus = status;
  if (notes) order.operatorNotes = notes;

  if (workstation && status === 'washing') {
    const operator = await Operator.findById(operatorId);
    operator.workStation = workstation;
    await operator.save();
  }

  if (status === 'ready') {
    order.processingCompleted = new Date();
    order.processingTimeMinutes = Math.round(
      (order.processingCompleted - order.processingStarted) / (1000 * 60)
    );
  }

  await order.save();

  await logAuditEvent(AuditEvents.ORDER_STATUS_CHANGED, {
    operatorId,
    orderId,
    orderNumber: order.orderNumber,
    oldStatus: previousStatus,
    newStatus: status
  }, req);

  return order.populate('customer', 'firstName lastName email phone');
}

module.exports = {
  getOrderQueue,
  claimOrder,
  updateOrderStatus,
  QueueError,
  MAX_CONCURRENT_ORDERS
};
