// Admin-surface IP gate.
//
// Restricts the admin surface — the /admin clean URL, the administrator-login /
// -dashboard embed pages, the admin login endpoint, and the /api/v1/administrators
// API — to a small allowlist of IPs. Gating the LOGIN endpoint is the linchpin:
// with no admin token obtainable off-allowlist, the downstream admin APIs can't be
// used from a non-whitelisted IP either.
//
// Client IP: behind Cloudflare -> nginx (trust proxy = 1), req.ip is the CF EDGE
// IP, so we read cf-connecting-ip first — the same hardened pattern used by
// server/middleware/accessGate.js and server/services/codeAttemptLockout.js. We
// do NOT trust raw X-Forwarded-For[0] (attacker-spoofable, see APP-011).
//
// Config (env, read at call time so it's not baked in at load):
//   ADMIN_ALLOWLIST = comma-separated IPs and/or CIDRs (preferred, explicit)
//   fallback when ADMIN_ALLOWLIST is empty:
//     ADMIN_IP, STORE_IP_ADDRESS, ADDITIONAL_STORE_IPS (IPs) + STORE_IP_RANGES (CIDR)
//
// FAILS CLOSED: if nothing is configured, NOBODY is allowed (a missing env can
// never silently expose admin). Non-whitelisted requests get a stealth 404 so the
// admin surface isn't advertised.
'use strict';

const logger = require('../utils/logger');
const storeIPs = require('../config/storeIPs'); // for the pure isInRange() CIDR helper

function parseList(value) {
  return String(value || '').split(',').map((s) => s.trim()).filter(Boolean);
}

// The active allowlist entries (IPs and/or CIDRs), resolved fresh each call.
function allowlistEntries() {
  const explicit = parseList(process.env.ADMIN_ALLOWLIST);
  if (explicit.length) return explicit;
  return [
    ...parseList(process.env.ADMIN_IP),
    ...parseList(process.env.STORE_IP_ADDRESS),
    ...parseList(process.env.ADDITIONAL_STORE_IPS),
    ...parseList(process.env.STORE_IP_RANGES)
  ];
}

function clientIp(req) {
  const ip = String((req && req.headers && req.headers['cf-connecting-ip']) || (req && req.ip) || '').trim();
  return ip.replace(/^::ffff:/, ''); // normalize IPv4-mapped IPv6
}

// The gate is LIVE in production. It is transparent in dev/test (so the broad
// admin test-suite, which calls admin APIs from loopback, isn't blocked) UNLESS a
// test explicitly opts in via ADMIN_IP_GATE_TEST=1 to exercise the real behavior.
function enforcementActive() {
  return process.env.ADMIN_IP_GATE_TEST === '1' || process.env.NODE_ENV === 'production';
}

function entryMatches(ip, entry) {
  if (entry.includes('/')) return storeIPs.isInRange(ip, entry);
  return ip === entry;
}

function isAllowed(req) {
  if (!enforcementActive()) return true; // transparent in dev/test (unless opted in)
  const ip = clientIp(req);
  if (!ip) return false;
  const entries = allowlistEntries();
  if (!entries.length) return false; // fail closed (prod, unconfigured)
  return entries.some((e) => entryMatches(ip, e));
}

module.exports = function adminIpGate(req, res, next) {
  if (isAllowed(req)) return next();

  logger.warn('Admin surface blocked by IP gate', {
    ip: clientIp(req) || '(none)',
    path: (req && req.originalUrl) || (req && req.path) || ''
  });

  // Stealth 404 — never reveal that an admin surface exists here. Match the shape
  // of the path so the gated route is indistinguishable from a genuinely-absent one.
  res.status(404);
  if (String((req && req.originalUrl) || '').startsWith('/api/')) {
    return res.json({ success: false, message: 'Not found' });
  }
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  return res.type('html').send('<!DOCTYPE html><html><head><title>404 Not Found</title></head><body><h1>404 Not Found</h1></body></html>');
};

// Is an allowlist configured at all? Used by the authorization layer to decide
// whether to ALSO enforce the admin IP on every admin-authorized API: when no
// allowlist is set the login route-gate (fail-closed) already prevents minting an
// admin token in prod, and leaving the authz check off keeps test suites (which
// mint admin tokens directly, from loopback, with no allowlist) working.
function isConfigured() {
  return allowlistEntries().length > 0;
}

// Exposed for testing / reuse.
module.exports.isAllowed = isAllowed;
module.exports.isConfigured = isConfigured;
module.exports.clientIp = clientIp;
module.exports.allowlistEntries = allowlistEntries;
