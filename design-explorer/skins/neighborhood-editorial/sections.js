'use strict';
const C = require('./components');
const { esc, fill, I, NAP, t } = C;

/* Each renderer takes (section, content, intensity, lang) -> HTML.
   Renders strictly what the shared content model provides for each `kind`,
   styled as magazine columns / ledgers / letters / a recipe list. */

function secHead(s, kicker) {
  const k = kicker ? `<p class="ne-kicker">${esc(kicker)}</p>` : '';
  const title = s.title ? `<h2 class="ne-sec-title">${fill(s.title)}</h2>` : '';
  const sub = s.sub ? `<p class="ne-sec-sub">${fill(s.sub)}</p>` : '';
  return (k || title || sub) ? `<div class="ne-sec-head">${k}${title}${sub}</div>` : '';
}

const renderers = {
  /* STATS -> ruled ledger strip (full-bleed within wrap) */
  stats(s, content, intensity, lang) {
    const cells = (s.items || []).map(it =>
      `<div class="ne-led-cell"><div class="ne-led-v">${esc(it.value)}</div><div class="ne-led-l">${esc(it.label)}</div></div>`
    ).join('');
    return `<section class="ne-section" style="padding-top:0"><div class="ne-wrap">
      <div class="ne-ledger">${cells}</div></div></section>`;
  },

  /* CARDS -> numbered editorial columns */
  cards(s, content, intensity, lang) {
    const L = t(lang);
    const cols = (s.items || []).map((it, i) =>
      `<article class="ne-col">
        <span class="ne-col-no">No. ${String(i + 1).padStart(2, '0')}</span>
        <h3>${fill(it.title)}</h3>
        <p>${fill(it.body)}</p>
      </article>`
    ).join('');
    return `<section class="ne-section"><div class="ne-wrap">
      ${secHead(s, L.columns)}<div class="ne-columns">${cols}</div></div></section>`;
  },

  /* STEPS -> a "recipe" list with oversized serif numerals */
  steps(s, content, intensity, lang) {
    const L = t(lang);
    const rows = (s.items || []).map(it =>
      `<div class="ne-step"><div class="ne-step-no" aria-hidden="true"></div>
        <div><h3>${fill(it.title)}</h3><p>${fill(it.body)}</p></div></div>`
    ).join('');
    return `<section class="ne-section"><div class="ne-wrap">
      ${secHead(s, L.theGuide)}<div class="ne-steps">${rows}</div></div></section>`;
  },

  /* REVIEWS -> "Letters from the block" masonry of cards */
  reviews(s, content, intensity, lang) {
    const L = t(lang);
    const stars = '★★★★★';
    const cards = (s.items || []).map(it =>
      `<figure class="ne-letter">
        <div class="ne-letter-stars" aria-label="5 out of 5 stars">${stars}</div>
        <blockquote>${fill(it.quote)}</blockquote>
        <figcaption><b>${esc(it.name)}</b>${it.meta ? esc(it.meta) : ''}</figcaption>
      </figure>`
    ).join('');
    return `<section class="ne-section"><div class="ne-wrap">
      ${secHead(s, L.fromTheBlock)}<div class="ne-letters">${cards}</div></div></section>`;
  },

  /* PROSE -> the story: aside + drop-cap body, photo strip beneath */
  prose(s, content, intensity, lang) {
    const L = t(lang);
    const paras = String(s.body || '').split(/\n{2,}/).map(p => `<p>${fill(p)}</p>`).join('');
    const strip = `<div class="ne-strip"><div class="ne-strip-track">
      ${C.figure(C.PHOTOS.storefront, L.capStorefront, `<b>${esc(L.capStorefront)}</b>`, L.photoNote, 'ne-figure--wide')}
      ${C.figure(C.PHOTOS.interior, L.capInterior, `<b>${esc(L.capInterior)}</b>`, '', 'ne-figure--wide')}
      ${C.figure(C.PHOTOS.door, L.capDoor, `<b>${esc(L.capDoor)}</b>`, '', 'ne-figure--wide')}
    </div></div>`;
    return `<section class="ne-section"><div class="ne-wrap">
      <div class="ne-prose">
        <div class="ne-prose-aside">
          <p class="ne-kicker">${esc(L.feature)}</p>
          ${s.title ? `<h2 class="ne-sec-title">${fill(s.title)}</h2>` : ''}
          <p class="ne-sec-sub">${esc(L.sinceLabel)}</p>
        </div>
        <div class="ne-prose-body">${paras}</div>
      </div></div>
      ${strip}</section>`;
  },

  /* PRICING -> a "menu card" */
  pricing(s, content, intensity, lang) {
    const L = t(lang);
    const es = lang;
    const featLabel = {
      en: 'Wash · Dry · Fold', es: 'Lava · Seca · Dobla',
      pt: 'Lavar · Secar · Dobrar', de: 'Waschen · Trocknen · Falten',
    }[es] || 'Wash · Dry · Fold';
    const includes = {
      en: ['Detergent, dryer sheets & hangers included', '10-lb minimum', 'Cards only · no cash', 'Ready the next day'],
      es: ['Detergente, hojas para secadora y ganchos incluidos', 'Mínimo de 10 lb', 'Solo tarjeta · sin efectivo', 'Lista al día siguiente'],
      pt: ['Sabão, lenços de secadora e cabides incluídos', 'Mínimo de 10 lb', 'Só cartão · sem dinheiro', 'Pronta no dia seguinte'],
      de: ['Waschmittel, Trocknertücher & Kleiderbügel inklusive', 'Mindestmenge 10 lb', 'Nur Karte · kein Bargeld', 'Fertig am nächsten Tag'],
    }[es] || [];
    const selfTitle = { en: 'The self-serve floor', es: 'El salón de autoservicio', pt: 'O salão de autoatendimento', de: 'Die SB-Wäscherei' }[es] || 'The self-serve floor';
    const selfList = {
      en: ['42 Electrolux 450G washers', 'Loads up to 80 lb', '50% faster drying', 'Attended every shift'],
      es: ['42 lavadoras Electrolux 450G', 'Cargas hasta 80 lb', 'Secado 50% más rápido', 'Atendido en cada turno'],
      pt: ['42 lavadoras Electrolux 450G', 'Cargas até 80 lb', 'Secagem 50% mais rápida', 'Equipe em cada turno'],
      de: ['42 Electrolux-450G-Waschmaschinen', 'Ladungen bis 80 lb', '50 % schnelleres Trocknen', 'Betreut in jeder Schicht'],
    }[es] || [];
    const machines = { en: 'machines', es: 'máquinas', pt: 'máquinas', de: 'Maschinen' }[es] || 'machines';
    return `<section class="ne-section"><div class="ne-wrap">
      ${secHead(s, L.theFinePrint)}
      <div class="ne-menu">
        <div class="ne-menu-card ne-menu-card--feature">
          <span class="ne-menu-eyebrow">${esc(featLabel)}</span>
          <div class="ne-menu-price">$1.20<small>/lb</small></div>
          <ul class="ne-menu-list">${includes.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
          <div class="ne-cta-row" style="margin-top:22px">
            <a class="ne-btn ne-btn-ghost" href="${C.tel}" style="border-color:rgba(255,255,255,.6);color:#fff">${I.phone}${esc(L.call)}</a>
          </div>
        </div>
        <div class="ne-menu-card">
          <span class="ne-menu-eyebrow">${esc(selfTitle)}</span>
          <div class="ne-menu-price">42<small> ${esc(machines)}</small></div>
          <ul class="ne-menu-list">${selfList.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
          <div class="ne-cta-row" style="margin-top:22px">
            <a class="ne-btn" href="${esc(NAP.mapsDir)}" target="_blank" rel="noopener">${I.pin}${esc(L.directions)}</a>
          </div>
        </div>
      </div></div></section>`;
  },

  /* CONTACT-INFO -> NAP ledger */
  'contact-info'(s, content, intensity, lang) {
    const L = t(lang);
    const labelMap = { Address: L.addressLabel, Phone: L.phoneLabel, Hours: L.hoursLabel };
    const ico = { Address: I.pin, Phone: I.phone, Hours: I.clock };
    const rows = (s.items || []).map(it => {
      const label = labelMap[it.label] || it.label;
      let val = esc(it.value);
      if (it.label === 'Phone') val = `<a href="${C.tel}">${esc(it.value)}</a>`;
      if (it.label === 'Address') val = `<a href="${esc(NAP.mapsDir)}" target="_blank" rel="noopener">${esc(it.value)}</a>`;
      return `<li><span class="ne-nap-ico">${ico[it.label] || I.pin}</span>
        <span><span class="ne-nap-l">${esc(label)}</span><span class="ne-nap-v">${val}</span></span></li>`;
    }).join('');
    return `<div>
      <p class="ne-kicker">${esc(L.findUs)}</p>
      <h2 class="ne-sec-title" style="font-size:clamp(24px,3vw,34px);margin-top:12px">${fill(s.title)}</h2>
      <ul class="ne-nap">${rows}</ul>
      <div class="ne-cta-row" style="margin-top:24px">
        <a class="ne-btn ne-btn-primary" href="${C.tel}">${I.phone}${esc(L.call)}</a>
        <a class="ne-btn" href="${esc(NAP.mapsDir)}" target="_blank" rel="noopener">${I.pin}${esc(L.directions)}</a>
      </div></div>`;
  },

  /* CONTACT-FORM -> static editorial form (CSP-clean, not wired) */
  'contact-form'(s, content, intensity, lang) {
    const f = {
      en: { name: 'Name', email: 'Email', phone: 'Phone', msg: 'Message', send: 'Send a note' },
      es: { name: 'Nombre', email: 'Correo', phone: 'Teléfono', msg: 'Mensaje', send: 'Enviar una nota' },
      pt: { name: 'Nome', email: 'E-mail', phone: 'Telefone', msg: 'Mensagem', send: 'Enviar uma nota' },
      de: { name: 'Name', email: 'E-Mail', phone: 'Telefon', msg: 'Nachricht', send: 'Notiz senden' },
    }[lang] || {};
    return `<div style="margin-top:34px;border-top:1px solid var(--ne-line);padding-top:30px">
      <h2 class="ne-sec-title" style="font-size:clamp(22px,2.6vw,30px)">${fill(s.title)}</h2>
      <form class="ne-form" aria-label="${esc(f.send)}">
        <div class="ne-form-row">
          <div class="ne-field"><label for="ne-fn">${esc(f.name)}</label><input id="ne-fn" type="text" name="name" autocomplete="name"></div>
          <div class="ne-field"><label for="ne-fe">${esc(f.email)}</label><input id="ne-fe" type="email" name="email" autocomplete="email"></div>
        </div>
        <div class="ne-field"><label for="ne-fp">${esc(f.phone)}</label><input id="ne-fp" type="tel" name="phone" autocomplete="tel"></div>
        <div class="ne-field"><label for="ne-fm">${esc(f.msg)}</label><textarea id="ne-fm" name="message"></textarea></div>
        <button class="ne-btn ne-btn-primary" type="submit">${esc(f.send)} ${I.arrow}</button>
      </form></div>`;
  },
};

function renderSection(s, content, intensity, lang) {
  const fn = renderers[s.kind];
  return fn ? fn(s, content, intensity, lang) : '';
}

module.exports = { renderSection, renderers, secHead };
