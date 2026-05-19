/**
 * Location quarantine middleware.
 *
 * Locks the deployment down to Austin-only: only Austin location pages
 * (/austin-tx/*), the affiliate-program app (API, embed pages, assets,
 * legal), and a few helper endpoints serve from this origin. Everything
 * else 302-redirects to the corporate site (www.wavemaxlaundry.com),
 * preserving the original path so the corporate side can route it.
 *
 * Activated by env var QUARANTINE_NON_AUSTIN=true. When unset/false the
 * middleware is a no-op — existing behavior is preserved (useful for
 * tests and for local dev where the corporate site isn't relevant).
 *
 * Mounted early in server.js — before embed routes, static, and any of
 * the corporate page handlers — so it gets first crack at every request.
 *
 * Reads the env var at request time, not at module-load, so tests can
 * flip QUARANTINE_NON_AUSTIN per-describe without re-requiring the app.
 */

const {
  isAllowed,
  buildCorporateRedirect,
  isQuarantineEnabled,
} = require('../config/quarantineConfig');

function locationQuarantine(req, res, next) {
  if (!isQuarantineEnabled()) return next();
  if (isAllowed(req.path)) return next();
  res.redirect(302, buildCorporateRedirect(req.originalUrl));
}

module.exports = locationQuarantine;
