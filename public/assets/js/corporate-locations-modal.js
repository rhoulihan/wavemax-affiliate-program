/* corporate-locations-modal.js
 *
 * Self-contained locations modal for corporate-content pages on
 * wavemax.promo. Adapted from austin-host-mock.js's initLocationModal,
 * but stripped of franchise-host-specific dependencies so it runs
 * standalone on /franchise/, /about/, /testimonials/, etc.
 *
 * The modal markup itself is injected by corporate-chrome.js into a
 * #wm-corp-locmodal container. This script:
 *   - Fetches the Google Maps API key from /api/v1/maps-config
 *   - Lazy-loads Google Maps + the franchise list on first modal open
 *   - Wires data-locmodal-open / data-locmodal-close click handlers
 *   - Renders franchise tiles grouped by state + a map with markers
 *   - Search filters by city/state/zip
 *   - "Visit Site" navigates to /:slug/, "Directions" opens Google Maps
 */
(function () {
  'use strict';

  let mapsPromise = null;
  let mapsKeyPromise = null;

  function loadMapsKey() {
    if (mapsKeyPromise) return mapsKeyPromise;
    if (window.GOOGLE_PLACES_API_KEY) {
      mapsKeyPromise = Promise.resolve(window.GOOGLE_PLACES_API_KEY);
      return mapsKeyPromise;
    }
    mapsKeyPromise = fetch('/api/v1/maps-config', { credentials: 'same-origin' })
      .then((r) => r.ok ? r.json() : { apiKey: '' })
      .then((d) => {
        const key = (d && d.apiKey) || '';
        if (key) window.GOOGLE_PLACES_API_KEY = key;
        return key;
      })
      .catch(() => '');
    return mapsKeyPromise;
  }

  function loadGoogleMaps() {
    if (window.google && window.google.maps && window.google.maps.Map) {
      return Promise.resolve(window.google);
    }
    if (mapsPromise) return mapsPromise;

    mapsPromise = loadMapsKey().then((apiKey) => new Promise((resolve, reject) => {
      if (!apiKey) return reject(new Error('Google Maps API key unavailable'));
      const cbName = '__wmGoogleMapsReady_' + Date.now();
      window[cbName] = () => { delete window[cbName]; resolve(window.google); };
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&loading=async&libraries=marker&callback=${cbName}`;
      script.async = true;
      script.defer = true;
      script.onerror = () => { delete window[cbName]; reject(new Error('Google Maps failed to load')); };
      document.head.appendChild(script);
    }));
    return mapsPromise;
  }

  let franchisesPromise = null;
  function loadFranchises() {
    if (franchisesPromise) return franchisesPromise;
    franchisesPromise = fetch('/api/v1/franchises', { credentials: 'same-origin' })
      .then((r) => r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)))
      .then((body) => Array.isArray(body.franchises) ? body.franchises : []);
    return franchisesPromise;
  }

  const WM_MAP_STYLE = [
    { elementType: 'geometry',          stylers: [{ color: '#1e3a5f' }] },
    { elementType: 'labels.text.stroke',stylers: [{ color: '#0f2035' }] },
    { elementType: 'labels.text.fill',  stylers: [{ color: '#a3b8d4' }] },
    { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#cfdcee' }] },
    { featureType: 'poi',                     elementType: 'all',              stylers: [{ visibility: 'off' }] },
    { featureType: 'road',          elementType: 'geometry', stylers: [{ color: '#254876' }] },
    { featureType: 'road',          elementType: 'labels.text.fill', stylers: [{ color: '#90a4c0' }] },
    { featureType: 'road.highway',  elementType: 'geometry', stylers: [{ color: '#2c5396' }] },
    { featureType: 'transit',       elementType: 'all',      stylers: [{ visibility: 'off' }] },
    { featureType: 'water',         elementType: 'geometry', stylers: [{ color: '#0f2035' }] },
    { featureType: 'water',         elementType: 'labels.text.fill', stylers: [{ color: '#5a7398' }] }
  ];

  const US_STATE_NAMES = {
    AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
    CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
    HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
    KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
    MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri',
    MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
    NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio',
    OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
    SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont',
    VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
    DC: 'District of Columbia'
  };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function init() {
    // Lazy-resolved DOM refs — corporate-chrome.js injects the modal
    // markup, but its DOMContentLoaded listener may run AFTER ours
    // (defer scripts run in document order). So we don't snapshot
    // element references at init time; we query at open() time.
    function $(id) { return document.getElementById(id); }

    let map = null;
    let markersBySlug = new Map();
    let franchises = [];
    let initialized = false;
    let selectedSlug = null;

    function open() {
      const overlay = $('locModal');
      const search  = $('locSearch');
      if (!overlay) {
        console.warn('[locModal] modal markup not found in DOM');
        return;
      }
      overlay.setAttribute('aria-hidden', 'false');
      overlay.classList.add('open');
      document.body.classList.add('wm-noscroll'); // CSP-safe class-toggle
      if (!initialized) initialize();
      if (map) setTimeout(() => google.maps.event.trigger(map, 'resize'), 100);
      if (search) search.focus();
    }
    function close() {
      const overlay = $('locModal');
      if (!overlay) return;
      overlay.setAttribute('aria-hidden', 'true');
      overlay.classList.remove('open');
      document.body.classList.remove('wm-noscroll'); // CSP-safe class-toggle
    }

    async function initialize() {
      if (initialized) return;
      initialized = true;
      const status = $('modalStatus');
      const statusText = $('modalStatusText');
      try {
        if (status) { status.hidden = false; if (statusText) statusText.textContent = 'Loading franchises…'; }
        const [google, fs] = await Promise.all([loadGoogleMaps(), loadFranchises()]);
        franchises = fs;
        if (status) status.hidden = true;
        renderTiles(franchises);
        renderMap(google, franchises);
      } catch (err) {
        console.error('[locModal] init failed', err);
        if (status) { status.hidden = false; if (statusText) statusText.textContent = 'Could not load franchise list — please try again.'; }
      }
    }

    function renderTiles(items) {
      const list = $('locList');
      if (!list) return;
      list.innerHTML = '';
      const byState = new Map();
      for (const f of items) {
        const k = f.state || '—';
        if (!byState.has(k)) byState.set(k, []);
        byState.get(k).push(f);
      }
      const states = Array.from(byState.keys()).sort((a, b) =>
        (US_STATE_NAMES[a] || a).localeCompare(US_STATE_NAMES[b] || b)
      );
      for (const stateAbbr of states) {
        const stateFull = US_STATE_NAMES[stateAbbr] || stateAbbr;
        const head = document.createElement('h4');
        head.className = 'modal-state';
        head.textContent = stateFull;
        list.appendChild(head);
        const rowFranchises = byState.get(stateAbbr).slice().sort((a, b) => (a.city || '').localeCompare(b.city || ''));
        for (const f of rowFranchises) {
          const tile = document.createElement('button');
          tile.type = 'button';
          tile.className = 'modal-tile';
          tile.dataset.slug = f.slug;
          tile.innerHTML =
            `<div class="modal-tile-name">${esc(f.city || f.slug)}</div>` +
            `<div class="modal-tile-addr">${esc(f.address || '')}</div>`;
          tile.addEventListener('click', () => selectFranchise(f.slug, { centerMap: true, zoom: 15 }));
          list.appendChild(tile);
        }
      }
    }

    function renderMap(google, items) {
      const mapEl = $('locMap');
      if (!mapEl || !google) return;
      const bounds = new google.maps.LatLngBounds();
      let hasPoints = false;

      map = new google.maps.Map(mapEl, {
        zoom: 4,
        center: { lat: 39.5, lng: -98.35 },
        styles: WM_MAP_STYLE,
        disableDefaultUI: false,
        clickableIcons: false,
        gestureHandling: 'greedy'
      });

      for (const f of items) {
        const lat = parseFloat(f.lat);
        const lng = parseFloat(f.lng);
        if (!isFinite(lat) || !isFinite(lng)) continue;
        const pos = { lat, lng };
        const marker = new google.maps.Marker({
          position: pos,
          map,
          title: f.city || f.slug,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: '#f5a623',
            fillOpacity: 1.0,
            strokeColor: '#143852',
            strokeWeight: 2
          }
        });
        marker.addListener('click', () => selectFranchise(f.slug, { centerMap: true, zoom: 14 }));
        markersBySlug.set(f.slug, { marker, pos, franchise: f });
        bounds.extend(pos);
        hasPoints = true;
      }
      if (hasPoints) map.fitBounds(bounds, 60);
    }

    function selectFranchise(slug, opts) {
      const opt = opts || {};
      const data = markersBySlug.get(slug);
      if (!data) return;
      selectedSlug = slug;
      const f = data.franchise;

      const selectedName   = $('locSelectedName');
      const selectedAddr   = $('locSelectedAddr');
      const directionsLink = $('locActionDirections');
      const visitLink      = $('locActionVisit');
      const actions        = $('locActions');
      const list           = $('locList');

      if (selectedName) selectedName.textContent = f.city || f.slug;
      if (selectedAddr) selectedAddr.textContent = f.address || '';
      if (directionsLink && f.mapsUrl) directionsLink.href = f.mapsUrl;
      else if (directionsLink && f.address) directionsLink.href = 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(f.address);
      if (visitLink) visitLink.href = '/' + encodeURIComponent(slug) + '/';
      if (actions) actions.hidden = false;

      Array.from((list || document).querySelectorAll('.modal-tile')).forEach((t) => {
        t.classList.toggle('is-active', t.dataset.slug === slug);
      });

      if (opt.centerMap && map) {
        map.panTo(data.pos);
        if (opt.zoom) map.setZoom(opt.zoom);
      }
    }

    // Search input is delegated through document so we don't need a
    // hard reference to the element at init time.
    document.addEventListener('input', (e) => {
      if (!e.target || e.target.id !== 'locSearch') return;
      const q = e.target.value.trim().toLowerCase();
      if (!q) { renderTiles(franchises); return; }
      const filtered = franchises.filter((f) => {
        const stateFull = (US_STATE_NAMES[f.state] || '').toLowerCase();
        return [f.city, f.state, stateFull, f.zip, f.address]
          .filter(Boolean)
          .map((s) => String(s).toLowerCase())
          .some((s) => s.includes(q));
      });
      renderTiles(filtered);
    });

    // Wire global click handlers (run regardless of whether modal
    // markup exists yet — open() resolves the overlay lazily).
    document.addEventListener('click', (e) => {
      const t = e.target;
      if (!t || !t.closest) return;

      if (t.closest('[data-locmodal-open], [data-action="open-locations"]')) {
        e.preventDefault();
        open();
        return;
      }
      if (t.closest('[data-locmodal-close]')) { e.preventDefault(); close(); return; }

      const overlay = $('locModal');
      if (overlay && t === overlay) close();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      const overlay = $('locModal');
      if (overlay && overlay.classList.contains('open')) close();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
