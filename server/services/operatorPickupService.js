// Operator pickup service
//
// Handles the post-processing handoff: legacy markOrderReady, bag-verified
// completePickup, and the legacy confirmPickup flow used by affiliates.
// Also owns the payment-reminder helper that the pickup flow can kick off.
//
// Email failures never block the pickup — they're logged and swallowed.

const Order = require('../models/Order');
const Customer = require('../models/Customer');
const Affiliate = require('../models/Affiliate');
const emailService = require('../utils/emailService');
const { logAuditEvent, AuditEvents } = require('../utils/auditLogger');
const logger = require('../utils/logger');

class PickupError extends Error {
  constructor(code, message, status = 400, details = {}) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
    this.isPickupError = true;
  }
}

function affiliateDisplayName(affiliate) {
  return affiliate ? (affiliate.contactPerson || affiliate.businessName) : 'Your laundry service provider';
}

async function sendPaymentReminder(order) {
  try {
    const customer = await Customer.findOne({ customerId: order.customerId });
    if (!customer) {
      logger.error(`Customer not found for order ${order.orderId}`);
      return;
    }

    order.reminderCount = (order.reminderCount || 0) + 1;
    order.lastReminderSentAt = new Date();
    if (!order.paymentReminders) order.paymentReminders = [];
    order.paymentReminders.push({
      sentAt: new Date(),
      reminderNumber: order.reminderCount,
      method: 'email'
    });

    await emailService.sendV2PaymentReminder({
      customer,
      order,
      reminderNumber: order.reminderCount,
      paymentAmount: order.paymentAmount,
      paymentLinks: order.paymentLinks,
      qrCodes: order.paymentQRCodes
    });

    logger.info(`Payment reminder #${order.reminderCount} sent for order ${order.orderId}`);
    await order.save();
  } catch (error) {
    logger.error(`Failed to send payment reminder for order ${order.orderId}:`, error);
  }
}

async function markOrderReady({ orderId, operatorId, req }) {
  const order = await Order.findOne({ orderId });
  if (!order) throw new PickupError('order_not_found', 'Order not found', 404);

  order.processedAt = new Date();
  order.status = 'processed';
  order.bagsProcessed = order.numberOfBags;
  await order.save();

  // Notify affiliate only when every bag is accounted for.
  const affiliateNotified = order.affiliateId && order.bagsProcessed === order.numberOfBags;
  if (affiliateNotified) {
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

  await logAuditEvent(AuditEvents.ORDER_STATUS_CHANGED, {
    operatorId,
    orderId,
    action: 'order_marked_ready',
    affiliateNotified: order.bagsProcessed === order.numberOfBags,
    bagsProcessed: order.bagsProcessed,
    totalBags: order.numberOfBags,
    newStatus: 'ready'
  }, req);

  return order;
}

async function completePickup({ orderId, bagIds, operatorId, req }) {
  logger.info('completePickup called with:', { bagIds, orderId, operatorId });

  const order = await Order.findOne({ orderId });
  if (!order) throw new PickupError('order_not_found', 'Order not found', 404);

  if (bagIds.length !== order.bags.length) {
    throw new PickupError('bag_count_mismatch', 'Bag count mismatch', 400, {
      message: `Expected ${order.bags.length} bags but received ${bagIds.length}`
    });
  }

  const orderBagIds = new Set(order.bags.map(b => b.bagId));
  for (const bagId of new Set(bagIds)) {
    if (!orderBagIds.has(bagId)) {
      throw new PickupError('invalid_bag', 'Invalid bag', 400, {
        message: `Bag ${bagId} does not belong to this order`
      });
    }
  }

  const now = new Date();
  for (const bag of order.bags) {
    bag.status = 'completed';
    bag.scannedAt.completed = now;
    bag.scannedBy.completed = operatorId;
  }

  order.status = 'complete';
  order.completedAt = now;
  order.bagsPickedUp = order.bags.length;

  await order.save();

  // Email notifications are best-effort; never fail the pickup on SMTP hiccup.
  try {
    const customer = await Customer.findOne({ customerId: order.customerId });
    const affiliate = order.affiliateId
      ? await Affiliate.findOne({ affiliateId: order.affiliateId })
      : null;

    if (customer && customer.email) {
      await emailService.sendOrderPickedUpNotification(customer.email, {
        customerName: `${customer.firstName} ${customer.lastName}`,
        orderId: order.orderId,
        numberOfBags: order.bags.length,
        totalWeight: order.actualWeight,
        affiliateName: affiliateDisplayName(affiliate),
        businessName: affiliate ? affiliate.businessName : null
      });
      logger.info(`Delivery notification sent to customer ${customer.email}`);
    }

    if (affiliate && affiliate.email) {
      await emailService.sendAffiliateCommissionEmail(affiliate, order, customer);
      logger.info(`Commission notification sent to affiliate ${affiliate.email}`);
    }
  } catch (emailError) {
    logger.error('Error sending email notifications:', emailError);
  }

  await logAuditEvent(AuditEvents.ORDER_STATUS_CHANGED, {
    operatorId,
    orderId,
    action: 'order_picked_up',
    numberOfBags: order.bags.length,
    newStatus: 'complete'
  }, req);

  return order;
}

async function confirmPickup({ orderId, numberOfBags, operatorId, req }) {
  const order = await Order.findOne({ orderId });
  if (!order) throw new PickupError('order_not_found', 'Order not found', 404);

  const bagsToPickup = numberOfBags || 1;
  order.bagsPickedUp = Math.min(order.bagsPickedUp + bagsToPickup, order.numberOfBags);

  if (order.bagsPickedUp >= order.numberOfBags) {
    order.status = 'complete';
    order.completedAt = new Date();

    if (order.customerId) {
      const customer = await Customer.findOne({ customerId: order.customerId });
      const affiliate = order.affiliateId
        ? await Affiliate.findOne({ affiliateId: order.affiliateId })
        : null;

      if (customer && customer.email) {
        await emailService.sendOrderPickedUpNotification(customer.email, {
          customerName: `${customer.firstName} ${customer.lastName}`,
          orderId: order.orderId,
          numberOfBags: order.numberOfBags,
          totalWeight: order.actualWeight,
          affiliateName: affiliateDisplayName(affiliate),
          businessName: affiliate ? affiliate.businessName : null
        });
      }
    }
  }

  await order.save();

  await logAuditEvent(AuditEvents.ORDER_STATUS_CHANGED, {
    operatorId,
    orderId,
    action: 'bags_pickup_confirmed',
    bagsPickedUp: bagsToPickup,
    totalBagsPickedUp: order.bagsPickedUp,
    orderComplete: order.status === 'complete',
    newStatus: order.status
  }, req);

  return {
    bagsPickedUp: order.bagsPickedUp,
    totalBags: order.numberOfBags,
    orderComplete: order.status === 'complete'
  };
}

module.exports = {
  markOrderReady,
  completePickup,
  confirmPickup,
  sendPaymentReminder,
  PickupError
};
