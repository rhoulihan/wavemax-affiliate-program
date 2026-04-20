// Local dev test harness for the parent-iframe bridge.
//
// In production this logic is inlined into the WordPress page. For local
// dev we load it as an external script so the CSP nonce on the parent
// page isn't required. Origin allowlist includes localhost:4000 + the
// current origin so the harness works on any port.

(function() {
  'use strict';

  // Forward every query param to the iframe. The affiliate landing (and
  // other routes) rely on things like `code`, `affid`, `token`, etc., so
  // we can't just pluck `route` out.
  const urlParams = new URLSearchParams(window.location.search);
  if (!urlParams.has('route')) urlParams.set('route', '/');
  const iframeSrc = window.location.origin + '/embed-app-v2.html?' + urlParams.toString();
  const iframeEl = document.getElementById('wavemax-iframe');
  if (iframeEl) iframeEl.src = iframeSrc;

  const ALLOWED_ORIGINS = [
    'https://affiliate.wavemax.promo',
    'http://affiliate.wavemax.promo',
    'https://wavemax.promo',
    'http://wavemax.promo',
    'http://localhost:3000',
    'http://localhost:4000',
    window.location.origin
  ];

  const MOBILE_BREAKPOINT = 768;
  const TABLET_BREAKPOINT = 1024;

  let isMobile = false;
  let isTablet = false;
  let chromeHidden = false;
  let iframe = null;
  let lastIframeHeight = 0;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    iframe = document.getElementById('wavemax-iframe');
    if (!iframe) return;

    hidePageHeader();
    detectViewport();
    window.addEventListener('resize', debounce(detectViewport, 250));
    window.addEventListener('message', handleMessage);
    sendViewportInfo();
    setTimeout(sendViewportInfo, 500);
    setTimeout(sendViewportInfo, 1500);

    document.getElementById('btn-hide-chrome').addEventListener('click', hideChrome);
    document.getElementById('btn-show-chrome').addEventListener('click', showChrome);
    document.getElementById('btn-send-viewport').addEventListener('click', sendViewportInfo);
  }

  // Always-hide the "Wavemax Austin Affiliate Program" banner — matches prod.
  function hidePageHeader() {
    const header = document.querySelector(
      'section.page-header.page-header-modern.bg-color-light-scale-1.page-header-sm'
    );
    if (!header) return;
    header.style.setProperty('display', 'none', 'important');
    header.setAttribute('data-permanently-hidden', 'true');
  }

  function detectViewport() {
    const width = window.innerWidth;
    isMobile = width < MOBILE_BREAKPOINT;
    isTablet = width >= MOBILE_BREAKPOINT && width < TABLET_BREAKPOINT;
    const label = isMobile ? 'mobile' : isTablet ? 'tablet' : 'desktop';
    const vpEl = document.getElementById('vp');
    if (vpEl) vpEl.textContent = `viewport: ${label} (${width}px)`;
    sendViewportInfo();
  }

  function sendViewportInfo() {
    if (!iframe) return;
    const currentLanguage = localStorage.getItem('wavemax-language') || 'en';
    const info = {
      type: 'viewport-info',
      data: {
        width: window.innerWidth,
        height: window.innerHeight,
        isMobile, isTablet,
        isDesktop: !isMobile && !isTablet,
        hasTouch: 'ontouchstart' in window,
        orientation: window.innerWidth > window.innerHeight ? 'landscape' : 'portrait',
        language: currentLanguage
      }
    };
    try { iframe.contentWindow.postMessage(info, '*'); } catch (e) { /* noop */ }
  }

  function handleMessage(event) {
    const originAllowed = ALLOWED_ORIGINS.some(o => event.origin === o)
      || ALLOWED_ORIGINS.some(o => event.origin.endsWith(o.replace(/^https?:\/\//, '')));
    if (!originAllowed) {
      console.log('[Bridge] Rejected message from', event.origin);
      return;
    }
    if (!event.data || !event.data.type) return;

    console.log('[Bridge]', event.data.type, event.data.data || '');

    switch (event.data.type) {
    case 'hide-chrome':
      hideChrome();
      break;
    case 'show-chrome':
      showChrome();
      break;
    case 'resize':
      if (event.data.data && event.data.data.height) resizeIframe(event.data.data.height);
      break;
    case 'scroll-to-top':
      window.scrollTo({ top: 0, behavior: 'smooth' });
      break;
    case 'route-changed':
      window.currentEmbedRoute = event.data.data && event.data.data.route;
      break;
    }
  }

  function hideChrome() {
    if (chromeHidden) return;
    chromeHidden = true;
    document.querySelectorAll('body > *').forEach(el => {
      if (el === iframe || el.contains(iframe)) return;
      if (el.classList.contains('bridge-controls')) return;
      if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE') return;
      if (el.hasAttribute('data-permanently-hidden')) return;
      el.setAttribute('data-operator-hidden', 'true');
      el.setAttribute('data-original-display', el.style.display || '');
      el.style.setProperty('display', 'none', 'important');
    });
    document.body.classList.add('operator-mode');
    iframe.style.minHeight = '100vh';
    setTimeout(() => iframe.contentWindow.postMessage(
      { type: 'chrome-hidden', data: { hidden: true } }, '*'
    ), 100);
  }

  function showChrome() {
    if (!chromeHidden) return;
    chromeHidden = false;
    document.querySelectorAll('[data-operator-hidden="true"]').forEach(el => {
      if (el.hasAttribute('data-permanently-hidden')) return;
      el.style.removeProperty('display');
      const orig = el.getAttribute('data-original-display');
      if (orig) el.style.display = orig;
      el.removeAttribute('data-operator-hidden');
      el.removeAttribute('data-original-display');
    });
    document.body.classList.remove('operator-mode');
    iframe.style.minHeight = '';
    setTimeout(() => iframe.contentWindow.postMessage(
      { type: 'chrome-hidden', data: { hidden: false } }, '*'
    ), 100);
  }

  function resizeIframe(height) {
    if (chromeHidden && (isMobile || isTablet)) return;
    const newHeight = parseInt(height, 10);
    if (Math.abs(newHeight - lastIframeHeight) > 5) {
      lastIframeHeight = newHeight;
      iframe.style.height = newHeight + 'px';
    }
  }

  function debounce(fn, wait) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), wait);
    };
  }

  // Same public API surface as the production bridge.
  window.WaveMaxBridge = {
    hideChrome, showChrome, sendViewportInfo,
    getViewportInfo: () => ({
      isMobile, isTablet,
      isDesktop: !isMobile && !isTablet,
      chromeHidden
    })
  };
})();
