// Order Expediter routes (PR D) — token-guarded, read-only.
//   GET /api/v1/expediter/summary?k=<EXPEDITER_TOKEN>

const express = require('express');
const router = express.Router();
const expediterGuard = require('../middleware/expediterGuard');
const expediterController = require('../controllers/expediterController');

router.get('/summary', expediterGuard, expediterController.getSummary);

module.exports = router;
