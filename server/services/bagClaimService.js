// Bag claim service — adapts bagService for the customer claim path
// (spec §6.3). States: 'claimable' (issued) | 'claimed' (active) |
// 'invalid' (minted/retired/unknown — one generic state, no oracle).

const Affiliate = require('../models/Affiliate');
const bagService = require('../modules/bags/bagService');
const { getOpenOrderContext } = require('../modules/orders/openOrderContext');

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
      .select('affiliateId firstName lastName businessName minimumDeliveryFee perBagDeliveryFee city state serviceType pickupInstructions');
    if (!affiliate) return { state: 'invalid' }; // orphaned bag — treat as invalid
    return { state: 'claimable', bag, affiliate };
  }

  // outcome === 'claimed' — the same open-order context the bags resolver
  // returns. order: { status, nextAction }, PII-free.
  const ctx = await getOpenOrderContext(bag.bagId);
  return {
    state: 'claimed',
    bag,
    nextAction: ctx.nextAction,
    ...(ctx.order ? { order: ctx.order } : {})
  };
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
  return claimed;
}

module.exports = {
  ClaimError,
  resolveClaimToken,
  claimForCustomer
};
