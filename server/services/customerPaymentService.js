// Customer payment service
//
// Post-weigh payment orchestration for customer-facing endpoints.
// Extracted from customerController.js in Phase 2 to keep the controller
// focused on HTTP concerns. This module owns:
//   - Paygistix line-item construction for the hosted-form submit
//   - A display-oriented line-item view for the customer UI
//   - The "initiate payment" / "check status" workflows
//
// Paygistix itself (callback pool, token lifecycle) is still implemented
// by paymentController; this service orchestrates the call sequence.

const Customer = require('../models/Customer');
const Order = require('../models/Order');
const PaymentToken = require('../models/PaymentToken');
const paymentController = require('../controllers/paymentController');
const logger = require('../utils/logger');

// ---------------------------------------------------------------------------
// Line-item builders
// ---------------------------------------------------------------------------

/**
 * Consolidated line items for the Paygistix hosted form.
 * Paygistix uses specific WDF/MDF/PBF codes and expects pricing per pound
 * for the WDF line (quantity = weight).
 */
function buildPaygistixLineItems(order) {
  const items = [];

  let totalWeight = order.actualWeight || 0;
  if (!totalWeight && order.bags && order.bags.length > 0) {
    totalWeight = order.bags.reduce((sum, bag) => sum + (bag.weight || 0), 0);
  }

  const laundryServiceCost = totalWeight * (order.baseRate || 0);

  let addOnCount = 0;
  if (order.addOns) {
    if (order.addOns.premiumDetergent) addOnCount++;
    if (order.addOns.fabricSoftener) addOnCount++;
    if (order.addOns.stainRemover) addOnCount++;
  }
  const addOnTotal = order.addOnTotal || 0;

  // WDF line — per-pound rate × weight in pounds (Paygistix expects it this way).
  // The WDF code advertises how many add-ons are bundled in (WDF, WDF1, WDF2, WDF3).
  if (totalWeight > 0 && (laundryServiceCost > 0 || addOnTotal > 0)) {
    const effectiveRate = (laundryServiceCost + addOnTotal) / totalWeight;
    const wdfCode = addOnCount > 0 ? `WDF${Math.min(addOnCount, 3)}` : 'WDF';
    items.push({
      code: wdfCode,
      description: 'Wash Dry Fold Service',
      price: effectiveRate,
      quantity: Math.round(totalWeight)
    });
  }

  // Delivery fees — one of MDFnn (minimum) or PBFnn (per-bag) is charged,
  // never both. Both price tables are a discrete set of codes; pick the
  // closest code to the affiliate's configured fee.
  if (order.feeBreakdown) {
    if (order.feeBreakdown.minimumApplied && order.feeBreakdown.minimumFee > 0) {
      const mdfFee = order.feeBreakdown.minimumFee;
      const mdfCode = pickClosestCode('MDF', mdfFee, [10, 15, 20, 25, 30, 35, 40, 45, 50]);
      items.push({
        code: mdfCode,
        description: 'Minimum Delivery Fee',
        price: mdfFee,
        quantity: 1
      });
    } else if (order.feeBreakdown.perBagFee > 0 && order.feeBreakdown.numberOfBags > 0) {
      const pbfFee = order.feeBreakdown.perBagFee;
      const pbfCode = pickClosestCode('PBF', pbfFee, [5, 10, 15, 20, 25]);
      items.push({
        code: pbfCode,
        description: 'Per Bag Fee',
        price: pbfFee,
        quantity: order.feeBreakdown.numberOfBags
      });
    }
  }

  // Credits reduce the charged total but are not sent as Paygistix line items;
  // caller computes the final amount against the display line items instead.

  logger.info('[Payment] Generated Paygistix line items:', { items });
  return items;
}

function pickClosestCode(prefix, price, options) {
  if (options.includes(price)) return `${prefix}${price}`;
  const closest = options.reduce((prev, curr) =>
    Math.abs(curr - price) < Math.abs(prev - price) ? curr : prev
  );
  return `${prefix}${closest}`;
}

/**
 * Detailed line items for the customer's on-screen cart / receipt.
 * Unlike the Paygistix items, these show per-add-on lines and any applied
 * credits as negative entries.
 */
function buildLineItemsFromOrder(order) {
  const items = [];

  let totalWeight = order.actualWeight || 0;
  if (!totalWeight && order.bags && order.bags.length > 0) {
    totalWeight = order.bags.reduce((sum, bag) => sum + (bag.weight || 0), 0);
  }

  const laundryServiceCost = totalWeight * (order.baseRate || 0);
  if (laundryServiceCost > 0) {
    items.push({
      code: 'LAUNDRY',
      description: `Laundry Service (${totalWeight} lbs @ $${(order.baseRate || 0).toFixed(2)}/lb)`,
      price: laundryServiceCost,
      quantity: 1
    });
  }

  // Add-ons — keep the Order model's $0.10 per-pound convention in sync.
  const addOnPricePerLb = 0.10;
  if (order.addOns && totalWeight > 0) {
    const addOnPrice = totalWeight * addOnPricePerLb;
    if (order.addOns.premiumDetergent) {
      items.push({ code: 'ADDON_PD', description: `Premium Detergent (${totalWeight} lbs @ $${addOnPricePerLb.toFixed(2)}/lb)`, price: addOnPrice, quantity: 1 });
    }
    if (order.addOns.fabricSoftener) {
      items.push({ code: 'ADDON_FS', description: `Fabric Softener (${totalWeight} lbs @ $${addOnPricePerLb.toFixed(2)}/lb)`, price: addOnPrice, quantity: 1 });
    }
    if (order.addOns.stainRemover) {
      items.push({ code: 'ADDON_SR', description: `Stain Remover (${totalWeight} lbs @ $${addOnPricePerLb.toFixed(2)}/lb)`, price: addOnPrice, quantity: 1 });
    }
  }

  if (order.feeBreakdown) {
    if (order.feeBreakdown.minimumApplied && order.feeBreakdown.minimumFee > 0) {
      items.push({ code: 'MDF', description: 'Minimum Delivery Fee', price: order.feeBreakdown.minimumFee, quantity: 1 });
    } else if (order.feeBreakdown.perBagFee > 0 && order.feeBreakdown.numberOfBags > 0) {
      items.push({
        code: 'PBF',
        description: `Per Bag Fee (${order.feeBreakdown.numberOfBags} bags)`,
        price: order.feeBreakdown.perBagFee,
        quantity: order.feeBreakdown.numberOfBags
      });
    }
  }

  if (order.wdfCreditApplied && order.wdfCreditApplied > 0) {
    items.push({ code: 'CREDIT', description: 'WDF Credit Applied', price: -order.wdfCreditApplied, quantity: 1 });
  }

  return items;
}

// ---------------------------------------------------------------------------
// Payment workflows (called from the customer controller)
// ---------------------------------------------------------------------------

/**
 * Initiate a post-weigh payment for `orderId`.
 *
 * Looks up the order, builds both Paygistix-formatted and customer-facing
 * line items, and then delegates token creation to paymentController.
 * Because paymentController.createPaymentToken is written as an Express
 * handler, we pass it a res-shaped adapter that finalises the HTTP
 * response on `realRes` once the token is ready.
 *
 * Throws a `PaymentInitiationError` (attached `.status`) on validation
 * failures so the controller can render the error in a consistent shape.
 */
async function initiatePayment({ customerObjectId, orderId, realRes }) {
  const customer = await Customer.findById(customerObjectId);
  if (!customer) {
    throw makeError('Customer not found', 404);
  }

  logger.info('[Payment] Initiating payment for order:', { orderId, customerId: customer.customerId });

  const order = await Order.findOne({
    orderId,
    customerId: customer.customerId,
    paymentStatus: { $in: ['pending', 'awaiting'] }
  });

  if (!order) {
    // Log more context if the order exists but isn't eligible — helps debug
    // the common "already paid" / "wrong customer" cases.
    const orderDebug = await Order.findOne({ orderId });
    if (orderDebug) {
      logger.info('[Payment] Order found but not eligible', {
        customerId: orderDebug.customerId,
        paymentStatus: orderDebug.paymentStatus,
        expectedCustomerId: customer.customerId
      });
    } else {
      logger.info('[Payment] Order not found', { orderId });
    }
    throw makeError('Order not found or already paid', 404);
  }

  const displayLineItems = buildLineItemsFromOrder(order);
  const paygistixLineItems = buildPaygistixLineItems(order);
  const totalAmount = displayLineItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const paymentData = {
    customerData: {
      customerId: customer.customerId,
      email: customer.email,
      firstName: customer.firstName,
      lastName: customer.lastName,
      phone: customer.phone,
      orderId: order._id.toString(),
      orderNumber: order.orderId
    },
    paymentData: {
      amount: totalAmount,
      items: paygistixLineItems,
      orderId: order.orderId
    }
  };

  // Bridge paymentController (Express handler) back to our caller's res.
  const tokenRes = {
    json: (data) => {
      realRes.json({
        success: data.success,
        token: data.token,
        formConfig: data.formConfig,
        amount: totalAmount,
        lineItems: displayLineItems,
        paygistixItems: paygistixLineItems,
        message: data.message || 'Payment initiated successfully'
      });
    },
    status: (code) => ({
      json: (data) => realRes.status(code).json(data)
    })
  };

  await paymentController.createPaymentToken({ body: paymentData }, tokenRes);
}

/**
 * Read the current payment status for `orderId`. Prefers an in-flight
 * PaymentToken (`pending`/`processing`) if one exists; otherwise falls
 * back to the Order's recorded state.
 *
 * Returns a plain object; the controller shapes the HTTP response.
 */
async function getPaymentStatus({ orderId, customerId }) {
  const order = await Order.findOne({
    _id: orderId,
    customerId
  }).select('paymentStatus paymentMethod paymentTransactionId paymentVerifiedAt paymentNotes');

  if (!order) {
    throw makeError('Order not found', 404);
  }

  const activeToken = await PaymentToken.findOne({
    'customerData.orderId': orderId,
    status: { $in: ['pending', 'processing'] }
  }).sort('-createdAt');

  if (activeToken) {
    return {
      paymentStatus: activeToken.status,
      token: activeToken.token,
      transactionId: activeToken.transactionId,
      paymentDate: activeToken.updatedAt,
      error: activeToken.errorMessage,
      isActive: true
    };
  }

  return {
    paymentStatus: order.paymentStatus,
    transactionId: order.paymentTransactionId,
    paymentDate: order.paymentVerifiedAt,
    error: null,
    isActive: false
  };
}

function makeError(message, status) {
  const err = new Error(message);
  err.status = status;
  err.isPaymentError = true;
  return err;
}

module.exports = {
  initiatePayment,
  getPaymentStatus,
  // Exported for tests; not part of the controller-facing contract.
  buildPaygistixLineItems,
  buildLineItemsFromOrder
};
