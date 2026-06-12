// W-9 threshold trigger (spec §6.2 lifecycle, first arrow; spec §8 Decision #6).
// not_required --(YTD realized commission crosses w9_threshold_usd)--> required
// + payment lock. Called best-effort from every commission-realization site;
// NEVER throws into a delivery path.

const Order = require('../../models/Order');
const Affiliate = require('../../models/Affiliate');
const SystemConfig = require('../../models/SystemConfig');
const affiliatePaymentLockService = require('../../services/affiliatePaymentLockService');
const { logAuditEvent, AuditEvents } = require('../../utils/auditLogger');
const logger = require('../../utils/logger');

async function ytdRealizedCommission(affiliateId) {
  const startOfYear = new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1));
  const [row] = await Order.aggregate([
    { $match: { affiliateId, commissionRealized: true, commissionRealizedAt: { $gte: startOfYear } } },
    { $group: { _id: null, total: { $sum: '$affiliateCommission' } } }
  ]);
  return row ? row.total : 0;
}

/**
 * Re-check one affiliate against the W-9 earnings threshold.
 * Reads w9_threshold_usd with w9_earnings_threshold as the DB fallback
 * (PR 3 handoff — legacy alias). Only acts on w9Status === 'not_required'.
 * @returns {Promise<{triggered: boolean, ytd?: number, threshold?: number}>}
 */
async function applyW9ThresholdCheck(affiliateId, { req = null } = {}) {
  try {
    const affiliate = await Affiliate.findOne({ affiliateId })
      .select('affiliateId w9Status paymentProcessingLocked');
    if (!affiliate || affiliate.w9Status !== 'not_required') return { triggered: false };

    const threshold = await SystemConfig.getValue(
      'w9_threshold_usd',
      await SystemConfig.getValue('w9_earnings_threshold', 600)
    );
    const ytd = await ytdRealizedCommission(affiliateId);
    if (ytd < threshold) return { triggered: false, ytd, threshold };

    affiliate.w9Status = 'required';
    await affiliate.save();
    await affiliatePaymentLockService.lockPayments({
      affiliateId,
      reason: 'w9_required',
      notes: `Auto-locked: YTD realized commission $${ytd.toFixed(2)} crossed the W-9 threshold $${Number(threshold).toFixed(2)}`
    });
    logAuditEvent(AuditEvents.W9_REQUIRED_THRESHOLD, { affiliateId, ytd, threshold }, req);
    logger.info('W-9 threshold crossed — w9Status=required, payments locked', { affiliateId, ytd, threshold });
    return { triggered: true, ytd, threshold };
  } catch (error) {
    // Best-effort by contract: a compliance check must never block a delivery.
    logger.error('w9ThresholdService failed (non-blocking)', { affiliateId, error: error.message });
    return { triggered: false, error: error.message };
  }
}

module.exports = { applyW9ThresholdCheck, ytdRealizedCommission };
