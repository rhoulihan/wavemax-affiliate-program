// MongoDB cursor-retry shim.
//
// The Oracle Autonomous DB MongoDB API (loadBalanced) intermittently returns a
// `find` reply missing the `cursor` envelope. The mongodb 6.x driver's strict
// CursorResponse parser rejects it with:
//   MongoUnexpectedServerResponseError: BSON element "cursor" is missing
// surfacing on Collection.findOne (which the driver implements as a FindCursor).
// A fresh connection always succeeds — the failure is tied to degraded
// long-lived pooled connections — so retrying the read (which checks out a
// different pooled connection) recovers it transparently.
//
// findOne is an idempotent read, so retrying is safe. Per production logs (2026-05),
// 100% of these errors are Collection.findOne, so that is the only method wrapped.
// The patch is applied once to the shared mongodb driver Collection prototype, so
// it covers every pool in the process — both mongoose and connect-mongo's own client.
//
// This is a resilience stopgap for the ADB MongoDB-API migration, not a fix for
// the underlying server non-conformance.

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * True for the Oracle-ADB "cursor is missing" response error (and nothing else).
 */
function isCursorMissingError(err) {
  if (!err) return false;
  if (err.name === 'MongoUnexpectedServerResponseError') return true;
  return /cursor.*is missing|BSON element .?cursor.? is missing/i.test(err.message || '');
}

// Describe a failing findOne for diagnosis WITHOUT logging filter values (which
// can be PII — session ids, emails). Captures the collection, the filter's keys,
// and the option shape (session/projection/sort/readPreference/etc.) so we can
// pinpoint exactly which app code path triggers the Oracle-ADB cursor error.
function describeFindOne(coll, args) {
  let ns = 'unknown';
  try { ns = (coll && (coll.namespace || coll.collectionName)) || 'unknown'; } catch (_) { /* ignore */ }
  let filterKeys = [];
  try { if (args[0] && typeof args[0] === 'object') filterKeys = Object.keys(args[0]); } catch (_) { /* ignore */ }
  const opts = (args[1] && typeof args[1] === 'object') ? args[1] : {};
  const optSummary = {
    hasSession: !!opts.session,
    inTransaction: !!(opts.session && typeof opts.session.inTransaction === 'function' && opts.session.inTransaction()),
    readPreference: (opts.readPreference && (opts.readPreference.mode || opts.readPreference)) || undefined,
    projection: opts.projection ? Object.keys(opts.projection) : undefined,
    sort: opts.sort ? Object.keys(opts.sort) : undefined,
    collation: !!opts.collation,
    maxTimeMS: opts.maxTimeMS,
    limit: opts.limit
  };
  return { ns, filterKeys, optSummary };
}

function wrapFindOne(original, { retries, backoffMs, logger }) {
  return async function patchedFindOne(...args) {
    let attempt = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        return await original.apply(this, args);
      } catch (err) {
        if (!isCursorMissingError(err) || attempt >= retries) throw err;
        attempt += 1;
        if (logger && logger.warn) {
          const d = describeFindOne(this, args);
          logger.warn(`Mongo cursor-missing on findOne; retry ${attempt}/${retries} | ns=${d.ns} filterKeys=${JSON.stringify(d.filterKeys)} opts=${JSON.stringify(d.optSummary)}`);
        }
        // Small escalating backoff; the retry checks out a (likely healthy) connection.
        if (backoffMs > 0) await sleep(backoffMs * attempt);
      }
    }
  };
}

/**
 * Patch Collection.prototype.findOne to retry the cursor-missing error.
 * @param {object} [opts]
 * @param {number} [opts.retries=3]   max retries after the initial attempt
 * @param {number} [opts.backoffMs=25] base backoff (×attempt) between retries
 * @param {object} [opts.logger]      winston-style logger (optional)
 * @param {Function} [opts.Collection] driver Collection class (injectable for tests)
 * @returns {boolean} true if installed, false if already installed
 */
function installCursorRetry(opts = {}) {
  const retries = opts.retries != null ? opts.retries : 3;
  const backoffMs = opts.backoffMs != null ? opts.backoffMs : 25;
  const logger = opts.logger || null;
  // eslint-disable-next-line global-require
  const Collection = opts.Collection || require('mongodb').Collection;

  if (Collection.prototype.__cursorRetryInstalled) return false;
  const originalFindOne = Collection.prototype.findOne;
  Collection.prototype.findOne = wrapFindOne(originalFindOne, { retries, backoffMs, logger });
  Object.defineProperty(Collection.prototype, '__cursorRetryInstalled', {
    value: true, enumerable: false, configurable: true
  });
  if (logger && logger.info) logger.info(`Mongo cursor-retry shim installed (findOne, retries=${retries})`);
  return true;
}

module.exports = { installCursorRetry, isCursorMissingError, _wrapFindOne: wrapFindOne };
