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
  // Top-level nav rendered into b3.  Each entry is either { href, label, key }
  // (a flat link) or { label, key, items:[{href,label,key}] } (a dropdown).
  // `label` is the English fallback; `key` is the i18n key.
  const NAV = [
    { href: '/franchise/',                  label: 'Home',                  key: 'chrome.nav.home' },
    { label: 'Franchise', key: 'chrome.nav.franchise', items: [
      { href: '/franchise/',                  label: 'Overview',              key: 'chrome.nav.overview' },
      { href: '/become-a-franchisee/',        label: 'Become a Franchisee',   key: 'chrome.nav.becomeFranchisee' },
      { href: '/why-invest-in-wavemax/',      label: 'Why Invest in WaveMAX', key: 'chrome.nav.whyInvest' },
      { href: '/laundromat-investment-guide/', label: 'Investment Guide',     key: 'chrome.nav.investmentGuide' },
      { href: '/wavemax-vs-zombiemat/',       label: 'WaveMAX vs Zombiemat',  key: 'chrome.nav.vsZombiemat' }
    ]},
    { href: '/virtual-tour/',               label: 'Virtual Tour',          key: 'chrome.nav.virtualTour' },
    { href: '/about/',                      label: 'About',                 key: 'chrome.nav.about' },
    { href: '/testimonials/',               label: 'Testimonials',          key: 'chrome.nav.testimonials' },
    { href: '/faq/',                        label: 'FAQ',                   key: 'chrome.nav.faq' },
    { href: '/contact/',                    label: 'Contact',               key: 'chrome.nav.contact' }
  ];

  const FOOTER_LINKS = [
    {
      heading: 'Franchise', headingKey: 'chrome.footer.headingFranchise',
      links: [
        { href: '/franchise/',                   label: 'Overview',              key: 'chrome.footer.linkOverview' },
        { href: '/become-a-franchisee/',         label: 'Become a Franchisee',   key: 'chrome.footer.linkBecome' },
        { href: '/why-invest-in-wavemax/',       label: 'Why Invest',            key: 'chrome.footer.linkWhy' },
        { href: '/laundromat-investment-guide/', label: 'Investment Guide',      key: 'chrome.footer.linkGuide' },
        { href: '/wavemax-vs-zombiemat/',        label: 'vs Zombiemat',          key: 'chrome.footer.linkVs' }
      ]
    },
    {
      heading: 'Company', headingKey: 'chrome.footer.headingCompany',
      links: [
        { href: '/about/',         label: 'About WaveMAX', key: 'chrome.footer.linkAbout' },
        { href: '/testimonials/',  label: 'Testimonials',  key: 'chrome.footer.linkTestimonials' },
        { href: '/virtual-tour/',  label: 'Virtual Tour',  key: 'chrome.footer.linkTour' },
        { href: '/faq/',           label: 'FAQ',           key: 'chrome.footer.linkFaq' },
        { href: '/contact/',       label: 'Contact',       key: 'chrome.footer.linkContact' }
      ]
    },
    {
      heading: 'Locations', headingKey: 'chrome.footer.headingLocations',
      links: [
        { href: '#', dataAction: 'open-locations', label: 'Find a Store', key: 'chrome.footer.linkFindStore' },
        { href: 'https://www.wavemaxlaundry.com/locations/', label: 'Full Location Map', key: 'chrome.footer.linkFullMap', external: true }
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
          `<a href="${esc(s.href)}" data-i18n="${esc(s.key)}">${esc(s.label)}</a>`
        ).join('');
        return `
          <div class="wmlnav-drop">
            <a href="${esc(item.items[0].href)}">
              <span data-i18n="${esc(item.key)}">${esc(item.label)}</span><span class="wmlnav-arrow"></span>
            </a>
            <div class="wmlnav-drop-menu">${sub}</div>
          </div>
        `;
      }
      return `<a href="${esc(item.href)}" data-i18n="${esc(item.key)}">${esc(item.label)}</a>`;
    }).join('');

    return `
      <div id="wmlnav-wrap">
        <div class="wmlnav-b1">
          <div class="wmlnav-inner">
            <div class="wmlnav-b1-left">
              <span>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l2.39 6.95H22l-6.19 4.5 2.39 6.95L12 16l-6.2 4.4 2.39-6.95L2 8.95h7.61L12 2z"/></svg>
                <span data-i18n="chrome.b1.award">#1 Laundromat Franchise · 2026 Entrepreneur Franchise 500</span>
              </span>
              <span>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                <span data-i18n="chrome.b1.locations">75+ locations nationwide &amp; growing</span>
              </span>
              <a class="wmlnav-b1-cta" href="/why-invest-in-wavemax/" data-i18n="chrome.b1.item19">Item 19: $471K avg gross →</a>
            </div>
            <div class="wmlnav-b1-right">
              <div class="wm-lang-switcher" id="wm-lang" aria-expanded="false">
                <button type="button" class="wm-lang-btn" aria-haspopup="true" aria-label="Choose language">
                  <span class="wm-lang-flag wm-flag-en" aria-hidden="true"></span>
                  <span class="wm-lang-current-label">EN</span>
                  <svg class="wm-lang-arrow" viewBox="0 0 9 6" aria-hidden="true"><path d="M0.5 1L4.5 5L8.5 1" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </button>
                <div class="wm-lang-menu" role="menu"></div>
              </div>
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
              <a href="/become-a-franchisee/" class="wmlnav-btn-out" data-i18n="chrome.b2.becomeFranchisee">Become a Franchisee</a>
              <button type="button" class="wmlnav-btn-sol" data-action="open-locations" data-i18n="chrome.b2.findLocation">Find a Location</button>
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

  /* ---------- MOBILE HEADER (wmv3-header) ----------
   * Below 900px the desktop wmlnav-wrap is hidden via CSS in
   * wavemax-mhr-chrome.css; this mobile-only header takes over with the
   * same structure used by per-franchise host pages. The b1 utility
   * info is replaced with a corporate-context strip (award badge / 75+
   * locations / Item 19 callout). The burger toggles the nav drawer. */
  function buildMobileHeader() {
    const drawerItems = NAV.map((item) => {
      if (item.items) {
        return item.items.map((s) =>
          `<a href="${esc(s.href)}" data-i18n="${esc(s.key)}">${esc(s.label)}</a>`
        ).join('');
      }
      return `<a href="${esc(item.href)}" data-i18n="${esc(item.key)}">${esc(item.label)}</a>`;
    }).join('');

    return `
      <header class="wmv3-header" id="wmv3-mobile">
        <div class="wmv3-info">
          <div class="wmv3-info-col">
            <div class="wmv3-info-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l2.39 6.95H22l-6.19 4.5 2.39 6.95L12 16l-6.2 4.4 2.39-6.95L2 8.95h7.61L12 2z"/></svg>
            </div>
            <div class="wmv3-info-label" data-i18n="chrome.b1.awardShort">#1 Laundromat</div>
            <div class="wmv3-info-value" data-i18n="chrome.b1.awardYear">2026 Franchise 500</div>
          </div>
          <div class="wmv3-divider" aria-hidden="true"></div>
          <div class="wmv3-info-col">
            <div class="wmv3-info-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            </div>
            <div class="wmv3-info-label" data-i18n="chrome.b1.locationsShort">Locations</div>
            <div class="wmv3-info-value">75+</div>
          </div>
          <div class="wmv3-divider" aria-hidden="true"></div>
          <a class="wmv3-info-col" href="/why-invest-in-wavemax/">
            <div class="wmv3-info-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            </div>
            <div class="wmv3-info-label" data-i18n="chrome.b1.item19Short">Item 19</div>
            <div class="wmv3-info-value">$471K</div>
          </a>
        </div>

        <div class="wmv3-logo">
          <a href="/franchise/" aria-label="WaveMAX Laundry — Franchise home">
            <img src="${esc(LOGO_URL)}" alt="WaveMAX Laundry">
          </a>
        </div>

        <div class="wmv3-actions">
          <a href="/become-a-franchisee/" class="wmv3-btn wmv3-btn-out" data-i18n="chrome.b2.becomeFranchisee">Become a Franchisee</a>
          <button type="button" class="wmv3-btn wmv3-btn-sol" data-action="open-locations" data-i18n="chrome.b2.findLocation">Find a Location</button>
          <button type="button" class="wmv3-burger" id="wmv3-burger" aria-label="Open menu" aria-expanded="false"><span></span><span></span><span></span></button>
        </div>

        <nav class="wmv3-drawer" id="wmv3-drawer" aria-label="Mobile menu">
          ${drawerItems}
        </nav>
      </header>
    `;
  }

  /* ---------- BREADCRUMB ----------
   * Page declares its crumb via <meta name="wm-corp-breadcrumb"> using
   * pipe-separated `key:label` pairs:
   *   <meta name="wm-corp-breadcrumb"
   *         content="chrome.breadcrumb.home:Home|chrome.nav.franchise:Franchise">
   * Each segment is rendered with a data-i18n attribute so corporate-i18n.js
   * translates it on locale switch. The English label is the fallback. */
  function buildBreadcrumb() {
    const meta = document.querySelector('meta[name="wm-corp-breadcrumb"]');
    if (!meta) return '';
    const path = meta.getAttribute('content') || '';
    const parts = path.split('|').map((s) => s.trim()).filter(Boolean).map((s) => {
      const [key, label] = s.split(':').map((x) => x && x.trim());
      return { key: key || '', label: label || key || '' };
    });
    if (!parts.length) return '';

    const first = parts[0];
    const home  = `<a href="/franchise/" data-i18n="${esc(first.key)}">${esc(first.label)}</a>`;
    const rest  = parts.slice(1).map((p, i) => {
      const isLast = i === parts.length - 2;
      const sep = `<span class="wm-bc-host-sep" aria-hidden="true">›</span>`;
      return isLast
        ? `${sep}<strong class="wm-bc-host-current" data-i18n="${esc(p.key)}">${esc(p.label)}</strong>`
        : `${sep}<span data-i18n="${esc(p.key)}">${esc(p.label)}</span>`;
    }).join('');

    return `
      <div id="wm-bc" class="wm-bc-host">
        <div class="wm-bc-host-inner">${home}${rest}</div>
      </div>
    `;
  }

  /* ---------- FOOTER (wmcc- classes from corporate-chrome.css) ---------- */
  function buildFooter() {
    const cols = FOOTER_LINKS.map((col) => `
      <div class="wmcc-foot-col">
        <h4 data-i18n="${esc(col.headingKey)}">${esc(col.heading)}</h4>
        <ul>
          ${col.links.map((l) => {
            const attrs = l.external
              ? `target="_blank" rel="noopener"`
              : (l.dataAction ? `data-action="${esc(l.dataAction)}"` : '');
            const i18n = l.key ? ` data-i18n="${esc(l.key)}"` : '';
            return `<li><a href="${esc(l.href)}" ${attrs}${i18n}>${esc(l.label)}</a></li>`;
          }).join('')}
        </ul>
      </div>
    `).join('');

    return `
      <div class="wmcc-foot-inner">
        <div class="wmcc-foot-brand">
          <img src="${esc(LOGO_URL)}" alt="WaveMAX Laundry" referrerpolicy="no-referrer" loading="lazy" decoding="async">
          <p class="wmcc-foot-tag" data-i18n="chrome.footer.tag">A national laundromat franchise.<br>Cleaner. Safer. Faster.</p>
          <p class="wmcc-foot-addr"><span data-i18n="chrome.footer.address1">${esc(HQ_ADDRESS)}</span><br><span data-i18n="chrome.footer.address2">${esc(HQ_CITY)}</span></p>
        </div>
        <div class="wmcc-foot-cols">${cols}</div>
      </div>
      <div class="wmcc-foot-rule">
        <p class="wmcc-foot-legal">${esc(COPYRIGHT)}</p>
        <div class="wmcc-foot-legal-links">
          <a href="/privacy-policy.html" data-i18n="chrome.footer.privacy">Privacy</a>
          <a href="/terms-and-conditions.html" data-i18n="chrome.footer.terms">Terms</a>
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

      // Mobile burger -> toggle drawer
      const burger = t.closest('#wmv3-burger');
      if (burger) {
        const drawer = document.getElementById('wmv3-drawer');
        const willOpen = !burger.classList.contains('is-open');
        burger.classList.toggle('is-open', willOpen);
        burger.setAttribute('aria-expanded', String(willOpen));
        if (drawer) drawer.classList.toggle('is-open', willOpen);
        return;
      }
      // Tap a drawer link -> close the drawer
      if (t.closest('#wmv3-drawer a')) {
        const drawer = document.getElementById('wmv3-drawer');
        const burger2 = document.getElementById('wmv3-burger');
        if (drawer)  drawer.classList.remove('is-open');
        if (burger2) { burger2.classList.remove('is-open'); burger2.setAttribute('aria-expanded', 'false'); }
        // Don't preventDefault — let the link navigate
      }

      if (t.closest('[data-action="open-locations"]')) {
        e.preventDefault();
        window.location.href = 'https://www.wavemaxlaundry.com/locations/';
      }
    });
  }

  function injectChrome() {
    const headerEl = document.getElementById('wm-corp-header');
    const footerEl = document.getElementById('wm-corp-footer');
    if (headerEl) headerEl.innerHTML = buildHeader() + buildMobileHeader() + buildBreadcrumb();
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
