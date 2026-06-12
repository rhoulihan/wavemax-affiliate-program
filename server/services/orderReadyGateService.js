// THE canonical "ready for pickup" gate (design §6.5; settled decision §13 #3).
//
//   ready_for_pickup  IFF  status === 'processed'  AND  paymentStatus === 'verified'
//
// This service is the SOLE writer of Order.readyForPickupAt (never the model
// pre-save, never a direct PUT) and the only path into 'ready_for_pickup'.
// This service is required directly by callers (no delegate on the state
// machine — that would create a static require cycle). Callers (this PR): orderController.updateOrderStatus (processed transition)
// and orderController.verifyPaymentManually. PR 7 adds the kiosk processed scan;
// PR 8 adds the IMAP scanner / verification-job verify path.

const Customer = require('../models/Customer');
const Affiliate = require('../models/Affiliate');
const emailService = require('../utils/emailService');
const logger = require('../utils/logger');
const { applyTransition } = require('../modules/orders/orderStateMachine');

/**
 * Apply the ready gate to an order. Idempotent.
 * - processed + verified  -> ready_for_pickup, stamp readyForPickupAt,
 *                            heldAtStore=false, save, notify affiliate
 *                            (reuses the existing sendOrderReadyNotification
 *                            dispatcher — Notification A, design §6.6).
 * - processed + !verified -> heldAtStore=true, save (physically held).
 * - anything else         -> no-op.
 *
 * @param {Object} order - mongoose Order document
 * @param {Object} [ctx]
 * @param {string} [ctx.trigger] - caller tag for logs ('status_put',
 *   'manual_verify', 'scanner_verify', 'processed_scan', ...)
 * @returns {Promise<{promoted: boolean, held: boolean}>}
 */
async function applyReadyGate(order, { trigger } = {}) {
  if (order.status === 'ready_for_pickup' || order.status !== 'processed') {
    return { promoted: false, held: false };
  }

  if (order.paymentStatus !== 'verified') {
    if (!order.heldAtStore) {
      order.heldAtStore = true;
      await order.save();
    }
    logger.info('Ready gate: processed but unpaid — held at store', {
      orderId: order.orderId,
      trigger
    });
    return { promoted: false, held: true };
  }

  applyTransition(order, 'ready_for_pickup');
  if (!order.readyForPickupAt) order.readyForPickupAt = new Date(); // SOLE writer
  order.heldAtStore = false;
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
