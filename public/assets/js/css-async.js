/*
 * css-async.js — flip non-critical stylesheets from media="print" (which the
 * browser fetches without blocking first paint) to media="all" so they apply
 * once the document has parsed.
 *
 * CSP-safe: this is an external file, so it needs no inline `onload` handler
 * (the usual `<link onload="this.media='all'">` trick violates our strict
 * nonce-based CSP). Mark a stylesheet for async load with:
 *     <link rel="stylesheet" href="..." media="print" data-async-css>
 *
 * Used on the franchise host page for the Google Fonts CSS (the single biggest
 * render blocker) and swirl-spinner.css (only needed for async-work spinners).
 * Layout-critical chrome CSS stays a normal blocking <link> to avoid FOUC.
 */
(function () {
  'use strict';
  function applyAsyncCss() {
    var links = document.querySelectorAll('link[data-async-css]');
    for (var i = 0; i < links.length; i++) {
      links[i].media = 'all';
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyAsyncCss);
  } else {
    applyAsyncCss();
  }
})();
