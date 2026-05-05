const express = require('express');
const router = express.Router();
const locationController = require('../controllers/locationController');
const networkReviewsService = require('../services/networkReviewsService');
const logger = require('../utils/logger');

/* GET /api/v1/location/network-reviews
 * Aggregated 5-star customer reviews from across the franchise network,
 * tagged with the source store's city / state / brand. Used by the
 * /testimonials/ page to render a live customer-side credibility layer
 * alongside the franchisee owner quotes. Cached 6h server-side.
 *
 * MUST be declared BEFORE the /:slug/reviews route — Express matches
 * routes in order, and /:slug would swallow 'network-reviews' as a slug.
 */
router.get('/network-reviews', async (req, res) => {
  try {
    const count = Math.min(parseInt(req.query.count, 10) || 12, 36);
    const result = await networkReviewsService.getNetworkReviews({ count });
    res.set('Cache-Control', 'public, max-age=600');   // browser cache 10 min
    res.json({ success: true, ...result });
  } catch (e) {
    logger.warn('network-reviews endpoint failed', { err: e.message });
    res.json({ success: false, reviews: [], totalAvailable: 0, totalSampled: 0 });
  }
});

router.get('/:slug/reviews', locationController.getReviews);

module.exports = router;
