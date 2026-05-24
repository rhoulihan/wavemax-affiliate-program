/* franchise-map-lazy.js
 *
 * Lazy-loads the embedded Google Maps iframe so the ~20 Maps JS/tile
 * requests it pulls aren't on the critical path for first paint. The map
 * lives well below the fold (page footer / contact page bottom), so a user
 * who never scrolls there never pays for it.
 *
 * Markup contract (CSP-clean — no inline JS, no onload handlers):
 *
 *   <iframe data-map-src-bind="contact.mapsEmbedUrl" src="" loading="lazy" ...>
 *       deferred URL resolved from a LOCATION_DATA dotted path, OR
 *   <iframe data-map-src="https://www.google.com/maps?..." src="" loading="lazy" ...>
 *       deferred literal URL.
 *
 * The iframe's real src is attached only when it scrolls within ~400px of
 * the viewport (IntersectionObserver). On browsers without
 * IntersectionObserver we fall back to attaching immediately so the map
 * still renders.
 *
 * Works on both surfaces:
 *   - Host page (franchise-host.html): window.LOCATION_DATA is injected
 *     synchronously by the server, so the bind path resolves right away.
 *   - Iframe content (franchise-default/contact.html): LOCATION_DATA arrives
 *     via the bridge; we subscribe to IframeBridge.onLocationData and also
 *     read window.LOCATION_DATA as a fallback.
 */
(function () {
  'use strict';

  var ROOT_MARGIN = '400px';

  function resolvePath(obj, path) {
    if (!obj || !path) return undefined;
    return path.split('.').reduce(function (acc, key) {
      return acc == null ? acc : acc[key];
    }, obj);
  }

  // Resolve the deferred URL for a map iframe from its data-map-src (literal)
  // or data-map-src-bind (LOCATION_DATA path). Returns '' when not yet
  // resolvable (e.g. location-data hasn't arrived in the iframe).
  function resolveMapUrl(el, locationData) {
    var literal = el.getAttribute('data-map-src');
    if (literal) return literal;
    var bind = el.getAttribute('data-map-src-bind');
    if (bind) {
      var v = resolvePath(locationData, bind);
      return v == null ? '' : String(v);
    }
    return '';
  }

  function attach(el, url) {
    if (!url) return false;
    if (el.getAttribute('src')) return true; // already attached
    el.setAttribute('src', url);
    el.setAttribute('data-map-loaded', '1');
    return true;
  }

  function currentLocationData() {
    if (window.LOCATION_DATA) return window.LOCATION_DATA;
    var bridge = window.IframeBridge;
    if (bridge && typeof bridge.getLocationData === 'function') {
      return bridge.getLocationData();
    }
    return null;
  }

  function init() {
    var maps = Array.prototype.slice.call(
      document.querySelectorAll('iframe[data-map-src], iframe[data-map-src-bind]')
    );
    if (!maps.length) return;

    var pending = maps.filter(function (el) { return !el.getAttribute('src'); });
    if (!pending.length) return;

    // The observer fires the load when the map nears the viewport. We resolve
    // the URL lazily at fire time so it works even if LOCATION_DATA arrived
    // after this script ran (iframe/bridge case).
    var observer = null;
    if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var el = entry.target;
          var url = resolveMapUrl(el, currentLocationData());
          if (attach(el, url)) observer.unobserve(el);
        });
      }, { rootMargin: ROOT_MARGIN });
      pending.forEach(function (el) { observer.observe(el); });
    } else {
      // No IntersectionObserver: attach now (still better than blocking first
      // paint, since the request fires after this deferred script runs).
      pending.forEach(function (el) { attach(el, resolveMapUrl(el, currentLocationData())); });
    }

    // When location-data arrives in the iframe, the path-bound URL becomes
    // resolvable. If the map is already in view (small viewports / short
    // pages), the observer may have fired before the data was ready — re-run
    // the resolve for any still-pending in-view maps.
    if (window.IframeBridge && typeof window.IframeBridge.onLocationData === 'function') {
      window.IframeBridge.onLocationData(function (data) {
        pending.forEach(function (el) {
          if (el.getAttribute('src')) return;
          // Only attach if the map is on/near screen; otherwise leave it for
          // the observer so we keep the lazy benefit.
          var rect = el.getBoundingClientRect();
          var nearViewport = rect.top < (window.innerHeight + 400) && rect.bottom > -400;
          if (nearViewport) {
            var url = resolveMapUrl(el, data || currentLocationData());
            if (attach(el, url) && observer) observer.unobserve(el);
          }
        });
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
