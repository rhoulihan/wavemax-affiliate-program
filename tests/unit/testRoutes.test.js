const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const testRoutes = require('../../server/routes/testRoutes');
const Customer = require('../../server/models/Customer');
const Order = require('../../server/models/Order');
const Affiliate = require('../../server/models/Affiliate');

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
        lastName: 'Customer'
      };
      
      Customer.findOne.mockResolvedValue(mockCustomer);
      
      const response = await request(app)
        .get('/api/test/customer');
      
      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockCustomer);
      expect(Customer.findOne).toHaveBeenCalledWith({ email: 'spam-me@wavemax.promo' });
    });

    it('should return 404 when test customer not found', async () => {
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
        lastName: 'Customer'
      };
      
      Customer.findOne.mockResolvedValue(mockCustomer);
      
      const response = await request(app)
        .post('/api/test/customer')
        .send({});
      
      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockCustomer);
      expect(Customer.prototype.save).not.toHaveBeenCalled();
    });

    it('should create new customer and affiliate if not exists', async () => {
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
      Customer.findOne.mockResolvedValue(null);
      
      const mockAffiliate = {
        _id: 'affiliateId',
        affiliateId: 'AFF123'
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
      };
      
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
        affiliateId: 'AFF123'
      };
      
      Customer.findById.mockResolvedValue(null);
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
        affiliateId: 'AFF123'
      };
      
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
        orderId: { $regex: /^TEST-/ }
      });
    });

    it('should return 400 when customer not found', async () => {
      Customer.findById.mockResolvedValue(null);
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
      expect(Order.deleteMany).toHaveBeenCalledWith({ orderId: { $regex: /^TEST-/ } });
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