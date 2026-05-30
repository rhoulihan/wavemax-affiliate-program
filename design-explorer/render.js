// design-explorer/render.js
'use strict';

const { themes } = require('./themes');
const model = require('./content-model');

function cssVars(vars) {
  return Object.entries(vars).map(([k, v]) => `${k}:${v}`).join(';');
}

/**
 * Render a complete, CSP-clean HTML document for a given design-explorer state.
 *
 * @param {object} opts
 * @param {object} opts.skin        - Skin object: { id, css, renderPage(page,content,intensity,lang) }
 * @param {string} opts.intensity   - 'heavy' | 'light'
 * @param {string} opts.page        - Page key (e.g. 'home', 'self-serve', …)
 * @param {string} opts.lang        - 'en' | 'es'
 * @param {string} opts.nonce       - CSP nonce value (substituted for {{NONCE}})
 * @returns {string} Full <!DOCTYPE html> document
 */
function renderState({ skin, intensity, page, lang, nonce }) {
  const theme = themes[intensity];
  if (!theme) throw new Error(`unknown intensity: ${intensity}`);

  const c = model.content[lang];
  const body = skin.renderPage(page, c, intensity, lang);

  const html = `<!DOCTYPE html>
<html lang="${lang}" data-intensity="${theme.id}" data-skin="${skin.id}">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${model.NAP.name} — ${page}</title>
<style nonce="{{NONCE}}">:root{${cssVars(theme.vars)}}
${skin.css}</style>
</head>
<body>
<p class="ds-brandline" aria-hidden="true">${theme.brandTitle}</p>
${body}
<footer class="ds-tm" role="contentinfo">
  <p class="ds-tm-notice">${model.TRADEMARK_NOTICE}</p>
  <p class="ds-tm-copy">&copy; 2026 CRHS Enterprises, LLC.</p>
</footer>
</body></html>`;

  return html.replace(/\{\{NONCE\}\}/g, nonce);
}

module.exports = { renderState };
