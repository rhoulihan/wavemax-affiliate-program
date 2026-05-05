/* corporate-chrome.js
 *
 * Shared header + footer for the corporate-content pages on wavemax.promo
 * (/franchise/, /become-a-franchisee/, /about/, /testimonials/, etc.).
 *
 * These pages live OUTSIDE the per-franchise iframe architecture — they
 * have no LOCATION_DATA, no slug, no per-store data. Each page includes
 * this script and renders into two placeholder elements:
 *
 *     <header id="wm-corp-header"></header>
 *     <footer id="wm-corp-footer"></footer>
 *
 * Single source of truth for navigation across the corporate pages so
 * adding a new corporate page or renaming an existing one only edits
 * this file.
 */
(function () {
  'use strict';

  const NAV = {
    franchise: {
      label: 'Franchise',
      items: [
        { href: '/franchise/',                  label: 'Overview' },
        { href: '/become-a-franchisee/',        label: 'Become a Franchisee' },
        { href: '/why-invest-in-wavemax/',      label: 'Why Invest in WaveMAX' },
        { href: '/laundromat-investment-guide/', label: 'Investment Guide' },
        { href: '/wavemax-vs-zombiemat/',       label: 'WaveMAX vs Zombiemat' },
        { href: '/virtual-tour/',               label: 'Virtual Tour' },
        { href: '/faq/',                        label: 'FAQ' },
        { href: '/testimonials/',               label: 'Testimonials' }
      ]
    }
  };

  const FOOTER_LINKS = [
    {
      heading: 'Franchise',
      links: [
        { href: '/franchise/',                   label: 'Overview' },
        { href: '/become-a-franchisee/',         label: 'Become a Franchisee' },
        { href: '/why-invest-in-wavemax/',       label: 'Why Invest' },
        { href: '/laundromat-investment-guide/', label: 'Investment Guide' },
        { href: '/wavemax-vs-zombiemat/',        label: 'vs Zombiemat' }
      ]
    },
    {
      heading: 'Company',
      links: [
        { href: '/about/',         label: 'About WaveMAX' },
        { href: '/testimonials/',  label: 'Testimonials' },
        { href: '/virtual-tour/',  label: 'Virtual Tour' },
        { href: '/faq/',           label: 'FAQ' },
        { href: '/contact/',       label: 'Contact' }
      ]
    },
    {
      heading: 'Locations',
      links: [
        { href: '#', dataAction: 'open-locations', label: 'Find a Store' },
        { href: 'https://www.wavemaxlaundry.com/locations/', label: 'Full Location Map', external: true }
      ]
    }
  ];

  const LOGO_URL = 'https://wavemaxlaundry.com/wp-content/uploads/2026/03/logo-wavemax.png';
  const HQ_ADDRESS = '929 McDuff Ave S, Suite 107';
  const HQ_CITY    = 'Jacksonville, FL 32205';
  const COPYRIGHT  = '© ' + (new Date()).getFullYear() + ' AU Hydro LLC dba WaveMAX Laundry. All rights reserved.';

  /* ---------- HEADER ---------- */
  function buildHeader() {
    const navItems = NAV.franchise.items.map((it) =>
      `<a class="wmcc-drop-item" href="${esc(it.href)}">${esc(it.label)}</a>`
    ).join('');

    return `
      <div class="wmcc-bar">
        <div class="wmcc-bar-inner">
          <a class="wmcc-logo" href="/franchise/" aria-label="WaveMAX Laundry — Franchise home">
            <img src="${esc(LOGO_URL)}" alt="WaveMAX Laundry" referrerpolicy="no-referrer" loading="eager" decoding="async">
          </a>
          <nav class="wmcc-nav" aria-label="Primary">
            <div class="wmcc-drop">
              <button type="button" class="wmcc-nav-link wmcc-drop-toggle" aria-expanded="false" aria-haspopup="menu">
                ${esc(NAV.franchise.label)} <span class="wmcc-caret" aria-hidden="true">▾</span>
              </button>
              <div class="wmcc-drop-menu" role="menu">${navItems}</div>
            </div>
            <a class="wmcc-nav-link" href="/about/">About</a>
            <a class="wmcc-nav-link" href="/contact/">Contact</a>
            <button type="button" class="wmcc-nav-cta" data-locmodal-open data-action="open-locations">Find a Location</button>
          </nav>
          <button type="button" class="wmcc-burger" aria-expanded="false" aria-label="Open menu">
            <span></span><span></span><span></span>
          </button>
        </div>
      </div>
      <nav class="wmcc-mobile" aria-label="Mobile">
        <a class="wmcc-mob-link wmcc-mob-section" href="/franchise/">Franchise · Overview</a>
        ${NAV.franchise.items.slice(1).map((it) => `<a class="wmcc-mob-link" href="${esc(it.href)}">${esc(it.label)}</a>`).join('')}
        <a class="wmcc-mob-link wmcc-mob-section" href="/about/">About</a>
        <a class="wmcc-mob-link" href="/contact/">Contact</a>
        <a class="wmcc-mob-link" href="#" data-action="open-locations">Find a Location</a>
      </nav>
    `;
  }

  /* ---------- FOOTER ---------- */
  function buildFooter() {
    const cols = FOOTER_LINKS.map((col) => `
      <div class="wmcc-foot-col">
        <h4>${esc(col.heading)}</h4>
        <ul>
          ${col.links.map((l) => {
            const attrs = l.external
              ? `target="_blank" rel="noopener"`
              : (l.dataAction ? `data-action="${esc(l.dataAction)}"` : '');
            return `<li><a href="${esc(l.href)}" ${attrs}>${esc(l.label)}</a></li>`;
          }).join('')}
        </ul>
      </div>
    `).join('');

    return `
      <div class="wmcc-foot-inner">
        <div class="wmcc-foot-brand">
          <img src="${esc(LOGO_URL)}" alt="WaveMAX Laundry" referrerpolicy="no-referrer" loading="lazy" decoding="async">
          <p class="wmcc-foot-tag">A national laundromat franchise.<br>Cleaner. Safer. Faster.</p>
          <p class="wmcc-foot-addr">${esc(HQ_ADDRESS)}<br>${esc(HQ_CITY)}</p>
        </div>
        <div class="wmcc-foot-cols">${cols}</div>
      </div>
      <div class="wmcc-foot-rule">
        <p class="wmcc-foot-legal">${esc(COPYRIGHT)}</p>
        <div class="wmcc-foot-legal-links">
          <a href="/privacy-policy.html">Privacy</a>
          <a href="/terms-and-conditions.html">Terms</a>
        </div>
      </div>
    `;
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ---------- INTERACTIONS ---------- */
  // Dropdown + mobile drawer + locations modal trigger.
  function wireInteractions() {
    document.addEventListener('click', (e) => {
      const t = e.target;
      if (!t || !t.closest) return;

      // Dropdown toggle
      const tgl = t.closest('.wmcc-drop-toggle');
      if (tgl) {
        const drop = tgl.closest('.wmcc-drop');
        const open = drop.classList.toggle('is-open');
        tgl.setAttribute('aria-expanded', String(open));
        return;
      }

      // Click outside dropdown closes it
      if (!t.closest('.wmcc-drop')) {
        document.querySelectorAll('.wmcc-drop.is-open').forEach((d) => {
          d.classList.remove('is-open');
          const tg = d.querySelector('.wmcc-drop-toggle');
          if (tg) tg.setAttribute('aria-expanded', 'false');
        });
      }

      // Burger toggle
      if (t.closest('.wmcc-burger')) {
        document.body.classList.toggle('wmcc-mobile-open');
        const isOpen = document.body.classList.contains('wmcc-mobile-open');
        t.closest('.wmcc-burger').setAttribute('aria-expanded', String(isOpen));
        return;
      }

      // 'open-locations' triggers — corporate pages don't have the franchise
      // chrome's locations modal yet. For now, fall back to corporate's
      // locations page. When we wire up a corporate-side locations modal
      // (sharing the franchise modal's tile + Google Maps view), this
      // becomes a no-redirect modal-pop.
      if (t.closest('[data-action="open-locations"]')) {
        e.preventDefault();
        window.location.href = 'https://www.wavemaxlaundry.com/locations/';
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      document.querySelectorAll('.wmcc-drop.is-open').forEach((d) => {
        d.classList.remove('is-open');
        const tg = d.querySelector('.wmcc-drop-toggle');
        if (tg) tg.setAttribute('aria-expanded', 'false');
      });
      if (document.body.classList.contains('wmcc-mobile-open')) {
        document.body.classList.remove('wmcc-mobile-open');
      }
    });
  }

  function injectChrome() {
    const headerEl = document.getElementById('wm-corp-header');
    const footerEl = document.getElementById('wm-corp-footer');
    if (headerEl) headerEl.innerHTML = buildHeader();
    if (footerEl) footerEl.innerHTML = buildFooter();
    // Highlight the active nav link based on current path.
    const path = location.pathname.replace(/\/$/, '') || '/franchise';
    document.querySelectorAll('.wmcc-drop-item, .wmcc-nav-link, .wmcc-mob-link').forEach((a) => {
      const href = (a.getAttribute('href') || '').replace(/\/$/, '');
      if (href && href === path) a.classList.add('is-active');
    });
    wireInteractions();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectChrome);
  } else {
    injectChrome();
  }
})();
