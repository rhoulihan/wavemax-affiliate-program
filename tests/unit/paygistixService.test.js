const axios = require('axios');
const crypto = require('crypto');
const paygistixService = require('../../server/services/paygistixService');

// Mock dependencies
jest.mock('axios');

describe('PaygistixService', () => {
    const originalEnv = process.env;

    beforeAll(() => {
        process.env = {
            ...originalEnv,
            PAYGISTIX_API_URL: 'https://sandbox.paygistix.com/v1',
            PAYGISTIX_MERCHANT_ID: 'test_merchant_123',
            PAYGISTIX_API_KEY: 'test_api_key',
            PAYGISTIX_API_SECRET: 'test_api_secret',
            PAYGISTIX_WEBHOOK_SECRET: 'test_webhook_secret',
            PAYMENT_TIMEOUT: '30000'
        };
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    beforeEach(() => {
        jest.clearAllMocks();
        axios.create.mockReturnValue({
            post: jest.fn(),
            get: jest.fn(),
            interceptors: {
                request: { use: jest.fn() }
            }
        });
    });

    describe('constructor', () => {
        it('should initialize with correct configuration', () => {
            expect(axios.create).toHaveBeenCalledWith({
                baseURL: 'https://sandbox.paygistix.com/v1',
                timeout: 30000,
                headers: {
                    'Content-Type': 'application/json',
                    'X-Merchant-ID': 'test_merchant_123'
                }
            });
        });
    });

    describe('generateSignature', () => {
        it('should generate correct HMAC signature', () => {
            const method = 'POST';
            const path = '/payment-intents';
            const timestamp = '1234567890';
            const body = { amount: 1000, currency: 'USD' };

            const signature = paygistixService.generateSignature(method, path, timestamp, body);

            // Verify signature format (64 character hex string)
            expect(signature).toMatch(/^[a-f0-9]{64}$/);

            // Verify signature is deterministic
            const signature2 = paygistixService.generateSignature(method, path, timestamp, body);
            expect(signature).toBe(signature2);
        });

        it('should handle empty body', () => {
            const signature = paygistixService.generateSignature('GET', '/payments', '1234567890', null);
            expect(signature).toMatch(/^[a-f0-9]{64}$/);
        });

        it('should generate different signatures for different inputs', () => {
            const sig1 = paygistixService.generateSignature('POST', '/payments', '1234567890', { amount: 1000 });
            const sig2 = paygistixService.generateSignature('POST', '/payments', '1234567890', { amount: 2000 });
            const sig3 = paygistixService.generateSignature('GET', '/payments', '1234567890', { amount: 1000 });
            
            expect(sig1).not.toBe(sig2);
            expect(sig1).not.toBe(sig3);
            expect(sig2).not.toBe(sig3);
        });
    });

    describe('addAuthHeaders', () => {
        it('should add authentication headers to request', () => {
            const config = {
                method: 'post',
                url: '/payment-intents',
                data: { amount: 1000 },
                headers: {}
            };

            // Mock Date.now()
            const mockTimestamp = 1234567890123;
            jest.spyOn(Date, 'now').mockReturnValue(mockTimestamp);

            const result = paygistixService.addAuthHeaders(config);

            expect(result.headers['X-Api-Key']).toBe('test_api_key');
            expect(result.headers['X-Timestamp']).toBe('1234567890123');
            expect(result.headers['X-Signature']).toMatch(/^[a-f0-9]{64}$/);

            Date.now.mockRestore();
        });
    });

    describe('createPaymentIntent', () => {
        it('should create payment intent successfully', async () => {
            const mockResponse = {
                data: {
                    id: 'pi_test_123',
                    clientSecret: 'pi_test_123_secret',
                    amount: 2500,
                    currency: 'USD',
                    status: 'requires_payment_method'
                }
            };

            paygistixService.client.post = jest.fn().mockResolvedValue(mockResponse);

            const data = {
                amount: 2500,
                currency: 'USD',
                customerId: 'customer123',
                orderId: 'order123',
                description: 'Order #ORD-001',
                metadata: { orderNumber: 'ORD-001' }
            };

            const result = await paygistixService.createPaymentIntent(data);

            expect(paygistixService.client.post).toHaveBeenCalledWith('/payment-intents', {
                amount: 2500,
                currency: 'USD',
                customerId: 'customer123',
                orderId: 'order123',
                description: 'Order #ORD-001',
                metadata: { orderNumber: 'ORD-001' }
            });
            expect(result).toEqual(mockResponse.data);
        });

        it('should handle API errors', async () => {
            const mockError = {
                response: {
                    status: 400,
                    data: {
                        error: {
                            code: 'invalid_request',
                            message: 'Amount must be greater than 0'
                        }
                    }
                }
            };

            paygistixService.client.post = jest.fn().mockRejectedValue(mockError);

            await expect(
                paygistixService.createPaymentIntent({ amount: 0 })
            ).rejects.toMatchObject({
                message: 'Amount must be greater than 0',
                status: 400,
                code: 'invalid_request'
            });
        });

        it('should handle network errors', async () => {
            const mockError = {
                request: {},
                message: 'Network Error'
            };

            paygistixService.client.post = jest.fn().mockRejectedValue(mockError);

            await expect(
                paygistixService.createPaymentIntent({ amount: 1000 })
            ).rejects.toMatchObject({
                message: 'Payment service unavailable',
                status: 503
            });
        });
    });

    describe('capturePayment', () => {
        it('should capture payment successfully', async () => {
            const mockResponse = {
                data: {
                    id: 'pi_test_123',
                    status: 'succeeded',
                    amount: 2500,
                    payment_method: {
                        type: 'card',
                        last4: '4242',
                        brand: 'visa'
                    }
                }
            };

            paygistixService.client.post = jest.fn().mockResolvedValue(mockResponse);

            const result = await paygistixService.capturePayment('pi_test_123');

            expect(paygistixService.client.post).toHaveBeenCalledWith(
                '/payment-intents/pi_test_123/capture'
            );
            expect(result).toEqual(mockResponse.data);
        });

        it('should handle capture errors', async () => {
            const mockError = {
                response: {
                    status: 402,
                    data: {
                        error: {
                            code: 'card_declined',
                            message: 'Your card was declined'
                        }
                    }
                }
            };

            paygistixService.client.post = jest.fn().mockRejectedValue(mockError);

            await expect(
                paygistixService.capturePayment('pi_test_123')
            ).rejects.toMatchObject({
                message: 'Your card was declined',
                status: 402,
                code: 'card_declined'
            });
        });
    });

    describe('refundPayment', () => {
        it('should process refund successfully', async () => {
            const mockResponse = {
                data: {
                    id: 'ref_test_123',
                    amount: 1000,
                    status: 'succeeded',
                    reason: 'Customer requested'
                }
            };

            paygistixService.client.post = jest.fn().mockResolvedValue(mockResponse);

            const result = await paygistixService.refundPayment('pi_test_123', 1000, 'Customer requested');

            expect(paygistixService.client.post).toHaveBeenCalledWith('/refunds', {
                transactionId: 'pi_test_123',
                amount: 1000,
                reason: 'Customer requested'
            });
            expect(result).toEqual(mockResponse.data);
        });

        it('should handle refund errors', async () => {
            const mockError = {
                response: {
                    status: 400,
                    data: {
                        error: {
                            code: 'invalid_refund_amount',
                            message: 'Refund amount exceeds charge amount'
                        }
                    }
                }
            };

            paygistixService.client.post = jest.fn().mockRejectedValue(mockError);

            await expect(
                paygistixService.refundPayment('pi_test_123', 5000, 'Refund')
            ).rejects.toMatchObject({
                message: 'Refund amount exceeds charge amount',
                status: 400,
                code: 'invalid_refund_amount'
            });
        });
    });

    describe('tokenizeCard', () => {
        it('should tokenize card successfully', async () => {
            const mockResponse = {
                data: {
                    id: 'tok_test_123',
                    type: 'card',
                    card: {
                        last4: '4242',
                        brand: 'visa',
                        exp_month: 12,
                        exp_year: 2025
                    }
                }
            };

            paygistixService.client.post = jest.fn().mockResolvedValue(mockResponse);

            const cardData = {
                number: '4242424242424242',
                expMonth: 12,
                expYear: 2025,
                cvc: '123'
            };

            const result = await paygistixService.tokenizeCard(cardData);

            expect(paygistixService.client.post).toHaveBeenCalledWith('/tokens', {
                type: 'card',
                card: {
                    number: '4242424242424242',
                    exp_month: 12,
                    exp_year: 2025,
                    cvc: '123'
                }
            });
            expect(result).toEqual(mockResponse.data);
        });

        it('should handle invalid card data', async () => {
            const mockError = {
                response: {
                    status: 400,
                    data: {
                        error: {
                            code: 'invalid_card_number',
                            message: 'The card number is not a valid credit card number'
                        }
                    }
                }
            };

            paygistixService.client.post = jest.fn().mockRejectedValue(mockError);

            await expect(
                paygistixService.tokenizeCard({ number: '1234' })
            ).rejects.toMatchObject({
                message: 'The card number is not a valid credit card number',
                status: 400,
                code: 'invalid_card_number'
            });
        });
    });

    describe('chargeWithToken', () => {
        it('should charge with token successfully', async () => {
            const mockResponse = {
                data: {
                    id: 'ch_test_123',
                    amount: 2500,
                    currency: 'USD',
                    status: 'succeeded',
                    source: 'tok_test_123'
                }
            };

            paygistixService.client.post = jest.fn().mockResolvedValue(mockResponse);

            const result = await paygistixService.chargeWithToken('tok_test_123', 2500, 'customer123');

            expect(paygistixService.client.post).toHaveBeenCalledWith('/charges', {
                amount: 2500,
                currency: 'USD',
                source: 'tok_test_123',
                customerId: 'customer123'
            });
            expect(result).toEqual(mockResponse.data);
        });
    });

    describe('verifyWebhookSignature', () => {
        it('should verify valid webhook signature', () => {
            const payload = JSON.stringify({
                event: 'payment.succeeded',
                data: { paymentIntentId: 'pi_test_123' }
            });

            // Generate a valid signature
            const validSignature = crypto
                .createHmac('sha256', 'test_webhook_secret')
                .update(payload)
                .digest('hex');

            const result = paygistixService.verifyWebhookSignature(payload, validSignature);
            expect(result).toBe(true);
        });

        it('should reject invalid webhook signature', () => {
            const payload = JSON.stringify({
                event: 'payment.succeeded',
                data: { paymentIntentId: 'pi_test_123' }
            });

            const invalidSignature = 'invalid_signature_123';

            const result = paygistixService.verifyWebhookSignature(payload, invalidSignature);
            expect(result).toBe(false);
        });

        it('should reject tampered payload', () => {
            const originalPayload = JSON.stringify({
                event: 'payment.succeeded',
                data: { paymentIntentId: 'pi_test_123' }
            });

            const signature = crypto
                .createHmac('sha256', 'test_webhook_secret')
                .update(originalPayload)
                .digest('hex');

            // Tamper with the payload
            const tamperedPayload = JSON.stringify({
                event: 'payment.succeeded',
                data: { paymentIntentId: 'pi_test_456' }
            });

            const result = paygistixService.verifyWebhookSignature(tamperedPayload, signature);
            expect(result).toBe(false);
        });
    });

    describe('handleApiError', () => {
        it('should format API errors correctly', () => {
            const error = {
                response: {
                    status: 400,
                    data: {
                        error: {
                            code: 'invalid_request',
                            message: 'Invalid request parameters'
                        }
                    }
                }
            };

            expect(() => paygistixService.handleApiError(error)).toThrowError({
                message: 'Invalid request parameters',
                status: 400,
                code: 'invalid_request'
            });
        });

        it('should handle missing error details', () => {
            const error = {
                response: {
                    status: 500,
                    data: {}
                }
            };

            expect(() => paygistixService.handleApiError(error)).toThrowError({
                message: 'Payment processing failed',
                status: 500
            });
        });

        it('should handle network errors', () => {
            const error = {
                request: {},
                message: 'Network timeout'
            };

            expect(() => paygistixService.handleApiError(error)).toThrowError({
                message: 'Payment service unavailable',
                status: 503
            });
        });

        it('should rethrow unexpected errors', () => {
            const error = new Error('Unexpected error');

            expect(() => paygistixService.handleApiError(error)).toThrow('Unexpected error');
        });
    });
});