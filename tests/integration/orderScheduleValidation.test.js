/**
 * Integration tests for Order Creation with Schedule Validation
 * TDD Approach: Ensure orders respect affiliate availability
 */

const request = require('supertest');
const app = require('../../server');
const Affiliate = require('../../server/models/Affiliate');
const Customer = require('../../server/models/Customer');
const Order = require('../../server/models/Order');
const jwt = require('jsonwebtoken');

// Helper functions
function createCustomerToken(customerId) {
  return jwt.sign(
    { id: customerId, role: 'customer', customerId: customerId },
    process.env.JWT_SECRET || 'test-secret',
    { expiresIn: '1h' }
  );
}

async function getCsrfToken(agent) {
  const response = await agent.get('/api/csrf-token');
  return response.body.csrfToken;
}

function getNextDayOfWeek(dayIndex) {
  const today = new Date();
  const currentDay = today.getDay();
  const daysUntil = (dayIndex - currentDay + 7) % 7 || 7;
  const targetDate = new Date(today);
  targetDate.setDate(today.getDate() + daysUntil);
  targetDate.setHours(12, 0, 0, 0);
  return targetDate;
}

function getNextMonday() {
  return getNextDayOfWeek(1);
}

function getNextSunday() {
  return getNextDayOfWeek(0);
}

async function createTestAffiliate(overrides = {}) {
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
    availabilitySchedule: {
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
    },
    ...overrides
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

describe('Order Creation with Schedule Validation', () => {
  let agent;
  let affiliate;
  let customer;
  let customerToken;

  beforeEach(async () => {
    await Affiliate.deleteMany({});
    await Customer.deleteMany({});
    await Order.deleteMany({});

    agent = request.agent(app);
    affiliate = await createTestAffiliate();
    customer = await createTestCustomer(affiliate.affiliateId);
    customerToken = createCustomerToken(customer.customerId);
  });

  describe('POST /api/v1/orders', () => {
    it('should allow order creation for available time slot', async () => {
      const monday = getNextMonday();
      const csrfToken = await getCsrfToken(agent);

      const response = await agent
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .set('x-csrf-token', csrfToken)
        .send({
          customerId: customer.customerId,
          affiliateId: affiliate.affiliateId,
          pickupDate: monday.toISOString(),
          pickupTime: 'morning',
          estimatedWeight: 25,
          numberOfBags: 2
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      // Response format spreads order data directly onto body
      expect(response.body).toHaveProperty('orderId');
    });

    it('should reject order for unavailable time slot (day disabled)', async () => {
      const sunday = getNextSunday();

      // Ensure Sunday is unavailable
      affiliate.availabilitySchedule.weeklyTemplate.sunday.enabled = false;
      await affiliate.save();

      const csrfToken = await getCsrfToken(agent);

      const response = await agent
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .set('x-csrf-token', csrfToken)
        .send({
          customerId: customer.customerId,
          affiliateId: affiliate.affiliateId,
          pickupDate: sunday.toISOString(),
          pickupTime: 'morning',
          estimatedWeight: 25,
          numberOfBags: 2
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toHaveProperty('code', 'TIMESLOT_UNAVAILABLE');
    });

    it('should reject order for unavailable specific time slot', async () => {
      const monday = getNextMonday();

      // Disable evening slot on Monday
      affiliate.availabilitySchedule.weeklyTemplate.monday.timeSlots.evening = false;
      await affiliate.save();

      const csrfToken = await getCsrfToken(agent);

      const response = await agent
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .set('x-csrf-token', csrfToken)
        .send({
          customerId: customer.customerId,
          affiliateId: affiliate.affiliateId,
          pickupDate: monday.toISOString(),
          pickupTime: 'evening',
          estimatedWeight: 25,
          numberOfBags: 2
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toHaveProperty('code', 'TIMESLOT_UNAVAILABLE');
    });

    it('should reject order for blocked date', async () => {
      const blockDate = new Date();
      blockDate.setDate(blockDate.getDate() + 7);
      blockDate.setHours(12, 0, 0, 0);

      // Add block exception
      affiliate.availabilitySchedule.dateExceptions.push({
        date: blockDate,
        type: 'block',
        reason: 'Holiday'
      });
      await affiliate.save();

      const csrfToken = await getCsrfToken(agent);

      const response = await agent
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .set('x-csrf-token', csrfToken)
        .send({
          customerId: customer.customerId,
          affiliateId: affiliate.affiliateId,
          pickupDate: blockDate.toISOString(),
          pickupTime: 'morning',
          estimatedWeight: 25,
          numberOfBags: 2
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toHaveProperty('code', 'TIMESLOT_UNAVAILABLE');
    });

    it('should allow order for override exception slot', async () => {
      const sunday = getNextSunday();

      // Sunday is normally closed, but add override for morning only
      affiliate.availabilitySchedule.dateExceptions.push({
        date: sunday,
        type: 'override',
        timeSlots: { morning: true, afternoon: false, evening: false },
        reason: 'Special opening'
      });
      await affiliate.save();

      const csrfToken = await getCsrfToken(agent);

      const response = await agent
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .set('x-csrf-token', csrfToken)
        .send({
          customerId: customer.customerId,
          affiliateId: affiliate.affiliateId,
          pickupDate: sunday.toISOString(),
          pickupTime: 'morning',
          estimatedWeight: 25,
          numberOfBags: 2
        })
        .expect(201);

      expect(response.body.success).toBe(true);
    });

    it('should reject order for unavailable slot in override exception', async () => {
      const sunday = getNextSunday();

      // Override Sunday to only allow morning
      affiliate.availabilitySchedule.dateExceptions.push({
        date: sunday,
        type: 'override',
        timeSlots: { morning: true, afternoon: false, evening: false }
      });
      await affiliate.save();

      const csrfToken = await getCsrfToken(agent);

      const response = await agent
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .set('x-csrf-token', csrfToken)
        .send({
          customerId: customer.customerId,
          affiliateId: affiliate.affiliateId,
          pickupDate: sunday.toISOString(),
          pickupTime: 'afternoon',
          estimatedWeight: 25,
          numberOfBags: 2
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toHaveProperty('code', 'TIMESLOT_UNAVAILABLE');
    });

    it('should include helpful error message in rejection', async () => {
      const sunday = getNextSunday();

      affiliate.availabilitySchedule.weeklyTemplate.sunday.enabled = false;
      await affiliate.save();

      const csrfToken = await getCsrfToken(agent);

      const response = await agent
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .set('x-csrf-token', csrfToken)
        .send({
          customerId: customer.customerId,
          affiliateId: affiliate.affiliateId,
          pickupDate: sunday.toISOString(),
          pickupTime: 'morning',
          estimatedWeight: 25,
          numberOfBags: 2
        })
        .expect(400);

      expect(response.body.message).toContain('not available');
      expect(response.body.error.details).toBeDefined();
    });
  });
});
