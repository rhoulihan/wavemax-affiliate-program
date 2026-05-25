// Synthesize a franchise LOCATION_DATA object (the shape consumed by
// franchise-host.html + the franchise-default content + data-bind/bridge system)
// from a Google Business Profile details object. Used to render a localized
// PREVIEW for a franchisee who isn't yet a registered franchise.
//
// GBP gives us identity (name, address, phone, hours, geo, maps); everything else
// (pricing, amenities, equipment, curated photos, SEO copy) is filled with
// clearly-illustrative franchise defaults — the preview's job is to show the shape
// of the local site, and the onboarding call is where real content is captured.
'use strict';

// "825 E Rundberg Ln, Austin, TX 78753, USA" -> {street, city, state, zip}
function parseAddress(formatted) {
  const s = String(formatted || '').replace(/,?\s*(USA|United States)\s*$/i, '').trim();
  const parts = s.split(',').map((p) => p.trim()).filter(Boolean);
  let street = '', city = '', state = '', zip = '';
  if (parts.length) {
    const last = parts[parts.length - 1]; // "TX 78753" | "TX"
    const m = last.match(/([A-Za-z]{2})\s*(\d{5})?/);
    if (m) { state = m[1].toUpperCase(); zip = m[2] || ''; }
    city = parts.length >= 2 ? parts[parts.length - 2] : '';
    street = parts.slice(0, Math.max(1, parts.length - 2)).join(', ');
  }
  return { street, city, state, zip };
}

function phoneBits(phone) {
  const raw = String(phone || '').replace(/[^\d+]/g, '');
  let telRaw = '';
  if (raw) telRaw = raw.startsWith('+') ? raw : `+1${raw.replace(/^1/, '')}`;
  return { phone: phone || '', phoneTel: telRaw ? `tel:${telRaw}` : '', phoneTelRaw: telRaw };
}

// GBP weekdayDescriptions (e.g. "Monday: 7 AM–9 PM") -> {display, lastWash}
function parseHours(hoursArr) {
  if (!Array.isArray(hoursArr) || !hoursArr.length) return { display: '', lastWash: '', days: '' };
  const first = hoursArr.find((h) => /\d/.test(h)) || hoursArr[0];
  const m = first.match(/(\d{1,2}(?::\d{2})?\s*[AP]M)\s*[–\-to]+\s*(\d{1,2}(?::\d{2})?\s*[AP]M)/i);
  if (!m) return { display: first.replace(/^[^:]*:\s*/, '').trim(), lastWash: '', days: '' };
  const norm = (t) => t.replace(/\s+/g, '').replace(/:00/, '').toLowerCase();
  return { display: `${norm(m[1])}-${norm(m[2])}`, lastWash: norm(m[2]), days: '' };
}

function defaultSeo(name, city, state) {
  const loc = [city, state].filter(Boolean).join(', ');
  const title = (svc) => `${svc} in ${loc || 'your area'} | ${name}`;
  const desc = (svc) => `${svc} at ${name}${loc ? ` in ${loc}` : ''}. This is an illustrative preview — final content is built with you.`;
  return {
    keywords: [name, city && `laundromat ${city}`, 'laundromat near me', 'wash dry fold'].filter(Boolean).join(', '),
    localizedHeadlines: {
      landingTitle: title('Laundromat'),
      wdfTitle: title('Wash-Dry-Fold Laundry'),
      selfServeTitle: title('Self-Service Laundromat'),
      commercialTitle: title('Commercial Laundry'),
      aboutTitle: `About ${name}`,
      contactTitle: `Contact ${name}`
    },
    localizedDescriptions: {
      landingDescription: desc('Laundromat'),
      wdfDescription: desc('Wash-dry-fold'),
      selfServeDescription: desc('Self-service laundry'),
      commercialDescription: desc('Commercial laundry'),
      aboutDescription: desc('Family-owned laundromat'),
      contactDescription: desc('Contact us')
    },
    geoRegion: state ? `US-${state}` : '',
    geoPlacename: loc,
    geoPosition: '',
    icbm: ''
  };
}

/**
 * @param {object} gbp  gbpService.getPlaceDetails output (name, formattedAddress,
 *                      phone, hours[], location{latitude,longitude}, mapsUri, website,
 *                      rating, userRatingCount, placeId)
 * @param {{slug:string}} opts
 * @returns {object} LOCATION_DATA
 */
module.exports = function gbpToLocationData(gbp, opts = {}) {
  const g = gbp || {};
  const slug = opts.slug || 'preview';
  const name = g.name || 'Your Laundromat';
  const { street, city, state, zip } = parseAddress(g.formattedAddress);
  const ph = phoneBits(g.phone);
  const hours = parseHours(g.hours);
  const lat = g.location && (g.location.latitude != null) ? g.location.latitude : null;
  const lng = g.location && (g.location.longitude != null) ? g.location.longitude : null;
  const addressLine2 = [city, [state, zip].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  const mapsQuery = encodeURIComponent([name, g.formattedAddress].filter(Boolean).join(' '));

  return {
    slug,
    isPreview: true,
    brand: {
      name,
      parent: 'WaveMAX Laundry',
      tagline: city ? `${city}'s neighborhood laundromat` : ''
    },
    contact: {
      phone: ph.phone,
      phoneTel: ph.phoneTel,
      phoneTelRaw: ph.phoneTelRaw,
      address: street,
      city, state, zip, country: 'US',
      addressLine2,
      geo: { lat, lng },
      mapsUrl: g.mapsUri || `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`,
      mapsEmbedUrl: `https://www.google.com/maps?q=${mapsQuery}&output=embed`,
      neighborhood: ''
    },
    hours: {
      display: hours.display || 'See Google for hours',
      lastWash: hours.lastWash || '',
      days: hours.days || ''
    },
    // Illustrative defaults below — replaced with real values on the onboarding call.
    pricing: {
      wdf: { rate: 1.25, minLb: 10, currency: 'USD', display: '$1.25/lb' },
      selfServe: { minLoadDisplay: '$2.75', maxLoadDisplay: '$10.50', rangeDisplay: '$2.75 – $10.50', washMin: 20, dryMin: 20 },
      commercial: { rateFromLb: 0.95, currency: 'USD', fromDisplay: 'From $0.95/lb' }
    },
    amenities: ['Free WiFi', 'Free parking', 'Attendant on duty', 'Large-capacity machines', 'Card & coin payment'],
    serviceArea: city ? [city] : [],
    images: {
      hero: [],
      interior: [],
      landmarks: [],
      ogImage: 'https://wavemax.promo/assets/images/brand/logo-wavemax.png',
      ogImageAlt: `${name} preview`
    },
    seo: defaultSeo(name, city, state),
    nav: {
      commercialEnabled: true,
      commercialIndustries: { medical: true, gym: true, airbnb: true, restaurant: true, contractors: true },
      additional: [],
      sublinkExtensions: {}
    },
    google: { placeId: g.placeId || '', apiKey: '' },
    i18n: { languagesAvailable: ['en', 'es', 'pt', 'de'] }
  };
};

module.exports._internals = { parseAddress, phoneBits, parseHours };
