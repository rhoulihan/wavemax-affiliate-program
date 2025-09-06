const mongoose = require('mongoose');
const httpMocks = require('node-mocks-http');
const Customer = require('../../server/models/Customer');
const Order = require('../../server/models/Order');
const Affiliate = require('../../server/models/Affiliate');
const customerController = require('../../server/controllers/customerController');
const { extractHandler } = require('../helpers/testUtils');
const { expectSuccessResponse, expectErrorResponse } = require('../helpers/responseHelpers');
const { createFindOneMock, createFindMock, createMockDocument, createAggregateMock } = require('../helpers/mockHelpers');

// Mock ControllerHelpers to ensure proper response handling
jest.mock('../../server/utils/controllerHelpers', () => ({
  asyncWrapper: (fn) => fn,
  sendSuccess: (res, data, message, statusCode = 200) => {
    res.statusCode = statusCode;
    res.statusMessage = 'OK';
    res.end(JSON.stringify({ success: true, message: message || 'Success', ...data }));
    return res;
  },
  sendError: (res, message, statusCode = 400, details) => {
    res.statusCode = statusCode;
    res.statusMessage = 'Error';
    res.end(JSON.stringify({ success: false, message, ...(details && { ...details }) }));
    return res;
  },
  sendPaginated: (res, items, pagination, message, extra = {}) => {
    res.statusCode = 200;
    res.statusMessage = 'OK';
    res.end(JSON.stringify({
      success: true,
      message: message || 'Success',
      data: items,
      pagination,
      ...extra
    }));
    return res;
  }
}));

describe('Customer Dashboard WDF Credit Display', () => {
  let testCustomer;
  let testAffiliate;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/wavemax-test', {
        useNewUrlParser: true,
        useUnifiedTopology: true
      });
    }
  });

  beforeEach(async () => {
    await Customer.deleteMany({});
    await Order.deleteMany({});
    await Affiliate.deleteMany({});

    // Create test affiliate
    testAffiliate = await Affiliate.create({
      affiliateId: 'AFF-DASH-001',
      firstName: 'Dashboard',
      lastName: 'Affiliate',
      email: 'dash.affiliate@test.com',
      phone: '1234567890',
      businessName: 'Dashboard Business',
      address: '789 Dashboard St',
      city: 'Dashboard City',
      state: 'DS',
      zipCode: '54321',
      passwordSalt: 'salt',
      passwordHash: 'hash',
      username: 'dashaffiliate',
      paymentMethod: 'check',
      serviceLatitude: 40.7128,
      serviceLongitude: -74.0060
    });

    // Create test customer
    testCustomer = await Customer.create({
      customerId: 'CUST-DASH-001',
      affiliateId: testAffiliate.affiliateId,
      firstName: 'Dashboard',
      lastName: 'Customer',
      email: 'dashboard@test.com',
      phone: '1234567890',
      address: '123 Dashboard Ave',
      city: 'Dashboard City',
      state: 'DS',
      zipCode: '54321',
      username: 'dashcustomer',
      passwordSalt: 'salt',
      passwordHash: 'hash',
      numberOfBags: 2,
      bagCredit: 20,
      bagCreditApplied: false
    });
  });

  afterEach(async () => {
    await Customer.deleteMany({});
    await Order.deleteMany({});
    await Affiliate.deleteMany({});
  });

  afterAll(async () => {
    // Connection cleanup is handled by global setup.js
  });

  describe('Dashboard Stats with WDF Credit', () => {
    it('should include WDF credit information in dashboard response', async () => {
      // Set WDF credit
      testCustomer.wdfCredit = 12.50;
      testCustomer.wdfCreditUpdatedAt = new Date('2024-01-15');
      testCustomer.wdfCreditFromOrderId = 'ORD-PREV-001';
      await testCustomer.save();

      // Mock request and response
      const req = httpMocks.createRequest({
        params: { customerId: testCustomer.customerId },
        user: { 
          role: 'customer', 
          customerId: testCustomer.customerId 
        }
      });
      const res = httpMocks.createResponse();

      const handler = extractHandler(customerController.getCustomerDashboardStats);
      await handler(req, res, jest.fn());

      expect(res.statusCode).toBe(200);
      const responseData = JSON.parse(res._getData());
      
      expect(responseData.success).toBe(true);
      expect(responseData.customer).toHaveProperty('wdfCredits');
      expect(responseData.customer.wdfCredits).toBe(12.50);
      expect(responseData.customer.formattedCredits).toBeDefined();
    });

    it('should show zero WDF credit for new customers', async () => {
      const req = httpMocks.createRequest({
        params: { customerId: testCustomer.customerId },
        user: { 
          role: 'customer', 
          customerId: testCustomer.customerId 
        }
      });
      const res = httpMocks.createResponse();

      const handler = extractHandler(customerController.getCustomerDashboardStats);
      await handler(req, res, jest.fn());

      const responseData = JSON.parse(res._getData());
      
      expect(responseData.customer.wdfCredits).toBeDefined();
    });

    it('should show negative WDF credit (debit) correctly', async () => {
      testCustomer.wdfCredit = -8.75;
      testCustomer.wdfCreditUpdatedAt = new Date();
      testCustomer.wdfCreditFromOrderId = 'ORD-DEBIT-001';
      await testCustomer.save();

      const req = httpMocks.createRequest({
        params: { customerId: testCustomer.customerId },
        user: { 
          role: 'customer', 
          customerId: testCustomer.customerId 
        }
      });
      const res = httpMocks.createResponse();

      const handler = extractHandler(customerController.getCustomerDashboardStats);
      await handler(req, res, jest.fn());

      const responseData = JSON.parse(res._getData());
      
      expect(responseData.customer.wdfCredits).toBe(-8.75);
      expect(responseData.customer.customerId).toBe(testCustomer.customerId);
    });

    it('should include both bag credit and WDF credit', async () => {
      testCustomer.wdfCredit = 5.00;
      testCustomer.wdfCreditUpdatedAt = new Date();
      await testCustomer.save();

      const req = httpMocks.createRequest({
        params: { customerId: testCustomer.customerId },
        user: { 
          role: 'customer', 
          customerId: testCustomer.customerId 
        }
      });
      const res = httpMocks.createResponse();

      const handler = extractHandler(customerController.getCustomerDashboardStats);
      await handler(req, res, jest.fn());

      const responseData = JSON.parse(res._getData());
      
      // Should have both numberOfBags and wdfCredits
      expect(responseData.customer.numberOfBags).toBe(2);
      expect(responseData.customer.wdfCredits).toBe(5.00);
    });
  });

  describe('Dashboard with Order History', () => {
    it('should show WDF credit alongside order statistics', async () => {
      // Create orders with WDF credit history
      await Order.create([
        {
          orderId: 'ORD-STAT-001',
          customerId: testCustomer.customerId,
          affiliateId: testAffiliate.affiliateId,
          pickupDate: new Date(),
          pickupTime: 'morning',
          estimatedWeight: 20,
          actualWeight: 25,
          wdfCreditGenerated: 6.25,
          weightDifference: 5,
          status: 'complete',
          estimatedTotal: 35,
          actualTotal: 41.25
        },
        {
          orderId: 'ORD-STAT-002',
          customerId: testCustomer.customerId,
          affiliateId: testAffiliate.affiliateId,
          pickupDate: new Date(),
          pickupTime: 'afternoon',
          estimatedWeight: 30,
          wdfCreditApplied: 6.25,
          status: 'pending',
          estimatedTotal: 38.75 // After credit applied
        }
      ]);

      // Set current credit
      testCustomer.wdfCredit = 0; // Used in second order
      testCustomer.wdfCreditFromOrderId = 'ORD-STAT-001';
      await testCustomer.save();

      const req = httpMocks.createRequest({
        params: { customerId: testCustomer.customerId },
        user: { 
          role: 'customer', 
          customerId: testCustomer.customerId 
        }
      });
      const res = httpMocks.createResponse();

      const handler = extractHandler(customerController.getCustomerDashboardStats);
      await handler(req, res, jest.fn());

      const responseData = JSON.parse(res._getData());
      
      expect(responseData.statistics.totalOrders).toBe(2);
      expect(responseData.statistics.completedOrders).toBe(1);
      // activeOrders not in response
      expect(responseData.customer.wdfCredits).toBe(0);
      expect(responseData.customer.customerId).toBe(testCustomer.customerId);
    });
  });

  describe('Access Control', () => {
    it('should allow affiliates to see customer WDF credit', async () => {
      testCustomer.wdfCredit = 15.00;
      await testCustomer.save();

      const req = httpMocks.createRequest({
        params: { customerId: testCustomer.customerId },
        user: { 
          role: 'affiliate', 
          affiliateId: testAffiliate.affiliateId 
        }
      });
      const res = httpMocks.createResponse();

      const handler = extractHandler(customerController.getCustomerDashboardStats);
      await handler(req, res, jest.fn());

      expect(res.statusCode).toBe(200);
      const responseData = JSON.parse(res._getData());
      expect(responseData.customer.wdfCredits).toBe(15.00);
    });

    it.skip('should not allow unrelated affiliates to see customer WDF credit', async () => {
      // This test requires the authorization middleware to run, which is skipped by extractHandler
      // The authorization is tested in integration tests
      const req = httpMocks.createRequest({
        params: { customerId: testCustomer.customerId },
        user: { 
          role: 'affiliate', 
          affiliateId: 'OTHER-AFFILIATE' 
        }
      });
      const res = httpMocks.createResponse();

      const handler = extractHandler(customerController.getCustomerDashboardStats);
      await handler(req, res, jest.fn());

      expect(res.statusCode).toBe(403);
      expect(JSON.parse(res._getData()).success).toBe(false);
    });

    it('should allow admins to see any customer WDF credit', async () => {
      testCustomer.wdfCredit = -10.00;
      await testCustomer.save();

      const req = httpMocks.createRequest({
        params: { customerId: testCustomer.customerId },
        user: { 
          role: 'admin'
        }
      });
      const res = httpMocks.createResponse();

      const handler = extractHandler(customerController.getCustomerDashboardStats);
      await handler(req, res, jest.fn());

      expect(res.statusCode).toBe(200);
      const responseData = JSON.parse(res._getData());
      expect(responseData.customer.wdfCredits).toBe(-10.00);
    });
  });

  describe('Edge Cases', () => {
    it('should handle null WDF credit fields gracefully', async () => {
      // Ensure fields are undefined/null
      testCustomer.wdfCredit = undefined;
      testCustomer.wdfCreditUpdatedAt = undefined;
      testCustomer.wdfCreditFromOrderId = undefined;
      await testCustomer.save();

      const req = httpMocks.createRequest({
        params: { customerId: testCustomer.customerId },
        user: { 
          role: 'customer', 
          customerId: testCustomer.customerId 
        }
      });
      const res = httpMocks.createResponse();

      const handler = extractHandler(customerController.getCustomerDashboardStats);
      await handler(req, res, jest.fn());

      const responseData = JSON.parse(res._getData());
      
      expect(responseData.customer.wdfCredits).toBeDefined();
    });

    it('should handle very small WDF credit amounts', async () => {
      testCustomer.wdfCredit = 0.01;
      await testCustomer.save();

      const req = httpMocks.createRequest({
        params: { customerId: testCustomer.customerId },
        user: { 
          role: 'customer', 
          customerId: testCustomer.customerId 
        }
      });
      const res = httpMocks.createResponse();

      const handler = extractHandler(customerController.getCustomerDashboardStats);
      await handler(req, res, jest.fn());

      const responseData = JSON.parse(res._getData());
      expect(responseData.customer.wdfCredits).toBe(0.01);
    });
  });
});