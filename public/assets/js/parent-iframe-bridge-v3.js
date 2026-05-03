/* WaveMAX Parent-Iframe Bridge V3
 * Runs on the host (parent) page. Clean re-implementation of v2 — drops the
 * Walibu / Google Translate scaffolding, adds location-data + navigate
 * message types, integrates with native data-i18n switcher.
 *
 * Contract (PostMessage protocol):
 *   parent → iframe:
 *     parent-ready        ()
 *     current-language    { language }
 *     language-change     { language }
 *     location-data       { ...LOCATION_DATA }   [v3 addition]
 *
 *   iframe → parent:
 *     iframe-ready              { page, timestamp }
 *     request-language          ()
 *     request-location-data     ()                [v3 addition]
 *     resize                    { height, page }
 *     seo-data                  { meta, openGraph, twitter, structuredData }
 *     navigate                  { href }          [v3 addition]
 *     hide-page-header          ()                [legacy, accepted but no-op on v3]
 */
(function () {
  'use strict';

  const LANGUAGE_KEY = 'wavemax-language';
  const ALLOWED_ORIGINS = [
    'https://wavemax.promo',
    'https://affiliate.wavemax.promo',
    'http://localhost:3000',
    'http://localhost:3001'
  ];

  let iframe = null;
  let lastIframeHeight = 0;
  let lastLanguage = null;
  let locationData = null;
  let parentReadyTimer = null;

  function init() {
    iframe = document.getElementById('wavemax-iframe') ||
             document.querySelector('iframe[data-wm-bridge]') ||
             document.querySelector('iframe[src*="wavemax.promo"]');

    if (!iframe) {
      return;
    }

    locationData = window.LOCATION_DATA || null;
    lastLanguage = localStorage.getItem(LANGUAGE_KEY) || 'en';

    window.addEventListener('message', handleMessage);
    window.addEventListener('languageChanged', onCustomLanguageEvent);
    window.addEventListener('storage', onStorageEvent);

    // Notify iframe that parent is ready (after the iframe has had time to
    // mount its own listener — small debounce instead of a fixed timer).
    parentReadyTimer = setTimeout(() => {
      sendToIframe({ type: 'parent-ready' });
    }, 250);
  }

  function isAllowedOrigin(origin) {
    return ALLOWED_ORIGINS.some(allowed =>
      origin === allowed ||
      origin.replace(/^https?:\/\//, '') === allowed.replace(/^https?:\/\//, '')
    );
  }

  function handleMessage(event) {
    if (!isAllowedOrigin(event.origin) || !event.data || !event.data.type) {
      return;
    }

    const { type, data } = event.data;

    switch (type) {
      case 'iframe-ready':
        onIframeReady();
        break;
      case 'request-language':
        sendCurrentLanguage();
        break;
      case 'request-location-data':
        sendLocationData();
        break;
      case 'resize':
        if (data && Number.isFinite(Number(data.height))) {
          resizeIframe(Number(data.height));
        }
        break;
      case 'seo-data':
        if (data) applySeoData(data);
        break;
      case 'navigate':
        if (data && typeof data.href === 'string') {
          handleNavigate(data.href);
        }
        break;
      case 'hide-page-header':
        // Legacy v2 message — no-op on v3 because the host doesn't have a
        // hidden Walibu page-header section. Kept accepted to avoid noise.
        break;
      default:
        // Unknown message — ignore, don't error. Forward-compat.
        break;
    }
  }

  function onIframeReady() {
    sendCurrentLanguage();
    sendLocationData();
  }

  function sendToIframe(message) {
    if (iframe && iframe.contentWindow) {
      try {
        iframe.contentWindow.postMessage(message, '*');
      } catch (e) {
        // Cross-origin postMessage with '*' should not throw, but defensive.
      }
    }
  }

  function sendCurrentLanguage() {
    sendToIframe({
      type: 'current-language',
      data: { language: localStorage.getItem(LANGUAGE_KEY) || 'en' }
    });
  }

  function sendLocationData() {
    if (!locationData) return;
    sendToIframe({
      type: 'location-data',
      data: locationData
    });
  }

  function broadcastLanguageChange(language) {
    if (language === lastLanguage) return;
    lastLanguage = language;
    sendToIframe({
      type: 'language-change',
      data: { language }
    });
  }

  function onCustomLanguageEvent(e) {
    const lang = e?.detail?.language;
    if (lang) broadcastLanguageChange(lang);
  }

  function onStorageEvent(e) {
    if (e.key === LANGUAGE_KEY && e.newValue) {
      broadcastLanguageChange(e.newValue);
    }
  }

  function resizeIframe(height) {
    if (!iframe) return;
    if (Math.abs(height - lastIframeHeight) > 5) {
      lastIframeHeight = height;
      iframe.style.height = height + 'px';
    }
  }

  /* ---------- SEO injection ---------- */

  function applySeoData(seo) {
    if (seo.meta) {
      if (seo.meta.title) document.title = seo.meta.title;
      setMetaName('description', seo.meta.description);
      setMetaName('keywords', seo.meta.keywords);
      setMetaName('author', seo.meta.author);
      setLink('canonical', seo.meta.canonicalUrl);
    }

    if (seo.openGraph) {
      setMetaProperty('og:title', seo.openGraph.title);
      setMetaProperty('og:description', seo.openGraph.description);
      setMetaProperty('og:type', seo.openGraph.type);
      setMetaProperty('og:url', seo.openGraph.url);
      setMetaProperty('og:image', seo.openGraph.image);
      setMetaProperty('og:image:width', seo.openGraph.imageWidth);
      setMetaProperty('og:image:height', seo.openGraph.imageHeight);
      setMetaProperty('og:site_name', seo.openGraph.siteName);
      setMetaProperty('og:locale', seo.openGraph.locale);
    }

    if (seo.twitter) {
      setMetaName('twitter:card', seo.twitter.card);
      setMetaName('twitter:site', seo.twitter.site);
      setMetaName('twitter:title', seo.twitter.title);
      setMetaName('twitter:description', seo.twitter.description);
      setMetaName('twitter:image', seo.twitter.image);
      setMetaName('twitter:image:alt', seo.twitter.imageAlt);
    }

    if (seo.structuredData) {
      // Replace previous bridge-injected JSON-LD blocks
      document.querySelectorAll('script[type="application/ld+json"][data-wm-bridge]').forEach(el => el.remove());
      Object.keys(seo.structuredData).forEach(schemaKey => {
        const node = document.createElement('script');
        node.type = 'application/ld+json';
        node.setAttribute('data-wm-bridge', '1');
        node.setAttribute('data-wm-bridge-schema', schemaKey);
        node.textContent = JSON.stringify(seo.structuredData[schemaKey]);
        document.head.appendChild(node);
      });
    }

    if (Array.isArray(seo.alternateLanguages)) {
      // Remove previous bridge-injected hreflang links, then re-add.
      document.querySelectorAll('link[rel="alternate"][data-wm-bridge]').forEach(el => el.remove());
      seo.alternateLanguages.forEach(({ hreflang, href }) => {
        if (!hreflang || !href) return;
        const link = document.createElement('link');
        link.rel = 'alternate';
        link.hreflang = hreflang;
        link.href = href;
        link.setAttribute('data-wm-bridge', '1');
        document.head.appendChild(link);
      });
    }
  }

  function setMetaName(name, content) {
    if (!content) return;
    let meta = document.head.querySelector(`meta[name="${name}"]`);
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', name);
      meta.setAttribute('data-wm-bridge', '1');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', content);
  }

  function setMetaProperty(property, content) {
    if (!content) return;
    let meta = document.head.querySelector(`meta[property="${property}"]`);
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('property', property);
      meta.setAttribute('data-wm-bridge', '1');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', content);
  }

  function setLink(rel, href) {
    if (!href) return;
    let link = document.head.querySelector(`link[rel="${rel}"]`);
    if (!link) {
      link = document.createElement('link');
      link.setAttribute('rel', rel);
      link.setAttribute('data-wm-bridge', '1');
      document.head.appendChild(link);
    }
    link.setAttribute('href', href);
  }

  /* ---------- Navigation ---------- */

  function handleNavigate(href) {
    if (!isSafeNavigation(href)) return;
    window.location.href = href;
  }

  function isSafeNavigation(href) {
    if (typeof href !== 'string') return false;
    if (href.startsWith('/')) return true;
    try {
      const url = new URL(href, window.location.origin);
      return url.origin === window.location.origin;
    } catch (_) {
      return false;
    }
  }

  /* ---------- Public API ---------- */

  window.WaveMaxBridgeV3 = {
    sendToIframe,
    resizeIframe,
    getCurrentLanguage: () => localStorage.getItem(LANGUAGE_KEY) || 'en',
    setLanguage: (language) => {
      localStorage.setItem(LANGUAGE_KEY, language);
      window.dispatchEvent(new CustomEvent('languageChanged', { detail: { language } }));
    },
    setLocationData: (data) => {
      locationData = data;
      sendLocationData();
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
