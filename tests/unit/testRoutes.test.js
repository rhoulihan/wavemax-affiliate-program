const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const testRoutes = require('../../server/routes/testRoutes');
const Customer = require('../../server/models/Customer');
const Order = require('../../server/models/Order');
const Affiliate = require('../../server/models/Affiliate');
const { expectSuccessResponse, expectErrorResponse } = require('../helpers/responseHelpers');
const { createFindOneMock, createFindMock, createMockDocument, createAggregateMock } = require('../helpers/mockHelpers');

// Create Express app for testing
const app = express();
app.use(express.json());
app.use('/api/test', testRoutes);

// Mock the models
jest.mock('../../server/models/Customer');
jest.mock('../../server/models/Order');
jest.mock('../../server/models/Affiliate');

describe('Test Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NODE_ENV = 'test'; // Ensure test routes are accessible
  });

  describe('testOnlyMiddleware', () => {
    it('should allow access in test environment', async () => {
      process.env.NODE_ENV = 'test';
      Customer.findOne = createFindOneMock(null);
      Customer.findOne.mockResolvedValue(null);
      
      const response = await request(app)
        .get('/api/test/customer');
      
      // Should return 404 for customer not found, not from middleware
      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Test customer not found' });
    });

    it('should block access in production without ENABLE_TEST_ROUTES', async () => {
      process.env.NODE_ENV = 'production';
      delete process.env.ENABLE_TEST_ROUTES;
      
      const response = await request(app)
        .get('/api/test/customer');
      
      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Not found' });
    });

    it('should allow access in production with ENABLE_TEST_ROUTES', async () => {
      process.env.NODE_ENV = 'production';
      process.env.ENABLE_TEST_ROUTES = 'true';
      Customer.findOne = createFindOneMock(null);
      Customer.findOne.mockResolvedValue(null);
      
      const response = await request(app)
        .get('/api/test/customer');
      
      // Should return 404 for customer not found, not from middleware
      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Test customer not found' });
      
      delete process.env.ENABLE_TEST_ROUTES;
    });
  });

  describe('GET /api/test/customer', () => {
    it('should return existing test customer', async () => {
      const mockCustomer = {
        _id: 'customerId',
        email: 'spam-me@wavemax.promo',
        firstName: 'Test',
        lastName: 'Customer',
        save: jest.fn().mockResolvedValue(true)
      };
      
      Customer.findOne = createFindOneMock(mockCustomer);
      Customer.findOne.mockResolvedValue(mockCustomer);
      
      const response = await request(app)
        .get('/api/test/customer');
      
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        _id: 'customerId',
        email: 'spam-me@wavemax.promo',
        firstName: 'Test',
        lastName: 'Customer'
      });
      expect(Customer.findOne).toHaveBeenCalledWith({ email: 'spam-me@wavemax.promo' });
    });

    it('should return 404 when test customer not found', async () => {
      Customer.findOne = createFindOneMock(null);
      Customer.findOne.mockResolvedValue(null);
      
      const response = await request(app)
        .get('/api/test/customer');
      
      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Test customer not found' });
    });

    it('should handle database errors', async () => {
      Customer.findOne.mockRejectedValue(new Error('Database error'));
      
      const response = await request(app)
        .get('/api/test/customer');
      
      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Failed to fetch test customer' });
    });
  });

  describe('POST /api/test/customer', () => {
    it('should return existing customer if already exists', async () => {
      const mockCustomer = {
        _id: 'customerId',
        email: 'test.customer@wavemax.test',
        firstName: 'Test',
        lastName: 'Customer',
        username: 'testuser',
        passwordSalt: '053006d409478489684709794546f604',
        passwordHash: '329faa1f67bfa85af7481e230f8455b497e3fbf27557af91de5e550822bfd267d56ef7c852114cb783f551fb489ff40afd8173a1bf4aba293acafab25b1cf00d',
        save: jest.fn().mockResolvedValue(true)
      };

      Customer.findOne = createFindOneMock(mockCustomer);
      Customer.findOne.mockResolvedValue(mockCustomer);

      const response = await request(app)
        .post('/api/test/customer')
        .send({});

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        _id: 'customerId',
        email: 'test.customer@wavemax.test',
        firstName: 'Test',
        lastName: 'Customer',
        username: 'testuser'
      });
      // Save should be called to update password
      expect(mockCustomer.save).toHaveBeenCalled();
    });

    it('should create new customer and affiliate if not exists', async () => {
      Customer.findOne = createFindOneMock(null);
      Customer.findOne.mockResolvedValue(null);
      Affiliate.findOne.mockResolvedValue(null);
      
      const mockAffiliate = {
        _id: 'affiliateId',
        affiliateId: 'AFF123',
        save: jest.fn().mockResolvedValue(true)
      };
      
      const mockCustomer = {
        _id: 'customerId',
        email: 'test.customer@wavemax.test',
        save: jest.fn().mockResolvedValue(true)
      };
      
      Affiliate.mockImplementation(() => mockAffiliate);
      Customer.mockImplementation(() => mockCustomer);
      
      const response = await request(app)
        .post('/api/test/customer')
        .send({
          firstName: 'Custom',
          lastName: 'Name',
          phone: '512-555-9999'
        });
      
      expect(response.status).toBe(200);
      expect(mockAffiliate.save).toHaveBeenCalled();
      expect(mockCustomer.save).toHaveBeenCalled();
    });

    it('should use existing affiliate if already exists', async () => {
      Customer.findOne = createFindOneMock(null);
      Customer.findOne.mockResolvedValue(null);
      
      const mockAffiliate = {
        _id: 'affiliateId',
        affiliateId: 'AFF123',
        save: jest.fn().mockResolvedValue(true)
      };
      
      Affiliate.findOne.mockResolvedValue(mockAffiliate);
      
      const mockCustomer = {
        _id: 'customerId',
        email: 'test.customer@wavemax.test',
      save: jest.fn().mockResolvedValue(true)
      };
      
      Customer.mockImplementation(() => mockCustomer);
      
      const response = await request(app)
        .post('/api/test/customer')
        .send({});
      
      expect(response.status).toBe(200);
      expect(Affiliate.prototype.save).not.toHaveBeenCalled();
      expect(mockCustomer.save).toHaveBeenCalled();
    });

    it('should handle database errors', async () => {
      Customer.findOne.mockRejectedValue(new Error('Database error'));
      
      const response = await request(app)
        .post('/api/test/customer')
        .send({});
      
      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Failed to create test customer' });
    });
  });

  describe('POST /api/test/order', () => {
    it('should create order for specified customer', async () => {
      const mockCustomer = {
        _id: new mongoose.Types.ObjectId(),
        customerId: 'CUST123',
        affiliateId: 'AFF123'
,
      save: jest.fn().mockResolvedValue(true)};
      
      Customer.findById.mockResolvedValue(mockCustomer);
      
      const mockOrder = {
        save: jest.fn().mockResolvedValue(true),
        orderId: 'TEST-123'
      };
      
      Order.mockImplementation(() => mockOrder);
      
      const response = await request(app)
        .post('/api/test/order')
        .send({ customerId: mockCustomer._id });
      
      expect(response.status).toBe(200);
      expect(Customer.findById).toHaveBeenCalledWith(mockCustomer._id.toString());
      expect(mockOrder.save).toHaveBeenCalled();
    });

    it('should find test customer by email if customerId not provided', async () => {
      const mockCustomer = {
        _id: 'customerId',
        customerId: 'CUST123',
        affiliateId: 'AFF123',
        save: jest.fn().mockResolvedValue(true)
      };
      
      Customer.findById.mockResolvedValue(null);
      Customer.findOne = createFindOneMock(mockCustomer);
      Customer.findOne.mockResolvedValue(mockCustomer);
      
      const mockOrder = {
        save: jest.fn().mockResolvedValue(true),
        orderId: 'TEST-123'
      };
      
      Order.mockImplementation(() => mockOrder);
      
      const response = await request(app)
        .post('/api/test/order')
        .send({});
      
      expect(response.status).toBe(200);
      expect(Customer.findOne).toHaveBeenCalledWith({ email: 'spam-me@wavemax.promo' });
      expect(mockOrder.save).toHaveBeenCalled();
    });

    it('should delete existing test orders when recreate is true', async () => {
      const mockCustomer = {
        _id: 'customerId',
        customerId: 'CUST123',
        affiliateId: 'AFF123',
        save: jest.fn().mockResolvedValue(true)
      };
      
      Customer.findOne = createFindOneMock(mockCustomer);
      Customer.findOne.mockResolvedValue(mockCustomer);
      Order.deleteMany.mockResolvedValue({ deletedCount: 2 });
      
      const mockOrder = {
        save: jest.fn().mockResolvedValue(true),
        orderId: 'TEST-123'
      };
      
      Order.mockImplementation(() => mockOrder);
      
      const response = await request(app)
        .post('/api/test/order')
        .send({ recreate: true });
      
      expect(response.status).toBe(200);
      expect(Order.deleteMany).toHaveBeenCalledWith({
        customerId: 'CUST123',
        isTestOrder: true
      });
    });

    it('should return 400 when customer not found', async () => {
      Customer.findById.mockResolvedValue(null);
      Customer.findOne = createFindOneMock(null);
      Customer.findOne.mockResolvedValue(null);
      
      const response = await request(app)
        .post('/api/test/order')
        .send({ customerId: 'invalid' });
      
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Test customer not found' });
    });

    it('should handle database errors', async () => {
      Customer.findOne.mockRejectedValue(new Error('Database error'));
      
      const response = await request(app)
        .post('/api/test/order')
        .send({});
      
      expect(response.status).toBe(500);
      expect(response.body.error).toContain('Failed to create test order');
    });
  });

  describe('GET /api/test/order/:orderId', () => {
    it('should return order by orderId', async () => {
      const mockOrder = {
        _id: 'mongoId123',
        orderId: 'ORD-123',
        customerId: 'CUST-123',
        status: 'pending'
      };

      Order.findOne = createFindOneMock(mockOrder);
      Order.findOne.mockResolvedValue(mockOrder);

      const response = await request(app)
        .get('/api/test/order/ORD-123');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockOrder);
      expect(Order.findOne).toHaveBeenCalledWith({
        $or: [
          { _id: 'ORD-123' },
          { orderId: 'ORD-123' }
        ]
      });
    });

    it('should return 404 when order not found', async () => {
      Order.findOne = createFindOneMock(null);
      Order.findOne.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/test/order/INVALID-ID');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Order not found' });
    });

    it('should handle database errors', async () => {
      Order.findOne.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/test/order/ORD-123');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Failed to fetch test order' });
    });
  });

  describe('POST /api/test/send-payment-email', () => {
    let emailService;

    beforeEach(() => {
      // Mock emailService
      emailService = require('../../server/utils/emailService');
      emailService.sendEmail = jest.fn().mockResolvedValue(true);
    });

    it('should send payment email successfully', async () => {
      const emailData = {
        to: 'test@example.com',
        subject: 'Payment Request',
        html: '<p>Please pay $50.00</p>',
        orderId: 'ORD-123'
      };

      const response = await request(app)
        .post('/api/test/send-payment-email')
        .send(emailData);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        message: 'Test payment email sent successfully',
        orderId: 'ORD-123'
      });
      expect(emailService.sendEmail).toHaveBeenCalledWith(
        'test@example.com',
        'Payment Request',
        '<p>Please pay $50.00</p>'
      );
    });

    it('should return 400 when missing required fields', async () => {
      const response = await request(app)
        .post('/api/test/send-payment-email')
        .send({ to: 'test@example.com' }); // Missing subject and html

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Missing required fields: to, subject, html' });
    });

    it('should handle email sending errors', async () => {
      emailService.sendEmail.mockRejectedValue(new Error('SMTP error'));

      const response = await request(app)
        .post('/api/test/send-payment-email')
        .send({
          to: 'test@example.com',
          subject: 'Test',
          html: '<p>Test</p>'
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toContain('Failed to send test payment email');
    });
  });

  describe('POST /api/test/order/advance-stage', () => {
    let emailService;

    beforeEach(() => {
      // Mock emailService
      emailService = require('../../server/utils/emailService');
      emailService.sendV2PaymentRequest = jest.fn().mockResolvedValue(true);
    });

    it('should advance order to processing stage (weigh action)', async () => {
      const mockOrder = {
        _id: 'mongoId123',
        orderId: 'ORD-123',
        customerId: 'CUST-123',
        numberOfBags: 2,
        bags: [],
        status: 'pending',
        isV2Order: true,
        baseRate: 1.25,
        save: jest.fn().mockResolvedValue(true)
      };

      Order.findOne = createFindOneMock(mockOrder);
      Order.findOne.mockResolvedValue(mockOrder);

      const response = await request(app)
        .post('/api/test/order/advance-stage')
        .send({
          orderId: 'ORD-123',
          currentStage: 'pending',
          nextStage: 'processing',
          action: 'weigh',
          weights: [15, 20],
          actualWeight: 35
        });

      expect(response.status).toBe(200);
      expect(mockOrder.status).toBe('processing');
      expect(mockOrder.bags).toHaveLength(2);
      expect(mockOrder.save).toHaveBeenCalled();
    });

    it('should send V2 payment request email when weighing all bags', async () => {
      const mockCustomer = {
        _id: 'customerId123',
        customerId: 'CUST-123',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'Customer'
      };

      const mockOrder = {
        _id: 'mongoId123',
        orderId: 'ORD-123',
        customerId: 'CUST-123',
        numberOfBags: 2,
        bags: [],
        bagsWeighed: 0,
        status: 'pending',
        isV2Order: true,
        baseRate: 1.25,
        actualWeight: 0,
        feeBreakdown: { totalFee: 10 },
        addOns: { fabricSoftener: true },
        save: jest.fn().mockResolvedValue(true)
      };

      // Mock the save function to update bagsWeighed
      mockOrder.save.mockImplementation(async function() {
        this.bagsWeighed = this.numberOfBags;
        this.v2PaymentAmount = 45.50;
        return true;
      }.bind(mockOrder));

      Order.findOne = createFindOneMock(mockOrder);
      Order.findOne.mockResolvedValue(mockOrder);
      Customer.findOne = createFindOneMock(mockCustomer);
      Customer.findOne.mockResolvedValue(mockCustomer);

      const response = await request(app)
        .post('/api/test/order/advance-stage')
        .send({
          orderId: 'ORD-123',
          action: 'weigh',
          weights: [15, 20],
          actualWeight: 35
        });

      expect(response.status).toBe(200);
      expect(mockOrder.status).toBe('processing');
      expect(emailService.sendV2PaymentRequest).toHaveBeenCalled();
      expect(mockOrder.v2PaymentLinks).toBeDefined();
      expect(mockOrder.v2PaymentQRCodes).toBeDefined();
    });

    it('should advance order to processed stage (process action)', async () => {
      const mockOrder = {
        _id: 'mongoId123',
        orderId: 'ORD-123',
        numberOfBags: 2,
        bags: [
          { bagId: 'BAG-1', status: 'processing', scannedAt: {} },
          { bagId: 'BAG-2', status: 'processing', scannedAt: {} }
        ],
        status: 'processing',
        save: jest.fn().mockResolvedValue(true)
      };

      Order.findOne = createFindOneMock(mockOrder);
      Order.findOne.mockResolvedValue(mockOrder);

      const response = await request(app)
        .post('/api/test/order/advance-stage')
        .send({
          orderId: 'ORD-123',
          action: 'process'
        });

      expect(response.status).toBe(200);
      expect(mockOrder.status).toBe('processed');
      expect(mockOrder.bags[0].status).toBe('processed');
      expect(mockOrder.save).toHaveBeenCalled();
    });

    it('should advance order to complete stage (pickup action)', async () => {
      const mockOrder = {
        _id: 'mongoId123',
        orderId: 'ORD-123',
        numberOfBags: 2,
        bags: [
          { bagId: 'BAG-1', status: 'processed', scannedAt: {} },
          { bagId: 'BAG-2', status: 'processed', scannedAt: {} }
        ],
        status: 'processed',
        isV2Order: true,
        save: jest.fn().mockResolvedValue(true)
      };

      Order.findOne = createFindOneMock(mockOrder);
      Order.findOne.mockResolvedValue(mockOrder);

      const response = await request(app)
        .post('/api/test/order/advance-stage')
        .send({
          orderId: 'ORD-123',
          action: 'pickup'
        });

      expect(response.status).toBe(200);
      expect(mockOrder.status).toBe('complete');
      expect(mockOrder.v2PaymentStatus).toBe('verified');
      expect(mockOrder.bags[0].status).toBe('completed');
      expect(mockOrder.save).toHaveBeenCalled();
    });

    it('should return 404 when order not found', async () => {
      Order.findOne = createFindOneMock(null);
      Order.findOne.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/test/order/advance-stage')
        .send({
          orderId: 'INVALID-ID',
          action: 'weigh'
        });

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Order not found' });
    });

    it('should return 400 for invalid action', async () => {
      const mockOrder = {
        _id: 'mongoId123',
        orderId: 'ORD-123',
        save: jest.fn().mockResolvedValue(true)
      };

      Order.findOne = createFindOneMock(mockOrder);
      Order.findOne.mockResolvedValue(mockOrder);

      const response = await request(app)
        .post('/api/test/order/advance-stage')
        .send({
          orderId: 'ORD-123',
          action: 'invalid-action'
        });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Invalid action' });
    });

    it('should handle database errors', async () => {
      Order.findOne.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/api/test/order/advance-stage')
        .send({
          orderId: 'ORD-123',
          action: 'weigh'
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toContain('Failed to advance order stage');
    });
  });

  describe('DELETE /api/test/cleanup', () => {
    it('should delete all test data', async () => {
      Customer.find.mockResolvedValue([]);
      Order.deleteMany.mockResolvedValue({ deletedCount: 5 });
      Customer.deleteMany.mockResolvedValue({ deletedCount: 1 });
      Affiliate.deleteMany.mockResolvedValue({ deletedCount: 1 });

      const response = await request(app)
        .delete('/api/test/cleanup');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: 'Test data cleaned up successfully' });
      expect(Order.deleteMany).toHaveBeenCalledWith({ isTestOrder: true });
      expect(Customer.deleteMany).toHaveBeenCalledWith({
        email: { $in: ['spam-me@wavemax.promo', 'test.customer@wavemax.test', 'test.affiliate@wavemax.test'] }
      });
    });

    it('should handle database errors during cleanup', async () => {
      Order.deleteMany.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .delete('/api/test/cleanup');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Failed to cleanup test data' });
    });
  });
});