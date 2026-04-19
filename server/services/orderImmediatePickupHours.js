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
    const cdtOffset = -6; // CDT is UTC-6; approximate — DST ignored
    deadline.setUTCDate(deadline.getUTCDate() + 1);
    deadline.setUTCHours(IMMEDIATE_PICKUP_HOURS.NEXT_MORNING - cdtOffset, 0, 0, 0);
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
  const nextAvailable = new Date(time);
  const cdtOffset = -6;

  if (cdtHour < IMMEDIATE_PICKUP_HOURS.START) {
    nextAvailable.setUTCHours(IMMEDIATE_PICKUP_HOURS.START - cdtOffset, 0, 0, 0);
  } else if (cdtHour > IMMEDIATE_PICKUP_HOURS.END) {
    nextAvailable.setUTCDate(nextAvailable.getUTCDate() + 1);
    nextAvailable.setUTCHours(IMMEDIATE_PICKUP_HOURS.START - cdtOffset, 0, 0, 0);
  }
  return nextAvailable;
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
