const paymentController = require('../../server/controllers/paymentController');
const Payment = require('../../server/models/Payment');
const Order = require('../../server/models/Order');
const paygistixService = require('../../server/services/paygistixService');
const { validationResult } = require('express-validator');

// Mock dependencies
jest.mock('../../server/models/Payment');
jest.mock('../../server/models/Order');
jest.mock('../../server/services/paygistixService');
jest.mock('express-validator');

describe('Payment Controller', () => {
    let req, res;

    beforeEach(() => {
        req = {
            body: {},
            params: {},
            query: {},
            user: { id: 'user123' }
        };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
            send: jest.fn()
        };
        jest.clearAllMocks();
    });

    describe('createPaymentIntent', () => {
        it('should create payment intent successfully', async () => {
            // Setup
            const mockOrder = {
                _id: 'order123',
                orderNumber: 'ORD-2024-001',
                totalAmount: 25.00,
                paymentStatus: 'pending',
                serviceType: 'wash-dry-fold',
                customerId: {
                    _id: 'customer123',
                    email: 'customer@example.com'
                }
            };

            const mockPaymentIntent = {
                id: 'pi_test_123',
                clientSecret: 'pi_test_123_secret',
                amount: 2500,
                currency: 'USD'
            };

            req.body = { orderId: 'order123' };
            validationResult.mockReturnValue({ isEmpty: () => true });
            Order.findById.mockReturnValue({
                populate: jest.fn().mockResolvedValue(mockOrder)
            });
            paygistixService.createPaymentIntent.mockResolvedValue(mockPaymentIntent);
            Payment.prototype.save = jest.fn().mockResolvedValue({});

            // Execute
            await paymentController.createPaymentIntent(req, res);

            // Assert
            expect(Order.findById).toHaveBeenCalledWith('order123');
            expect(paygistixService.createPaymentIntent).toHaveBeenCalledWith({
                amount: 2500,
                currency: 'USD',
                customerId: 'customer123',
                orderId: 'order123',
                description: 'Order #ORD-2024-001',
                metadata: {
                    orderNumber: 'ORD-2024-001',
                    customerEmail: 'customer@example.com',
                    servicetype: 'wash-dry-fold'
                }
            });
            expect(res.json).toHaveBeenCalledWith({
                clientSecret: 'pi_test_123_secret',
                paymentIntentId: 'pi_test_123',
                amount: 2500,
                currency: 'USD'
            });
        });

        it('should return validation errors', async () => {
            validationResult.mockReturnValue({
                isEmpty: () => false,
                array: () => [{ msg: 'Invalid order ID', param: 'orderId' }]
            });

            await paymentController.createPaymentIntent(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                errors: [{ msg: 'Invalid order ID', param: 'orderId' }]
            });
        });

        it('should handle order not found', async () => {
            req.body = { orderId: 'nonexistent' };
            validationResult.mockReturnValue({ isEmpty: () => true });
            Order.findById.mockReturnValue({
                populate: jest.fn().mockResolvedValue(null)
            });

            await paymentController.createPaymentIntent(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith({
                error: 'Order not found'
            });
        });

        it('should handle already paid order', async () => {
            const mockOrder = {
                _id: 'order123',
                paymentStatus: 'paid'
            };

            req.body = { orderId: 'order123' };
            validationResult.mockReturnValue({ isEmpty: () => true });
            Order.findById.mockReturnValue({
                populate: jest.fn().mockResolvedValue(mockOrder)
            });

            await paymentController.createPaymentIntent(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                error: 'Order already paid'
            });
        });

        it('should handle Paygistix API errors', async () => {
            const mockOrder = {
                _id: 'order123',
                totalAmount: 25.00,
                paymentStatus: 'pending',
                customerId: { _id: 'customer123' }
            };

            req.body = { orderId: 'order123' };
            validationResult.mockReturnValue({ isEmpty: () => true });
            Order.findById.mockReturnValue({
                populate: jest.fn().mockResolvedValue(mockOrder)
            });
            
            const error = new Error('Payment service unavailable');
            error.status = 503;
            paygistixService.createPaymentIntent.mockRejectedValue(error);

            await paymentController.createPaymentIntent(req, res);

            expect(res.status).toHaveBeenCalledWith(503);
            expect(res.json).toHaveBeenCalledWith({
                error: 'Payment service unavailable'
            });
        });
    });

    describe('processPayment', () => {
        it('should process payment successfully', async () => {
            const mockPayment = {
                _id: 'payment123',
                orderId: 'order123',
                paygistixTransactionId: 'pi_test_123',
                status: 'pending',
                save: jest.fn()
            };

            const mockCaptureResult = {
                status: 'succeeded',
                payment_method: {
                    last4: '4242',
                    brand: 'visa'
                }
            };

            req.body = {
                paymentIntentId: 'pi_test_123',
                paymentMethodId: 'pm_test_123'
            };

            Payment.findOne.mockResolvedValue(mockPayment);
            paygistixService.capturePayment.mockResolvedValue(mockCaptureResult);
            Order.findByIdAndUpdate.mockResolvedValue({});

            await paymentController.processPayment(req, res);

            expect(Payment.findOne).toHaveBeenCalledWith({
                paygistixTransactionId: 'pi_test_123'
            });
            expect(mockPayment.status).toBe('completed');
            expect(mockPayment.paymentMethod.last4).toBe('4242');
            expect(mockPayment.paymentMethod.brand).toBe('visa');
            expect(mockPayment.save).toHaveBeenCalled();
            expect(Order.findByIdAndUpdate).toHaveBeenCalledWith('order123', {
                paymentStatus: 'paid',
                paidAt: expect.any(Date)
            });
            expect(res.json).toHaveBeenCalledWith({
                status: 'completed',
                transactionId: 'pi_test_123',
                orderId: 'order123'
            });
        });

        it('should handle payment not found', async () => {
            req.body = { paymentIntentId: 'nonexistent' };
            Payment.findOne.mockResolvedValue(null);

            await paymentController.processPayment(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith({
                error: 'Payment not found'
            });
        });

        it('should handle already processed payment', async () => {
            const mockPayment = {
                status: 'completed'
            };

            req.body = { paymentIntentId: 'pi_test_123' };
            Payment.findOne.mockResolvedValue(mockPayment);

            await paymentController.processPayment(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                error: 'Payment already processed'
            });
        });

        it('should handle failed payment capture', async () => {
            const mockPayment = {
                _id: 'payment123',
                status: 'pending',
                save: jest.fn()
            };

            const mockCaptureResult = {
                status: 'failed',
                error: { message: 'Insufficient funds' }
            };

            req.body = { paymentIntentId: 'pi_test_123' };
            Payment.findOne.mockResolvedValue(mockPayment);
            paygistixService.capturePayment.mockResolvedValue(mockCaptureResult);

            await paymentController.processPayment(req, res);

            expect(mockPayment.status).toBe('failed');
            expect(mockPayment.save).toHaveBeenCalled();
            expect(Order.findByIdAndUpdate).not.toHaveBeenCalled();
        });
    });

    describe('refundPayment', () => {
        it('should process full refund successfully', async () => {
            const mockPayment = {
                _id: 'payment123',
                orderId: 'order123',
                paygistixTransactionId: 'pi_test_123',
                amount: 2500,
                status: 'completed',
                refunds: [],
                save: jest.fn()
            };

            const mockRefund = {
                id: 'ref_test_123',
                status: 'succeeded'
            };

            req.params = { paymentId: 'payment123' };
            req.body = { reason: 'Customer requested refund' };

            Payment.findById.mockResolvedValue(mockPayment);
            paygistixService.refundPayment.mockResolvedValue(mockRefund);
            Order.findByIdAndUpdate.mockResolvedValue({});

            await paymentController.refundPayment(req, res);

            expect(paygistixService.refundPayment).toHaveBeenCalledWith(
                'pi_test_123',
                2500,
                'Customer requested refund'
            );
            expect(mockPayment.refunds).toHaveLength(1);
            expect(mockPayment.status).toBe('refunded');
            expect(mockPayment.save).toHaveBeenCalled();
            expect(Order.findByIdAndUpdate).toHaveBeenCalledWith('order123', {
                paymentStatus: 'refunded'
            });
            expect(res.json).toHaveBeenCalledWith({
                refundId: 'ref_test_123',
                amount: 2500,
                status: 'succeeded'
            });
        });

        it('should process partial refund successfully', async () => {
            const mockPayment = {
                _id: 'payment123',
                orderId: 'order123',
                paygistixTransactionId: 'pi_test_123',
                amount: 2500,
                status: 'completed',
                refunds: [],
                save: jest.fn()
            };

            req.params = { paymentId: 'payment123' };
            req.body = { amount: 1000, reason: 'Partial refund' };

            Payment.findById.mockResolvedValue(mockPayment);
            paygistixService.refundPayment.mockResolvedValue({
                id: 'ref_test_123',
                status: 'succeeded'
            });

            await paymentController.refundPayment(req, res);

            expect(mockPayment.status).toBe('partially_refunded');
            expect(Order.findByIdAndUpdate).toHaveBeenCalledWith('order123', {
                paymentStatus: 'partially_refunded'
            });
        });

        it('should prevent refund exceeding payment amount', async () => {
            const mockPayment = {
                amount: 2500,
                status: 'completed',
                refunds: [{ amount: 1500, status: 'succeeded' }]
            };

            req.params = { paymentId: 'payment123' };
            req.body = { amount: 1500, reason: 'Refund' };

            Payment.findById.mockResolvedValue(mockPayment);

            await paymentController.refundPayment(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                error: 'Refund amount exceeds payment amount'
            });
        });

        it('should handle payment not found', async () => {
            req.params = { paymentId: 'nonexistent' };
            req.body = { reason: 'Refund' };
            Payment.findById.mockResolvedValue(null);

            await paymentController.refundPayment(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith({
                error: 'Payment not found'
            });
        });

        it('should only allow refunds for completed payments', async () => {
            const mockPayment = {
                status: 'pending'
            };

            req.params = { paymentId: 'payment123' };
            req.body = { reason: 'Refund' };
            Payment.findById.mockResolvedValue(mockPayment);

            await paymentController.refundPayment(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                error: 'Can only refund completed payments'
            });
        });
    });

    describe('getPayment', () => {
        it('should retrieve payment details successfully', async () => {
            const mockPayment = {
                _id: 'payment123',
                orderId: { _id: 'order123', orderNumber: 'ORD-2024-001' },
                customerId: { _id: 'customer123', name: 'John Doe', email: 'john@example.com' },
                amount: 2500,
                status: 'completed'
            };

            req.params = { paymentId: 'payment123' };
            Payment.findById.mockReturnValue({
                populate: jest.fn().mockReturnValue({
                    populate: jest.fn().mockResolvedValue(mockPayment)
                })
            });

            await paymentController.getPayment(req, res);

            expect(Payment.findById).toHaveBeenCalledWith('payment123');
            expect(res.json).toHaveBeenCalledWith(mockPayment);
        });

        it('should handle payment not found', async () => {
            req.params = { paymentId: 'nonexistent' };
            Payment.findById.mockReturnValue({
                populate: jest.fn().mockReturnValue({
                    populate: jest.fn().mockResolvedValue(null)
                })
            });

            await paymentController.getPayment(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith({
                error: 'Payment not found'
            });
        });
    });

    describe('listPayments', () => {
        it('should list payments with pagination', async () => {
            const mockPayments = [
                {
                    _id: 'payment1',
                    amount: 2500,
                    status: 'completed',
                    orderId: { orderNumber: 'ORD-001' },
                    customerId: { name: 'John Doe', email: 'john@example.com' }
                },
                {
                    _id: 'payment2',
                    amount: 3500,
                    status: 'completed',
                    orderId: { orderNumber: 'ORD-002' },
                    customerId: { name: 'Jane Doe', email: 'jane@example.com' }
                }
            ];

            req.query = { page: 1, limit: 20, status: 'completed' };
            
            Payment.find.mockReturnValue({
                populate: jest.fn().mockReturnValue({
                    populate: jest.fn().mockReturnValue({
                        sort: jest.fn().mockReturnValue({
                            skip: jest.fn().mockReturnValue({
                                limit: jest.fn().mockResolvedValue(mockPayments)
                            })
                        })
                    })
                })
            });
            
            Payment.countDocuments.mockResolvedValue(50);

            await paymentController.listPayments(req, res);

            expect(Payment.find).toHaveBeenCalledWith({ status: 'completed' });
            expect(Payment.countDocuments).toHaveBeenCalledWith({ status: 'completed' });
            expect(res.json).toHaveBeenCalledWith({
                payments: mockPayments,
                pagination: {
                    total: 50,
                    page: 1,
                    pages: 3
                }
            });
        });

        it('should filter by date range', async () => {
            req.query = {
                startDate: '2024-01-01',
                endDate: '2024-01-31'
            };

            Payment.find.mockReturnValue({
                populate: jest.fn().mockReturnValue({
                    populate: jest.fn().mockReturnValue({
                        sort: jest.fn().mockReturnValue({
                            skip: jest.fn().mockReturnValue({
                                limit: jest.fn().mockResolvedValue([])
                            })
                        })
                    })
                })
            });
            Payment.countDocuments.mockResolvedValue(0);

            await paymentController.listPayments(req, res);

            expect(Payment.find).toHaveBeenCalledWith({
                createdAt: {
                    $gte: new Date('2024-01-01'),
                    $lte: new Date('2024-01-31')
                }
            });
        });

        it('should handle empty results', async () => {
            req.query = {};
            
            Payment.find.mockReturnValue({
                populate: jest.fn().mockReturnValue({
                    populate: jest.fn().mockReturnValue({
                        sort: jest.fn().mockReturnValue({
                            skip: jest.fn().mockReturnValue({
                                limit: jest.fn().mockResolvedValue([])
                            })
                        })
                    })
                })
            });
            Payment.countDocuments.mockResolvedValue(0);

            await paymentController.listPayments(req, res);

            expect(res.json).toHaveBeenCalledWith({
                payments: [],
                pagination: {
                    total: 0,
                    page: 1,
                    pages: 0
                }
            });
        });
    });
});