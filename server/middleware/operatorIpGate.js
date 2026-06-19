// Operator-surface IP gate.
//
// Restricts the operator surface — the /operator clean URL, the operator login /
// scan embed pages, and the operator PIN-login endpoint — to the store
// location(s) plus the admin IP ("our default locations"). Mirrors adminIpGate
// but scoped to the STORE allowlist rather than the admin allowlist.
//
// Client IP: behind Cloudflare -> nginx (trust proxy = 1), req.ip is the CF EDGE
// IP, so we read cf-connecting-ip first (same hardened pattern as adminIpGate /
// accessGate). We do NOT trust raw X-Forwarded-For.
//
// Config (env, read at call time):
//   STORE_IP_ADDRESS, ADDITIONAL_STORE_IPS, STORE_IP_RANGES (the store locations,
//     also used by operator session auto-renewal) + ADMIN_IP (admin may reach it)
//     + OPERATOR_ALLOWLIST (explicit extra IPs/CIDRs).
//
// FAILS CLOSED in production: nothing configured => nobody. Live only in
// production or when OPERATOR_IP_GATE_TEST=1 (transparent in dev/test otherwise,
// so the broad operator test-suite, hitting from loopback, isn't blocked).
'use strict';

const logger = require('../utils/logger');
const storeIPs = require('../config/storeIPs'); // pure isInRange() CIDR helper

function parseList(value) {
  return String(value || '').split(',').map((s) => s.trim()).filter(Boolean);
}

// Allowlist entries (IPs and/or CIDRs), resolved fresh each call.
function allowlistEntries() {
  return [
    ...parseList(process.env.STORE_IP_ADDRESS),
    ...parseList(process.env.ADDITIONAL_STORE_IPS),
    ...parseList(process.env.STORE_IP_RANGES),
    ...parseList(process.env.ADMIN_IP),
    ...parseList(process.env.OPERATOR_ALLOWLIST)
  ];
}

function enforcementActive() {
  return process.env.OPERATOR_IP_GATE_TEST === '1' || process.env.NODE_ENV === 'production';
}

function clientIp(req) {
  const ip = String((req && req.headers && req.headers['cf-connecting-ip']) || (req && req.ip) || '').trim();
  return ip.replace(/^::ffff:/, '');
}

function entryMatches(ip, entry) {
  if (entry.includes('/')) return storeIPs.isInRange(ip, entry);
  return ip === entry;
}

function isAllowed(req) {
  if (!enforcementActive()) return true; // transparent in dev/test unless opted in
  const ip = clientIp(req);
  if (!ip) return false;
  const entries = allowlistEntries();
  if (!entries.length) return false; // fail closed (prod, unconfigured)
  return entries.some((e) => entryMatches(ip, e));
}

module.exports = function operatorIpGate(req, res, next) {
  if (isAllowed(req)) return next();

  logger.warn('Operator surface blocked by IP gate', {
    ip: clientIp(req) || '(none)',
    path: (req && req.originalUrl) || (req && req.path) || ''
  });

  res.status(404);
  if (String((req && req.originalUrl) || '').startsWith('/api/')) {
    return res.json({ success: false, message: 'Not found' });
  }
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  return res.type('html').send('<!DOCTYPE html><html><head><title>404 Not Found</title></head><body><h1>404 Not Found</h1></body></html>');
};

module.exports.isAllowed = isAllowed;
module.exports.clientIp = clientIp;
module.exports.allowlistEntries = allowlistEntries;
