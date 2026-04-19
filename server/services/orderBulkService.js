// Order bulk-operations service
//
// Handles bulk status updates and bulk cancellations in a single pass,
// preserving per-order success/failure outcomes and respecting the same
// per-order authorization check as the single-order endpoints.
//
// Extracted from orderController.js in Phase 2. The controller remains
// responsible for translating HTTP input/output; this module owns the
// batch iteration and the status-transition rules.

const Order = require('../models/Order');

class BulkError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
    this.isBulkError = true;
  }
}

/**
 * Bulk-apply `status` to every order in `orderIds`.
 * Returns { updated, failed, results: [{ orderId, success, message? }] }.
 */
async function bulkUpdateStatus({ orderIds, status, user, checkStatusTransition }) {
  if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
    throw new BulkError('Order IDs must be provided as an array');
  }

  const validStatuses = ['pending', 'scheduled', 'processing', 'processed', 'complete', 'cancelled'];
  if (!validStatuses.includes(status)) {
    throw new BulkError('Invalid status');
  }

  const orders = await Order.find({ orderId: { $in: orderIds } });
  if (orders.length === 0) {
    throw new BulkError('No orders found', 404);
  }

  // Must be admin, or an affiliate who owns EVERY order in the batch.
  const isAuthorized = user.role === 'admin' ||
    (user.role === 'affiliate' && orders.every(o => o.affiliateId === user.affiliateId));
  if (!isAuthorized) {
    throw new BulkError('Unauthorized', 403);
  }

  const results = [];
  let updated = 0;
  let failed = 0;

  for (const order of orders) {
    try {
      if (!checkStatusTransition(order.status, status)) {
        results.push({
          orderId: order.orderId,
          success: false,
          message: `Cannot transition from ${order.status} to ${status}`
        });
        failed++;
        continue;
      }

      order.status = status;
      await order.save();

      results.push({ orderId: order.orderId, success: true, message: 'Order updated successfully' });
      updated++;
    } catch (error) {
      results.push({ orderId: order.orderId, success: false, message: error.message });
      failed++;
    }
  }

  return { updated, failed, results };
}

/**
 * Bulk-cancel every order in `orderIds`. Orders in `processing`,
 * `processed`, `complete`, or `cancelled` state are skipped (recorded
 * in results but don't count as cancellations).
 */
async function bulkCancel({ orderIds, user }) {
  if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
    throw new BulkError('Invalid order IDs provided');
  }

  const orders = await Order.find({ orderId: { $in: orderIds } });
  if (orders.length === 0) {
    throw new BulkError('No orders found', 404);
  }

  const unauthorized = orders.some(order =>
    user.role !== 'admin' &&
    !(user.role === 'affiliate' && user.affiliateId === order.affiliateId)
  );
  if (unauthorized) {
    throw new BulkError('Unauthorized to cancel one or more orders', 403);
  }

  let cancelled = 0;
  let failed = 0;
  const results = [];

  for (const order of orders) {
    if (['processing', 'processed', 'complete', 'cancelled'].includes(order.status)) {
      results.push({
        orderId: order.orderId,
        success: false,
        error: `Cannot cancel order with status: ${order.status}`
      });
      failed++;
    } else {
      order.status = 'cancelled';
      order.cancelledAt = new Date();
      order.cancelledBy = user.id;
      order.cancelReason = 'Bulk cancellation';
      await order.save();

      results.push({ orderId: order.orderId, success: true });
      cancelled++;
    }
  }

  return { cancelled, failed, results };
}

module.exports = { bulkUpdateStatus, bulkCancel, BulkError };
