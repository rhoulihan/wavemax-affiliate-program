/* corporate-chrome.js
 *
 * Shared header + footer for the corporate-content pages on wavemax.promo
 * (/franchise/, /become-a-franchisee/, /about/, /testimonials/, etc.).
 *
 * Renders the SAME wmlnav-wrap chrome used by per-franchise host pages
 * (franchise-host.html), so corporate and per-store pages share one visual
 * identity. Picks up styling from wavemax-mhr-chrome.css. The b1 utility
 * strip shows brand context (awards / location count) instead of a single
 * store's hours; b2 (logo + "Find a Location" CTA) and b3 (nav) match
 * exactly. Footer continues to use wmcc-foot- classes from corporate-chrome.css.
 */
(function () {
  'use strict';

  /* ---------- NAV CONFIG ---------- */
  // Top-level nav rendered into b3.  Each entry is either { href, label }
  // (a flat link) or { label, items:[{href,label}] } (a dropdown — pure-CSS
  // hover behavior via .wmlnav-drop / .wmlnav-drop-menu).
  const NAV = [
    { href: '/franchise/',                  label: 'Home' },
    { label: 'Franchise', items: [
      { href: '/franchise/',                  label: 'Overview' },
      { href: '/become-a-franchisee/',        label: 'Become a Franchisee' },
      { href: '/why-invest-in-wavemax/',      label: 'Why Invest in WaveMAX' },
      { href: '/laundromat-investment-guide/', label: 'Investment Guide' },
      { href: '/wavemax-vs-zombiemat/',       label: 'WaveMAX vs Zombiemat' }
    ]},
    { href: '/virtual-tour/',               label: 'Virtual Tour' },
    { href: '/about/',                      label: 'About' },
    { href: '/testimonials/',               label: 'Testimonials' },
    { href: '/faq/',                        label: 'FAQ' },
    { href: '/contact/',                    label: 'Contact' }
  ];

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

  const LOGO_URL   = 'https://www.wavemaxlaundry.com/wp-content/uploads/2026/03/logo-wavemax.png';
  const HQ_ADDRESS = '929 McDuff Ave S, Suite 107';
  const HQ_CITY    = 'Jacksonville, FL 32205';
  const COPYRIGHT  = '© ' + (new Date()).getFullYear() + ' AU Hydro LLC dba WaveMAX Laundry. All rights reserved.';

  /* ---------- HEADER (wmlnav-wrap, matches franchise-host.html) ---------- */
  function buildHeader() {
    const navItems = NAV.map((item) => {
      if (item.items) {
        const sub = item.items.map((s) =>
          `<a href="${esc(s.href)}">${esc(s.label)}</a>`
        ).join('');
        return `
          <div class="wmlnav-drop">
            <a href="${esc(item.items[0].href)}">
              <span>${esc(item.label)}</span><span class="wmlnav-arrow"></span>
            </a>
            <div class="wmlnav-drop-menu">${sub}</div>
          </div>
        `;
      }
      return `<a href="${esc(item.href)}">${esc(item.label)}</a>`;
    }).join('');

    return `
      <div id="wmlnav-wrap">
        <div class="wmlnav-b1">
          <div class="wmlnav-inner">
            <div class="wmlnav-b1-left">
              <span aria-hidden="true">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l2.39 6.95H22l-6.19 4.5 2.39 6.95L12 16l-6.2 4.4 2.39-6.95L2 8.95h7.61L12 2z"/></svg>
                #1 Laundromat Franchise · 2026 Entrepreneur Franchise 500
              </span>
              <span aria-hidden="true">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                75+ locations nationwide &amp; growing
              </span>
            </div>
            <div class="wmlnav-b1-right">
              <a href="/why-invest-in-wavemax/">$471K avg gross · 2024 Item 19 →</a>
            </div>
          </div>
        </div>

        <div class="wmlnav-b2">
          <div class="wmlnav-inner">
            <div class="wmlnav-b2-logo">
              <a href="/franchise/" aria-label="WaveMAX Laundry — Franchise home">
                <img decoding="async" src="${esc(LOGO_URL)}" alt="WaveMAX Laundry">
              </a>
            </div>
            <div class="wmlnav-b2-right">
              <a href="/become-a-franchisee/" class="wmlnav-btn-out">Become a Franchisee</a>
              <button type="button" class="wmlnav-btn-sol" data-action="open-locations">Find a Location</button>
            </div>
          </div>
        </div>

        <div class="wmlnav-b3">
          <div class="wmlnav-b3-inner">
            <nav id="wmlnav-nav" aria-label="Primary navigation">
              ${navItems}
            </nav>
          </div>
        </div>
      </div>
    `;
  }

  /* ---------- FOOTER (wmcc- classes from corporate-chrome.css) ---------- */
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

  /* ---------- INTERACTIONS ----------
   * The wmlnav-drop dropdown is pure CSS hover; no JS interaction needed
   * for that. We only wire the "Find a Location" CTA — for now it falls
   * through to corporate's locations index. When the cross-corporate
   * locations modal lands, this becomes a no-redirect modal pop. */
  function wireInteractions() {
    document.addEventListener('click', (e) => {
      const t = e.target;
      if (!t || !t.closest) return;
      if (t.closest('[data-action="open-locations"]')) {
        e.preventDefault();
        window.location.href = 'https://www.wavemaxlaundry.com/locations/';
      }
    });
  }

  function injectChrome() {
    const headerEl = document.getElementById('wm-corp-header');
    const footerEl = document.getElementById('wm-corp-footer');
    if (headerEl) headerEl.innerHTML = buildHeader();
    if (footerEl) footerEl.innerHTML = buildFooter();

    // Highlight the active nav item based on current path.
    const path = location.pathname.replace(/\/$/, '') || '/franchise';
    document.querySelectorAll('#wmlnav-nav > a, #wmlnav-nav .wmlnav-drop-menu a').forEach((a) => {
      const href = (a.getAttribute('href') || '').replace(/\/$/, '');
      if (href && href === path) {
        a.classList.add('wmlnav-on');
        // If the active link is inside a dropdown, also highlight the parent.
        const parentDrop = a.closest('.wmlnav-drop');
        if (parentDrop) parentDrop.classList.add('wmlnav-on');
      }
    });

    wireInteractions();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectChrome);
  } else {
    injectChrome();
  }
})();
