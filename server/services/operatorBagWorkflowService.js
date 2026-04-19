// Operator bag-workflow service
//
// Three-stage scanning pipeline: weigh → process → complete. The customer's
// QR code drives stage 1 (scanCustomer), bag QR codes drive stages 2+3
// (scanBag/scanProcessed). weighBags is the commit point that locks the
// total, triggers V2 payment request emails, and moves the order into
// 'processing'. Controllers map BagWorkflowError to HTTP responses.

const Order = require('../models/Order');
const Customer = require('../models/Customer');
const Affiliate = require('../models/Affiliate');
const emailService = require('../utils/emailService');
const { logAuditEvent, AuditEvents } = require('../utils/auditLogger');
const logger = require('../utils/logger');
const QRCode = require('qrcode');
const pickupService = require('./operatorPickupService');

class BagWorkflowError extends Error {
  constructor(code, message, status = 400, details = {}) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
    this.isBagWorkflowError = true;
  }
}

// Venmo business-profile + WaveMAX usernames. Known issue: Venmo app adds
// business profile + username as two recipients when scanning QR.
async function generatePaymentURLs(order) {
  const amount = order.paymentAmount.toFixed(2);
  const orderNote = `WaveMAX Order ${order.orderId}`;
  const links = {
    venmo: `https://venmo.com/wavemaxatx?txn=pay&amount=${amount}&note=${encodeURIComponent(orderNote)}`,
    paypal: `https://www.paypal.me/WaveMAXLaundry/${amount}?locale.x=en_US&country.x=US`,
    cashapp: `https://cash.app/$WaveMAXLaundry/${amount}?note=${encodeURIComponent(orderNote)}`
  };

  const qrCodes = {};
  for (const [service, url] of Object.entries(links)) {
    try {
      logger.info(`Generating ${service} QR code for URL:`, url);
      qrCodes[service] = await QRCode.toDataURL(url, {
        width: 300,
        margin: 1,
        color: { dark: '#000000', light: '#FFFFFF' }
      });
    } catch (error) {
      logger.error(`Failed to generate QR code for ${service}:`, error);
      qrCodes[service] = null;
    }
  }
  return { links, qrCodes };
}

function parseCustomerQr(customerId) {
  // Two flavors: bare CUST-<uuid>, or CUST-<uuid>-<bagNumber> from printed labels.
  let cleanCustomerId = customerId;
  let extractedBagNumber = null;

  const bagNumberMatch = customerId.match(/^(cust-[a-f0-9-]+)-(\d+)$/i);
  if (bagNumberMatch) {
    cleanCustomerId = bagNumberMatch[1];
    extractedBagNumber = parseInt(bagNumberMatch[2], 10);
  }

  // Normalize: CUST- prefix uppercase, UUID lowercase.
  cleanCustomerId = cleanCustomerId.replace(/^cust-/i, 'CUST-').toLowerCase();
  cleanCustomerId = cleanCustomerId.replace(/^cust-/, 'CUST-');

  return { cleanCustomerId, extractedBagNumber };
}

async function findCustomerFlexible(cleanCustomerId) {
  let customer = await Customer.findOne({ customerId: cleanCustomerId });
  if (customer) return customer;
  // Fallback to case-insensitive match in case the normalization missed a variant.
  const escaped = cleanCustomerId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return Customer.findOne({
    customerId: { $regex: new RegExp('^' + escaped + '$', 'i') }
  });
}

function deriveScanAction(order) {
  if (order.bagsWeighed < order.numberOfBags) return 'weight_input';
  if (order.bagsProcessed < order.numberOfBags) return 'process_complete';
  if (order.bagsPickedUp < order.numberOfBags) return 'pickup_scan';
  return 'status_check';
}

async function scanCustomer({ customerId, bagId, operatorId, req }) {
  logger.info('scanCustomer called with:', { customerId, bagId });

  const { cleanCustomerId, extractedBagNumber } = parseCustomerQr(customerId);
  logger.info(`Normalized customer ID: ${cleanCustomerId}`);

  const customer = await findCustomerFlexible(cleanCustomerId);
  if (!customer) {
    throw new BagWorkflowError('customer_not_found', 'Customer not found', 404, {
      message: 'Invalid customer ID',
      searchedId: cleanCustomerId,
      originalId: customerId
    });
  }

  const currentOrder = await Order.findOne({
    customerId: customer.customerId,
    status: { $in: ['pending', 'processing', 'processed'] }
  }).sort({ createdAt: -1 });

  if (!currentOrder) {
    throw new BagWorkflowError('no_active_order', 'No active order', 404, {
      message: 'No active order found for this customer',
      customer: {
        name: `${customer.firstName} ${customer.lastName}`,
        customerId: customer.customerId
      }
    });
  }

  let action = deriveScanAction(currentOrder);

  let affiliateName = 'N/A';
  if (currentOrder.affiliateId) {
    const affiliate = await Affiliate.findOne({ affiliateId: currentOrder.affiliateId });
    if (affiliate) affiliateName = affiliate.businessName;
  }

  let bagRegistered = false;
  let bagAlreadyExists = false;
  let effectiveBagId = bagId;

  if (effectiveBagId || extractedBagNumber) {
    if (!effectiveBagId && extractedBagNumber) {
      effectiveBagId = `${currentOrder.orderId}-BAG${extractedBagNumber}`;
    }
    if (!currentOrder.bags) currentOrder.bags = [];

    const existingBag = currentOrder.bags.find(b => b.bagId === effectiveBagId);
    if (!existingBag) {
      currentOrder.bags.push({
        bagId: effectiveBagId,
        bagNumber: extractedBagNumber || currentOrder.bags.length + 1,
        status: 'processing',
        weight: 0,
        scannedAt: { processing: new Date() },
        scannedBy: { processing: operatorId }
      });
      await currentOrder.save();
      bagRegistered = true;
      logger.info(`Bag ${effectiveBagId} registered for order ${currentOrder.orderId}. Total bags scanned: ${currentOrder.bags.length}/${currentOrder.numberOfBags}`);
    } else {
      bagAlreadyExists = true;
      logger.info(`Bag ${effectiveBagId} already exists in order ${currentOrder.orderId}`);
    }
  }

  const scannedBagCount = currentOrder.bags ? currentOrder.bags.length : 0;
  if (scannedBagCount === currentOrder.numberOfBags && currentOrder.bagsWeighed < currentOrder.numberOfBags) {
    action = 'weight_input';
  } else if (scannedBagCount < currentOrder.numberOfBags) {
    action = 'scan_required';
  }

  await logAuditEvent(AuditEvents.SENSITIVE_DATA_ACCESS, {
    operatorId,
    customerId: customer.customerId,
    orderId: currentOrder.orderId,
    action: 'customer_card_scanned',
    scanAction: action
  }, req);

  return {
    action,
    bagRegistered,
    bagAlreadyExists,
    scannedBagId: effectiveBagId,
    order: {
      orderId: currentOrder.orderId,
      customerName: `${customer.firstName} ${customer.lastName}`,
      affiliateName,
      numberOfBags: currentOrder.numberOfBags,
      bagsScanned: scannedBagCount,
      bagsWeighed: currentOrder.bagsWeighed,
      bagsProcessed: currentOrder.bagsProcessed,
      bagsPickedUp: currentOrder.bagsPickedUp,
      estimatedWeight: currentOrder.estimatedWeight,
      actualWeight: currentOrder.actualWeight,
      status: currentOrder.status,
      bags: currentOrder.bags || [],
      addOns: currentOrder.addOns,
      addOnTotal: currentOrder.addOnTotal
    }
  };
}

async function scanBag({ qrCode }) {
  // Legacy QR (bare customer ID) — callers should fall through to scanCustomer.
  if (!qrCode || !qrCode.includes('#')) {
    return { legacy: true, customerId: qrCode };
  }

  const [customerId, bagId] = qrCode.split('#');

  const customer = await Customer.findOne({ customerId });
  if (!customer) {
    throw new BagWorkflowError('customer_not_found', 'Customer not found', 404, {
      message: 'Invalid customer ID'
    });
  }

  const currentOrder = await Order.findOne({
    customerId: customer.customerId,
    status: { $in: ['pending', 'processing', 'processed'] }
  })
    .sort({ createdAt: -1 })
    .populate('customer', 'firstName lastName phone email address');

  if (!currentOrder) {
    throw new BagWorkflowError('no_active_order', 'No active order', 404, {
      message: 'No active order found for this customer'
    });
  }

  return {
    legacy: false,
    order: currentOrder,
    customer: currentOrder.customer,
    bagId,
    action: 'show_order'
  };
}

async function receiveOrder({ orderId, bagWeights, totalWeight, operatorId, req }) {
  const order = await Order.findOne({ orderId });
  if (!order) throw new BagWorkflowError('order_not_found', 'Order not found', 404);

  order.actualWeight = totalWeight;
  order.status = 'processing';
  order.assignedOperator = operatorId;
  order.processingStarted = new Date();
  order.processingStartedAt = new Date();
  order.bagsWeighed = (order.bagsWeighed || 0) + bagWeights.length;

  if (!order.bagWeights) order.bagWeights = [];
  bagWeights.forEach(bw => {
    order.bagWeights.push({
      bagNumber: bw.bagNumber,
      weight: bw.weight,
      receivedAt: new Date()
    });
  });

  await order.save();

  await logAuditEvent(AuditEvents.ORDER_STATUS_CHANGED, {
    operatorId,
    orderId,
    action: 'order_received',
    totalWeight,
    numberOfBags: bagWeights.length,
    newStatus: 'processing'
  }, req);

  return order;
}

async function weighBags({ orderId, bags, operatorId, req }) {
  const order = await Order.findOne({ orderId });
  if (!order) throw new BagWorkflowError('order_not_found', 'Order not found', 404);

  for (const bagData of bags) {
    const existingBagIndex = order.bags.findIndex(b => b.bagId === bagData.bagId);
    if (existingBagIndex >= 0) {
      order.bags[existingBagIndex].weight = bagData.weight;
      order.bags[existingBagIndex].status = 'processing';
      if (!order.bags[existingBagIndex].scannedAt.processing) {
        order.bags[existingBagIndex].scannedAt.processing = new Date();
      }
      if (!order.bags[existingBagIndex].scannedBy.processing) {
        order.bags[existingBagIndex].scannedBy.processing = operatorId;
      }
    } else {
      order.bags.push({
        bagId: bagData.bagId,
        bagNumber: order.bags.length + 1,
        status: 'processing',
        weight: bagData.weight,
        scannedAt: { processing: new Date() },
        scannedBy: { processing: operatorId }
      });
    }
  }

  order.actualWeight = order.bags.reduce((sum, bag) => sum + (bag.weight || 0), 0);
  order.status = 'processing';
  order.assignedOperator = operatorId;
  if (!order.processingStartedAt) order.processingStartedAt = new Date();
  order.bagsWeighed = order.bags.filter(b => b.weight > 0).length;

  await order.save();

  // V2 payment request: fires only when the LAST bag is weighed.
  if (order.bagsWeighed === order.numberOfBags) {
    order.weightDifference = order.actualWeight - order.estimatedWeight;

    const customer = await Customer.findOne({ customerId: order.customerId });
    if (customer) {
      const paymentAmount = order.paymentAmount
        || order.actualTotal
        || (order.actualWeight * (order.baseRate || 1.25) + (order.addOnTotal || 0));

      const paymentURLs = await generatePaymentURLs({ ...order.toObject(), paymentAmount });
      order.paymentLinks = paymentURLs.links;
      order.paymentQRCodes = paymentURLs.qrCodes;
      order.paymentStatus = 'awaiting';
      order.paymentRequestedAt = new Date();
      order.paymentAmount = paymentAmount;
      await order.save();

      try {
        await emailService.sendV2PaymentRequest({
          customer,
          order,
          paymentAmount,
          paymentLinks: paymentURLs.links,
          qrCodes: paymentURLs.qrCodes
        });
        logger.info(`V2 Payment request sent for order ${order.orderId}, amount: $${paymentAmount}`);
      } catch (emailError) {
        logger.error(`Failed to send payment request email for order ${order.orderId}:`, emailError);
      }
    }
  }

  await logAuditEvent(AuditEvents.ORDER_STATUS_CHANGED, {
    operatorId,
    orderId,
    action: 'bags_weighed',
    totalWeight: order.actualWeight,
    numberOfBags: order.bags.length,
    newBags: bags.length
  }, req);

  return {
    order,
    orderProgress: {
      totalBags: order.bags.length,
      bagsWeighed: order.bags.length,
      bagsProcessed: order.bags.filter(b => b.status === 'processed').length,
      bagsCompleted: order.bags.filter(b => b.status === 'completed').length
    }
  };
}

async function markBagProcessed({ orderId, operatorId, req }) {
  const order = await Order.findOne({ orderId });
  if (!order) throw new BagWorkflowError('order_not_found', 'Order not found', 404);

  order.bagsProcessed = Math.min((order.bagsProcessed || 0) + 1, order.numberOfBags);
  const allProcessed = order.bagsProcessed === order.numberOfBags;

  if (allProcessed) {
    order.processedAt = new Date();
    order.status = 'processed';

    if (order.affiliateId) {
      const affiliate = await Affiliate.findOne({ affiliateId: order.affiliateId });

      let customerName = 'N/A';
      if (order.customerId) {
        const customer = await Customer.findOne({ customerId: order.customerId });
        if (customer) customerName = `${customer.firstName} ${customer.lastName}`;
      }

      if (affiliate && affiliate.email) {
        await emailService.sendOrderReadyNotification(affiliate.email, {
          affiliateName: affiliate.contactPerson || affiliate.businessName,
          orderId: order.orderId,
          customerName,
          numberOfBags: order.numberOfBags,
          totalWeight: order.actualWeight
        });
      }
    }
  }

  await order.save();

  await logAuditEvent(AuditEvents.ORDER_STATUS_CHANGED, {
    operatorId,
    orderId,
    action: 'bag_processed',
    bagNumber: order.bagsProcessed,
    totalBags: order.numberOfBags,
    allBagsProcessed: allProcessed,
    affiliateNotified: allProcessed
  }, req);

  return {
    bagsProcessed: order.bagsProcessed,
    totalBags: order.numberOfBags,
    orderReady: allProcessed
  };
}

async function scanProcessed({ qrCode, operatorId, req }) {
  logger.info('scanProcessed called with:', { qrCode, operatorId });

  if (!qrCode || !qrCode.includes('#')) {
    throw new BagWorkflowError('invalid_qr', 'Invalid QR code format', 400, {
      message: 'Expected format: customerId#bagId'
    });
  }

  const [customerId, bagId] = qrCode.split('#');

  const order = await Order.findOne({
    customerId,
    'bags.bagId': bagId,
    status: { $in: ['processing', 'processed'] }
  });

  if (!order) {
    throw new BagWorkflowError('bag_not_found', 'Bag not found', 404, {
      message: 'This bag is not associated with any active order'
    });
  }

  // Order has no schema ref to Customer; attach one for downstream emails.
  const customer = await Customer.findOne({ customerId: order.customerId });
  if (customer) order.customer = customer;

  const bag = order.bags.find(b => b.bagId === bagId);

  if (bag.status === 'processed') {
    const allBagsProcessed = order.bags.every(b => b.status === 'processed' || b.status === 'completed');
    if (allBagsProcessed) {
      return { action: 'show_pickup_modal', order, allBagsProcessed: true };
    }
    const remainingBags = order.bags.filter(b => b.status === 'processing').length;
    return {
      warning: 'duplicate_scan',
      message: `This bag has already been processed. ${remainingBags} bags still need processing.`,
      bag: {
        bagId: bag.bagId,
        bagNumber: bag.bagNumber,
        status: bag.status,
        processedAt: bag.scannedAt.processed
      },
      remainingCount: remainingBags
    };
  }

  bag.status = 'processed';
  bag.scannedAt.processed = new Date();
  bag.scannedBy.processed = operatorId;

  order.bagsProcessed = order.bags.filter(
    b => b.status === 'processed' || b.status === 'completed'
  ).length;
  const allBagsProcessed = order.bags.every(
    b => b.status === 'processed' || b.status === 'completed'
  );

  if (allBagsProcessed) {
    order.processedAt = new Date();
    order.status = 'processed';

    if (order.paymentStatus === 'verified' || order.paymentStatus === 'paid') {
      // Paid — notify affiliate only; customer is notified after actual pickup.
      if (order.affiliateId) {
        const affiliate = await Affiliate.findOne({ affiliateId: order.affiliateId });
        if (affiliate && affiliate.email) {
          await emailService.sendOrderReadyNotification(affiliate.email, {
            orderId: order.orderId,
            customerName: `${order.customer.firstName} ${order.customer.lastName}`,
            customerPhone: order.customer.phone,
            numberOfBags: order.numberOfBags,
            totalWeight: order.actualWeight,
            finalTotal: order.actualTotal || order.estimatedTotal,
            address: `${order.customer.address.street}, ${order.customer.address.city}, ${order.customer.address.state} ${order.customer.address.zip}`
          });
          logger.info(`Ready for pickup notification sent to affiliate ${affiliate.email} for order ${order.orderId}`);
        }
      }
    } else {
      // Unpaid — nudge the customer before anything ships.
      await pickupService.sendPaymentReminder(order);
      logger.info(`Order ${order.orderId} processed but awaiting payment. Reminder sent.`);
    }
  }

  await order.save();

  await logAuditEvent(AuditEvents.ORDER_STATUS_CHANGED, {
    operatorId,
    orderId: order.orderId,
    action: 'bag_processed',
    bagId,
    bagNumber: bag.bagNumber,
    bagsProcessed: order.bagsProcessed,
    totalBags: order.bags.length,
    allBagsProcessed
  }, req);

  if (allBagsProcessed) {
    return { action: 'show_pickup_modal', order, allBagsProcessed: true };
  }
  return {
    order,
    bag: {
      bagId: bag.bagId,
      bagNumber: bag.bagNumber,
      status: bag.status,
      weight: bag.weight
    },
    orderProgress: {
      totalBags: order.bags.length,
      bagsWeighed: order.bags.length,
      bagsProcessed: order.bagsProcessed,
      bagsCompleted: order.bags.filter(b => b.status === 'completed').length
    }
  };
}

module.exports = {
  scanCustomer,
  scanBag,
  receiveOrder,
  weighBags,
  markBagProcessed,
  scanProcessed,
  generatePaymentURLs,
  BagWorkflowError
};
