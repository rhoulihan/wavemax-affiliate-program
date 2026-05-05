/* corporate-hero-backdrop.js
 *
 * On every corporate-content page, randomly pick a storefront/exterior
 * photograph from the showcase pool (Jacksonville flagship, Kent WA,
 * Omaha) and apply it as the hero backdrop, preserving the existing
 * gradient overlay defined in the page's stylesheet.
 *
 * Targets any element with class `wm-fr-hero` or `data-corp-hero`.
 * Pages that intentionally use a different image (e.g., /virtual-tour/
 * uses an interior shot) opt out via `data-corp-hero="off"`.
 */
(function () {
  'use strict';

  // Curated showcase storefront pool — only verified-existent URLs.
  // (Exteriors only — keep interiors out so the hero always reads as
  // "outside the store" rather than "inside.")
  const POOL = [
    'https://wavemaxlaundry.com/wp-content/uploads/locations/jacksonville-fl/hero-1.jpg',
    'https://wavemaxlaundry.com/wp-content/uploads/locations/jacksonville-fl/hero-3.jpg',
    'https://wavemaxlaundry.com/wp-content/uploads/locations/kent-wa/hero-1.jpg',
    'https://wavemaxlaundry.com/wp-content/uploads/locations/kent-wa/hero-2.jpg',
    'https://wavemaxlaundry.com/wp-content/uploads/locations/kent-wa/hero-3.jpg',
    'https://wavemaxlaundry.com/wp-content/uploads/locations/omaha/hero-1.jpg',
    'https://wavemaxlaundry.com/wp-content/uploads/locations/omaha/hero-2.jpg',
    'https://wavemaxlaundry.com/wp-content/uploads/locations/omaha/hero-3.jpg'
  ];

  // Default gradient overlay, kept consistent across pages so the existing
  // page-specific stylesheet rules don't matter. Pages can override by
  // setting data-corp-hero-gradient on the hero element.
  const DEFAULT_GRADIENT =
    'linear-gradient(120deg, rgba(15, 32, 53, 0.88) 0%, rgba(20, 56, 82, 0.62) 55%, rgba(20, 56, 82, 0.30) 100%)';

  function pick() {
    return POOL[Math.floor(Math.random() * POOL.length)];
  }

  function apply() {
    const heroes = document.querySelectorAll('.wm-fr-hero, [data-corp-hero]');
    heroes.forEach((el) => {
      if (el.getAttribute('data-corp-hero') === 'off') return;

      const url = pick();
      const grad = el.getAttribute('data-corp-hero-gradient') || DEFAULT_GRADIENT;
      el.style.background = `${grad}, url('${url}') center/cover`;

      // Pre-load the image so its dimensions are cached when the gradient
      // composites — avoids a brief solid-navy flash on slow connections.
      const pre = new Image();
      pre.src = url;
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', apply);
  } else {
    apply();
  }
})();
