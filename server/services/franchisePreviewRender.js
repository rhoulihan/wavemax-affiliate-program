// Render the franchise-host marketing template (public/franchise-host.html) for a
// PREVIEW, populated with synthesized LOCATION_DATA. Reuses the exact template,
// iframe content (/franchise-default/landing.html), and parent→iframe data bridge
// the live franchise pages use — the chrome holds window.LOCATION_DATA and the
// bridge serves it to the embedded landing, so the preview localizes end to end.
//
// This is a separate, self-contained fill (it does not touch the live
// franchiseController) — kept deliberately isolated so a preview can never affect
// production franchise rendering. Placeholder set mirrors franchiseController.js.
'use strict';

const fs = require('fs');
const path = require('path');

const TEMPLATE_PATH = path.join(__dirname, '../../public/franchise-host.html');
let _tpl = null;
let _mtime = 0;
function loadTemplate() {
  const st = fs.statSync(TEMPLATE_PATH);
  if (!_tpl || st.mtimeMs !== _mtime) {
    _tpl = fs.readFileSync(TEMPLATE_PATH, 'utf8');
    _mtime = st.mtimeMs;
  }
  return _tpl;
}

function escHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}
// Safe to embed inside an inline <script> as a JS object literal: neutralize a
// "</script>" sequence and the two line-separator code points (U+2028/U+2029),
// which are valid in JSON strings but historically broke JS string literals.
const LS = String.fromCharCode(0x2028);
const PS = String.fromCharCode(0x2029);
function escJson(o) {
  return JSON.stringify(o)
    .replace(/<\/(script)/gi, '<\\/$1')
    .split(LS).join('\\u2028')
    .split(PS).join('\\u2029');
}

const PREVIEW_BANNER =
  '<div style="position:sticky;top:0;z-index:99999;background:#1e3a8a;color:#fff;text-align:center;font:600 13px/1.45 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Arial,sans-serif;padding:8px 14px">'
  + 'PRIVATE PREVIEW &middot; illustrative content built from your Google listing &mdash; not a published site &middot; hosted temporarily by CRHS Enterprises, LLC'
  + '</div>';

/**
 * @param {object} data LOCATION_DATA (see gbpToLocationData)
 * @param {{nonce?:string, slug?:string}} opts
 * @returns {string} full HTML document
 */
function renderPreviewHost(data, opts = {}) {
  const nonce = opts.nonce || '';
  const slug = opts.slug || data.slug || 'preview';
  const nonceAttr = nonce ? ` nonce="${escHtml(nonce)}"` : '';
  const name = (data.brand && data.brand.name) || 'Your Laundromat';
  const city = (data.contact && data.contact.city) || '';
  const state = (data.contact && data.contact.state) || '';
  const loc = [city, state].filter(Boolean).join(', ');
  const title = `${name} — Private Preview`;
  const description = `A private, illustrative web preview for ${name}${loc ? ` in ${loc}` : ''}.`;
  const canonical = `https://crhsent.com/${slug}`;

  const dataInjection = [
    `<script${nonceAttr}>`,
    `  window.LOCATION_DATA = ${escJson(data)};`,
    '  window.GOOGLE_PLACES_API_KEY = "";',
    `  window.LOCATION_PLACE_ID = ${escJson((data.google && data.google.placeId) || '')};`,
    `  window.FRANCHISE_SLUG = ${escJson(slug)};`,
    '  window.FRANCHISE_INITIAL_ROUTE = "/";',
    '  window.WAVEMAX_PREVIEW = true;',
    '</script>'
  ].join('\n');

  let html = loadTemplate()
    .replace(/\{\{TITLE\}\}/g, escHtml(title))
    .replace(/\{\{DESCRIPTION\}\}/g, escHtml(description))
    .replace(/\{\{KEYWORDS\}\}/g, escHtml((data.seo && data.seo.keywords) || ''))
    .replace(/\{\{CANONICAL_URL\}\}/g, escHtml(canonical))
    .replace(/\{\{HERO_H1\}\}/g, escHtml(name))
    .replace(/\{\{LEAD_PARAGRAPH\}\}/g, escHtml(description))
    .replace(/\{\{INITIAL_IFRAME_SRC\}\}/g, '/franchise-default/landing.html')
    .replace(/\{\{SLUG\}\}/g, escHtml(slug))
    .replace(/\{\{CSP_NONCE\}\}/g, escHtml(nonce))
    .replace(/\{\{SCHEMA_NAME\}\}/g, escHtml(name))
    .replace(/\{\{SCHEMA_ALTERNATE_NAME\}\}/g, escHtml((data.brand && data.brand.parent) || name))
    .replace(/\{\{SCHEMA_DESCRIPTION\}\}/g, escHtml(description))
    .replace(/\{\{SCHEMA_ID\}\}/g, escHtml(`${canonical}/#localbusiness`))
    // data injection (template carries it as an HTML comment) — handle comment or bare form
    .replace(/(?:<!--\s*)?\{\{FRANCHISE_DATA_INJECTION\}\}(?:\s*-->)?/, dataInjection)
    .replace(/\{\{FAQ_PAGE_SCHEMA\}\}/g, '')
    .replace(/\{\{FAQ_VISIBLE_BLOCK\}\}/g, '');

  // Private preview: force noindex (also behind a key, but belt-and-suspenders).
  html = html.replace('</head>', '<meta name="robots" content="noindex,nofollow"></head>');
  // Unmistakably a preview.
  html = html.replace(/(<body[^>]*>)/i, `$1${PREVIEW_BANNER}`);
  // Safety net: clear any placeholder we didn't explicitly fill.
  html = html.replace(/\{\{[A-Z_]+\}\}/g, '');
  return html;
}

module.exports = { renderPreviewHost, loadTemplate };
