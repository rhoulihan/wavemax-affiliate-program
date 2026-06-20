// Public add-on catalog route — GET /api/v1/addons (active only, no auth).
// Powers the add-on selector on the customer order form. Admin CRUD lives under
// /api/v1/administrators/addons (see administratorRoutes.js).

const express = require('express');
const router = express.Router();
const addonController = require('../controllers/addonController');

router.get('/', addonController.listPublic);

module.exports = router;
