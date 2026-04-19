// Immediate-pickup scheduling helpers
//
// Pure time-math for the "Pickup Now!" feature: operating-hour checks,
// next-available slot, 4-hour deadline, after-5pm overflow to next morning.
// All business logic is expressed in Central time (America/Chicago) since
// WaveMAX operates in Austin, TX.
//
// Extracted from orderController.js in Phase 2 so the controller doesn't
// carry ~130 lines of date math.

const IMMEDIATE_PICKUP_HOURS = {
  START: 7,         // 7 AM CDT — pickup requests accepted starting here
  END: 19,          // 7 PM CDT — last hour we accept requests
  AFTER_5PM: 17,    // 5 PM CDT — cutoff; later requests roll to tomorrow
  DEADLINE_HOURS: 4,
  NEXT_MORNING: 9   // 9 AM CDT — deadline for after-5-PM orders
};

/** Current hour (0–23) in America/Chicago for `date`. */
function getCDTHour(date = new Date()) {
  return parseInt(date.toLocaleString('en-US', {
    timeZone: 'America/Chicago',
    hour: '2-digit',
    hour12: false
  }));
}

/**
 * Current Chicago UTC-offset in hours at the given date (DST-aware).
 * Returns -6 in standard time (CST), -5 during daylight saving (CDT).
 */
function getChicagoOffsetHours(date) {
  const utcHour = date.getUTCHours();
  const chicagoHour = getCDTHour(date);
  let offset = chicagoHour - utcHour;
  if (offset > 12) offset -= 24;   // crossed back over midnight
  if (offset < -12) offset += 24;  // crossed forward over midnight
  return offset;
}

/**
 * Returns a fresh `Date` representing "now". Wrapped so tests can mock it.
 */
function getCurrentCDTTime() {
  return new Date();
}

/** Map a CDT hour to a pickup slot: morning / afternoon / evening. */
function getPickupTimeSlot(cdtHour) {
  if (cdtHour >= 7 && cdtHour < 12) return 'morning';
  if (cdtHour >= 12 && cdtHour < 16) return 'afternoon';
  if (cdtHour >= 16 && cdtHour <= 19) return 'evening';
  return 'morning';
}

/**
 * Compute the pickup deadline:
 *   - Before 5 PM CDT: orderTime + 4 hours
 *   - After 5 PM CDT:  next day at 9 AM CDT
 */
function calculatePickupDeadline(orderTime) {
  const cdtHour = getCDTHour(orderTime);
  const deadline = new Date(orderTime);

  if (cdtHour >= IMMEDIATE_PICKUP_HOURS.AFTER_5PM) {
    deadline.setUTCDate(deadline.getUTCDate() + 1);
    const offset = getChicagoOffsetHours(deadline);
    deadline.setUTCHours(IMMEDIATE_PICKUP_HOURS.NEXT_MORNING - offset, 0, 0, 0);
  } else {
    deadline.setTime(deadline.getTime() + IMMEDIATE_PICKUP_HOURS.DEADLINE_HOURS * 60 * 60 * 1000);
  }
  return deadline;
}

/**
 * Pickup date (midnight-anchored) — today for pre-5pm orders, tomorrow
 * for post-5pm orders.
 */
function calculatePickupDate(orderTime) {
  const cdtHour = getCDTHour(orderTime);
  const pickupDate = new Date(orderTime);
  if (cdtHour >= IMMEDIATE_PICKUP_HOURS.AFTER_5PM) {
    pickupDate.setDate(pickupDate.getDate() + 1);
  }
  pickupDate.setHours(0, 0, 0, 0);
  return pickupDate;
}

/** True if `time` falls within the 7 AM–7 PM CDT operating window. */
function isWithinOperatingHours(time) {
  const cdtHour = getCDTHour(time);
  return cdtHour >= IMMEDIATE_PICKUP_HOURS.START && cdtHour <= IMMEDIATE_PICKUP_HOURS.END;
}

/**
 * Next time we'll start accepting immediate-pickup requests.
 * Same day (at open) if called before 7 AM CDT, next day (at open)
 * if called after 7 PM CDT.
 */
function calculateNextAvailableTime(time) {
  const cdtHour = getCDTHour(time);
  if (cdtHour >= IMMEDIATE_PICKUP_HOURS.START && cdtHour <= IMMEDIATE_PICKUP_HOURS.END) {
    return new Date(time);
  }

  // We want "7 AM Chicago on day X". Determine which Chicago calendar day
  // that is (today if called before opening; tomorrow if called after closing),
  // then construct the matching UTC instant using the DST-aware offset at
  // the target time (DST-transition days can differ from `time`'s offset).
  const parts = chicagoDateParts(time);
  let { year, month, day } = parts;
  if (cdtHour > IMMEDIATE_PICKUP_HOURS.END) {
    // Advance one Chicago calendar day using a Date in any tz (UTC math
    // is fine for "+1 day" when we stay at midnight-ish).
    const d = new Date(Date.UTC(year, month - 1, day));
    d.setUTCDate(d.getUTCDate() + 1);
    year = d.getUTCFullYear();
    month = d.getUTCMonth() + 1;
    day = d.getUTCDate();
  }

  // Approximate the target instant, then refine the offset using that
  // instant (handles spring-forward / fall-back days correctly).
  const approx = new Date(Date.UTC(year, month - 1, day, IMMEDIATE_PICKUP_HOURS.START + 6, 0, 0));
  const offset = getChicagoOffsetHours(approx);
  return new Date(Date.UTC(year, month - 1, day, IMMEDIATE_PICKUP_HOURS.START - offset, 0, 0));
}

/**
 * Extract the Chicago calendar-date components (year, month 1-12, day 1-31)
 * of the given instant.
 */
function chicagoDateParts(date) {
  return {
    year: parseInt(date.toLocaleString('en-US', { timeZone: 'America/Chicago', year: 'numeric' })),
    month: parseInt(date.toLocaleString('en-US', { timeZone: 'America/Chicago', month: '2-digit' })),
    day: parseInt(date.toLocaleString('en-US', { timeZone: 'America/Chicago', day: '2-digit' }))
  };
}

module.exports = {
  IMMEDIATE_PICKUP_HOURS,
  getCDTHour,
  getCurrentCDTTime,
  getPickupTimeSlot,
  calculatePickupDeadline,
  calculatePickupDate,
  isWithinOperatingHours,
  calculateNextAvailableTime
};
