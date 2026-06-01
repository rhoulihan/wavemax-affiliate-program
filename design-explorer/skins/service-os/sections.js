'use strict';
const C = require('./components');
const { esc, fill, I, NAP, t } = C;

/* Each renderer takes (section, content, intensity, lang) and returns HTML.
   Renders strictly what the content model provides for each `kind`. */

function header(s) {
  const title = s.title ? `<h2 class="so-sec-title">${fill(s.title)}</h2>` : '';
  const sub = s.sub ? `<p class="so-sec-sub">${fill(s.sub)}</p>` : '';
  return title || sub ? `<div class="so-sec-head">${title}${sub}</div>` : '';
}

const renderers = {
  stats(s) {
    const items = (s.items || []).map(it =>
      `<div class="so-stat"><div class="so-stat-v">${esc(it.value)}</div><div class="so-stat-l">${esc(it.label)}</div></div>`
    ).join('');
    return `<section class="so-section"><div class="so-wrap">${header(s)}<div class="so-stats">${items}</div></div></section>`;
  },

  cards(s) {
    const items = (s.items || []).map((it, i) =>
      `<article class="so-card"><span class="so-card-no">${String(i + 1).padStart(2, '0')}</span>
        <h3>${fill(it.title)}</h3><p>${fill(it.body)}</p></article>`
    ).join('');
    return `<section class="so-section"><div class="so-wrap">${header(s)}<div class="so-cards">${items}</div></div></section>`;
  },

  steps(s) {
    const items = (s.items || []).map((it, i) =>
      `<div class="so-step"><div class="so-step-no">${String(i + 1).padStart(2, '0')}</div>
        <div><h3>${fill(it.title)}</h3><p>${fill(it.body)}</p></div></div>`
    ).join('');
    return `<section class="so-section so-section--alt"><div class="so-wrap">${header(s)}<div class="so-steps">${items}</div></div></section>`;
  },

  reviews(s) {
    const stars = '★★★★★';
    const cards = (s.items || []).map(it =>
      `<figure class="so-review">
        <div class="so-review-stars" aria-label="5 out of 5 stars">${stars}</div>
        <blockquote>${fill(it.quote)}</blockquote>
        <figcaption><b>${esc(it.name)}</b>${it.meta ? `<span>${esc(it.meta)}</span>` : ''}</figcaption>
      </figure>`
    ).join('');
    return `<section class="so-section so-section--alt"><div class="so-wrap">${header(s)}<div class="so-reviews">${cards}</div></div></section>`;
  },

  prose(s) {
    return `<section class="so-section"><div class="so-wrap"><div class="so-prose">
      ${s.title ? `<h2 class="so-sec-title">${fill(s.title)}</h2>` : ''}
      <p>${fill(s.body)}</p></div></div></section>`;
  },

  tabs(s, content, intensity, lang) {
    const L = t(lang);
    const slugs = (s.tabs || []).slice(0, 3);
    const inputs = slugs.map((_, i) =>
      `<input type="radio" name="so-svc" id="so-t${i}"${i === 0 ? ' checked' : ''}>`
    ).join('');
    const labels = slugs.map((slug, i) =>
      `<label for="so-t${i}">${esc(C.serviceTitle(slug, lang, content))}</label>`
    ).join('');
    const panels = slugs.map(slug => {
      const p = content.pages[slug];
      const h = p && p.hero ? p.hero : { title: slug, sub: '' };
      const ico = C.SERVICE_ICON[slug] || I.wash;
      return `<div class="so-tabpanel">
        <div class="so-tile-ico" style="margin-bottom:12px">${ico}</div>
        <h3>${fill(h.title)}</h3><p>${fill(h.sub)}</p>
        <a class="so-btn" href="#">${esc(L.learnMore)} ${I.arrow}</a></div>`;
    }).join('');
    return `<section class="so-section"><div class="so-wrap">${header(s)}
      <div class="so-tabs">${inputs}
        <div class="so-tablist" role="tablist">${labels}</div>
        <div class="so-tabpanels">${panels}</div>
      </div></div></section>`;
  },

  pricing(s, content, intensity, lang) {
    const L = t(lang);
    const es = lang === 'es';
    const featLabel = es ? 'Lava · Seca · Dobla' : 'Wash · Dry · Fold';
    const includes = es
      ? ['Detergente, hojas para secadora y ganchos incluidos', 'Mínimo de 10 lb', 'Solo tarjeta · sin efectivo', 'Lista en 24 horas']
      : ['Detergent, dryer sheets & hangers included', '10 lb minimum', 'Cards only · no cash', '24-hour turnaround'];
    const selfTitle = es ? 'Autoservicio' : 'Self-serve wash';
    const selfList = es
      ? ['42 lavadoras Electrolux 450G', 'Carga más grande: 80 lb', 'Secado 50% más rápido', 'Atendido en cada turno']
      : ['42 Electrolux 450G washers', 'Largest load: 80 lb', '50% faster drying', 'Attended every shift'];
    return `<section class="so-section"><div class="so-wrap">${header(s)}
      <div class="so-price">
        <div class="so-price-card so-price-card--feature">
          <span class="so-eyebrow">${esc(featLabel)}</span>
          <div class="so-price-big" style="margin-top:8px">$1.20<small>/lb</small></div>
          <ul class="so-price-list">${includes.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
          <a class="so-btn so-btn-primary" href="${C.tel}" style="margin-top:18px">${I.phone}${esc(L.call)}</a>
        </div>
        <div class="so-price-card">
          <span class="so-eyebrow">${esc(selfTitle)}</span>
          <div class="so-price-big" style="margin-top:8px">42+42<small> ${es ? 'máquinas' : 'machines'}</small></div>
          <ul class="so-price-list">${selfList.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
          <a class="so-btn" href="${esc(NAP.mapsDir)}" target="_blank" rel="noopener" style="margin-top:18px">${I.pin}${esc(L.directions)}</a>
        </div>
      </div></div></section>`;
  },

  'contact-info'(s, content, intensity, lang) {
    const L = t(lang);
    const labelMap = {
      Address: es => es ? 'Dirección' : 'Address',
      Phone: es => es ? 'Teléfono' : 'Phone',
      Hours: es => es ? 'Horario' : 'Hours',
    };
    const es = lang === 'es';
    const ico = { Address: I.pin, Phone: I.phone, Hours: I.clock };
    const rows = (s.items || []).map(it => {
      const label = labelMap[it.label] ? labelMap[it.label](es) : it.label;
      let val = esc(it.value);
      if (it.label === 'Phone') val = `<a href="${C.tel}">${esc(it.value)}</a>`;
      if (it.label === 'Address') val = `<a href="${esc(NAP.mapsDir)}" target="_blank" rel="noopener">${esc(it.value)}</a>`;
      return `<li><span class="so-nap-ico">${ico[it.label] || I.pin}</span>
        <span><span class="so-nap-l">${esc(label)}</span><br><span class="so-nap-v">${val}</span></span></li>`;
    }).join('');
    return `<div class="so-contact-card">
      <h2 class="so-sec-title" style="font-size:24px;margin-bottom:18px">${fill(s.title)}</h2>
      <ul class="so-nap">${rows}</ul>
      <div class="so-actions" style="margin-top:22px">
        <a class="so-btn so-btn-primary" href="${C.tel}">${I.phone}${esc(L.call)}</a>
        <a class="so-btn" href="${esc(NAP.mapsDir)}" target="_blank" rel="noopener">${I.pin}${esc(L.directions)}</a>
      </div></div>`;
  },

  'contact-form'(s, content, intensity, lang) {
    const es = lang === 'es';
    const f = {
      name: es ? 'Nombre' : 'Name', email: es ? 'Correo' : 'Email',
      phone: es ? 'Teléfono' : 'Phone', msg: es ? 'Mensaje' : 'Message',
      send: es ? 'Enviar mensaje' : 'Send message',
    };
    // Static visual form (CSP-clean: no JS, no handlers; not wired)
    return `<div class="so-contact-card">
      <h2 class="so-sec-title" style="font-size:24px;margin-bottom:6px">${fill(s.title)}</h2>
      <form class="so-form" aria-label="${esc(f.send)}">
        <div class="so-field"><label for="so-fn">${esc(f.name)}</label><input id="so-fn" type="text" name="name" autocomplete="name"></div>
        <div class="so-field"><label for="so-fe">${esc(f.email)}</label><input id="so-fe" type="email" name="email" autocomplete="email"></div>
        <div class="so-field"><label for="so-fp">${esc(f.phone)}</label><input id="so-fp" type="tel" name="phone" autocomplete="tel"></div>
        <div class="so-field"><label for="so-fm">${esc(f.msg)}</label><textarea id="so-fm" name="message"></textarea></div>
        <button class="so-btn so-btn-primary" type="submit">${esc(f.send)} ${I.arrow}</button>
      </form></div>`;
  },
};

function renderSection(s, content, intensity, lang) {
  const fn = renderers[s.kind];
  return fn ? fn(s, content, intensity, lang) : '';
}

module.exports = { renderSection, renderers, header };
