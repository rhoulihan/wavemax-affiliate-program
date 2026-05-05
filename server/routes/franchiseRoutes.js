/**
 * Franchise routes.
 *
 * Wired into server.js BEFORE the static-file middleware so /:slug
 * intercepts before Express tries to serve a missing file. The slug
 * allowlist (registry lookup in the controller) makes this safe — any
 * unknown slug calls next() and falls through to the static handler.
 */

const express = require('express');
const router = express.Router();
const controller = require('../controllers/franchiseController');

// Per-franchise pages. Order matters: the more-specific pattern first.
router.get('/:slug/:page/', controller.renderFranchisePage);
router.get('/:slug/:page',  controller.renderFranchisePage);
router.get('/:slug/',       controller.renderFranchisePage);
router.get('/:slug',        controller.renderFranchisePage);

module.exports = router;
