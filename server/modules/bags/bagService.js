// Bag service — mint, issue, resolve, claim, intake-link, inventory (spec §6.1).
//
// Typed error mirrors the InviteError / ClaimError pattern: callers branch on
// `code`, controllers map `status` to HTTP.

const { v4: uuidv4 } = require('uuid');
const Bag = require('./Bag');
const Affiliate = require('../../models/Affiliate');
const SystemConfig = require('../../models/SystemConfig');
const encryptionUtil = require('../../utils/encryption');
const { getOpenOrderContext } = require('../orders/openOrderContext');
const { logAuditEvent, AuditEvents } = require('../../utils/auditLogger');
const logger = require('../../utils/logger');

class BagError extends Error {
  constructor(code, status, message) {
    super(message || code);
    this.code = code;
    this.status = status;
    this.isBagError = true;
  }
}

function buildBagDoc({ affiliateId, batchId, adminId, tokenBytes }) {
  const token = encryptionUtil.generateToken(tokenBytes);
  return {
    token,
    tokenHash: Bag.hashToken(token),
    affiliateId,
    batchId,
    mintedBy: adminId,
    status: 'minted'
  };
}

/**
 * Mint a per-affiliate batch of durable bags.
 * Bounded by SystemConfig bag_mint_max_batch. insertMany { ordered:false }
 * with a single regenerate-and-retry pass on the (rare) E11000 token
 * collision. Returns { batchId, bags } — the ONLY place raw tokens leave the
 * service (the mint response feeds the label-print pipeline).
 */
async function mintBatch({ affiliateId, quantity, adminId, req = null }) {
  const maxBatch = await SystemConfig.getValue('bag_mint_max_batch', 200);
  const qty = parseInt(quantity, 10);
  if (!Number.isInteger(qty) || qty < 1 || qty > maxBatch) {
    throw new BagError('invalid_quantity', 400, `Quantity must be between 1 and ${maxBatch}`);
  }

  const affiliate = await Affiliate.findOne({ affiliateId });
  if (!affiliate) {
    throw new BagError('invalid_affiliate', 404, 'Affiliate not found');
  }

  const tokenBytes = await SystemConfig.getValue('bag_token_bytes', 16);
  const batchId = 'BATCH-' + uuidv4();
  const docs = Array.from({ length: qty }, () =>
    buildBagDoc({ affiliateId, batchId, adminId, tokenBytes }));

  try {
    await Bag.insertMany(docs, { ordered: false });
  } catch (err) {
    const writeErrors = err.writeErrors || [];
    const isDup = err.code === 11000 || writeErrors.some((e) => e.code === 11000);
    if (!isDup) throw err;
    // Regenerate the collided docs once and retry; non-colliding docs were
    // already inserted because { ordered: false }.
    const failedIdx = writeErrors.length > 0
      ? writeErrors.map((e) => e.index)
      : [...docs.keys()];
    const alreadyInserted = await Bag.countDocuments({ batchId });
    const retryDocs = failedIdx
      .slice(0, qty - alreadyInserted)
      .map(() => buildBagDoc({ affiliateId, batchId, adminId, tokenBytes }));
    if (retryDocs.length > 0) {
      await Bag.insertMany(retryDocs, { ordered: false });
    }
    logger.warn('Bag mint hit token collision; regenerated', { batchId, retried: retryDocs.length });
  }

  const bags = await Bag.find({ batchId }).sort({ bagId: 1 });
  logAuditEvent(AuditEvents.BAG_MINTED, {
    batchId, count: bags.length, affiliateId, adminId: String(adminId)
  }, req);
  return { batchId, bags };
}

/** Mark a whole minted batch as issued (handed to the affiliate). */
async function issueBatch({ batchId, adminId, req = null }) {
  const result = await Bag.updateMany(
    { batchId, status: 'minted' },
    { $set: { status: 'issued', issuedAt: new Date() } }
  );
  if (result.modifiedCount === 0) {
    throw new BagError('batch_not_found', 404, 'No mintable bags found for that batch');
  }
  logAuditEvent(AuditEvents.BAG_ISSUED, {
    batchId, issued: result.modifiedCount, adminId: String(adminId)
  }, req);
  return { batchId, issued: result.modifiedCount };
}

/**
 * Canonical scan resolver. Anti-enumeration: minted, retired, and unknown
 * tokens all resolve to null — callers return one generic error for all
 * three (spec §9). Returns { bag, outcome } where outcome is
 * 'unclaimed' (issued) or 'claimed' (active).
 */
async function resolveByToken(token) {
  if (!token || typeof token !== 'string') return null;
  const bag = await Bag.findOne({ tokenHash: Bag.hashToken(token) });
  if (!bag) return null;
  if (bag.status === 'issued') return { bag, outcome: 'unclaimed' };
  if (bag.status === 'active') {
    // PR 7: open-order context drives the kiosk/claim-page branch
    // (intake | advance | deliver-or-reintake). PII-free by construction.
    const ctx = await getOpenOrderContext(bag.bagId);
    return {
      bag,
      outcome: 'claimed',
      customerId: bag.customerId,
      nextAction: ctx.nextAction,
      ...(ctx.order ? { order: ctx.order } : {})
    };
  }
  return null; // minted / retired — non-resolvable
}

/**
 * Atomic claim (issued -> active). Returns the updated bag or null on race
 * loss / non-issued status. Audit fires only on success.
 */
async function claim({ token, customerId, req = null }) {
  const claimed = await Bag.claim(token, customerId);
  if (claimed) {
    logAuditEvent(AuditEvents.BAG_CLAIMED, {
      bagId: claimed.bagId, customerId, affiliateId: claimed.affiliateId
    }, req);
  }
  return claimed;
}

/**
 * Bag lifetime-counter bump primitive. Resolves an ACTIVE bag by token,
 * atomically increments the lifetime intake counters (orderCount /
 * lastIntakeAt), and returns the denormalized link ids. The open-order guard
 * itself lives in orderTransitionService (one open order per bag — open =
 * pending | in_progress | out_for_delivery; a cancelled/complete order never
 * blocks a new cycle since the bag stays 'active').
 */
async function linkToOrderAtIntake({ token, operatorId }) {
  if (!token || typeof token !== 'string') {
    throw new BagError('bag_not_active', 409, 'Bag is not active');
  }
  const bag = await Bag.findOneAndUpdate(
    { tokenHash: Bag.hashToken(token), status: 'active' },
    { $inc: { orderCount: 1 }, $set: { lastIntakeAt: new Date() } },
    { new: true }
  );
  if (!bag) {
    throw new BagError('bag_not_active', 409, 'Bag is not active');
  }
  logger.info('Bag linked at intake', { bagId: bag.bagId, operatorId: String(operatorId) });
  return { bag, customerId: bag.customerId, affiliateId: bag.affiliateId };
}

/**
 * Paginated inventory listing for admin / affiliate dashboards.
 * Never returns token or tokenHash — the raw token leaves the service only
 * in the mint response (label printing).
 */
async function getInventory({ affiliateId, status, page = 1, limit = 50 } = {}) {
  const filter = {};
  if (affiliateId) filter.affiliateId = affiliateId;
  if (status) filter.status = status;
  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const pageSize = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
  const [bags, total] = await Promise.all([
    Bag.find(filter)
      .select('-token -tokenHash')
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * pageSize)
      .limit(pageSize),
    Bag.countDocuments(filter)
  ]);
  return {
    bags,
    pagination: { total, page: pageNum, totalPages: Math.max(Math.ceil(total / pageSize), 1) }
  };
}

// FUTURE (spec §6.1 — hooks only, do NOT implement this phase):
//   reassign({ token, toCustomerId, adminId }), retire({ token, adminId, reason })

module.exports = {
  BagError,
  mintBatch,
  issueBatch,
  resolveByToken,
  claim,
  linkToOrderAtIntake,
  getInventory
};
