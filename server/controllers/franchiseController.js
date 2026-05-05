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

exports.renderFranchisePage = (req, res, next) => {
  const slug = req.params.slug;
  const page = req.params.page ? `/${req.params.page}` : '/';

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
  const data = {
    ...resolution.data,
    equipment: equipmentProfileService.resolve(resolution.data)
  };
  const iframeSrc = buildInitialIframeSrc(resolution);

  const title = data.brand.name;
  const description = `${data.brand.name} at ${data.contact.address}, ${data.contact.city}, ${data.contact.state}. ` +
                      `Open ${data.hours.display}, ${data.hours.days}.`;
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
    .replace(/\{\{CANONICAL_URL\}\}/g, escapeHtml(canonical))
    .replace(/\{\{INITIAL_IFRAME_SRC\}\}/g, escapeHtml(iframeSrc || ''))
    .replace(/\{\{SLUG\}\}/g,          escapeHtml(slug))
    .replace(/<!-- \{\{FRANCHISE_DATA_INJECTION\}\} -->/, dataInjection);

  res.setHeader('Cache-Control', 'public, max-age=60');
  res.send(html);
};

exports.listFranchises = (req, res) => {
  res.json({ franchises: registry.listFranchises() });
};
