// Order transition service — the seam the scan-session layer (PR 4/5) calls.
//
// Phase 1 model: the order is born at PICKUP (scan 1) and walks the 4-state
// machine via state-driven advances. There is no pricing, weight, payment, or
// commission here — money lives in Cents (external). Every entry point takes
// the resolved Bag plus { by, role, req }: `by` is the scanner id (affiliateId
// for partners, Operator _id for kiosk), `role` disambiguates.
//
//   createPendingOrder  scan 1  (no open order) -> pending
//   advanceOrder        scans 2-4, state-driven; also opens a new pending when
//                       the bag has no open order (or a stale-complete one)
//   cancelOrder         explicit cancel (undo / admin)
//   undoLastTransition  reverse the last applied step (mis-scan safety net)

const Order = require('../../models/Order');
const Customer = require('../../models/Customer');
const Affiliate = require('../../models/Affiliate');
const SystemConfig = require('../../models/SystemConfig');
const emailService = require('../../utils/emailService');
const {
  applyTransition, resolveScanAction, OPEN_STATUSES
} = require('./orderStateMachine');
const { logAuditEvent, AuditEvents } = require('../../utils/auditLogger');
const logger = require('../../utils/logger');

class TransitionServiceError extends Error {
  constructor(code, message, status = 400, details = {}) {
    super(message);
    this.code = code;
    this.status = status;
    this.statusCode = status;
    this.details = details;
    this.isTransitionError = true;
  }
}

async function getReopenWindowMs() {
  const minutes = await SystemConfig.getValue('order_reopen_window_minutes', 240);
  return minutes * 60 * 1000;
}

function findOpenOrder(bagId) {
  return Order.findOne({ bagId, status: { $in: OPEN_STATUSES } }).sort({ createdAt: -1 });
}

/**
 * Scan 1 — pickup at partner. Creates exactly one pending order. The customer/
 * affiliate ids come from the registered bag, never from client input.
 * @param {Object} args
 * @param {Object} args.bag   - resolved Bag doc (status 'active', has customerId)
 * @param {string} args.by    - scanner id
 * @param {string} args.role  - 'affiliate' | 'operator'
 * @param {Object} [args.req] - Express request (audit context)
 * @returns {Promise<{order: Order}>}
 * @throws {TransitionServiceError} bag_not_registered | order_already_open
 */
async function createPendingOrder({ bag, by, role, req }) {
  if (!bag || bag.status !== 'active' || !bag.customerId) {
    throw new TransitionServiceError('bag_not_registered',
      'Bag is not registered to a customer', 409);
  }

  // Open-order guard: at most one open order per bag, enforced here at the
  // application layer (no DB constraint — the Oracle ADB Mongo API rejects the
  // partial unique index that would otherwise backstop a true concurrent race;
  // at this volume a double-pickup-scan race is not a realistic concern).
  const existing = await findOpenOrder(bag.bagId);
  if (existing) {
    throw new TransitionServiceError('order_already_open',
      `Order ${existing.orderId} is already open for this bag (${existing.status})`,
      409, { bagId: bag.bagId, orderId: existing.orderId, status: existing.status });
  }

  const now = new Date();
  const order = new Order({
    customerId: bag.customerId,
    affiliateId: bag.affiliateId,
    bagId: bag.bagId,
    bagToken: bag.token,
    status: 'pending',
    pickup: { at: now, by, role }
  });

  await order.save();

  await logAuditEvent(AuditEvents.ORDER_CREATED, {
    orderId: order.orderId, bagId: bag.bagId, by, role, action: 'pickup'
  }, req);
  logger.info('Order created at pickup', { orderId: order.orderId, bagId: bag.bagId });
  await notifyTransition(order, { event: 'created' });
  return { order };
}

/**
 * State-driven advance. Resolves the bag's open order, computes the single
 * next action, and applies it. With no open order (or a stale-complete one) it
 * opens a fresh pending order. Within the reopen window a completed bag returns
 * a delivery-rescan-prompt for the scan UI (PR 4) to confirm — call
 * createPendingOrder on "yes".
 *
 * @param {Object} args
 * @param {Object} args.bag
 * @param {string} args.by
 * @param {string} args.role
 * @param {boolean} [args.paymentConfirmed] - store-pickup manual payment checkbox
 * @param {Object} [args.req]
 * @returns {Promise<{order?: Order, action: string, to?: string, orderId?: string}>}
 */
async function advanceOrder({ bag, by, role, paymentConfirmed, req }) {
  if (!bag || bag.status !== 'active' || !bag.customerId) {
    throw new TransitionServiceError('bag_not_registered',
      'Bag is not registered to a customer', 409);
  }

  const order = await findOpenOrder(bag.bagId);
  const now = new Date();
  const reopenWindowMs = await getReopenWindowMs();

  // Resolve from the open order, or the most recent closed order (to honour
  // the reopen window on a freshly-completed bag).
  let referenceOrder = order;
  if (!referenceOrder) {
    referenceOrder = await Order.findOne({ bagId: bag.bagId }).sort({ createdAt: -1 });
  }

  const decision = resolveScanAction(referenceOrder, { now, reopenWindowMs });

  if (decision.action === 'create-pending') {
    const { order: created } = await createPendingOrder({ bag, by, role, req });
    return { order: created, action: 'create-pending' };
  }

  if (decision.action === 'delivery-rescan-prompt') {
    return { action: 'delivery-rescan-prompt', orderId: decision.orderId };
  }

  // advance
  applyTransition(order, decision.to, { by, role, at: now, paymentConfirmed });
  await order.save();

  await logAuditEvent(AuditEvents.OPERATOR_SCAN, {
    orderId: order.orderId, bagId: bag.bagId, by, role,
    action: 'advance', to: order.status
  }, req);

  // Notify on the new state (in_progress / out_for_delivery / complete).
  await notifyTransition(order, { event: order.status });

  return { order, action: 'advance', to: order.status };
}

/**
 * Best-effort per-transition notifications. NEVER throws into the scan flow.
 *
 * Customer is emailed on EVERY state change. The affiliate is emailed only when
 * a customer starts an order (pickup.role === 'customer') and when the order is
 * ready for pickup — and only if the affiliate has order notifications enabled
 * (default off; full_service defaults on — see Affiliate model). Both sends run
 * in parallel and failures are swallowed (logged), so a flaky SMTP never blocks
 * or fails a scan.
 *
 * @param {Order} order
 * @param {{event: 'created'|'in_progress'|'out_for_delivery'|'complete'|'cancelled'}} opts
 */
async function notifyTransition(order, { event }) {
  try {
    const [customer, affiliate] = await Promise.all([
      Customer.findOne({ customerId: order.customerId }),
      Affiliate.findOne({ affiliateId: order.affiliateId })
    ]);
    const affiliateName = affiliate
      ? (affiliate.businessName || `${affiliate.firstName} ${affiliate.lastName}`)
      : null;

    const sends = [];

    // Customer — every state change.
    if (customer && customer.email) {
      if (event === 'created') {
        sends.push(emailService.sendOrderStatusUpdateEmail(customer, order, 'pending'));
      } else if (event === 'in_progress' || event === 'out_for_delivery') {
        sends.push(emailService.sendOrderStatusUpdateEmail(customer, order, event));
      } else if (event === 'complete') {
        sends.push(emailService.sendCustomerDeliveredEmail(customer, order, { affiliateName }));
      } else if (event === 'cancelled') {
        sends.push(emailService.sendOrderCancellationEmail(customer, order));
      }
    }

    // Affiliate — gated on opt-in; only on customer-started creation + ready.
    if (affiliate && affiliate.orderNotificationsEnabled && affiliate.email) {
      if (event === 'created' && order.pickup && order.pickup.role === 'customer') {
        sends.push(emailService.sendAffiliateNewOrderEmail(affiliate, customer, order));
      } else if (event === 'out_for_delivery') {
        sends.push(emailService.sendAffiliateOrderReadyEmail(affiliate, order, customer));
      }
    }

    await Promise.allSettled(sends);
  } catch (err) {
    logger.error(`Order notification failed for ${order.orderId} event=${event} (non-blocking):`, err);
  }
}

/**
 * Cancel an open order. by/role recorded in the audit trail.
 * @param {Object} args
 * @param {Order} args.order
 * @param {string} args.by
 * @param {string} args.role
 * @param {Object} [args.req]
 */
async function cancelOrder({ order, by, role, req }) {
  applyTransition(order, 'cancelled', { by, role });
  await order.save();
  await logAuditEvent(AuditEvents.ORDER_CANCELLED, {
    orderId: order.orderId, bagId: order.bagId, by, role
  }, req);
  await notifyTransition(order, { event: 'cancelled' });
  return { order };
}

/**
 * Reverse the last applied transition (mis-scan safety net). A just-created
 * pending order is deleted; otherwise the status rolls back one step:
 *   out_for_delivery -> in_progress -> pending. Always audited.
 *
 * @param {Object} args
 * @param {Order} args.order
 * @param {string} args.by
 * @param {Object} [args.req]
 * @returns {Promise<{undone: string, order?: Order}>}
 */
async function undoLastTransition({ order, by, req }) {
  const PREV = {
    out_for_delivery: 'in_progress',
    in_progress: 'pending'
  };

  if (order.status === 'pending') {
    const orderId = order.orderId;
    await Order.deleteOne({ orderId });
    await logAuditEvent(AuditEvents.ORDER_UNDO, {
      orderId, bagId: order.bagId, by, action: 'deleted_pending'
    }, req);
    return { undone: 'deleted' };
  }

  const prev = PREV[order.status];
  if (!prev) {
    throw new TransitionServiceError('cannot_undo',
      `Cannot undo from status ${order.status}`, 400);
  }

  const from = order.status;
  order.status = prev;
  // Clear the stamp + terminal marker for the step we reversed.
  if (from === 'out_for_delivery') {
    order.storePickup = undefined;
    order.paymentConfirmedManually = false;
  } else if (from === 'in_progress') {
    order.intake = undefined;
  }
  await order.save();

  await logAuditEvent(AuditEvents.ORDER_UNDO, {
    orderId: order.orderId, bagId: order.bagId, by, from, to: prev
  }, req);
  return { undone: 'rolled_back', order };
}

module.exports = {
  createPendingOrder,
  advanceOrder,
  cancelOrder,
  undoLastTransition,
  TransitionServiceError
};
