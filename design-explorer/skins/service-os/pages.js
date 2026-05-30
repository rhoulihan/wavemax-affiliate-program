'use strict';
const C = require('./components');
const { renderSection } = require('./sections');
const { esc, fill, I, NAP, t } = C;

/* highlight the last word of an H1 in the lead color for OS-product punch */
function leadLastWord(title) {
  const safe = fill(title); // already escaped
  const m = safe.match(/^(.*\s)(\S+)$/);
  if (!m) return `<span class="so-lead-word">${safe}</span>`;
  return `${m[1]}<span class="so-lead-word">${m[2]}</span>`;
}

function heroChips(lang) {
  const L = t(lang);
  return `<div class="so-hero-chips">
    <span class="so-chip">${I.clock}${esc(L.openNow)} · ${esc(L.until)}</span>
    <span class="so-chip">${I.bolt}${esc(L.turnaround)}</span>
    <span class="so-chip">${I.card}${esc(L.cardsOnly)}</span>
    <span class="so-chip">${I.globe}${esc(L.bilingual)}</span>
  </div>`;
}

function heroActions(lang, primaryLabel) {
  const L = t(lang);
  return `<div class="so-actions">
    <a class="so-btn so-btn-primary" href="${C.tel}">${I.cal}${esc(primaryLabel || L.book)}</a>
    <a class="so-btn" href="${esc(NAP.mapsDir)}" target="_blank" rel="noopener">${I.pin}${esc(L.directions)}</a>
    <a class="so-btn" href="${C.tel}">${I.phone}${esc(L.call)} ${esc(NAP.phone)}</a>
  </div>`;
}

/* ---- BENTO hero (home only) ---- */
function bentoHero(content, intensity, lang) {
  const L = t(lang);
  const hero = content.pages.home.hero;
  const badge = hero.badge ? esc(hero.badge) : esc(L.rating);

  function tile(slug, ico, klass) {
    const p = content.pages[slug];
    const h = p && p.hero ? p.hero : { title: slug, sub: '' };
    const tag = L.nav[{ 'self-serve': 'selfServe', 'wash-dry-fold': 'wdf', commercial: 'commercial' }[slug]] || slug;
    return `<a class="so-tile ${klass || ''}" href="#" aria-label="${fill(h.title)}">
      <div class="so-tile-head"><span class="so-tile-tag">${esc(tag)}</span>
        <span class="so-tile-ico">${ico}</span></div>
      <h3>${fill(h.title)}</h3>
      <span class="so-tile-open">${esc(L.tileOpen)} ${I.arrow}</span></a>`;
  }

  const statusTile = `<div class="so-tile so-tile--status">
    <div class="so-tile-head"><span class="so-tile-tag">${esc(L.bentoStatus)}</span><span class="so-dot"></span></div>
    <div class="so-status-rows">
      <div class="so-status-row"><span>${esc(L.openNow)}</span><b>${esc(L.until)}</b></div>
      <div class="so-status-row"><span>WDF</span><b>$1.20/lb</b></div>
      <div class="so-status-row"><span>${esc(L.turnaround)}</span><b>24 h</b></div>
    </div>
    <div class="so-status-bar" aria-hidden="true"><i></i></div></div>`;

  const mapTile = `<div class="so-tile so-tile--map">
    <iframe title="WaveMAX Austin map" src="${esc(NAP.mapsEmbed)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
    <span class="so-map-cap">${I.pin} 825 E Rundberg Ln</span></div>`;

  const bookTile = `<a class="so-tile so-tile--lead" href="${C.tel}" aria-label="${esc(L.bentoBook)}">
    <div class="so-tile-head"><span class="so-tile-tag">${esc(L.bentoBook)}</span><span class="so-tile-ico">${I.cal}</span></div>
    <h3>${esc(L.book)}</h3>
    <p>${esc(NAP.phone)} · ${esc(NAP.hours)}</p>
    <span class="so-tile-open">${esc(L.call)} ${I.arrow}</span></a>`;

  return `<section class="so-hero" aria-labelledby="so-h1">
    <div class="so-wrap">
      <div class="so-hero-head">
        <span class="so-eyebrow">${badge}</span>
        <h1 class="so-h1" id="so-h1">${leadLastWord(hero.title)}</h1>
        <p class="so-hero-sub">${fill(hero.sub)}</p>
        ${heroChips(lang)}
        ${heroActions(lang)}
      </div>
      <div class="so-bento">
        ${tile('self-serve', I.wash, 'so-tile--wide')}
        ${statusTile}
        ${tile('wash-dry-fold', I.drop)}
        ${tile('commercial', I.box)}
        ${mapTile}
        ${bookTile}
      </div>
    </div>
  </section>`;
}

/* ---- Banner hero (non-home pages) ---- */
function bannerHero(content, page, intensity, lang) {
  const hero = content.pages[page].hero;
  const eyebrow = hero.tagline ? esc(hero.tagline) : (hero.badge ? esc(hero.badge) : esc(t(lang).module));
  return `<section class="so-hero" aria-labelledby="so-h1"><div class="so-wrap">
    <div class="so-hero-head">
      <span class="so-eyebrow">${eyebrow}</span>
      <h1 class="so-h1" id="so-h1">${leadLastWord(hero.title)}</h1>
      <p class="so-hero-sub">${fill(hero.sub)}</p>
      ${heroChips(lang)}
      ${heroActions(lang, hero.cta && hero.cta.label)}
    </div>
  </div></section>`;
}

/* ---- Contact page (NAP + map iframe, side by side) ---- */
function contactPage(content, intensity, lang) {
  const page = content.pages.contact;
  const info = page.sections.find(s => s.kind === 'contact-info');
  const form = page.sections.find(s => s.kind === 'contact-form');
  const L = t(lang);
  const infoHtml = info ? renderSection(info, content, intensity, lang) : '';
  const formHtml = form ? renderSection(form, content, intensity, lang) : '';

  return `${bannerHero(content, 'contact', intensity, lang)}
  <section class="so-section"><div class="so-wrap">
    <div class="so-contact">
      <div>${infoHtml}${formHtml}</div>
      <div class="so-map-frame">
        <iframe title="WaveMAX Austin satellite map" src="${esc(NAP.mapsEmbed)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
      </div>
    </div>
  </div></section>`;
}

/* ===== top-level page composition ===== */
function buildPage(page, content, intensity, lang) {
  const data = content.pages[page];
  const parts = [];

  if (page === 'home') {
    parts.push(bentoHero(content, intensity, lang));
    parts.push(`<div class="so-wrap">${C.concierge(lang)}</div>`);
    for (const s of (data.sections || [])) parts.push(renderSection(s, content, intensity, lang));
    parts.push(C.ctaBanner(data.cta, lang));
  } else if (page === 'contact') {
    parts.push(contactPage(content, intensity, lang));
    parts.push(`<div class="so-wrap">${C.concierge(lang)}</div>`);
    parts.push(C.ctaBanner(data.cta, lang));
  } else {
    parts.push(bannerHero(content, page, intensity, lang));
    for (const s of (data.sections || [])) parts.push(renderSection(s, content, intensity, lang));
    parts.push(`<div class="so-wrap">${C.concierge(lang)}</div>`);
    parts.push(C.ctaBanner(data.cta, lang));
  }
  return parts.join('\n');
}

module.exports = { buildPage };
