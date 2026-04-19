// Order export service
//
// CSV/JSON export for admins and affiliates. Extracted from
// orderController.js in Phase 2 so the controller only owns HTTP framing.

const Order = require('../models/Order');
const Customer = require('../models/Customer');

class ExportError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
    this.isExportError = true;
  }
}

/**
 * Build the order + customer dataset for the export.
 * Applies per-role access control (affiliates can only see their own).
 */
async function collectExportData({ format = 'csv', filters, user }) {
  if (format !== 'csv' && format !== 'json') {
    if (format === 'excel') {
      throw new ExportError('Excel export not yet implemented', 501);
    }
    throw new ExportError('Invalid export format. Supported formats: csv, json');
  }

  const query = {};

  if (filters.startDate || filters.endDate) {
    query.createdAt = {};
    if (filters.startDate) query.createdAt.$gte = new Date(filters.startDate);
    if (filters.endDate) query.createdAt.$lte = new Date(filters.endDate);
  }
  if (filters.affiliateId) query.affiliateId = filters.affiliateId;
  if (filters.status) query.status = filters.status;

  if (user.role === 'affiliate') {
    query.affiliateId = user.affiliateId;
  } else if (user.role !== 'admin') {
    throw new ExportError('Insufficient permissions for this export', 403);
  }

  const orders = await Order.find(query).sort({ createdAt: -1 });

  const customerIds = [...new Set(orders.map(o => o.customerId))];
  const customers = await Customer.find({ customerId: { $in: customerIds } });
  const customerMap = {};
  customers.forEach(c => { customerMap[c.customerId] = c; });

  return { orders, customerMap };
}

/**
 * Format the dataset as CSV text.
 */
function formatCsv({ orders, customerMap }) {
  const headers = [
    'Order ID', 'Customer Name', 'Customer Email', 'Affiliate ID', 'Status',
    'Estimated Weight', 'Actual Weight', 'Estimated Total', 'Actual Total',
    'Commission', 'Pickup Date', 'Delivery Date', 'Created At'
  ].join(',');

  const rows = orders.map(order => {
    const customer = customerMap[order.customerId];
    return [
      order.orderId,
      customer ? `${customer.firstName} ${customer.lastName}` : '',
      customer ? customer.email : '',
      order.affiliateId,
      order.status,
      order.estimatedWeight || '',
      order.actualWeight || '',
      order.estimatedTotal || '',
      order.actualTotal || '',
      order.affiliateCommission || '',
      order.pickupDate ? new Date(order.pickupDate).toISOString() : '',
      order.deliveryDate ? new Date(order.deliveryDate).toISOString() : '',
      new Date(order.createdAt).toISOString()
    ].join(',');
  });

  return [headers, ...rows].join('\n');
}

/**
 * Format the dataset as a JSON export envelope.
 */
function formatJson({ orders, customerMap, filters }) {
  return {
    success: true,
    exportDate: new Date().toISOString(),
    filters,
    totalOrders: orders.length,
    orders: orders.map(order => {
      const customer = customerMap[order.customerId];
      return {
        orderId: order.orderId,
        customer: customer ? { name: `${customer.firstName} ${customer.lastName}`, email: customer.email } : null,
        affiliateId: order.affiliateId,
        status: order.status,
        estimatedWeight: order.estimatedWeight,
        actualWeight: order.actualWeight,
        estimatedTotal: order.estimatedTotal,
        actualTotal: order.actualTotal,
        commission: order.affiliateCommission,
        pickupDate: order.pickupDate,
        deliveryDate: order.deliveryDate,
        createdAt: order.createdAt
      };
    })
  };
}

module.exports = { collectExportData, formatCsv, formatJson, ExportError };
