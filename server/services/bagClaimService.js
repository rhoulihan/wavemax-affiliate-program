// Bag claim service — adapts bagService for the customer claim path
// (spec §6.3). States: 'claimable' (issued) | 'claimed' (active) |
// 'invalid' (minted/retired/unknown — one generic state, no oracle).

const Affiliate = require('../models/Affiliate');
const Customer = require('../models/Customer');
const SystemConfig = require('../models/SystemConfig');
const bagService = require('../modules/bags/bagService');
const roleCodes = require('../utils/roleCodes');

class ClaimError extends Error {
  constructor(code, status, message) {
    super(message || code);
    this.code = code;
    this.status = status;
    this.isClaimError = true;
  }
}

/**
 * Resolve a scanned bag token into a claim-page state.
 * - 'claimable': includes the affiliate public projection (same fields as
 *   affiliateController.getPublicAffiliateInfo) so the form can show
 *   "Registering with <name>".
 * - 'claimed': includes the open order's { status, awaitingDelivery } with
 *   NO customer PII. Order.bagId does not exist until PR 7, so the slot is
 *   designed now and returned as null; PR 9 populates it.
 */
async function resolveClaimToken(bagToken) {
  const resolved = await bagService.resolveByToken(bagToken);
  if (!resolved) return { state: 'invalid' };
  const { bag, outcome } = resolved;

  if (outcome === 'unclaimed') {
    const affiliate = await Affiliate.findOne({ affiliateId: bag.affiliateId })
      .select('affiliateId firstName lastName businessName minimumDeliveryFee perBagDeliveryFee city state');
    if (!affiliate) return { state: 'invalid' }; // orphaned bag — treat as invalid
    return { state: 'claimable', bag, affiliate };
  }

  // outcome === 'claimed' — order context arrives with PR 7/9:
  // order: { status, awaitingDelivery } (awaitingDelivery true iff picked_up)
  return { state: 'claimed', bag, order: null };
}

/**
 * Atomic claim for a freshly created customer. Throws
 * ClaimError('bag_already_claimed', 409) on race loss so the caller can run
 * its compensating delete.
 */
async function claimForCustomer(bag, customerId, req = null) {
  const claimed = await bagService.claim({ token: bag.token, customerId, req });
  if (!claimed) {
    throw new ClaimError('bag_already_claimed', 409, 'This bag has already been claimed');
  }

  // PR 9: every claim provisions the customer's delivery PIN (spec §4.5).
  // Covers both the traditional and OAuth claim paths in one hook point.
  const pinLength = await SystemConfig.getValue('customer_delivery_pin_length', 6);
  const deliveryPin = roleCodes.generateCode(pinLength);
  await Customer.updateOne(
    { customerId },
    { $set: { deliveryPinHash: roleCodes.hashCode(deliveryPin), deliveryPinSetAt: new Date() } }
  );

  return claimed;
}

module.exports = {
  ClaimError,
  resolveClaimToken,
  claimForCustomer
};
