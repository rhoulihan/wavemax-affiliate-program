const request = require('supertest');
const app = require('../../server');
const Customer = require('../../server/models/Customer');
const Order = require('../../server/models/Order');
const Affiliate = require('../../server/models/Affiliate');
const SystemConfig = require('../../server/models/SystemConfig');
const { createTestAffiliate, createTestCustomer, cleanupTestData } = require('../testUtils');

describe('Bag Credit Functionality', () => {
  let testAffiliate;
  let testCustomer;
  let authToken;

  beforeAll(async () => {
    // Setup test data
    testAffiliate = await createTestAffiliate();
    testCustomer = await createTestCustomer(testAffiliate.affiliateId);
    
    // Set customer's bag credit
    testCustomer.bagCredit = 25; // $25 bag credit
    testCustomer.bagCreditApplied = false;
    await testCustomer.save();

    // Login to get auth token
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        username: testCustomer.username,
        password: 'password123'
      });
    authToken = loginRes.body.token;

    // Ensure system config values exist
    await SystemConfig.setValue('wdf_base_rate_per_pound', 1.25);
    await SystemConfig.setValue('affiliate_default_min_delivery_fee', 5.00);
    await SystemConfig.setValue('affiliate_default_per_bag_fee', 2.00);
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  test('Should apply bag credit to first order', async () => {
    const orderData = {
      customerId: testCustomer.customerId,
      affiliateId: testAffiliate.affiliateId,
      pickupDate: new Date(Date.now() + 86400000).toISOString(),
      pickupTime: 'morning',
      estimatedWeight: 20,
      numberOfBags: 2,
      addOns: {
        premiumDetergent: true,
        fabricSoftener: false,
        stainRemover: false
      }
    };

    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${authToken}`)
      .send(orderData);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.bagCreditApplied).toBe(25); // $25 bag credit applied

    // Verify order was created with bag credit
    const order = await Order.findOne({ orderId: res.body.orderId });
    expect(order.bagCreditApplied).toBe(25);
    
    // Calculate expected total
    // Base: 20 lbs × $1.25 = $25
    // Delivery: min($5, 2 × $2) = $5
    // Add-on: 1 add-on × 20 lbs × $0.10 = $2
    // Subtotal: $25 + $5 + $2 = $32
    // After bag credit: $32 - $25 = $7
    expect(order.estimatedTotal).toBe(7);

    // Verify customer's bag credit is reset
    const updatedCustomer = await Customer.findOne({ customerId: testCustomer.customerId });
    expect(updatedCustomer.bagCredit).toBe(0);
    expect(updatedCustomer.bagCreditApplied).toBe(true);
  });

  test('Should not apply bag credit to second order', async () => {
    // Create another order
    const orderData = {
      customerId: testCustomer.customerId,
      affiliateId: testAffiliate.affiliateId,
      pickupDate: new Date(Date.now() + 172800000).toISOString(), // 2 days later
      pickupTime: 'afternoon',
      estimatedWeight: 15,
      numberOfBags: 1
    };

    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${authToken}`)
      .send(orderData);

    expect(res.status).toBe(201);
    expect(res.body.bagCreditApplied).toBe(0); // No bag credit applied

    // Verify order has no bag credit
    const order = await Order.findOne({ orderId: res.body.orderId });
    expect(order.bagCreditApplied).toBe(0);
    
    // Total should be normal without bag credit
    // Base: 15 lbs × $1.25 = $18.75
    // Delivery: $5 (minimum)
    // Total: $23.75
    expect(order.estimatedTotal).toBe(23.75);
  });
});