/**
 * Affiliate Schedule Routes
 * Routes for managing affiliate availability schedules
 */

const express = require('express');
const router = express.Router();
const affiliateScheduleController = require('../controllers/affiliateScheduleController');
const { authenticate } = require('../middleware/auth');
const { conditionalCsrf } = require('../config/csrf-config');

// Private routes (require authentication)

// Get affiliate's schedule
router.get(
  '/:affiliateId/schedule',
  authenticate,
  affiliateScheduleController.getSchedule
);

// Update weekly template
router.put(
  '/:affiliateId/schedule/template',
  authenticate,
  conditionalCsrf,
  affiliateScheduleController.updateWeeklyTemplate
);

// Add date exception
router.post(
  '/:affiliateId/schedule/exceptions',
  authenticate,
  conditionalCsrf,
  affiliateScheduleController.addDateException
);

// Delete date exception
router.delete(
  '/:affiliateId/schedule/exceptions/:exceptionId',
  authenticate,
  conditionalCsrf,
  affiliateScheduleController.deleteDateException
);

// Update schedule settings
router.put(
  '/:affiliateId/schedule/settings',
  authenticate,
  conditionalCsrf,
  affiliateScheduleController.updateScheduleSettings
);

// Public routes (no authentication required)

// Get available slots for a date range
router.get(
  '/:affiliateId/available-slots',
  affiliateScheduleController.getAvailableSlots
);

// Check specific slot availability
router.get(
  '/:affiliateId/available-slots/check',
  affiliateScheduleController.checkSlotAvailability
);

module.exports = router;
