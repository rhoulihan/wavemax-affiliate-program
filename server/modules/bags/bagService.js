// Bag service — mint, issue, resolve, claim, intake-link, inventory (spec §6.1).
//
// Typed error mirrors the InviteError / ClaimError pattern: callers branch on
// `code`, controllers map `status` to HTTP.

const { v4: uuidv4 } = require('uuid');
const Bag = require('./Bag');
const Affiliate = require('../../models/Affiliate');
const SystemConfig = require('../../models/SystemConfig');
const encryptionUtil = require('../../utils/encryption');
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

module.exports = {
  BagError,
  mintBatch,
  issueBatch
};
