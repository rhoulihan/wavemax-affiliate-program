// Stateless 1-hour unlock token for the franchise preview, carried in a signed
// cookie. Deliberately NOT a DB/session record: an unlock is high-frequency and
// short-lived, and a DB-backed store on the Cloudflare-fronted origin is exactly
// what caused the session-bloat outage. An HMAC-signed cookie needs no storage,
// can't be forged without the server secret, and expires on its own.
'use strict';

const crypto = require('crypto');

const COOKIE_NAME = 'pv_unlock';
const UNLOCK_TTL_MS = 60 * 60 * 1000; // 1 hour

function secret() {
  return process.env.SESSION_SECRET || process.env.JWT_SECRET || 'pv-unlock-dev-secret';
}

// Sign an unlock for a given preview token. Value = base64url("token:exp:sig").
function sign(token, ttlMs) {
  const exp = Date.now() + (ttlMs || UNLOCK_TTL_MS);
  const payload = `${token}:${exp}`;
  const sig = crypto.createHmac('sha256', secret()).update(payload).digest('hex');
  return Buffer.from(`${payload}:${sig}`).toString('base64url');
}

// True iff the cookie is well-formed, signed by us, matches `token`, and unexpired.
function verify(value, token) {
  if (!value || typeof value !== 'string') return false;
  let raw;
  try { raw = Buffer.from(value, 'base64url').toString('utf8'); } catch (e) { return false; }
  const parts = raw.split(':');
  if (parts.length !== 3) return false;
  const [cookieToken, expStr, sig] = parts;
  const expected = crypto.createHmac('sha256', secret()).update(`${cookieToken}:${expStr}`).digest('hex');
  let ok = false;
  try { ok = crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex')); } catch (e) { return false; }
  if (!ok) return false;
  if (cookieToken !== token) return false;
  const exp = parseInt(expStr, 10);
  if (!exp || Date.now() > exp) return false;
  return true;
}

module.exports = { sign, verify, COOKIE_NAME, UNLOCK_TTL_MS };
