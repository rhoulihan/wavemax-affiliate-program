// Bag HTTP layer — thin wrappers over bagService / labelSheetService.

const ControllerHelpers = require('../../utils/controllerHelpers');
const bagService = require('./bagService');
const labelSheetService = require('./labelSheetService');
const Affiliate = require('../../models/Affiliate');

const { asyncWrapper, sendSuccess, sendError } = ControllerHelpers;

function mapBagError(res, err) {
  if (err.isBagError) return sendError(res, err.message, err.status);
  throw err;
}

/** POST /api/v1/bags/mint — admin + manage_affiliates + CSRF */
exports.mintBags = asyncWrapper(async (req, res) => {
  const { affiliateId, quantity } = req.body;
  try {
    const { batchId, bags } = await bagService.mintBatch({
      affiliateId, quantity, adminId: req.user.id, req
    });
    return sendSuccess(res, {
      batchId,
      count: bags.length,
      // Raw tokens returned exactly once — the mint response feeds printing.
      bags: bags.map((b) => ({ bagId: b.bagId, token: b.token, status: b.status }))
    }, 'Bag batch minted', 201);
  } catch (err) {
    return mapBagError(res, err);
  }
});

/** GET /api/v1/bags/batch/:batchId/labels — admin + manage_affiliates */
exports.getBatchLabels = asyncWrapper(async (req, res) => {
  const html = await labelSheetService.renderLabelSheet(req.params.batchId);
  if (!html) return sendError(res, 'Batch not found', 404);
  res.type('text/html').send(html);
});

/** POST /api/v1/bags/batch/:batchId/issue — admin + manage_affiliates + CSRF */
exports.issueBatch = asyncWrapper(async (req, res) => {
  try {
    const result = await bagService.issueBatch({
      batchId: req.params.batchId, adminId: req.user.id, req
    });
    return sendSuccess(res, result, 'Batch issued');
  } catch (err) {
    return mapBagError(res, err);
  }
});

/**
 * GET /api/v1/bags/resolve/:token — PUBLIC (rate-limited).
 * Canonical scan-context resolver (spec §5). Anti-enumeration: unknown,
 * minted, and retired tokens share one generic 404. Never returns customer
 * PII; `customerId` only on 'claimed' to drive login routing. The `order`
 * slot is the designed shape populated by PR 7/9 — null until then.
 */
exports.resolveBag = asyncWrapper(async (req, res) => {
  const resolved = await bagService.resolveByToken(req.params.token);
  if (!resolved) return sendError(res, 'invalid_bag', 404);
  const { bag, outcome } = resolved;
  if (outcome === 'unclaimed') {
    const affiliate = await Affiliate.findOne({ affiliateId: bag.affiliateId })
      .select('businessName firstName lastName');
    const name = affiliate
      ? (affiliate.businessName || `${affiliate.firstName} ${affiliate.lastName}`)
      : null;
    return sendSuccess(res, { outcome, affiliate: { name }, order: null });
  }
  // claimed
  return sendSuccess(res, { outcome, customerId: bag.customerId, order: null });
});

/** GET /api/v1/bags — affiliate (own) / administrator */
exports.getInventory = asyncWrapper(async (req, res) => {
  const { status, page, limit } = req.query;
  let affiliateId = req.query.affiliateId;
  if (req.user.role === 'affiliate') {
    affiliateId = req.user.affiliateId; // own bags only, ignore the query param
  } else if (req.user.role !== 'administrator') {
    return sendError(res, 'Access denied', 403);
  }
  const result = await bagService.getInventory({ affiliateId, status, page, limit });
  return sendSuccess(res, result);
});
