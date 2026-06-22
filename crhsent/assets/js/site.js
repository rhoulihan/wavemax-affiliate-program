/* CRHS Enterprises — RED BUREAU site behavior.
   No dependencies. CSP-safe (loaded as an external nonce'd script).
   Mobile nav toggle + scroll-reveal + count-up; reduced-motion + no-IO safe. */
(function () {
  'use strict';

  var reduce = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- Mobile nav ---- */
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.getElementById('site-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    nav.addEventListener('click', function (e) {
      if (e.target.tagName === 'A' && nav.classList.contains('open')) {
        nav.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /* ---- Count-up ---- */
  function runCount(el) {
    if (el.__done) return;
    el.__done = true;
    var to = parseFloat(el.getAttribute('data-count-to'));
    if (isNaN(to)) return;
    var dec = parseInt(el.getAttribute('data-count-decimals') || '0', 10);
    var pre = el.getAttribute('data-count-prefix') || '';
    var suf = el.getAttribute('data-count-suffix') || '';
    var dur = 1100, start = null;
    function frame(t) {
      if (start === null) start = t;
      var p = Math.min((t - start) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = pre + (to * eased).toFixed(dec) + suf;
      if (p < 1) { requestAnimationFrame(frame); }
      else { el.textContent = pre + to.toFixed(dec) + suf; }
    }
    requestAnimationFrame(frame);
  }

  var reveals = [].slice.call(document.querySelectorAll('.reveal'));
  var counters = [].slice.call(document.querySelectorAll('[data-count-to]'));

  /* No IntersectionObserver or reduced motion: show everything as-is. */
  if (reduce || !('IntersectionObserver' in window) || !('requestAnimationFrame' in window)) {
    reveals.forEach(function (el) { el.classList.add('in'); });
    return;
  }

  /* Seed counters to zero so the animation starts from 0. */
  counters.forEach(function (el) {
    var dec = parseInt(el.getAttribute('data-count-decimals') || '0', 10);
    var pre = el.getAttribute('data-count-prefix') || '';
    var suf = el.getAttribute('data-count-suffix') || '';
    el.textContent = pre + (0).toFixed(dec) + suf;
  });

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      var el = entry.target;
      el.classList.add('in');
      if (el.hasAttribute('data-count-to')) { runCount(el); }
      var inner = el.querySelectorAll('[data-count-to]');
      [].forEach.call(inner, runCount);
      io.unobserve(el);
    });
  }, { threshold: 0.15, rootMargin: '0px 0px 0px 0px' });

  reveals.forEach(function (el) { io.observe(el); });
  counters.forEach(function (el) {
    if (!el.closest('.reveal')) { io.observe(el); }
  });
})();
