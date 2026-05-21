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
})();
