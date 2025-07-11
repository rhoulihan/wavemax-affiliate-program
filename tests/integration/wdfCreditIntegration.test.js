const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../server');
const Order = require('../../server/models/Order');
const Customer = require('../../server/models/Customer');
const Operator = require('../../server/models/Operator');
const Affiliate = require('../../server/models/Affiliate');
const jwt = require('jsonwebtoken');

describe('WDF Credit System Integration Tests', () => {
  let testCustomer;
  let testOperator;
  let testAffiliate;
  let customerToken;
  let operatorToken;
  let affiliateToken;
  let csrfToken;

  // Helper function to add common headers
  const addHeaders = (req, token) => {
    req.set('Authorization', `Bearer ${token}`);
    if (csrfToken) req.set('X-CSRF-Token', csrfToken);
    return req;
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
    // Clear collections
    await Order.deleteMany({});
    await Customer.deleteMany({});
    await Operator.deleteMany({});
    await Affiliate.deleteMany({});
    
    // Import SystemConfig and initialize
    const SystemConfig = require('../../server/models/SystemConfig');
    await SystemConfig.deleteMany({});
    await SystemConfig.initializeDefaults();

    // Create test affiliate
    testAffiliate = await Affiliate.create({
      affiliateId: 'AFF-INT-001',
      firstName: 'Test',
      lastName: 'Affiliate',
      email: 'affiliate@test.com',
      phone: '1234567890',
      businessName: 'Test Business',
      address: '123 Test St',
      city: 'Test City',
      state: 'TS',
      zipCode: '12345',
      username: 'testaffiliate',
      passwordSalt: 'salt',
      passwordHash: 'hash',
      paymentMethod: 'directDeposit',
      serviceLatitude: 40.7128,
      serviceLongitude: -74.0060,
      minimumDeliveryFee: 25,
      perBagDeliveryFee: 5,
      serviceRadius: 5
    });

    // Create test customer
    testCustomer = await Customer.create({
      customerId: 'CUST-INT-001',
      affiliateId: testAffiliate.affiliateId,
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane.smith@test.com',
      phone: '1234567890',
      address: '456 Test Ave',
      city: 'Test City',
      state: 'TS',
      zipCode: '12345',
      username: 'janesmith',
      passwordSalt: 'salt',
      passwordHash: 'hash'
    });

    // Create test operator
    testOperator = await Operator.create({
      operatorId: 'OP-INT-001',
      firstName: 'Test',
      lastName: 'Operator',
      email: 'operator@test.com',
      username: 'testoperator',
      password: 'hashedpassword',
      createdBy: new mongoose.Types.ObjectId(),
      passwordSalt: 'salt',
      passwordHash: 'hash'
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

    operatorToken = jwt.sign(
      { 
        id: testOperator._id, 
        operatorId: testOperator.operatorId, 
        role: 'operator' 
      },
      process.env.JWT_SECRET || 'test-secret'
    );
    
    affiliateToken = jwt.sign(
      { 
        id: testAffiliate._id, 
        affiliateId: testAffiliate.affiliateId, 
        role: 'affiliate' 
      },
      process.env.JWT_SECRET || 'test-secret'
    );
    
    // Get CSRF token
    const csrfRes = await request(app).get('/api/csrf-token');
    csrfToken = csrfRes.body.csrfToken || csrfRes.body.token;
  });

  afterEach(async () => {
    await Order.deleteMany({});
    await Customer.deleteMany({});
    await Operator.deleteMany({});
    await Affiliate.deleteMany({});
  });

  afterAll(async () => {
    // Connection cleanup is handled by global setup.js
  });

  describe('End-to-End WDF Credit Flow', () => {
    it('should complete full credit cycle: create order → weigh bags → generate credit → apply to next order', async () => {
      // Step 1: Create first order
      const createOrderRes = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .set('X-CSRF-Token', csrfToken)
        .send({
          customerId: testCustomer.customerId,
          affiliateId: testAffiliate.affiliateId,
          pickupDate: new Date().toISOString(),
          pickupTime: 'morning',
          estimatedWeight: 30,
          numberOfBags: 2,
          specialPickupInstructions: 'First order'
        });

      expect(createOrderRes.status).toBe(201);
      expect(createOrderRes.body.success).toBe(true);
      const firstOrderId = createOrderRes.body.orderId;

      // Step 2: Operator weighs bags (actual weight is higher)
      const weighBagsRes = await request(app)
        .post('/api/v1/operators/orders/weigh-bags')
        .set('Authorization', `Bearer ${operatorToken}`)
        .set('X-CSRF-Token', csrfToken)
        .send({
          orderId: firstOrderId,
          bags: [
            { bagId: 'BAG-INT-001', weight: 20 },
            { bagId: 'BAG-INT-002', weight: 15 }
          ]
        });

      expect(weighBagsRes.status).toBe(200);
      expect(weighBagsRes.body.success).toBe(true);

      // Step 3: Verify credit was generated
      const customerRes = await request(app)
        .get(`/api/v1/customers/${testCustomer.customerId}/dashboard`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(customerRes.status).toBe(200);
      expect(customerRes.body.dashboard.wdfCredit.amount).toBe(6.25); // (35-30) * 1.25

      // Mark first order as complete to avoid active order conflict
      await Order.findOneAndUpdate(
        { orderId: firstOrderId },
        { status: 'complete', completedAt: new Date() }
      );

      // Step 4: Create second order (credit should be applied)
      const secondOrderRes = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .set('X-CSRF-Token', csrfToken)
        .send({
          customerId: testCustomer.customerId,
          affiliateId: testAffiliate.affiliateId,
          pickupDate: new Date().toISOString(),
          pickupTime: 'afternoon',
          estimatedWeight: 25,
          numberOfBags: 2,
          specialPickupInstructions: 'Second order with credit'
        });

      expect(secondOrderRes.status).toBe(201);
      expect(secondOrderRes.body.wdfCreditApplied).toBe(6.25);
      
      // Step 5: Verify credit was consumed
      const finalCustomerRes = await request(app)
        .get(`/api/v1/customers/${testCustomer.customerId}/dashboard`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(finalCustomerRes.body.dashboard.wdfCredit.amount).toBe(0);

      // Step 6: Verify order details show credit
      const orderDetailsRes = await request(app)
        .get(`/api/v1/orders/${secondOrderRes.body.orderId}`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(orderDetailsRes.status).toBe(200);
      expect(orderDetailsRes.body.order.wdfCreditApplied).toBe(6.25);
      
      // Verify the total was calculated correctly
      // Base: 25 * 1.25 = 31.25, Fee: 25 (minimum), Credit: -6.25
      // Total: 31.25 + 25 - 6.25 = 50
      expect(orderDetailsRes.body.order.estimatedTotal).toBe(50);
    });

    it('should handle debit scenario when actual weight is less than estimated', async () => {
      // Create order with overestimated weight
      const createOrderRes = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .set('X-CSRF-Token', csrfToken)
        .send({
          customerId: testCustomer.customerId,
          affiliateId: testAffiliate.affiliateId,
          pickupDate: new Date().toISOString(),
          pickupTime: 'evening',
          estimatedWeight: 40,
          numberOfBags: 1,
          specialPickupInstructions: 'Overestimated weight'
        });

      expect(createOrderRes.status).toBe(201);
      const orderId = createOrderRes.body.orderId;

      // Weigh bag (actual weight is lower)
      const weighBagsRes = await request(app)
        .post('/api/v1/operators/orders/weigh-bags')
        .set('Authorization', `Bearer ${operatorToken}`)
        .set('X-CSRF-Token', csrfToken)
        .send({
          orderId: orderId,
          bags: [{ bagId: 'BAG-INT-003', weight: 35 }]
        });

      expect(weighBagsRes.status).toBe(200);

      // Check customer has negative credit (debit)
      const customerRes = await request(app)
        .get(`/api/v1/customers/${testCustomer.customerId}/dashboard`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(customerRes.body.dashboard.wdfCredit.amount).toBe(-6.25); // (35-40) * 1.25

      // Mark first order as complete to avoid active order conflict
      await Order.findOneAndUpdate(
        { orderId: orderId },
        { status: 'complete', completedAt: new Date() }
      );

      // Create next order with debit applied
      const secondOrderRes = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .set('X-CSRF-Token', csrfToken)
        .send({
          customerId: testCustomer.customerId,
          affiliateId: testAffiliate.affiliateId,
          pickupDate: new Date().toISOString(),
          pickupTime: 'morning',
          estimatedWeight: 20,
          numberOfBags: 1
        });

      expect(secondOrderRes.status).toBe(201);
      expect(secondOrderRes.body.wdfCreditApplied).toBe(-6.25);

      // Verify total includes the debit
      const orderDetailsRes = await request(app)
        .get(`/api/v1/orders/${secondOrderRes.body.orderId}`)
        .set('Authorization', `Bearer ${customerToken}`);

      // Base: 20 * 1.25 = 25, Fee: 25 (minimum), Debit: +6.25
      // Total: 25 + 25 + 6.25 = 56.25
      expect(orderDetailsRes.body.order.estimatedTotal).toBe(56.25);
    });
  });

  describe('API Response Validation', () => {
    it('should include WDF credit fields in customer profile', async () => {
      // Set some credit
      testCustomer.wdfCredit = 15.50;
      testCustomer.wdfCreditUpdatedAt = new Date();
      testCustomer.wdfCreditFromOrderId = 'ORD-123';
      await testCustomer.save();

      const res = await request(app)
        .get(`/api/v1/customers/${testCustomer.customerId}/profile`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.customer).toHaveProperty('wdfCredit', 15.50);
      expect(res.body.customer).toHaveProperty('wdfCreditFromOrderId', 'ORD-123');
      expect(res.body.customer).toHaveProperty('wdfCreditUpdatedAt');
    });

    it('should include WDF credit in order search results', async () => {
      // Create order with credit
      await Order.create({
        orderId: 'ORD-SEARCH-001',
        customerId: testCustomer.customerId,
        affiliateId: testAffiliate.affiliateId,
        pickupDate: new Date(),
        pickupTime: 'morning',
        estimatedWeight: 30,
        actualWeight: 35,
        wdfCreditApplied: 5.00,
        wdfCreditGenerated: 6.25,
        weightDifference: 5,
        status: 'complete',
        baseRate: 1.25,
        numberOfBags: 2,
        feeBreakdown: {
          numberOfBags: 2,
          minimumFee: 25,
          perBagFee: 5,
          totalFee: 25,
          minimumApplied: true
        }
      });

      const res = await request(app)
        .get('/api/v1/orders/search')
        .set('Authorization', `Bearer ${affiliateToken}`)
        .query({ customerId: testCustomer.customerId });

      expect(res.status).toBe(200);
      expect(res.body.orders).toHaveLength(1);
      expect(res.body.orders[0]).toHaveProperty('wdfCreditApplied', 5.00);
      expect(res.body.orders[0]).toHaveProperty('wdfCreditGenerated', 6.25);
      expect(res.body.orders[0]).toHaveProperty('weightDifference', 5);
    });
  });

  describe('Error Handling', () => {
    it('should handle order not found error when weighing bags', async () => {
      const res = await request(app)
        .post('/api/v1/operators/orders/weigh-bags')
        .set('Authorization', `Bearer ${operatorToken}`)
        .set('X-CSRF-Token', csrfToken)
        .send({
          orderId: 'INVALID-ORDER-ID',
          bags: [{ bagId: 'BAG001', weight: 10 }]
        });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Order not found');
    });

    it('should prevent duplicate bag weighing', async () => {
      // Create order
      const order = await Order.create({
        orderId: 'ORD-DUP-001',
        customerId: testCustomer.customerId,
        affiliateId: testAffiliate.affiliateId,
        pickupDate: new Date(),
        pickupTime: 'morning',
        estimatedWeight: 20,
        numberOfBags: 2,
        status: 'processing'
      });

      // Weigh first bag
      await request(app)
        .post('/api/v1/operators/orders/weigh-bags')
        .set('Authorization', `Bearer ${operatorToken}`)
        .set('X-CSRF-Token', csrfToken)
        .send({
          orderId: order.orderId,
          bags: [{ bagId: 'BAG-DUP-001', weight: 10 }]
        });

      // Try to weigh same bag again
      const res = await request(app)
        .post('/api/v1/operators/orders/weigh-bags')
        .set('Authorization', `Bearer ${operatorToken}`)
        .set('X-CSRF-Token', csrfToken)
        .send({
          orderId: order.orderId,
          bags: [{ bagId: 'BAG-DUP-001', weight: 10 }]
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Duplicate bag');
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent credit updates correctly', async () => {
      // Create two orders for the same customer
      const [order1, order2] = await Promise.all([
        Order.create({
          orderId: 'ORD-CONC-001',
          customerId: testCustomer.customerId,
          affiliateId: testAffiliate.affiliateId,
          pickupDate: new Date(),
          pickupTime: 'morning',
          estimatedWeight: 20,
          numberOfBags: 1,
          status: 'processing'
        }),
        Order.create({
          orderId: 'ORD-CONC-002',
          customerId: testCustomer.customerId,
          affiliateId: testAffiliate.affiliateId,
          pickupDate: new Date(),
          pickupTime: 'afternoon',
          estimatedWeight: 30,
          numberOfBags: 1,
          status: 'processing'
        })
      ]);

      // Weigh both orders concurrently
      const [res1, res2] = await Promise.all([
        request(app)
          .post('/api/v1/operators/orders/weigh-bags')
          .set('Authorization', `Bearer ${operatorToken}`)
          .send({
            orderId: order1.orderId,
            bags: [{ bagId: 'BAG-CONC-001', weight: 25 }]
          }),
        request(app)
          .post('/api/v1/operators/orders/weigh-bags')
          .set('Authorization', `Bearer ${operatorToken}`)
          .send({
            orderId: order2.orderId,
            bags: [{ bagId: 'BAG-CONC-002', weight: 28 }]
          })
      ]);

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);

      // Check final customer credit
      const customer = await Customer.findOne({ customerId: testCustomer.customerId });
      
      // The last update should win (race condition expected)
      // Credit should be from one of the orders
      expect([6.25, -2.5]).toContain(customer.wdfCredit);
      expect(['ORD-CONC-001', 'ORD-CONC-002']).toContain(customer.wdfCreditFromOrderId);
    });
  });
});