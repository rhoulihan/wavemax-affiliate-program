// Periodic MongoDB connection recycler (per PM2 worker).
//
// Root cause of the intermittent Oracle-ADB "cursor is missing" errors is
// degraded long-lived pooled connections against the loadBalanced ADB endpoint
// — fresh connections never fail (verified: 43k findOne ops on a new client, 0
// failures). `maxIdleTimeMS` recycles idle connections continuously; this
// recycler is the explicit periodic hard reset for connections that stay busy.
//
// It closes and re-opens the mongoose pool on an interval, STAGGERED by worker
// instance (NODE_APP_INSTANCE) so the cluster never resets every worker at once.
// mongoose command buffering (bufferCommands, default on) queues queries during
// the brief reconnect, and the cursor-retry shim covers connect-mongo's separate
// pool. Every step is guarded so a failed recycle can never crash a worker.
//
// connect-mongo runs its own MongoClient (mongoUrl) — that pool relies on
// maxIdleTimeMS (set in its mongoOptions) + the cursor-retry shim, not this.

const DEFAULT_INTERVAL_MS = 30 * 60 * 1000; // recycle each worker every 30 min
const DEFAULT_STAGGER_MS = 5 * 60 * 1000;   // offset workers by 5 min each

/**
 * Start the periodic recycler. Returns { recycleOnce, stop }.
 *
 * @param {object} opts
 * @param {object} opts.mongoose         the mongoose instance
 * @param {string} opts.uri             MONGODB_URI to reconnect with
 * @param {object} [opts.options]       mongoose connect options (reused on reconnect)
 * @param {number} [opts.intervalMs]    recycle interval (default 30 min)
 * @param {number} [opts.staggerMs]     per-instance offset (default 5 min)
 * @param {number} [opts.instance]      worker index (default NODE_APP_INSTANCE)
 * @param {object} [opts.logger]        winston-style logger
 * @param {Function} [opts.setTimeoutFn] injectable for tests
 * @param {Function} [opts.setIntervalFn] injectable for tests
 */
function startConnectionRecycler(opts = {}) {
  const {
    mongoose,
    uri,
    options = {},
    intervalMs = DEFAULT_INTERVAL_MS,
    staggerMs = DEFAULT_STAGGER_MS,
    logger = null,
    setTimeoutFn = setTimeout,
    setIntervalFn = setInterval
  } = opts;

  if (!mongoose) throw new Error('startConnectionRecycler requires a mongoose instance');
  if (!uri) throw new Error('startConnectionRecycler requires a uri');

  const instance = opts.instance != null
    ? opts.instance
    : (parseInt(process.env.NODE_APP_INSTANCE || process.env.pm_id || '0', 10) || 0);

  async function recycleOnce() {
    try {
      if (logger && logger.info) logger.info('Recycling MongoDB connection pool (scheduled reset)');
      // Graceful close; in-flight mongoose queries buffer until reconnect.
      await mongoose.connection.close(false);
      await mongoose.connect(uri, options);
      if (logger && logger.info) logger.info('MongoDB connection pool recycled');
    } catch (e) {
      // Never let a recycle failure crash the worker — the next tick retries,
      // and the existing connection/auto-reconnect keeps serving meanwhile.
      if (logger && logger.error) logger.error('MongoDB connection recycle failed:', e.message);
    }
  }

  // First recycle fires after a FULL interval plus the per-worker stagger —
  // NEVER at startup. Connections are fresh at boot (nothing to recycle), and an
  // immediate close would race connection-time initialization (initializeDefaults,
  // callback pool) and the raw-driver stores. The stagger keeps workers apart.
  const offset = (instance * staggerMs) % intervalMs;
  const firstDelayMs = intervalMs + offset;
  let timer = null;
  const startTimer = setTimeoutFn(() => {
    recycleOnce();
    timer = setIntervalFn(recycleOnce, intervalMs);
    if (timer && typeof timer.unref === 'function') timer.unref();
  }, firstDelayMs);
  if (startTimer && typeof startTimer.unref === 'function') startTimer.unref();

  return {
    recycleOnce,
    stop: () => { if (timer) clearInterval(timer); }
  };
}

module.exports = { startConnectionRecycler, DEFAULT_INTERVAL_MS, DEFAULT_STAGGER_MS };
