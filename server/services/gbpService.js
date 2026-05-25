// Google Business Profile resolver for the franchise self-serve preview.
//
// A franchisee pastes their Google Business link (any of: a /maps/place/ URL,
// a maps.app.goo.gl / g.co short link, or a search-result link). We resolve it
// to a canonical Google Places `placeId` plus the public fields we light-localize
// from (name, address, phone, hours, location, website, reviews count/rating).
//
// IMPORTANT: Google never exposes the listing's owner email — only the public
// fields below. Authorization is by attestation, not by this data. We use this
// only to (a) confirm the link points at a real business and (b) pre-fill the
// preview. Reuses the referer-restricted Places key pattern from
// googleReviewsService (the prod key is locked to the wavemax.promo referer).
'use strict';

const axios = require('axios');
const logger = require('../utils/logger');

const PLACES_BASE = 'https://places.googleapis.com/v1/places';
const DETAILS_FIELD_MASK = [
  'id', 'displayName', 'formattedAddress', 'internationalPhoneNumber',
  'nationalPhoneNumber', 'regularOpeningHours', 'location', 'websiteUri',
  'googleMapsUri', 'rating', 'userRatingCount'
].join(',');
const SEARCH_FIELD_MASK = 'places.id,places.displayName,places.formattedAddress,places.location';
const REFERER = 'https://wavemax.promo/';

class GbpError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'GbpError';
    this.code = code;
  }
}

function apiKey() {
  const k = process.env.GOOGLE_PLACES_API_KEY;
  if (!k) throw new GbpError('GOOGLE_PLACES_API_KEY is not configured', 'CONFIG_MISSING_API_KEY');
  return k;
}

// Follow redirects on a short link (maps.app.goo.gl / g.co / goo.gl) to its
// expanded maps URL. Returns the final URL, or the input unchanged on failure.
async function expandShortLink(link) {
  if (!/^https?:\/\/(maps\.app\.goo\.gl|g\.co|goo\.gl|maps\.google\.[a-z.]+\/url)/i.test(link)) {
    return link; // not a short link — use as-is
  }
  try {
    const resp = await axios.get(link, {
      maxRedirects: 5,
      timeout: 6000,
      validateStatus: () => true,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WaveMAX-Preview/1.0)' },
      maxContentLength: 256 * 1024
    });
    return (resp.request?.res?.responseUrl) || link;
  } catch (err) {
    // axios still exposes the final URL on some errors (e.g. content too large)
    return err.request?.res?.responseUrl || link;
  }
}

// Pull a human-readable business name + coordinate bias out of a Google Maps URL.
function parsePlaceFromUrl(url) {
  let name = null;
  let lat = null;
  let lng = null;
  const placeMatch = url.match(/\/maps\/place\/([^/@]+)/);
  if (placeMatch) {
    name = decodeURIComponent(placeMatch[1].replace(/\+/g, ' ')).trim() || null;
  }
  const atMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (atMatch) { lat = parseFloat(atMatch[1]); lng = parseFloat(atMatch[2]); }
  // Some links carry the query as ?q= or ?query=
  if (!name) {
    const q = url.match(/[?&](?:q|query)=([^&]+)/);
    if (q) name = decodeURIComponent(q[1].replace(/\+/g, ' ')).trim() || null;
  }
  return { name, lat, lng };
}

// Google Places Text Search → best-matching place (id + basics).
async function searchPlace(textQuery, bias) {
  const body = { textQuery };
  if (bias && Number.isFinite(bias.lat) && Number.isFinite(bias.lng)) {
    body.locationBias = { circle: { center: { latitude: bias.lat, longitude: bias.lng }, radius: 5000 } };
  }
  const resp = await axios.post(`${PLACES_BASE}:searchText`, body, {
    headers: {
      'X-Goog-Api-Key': apiKey(),
      'X-Goog-FieldMask': SEARCH_FIELD_MASK,
      'Referer': REFERER,
      'Content-Type': 'application/json'
    },
    timeout: 6000
  });
  const place = (resp.data?.places || [])[0];
  if (!place?.id) return null;
  return {
    placeId: place.id,
    name: place.displayName?.text || null,
    formattedAddress: place.formattedAddress || null,
    location: place.location || null
  };
}

// Full public details for a placeId (the light-localization payload).
async function getPlaceDetails(placeId) {
  const resp = await axios.get(`${PLACES_BASE}/${encodeURIComponent(placeId)}`, {
    headers: {
      'X-Goog-Api-Key': apiKey(),
      'X-Goog-FieldMask': DETAILS_FIELD_MASK,
      'Referer': REFERER
    },
    timeout: 6000
  });
  const d = resp.data || {};
  if (!d.id) throw new GbpError('Place not found', 'PLACE_NOT_FOUND');
  return {
    placeId: d.id,
    name: d.displayName?.text || null,
    formattedAddress: d.formattedAddress || null,
    phone: d.internationalPhoneNumber || d.nationalPhoneNumber || null,
    hours: d.regularOpeningHours?.weekdayDescriptions || null,
    location: d.location || null,
    website: d.websiteUri || null,
    mapsUri: d.googleMapsUri || null,
    rating: d.rating || null,
    userRatingCount: d.userRatingCount || 0
  };
}

// Resolve a pasted Google Business link to a confirmed place + details.
// Throws GbpError('RESOLVE_FAILED') when the link can't be turned into a place
// (the caller's UI should then ask for "business name + city" as a fallback).
async function resolveGbpLink(link) {
  if (!link || typeof link !== 'string' || !/^https?:\/\//i.test(link.trim())) {
    throw new GbpError('A valid Google Business link is required', 'INVALID_LINK');
  }
  const expanded = await expandShortLink(link.trim());
  const { name, lat, lng } = parsePlaceFromUrl(expanded);
  if (!name) {
    throw new GbpError('Could not read a business from that link', 'RESOLVE_FAILED');
  }
  const hit = await searchPlace(name, { lat, lng });
  if (!hit) throw new GbpError('No matching Google business found', 'RESOLVE_FAILED');
  const details = await getPlaceDetails(hit.placeId);
  return details;
}

// Resolve from an explicit "business name + city" fallback (modal step 2).
async function resolveByText(textQuery) {
  if (!textQuery || !textQuery.trim()) throw new GbpError('A business name is required', 'INVALID_QUERY');
  const hit = await searchPlace(textQuery.trim());
  if (!hit) throw new GbpError('No matching Google business found', 'RESOLVE_FAILED');
  return getPlaceDetails(hit.placeId);
}

module.exports = {
  GbpError,
  expandShortLink,
  parsePlaceFromUrl,
  searchPlace,
  getPlaceDetails,
  resolveGbpLink,
  resolveByText
};
