/* franchise-hero-rotator.js
 *
 * Rotates the foreground photo card on the /franchise/ hero through a
 * curated set of WaveMAX network images. Tag label updates per slide.
 * Pauses on hover. Pure CSS opacity transition (no innerHTML thrash).
 */
(function () {
  'use strict';

  const SLIDE_MS = 3500;

  function start() {
    const card = document.getElementById('wm-fr-hero-rotator');
    if (!card) return;
    const slides = Array.prototype.slice.call(card.querySelectorAll('img'));
    const tagEl  = document.getElementById('wm-fr-hero-tag');
    if (slides.length < 2) return;

    let i = 0;

    function show(idx) {
      slides.forEach((img, k) => img.classList.toggle('is-active', k === idx));
      if (tagEl) {
        const tag = slides[idx].getAttribute('data-tag') || '';
        tagEl.textContent = tag;
      }
    }

    // Always advance. Earlier versions tried to pause on hover, but
    // headless browsers report :hover as always true, and real cursors
    // landing on the card during page load made the rotator look
    // permanently stalled. Continuous rotation is simpler and works.
    function tick() {
      i = (i + 1) % slides.length;
      show(i);
    }

    // Don't auto-rotate if user prefers reduced motion.
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    setInterval(tick, SLIDE_MS);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
