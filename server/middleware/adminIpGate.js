// Admin-surface IP gate.
//
// Restricts the admin surface — the /admin clean URL, the administrator-login /
// -dashboard embed pages, the admin login endpoint, and the /api/v1/administrators
// API — to a small allowlist of IPs. Gating the LOGIN endpoint is the linchpin:
// with no admin token obtainable off-allowlist, the downstream admin APIs can't be
// used from a non-whitelisted IP either.
//
// The shared gate mechanics (canonical client IP, fail-closed enforcement,
// stealth 404) live in ./ipGate.js. This module only supplies the admin allowlist
// resolution + the isConfigured() helper consumed by rbac.js.
//
// Config (env, read at call time so it's not baked in at load):
//   ADMIN_ALLOWLIST = comma-separated IPs and/or CIDRs (preferred, explicit)
//   fallback when ADMIN_ALLOWLIST is empty:
//     ADMIN_IP, STORE_IP_ADDRESS, ADDITIONAL_STORE_IPS (IPs) + STORE_IP_RANGES (CIDR)
//
// FAILS CLOSED: if nothing is configured, NOBODY is allowed (a missing env can
// never silently expose admin).
'use strict';

const { createIpGate, parseList } = require('./ipGate');

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

// Is an allowlist configured at all? Used by the authorization layer to decide
// whether to ALSO enforce the admin IP on every admin-authorized API: when no
// allowlist is set the login route-gate (fail-closed) already prevents minting an
// admin token in prod, and leaving the authz check off keeps test suites (which
// mint admin tokens directly, from loopback, with no allowlist) working.
function isConfigured() {
  return allowlistEntries().length > 0;
}

const adminIpGate = createIpGate({
  allowlistEntries,
  enforcementEnvVar: 'ADMIN_IP_GATE_TEST',
  logLabel: 'Admin'
});

// Exposed for testing / reuse (isAllowed / clientIp / allowlistEntries come from
// the factory; isConfigured is admin-specific).
adminIpGate.isConfigured = isConfigured;

module.exports = adminIpGate;
