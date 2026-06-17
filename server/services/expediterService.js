// Order Expediter aggregations (PR D) — read-only, AGGREGATE-ONLY (no customer
// PII). Powers the always-on in-store display: who has active orders, totals by
// state across all affiliates, and a daily completed-orders summary.
//
// Phase 1 holds no weight/money (Cents owns it), so the daily summary reports
// counts + timing only (no "pounds of WDF"). Timing is derived from the scan
// timestamps already on the Order: intake.at, storePickup.at, pickup.at,
// completedAt.

const Order = require('../models/Order');
const Affiliate = require('../models/Affiliate');
const SystemConfig = require('../models/SystemConfig');
const { OPEN_STATUSES } = require('../modules/orders/orderStateMachine');

// Cap the per-affiliate rows returned to the display (counters always reflect
// ALL open orders — only the table is bounded). Single-store volume is tiny;
// this just bounds a pathological response.
const MAX_AFFILIATE_ROWS = 100;

/**
 * Start of "today" in the store's configured timezone, returned as a UTC Date
 * for the Mongo query. The server may run in UTC while the store keeps local
 * hours (system_timezone, default America/Chicago) — using the server's own
 * local midnight would misalign the day boundary by the tz offset.
 */
function startOfTodayInTz(tz) {
  const now = new Date();
  // Reinterpret "now" as the tz wall clock and as UTC, both in server-local
  // epoch space, to recover the tz→UTC offset (DST-correct for the instant).
  const tzNow = new Date(now.toLocaleString('en-US', { timeZone: tz }));
  const utcNow = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
  const offsetMs = tzNow.getTime() - utcNow.getTime();
  const localMidnight = new Date(tzNow);
  localMidnight.setHours(0, 0, 0, 0);
  return new Date(localMidnight.getTime() - offsetMs);
}

/**
 * @returns {Promise<{
 *   generatedAt: string,
 *   counters: {pending:number, in_progress:number, out_for_delivery:number, total:number},
 *   activeByAffiliate: Array<{affiliateId,name,serviceType,pending,in_progress,out_for_delivery,total}>,
 *   dailyCompleted: {count:number, avgProcessingMinutes:number|null, avgTurnaroundMinutes:number|null}
 * }>}
 */
async function getExpediterSummary() {
  // Open orders grouped by affiliate + status (skip orphan/null affiliateId).
  const openRows = await Order.aggregate([
    { $match: { status: { $in: OPEN_STATUSES }, affiliateId: { $ne: null } } },
    { $group: { _id: { affiliateId: '$affiliateId', status: '$status' }, count: { $sum: 1 } } }
  ]);

  const counters = { total: 0 };
  OPEN_STATUSES.forEach((s) => { counters[s] = 0; });

  const byAffiliate = new Map();
  for (const row of openRows) {
    const aid = row._id.affiliateId;
    const st = row._id.status;
    const c = row.count;
    if (aid == null) continue; // defensive (matched out above)
    if (!byAffiliate.has(aid)) {
      const rec = { affiliateId: aid, total: 0 };
      OPEN_STATUSES.forEach((s) => { rec[s] = 0; });
      byAffiliate.set(aid, rec);
    }
    const rec = byAffiliate.get(aid);
    if (rec[st] !== undefined) rec[st] += c;
    rec.total += c;
    if (counters[st] !== undefined) counters[st] += c;
    counters.total += c;
  }

  // Attach affiliate display names (no customer PII anywhere in this payload).
  const ids = [...byAffiliate.keys()];
  if (ids.length) {
    const affs = await Affiliate.find({ affiliateId: { $in: ids } })
      .select('affiliateId businessName firstName lastName serviceType').lean();
    const nameMap = new Map(affs.map((a) => [a.affiliateId, a]));
    for (const rec of byAffiliate.values()) {
      const a = nameMap.get(rec.affiliateId);
      rec.name = a ? (a.businessName || `${a.firstName || ''} ${a.lastName || ''}`.trim() || rec.affiliateId)
        : rec.affiliateId;
      rec.serviceType = a ? a.serviceType : null;
    }
  }
  const activeByAffiliate = [...byAffiliate.values()]
    .sort((a, b) => b.total - a.total)
    .slice(0, MAX_AFFILIATE_ROWS);

  // Daily completed summary (orders completed since local midnight in the store tz).
  const tz = await SystemConfig.getValue('system_timezone', 'America/Chicago');
  const dayStart = startOfTodayInTz(tz);
  const completedToday = await Order.find({
    status: 'complete', completedAt: { $gte: dayStart }
  }).select('intake.at storePickup.at pickup.at completedAt').lean();

  let procSum = 0; let procN = 0; let turnSum = 0; let turnN = 0;
  for (const o of completedToday) {
    if (o.intake && o.intake.at && o.storePickup && o.storePickup.at) {
      procSum += (new Date(o.storePickup.at).getTime() - new Date(o.intake.at).getTime());
      procN += 1;
    }
    if (o.pickup && o.pickup.at && o.completedAt) {
      turnSum += (new Date(o.completedAt).getTime() - new Date(o.pickup.at).getTime());
      turnN += 1;
    }
  }
  const toMin = (ms) => Math.round(ms / 60000);

  return {
    generatedAt: new Date().toISOString(),
    counters,
    activeByAffiliate,
    dailyCompleted: {
      count: completedToday.length,
      // intake → ready-for-pickup (the in-store WDF window)
      avgProcessingMinutes: procN ? toMin(procSum / procN) : null,
      // pickup → delivered (full turnaround)
      avgTurnaroundMinutes: turnN ? toMin(turnSum / turnN) : null
    }
  };
}

module.exports = { getExpediterSummary };
