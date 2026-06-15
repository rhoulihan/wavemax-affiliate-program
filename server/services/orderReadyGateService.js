// THE canonical "ready for pickup" gate.
//
//   ready_for_pickup  IFF  status === 'processed'
//
// Payment was removed in Phase 1 (all money lives in Cents, external), so the
// processed -> ready_for_pickup promotion is now UNCONDITIONAL. This is an
// INTERIM implementation — PR 3 replaces this service entirely with the
// rewritten lifecycle.
//
// This service is the SOLE writer of Order.readyForPickupAt (never the model
// pre-save, never a direct PUT) and the only path into 'ready_for_pickup'.
// This service is required directly by callers (no delegate on the state
// machine — that would create a static require cycle).

const Customer = require('../models/Customer');
const Affiliate = require('../models/Affiliate');
const emailService = require('../utils/emailService');
const logger = require('../utils/logger');
const { applyTransition } = require('../modules/orders/orderStateMachine');

/**
 * Apply the ready gate to an order. Idempotent.
 * - processed     -> ready_for_pickup, stamp readyForPickupAt, save, notify
 *                    affiliate (reuses the existing sendOrderReadyNotification
 *                    dispatcher — Notification A, design §6.6).
 * - anything else -> no-op.
 *
 * Promotion is unconditional now that payment has been removed (Phase 1).
 *
 * @param {Object} order - mongoose Order document
 * @param {Object} [ctx]
 * @param {string} [ctx.trigger] - caller tag for logs ('status_put',
 *   'processed_scan', ...)
 * @returns {Promise<{promoted: boolean, held: boolean}>}
 */
async function applyReadyGate(order, { trigger } = {}) {
  if (order.status === 'ready_for_pickup' || order.status !== 'processed') {
    return { promoted: false, held: false };
  }

  applyTransition(order, 'ready_for_pickup');
  if (!order.readyForPickupAt) order.readyForPickupAt = new Date(); // SOLE writer
  await order.save();

  logger.info('Ready gate: promoted to ready_for_pickup', {
    orderId: order.orderId,
    trigger
  });

  // Notification A — reuse the existing dispatcher; best-effort, never blocks the gate.
  try {
    const affiliate = await Affiliate.findOne({ affiliateId: order.affiliateId });
    if (affiliate && affiliate.email) {
      let customerName = 'N/A';
      const customer = await Customer.findOne({ customerId: order.customerId });
      if (customer) customerName = `${customer.firstName} ${customer.lastName}`;
      await emailService.sendOrderReadyNotification(affiliate.email, {
        affiliateName: affiliate.contactPerson || affiliate.businessName,
        orderId: order.orderId,
        customerName,
        numberOfBags: 1,            // one bag = one order
        totalWeight: order.actualWeight,
        language: affiliate.languagePreference
      });
    }
  } catch (emailError) {
    logger.error('Ready gate: order-ready notification failed', {
      orderId: order.orderId,
      error: emailError.message
    });
  }

  return { promoted: true, held: false };
}

module.exports = { applyReadyGate };
