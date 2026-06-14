// Bag HTTP layer — thin wrappers over bagService / labelSheetService.

const jwt = require('jsonwebtoken');
const ControllerHelpers = require('../../utils/controllerHelpers');
const bagService = require('./bagService');
const labelSheetService = require('./labelSheetService');
const Affiliate = require('../../models/Affiliate');
const { authenticate } = require('../../middleware/auth');
const { checkAdminPermission } = require('../../middleware/rbac');

const { asyncWrapper, sendSuccess, sendError } = ControllerHelpers;

// Short-lived, purpose-scoped token that lets a browser TAB navigation open the
// printable labels page. A top-level GET carries no Authorization header (the
// admin JWT lives in localStorage), so the labels route can't rely on it. We
// keep the admin JWT out of URLs/logs by minting a separate token scoped to one
// batch, read-only, 15-minute TTL. See bagLabelsAccess below.
const LABELS_TOKEN_PURPOSE = 'bag-labels';
const LABELS_TOKEN_TTL = '15m';

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

/**
 * POST /api/v1/bags/print-run — admin + manage_affiliates + CSRF.
 * Combined mint+issue: labels are ALWAYS tied to an affiliate. Mints a batch
 * then immediately issues it so the printed bags are claimable. No partial
 * state on the happy path — mint validates the affiliate/quantity first, then
 * issue flips the whole batch in one updateMany.
 */
exports.printRun = asyncWrapper(async (req, res) => {
  const { affiliateId, quantity } = req.body;
  try {
    const { batchId, bags } = await bagService.mintBatch({
      affiliateId, quantity, adminId: req.user.id, req
    });
    await bagService.issueBatch({ batchId, adminId: req.user.id, req });
    // Mint a short-lived labels token so the admin UI can open the printable
    // page via a top-level tab navigation (which carries no auth header).
    const labelsToken = jwt.sign(
      { batchId, purpose: LABELS_TOKEN_PURPOSE },
      process.env.JWT_SECRET,
      { expiresIn: LABELS_TOKEN_TTL }
    );
    return sendSuccess(res, { batchId, count: bags.length, labelsToken }, 'Bag print run created', 201);
  } catch (err) {
    return mapBagError(res, err);
  }
});

/**
 * Access shim for GET /api/v1/bags/batch/:batchId/labels ONLY.
 * Primary path: a short-lived `?t=` labels token (purpose + batch scoped) lets a
 * browser tab open the printable page without an auth header. Fallback: a
 * logged-in admin hitting the URL with a Bearer header still works via the
 * normal authenticate + checkAdminPermission chain. An invalid/expired `t` with
 * no valid admin auth falls through to the admin chain and 401/403s as before.
 * Scoped to this route — does NOT broaden the global authenticate.
 */
exports.bagLabelsAccess = (req, res, next) => {
  const token = req.query.t;
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
      if (decoded.purpose === LABELS_TOKEN_PURPOSE && decoded.batchId === req.params.batchId) {
        return next();
      }
    } catch {
      // fall through to admin auth
    }
  }
  // No (or invalid) labels token → require a logged-in admin with the perm.
  return authenticate(req, res, () => checkAdminPermission('manage_affiliates')(req, res, next));
};

/** GET /api/v1/bags/batch/:batchId/labels — labels token OR admin + manage_affiliates */
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
 * slot is populated HERE for open orders ({status, awaitingDelivery,
 * nextAction}); the customer claim resolver gains the same context in PR 9.
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
  return sendSuccess(res, {
    outcome,
    customerId: bag.customerId,
    nextAction: resolved.nextAction,
    order: resolved.order || null
  });
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
