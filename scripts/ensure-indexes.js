// Ensure redesign (PR 6–9) indexes exist in production.
//
//   node scripts/ensure-indexes.js        (or: npm run ensure-indexes)
//
// Production runs with mongoose autoIndex: false (server.js — Oracle ADB),
// so nothing provisions new schema indexes automatically. This script calls
// Model.createIndexes() (never drops anything — deliberately NOT syncIndexes)
// for every model carrying redesign indexes:
//   - Bag            (tokenHash unique, bagId unique, affiliate/customer/status)
//   - Order          (bagId_open_unique PARTIAL unique — two-kiosk re-intake guard)
//   - Operator       (scanCodeHmac unique sparse)
//   - AffiliateInvite (inviteId unique, tokenHash/email/status/expiresAt)
//
// !!! Oracle ADB Mongo API caveat !!!
// ADB's Mongo API may NOT support partial unique indexes. This script must be
// run on the box at deploy time and its output verified by a human. It
// explicitly checks that Order's `bagId_open_unique` exists AND carries its
// partialFilterExpression. If that index is missing or non-partial, the
// two-kiosk re-intake race protection degrades to the application-level
// open-order check — that MUST be flagged before launch.
//
// Exits 0 on success, 1 on connection/creation failure.
// (console.* is the established convention in scripts/ — see seed-access-gate.js.)

require('dotenv').config();
const mongoose = require('mongoose');

const Bag = require('../server/modules/bags/Bag');
const Order = require('../server/models/Order');
const Operator = require('../server/models/Operator');
const AffiliateInvite = require('../server/modules/onboarding/AffiliateInvite');

const MODELS = [Bag, Order, Operator, AffiliateInvite];

(async () => {
  let failed = false;
  try {
    const tls = process.env.MONGODB_TLS === 'false'
      ? {}
      : { tls: true, tlsAllowInvalidCertificates: process.env.NODE_ENV !== 'production' };
    await mongoose.connect(process.env.MONGODB_URI, { ...tls, autoIndex: false });
    console.log('connected to', mongoose.connection.name);

    for (const model of MODELS) {
      const label = `${model.modelName} (${model.collection.collectionName})`;
      try {
        await model.createIndexes();
        console.log('createIndexes ok:', label);
      } catch (e) {
        failed = true;
        console.error('createIndexes FAILED:', label, '-', e.message.split('\n')[0]);
      }
      try {
        const indexes = await model.collection.indexes();
        console.log(`indexes on ${label}:`);
        for (const idx of indexes) {
          const flags = [
            idx.unique ? 'unique' : null,
            idx.sparse ? 'sparse' : null,
            idx.partialFilterExpression ? `partial=${JSON.stringify(idx.partialFilterExpression)}` : null,
            idx.expireAfterSeconds !== undefined ? `ttl=${idx.expireAfterSeconds}s` : null
          ].filter(Boolean).join(' ');
          console.log(`  - ${idx.name} ${JSON.stringify(idx.key)} ${flags}`);
        }
      } catch (e) {
        failed = true;
        console.error('listing indexes FAILED:', label, '-', e.message.split('\n')[0]);
      }
    }

    // Explicit verification of the two-kiosk re-intake guard.
    const orderIndexes = await Order.collection.indexes();
    const guard = orderIndexes.find((i) => i.name === 'bagId_open_unique');
    if (guard && guard.unique && guard.partialFilterExpression) {
      console.log('VERIFIED: bagId_open_unique exists, unique, partialFilterExpression =',
        JSON.stringify(guard.partialFilterExpression));
    } else if (guard) {
      failed = true;
      console.error('***********************************************************');
      console.error('WARNING: bagId_open_unique exists but is NOT a partial unique');
      console.error('index (unique=%s, partial=%s). Two-kiosk re-intake race', !!guard.unique,
        JSON.stringify(guard.partialFilterExpression || null));
      console.error('protection degrades to the application-level open-order');
      console.error('check. FLAG THIS BEFORE LAUNCH.');
      console.error('***********************************************************');
    } else {
      failed = true;
      console.error('***********************************************************');
      console.error('WARNING: bagId_open_unique is MISSING on orders. Oracle ADB');
      console.error('Mongo API may not support partial unique indexes. Two-kiosk');
      console.error('re-intake race protection degrades to the application-level');
      console.error('open-order check. FLAG THIS BEFORE LAUNCH.');
      console.error('***********************************************************');
    }
  } catch (e) {
    failed = true;
    console.error('FATAL:', e.message);
  } finally {
    await mongoose.disconnect().catch(() => {});
  }
  process.exit(failed ? 1 : 0);
})();
