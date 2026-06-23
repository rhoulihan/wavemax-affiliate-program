// Geocoding service — Google Address Validation API.
//
// One server-side call validates + geocodes a US address (catches typos /
// undeliverable addresses) and returns lat/lng + placeId. Used to gate customer
// bag-claim registration to within a partner's opt-in radius (Haversine).
//
// Design contract: this module NEVER throws — every failure path returns
// `{ ok: false, reason }` so callers can FAIL-OPEN (an outage must not block
// signups). The API key is read at call time from GOOGLE_GEOCODING_API_KEY
// (server-side only, IP-restricted; never the referrer-restricted Places key).
//
// Google Maps Service Terms §5.3: lat/lng may be cached ≤30 days; placeId may
// be stored indefinitely — callers refresh stale coordinates accordingly.
const logger = require('../utils/logger');

const ENDPOINT = 'https://addressvalidation.googleapis.com/v1:validateAddress';
const TIMEOUT_MS = 5000;
const EARTH_RADIUS_MILES = 3959;

function isConfigured() {
  return !!process.env.GOOGLE_GEOCODING_API_KEY;
}

const toRad = (deg) => (deg * Math.PI) / 180;

/**
 * Great-circle distance between two points, in miles (Haversine).
 * A service "radius" is a circle, so straight-line distance is the correct
 * measure (not driving distance).
 */
function distanceMiles(lat1, lng1, lat2, lng2) {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_MILES * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Geocode + validate a US address via Google Address Validation.
 * @returns {Promise<{ok:true, lat, lng, placeId, formatted, granularity} | {ok:false, reason:string}>}
 *          Always resolves; never throws.
 */
async function geocodeAddress({ address, city, state, zipCode } = {}) {
  if (!address || !city || !state || !zipCode) {
    return { ok: false, reason: 'missing_fields' };
  }
  const key = process.env.GOOGLE_GEOCODING_API_KEY;
  if (!key) {
    return { ok: false, reason: 'not_configured' };
  }

  const body = {
    address: {
      regionCode: 'US',
      addressLines: [String(address).trim(), `${city}, ${state} ${zipCode}`.trim()].filter(Boolean)
    }
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${ENDPOINT}?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    if (!res.ok) {
      logger.warn('geocodeAddress: non-200 from Address Validation', { status: res.status });
      return { ok: false, reason: `http_${res.status}` };
    }
    const data = await res.json();
    const result = data && data.result;
    const loc = result && result.geocode && result.geocode.location;
    if (!loc || typeof loc.latitude !== 'number' || typeof loc.longitude !== 'number') {
      return { ok: false, reason: 'no_geocode' };
    }
    return {
      ok: true,
      lat: loc.latitude,
      lng: loc.longitude,
      placeId: (result.geocode && result.geocode.placeId) || null,
      formatted: (result.address && result.address.formattedAddress) || null,
      granularity: (result.verdict && result.verdict.validationGranularity) || null
    };
  } catch (err) {
    logger.warn('geocodeAddress: request failed (failing open)', { error: err.message });
    return { ok: false, reason: 'request_failed' };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { geocodeAddress, distanceMiles, isConfigured };
