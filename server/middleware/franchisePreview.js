// Franchise self-serve preview — request endpoints (crhsent.com host).
//
// Two POST endpoints, only on the crhsent host:
//   /__preview/resolve  — resolve a pasted Google Business link → {placeId,name,address}
//                         so the modal can show the franchisee "is this you?".
//   /__preview/request  — the consequential submit: Turnstile + attestation +
//                         throttle → create a FranchisePreviewRequest → email the
//                         reusable key link + the 1-hour-unlock password.
//
// Deploys DARK: no-op unless FRANCHISE_PREVIEW_ENABLED=true (mirrors the access
// gate). Mounted after body+cookie parsing and before the location quarantine so
// these crhsent paths aren't redirected to corporate. Authorization is by
// attestation (Google never exposes a GBP owner's email — see gbpService).
'use strict';

const crypto = require('crypto');
const FranchisePreviewRequest = require('../models/FranchisePreviewRequest');
const gbp = require('../services/gbpService');
const { verifyTurnstile } = require('../utils/turnstile');
const { sendPreviewUnlockEmail } = require('../services/franchisePreviewEmail');
const { hashPassword, verifyPassword } = require('../utils/encryption');
const { DISCLAIMER_VERSION } = require('../config/franchisePreviewCopy');
const { sign: signUnlock, verify: verifyUnlock, COOKIE_NAME, UNLOCK_TTL_MS } = require('../utils/previewUnlockCookie');
const pages = require('../services/franchisePreviewPages');
const logger = require('../utils/logger');

const PREVIEW_HOSTS = new Set(['crhsent.com', 'www.crhsent.com']);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESEND_WINDOW_MS = 60 * 1000;

// Coarse in-memory per-IP throttle for the Places-backed resolve endpoint
// (protects Google quota from hammering). Per-process + resets on restart;
// pruned per-IP on access and hard-capped so it can't grow unbounded.
const resolveHits = new Map();
const RESOLVE_MAX = 30;
const RESOLVE_WINDOW_MS = 10 * 60 * 1000;
function resolveThrottled(ip) {
  if (resolveHits.size > 10000) resolveHits.clear();
  const now = Date.now();
  const arr = (resolveHits.get(ip) || []).filter((t) => now - t < RESOLVE_WINDOW_MS);
  arr.push(now);
  resolveHits.set(ip, arr);
  return arr.length > RESOLVE_MAX;
}

// In-memory brute-force guard for the unlock password (keyed by token+IP).
const unlockHits = new Map();
const UNLOCK_MAX = 10;
const UNLOCK_WINDOW_MS = 15 * 60 * 1000;
function unlockThrottled(key) {
  if (unlockHits.size > 10000) unlockHits.clear();
  const now = Date.now();
  const arr = (unlockHits.get(key) || []).filter((t) => now - t < UNLOCK_WINDOW_MS);
  arr.push(now);
  unlockHits.set(key, arr);
  return arr.length > UNLOCK_MAX;
}

function enabled() { return process.env.FRANCHISE_PREVIEW_ENABLED === 'true'; }
function isPreviewHost(req) { return PREVIEW_HOSTS.has(String(req.hostname || '').toLowerCase()); }
function clientIp(req) { return String(req.headers['cf-connecting-ip'] || req.ip || ''); }
function cleanLink(s) { return String(s || '').replace(/&amp;/g, '&').trim(); }

function slugify(s) {
  return String(s || '').toLowerCase().normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
}

// Cosmetic URL slug for crhsent.com/<slug>. The token (not the slug) keys the
// content, so the slug need not be unique — prefer the city/state, fall back to
// the business name.
function locationSlug(details) {
  const m = String(details.formattedAddress || '').match(/,\s*([^,]+),\s*([A-Za-z]{2})\b/);
  if (m) return slugify(`${m[1]}-${m[2]}`);
  return slugify(details.name) || 'preview';
}

// Human-friendly one-time password: 8 unambiguous chars, grouped (e.g. WX7K-9MQ2).
function genPassword() {
  const alpha = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const b = crypto.randomBytes(8);
  let s = '';
  for (let i = 0; i < 8; i++) s += alpha[b[i] % alpha.length];
  return `${s.slice(0, 4)}-${s.slice(4)}`;
}

async function handleResolve(req, res) {
  const ip = clientIp(req);
  if (resolveThrottled(ip)) return res.status(429).json({ ok: false, code: 'THROTTLED' });
  const body = req.body || {};
  try {
    const d = body.text
      ? await gbp.resolveByText(body.text)
      : await gbp.resolveGbpLink(cleanLink(body.gbpLink));
    return res.json({ ok: true, placeId: d.placeId, name: d.name, formattedAddress: d.formattedAddress });
  } catch (e) {
    const status = (e.code === 'INVALID_LINK' || e.code === 'INVALID_QUERY') ? 400 : 422;
    return res.status(status).json({ ok: false, code: e.code || 'RESOLVE_FAILED' });
  }
}

async function handleRequest(req, res) {
  const ip = clientIp(req);
  const body = req.body || {};

  const ts = await verifyTurnstile(body.turnstileToken, ip);
  if (!ts.success) return res.status(400).json({ ok: false, code: 'CAPTCHA_FAILED' });

  const email = String(body.email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return res.status(400).json({ ok: false, code: 'INVALID_EMAIL' });
  if (body.attestation !== true) return res.status(400).json({ ok: false, code: 'ATTESTATION_REQUIRED' });

  // Anti-resend throttle: a recent request from this IP or email → respond ok
  // (don't resend, don't leak whether an address was used).
  const since = new Date(Date.now() - RESEND_WINDOW_MS);
  const recent = await FranchisePreviewRequest.findOne({
    $or: [{ requestIp: ip }, { email }], createdAt: { $gte: since }
  });
  if (recent) return res.json({ ok: true });

  // Prefer the placeId carried from the resolve step; fall back to re-resolving.
  let details;
  try {
    details = body.placeId
      ? await gbp.getPlaceDetails(String(body.placeId))
      : await gbp.resolveGbpLink(cleanLink(body.gbpLink));
  } catch (e) {
    return res.status(422).json({ ok: false, code: e.code || 'RESOLVE_FAILED' });
  }

  const token = crypto.randomBytes(32).toString('hex');
  const password = genPassword();
  const { salt, hash } = hashPassword(password);
  const slug = locationSlug(details);

  await FranchisePreviewRequest.create({
    token,
    locationSlug: slug,
    placeId: details.placeId,
    businessName: details.name,
    formattedAddress: details.formattedAddress,
    email,
    passwordSalt: salt,
    passwordHash: hash,
    gbpData: details,
    attestation: { acceptedAt: new Date(), ip, version: DISCLAIMER_VERSION },
    requestIp: ip,
    createdAt: new Date()
  });

  const unlockUrl = `https://crhsent.com/${slug}?key=${token}`;
  try {
    await sendPreviewUnlockEmail({ email, businessName: details.name, unlockUrl, password });
  } catch (e) {
    logger.error('Franchise preview: email send failed', { error: e.message, email });
    return res.status(502).json({ ok: false, code: 'EMAIL_FAILED' });
  }
  logger.info('Franchise preview requested', { email, slug, placeId: details.placeId });
  return res.json({ ok: true });
}

// GET crhsent.com/<slug>?key=<token> — the gated preview route. 404s without a
// valid key; shows the unlock (password) form unless a valid 1-hour cookie is
// present, in which case it serves the preview.
async function handleGatedPage(req, res) {
  const token = String(req.query.key || '');
  const doc = await FranchisePreviewRequest.findOne({ token, revokedAt: null });
  if (!doc) {
    res.status(404).type('html');
    return res.send(pages.buildNoticePage('Preview link not found', 'This preview link is invalid or has been revoked. Please use the link from your email.'));
  }
  const cookieVal = req.cookies ? req.cookies[COOKIE_NAME] : null;
  if (verifyUnlock(cookieVal, token)) {
    res.type('html');
    return res.send(pages.buildPreviewPage(doc));
  }
  res.type('html');
  return res.send(pages.buildUnlockPage({ businessName: doc.businessName, token }));
}

// POST /__preview/unlock — native form submit from the unlock page. Validates the
// password + re-attestation, then sets the 1-hour signed unlock cookie.
async function handleUnlock(req, res) {
  const ip = clientIp(req);
  const body = req.body || {};
  const token = String(body.key || '');
  const doc = await FranchisePreviewRequest.findOne({ token, revokedAt: null });
  if (!doc) {
    res.status(404).type('html');
    return res.send(pages.buildNoticePage('Preview link not found', 'This preview link is invalid or has been revoked.'));
  }
  if (unlockThrottled(`${token}:${ip}`)) {
    res.status(429).type('html');
    return res.send(pages.buildUnlockPage({ businessName: doc.businessName, token, error: 'Too many attempts. Please wait a few minutes and try again.' }));
  }
  if (body.attest !== 'yes') {
    res.type('html');
    return res.send(pages.buildUnlockPage({ businessName: doc.businessName, token, error: 'Please confirm you are authorized for this business.' }));
  }
  if (!verifyPassword(String(body.password || ''), doc.passwordSalt, doc.passwordHash)) {
    res.type('html');
    return res.send(pages.buildUnlockPage({ businessName: doc.businessName, token, error: 'Incorrect password. Check the email we sent you.' }));
  }
  doc.lastUnlockedAt = new Date();
  await doc.save();
  res.cookie(COOKIE_NAME, signUnlock(token), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: UNLOCK_TTL_MS,
    path: '/'
  });
  logger.info('Franchise preview unlocked', { slug: doc.locationSlug, placeId: doc.placeId });
  return res.redirect(303, `/${doc.locationSlug}?key=${token}`);
}

function franchisePreview(req, res, next) {
  if (!isPreviewHost(req)) return next();
  if (!enabled()) return next(); // dark until FRANCHISE_PREVIEW_ENABLED=true
  if (req.method === 'POST') {
    if (req.path === '/__preview/resolve') return handleResolve(req, res).catch(next);
    if (req.path === '/__preview/request') return handleRequest(req, res).catch(next);
    if (req.path === '/__preview/unlock') return handleUnlock(req, res).catch(next);
    return next();
  }
  // GET <slug>?key=<token> — the gated preview page (only when a key is present).
  if (req.method === 'GET' && req.query && req.query.key) {
    return handleGatedPage(req, res).catch(next);
  }
  return next();
}

module.exports = franchisePreview;
module.exports.handleResolve = handleResolve;
module.exports.handleRequest = handleRequest;
module.exports._internals = { slugify, locationSlug, genPassword, cleanLink };
