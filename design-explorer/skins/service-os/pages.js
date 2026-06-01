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
    <a class="so-btn so-btn-primary" href="${C.tel}">${I.phone}${esc(L.call)} ${esc(NAP.phone)}</a>
    <a class="so-btn" href="${esc(NAP.mapsDir)}" target="_blank" rel="noopener">${I.pin}${esc(primaryLabel || L.directions)}</a>
  </div>`;
}

/* ---- BENTO hero (home only) ----
   A full-width 12-col bento that fills both sides at desktop width. The
   headline/sub/actions live in a tall LEAD tile (left), and the right side
   is packed with service tiles, a live-status readout, a machines/stats
   tile, a wash-dry-fold pricing chip, and a map — no empty region. All
   tiles draw from the content model + NAP. CSS-only; no scripts. */
function bentoHero(content, intensity, lang) {
  const L = t(lang);
  const hero = content.pages.home.hero;
  const badge = hero.badge ? esc(hero.badge) : esc(L.rating);

  // A service tile — pulls each service page's hero title from the model.
  function serviceTile(slug, ico, klass) {
    const p = content.pages[slug];
    const h = p && p.hero ? p.hero : { title: slug, sub: '' };
    const tag = L.nav[{ 'self-serve': 'selfServe', 'wash-dry-fold': 'wdf', commercial: 'commercial' }[slug]] || slug;
    const open = slug === 'wash-dry-fold' ? L.tileDrop : L.tileOpen;
    return `<a class="so-tile ${klass || ''}" href="#" aria-label="${fill(h.title)}">
      <div class="so-tile-head"><span class="so-tile-tag">${esc(tag)}</span>
        <span class="so-tile-ico">${ico}</span></div>
      <h3>${fill(h.title)}</h3>
      <span class="so-tile-open">${esc(open)} ${I.arrow}</span></a>`;
  }

  // LEAD tile — carries the H1, sub, and primary actions (self-serve + WDF).
  const leadTile = `<div class="so-tile so-tile--lead so-tile--hero">
    <div class="so-tile-head"><span class="so-tile-tag">${badge}</span>
      <span class="so-tile-ico">${I.wash}</span></div>
    <h1 class="so-h1" id="so-h1">${leadLastWord(hero.title)}</h1>
    <p class="so-hero-sub">${fill(hero.sub)}</p>
    ${heroChips(lang)}
    ${heroActions(lang, content.pages.home.cta && content.pages.home.cta.primaryLabel)}
  </div>`;

  // Live-status readout.
  const statusTile = `<div class="so-tile so-tile--status">
    <div class="so-tile-head"><span class="so-tile-tag">${esc(L.bentoStatus)}</span><span class="so-dot"></span></div>
    <div class="so-status-rows">
      <div class="so-status-row"><span>${esc(L.openNow)}</span><b>${esc(L.until)}</b></div>
      <div class="so-status-row"><span>WDF</span><b>$1.20/lb</b></div>
      <div class="so-status-row"><span>${esc(L.turnaround)}</span><b>24 h</b></div>
    </div>
    <div class="so-status-bar" aria-hidden="true"><i></i></div></div>`;

  // Machines / capacity stat tile.
  const machinesTile = `<div class="so-tile so-tile--stat">
    <div class="so-tile-head"><span class="so-tile-tag">${esc(L.machinesTag)}</span>
      <span class="so-tile-ico">${I.bolt}</span></div>
    <div class="so-stat-pair"><b>42</b><span>+</span><b>42</b></div>
    <h3>${esc(L.machinesTitle)}</h3>
    <p>${esc(L.machinesSub)}</p></div>`;

  // Wash-dry-fold pricing chip tile.
  const pricingTile = `<a class="so-tile so-tile--price" href="${C.tel}" aria-label="${esc(L.bentoWdf)}">
    <div class="so-tile-head"><span class="so-tile-tag">${esc(L.pricingTag)}</span>
      <span class="so-tile-ico">${I.drop}</span></div>
    <div class="so-price-chip">$1.20<small>/lb</small></div>
    <p>${esc(L.turnaround)} · ${esc(L.pricingNote)}</p>
    <span class="so-tile-open">${esc(L.tileDrop)} ${I.arrow}</span></a>`;

  // Find-us map tile.
  const mapTile = `<div class="so-tile so-tile--map">
    <iframe title="WaveMAX Austin map" src="${esc(NAP.mapsEmbed)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
    <span class="so-map-cap">${I.pin} ${esc(NAP.street)}</span></div>`;

  return `<section class="so-hero so-hero--bento" aria-labelledby="so-h1">
    <div class="so-wrap">
      <div class="so-bento">
        ${leadTile}
        ${serviceTile('self-serve', I.wash)}
        ${statusTile}
        ${serviceTile('wash-dry-fold', I.drop)}
        ${pricingTile}
        ${machinesTile}
        ${serviceTile('commercial', I.box)}
        ${mapTile}
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
