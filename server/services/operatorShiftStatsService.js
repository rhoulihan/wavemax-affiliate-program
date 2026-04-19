// Operator shift + stats service
//
// Shift clock-in/out, performance metrics, and the new-customer bag-label
// flow. All three concerns share the Operator/Order/Customer models and the
// audit logger, and none of them care about HTTP plumbing — extracted from
// operatorController.

const Operator = require('../models/Operator');
const Order = require('../models/Order');
const Customer = require('../models/Customer');
const { logAuditEvent, AuditEvents } = require('../utils/auditLogger');

class ShiftError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
    this.isShiftError = true;
  }
}

async function updateShiftStatus({ operatorId, action, workstation, req }) {
  const operator = await Operator.findById(operatorId);
  if (!operator) throw new ShiftError('operator_not_found', 'Operator not found', 404);

  if (action === 'start') {
    if (!workstation) throw new ShiftError('workstation_required', 'Workstation required to start shift');

    const existing = await Operator.findOne({
      workStation: workstation,
      _id: { $ne: operatorId }
    });
    if (existing) throw new ShiftError('workstation_occupied', 'Workstation already occupied');

    operator.workStation = workstation;
  } else if (action === 'end') {
    const incompleteOrders = await Order.countDocuments({
      assignedOperator: operatorId,
      orderProcessingStatus: { $nin: ['completed', 'ready'] }
    });
    if (incompleteOrders > 0) {
      throw new ShiftError(
        'incomplete_orders',
        `Cannot end shift with ${incompleteOrders} incomplete orders`
      );
    }
    operator.workStation = null;
  } else {
    throw new ShiftError('invalid_action', 'Invalid action');
  }

  operator.updatedAt = new Date();
  await operator.save();

  await logAuditEvent(AuditEvents.ACCOUNT_UPDATED, {
    operatorId,
    action: `shift_${action}`,
    workstation,
    timestamp: new Date()
  }, req);

  return { workStation: operator.workStation, updatedAt: operator.updatedAt };
}

function dateRangeForPeriod(period) {
  const endDate = new Date();
  const startDate = new Date();
  switch (period) {
  case 'day':   startDate.setDate(startDate.getDate() - 1); break;
  case 'month': startDate.setMonth(startDate.getMonth() - 1); break;
  case 'week':
  default:      startDate.setDate(startDate.getDate() - 7);
  }
  return { startDate, endDate };
}

async function getPerformanceStats({ operatorId, period = 'week' }) {
  const operator = await Operator.findById(operatorId);
  if (!operator) throw new ShiftError('operator_not_found', 'Operator not found', 404);

  const { startDate, endDate } = dateRangeForPeriod(period);
  const days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));

  const [stats, dailyStats] = await Promise.all([
    Order.aggregate([
      { $match: { assignedOperator: operator._id, processingStarted: { $gte: startDate, $lte: endDate } } },
      { $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        completedOrders: { $sum: { $cond: [{ $eq: ['$orderProcessingStatus', 'completed'] }, 1, 0] } },
        totalWeight: { $sum: '$weight' },
        avgProcessingTime: { $avg: '$processingTimeMinutes' },
        minProcessingTime: { $min: '$processingTimeMinutes' },
        maxProcessingTime: { $max: '$processingTimeMinutes' },
        qualityChecksPassed: { $sum: { $cond: [{ $eq: ['$qualityCheckPassed', true] }, 1, 0] } },
        qualityChecksFailed: { $sum: { $cond: [{ $eq: ['$qualityCheckPassed', false] }, 1, 0] } }
      } }
    ]),
    Order.aggregate([
      { $match: { assignedOperator: operator._id, processingStarted: { $gte: startDate, $lte: endDate } } },
      { $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$processingStarted' } },
        orders: { $sum: 1 },
        weight: { $sum: '$weight' },
        avgTime: { $avg: '$processingTimeMinutes' }
      } },
      { $sort: { _id: 1 } }
    ])
  ]);

  const summary = stats[0] || {
    totalOrders: 0, completedOrders: 0, totalWeight: 0, avgProcessingTime: 0,
    minProcessingTime: 0, maxProcessingTime: 0, qualityChecksPassed: 0, qualityChecksFailed: 0
  };
  const qcTotal = summary.qualityChecksPassed + summary.qualityChecksFailed;

  return {
    operator: {
      name: `${operator.firstName} ${operator.lastName}`,
      operatorId: operator.operatorId,
      qualityScore: operator.qualityScore
    },
    period: { start: startDate, end: endDate, days },
    summary,
    dailyBreakdown: dailyStats,
    efficiency: {
      ordersPerDay: summary.totalOrders / days,
      weightPerDay: summary.totalWeight / days,
      qualityRate: qcTotal > 0 ? Math.round((summary.qualityChecksPassed / qcTotal) * 100) : 100
    }
  };
}

async function getTodayStats({ operatorId }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // "Processed today" spans both orders this operator claimed and any order
  // with bags weighed today (may have been weighed by a different station).
  const query = {
    $or: [
      { assignedOperator: operatorId, processingStarted: { $gte: today } },
      { bagsWeighed: { $gt: 0 }, updatedAt: { $gte: today, $lt: tomorrow } }
    ]
  };

  const [ordersProcessed, todayOrders, ordersReady] = await Promise.all([
    Order.countDocuments(query),
    Order.find(query),
    Order.countDocuments({ status: 'processed', updatedAt: { $gte: today } })
  ]);

  const bagsScanned = todayOrders.reduce((total, order) => total + (order.bagsWeighed || 0), 0);
  return { ordersProcessed, bagsScanned, ordersReady };
}

async function getNewCustomersCount() {
  // No isActive filter: customers may need labels printed before activation.
  return Customer.countDocuments({ bagLabelsGenerated: false });
}

async function printNewCustomerLabels() {
  const customers = await Customer.find({ bagLabelsGenerated: false })
    .select('customerId firstName lastName phone email numberOfBags affiliateId');

  if (customers.length === 0) {
    return { customersProcessed: 0, labelsGenerated: 0, labelData: [], customerIds: [] };
  }

  const labelData = [];
  for (const customer of customers) {
    const bagCount = customer.numberOfBags || 1;
    for (let bagNumber = 1; bagNumber <= bagCount; bagNumber++) {
      labelData.push({
        customerId: customer.customerId,
        customerName: `${customer.firstName} ${customer.lastName}`,
        phone: customer.phone || '',
        email: customer.email || '',
        bagNumber,
        totalBags: bagCount,
        qrCode: `${customer.customerId}-${bagNumber}`,
        affiliateId: customer.affiliateId
      });
    }
  }

  return {
    customersProcessed: customers.length,
    labelsGenerated: labelData.length,
    labelData,
    customerIds: customers.map(c => c._id)
  };
}

async function confirmLabelsPrinted({ customerIds, operatorId }) {
  if (!Array.isArray(customerIds) || customerIds.length === 0) {
    throw new ShiftError('no_customer_ids', 'No customer IDs provided');
  }

  const result = await Customer.updateMany(
    { _id: { $in: customerIds } },
    { $set: {
      bagLabelsGenerated: true,
      bagLabelsGeneratedAt: new Date(),
      bagLabelsGeneratedBy: operatorId
    } }
  );

  return { customersUpdated: result.modifiedCount };
}

module.exports = {
  updateShiftStatus,
  getPerformanceStats,
  getTodayStats,
  getNewCustomersCount,
  printNewCustomerLabels,
  confirmLabelsPrinted,
  ShiftError
};
