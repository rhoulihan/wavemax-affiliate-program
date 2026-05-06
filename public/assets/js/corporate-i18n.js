/* corporate-i18n.js
 *
 * Language switcher + translation engine for corporate-content pages.
 * Self-contained — does NOT depend on the iframe-bridge i18n used by
 * per-franchise host pages. Loads /locales/{lang}/corporate.json and
 * applies translations to elements marked with data-i18n / data-i18n-attr
 * attributes. Persists selected lang in localStorage as `wm-lang`.
 *
 * Languages supported: en (default), es, pt, de.
 *
 * Marker syntax:
 *   <h1 data-i18n="franchise.hero.title">English fallback</h1>
 *   <input data-i18n-attr='{"placeholder":"contact.email.placeholder"}'>
 */
(function () {
  'use strict';

  const SUPPORTED = ['en', 'es', 'pt', 'de'];
  const FLAGS     = { en: 'wm-flag-en', es: 'wm-flag-es', pt: 'wm-flag-pt', de: 'wm-flag-de' };
  const LABELS    = { en: 'English',    es: 'Español',   pt: 'Português', de: 'Deutsch'   };
  const SHORT     = { en: 'EN',         es: 'ES',        pt: 'PT',        de: 'DE'        };
  const STORAGE   = 'wm-lang';

  let dict = {};
  let currentLang = readLang();

  function readLang() {
    try {
      const saved = localStorage.getItem(STORAGE);
      if (saved && SUPPORTED.indexOf(saved) >= 0) return saved;
    } catch (_) { /* localStorage may be unavailable */ }
    return 'en';
  }

  function writeLang(lang) {
    try { localStorage.setItem(STORAGE, lang); } catch (_) {}
  }

  function fetchDict(lang) {
    return fetch(`/locales/${lang}/corporate.json`, { credentials: 'same-origin' })
      .then((r) => r.ok ? r.json() : {})
      .catch(() => ({}));
  }

  // Resolve "a.b.c" → dict.a.b.c. Returns null if unresolved.
  function resolve(key) {
    const parts = key.split('.');
    let v = dict;
    for (let i = 0; i < parts.length; i++) {
      if (v == null || typeof v !== 'object') return null;
      v = v[parts[i]];
    }
    return (typeof v === 'string') ? v : null;
  }

  function applyTranslations(root) {
    const scope = root || document;

    // text content
    scope.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      const v   = resolve(key);
      if (v != null) el.textContent = v;
    });

    // attribute translations: <el data-i18n-attr='{"placeholder":"key.path"}'>
    scope.querySelectorAll('[data-i18n-attr]').forEach((el) => {
      const raw = el.getAttribute('data-i18n-attr');
      if (!raw) return;
      let map; try { map = JSON.parse(raw); } catch (_) { return; }
      Object.keys(map).forEach((attr) => {
        const v = resolve(map[attr]);
        if (v != null) el.setAttribute(attr, v);
      });
    });

    // <html lang="…"> for accessibility / SEO
    document.documentElement.setAttribute('lang', currentLang);
  }

  /* ---------- LANG SWITCHER UI ---------- */
  function populateMenu(menuEl) {
    menuEl.innerHTML = SUPPORTED.map((lang) => `
      <button type="button" role="menuitem" class="wm-lang-item" data-lang="${lang}">
        <span class="wm-lang-flag ${FLAGS[lang]}" aria-hidden="true"></span>
        <span>${LABELS[lang]}</span>
      </button>
    `).join('');
  }

  function updateSwitcherDisplay(switcher) {
    const flag  = switcher.querySelector('.wm-lang-btn .wm-lang-flag');
    const label = switcher.querySelector('.wm-lang-current-label');
    if (flag)  { flag.className = 'wm-lang-flag ' + FLAGS[currentLang]; }
    if (label) { label.textContent = SHORT[currentLang]; }
  }

  function wireSwitcher() {
    // There can be multiple switchers on the page (desktop b2-right + mobile
    // wmv3-actions). Wire each one. CSS hides the inactive one based on
    // viewport, but both stay in the DOM so the lang menu works in either
    // breakpoint.
    const switchers = Array.prototype.slice.call(document.querySelectorAll('.wm-lang-switcher'));
    if (!switchers.length) return;

    switchers.forEach((switcher, idx) => {
      const menu = switcher.querySelector('.wm-lang-menu');
      if (menu) populateMenu(menu);
      updateSwitcherDisplay(switcher);

      switcher.addEventListener('click', (e) => {
        const item = e.target.closest('.wm-lang-item');
        if (item) {
          const lang = item.getAttribute('data-lang');
          if (lang && SUPPORTED.indexOf(lang) >= 0 && lang !== currentLang) {
            setLang(lang);
          }
          switcher.setAttribute('aria-expanded', 'false');
          return;
        }
        const btn = e.target.closest('.wm-lang-btn');
        if (btn) {
          const open = switcher.getAttribute('aria-expanded') === 'true';
          switcher.setAttribute('aria-expanded', String(!open));
        }
      });
    });

    // Click outside any switcher closes them all.
    document.addEventListener('click', (e) => {
      if (!e.target.closest || !e.target.closest('.wm-lang-switcher')) {
        switchers.forEach((s) => s.setAttribute('aria-expanded', 'false'));
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') switchers.forEach((s) => s.setAttribute('aria-expanded', 'false'));
    });
  }

  /* ---------- LANGUAGE SWITCH ---------- */
  function setLang(lang) {
    currentLang = lang;
    writeLang(lang);
    fetchDict(lang).then((d) => {
      dict = d || {};
      applyTranslations();
      // Update all switchers' display (desktop + mobile)
      document.querySelectorAll('.wm-lang-switcher').forEach((s) => updateSwitcherDisplay(s));
    });
  }

  /* ---------- BOOT ---------- */
  function boot() {
    // Wait briefly for the chrome (corporate-chrome.js) to inject the
    // switcher into the DOM. corporate-chrome.js runs on DOMContentLoaded
    // too — order isn't guaranteed across `defer` scripts in all browsers,
    // so do a microtask defer to be safe.
    Promise.resolve().then(() => {
      wireSwitcher();
      fetchDict(currentLang).then((d) => {
        dict = d || {};
        applyTranslations();
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
