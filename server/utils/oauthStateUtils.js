// OAuth State Utilities — cryptographic CSRF protection for OAuth flows.
//
// The OAuth `state` parameter is meant to bind the initiation request to
// the callback so an attacker can't trick a victim into completing an
// OAuth flow the attacker started. Without server-side validation, the
// `state` is just a string the OAuth provider echoes back — anyone who
// can craft a callback URL can replay it.
//
// Pattern here:
//   state = base64url(ts).base64url(nonce).base64url(clientPayload).base64url(hmac)
// where hmac = HMAC-SHA256(SECRET, ts.nonce.clientPayload).
// On callback: split, recompute HMAC, timing-safe compare, check TTL.
//
// SECRET source order:
//   1. OAUTH_STATE_SECRET (preferred, dedicated secret)
//   2. SESSION_SECRET
//   3. JWT_SECRET
// All three are 64-char hex in standard env files.

const crypto = require('crypto');
const logger = require('./logger');

const STATE_TTL_MS = 5 * 60 * 1000;

function getSecret() {
  return process.env.OAUTH_STATE_SECRET
      || process.env.SESSION_SECRET
      || process.env.JWT_SECRET
      || '';
}

function b64url(input) {
  return Buffer.from(input).toString('base64url');
}
function b64urlDecode(input) {
  return Buffer.from(input, 'base64url').toString();
}

function sign(payload) {
  const secret = getSecret();
  if (!secret) {
    throw new Error('OAUTH_STATE_SECRET / SESSION_SECRET / JWT_SECRET must be configured');
  }
  return crypto.createHmac('sha256', secret).update(payload).digest('base64url');
}

/**
 * Generate a signed OAuth state token. The `clientPayload` is whatever
 * the caller wants to round-trip through the OAuth provider — typically
 * a session identifier the client uses to look up the auth result after
 * the popup closes. It is signed but NOT encrypted; do not put secrets
 * in it.
 */
function generateOAuthState(clientPayload) {
  const ts = Date.now().toString();
  const nonce = crypto.randomBytes(8).toString('hex');
  const safePayload = String(clientPayload || '');
  const tsB = b64url(ts);
  const nonceB = b64url(nonce);
  const payloadB = b64url(safePayload);
  const body = `${tsB}.${nonceB}.${payloadB}`;
  const sig = sign(body);
  return `${body}.${sig}`;
}

/**
 * Validate a state string. Returns `{ valid, clientPayload, reason }`.
 * `valid: false` reasons: 'missing' | 'malformed' | 'bad-signature' | 'expired'.
 */
function validateOAuthState(state) {
  if (!state || typeof state !== 'string') return { valid: false, reason: 'missing' };
  const parts = state.split('.');
  if (parts.length !== 4) return { valid: false, reason: 'malformed' };
  const [tsB, nonceB, payloadB, sig] = parts;
  let expected;
  try {
    expected = sign(`${tsB}.${nonceB}.${payloadB}`);
  } catch (err) {
    logger.error('[OAuth state] HMAC compute failed', { err: err.message });
    return { valid: false, reason: 'bad-signature' };
  }
  const sigBuf = Buffer.from(sig, 'base64url');
  const expBuf = Buffer.from(expected, 'base64url');
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return { valid: false, reason: 'bad-signature' };
  }
  let ts;
  let clientPayload;
  try {
    ts = Number(b64urlDecode(tsB));
    clientPayload = b64urlDecode(payloadB);
  } catch (_) {
    return { valid: false, reason: 'malformed' };
  }
  if (!Number.isFinite(ts) || ts + STATE_TTL_MS < Date.now()) {
    return { valid: false, reason: 'expired' };
  }
  return { valid: true, clientPayload, ts };
}

module.exports = {
  generateOAuthState,
  validateOAuthState,
  STATE_TTL_MS
};
