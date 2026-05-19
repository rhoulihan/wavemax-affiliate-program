/**
 * Franchise controller — renders the per-franchise host page.
 *
 * URL contract:
 *   GET /:slug              → landing page (page = '/')
 *   GET /:slug/             → landing page (page = '/')
 *   GET /:slug/:page        → specific service page
 *   GET /:slug/:page/       → specific service page (trailing slash OK)
 *
 * The host page is a single template (public/franchise-host.html) shared
 * by every franchise. Per-request the controller injects:
 *   - window.LOCATION_DATA          (from the franchise's JSON)
 *   - window.FRANCHISE_INITIAL_SRC  (iframe src for the requested page)
 *   - <title>, <meta description>, canonical URL                   (SEO)
 *
 * Iframe-override resolution + default-content fallback live in the
 * registry service; the controller only renders.
 */

const fs = require('fs');
const path = require('path');
const registry = require('../services/franchiseRegistryService');
const equipmentProfileService = require('../services/equipmentProfileService');
const logger = require('../utils/logger');
const { isQuarantineEnabled, buildCorporateRedirect } = require('../config/quarantineConfig');

const ROOT = path.resolve(__dirname, '../..');
const HOST_TEMPLATE = path.join(ROOT, 'public/franchise-host.html');

// Read the template once at startup; in dev we re-read on every request
// so edits show up without restarting pm2.
let cachedTemplate = null;
function loadTemplate() {
  if (process.env.NODE_ENV === 'production' && cachedTemplate) return cachedTemplate;
  cachedTemplate = fs.readFileSync(HOST_TEMPLATE, 'utf8');
  return cachedTemplate;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function escapeJsonForScript(obj) {
  // JSON.stringify and then escape `</` so the inline script can't be
  // closed early by attacker-controlled content. Also escape U+2028/2029
  // which are valid in JSON but break JS string literals.
  return JSON.stringify(obj)
    .replace(/<\/(script)/gi, '<\\/$1')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function buildInitialIframeSrc(resolution) {
  if (resolution.kind === 'iframe') return resolution.iframeUrl;
  if (resolution.kind === 'default') {
    // Internal franchise-default content surface.
    return `/franchise-default/${resolution.defaultPage}.html`;
  }
  if (resolution.kind === 'placeholder') {
    return `/franchise-default/coming-soon.html`;
  }
  return null;
}

// Per-page SEO seeds. The page-key prefix maps to a pseudo-canonical
// "service" name for keyword-density purposes, the per-page H1 the
// host page should ship in static HTML, and a description-shape
// hint. Long-form titles are constructed from these seeds + the
// franchise's brand/contact data.
const PAGE_SEO_SPEC = {
  '/':                   { service: 'Laundromat',                     h1: 'Laundromat',                          differentiator: 'Self-Service & Wash-Dry-Fold Drop-Off' },
  '/wash-dry-fold':      { service: 'Wash-Dry-Fold Laundry',           h1: 'Wash-Dry-Fold Drop-Off Laundry',      differentiator: 'Drop-Off Service' },
  '/self-serve-laundry': { service: 'Self-Service Laundromat',         h1: 'Self-Service Laundromat',             differentiator: '42 Electrolux Washers up to 80lb' },
  '/commercial':         { service: 'Commercial Laundry Service',      h1: 'Commercial Laundry Service',          differentiator: 'Volume Pricing for Business' },
  '/about-us':           { service: 'Family-Owned Laundromat',         h1: 'About Us',                            differentiator: 'About Us' },
  '/contact':            { service: 'Laundromat Contact',              h1: 'Contact Us',                          differentiator: 'Call · Visit · Send a Message' }
};

function buildPageSeo(data, page, slug) {
  const spec = PAGE_SEO_SPEC[page] || PAGE_SEO_SPEC['/'];
  const brand = (data.brand && data.brand.name) || 'WaveMAX Laundry';
  const city  = (data.contact && data.contact.city)  || '';
  const state = (data.contact && data.contact.state) || '';
  const addr  = (data.contact && data.contact.address) || '';
  const phone = (data.contact && data.contact.phone) || '';
  const hours = (data.hours && data.hours.display) || '';
  const seoBlock = (data.seo && data.seo.localizedHeadlines) || {};
  const seoDescBlock = (data.seo && data.seo.localizedDescriptions) || {};

  // Map page → seo-block keys (matches the keys franchise-page-helpers uses
  // on the client side).
  const KEY_MAP = {
    '/':                   { tk: 'landingTitle',    dk: 'landingDescription' },
    '/wash-dry-fold':      { tk: 'wdfTitle',        dk: 'wdfDescription' },
    '/self-serve-laundry': { tk: 'selfServeTitle',  dk: 'selfServeDescription' },
    '/commercial':         { tk: 'commercialTitle', dk: 'commercialDescription' },
    '/about-us':           { tk: 'aboutTitle',      dk: 'aboutDescription' },
    '/contact':            { tk: 'contactTitle',    dk: 'contactDescription' }
  };
  const km = KEY_MAP[page] || KEY_MAP['/'];

  // Title: per-franchise override first; else `${service} in ${city}, ${state} | ${differentiator} | ${brand}`.
  // Target length: 50-90 chars (Google truncates around 60 visually but
  // indexes the full string for keyword scoring up to ~70-80).
  const defaultTitle = (page === '/about-us' || page === '/contact')
    ? `${spec.h1} ${brand}${city ? ' · ' + city + ', ' + state : ''}`
    : `${spec.service}${city ? ' in ' + city + ', ' + state : ''} | ${spec.differentiator} | ${brand}`;
  const title = seoBlock[km.tk] || defaultTitle;

  // Description: per-franchise override first; else a 150-160 char template
  // that bakes in city, address, hours, brand, and primary keyword.
  const defaultDescription =
    page === '/contact'
      ? `Contact ${brand}: call ${phone}, visit ${addr}, ${city}, ${state}, or send a message. Open ${hours}. Card-pay, fully attended.`.trim()
      : page === '/about-us'
        ? `${brand} — family-owned ${city} laundromat at ${addr}. Hospital-grade UV-sanitized water, 80lb commercial Electrolux washers, fully attended every shift.`.trim()
        : `${spec.service} in ${city}, ${state}. ${brand} at ${addr}. Open ${hours}. ${spec.differentiator}, hospital-grade UV-sanitized water, fully attended.`.trim();
  const description = seoDescBlock[km.dk] || defaultDescription;

  // SSR-visible H1 — short, keyword-rich, includes city. Renders inside a
  // visually-hidden span on the host page so chrome layout is unchanged but
  // crawlers (especially low-budget JS-skipping ones) see an H1. About-us
  // and contact get a brand-anchored H1 instead of the generic "in city"
  // pattern, which reads better and surfaces brand keywords.
  const heroH1 =
    page === '/about-us' ? `About ${brand}` :
    page === '/contact'  ? `Contact ${brand}` :
    city                 ? `${spec.h1} in ${city}, ${state}` :
                           spec.h1;

  return { title, description, heroH1 };
}

// Strip PII fields from the data object before injecting into the HTML.
// Owner emails are populated server-side from corporate scraping (see
// scripts/franchise-build/fetch-emails.js + fetch-corporate-data.js)
// and used for contact-form delivery routing only — they must never
// reach the rendered page or the browser-readable LOCATION_DATA blob.
function sanitizeForClient(data) {
  const out = JSON.parse(JSON.stringify(data));
  if (out.contact) {
    delete out.contact.email;
    delete out.contact.emailMailto;
  }
  return out;
}

exports.renderFranchisePage = (req, res, next) => {
  const slug = req.params.slug;
  const page = req.params.page ? `/${req.params.page}` : '/';

  // Defense-in-depth — the locationQuarantine middleware should catch
  // non-Austin slugs before they reach this controller, but belt-and-
  // suspenders in case the middleware is bypassed or this controller is
  // invoked directly (e.g., from a future internal route).
  if (isQuarantineEnabled() && slug !== 'austin-tx') {
    return res.redirect(302, buildCorporateRedirect(req.originalUrl));
  }

  if (!registry.getFranchise(slug)) return next();

  const resolution = registry.resolvePage(slug, page);
  if (resolution.kind === 'notfound') {
    return res.status(404).send('Page not available for this franchise.');
  }

  // Enrich equipment with profile-derived metrics (cycle time, spin G,
  // UV system, marketing claims, capacity range). Pages read these out
  // of LOCATION_DATA.equipment instead of hardcoding Austin numbers.
  // Stores without an explicit profileId fall back to the unaudited
  // mixed-fleet profile, so we never make claims we can't back up.
  const enriched = {
    ...resolution.data,
    equipment: equipmentProfileService.resolve(resolution.data)
  };

  // Owner emails (scraped from corporate JSON-LD) are PII — never expose
  // them in the rendered HTML or in the client-side LOCATION_DATA blob.
  // The contact form's POST handler reads contact.email directly from
  // the registry file via loadLocationData(slug) on the server, so form
  // routing still works; clients just don't see the address.
  const data = sanitizeForClient(enriched);
  const iframeSrc = buildInitialIframeSrc(resolution);

  // Per-page SEO bundle — long keyword-rich title (~70-90 chars) + 150-char
  // description + short H1 the static HTML can ship for SSR-side crawlers
  // that don't run JS. Pulls per-page overrides from the franchise's seo
  // block when present, else falls back to a structured template that bakes
  // city, state, brand, and primary keyword into a Google-friendly shape.
  const seo = buildPageSeo(data, page, slug);
  const title       = seo.title;
  const description = seo.description;
  const heroH1      = seo.heroH1;
  const canonical = `https://wavemax.promo/${slug}${page === '/' ? '/' : page + '/'}`;

  // Inline data block — replaces the two scripts (places-config + static
  // host-mock-data.js) the dev demo loads. Single source of truth: the
  // franchise's JSON file. Falls back to the corporate Places key in env
  // when the franchise's own google.apiKey is empty.
  const placesApiKey = (data.google && data.google.apiKey) || process.env.GOOGLE_PLACES_API_KEY || '';
  const placeId      = (data.google && data.google.placeId) || '';
  // Per-request CSP nonce (set by cspNonceMiddleware on res.locals).
  // Required: the host page CSP demands a nonce on inline <script> and
  // the 'unsafe-inline' fallback is ignored once a nonce is in the
  // source list. Without it the script is silently blocked, leaving
  // window.LOCATION_DATA undefined and the chrome falling back to the
  // hardcoded austin-landing iframe path.
  const nonce = res.locals.cspNonce || '';
  const nonceAttr = nonce ? ` nonce="${escapeHtml(nonce)}"` : '';
  const dataInjection = [
    `<script${nonceAttr}>`,
    `  window.LOCATION_DATA          = ${escapeJsonForScript(data)};`,
    `  window.GOOGLE_PLACES_API_KEY  = ${escapeJsonForScript(placesApiKey)};`,
    `  window.LOCATION_PLACE_ID      = ${escapeJsonForScript(placeId)};`,
    `  window.FRANCHISE_SLUG         = ${escapeJsonForScript(slug)};`,
    `  window.FRANCHISE_INITIAL_ROUTE = ${escapeJsonForScript(page)};`,
    '</script>'
  ].join('\n');

  let html = loadTemplate();
  html = html
    .replace(/\{\{TITLE\}\}/g,         escapeHtml(title))
    .replace(/\{\{DESCRIPTION\}\}/g,   escapeHtml(description))
    .replace(/\{\{HERO_H1\}\}/g,       escapeHtml(heroH1))
    .replace(/\{\{CANONICAL_URL\}\}/g, escapeHtml(canonical))
    .replace(/\{\{INITIAL_IFRAME_SRC\}\}/g, escapeHtml(iframeSrc || ''))
    .replace(/\{\{SLUG\}\}/g,          escapeHtml(slug))
    .replace(/\{\{CSP_NONCE\}\}/g,     escapeHtml(nonce))
    .replace(/<!-- \{\{FRANCHISE_DATA_INJECTION\}\} -->/, dataInjection);

  res.setHeader('Cache-Control', 'public, max-age=60');
  res.send(html);
};

exports.listFranchises = (req, res) => {
  res.json({ franchises: registry.listFranchises() });
};
