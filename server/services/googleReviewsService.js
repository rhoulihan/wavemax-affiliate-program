const axios = require('axios');
const logger = require('../utils/logger');

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const PLACES_API_BASE = 'https://places.googleapis.com/v1/places';
const FIELD_MASK = 'reviews,rating,userRatingCount';

const cache = new Map();
let clockOffsetMs = 0;
const now = () => Date.now() + clockOffsetMs;

class ReviewsError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
    this.name = 'ReviewsError';
  }
}

function shapeReview(raw) {
  const author = raw.authorAttribution || {};
  return {
    author: author.displayName || 'Anonymous',
    rating: raw.rating,
    text: raw.text?.text || '',
    relativeTime: raw.relativePublishTimeDescription || '',
    publishTime: raw.publishTime || null,
    photoUrl: author.photoUri || null,
    googleProfileUrl: author.uri || null
  };
}

async function fetchPlaceReviews(placeId) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    throw new ReviewsError('GOOGLE_PLACES_API_KEY is not configured', 'CONFIG_MISSING_API_KEY');
  }

  try {
    const response = await axios.get(`${PLACES_API_BASE}/${placeId}`, {
      headers: {
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': FIELD_MASK
      },
      timeout: 5000
    });

    const data = response.data || {};
    return {
      totalReviewsAtSource: data.userRatingCount || 0,
      averageRatingAtSource: data.rating || 0,
      reviews: (data.reviews || []).map(shapeReview)
    };
  } catch (err) {
    if (err instanceof ReviewsError) throw err;
    const status = err?.response?.status;
    if (status === 404) {
      throw new ReviewsError(`Place not found: ${placeId}`, 'PLACE_NOT_FOUND');
    }
    logger.warn('googleReviewsService upstream error', { placeId, status });
    throw new ReviewsError(`Upstream error from Google (status ${status})`, 'UPSTREAM_ERROR');
  }
}

function filterByRating(reviews, minRating) {
  return reviews.filter(r => r.rating >= minRating);
}

async function getReviewsForLocation(placeId, { minRating = 1, limit = 5 } = {}) {
  const cacheKey = placeId;
  const cached = cache.get(cacheKey);
  const isFresh = cached && (now() - cached.fetchedAtEpoch) < CACHE_TTL_MS;

  if (isFresh) {
    return shapeResponse(placeId, cached, { minRating, limit, servedFromStaleCache: false });
  }

  try {
    const fetched = await fetchPlaceReviews(placeId);
    const fetchedAtEpoch = now();
    const entry = { ...fetched, fetchedAtEpoch, lastFetchedAt: new Date(fetchedAtEpoch).toISOString() };
    cache.set(cacheKey, entry);
    return shapeResponse(placeId, entry, { minRating, limit, servedFromStaleCache: false });
  } catch (err) {
    if (err.code === 'CONFIG_MISSING_API_KEY') {
      return emptyResponse(placeId, 'config');
    }
    if (err.code === 'PLACE_NOT_FOUND') {
      return emptyResponse(placeId, 'not_found');
    }
    if (cached) {
      logger.warn('Serving stale reviews cache after upstream failure', { placeId, code: err.code });
      return shapeResponse(placeId, cached, { minRating, limit, servedFromStaleCache: true });
    }
    return emptyResponse(placeId, 'upstream_error');
  }
}

function shapeResponse(placeId, entry, { minRating, limit, servedFromStaleCache }) {
  const filtered = filterByRating(entry.reviews, minRating).slice(0, limit);
  return {
    source: 'google',
    placeId,
    totalReviewsAtSource: entry.totalReviewsAtSource,
    averageRatingAtSource: entry.averageRatingAtSource,
    attributionHref: `https://www.google.com/maps/place/?q=place_id:${placeId}`,
    lastFetchedAt: entry.lastFetchedAt,
    servedFromStaleCache,
    reviews: filtered
  };
}

function emptyResponse(placeId, reason) {
  return {
    source: 'google',
    placeId,
    totalReviewsAtSource: 0,
    averageRatingAtSource: 0,
    attributionHref: placeId ? `https://www.google.com/maps/place/?q=place_id:${placeId}` : null,
    lastFetchedAt: null,
    servedFromStaleCache: false,
    reviews: [],
    reason
  };
}

module.exports = {
  fetchPlaceReviews,
  filterByRating,
  getReviewsForLocation,
  __clearCache: () => { cache.clear(); clockOffsetMs = 0; },
  __advanceCacheClock: (ms) => { clockOffsetMs += ms; }
};
