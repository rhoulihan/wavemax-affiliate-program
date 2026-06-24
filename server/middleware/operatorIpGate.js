// Operator-surface IP gate.
//
// Restricts the operator surface — the /operator clean URL, the operator login /
// scan embed pages, and the operator PIN-login endpoint — to the store
// location(s) plus the admin IP ("our default locations"). Mirrors adminIpGate
// but scoped to the STORE allowlist rather than the admin allowlist.
//
// Shared gate mechanics (canonical client IP, fail-closed enforcement, stealth
// 404) live in ./ipGate.js. This module only supplies the store allowlist.
//
// Config (env, read at call time):
//   STORE_IP_ADDRESS, ADDITIONAL_STORE_IPS, STORE_IP_RANGES (the store locations,
//     also used by operator session auto-renewal) + ADMIN_IP (admin may reach it)
//     + OPERATOR_ALLOWLIST (explicit extra IPs/CIDRs).
//
// FAILS CLOSED in production: nothing configured => nobody. Live only in
// production or when OPERATOR_IP_GATE_TEST=1 (transparent in dev/test otherwise).
'use strict';

const { createIpGate, parseList } = require('./ipGate');

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

// Exposed for testing / reuse (isAllowed / clientIp / allowlistEntries from the factory).
module.exports = createIpGate({
  allowlistEntries,
  enforcementEnvVar: 'OPERATOR_IP_GATE_TEST',
  logLabel: 'Operator'
});
