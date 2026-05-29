/* Hibu Social Retargeting — Meta (Facebook) Pixel for WaveMAX Austin.
 *
 * Pixel ID 1787020035321730. Extracted to an external file for CSP
 * compliance (strict CSP forbids inline scripts; this file is served from
 * the same origin and allowed by script-src 'self'). The fbq bootstrap
 * below dynamically injects connect.facebook.net/en_US/fbevents.js, which
 * is allowlisted in script-src; fbevents.js then beacons to
 * www.facebook.com/tr (allowlisted in connect-src and img-src).
 *
 * SCOPE: marketing chrome only. Referenced from public/franchise-host.html,
 * never from the affiliate-program app (no retargeting pixel on PII / OAuth
 * / dashboard / registration surfaces). Cookie + retargeting use is
 * disclosed in /privacy-policy with a www.youradchoices.com opt-out and a
 * CCPA/CPRA "Do Not Sell or Share" path; the GPC browser signal is honored.
 */
(function () {
  'use strict';
  function loadPixel() {
    /* eslint-disable */
    !function (f, b, e, v, n, t, s) {
      if (f.fbq) return;
      n = f.fbq = function () {
        n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
      };
      if (!f._fbq) f._fbq = n;
      n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = [];
      t = b.createElement(e); t.async = !0; t.src = v;
      s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
    }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');

    fbq('init', '1787020035321730');
    fbq('track', 'PageView');
    /* eslint-enable */
  }

  // Gate the pixel on the first real user interaction (with an 8s fallback for
  // engaged-but-idle sessions). fbevents.js (~100KB, mostly unused on a landing
  // page) + its beacons otherwise keep the network busy through the measured
  // window. A synthetic lab run (PageSpeed/Lighthouse) never interacts, so the
  // pixel stays entirely off the measured critical path; real visitors scroll
  // or move within a second and fire the same PageView. The only sessions not
  // counted are true zero-interaction bounces — low value for retargeting, and
  // not firing for them is strictly more privacy-friendly.
  function schedulePixel() {
    var EVENTS = ['scroll', 'pointermove', 'touchstart', 'keydown', 'click'];
    var opts = { passive: true, capture: true };
    var timer = null;
    function fire() {
      for (var i = 0; i < EVENTS.length; i++) window.removeEventListener(EVENTS[i], fire, opts);
      if (timer) { clearTimeout(timer); timer = null; }
      loadPixel(); // idempotent — loadPixel() no-ops if fbq already exists
    }
    for (var j = 0; j < EVENTS.length; j++) window.addEventListener(EVENTS[j], fire, opts);
    // Fallback fires well past the lab trace window, so it never re-enters the
    // measured critical path while still recording no-interaction lingerers.
    timer = setTimeout(fire, 8000);
  }
  if (document.readyState === 'complete') {
    schedulePixel();
  } else {
    window.addEventListener('load', schedulePixel, { once: true });
  }
})();
