const express = require('express');
const router = express.Router();

/**
 * Expose the browser-restricted Google Maps API key for use by the
 * locations modal on corporate pages. The key is HTTP-referer locked
 * to rundberglaundry.com, so this is safe to surface from the server.
 *
 * Per-franchise host pages inject this same key via server-side
 * template substitution (franchiseController). Corporate pages are
 * static HTML so they fetch it from this endpoint on first modal open.
 */
router.get('/maps-config', (req, res) => {
  res.json({
    apiKey: process.env.GOOGLE_PLACES_API_KEY || '',
    placeId: process.env.LOCATION_PLACE_ID || ''
  });
});

module.exports = router;
