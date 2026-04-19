// Operator support-workflow service
//
// Ancillary operations around the main bag-scanning pipeline: quality check,
// order listings, workstation status, customer details, and customer notes.
// Everything is a thin Mongoose wrapper — no HTTP or session concerns.

const Operator = require('../models/Operator');
const Order = require('../models/Order');
const Customer = require('../models/Customer');
const { logAuditEvent, AuditEvents } = require('../utils/auditLogger');

const WORKSTATIONS = ['W1', 'W2', 'W3', 'W4', 'W5', 'D1', 'D2', 'D3', 'F1', 'F2'];

class SupportError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
    this.isSupportError = true;
  }
}

async function performQualityCheck({ orderId, operatorId, passed, notes, issues, req }) {
  const order = await Order.findById(orderId);
  if (!order) throw new SupportError('order_not_found', 'Order not found', 404);
  if (order.orderProcessingStatus !== 'quality_check') {
    throw new SupportError('not_ready_for_qc', 'Order not ready for quality check');
  }

  order.qualityCheckPassed = passed;
  order.qualityCheckBy = operatorId;
  order.qualityCheckNotes = notes;

  if (passed) {
    order.orderProcessingStatus = 'ready';
    order.processingCompleted = new Date();
    order.processingTimeMinutes = Math.round(
      (order.processingCompleted - order.processingStarted) / (1000 * 60)
    );
  } else {
    order.orderProcessingStatus = 'washing';
    if (issues) {
      order.operatorNotes = `Quality issues: ${issues}. ${order.operatorNotes || ''}`;
    }
  }

  await order.save();

  // Quality score recomputed only on pass — stays at prior value on fail.
  if (passed) {
    const operator = await Operator.findById(order.assignedOperator);
    if (operator) {
      const [qualityChecks, passedChecks] = await Promise.all([
        Order.countDocuments({ assignedOperator: operator._id, qualityCheckPassed: { $ne: null } }),
        Order.countDocuments({ assignedOperator: operator._id, qualityCheckPassed: true })
      ]);
      operator.qualityScore = Math.round((passedChecks / qualityChecks) * 100);
      await operator.save();
    }
  }

  await logAuditEvent(AuditEvents.ORDER_STATUS_CHANGED, {
    operatorId,
    orderId,
    orderNumber: order.orderNumber,
    action: 'quality_check',
    passed,
    issues
  }, req);

  return {
    passed,
    order: await order.populate('customer', 'firstName lastName email phone')
  };
}

async function getMyOrders({ operatorId, status, dateFrom, dateTo, page = 1, limit = 20 }) {
  const query = { assignedOperator: operatorId };
  if (status) query.orderProcessingStatus = status;
  if (dateFrom || dateTo) {
    query.processingStarted = {};
    if (dateFrom) query.processingStarted.$gte = new Date(dateFrom);
    if (dateTo) query.processingStarted.$lte = new Date(dateTo);
  }

  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const skip = (pageNum - 1) * limitNum;

  const [orders, total] = await Promise.all([
    Order.find(query)
      .populate('customer', 'firstName lastName email phone')
      .sort({ processingStarted: -1 })
      .skip(skip)
      .limit(limitNum),
    Order.countDocuments(query)
  ]);

  return {
    orders,
    pagination: { total, page: pageNum, pages: Math.ceil(total / limitNum) }
  };
}

async function getWorkstationStatus() {
  return Promise.all(WORKSTATIONS.map(async (workstation) => {
    const operator = await Operator.findOne({
      workStation: workstation,
      isActive: true
    }).select('firstName lastName operatorId');

    const activeOrders = await Order.countDocuments({
      assignedOperator: operator?._id,
      orderProcessingStatus: { $in: ['washing', 'drying', 'folding'] }
    });

    return {
      workstation,
      type: workstation.startsWith('W') ? 'washing'
        : workstation.startsWith('D') ? 'drying' : 'folding',
      operator: operator ? {
        name: `${operator.firstName} ${operator.lastName}`,
        operatorId: operator.operatorId
      } : null,
      activeOrders,
      available: !operator || activeOrders < 3
    };
  }));
}

async function getCustomerDetails({ customerId }) {
  const customer = await Customer.findById(customerId)
    .select('firstName lastName email phone address preferences notes');
  if (!customer) throw new SupportError('customer_not_found', 'Customer not found', 404);

  const recentOrders = await Order.find({ customer: customerId })
    .select('orderNumber scheduledPickup weight totalAmount orderProcessingStatus')
    .sort({ createdAt: -1 })
    .limit(5);

  return { customer, recentOrders };
}

async function addCustomerNote({ customerId, note, operatorId, req }) {
  const customer = await Customer.findById(customerId);
  if (!customer) throw new SupportError('customer_not_found', 'Customer not found', 404);

  if (!customer.notes) customer.notes = [];
  customer.notes.push({ note, addedBy: operatorId, addedAt: new Date() });
  await customer.save();

  await logAuditEvent(AuditEvents.ACCOUNT_UPDATED, {
    operatorId,
    action: 'customer_note_added',
    customerId,
    note: note.substring(0, 100)
  }, req);

  return { id: customer._id, notes: customer.notes };
}

module.exports = {
  performQualityCheck,
  getMyOrders,
  getWorkstationStatus,
  getCustomerDetails,
  addCustomerNote,
  SupportError,
  WORKSTATIONS
};
