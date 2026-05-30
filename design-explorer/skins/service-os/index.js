'use strict';
/**
 * Direction 1 — "Service OS"
 * A utility-first, agentic, bento-grid skin for WaveMAX Austin (rundberglaundry.com).
 * The site behaves like a product: bento hero of live-feeling tiles, an AI concierge
 * launcher (visual STUB — never wired), open-now status + turnaround chips, and a
 * CSS-only sticky mobile action bar. One skin renders BOTH intensities by consuming
 * the theme vars the core injects into :root.
 *
 * CSP-clean by construction: ZERO <script> tags, ZERO inline event handlers.
 * All interactivity is CSS-only (:checked tabs, :hover, sticky, scroll, :focus-within).
 */
const { css } = require('./styles');
const C = require('./components');
const { buildPage } = require('./pages');

module.exports = {
  id: 'service-os',
  css,
  /**
   * @param {string} page      one of home|self-serve|wash-dry-fold|commercial|about|contact
   * @param {object} content   model.content[lang] (has .pages, etc.)
   * @param {string} intensity 'heavy' | 'light'
   * @param {string} lang      'en' | 'es'
   * @returns {string} body HTML (core wraps it with doctype/head + §12.2 footer)
   */
  renderPage(page, content, intensity, lang) {
    const top = C.topbar(page, intensity, lang);
    const main = `<main id="main">${buildPage(page, content, intensity, lang)}</main>`;
    const foot = C.footer(intensity, lang);
    const dock = C.dock(lang);
    return `${top}\n${main}\n${foot}\n${dock}`;
  },
};
