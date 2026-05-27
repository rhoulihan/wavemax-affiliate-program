/* Smart back-navigation + hash-target focus for crhsent secondary pages.
 *
 * Smart back: any <a data-back-to-offer> or <a data-back-to-audit> link
 * inspects document.referrer. If the visitor arrived from the link's
 * target path (the path component of the link's own href), use
 * history.back() — preserves exact scroll + tab + JS state. Otherwise
 * let the default href navigation (with anchor) take over.
 *
 * Hash-target focus: when this page loads with a URL hash matching a
 * known callout (e.g. /wavemax/security-audit.html#demo-callout), scroll
 * the callout into view and focus its primary button. So a visitor
 * arriving from the clickjacking demo lands directly on the "View the
 * live clickjacking demonstration →" button rather than having to scan
 * the §5 security section.
 */
(function () {
  'use strict';

  function pathOf(url) {
    try { return new URL(url, window.location.href).pathname; }
    catch (e) { return ''; }
  }

  function smartBackOnClick(e) {
    var link = e.currentTarget;
    var hrefPath = pathOf(link.getAttribute('href') || '');
    if (!hrefPath) return;
    var ref = document.referrer || '';
    if (!ref) return;
    var refPath;
    try { refPath = new URL(ref).pathname; } catch (err) { return; }
    var refOrigin;
    try { refOrigin = new URL(ref).origin; } catch (err) { return; }
    if (refOrigin !== window.location.origin) return;

    // Normalize trailing-index for the offer-page root
    var normalize = function (p) {
      if (p === '/wavemax' || p === '/wavemax/' || p === '/wavemax/index.html') return '/wavemax/';
      return p;
    };
    if (normalize(refPath) === normalize(hrefPath) && history.length > 1) {
      e.preventDefault();
      history.back();
    }
  }

  document.querySelectorAll('[data-back-to-offer], [data-back-to-audit]').forEach(function (link) {
    link.addEventListener('click', smartBackOnClick);
  });

  // Hash-target focus: callout id -> id of the primary button inside it to focus
  var focusMap = {
    'demo-callout': 'demo-btn',
  };
  function handleHashFocus() {
    var id = (location.hash || '').slice(1);
    if (!id || !focusMap[id]) return;
    var target = document.getElementById(id);
    if (!target) return;
    setTimeout(function () {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      var btn = document.getElementById(focusMap[id]);
      if (btn) {
        // After the smooth-scroll begins, focus the button. preventScroll
        // so the focus doesn't fight the smooth-scroll animation.
        setTimeout(function () {
          try { btn.focus({ preventScroll: true }); } catch (e) { btn.focus(); }
        }, 450);
      }
    }, 60);
  }
  handleHashFocus();
  window.addEventListener('hashchange', handleHashFocus);
})();
