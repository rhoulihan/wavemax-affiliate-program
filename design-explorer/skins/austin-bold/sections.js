'use strict';
/**
 * Direction 3 — "RUNDBERG PRESS" section renderers.
 *
 * Each takes (section, content, intensity, lang) and returns a poster BAND.
 * Renders strictly what the content model provides per `kind`:
 *   stats  -> a row of stamped facts
 *   tabs   -> overlapping pasted-poster service show-bills (:checked, CSS-only)
 *   steps  -> a torn-ticket "how it works" run
 *   cards  -> pasted posters at ±rotation with tape corners
 *   prose  -> a single broadsheet column with a drop-cap
 *   pricing-> the torn-ticket PRICE LEDGER (big tabular numerals)
 *   reviews-> "letters from the block" clippings
 *   contact-info / contact-form -> NAP card + a static (unwired) coupon form
 *
 * Body paragraphs sit on a SOLID paper/ink token pair (never on halftone/grain)
 * to hold WCAG-AA contrast. CSP-clean: no scripts, no inline handlers.
 */
const C = require('./components');
const { esc, fill, I, NAP, tel, t } = C;

/* a band header: a kicker label + the model title as a misregistered poster H2 */
function bandHead(s, label) {
  const kicker = label ? `<span class="ap-kicker">${esc(label)}</span>` : '';
  const title = s.title ? `<h2 class="ap-h2" data-text="${fill(s.title)}">${fill(s.title)}</h2>` : '';
  const sub = s.sub ? `<p class="ap-sub">${fill(s.sub)}</p>` : '';
  return (kicker || title || sub) ? `<div class="ap-band-head">${kicker}${title}${sub}</div>` : '';
}

const renderers = {
  stats(s, content, intensity, lang) {
    const items = (s.items || []).map(it =>
      `<div class="ap-stat">
        <span class="ap-stat-v">${esc(it.value)}</span>
        <span class="ap-stat-l">${esc(it.label)}</span>
      </div>`
    ).join('<span class="ap-stat-perf" aria-hidden="true"></span>');
    return `<section class="ap-band ap-band--stats"><div class="ap-wrap">
      ${bandHead(s)}
      <div class="ap-stats">${items}</div>
    </div></section>`;
  },

  /* pasted-poster service show-bills — CSS-only :checked switcher.
     Names are namespaced per page is unnecessary (one tabs block per page). */
  tabs(s, content, intensity, lang) {
    const L = t(lang);
    const slugs = (s.tabs || []).slice(0, 3);
    const ico = { 'self-serve': '①', 'wash-dry-fold': '②', commercial: '③' };
    const inputs = slugs.map((_, i) =>
      `<input class="ap-bill-radio ap-sr" type="radio" name="ap-bill" id="ap-bill${i}"${i === 0 ? ' checked' : ''} tabindex="-1">`
    ).join('');
    const tabs = slugs.map((slug, i) => {
      const title = (content.pages[slug] && content.pages[slug].hero) ? content.pages[slug].hero.title : slug;
      return `<label class="ap-bill-tab" for="ap-bill${i}"><span class="ap-bill-no" aria-hidden="true">${ico[slug] || '•'}</span>${fill(title)}</label>`;
    }).join('');
    const panels = slugs.map(slug => {
      const p = content.pages[slug];
      const h = p && p.hero ? p.hero : { title: slug, sub: '' };
      return `<div class="ap-bill-panel" role="group">
        <span class="ap-tape ap-tape--tl" aria-hidden="true"></span>
        <span class="ap-tape ap-tape--br" aria-hidden="true"></span>
        <h3 class="ap-bill-title">${fill(h.title)}</h3>
        <p class="ap-bill-body">${fill(h.sub)}</p>
        <a class="ap-link" href="#">${esc(L.showOpen)} ${I.arrow}</a>
      </div>`;
    }).join('');
    return `<section class="ap-band ap-band--bills"><div class="ap-wrap">
      ${bandHead(s, L.servicesLabel)}
      <div class="ap-bills">
        ${inputs}
        <div class="ap-bill-tabs" role="tablist">${tabs}</div>
        <div class="ap-bill-stage">${panels}</div>
      </div>
    </div></section>`;
  },

  /* torn-ticket "how it works" run */
  steps(s, content, intensity, lang) {
    const items = (s.items || []).map((it, i) =>
      `<li class="ap-ticket">
        <span class="ap-ticket-no" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span>
        <h3 class="ap-ticket-title">${fill(it.title)}</h3>
        <p class="ap-ticket-body">${fill(it.body)}</p>
      </li>`
    ).join('');
    return `<section class="ap-band ap-band--steps"><div class="ap-wrap">
      ${bandHead(s)}
      <ol class="ap-tickets">${items}</ol>
    </div></section>`;
  },

  /* pasted posters at ±rotation, tape corners, lift on hover/focus-within */
  cards(s, content, intensity, lang) {
    const items = (s.items || []).map((it, i) =>
      `<article class="ap-poster" style="--i:${i}" tabindex="0">
        <span class="ap-tape ap-tape--tl" aria-hidden="true"></span>
        <span class="ap-poster-no" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span>
        <h3 class="ap-poster-title">${fill(it.title)}</h3>
        <p class="ap-poster-body">${fill(it.body)}</p>
      </article>`
    ).join('');
    return `<section class="ap-band ap-band--posters"><div class="ap-wrap">
      ${bandHead(s)}
      <div class="ap-posters">${items}</div>
    </div></section>`;
  },

  /* single broadsheet column with drop-cap */
  prose(s, content, intensity, lang) {
    const body = fill(s.body);
    return `<section class="ap-band ap-band--prose"><div class="ap-wrap">
      <div class="ap-column">
        ${s.title ? `<h2 class="ap-h2" data-text="${fill(s.title)}">${fill(s.title)}</h2>` : ''}
        <p class="ap-dropcap">${body}</p>
      </div>
    </div></section>`;
  },

  /* THE torn-ticket PRICE LEDGER (big stacked tabular numerals, perforations) */
  pricing(s, content, intensity, lang) {
    const L = t(lang);
    return `<section class="ap-band ap-band--ledger"><div class="ap-wrap">
      ${bandHead({ title: L.ledgerTitle, sub: L.ledgerSub })}
      <div class="ap-ledger">
        <div class="ap-ledger-row">
          <div class="ap-ledger-name">
            <span class="ap-kicker">${esc(L.ledgerSelfTitle)}</span>
            <p class="ap-ledger-foot">${esc(L.ledgerSelfFoot)}</p>
          </div>
          <div class="ap-ledger-price">
            <span class="ap-num">$2.75</span><span class="ap-num-to">–</span><span class="ap-num">$10.50</span>
            <span class="ap-ledger-unit">${esc(L.ledgerSelfUnit)}</span>
          </div>
        </div>
        <div class="ap-perf" aria-hidden="true"></div>
        <div class="ap-ledger-row">
          <div class="ap-ledger-name">
            <span class="ap-kicker">${esc(L.ledgerWdfTitle)}</span>
            <p class="ap-ledger-foot">${esc(L.ledgerWdfFoot)}</p>
          </div>
          <div class="ap-ledger-price">
            <span class="ap-num ap-num--big">$1.20</span>
            <span class="ap-ledger-unit">${esc(L.ledgerWdfUnit)}</span>
          </div>
        </div>
        <span class="ap-ledger-stub" aria-hidden="true">${esc(L.ledgerStub)}</span>
      </div>
    </div></section>`;
  },

  /* "letters from the block" — review clippings */
  reviews(s, content, intensity, lang) {
    const cards = (s.items || []).map((it, i) =>
      `<figure class="ap-clip" style="--i:${i}">
        <span class="ap-stars" aria-label="5 / 5">${I.star}${I.star}${I.star}${I.star}${I.star}</span>
        <blockquote class="ap-clip-q">${fill(it.quote)}</blockquote>
        <figcaption class="ap-clip-cap"><b>${esc(it.name)}</b>${it.meta ? `<span>${esc(it.meta)}</span>` : ''}</figcaption>
      </figure>`
    ).join('');
    return `<section class="ap-band ap-band--clips"><div class="ap-wrap">
      ${bandHead(s)}
      <div class="ap-clips">${cards}</div>
    </div></section>`;
  },

  'contact-info'(s, content, intensity, lang) {
    const L = t(lang);
    const labelTr = (label) => {
      const map = { Address: L.addrLabel, Phone: L.phoneLabel, Hours: L.hoursOpen };
      return map[label] || label;
    };
    const rows = (s.items || []).map(it => {
      let val = esc(it.value);
      if (it.label === 'Phone') val = `<a href="${tel}">${esc(it.value)}</a>`;
      if (it.label === 'Address') val = `<a href="${esc(NAP.mapsDir)}" target="_blank" rel="noopener">${esc(it.value)}</a>`;
      return `<li><span class="ap-nap-l">${esc(labelTr(it.label))}</span><span class="ap-nap-v">${val}</span></li>`;
    }).join('');
    return `<div class="ap-nap-card">
      <h2 class="ap-h3">${fill(s.title)}</h2>
      <ul class="ap-nap">${rows}</ul>
      <div class="ap-actions">
        <a class="ap-btn ap-btn--hot" href="${tel}">${I.phone}<span>${esc(L.call)}</span></a>
        <a class="ap-btn" href="${esc(NAP.mapsDir)}" target="_blank" rel="noopener">${I.pin}<span>${esc(L.directions)}</span></a>
      </div>
    </div>`;
  },

  'contact-form'(s, content, intensity, lang) {
    const f = {
      en: { name: 'Name', email: 'Email', phone: 'Phone', msg: 'Message', send: 'Send message' },
      es: { name: 'Nombre', email: 'Correo', phone: 'Teléfono', msg: 'Mensaje', send: 'Enviar mensaje' },
      pt: { name: 'Nome', email: 'E-mail', phone: 'Telefone', msg: 'Mensagem', send: 'Enviar mensagem' },
      de: { name: 'Name', email: 'E-Mail', phone: 'Telefon', msg: 'Nachricht', send: 'Nachricht senden' },
    }[lang] || { name: 'Name', email: 'Email', phone: 'Phone', msg: 'Message', send: 'Send message' };
    // Static visual coupon-style form (CSP-clean: no JS, not wired).
    return `<div class="ap-nap-card ap-form-card">
      <h2 class="ap-h3">${fill(s.title)}</h2>
      <form class="ap-form" aria-label="${esc(f.send)}">
        <div class="ap-field"><label for="ap-fn">${esc(f.name)}</label><input id="ap-fn" type="text" name="name" autocomplete="name"></div>
        <div class="ap-field"><label for="ap-fe">${esc(f.email)}</label><input id="ap-fe" type="email" name="email" autocomplete="email"></div>
        <div class="ap-field"><label for="ap-fp">${esc(f.phone)}</label><input id="ap-fp" type="tel" name="phone" autocomplete="tel"></div>
        <div class="ap-field"><label for="ap-fm">${esc(f.msg)}</label><textarea id="ap-fm" name="message" rows="4"></textarea></div>
        <button class="ap-btn ap-btn--hot" type="submit">${esc(f.send)} ${I.arrow}</button>
      </form>
    </div>`;
  },
};

function renderSection(s, content, intensity, lang) {
  const fn = renderers[s.kind];
  return fn ? fn(s, content, intensity, lang) : '';
}

module.exports = { renderSection, renderers, bandHead };
