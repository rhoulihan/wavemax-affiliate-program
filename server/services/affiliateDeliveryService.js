// Door delivery confirmation on the overloaded bag URL (spec §6.6).
//
// The submitted code is verified ONLY against this order's customer
// (deliveryPinHash) and affiliate (affiliateDeliveryCodeHash) — constant-time,
// both verifications always run, no global lookup, no role oracle. Operator
// codes are identified (global HMAC lookup) and rejected with a distinct 401
// so the page can branch to the re-intake prompt instead.
//
// Success: picked_up -> delivered, proofOfDelivery stamped, commission
// realized exactly once, customer "delivered" + affiliate commission emails
// (best-effort). Public endpoint -> per-bag/IP attempt lockout.

const Bag = require('../modules/bags/Bag');
const Order = require('../models/Order');
const Customer = require('../models/Customer');
const Affiliate = require('../models/Affiliate');
const Operator = require('../models/Operator');
const SystemConfig = require('../models/SystemConfig');
const { applyTransition } = require('../modules/orders/orderStateMachine');
const { OPEN_STATUSES } = require('../modules/orders/orderAdvanceService');
const codeAttemptLockout = require('./codeAttemptLockout');
const roleCodes = require('../utils/roleCodes');
const emailService = require('../utils/emailService');
const { logAuditEvent, AuditEvents } = require('../utils/auditLogger');
const logger = require('../utils/logger');

class DeliveryError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
    this.isDeliveryError = true;
  }
}

function toGeoPoint(geo) {
  if (!geo) return undefined;
  const lat = Number(geo.lat);
  const lng = Number(geo.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return undefined;
  return { type: 'Point', coordinates: [lng, lat] }; // GeoJSON: [lng, lat]
}

async function confirmDelivery({ bagToken, code, geo, req }) {
  const bag = await Bag.findOne({ tokenHash: Bag.hashToken(bagToken) });
  if (!bag) throw new DeliveryError('invalid_bag', 'Bag not found', 404);

  const order = await Order.findOne({ bagId: bag.bagId, status: { $in: OPEN_STATUSES } });
  if (!order || order.status !== 'picked_up') {
    throw new DeliveryError('not_picked_up', 'This order is not out for delivery', 409);
  }

  const key = codeAttemptLockout.attemptKey({ scope: 'deliver', bagToken, ip: req && req.ip });
  const maxAttempts = await SystemConfig.getValue('delivery_code_max_attempts', 5);
  if (await codeAttemptLockout.isLockedOut(key, maxAttempts)) {
    throw new DeliveryError('locked_out', 'Too many attempts — please try again later', 429);
  }

  // Operator code? Back-at-the-store, not a delivery (§6.6). Distinct 401 so
  // the page can offer re-intake; does NOT count toward the delivery lockout
  // (it identified a real operator — it isn't a guess).
  const operator = code
    ? await Operator.findOne({ scanCodeHmac: roleCodes.hmacCode(code), isActive: true })
    : null;
  if (operator) {
    logAuditEvent(AuditEvents.DELIVERY_CODE_FAILED, {
      reason: 'operator_code', orderId: order.orderId
    }, req);
    throw new DeliveryError('operator_code',
      'Operator codes cannot confirm deliveries — re-intake the bag instead', 401);
  }

  // Verify against THIS order's parties only. Run BOTH verifications every
  // time (constant work; no oracle distinguishing customer vs affiliate).
  const customer = await Customer.findOne({ customerId: order.customerId })
    .select('+deliveryPinHash');
  const affiliate = await Affiliate.findOne({ affiliateId: order.affiliateId })
    .select('+affiliateDeliveryCodeHash');
  const customerMatch = roleCodes.verifyCode(code, customer && customer.deliveryPinHash);
  const affiliateMatch = roleCodes.verifyCode(code, affiliate && affiliate.affiliateDeliveryCodeHash);

  if (!customerMatch && !affiliateMatch) {
    const attempts = await codeAttemptLockout.registerFailure(key);
    logAuditEvent(AuditEvents.DELIVERY_CODE_FAILED, {
      orderId: order.orderId, attempts
    }, req);
    throw new DeliveryError('invalid_code', 'Invalid code', 401);
  }
  await codeAttemptLockout.clearFailures(key);

  const now = new Date();
  applyTransition(order, 'delivered');
  order.intake.deliveredAt = now;
  order.intake.deliveredBy = order.affiliateId; // the affiliate is at the door either way
  if (order.bags[0]) {
    order.bags[0].status = 'delivered';
    order.bags[0].scannedAt.delivered = now;
    order.bags[0].scannedBy.delivered = order.affiliateId;
  }
  order.proofOfDelivery = {
    method: customerMatch ? 'customer_pin' : 'affiliate_code',
    confirmedByRole: customerMatch ? 'customer' : 'affiliate',
    confirmedById: customerMatch ? order.customerId : order.affiliateId,
    confirmedAt: now,
    ...(toGeoPoint(geo) ? { geo: toGeoPoint(geo) } : {})
  };
  // Commission is realized at delivered ONLY (spec §6.4/§6.6) — set-once;
  // the Order pre-save set-once stamping makes a re-save a no-op.
  if (!order.commissionRealized) {
    order.commissionRealized = true;
    order.commissionRealizedAt = now;
  }
  await order.save();

  // Notifications are best-effort — never block a confirmed delivery.
  try {
    const affiliateName = affiliate
      ? (affiliate.businessName || `${affiliate.firstName} ${affiliate.lastName}`)
      : null;
    if (customer && customer.email) {
      await emailService.sendCustomerDeliveredEmail(customer, order, { affiliateName });
    }
    if (affiliate && affiliate.email) {
      await emailService.sendAffiliateCommissionEmail(affiliate, order, customer);
    }
  } catch (emailError) {
    logger.error(`Delivery emails failed for order ${order.orderId} (non-blocking):`, emailError);
  }

  logAuditEvent(AuditEvents.DELIVERY_CONFIRMED, {
    orderId: order.orderId,
    method: order.proofOfDelivery.method,
    confirmedByRole: order.proofOfDelivery.confirmedByRole
  }, req);

  return { order };
}

module.exports = { confirmDelivery, DeliveryError };
