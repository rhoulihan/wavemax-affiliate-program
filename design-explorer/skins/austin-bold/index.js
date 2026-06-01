'use strict';
/**
 * Direction 3 — "RUNDBERG PRESS" (austin-bold)
 *
 * A laundromat website built like a North-Austin gig-poster / risograph
 * screenprint broadside: stapled-flyer, taqueria-window-sign energy where every
 * "rubber stamp" is REAL useful info wearing a costume. Maximalist, handmade,
 * unmistakably made-by-this-block. ZERO stock photography — gradient/SVG-data-URI
 * texture + heavy poster type do all the work.
 *
 * Type: Anton (display poster grotesque) · Big Shoulders Display (stamp/seal
 * civic-signage voice) · Bricolage Grotesque (characterful kickers/subdisplay)
 * · Hanken Grotesk (warm humanist body, full Latin-ext for es/pt/de diacritics).
 *
 * Two intensities swap which "press plates" are loaded (see styles.js):
 *   heavy = brand LEADS — teal #0C93AD + deep navy #0A2A3A overprint on warm
 *           newsprint, hot red-orange #FF4D23 for stamps/CTAs.
 *   light = local LEADS — dusk magenta #C2306B + marigold #E8A33D on sun-bleached
 *           kraft; teal demotes to ONE accent hit (seals/rule/wordmark chip).
 *
 * Three grafts: (1) per-language PAINTED hero word (WASH/LAVA/LAVE/WÄSCHE),
 * (2) the WaveMAX wave as the structural SEAM between bands, (3) the white
 * wordmark on a SOLID TEAL CHIP as the legibility device (publisher's mark).
 *
 * CSP-clean by construction: ZERO <script>, ZERO inline on* handlers. All
 * interactivity is CSS-only (:checked show-bills, :focus-within desk, :hover,
 * scroll-snap bands, CSS animation). The Google-Maps iframe is CSP-allowed.
 */
const { css } = require('./styles');
const C = require('./components');
const { buildPage } = require('./pages');

module.exports = {
  id: 'austin-bold',
  css,
  /**
   * @param {string} page      home|self-serve|wash-dry-fold|commercial|about|contact
   * @param {object} content   model.content[lang]
   * @param {string} intensity 'heavy' | 'light'
   * @param {string} lang      'en' | 'es' | 'pt' | 'de'
   * @returns {string} body HTML (core wraps doctype/head + §12.2 footer)
   */
  renderPage(page, content, intensity, lang) {
    const mast = C.masthead(page, intensity, lang);
    const ticker = C.programTicker(lang);
    const main = `<main id="main" class="ap-poster-doc">${buildPage(page, content, intensity, lang)}</main>`;
    const foot = C.colophon(intensity, lang);
    return `${mast}\n${ticker}\n${main}\n${foot}`;
  },
};
