// IP-gate factory — the shared core of adminIpGate + operatorIpGate.
//
// Both gates restrict a surface to an allowlist of IPs/CIDRs: LIVE in production
// (transparent in dev/test unless their *_IP_GATE_TEST=1 opt-in is set), FAIL
// CLOSED (nothing configured => nobody), and emit a stealth 404 so the gated
// surface is indistinguishable from a genuinely-absent one. They differ only in
// (a) how the allowlist is resolved, (b) the test opt-in env var, and (c) the log
// label. Client IP uses the canonical resolver (server/utils/clientIp.js):
// cf-connecting-ip behind Cloudflare, never the spoofable raw X-Forwarded-For.
'use strict';

const logger = require('../utils/logger');
const storeIPs = require('../config/storeIPs'); // pure isInRange() CIDR helper
const { clientIp } = require('../utils/clientIp');

/** Split a comma-separated env value into trimmed, non-empty entries. */
function parseList(value) {
  return String(value || '').split(',').map((s) => s.trim()).filter(Boolean);
}

/** Match an IP against one allowlist entry — a CIDR range, or an exact IP. */
function entryMatches(ip, entry) {
  if (entry.includes('/')) return storeIPs.isInRange(ip, entry);
  return ip === entry;
}

/**
 * Build an IP-gate middleware.
 *
 * @param {Object} opts
 * @param {() => string[]} opts.allowlistEntries  resolves the active IP/CIDR list, fresh each call
 * @param {string} opts.enforcementEnvVar  env var that forces enforcement in dev/test (e.g. 'ADMIN_IP_GATE_TEST')
 * @param {string} opts.logLabel  human label for the blocked-request log ('Admin' | 'Operator')
 * @returns {Function} Express middleware with .isAllowed / .clientIp / .allowlistEntries attached
 */
function createIpGate({ allowlistEntries, enforcementEnvVar, logLabel }) {
  function enforcementActive() {
    return process.env[enforcementEnvVar] === '1' || process.env.NODE_ENV === 'production';
  }

  function isAllowed(req) {
    if (!enforcementActive()) return true; // transparent in dev/test unless opted in
    const ip = clientIp(req);
    if (!ip) return false;
    const entries = allowlistEntries();
    if (!entries.length) return false; // fail closed (prod, unconfigured)
    return entries.some((e) => entryMatches(ip, e));
  }

  function gate(req, res, next) {
    if (isAllowed(req)) return next();

    logger.warn(`${logLabel} surface blocked by IP gate`, {
      ip: clientIp(req) || '(none)',
      path: (req && req.originalUrl) || (req && req.path) || ''
    });

    // Stealth 404 — never reveal the surface exists; match the absent-route shape.
    res.status(404);
    if (String((req && req.originalUrl) || '').startsWith('/api/')) {
      return res.json({ success: false, message: 'Not found' });
    }
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    return res.type('html').send('<!DOCTYPE html><html><head><title>404 Not Found</title></head><body><h1>404 Not Found</h1></body></html>');
  }

  gate.isAllowed = isAllowed;
  gate.allowlistEntries = allowlistEntries;
  gate.clientIp = clientIp; // canonical resolver, re-exposed for back-compat
  return gate;
}

module.exports = { createIpGate, parseList, entryMatches };
