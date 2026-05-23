/* Hibu Dynamic Phone Insertion — init for the WaveMAX Austin location.
 *
 * MIRRORS the inline init currently on https://wavemaxlaundry.com/austin-tx/
 * (extracted to an external file for CSP compliance — strict CSP forbids
 * inline scripts; this file is loaded with the per-request nonce).
 *
 * The external loader script `ybDynamicPhoneInsertion.js` is requested
 * separately from `https://reports.hibu.com/analytics/js/...`. It exposes
 * the global `ybFun_ReplaceText` function which scans the document for the
 * `ybFindPhNums*` numbers and replaces them with the corresponding
 * `ybReplacePhNums*` source-indexed tracking number.
 *
 *   ybFindPhNums          — five copies of the local number, one per source
 *                           index (organic / paid / GBP / direct / etc.).
 *                           Hibu's loader picks the right replacement based
 *                           on the visitor's referrer / utm_source.
 *   ybReplacePhNums       — five matching tracking numbers (one per source).
 *   ybFindPhNumsNoIndx    — fallback "default" pattern when no source match.
 *   ybReplacePhNumsNoIndx — fallback tracking number used in that case.
 *
 * Numbers below match the current production austin-tx page exactly.
 * If you change the local number, also update LOCATION_DATA.contact.phone
 * in austin-host-mock-data.js.
 */
(function () {
  'use strict';

  /* eslint-disable no-undef */
  ybFindPhNums          = ['15125531674', '15125531674', '15125531674', '15125531674', '15125531674'];
  ybReplacePhNums       = ['15123091004', '15123091415', '15123597929', '15123608337', '15123608339'];
  ybFindPhNumsNoIndx    = ['15125531674'];
  ybReplacePhNumsNoIndx = ['15123090430'];

  function yextPhoneChangeEventHandler(e) {
    e.preventDefault();
    if (typeof ybFun_ReplaceText === 'function') ybFun_ReplaceText();
  }

  // ── FIX (iframe double-load): the Hibu loader's non-jQuery replace rewrites
  // document.body.innerHTML, which DESTROYS and recreates #wavemax-iframe on
  // every phone swap → the embedded content reloaded 2-4x per page view and
  // re-ran its own Hibu (root-caused 2026-05-23 via stack capture). Override
  // that one global with a non-destructive replacement that only touches text
  // nodes + tel:/data-phone attributes — never innerHTML, never the iframe.
  // Hibu's source-attribution number SELECTION (ybFun_ReplaceText) is unchanged;
  // only the DOM-write mechanism is made safe.
  window.ybFun_GenericFindAndReplaceNonJQuery = function (searchText, replacement, searchNode) {
    if (!searchText) return;
    var root = (searchNode && searchNode.nodeType === 1) ? searchNode : document.body;
    if (!root) return;
    // IMPORTANT: ybFun_CustomFindAndReplace passes searchText as a REGEX PATTERN —
    // it builds every format variant, including the formatted display
    // "\(512\)\s{0,}553-{0,1}\.{0,1}\s{0,}1674". Compile it as a regex (like the
    // vendor's jQuery path does); do NOT escape it. Escaping was the bug that left
    // the visible/formatted numbers un-swapped while only the raw tel: form changed.
    var rx, testRx;
    try { rx = new RegExp(searchText, 'g'); testRx = new RegExp(searchText); }
    catch (e) { return; }
    // 1) text nodes (the visible number), skipping script/style/iframe/noscript
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        if (!n.nodeValue || !testRx.test(n.nodeValue)) return NodeFilter.FILTER_REJECT;
        for (var p = n.parentNode; p && p !== root.parentNode; p = p.parentNode) {
          var t = p.nodeName;
          if (t === 'SCRIPT' || t === 'STYLE' || t === 'IFRAME' || t === 'NOSCRIPT') return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var hits = [], node;
    while ((node = walker.nextNode())) hits.push(node);
    hits.forEach(function (t) { t.nodeValue = t.nodeValue.replace(rx, replacement); });
    // 2) attributes (tel: href, data-phone, aria-label, value, …) — match the
    //    vendor's full coverage, but NEVER touch the <iframe> element (re-parenting
    //    or rewriting it reloads the embedded content — the original double-load bug).
    var els = root.querySelectorAll('*');
    Array.prototype.forEach.call(els, function (el) {
      if (el.tagName === 'IFRAME' || !el.attributes) return;
      for (var i = 0; i < el.attributes.length; i++) {
        var a = el.attributes[i];
        if (a.value && testRx.test(a.value)) el.setAttribute(a.name, a.value.replace(rx, replacement));
      }
    });
  };

  document.addEventListener('YextPhoneChangeEvent', yextPhoneChangeEventHandler, false);

  // Divi/dmAPI integration — runs the swap once the Divi page has hydrated
  // and again whenever a popup is opened (popups inject fresh DOM that
  // contains the un-swapped local number, so we need to re-run).
  if (typeof dmAPI !== 'undefined') {
    dmAPI.runOnReady('dpni', function () {
      setTimeout(ybFun_ReplaceText, 500);
    });
    window.addEventListener('DOMContentLoaded', function () {
      dmAPI.subscribeEvent(dmAPI.EVENTS.SHOW_POPUP, function () {
        setTimeout(ybFun_ReplaceText, 500);
      });
    });
  } else {
    // Plain HTML host page (our reference build) — Divi is absent, so just
    // wait for window.onload and run the swap once.
    window.addEventListener('load', function () {
      setTimeout(function () {
        if (typeof ybFun_ReplaceText === 'function') ybFun_ReplaceText();
      }, 500);
    });
  }
  /* eslint-enable no-undef */
})();
