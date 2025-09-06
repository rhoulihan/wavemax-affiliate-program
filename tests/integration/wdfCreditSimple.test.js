const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../server');
const Order = require('../../server/models/Order');
const Customer = require('../../server/models/Customer');
const Operator = require('../../server/models/Operator');
const Affiliate = require('../../server/models/Affiliate');
const jwt = require('jsonwebtoken');
const { expectSuccessResponse, expectErrorResponse } = require('../helpers/responseHelpers');
const { createFindOneMock, createFindMock, createMockDocument, createAggregateMock } = require('../helpers/mockHelpers');

// Set timeout for integration tests
jest.setTimeout(90000);

describe.skip('WDF Credit Integration Test (DEPRECATED - Feature being removed)', () => {
  let server;

  beforeAll(async () => {
    // Don't start server - use the app directly for supertest
    // which will handle the server lifecycle
  });

  afterAll(async () => {
    // No server to close since we're using supertest with app directly
  });

  describe('WDF Credit API Endpoints', () => {
    let testCustomer;
    let testAffiliate;
    let customerToken;

    beforeEach(async () => {
      // Clear test data
      await Customer.deleteMany({});
      await Affiliate.deleteMany({});
      await Order.deleteMany({});

      // Create test affiliate
      testAffiliate = await Affiliate.create({
        affiliateId: 'AFF-API-001',
        firstName: 'API',
        lastName: 'Affiliate',
        email: 'api.affiliate@test.com',
        phone: '1234567890',
        businessName: 'API Business',
        address: '123 API St',
        city: 'API City',
        state: 'AP',
        zipCode: '12345',
        username: 'apiaffiliate',
        passwordSalt: 'salt',
        passwordHash: 'hash',
        paymentMethod: 'check',
        serviceLatitude: 40.7128,
        serviceLongitude: -74.0060
      });

      // Create test customer with WDF credit
      testCustomer = await Customer.create({
        customerId: 'CUST-API-001',
        affiliateId: testAffiliate.affiliateId,
        firstName: 'API',
        lastName: 'Customer',
        email: 'api.customer@test.com',
        phone: '1234567890',
        address: '456 API Ave',
        city: 'API City',
        state: 'AP',
        zipCode: '12345',
        username: 'apicustomer',
        passwordSalt: 'salt',
        passwordHash: 'hash',
        wdfCredit: 15.50,
        wdfCreditUpdatedAt: new Date(),
        wdfCreditFromOrderId: 'ORD-PREV-001'
      });

      // Generate token
      customerToken = jwt.sign(
        { 
          id: testCustomer._id, 
          customerId: testCustomer.customerId, 
          role: 'customer' 
        },
        process.env.JWT_SECRET || 'test-secret'
      );
    });

    it('should include WDF credit in customer dashboard', async () => {
      const res = await request(app)
        .get(`/api/v1/customers/${testCustomer.customerId}/dashboard`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.dashboard).toHaveProperty('wdfCredit');
      expect(res.body.dashboard.wdfCredit.amount).toBe(15.50);
      expect(res.body.dashboard.wdfCredit.fromOrderId).toBe('ORD-PREV-001');
    });

    it('should apply WDF credit when creating new order', async () => {
      const res = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          customerId: testCustomer.customerId,
          affiliateId: testAffiliate.affiliateId,
          pickupDate: new Date().toISOString(),
          pickupTime: 'morning',
          estimatedWeight: 25,
          numberOfBags: 2,
          specialPickupInstructions: 'Test order with credit'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.wdfCreditApplied).toBe(15.50);

      // Verify credit was consumed
      const updatedCustomer = await Customer.findOne({ customerId: testCustomer.customerId });
      expect(updatedCustomer.wdfCredit).toBe(0);

      // Verify order has credit applied
      const order = await Order.findOne({ orderId: res.body.orderId });
      expect(order.wdfCreditApplied).toBe(15.50);
    });

    it('should show WDF credit in order details', async () => {
      // Create order with WDF credit
      const order = await Order.create({
        orderId: 'ORD-API-001',
        customerId: testCustomer.customerId,
        affiliateId: testAffiliate.affiliateId,
        pickupDate: new Date(),
        pickupTime: 'morning',
        estimatedWeight: 30,
        actualWeight: 35,
        wdfCreditApplied: 10.00,
        wdfCreditGenerated: 6.25,
        weightDifference: 5,
        baseRate: 1.25,
        feeBreakdown: {
          numberOfBags: 2,
          minimumFee: 10,
          perBagFee: 2,
          totalFee: 10,
          minimumApplied: true
        },
        status: 'complete'
      });

      const res = await request(app)
        .get(`/api/v1/orders/${order.orderId}`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.order.wdfCreditApplied).toBe(10.00);
      expect(res.body.order.wdfCreditGenerated).toBe(6.25);
      expect(res.body.order.weightDifference).toBe(5);
    });
  });

  describe('WDF Credit Calculation', () => {
    it('should generate correct credit for weight differences', async () => {
      // Create customer without credit
      const customer = await Customer.create({
        customerId: 'CUST-CALC-001',
        affiliateId: 'AFF-CALC-001',
        firstName: 'Calc',
        lastName: 'Customer',
        email: 'calc@test.com',
        phone: '1234567890',
        address: '789 Calc St',
        city: 'Calc City',
        state: 'CA',
        zipCode: '54321',
        username: 'calccustomer',
        passwordSalt: 'salt',
        passwordHash: 'hash'
      });

      // Create order
      const order = await Order.create({
        orderId: 'ORD-CALC-001',
        customerId: customer.customerId,
        affiliateId: 'AFF-CALC-001',
        pickupDate: new Date(),
        pickupTime: 'morning',
        estimatedWeight: 20,
        baseRate: 1.25,
        numberOfBags: 1,
        status: 'processing'
      });

      // Simulate weighing with higher actual weight
      order.actualWeight = 25;
      order.bagsWeighed = 1;
      order.weightDifference = order.actualWeight - order.estimatedWeight;
      order.wdfCreditGenerated = parseFloat((order.weightDifference * order.baseRate).toFixed(2));
      await order.save();

      // Update customer credit
      customer.wdfCredit = order.wdfCreditGenerated;
      customer.wdfCreditUpdatedAt = new Date();
      customer.wdfCreditFromOrderId = order.orderId;
      await customer.save();

      // Verify calculations
      expect(order.weightDifference).toBe(5);
      expect(order.wdfCreditGenerated).toBe(6.25); // 5 * 1.25
      expect(customer.wdfCredit).toBe(6.25);
    });
  });
});