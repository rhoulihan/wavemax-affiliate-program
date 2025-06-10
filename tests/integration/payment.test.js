const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../server');
const Payment = require('../../server/models/Payment');
const Order = require('../../server/models/Order');
const Customer = require('../../server/models/Customer');
const paygistixService = require('../../server/services/paygistixService');

// Mock Paygistix service
jest.mock('../../server/services/paygistixService');

describe('Payment Integration Tests', () => {
    let authToken;
    let testCustomer;
    let testOrder;

    beforeAll(async () => {
        // Connect to test database
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/wavemax-test', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
    });

    afterAll(async () => {
        await mongoose.connection.close();
    });

    beforeEach(async () => {
        // Clear test data
        await Payment.deleteMany({});
        await Order.deleteMany({});
        await Customer.deleteMany({});

        // Create test customer
        testCustomer = await Customer.create({
            name: 'Test Customer',
            email: 'test@example.com',
            password: 'Test123!@#',
            phone: '+1234567890',
            addresses: [{
                street: '123 Test St',
                city: 'Test City',
                state: 'TS',
                zipCode: '12345',
                isDefault: true
            }]
        });

        // Login to get auth token
        const loginResponse = await request(app)
            .post('/api/auth/login')
            .send({
                email: 'test@example.com',
                password: 'Test123!@#'
            });

        authToken = loginResponse.body.token;

        // Create test order
        testOrder = await Order.create({
            customerId: testCustomer._id,
            orderNumber: `ORD-${Date.now()}`,
            items: [{
                servicetype: 'wash-dry-fold',
                quantity: 10,
                pricePerUnit: 2.50,
                totalPrice: 25.00
            }],
            totalAmount: 25.00,
            serviceType: 'wash-dry-fold',
            status: 'pending',
            paymentStatus: 'pending'
        });
    });

    describe('POST /api/payments/payment-intent', () => {
        it('should create payment intent successfully', async () => {
            // Mock Paygistix response
            paygistixService.createPaymentIntent.mockResolvedValue({
                id: 'pi_test_123',
                clientSecret: 'pi_test_123_secret',
                amount: 2500,
                currency: 'USD'
            });

            const response = await request(app)
                .post('/api/payments/payment-intent')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    orderId: testOrder._id.toString()
                });

            expect(response.status).toBe(200);
            expect(response.body).toMatchObject({
                clientSecret: 'pi_test_123_secret',
                paymentIntentId: 'pi_test_123',
                amount: 2500,
                currency: 'USD'
            });

            // Verify payment record was created
            const payment = await Payment.findOne({ orderId: testOrder._id });
            expect(payment).toBeTruthy();
            expect(payment.paygistixTransactionId).toBe('pi_test_123');
            expect(payment.amount).toBe(2500);
            expect(payment.status).toBe('pending');
        });

        it('should reject invalid order ID', async () => {
            const response = await request(app)
                .post('/api/payments/payment-intent')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    orderId: 'invalid-id'
                });

            expect(response.status).toBe(400);
            expect(response.body.errors).toBeDefined();
        });

        it('should reject non-existent order', async () => {
            const fakeOrderId = new mongoose.Types.ObjectId();

            const response = await request(app)
                .post('/api/payments/payment-intent')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    orderId: fakeOrderId.toString()
                });

            expect(response.status).toBe(404);
            expect(response.body.error).toBe('Order not found');
        });

        it('should reject already paid order', async () => {
            // Update order to paid status
            testOrder.paymentStatus = 'paid';
            await testOrder.save();

            const response = await request(app)
                .post('/api/payments/payment-intent')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    orderId: testOrder._id.toString()
                });

            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Order already paid');
        });

        it('should handle Paygistix API errors', async () => {
            paygistixService.createPaymentIntent.mockRejectedValue({
                status: 503,
                message: 'Service temporarily unavailable'
            });

            const response = await request(app)
                .post('/api/payments/payment-intent')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    orderId: testOrder._id.toString()
                });

            expect(response.status).toBe(503);
            expect(response.body.error).toBe('Service temporarily unavailable');
        });
    });

    describe('POST /api/payments/process', () => {
        let testPayment;

        beforeEach(async () => {
            // Create test payment
            testPayment = await Payment.create({
                orderId: testOrder._id,
                customerId: testCustomer._id,
                paygistixTransactionId: 'pi_test_123',
                amount: 2500,
                currency: 'USD',
                status: 'pending',
                paymentMethod: {
                    type: 'card'
                }
            });
        });

        it('should process payment successfully', async () => {
            paygistixService.capturePayment.mockResolvedValue({
                status: 'succeeded',
                payment_method: {
                    last4: '4242',
                    brand: 'visa'
                }
            });

            const response = await request(app)
                .post('/api/payments/process')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    paymentIntentId: 'pi_test_123'
                });

            expect(response.status).toBe(200);
            expect(response.body).toMatchObject({
                status: 'completed',
                transactionId: 'pi_test_123',
                orderId: testOrder._id.toString()
            });

            // Verify payment was updated
            const updatedPayment = await Payment.findById(testPayment._id);
            expect(updatedPayment.status).toBe('completed');
            expect(updatedPayment.paymentMethod.last4).toBe('4242');
            expect(updatedPayment.paymentMethod.brand).toBe('visa');

            // Verify order was updated
            const updatedOrder = await Order.findById(testOrder._id);
            expect(updatedOrder.paymentStatus).toBe('paid');
            expect(updatedOrder.paidAt).toBeDefined();
        });

        it('should handle payment failure', async () => {
            paygistixService.capturePayment.mockResolvedValue({
                status: 'failed',
                error: {
                    message: 'Card declined'
                }
            });

            const response = await request(app)
                .post('/api/payments/process')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    paymentIntentId: 'pi_test_123'
                });

            expect(response.status).toBe(200);
            expect(response.body.status).toBe('failed');

            // Verify payment status
            const updatedPayment = await Payment.findById(testPayment._id);
            expect(updatedPayment.status).toBe('failed');

            // Verify order was not marked as paid
            const updatedOrder = await Order.findById(testOrder._id);
            expect(updatedOrder.paymentStatus).toBe('pending');
        });

        it('should reject non-existent payment', async () => {
            const response = await request(app)
                .post('/api/payments/process')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    paymentIntentId: 'non_existent'
                });

            expect(response.status).toBe(404);
            expect(response.body.error).toBe('Payment not found');
        });

        it('should reject already processed payment', async () => {
            testPayment.status = 'completed';
            await testPayment.save();

            const response = await request(app)
                .post('/api/payments/process')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    paymentIntentId: 'pi_test_123'
                });

            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Payment already processed');
        });
    });

    describe('POST /api/payments/:paymentId/refund', () => {
        let completedPayment;

        beforeEach(async () => {
            // Create completed payment
            completedPayment = await Payment.create({
                orderId: testOrder._id,
                customerId: testCustomer._id,
                paygistixTransactionId: 'pi_test_completed',
                amount: 2500,
                currency: 'USD',
                status: 'completed',
                paymentMethod: {
                    type: 'card',
                    last4: '4242',
                    brand: 'visa'
                },
                refunds: []
            });

            // Update order to paid
            testOrder.paymentStatus = 'paid';
            await testOrder.save();
        });

        it('should process full refund successfully', async () => {
            paygistixService.refundPayment.mockResolvedValue({
                id: 'ref_test_123',
                status: 'succeeded'
            });

            const response = await request(app)
                .post(`/api/payments/${completedPayment._id}/refund`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    reason: 'Customer requested refund'
                });

            expect(response.status).toBe(200);
            expect(response.body).toMatchObject({
                refundId: 'ref_test_123',
                amount: 2500,
                status: 'succeeded'
            });

            // Verify payment was updated
            const updatedPayment = await Payment.findById(completedPayment._id);
            expect(updatedPayment.status).toBe('refunded');
            expect(updatedPayment.refunds).toHaveLength(1);
            expect(updatedPayment.refunds[0]).toMatchObject({
                refundId: 'ref_test_123',
                amount: 2500,
                reason: 'Customer requested refund'
            });

            // Verify order was updated
            const updatedOrder = await Order.findById(testOrder._id);
            expect(updatedOrder.paymentStatus).toBe('refunded');
        });

        it('should process partial refund successfully', async () => {
            paygistixService.refundPayment.mockResolvedValue({
                id: 'ref_test_partial',
                status: 'succeeded'
            });

            const response = await request(app)
                .post(`/api/payments/${completedPayment._id}/refund`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    amount: 1000,
                    reason: 'Partial refund for damaged items'
                });

            expect(response.status).toBe(200);
            expect(response.body.amount).toBe(1000);

            // Verify payment status
            const updatedPayment = await Payment.findById(completedPayment._id);
            expect(updatedPayment.status).toBe('partially_refunded');

            // Verify order status
            const updatedOrder = await Order.findById(testOrder._id);
            expect(updatedOrder.paymentStatus).toBe('partially_refunded');
        });

        it('should reject refund exceeding payment amount', async () => {
            const response = await request(app)
                .post(`/api/payments/${completedPayment._id}/refund`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    amount: 5000,
                    reason: 'Refund'
                });

            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Refund amount exceeds payment amount');
        });

        it('should reject refund for non-completed payment', async () => {
            completedPayment.status = 'pending';
            await completedPayment.save();

            const response = await request(app)
                .post(`/api/payments/${completedPayment._id}/refund`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    reason: 'Refund'
                });

            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Can only refund completed payments');
        });

        it('should handle multiple partial refunds', async () => {
            // First refund
            completedPayment.refunds.push({
                refundId: 'ref_first',
                amount: 1000,
                reason: 'First refund',
                createdAt: new Date(),
                status: 'succeeded'
            });
            completedPayment.status = 'partially_refunded';
            await completedPayment.save();

            paygistixService.refundPayment.mockResolvedValue({
                id: 'ref_second',
                status: 'succeeded'
            });

            // Second refund
            const response = await request(app)
                .post(`/api/payments/${completedPayment._id}/refund`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    amount: 500,
                    reason: 'Second refund'
                });

            expect(response.status).toBe(200);

            const updatedPayment = await Payment.findById(completedPayment._id);
            expect(updatedPayment.refunds).toHaveLength(2);
            expect(updatedPayment.status).toBe('partially_refunded');

            // Try to refund more than remaining
            const response2 = await request(app)
                .post(`/api/payments/${completedPayment._id}/refund`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    amount: 1500,
                    reason: 'Excess refund'
                });

            expect(response2.status).toBe(400);
            expect(response2.body.error).toBe('Refund amount exceeds payment amount');
        });
    });

    describe('GET /api/payments/:paymentId', () => {
        it('should retrieve payment details', async () => {
            const payment = await Payment.create({
                orderId: testOrder._id,
                customerId: testCustomer._id,
                paygistixTransactionId: 'pi_test_get',
                amount: 2500,
                currency: 'USD',
                status: 'completed',
                paymentMethod: {
                    type: 'card',
                    last4: '4242',
                    brand: 'visa'
                }
            });

            const response = await request(app)
                .get(`/api/payments/${payment._id}`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body).toMatchObject({
                _id: payment._id.toString(),
                paygistixTransactionId: 'pi_test_get',
                amount: 2500,
                status: 'completed',
                orderId: expect.objectContaining({
                    _id: testOrder._id.toString(),
                    orderNumber: testOrder.orderNumber
                }),
                customerId: expect.objectContaining({
                    _id: testCustomer._id.toString(),
                    name: 'Test Customer',
                    email: 'test@example.com'
                })
            });
        });

        it('should return 404 for non-existent payment', async () => {
            const fakePaymentId = new mongoose.Types.ObjectId();

            const response = await request(app)
                .get(`/api/payments/${fakePaymentId}`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(404);
            expect(response.body.error).toBe('Payment not found');
        });
    });

    describe('GET /api/payments', () => {
        beforeEach(async () => {
            // Create multiple payments
            const payments = [];
            for (let i = 0; i < 25; i++) {
                const order = await Order.create({
                    customerId: testCustomer._id,
                    orderNumber: `ORD-TEST-${i}`,
                    totalAmount: 20 + i,
                    serviceType: 'wash-dry-fold',
                    status: 'pending',
                    paymentStatus: 'pending'
                });

                payments.push({
                    orderId: order._id,
                    customerId: testCustomer._id,
                    paygistixTransactionId: `pi_test_${i}`,
                    amount: (20 + i) * 100,
                    currency: 'USD',
                    status: i % 3 === 0 ? 'failed' : 'completed',
                    paymentMethod: {
                        type: 'card',
                        last4: '4242',
                        brand: 'visa'
                    },
                    createdAt: new Date(Date.now() - i * 24 * 60 * 60 * 1000)
                });
            }
            await Payment.insertMany(payments);
        });

        it('should list payments with pagination', async () => {
            const response = await request(app)
                .get('/api/payments')
                .set('Authorization', `Bearer ${authToken}`)
                .query({ page: 1, limit: 10 });

            expect(response.status).toBe(200);
            expect(response.body.payments).toHaveLength(10);
            expect(response.body.pagination).toMatchObject({
                total: 25,
                page: 1,
                pages: 3
            });
        });

        it('should filter payments by status', async () => {
            const response = await request(app)
                .get('/api/payments')
                .set('Authorization', `Bearer ${authToken}`)
                .query({ status: 'failed' });

            expect(response.status).toBe(200);
            response.body.payments.forEach(payment => {
                expect(payment.status).toBe('failed');
            });
        });

        it('should filter payments by customer', async () => {
            const response = await request(app)
                .get('/api/payments')
                .set('Authorization', `Bearer ${authToken}`)
                .query({ customerId: testCustomer._id.toString() });

            expect(response.status).toBe(200);
            response.body.payments.forEach(payment => {
                expect(payment.customerId._id).toBe(testCustomer._id.toString());
            });
        });

        it('should filter payments by date range', async () => {
            const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            const endDate = new Date();

            const response = await request(app)
                .get('/api/payments')
                .set('Authorization', `Bearer ${authToken}`)
                .query({
                    startDate: startDate.toISOString(),
                    endDate: endDate.toISOString()
                });

            expect(response.status).toBe(200);
            response.body.payments.forEach(payment => {
                const paymentDate = new Date(payment.createdAt);
                expect(paymentDate >= startDate).toBe(true);
                expect(paymentDate <= endDate).toBe(true);
            });
        });

        it('should sort payments by creation date descending', async () => {
            const response = await request(app)
                .get('/api/payments')
                .set('Authorization', `Bearer ${authToken}`)
                .query({ limit: 5 });

            expect(response.status).toBe(200);
            
            // Verify descending order
            for (let i = 1; i < response.body.payments.length; i++) {
                const prevDate = new Date(response.body.payments[i - 1].createdAt);
                const currDate = new Date(response.body.payments[i].createdAt);
                expect(prevDate >= currDate).toBe(true);
            }
        });
    });

    describe('Webhook handling', () => {
        it('should handle payment.succeeded webhook', async () => {
            const payment = await Payment.create({
                orderId: testOrder._id,
                customerId: testCustomer._id,
                paygistixTransactionId: 'pi_webhook_test',
                amount: 2500,
                currency: 'USD',
                status: 'processing',
                paymentMethod: { type: 'card' }
            });

            const webhookPayload = {
                event: 'payment.succeeded',
                data: {
                    paymentIntentId: 'pi_webhook_test',
                    payment_method: {
                        last4: '4242',
                        brand: 'visa'
                    }
                }
            };

            const payload = JSON.stringify(webhookPayload);
            const signature = require('crypto')
                .createHmac('sha256', process.env.PAYGISTIX_WEBHOOK_SECRET || 'test_webhook_secret')
                .update(payload)
                .digest('hex');

            paygistixService.verifyWebhookSignature.mockReturnValue(true);

            const response = await request(app)
                .post('/api/webhooks/paygistix')
                .set('X-Paygistix-Signature', signature)
                .send(webhookPayload);

            expect(response.status).toBe(200);
            expect(response.body).toEqual({ received: true });

            // Verify payment was updated
            const updatedPayment = await Payment.findById(payment._id);
            expect(updatedPayment.status).toBe('completed');
            expect(updatedPayment.webhookEvents).toHaveLength(1);
            expect(updatedPayment.webhookEvents[0]).toMatchObject({
                eventType: 'payment.succeeded',
                processed: true
            });

            // Verify order was updated
            const updatedOrder = await Order.findById(testOrder._id);
            expect(updatedOrder.paymentStatus).toBe('paid');
        });

        it('should reject webhook with invalid signature', async () => {
            const webhookPayload = {
                event: 'payment.succeeded',
                data: { paymentIntentId: 'pi_test' }
            };

            paygistixService.verifyWebhookSignature.mockReturnValue(false);

            const response = await request(app)
                .post('/api/webhooks/paygistix')
                .set('X-Paygistix-Signature', 'invalid_signature')
                .send(webhookPayload);

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Invalid signature');
        });
    });
});