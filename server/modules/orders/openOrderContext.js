// Order context for the bag resolvers (spec §3/§5). Drives the kiosk + claim-
// page next-action hint. Deliberately PII-free — status words only.
//
// nextAction vocab (state-driven, spec §3):
//   no open order      -> 'pickup'       (scan 1 creates a pending order)
//   pending            -> 'intake'       (scan 2 -> in_progress)
//   in_progress        -> 'store-pickup' (scan 3 -> out_for_delivery)
//   out_for_delivery   -> 'delivery'     (scan 4 -> complete)

const Order = require('../../models/Order');
const { OPEN_STATUSES, CLOSED_STATUSES } = require('./orderStateMachine');

const NEXT_ACTION = {
  pending: 'intake',
  in_progress: 'store-pickup',
  out_for_delivery: 'delivery'
};

function nextActionFor(order) {
  if (!order) return 'pickup';
  return NEXT_ACTION[order.status] || 'pickup';
}

/**
 * @param {string} bagId - the BAG-uuid join key (Order.bagId == Bag.bagId)
 * @returns {Promise<{order: {status, nextAction}|null, nextAction: string}>}
 */
async function getOpenOrderContext(bagId) {
  const order = await Order.findOne({ bagId, status: { $in: OPEN_STATUSES } })
    .select('status');
  if (!order) return { order: null, nextAction: 'pickup' };
  const ctx = { status: order.status, nextAction: nextActionFor(order) };
  return { order: ctx, nextAction: ctx.nextAction };
}

module.exports = { getOpenOrderContext, nextActionFor, OPEN_STATUSES, CLOSED_STATUSES };
