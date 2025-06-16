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
            deliveryDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
            deliveryTime: 'afternoon',
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
        it('should handle form callback', async () => {
            // This tests the dynamic callback handlers
            const response = await agent
                .get('/api/v1/payments/callback/handler-1')
                .query({
                    token: 'test-token',
                    status: 'success'
                });

            expect(response.status).toBe(302); // Expect redirect
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