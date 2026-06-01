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
   A full-width 12-col bento. The headline/sub/actions live in a tall LEAD
   tile (left, 7×2). The right column carries two service tiles (self-serve +
   a single consolidated wash-dry-fold tile that folds the $1.20/lb pricing
   into the service). A bottom band runs an Omni UV-sanitization SHOWCASE
   tile, the commercial tile, and a find-us MAP tile so no region is empty.
   The headline KPI numbers live in a separate strip BELOW this section (see
   kpiStrip). All tiles draw from the content model + NAP. CSS-only; no
   scripts. */
function bentoHero(content, intensity, lang) {
  const L = t(lang);
  const hero = content.pages.home.hero;
  const badge = hero.badge ? esc(hero.badge) : esc(L.rating);

  // A plain service tile — pulls each service page's hero title from the model.
  function serviceTile(slug, ico, klass) {
    const p = content.pages[slug];
    const h = p && p.hero ? p.hero : { title: slug, sub: '' };
    const tag = L.nav[{ 'self-serve': 'selfServe', commercial: 'commercial' }[slug]] || slug;
    return `<a class="so-tile ${klass || ''}" href="#" aria-label="${fill(h.title)}">
      <div class="so-tile-head"><span class="so-tile-tag">${esc(tag)}</span>
        <span class="so-tile-ico">${ico}</span></div>
      <h3>${fill(h.title)}</h3>
      <span class="so-tile-open">${esc(L.tileOpen)} ${I.arrow}</span></a>`;
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

  // Dedicated SELF-SERVE tile — shows the real pricing range ($2.75–$10.50) and
  // washer load range (18–80 lb) alongside the page title from the content model.
  const ssPage = content.pages['self-serve'];
  const ssTitle = ssPage && ssPage.hero ? ssPage.hero.title : L.nav.selfServe;
  const selfServeTile = `<a class="so-tile so-tile--service" href="#" aria-label="${fill(ssTitle)}">
    <div class="so-tile-head"><span class="so-tile-tag">${esc(L.ssTag)}</span>
      <span class="so-tile-ico">${I.wash}</span></div>
    <h3>${fill(ssTitle)}</h3>
    <div class="so-wdf-price"><b>$2.75</b><small>–$10.50</small>
      <span class="so-wdf-meta">${esc(L.ssPerLoad)}</span></div>
    <p>${esc(L.ssLoads)}</p>
    <span class="so-tile-open">${esc(L.tileOpen)} ${I.arrow}</span></a>`;

  // Consolidated WASH-DRY-FOLD tile — service + $1.20/lb · 10-lb min · 24-hr
  // pricing facts together (was two adjacent tiles, now one).
  const wdfPage = content.pages['wash-dry-fold'];
  const wdfTitle = wdfPage && wdfPage.hero ? wdfPage.hero.title : L.bentoWdf;
  const wdfTile = `<a class="so-tile so-tile--wdf" href="${C.tel}" aria-label="${esc(L.bentoWdf)}">
    <div class="so-tile-head"><span class="so-tile-tag">${esc(L.pricingTag)}</span>
      <span class="so-tile-ico">${I.drop}</span></div>
    <h3>${fill(wdfTitle)}</h3>
    <div class="so-wdf-price"><b>$1.20</b><small>${esc(L.wdfPerLb)}</small>
      <span class="so-wdf-meta">${esc(L.wdfMin)} · ${esc(L.wdf24)}</span></div>
    <p>${esc(L.pricingNote)}</p>
    <span class="so-tile-open">${esc(L.tileDrop)} ${I.arrow}</span></a>`;

  // Omni UV-sanitization SHOWCASE tile — the store's hygiene differentiator.
  const uvTile = `<div class="so-tile so-tile--showcase">
    <div class="so-tile-head"><span class="so-tile-tag">${esc(L.uvTag)}</span>
      <span class="so-tile-ico">${I.shield}</span></div>
    <h3>${esc(L.uvTitle)}</h3>
    <p>${esc(L.uvSub)}</p>
    <span class="so-showcase-badge">${I.shield}${esc(L.uvBadge)}</span></div>`;

  // Find-us MAP tile — iframe only; the Google embed provides its own open-in-maps
  // control. The lead tile's "Get directions" action and the sticky dock already
  // cover the directions use-case, so no overlay needed here.
  const mapTile = `<div class="so-tile so-tile--map">
    <iframe title="WaveMAX Austin map" src="${esc(NAP.mapsEmbed)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe></div>`;

  return `<section class="so-hero so-hero--bento" aria-labelledby="so-h1">
    <div class="so-wrap">
      <div class="so-bento">
        ${leadTile}
        ${selfServeTile}
        ${wdfTile}
        ${uvTile}
        ${serviceTile('commercial', I.box, 'so-tile--commercial')}
        ${mapTile}
      </div>
    </div>
  </section>`;
}

/* ---- KPI strip (home) ----
   Full-width horizontal stat band that sits DIRECTLY BELOW the hero bento,
   between the hero and the next section. Carries the headline numbers
   (42 washers · 42 dryers · 24-hr · $1.20/lb · hours). Wraps on mobile. */
function kpiStrip(lang) {
  const L = t(lang);
  const items = [
    { v: '42', l: L.kpiWashers, ico: I.wash },
    { v: '42', l: L.kpiDryers, ico: I.bolt },
    { v: '24 h', l: L.kpiTurn, ico: I.clock },
    { v: '$1.20', l: `WDF${esc(L.wdfPerLb)}`, ico: I.drop, raw: true },
    { v: L.kpiHoursVal, l: L.kpiHours, ico: I.cal },
  ];
  const cells = items.map(it =>
    `<div class="so-kpi">
      <span class="so-kpi-ico">${it.ico}</span>
      <span class="so-kpi-v">${it.raw ? it.v : esc(it.v)}</span>
      <span class="so-kpi-l">${esc(it.l)}</span>
    </div>`
  ).join('');
  return `<section class="so-kpis" aria-label="${esc(L.bentoStatus)}"><div class="so-wrap">
    <div class="so-kpi-row">${cells}</div>
  </div></section>`;
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
    parts.push(kpiStrip(lang));
    parts.push(`<div class="so-wrap">${C.concierge(lang)}</div>`);
    // The KPI strip under the hero already presents the stats, so skip the
    // model's redundant 'stats' section on home (avoids a second KPI row).
    for (const s of (data.sections || [])) {
      if (s.kind === 'stats') continue;
      parts.push(renderSection(s, content, intensity, lang));
    }
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
