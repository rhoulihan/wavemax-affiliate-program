/* franchise-reviews-slider.js
 *
 * Pulls live 5-star Google reviews from /api/v1/location/network-reviews
 * (aggregated across the WaveMAX franchise network) and renders them as
 * a horizontal scrollable slider inside the Why tab on /franchise/.
 *
 * Reviews are real — sampled from operating franchise locations using
 * the Places API. Each card is tagged with the city/state and links
 * back to that store's landing page on wavemax.promo.
 */
(function () {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function star() {
    return '<svg width="14" height="14" viewBox="0 0 24 24" fill="#f5a623" aria-hidden="true"><path d="M12 2l2.39 6.95H22l-6.19 4.5 2.39 6.95L12 16l-6.2 4.4 2.39-6.95L2 8.95h7.61L12 2z"/></svg>';
  }

  function renderSlide(r) {
    const stars = star().repeat(Math.max(1, Math.min(5, r.rating || 5)));
    const cityState = (r.cityState || '').trim();
    const slug = r.slug || '';
    const cityLink = slug && cityState
      ? `<a class="wm-fr-slide-loc" href="/${esc(slug)}/">${esc(cityState)} →</a>`
      : (cityState ? `<span class="wm-fr-slide-loc">${esc(cityState)}</span>` : '');
    return `
      <div class="wm-fr-slide">
        <div class="wm-fr-slide-stars" aria-label="${r.rating || 5} stars">${stars}</div>
        <p class="wm-fr-slide-quote">"${esc((r.text || '').slice(0, 280) + ((r.text || '').length > 280 ? '…' : ''))}"</p>
        <div class="wm-fr-slide-attr">— ${esc(r.author || 'Anonymous')}</div>
        ${cityLink}
      </div>
    `;
  }

  function init() {
    const track = document.getElementById('wm-fr-reviews-track');
    if (!track) return;

    fetch('/api/v1/location/network-reviews', { credentials: 'same-origin' })
      .then((r) => r.ok ? r.json() : { reviews: [] })
      .then((data) => {
        const reviews = (data && data.reviews) || [];
        if (!reviews.length) {
          // Hide the whole slider section if no reviews came back.
          const wrap = track.closest('.wm-fr-reviews');
          if (wrap) wrap.style.display = 'none';
          return;
        }
        track.innerHTML = reviews.slice(0, 12).map(renderSlide).join('');
      })
      .catch(() => {
        const wrap = track.closest('.wm-fr-reviews');
        if (wrap) wrap.style.display = 'none';
      });

    // Prev/next buttons scroll the track horizontally by ~one card width.
    const wrap = track.closest('.wm-fr-reviews');
    if (!wrap) return;
    const prev = wrap.querySelector('.wm-fr-slider-nav.prev');
    const next = wrap.querySelector('.wm-fr-slider-nav.next');
    function scrollBy(dir) {
      const card = track.querySelector('.wm-fr-slide');
      const dist = (card ? card.getBoundingClientRect().width + 16 : 320) * dir;
      track.scrollBy({ left: dist, behavior: 'smooth' });
    }
    if (prev) prev.addEventListener('click', () => scrollBy(-1));
    if (next) next.addEventListener('click', () => scrollBy(1));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
