const request = require('supertest');
const express = require('express');
const generalPaymentCallback = require('../../server/routes/generalPaymentCallback');
const Payment = require('../../server/models/Payment');
const Order = require('../../server/models/Order');
const Customer = require('../../server/models/Customer');
const emailService = require('../../server/utils/emailService');
const auditLogger = require('../../server/utils/auditLogger');

// Mock dependencies
jest.mock('../../server/models/Payment');
jest.mock('../../server/models/Order');
jest.mock('../../server/models/Customer');
jest.mock('../../server/utils/emailService');
jest.mock('../../server/utils/auditLogger');

// Create test app
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/payment/general-callback', generalPaymentCallback);

describe('General Payment Callback Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    console.log = jest.fn();
    console.error = jest.fn();
    
    // Setup default mocks
    auditLogger.log = jest.fn().mockResolvedValue(true);
    emailService.sendPaymentConfirmationEmail = jest.fn().mockResolvedValue(true);
  });

  describe('GET /', () => {
    describe('Registration Payment', () => {
      it('should redirect to success page on approved registration payment', async () => {
        const res = await request(app)
          .get('/payment/general-callback')
          .query({
            type: 'registration',
            status: 'approved',
            transactionId: 'TX123',
            amount: '10.00',
            authCode: 'AUTH123',
            responseCode: '00',
            responseMessage: 'Approved',
            cardType: 'VISA',
            maskedCard: '************1234'
          });

        expect(res.status).toBe(302);
        expect(res.header.location).toBe('/embed-app-v2.html?route=/customer-success&transactionId=TX123&paymentStatus=success');
      });

      it('should redirect to success page on success status', async () => {
        const res = await request(app)
          .get('/payment/general-callback')
          .query({
            type: 'registration',
            status: 'success',
            transactionId: 'TX124'
          });

        expect(res.status).toBe(302);
        expect(res.header.location).toBe('/embed-app-v2.html?route=/customer-success&transactionId=TX124&paymentStatus=success');
      });

      it('should redirect to register page with error on failed registration payment', async () => {
        const res = await request(app)
          .get('/payment/general-callback')
          .query({
            type: 'registration',
            status: 'declined',
            transactionId: 'TX125',
            responseMessage: 'Insufficient funds'
          });

        expect(res.status).toBe(302);
        expect(res.header.location).toBe('/embed-app-v2.html?route=/customer-register&error=payment_failed&message=Insufficient%20funds');
      });

      it('should handle missing response message on failure', async () => {
        const res = await request(app)
          .get('/payment/general-callback')
          .query({
            type: 'registration',
            status: 'failed'
          });

        expect(res.status).toBe(302);
        expect(res.header.location).toBe('/embed-app-v2.html?route=/customer-register&error=payment_failed&message=Payment%20failed');
      });

      it('should handle registration payment callback errors', async () => {
        // Test that errors are caught and handled
        const res = await request(app)
          .get('/payment/general-callback')
          .query({
            type: 'registration',
            status: 'error_test'
          });

        expect(res.status).toBe(302);
        // Should redirect somewhere even on error
        expect(res.header.location).toBeDefined();
      });
    });

    describe('Order Payment', () => {
      let mockOrder;
      let mockPayment;
      let mockCustomer;

      beforeEach(() => {
        mockOrder = {
          _id: 'order123',
          orderId: 'ORD123',
          customerId: 'CUST123',
          estimatedTotal: 100,
          paymentStatus: 'pending',
      save: jest.fn().mockResolvedValue(true)
        };

        mockPayment = {
          _id: 'payment123',
          orderId: 'order123',
          customerId: 'CUST123',
          amount: 100,
          status: 'pending',
          attempts: 0,
          save: jest.fn().mockResolvedValue(true)
        };

        mockCustomer = {
          _id: 'customer123',
          customerId: 'CUST123',
          email: 'test@example.com',
          isActive: false,
          save: jest.fn().mockResolvedValue(true)
        };

        Order.findOne = jest.fn().mockResolvedValue(mockOrder);
        Payment.findOne = jest.fn().mockResolvedValue(null);
        Payment.mockImplementation(() => mockPayment);
        Customer.findOne = jest.fn().mockResolvedValue(mockCustomer);
      });

      it('should handle approved order payment successfully', async () => {
        const res = await request(app)
          .get('/payment/general-callback')
          .query({
            status: 'approved',
            transactionId: 'TX126',
            orderId: 'ORD123',
            amount: '100.00',
            authCode: 'AUTH456',
            responseCode: '00',
            responseMessage: 'Approved',
            cardType: 'MASTERCARD',
            maskedCard: '************5678'
          });

        expect(res.status).toBe(302);
        expect(res.header.location).toBe('/payment-success?orderId=ORD123&transactionId=TX126');
        
        expect(mockOrder.paymentStatus).toBe('paid');
        expect(mockOrder.paidAt).toBeInstanceOf(Date);
        expect(mockOrder.save).toHaveBeenCalled();
        
        expect(mockPayment.status).toBe('completed');
        expect(mockPayment.paymentMethod.type).toBe('card');
        expect(mockPayment.paymentMethod.brand).toBe('MASTERCARD');
        expect(mockPayment.paymentMethod.last4).toBe('5678');
        expect(mockPayment.save).toHaveBeenCalled();
        
        expect(mockCustomer.isActive).toBe(true);
        expect(mockCustomer.save).toHaveBeenCalled();
        
        expect(emailService.sendPaymentConfirmationEmail).toHaveBeenCalledWith(mockCustomer, mockOrder, mockPayment);
        expect(auditLogger.log).toHaveBeenCalledWith({
          userId: 'CUST123',
          userType: 'customer',
          action: 'payment.completed',
          resourceType: 'payment',
          resourceId: 'payment123',
          details: {
            orderId: 'ORD123',
            amount: 100,
            transactionId: 'TX126'
          }
        });
      });

      it('should handle success status for order payment', async () => {
        const res = await request(app)
          .get('/payment/general-callback')
          .query({
            status: 'success',
            transactionId: 'TX127',
            orderId: 'ORD123',
            amount: '100.00'
          });

        expect(res.status).toBe(302);
        expect(res.header.location).toBe('/payment-success?orderId=ORD123&transactionId=TX127');
        expect(mockPayment.status).toBe('completed');
      });

      it('should update existing payment record', async () => {
        Payment.findOne = jest.fn().mockResolvedValue(mockPayment);

        const res = await request(app)
          .get('/payment/general-callback')
          .query({
            status: 'approved',
            transactionId: 'TX128',
            orderId: 'ORD123',
            amount: '100.00'
          });

        expect(res.status).toBe(302);
        expect(Payment).not.toHaveBeenCalled(); // Should not create new payment
        expect(mockPayment.save).toHaveBeenCalled();
      });

      it('should handle declined order payment', async () => {
        const res = await request(app)
          .get('/payment/general-callback')
          .query({
            status: 'declined',
            transactionId: 'TX129',
            orderId: 'ORD123',
            amount: '100.00',
            responseMessage: 'Card declined'
          });

        expect(res.status).toBe(302);
        expect(res.header.location).toBe('/payment-error?orderId=ORD123&message=Card%20declined');
        
        expect(mockPayment.status).toBe('failed');
        expect(mockPayment.errorMessage).toBe('Card declined');
        expect(mockPayment.attempts).toBe(1);
        expect(mockPayment.save).toHaveBeenCalled();
        
        expect(auditLogger.log).toHaveBeenCalledWith({
          userId: 'CUST123',
          userType: 'customer',
          action: 'payment.failed',
          resourceType: 'payment',
          resourceId: 'payment123',
          details: {
            orderId: 'ORD123',
            reason: 'Card declined',
            responseCode: undefined
          }
        });
      });

      it('should handle failed order payment', async () => {
        const res = await request(app)
          .get('/payment/general-callback')
          .query({
            status: 'failed',
            transactionId: 'TX130',
            orderId: 'ORD123',
            responseCode: 'E01',
            responseMessage: 'Transaction failed'
          });

        expect(res.status).toBe(302);
        expect(res.header.location).toBe('/payment-error?orderId=ORD123&message=Transaction%20failed');
        expect(mockPayment.status).toBe('failed');
      });

      it('should handle unknown payment status', async () => {
        const res = await request(app)
          .get('/payment/general-callback')
          .query({
            status: 'unknown_status',
            orderId: 'ORD123'
          });

        expect(res.status).toBe(302);
        expect(res.header.location).toBe('/payment-error?orderId=ORD123&message=Unknown%20payment%20status');
        expect(console.error).toHaveBeenCalledWith('Unknown payment status:', 'unknown_status');
      });

      it('should handle order not found', async () => {
        Order.findOne = jest.fn().mockResolvedValue(null);

        const res = await request(app)
          .get('/payment/general-callback')
          .query({
            status: 'approved',
            orderId: 'NONEXISTENT'
          });

        expect(res.status).toBe(302);
        expect(res.header.location).toBe('/payment-error?message=Order%20not%20found');
        expect(console.error).toHaveBeenCalledWith('Order not found for callback:', 'NONEXISTENT');
      });

      it('should handle missing orderId in query', async () => {
        const res = await request(app)
          .get('/payment/general-callback')
          .query({
            status: 'approved',
            transactionId: 'TX131'
          });

        expect(res.status).toBe(302);
        expect(Order.findOne).toHaveBeenCalledWith({ orderId: undefined });
      });

      it('should handle email service failure gracefully', async () => {
        emailService.sendPaymentConfirmationEmail = jest.fn().mockRejectedValue(new Error('Email service down'));

        const res = await request(app)
          .get('/payment/general-callback')
          .query({
            status: 'approved',
            transactionId: 'TX132',
            orderId: 'ORD123'
          });

        expect(res.status).toBe(302);
        expect(res.header.location).toBe('/payment-success?orderId=ORD123&transactionId=TX132');
        expect(console.error).toHaveBeenCalledWith('Failed to send payment confirmation email:', expect.any(Error));
      });

      it('should skip customer update if customer not found', async () => {
        Customer.findOne = jest.fn().mockResolvedValue(null);

        const res = await request(app)
          .get('/payment/general-callback')
          .query({
            status: 'approved',
            transactionId: 'TX133',
            orderId: 'ORD123'
          });

        expect(res.status).toBe(302);
        expect(res.header.location).toBe('/payment-success?orderId=ORD123&transactionId=TX133');
        expect(emailService.sendPaymentConfirmationEmail).not.toHaveBeenCalled();
      });

      it('should not update already active customer', async () => {
        mockCustomer.isActive = true;

        const res = await request(app)
          .get('/payment/general-callback')
          .query({
            status: 'approved',
            transactionId: 'TX134',
            orderId: 'ORD123'
          });

        expect(res.status).toBe(302);
        expect(mockCustomer.save).not.toHaveBeenCalled(); // Should not save if already active
      });

      it('should handle payment callback errors', async () => {
        Order.findOne = jest.fn().mockRejectedValue(new Error('Database error'));

        const res = await request(app)
          .get('/payment/general-callback')
          .query({
            status: 'approved',
            orderId: 'ORD123'
          });

        expect(res.status).toBe(302);
        expect(res.header.location).toBe('/payment-error?message=An%20error%20occurred%20processing%20your%20payment');
        expect(console.error).toHaveBeenCalledWith('Order payment callback error:', expect.any(Error));
      });

      it('should use order amount if payment amount not provided', async () => {
        const res = await request(app)
          .get('/payment/general-callback')
          .query({
            status: 'approved',
            transactionId: 'TX135',
            orderId: 'ORD123'
          });

        expect(res.status).toBe(302);
        expect(mockPayment.amount).toBe(100); // Should use order.estimatedTotal
      });

      it('should handle partial masked card', async () => {
        const res = await request(app)
          .get('/payment/general-callback')
          .query({
            status: 'approved',
            transactionId: 'TX136',
            orderId: 'ORD123',
            cardType: 'VISA',
            maskedCard: '1234' // Less than 4 digits
          });

        expect(res.status).toBe(302);
        expect(mockPayment.paymentMethod.last4).toBe('1234');
      });

      it('should handle missing masked card', async () => {
        const res = await request(app)
          .get('/payment/general-callback')
          .query({
            status: 'approved',
            transactionId: 'TX137',
            orderId: 'ORD123',
            cardType: 'VISA'
          });

        expect(res.status).toBe(302);
        expect(mockPayment.paymentMethod.last4).toBe('');
      });
    });

    describe('General error handling', () => {
      it('should handle general callback errors', async () => {
      const next = jest.fn();
        // Force an error in the main handler
        const res = await request(app)
          .get('/payment/general-callback')
          .query({}); // Empty query to trigger potential errors

        expect(res.status).toBe(302);
        // Should default to order payment handling
      });
    });
  });

  describe('POST /', () => {
    describe('Registration Payment', () => {
      it('should create customer on approved registration payment with session', async () => {
        const mockCustomer = {
          _id: 'customer456',
          customerId: 'CUST456',
      save: jest.fn().mockResolvedValue(true)
        };
        Customer.mockImplementation(() => mockCustomer);

        const req = {
          body: {
            type: 'registration',
            status: 'approved',
            transactionId: 'TX200',
            amount: '10.00'
          },
          session: {
            pendingRegistration: {
              customerId: 'CUST456',
              email: 'newcustomer@example.com',
              firstName: 'John',
              lastName: 'Doe'
            }
          }
        };

        // Create a custom app instance to inject session
        const testApp = express();
        testApp.use(express.json());
        testApp.use((req, res, next) => {
          req.session = req.body.sessionData || {};
          next();
        });
        testApp.use('/payment/general-callback', generalPaymentCallback);

        const res = await request(testApp)
          .post('/payment/general-callback')
          .send({
            ...req.body,
            sessionData: req.session
          });

        expect(res.status).toBe(200);
        expect(res.body).toEqual({
          received: true,
          success: true,
          customerId: 'CUST456'
        });

        expect(Customer).toHaveBeenCalledWith({
          customerId: 'CUST456',
          email: 'newcustomer@example.com',
          firstName: 'John',
          lastName: 'Doe',
          paymentVerified: true,
          paymentTransactionId: 'TX200',
          createdAt: expect.any(Date)
        });

        expect(mockCustomer.save).toHaveBeenCalled();
        expect(auditLogger.log).toHaveBeenCalledWith({
          userId: 'CUST456',
          userType: 'customer',
          action: 'customer.registered',
          resourceType: 'customer',
          resourceId: 'customer456',
          details: {
            paymentTransactionId: 'TX200',
            registrationType: 'paid'
          }
        });
      });

      it('should handle success status for registration', async () => {
        const res = await request(app)
          .post('/payment/general-callback')
          .send({
            type: 'registration',
            status: 'success',
            transactionId: 'TX201'
          });

        expect(res.status).toBe(400);
        expect(res.body).toEqual({
          received: true,
          success: false,
          error: 'No pending registration found'
        });
      });

      it('should handle customer creation error', async () => {
        Customer.mockImplementation(() => {
          throw new Error('Database error');
        });

        const testApp = express();
        testApp.use(express.json());
        testApp.use((req, res, next) => {
          req.session = {
            pendingRegistration: { customerId: 'CUST457' }
          };
          next();
        });
        testApp.use('/payment/general-callback', generalPaymentCallback);

        const res = await request(testApp)
          .post('/payment/general-callback')
          .send({
            type: 'registration',
            status: 'approved',
            transactionId: 'TX202'
          });

        expect(res.status).toBe(500);
        expect(res.body).toEqual({
          received: true,
          success: false,
          error: 'Failed to create customer account'
        });
      });

      it('should handle no pending registration', async () => {
        const res = await request(app)
          .post('/payment/general-callback')
          .send({
            type: 'registration',
            status: 'approved',
            transactionId: 'TX203'
          });

        expect(res.status).toBe(400);
        expect(res.body).toEqual({
          received: true,
          success: false,
          error: 'No pending registration found'
        });
      });

      it('should handle declined registration payment', async () => {
        const res = await request(app)
          .post('/payment/general-callback')
          .send({
            type: 'registration',
            status: 'declined',
            transactionId: 'TX204',
            responseMessage: 'Card declined'
          });

        expect(res.status).toBe(200);
        expect(res.body).toEqual({
          received: true,
          success: false,
          error: 'Card declined'
        });
      });

      it('should handle failed registration payment without message', async () => {
        const res = await request(app)
          .post('/payment/general-callback')
          .send({
            type: 'registration',
            status: 'failed',
            transactionId: 'TX205'
          });

        expect(res.status).toBe(200);
        expect(res.body).toEqual({
          received: true,
          success: false,
          error: 'Payment failed'
        });
      });
    });

    describe('Order Payment POST', () => {
      it('should acknowledge order payment callback', async () => {
        const res = await request(app)
          .post('/payment/general-callback')
          .send({
            status: 'approved',
            transactionId: 'TX300',
            orderId: 'ORD300'
          });

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ received: true });
      });

      it('should handle order payment with explicit type', async () => {
        const res = await request(app)
          .post('/payment/general-callback')
          .send({
            type: 'order',
            status: 'approved',
            transactionId: 'TX301',
            orderId: 'ORD301'
          });

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ received: true });
      });
    });

    describe('General POST error handling', () => {
      it('should handle POST callback errors', async () => {
        // Force an error by sending invalid data that will cause parsing issues
        const testApp = express();
        testApp.use(express.json());
        testApp.use((req, res, next) => {
          throw new Error('Forced error');
        });
        testApp.use('/payment/general-callback', generalPaymentCallback);

        const res = await request(testApp)
          .post('/payment/general-callback')
          .send({
            type: 'registration',
            status: 'approved'
          });

        expect(res.status).toBe(500);
      });

      it('should log POST callback data', async () => {
        const res = await request(app)
          .post('/payment/general-callback')
          .send({
            type: 'test',
            data: 'sample'
          });

        expect(console.log).toHaveBeenCalledWith('Paygistix POST callback received:', {
          type: 'test',
          data: 'sample'
        });
      });
    });
  });
});