/* Smart "back to offer" link behavior.
 *
 * Used on the security-audit and clickjacking-demo pages. The link's href
 * carries an anchor pointing back at the originating callout on the main
 * offer page (e.g. /wavemax/#audit-callout), so a direct-URL visit lands
 * at the right place. But when the visitor arrived here by clicking
 * forward FROM the offer page, history.back() returns them to the exact
 * scroll position + tab state they had — better UX than re-loading the
 * offer page and scrolling to an anchor.
 *
 * This script picks history.back() over the href when the document
 * referrer is the offer page (i.e. /wavemax/ root, not another secondary
 * page), and falls back to the href navigation otherwise.
 */
(function () {
  'use strict';

  function cameFromOfferPage() {
    var ref = document.referrer || '';
    if (!ref) return false;
    try {
      var u = new URL(ref);
      // Same origin
      if (u.origin !== window.location.origin) return false;
      // Path under /wavemax/, but NOT one of the secondary pages
      if (u.pathname === '/wavemax/' || u.pathname === '/wavemax') return true;
      if (u.pathname === '/wavemax/index.html') return true;
      return false;
    } catch (e) { return false; }
  }

  document.querySelectorAll('[data-back-to-offer]').forEach(function (link) {
    link.addEventListener('click', function (e) {
      if (cameFromOfferPage() && history.length > 1) {
        e.preventDefault();
        history.back();
      }
      // else: let the default href (with anchor) navigate normally
    });
  });
})();
