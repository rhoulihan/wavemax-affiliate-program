/* Austin host-mock chrome wiring
 * Drives the chrome of dev/austin-host-mock.html from window.LOCATION_DATA.
 * No iframe content — that's the embedded app's job. This file owns:
 *   - data-bind substitutions across header, footer, breadcrumb
 *   - language switcher dropdown (writes to localStorage, dispatches event)
 *   - tab/nav active state
 *   - location-finder modal open/close + selection
 *   - mobile drawer toggle
 *   - bridge handshake setup (the actual bridge script is parent-iframe-bridge-v3.js)
 *
 * Runs after the bridge script. Reads window.LOCATION_DATA. CSP-clean.
 */
(function () {
  'use strict';

  const LANGUAGE_KEY = 'wavemax-language';
  const LANGUAGES = [
    { code: 'en', label: 'English',    flag: '🇺🇸' },
    { code: 'es', label: 'Español',    flag: '🇲🇽' },
    { code: 'pt', label: 'Português',  flag: '🇧🇷' },
    { code: 'de', label: 'Deutsch',    flag: '🇩🇪' }
  ];

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }
  function $$(sel, root) {
    return Array.from((root || document).querySelectorAll(sel));
  }

  function applyDataBindings() {
    const data = window.LOCATION_DATA;
    if (!data) return;
    $$('[data-bind]').forEach(el => {
      const path = el.getAttribute('data-bind');
      const value = path.split('.').reduce((acc, key) => (acc == null ? acc : acc[key]), data);
      if (value === undefined || value === null) return;
      const attr = el.getAttribute('data-bind-attr');
      if (attr) {
        el.setAttribute(attr, String(value));
      } else {
        el.textContent = String(value);
      }
    });
  }

  /* ---------- Language switcher ---------- */

  function initLanguageSwitcher() {
    const root = $('.wmv3-lang');
    if (!root) return;
    const btn = $('.wmv3-lang-btn', root);
    const menu = $('.wmv3-lang-menu', root);
    if (!btn || !menu) return;

    const available = (window.LOCATION_DATA?.i18n?.languagesAvailable) || ['en', 'es'];
    menu.innerHTML = '';

    LANGUAGES.forEach(lang => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'wmv3-lang-item';
      item.setAttribute('data-lang', lang.code);
      item.innerHTML = `<span class="wmv3-lang-flag" aria-hidden="true">${lang.flag}</span><span>${lang.label}</span>`;
      if (!available.includes(lang.code)) {
        item.classList.add('wmv3-lang-item--unavailable');
        item.setAttribute('disabled', '');
        item.setAttribute('title', 'Available on iframe-wrapped pages only');
      }
      item.addEventListener('click', () => {
        if (item.hasAttribute('disabled')) return;
        setLanguage(lang.code);
        closeMenu();
      });
      menu.appendChild(item);
    });

    function openMenu()  { root.setAttribute('aria-expanded', 'true'); }
    function closeMenu() { root.setAttribute('aria-expanded', 'false'); }
    function toggle()    {
      root.getAttribute('aria-expanded') === 'true' ? closeMenu() : openMenu();
    }

    btn.addEventListener('click', toggle);
    document.addEventListener('click', (e) => {
      if (!root.contains(e.target)) closeMenu();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeMenu();
    });

    refreshActiveLanguage();
  }

  function setLanguage(lang) {
    localStorage.setItem(LANGUAGE_KEY, lang);
    window.dispatchEvent(new CustomEvent('languageChanged', { detail: { language: lang } }));
    refreshActiveLanguage();
    applyChromeTranslations(lang);
  }

  function refreshActiveLanguage() {
    const active = localStorage.getItem(LANGUAGE_KEY) || 'en';
    const current = LANGUAGES.find(l => l.code === active) || LANGUAGES[0];

    const btnFlag = $('.wmv3-lang-btn .wmv3-lang-flag');
    const btnLabel = $('.wmv3-lang-btn span:not(.wmv3-lang-flag):not(.wmv3-lang-arrow)');
    if (btnFlag) btnFlag.textContent = current.flag;
    if (btnLabel) btnLabel.textContent = current.code.toUpperCase();

    $$('.wmv3-lang-item').forEach(item => {
      item.setAttribute('aria-selected', item.getAttribute('data-lang') === active ? 'true' : 'false');
    });
  }

  /* ---------- Chrome translations (en/es local; pt/de come from iframe) ---------- */

  const CHROME_STRINGS = {
    en: {
      'chrome.callUs': 'CALL US',
      'chrome.openHours': 'OPEN',
      'chrome.address': 'VISIT US',
      'chrome.locations': 'Locations',
      'chrome.findLocation': 'Find a location',
      'chrome.signIn': 'Sign in',
      'chrome.nav.home': 'Home',
      'chrome.nav.wdf': 'Wash · Dry · Fold',
      'chrome.nav.selfserve': 'Self-Serve Laundry',
      'chrome.nav.commercial': 'Commercial',
      'chrome.nav.about': 'About Us',
      'chrome.nav.contact': 'Contact',
      'chrome.bc.home': 'Home',
      'chrome.footer.localLinks': 'Local Links',
      'chrome.footer.contact': 'Contact',
      'chrome.footer.allLocations': 'All Locations',
      'chrome.footer.copy': '© 2026 CRHS Enterprises, LLC. All rights reserved.'
    },
    es: {
      'chrome.callUs': 'LLÁMANOS',
      'chrome.openHours': 'ABIERTO',
      'chrome.address': 'VISÍTANOS',
      'chrome.locations': 'Ubicaciones',
      'chrome.findLocation': 'Buscar ubicación',
      'chrome.signIn': 'Iniciar sesión',
      'chrome.nav.home': 'Inicio',
      'chrome.nav.wdf': 'Lavar · Secar · Doblar',
      'chrome.nav.selfserve': 'Autoservicio',
      'chrome.nav.commercial': 'Comercial',
      'chrome.nav.about': 'Sobre Nosotros',
      'chrome.nav.contact': 'Contacto',
      'chrome.bc.home': 'Inicio',
      'chrome.footer.localLinks': 'Enlaces Locales',
      'chrome.footer.contact': 'Contacto',
      'chrome.footer.allLocations': 'Todas las Ubicaciones',
      'chrome.footer.copy': '© 2026 CRHS Enterprises, LLC. Todos los derechos reservados.'
    }
  };

  // pt + de come from the iframe via bridge in production; fallback shown here.
  const CHROME_FALLBACK = CHROME_STRINGS.en;
  let bridgeFedChromeStrings = {};

  function applyChromeTranslations(lang) {
    const dict = CHROME_STRINGS[lang] || bridgeFedChromeStrings[lang] || CHROME_FALLBACK;
    $$('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      const value = dict[key];
      if (value !== undefined) {
        if (el.hasAttribute('data-i18n-html')) el.innerHTML = value;
        else el.textContent = value;
      } else if (CHROME_FALLBACK[key]) {
        if (el.hasAttribute('data-i18n-html')) el.innerHTML = CHROME_FALLBACK[key];
        else el.textContent = CHROME_FALLBACK[key];
      }
    });
  }

  /* ---------- Location modal ---------- */

  function initLocationModal() {
    const trigger = $('[data-locmodal-open]');
    const overlay = $('#locModal');
    if (!overlay) return;
    const closeBtn = $('.wm-modal-close', overlay);

    function open() {
      overlay.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      $('.wm-modal-search input', overlay)?.focus();
    }
    function close() {
      overlay.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    }
    trigger?.addEventListener('click', open);
    closeBtn?.addEventListener('click', close);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && overlay.getAttribute('aria-hidden') === 'false') close();
    });
  }

  /* ---------- Active nav state ---------- */

  function initActiveNav() {
    const path = window.location.pathname;
    const params = new URLSearchParams(window.location.search);
    const route = params.get('route') || '';
    $$('.wmlnav-tab').forEach(tab => {
      const target = tab.getAttribute('data-route');
      if (target && (route === target || (route === '' && target === '/'))) {
        tab.setAttribute('aria-current', 'page');
      }
    });
  }

  /* ---------- Iframe route loader ----------
   * Map of routes we OWN to direct iframe sources. Other routes fall through
   * to the existing embed-app-v2 SPA router. As Phase 2/3/4 land, this map
   * grows; the entry for `/` falls back to the stub during Phase 1 foundation
   * verification, and is replaced by `austin-landing-v3-embed.html` in Phase 2.
   */
  const ROUTE_MAP = {
    '/':                    '/dev/austin-stub-embed.html',
    '/wash-dry-fold':       '/wash-dry-fold-embed.html',
    '/self-serve-laundry':  '/self-serve-laundry-embed.html'
  };

  function loadIframeRoute() {
    const iframe = $('#wavemax-iframe');
    if (!iframe) return;
    const params = new URLSearchParams(window.location.search);
    const route = params.get('route') || '/';
    const direct = ROUTE_MAP[route];
    iframe.src = direct || `/embed-app-v2.html?route=${encodeURIComponent(route)}`;
  }

  /* ---------- Init ---------- */

  function init() {
    applyDataBindings();
    applyChromeTranslations(localStorage.getItem(LANGUAGE_KEY) || 'en');
    initLanguageSwitcher();
    initLocationModal();
    initActiveNav();
    loadIframeRoute();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
