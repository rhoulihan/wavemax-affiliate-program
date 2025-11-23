jest.setTimeout(90000);

const app = require('../../server');
const Affiliate = require('../../server/models/Affiliate');
const Customer = require('../../server/models/Customer');
const Order = require('../../server/models/Order');
const jwt = require('jsonwebtoken');
const { getCsrfToken, createAgent } = require('../helpers/csrfHelper');
const { getStrongPassword } = require('../helpers/testPasswords');

describe('Affiliate API', () => {
  let testAffiliate;
  let authToken;
  let agent;
  let csrfToken;

  beforeEach(async () => {
    // Create agent with session support
    agent = createAgent(app);

    // Get CSRF token
    csrfToken = await getCsrfToken(app, agent);

    // Create a test affiliate
    testAffiliate = new Affiliate({
      firstName: 'Test',
      lastName: 'Affiliate',
      email: 'test@example.com',
      phone: '555-1234',
      address: '123 Test St',
      city: 'Testville',
      state: 'TX',
      zipCode: '12345',
      serviceArea: 'Test Area',
      serviceLatitude: 30.2672,
      serviceLongitude: -97.7431,
      serviceRadius: 10,
      minimumDeliveryFee: 25,
      perBagDeliveryFee: 5,
      username: 'testaffiliate',
      passwordSalt: 'testsalt',
      passwordHash: 'testhash',
      paymentMethod: 'check'
    });

    await testAffiliate.save();

    // Generate auth token
    authToken = jwt.sign(
      {
        id: testAffiliate._id,
        affiliateId: testAffiliate.affiliateId,
        role: 'affiliate'
      },
      process.env.JWT_SECRET || 'testsecret',
      { expiresIn: '1h' }
    );
  });

  test('should register a new affiliate', async () => {
    // Create beta request for the new affiliate (required for beta mode)
    // This ensures test works in both beta and regular mode
    const BetaRequest = require('../../server/models/BetaRequest');
    await BetaRequest.create({
      email: 'new@example.com',
      firstName: 'New',
      lastName: 'Affiliate',
      phone: '555-5678',
      address: '456 Test St',
      city: 'Austin',
      state: 'TX',
      zipCode: '78701',
      welcomeEmailSent: true
    });

    const res = await agent
      .post('/api/v1/affiliates/register')
      .set('X-CSRF-Token', csrfToken)
      .send({
        firstName: 'New',
        lastName: 'Affiliate',
        email: 'new@example.com',
        phone: '555-5678',
        address: '456 Test St',
        city: 'Austin',
        state: 'TX',
        zipCode: '78701',
        serviceArea: 'Austin Area',
        serviceLatitude: 30.2672,
        serviceLongitude: -97.7431,
        serviceRadius: 10,
        minimumDeliveryFee: 25,
        perBagDeliveryFee: 5,
        username: 'newaffiliate',
        password: getStrongPassword('affiliate', 1),
        paymentMethod: 'check'
      });

    expect(res.statusCode).toEqual(201);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('affiliateId');
  });

  test('should get affiliate profile', async () => {
    const res = await agent
      .get(`/api/v1/affiliates/${testAffiliate.affiliateId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body.affiliate).toHaveProperty('firstName', 'Test');
    expect(res.body.affiliate).toHaveProperty('lastName', 'Affiliate');
  });

  test('should update affiliate profile', async () => {
    const res = await agent
      .put(`/api/v1/affiliates/${testAffiliate.affiliateId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .set('X-CSRF-Token', csrfToken)
      .send({
        firstName: 'Updated',
        minimumDeliveryFee: 30,
        perBagDeliveryFee: 6
      });

    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('success', true);

    // Verify the update
    const updatedAffiliate = await Affiliate.findOne({ affiliateId: testAffiliate.affiliateId });
    expect(updatedAffiliate.firstName).toBe('Updated');
    expect(updatedAffiliate.minimumDeliveryFee).toBe(30);
    expect(updatedAffiliate.perBagDeliveryFee).toBe(6);
  });

  test('should login affiliate', async () => {
    // Set up password for test affiliate
    const testPassword = getStrongPassword('affiliate', 2);
    const { hash, salt } = require('../../server/utils/encryption').hashPassword(testPassword);
    await Affiliate.updateOne(
      { affiliateId: testAffiliate.affiliateId },
      { passwordHash: hash, passwordSalt: salt }
    );

    const res = await agent
      .post('/api/v1/auth/affiliate/login')
      .set('x-csrf-token', csrfToken)
      .send({
        username: 'testaffiliate',
        password: testPassword
      });

    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('token');
    expect(res.body).toHaveProperty('refreshToken');
    expect(res.body.affiliate).toHaveProperty('affiliateId', testAffiliate.affiliateId);
  });

  test('should get affiliate\'s customers list', async () => {
    // Create test customers
    const Customer = require('../../server/models/Customer');
    await Customer.create([
      {
        customerId: 'CUST001',
        firstName: 'Customer',
        lastName: 'One',
        email: 'customer1@example.com',
        phone: '555-0001',
        address: '111 Test St',
        city: 'Testville',
        state: 'TX',
        zipCode: '12345',
        serviceFrequency: 'weekly',
        username: 'customer1',
        passwordHash: 'hash',
        passwordSalt: 'salt',
        affiliateId: testAffiliate.affiliateId
      },
      {
        customerId: 'CUST002',
        firstName: 'Customer',
        lastName: 'Two',
        email: 'customer2@example.com',
        phone: '555-0002',
        address: '222 Test St',
        city: 'Testville',
        state: 'TX',
        zipCode: '12345',
        serviceFrequency: 'biweekly',
        username: 'customer2',
        passwordHash: 'hash',
        passwordSalt: 'salt',
        affiliateId: testAffiliate.affiliateId
      }
    ]);

    const res = await agent
      .get(`/api/v1/affiliates/${testAffiliate.affiliateId}/customers`)
      .set('Authorization', `Bearer ${authToken}`)
      .query({ page: 1, limit: 10 });

    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('customers');
    expect(res.body.customers).toHaveLength(2);
    expect(res.body).toHaveProperty('pagination');
    expect(res.body.pagination).toMatchObject({
      totalItems: 2,
      totalPages: 1,
      page: 1,
      limit: 10,
      hasNext: false,
      hasPrev: false
    });
  });

  test('should get affiliate\'s orders', async () => {
    const Order = require('../../server/models/Order');
    // Create orders with proper fee structure
    const order1 = new Order({
      orderId: 'ORD001',
      customerId: 'CUST001',
      affiliateId: testAffiliate.affiliateId,
      pickupDate: new Date('2025-05-25'),
      pickupTime: 'morning',

      status: 'complete',
      estimatedWeight: 30,
      numberOfBags: 2,
      actualWeight: 23.5,
      baseRate: 1.89,
      feeBreakdown: {
        numberOfBags: 2,
        minimumFee: 25,
        perBagFee: 5,
        totalFee: 25,
        minimumApplied: true
      }
    });
    await order1.save();

    const order2 = new Order({
      orderId: 'ORD002',
      customerId: 'CUST002',
      affiliateId: testAffiliate.affiliateId,
      pickupDate: new Date('2025-05-26'),
      pickupTime: 'afternoon',

      status: 'processing',
      estimatedWeight: 50,
      numberOfBags: 3,
      baseRate: 1.89,
      feeBreakdown: {
        numberOfBags: 3,
        minimumFee: 25,
        perBagFee: 5,
        totalFee: 25,
        minimumApplied: true
      }
    });
    await order2.save();

    const res = await agent
      .get(`/api/v1/affiliates/${testAffiliate.affiliateId}/orders`)
      .set('Authorization', `Bearer ${authToken}`)
      .query({ page: 1, limit: 10 });

    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('orders');
    expect(res.body.orders).toHaveLength(2);
    expect(res.body).toHaveProperty('pagination');
    expect(res.body).toHaveProperty('totalEarnings', 29.44);
  });

  test('should get affiliate\'s earnings/transactions', async () => {
    const Transaction = require('../../server/models/Transaction');
    await Transaction.create([
      {
        transactionId: 'TXN001',
        affiliateId: testAffiliate.affiliateId,
        orderId: 'ORD001',
        type: 'commission',
        amount: 10.43,
        description: 'Commission for order ORD001',
        status: 'pending',
        payoutMethod: 'check'
      },
      {
        transactionId: 'TXN002',
        affiliateId: testAffiliate.affiliateId,
        type: 'payout',
        amount: -100.00,
        description: 'Weekly payout',
        status: 'completed',
        payoutMethod: 'check',
        payoutReference: 'REF123'
      }
    ]);

    const res = await agent
      .get(`/api/v1/affiliates/${testAffiliate.affiliateId}/transactions`)
      .set('Authorization', `Bearer ${authToken}`)
      .query({ page: 1, limit: 10 });

    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('transactions');
    expect(res.body.transactions).toHaveLength(2);
    expect(res.body).toHaveProperty('summary');
    expect(res.body.summary).toMatchObject({
      totalEarnings: 10.43,
      totalPayouts: 100.00,
      pendingAmount: 10.43
    });
  });


  test('Delete all affiliate data (development only)', async () => {
    // Enable delete feature
    const originalEnv = process.env.ENABLE_DELETE_DATA_FEATURE;
    process.env.ENABLE_DELETE_DATA_FEATURE = 'true';

    // Create some test data
    const testCustomer = await Customer.create({
      affiliateId: testAffiliate.affiliateId,
      firstName: 'Test',
      lastName: 'Customer',
      email: 'testcustomer@example.com',
      phone: '555-0123',
      address: '123 Test St',
      city: 'Austin',
      state: 'TX',
      zipCode: '78701',
      username: 'testcustomer',
      passwordSalt: 'salt',
      passwordHash: 'hash'
    });

    const testOrder = await Order.create({
      customerId: testCustomer.customerId,
      affiliateId: testAffiliate.affiliateId,
      pickupDate: new Date(),
      pickupTime: 'morning',

      status: 'pending',
      estimatedWeight: 30,
      numberOfBags: 2,
      deliveryFee: 20
    });


    // Delete all data
    const res = await agent
      .delete(`/api/v1/affiliates/${testAffiliate.affiliateId}/delete-all-data`)
      .set('Authorization', `Bearer ${authToken}`)
      .set('X-CSRF-Token', csrfToken);

    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('message', 'All data has been deleted successfully');

    // Verify data is deleted
    const deletedAffiliate = await Affiliate.findOne({ affiliateId: testAffiliate.affiliateId });
    const deletedCustomer = await Customer.findOne({ customerId: testCustomer.customerId });
    const deletedOrder = await Order.findOne({ orderId: testOrder.orderId });

    expect(deletedAffiliate).toBeNull();
    expect(deletedCustomer).toBeNull();
    expect(deletedOrder).toBeNull();

    // Restore environment
    process.env.ENABLE_DELETE_DATA_FEATURE = originalEnv;
  });

  test('Reject delete in production environment', async () => {
    // Disable delete feature
    const originalEnv = process.env.ENABLE_DELETE_DATA_FEATURE;
    process.env.ENABLE_DELETE_DATA_FEATURE = 'false';

    const res = await agent
      .delete(`/api/v1/affiliates/${testAffiliate.affiliateId}/delete-all-data`)
      .set('Authorization', `Bearer ${authToken}`)
      .set('X-CSRF-Token', csrfToken);

    expect(res.statusCode).toEqual(403);
    expect(res.body).toHaveProperty('success', false);
    expect(res.body).toHaveProperty('message', 'This operation is not allowed');

    // Restore environment
    process.env.ENABLE_DELETE_DATA_FEATURE = originalEnv;
  });
});