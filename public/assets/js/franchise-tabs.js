/* franchise-tabs.js
 *
 * Tab switcher + FAQ accordion for /franchise/. Tabs are .wm-fr-tab
 * buttons; panels are .wm-fr-panel keyed by data-tab => id="panel-{tab}".
 * Hash-based deep linking: /franchise/#numbers selects the Numbers tab
 * on load. ARIA attrs maintained for screen-reader correctness.
 */
(function () {
  'use strict';

  function activate(name) {
    document.querySelectorAll('.wm-fr-tab').forEach((b) => {
      const isActive = b.getAttribute('data-tab') === name;
      b.classList.toggle('is-active', isActive);
      b.setAttribute('aria-selected', String(isActive));
    });
    document.querySelectorAll('.wm-fr-panel').forEach((p) => {
      p.classList.toggle('is-active', p.id === 'panel-' + name);
    });
  }

  function bootTabs() {
    const tabs = Array.from(document.querySelectorAll('.wm-fr-tab'));
    if (!tabs.length) return;

    tabs.forEach((btn) => {
      btn.addEventListener('click', () => {
        const name = btn.getAttribute('data-tab');
        if (!name) return;
        activate(name);
        history.replaceState(null, '', '#' + name);
        // Scroll the tab bar into view if user clicked while tab is below fold.
        const bar = btn.closest('.wm-fr-tab-bar');
        if (bar) bar.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });

    // Keyboard left/right between tabs
    const bar = document.querySelector('.wm-fr-tab-bar');
    if (bar) {
      bar.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        const i = tabs.findIndex((t) => t === document.activeElement);
        if (i < 0) return;
        const next = e.key === 'ArrowLeft'
          ? (i - 1 + tabs.length) % tabs.length
          : (i + 1) % tabs.length;
        tabs[next].focus();
        tabs[next].click();
      });
    }

    // Hash-based deep link: /franchise/#numbers etc.
    const initial = (location.hash || '').replace(/^#/, '');
    const valid   = ['why', 'numbers', 'model', 'equipment', 'process', 'faq'];
    if (valid.indexOf(initial) >= 0) activate(initial);
  }

  function bootAccordion() {
    document.querySelectorAll('.wm-fr-faq-q-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const expanded = btn.getAttribute('aria-expanded') === 'true';
        const panel = document.getElementById(btn.getAttribute('aria-controls'));
        if (!panel) return;
        if (expanded) {
          btn.setAttribute('aria-expanded', 'false');
          panel.style.maxHeight = '0px';
        } else {
          btn.setAttribute('aria-expanded', 'true');
          panel.style.maxHeight = panel.scrollHeight + 'px';
        }
      });
    });
  }

  function init() {
    bootTabs();
    bootAccordion();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
