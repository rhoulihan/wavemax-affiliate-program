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
      serviceLatitude: 30.2672,
      serviceLongitude: -97.7431,
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

  describe('POST /api/orders - Create Order with Add-ons', () => {

    it('should create order with single add-on selected', async () => {
      const orderData = {
        customerId: 'CUST_ADDON_001',
        affiliateId: 'AFF_ADDON_001',
        pickupDate: new Date(Date.now() + 86400000).toISOString(),
        pickupTime: 'morning',
        specialPickupInstructions: 'Test with premium detergent',
        estimatedWeight: 20,
        numberOfBags: 2,
        addOns: {
          premiumDetergent: true,
          fabricSoftener: false,
          stainRemover: false
        }
      };

      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send(orderData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.orderId).toBeDefined();

      // Verify order was created with add-ons
      const order = await Order.findOne({ orderId: response.body.orderId });
      expect(order.addOns.premiumDetergent).toBe(true);
      expect(order.addOns.fabricSoftener).toBe(false);
      expect(order.addOns.stainRemover).toBe(false);
      expect(order.addOnTotal).toBe(2.00); // 1 × 20 × 0.10
    });

    it('should create order with multiple add-ons selected', async () => {
      const orderData = {
        customerId: 'CUST_ADDON_001',
        affiliateId: 'AFF_ADDON_001',
        pickupDate: new Date(Date.now() + 86400000).toISOString(),
        pickupTime: 'afternoon',
        specialPickupInstructions: 'All add-ons please',
        estimatedWeight: 30,
        numberOfBags: 3,
        addOns: {
          premiumDetergent: true,
          fabricSoftener: true,
          stainRemover: true
        }
      };

      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send(orderData)
        .expect(201);

      expect(response.body.success).toBe(true);

      const order = await Order.findOne({ orderId: response.body.orderId });
      expect(order.addOns.premiumDetergent).toBe(true);
      expect(order.addOns.fabricSoftener).toBe(true);
      expect(order.addOns.stainRemover).toBe(true);
      expect(order.addOnTotal).toBe(9.00); // 3 × 30 × 0.10
    });

    it('should create order with no add-ons when not specified', async () => {
      const orderData = {
        customerId: 'CUST_ADDON_001',
        affiliateId: 'AFF_ADDON_001',
        pickupDate: new Date(Date.now() + 86400000).toISOString(),
        pickupTime: 'evening',
        specialPickupInstructions: 'No add-ons',
        estimatedWeight: 25,
        numberOfBags: 2
        // No addOns property
      };

      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send(orderData)
        .expect(201);

      expect(response.body.success).toBe(true);

      const order = await Order.findOne({ orderId: response.body.orderId });
      expect(order.addOns.premiumDetergent).toBe(false);
      expect(order.addOns.fabricSoftener).toBe(false);
      expect(order.addOns.stainRemover).toBe(false);
      expect(order.addOnTotal).toBe(0);
    });

    it('should calculate correct total with add-ons and delivery fee', async () => {
      const orderData = {
        customerId: 'CUST_ADDON_001',
        affiliateId: 'AFF_ADDON_001',
        pickupDate: new Date(Date.now() + 86400000).toISOString(),
        pickupTime: 'morning',
        specialPickupInstructions: 'Test total calculation',
        estimatedWeight: 40,
        numberOfBags: 4,
        addOns: {
          premiumDetergent: true,
          fabricSoftener: true,
          stainRemover: false
        }
      };

      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send(orderData)
        .expect(201);

      const order = await Order.findOne({ orderId: response.body.orderId });
      
      // Add-ons: 2 × 40 × 0.10 = $8.00
      expect(order.addOnTotal).toBe(8.00);
      
      // Delivery fee: 4 bags × $5/bag = $20 (exceeds minimum of $15)
      expect(order.feeBreakdown.totalFee).toBe(20);
      
      // Total: (40 × 1.25) + 20 + 8 = 78.00
      expect(order.estimatedTotal).toBe(78.00);
    });

    it('should include add-ons in total but not in commission calculation', async () => {
      const orderData = {
        customerId: 'CUST_ADDON_001',
        affiliateId: 'AFF_ADDON_001',
        pickupDate: new Date(Date.now() + 86400000).toISOString(),
        pickupTime: 'morning',
        specialPickupInstructions: 'Commission test',
        estimatedWeight: 50,
        numberOfBags: 5,
        addOns: {
          premiumDetergent: true,
          fabricSoftener: true,
          stainRemover: true
        }
      };

      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send(orderData)
        .expect(201);

      const order = await Order.findOne({ orderId: response.body.orderId });
      
      // Mark order as complete with actual weight to trigger commission calculation
      order.status = 'processing';
      order.actualWeight = 50;
      await order.save();
      
      // Add-ons: 3 × 50 × 0.10 = $15.00
      expect(order.addOnTotal).toBe(15.00);
      
      // Commission should exclude add-ons: (50 × 1.25 × 0.10) + 25 = 31.25
      // WDF: 50 × 1.25 = 62.50
      // WDF Commission: 62.50 × 0.10 = 6.25
      // Delivery Fee: 5 × 5 = 25.00
      // Total Commission: 6.25 + 25.00 = 31.25
      expect(order.affiliateCommission).toBe(31.25);
      
      // But actual total includes add-ons: 62.50 + 25 + 15 = 102.50
      expect(order.actualTotal).toBe(102.50);
    });
  });

  describe('GET /api/orders/:orderId - Retrieve Order with Add-ons', () => {
    let testOrderId;

    beforeEach(async () => {
      // Create an order with add-ons
      const order = await Order.create({
        customerId: 'CUST_ADDON_001',
        affiliateId: 'AFF_ADDON_001',
        pickupDate: new Date(Date.now() + 86400000),
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

  describe('Order with Add-ons and WDF Credit', () => {
    it('should apply WDF credit after add-on calculation', async () => {
      // Give customer some WDF credit
      customer.wdfCredit = 10;
      await customer.save();

      const orderData = {
        customerId: 'CUST_ADDON_001',
        affiliateId: 'AFF_ADDON_001',
        pickupDate: new Date(Date.now() + 86400000).toISOString(),
        pickupTime: 'morning',
        specialPickupInstructions: 'Test with credit',
        estimatedWeight: 30,
        numberOfBags: 3,
        addOns: {
          premiumDetergent: true,
          fabricSoftener: true,
          stainRemover: false
        }
      };

      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send(orderData)
        .expect(201);

      const order = await Order.findOne({ orderId: response.body.orderId });
      
      // Add-ons: 2 × 30 × 0.10 = $6.00
      expect(order.addOnTotal).toBe(6.00);
      
      // WDF credit applied
      expect(order.wdfCreditApplied).toBe(10);
      
      // Total: (30 × 1.25) + 15 + 6 - 10 = 48.50
      expect(order.estimatedTotal).toBe(48.50);

      // Verify customer credit was reset
      const updatedCustomer = await Customer.findOne({ customerId: 'CUST_ADDON_001' });
      expect(updatedCustomer.wdfCredit).toBe(0);
    });
  });
});