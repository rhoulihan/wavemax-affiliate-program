/* network-reviews-init.js
 *
 * Fetches the network-aggregated 5-star Google customer reviews from
 * /api/v1/location/network-reviews and renders them into the
 * /testimonials/ page. Used to provide a live customer-side credibility
 * layer alongside the franchisee owner quotes.
 *
 * Endpoint cached server-side (6h) — the fetch from this page is cheap
 * and shared across visitors.
 */
(function () {
  'use strict';

  const ENDPOINT = '/api/v1/location/network-reviews?count=12';

  function el(tag, attrs, children) {
    const e = document.createElement(tag);
    if (attrs) for (const k of Object.keys(attrs)) {
      if (k === 'class') e.className = attrs[k];
      else if (k === 'href') e.href = attrs[k];
      else if (k.startsWith('aria-')) e.setAttribute(k, attrs[k]);
      else e[k] = attrs[k];
    }
    if (children) for (const c of children) {
      if (typeof c === 'string') e.appendChild(document.createTextNode(c));
      else if (c) e.appendChild(c);
    }
    return e;
  }

  function initials(name) {
    return String(name || '?').trim().split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase() || '?';
  }

  function renderCard(rv) {
    const loc = rv.location || {};
    const cityState = [loc.city, loc.state].filter(Boolean).join(', ');

    const card = el('article', { class: 'wm-tm-live-card' });
    card.appendChild(el('div', { class: 'wm-tm-live-rating', 'aria-label': '5 out of 5 stars' }, ['★★★★★']));
    card.appendChild(el('p', { class: 'wm-tm-live-text' }, [rv.text || '']));

    const meta = el('div', { class: 'wm-tm-live-meta' });
    const text = el('div', null, [
      el('div', { class: 'wm-tm-live-author' }, [rv.author || 'Anonymous']),
      el('div', { class: 'wm-tm-live-loc' }, [
        loc.url
          ? el('a', { href: loc.url }, [cityState || 'WaveMAX'])
          : (cityState || 'WaveMAX')
      ]),
      rv.relativeTime ? el('div', { class: 'wm-tm-live-time' }, [rv.relativeTime]) : null
    ]);
    meta.appendChild(text);
    card.appendChild(meta);
    return card;
  }

  async function load() {
    const grid    = document.getElementById('wm-tm-live-grid');
    const loading = document.getElementById('wm-tm-live-loading');
    const errEl   = document.getElementById('wm-tm-live-error');
    const sampled = document.getElementById('wm-tm-live-sampled');

    if (!grid || !loading) return;

    try {
      const res = await fetch(ENDPOINT, { credentials: 'same-origin' });
      const data = await res.json();
      if (!data || !Array.isArray(data.reviews) || data.reviews.length === 0) {
        loading.hidden = true;
        if (errEl) errEl.hidden = false;
        return;
      }

      grid.innerHTML = '';
      data.reviews.forEach((rv) => grid.appendChild(renderCard(rv)));
      loading.hidden = true;
      grid.hidden = false;

      if (sampled && data.totalSampled) sampled.textContent = String(data.totalSampled);
    } catch (e) {
      loading.hidden = true;
      if (errEl) errEl.hidden = false;
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', load);
  } else {
    load();
  }
})();
