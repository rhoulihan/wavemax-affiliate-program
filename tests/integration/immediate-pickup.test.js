/**
 * Integration Tests for Immediate Pickup Feature
 *
 * Tests the "Pickup Now!" feature that allows customers to request
 * same-day laundry pickup without scheduling in advance.
 */

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../server');
const Order = require('../../server/models/Order');
const Customer = require('../../server/models/Customer');
const Affiliate = require('../../server/models/Affiliate');
const SystemConfig = require('../../server/models/SystemConfig');
const jwt = require('jsonwebtoken');
const orderController = require('../../server/controllers/orderController');

// Set timeout for integration tests
jest.setTimeout(90000);

// Mock emailService to prevent actual emails
jest.mock('../../server/utils/emailService', () => ({
  sendAffiliateUrgentPickupEmail: jest.fn().mockResolvedValue({ messageId: 'test-message-id' }),
  sendCustomerOrderConfirmationEmail: jest.fn().mockResolvedValue({ messageId: 'test-message-id' }),
  sendAffiliateNewOrderEmail: jest.fn().mockResolvedValue({ messageId: 'test-message-id' })
}));

describe('Immediate Pickup Feature', () => {
  let testCustomer;
  let testCustomerFirstOrder;
  let testAffiliate;
  let customerToken;
  let customerTokenFirstOrder;
  let csrfToken;

  // Helper to create a date at a specific hour in CDT
  const createCDTDate = (hour, minute = 0) => {
    const now = new Date();
    // Create date in CDT (UTC-5 or UTC-6 depending on DST)
    const cdt = new Date(now.toLocaleString('en-US', { timeZone: 'America/Chicago' }));
    cdt.setHours(hour, minute, 0, 0);
    return cdt;
  };

  // Helper to mock current time using jest.spyOn (doesn't block async operations)
  let timeMock = null;
  const mockCurrentTime = (hour, minute = 0) => {
    const mockDate = createCDTDate(hour, minute);
    // Clean up previous mock if any
    if (timeMock) {
      timeMock.mockRestore();
    }
    timeMock = jest.spyOn(orderController, '_getCurrentCDTTime').mockReturnValue(mockDate);
    return mockDate;
  };

  const restoreTime = () => {
    if (timeMock) {
      timeMock.mockRestore();
      timeMock = null;
    }
  };

  beforeAll(async () => {
    // Connect to test database if not connected
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/wavemax-test', {
        useNewUrlParser: true,
        useUnifiedTopology: true
      });
    }
  });

  beforeEach(async () => {
    // Restore any mocked time from previous test
    restoreTime();

    // Clear collections
    await Order.deleteMany({});
    await Customer.deleteMany({});
    await Affiliate.deleteMany({});
    await SystemConfig.deleteMany({});
    await SystemConfig.initializeDefaults();

    // Create test affiliate with immediate pickup enabled
    testAffiliate = await Affiliate.create({
      affiliateId: 'AFF-IMM-001',
      firstName: 'Test',
      lastName: 'Affiliate',
      email: 'affiliate@test.com',
      phone: '1234567890',
      businessName: 'Test Business',
      address: '123 Test St',
      city: 'Austin',
      state: 'TX',
      zipCode: '78701',
      username: 'testaffiliate',
      passwordSalt: 'salt',
      passwordHash: 'hash',
      paymentMethod: 'check',
      serviceLatitude: 30.2672,
      serviceLongitude: -97.7431,
      minimumDeliveryFee: 25,
      perBagDeliveryFee: 5,
      serviceRadius: 10,
      allowImmediatePickup: true, // Feature enabled
      availabilitySchedule: {
        weeklyTemplate: {
          monday: { enabled: true, timeSlots: { morning: true, afternoon: true, evening: true } },
          tuesday: { enabled: true, timeSlots: { morning: true, afternoon: true, evening: true } },
          wednesday: { enabled: true, timeSlots: { morning: true, afternoon: true, evening: true } },
          thursday: { enabled: true, timeSlots: { morning: true, afternoon: true, evening: true } },
          friday: { enabled: true, timeSlots: { morning: true, afternoon: true, evening: true } },
          saturday: { enabled: true, timeSlots: { morning: true, afternoon: true, evening: true } },
          sunday: { enabled: false, timeSlots: { morning: false, afternoon: false, evening: false } }
        }
      }
    });

    // Create test customer (not first order)
    testCustomer = await Customer.create({
      customerId: 'CUST-IMM-001',
      affiliateId: testAffiliate.affiliateId,
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane.smith@test.com',
      phone: '1234567890',
      address: '456 Test Ave',
      city: 'Austin',
      state: 'TX',
      zipCode: '78702',
      username: 'janesmith',
      passwordSalt: 'salt',
      passwordHash: 'hash',
      initialBagsRequested: 2,
      totalOrders: 5, // Has previous orders
      deliveryInstructions: 'Leave at front door'
    });

    // Create test customer (first order scenario)
    testCustomerFirstOrder = await Customer.create({
      customerId: 'CUST-IMM-002',
      affiliateId: testAffiliate.affiliateId,
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@test.com',
      phone: '9876543210',
      address: '789 First St',
      city: 'Austin',
      state: 'TX',
      zipCode: '78703',
      username: 'johndoe',
      passwordSalt: 'salt',
      passwordHash: 'hash',
      initialBagsRequested: 2,
      totalOrders: 0, // First order
      deliveryInstructions: 'Ring doorbell'
    });

    // Generate tokens
    customerToken = jwt.sign(
      {
        id: testCustomer._id,
        customerId: testCustomer.customerId,
        role: 'customer'
      },
      process.env.JWT_SECRET || 'test-secret'
    );

    customerTokenFirstOrder = jwt.sign(
      {
        id: testCustomerFirstOrder._id,
        customerId: testCustomerFirstOrder.customerId,
        role: 'customer'
      },
      process.env.JWT_SECRET || 'test-secret'
    );

    // Get CSRF token
    const csrfRes = await request(app).get('/api/csrf-token');
    csrfToken = csrfRes.body.csrfToken || csrfRes.body.token;
  });

  afterEach(async () => {
    restoreTime();
    await Order.deleteMany({});
    await Customer.deleteMany({});
    await Affiliate.deleteMany({});
  });

  afterAll(async () => {
    restoreTime();
  });

  describe('POST /api/v1/orders/immediate - Create Immediate Pickup Order', () => {
    describe('Successful Order Creation', () => {
      it('should create an immediate pickup order during operating hours (10 AM)', async () => {
        mockCurrentTime(10, 0); // 10:00 AM CDT

        const res = await request(app)
          .post('/api/v1/orders/immediate')
          .set('Authorization', `Bearer ${customerToken}`)
          .set('X-CSRF-Token', csrfToken)
          .send({
            customerId: testCustomer.customerId,
            affiliateId: testAffiliate.affiliateId,
            numberOfBags: 2,
            estimatedWeight: 30,
            specialPickupInstructions: 'Front porch',
            addOns: {
              premiumDetergent: true,
              fabricSoftener: false,
              stainRemover: false
            }
          });

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.orderId).toBeDefined();
        expect(res.body.pickupDeadline).toBeDefined();

        // Verify order in database
        const order = await Order.findOne({ orderId: res.body.orderId });
        expect(order.isImmediatePickup).toBe(true);
        expect(order.immediatePickupRequestedAt).toBeDefined();
        expect(order.pickupDeadline).toBeDefined();
        expect(order.pickupTime).toBe('morning'); // 10 AM = morning
        expect(order.status).toBe('pending');
      });

      it('should set morning time slot for orders between 7 AM - 12 PM', async () => {
        mockCurrentTime(9, 30); // 9:30 AM CDT

        const res = await request(app)
          .post('/api/v1/orders/immediate')
          .set('Authorization', `Bearer ${customerToken}`)
          .set('X-CSRF-Token', csrfToken)
          .send({
            customerId: testCustomer.customerId,
            affiliateId: testAffiliate.affiliateId,
            numberOfBags: 1,
            estimatedWeight: 15
          });

        expect(res.status).toBe(201);
        const order = await Order.findOne({ orderId: res.body.orderId });
        expect(order.pickupTime).toBe('morning');
      });

      it('should set afternoon time slot for orders between 12 PM - 4 PM', async () => {
        mockCurrentTime(14, 0); // 2:00 PM CDT

        const res = await request(app)
          .post('/api/v1/orders/immediate')
          .set('Authorization', `Bearer ${customerToken}`)
          .set('X-CSRF-Token', csrfToken)
          .send({
            customerId: testCustomer.customerId,
            affiliateId: testAffiliate.affiliateId,
            numberOfBags: 1,
            estimatedWeight: 15
          });

        expect(res.status).toBe(201);
        const order = await Order.findOne({ orderId: res.body.orderId });
        expect(order.pickupTime).toBe('afternoon');
      });

      it('should set evening time slot for orders between 4 PM - 7 PM', async () => {
        mockCurrentTime(16, 30); // 4:30 PM CDT

        const res = await request(app)
          .post('/api/v1/orders/immediate')
          .set('Authorization', `Bearer ${customerToken}`)
          .set('X-CSRF-Token', csrfToken)
          .send({
            customerId: testCustomer.customerId,
            affiliateId: testAffiliate.affiliateId,
            numberOfBags: 1,
            estimatedWeight: 15
          });

        expect(res.status).toBe(201);
        const order = await Order.findOne({ orderId: res.body.orderId });
        expect(order.pickupTime).toBe('evening');
      });
    });

    describe('Pickup Deadline Calculation', () => {
      it('should calculate 4-hour deadline for orders before 5 PM', async () => {
        mockCurrentTime(10, 0); // 10:00 AM CDT

        const res = await request(app)
          .post('/api/v1/orders/immediate')
          .set('Authorization', `Bearer ${customerToken}`)
          .set('X-CSRF-Token', csrfToken)
          .send({
            customerId: testCustomer.customerId,
            affiliateId: testAffiliate.affiliateId,
            numberOfBags: 1,
            estimatedWeight: 15
          });

        expect(res.status).toBe(201);
        const order = await Order.findOne({ orderId: res.body.orderId });

        // Deadline should be ~4 hours from order time
        const orderTime = new Date(order.immediatePickupRequestedAt);
        const deadline = new Date(order.pickupDeadline);
        const hoursDiff = (deadline - orderTime) / (1000 * 60 * 60);
        expect(hoursDiff).toBeCloseTo(4, 0);
      });

      it('should set next day 9 AM deadline for orders after 5 PM', async () => {
        mockCurrentTime(17, 30); // 5:30 PM CDT

        const res = await request(app)
          .post('/api/v1/orders/immediate')
          .set('Authorization', `Bearer ${customerToken}`)
          .set('X-CSRF-Token', csrfToken)
          .send({
            customerId: testCustomer.customerId,
            affiliateId: testAffiliate.affiliateId,
            numberOfBags: 1,
            estimatedWeight: 15
          });

        expect(res.status).toBe(201);
        const order = await Order.findOne({ orderId: res.body.orderId });

        // Deadline should be next day 9 AM
        const deadline = new Date(order.pickupDeadline);
        expect(deadline.getHours()).toBe(9);
        expect(deadline.getMinutes()).toBe(0);

        // Should be next day
        const orderTime = new Date(order.immediatePickupRequestedAt);
        expect(deadline.getDate()).toBe(orderTime.getDate() + 1);
      });

      it('should set pickup date to tomorrow for after-5-PM orders', async () => {
        const mockedDate = mockCurrentTime(18, 0); // 6:00 PM CDT

        const res = await request(app)
          .post('/api/v1/orders/immediate')
          .set('Authorization', `Bearer ${customerToken}`)
          .set('X-CSRF-Token', csrfToken)
          .send({
            customerId: testCustomer.customerId,
            affiliateId: testAffiliate.affiliateId,
            numberOfBags: 1,
            estimatedWeight: 15
          });

        expect(res.status).toBe(201);
        const order = await Order.findOne({ orderId: res.body.orderId });

        const pickupDate = new Date(order.pickupDate);
        // Pickup date should be tomorrow relative to the mocked time
        expect(pickupDate.getDate()).toBe(mockedDate.getDate() + 1);
      });
    });

    describe('Operating Hours Validation', () => {
      it('should reject orders before 7 AM', async () => {
        mockCurrentTime(6, 30); // 6:30 AM CDT

        const res = await request(app)
          .post('/api/v1/orders/immediate')
          .set('Authorization', `Bearer ${customerToken}`)
          .set('X-CSRF-Token', csrfToken)
          .send({
            customerId: testCustomer.customerId,
            affiliateId: testAffiliate.affiliateId,
            numberOfBags: 1,
            estimatedWeight: 15
          });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toContain('outside operating hours');
      });

      it('should reject orders after 7 PM', async () => {
        mockCurrentTime(20, 0); // 8:00 PM CDT (after operating hours end at 7 PM / hour 19)

        const res = await request(app)
          .post('/api/v1/orders/immediate')
          .set('Authorization', `Bearer ${customerToken}`)
          .set('X-CSRF-Token', csrfToken)
          .send({
            customerId: testCustomer.customerId,
            affiliateId: testAffiliate.affiliateId,
            numberOfBags: 1,
            estimatedWeight: 15
          });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toContain('outside operating hours');
      });

      it('should accept orders at exactly 7 AM', async () => {
        mockCurrentTime(7, 0); // 7:00 AM CDT

        const res = await request(app)
          .post('/api/v1/orders/immediate')
          .set('Authorization', `Bearer ${customerToken}`)
          .set('X-CSRF-Token', csrfToken)
          .send({
            customerId: testCustomer.customerId,
            affiliateId: testAffiliate.affiliateId,
            numberOfBags: 1,
            estimatedWeight: 15
          });

        expect(res.status).toBe(201);
      });

      it('should accept orders at exactly 7 PM', async () => {
        mockCurrentTime(19, 0); // 7:00 PM CDT

        const res = await request(app)
          .post('/api/v1/orders/immediate')
          .set('Authorization', `Bearer ${customerToken}`)
          .set('X-CSRF-Token', csrfToken)
          .send({
            customerId: testCustomer.customerId,
            affiliateId: testAffiliate.affiliateId,
            numberOfBags: 1,
            estimatedWeight: 15
          });

        expect(res.status).toBe(201);
      });
    });

    describe('Affiliate Control', () => {
      it('should reject orders when affiliate has disabled immediate pickup', async () => {
        mockCurrentTime(10, 0);

        // Disable immediate pickup for affiliate
        await Affiliate.findOneAndUpdate(
          { affiliateId: testAffiliate.affiliateId },
          { allowImmediatePickup: false }
        );

        const res = await request(app)
          .post('/api/v1/orders/immediate')
          .set('Authorization', `Bearer ${customerToken}`)
          .set('X-CSRF-Token', csrfToken)
          .send({
            customerId: testCustomer.customerId,
            affiliateId: testAffiliate.affiliateId,
            numberOfBags: 1,
            estimatedWeight: 15
          });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toContain('does not currently accept immediate pickup');
      });

      it('should accept orders when affiliate has immediate pickup enabled', async () => {
        mockCurrentTime(10, 0);

        const res = await request(app)
          .post('/api/v1/orders/immediate')
          .set('Authorization', `Bearer ${customerToken}`)
          .set('X-CSRF-Token', csrfToken)
          .send({
            customerId: testCustomer.customerId,
            affiliateId: testAffiliate.affiliateId,
            numberOfBags: 1,
            estimatedWeight: 15
          });

        expect(res.status).toBe(201);
      });
    });

    describe('Active Order Validation', () => {
      it('should reject order when customer already has an active order', async () => {
        mockCurrentTime(10, 0);

        // Create an active order for the customer
        await Order.create({
          orderId: 'ORD-ACTIVE-001',
          customerId: testCustomer.customerId,
          affiliateId: testAffiliate.affiliateId,
          pickupDate: new Date(),
          pickupTime: 'morning',
          estimatedWeight: 20,
          numberOfBags: 1,
          status: 'pending'
        });

        const res = await request(app)
          .post('/api/v1/orders/immediate')
          .set('Authorization', `Bearer ${customerToken}`)
          .set('X-CSRF-Token', csrfToken)
          .send({
            customerId: testCustomer.customerId,
            affiliateId: testAffiliate.affiliateId,
            numberOfBags: 1,
            estimatedWeight: 15
          });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toContain('already have an active order');
      });
    });

    describe('First Order Behavior', () => {
      it('should include first order flag for new customers', async () => {
        mockCurrentTime(10, 0);

        const res = await request(app)
          .post('/api/v1/orders/immediate')
          .set('Authorization', `Bearer ${customerTokenFirstOrder}`)
          .set('X-CSRF-Token', csrfToken)
          .send({
            customerId: testCustomerFirstOrder.customerId,
            affiliateId: testAffiliate.affiliateId,
            numberOfBags: 1,
            estimatedWeight: 15
          });

        expect(res.status).toBe(201);
        expect(res.body.isFirstOrder).toBe(true);
        expect(res.body.firstOrderNote).toBeDefined();
        expect(res.body.firstOrderNote).toContain('kitchen bags');
      });

      it('should not include first order flag for returning customers', async () => {
        mockCurrentTime(10, 0);

        // Create a complete order for this customer to make them a "returning customer"
        await Order.create({
          orderId: 'ORD-PREV-001',
          customerId: testCustomer.customerId,
          affiliateId: testAffiliate.affiliateId,
          pickupDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
          pickupTime: 'morning',
          estimatedWeight: 20,
          numberOfBags: 1,
          status: 'complete' // Completed order, not active (enum value is 'complete')
        });

        const res = await request(app)
          .post('/api/v1/orders/immediate')
          .set('Authorization', `Bearer ${customerToken}`)
          .set('X-CSRF-Token', csrfToken)
          .send({
            customerId: testCustomer.customerId,
            affiliateId: testAffiliate.affiliateId,
            numberOfBags: 1,
            estimatedWeight: 15
          });

        expect(res.status).toBe(201);
        expect(res.body.isFirstOrder).toBe(false);
        expect(res.body.firstOrderNote).toBeUndefined();
      });
    });

    describe('Email Notifications', () => {
      it('should send urgent affiliate notification email', async () => {
        mockCurrentTime(10, 0);
        const emailService = require('../../server/utils/emailService');

        const res = await request(app)
          .post('/api/v1/orders/immediate')
          .set('Authorization', `Bearer ${customerToken}`)
          .set('X-CSRF-Token', csrfToken)
          .send({
            customerId: testCustomer.customerId,
            affiliateId: testAffiliate.affiliateId,
            numberOfBags: 1,
            estimatedWeight: 15
          });

        expect(res.status).toBe(201);
        expect(emailService.sendAffiliateUrgentPickupEmail).toHaveBeenCalled();
      });
    });
  });

  describe('GET /api/v1/orders/immediate/availability - Check Availability', () => {
    it('should return available: true during operating hours with enabled affiliate', async () => {
      mockCurrentTime(12, 0); // Noon CDT

      const res = await request(app)
        .get('/api/v1/orders/immediate/availability')
        .set('Authorization', `Bearer ${customerToken}`)
        .query({ affiliateId: testAffiliate.affiliateId });

      expect(res.status).toBe(200);
      expect(res.body.available).toBe(true);
    });

    it('should return available: false outside operating hours', async () => {
      mockCurrentTime(6, 0); // 6:00 AM CDT

      const res = await request(app)
        .get('/api/v1/orders/immediate/availability')
        .set('Authorization', `Bearer ${customerToken}`)
        .query({ affiliateId: testAffiliate.affiliateId });

      expect(res.status).toBe(200);
      expect(res.body.available).toBe(false);
      expect(res.body.reason).toContain('operating hours');
      expect(res.body.nextAvailableTime).toBeDefined();
    });

    it('should return available: false when affiliate has disabled feature', async () => {
      mockCurrentTime(12, 0);

      await Affiliate.findOneAndUpdate(
        { affiliateId: testAffiliate.affiliateId },
        { allowImmediatePickup: false }
      );

      const res = await request(app)
        .get('/api/v1/orders/immediate/availability')
        .set('Authorization', `Bearer ${customerToken}`)
        .query({ affiliateId: testAffiliate.affiliateId });

      expect(res.status).toBe(200);
      expect(res.body.available).toBe(false);
      expect(res.body.reason).toContain('not currently accept');
    });

    it('should return available: false when customer has active order', async () => {
      mockCurrentTime(12, 0);

      await Order.create({
        orderId: 'ORD-ACTIVE-002',
        customerId: testCustomer.customerId,
        affiliateId: testAffiliate.affiliateId,
        pickupDate: new Date(),
        pickupTime: 'morning',
        estimatedWeight: 20,
        numberOfBags: 1,
        status: 'processing'
      });

      const res = await request(app)
        .get('/api/v1/orders/immediate/availability')
        .set('Authorization', `Bearer ${customerToken}`)
        .query({ affiliateId: testAffiliate.affiliateId });

      expect(res.status).toBe(200);
      expect(res.body.available).toBe(false);
      expect(res.body.reason).toContain('active order');
    });

    it('should calculate next available time when before operating hours', async () => {
      mockCurrentTime(5, 30); // 5:30 AM CDT

      const res = await request(app)
        .get('/api/v1/orders/immediate/availability')
        .set('Authorization', `Bearer ${customerToken}`)
        .query({ affiliateId: testAffiliate.affiliateId });

      expect(res.status).toBe(200);
      expect(res.body.available).toBe(false);
      expect(res.body.nextAvailableTime).toBeDefined();

      const nextAvailable = new Date(res.body.nextAvailableTime);
      expect(nextAvailable.getHours()).toBe(7);
      expect(nextAvailable.getMinutes()).toBe(0);
    });

    it('should calculate next available time as tomorrow when after operating hours', async () => {
      const mockedDate = mockCurrentTime(20, 0); // 8:00 PM CDT

      const res = await request(app)
        .get('/api/v1/orders/immediate/availability')
        .set('Authorization', `Bearer ${customerToken}`)
        .query({ affiliateId: testAffiliate.affiliateId });

      expect(res.status).toBe(200);
      expect(res.body.available).toBe(false);
      expect(res.body.nextAvailableTime).toBeDefined();

      const nextAvailable = new Date(res.body.nextAvailableTime);
      // Next available should be tomorrow relative to the mocked time
      expect(nextAvailable.getDate()).toBe(mockedDate.getDate() + 1);
      expect(nextAvailable.getHours()).toBe(7);
    });
  });

  describe('Affiliate Settings Update', () => {
    let affiliateToken;

    beforeEach(() => {
      affiliateToken = jwt.sign(
        {
          id: testAffiliate._id,
          affiliateId: testAffiliate.affiliateId,
          role: 'affiliate'
        },
        process.env.JWT_SECRET || 'test-secret'
      );
    });

    it('should allow affiliate to toggle immediate pickup setting', async () => {
      // Disable immediate pickup
      const disableRes = await request(app)
        .put(`/api/v1/affiliates/${testAffiliate.affiliateId}`)
        .set('Authorization', `Bearer ${affiliateToken}`)
        .set('X-CSRF-Token', csrfToken)
        .send({ allowImmediatePickup: false });

      expect(disableRes.status).toBe(200);

      let affiliate = await Affiliate.findOne({ affiliateId: testAffiliate.affiliateId });
      expect(affiliate.allowImmediatePickup).toBe(false);

      // Enable immediate pickup
      const enableRes = await request(app)
        .put(`/api/v1/affiliates/${testAffiliate.affiliateId}`)
        .set('Authorization', `Bearer ${affiliateToken}`)
        .set('X-CSRF-Token', csrfToken)
        .send({ allowImmediatePickup: true });

      expect(enableRes.status).toBe(200);

      affiliate = await Affiliate.findOne({ affiliateId: testAffiliate.affiliateId });
      expect(affiliate.allowImmediatePickup).toBe(true);
    });
  });
});

describe('Order Model - Immediate Pickup Fields', () => {
  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/wavemax-test');
    }
  });

  beforeEach(async () => {
    await Order.deleteMany({});
  });

  afterEach(async () => {
    await Order.deleteMany({});
  });

  it('should save order with immediate pickup fields', async () => {
    const now = new Date();
    const deadline = new Date(now.getTime() + 4 * 60 * 60 * 1000); // 4 hours later

    const order = new Order({
      orderId: 'ORD-IMM-001',
      customerId: 'CUST-001',
      affiliateId: 'AFF-001',
      pickupDate: now,
      pickupTime: 'morning',
      estimatedWeight: 20,
      numberOfBags: 1,
      isImmediatePickup: true,
      pickupDeadline: deadline,
      immediatePickupRequestedAt: now
    });

    await order.save();

    const savedOrder = await Order.findOne({ orderId: 'ORD-IMM-001' });
    expect(savedOrder.isImmediatePickup).toBe(true);
    expect(savedOrder.pickupDeadline).toEqual(deadline);
    expect(savedOrder.immediatePickupRequestedAt).toEqual(now);
  });

  it('should default isImmediatePickup to false', async () => {
    const order = new Order({
      orderId: 'ORD-REG-001',
      customerId: 'CUST-001',
      affiliateId: 'AFF-001',
      pickupDate: new Date(),
      pickupTime: 'afternoon',
      estimatedWeight: 25,
      numberOfBags: 2
    });

    await order.save();

    const savedOrder = await Order.findOne({ orderId: 'ORD-REG-001' });
    expect(savedOrder.isImmediatePickup).toBe(false);
    expect(savedOrder.pickupDeadline).toBeUndefined();
    expect(savedOrder.immediatePickupRequestedAt).toBeUndefined();
  });
});

describe('Affiliate Model - allowImmediatePickup Field', () => {
  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/wavemax-test');
    }
  });

  beforeEach(async () => {
    await Affiliate.deleteMany({});
  });

  afterEach(async () => {
    await Affiliate.deleteMany({});
  });

  it('should default allowImmediatePickup to true', async () => {
    const affiliate = new Affiliate({
      affiliateId: 'AFF-TEST-001',
      firstName: 'Test',
      lastName: 'User',
      email: 'test@example.com',
      phone: '1234567890',
      address: '123 Test St',
      city: 'Austin',
      state: 'TX',
      zipCode: '78701',
      username: 'testuser',
      passwordSalt: 'salt',
      passwordHash: 'hash',
      paymentMethod: 'check',
      serviceLatitude: 30.2672,
      serviceLongitude: -97.7431,
      serviceRadius: 5
    });

    await affiliate.save();

    const savedAffiliate = await Affiliate.findOne({ affiliateId: 'AFF-TEST-001' });
    expect(savedAffiliate.allowImmediatePickup).toBe(true);
  });

  it('should allow setting allowImmediatePickup to false', async () => {
    const affiliate = new Affiliate({
      affiliateId: 'AFF-TEST-002',
      firstName: 'Test',
      lastName: 'User',
      email: 'test2@example.com',
      phone: '1234567890',
      address: '123 Test St',
      city: 'Austin',
      state: 'TX',
      zipCode: '78701',
      username: 'testuser2',
      passwordSalt: 'salt',
      passwordHash: 'hash',
      paymentMethod: 'check',
      serviceLatitude: 30.2672,
      serviceLongitude: -97.7431,
      serviceRadius: 5,
      allowImmediatePickup: false
    });

    await affiliate.save();

    const savedAffiliate = await Affiliate.findOne({ affiliateId: 'AFF-TEST-002' });
    expect(savedAffiliate.allowImmediatePickup).toBe(false);
  });
});
