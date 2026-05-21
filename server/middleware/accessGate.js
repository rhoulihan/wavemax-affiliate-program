// Site access gate: password-protects all web traffic to the Express-served
// domains unless the client IP is whitelisted. No username — a single shared
// password (PBKDF2-hashed in the AccessGate collection) unlocks an IP, which
// is then recorded in AccessWhitelist. Whitelisted IPs (except the seeded
// admin IP) have their traffic logged to AccessClick.
//
// Enabled only when ACCESS_GATE_ENABLED=true, so it can be deployed dark,
// seeded, verified, then switched on without risk of self-lockout.
//
// Resilience: an in-memory cache serves the hot path with no per-request DB
// read; a cache miss falls back to a single DB lookup (covers cross-worker
// unlocks in the PM2 cluster); a periodic refresh reconciles drift. Click
// logging is best-effort and never blocks a request.

const { verifyPassword } = require('../utils/encryption');
const logger = require('../utils/logger');
const AccessGate = require('../models/AccessGate');
const AccessWhitelist = require('../models/AccessWhitelist');
const AccessClick = require('../models/AccessClick');

const cache = { ready: false, salt: null, hash: null, ips: new Map() }; // ip -> { trackClicks }

async function loadCache() {
  try {
    const gate = await AccessGate.findOne({ key: 'gate' }).lean();
    const wl = await AccessWhitelist.find({}, { ip: 1, trackClicks: 1 }).lean();
    cache.salt = gate ? gate.salt : null;
    cache.hash = gate ? gate.hash : null;
    cache.ips = new Map(wl.map((w) => [w.ip, { trackClicks: w.trackClicks !== false }]));
    cache.ready = true;
    logger.info(`Access gate cache loaded: ${cache.ips.size} whitelisted IP(s); password ${cache.hash ? 'set' : 'NOT set'}`);
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

function landingPage(error, nextUrl) {
  const next = esc(nextUrl && nextUrl.startsWith('/') ? nextUrl : '/');
  const err = error ? `<p class="err">${esc(error)}</p>` : '';
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
  p.sub{font-size:14px;color:#bcd3ff;margin-bottom:22px}
  input[type=password]{width:100%;padding:13px 14px;border-radius:8px;border:1px solid rgba(255,255,255,.25);
    background:rgba(255,255,255,.95);color:#0f172a;font-size:15px;margin-bottom:14px}
  button{width:100%;padding:13px;border:0;border-radius:8px;background:#2563eb;color:#fff;
    font-size:15px;font-weight:600;cursor:pointer}
  button:hover{background:#1e3a8a}
  .err{color:#fca5a5;font-size:13px;margin-bottom:12px}
</style></head>
<body>
  <form class="card" method="POST" action="/__gate" autocomplete="off">
    <img class="logo" src="/assets/images/brand/logo-wavemax.png" alt="WaveMAX">
    <h1>Enter password to proceed</h1>
    <p class="sub">This site is currently private.</p>
    ${err}
    <input type="password" name="password" placeholder="Password" autofocus required>
    <input type="hidden" name="next" value="${next}">
    <button type="submit">Enter</button>
  </form>
</body></html>`;
}

async function addToWhitelist(ip) {
  await AccessWhitelist.updateOne(
    { ip },
    { $set: { lastSeenAt: new Date() }, $setOnInsert: { ip, addedAt: new Date(), addedVia: 'password', trackClicks: true } },
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

async function accessGate(req, res, next) {
  if (process.env.ACCESS_GATE_ENABLED !== 'true') return next();
  const ip = clientIp(req);

  // The gate's own endpoint (GET landing / POST password) — handled regardless of whitelist.
  if (req.path === '/__gate') {
    if (req.method === 'POST') {
      const pw = (req.body && req.body.password) || '';
      if (cache.hash && verifyPassword(pw, cache.salt, cache.hash)) {
        try { await addToWhitelist(ip); } catch (e) { logger.error('Access gate whitelist add failed:', e.message); }
        const dest = req.body.next && String(req.body.next).startsWith('/') ? req.body.next : '/';
        return res.redirect(dest);
      }
      return res.status(401).type('html').send(landingPage('Incorrect password.', req.body && req.body.next));
    }
    return res.status(200).type('html').send(landingPage(null, req.query.next));
  }

  if (isExempt(req.path)) return next();

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

  // Not whitelisted → branded landing page.
  return res.status(401).type('html').send(landingPage(null, req.method === 'GET' ? req.originalUrl : '/'));
}

module.exports = accessGate;
module.exports.loadCache = loadCache;
module.exports.startCacheRefresh = startCacheRefresh;
module.exports._cache = cache; // exposed for tests
module.exports._landingPage = landingPage;
