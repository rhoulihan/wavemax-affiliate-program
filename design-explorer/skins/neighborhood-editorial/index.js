'use strict';
/**
 * Direction 2 — "Neighborhood Editorial"
 * A warm, photography-led magazine skin for WaveMAX Austin (rundberglaundry.com),
 * told as "The Rundberg Edition": newspaper masthead, art-directed photo hero,
 * a feature story with drop caps + pull-quote, numbered "columns", a recipe-style
 * guide, "letters from the block" reviews, and a "neighborhood desk" concierge
 * (visual STUB — never wired). The deliberate opposite of Direction 1's dark
 * mono/grotesk bento "OS".
 *
 * Typography: Fraunces (characterful display serif) + Mulish (humanist sans).
 * One skin renders BOTH intensities by consuming the theme vars the core injects
 * into :root (light = warm terracotta lead; heavy = WaveMAX teal/navy leads).
 *
 * CSP-clean by construction: ZERO <script> tags, ZERO inline event handlers.
 * Interactivity is CSS-only (:target mobile nav drawer, scroll-snap photo strip,
 * :focus-within desk input). The white WaveMAX wordmark always sits on a dark
 * brand chip so it stays legible on cream/paper backgrounds.
 */
const { css } = require('./styles');
const C = require('./components');
const { buildPage } = require('./pages');

module.exports = {
  id: 'neighborhood-editorial',
  css,
  /**
   * @param {string} page      home|self-serve|wash-dry-fold|commercial|about|contact
   * @param {object} content   model.content[lang]
   * @param {string} intensity 'heavy' | 'light'
   * @param {string} lang      'en' | 'es' | 'pt' | 'de'
   * @returns {string} body HTML (core wraps doctype/head + §12.2 footer)
   */
  renderPage(page, content, intensity, lang) {
    const head = C.masthead(page, intensity, lang);
    const main = `<main id="main">${buildPage(page, content, intensity, lang)}</main>`;
    const foot = C.colophon(intensity, lang);
    return `${head}\n${main}\n${foot}`;
  },
};
