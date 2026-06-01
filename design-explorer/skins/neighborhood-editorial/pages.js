'use strict';
const C = require('./components');
const { renderSection } = require('./sections');
const { esc, fill, I, NAP, t } = C;

/* Italicize the closing clause of an H1 (after the last em-dash or comma) for
   editorial emphasis in the lead/accent color. Falls back to last word. */
function emphasize(title) {
  const safe = fill(title); // already escaped
  let m = safe.match(/^(.*?[—,]\s*)(.+)$/); // split on em-dash or comma
  if (m) return `${m[1]}<em>${m[2]}</em>`;
  m = safe.match(/^(.*\s)(\S+)$/);
  return m ? `${m[1]}<em>${m[2]}</em>` : `<em>${safe}</em>`;
}

function byline(lang) {
  const L = t(lang);
  return `<p class="ne-byline">
    <span class="ne-tick">${I.globe}</span>${esc(L.bilingual)}
    <span class="ne-tick">${I.bolt}</span>${esc(L.turnaround)}
    <span class="ne-tick">${I.card}</span>${esc(L.cardsOnly)}
  </p>`;
}

function heroCtas(lang, primaryLabel) {
  const L = t(lang);
  return `<div class="ne-cta-row">
    <a class="ne-btn ne-btn-primary" href="${C.tel}">${I.phone}${esc(L.call)} ${esc(NAP.phone)}</a>
    <a class="ne-btn ne-btn-ghost" href="${esc(NAP.mapsDir)}" target="_blank" rel="noopener">${I.pin}${esc(primaryLabel || L.directions)}</a>
  </div>`;
}

/* ---- HOME feature hero: headline column + big art-directed storefront plate ---- */
function homeHero(content, intensity, lang) {
  const L = t(lang);
  const hero = content.pages.home.hero;
  const cta = content.pages.home.cta || {};
  const badge = hero.badge ? esc(hero.badge) : esc(L.ratingLabel);
  return `<section class="ne-hero" aria-labelledby="ne-h1"><div class="ne-wrap">
    <div class="ne-hero-grid ne-hero-grid--home">
      <div class="ne-hero-head">
        <p class="ne-eyebrow">${esc(L.feature)} · ${badge}</p>
        <h1 class="ne-h1" id="ne-h1">${emphasize(hero.title)}</h1>
      </div>
      <div class="ne-plate">
        ${C.figure(C.PHOTOS.storefront, L.capStorefront,
          `<b>${esc(NAP.street)}</b> — ${esc(L.capStorefront)}`, L.photoNote, 'ne-figure--wide')}
      </div>
      <div class="ne-hero-body">
        <p class="ne-lede ne-drop">${fill(hero.sub)}</p>
      </div>
      <div class="ne-hero-meta">
        ${byline(lang)}
        ${heroCtas(lang, cta.primaryLabel)}
      </div>
    </div>
  </div></section>`;
}

/* ---- Pull quote drawn editorially from the first review (home) ----
   Two-column band: the quote (vertically centered) on the LEFT, a shop
   signage photo on the RIGHT. Quote text always comes from reviews[0]. */
function pullQuote(content, lang) {
  const L = t(lang);
  const reviews = (content.pages.home.sections.find(s => s.kind === 'reviews') || {}).items || [];
  if (!reviews.length) return '';
  const r = reviews[0];
  const photo = C.figure(
    C.PHOTOS.signage, L.altSignage,
    `<b>${esc(L.capSignage)}</b>`, L.photoNote, 'ne-figure--wide'
  );
  return `<div class="ne-pull"><div class="ne-pull-band">
    <div class="ne-pull-in">
      <blockquote>${fill(r.quote)}</blockquote>
      <cite><b>${esc(r.name)}</b> · ${esc(r.meta || L.pullByline)}</cite>
    </div>
    <div class="ne-pull-plate">${photo}</div>
  </div></div>`;
}

/* ---- Banner hero (non-home pages): editorial headline + paired photo ---- */
const PAGE_PHOTO = {
  'self-serve': { src: () => C.PHOTOS.interior, klass: 'ne-figure--wide', cap: L => L.capInterior },
  'wash-dry-fold': { src: () => C.PHOTOS.floor, klass: 'ne-figure--wide', cap: L => L.capInterior },
  commercial: { src: () => C.PHOTOS.floor, klass: 'ne-figure--wide', cap: L => L.capInterior },
  about: { src: () => C.PHOTOS.door, klass: 'ne-figure--tall', cap: L => L.capDoor },
  contact: { src: () => C.PHOTOS.storefront, klass: 'ne-figure--wide', cap: L => L.capStorefront },
};

function bannerHero(content, page, intensity, lang) {
  const L = t(lang);
  const hero = content.pages[page].hero;
  const cta = content.pages[page].cta || {};
  const eyebrow = hero.tagline ? esc(hero.tagline) : (hero.badge ? esc(hero.badge) : esc(L.dispatch));
  const ph = PAGE_PHOTO[page];
  const photo = ph
    ? `<div class="ne-plate">${C.figure(ph.src(), ph.cap(L), `<b>${esc(ph.cap(L))}</b>`, L.photoNote, ph.klass)}</div>`
    : '';
  return `<section class="ne-hero" aria-labelledby="ne-h1"><div class="ne-wrap">
    <div class="ne-hero-grid">
      <div class="ne-hero-copy">
        <p class="ne-eyebrow">${eyebrow}</p>
        <h1 class="ne-h1" id="ne-h1">${emphasize(hero.title)}</h1>
        <p class="ne-lede">${fill(hero.sub)}</p>
        ${byline(lang)}
        ${heroCtas(lang, cta.primaryLabel)}
      </div>
      ${photo}
    </div>
  </div></section>`;
}

/* ---- Contact page (NAP + form, then a big satellite map iframe) ---- */
function contactPage(content, intensity, lang) {
  const page = content.pages.contact;
  const info = page.sections.find(s => s.kind === 'contact-info');
  const form = page.sections.find(s => s.kind === 'contact-form');
  const infoHtml = info ? renderSection(info, content, intensity, lang) : '';
  const formHtml = form ? renderSection(form, content, intensity, lang) : '';
  return `${bannerHero(content, 'contact', intensity, lang)}
    <section class="ne-section"><div class="ne-wrap">
      <div class="ne-contact">
        <div>${infoHtml}${formHtml}</div>
        <div class="ne-map">
          <iframe title="WaveMAX Austin satellite map" src="${esc(NAP.mapsEmbed)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
        </div>
      </div>
    </div></section>`;
}

/* ---- WDF-only: pair the three "how it works" steps with the front-door photo.
   Two columns — steps on the LEFT, door photo (vertically centered) on the
   RIGHT. Reuses the generic steps renderer for the step content; only wraps it.
   Page-specific to wash-dry-fold (home's steps section is untouched). ---- */
function wdfStepsWithDoor(s, content, intensity, lang) {
  const L = t(lang);
  const steps = renderSection(s, content, intensity, lang);
  const photo = C.figure(
    C.PHOTOS.door, L.altWdfDoor,
    `<b>${esc(L.capWdfDoor)}</b>`, L.photoNote, 'ne-figure--tall'
  );
  return `<div class="ne-wdf-steps">
    <div class="ne-wdf-steps-main">${steps}</div>
    <div class="ne-wdf-steps-plate">${photo}</div>
  </div>`;
}

/* ===== top-level page composition ===== */
function buildPage(page, content, intensity, lang) {
  const data = content.pages[page];
  const L = t(lang);
  const parts = [];

  if (page === 'home') {
    parts.push(homeHero(content, intensity, lang));
    // stats ledger sits right under the feature hero
    const stats = (data.sections || []).find(s => s.kind === 'stats');
    if (stats) parts.push(renderSection(stats, content, intensity, lang));
    parts.push(pullQuote(content, lang));
    parts.push(C.divider(L.inThisIssue));
    for (const s of (data.sections || [])) {
      if (s.kind === 'stats') continue;
      // 'tabs' is a home-only navigational repeat of the service pages — the
      // story/columns/steps/reviews already cover services editorially, so skip.
      if (s.kind === 'tabs') continue;
      parts.push(renderSection(s, content, intensity, lang));
    }
    parts.push(C.desk(lang));
    parts.push(C.closer(data.cta, lang, page));
  } else if (page === 'contact') {
    parts.push(contactPage(content, intensity, lang));
    parts.push(C.desk(lang));
    parts.push(C.closer(data.cta, lang, page));
  } else if (page === 'about') {
    parts.push(bannerHero(content, page, intensity, lang));
    for (const s of (data.sections || [])) parts.push(renderSection(s, content, intensity, lang));
    parts.push(C.desk(lang));
    parts.push(C.closer(data.cta, lang, page));
  } else {
    parts.push(bannerHero(content, page, intensity, lang));
    for (const s of (data.sections || [])) {
      // WDF only: render the steps paired with the front-door photo (two-column).
      if (page === 'wash-dry-fold' && s.kind === 'steps') {
        parts.push(wdfStepsWithDoor(s, content, intensity, lang));
      } else {
        parts.push(renderSection(s, content, intensity, lang));
      }
    }
    parts.push(C.desk(lang));
    parts.push(C.closer(data.cta, lang, page));
  }
  return parts.join('\n');
}

module.exports = { buildPage };
