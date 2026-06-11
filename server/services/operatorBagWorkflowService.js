// Operator bag-workflow service (redesign interim — spec §6.4).
//
// Order birth moved to orderIntakeService.createOrderFromBag; scan context
// comes from bagService.resolveByToken. scanCustomer/weighBags survive one
// sprint as deprecated delegates (move-then-delete house rule); PR 9
// replaces scanProcessed with an orderAdvanceService delegate and deletes
// the stranded legacy functions. Controllers map BagWorkflowError to HTTP.

const Order = require('../models/Order');
const Customer = require('../models/Customer');
const { logAuditEvent, AuditEvents } = require('../utils/auditLogger');
const bagService = require('../modules/bags/bagService');
const orderIntakeService = require('../modules/orders/orderIntakeService');

class BagWorkflowError extends Error {
  constructor(code, message, status = 400, details = {}) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
    this.isBagWorkflowError = true;
  }
}

// DEPRECATED kiosk shim (move-then-delete; PR 9 removes it).
// Scan context now comes from GET /api/v1/bags/resolve/:token — this
// shim keeps the export alive one sprint for stragglers.
async function scanCustomer({ bagToken, operatorId, req }) {
  const resolved = await bagService.resolveByToken(bagToken);
  if (!resolved || !resolved.bag) {
    throw new BagWorkflowError('bag_not_found', 'Bag not found', 404, {
      message: 'Bag not recognized'
    });
  }
  await logAuditEvent(AuditEvents.SENSITIVE_DATA_ACCESS, {
    operatorId,
    bagId: resolved.bag.bagId,
    action: 'bag_scanned',
    outcome: resolved.outcome
  }, req);
  return {
    outcome: resolved.outcome,
    bag: {
      bagId: resolved.bag.bagId,
      status: resolved.bag.status,
      customerId: resolved.bag.customerId,
      affiliateId: resolved.bag.affiliateId
    }
  };
}

// LEGACY — stranded (references pre-redesign Order fields), deleted in PR 9.
async function scanBag({ qrCode }) {
  // Legacy QR (bare customer ID) — callers should fall through to scanCustomer.
  if (!qrCode || !qrCode.includes('#')) {
    return { legacy: true, customerId: qrCode };
  }

  const [customerId, bagId] = qrCode.split('#');

  const customer = await Customer.findOne({ customerId });
  if (!customer) {
    throw new BagWorkflowError('customer_not_found', 'Customer not found', 404, {
      message: 'Invalid customer ID'
    });
  }

  const currentOrder = await Order.findOne({
    customerId: customer.customerId,
    status: { $in: ['in_progress', 'processed'] }
  })
    .sort({ createdAt: -1 })
    .populate('customer', 'firstName lastName phone email address');

  if (!currentOrder) {
    throw new BagWorkflowError('no_active_order', 'No active order', 404, {
      message: 'No active order found for this customer'
    });
  }

  return {
    legacy: false,
    order: currentOrder,
    customer: currentOrder.customer,
    bagId,
    action: 'show_order'
  };
}

// LEGACY — stranded (references pre-redesign Order fields), deleted in PR 9.
async function receiveOrder({ orderId, bagWeights, totalWeight, operatorId, req }) {
  const order = await Order.findOne({ orderId });
  if (!order) throw new BagWorkflowError('order_not_found', 'Order not found', 404);

  order.actualWeight = totalWeight;
  order.status = 'in_progress';
  order.assignedOperator = operatorId;
  order.processingStarted = new Date();
  order.bagsWeighed = (order.bagsWeighed || 0) + bagWeights.length;

  if (!order.bagWeights) order.bagWeights = [];
  bagWeights.forEach(bw => {
    order.bagWeights.push({
      bagNumber: bw.bagNumber,
      weight: bw.weight,
      receivedAt: new Date()
    });
  });

  await order.save();

  await logAuditEvent(AuditEvents.ORDER_STATUS_CHANGED, {
    operatorId,
    orderId,
    action: 'order_received',
    totalWeight,
    numberOfBags: bagWeights.length,
    newStatus: 'in_progress'
  }, req);

  return order;
}

// DEPRECATED kiosk shim (move-then-delete; PR 9 removes it).
// Order birth lives in orderIntakeService.createOrderFromBag.
async function weighBags({ bagToken, weight, addOns, freshAddOnsFormPlaced, operatorId, req }) {
  return orderIntakeService.createOrderFromBag({
    bagToken, weight, addOns, freshAddOnsFormPlaced, operatorId, req
  });
}

// markBagProcessed and scanProcessed were deleted in PR 9: the kiosk's
// stage-2/stage-3 scans now go through orderAdvanceService.advance via
// operatorController.advance (the /scan-processed route is a thin delegate).

module.exports = {
  scanCustomer,
  scanBag,        // LEGACY — stranded
  receiveOrder,   // LEGACY — stranded
  weighBags,
  BagWorkflowError
};
