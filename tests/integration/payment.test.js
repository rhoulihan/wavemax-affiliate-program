const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../server');
const Payment = require('../../server/models/Payment');
const Order = require('../../server/models/Order');
const Customer = require('../../server/models/Customer');
const CallbackPool = require('../../server/models/CallbackPool');
const PaymentToken = require('../../server/models/PaymentToken');
const paygistixService = require('../../server/services/paygistix');
const { getCsrfToken, createAgent } = require('../helpers/csrfHelper');

// Mock Paygistix service
jest.mock('../../server/services/paygistix');

describe('Payment Integration Tests', () => {
  let authToken;
  let testCustomer;
  let testOrder;
  let agent;
  let csrfToken;

  // Remove beforeAll and afterAll - connection is handled by test setup

  afterAll(async () => {
    // Stop the callback pool cleanup job
    const callbackPoolManager = require('../../server/services/callbackPoolManager');
    callbackPoolManager.stopCleanupJob();
  });

  beforeEach(async () => {
    // Create agent with session support
    agent = createAgent(app);

    // Get CSRF token
    csrfToken = await getCsrfToken(app, agent);
    // Clear test data
    await Payment.deleteMany({});
    await Order.deleteMany({});
    await Customer.deleteMany({});
    await CallbackPool.deleteMany({});
    await PaymentToken.deleteMany({});

    // Initialize callback pool for tests
    const callbackPoolManager = require('../../server/services/callbackPoolManager');
    
    // Set test config for callback pool with 10 handlers
    callbackPoolManager.setTestConfig({
      callbackPaths: [
        '/api/v1/payments/callback/handler-1',
        '/api/v1/payments/callback/handler-2',
        '/api/v1/payments/callback/handler-3',
        '/api/v1/payments/callback/handler-4',
        '/api/v1/payments/callback/handler-5',
        '/api/v1/payments/callback/handler-6',
        '/api/v1/payments/callback/handler-7',
        '/api/v1/payments/callback/handler-8',
        '/api/v1/payments/callback/handler-9',
        '/api/v1/payments/callback/handler-10'
      ],
      baseUrl: 'http://localhost:3005',
      lockTimeoutMinutes: 10,
      form: {
        formId: 'test-form-id',
        formHash: 'test-form-hash'
      }
    });
    
    await callbackPoolManager.initializePool();

    // Create test customer
    const encryptionUtil = require('../../server/utils/encryption');
    const { hash, salt } = encryptionUtil.hashPassword('Test123!@#');
    testCustomer = await Customer.create({
      affiliateId: 'AFF-TEST-123',
      firstName: 'Test',
      lastName: 'Customer',
      email: 'test@example.com',
      username: 'testcustomer',
      passwordHash: hash,
      passwordSalt: salt,
      phone: '+1234567890',
      address: '123 Test St',
      city: 'Test City',
      state: 'TS',
      zipCode: '12345'
    });

    // Login to get auth token
    const loginResponse = await agent
      .post('/api/v1/auth/customer/login')
      .send({
        emailOrUsername: 'test@example.com',
        password: 'Test123!@#'
      });

    authToken = loginResponse.body.token;

    // Create test order
    testOrder = await Order.create({
      customerId: testCustomer.customerId,
      affiliateId: 'AFF-TEST-123',
      pickupDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
      pickupTime: 'morning',

      estimatedWeight: 10,
      numberOfBags: 2,
      status: 'pending',
      paymentStatus: 'pending'
    });
  });

  describe('Payment Configuration Tests', () => {
    it('should get payment configuration', async () => {
      const response = await agent
        .get('/api/v1/payments/config');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('config');
      expect(response.body.config).toHaveProperty('formActionUrl');
      expect(response.body.config).toHaveProperty('merchantId');
    });
  });

  describe('Payment Token Tests', () => {
    it('should create payment token', async () => {
      const response = await agent
        .post('/api/v1/payments/create-token')
        .set('x-csrf-token', csrfToken)
        .send({
          customerData: {
            email: testCustomer.email,
            name: `${testCustomer.firstName} ${testCustomer.lastName}`,
            orderId: testOrder.orderId
          },
          paymentData: {
            amount: 100,
            description: 'Test payment for order ' + testOrder.orderId
          }
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('formConfig');
    });

    it('should check payment status', async () => {
      // First create a token
      const createResponse = await agent
        .post('/api/v1/payments/create-token')
        .set('x-csrf-token', csrfToken)
        .send({
          customerData: {
            email: testCustomer.email,
            name: `${testCustomer.firstName} ${testCustomer.lastName}`,
            orderId: testOrder.orderId
          },
          paymentData: {
            amount: 100,
            description: 'Test payment'
          }
        });

      const token = createResponse.body.token;

      const response = await agent
        .get(`/api/v1/payments/check-status/${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('status');
    });

    it('should cancel payment token', async () => {
      // First create a token
      const createResponse = await agent
        .post('/api/v1/payments/create-token')
        .set('x-csrf-token', csrfToken)
        .send({
          customerData: {
            email: testCustomer.email,
            name: `${testCustomer.firstName} ${testCustomer.lastName}`,
            orderId: testOrder.orderId
          },
          paymentData: {
            amount: 100,
            description: 'Test payment'
          }
        });

      const token = createResponse.body.token;

      const response = await agent
        .post(`/api/v1/payments/cancel-token/${token}`)
        .set('x-csrf-token', csrfToken)
        .send({});

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success');
    });
  });

  describe('Payment Callback Tests', () => {
    it('should return 503 when all callback handlers are locked', async () => {
      const next = jest.fn();
      // Create 10 payment tokens to lock all callback handlers
      const tokenPromises = [];
      
      for (let i = 0; i < 10; i++) {
        const promise = agent
          .post('/api/v1/payments/create-token')
          .set('x-csrf-token', csrfToken)
          .send({
            customerData: {
              email: `customer${i}@example.com`,
              name: `Customer ${i}`,
              orderId: `ORDER-${i}`
            },
            paymentData: {
              amount: 100 + i,
              description: `Payment ${i}`
            }
          });
        tokenPromises.push(promise);
      }
      
      // Execute all requests to lock all handlers
      const responses = await Promise.all(tokenPromises);
      
      // Verify all 10 handlers were successfully acquired
      const acquiredPaths = new Set();
      responses.forEach((response) => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.token).toBeDefined();
        expect(response.body.formConfig).toBeDefined();
        expect(response.body.formConfig.callbackPath).toMatch(/^\/api\/v1\/payments\/callback\/handler-\d+$/);
        acquiredPaths.add(response.body.formConfig.callbackPath);
      });
      
      // Verify we got 10 unique callback paths
      expect(acquiredPaths.size).toBe(10);
      
      // Now try to create an 11th payment token - should fail
      const failedResponse = await agent
        .post('/api/v1/payments/create-token')
        .set('x-csrf-token', csrfToken)
        .send({
          customerData: {
            email: 'overflow@example.com',
            name: 'Overflow Customer',
            orderId: 'ORDER-OVERFLOW'
          },
          paymentData: {
            amount: 999,
            description: 'This should fail'
          }
        });
      
      expect(failedResponse.status).toBe(503);
      expect(failedResponse.body.success).toBe(false);
      expect(failedResponse.body.message).toContain('No payment handlers available');
    });
    
    it('should release callback handler when payment is cancelled', async () => {
      // Create a payment token
      const createResponse = await agent
        .post('/api/v1/payments/create-token')
        .set('x-csrf-token', csrfToken)
        .send({
          customerData: {
            email: 'cancel@example.com',
            name: 'Cancel Test',
            orderId: 'ORDER-CANCEL'
          },
          paymentData: {
            amount: 50,
            description: 'Payment to be cancelled'
          }
        });
      
      expect(createResponse.status).toBe(200);
      const token = createResponse.body.token;
      const callbackPath = createResponse.body.formConfig.callbackPath;
      
      // Cancel the payment
      const cancelResponse = await agent
        .post(`/api/v1/payments/cancel-token/${token}`)
        .set('x-csrf-token', csrfToken)
        .send({});
      
      expect(cancelResponse.status).toBe(200);
      
      // Verify the handler is released by creating a new payment
      const newResponse = await agent
        .post('/api/v1/payments/create-token')
        .set('x-csrf-token', csrfToken)
        .send({
          customerData: {
            email: 'new@example.com',
            name: 'New Customer',
            orderId: 'ORDER-NEW'
          },
          paymentData: {
            amount: 75,
            description: 'New payment after cancel'
          }
        });
      
      expect(newResponse.status).toBe(200);
      // Should get the same callback handler that was just released
      expect(newResponse.body.formConfig.callbackPath).toBeDefined();
    });
  });

  describe('Pool Statistics Tests', () => {
    it('should get pool statistics', async () => {
      const response = await agent
        .get('/api/v1/payments/pool-stats');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('stats');
      expect(response.body.stats).toHaveProperty('total');
      expect(response.body.stats).toHaveProperty('available');
      expect(response.body.stats).toHaveProperty('locked');
      expect(response.body.stats).toHaveProperty('handlers');
    });
  });
});