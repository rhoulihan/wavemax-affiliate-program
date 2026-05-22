// Site access gate: password-protects all web traffic to the Express-served
// domains unless the client IP is whitelisted. No username — a single shared
// password (PBKDF2-hashed in the AccessGate collection).
//
// Unlock is a double-opt-in magic-link flow that captures a verified email:
//   1. Landing form takes email + password → POST /__gate.
//   2. Correct password → a single-use token (the URL parameter) is stored in
//      AccessRequest, associated with the submitted email, and a link is
//      emailed (from admin@rundberglaundry.com). Browser is redirected to a
//      "check your email" page. No IP is whitelisted yet.
//   3. The emailed link → GET /__gate/confirm?token=… shows an "Enter site"
//      page; the button POSTs the token. POST verifies the token↔email, then
//      whitelists the clicking IP (recorded in AccessWhitelist with the email).
// The GET→POST confirm step defeats mail-provider link prefetch (scanners
// follow GET but don't submit forms), so a scanner can't burn the token or
// whitelist its own IP.
//
// Enabled only when the SystemConfig key `access_gate_enabled` is true (a
// runtime toggle, no redeploy). It can be deployed dark, seeded, verified, then
// switched on — and flipped back off to route all traffic locally — at runtime.
//
// Resilience: an in-memory cache serves the hot path with no per-request DB
// read; a cache miss falls back to a single DB lookup (covers cross-worker
// unlocks in the PM2 cluster); a periodic refresh reconciles drift. Click
// logging is best-effort and never blocks a request.

const crypto = require('crypto');
const dns = require('dns').promises;
const { verifyPassword } = require('../utils/encryption');
const logger = require('../utils/logger');
const { sendEmail } = require('../services/email/transport');
const AccessGate = require('../models/AccessGate');
const AccessWhitelist = require('../models/AccessWhitelist');
const AccessClick = require('../models/AccessClick');
const AccessRequest = require('../models/AccessRequest');
const SystemConfig = require('../models/SystemConfig');

// `enabled` is the master switch, loaded from the SystemConfig key
// `access_gate_enabled` (runtime-toggleable, no redeploy). Defaults false so an
// unreadable/uninitialized config fails OPEN (route locally), never locking the
// whole network out of every domain.
const cache = { ready: false, enabled: false, salt: null, hash: null, ips: new Map() }; // ip -> { trackClicks }

const TOKEN_TTL_MS = 60 * 60 * 1000;          // emailed link valid for 60 minutes
const SEND_THROTTLE_MS = 60 * 1000;           // min interval between link emails per IP
const GATE_FROM = '"WaveMAX" <admin@rundberglaundry.com>';

// Preview routing (temporary "for now" state): every gated host bounces
// non-whitelisted, non-crawler traffic to the corporate Austin page EXCEPT the
// shareable preview path, which shows the gate so invited people can request
// access. crhsent.com is the open public site and is never gated or redirected.
const NON_GATED_HOSTS = ['crhsent.com', 'www.crhsent.com'];
const PREVIEW_PATH_PREFIX = '/austin-tx';
const PREVIEW_CORPORATE_URL = 'https://wavemaxlaundry.com/austin-tx/';

const emailValid = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || '').trim());
const safeNext = (n) => (n && String(n).startsWith('/') ? String(n) : '/');
const tokenExpired = (ar) => !ar.expiresAt || new Date(ar.expiresAt).getTime() < Date.now();

// Verified Google-crawler cache: ip -> { ok, exp }. Spares a DNS round-trip on
// every crawler request. Positives are long-lived; negatives expire quickly so
// a real crawler recovers fast from a transient DNS failure (and a spoofer's
// negative result isn't pinned for long).
const botCache = new Map();
const BOT_TTL_OK = 7 * 24 * 60 * 60 * 1000;
const BOT_TTL_NEG = 10 * 60 * 1000;

// Cheap UA pre-filter for Google's indexing/inspection crawlers — only these
// trigger the (more expensive) reverse-DNS check. A spoofed UA still fails it.
const GOOGLE_UA_RE = /(googlebot|storebot-google|google-inspectiontool|googleother|google-site-verification)/i;
const GOOGLE_HOST_RE = /\.(googlebot|google|googleusercontent)\.com$/i;

// Authoritative Googlebot verification (Google's documented method): reverse-DNS
// the client IP, require a Google-owned hostname, then forward-confirm that the
// hostname resolves back to the same IP. Result is cached per IP.
async function isVerifiedGoogle(ip) {
  if (!ip) return false;
  const now = Date.now();
  const hit = botCache.get(ip);
  if (hit && hit.exp > now) return hit.ok;
  let ok = false;
  try {
    const hosts = await dns.reverse(ip);
    const host = (hosts || []).find((h) => GOOGLE_HOST_RE.test(h));
    if (host) {
      const fwd = ip.includes(':') ? await dns.resolve6(host) : await dns.resolve4(host);
      ok = Array.isArray(fwd) && fwd.includes(ip);
    }
  } catch (_) { ok = false; }
  botCache.set(ip, { ok, exp: now + (ok ? BOT_TTL_OK : BOT_TTL_NEG) });
  return ok;
}

async function loadCache() {
  try {
    cache.enabled = (await SystemConfig.getValue('access_gate_enabled', false)) === true;
    const gate = await AccessGate.findOne({ key: 'gate' }).lean();
    const wl = await AccessWhitelist.find({}, { ip: 1, trackClicks: 1 }).lean();
    cache.salt = gate ? gate.salt : null;
    cache.hash = gate ? gate.hash : null;
    cache.ips = new Map(wl.map((w) => [w.ip, { trackClicks: w.trackClicks !== false }]));
    cache.ready = true;
    logger.info(`Access gate cache loaded: ${cache.enabled ? 'ENABLED' : 'disabled'}; ${cache.ips.size} whitelisted IP(s); password ${cache.hash ? 'set' : 'NOT set'}`);
  } catch (e) {
    logger.error('Access gate cache load failed:', e.message);
  }
}

// Refresh every 60s so all cluster workers converge on whitelist/password changes.
let refreshTimer = null;
function startCacheRefresh() {
  if (refreshTimer) return;
  refreshTimer = setInterval(() => { loadCache().catch(() => {}); }, 60 * 1000);
  if (refreshTimer.unref) refreshTimer.unref();
}

function clientIp(req) {
  return String(req.headers['cf-connecting-ip'] || req.ip || '').trim();
}

function reqHost(req) {
  return String(req.headers['x-forwarded-host'] || req.headers.host || '').toLowerCase().split(':')[0].trim();
}

// Paths always allowed through, even for non-whitelisted IPs: the gate's own
// assets/endpoint, the landing-page logo, cert renewal, and health checks.
function isExempt(p) {
  return (
    p === '/assets/images/brand/logo-wavemax.png' ||
    p === '/favicon.ico' ||
    p.startsWith('/.well-known/acme-challenge') ||
    p === '/api/health' ||
    p === '/health'
  );
}

function esc(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Branded swirl spinner — same SVG + elliptical-orbit animation as the app's
// public/assets/css/swirl-spinner.css, inlined because the gate page loads
// before any IP is whitelisted (external assets wouldn't pass the gate).
const SWIRL_SVG = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="50" cy="50" rx="48" ry="35" fill="#2563eb" opacity="0.9"/>
      <ellipse cx="50" cy="50" rx="40" ry="28" fill="#3b82f6"/>
      <path d="M 35 50 Q 50 35, 65 50 Q 60 60, 50 62 Q 40 60, 35 50 Z" fill="#1e40af" opacity="0.6"/>
      <circle class="swirl-dot1" cx="30" cy="45" r="4" fill="white"/>
      <circle class="swirl-dot2" cx="70" cy="45" r="4" fill="white"/>
      <circle class="swirl-dot3" cx="30" cy="55" r="3" fill="white"/>
      <circle class="swirl-dot4" cx="70" cy="55" r="3" fill="white"/>
    </svg>`;

// Shared chrome for all gate pages (landing / sent / confirm / error). When a
// CSP nonce is supplied, a nonce-bound handler reveals the swirl spinner the
// instant a form is submitted (the email request and the "enter the site" click).
function pageShell(cardHtml, nonce) {
  const spinnerScript = nonce ? `<script nonce="${nonce}">
(function(){
  var ov=document.getElementById('gate-spinner'), msg=document.getElementById('gate-spinner-msg');
  document.querySelectorAll('form.card').forEach(function(f){
    f.addEventListener('submit',function(){
      var m=f.getAttribute('data-spinner'); if(m&&msg){msg.textContent=m;}
      if(ov){ov.classList.add('show');}
    });
  });
})();
</script>` : '';
  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>WaveMAX</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;
    min-height:100vh;display:flex;align-items:center;justify-content:center;
    background:linear-gradient(160deg,#0b1f43 0%,#16336b 60%,#1e3a8a 100%);color:#fff;padding:24px}
  .card{width:100%;max-width:380px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.15);
    border-radius:14px;padding:36px 30px;text-align:center}
  .logo{height:48px;margin-bottom:22px}
  h1{font-size:18px;font-weight:600;margin-bottom:6px}
  p.sub{font-size:14px;color:#bcd3ff;margin-bottom:22px;line-height:1.5}
  input{width:100%;padding:13px 14px;border-radius:8px;border:1px solid rgba(255,255,255,.25);
    background:rgba(255,255,255,.95);color:#0f172a;font-size:15px;margin-bottom:14px}
  button{width:100%;padding:13px;border:0;border-radius:8px;background:#2563eb;color:#fff;
    font-size:15px;font-weight:600;cursor:pointer}
  button:hover{background:#1e3a8a}
  a.link{color:#bcd3ff;font-size:13px}
  .err{color:#fca5a5;font-size:13px;margin-bottom:12px}
  /* WaveMAX swirl spinner — revealed on form submit */
  .swirl-spinner{width:120px;height:120px;display:inline-block;position:relative;background:#fff;border-radius:50%;padding:14px;box-shadow:0 10px 34px rgba(0,0,0,.4)}
  .swirl-spinner svg{width:100%;height:100%}
  .swirl-dot1{animation:swirl-o1 2s linear infinite}
  .swirl-dot2{animation:swirl-o2 2s linear infinite}
  .swirl-dot3{animation:swirl-o3 2s linear infinite}
  .swirl-dot4{animation:swirl-o4 2s linear infinite}
  @keyframes swirl-o1{0%{transform:translate(0,0)}25%{transform:translate(20px,-8px)}50%{transform:translate(0,-16px)}75%{transform:translate(-20px,-8px)}100%{transform:translate(0,0)}}
  @keyframes swirl-o2{0%{transform:translate(0,-16px)}25%{transform:translate(-20px,-8px)}50%{transform:translate(0,0)}75%{transform:translate(20px,-8px)}100%{transform:translate(0,-16px)}}
  @keyframes swirl-o3{0%{transform:translate(0,0)}25%{transform:translate(20px,8px)}50%{transform:translate(0,16px)}75%{transform:translate(-20px,8px)}100%{transform:translate(0,0)}}
  @keyframes swirl-o4{0%{transform:translate(0,16px)}25%{transform:translate(-20px,8px)}50%{transform:translate(0,0)}75%{transform:translate(20px,8px)}100%{transform:translate(0,16px)}}
  #gate-spinner{position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;
    background:rgba(8,18,40,.82);backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px);
    opacity:0;visibility:hidden;transition:opacity .3s ease;z-index:9999}
  #gate-spinner.show{opacity:1;visibility:visible}
  #gate-spinner .msg{color:#fff;font-size:15px;font-weight:600;letter-spacing:.2px}
</style></head>
<body>${cardHtml}
<div id="gate-spinner" aria-hidden="true">
  <div class="swirl-spinner">${SWIRL_SVG}</div>
  <div class="msg" id="gate-spinner-msg">Working…</div>
</div>
${spinnerScript}
</body></html>`;
}

function landingPage(error, nextUrl, email, nonce) {
  const next = esc(safeNext(nextUrl));
  const err = error ? `<p class="err">${esc(error)}</p>` : '';
  return pageShell(`
  <form class="card" method="POST" action="/__gate" autocomplete="off" data-spinner="Sending your preview link…">
    <img class="logo" src="/assets/images/brand/logo-wavemax.png" alt="WaveMAX">
    <h1>Request access to preview</h1>
    <p class="sub">This site is currently private. Enter your email and the access password and we'll send you a preview link.</p>
    ${err}
    <input type="email" name="email" placeholder="Email address" value="${esc(email)}" autocomplete="off" autofocus required>
    <input type="password" name="password" placeholder="Access password" autocomplete="off" required>
    <input type="hidden" name="next" value="${next}">
    <button type="submit">Send me a link</button>
  </form>`, nonce);
}

function sentPage(nonce) {
  return pageShell(`
  <div class="card">
    <img class="logo" src="/assets/images/brand/logo-wavemax.png" alt="WaveMAX">
    <h1>Check your email</h1>
    <p class="sub">We've sent a preview link to your email address. Open it and click <strong>Enter the site</strong> to continue. The link expires in 60 minutes.</p>
    <p class="sub" style="color:#fcd34d"><strong>Don't see it?</strong> Check your spam or promotions folder and mark it "Not spam".</p>
    <a class="link" href="/__gate">Use a different email</a>
  </div>`, nonce);
}

function confirmPage(token, nextUrl, nonce) {
  return pageShell(`
  <form class="card" method="POST" action="/__gate/confirm" autocomplete="off" data-spinner="Entering the site…">
    <img class="logo" src="/assets/images/brand/logo-wavemax.png" alt="WaveMAX">
    <h1>You're verified</h1>
    <p class="sub">Click below to unlock the site preview from this device.</p>
    <input type="hidden" name="token" value="${esc(token)}">
    <input type="hidden" name="next" value="${esc(safeNext(nextUrl))}">
    <button type="submit">Enter the site</button>
  </form>`, nonce);
}

function confirmErrorPage(nonce) {
  return pageShell(`
  <div class="card">
    <img class="logo" src="/assets/images/brand/logo-wavemax.png" alt="WaveMAX">
    <h1>Link expired or already used</h1>
    <p class="sub">This preview link is no longer valid. Request a fresh one and we'll email you a new link.</p>
    <a class="link" href="/__gate">Request a new link</a>
  </div>`, nonce);
}

function confirmEmailHtml(link) {
  const safeLink = esc(link);
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;color:#0f172a">
  <div style="background:#1e3a8a;text-align:center;padding:22px;border-radius:10px 10px 0 0">
    <img src="https://wavemax.promo/assets/images/brand/logo-wavemax.png" alt="WaveMAX" style="height:40px">
  </div>
  <div style="padding:28px 24px;border:1px solid #e5e7eb;border-top:0;border-radius:0 0 10px 10px">
    <h2 style="font-size:18px;margin:0 0 8px">Your site preview link</h2>
    <p style="font-size:14px;line-height:1.5;color:#334155">Click below to unlock access to the site preview from this device. This link expires in 60 minutes.</p>
    <p style="margin:22px 0"><a href="${safeLink}" style="background:#2563eb;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;display:inline-block">Enter the site</a></p>
    <p style="font-size:12px;color:#64748b;word-break:break-all">If the button doesn't work, paste this link into your browser:<br>${safeLink}</p>
    <p style="font-size:12px;color:#94a3b8;margin-top:16px">If you didn't request this, you can safely ignore this email.</p>
  </div>
</div>`;
}

async function whitelistIp(ip, email) {
  const set = { lastSeenAt: new Date() };
  if (email) set.email = email;
  await AccessWhitelist.updateOne(
    { ip },
    { $set: set, $setOnInsert: { ip, addedAt: new Date(), addedVia: 'email-link', trackClicks: true } },
    { upsert: true }
  );
  cache.ips.set(ip, { trackClicks: true });
}

function recordClick(req, ip) {
  // best-effort, fire-and-forget — never blocks or throws into the request
  AccessClick.create({
    ip,
    method: req.method,
    host: req.headers.host,
    path: req.originalUrl,
    userAgent: req.headers['user-agent'],
    referer: req.headers.referer || req.headers.referrer
  }).catch(() => {});
}

// Handles the gate's own endpoints (/__gate, /__gate/sent, /__gate/confirm),
// reachable regardless of whitelist so a not-yet-unlocked visitor can request
// and confirm access.
async function handleGate(req, res, ip) {
  const nonce = (res.locals && res.locals.cspNonce) || '';
  // POST /__gate/confirm — verify the token↔email, then whitelist this IP.
  if (req.path === '/__gate/confirm' && req.method === 'POST') {
    const token = (req.body && req.body.token) || '';
    const ar = token ? await AccessRequest.findOne({ token }).lean().catch(() => null) : null;
    if (ar && ar.used && ar.usedIp === ip) return res.redirect(safeNext(ar.next));
    if (!ar || ar.used || tokenExpired(ar)) {
      return res.status(400).type('html').send(confirmErrorPage(nonce));
    }
    try {
      await whitelistIp(ip, ar.email);
      await AccessRequest.updateOne({ token }, { $set: { used: true, usedAt: new Date(), usedIp: ip } });
    } catch (e) { logger.error('Access gate confirm failed:', e.message); }
    return res.redirect(safeNext(ar.next));
  }

  // GET /__gate/confirm — validate the emailed token, then show the confirm button.
  if (req.path === '/__gate/confirm') {
    const token = (req.query && req.query.token) || '';
    const ar = token ? await AccessRequest.findOne({ token }).lean().catch(() => null) : null;
    if (ar && ar.used && ar.usedIp === ip) return res.redirect(safeNext(ar.next));
    if (!ar || ar.used || tokenExpired(ar)) {
      return res.status(400).type('html').send(confirmErrorPage(nonce));
    }
    return res.status(200).type('html').send(confirmPage(token, ar.next, nonce));
  }

  // GET /__gate/sent — "check your email" confirmation.
  if (req.path === '/__gate/sent') {
    return res.status(200).type('html').send(sentPage(nonce));
  }

  // POST /__gate — verify password + email, then email a single-use link.
  if (req.path === '/__gate' && req.method === 'POST') {
    const pw = (req.body && req.body.password) || '';
    const email = ((req.body && req.body.email) || '').trim();
    const next = req.body && req.body.next;
    if (!cache.hash || !verifyPassword(pw, cache.salt, cache.hash)) {
      return res.status(401).type('html').send(landingPage('Incorrect password.', next, email, nonce));
    }
    if (!emailValid(email)) {
      return res.status(400).type('html').send(landingPage('Please enter a valid email address.', next, '', nonce));
    }
    // Cluster-global throttle: skip resending if this IP requested a link very
    // recently. Checked in the DB so all PM2 workers share the window.
    const since = new Date(Date.now() - SEND_THROTTLE_MS);
    const recent = await AccessRequest.findOne({ requestIp: ip, createdAt: { $gte: since } }).lean().catch(() => null);
    if (recent) return res.redirect('/__gate/sent');
    const token = crypto.randomBytes(32).toString('hex');
    try {
      await AccessRequest.create({
        token, email, next: safeNext(next), requestIp: ip,
        createdAt: new Date(), expiresAt: new Date(Date.now() + TOKEN_TTL_MS), used: false
      });
      const host = req.headers['x-forwarded-host'] || req.headers.host;
      const link = `https://${host}/__gate/confirm?token=${token}`;
      await sendEmail(email, 'Your WaveMAX preview link', confirmEmailHtml(link), GATE_FROM);
    } catch (e) {
      logger.error('Access gate link email failed:', e.message);
      return res.status(500).type('html').send(landingPage('We could not send the email. Please try again.', next, email, nonce));
    }
    return res.redirect('/__gate/sent');
  }

  // GET /__gate — landing form.
  return res.status(200).type('html').send(landingPage(null, req.query && req.query.next, '', nonce));
}

async function accessGate(req, res, next) {
  if (!cache.enabled) return next();
  const ip = clientIp(req);

  // The gate's own endpoints — handled regardless of whitelist so a not-yet-
  // unlocked visitor can request and confirm access.
  if (req.path === '/__gate' || req.path.startsWith('/__gate/')) {
    return handleGate(req, res, ip);
  }

  if (isExempt(req.path)) return next();

  // crhsent.com is the open public site — never gated or redirected.
  if (NON_GATED_HOSTS.includes(reqHost(req))) return next();

  // Hot path: in-memory whitelist hit.
  let entry = cache.ips.get(ip);
  // Cache miss → single DB lookup (covers an unlock that happened on another
  // cluster worker). Fail-closed (show landing) if the DB is unreachable.
  if (!entry) {
    try {
      const w = await AccessWhitelist.findOne({ ip }, { trackClicks: 1 }).lean();
      if (w) { entry = { trackClicks: w.trackClicks !== false }; cache.ips.set(ip, entry); }
    } catch (e) { /* fail-closed: fall through to landing */ }
  }

  if (entry) {
    if (entry.trackClicks) recordClick(req, ip);
    return next();
  }

  // Verified Google crawlers bypass the gate AND the preview redirect so search
  // sees all real content on every path. UA is a cheap pre-filter; reverse-DNS +
  // forward-confirm is authoritative (spoofed UAs fail it). Not click-logged.
  const ua = req.headers['user-agent'] || '';
  if (GOOGLE_UA_RE.test(ua) && await isVerifiedGoogle(ip)) {
    return next();
  }

  // Non-whitelisted, non-crawler on a gated host. Decide off the ORIGINAL
  // request path (X-Original-URI, set by nginx before its root→/austin-tx/
  // rewrite — falls back to originalUrl when not behind nginx): the bare domain
  // root bounces to corporate, while only the shareable /austin-tx/ preview
  // path shows the gate. Whitelisted users already returned next() above, so
  // they still see the franchise content at the root.
  const originalPath = String(req.headers['x-original-uri'] || req.originalUrl || req.path).split('?')[0];
  if (!originalPath.startsWith(PREVIEW_PATH_PREFIX)) {
    return res.redirect(302, PREVIEW_CORPORATE_URL);
  }
  return res.status(401).type('html').send(landingPage(null, req.method === 'GET' ? req.originalUrl : '/', '', (res.locals && res.locals.cspNonce) || ''));
}

module.exports = accessGate;
module.exports.loadCache = loadCache;
module.exports.startCacheRefresh = startCacheRefresh;
module.exports._cache = cache; // exposed for tests
module.exports._botCache = botCache; // exposed for tests
module.exports._landingPage = landingPage;
