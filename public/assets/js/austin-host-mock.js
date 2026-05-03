/* Austin host-mock chrome wiring (visual-fidelity rebuild)
 * Drives the chrome of dev/austin-host-mock.html from window.LOCATION_DATA
 * and routes the iframe based on the URL ?route= parameter.
 *
 * Owns:
 *   - data-bind substitutions across header / breadcrumb / footer / modal
 *   - language switcher (en/es/pt/de) — drives the bridge protocol
 *   - location-finder modal open/close (F2 fix: selectable)
 *   - mobile drawer toggle for the wmv3 stack
 *   - active-nav highlight (wmlnav-on)
 *   - iframe route loader
 *
 * Loaded after parent-iframe-bridge-v3.js (which owns the iframe message
 * protocol) so window.WaveMaxBridgeV3 is available here.
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

  /* Routes we OWN. Map grows as Phase 2/3/4 land. Anything not in the map
   * routes through embed-app-v2 (the existing SPA router). */
  const ROUTE_MAP = {
    '/':                          '/dev/austin-stub-embed.html',
    '/wash-dry-fold':             '/wash-dry-fold-embed.html',
    '/self-serve-laundry':        '/self-serve-laundry-embed.html'
  };

  const ROUTE_BREADCRUMBS = {
    '/':                          'Home',
    '/wash-dry-fold':             'Wash · Dry · Fold',
    '/self-serve-laundry':        'Self-Service Laundry',
    '/commercial':                'Commercial',
    '/commercial/medical-offices':'Medical Offices',
    '/commercial/health-clubs':   'Health Clubs',
    '/commercial/airbnb-rentals': 'Airbnb & Rentals',
    '/about-us':                  'About Us',
    '/contact':                   'Contact'
  };

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }

  /* ---------- data-bind ---------- */

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
    const root = document.getElementById('wm-lang');
    if (!root) return;
    const btn = root.querySelector('.wm-lang-btn');
    const menu = root.querySelector('.wm-lang-menu');
    if (!btn || !menu) return;

    const available = (window.LOCATION_DATA?.i18n?.languagesAvailable) || ['en', 'es'];
    menu.innerHTML = '';

    LANGUAGES.forEach(lang => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'wm-lang-item';
      item.setAttribute('data-lang', lang.code);
      item.style.cssText = `
        display: flex; align-items: center; gap: 8px;
        width: 100%; padding: 10px 14px;
        background: transparent; border: 0; text-align: left;
        cursor: pointer; color: rgba(255,255,255,0.85);
        font-size: 13px; font-weight: 500; font-family: 'Poppins', sans-serif;
        border-bottom: 1px solid rgba(255,255,255,0.08);
      `;
      item.innerHTML = `<span aria-hidden="true">${lang.flag}</span><span>${lang.label}</span>`;
      if (!available.includes(lang.code)) {
        item.style.opacity = '0.4';
        item.disabled = true;
        item.title = 'Available on iframe-wrapped pages only';
      }
      item.addEventListener('click', () => {
        if (item.disabled) return;
        setLanguage(lang.code);
        closeMenu();
      });
      item.addEventListener('mouseenter', () => {
        if (!item.disabled) item.style.background = 'rgba(255,255,255,0.08)';
      });
      item.addEventListener('mouseleave', () => { item.style.background = 'transparent'; });
      menu.appendChild(item);
    });

    function openMenu()  { root.setAttribute('aria-expanded', 'true');  menu.style.display = 'block'; }
    function closeMenu() { root.setAttribute('aria-expanded', 'false'); menu.style.display = 'none'; }
    function toggle()    { root.getAttribute('aria-expanded') === 'true' ? closeMenu() : openMenu(); }

    btn.addEventListener('click', toggle);
    document.addEventListener('click', (e) => { if (!root.contains(e.target)) closeMenu(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });

    refreshActiveLanguage();
  }

  function setLanguage(lang) {
    if (window.WaveMaxBridgeV3?.setLanguage) {
      window.WaveMaxBridgeV3.setLanguage(lang);
    } else {
      localStorage.setItem(LANGUAGE_KEY, lang);
      window.dispatchEvent(new CustomEvent('languageChanged', { detail: { language: lang } }));
    }
    refreshActiveLanguage();
    applyChromeTranslations(lang);
  }

  function refreshActiveLanguage() {
    const active = localStorage.getItem(LANGUAGE_KEY) || 'en';
    const current = LANGUAGES.find(l => l.code === active) || LANGUAGES[0];

    const btnFlag = $('.wm-lang-current-flag');
    const btnLabel = $('.wm-lang-current-label');
    if (btnFlag) btnFlag.textContent = current.flag;
    if (btnLabel) btnLabel.textContent = current.code.toUpperCase();
  }

  /* ---------- Chrome translations (en/es local; pt/de come from iframe via bridge) ---------- */

  const CHROME_STRINGS = {
    en: {
      'chrome.callUs': 'CALL US',
      'chrome.lastWash': 'LAST WASH',
      'chrome.address': 'VISIT US',
      'chrome.locations': 'Locations',
      'chrome.franchise': 'Franchise',
      'chrome.findLocation': 'Find a Location',
      'chrome.bc.home': 'Home',
      'chrome.footer.localLinks': 'Local Links',
      'chrome.footer.contact': 'Visit / Call / Email',
      'chrome.footer.serviceArea': 'Service Area'
    },
    es: {
      'chrome.callUs': 'LLÁMANOS',
      'chrome.lastWash': 'ÚLTIMO LAVADO',
      'chrome.address': 'VISÍTANOS',
      'chrome.locations': 'Ubicaciones',
      'chrome.franchise': 'Franquicia',
      'chrome.findLocation': 'Buscar ubicación',
      'chrome.bc.home': 'Inicio',
      'chrome.footer.localLinks': 'Enlaces Locales',
      'chrome.footer.contact': 'Visitar / Llamar / Correo',
      'chrome.footer.serviceArea': 'Área de Servicio'
    }
  };

  function applyChromeTranslations(lang) {
    const dict = CHROME_STRINGS[lang] || CHROME_STRINGS.en;
    $$('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      const value = dict[key] || CHROME_STRINGS.en[key];
      if (value !== undefined) {
        if (el.hasAttribute('data-i18n-html')) el.innerHTML = value;
        else el.textContent = value;
      }
    });
  }

  /* ---------- Location modal ---------- */

  function initLocationModal() {
    const overlay = document.getElementById('locModal');
    if (!overlay) return;

    const open = () => {
      overlay.setAttribute('aria-hidden', 'false');
      overlay.classList.add('open');
      document.body.style.overflow = 'hidden';
      $('#locSearch')?.focus();
    };
    const close = () => {
      overlay.setAttribute('aria-hidden', 'true');
      overlay.classList.remove('open');
      document.body.style.overflow = '';
    };

    $$('[data-locmodal-open]').forEach(t => t.addEventListener('click', open));
    $$('[data-locmodal-close]').forEach(t => t.addEventListener('click', close));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && overlay.getAttribute('aria-hidden') === 'false') close();
    });

    // Selectable cards (F2a fix)
    $$('.loc-card', overlay).forEach(card => {
      card.addEventListener('click', () => {
        $$('.loc-card', overlay).forEach(c => c.setAttribute('aria-selected', 'false'));
        card.setAttribute('aria-selected', 'true');
        const slug = card.getAttribute('data-loc-slug');
        if (slug && slug !== window.LOCATION_DATA?.slug) {
          // For the demo only one franchisee is wired; cross-franchise routing
          // would happen here when multi-location support lands.
          console.info('[host] location selected:', slug);
        }
        close();
      });
    });

    // Search filter (basic — for demo, only one location)
    const search = $('#locSearch');
    if (search) {
      search.addEventListener('input', (e) => {
        const q = e.target.value.toLowerCase();
        $$('.loc-card', overlay).forEach(card => {
          const text = (card.textContent || '').toLowerCase();
          card.style.display = q && !text.includes(q) ? 'none' : '';
        });
      });
    }
  }

  /* ---------- Mobile drawer (wmv3) ---------- */

  function initMobileDrawer() {
    const burger = document.getElementById('wmv3-burger');
    const drawer = document.getElementById('wmv3-drawer');
    if (!burger || !drawer) return;
    burger.addEventListener('click', () => {
      const open = burger.classList.toggle('is-open');
      drawer.classList.toggle('is-open', open);
      burger.setAttribute('aria-expanded', String(open));
    });
  }

  /* ---------- Active nav state + iframe route ---------- */

  function getActiveRoute() {
    const params = new URLSearchParams(window.location.search);
    return params.get('route') || '/';
  }

  function applyActiveNav(route) {
    $$('a[data-route]').forEach(a => {
      const r = a.getAttribute('data-route');
      const isActive = r === route;
      a.classList.toggle('wmlnav-on', isActive);
      a.classList.toggle('is-active', isActive);
      if (isActive) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });

    // Mark drop parent as active when one of its children matches
    $$('.wmlnav-drop').forEach(drop => {
      const childRoutes = $$('a[data-route]', drop).map(a => a.getAttribute('data-route'));
      const isActiveChild = childRoutes.some(r => r === route);
      drop.classList.toggle('wmlnav-on', isActiveChild);
    });

    // Update breadcrumb current label
    const bcCurrent = document.getElementById('wm-bc-current');
    if (bcCurrent) {
      const label = ROUTE_BREADCRUMBS[route];
      bcCurrent.textContent = (route === '/' || !label) ? 'WaveMAX Austin, TX' : label;
    }
  }

  function loadIframeRoute(route) {
    const iframe = document.getElementById('wavemax-iframe');
    if (!iframe) return;
    const direct = ROUTE_MAP[route];
    iframe.src = direct || `/embed-app-v2.html?route=${encodeURIComponent(route)}`;
  }

  /* ---------- Footer contact form (POST /api/v1/contact/austin-tx) ---------- */

  async function fetchCsrfToken() {
    try {
      const res = await fetch('/api/csrf-token', { credentials: 'include' });
      if (!res.ok) return null;
      const json = await res.json();
      return json.csrfToken || null;
    } catch (_) {
      return null;
    }
  }

  function initFooterContactForm() {
    const form = document.getElementById('wm-pgfooter-form');
    if (!form) return;

    const submitBtn = document.getElementById('wm-pgfooter-submit');
    const okAlert = document.getElementById('wm-pgfooter-alert-ok');
    const errAlert = document.getElementById('wm-pgfooter-alert-error');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      okAlert?.classList.remove('is-shown');
      errAlert?.classList.remove('is-shown');

      const fd = new FormData(form);
      const payload = {
        firstName: (fd.get('firstName') || '').toString().trim(),
        lastName:  (fd.get('lastName')  || '').toString().trim(),
        email:     (fd.get('email')     || '').toString().trim(),
        phone:     (fd.get('phone')     || '').toString().trim(),
        message:   (fd.get('message')   || '').toString().trim()
      };
      if (!payload.firstName || !payload.lastName || !payload.email || !payload.message) {
        errAlert.textContent = 'Please fill in name, email, and message.';
        errAlert.classList.add('is-shown');
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'SENDING…';

      try {
        const csrf = await fetchCsrfToken();
        const headers = { 'Content-Type': 'application/json' };
        if (csrf) headers['x-csrf-token'] = csrf;

        const slug = window.LOCATION_DATA?.slug || 'austin-tx';
        const res = await fetch(`/api/v1/contact/${slug}`, {
          method: 'POST',
          credentials: 'include',
          headers,
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          okAlert.classList.add('is-shown');
          form.reset();
        } else {
          let msg = "Sorry, that didn't go through. Please try again or call us directly.";
          try {
            const body = await res.json();
            if (body?.message) msg = body.message;
          } catch (_) {}
          errAlert.textContent = msg;
          errAlert.classList.add('is-shown');
        }
      } catch (_) {
        errAlert.textContent = "Network error — please try again or call us directly.";
        errAlert.classList.add('is-shown');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'SUBMIT →';
      }
    });
  }

  /* ---------- Init ---------- */

  function init() {
    applyDataBindings();
    applyChromeTranslations(localStorage.getItem(LANGUAGE_KEY) || 'en');
    initLanguageSwitcher();
    initLocationModal();
    initMobileDrawer();
    initFooterContactForm();

    const route = getActiveRoute();
    applyActiveNav(route);
    loadIframeRoute(route);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
