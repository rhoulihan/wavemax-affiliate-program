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
    var find = String(searchText);
    var root = (searchNode && searchNode.nodeType === 1) ? searchNode : document.body;
    if (!root) return;
    var rx = new RegExp(find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    // 1) text nodes only, skipping script/style/iframe/noscript subtrees
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        if (!n.nodeValue || n.nodeValue.indexOf(find) === -1) return NodeFilter.FILTER_REJECT;
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
    // 2) the call-tracking link itself (tel: href / data-phone)
    try {
      root.querySelectorAll('a[href*="' + find + '"], [data-phone*="' + find + '"]').forEach(function (el) {
        if (el.hasAttribute('href')) el.setAttribute('href', el.getAttribute('href').replace(rx, replacement));
        if (el.hasAttribute('data-phone')) el.setAttribute('data-phone', el.getAttribute('data-phone').replace(rx, replacement));
      });
    } catch (e) { /* text-node pass already covered the visible number */ }
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
