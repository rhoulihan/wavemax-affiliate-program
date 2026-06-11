// Order intake service — the single place a new-flow order is born (spec §6.4).
//
// createOrderFromBag: resolve the durable bag, guard open orders (Task 3/4
// add the guards + re-intake), set EVERY pricing input before the first
// save (the Order pre-save READS feeBreakdown.totalFee, it does not
// compute the delivery fee), save, generate payment links exactly once,
// email the payment request, audit.

const Order = require('../../models/Order');
const Customer = require('../../models/Customer');
const Affiliate = require('../../models/Affiliate');
const bagService = require('../bags/bagService');
const { applyTransition } = require('./orderStateMachine');
const { calculateDeliveryFee } = require('../../services/orderPricingService');
const paymentLinkService = require('../../services/paymentLinkService');
const emailService = require('../../utils/emailService');
const { logAuditEvent, AuditEvents } = require('../../utils/auditLogger');
const logger = require('../../utils/logger');

class IntakeError extends Error {
  constructor(code, message, status = 400, details = {}) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
    this.isIntakeError = true;
  }
}

/**
 * Re-intake rule (spec §6.4 step 1): a picked_up order whose bag is being
 * scanned back IN was delivered but never confirmed — close it as
 * delivered exactly once, realize commission, notify, then the caller
 * opens the new order.
 */
async function autoDeliverPickedUpOrder(order, operatorId, req) {
  applyTransition(order, 'delivered'); // validates picked_up -> delivered; pre-save stamps deliveredAt + commissionRealizedAt set-once
  order.commissionRealized = true;
  order.proofOfDelivery = {
    method: 'reintake',
    confirmedByRole: 'operator',
    confirmedById: String(operatorId),
    confirmedAt: new Date()
  };
  if (order.bags && order.bags[0]) {
    order.bags[0].status = 'delivered';
    order.bags[0].scannedAt.delivered = new Date();
    // bags[].scannedBy.delivered is typed String ref Affiliate (door scans);
    // re-intake is operator-confirmed, recorded in proofOfDelivery instead.
  }
  if (order.intake) {
    order.intake.deliveredAt = new Date();
  }
  await order.save();

  const customer = await Customer.findOne({ customerId: order.customerId });
  const affiliate = await Affiliate.findOne({ affiliateId: order.affiliateId });
  try {
    if (customer) {
      await emailService.sendCustomerDeliveredEmail(customer, order);
    }
    if (affiliate && customer) {
      await emailService.sendAffiliateCommissionEmail(affiliate, order, customer);
    }
  } catch (emailError) {
    logger.error(`Re-intake delivery emails failed for order ${order.orderId}:`, emailError);
  }

  await logAuditEvent(AuditEvents.ORDER_REINTAKE, {
    operatorId,
    orderId: order.orderId,
    bagId: order.bagId,
    action: 'auto_delivered_on_reintake'
  }, req);

  logger.info(`Re-intake: order ${order.orderId} auto-delivered (bag ${order.bagId})`);
}

/**
 * Create exactly one order from a bag intake.
 * @param {Object} args
 * @param {string} args.bagToken - the opaque 32-hex Bag.token (scan key)
 * @param {number} args.weight - actual weight in lbs (operator-entered)
 * @param {Object} [args.addOns] - { premiumDetergent, fabricSoftener, stainRemover }
 * @param {boolean} [args.freshAddOnsFormPlaced] - operator ack: fresh form in the pocket
 * @param {ObjectId|string} args.operatorId - kiosk JWT operator (PR 9 adds scan-code resolution)
 * @param {Object} [args.req] - Express request for audit context
 * @returns {Promise<{order: Order, reIntake: boolean}>}
 * @throws {IntakeError} invalid_weight(400) | invalid_bag(404) | bag_not_active(409)
 *                       | order_already_open(409) | bag_links_broken(409)
 */
async function createOrderFromBag({ bagToken, weight, addOns, freshAddOnsFormPlaced, operatorId, req }) {
  const parsedWeight = parseFloat(weight);
  if (!parsedWeight || parsedWeight <= 0) {
    throw new IntakeError('invalid_weight', 'A positive weight is required', 400);
  }

  // 1. Resolve the bag (generic 404 — anti-enumeration, spec §9).
  const resolved = await bagService.resolveByToken(bagToken);
  if (!resolved || !resolved.bag) {
    throw new IntakeError('invalid_bag', 'Bag not recognized', 404);
  }
  const bag = resolved.bag;
  if (bag.status !== 'active') {
    throw new IntakeError('bag_not_active', 'Bag is not active', 409);
  }

  // Open-order check BEFORE counters are bumped (Task 3 adds the 409,
  // Task 4 adds the picked_up re-intake auto-deliver). A cancelled or
  // delivered order never blocks re-intake (PR 6 contract).
  const openOrder = await Order.findOne({
    bagId: bag.bagId,
    status: { $nin: ['delivered', 'cancelled'] }
  }).sort({ createdAt: -1 });
  const reIntake = !!(openOrder && openOrder.status === 'picked_up');
  if (openOrder && !reIntake) {
    // Bag never left the store — advance the existing order, don't re-intake.
    throw new IntakeError(
      'order_already_open',
      `Order ${openOrder.orderId} is already open for this bag (${openOrder.status})`,
      409,
      { orderId: openOrder.orderId, status: openOrder.status }
    );
  }
  if (reIntake) {
    await autoDeliverPickedUpOrder(openOrder, operatorId, req);
  }

  // Lifetime counters (++orderCount / lastIntakeAt) — PR 6 static.
  await bagService.linkToOrderAtIntake({ token: bagToken, operatorId });

  // 2. Relationship comes from the bag — never from client input (spec §9).
  const customer = await Customer.findOne({ customerId: bag.customerId });
  const affiliate = await Affiliate.findOne({ affiliateId: bag.affiliateId });
  if (!customer || !affiliate) {
    throw new IntakeError('bag_links_broken', 'Bag is not linked to an active customer/affiliate', 409);
  }

  // 3. Delivery fee for exactly one bag (one bag = one order).
  const feeCalculation = await calculateDeliveryFee(1, affiliate);

  // Carry-in WDF credit applies at intake (spec §4.4).
  let wdfCreditToApply = 0;
  if (customer.wdfCredit && customer.wdfCredit !== 0) {
    wdfCreditToApply = customer.wdfCredit;
    logger.info(`Applying WDF credit of $${wdfCreditToApply} at intake for customer ${customer.customerId}`);
  }

  const now = new Date();

  // 4. EVERY pricing input set before the first save.
  const order = new Order({
    customerId: customer.customerId,
    affiliateId: affiliate.affiliateId,
    bagId: bag.bagId,        // BAG-uuid join key
    bagToken: bag.token,     // 32-hex scan key
    status: 'in_progress',
    actualWeight: parsedWeight,
    addOns: {
      premiumDetergent: !!(addOns && addOns.premiumDetergent),
      fabricSoftener: !!(addOns && addOns.fabricSoftener),
      stainRemover: !!(addOns && addOns.stainRemover)
    },
    addOnsEnteredBy: operatorId,
    addOnsEnteredAt: now,
    freshAddOnsFormPlaced: !!freshAddOnsFormPlaced,
    freshAddOnsFormAckBy: freshAddOnsFormPlaced ? operatorId : undefined,
    freshAddOnsFormAckAt: freshAddOnsFormPlaced ? now : undefined,
    feeBreakdown: { ...feeCalculation },   // pre-save READS totalFee — omit and everything zeroes
    wdfCreditApplied: wdfCreditToApply,
    intakeAt: now,
    assignedOperator: operatorId,
    intake: {
      weight: parsedWeight,
      weighedAt: now,
      weighedBy: operatorId,
      addOnFormPlaced: !!freshAddOnsFormPlaced,
      addOnFormPlacedAt: freshAddOnsFormPlaced ? now : undefined
    },
    bags: [{
      bagToken: bag.token,   // canon: bags[] uses bagToken, NEVER bagId
      bagNumber: 1,
      status: 'intake',
      weight: parsedWeight,
      scannedAt: { intake: now },
      scannedBy: { intake: operatorId }
    }]
  });

  // 5. Save — pre-save computes actualTotal / paymentAmount / affiliateCommission.
  await order.save();

  if (wdfCreditToApply !== 0) {
    customer.wdfCredit = 0;
    customer.wdfCreditUpdatedAt = now;
    await customer.save();
  }

  // 6. Payment links/QR generated exactly ONCE (spec §6.4 step 6).
  const customerName = `${customer.firstName} ${customer.lastName}`;
  const { links, qrCodes } = await paymentLinkService.generatePaymentLinks(
    order.orderId, order.paymentAmount, customerName
  );
  order.paymentLinks = links;
  order.paymentQRCodes = qrCodes;
  order.paymentStatus = 'awaiting';
  order.paymentRequestedAt = new Date();
  await order.save();

  // 7. Payment request email (best-effort) + audit.
  try {
    await emailService.sendV2PaymentRequest({
      customer, order,
      paymentAmount: order.paymentAmount,
      paymentLinks: links,
      qrCodes
    });
  } catch (emailError) {
    logger.error(`Failed to send payment request for order ${order.orderId}:`, emailError);
  }

  await logAuditEvent(AuditEvents.ORDER_STATUS_CHANGED, {
    operatorId,
    orderId: order.orderId,
    bagId: bag.bagId,
    action: 'order_created_at_intake',
    weight: parsedWeight,
    paymentAmount: order.paymentAmount
  }, req);

  logger.info(`Order ${order.orderId} created at intake for bag ${bag.bagId} (${parsedWeight} lbs, $${order.paymentAmount})`);
  return { order, reIntake };
}

module.exports = { createOrderFromBag, IntakeError };
