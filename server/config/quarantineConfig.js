/**
 * Quarantine configuration — what passes through, what redirects.
 *
 * When `QUARANTINE_NON_AUSTIN=true` the middleware (locationQuarantine.js)
 * lets only these path patterns through; everything else 302-redirects to
 * the corporate site at CORPORATE_SITE_URL with the original path preserved.
 *
 * The intent is: this server hosts the Austin location pages + the
 * affiliate-program app. Marketing/corporate content and other franchise
 * locations live on www.wavemaxlaundry.com.
 */

const CORPORATE_SITE_URL =
  (process.env.CORPORATE_SITE_URL || 'https://www.wavemaxlaundry.com').replace(/\/+$/, '');

// Patterns matched against req.path (no query string, no method). Order does
// not matter — any match passes the request through. Use anchored regexes so
// a substring like "austin" elsewhere in the URL doesn't accidentally allow.
const ALLOWLIST = [
  // ── Austin location (iframe-bridge architecture) ─────────────────
  /^\/austin-tx(\/.*)?$/,           // /austin-tx, /austin-tx/, /austin-tx/wash-dry-fold/, etc.
  /^\/api\/austin-tx\//,            // Austin Places config endpoint

  // ── Affiliate-program app — API surface ──────────────────────────
  /^\/api\//,                       // covers /api/v1, /api/v2, /api/csrf-token, /api/health, /api/docs
  /^\/health$/,                     // non-API health (some monitors hit this)

  // ── Affiliate-program app — static assets and SPA entry ──────────
  /^\/assets\//,                    // CSS, JS, images
  /^\/locales\//,                   // i18n translation files
  /^\/franchise-default\//,         // internal iframe content for default franchise pages
  /^\/data\/franchises\.json$/,     // franchise index (used by clients/sitemap; not per-franchise data)
  /^\/embed-app(-v2)?\.html$/,      // SPA shell
  /^\/[a-z0-9-]+-embed\.html$/,     // any *-embed.html (affiliate-login, customer-register, etc.)
  /^\/operator-login-store\.html$/, // store-IP-gated operator login
  /^\/oauth-success\.html$/,        // OAuth callback landing
  /^\/registration-success\.html$/,
  /^\/deletion-status\.html$/,

  // ── Legal/policy (required for payment processor + compliance) ───
  /^\/privacy-policy$/,
  /^\/terms-of-service$/,
  /^\/terms-and-conditions$/,
  /^\/refund-policy$/,

  // ── SEO crawl resources ──────────────────────────────────────────
  // Per-host robots.txt and sitemap.xml emitted by server.js so each of
  // the four per-location domains points search engines at its own URL
  // set. Search crawlers (Googlebot, Bingbot) don't carry session cookies
  // or whitelisted IPs, so these must be public.
  /^\/robots\.txt$/,
  /^\/sitemap\.xml$/,
];

/**
 * Does this path pass the allowlist?
 * @param {string} pathname  req.path (no query string)
 */
function isAllowed(pathname) {
  return ALLOWLIST.some((re) => re.test(pathname));
}

/**
 * Build the corporate URL that a quarantined path redirects to. Preserves
 * the path and query string verbatim — the corporate site is responsible
 * for its own URL structure / 404s.
 *
 * @param {string} originalUrl  req.originalUrl (path + query)
 */
function buildCorporateRedirect(originalUrl) {
  // originalUrl always starts with '/'; ensure no double slash.
  const tail = originalUrl.startsWith('/') ? originalUrl : '/' + originalUrl;
  return `${CORPORATE_SITE_URL}${tail}`;
}

/**
 * Is the quarantine currently active? Read at request time so tests can
 * flip the env var per-describe.
 */
function isQuarantineEnabled() {
  return process.env.QUARANTINE_NON_AUSTIN === 'true';
}

module.exports = {
  ALLOWLIST,
  CORPORATE_SITE_URL,
  isAllowed,
  buildCorporateRedirect,
  isQuarantineEnabled,
};
