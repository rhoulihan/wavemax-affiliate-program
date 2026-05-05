#!/usr/bin/env node
/**
 * Compose final per-franchise LOCATION_DATA files.
 *
 * Inputs:
 *   - locations.with-images.json   (LOCATIONS array + image probe result)
 *   - DEFAULTS                      (corporate-boilerplate values for fields
 *                                    that vary per franchise but we don't
 *                                    have authoritative values for yet)
 *
 * Outputs:
 *   - public/data/franchises.json                   (index — slug,name,address,city,state,zip,phone,lat,lng,url)
 *   - public/data/franchises/<slug>.json            (one file per franchise — full LOCATION_DATA)
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const SRC  = path.join(__dirname, 'locations.with-images.json');
const OUT_DIR = path.join(ROOT, 'public/data/franchises');
const OUT_INDEX = path.join(ROOT, 'public/data/franchises.json');

const KENT_WA = 'https://wavemaxlaundry.com/wp-content/uploads/locations/kent-wa';
const KENT_FALLBACK = {
  hero:     [`${KENT_WA}/hero-1.jpg`, `${KENT_WA}/hero-2.jpg`, `${KENT_WA}/hero-3.jpg`],
  interior: [`${KENT_WA}/interior-1.jpg`, `${KENT_WA}/interior-2.jpg`, `${KENT_WA}/interior-3.jpg`,
             `${KENT_WA}/interior-4.jpg`, `${KENT_WA}/interior-5.jpg`, `${KENT_WA}/interior-6.jpg`],
  owner:    [],
  ogImage:  `${KENT_WA}/hero-1.jpg`
};

// Generic defaults — only fields that are TRUE for every franchise. Hours,
// pricing, equipment, and amenities all vary by store (a 2025 store like
// Austin runs new 80lb machines + UV LUX; older stores have whatever they
// were built with). The templates degrade gracefully when these are null,
// showing generic copy ("call for pricing", "premium washers") instead.
//
// Per-store ground truth (as we learn it) goes in known-overrides.json
// and gets deep-merged on top of these placeholders.
const DEFAULTS = {
  hours: {
    open: '', close: '', display: 'Call for hours',
    lastWash: '', days: ''
  },
  pricing: {
    wdf: { rate: null, minLb: null, currency: 'USD', display: 'Call for pricing' },
    selfServe: {
      minLoad: null, maxLoad: null,
      minLoadDisplay: '', maxLoadDisplay: '',
      washMin: null, dryMin: null,
      rangeDisplay: 'Call for pricing'
    }
  },
  equipment: { washers: null, dryers: null, capacityLb: null },
  amenities: ['Free WiFi', 'Free Parking'],   // safe baseline only — UV LUX, ADA etc. vary by store
  i18n: { languagesAvailable: ['en', 'es', 'pt', 'de'] }
};

// Deep merge: src values override dst values, but for arrays src
// REPLACES dst entirely (so amenities: ["A","B"] in known-overrides
// fully replaces the default ["Free WiFi", "Free Parking"]).
function deepMerge(dst, src) {
  if (src == null) return dst;
  if (Array.isArray(src)) return src.slice();
  if (typeof src !== 'object') return src;
  const out = (typeof dst === 'object' && dst !== null && !Array.isArray(dst)) ? { ...dst } : {};
  for (const k of Object.keys(src)) out[k] = deepMerge(dst ? dst[k] : undefined, src[k]);
  return out;
}

function normalizePhone(phoneRaw) {
  if (!phoneRaw) return { phone: '', phoneTel: '', phoneTelRaw: '' };
  // "+1 (512) 553-1674" → display "(512) 553-1674", tel "tel:+15125531674"
  const digits = phoneRaw.replace(/[^\d]/g, '');
  const display = phoneRaw.startsWith('+1 ') ? phoneRaw.slice(3) : phoneRaw;
  const telRaw = digits.length === 11 ? `+${digits}` : digits.length === 10 ? `+1${digits}` : `+${digits}`;
  return { phone: display, phoneTel: `tel:${telRaw}`, phoneTelRaw: telRaw };
}

function buildMapsUrl(addr) {
  const q = encodeURIComponent(`${addr.address} ${addr.city} ${addr.state} ${addr.zip}`).replace(/%20/g, '+');
  return `https://www.google.com/maps/dir/?api=1&destination=${q}`;
}

function withFallbackImages(probed) {
  return {
    hero:     probed.hero.length     > 0 ? probed.hero     : KENT_FALLBACK.hero,
    interior: probed.interior.length > 0 ? probed.interior : KENT_FALLBACK.interior,
    owner:    probed.owner,                                        // empty → placeholder card at runtime
    landmarks: [],
    ogImage:  probed.ogImage || KENT_FALLBACK.ogImage,
    ogImageAlt: probed.ogImageAlt || 'WaveMAX Laundry storefront',
    mapPreview: ''
  };
}

// Build a per-franchise SEO baseline. Page-level SEO bundles (per-page
// title/description/structuredData) are generated at template-render time
// from LOCATION_DATA — these are the seeds the templates read.
function buildSeoBaseline(loc) {
  const cityClean = (loc.city || '').replace(/[.,]/g, '').trim();
  const stateUpper = (loc.state || '').toUpperCase();
  const cityLower = cityClean.toLowerCase();
  const stateLower = stateUpper.toLowerCase();

  // Keyword baseline — applied to every page on this franchise. Page-specific
  // keywords (wash-dry-fold, self-serve, commercial) layer on top at render.
  const keywordSeeds = [
    `laundromat ${cityLower} ${stateLower}`,
    `laundromat near me`,
    `${cityLower} laundromat`,
    `wash dry fold ${cityLower}`,
    `self service laundry ${cityLower}`,
    `drop off laundry ${cityLower}`,
    `coin laundry ${cityLower}`,
    `commercial laundry ${cityLower}`,
    `wavemax ${cityLower}`,
    `wavemax ${cityLower} ${stateLower}`
  ];

  // Localized H1/headline patterns the templates can use as fallbacks
  // when aboutContent.heroTitle is empty. Keeps every page indexable
  // even before franchise-specific copy is written.
  const localizedHeadlines = {
    landingTitle:    `${cityClean}'s premier laundromat`,
    landingSubtitle: `Self-serve laundry, wash-dry-fold, and commercial accounts in ${cityClean}, ${stateUpper}.`,
    wdfTitle:        `Wash-Dry-Fold drop-off laundry in ${cityClean}, ${stateUpper}`,
    selfServeTitle:  `Self-serve laundry in ${cityClean}, ${stateUpper}`,
    commercialTitle: `Commercial laundry service for ${cityClean} businesses`,
    aboutTitle:      `About WaveMAX ${cityClean}`,
    contactTitle:    `Contact WaveMAX ${cityClean}, ${stateUpper}`
  };

  return {
    keywords:           keywordSeeds.join(', '),
    keywordsByPage: {
      '/':                    keywordSeeds.join(', '),
      '/wash-dry-fold':       `wash dry fold ${cityLower}, drop off laundry ${cityLower}, fluff and fold ${cityLower}, ` + keywordSeeds.slice(0, 6).join(', '),
      '/self-serve-laundry':  `self service laundry ${cityLower}, coin laundry ${cityLower}, laundromat ${cityLower}, ` + keywordSeeds.slice(0, 6).join(', '),
      '/commercial':          `commercial laundry ${cityLower}, business laundry ${cityLower}, hotel laundry ${cityLower}, restaurant linens ${cityLower}, ` + keywordSeeds.slice(0, 6).join(', '),
      '/about-us':            `wavemax owners ${cityLower}, family-owned laundromat ${cityLower}, ` + keywordSeeds.slice(0, 4).join(', '),
      '/contact':             `contact wavemax ${cityLower}, laundromat phone ${cityLower}, ` + keywordSeeds.slice(0, 4).join(', ')
    },
    localizedHeadlines,
    geoRegion:    `US-${stateUpper}`,
    geoPlacename: `${cityClean}, ${stateUpper}`,
    geoPosition:  `${loc.lat};${loc.lng}`,
    icbm:         `${loc.lat}, ${loc.lng}`
  };
}

function buildLocationData(loc) {
  const phone = normalizePhone(loc.phone);
  const cityClean = (loc.city || '').replace(/[.,]/g, '').trim();
  const localityShort = cityClean ? `${cityClean}, ${loc.state}` : loc.state;

  return {
    slug: loc.slug,
    brand: {
      name: loc.name || `WaveMAX ${localityShort}`,
      parent: 'WaveMAX Laundry',
      tagline: ''
    },
    contact: {
      ...phone,
      email: 'no-reply@wavemax.promo',                 // single corporate email; per-franchise can override
      emailMailto: 'mailto:no-reply@wavemax.promo',
      address: loc.address || '',
      city: cityClean,
      state: loc.state || '',
      zip: loc.zip || '',
      country: 'US',
      addressLine2: cityClean && loc.zip ? `${cityClean}, ${loc.state} ${loc.zip}` : '',
      geo: { lat: loc.lat, lng: loc.lng },
      mapsUrl: buildMapsUrl({ address: loc.address || '', city: cityClean, state: loc.state || '', zip: loc.zip || '' })
    },
    hours: { ...DEFAULTS.hours },
    owners: [],                                        // empty → placeholder card at runtime
    aboutContent: {
      heroTitle: '', heroTagline: '', heroSubtitle: '',
      missionEyebrow: '', missionTitle: '', missionBody: [],
      valuesEyebrow: '', valuesTitle: '', values: [],
      teamEyebrow: '', teamTitle: '', teamLede: '',
      communityTitle: '', communityBody: '',
      ctaText: ''
    },
    pricing: { ...DEFAULTS.pricing },
    equipment: { ...DEFAULTS.equipment },
    amenities: [...DEFAULTS.amenities],
    serviceArea: [cityClean].filter(Boolean),          // start with own city; franchise can extend
    social: { facebook: '', instagram: '' },
    google: { placeId: '', apiKey: '', profileUrl: '', reviewsUrl: '' },
    images: withFallbackImages(loc.images),
    seo: buildSeoBaseline(loc),
    i18n: { ...DEFAULTS.i18n },
    nav: {
      commercialEnabled: true,
      commercialIndustries: { medical: true, gym: true, airbnb: true, restaurant: true, contractors: true },
      additional: [],
      sublinkExtensions: {}
    },
    iframeOverrides: {}
  };
}

(function main() {
  const sources = JSON.parse(fs.readFileSync(SRC, 'utf8'));
  const overridesPath = path.join(__dirname, 'known-overrides.json');
  const overrides = fs.existsSync(overridesPath) ? JSON.parse(fs.readFileSync(overridesPath, 'utf8')) : {};
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const index = [];
  let appliedOverrides = 0;
  for (const loc of sources) {
    let data = buildLocationData(loc);
    if (overrides[loc.slug]) {
      data = deepMerge(data, overrides[loc.slug]);
      appliedOverrides++;
    }
    const outPath = path.join(OUT_DIR, `${loc.slug}.json`);
    fs.writeFileSync(outPath, JSON.stringify(data, null, 2) + '\n');

    index.push({
      slug:    data.slug,
      name:    data.brand.name,
      city:    data.contact.city,
      state:   data.contact.state,
      zip:     data.contact.zip,
      address: data.contact.address,
      phone:   data.contact.phone,
      lat:     data.contact.geo.lat,
      lng:     data.contact.geo.lng,
      url:     `/${data.slug}/`,
      hasHeroImages:     data.images.hero[0]?.includes(`/${data.slug}/`) ?? false,
      hasOwnerPhoto:     data.images.owner.length > 0
    });
  }

  fs.writeFileSync(OUT_INDEX, JSON.stringify(index, null, 2) + '\n');
  console.log(`Wrote ${index.length} per-franchise files → ${path.relative(ROOT, OUT_DIR)}/`);
  console.log(`Wrote index → ${path.relative(ROOT, OUT_INDEX)}`);
  console.log(`Known-overrides applied: ${appliedOverrides}`);
  console.log(`States represented:`, [...new Set(index.map(i => i.state))].sort().join(' '));
})();
