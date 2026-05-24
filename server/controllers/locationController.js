const ControllerHelpers = require('../utils/controllerHelpers');
const googleReviewsService = require('../services/googleReviewsService');
const registry = require('../services/franchiseRegistryService');
const logger = require('../utils/logger');

const LOCATIONS = {
  'austin-tx': {
    placeIdEnv: 'LOCATION_AUSTIN_TX_PLACE_ID'
  }
};

// Resolve the Google Place ID for a slug. Single source of truth is the
// franchise registry (public/data/franchises/<slug>.json → google.placeId —
// the exact value the page/client already uses for its Places call), so the
// cached endpoint and the page can never drift. Falls back to a per-location
// env override (legacy) if the registry has none.
function resolvePlaceId(slug) {
  const fromRegistry = registry.getFranchise(slug)?.google?.placeId;
  if (fromRegistry) return fromRegistry;
  const loc = LOCATIONS[slug];
  return (loc && process.env[loc.placeIdEnv]) || null;
}

exports.getReviews = ControllerHelpers.asyncWrapper(async (req, res) => {
  const { slug } = req.params;

  if (!LOCATIONS[slug] && !registry.getFranchise(slug)) {
    return ControllerHelpers.sendError(res, `Unknown location: ${slug}`, 404);
  }

  const minRating = req.query.minRating !== undefined ? Number(req.query.minRating) : 1;
  const limit = req.query.limit !== undefined ? Number(req.query.limit) : 5;

  if (!Number.isFinite(minRating) || minRating < 1 || minRating > 5) {
    return ControllerHelpers.sendError(res, 'minRating must be between 1 and 5', 400);
  }
  if (!Number.isFinite(limit) || limit < 1) {
    return ControllerHelpers.sendError(res, 'limit must be a positive integer', 400);
  }

  const cappedLimit = Math.min(limit, 5);
  const placeId = resolvePlaceId(slug);

  if (!placeId) {
    logger.warn('Location reviews requested but placeId is not configured', { slug });
    return ControllerHelpers.sendSuccess(res, {
      data: {
        source: 'google',
        placeId: null,
        totalReviewsAtSource: 0,
        averageRatingAtSource: 0,
        attributionHref: null,
        lastFetchedAt: null,
        servedFromStaleCache: false,
        reviews: [],
        reason: 'config'
      }
    });
  }

  const data = await googleReviewsService.getReviewsForLocation(placeId, {
    minRating,
    limit: cappedLimit
  });

  // Reviews change slowly; let the browser/edge cache the response so repeat
  // visits skip even the server round-trip. The service itself caches the
  // upstream Google Places call for 24h.
  res.set('Cache-Control', 'public, max-age=3600');
  return ControllerHelpers.sendSuccess(res, { data });
});
