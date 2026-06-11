// State-driven one-step order advance — the "scan it again" engine (spec §6.4).
//
//   in_progress      -> processed   (stamp scan-2; then run the ready gate)
//   processed        -> 409 awaiting_payment when unpaid (held); the gate is
//                       re-run defensively first (idempotent heal)
//   ready_for_pickup -> picked_up   (operator scan-OUT: stamp scan-3, rotate +
//                       email the customer delivery PIN; NO commission here)
//   picked_up        -> 409 (deliver or re-intake — not this service)
//
// Shared by the kiosk (operator JWT) and the overloaded bag URL (operator
// scan code). `operatorId` is the resolved Operator _id either way.

const Bag = require('../bags/Bag');
const Order = require('../../models/Order');
const Customer = require('../../models/Customer');
const Affiliate = require('../../models/Affiliate');
const SystemConfig = require('../../models/SystemConfig');
const { applyTransition } = require('./orderStateMachine');
const orderReadyGateService = require('../../services/orderReadyGateService');
const emailService = require('../../utils/emailService');
const roleCodes = require('../../utils/roleCodes');
const { logAuditEvent, AuditEvents } = require('../../utils/auditLogger');
const logger = require('../../utils/logger');

const OPEN_STATUSES = ['in_progress', 'processed', 'ready_for_pickup', 'picked_up'];

class AdvanceError extends Error {
  constructor(code, message, status = 409) {
    super(message);
    this.code = code;
    this.status = status;
    this.isAdvanceError = true;
  }
}

/**
 * Advance the bag's open order one lifecycle step.
 * @param {object} args
 * @param {string} args.bagToken  - raw 32-hex bag token
 * @param {*}      args.operatorId - Operator _id (JWT id or code-resolved)
 * @param {object} [args.req]     - Express request (audit context)
 * @returns {Promise<{order: object, action: string}>}
 * @throws {AdvanceError}
 */
async function advance({ bagToken, operatorId, req }) {
  const bag = await Bag.findOne({ tokenHash: Bag.hashToken(bagToken) });
  if (!bag) throw new AdvanceError('invalid_bag', 'Bag not found', 404);

  const order = await Order.findOne({ bagId: bag.bagId, status: { $in: OPEN_STATUSES } });
  if (!order) throw new AdvanceError('no_open_order', 'No open order for this bag', 409);

  const now = new Date();

  if (order.status === 'in_progress') {
    applyTransition(order, 'processed');
    order.intake.processedAt = now;
    order.intake.processedBy = operatorId;
    if (order.bags[0]) {
      order.bags[0].status = 'processed';
      order.bags[0].scannedAt.processed = now;
      order.bags[0].scannedBy.processed = operatorId;
    }
    await order.save();
    // Gate: promotes to ready_for_pickup iff paid; else marks heldAtStore.
    await orderReadyGateService.applyReadyGate(order, { trigger: 'processed' });
    logAuditEvent(AuditEvents.OPERATOR_SCAN, {
      action: 'advance_processed', orderId: order.orderId, bagId: bag.bagId, operatorId
    }, req);
    return { order, action: order.status === 'ready_for_pickup' ? 'ready_for_pickup' : 'processed' };
  }

  if (order.status === 'processed') {
    // Defensive idempotent heal — if payment verified since the last scan,
    // the gate promotes; otherwise the order is held and the scan is a no-op.
    await orderReadyGateService.applyReadyGate(order, { trigger: 'advance_rescan' });
    if (order.status !== 'ready_for_pickup') {
      throw new AdvanceError('awaiting_payment', 'Order is processed but unpaid — held at store', 409);
    }
    logAuditEvent(AuditEvents.OPERATOR_SCAN, {
      action: 'advance_gate_heal', orderId: order.orderId, bagId: bag.bagId, operatorId
    }, req);
    return { order, action: 'ready_for_pickup' };
  }

  if (order.status === 'ready_for_pickup') {
    if (order.paymentStatus !== 'verified') {
      // Defensive — the gate is the only path here and it requires verified.
      throw new AdvanceError('awaiting_payment', 'Payment not verified', 409);
    }
    applyTransition(order, 'picked_up');
    order.intake.pickedUpAt = now;
    order.intake.pickedUpBy = operatorId;
    if (order.bags[0]) {
      order.bags[0].status = 'picked_up';
      order.bags[0].scannedAt.picked_up = now;
      order.bags[0].scannedBy.picked_up = operatorId;
    }
    await order.save();

    // Rotate the delivery PIN: only a PBKDF2 hash exists at rest, so a fresh
    // PIN is minted per scan-out and the plaintext rides in the email the
    // customer needs at the door (spec §6.4/§6.6 + §4.5 hash-only storage).
    const customer = await Customer.findOne({ customerId: order.customerId });
    let deliveryPin = null;
    if (customer) {
      const pinLength = await SystemConfig.getValue('customer_delivery_pin_length', 6);
      deliveryPin = roleCodes.generateCode(pinLength);
      customer.deliveryPinHash = roleCodes.hashCode(deliveryPin);
      customer.deliveryPinSetAt = now;
      await customer.save();
    }

    try {
      if (customer && customer.email) {
        const affiliate = order.affiliateId
          ? await Affiliate.findOne({ affiliateId: order.affiliateId })
          : null;
        await emailService.sendOrderOnTheWayEmail(customer, order, {
          deliveryPin,
          affiliateName: affiliate
            ? (affiliate.businessName || `${affiliate.firstName} ${affiliate.lastName}`)
            : null
        });
      }
    } catch (emailError) {
      logger.error(`On-the-way email failed for order ${order.orderId} (non-blocking):`, emailError);
    }

    logAuditEvent(AuditEvents.OPERATOR_SCAN, {
      action: 'scan_out', orderId: order.orderId, bagId: bag.bagId, operatorId
    }, req);
    return { order, action: 'picked_up' };
  }

  // picked_up — the door confirm (delivery code) or re-intake (operator code
  // on the intake endpoint) owns this state.
  throw new AdvanceError('awaiting_delivery_confirmation',
    'Bag is out for delivery — confirm delivery or re-intake it', 409);
}

module.exports = { advance, AdvanceError, OPEN_STATUSES };
