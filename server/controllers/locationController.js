const ControllerHelpers = require('../utils/controllerHelpers');
const googleReviewsService = require('../services/googleReviewsService');
const logger = require('../utils/logger');

const LOCATIONS = {
  'austin-tx': {
    placeIdEnv: 'LOCATION_AUSTIN_TX_PLACE_ID'
  }
};

function resolvePlaceId(slug) {
  const loc = LOCATIONS[slug];
  if (!loc) return null;
  return process.env[loc.placeIdEnv] || null;
}

exports.getReviews = ControllerHelpers.asyncWrapper(async (req, res) => {
  const { slug } = req.params;

  if (!LOCATIONS[slug]) {
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

  return ControllerHelpers.sendSuccess(res, { data });
});
