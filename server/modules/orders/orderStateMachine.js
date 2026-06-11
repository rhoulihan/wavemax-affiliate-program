// Single source of truth for order-status transitions (design §6.4).
// Replaces the duplicate maps that previously lived in orderController
// (updateOrderStatus validTransitions + checkStatusTransition) and the
// hardcoded status lists in orderBulkService.

const TRANSITIONS = {
  in_progress: ['processed', 'cancelled'],
  processed: ['ready_for_pickup', 'cancelled'],
  ready_for_pickup: ['picked_up'],
  picked_up: ['delivered'],
  delivered: [],
  cancelled: []
};

class TransitionError extends Error {
  constructor(from, to) {
    super(`Invalid status transition from ${from} to ${to}`);
    this.code = 'invalid_transition';
    this.statusCode = 400;
    Error.captureStackTrace(this, this.constructor);
  }
}

function canTransition(from, to) {
  return Array.isArray(TRANSITIONS[from]) && TRANSITIONS[from].includes(to);
}

/**
 * Validate + apply a transition on an order document and stamp the matching
 * lifecycle timestamp (set-once). Does NOT save — callers own persistence.
 *
 * readyForPickupAt is deliberately NOT stamped here: its sole writer is
 * orderReadyGateService.applyReadyGate (design §4.4, settled decision §13 #3).
 *
 * @param {Object} order - mongoose Order doc (or plain object in unit tests)
 * @param {string} to - target status
 * @returns {Object} the mutated order
 * @throws {TransitionError} when TRANSITIONS does not allow the move
 */
function applyTransition(order, to) {
  if (!canTransition(order.status, to)) {
    throw new TransitionError(order.status, to);
  }
  order.status = to;
  const now = new Date();
  switch (to) {
  case 'processed':
    if (!order.processedAt) order.processedAt = now;
    break;
  case 'picked_up':
    if (!order.pickedUpAt) order.pickedUpAt = now;
    break;
  case 'delivered':
    if (!order.deliveredAt) order.deliveredAt = now;
    if (!order.commissionRealized) {
      order.commissionRealized = true;
      order.commissionRealizedAt = now;
    }
    break;
  case 'cancelled':
    if (!order.cancelledAt) order.cancelledAt = now;
    break;
  }
  return order;
}

// Callers needing the ready gate require server/services/orderReadyGateService
// directly (applyReadyGate is canonical; a delegate here would create a static
// require cycle — the gate service requires this module for applyTransition).
module.exports = { TRANSITIONS, canTransition, applyTransition, TransitionError };
