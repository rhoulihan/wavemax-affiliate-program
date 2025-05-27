const request = require('supertest');
const app = require('../../server');
const Affiliate = require('../../server/models/Affiliate');
const jwt = require('jsonwebtoken');

describe('Affiliate API', () => {
  let testAffiliate;
  let authToken;

  beforeEach(async () => {
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
      deliveryFee: 5.99,
      username: 'testaffiliate',
      passwordSalt: 'testsalt',
      passwordHash: 'testhash',
      paymentMethod: 'directDeposit'
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
    const res = await request(app)
      .post('/api/v1/affiliates/register')
      .send({
        firstName: 'New',
        lastName: 'Affiliate',
        email: 'new@example.com',
        phone: '555-5678',
        address: '456 Test St',
        city: 'Testville',
        state: 'TX',
        zipCode: '12345',
        serviceArea: 'Test Area',
        deliveryFee: 5.99,
        username: 'newaffiliate',
        password: 'Password123!',
        paymentMethod: 'directDeposit'
      });

    expect(res.statusCode).toEqual(201);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('affiliateId');
  });

  test('should get affiliate profile', async () => {
    const res = await request(app)
      .get(`/api/v1/affiliates/${testAffiliate.affiliateId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body.affiliate).toHaveProperty('firstName', 'Test');
    expect(res.body.affiliate).toHaveProperty('lastName', 'Affiliate');
  });

  test('should update affiliate profile', async () => {
    const res = await request(app)
      .put(`/api/v1/affiliates/${testAffiliate.affiliateId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        firstName: 'Updated',
        deliveryFee: 6.99
      });

    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('success', true);

    // Verify the update
    const updatedAffiliate = await Affiliate.findOne({ affiliateId: testAffiliate.affiliateId });
    expect(updatedAffiliate.firstName).toBe('Updated');
    expect(updatedAffiliate.deliveryFee).toBe(6.99);
  });

  test('should login affiliate', async () => {
    // Set up password for test affiliate
    const { hash, salt } = require('../../server/utils/encryption').hashPassword('testpassword');
    await Affiliate.updateOne(
      { affiliateId: testAffiliate.affiliateId },
      { passwordHash: hash, passwordSalt: salt }
    );

    const res = await request(app)
      .post('/api/v1/auth/affiliate/login')
      .send({
        username: 'testaffiliate',
        password: 'testpassword'
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

    const res = await request(app)
      .get(`/api/v1/affiliates/${testAffiliate.affiliateId}/customers`)
      .set('Authorization', `Bearer ${authToken}`)
      .query({ page: 1, limit: 10 });

    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('customers');
    expect(res.body.customers).toHaveLength(2);
    expect(res.body).toHaveProperty('pagination');
    expect(res.body.pagination).toMatchObject({
      total: 2,
      pages: 1,
      currentPage: 1,
      perPage: 10
    });
  });

  test('should get affiliate\'s orders', async () => {
    const Order = require('../../server/models/Order');
    await Order.create([
      {
        orderId: 'ORD001',
        customerId: 'CUST001',
        affiliateId: testAffiliate.affiliateId,
        pickupDate: new Date('2025-05-25'),
        pickupTime: 'morning',
        deliveryDate: new Date('2025-05-27'),
        deliveryTime: 'afternoon',
        status: 'delivered',
        estimatedSize: 'medium',
        actualWeight: 23.5,
        baseRate: 1.89,
        deliveryFee: 5.99,
        actualTotal: 50.40,
        affiliateCommission: 44.41
      },
      {
        orderId: 'ORD002',
        customerId: 'CUST002',
        affiliateId: testAffiliate.affiliateId,
        pickupDate: new Date('2025-05-26'),
        pickupTime: 'afternoon',
        deliveryDate: new Date('2025-05-28'),
        deliveryTime: 'morning',
        status: 'processing',
        estimatedSize: 'large',
        baseRate: 1.89,
        deliveryFee: 5.99
      }
    ]);

    const res = await request(app)
      .get(`/api/v1/affiliates/${testAffiliate.affiliateId}/orders`)
      .set('Authorization', `Bearer ${authToken}`)
      .query({ page: 1, limit: 10 });

    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('orders');
    expect(res.body.orders).toHaveLength(2);
    expect(res.body).toHaveProperty('pagination');
    expect(res.body).toHaveProperty('totalEarnings', 44.41);
  });

  test('should get affiliate\'s earnings/transactions', async () => {
    const Transaction = require('../../server/models/Transaction');
    await Transaction.create([
      {
        transactionId: 'TXN001',
        affiliateId: testAffiliate.affiliateId,
        orderId: 'ORD001',
        type: 'commission',
        amount: 44.41,
        description: 'Commission for order ORD001',
        status: 'pending'
      },
      {
        transactionId: 'TXN002',
        affiliateId: testAffiliate.affiliateId,
        type: 'payout',
        amount: -100.00,
        description: 'Weekly payout',
        status: 'completed',
        paymentMethod: 'directDeposit',
        paymentReference: 'REF123'
      }
    ]);

    const res = await request(app)
      .get(`/api/v1/affiliates/${testAffiliate.affiliateId}/transactions`)
      .set('Authorization', `Bearer ${authToken}`)
      .query({ page: 1, limit: 10 });

    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('transactions');
    expect(res.body.transactions).toHaveLength(2);
    expect(res.body).toHaveProperty('summary');
    expect(res.body.summary).toMatchObject({
      totalEarnings: 44.41,
      totalPayouts: 100.00,
      pendingAmount: 44.41,
      balance: -55.59
    });
  });

  test('should update payment information', async () => {
    const res = await request(app)
      .put(`/api/v1/affiliates/${testAffiliate.affiliateId}/payment`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        paymentMethod: 'check',
        bankAccountNumber: '123456789',
        bankRoutingNumber: '987654321',
        preferredPaymentDay: 'friday'
      });

    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('message', 'Payment information updated successfully');

    // Verify the update
    const updatedAffiliate = await Affiliate.findOne({ affiliateId: testAffiliate.affiliateId });
    expect(updatedAffiliate.paymentMethod).toBe('check');
    expect(updatedAffiliate.bankAccountNumber).toBe('123456789');
    expect(updatedAffiliate.bankRoutingNumber).toBe('987654321');
    expect(updatedAffiliate.preferredPaymentDay).toBe('friday');
  });

  test('should handle commission-related endpoints', async () => {
    // Test getting commission summary
    const res = await request(app)
      .get(`/api/v1/affiliates/${testAffiliate.affiliateId}/commission-summary`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('summary');
    expect(res.body.summary).toHaveProperty('currentMonth');
    expect(res.body.summary).toHaveProperty('lastMonth');
    expect(res.body.summary).toHaveProperty('yearToDate');
    expect(res.body.summary).toHaveProperty('lifetime');
    expect(res.body.summary).toHaveProperty('pendingPayouts');
  });
});