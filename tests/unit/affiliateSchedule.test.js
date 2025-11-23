/**
 * Unit tests for Affiliate Scheduling functionality
 * TDD Approach: Tests written first, then implementation
 */

const Affiliate = require('../../server/models/Affiliate');
const Order = require('../../server/models/Order');
const Customer = require('../../server/models/Customer');

// Helper functions for dates
function getNextDayOfWeek(dayIndex) {
  // dayIndex: 0 = Sunday, 1 = Monday, etc.
  const today = new Date();
  const currentDay = today.getDay();
  const daysUntil = (dayIndex - currentDay + 7) % 7 || 7;
  const targetDate = new Date(today);
  targetDate.setDate(today.getDate() + daysUntil);
  targetDate.setHours(0, 0, 0, 0);
  return targetDate;
}

function getNextMonday() {
  return getNextDayOfWeek(1);
}

function getNextSunday() {
  return getNextDayOfWeek(0);
}

function getNextSaturday() {
  return getNextDayOfWeek(6);
}

// Helper to create test affiliate with availability
async function createTestAffiliateWithSchedule(scheduleOverrides = {}) {
  const defaultSchedule = {
    weeklyTemplate: {
      monday: { enabled: true, timeSlots: { morning: true, afternoon: true, evening: true } },
      tuesday: { enabled: true, timeSlots: { morning: true, afternoon: true, evening: true } },
      wednesday: { enabled: true, timeSlots: { morning: true, afternoon: true, evening: true } },
      thursday: { enabled: true, timeSlots: { morning: true, afternoon: true, evening: true } },
      friday: { enabled: true, timeSlots: { morning: true, afternoon: true, evening: true } },
      saturday: { enabled: true, timeSlots: { morning: true, afternoon: true, evening: true } },
      sunday: { enabled: false, timeSlots: { morning: false, afternoon: false, evening: false } }
    },
    dateExceptions: [],
    scheduleSettings: {
      advanceBookingDays: 1,
      maxBookingDays: 30,
      timezone: 'America/Chicago'
    }
  };

  // Deep merge overrides
  const mergedSchedule = JSON.parse(JSON.stringify(defaultSchedule));
  if (scheduleOverrides.weeklyTemplate) {
    Object.assign(mergedSchedule.weeklyTemplate, scheduleOverrides.weeklyTemplate);
  }
  if (scheduleOverrides.dateExceptions) {
    mergedSchedule.dateExceptions = scheduleOverrides.dateExceptions;
  }
  if (scheduleOverrides.scheduleSettings) {
    Object.assign(mergedSchedule.scheduleSettings, scheduleOverrides.scheduleSettings);
  }

  const affiliate = new Affiliate({
    firstName: 'Test',
    lastName: 'Affiliate',
    email: `test${Date.now()}@example.com`,
    phone: '555-0100',
    address: '123 Test St',
    city: 'Austin',
    state: 'TX',
    zipCode: '78701',
    serviceLatitude: 30.2672,
    serviceLongitude: -97.7431,
    serviceRadius: 10,
    username: `testuser${Date.now()}`,
    passwordSalt: 'testsalt',
    passwordHash: 'testhash',
    paymentMethod: 'check',
    availabilitySchedule: mergedSchedule
  });

  await affiliate.save();
  return affiliate;
}

async function createTestCustomer(affiliateId) {
  const customer = new Customer({
    customerId: `CUST-${Date.now()}`,
    affiliateId: affiliateId,
    firstName: 'Test',
    lastName: 'Customer',
    email: `customer${Date.now()}@example.com`,
    phone: '555-0200',
    address: '456 Customer St',
    city: 'Austin',
    state: 'TX',
    zipCode: '78702',
    username: `customer${Date.now()}`,
    passwordSalt: 'testsalt',
    passwordHash: 'testhash'
  });

  await customer.save();
  return customer;
}

async function createTestOrder(orderData) {
  const order = new Order({
    customerId: orderData.customerId,
    affiliateId: orderData.affiliateId,
    pickupDate: orderData.pickupDate,
    pickupTime: orderData.pickupTime,
    estimatedWeight: orderData.estimatedWeight || 25,
    numberOfBags: orderData.numberOfBags || 2,
    status: orderData.status || 'pending',
    feeBreakdown: {
      numberOfBags: orderData.numberOfBags || 2,
      minimumFee: 25,
      perBagFee: 5,
      totalFee: 25,
      minimumApplied: true
    }
  });

  await order.save();
  return order;
}

describe('Affiliate Model - Availability Schedule', () => {
  beforeEach(async () => {
    await Affiliate.deleteMany({});
    await Customer.deleteMany({});
    await Order.deleteMany({});
  });

  describe('Schema Validation', () => {
    it('should have default availability schedule structure', async () => {
      const affiliate = await createTestAffiliateWithSchedule();

      expect(affiliate.availabilitySchedule).toBeDefined();
      expect(affiliate.availabilitySchedule.weeklyTemplate).toBeDefined();
      expect(affiliate.availabilitySchedule.dateExceptions).toBeDefined();
      expect(affiliate.availabilitySchedule.scheduleSettings).toBeDefined();
    });

    it('should have all days in weekly template', async () => {
      const affiliate = await createTestAffiliateWithSchedule();
      const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

      days.forEach(day => {
        expect(affiliate.availabilitySchedule.weeklyTemplate[day]).toBeDefined();
        expect(affiliate.availabilitySchedule.weeklyTemplate[day].enabled).toBeDefined();
        expect(affiliate.availabilitySchedule.weeklyTemplate[day].timeSlots).toBeDefined();
      });
    });

    it('should have all time slots for each day', async () => {
      const affiliate = await createTestAffiliateWithSchedule();
      const timeSlots = ['morning', 'afternoon', 'evening'];

      const monday = affiliate.availabilitySchedule.weeklyTemplate.monday;
      timeSlots.forEach(slot => {
        expect(typeof monday.timeSlots[slot]).toBe('boolean');
      });
    });

    it('should have schedule settings with defaults', async () => {
      const affiliate = await createTestAffiliateWithSchedule();

      expect(affiliate.availabilitySchedule.scheduleSettings.advanceBookingDays).toBe(1);
      expect(affiliate.availabilitySchedule.scheduleSettings.maxBookingDays).toBe(30);
      expect(affiliate.availabilitySchedule.scheduleSettings.timezone).toBe('America/Chicago');
    });
  });

  describe('getDayOfWeekKey()', () => {
    it('should return correct day key for Sunday (0)', async () => {
      const affiliate = await createTestAffiliateWithSchedule();
      const sunday = new Date('2025-01-19'); // Known Sunday

      expect(affiliate.getDayOfWeekKey(sunday)).toBe('sunday');
    });

    it('should return correct day key for Monday (1)', async () => {
      const affiliate = await createTestAffiliateWithSchedule();
      const monday = new Date('2025-01-20'); // Known Monday

      expect(affiliate.getDayOfWeekKey(monday)).toBe('monday');
    });

    it('should return correct day key for Saturday (6)', async () => {
      const affiliate = await createTestAffiliateWithSchedule();
      const saturday = new Date('2025-01-18'); // Known Saturday

      expect(affiliate.getDayOfWeekKey(saturday)).toBe('saturday');
    });
  });

  describe('isAvailable()', () => {
    it('should return true for available time slot in weekly template', async () => {
      const affiliate = await createTestAffiliateWithSchedule({
        weeklyTemplate: {
          monday: { enabled: true, timeSlots: { morning: true, afternoon: true, evening: true } }
        }
      });

      const monday = getNextMonday();
      expect(affiliate.isAvailable(monday, 'morning')).toBe(true);
    });

    it('should return false for unavailable time slot in weekly template', async () => {
      const affiliate = await createTestAffiliateWithSchedule({
        weeklyTemplate: {
          monday: { enabled: true, timeSlots: { morning: true, afternoon: true, evening: false } }
        }
      });

      const monday = getNextMonday();
      expect(affiliate.isAvailable(monday, 'evening')).toBe(false);
    });

    it('should return false when entire day is disabled', async () => {
      const affiliate = await createTestAffiliateWithSchedule({
        weeklyTemplate: {
          sunday: { enabled: false, timeSlots: { morning: true, afternoon: true, evening: true } }
        }
      });

      const sunday = getNextSunday();
      expect(affiliate.isAvailable(sunday, 'morning')).toBe(false);
    });

    it('should return false for blocked date exception', async () => {
      const monday = getNextMonday();
      const affiliate = await createTestAffiliateWithSchedule({
        weeklyTemplate: {
          monday: { enabled: true, timeSlots: { morning: true, afternoon: true, evening: true } }
        },
        dateExceptions: [{
          date: monday,
          type: 'block',
          reason: 'Holiday'
        }]
      });

      expect(affiliate.isAvailable(monday, 'morning')).toBe(false);
      expect(affiliate.isAvailable(monday, 'afternoon')).toBe(false);
      expect(affiliate.isAvailable(monday, 'evening')).toBe(false);
    });

    it('should honor override exception over weekly template', async () => {
      const sunday = getNextSunday();
      const affiliate = await createTestAffiliateWithSchedule({
        weeklyTemplate: {
          sunday: { enabled: false, timeSlots: { morning: false, afternoon: false, evening: false } }
        },
        dateExceptions: [{
          date: sunday,
          type: 'override',
          timeSlots: { morning: true, afternoon: false, evening: false },
          reason: 'Special opening'
        }]
      });

      expect(affiliate.isAvailable(sunday, 'morning')).toBe(true);
      expect(affiliate.isAvailable(sunday, 'afternoon')).toBe(false);
      expect(affiliate.isAvailable(sunday, 'evening')).toBe(false);
    });

    it('should prioritize date exception over weekly template', async () => {
      const monday = getNextMonday();
      const affiliate = await createTestAffiliateWithSchedule({
        weeklyTemplate: {
          monday: { enabled: true, timeSlots: { morning: true, afternoon: true, evening: true } }
        },
        dateExceptions: [{
          date: monday,
          type: 'override',
          timeSlots: { morning: false, afternoon: true, evening: false }
        }]
      });

      expect(affiliate.isAvailable(monday, 'morning')).toBe(false);
      expect(affiliate.isAvailable(monday, 'afternoon')).toBe(true);
      expect(affiliate.isAvailable(monday, 'evening')).toBe(false);
    });

    it('should handle dates without exceptions using weekly template', async () => {
      const affiliate = await createTestAffiliateWithSchedule({
        weeklyTemplate: {
          friday: { enabled: true, timeSlots: { morning: true, afternoon: false, evening: true } }
        }
      });

      const friday = getNextDayOfWeek(5);
      expect(affiliate.isAvailable(friday, 'morning')).toBe(true);
      expect(affiliate.isAvailable(friday, 'afternoon')).toBe(false);
      expect(affiliate.isAvailable(friday, 'evening')).toBe(true);
    });
  });

  describe('getAvailableTimeSlots()', () => {
    it('should return array of available time slots for a date', async () => {
      const affiliate = await createTestAffiliateWithSchedule({
        weeklyTemplate: {
          monday: { enabled: true, timeSlots: { morning: true, afternoon: false, evening: true } }
        }
      });

      const monday = getNextMonday();
      const slots = affiliate.getAvailableTimeSlots(monday);

      expect(slots).toEqual(['morning', 'evening']);
    });

    it('should return all slots when all are available', async () => {
      const affiliate = await createTestAffiliateWithSchedule({
        weeklyTemplate: {
          tuesday: { enabled: true, timeSlots: { morning: true, afternoon: true, evening: true } }
        }
      });

      const tuesday = getNextDayOfWeek(2);
      const slots = affiliate.getAvailableTimeSlots(tuesday);

      expect(slots).toEqual(['morning', 'afternoon', 'evening']);
    });

    it('should return empty array for fully unavailable day', async () => {
      const affiliate = await createTestAffiliateWithSchedule({
        weeklyTemplate: {
          sunday: { enabled: false, timeSlots: { morning: false, afternoon: false, evening: false } }
        }
      });

      const sunday = getNextSunday();
      const slots = affiliate.getAvailableTimeSlots(sunday);

      expect(slots).toEqual([]);
    });

    it('should return empty array for blocked date', async () => {
      const monday = getNextMonday();
      const affiliate = await createTestAffiliateWithSchedule({
        dateExceptions: [{
          date: monday,
          type: 'block'
        }]
      });

      const slots = affiliate.getAvailableTimeSlots(monday);
      expect(slots).toEqual([]);
    });

    it('should return overridden slots for override exception', async () => {
      const sunday = getNextSunday();
      const affiliate = await createTestAffiliateWithSchedule({
        weeklyTemplate: {
          sunday: { enabled: false, timeSlots: { morning: false, afternoon: false, evening: false } }
        },
        dateExceptions: [{
          date: sunday,
          type: 'override',
          timeSlots: { morning: true, afternoon: true, evening: false }
        }]
      });

      const slots = affiliate.getAvailableTimeSlots(sunday);
      expect(slots).toEqual(['morning', 'afternoon']);
    });
  });

  describe('getAvailableDates()', () => {
    it('should return available dates in range with time slots', async () => {
      const affiliate = await createTestAffiliateWithSchedule();

      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 7);

      const availableDates = affiliate.getAvailableDates(startDate, endDate);

      expect(availableDates).toBeInstanceOf(Array);
      expect(availableDates.length).toBeGreaterThan(0);
      expect(availableDates[0]).toHaveProperty('date');
      expect(availableDates[0]).toHaveProperty('timeSlots');
      expect(availableDates[0]).toHaveProperty('allDay');
    });

    it('should exclude unavailable days from results', async () => {
      const affiliate = await createTestAffiliateWithSchedule({
        weeklyTemplate: {
          sunday: { enabled: false, timeSlots: { morning: false, afternoon: false, evening: false } }
        }
      });

      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 14);

      const availableDates = affiliate.getAvailableDates(startDate, endDate);

      // Check that no Sundays are included
      const sundaysIncluded = availableDates.filter(d => d.date.getDay() === 0);
      expect(sundaysIncluded.length).toBe(0);
    });

    it('should mark allDay as true when all slots available', async () => {
      const affiliate = await createTestAffiliateWithSchedule({
        weeklyTemplate: {
          monday: { enabled: true, timeSlots: { morning: true, afternoon: true, evening: true } }
        }
      });

      const monday = getNextMonday();
      const endDate = new Date(monday);
      endDate.setDate(endDate.getDate() + 1);

      const availableDates = affiliate.getAvailableDates(monday, endDate);
      const mondayEntry = availableDates.find(d => d.date.getDay() === 1);

      expect(mondayEntry.allDay).toBe(true);
    });

    it('should mark allDay as false when partial availability', async () => {
      const affiliate = await createTestAffiliateWithSchedule({
        weeklyTemplate: {
          monday: { enabled: true, timeSlots: { morning: true, afternoon: false, evening: true } }
        }
      });

      const monday = getNextMonday();
      const endDate = new Date(monday);
      endDate.setDate(endDate.getDate() + 1);

      const availableDates = affiliate.getAvailableDates(monday, endDate);
      const mondayEntry = availableDates.find(d => d.date.getDay() === 1);

      expect(mondayEntry.allDay).toBe(false);
      expect(mondayEntry.timeSlots).toEqual(['morning', 'evening']);
    });

    it('should exclude blocked dates from results', async () => {
      const monday = getNextMonday();
      const affiliate = await createTestAffiliateWithSchedule({
        dateExceptions: [{
          date: monday,
          type: 'block',
          reason: 'Holiday'
        }]
      });

      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 14);

      const availableDates = affiliate.getAvailableDates(startDate, endDate);

      // Check that blocked Monday is not included
      const blockedDate = availableDates.find(d =>
        d.date.toDateString() === monday.toDateString()
      );
      expect(blockedDate).toBeUndefined();
    });

    it('should handle empty range correctly', async () => {
      const affiliate = await createTestAffiliateWithSchedule();

      const startDate = new Date();
      const endDate = new Date(startDate); // Same date

      const availableDates = affiliate.getAvailableDates(startDate, endDate);

      // Should include the single date if available
      expect(availableDates.length).toBeLessThanOrEqual(1);
    });
  });

  describe('validateScheduleChange()', () => {
    it('should return valid=true when no conflicting orders exist', async () => {
      const affiliate = await createTestAffiliateWithSchedule();
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);

      const result = await affiliate.validateScheduleChange(futureDate, 'morning');

      expect(result.valid).toBe(true);
      expect(result.conflicts).toHaveLength(0);
    });

    it('should return valid=false when conflicting pending order exists', async () => {
      const affiliate = await createTestAffiliateWithSchedule();
      const customer = await createTestCustomer(affiliate.affiliateId);

      const pickupDate = new Date();
      pickupDate.setDate(pickupDate.getDate() + 3);
      pickupDate.setHours(12, 0, 0, 0);

      // Create conflicting order
      await createTestOrder({
        affiliateId: affiliate.affiliateId,
        customerId: customer.customerId,
        pickupDate: pickupDate,
        pickupTime: 'morning',
        status: 'pending'
      });

      const result = await affiliate.validateScheduleChange(pickupDate, 'morning');

      expect(result.valid).toBe(false);
      expect(result.conflicts).toHaveLength(1);
    });

    it('should return valid=false when conflicting processing order exists', async () => {
      const affiliate = await createTestAffiliateWithSchedule();
      const customer = await createTestCustomer(affiliate.affiliateId);

      const pickupDate = new Date();
      pickupDate.setDate(pickupDate.getDate() + 3);
      pickupDate.setHours(12, 0, 0, 0);

      await createTestOrder({
        affiliateId: affiliate.affiliateId,
        customerId: customer.customerId,
        pickupDate: pickupDate,
        pickupTime: 'afternoon',
        status: 'processing'
      });

      const result = await affiliate.validateScheduleChange(pickupDate, 'afternoon');

      expect(result.valid).toBe(false);
      expect(result.conflicts).toHaveLength(1);
    });

    it('should return valid=true when order is completed (no conflict)', async () => {
      const affiliate = await createTestAffiliateWithSchedule();
      const customer = await createTestCustomer(affiliate.affiliateId);

      const pickupDate = new Date();
      pickupDate.setDate(pickupDate.getDate() + 3);
      pickupDate.setHours(12, 0, 0, 0);

      await createTestOrder({
        affiliateId: affiliate.affiliateId,
        customerId: customer.customerId,
        pickupDate: pickupDate,
        pickupTime: 'evening',
        status: 'complete'
      });

      const result = await affiliate.validateScheduleChange(pickupDate, 'evening');

      expect(result.valid).toBe(true);
      expect(result.conflicts).toHaveLength(0);
    });

    it('should return valid=true for different time slot with order', async () => {
      const affiliate = await createTestAffiliateWithSchedule();
      const customer = await createTestCustomer(affiliate.affiliateId);

      const pickupDate = new Date();
      pickupDate.setDate(pickupDate.getDate() + 3);
      pickupDate.setHours(12, 0, 0, 0);

      await createTestOrder({
        affiliateId: affiliate.affiliateId,
        customerId: customer.customerId,
        pickupDate: pickupDate,
        pickupTime: 'morning',
        status: 'pending'
      });

      // Check afternoon slot - should be valid since order is for morning
      const result = await affiliate.validateScheduleChange(pickupDate, 'afternoon');

      expect(result.valid).toBe(true);
      expect(result.conflicts).toHaveLength(0);
    });
  });
});
