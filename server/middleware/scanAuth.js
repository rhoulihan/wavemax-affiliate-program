// Scan-auth middleware (PR 4) — authorizes the state-driven scan endpoints.
//
// Two credentials are accepted, in this order:
//   1. A normal operator JWT (the store kiosk is already logged in). The bearer
//      token's `role` must be operator | administrator | admin. Maps to a scan
//      actor of type 'operator'.
//   2. A short-lived scan-session token (the field/phone path) minted by
//      POST /api/v1/scan/session after a one-time code entry. Carries
//      { scope:'scan-session', actorType, actorId }. Accepted on either the
//      Authorization: Bearer header or the x-scan-session header.
//
// On success populates req.scanActor = { type, id, role } and calls next();
// otherwise responds 401. Anything that fails verification (garbage, expired,
// wrong scope/role) is a flat 401 — no oracle.
//
// Algorithm is pinned to HS256 (matches authTokenService + auth.js — guards the
// alg-confusion attack class).

const jwt = require('jsonwebtoken');

const SCAN_ROLES = new Set(['operator', 'administrator', 'admin']);

function bearer(req) {
  const h = req.headers && req.headers.authorization;
  if (h && h.startsWith('Bearer ')) return h.slice(7);
  return null;
}

function deny(res) {
  return res.status(401).json({ success: false, message: 'Scan authorization required' });
}

module.exports = function scanAuth(req, res, next) {
  const sessionHeader = req.headers && req.headers['x-scan-session'];
  const bearerToken = bearer(req);
  // A scan-session token may arrive on either header; try the explicit one first.
  const candidates = [sessionHeader, bearerToken].filter(Boolean);
  if (candidates.length === 0) return deny(res);

  for (const token of candidates) {
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    } catch (_e) {
      continue; // try the next candidate; if none verify -> deny
    }

    if (decoded.scope === 'scan-session') {
      // actorType is set by mintSession to one of these exact values.
      const ALLOWED = { operator: 1, affiliate: 1, customer: 1 };
      const type = ALLOWED[decoded.actorType] ? decoded.actorType : null;
      if (!type) continue; // malformed scope token → try next / deny
      req.scanActor = { type, id: decoded.actorId, role: type };
      return next();
    }

    if (decoded.role && SCAN_ROLES.has(decoded.role)) {
      req.scanActor = { type: 'operator', id: decoded.id, role: decoded.role };
      return next();
    }
    // Verified but not authorized for scanning (e.g. a customer JWT): deny.
  }

  return deny(res);
};
