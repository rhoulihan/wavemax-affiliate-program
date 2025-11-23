/**
 * Affiliate Schedule Controller
 * Manages affiliate availability schedules for pickup management
 */

const Affiliate = require('../models/Affiliate');
const ControllerHelpers = require('../utils/controllerHelpers');

const VALID_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const VALID_TIME_SLOTS = ['morning', 'afternoon', 'evening'];

/**
 * Get affiliate's schedule
 */
exports.getSchedule = ControllerHelpers.asyncWrapper(async (req, res) => {
  const { affiliateId } = req.params;

  const affiliate = await Affiliate.findOne({ affiliateId });

  if (!affiliate) {
    return ControllerHelpers.sendError(res, 'Affiliate not found', 404);
  }

  // Authorization check: Must be own schedule or admin
  if (req.user.role !== 'admin' && req.user.role !== 'administrator' && req.user.affiliateId !== affiliateId) {
    return ControllerHelpers.sendError(res, 'Not authorized to view this schedule', 403);
  }

  // Return schedule or defaults if not set
  const schedule = affiliate.availabilitySchedule || {};

  ControllerHelpers.sendSuccess(res, {
    weeklyTemplate: schedule.weeklyTemplate || getDefaultWeeklyTemplate(),
    dateExceptions: schedule.dateExceptions || [],
    scheduleSettings: schedule.scheduleSettings || getDefaultScheduleSettings()
  }, 'Schedule retrieved successfully');
});

/**
 * Get default weekly template
 */
function getDefaultWeeklyTemplate() {
  return {
    monday: { enabled: true, timeSlots: { morning: true, afternoon: true, evening: true } },
    tuesday: { enabled: true, timeSlots: { morning: true, afternoon: true, evening: true } },
    wednesday: { enabled: true, timeSlots: { morning: true, afternoon: true, evening: true } },
    thursday: { enabled: true, timeSlots: { morning: true, afternoon: true, evening: true } },
    friday: { enabled: true, timeSlots: { morning: true, afternoon: true, evening: true } },
    saturday: { enabled: true, timeSlots: { morning: true, afternoon: true, evening: true } },
    sunday: { enabled: false, timeSlots: { morning: false, afternoon: false, evening: false } }
  };
}

/**
 * Get default schedule settings
 */
function getDefaultScheduleSettings() {
  return {
    advanceBookingDays: 1,
    maxBookingDays: 30,
    timezone: 'America/Chicago'
  };
}

/**
 * Update weekly template
 */
exports.updateWeeklyTemplate = ControllerHelpers.asyncWrapper(async (req, res) => {
  const { affiliateId } = req.params;
  const { weeklyTemplate } = req.body;

  // Authorization check
  if (req.user.role !== 'admin' && req.user.role !== 'administrator' && req.user.affiliateId !== affiliateId) {
    return ControllerHelpers.sendError(res, 'Not authorized to update this schedule', 403);
  }

  const affiliate = await Affiliate.findOne({ affiliateId });

  if (!affiliate) {
    return ControllerHelpers.sendError(res, 'Affiliate not found', 404);
  }

  // Validate input
  if (!weeklyTemplate || typeof weeklyTemplate !== 'object') {
    return ControllerHelpers.sendError(res, 'Weekly template is required', 400);
  }

  // Validate each day in the update
  for (const day in weeklyTemplate) {
    if (!VALID_DAYS.includes(day)) {
      return ControllerHelpers.sendError(res, `Invalid day: ${day}`, 400);
    }

    const dayConfig = weeklyTemplate[day];

    if (dayConfig.enabled !== undefined && typeof dayConfig.enabled !== 'boolean') {
      return ControllerHelpers.sendError(res, `enabled must be a boolean for ${day}`, 400);
    }

    if (dayConfig.timeSlots) {
      for (const slot in dayConfig.timeSlots) {
        if (!VALID_TIME_SLOTS.includes(slot)) {
          return ControllerHelpers.sendError(res, `Invalid time slot: ${slot}`, 400);
        }
        if (typeof dayConfig.timeSlots[slot] !== 'boolean') {
          return ControllerHelpers.sendError(res, `Time slot ${slot} must be a boolean`, 400);
        }
      }
    }
  }

  // Apply updates
  for (const day in weeklyTemplate) {
    const dayConfig = weeklyTemplate[day];

    if (dayConfig.enabled !== undefined) {
      affiliate.availabilitySchedule.weeklyTemplate[day].enabled = dayConfig.enabled;
    }

    if (dayConfig.timeSlots) {
      for (const slot in dayConfig.timeSlots) {
        affiliate.availabilitySchedule.weeklyTemplate[day].timeSlots[slot] = dayConfig.timeSlots[slot];
      }
    }
  }

  await affiliate.save();

  ControllerHelpers.sendSuccess(res, {
    weeklyTemplate: affiliate.availabilitySchedule.weeklyTemplate
  }, 'Weekly template updated successfully');
});

/**
 * Add date exception
 */
exports.addDateException = ControllerHelpers.asyncWrapper(async (req, res) => {
  const { affiliateId } = req.params;
  const { date, type, timeSlots, reason } = req.body;

  // Authorization check
  if (req.user.role !== 'admin' && req.user.role !== 'administrator' && req.user.affiliateId !== affiliateId) {
    return ControllerHelpers.sendError(res, 'Not authorized to update this schedule', 403);
  }

  const affiliate = await Affiliate.findOne({ affiliateId });

  if (!affiliate) {
    return ControllerHelpers.sendError(res, 'Affiliate not found', 404);
  }

  // Validate date
  if (!date) {
    return ControllerHelpers.sendError(res, 'Date is required', 400);
  }

  const exceptionDate = new Date(date);
  exceptionDate.setHours(12, 0, 0, 0); // Set to noon to avoid timezone issues

  if (isNaN(exceptionDate.getTime())) {
    return ControllerHelpers.sendError(res, 'Invalid date format', 400);
  }

  // Check if date is in the past
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (exceptionDate < today) {
    return ControllerHelpers.sendError(res, 'Cannot add exceptions for past dates', 400);
  }

  // Validate type
  if (!type || !['block', 'override'].includes(type)) {
    return ControllerHelpers.sendError(res, 'Invalid exception type. Must be "block" or "override"', 400);
  }

  // Check for conflicting orders
  const validationResult = await affiliate.validateScheduleChange(exceptionDate, 'morning');
  let warning = null;
  if (!validationResult.valid) {
    warning = `Warning: There are ${validationResult.conflicts.length} existing order(s) on this date that may be affected.`;
  }

  // Create exception
  const exception = {
    date: exceptionDate,
    type: type,
    timeSlots: type === 'block' ? { morning: false, afternoon: false, evening: false } : (timeSlots || { morning: false, afternoon: false, evening: false }),
    reason: reason || '',
    createdAt: new Date()
  };

  affiliate.availabilitySchedule.dateExceptions.push(exception);
  await affiliate.save();

  const savedException = affiliate.availabilitySchedule.dateExceptions[affiliate.availabilitySchedule.dateExceptions.length - 1];

  const responseData = {
    exception: savedException
  };

  if (warning) {
    res.status(201).json({
      success: true,
      message: 'Date exception added successfully',
      warning: warning,
      data: responseData
    });
  } else {
    res.status(201).json({
      success: true,
      message: 'Date exception added successfully',
      data: responseData
    });
  }
});

/**
 * Delete date exception
 */
exports.deleteDateException = ControllerHelpers.asyncWrapper(async (req, res) => {
  const { affiliateId, exceptionId } = req.params;

  // Authorization check
  if (req.user.role !== 'admin' && req.user.role !== 'administrator' && req.user.affiliateId !== affiliateId) {
    return ControllerHelpers.sendError(res, 'Not authorized to update this schedule', 403);
  }

  const affiliate = await Affiliate.findOne({ affiliateId });

  if (!affiliate) {
    return ControllerHelpers.sendError(res, 'Affiliate not found', 404);
  }

  const exceptionIndex = affiliate.availabilitySchedule.dateExceptions.findIndex(
    ex => ex._id.toString() === exceptionId
  );

  if (exceptionIndex === -1) {
    return ControllerHelpers.sendError(res, 'Exception not found', 404);
  }

  affiliate.availabilitySchedule.dateExceptions.splice(exceptionIndex, 1);
  await affiliate.save();

  ControllerHelpers.sendSuccess(res, null, 'Date exception removed successfully');
});

/**
 * Get available slots for a date range (public endpoint)
 */
exports.getAvailableSlots = ControllerHelpers.asyncWrapper(async (req, res) => {
  const { affiliateId } = req.params;
  const { startDate, endDate } = req.query;

  const affiliate = await Affiliate.findOne({ affiliateId });

  if (!affiliate) {
    return ControllerHelpers.sendError(res, 'Affiliate not found', 404);
  }

  // Validate required parameters
  if (!startDate || !endDate) {
    return ControllerHelpers.sendError(res, 'Both startDate and endDate are required', 400);
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return ControllerHelpers.sendError(res, 'Invalid date format', 400);
  }

  // Check date range doesn't exceed 90 days
  const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
  if (daysDiff > 90) {
    return ControllerHelpers.sendError(res, 'Date range cannot exceed 90 days', 400);
  }

  // Get available dates
  const availableDates = affiliate.getAvailableDates(start, end);

  // Format dates for response
  const formattedDates = availableDates.map(item => ({
    date: item.date.toISOString().split('T')[0],
    dayOfWeek: affiliate.getDayOfWeekKey(item.date),
    availableSlots: item.timeSlots, // Frontend expects 'availableSlots' key
    timeSlots: item.timeSlots, // Keep for backward compatibility
    allDay: item.allDay
  }));

  ControllerHelpers.sendSuccess(res, {
    availableDates: formattedDates,
    affiliateSettings: affiliate.availabilitySchedule.scheduleSettings
  }, 'Available slots retrieved successfully');
});

/**
 * Check specific slot availability (public endpoint)
 */
exports.checkSlotAvailability = ControllerHelpers.asyncWrapper(async (req, res) => {
  const { affiliateId } = req.params;
  const { date, timeSlot } = req.query;

  const affiliate = await Affiliate.findOne({ affiliateId });

  if (!affiliate) {
    return ControllerHelpers.sendError(res, 'Affiliate not found', 404);
  }

  // Validate required parameters
  if (!date || !timeSlot) {
    return ControllerHelpers.sendError(res, 'Both date and timeSlot are required', 400);
  }

  // Validate time slot
  if (!VALID_TIME_SLOTS.includes(timeSlot)) {
    return ControllerHelpers.sendError(res, 'Invalid time slot. Must be morning, afternoon, or evening', 400);
  }

  const checkDate = new Date(date);
  if (isNaN(checkDate.getTime())) {
    return ControllerHelpers.sendError(res, 'Invalid date format', 400);
  }

  const available = affiliate.isAvailable(checkDate, timeSlot);

  ControllerHelpers.sendSuccess(res, {
    available: available,
    date: date,
    timeSlot: timeSlot
  }, 'Availability check completed');
});

/**
 * Update schedule settings
 */
exports.updateScheduleSettings = ControllerHelpers.asyncWrapper(async (req, res) => {
  const { affiliateId } = req.params;
  const { advanceBookingDays, maxBookingDays, timezone } = req.body;

  // Authorization check
  if (req.user.role !== 'admin' && req.user.role !== 'administrator' && req.user.affiliateId !== affiliateId) {
    return ControllerHelpers.sendError(res, 'Not authorized to update this schedule', 403);
  }

  const affiliate = await Affiliate.findOne({ affiliateId });

  if (!affiliate) {
    return ControllerHelpers.sendError(res, 'Affiliate not found', 404);
  }

  // Validate advance booking days
  if (advanceBookingDays !== undefined) {
    if (typeof advanceBookingDays !== 'number' || advanceBookingDays < 0 || advanceBookingDays > 30) {
      return ControllerHelpers.sendError(res, 'advanceBookingDays must be between 0 and 30', 400);
    }
    affiliate.availabilitySchedule.scheduleSettings.advanceBookingDays = advanceBookingDays;
  }

  // Validate max booking days
  if (maxBookingDays !== undefined) {
    if (typeof maxBookingDays !== 'number' || maxBookingDays < 1 || maxBookingDays > 90) {
      return ControllerHelpers.sendError(res, 'maxBookingDays must be between 1 and 90', 400);
    }
    affiliate.availabilitySchedule.scheduleSettings.maxBookingDays = maxBookingDays;
  }

  // Update timezone if provided
  if (timezone !== undefined) {
    affiliate.availabilitySchedule.scheduleSettings.timezone = timezone;
  }

  await affiliate.save();

  ControllerHelpers.sendSuccess(res, {
    scheduleSettings: affiliate.availabilitySchedule.scheduleSettings
  }, 'Schedule settings updated successfully');
});
