/**
 * In-house MongoDB-backed store for express-rate-limit v7+.
 *
 * Closes H-6 from docs/security/prod-lockdown-2026-05-20.md. The previous
 * fallback used the package's default in-memory store, which is per-worker
 * — meaning with PM2 cluster mode `max`, the configured `max` was
 * effectively multiplied by the worker count (the auth limiter's
 * documented "5 / 15 min" became "5 × workers / 15 min").
 *
 * Why not the published `rate-limit-mongo` package: it still depends on
 * `underscore@1.12.1` (multiple high-severity CVEs). The maintained
 * alternative `rate-limit-redis` requires standing up a dedicated Redis
 * instance (mailcow's Redis is shared and namespace-mixing is unclean).
 * Our app already has a MongoDB connection — a tiny store using it
 * directly is the lowest-risk path.
 *
 * Store interface follows express-rate-limit v7+: init / increment /
 * decrement / resetKey / resetAll / shutdown. Hits are stored in a
 * dedicated collection per limiter (`ratelimit_<name>`) so different
 * limiters (auth / api / passwordReset / etc.) don't collide. Documents
 * carry an `_expiresAt` field and a 1-second-granularity TTL index purges
 * expired counter records automatically.
 */

const mongoose = require('mongoose');

class MongoRateLimitStore {
  /**
   * @param {object} options
   * @param {number} options.windowMs  Sliding-window length in ms.
   * @param {string} options.name      Limiter name (used as collection suffix).
   */
  constructor({ windowMs, name }) {
    this.windowMs = windowMs;
    this.name = name || 'default';
    this.collectionName = `ratelimit_${this.name}`;
    this._initialized = false;
  }

  /**
   * Called by express-rate-limit once the limiter is constructed. Passes
   * the limiter's own `windowMs` in case we want to honor the limiter's
   * value over the one given to the constructor.
   */
  async init(options) {
    if (options && typeof options.windowMs === 'number') {
      this.windowMs = options.windowMs;
    }

    // Lazily resolve the collection — Mongoose's connection might not be
    // open yet when express-rate-limit constructs us at module load.
    const coll = mongoose.connection.collection(this.collectionName);
    // TTL index — Mongo purges documents whose _expiresAt has passed.
    // `expireAfterSeconds: 0` means "purge as soon as _expiresAt is in
    // the past" (with a ~60s mongod sweep granularity, but that's fine
    // — the count math uses _expiresAt directly, not relying on the
    // sweep for correctness).
    try {
      await coll.createIndex({ _expiresAt: 1 }, { expireAfterSeconds: 0 });
    } catch (_e) {
      // Already-exists is fine; other errors should not crash startup.
    }
    this._initialized = true;
  }

  /**
   * Atomic increment + return current count + window reset time.
   * @param {string} key
   * @returns {Promise<{ totalHits: number, resetTime: Date }>}
   */
  async increment(key) {
    const now = Date.now();
    const nowDate = new Date(now);
    const expiresAt = new Date(now + this.windowMs);

    const coll = mongoose.connection.collection(this.collectionName);
    const unwrap = (r) => (r && r.value !== undefined ? r.value : r); // driver-version compat

    // Step 1 — increment ONLY within an active (unexpired) window. Critical on
    // Oracle ADB, where the TTL index is inert: an expired counter lingers, and
    // the old blind $inc kept incrementing it forever (the window never reset),
    // so a limiter could jam permanently once it crossed `max`. This filter
    // ignores any doc whose _expiresAt has passed.
    const active = unwrap(await coll.findOneAndUpdate(
      { _id: key, _expiresAt: { $gt: nowDate } },
      { $inc: { hits: 1 } },
      { returnDocument: 'after' }
    ));
    if (active) {
      return { totalHits: active.hits, resetTime: active._expiresAt };
    }

    // Step 2 — no active window (new key, or an expired/lingering doc) → start a
    // fresh window. $set (not $inc) RESETS hits to 1 and rolls _expiresAt.
    const fresh = unwrap(await coll.findOneAndUpdate(
      { _id: key },
      { $set: { hits: 1, _expiresAt: expiresAt } },
      { upsert: true, returnDocument: 'after' }
    ));
    return {
      totalHits: (fresh && fresh.hits) || 1,
      resetTime: (fresh && fresh._expiresAt) || expiresAt
    };
  }

  /**
   * Decrement (e.g. on a successful request when `skipSuccessfulRequests`).
   * Never lets the counter go below 0.
   */
  async decrement(key) {
    const coll = mongoose.connection.collection(this.collectionName);
    await coll.updateOne(
      { _id: key, hits: { $gt: 0 } },
      { $inc: { hits: -1 } }
    );
  }

  /** Wipe state for a single key. */
  async resetKey(key) {
    const coll = mongoose.connection.collection(this.collectionName);
    await coll.deleteOne({ _id: key });
  }

  /** Wipe state for every key in this limiter's bucket. */
  async resetAll() {
    const coll = mongoose.connection.collection(this.collectionName);
    await coll.deleteMany({});
  }

  /** No-op on shutdown; we share the global Mongoose connection. */
  async shutdown() { /* no-op */ }
}

module.exports = MongoRateLimitStore;
