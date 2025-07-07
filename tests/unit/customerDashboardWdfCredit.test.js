const mongoose = require('mongoose');
const httpMocks = require('node-mocks-http');
const Customer = require('../../server/models/Customer');
const Order = require('../../server/models/Order');
const Affiliate = require('../../server/models/Affiliate');
const { getCustomerDashboardStats } = require('../../server/controllers/customerController');

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
      paymentMethod: 'directDeposit',
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
    await mongoose.connection.close();
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

      await getCustomerDashboardStats(req, res);

      expect(res.statusCode).toBe(200);
      const responseData = JSON.parse(res._getData());
      
      expect(responseData.success).toBe(true);
      expect(responseData.dashboard).toHaveProperty('wdfCredit');
      expect(responseData.dashboard.wdfCredit).toEqual({
        amount: 12.50,
        updatedAt: testCustomer.wdfCreditUpdatedAt.toISOString(),
        fromOrderId: 'ORD-PREV-001'
      });
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

      await getCustomerDashboardStats(req, res);

      const responseData = JSON.parse(res._getData());
      
      expect(responseData.dashboard.wdfCredit).toEqual({
        amount: 0,
        updatedAt: null,
        fromOrderId: null
      });
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

      await getCustomerDashboardStats(req, res);

      const responseData = JSON.parse(res._getData());
      
      expect(responseData.dashboard.wdfCredit.amount).toBe(-8.75);
      expect(responseData.dashboard.wdfCredit.fromOrderId).toBe('ORD-DEBIT-001');
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

      await getCustomerDashboardStats(req, res);

      const responseData = JSON.parse(res._getData());
      
      // Should have both credits
      expect(responseData.dashboard.bagCredit).toEqual({
        amount: 20,
        applied: false,
        numberOfBags: 2
      });
      expect(responseData.dashboard.wdfCredit.amount).toBe(5.00);
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

      await getCustomerDashboardStats(req, res);

      const responseData = JSON.parse(res._getData());
      
      expect(responseData.dashboard.statistics.totalOrders).toBe(2);
      expect(responseData.dashboard.statistics.completedOrders).toBe(1);
      expect(responseData.dashboard.statistics.activeOrders).toBe(1);
      expect(responseData.dashboard.wdfCredit.amount).toBe(0);
      expect(responseData.dashboard.wdfCredit.fromOrderId).toBe('ORD-STAT-001');
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

      await getCustomerDashboardStats(req, res);

      expect(res.statusCode).toBe(200);
      const responseData = JSON.parse(res._getData());
      expect(responseData.dashboard.wdfCredit.amount).toBe(15.00);
    });

    it('should not allow unrelated affiliates to see customer WDF credit', async () => {
      const req = httpMocks.createRequest({
        params: { customerId: testCustomer.customerId },
        user: { 
          role: 'affiliate', 
          affiliateId: 'OTHER-AFFILIATE' 
        }
      });
      const res = httpMocks.createResponse();

      await getCustomerDashboardStats(req, res);

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

      await getCustomerDashboardStats(req, res);

      expect(res.statusCode).toBe(200);
      const responseData = JSON.parse(res._getData());
      expect(responseData.dashboard.wdfCredit.amount).toBe(-10.00);
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

      await getCustomerDashboardStats(req, res);

      const responseData = JSON.parse(res._getData());
      
      expect(responseData.dashboard.wdfCredit).toEqual({
        amount: 0,
        updatedAt: null,
        fromOrderId: null
      });
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

      await getCustomerDashboardStats(req, res);

      const responseData = JSON.parse(res._getData());
      expect(responseData.dashboard.wdfCredit.amount).toBe(0.01);
    });
  });
});