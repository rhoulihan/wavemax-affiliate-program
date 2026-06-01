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
  return `<section class="ap-band ap-band--hero" aria-labelledby="ap-h1">
    <div class="ap-grain" aria-hidden="true"></div>
    <div class="ap-wrap ap-hero-wrap">
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
    </div>
  </section>`;
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
