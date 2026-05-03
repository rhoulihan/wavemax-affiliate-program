const express = require('express');
const router = express.Router();
const locationController = require('../controllers/locationController');

router.get('/:slug/reviews', locationController.getReviews);

module.exports = router;
