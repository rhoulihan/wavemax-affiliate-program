jest.setTimeout(90000);

const request = require('supertest');
const app = require('../../server');
const Order = require('../../server/models/Order');
const Customer = require('../../server/models/Customer');
const Affiliate = require('../../server/models/Affiliate');
const Administrator = require('../../server/models/Administrator');
const encryptionUtil = require('../../server/utils/encryption');
const jwt = require('jsonwebtoken');

describe('Order API - Add-on Functionality Integration Tests', () => {
  let customerToken;
  let customer;
  let affiliate;
  let admin;
  let adminToken;

  beforeEach(async () => {
    // Create test admin
    const { hash: hashedPassword, salt } = encryptionUtil.hashPassword('Test123!');
    admin = await Administrator.create({
      username: 'admin_addon_test',
      email: 'admin.addon@test.com',
      passwordHash: hashedPassword,
      passwordSalt: salt,
      firstName: 'Admin',
      lastName: 'Test',
      role: 'admin',
      isActive: true
    });
    
    adminToken = jwt.sign(
      { userId: admin._id, role: 'admin' },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );

    // Create test affiliate
    const affiliateCreds = encryptionUtil.hashPassword('Test123!');
    affiliate = await Affiliate.create({
      affiliateId: 'AFF_ADDON_001',
      username: 'affiliate_addon',
      email: 'affiliate.addon@test.com',
      passwordHash: affiliateCreds.hash,
      passwordSalt: affiliateCreds.salt,
      firstName: 'Affiliate',
      lastName: 'AddOn',
      phone: '1234567890',
      address: '123 Test St',
      city: 'Test City',
      state: 'TS',
      zipCode: '12345',
      serviceArea: ['12345'],
      minimumDeliveryFee: 15,
      perBagDeliveryFee: 5,
      paymentMethod: 'check',
      isActive: true
    });

    // Create test customer
    const customerCreds = encryptionUtil.hashPassword('Test123!');
    customer = await Customer.create({
      customerId: 'CUST_ADDON_001',
      username: 'customer_addon',
      email: 'customer.addon@test.com',
      passwordHash: customerCreds.hash,
      passwordSalt: customerCreds.salt,
      firstName: 'Customer',
      lastName: 'AddOn',
      phone: '9876543210',
      address: '456 Test Ave',
      city: 'Test City',
      state: 'TS',
      zipCode: '12345',
      affiliateId: affiliate.affiliateId,
      isActive: true,
      wdfCredit: 0
    });

    customerToken = jwt.sign(
      { userId: customer._id, customerId: customer.customerId, role: 'customer' },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );
  });

  afterEach(async () => {
    // Clean up is handled by global afterEach in setup.js
  });

  describe('GET /api/orders/:orderId - Retrieve Order with Add-ons', () => {
    let testOrderId;

    beforeEach(async () => {
      // Create an order with add-ons
      const order = await Order.create({
        customerId: 'CUST_ADDON_001',
        affiliateId: 'AFF_ADDON_001',
        pickupDate: '2026-01-27',
        pickupTime: 'morning',
        estimatedWeight: 25,
        numberOfBags: 2,
        feeBreakdown: {
          numberOfBags: 2,
          minimumFee: 15,
          perBagFee: 5,
          totalFee: 15,
          minimumApplied: true
        },
        addOns: {
          premiumDetergent: true,
          fabricSoftener: false,
          stainRemover: true
        }
      });
      testOrderId = order.orderId;
    });

    it('should return order details including add-ons', async () => {
      const response = await request(app)
        .get(`/api/orders/${testOrderId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.order.addOns).toEqual({
        premiumDetergent: true,
        fabricSoftener: false,
        stainRemover: true
      });
      expect(response.body.order.addOnTotal).toBe('$5.00'); // 2 × 25 × 0.10
    });

    it('should include add-ons when admin retrieves order', async () => {
      const response = await request(app)
        .get(`/api/orders/${testOrderId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.order.addOns).toBeDefined();
      expect(response.body.order.addOnTotal).toBe('$5.00');
    });
  });
});