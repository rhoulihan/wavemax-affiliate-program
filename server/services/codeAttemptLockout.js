// Per-bag/IP failed-code attempt lockout (spec §6.6/§9).
//
// Reuses the in-house Mongo-backed rate-limit store (the same infrastructure
// the express limiters use — server/middleware/rateLimitMongoStore.js) so the
// counter is shared across PM2 cluster workers and TTL-purged by Mongo.
// Unlike the express limiters this is NOT skipped in tests: lockout is a
// security behavior under test, and it counts FAILURES (a request limiter
// counts requests).
//
// Key shape: "<scope>:<sha256(bagToken)[0..16]>:<ip>" — the raw token never
// touches the store.

const crypto = require('crypto');
const mongoose = require('mongoose');
const MongoRateLimitStore = require('../middleware/rateLimitMongoStore');

const WINDOW_MS = 15 * 60 * 1000;
const STORE_NAME = 'bag_codes';

let store = null;
function getStore() {
  if (!store) {
    store = new MongoRateLimitStore({ windowMs: WINDOW_MS, name: STORE_NAME });
    store.init({ windowMs: WINDOW_MS }).catch(() => { /* TTL index best-effort */ });
  }
  return store;
}

function attemptKey({ scope, bagToken, ip }) {
  const tokenDigest = crypto.createHash('sha256')
    .update(String(bagToken || '')).digest('hex').slice(0, 16);
  return `${scope}:${tokenDigest}:${ip || 'no-ip'}`;
}

/** Record a failed attempt; returns the running failure count. */
async function registerFailure(key) {
  const { totalHits } = await getStore().increment(key);
  return totalHits;
}

/** True when the key has >= maxAttempts unexpired failures. */
async function isLockedOut(key, maxAttempts) {
  const doc = await mongoose.connection
    .collection(`ratelimit_${STORE_NAME}`)
    .findOne({ _id: key });
  if (!doc) return false;
  if (doc._expiresAt && doc._expiresAt < new Date()) return false;
  return doc.hits >= maxAttempts;
}

/** Wipe the counter (on a successful code entry). */
async function clearFailures(key) {
  return getStore().resetKey(key);
}

module.exports = { attemptKey, registerFailure, isLockedOut, clearFailures, WINDOW_MS };
