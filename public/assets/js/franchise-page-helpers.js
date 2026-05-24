/* franchise-page-helpers.js
 *
 * Shared runtime helpers for the franchise-default content templates.
 * Replaces what each per-page init script used to bake in as Austin-
 * specific constants (WATERMARK_URL, HERO_IMG, BUSINESS_ID, the entire
 * static SEO bundle). Now those values are derived from LOCATION_DATA
 * at the moment it arrives via the bridge, so the same templates render
 * correctly for every franchise.
 *
 * Exposes:
 *   window.FranchisePage.applyHeroWatermark(LOCATION_DATA)
 *   window.FranchisePage.buildSeo(LOCATION_DATA, pageKey)
 *   window.FranchisePage.businessId(LOCATION_DATA)
 *   window.FranchisePage.pageUrl(LOCATION_DATA, pageKey)
 *
 * pageKey is one of: 'landing' | 'wdf' | 'self-serve' | 'commercial' |
 *                    'about-us' | 'contact'
 */
(function () {
  'use strict';

  const SITE_ROOT = 'https://wavemax.promo';

  /* ---------- Same-origin image normalization ----------
   * Per-franchise image data carries ABSOLUTE https://wavemax.promo/... URLs.
   * The host page, however, is served from the franchise's own domain (e.g.
   * rundberglaundry.com). A browser-rendered <img>/background using the
   * absolute wavemax.promo URL fetches it cross-domain, gets a 301 to the
   * serving domain, and re-fetches it same-origin — a wasted round-trip per
   * image. relativizeAssetUrl strips the wavemax.promo host so the browser
   * loads the asset directly from whatever domain the page is on.
   *
   * IMPORTANT: only use this for BROWSER-RENDERED images (hero watermark,
   * gallery/rotator). Crawler-facing SEO fields (og:image, twitter:image,
   * JSON-LD image) MUST stay absolute — bots don't know the serving domain —
   * so ogImage()/buildSeo() deliberately do NOT call this. External hosts
   * (e.g. Wikimedia landmarks) are left untouched.
   */
  function relativizeAssetUrl(url) {
    if (!url || typeof url !== 'string') return '';
    return url.replace(/^https?:\/\/(?:www\.)?wavemax\.promo(?=\/)/i, '');
  }

  // Map pageKey → URL segment + page-specific copy seeds.
  const PAGE_SPEC = {
    'landing':     { path: '',                       service: 'Laundromat'           },
    'wdf':         { path: 'wash-dry-fold/',         service: 'Wash-Dry-Fold'        },
    'self-serve':  { path: 'self-serve-laundry/',    service: 'Self-Serve Laundry'   },
    'commercial':  { path: 'commercial/',            service: 'Commercial Laundry'   },
    'about-us':    { path: 'about-us/',              service: 'About Us'             },
    'contact':     { path: 'contact/',               service: 'Contact'              }
  };

  function pageUrl(data, pageKey) {
    const slug = data?.slug || '';
    const segment = (PAGE_SPEC[pageKey] || PAGE_SPEC.landing).path;
    return `${SITE_ROOT}/${slug}/${segment}`;
  }

  function businessId(data) {
    const slug = data?.slug || '';
    return `${SITE_ROOT}/${slug}/#localbusiness`;
  }

  function heroUrl(data) {
    // Browser-rendered hero background → load same-origin.
    return relativizeAssetUrl(data?.images?.hero?.[0] || '');
  }

  function ogImage(data) {
    // Crawler-facing → MUST stay absolute. Do not relativize.
    return data?.images?.ogImage || data?.images?.hero?.[0] || '';
  }

  function applyHeroWatermark(data) {
    const root = document.getElementById('wm-austin-watermark');
    if (!root) return;
    const url = heroUrl(data);
    if (!url) {
      root.classList.add('is-loaded');
      return;
    }
    const probe = new Image();
    probe.referrerPolicy = 'no-referrer';
    probe.onload = () => {
      root.style.backgroundImage = `url("${url}")`;
      root.classList.add('is-loaded');
    };
    probe.onerror = () => {
      // Even on error, mark loaded so the gradient/overlay shows.
      root.classList.add('is-loaded');
    };
    probe.src = url;
  }

  /* ---------- SEO builder ----------
   * Produces the same shape every per-page init used to pass to
   * IframeBridge.loadSEOConfig: { meta, openGraph, twitter,
   * structuredData, alternateLanguages }. Page-specific keyword and
   * headline copy comes from LOCATION_DATA.seo (built into the
   * registry at scripts/franchise-build/build-registry.js).
   */
  function buildSeo(data, pageKey) {
    if (!data) return null;
    const spec = PAGE_SPEC[pageKey] || PAGE_SPEC.landing;
    const url = pageUrl(data, pageKey);
    const hostUrl = `${SITE_ROOT}/${data.slug || ''}/`;
    const heroImg = ogImage(data);
    const bizId = businessId(data);

    const seoBaseline = data.seo || {};
    const keywords = (seoBaseline.keywordsByPage && seoBaseline.keywordsByPage['/' + (spec.path.replace(/\/$/, '') || '')]) ||
                     seoBaseline.keywords || '';
    const localized = seoBaseline.localizedHeadlines || {};
    const localizedDesc = seoBaseline.localizedDescriptions || {};

    // Page-specific title + description templates. Long, keyword-rich
    // shape (~70-90 char titles, ~150 char descriptions) matching the
    // server-side template in franchiseController.buildPageSeo so the
    // client-side SEO update doesn't shorten what SSR shipped.
    const headlines = {
      'landing':    { title: localized.landingTitle    || `Laundromat in ${data.contact?.city}, ${data.contact?.state} | Self-Service & Wash-Dry-Fold | ${data.brand?.name}`, description: localizedDesc.landingDescription   || localized.landingSubtitle || `Top-rated laundromat in ${data.contact?.city}, ${data.contact?.state}. Self-service & wash-dry-fold drop-off at ${data.contact?.address}.` },
      'wdf':        { title: localized.wdfTitle        || `Wash-Dry-Fold Laundry in ${data.contact?.city}, ${data.contact?.state} | Drop-Off Service | ${data.brand?.name}`,  description: localizedDesc.wdfDescription       || `Drop-off wash-dry-fold laundry in ${data.contact?.city}. Hospital-grade UV-sanitized water, eco-friendly detergent. ${data.brand?.name}.` },
      'self-serve': { title: localized.selfServeTitle  || `Self-Service Laundromat in ${data.contact?.city}, ${data.contact?.state} | Commercial Washers | ${data.brand?.name}`, description: localizedDesc.selfServeDescription || `Self-serve laundromat in ${data.contact?.city} with commercial Electrolux washers up to 80lb. ${data.brand?.name} at ${data.contact?.address}.` },
      'commercial': { title: localized.commercialTitle || `Commercial Laundry in ${data.contact?.city}, ${data.contact?.state} | Volume Pricing | ${data.brand?.name}`,        description: localizedDesc.commercialDescription || `Commercial laundry that scales with your ${data.contact?.city} business. Volume pricing tiers, same-day available. ${data.brand?.name}.` },
      'about-us':   { title: localized.aboutTitle      || `About ${data.brand?.name} | Family-Owned ${data.contact?.city} Laundromat`,                                          description: localizedDesc.aboutDescription     || `${data.brand?.name} — family-owned ${data.contact?.city} laundromat at ${data.contact?.address}. Hospital-grade UV water, fully attended.` },
      'contact':    { title: localized.contactTitle    || `Contact ${data.brand?.name} Laundromat | ${data.contact?.phone} | ${data.contact?.address}`,                          description: localizedDesc.contactDescription   || `Contact ${data.brand?.name}: call ${data.contact?.phone}, visit ${data.contact?.address}, ${data.contact?.city}, ${data.contact?.state}, or send a message.` }
    };
    const h = headlines[pageKey] || headlines['landing'];

    const localBusiness = {
      '@context':    'https://schema.org',
      '@type':       'LaundryOrDryCleaner',
      '@id':         bizId,
      name:          data.brand?.name,
      alternateName: data.brand?.name,
      url:           hostUrl,
      telephone:     data.contact?.phoneTelRaw,
      email:         data.contact?.email,
      priceRange:    '$',
      image:         heroImg ? [heroImg] : [],
      address: {
        '@type':         'PostalAddress',
        streetAddress:   data.contact?.address,
        addressLocality: data.contact?.city,
        addressRegion:   data.contact?.state,
        postalCode:      data.contact?.zip,
        addressCountry:  data.contact?.country || 'US'
      },
      geo: data.contact?.geo
        ? { '@type': 'GeoCoordinates', latitude: data.contact.geo.lat, longitude: data.contact.geo.lng }
        : undefined,
      openingHoursSpecification: data.hours?.open && data.hours?.close ? [{
        '@type':   'OpeningHoursSpecification',
        dayOfWeek: ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'],
        opens:     data.hours.open,
        closes:    data.hours.close
      }] : undefined,
      areaServed: (data.serviceArea || []).map((c) => ({ '@type': 'City', name: c }))
    };

    const breadcrumb = {
      '@context': 'https://schema.org',
      '@type':    'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'WaveMAX Laundry',                  item: 'https://www.wavemaxlaundry.com/' },
        { '@type': 'ListItem', position: 2, name: `${data.contact?.city}, ${data.contact?.state}`, item: hostUrl },
        ...(pageKey === 'landing' ? [] : [
          { '@type': 'ListItem', position: 3, name: spec.service }
        ])
      ]
    };

    return {
      meta: {
        title:        h.title,
        description:  h.description,
        canonicalUrl: url,
        author:       data.brand?.name,
        keywords:     keywords
      },
      openGraph: {
        title:       h.title,
        description: h.description,
        type:        'business.business',
        url:         url,
        image:       heroImg,
        imageWidth:  '1200',
        imageHeight: '630',
        siteName:    data.brand?.parent || 'WaveMAX Laundry',
        locale:      'en_US'
      },
      twitter: {
        card:        'summary_large_image',
        title:       h.title,
        description: h.description,
        image:       heroImg,
        imageAlt:    data.images?.ogImageAlt || `${data.brand?.name} storefront`
      },
      structuredData: { localBusiness, breadcrumb },
      alternateLanguages: [
        { hreflang: 'en',        href: url },
        { hreflang: 'es',        href: url },
        { hreflang: 'pt',        href: url },
        { hreflang: 'de',        href: url },
        { hreflang: 'x-default', href: url }
      ]
    };
  }

  /* ---------- Equipment-aware rendering ----------
   *
   * applyEquipment(LOCATION_DATA) walks the page and:
   *
   *   1. data-equipment-show="<flag>"  — element is hidden if the flag on
   *      LOCATION_DATA.equipment is FALSY. Use for content that should
   *      only render for stores with verified premium equipment, e.g.
   *      <section data-equipment-show="hasUVSanitization">...</section>.
   *      Supported flags (resolved via equipmentProfileService):
   *        hasUVSanitization
   *        marketingClaims.fast
   *        marketingClaims.premium
   *        marketingClaims.hospitalGrade
   *        marketingClaims.highSpin
   *
   *   2. data-equipment-hide="<flag>"  — opposite: hidden when flag is
   *      TRUTHY. Use for generic-fleet copy that should disappear when a
   *      store has premium equipment.
   *
   *   3. data-bind="equipment.<path>"  — handled by the bridge already,
   *      so equipment.spinGDisplay, equipment.washCycleMins, etc. work
   *      out of the box. (See parent-iframe-bridge-v3.js applyDataBind.)
   *
   * Page templates ship with GENERIC HTML defaults (safe copy that works
   * for any store). Premium-only fragments live behind data-equipment-show
   * and stay hidden until applyEquipment confirms the store qualifies.
   *
   * Run this after the bridge has injected LOCATION_DATA AND after
   * i18n.translatePage() — translatePage may rewrite text that
   * applyEquipment then needs to gate.
   */
  function getFlag(equipment, path) {
    if (!equipment || !path) return false;
    const parts = path.split('.');
    let v = equipment;
    for (const p of parts) {
      if (v == null) return false;
      v = v[p];
    }
    return Boolean(v);
  }

  function setVisible(el, visible) {
    // Don't use el.hidden — `[hidden] { display: none }` is the browser
    // default but ANY rule that sets display: more specifically (e.g.
    // .wm-card { display: flex }) wins on cascade and the element stays
    // visible. Use inline style.display which beats class-level rules.
    if (visible) el.style.removeProperty('display');
    else el.style.display = 'none';
  }

  function applyEquipment(data) {
    const eq = data && data.equipment;
    if (!eq) return;
    document.querySelectorAll('[data-equipment-show]').forEach((el) => {
      const flag = el.getAttribute('data-equipment-show');
      setVisible(el, getFlag(eq, flag));
    });
    document.querySelectorAll('[data-equipment-hide]').forEach((el) => {
      const flag = el.getAttribute('data-equipment-hide');
      setVisible(el, !getFlag(eq, flag));
    });
  }

  /**
   * applyTextPlaceholders(LOCATION_DATA)
   *
   * Walks every [data-i18n] element and substitutes {{dotted.path}}
   * placeholders against LOCATION_DATA. Lets translations carry slots
   * for franchise-specific values that change per store, without
   * forcing every i18n key to ship a per-store variant.
   *
   *   "{{contact.city}}'s Cleanest Laundromat"
   *     austin → "Austin's Cleanest Laundromat"
   *     jackson-keller-san-antonio → "San Antonio's Cleanest Laundromat"
   *
   *   "Drop off in the morning at {{contact.city}}, {{contact.state}}"
   *
   * Run AFTER translatePage — that's the call that sets textContent
   * from the i18n dictionary, and we substitute on top of that text.
   */
  function applyTextPlaceholders(data) {
    if (!data) return;
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const text = el.textContent || '';
      if (text.indexOf('{{') === -1) return;
      const replaced = text.replace(/\{\{\s*([^}\s]+)\s*\}\}/g, (_, p) => {
        const v = p.split('.').reduce((acc, k) => (acc == null ? acc : acc[k]), data);
        return v == null ? '' : String(v);
      });
      if (replaced !== text) el.textContent = replaced;
    });
  }

  /**
   * applyDocumentTitle(LOCATION_DATA, pageKey)
   *
   * Sets the iframe's document.title to a franchise-derived title.
   * The parent frame's title is already set via the bridge's SEO bundle
   * — this is purely the iframe's own title, which mostly affects
   * accessibility (screen readers announce 'document loaded: <title>'
   * when an iframe gains focus) and the browser tab if the iframe is
   * opened directly. SEO is unchanged either way.
   *
   * pageKey aligns with PAGE_SPEC: 'landing' | 'wdf' | 'self-serve' |
   * 'commercial' | 'about-us' | 'contact'.
   */
  const TITLE_PREFIX = {
    'landing':    null,                          // brand only
    'wdf':        'Wash-Dry-Fold',
    'self-serve': 'Self-Serve Laundry',
    'commercial': 'Commercial Laundry',
    'about-us':   'About',
    'contact':    'Contact'
  };
  function applyDocumentTitle(data, pageKey) {
    const brand = data && data.brand && data.brand.name;
    if (!brand) return;
    const prefix = TITLE_PREFIX[pageKey];
    document.title = prefix ? `${prefix} · ${brand}` : brand;
  }

  window.FranchisePage = {
    applyHeroWatermark,
    applyEquipment,
    applyTextPlaceholders,
    applyDocumentTitle,
    buildSeo,
    businessId,
    pageUrl,
    heroUrl,
    ogImage,
    relativizeAssetUrl
  };
})();
