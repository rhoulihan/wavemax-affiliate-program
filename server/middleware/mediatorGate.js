// mediatorGate — password + IP-binding gate fronting the crhsent.com/wavemax
// documentation package (the platform-deficiency demonstration prepared for the
// mediator). A shared password becomes single-viewer: the first IP to open it is
// bound to that password (MediatorAccess model); the same password from any other
// IP is denied. Every attempt is logged (IP + result).
//
// Deploys DARK: a no-op unless MEDIATOR_GATE_ENABLED=true. Passwords are supplied
// via MEDIATOR_GATE_PASSWORDS (comma-separated; each binds to one IP independently),
// never hardcoded. Client IP uses the canonical resolver (cf-connecting-ip behind
// Cloudflare). Access grants ride a short-lived HMAC-signed unlock cookie bound to
// (passwordHash, IP) so the bound viewer isn't re-prompted on every asset.
'use strict';

const crypto = require('crypto');
const logger = require('../utils/logger');
const { clientIp } = require('../utils/clientIp');
const MediatorAccess = require('../models/MediatorAccess');

const COOKIE = 'wm_med_unlock';
const TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

const enabled = () => process.env.MEDIATOR_GATE_ENABLED === 'true';
const passwords = () => String(process.env.MEDIATOR_GATE_PASSWORDS || '')
  .split(',').map((s) => s.trim()).filter(Boolean);
// In production the HMAC key MUST come from a real secret; never fall back to ''
// (an empty key makes unlock-cookie forgery trivial). null → the gate fails closed.
const secret = () => process.env.SESSION_SECRET || process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? null : 'med-gate-dev-secret');
const configuredHashes = () => passwords().map((p) => crypto.createHash('sha256').update(p).digest('hex'));

function isCrhsentWavemax(req) {
  const host = (req.hostname || '').toLowerCase().replace(/^www\./, '');
  return host === 'crhsent.com' && (req.path === '/wavemax' || req.path.startsWith('/wavemax/'));
}

// Constant-time check of a submitted password against the configured list.
function matchPassword(submitted) {
  const h = crypto.createHash('sha256').update(String(submitted || '')).digest();
  for (const p of passwords()) {
    const ph = crypto.createHash('sha256').update(p).digest();
    if (crypto.timingSafeEqual(h, ph)) return p;
  }
  return null;
}

function signUnlock(passwordHash, ip) {
  const key = secret();
  if (!key) return '';                              // misconfigured — never mint a forgeable cookie
  const exp = Date.now() + TTL_MS;
  const payload = `${passwordHash}:${ip}:${exp}`;
  const sig = crypto.createHmac('sha256', key).update(payload).digest('hex');
  return Buffer.from(`${payload}:${sig}`).toString('base64url');
}
function verifyUnlock(value, ip) {
  if (!value) return false;
  const key = secret();
  if (!key) return false;                           // fail closed if no HMAC secret is configured
  let raw;
  try { raw = Buffer.from(value, 'base64url').toString('utf8'); } catch (e) { return false; }
  // payload is hash:ip:exp:sig — but an IPv6 `ip` itself contains colons, so parse
  // from the ends (hash/exp/sig are colon-free) and rejoin the middle as the IP.
  const parts = raw.split(':');
  if (parts.length < 4) return false;
  const sig = parts.pop();
  const expStr = parts.pop();
  const hash = parts.shift();
  const cookieIp = parts.join(':');
  const expected = crypto.createHmac('sha256', key).update(`${hash}:${cookieIp}:${expStr}`).digest('hex');
  let ok = false;
  try { ok = crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex')); } catch (e) { return false; }
  if (!ok) return false;
  if (cookieIp !== ip) return false;               // cookie is bound to the IP it was issued for
  if (!configuredHashes().includes(hash)) return false; // hash must be a currently-configured password
  const exp = parseInt(expStr, 10);
  return !!exp && Date.now() <= exp;
}

function promptPage(res, { error } = {}) {
  const nonce = res.locals && res.locals.cspNonce ? res.locals.cspNonce : '';
  const msg = error ? `<p class="err">${error}</p>` : '';
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Access &mdash; CRHS Documented Record</title>
<style nonce="${nonce}">
:root{color-scheme:light dark}
body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0f1115;color:#e7e9ee;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif}
.card{width:min(92vw,420px);background:#171a21;border:1px solid #262b36;border-radius:14px;padding:30px 28px;box-shadow:0 12px 40px rgba(0,0,0,.4)}
h1{font-size:19px;margin:0 0 6px} p{color:#9aa3b2;font-size:14px;line-height:1.5;margin:0 0 18px}
label{display:block;font-size:13px;color:#c3c9d4;margin:0 0 6px}
input{width:100%;box-sizing:border-box;padding:11px 12px;border-radius:9px;border:1px solid #333a47;background:#0f1319;color:#e7e9ee;font-size:15px}
button{margin-top:14px;width:100%;padding:11px;border:0;border-radius:9px;background:#c74634;color:#fff;font-size:15px;font-weight:600;cursor:pointer}
.err{color:#ff8f7a;background:#2a1512;border:1px solid #5a2318;border-radius:8px;padding:8px 10px;font-size:13px}
.note{margin-top:16px;font-size:12px;color:#6b7280}
</style></head><body>
<form class="card" method="POST" action="/wavemax/__unlock" autocomplete="off">
<h1>Documented record &mdash; access</h1>
<p>This material is provided for a specific reviewer. Enter the access code you were given.</p>
${msg}
<label for="p">Access code</label>
<input id="p" name="password" type="password" autofocus required>
<button type="submit">Open</button>
<p class="note">This link is single‑use per network. Opening it binds it to this connection; the same code will not open from a different network.</p>
</form></body></html>`;
  res.status(error ? 401 : 200).type('html')
    .setHeader('Cache-Control', 'no-store');
  return res.send(html);
}

async function mediatorGate(req, res, next) {
  if (!isCrhsentWavemax(req)) return next();
  if (!enabled()) return next();
  const ip = clientIp(req) || '';
  // Trusted operator IPs (ADMIN_ALLOWLIST — the store + the owner's home IP) manage
  // and preview the gate. Required lazily (cached) to avoid load-order coupling.
  const adminIpGate = require('./adminIpGate');

  // Admin reset: an allowlisted admin IP can clear a binding (viewer IP changed).
  if (req.path === '/wavemax/__reset') {
    if (!adminIpGate.isAllowed(req)) return res.status(404).end();
    // POST + code in the body, so the plaintext code never lands in access logs
    // or Referer the way a query string would.
    if (req.method !== 'POST') return res.status(405).type('text').send('POST required');
    const p = (req.body && req.body.code) || '';
    const done = p ? await MediatorAccess.resetBinding(p) : false;
    return res.type('text').send(done ? 'binding reset' : 'no such code');
  }

  // Unlock POST (form submit).
  if (req.method === 'POST' && req.path === '/wavemax/__unlock') {
    const matched = matchPassword(req.body && req.body.password);
    if (!matched) {
      logger.warn('mediatorGate: bad password', { ip });
      return promptPage(res, { error: 'That access code was not recognized.' });
    }
    if (!secret()) {
      logger.error('mediatorGate: no HMAC secret (SESSION_SECRET/JWT_SECRET) configured — refusing to grant access');
      return promptPage(res, { error: 'Temporarily unavailable — please try again later.' });
    }
    let result;
    try {
      result = await MediatorAccess.authorize(matched, ip, null);
    } catch (e) {
      logger.error('mediatorGate: authorize failed', { error: e.message });
      return promptPage(res, { error: 'Temporary error — please try again.' });
    }
    if (!result.ok) {
      logger.warn('mediatorGate: denied (wrong IP for bound code)', { ip });
      return promptPage(res, { error: 'This link has already been opened from another network and is locked to it.' });
    }
    logger.info('mediatorGate: access granted', { ip, reason: result.reason });
    res.cookie(COOKIE, signUnlock(result.hash, ip), {
      httpOnly: true, secure: true, sameSite: 'lax', maxAge: TTL_MS, path: '/wavemax'
    });
    return res.redirect('/wavemax/');
  }

  // Trusted operator/home IPs (ADMIN_ALLOWLIST) see all content ungated — the owner
  // and the store are never prompted or IP-bound. Placed after the __reset/__unlock
  // handlers so admin reset stays reachable from those same IPs.
  if (adminIpGate.isAllowed(req)) return next();

  // Authorized viewer (valid unlock cookie for this IP) → serve the content.
  const cookie = req.cookies && req.cookies[COOKIE];
  if (verifyUnlock(cookie, ip)) return next();

  // Otherwise, prompt.
  return promptPage(res);
}

// Exposed for tests.
mediatorGate.isCrhsentWavemax = isCrhsentWavemax;
mediatorGate.matchPassword = matchPassword;
mediatorGate.signUnlock = signUnlock;
mediatorGate.verifyUnlock = verifyUnlock;

module.exports = mediatorGate;
