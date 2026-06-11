// Operator bag-workflow service (redesign interim — spec §6.4).
//
// Order birth moved to orderIntakeService.createOrderFromBag; scan context
// comes from bagService.resolveByToken. scanCustomer/weighBags survive one
// sprint as deprecated delegates (move-then-delete house rule); PR 9
// replaces scanProcessed with an orderAdvanceService delegate and deletes
// the stranded legacy functions. Controllers map BagWorkflowError to HTTP.

const Order = require('../models/Order');
const Customer = require('../models/Customer');
const Affiliate = require('../models/Affiliate');
const emailService = require('../utils/emailService');
const { logAuditEvent, AuditEvents } = require('../utils/auditLogger');
const logger = require('../utils/logger');
const bagService = require('../modules/bags/bagService');
const orderIntakeService = require('../modules/orders/orderIntakeService');
const pickupService = require('./operatorPickupService');

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

// LEGACY — stranded (references pre-redesign Order fields), deleted in PR 9.
async function markBagProcessed({ orderId, operatorId, req }) {
  const order = await Order.findOne({ orderId });
  if (!order) throw new BagWorkflowError('order_not_found', 'Order not found', 404);

  order.bagsProcessed = Math.min((order.bagsProcessed || 0) + 1, order.numberOfBags);
  const allProcessed = order.bagsProcessed === order.numberOfBags;

  if (allProcessed) {
    order.processedAt = new Date();
    order.status = 'processed';

    if (order.affiliateId) {
      const affiliate = await Affiliate.findOne({ affiliateId: order.affiliateId });

      let customerName = 'N/A';
      if (order.customerId) {
        const customer = await Customer.findOne({ customerId: order.customerId });
        if (customer) customerName = `${customer.firstName} ${customer.lastName}`;
      }

      if (affiliate && affiliate.email) {
        await emailService.sendOrderReadyNotification(affiliate.email, {
          affiliateName: affiliate.contactPerson || affiliate.businessName,
          orderId: order.orderId,
          customerName,
          numberOfBags: order.numberOfBags,
          totalWeight: order.actualWeight
        });
      }
    }
  }

  await order.save();

  await logAuditEvent(AuditEvents.ORDER_STATUS_CHANGED, {
    operatorId,
    orderId,
    action: 'bag_processed',
    bagNumber: order.bagsProcessed,
    totalBags: order.numberOfBags,
    allBagsProcessed: allProcessed,
    affiliateNotified: allProcessed
  }, req);

  return {
    bagsProcessed: order.bagsProcessed,
    totalBags: order.numberOfBags,
    orderReady: allProcessed
  };
}

async function scanProcessed({ qrCode, operatorId, req }) {
  logger.info('scanProcessed called with:', { qrCode, operatorId });

  if (!qrCode || !qrCode.includes('#')) {
    throw new BagWorkflowError('invalid_qr', 'Invalid QR code format', 400, {
      message: 'Expected format: customerId#bagId'
    });
  }

  const [customerId, bagId] = qrCode.split('#');

  const order = await Order.findOne({
    customerId,
    'bags.bagToken': bagId,
    status: { $in: ['in_progress', 'processed'] }
  });

  if (!order) {
    throw new BagWorkflowError('bag_not_found', 'Bag not found', 404, {
      message: 'This bag is not associated with any active order'
    });
  }

  // Order has no schema ref to Customer; attach one for downstream emails.
  const customer = await Customer.findOne({ customerId: order.customerId });
  if (customer) order.customer = customer;

  const bag = order.bags.find(b => b.bagToken === bagId);

  if (bag.status === 'processed') {
    const allBagsProcessed = order.bags.every(b => b.status === 'processed' || b.status === 'picked_up');
    if (allBagsProcessed) {
      return { action: 'show_pickup_modal', order, allBagsProcessed: true };
    }
    const remainingBags = order.bags.filter(b => b.status === 'intake').length;
    return {
      warning: 'duplicate_scan',
      message: `This bag has already been processed. ${remainingBags} bags still need processing.`,
      bag: {
        bagId: bag.bagToken,
        bagNumber: bag.bagNumber,
        status: bag.status,
        processedAt: bag.scannedAt.processed
      },
      remainingCount: remainingBags
    };
  }

  bag.status = 'processed';
  bag.scannedAt.processed = new Date();
  bag.scannedBy.processed = operatorId;

  order.bagsProcessed = order.bags.filter(
    b => b.status === 'processed' || b.status === 'picked_up'
  ).length;
  const allBagsProcessed = order.bags.every(
    b => b.status === 'processed' || b.status === 'picked_up'
  );

  if (allBagsProcessed) {
    order.processedAt = new Date();
    order.status = 'processed';

    if (order.paymentStatus === 'verified' || order.paymentStatus === 'paid') {
      // Paid — notify affiliate only; customer is notified after actual pickup.
      if (order.affiliateId) {
        const affiliate = await Affiliate.findOne({ affiliateId: order.affiliateId });
        if (affiliate && affiliate.email) {
          await emailService.sendOrderReadyNotification(affiliate.email, {
            orderId: order.orderId,
            customerName: `${order.customer.firstName} ${order.customer.lastName}`,
            customerPhone: order.customer.phone,
            numberOfBags: order.numberOfBags,
            totalWeight: order.actualWeight,
            finalTotal: order.actualTotal || order.estimatedTotal,
            address: `${order.customer.address.street}, ${order.customer.address.city}, ${order.customer.address.state} ${order.customer.address.zip}`
          });
          logger.info(`Ready for pickup notification sent to affiliate ${affiliate.email} for order ${order.orderId}`);
        }
      }
    } else {
      // Unpaid — nudge the customer before anything ships.
      await pickupService.sendPaymentReminder(order);
      logger.info(`Order ${order.orderId} processed but awaiting payment. Reminder sent.`);
    }
  }

  await order.save();

  await logAuditEvent(AuditEvents.ORDER_STATUS_CHANGED, {
    operatorId,
    orderId: order.orderId,
    action: 'bag_processed',
    bagId,
    bagNumber: bag.bagNumber,
    bagsProcessed: order.bagsProcessed,
    totalBags: order.bags.length,
    allBagsProcessed
  }, req);

  if (allBagsProcessed) {
    return { action: 'show_pickup_modal', order, allBagsProcessed: true };
  }
  return {
    order,
    bag: {
      bagId: bag.bagToken,
      bagNumber: bag.bagNumber,
      status: bag.status,
      weight: bag.weight
    },
    orderProgress: {
      totalBags: order.bags.length,
      bagsWeighed: order.bags.length,
      bagsProcessed: order.bagsProcessed,
      bagsCompleted: order.bags.filter(b => b.status === 'picked_up').length
    }
  };
}

module.exports = {
  scanCustomer,
  scanBag,        // LEGACY — stranded, deleted in PR 9
  receiveOrder,   // LEGACY — stranded, deleted in PR 9
  weighBags,
  markBagProcessed, // LEGACY — stranded, deleted in PR 9
  scanProcessed,
  BagWorkflowError
};
