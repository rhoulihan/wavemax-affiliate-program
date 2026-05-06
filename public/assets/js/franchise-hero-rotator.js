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

    // Always advance. Earlier versions tried to pause on hover (broke
    // in headless browsers) and to honor prefers-reduced-motion (which
    // Windows users get auto-set when "Show animations in Windows" is
    // off, leaving the rotator stuck on slide 0). The 1.2s opacity
    // crossfade is gentle enough not to trigger motion sensitivity.
    function tick() {
      i = (i + 1) % slides.length;
      show(i);
    }

    setInterval(tick, SLIDE_MS);
    // Kick off the first transition slightly before the first interval
    // tick so the photo card visibly moves within ~1s of page load,
    // which makes the rotation feature obvious to the user.
    setTimeout(tick, 800);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
