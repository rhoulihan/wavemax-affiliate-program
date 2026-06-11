// Order context for the bag resolvers (spec §5 resolve row, §6.3/§6.6 d).
// Drives the kiosk + claim-page branch: claim | intake | advance |
// deliver-or-reintake. Deliberately PII-free — status words only.

const Order = require('../../models/Order');

// "Open" = anything not terminally closed (matches orderIntakeService's
// open-order guard: a cancelled/delivered order never blocks re-intake).
const CLOSED_STATUSES = ['delivered', 'cancelled'];

function nextActionFor(order) {
  if (!order) return 'intake';
  return order.status === 'picked_up' ? 'deliver-or-reintake' : 'advance';
}

/**
 * @param {string} bagId - the BAG-uuid join key (Order.bagId == Bag.bagId)
 * @returns {Promise<{order: {status, awaitingDelivery, nextAction}|null, nextAction: string}>}
 */
async function getOpenOrderContext(bagId) {
  const order = await Order.findOne({ bagId, status: { $nin: CLOSED_STATUSES } })
    .select('status');
  if (!order) return { order: null, nextAction: 'intake' };
  const ctx = {
    status: order.status,
    awaitingDelivery: order.status === 'picked_up',
    nextAction: nextActionFor(order)
  };
  return { order: ctx, nextAction: ctx.nextAction };
}

module.exports = { getOpenOrderContext, nextActionFor, CLOSED_STATUSES };
