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
    let timer = null;
    let paused = false;

    function show(idx) {
      slides.forEach((img, k) => img.classList.toggle('is-active', k === idx));
      if (tagEl) {
        const tag = slides[idx].getAttribute('data-tag') || '';
        tagEl.textContent = tag;
      }
    }

    function tick() {
      if (paused) return;
      i = (i + 1) % slides.length;
      show(i);
    }

    function loop() {
      timer = setInterval(tick, SLIDE_MS);
    }

    card.addEventListener('mouseenter', () => { paused = true; });
    card.addEventListener('mouseleave', () => { paused = false; });

    // Don't auto-rotate if user prefers reduced motion.
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    loop();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
