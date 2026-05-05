/**
 * networkReviewsService.js
 *
 * Aggregates live 5-star Google customer reviews from franchise locations
 * across the WaveMAX network. Builds on top of googleReviewsService (which
 * caches per-placeId reviews for 24h) — the aggregator caches a SAMPLED
 * snapshot of network reviews for 6h so the testimonials page renders a
 * rotating mix without re-querying Places on every request.
 *
 * Used by: GET /api/v1/network-reviews
 * Used on: /testimonials/ (network-wide 5-star customer-review section)
 */

const fs = require('fs');
const path = require('path');
const googleReviewsService = require('./googleReviewsService');
const logger = require('../utils/logger');

const FRANCHISES_DIR = path.join(__dirname, '..', '..', 'public', 'data', 'franchises');
const NETWORK_CACHE_TTL_MS = 6 * 60 * 60 * 1000;        // 6h — rotate the sample shown
const SAMPLE_SIZE = 18;                                  // how many franchises to query per refresh
const FETCH_CONCURRENCY = 4;                             // parallelism for Places API calls
const TARGET_REVIEW_COUNT = 24;                          // how many reviews we'd like in the network pool

let cachedSnapshot = null;     // { reviews, fetchedAt, totalAvailable, totalSampled }
let cachedExpiresAt = 0;
let inFlight = null;

/** Load all franchise records from the registry. */
function loadFranchises() {
  try {
    const files = fs.readdirSync(FRANCHISES_DIR).filter(f => f.endsWith('.json'));
    return files.map((f) => {
      try { return JSON.parse(fs.readFileSync(path.join(FRANCHISES_DIR, f), 'utf8')); }
      catch (_) { return null; }
    }).filter(Boolean);
  } catch (e) {
    logger.warn('networkReviewsService: failed to read franchises dir', { err: e.message });
    return [];
  }
}

/** Pick N random elements from an array. Mutates a copy via Fisher-Yates. */
function sampleN(arr, n) {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out.slice(0, n);
}

/** Run async tasks with bounded concurrency. */
async function runWithConcurrency(items, worker, concurrency) {
  const results = new Array(items.length);
  let cursor = 0;
  async function next() {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      try { results[i] = await worker(items[i], i); }
      catch (e) { results[i] = null; }
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => next());
  await Promise.all(workers);
  return results;
}

/**
 * Build a fresh network-reviews snapshot. Samples SAMPLE_SIZE franchises with
 * Place IDs, fetches their cached reviews via googleReviewsService, filters to
 * 5-star, attaches franchise metadata to each review, returns up to
 * TARGET_REVIEW_COUNT total.
 */
async function buildSnapshot() {
  const all = loadFranchises();
  const eligible = all.filter((f) => f.google && f.google.placeId);
  if (eligible.length === 0) return { reviews: [], totalAvailable: 0, totalSampled: 0 };

  const sample = sampleN(eligible, Math.min(SAMPLE_SIZE, eligible.length));

  const results = await runWithConcurrency(sample, async (f) => {
    const data = await googleReviewsService.getReviewsForLocation(f.google.placeId, { minRating: 5, limit: 5 });
    return { franchise: f, data };
  }, FETCH_CONCURRENCY);

  // Flatten + tag each review with source franchise metadata
  const reviews = [];
  for (const r of results) {
    if (!r || !r.data || !Array.isArray(r.data.reviews)) continue;
    const f = r.franchise;
    for (const rv of r.data.reviews) {
      if (rv.rating !== 5 || !rv.text) continue;
      reviews.push({
        author:        rv.author,
        rating:        rv.rating,
        text:          rv.text,
        relativeTime:  rv.relativeTime,
        publishTime:   rv.publishTime,
        photoUrl:      rv.photoUrl,
        googleProfileUrl: rv.googleProfileUrl,
        location: {
          slug:  f.slug,
          city:  f.contact && f.contact.city,
          state: f.contact && f.contact.state,
          brand: f.brand && f.brand.name,
          url:   `/${f.slug}/`
        }
      });
    }
  }

  // Shuffle so the same locations don't always render at the top.
  const shuffled = sampleN(reviews, reviews.length);
  return {
    reviews:        shuffled.slice(0, TARGET_REVIEW_COUNT),
    totalAvailable: reviews.length,
    totalSampled:   sample.length,
    fetchedAt:      new Date().toISOString()
  };
}

/**
 * getNetworkReviews({ count }) — returns up to `count` 5-star reviews from
 * across the franchise network, with each review tagged with its source
 * franchise's city/state/slug. Cached for 6h.
 */
async function getNetworkReviews({ count = 12 } = {}) {
  const now = Date.now();

  // Serve from cache while fresh
  if (cachedSnapshot && now < cachedExpiresAt) {
    return shapeResponse(cachedSnapshot, count);
  }

  // De-duplicate concurrent rebuilds — only one Places fetch at a time
  if (inFlight) {
    const snap = await inFlight;
    return shapeResponse(snap, count);
  }

  inFlight = (async () => {
    try {
      const snap = await buildSnapshot();
      cachedSnapshot = snap;
      cachedExpiresAt = Date.now() + NETWORK_CACHE_TTL_MS;
      return snap;
    } catch (e) {
      logger.warn('networkReviewsService.buildSnapshot failed', { err: e.message });
      return cachedSnapshot || { reviews: [], totalAvailable: 0, totalSampled: 0 };
    } finally {
      inFlight = null;
    }
  })();

  const snap = await inFlight;
  return shapeResponse(snap, count);
}

function shapeResponse(snap, count) {
  return {
    reviews:        (snap.reviews || []).slice(0, count),
    totalAvailable: snap.totalAvailable || 0,
    totalSampled:   snap.totalSampled || 0,
    fetchedAt:      snap.fetchedAt || null
  };
}

module.exports = { getNetworkReviews };
