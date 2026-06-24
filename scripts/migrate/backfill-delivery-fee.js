#!/usr/bin/env node
/**
 * backfill-delivery-fee.js — one-time migration for the V1 fee-field removal.
 *
 * The 2026-06-23 audit collapsed the per-affiliate delivery fee to the single
 * flat `deliveryFee`, removing the V1 `minimumDeliveryFee`/`perBagDeliveryFee`
 * pair from the Affiliate schema. Affiliates created/edited before the flat
 * field existed carry `deliveryFee = 0` (or unset) alongside real legacy V1
 * values. Because the customer-facing fee now resolves through
 * `effectiveDeliveryFee` (deliveryFee > 0 ? deliveryFee : default_delivery_fee),
 * those partners would silently flip to the house default. This migration
 * preserves each partner's prior effective fee.
 *
 * For every affiliate doc that still carries a V1 field:
 *   - if `deliveryFee` is unset/0, set it to `perBagDeliveryFee || minimumDeliveryFee || 0`
 *     (the exact formula the OLD getPublicAffiliateInfoById used), and
 *   - $unset the now-orphaned `minimumDeliveryFee` + `perBagDeliveryFee`.
 *
 * It reads the RAW collection (the Mongoose model no longer maps the V1 fields,
 * so strict mode would hide them). Idempotent: a second run finds no V1 fields
 * and does nothing.
 *
 * SAFETY: dry-run by default — prints what WOULD change and exits. Pass --yes
 * (or --confirm) to write. No production abort guard by design (run on the box
 * that reaches the target DB); the dry-run default + explicit flag are the guard.
 *
 * Usage (on the box that reaches the target DB):
 *   node scripts/migrate/backfill-delivery-fee.js            # dry-run preview
 *   node scripts/migrate/backfill-delivery-fee.js --yes      # execute
 *
 * npm:
 *   npm run migrate:delivery-fee           # dry-run
 *   npm run migrate:delivery-fee:confirm   # execute (--yes)
 */
'use strict';

const Affiliate = require('../../server/models/Affiliate');

const V1_QUERY = {
  $or: [
    { minimumDeliveryFee: { $exists: true } },
    { perBagDeliveryFee: { $exists: true } }
  ]
};

/**
 * The effective legacy fee for a raw affiliate doc — mirrors the OLD
 * getPublicAffiliateInfoById: perBag wins, then min, else 0.
 * @param {object} doc raw affiliate document
 * @returns {number}
 */
function legacyEffectiveFee(doc) {
  return Number(doc.perBagDeliveryFee) || Number(doc.minimumDeliveryFee) || 0;
}

/**
 * Backfill + clean the flat deliveryFee from legacy V1 fields. Operates on the
 * already-connected default mongoose connection (no connect/disconnect, no
 * process.exit) so it is unit-testable.
 *
 * @param {Object}  [opts]
 * @param {boolean} [opts.dryRun=true] count only; write nothing
 * @param {Function}[opts.log]         optional line logger (message:string)
 * @returns {Promise<{dryRun:boolean, scanned:number, backfilled:number, cleaned:number, samples:Array}>}
 */
async function backfillDeliveryFee({ dryRun = true, log = () => {} } = {}) {
  const coll = Affiliate.collection;
  const docs = await coll.find(V1_QUERY).toArray();

  let backfilled = 0;
  let cleaned = 0;
  const samples = [];

  for (const d of docs) {
    const hasFlat = typeof d.deliveryFee === 'number' && d.deliveryFee > 0;
    const legacy = legacyEffectiveFee(d);
    const update = { $unset: { minimumDeliveryFee: '', perBagDeliveryFee: '' } };

    if (!hasFlat && legacy > 0) {
      update.$set = { deliveryFee: legacy };
      backfilled += 1;
      if (samples.length < 10) {
        samples.push({ affiliateId: d.affiliateId, from: d.deliveryFee || 0, to: legacy });
      }
    }
    cleaned += 1;

    if (!dryRun) {
      await coll.updateOne({ _id: d._id }, update);
    }
  }

  log(`${dryRun ? 'would backfill' : 'backfilled'} deliveryFee on ${backfilled} affiliate(s)`);
  log(`${dryRun ? 'would clean' : 'cleaned'} orphaned V1 fee fields on ${cleaned} affiliate(s)`);
  return { dryRun, scanned: docs.length, backfilled, cleaned, samples };
}

/**
 * Decide run mode from CLI args. Pure + exported so the safe default (no flag =>
 * dry-run) is unit-testable. Case-sensitive on purpose.
 * @param {string[]} argv process.argv.slice(2)
 * @returns {{dryRun:boolean}}
 */
function decideMode(argv = []) {
  const execute = argv.includes('--yes') || argv.includes('--confirm');
  return { dryRun: !execute };
}

async function main() {
  const path = require('path');
  require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
  const mongoose = require('mongoose');

  const { dryRun } = decideMode(process.argv.slice(2));

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('FATAL: MONGODB_URI is not set. Refusing to run.');
    process.exit(1);
  }

  // Match scripts/ensure-indexes.js / clear-customer-data.js exactly.
  const tls = process.env.MONGODB_TLS === 'false'
    ? {}
    : { tls: true, tlsAllowInvalidCertificates: process.env.NODE_ENV !== 'production' };

  await mongoose.connect(uri, { ...tls, autoIndex: false, serverSelectionTimeoutMS: 20000 });

  const dbName = mongoose.connection.name;
  const host = mongoose.connection.host || '(unknown host)';
  console.log(`\nConnected to DB "${dbName}" @ ${host}`);
  console.log(`Mode: ${dryRun ? 'DRY-RUN (no writes) — pass --yes to execute' : 'EXECUTE (will write)'}\n`);

  try {
    // Preview first, always.
    const preview = await backfillDeliveryFee({ dryRun: true, log: (m) => console.log('  ' + m) });
    if (preview.samples.length) {
      console.log('\n  sample backfills (affiliateId: from -> to):');
      preview.samples.forEach((s) => console.log(`    ${s.affiliateId}: $${s.from} -> $${s.to}`));
    }

    if (dryRun) {
      console.log(`\nDry-run complete. ${preview.backfilled} backfill(s), ${preview.cleaned} cleanup(s) over ${preview.scanned} doc(s). Re-run with --yes to execute.`);
      return;
    }

    if (preview.scanned === 0) {
      console.log('\nNothing to migrate (no affiliate carries a V1 fee field). Exiting.');
      return;
    }

    console.log(`\n*** About to WRITE to ${preview.scanned} affiliate doc(s) in "${dbName}". ***`);
    console.log('Press Ctrl-C within 5 seconds to abort...');
    await new Promise((resolve) => setTimeout(resolve, 5000));

    const result = await backfillDeliveryFee({ dryRun: false, log: (m) => console.log('  ' + m) });

    // Verify: re-count V1-bearing docs (should be 0 after cleanup).
    const remaining = await Affiliate.collection.countDocuments(V1_QUERY);
    console.log(`\nDone. Backfilled ${result.backfilled}, cleaned ${result.cleaned}. V1-bearing docs remaining: ${remaining}.`);
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
}

module.exports = { backfillDeliveryFee, legacyEffectiveFee, decideMode, V1_QUERY };
