'use strict';
/**
 * Direction 3 — "RUNDBERG PRESS" page composition.
 *
 * Every page is ONE poster: a stack of full-bleed BANDS separated by the brand
 * WAVE SEAM, laid out on a coarse 2–4 fat-poster-column grid and CSS scroll-snap
 * so scrolling feels like flipping stapled bills.
 *
 * HOME  = marquee (giant Anton wordline + the per-language PAINTED hero word) ->
 *         stats stamps -> pasted-poster service show-bills -> torn-ticket
 *         how-it-works -> price ledger -> quality posters -> letters/reviews ->
 *         UV "headliner" band -> hours+map band -> front desk -> coupon CTA.
 * INNER = same skeleton zoomed: a hero STAMP marquee, the model's bands, then
 *         the shared hours+map band, front desk, and coupon CTA.
 * CONTACT= NAP card + map iframe side by side, plus the shared chrome.
 *
 * Renders all copy from the shared content model. CSP-clean throughout.
 */
const C = require('./components');
const { renderSection } = require('./sections');
const { esc, fill, I, NAP, tel, t, waveSeam, seal } = C;

/* ---------- HERO: the painted-word marquee ----------
   The H1 is the page hero title; we PROMOTE the per-language painted WORD
   (WASH / LAVA / LAVE / WÄSCHE) as the giant overprinted display element and
   keep the descriptive title as the accessible, AA-contrast subhead. Because
   the H1 must be the page's single accessible heading, the painted word IS the
   h1 text and the model title rides as the lede below it. */
function heroMarquee(content, page, intensity, lang) {
  const L = t(lang);
  const hero = content.pages[page].hero;
  const tagline = hero.tagline ? esc(hero.tagline) : (hero.badge ? esc(hero.badge) : esc(L.heroLede));
  const cta = content.pages[page].cta || {};
  // The screenprint duotone "relief" fills the empty right column on every page
  // that has a relief assignment (home = storefront; inner heroes = interiors /
  // the front door). Pages with no entry (e.g. about) stay single-column.
  const reliefHtml = pageRelief(page, lang);
  const hasRelief = reliefHtml !== '';
  const main = `<div class="ap-hero-main">
      <p class="ap-hero-kicker">${esc(L.heroKicker)} <span class="ap-hero-rule" aria-hidden="true"></span> ${tagline}</p>

      <h1 class="ap-hero-word" id="ap-h1" data-word="${esc(L.heroWord)}">
        <span class="ap-sr">${fill(hero.title)} — </span>${esc(L.heroWord)}
      </h1>

      <p class="ap-hero-title" aria-hidden="true">${fill(hero.title)}</p>
      <p class="ap-hero-sub">${fill(hero.sub)}</p>

      <div class="ap-actions ap-hero-actions">
        <a class="ap-btn ap-btn--hot" href="${tel}">${I.phone}<span>${esc(L.call)} ${esc(NAP.phone)}</span></a>
        <a class="ap-btn" href="${esc(NAP.mapsDir)}" target="_blank" rel="noopener">${I.pin}<span>${esc(cta.primaryLabel || L.directions)}</span></a>
      </div>

      ${C.sealStrip(lang)}
      ${langStampRow(lang)}
    </div>`;
  return `<section class="ap-band ap-band--hero" aria-labelledby="ap-h1">
    <div class="ap-grain" aria-hidden="true"></div>
    <div class="ap-wrap ap-hero-wrap${hasRelief ? ' ap-hero-wrap--split' : ''}">
      ${main}${reliefHtml}
    </div>
  </section>`;
}

/* ---------- per-page RELIEF assignments ----------
   Each hero relief is the SAME duotone+halftone screenprint plate; only the photo
   + its caption change. HOME shows the storefront; the inner heroes show varied
   store INTERIORS; CONTACT shows the front DOOR. Pages absent from this map (e.g.
   ABOUT) keep the single-column hero with no relief.

   Only two visually distinct interior compositions exist in the asset set
   (interior-1 = the fold/seating side; interior-2/5/6 = the long machine-aisle),
   so COMMERCIAL reuses the machine-hall composition via the distinct interior-5
   file — every page still references its own photo, but self-serve and commercial
   share the aisle scene. The duotone/halftone treatment makes them read as
   different plates regardless. */
const PAGE_RELIEF = {
  // home keeps the bilingual storefront facade (unchanged)
  'home':          { src: '/assets/images/locations/austin-tx/hero-1.webp' },
  // inner heroes — distinct interiors
  'self-serve':    { src: '/assets/images/locations/austin-tx/interior-2.webp' }, // the long self-serve machine aisle
  'wash-dry-fold': { src: '/assets/images/locations/austin-tx/interior-1.webp' }, // the fold tables + washer bank
  'commercial':    { src: '/assets/images/locations/austin-tx/interior-5.webp' }, // the full machine hall (capacity)
  // contact — the front door on Rundberg Ln
  'contact':       { src: '/assets/images/locations/austin-tx/interior-3.webp' },
};

/* ---------- the duotone+halftone screenprint photo RELIEF (parametrized) ----------
   A real store photo treated CSS-only to read as a 2-color riso plate that belongs
   in the poster (NOT a pasted stock photo). The duotone is built by stacking blend
   modes (see the .ap-relief-* rules in styles.js — shared by ALL reliefs):
     · the plate container paints the dominant ink (--ap-relief-a) as its ground;
     · the <img> sits grayscale+high-contrast, blended so the photo's tonal values
       modulate that ink;
     · ::after flushes the accent plate (--ap-relief-b) into the highlights, offset
       for the misregistration hit;
     · the screen overlays the halftone dot pattern + grain via multiply.
   Tape corners + a thin rule + a rotated stamp/caption seal frame it in the press
   vernacular. Inks recolor per intensity purely through the --ap-relief-* tokens.

   `alt` = the accessible image description; `cap` = the small corner caption seal.
   Home uses the storefront alt + address seal; inner pages use their per-page
   { alt, cap } from i18n. CSS is reused for every page — no per-page CSS. */
function relief(src, alt, cap, lang) {
  const L = t(lang);
  return `<figure class="ap-relief" role="group" aria-label="${esc(alt)}">
    <span class="ap-tape ap-tape--tl" aria-hidden="true"></span>
    <span class="ap-tape ap-tape--br" aria-hidden="true"></span>
    <div class="ap-relief-plate">
      <img class="ap-relief-img" src="${esc(src)}"
        alt="${esc(alt)}" width="1200" height="800" loading="lazy" decoding="async">
      <span class="ap-relief-screen" aria-hidden="true"></span>
    </div>
    <figcaption class="ap-relief-cap" aria-hidden="true">
      <span class="ap-relief-stamp">${esc(L.reliefStamp)}</span>
      <span class="ap-relief-addr">${esc(cap)}</span>
    </figcaption>
  </figure>`;
}

/* Resolve the relief for the current page (or '' if the page has no assignment). */
function pageRelief(page, lang) {
  const cfg = PAGE_RELIEF[page];
  if (!cfg) return '';
  const L = t(lang);
  if (page === 'home') {
    // storefront keeps its dedicated facade alt + street-address seal
    return relief(cfg.src, L.reliefAlt, L.reliefCap, lang);
  }
  const r = (L.relief && L.relief[page]) || {};
  return relief(cfg.src, r.alt || L.reliefAlt, r.cap || L.reliefCap, lang);
}

/* display-only row of language stamps (the real switch is the explorer shell) */
function langStampRow(lang) {
  const L = t(lang);
  const order = ['en', 'es', 'pt', 'de'];
  const codes = { en: 'EN', es: 'ES', pt: 'PT', de: 'DE' };
  const stamps = order.map(code =>
    `<span class="ap-langstamp${code === lang ? ' is-active' : ''}">${codes[code]}</span>`
  ).join('');
  return `<p class="ap-langrow" aria-hidden="true"><span class="ap-langrow-l">${esc(L.langRow)}</span>${stamps}</p>`;
}

/* ---------- UV "headliner" band (the store's hygiene differentiator) ---------- */
function uvBand(lang) {
  const L = t(lang);
  return `<section class="ap-band ap-band--uv" aria-labelledby="ap-uv-t">
    <div class="ap-grain" aria-hidden="true"></div>
    <div class="ap-wrap ap-uv-wrap">
      <span class="ap-kicker ap-kicker--invert">${esc(L.uvKicker)}</span>
      <h2 class="ap-uv-head" id="ap-uv-t" data-text="${esc(L.uvHeadline)}">${esc(L.uvHeadline)}</h2>
      <div class="ap-uv-foot">
        ${seal(L.uvSeal, 'round', 'hot', -6)}
        <p class="ap-uv-body">${esc(L.uvBody)}</p>
      </div>
    </div>
  </section>`;
}

/* ---------- hours + Google-Maps (satellite) band ---------- */
function hoursBand(lang) {
  const L = t(lang);
  return `<section class="ap-band ap-band--hours" aria-labelledby="ap-hours-t">
    <div class="ap-wrap ap-hours-wrap">
      <div class="ap-hours-info">
        <span class="ap-kicker">${esc(L.hoursLabel)}</span>
        <h2 class="ap-h2" id="ap-hours-t" data-text="${esc(L.hoursTitle)}">${esc(L.hoursTitle)}</h2>
        <ul class="ap-nap">
          <li><span class="ap-nap-l">${esc(L.hoursOpen)}</span><span class="ap-nap-v">${esc(L.hoursVal)}</span></li>
          <li><span class="ap-nap-l">${esc(L.addrLabel)}</span><span class="ap-nap-v"><a href="${esc(NAP.mapsDir)}" target="_blank" rel="noopener">${esc(NAP.street)}, ${esc(NAP.city)} ${esc(NAP.state)} ${esc(NAP.zip)}</a></span></li>
          <li><span class="ap-nap-l">${esc(L.phoneLabel)}</span><span class="ap-nap-v"><a href="${tel}">${esc(NAP.phone)}</a></span></li>
        </ul>
        <p class="ap-hours-note">${esc(L.mapNote)}</p>
        <div class="ap-actions">
          <a class="ap-btn ap-btn--hot" href="${tel}">${I.phone}<span>${esc(L.call)}</span></a>
          <a class="ap-btn" href="${esc(NAP.mapsDir)}" target="_blank" rel="noopener">${I.pin}<span>${esc(L.directions)}</span></a>
        </div>
      </div>
      <div class="ap-map">
        <iframe title="WaveMAX Austin satellite map — ${esc(NAP.street)}" src="${esc(NAP.mapsEmbed)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
      </div>
    </div>
  </section>`;
}

/* ---------- contact page (NAP card + map iframe) ---------- */
function contactBands(content, intensity, lang) {
  const page = content.pages.contact;
  const info = page.sections.find(s => s.kind === 'contact-info');
  const form = page.sections.find(s => s.kind === 'contact-form');
  const infoHtml = info ? renderSection(info, content, intensity, lang) : '';
  const formHtml = form ? renderSection(form, content, intensity, lang) : '';
  return `<section class="ap-band ap-band--contact"><div class="ap-wrap">
    <div class="ap-contact">
      <div class="ap-contact-col">${infoHtml}${formHtml}</div>
      <div class="ap-map ap-map--tall">
        <iframe title="WaveMAX Austin satellite map — ${esc(NAP.street)}" src="${esc(NAP.mapsEmbed)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
      </div>
    </div>
  </div></section>`;
}

/* glue bands together with the wave seam between each */
function stack(bands) {
  const parts = [];
  bands.filter(Boolean).forEach((b, i) => {
    if (i > 0) parts.push(waveSeam(i % 2 === 0));
    parts.push(b);
  });
  return parts.join('\n');
}

/* ===== top-level page composition ===== */
function buildPage(page, content, intensity, lang) {
  const data = content.pages[page];

  if (page === 'home') {
    const bands = [heroMarquee(content, 'home', intensity, lang)];
    for (const s of (data.sections || [])) bands.push(renderSection(s, content, intensity, lang));
    bands.push(uvBand(lang));
    bands.push(hoursBand(lang));
    bands.push(C.concierge(lang));
    bands.push(C.ctaBanner(data.cta, lang));
    return stack(bands);
  }

  if (page === 'contact') {
    const bands = [
      heroMarquee(content, 'contact', intensity, lang),
      contactBands(content, intensity, lang),
      C.concierge(lang),
      C.ctaBanner(data.cta, lang),
    ];
    return stack(bands);
  }

  // inner service / about pages: same skeleton zoomed
  const bands = [heroMarquee(content, page, intensity, lang)];
  for (const s of (data.sections || [])) bands.push(renderSection(s, content, intensity, lang));
  // the wash-dry-fold / self-serve pages get the shared UV + hours bands; about
  // skips the UV band to keep its story tone, but always shows hours + desk.
  if (page === 'self-serve' || page === 'wash-dry-fold' || page === 'commercial') bands.push(uvBand(lang));
  bands.push(hoursBand(lang));
  bands.push(C.concierge(lang));
  bands.push(C.ctaBanner(data.cta, lang));
  return stack(bands);
}

module.exports = { buildPage };
