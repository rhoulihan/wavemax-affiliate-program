const request = require('supertest');
const app = require('../../server');
const Order = require('../../server/models/Order');
const Customer = require('../../server/models/Customer');
const Affiliate = require('../../server/models/Affiliate');
const encryptionUtil = require('../../server/utils/encryption');
const jwt = require('jsonwebtoken');

describe('Order Integration Tests', () => {
  let server;
  let testAffiliate;
  let testCustomer;
  let customerToken;
  let affiliateToken;
  let adminToken;

  beforeAll(() => {
    server = app.listen(0);
  });

  afterAll(async () => {
    await server.close();
  });

  beforeEach(async () => {
    // Clear database
    await Order.deleteMany({});
    await Customer.deleteMany({});
    await Affiliate.deleteMany({});

    // Create test affiliate
    const { hash, salt } = encryptionUtil.hashPassword('affiliatepass');
    testAffiliate = new Affiliate({
      affiliateId: 'AFF123',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      phone: '555-123-4567',
      address: '123 Main St',
      city: 'Austin',
      state: 'TX',
      zipCode: '78701',
      serviceArea: 'Downtown',
      deliveryFee: 5.99,
      username: 'johndoe',
      passwordHash: hash,
      passwordSalt: salt,
      paymentMethod: 'directDeposit'
    });
    await testAffiliate.save();

    // Create affiliate token
    affiliateToken = jwt.sign(
      { id: testAffiliate._id, affiliateId: 'AFF123', role: 'affiliate' },
      process.env.JWT_SECRET || 'test-secret'
    );

    // Create test customer
    const customerCreds = encryptionUtil.hashPassword('customerpass');
    testCustomer = new Customer({
      customerId: 'CUST123',
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane@example.com',
      phone: '555-987-6543',
      address: '456 Oak Ave',
      city: 'Austin',
      state: 'TX',
      zipCode: '78702',
      serviceFrequency: 'weekly',
      username: 'janesmith',
      passwordHash: customerCreds.hash,
      passwordSalt: customerCreds.salt,
      affiliateId: 'AFF123'
    });
    await testCustomer.save();

    // Create customer token
    customerToken = jwt.sign(
      { id: testCustomer._id, customerId: 'CUST123', role: 'customer' },
      process.env.JWT_SECRET || 'test-secret'
    );

    // Create admin token
    adminToken = jwt.sign(
      { id: 'admin123', role: 'admin' },
      process.env.JWT_SECRET || 'test-secret'
    );
  });

  describe('POST /api/orders', () => {
    it('should create order as customer', async () => {
      const response = await request(server)
        .post('/api/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          customerId: 'CUST123',
          affiliateId: 'AFF123',
          pickupDate: '2025-05-25',
          pickupTime: 'morning',
          specialPickupInstructions: 'Ring doorbell',
          estimatedSize: 'medium',
          serviceNotes: 'Handle with care',
          deliveryDate: '2025-05-27',
          deliveryTime: 'afternoon',
          specialDeliveryInstructions: 'Leave at door'
        });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        success: true,
        orderId: expect.stringMatching(/^ORD\d{6}$/),
        estimatedTotal: expect.any(Number),
        message: 'Pickup scheduled successfully!'
      });

      // Verify order was created
      const order = await Order.findOne({ orderId: response.body.orderId });
      expect(order).toBeTruthy();
      expect(order.customerId).toBe('CUST123');
      expect(order.affiliateId).toBe('AFF123');
      expect(order.status).toBe('scheduled');
      expect(order.deliveryFee).toBe(5.99);
    });

    it('should create order as affiliate for their customer', async () => {
      const response = await request(server)
        .post('/api/orders')
        .set('Authorization', `Bearer ${affiliateToken}`)
        .send({
          customerId: 'CUST123',
          affiliateId: 'AFF123',
          pickupDate: '2025-05-25',
          pickupTime: 'morning',
          estimatedSize: 'small',
          deliveryDate: '2025-05-27',
          deliveryTime: 'evening'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });

    it('should fail with invalid customer ID', async () => {
      const response = await request(server)
        .post('/api/orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          customerId: 'INVALID',
          affiliateId: 'AFF123',
          pickupDate: '2025-05-25',
          pickupTime: 'morning',
          estimatedSize: 'medium',
          deliveryDate: '2025-05-27',
          deliveryTime: 'afternoon'
        });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        message: 'Invalid customer ID'
      });
    });

    it('should fail with invalid affiliate ID', async () => {
      const response = await request(server)
        .post('/api/orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          customerId: 'CUST123',
          affiliateId: 'INVALID',
          pickupDate: '2025-05-25',
          pickupTime: 'morning',
          estimatedSize: 'medium',
          deliveryDate: '2025-05-27',
          deliveryTime: 'afternoon'
        });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        message: 'Invalid affiliate ID'
      });
    });

    it('should fail when customer tries to create order for another customer', async () => {
      // Create another customer
      const otherCustomer = new Customer({
        customerId: 'CUST999',
        firstName: 'Bob',
        lastName: 'Jones',
        email: 'bob@example.com',
        phone: '555-111-2222',
        address: '789 Pine St',
        city: 'Austin',
        state: 'TX',
        zipCode: '78703',
        serviceFrequency: 'biweekly',
        username: 'bobjones',
        passwordHash: 'hash',
        passwordSalt: 'salt',
        affiliateId: 'AFF123'
      });
      await otherCustomer.save();

      const response = await request(server)
        .post('/api/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          customerId: 'CUST999',
          affiliateId: 'AFF123',
          pickupDate: '2025-05-25',
          pickupTime: 'morning',
          estimatedSize: 'medium',
          deliveryDate: '2025-05-27',
          deliveryTime: 'afternoon'
        });

      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({
        success: false,
        message: 'Unauthorized'
      });
    });

    it('should validate required fields', async () => {
      const response = await request(server)
        .post('/api/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          customerId: 'CUST123',
          affiliateId: 'AFF123'
          // Missing required fields
        });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/orders/:orderId', () => {
    let testOrder;

    beforeEach(async () => {
      testOrder = new Order({
        orderId: 'ORD123456',
        customerId: 'CUST123',
        affiliateId: 'AFF123',
        pickupDate: new Date('2025-05-25'),
        pickupTime: 'morning',
        deliveryDate: new Date('2025-05-27'),
        deliveryTime: 'afternoon',
        status: 'processing',
        estimatedSize: 'medium',
        baseRate: 1.89,
        deliveryFee: 5.99
      });
      await testOrder.save();
    });

    it('should return order details for customer', async () => {
      const response = await request(server)
        .get('/api/orders/ORD123456')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        order: {
          orderId: 'ORD123456',
          customerId: 'CUST123',
          affiliateId: 'AFF123',
          status: 'processing',
          customer: {
            name: 'Jane Smith',
            email: 'jane@example.com'
          },
          affiliate: {
            name: 'John Doe',
            email: 'john@example.com'
          }
        }
      });
    });

    it('should return order details for affiliate', async () => {
      const response = await request(server)
        .get('/api/orders/ORD123456')
        .set('Authorization', `Bearer ${affiliateToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.order.orderId).toBe('ORD123456');
    });

    it('should fail for unauthorized customer', async () => {
      const otherCustomerToken = jwt.sign(
        { id: 'other', customerId: 'CUST999', role: 'customer' },
        process.env.JWT_SECRET || 'test-secret'
      );

      const response = await request(server)
        .get('/api/orders/ORD123456')
        .set('Authorization', `Bearer ${otherCustomerToken}`);

      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({
        success: false,
        message: 'Unauthorized'
      });
    });

    it('should return 404 for non-existent order', async () => {
      const response = await request(server)
        .get('/api/orders/NONEXISTENT')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({
        success: false,
        message: 'Order not found'
      });
    });
  });

  describe('PUT /api/orders/:orderId/status', () => {
    let testOrder;

    beforeEach(async () => {
      testOrder = new Order({
        orderId: 'ORD123456',
        customerId: 'CUST123',
        affiliateId: 'AFF123',
        pickupDate: new Date('2025-05-25'),
        pickupTime: 'morning',
        deliveryDate: new Date('2025-05-27'),
        deliveryTime: 'afternoon',
        status: 'scheduled',
        estimatedSize: 'medium',
        baseRate: 1.89,
        deliveryFee: 5.99
      });
      await testOrder.save();
    });

    it('should update order status as affiliate', async () => {
      const response = await request(server)
        .put('/api/orders/ORD123456/status')
        .set('Authorization', `Bearer ${affiliateToken}`)
        .send({
          status: 'picked_up'
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        orderId: 'ORD123456',
        status: 'picked_up',
        message: 'Order status updated successfully!'
      });

      // Verify status was updated
      const order = await Order.findOne({ orderId: 'ORD123456' });
      expect(order.status).toBe('picked_up');
      expect(order.pickedUpAt).toBeDefined();
    });

    it('should update weight when processing', async () => {
      // First update to picked_up
      await Order.updateOne(
        { orderId: 'ORD123456' },
        { status: 'picked_up' }
      );

      const response = await request(server)
        .put('/api/orders/ORD123456/status')
        .set('Authorization', `Bearer ${affiliateToken}`)
        .send({
          status: 'processing',
          actualWeight: 25.5
        });

      expect(response.status).toBe(200);
      expect(response.body.actualWeight).toBe(25.5);

      // Verify weight was updated
      const order = await Order.findOne({ orderId: 'ORD123456' });
      expect(order.actualWeight).toBe(25.5);
      expect(order.actualTotal).toBeGreaterThan(0);
    });

    it('should prevent invalid status transitions', async () => {
      // Update to delivered first
      await Order.updateOne(
        { orderId: 'ORD123456' },
        { status: 'delivered' }
      );

      const response = await request(server)
        .put('/api/orders/ORD123456/status')
        .set('Authorization', `Bearer ${affiliateToken}`)
        .send({
          status: 'scheduled'
        });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        message: 'Invalid status transition from delivered to scheduled'
      });
    });

    it('should fail for unauthorized affiliate', async () => {
      const otherAffiliateToken = jwt.sign(
        { id: 'other', affiliateId: 'AFF999', role: 'affiliate' },
        process.env.JWT_SECRET || 'test-secret'
      );

      const response = await request(server)
        .put('/api/orders/ORD123456/status')
        .set('Authorization', `Bearer ${otherAffiliateToken}`)
        .send({
          status: 'picked_up'
        });

      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({
        success: false,
        message: 'Unauthorized'
      });
    });

    it('should fail for customers', async () => {
      const response = await request(server)
        .put('/api/orders/ORD123456/status')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          status: 'picked_up'
        });

      expect(response.status).toBe(403);
    });
  });

  describe('POST /api/orders/:orderId/cancel', () => {
    let testOrder;

    beforeEach(async () => {
      testOrder = new Order({
        orderId: 'ORD123456',
        customerId: 'CUST123',
        affiliateId: 'AFF123',
        pickupDate: new Date('2025-05-25'),
        pickupTime: 'morning',
        deliveryDate: new Date('2025-05-27'),
        deliveryTime: 'afternoon',
        status: 'scheduled',
        estimatedSize: 'medium',
        baseRate: 1.89,
        deliveryFee: 5.99
      });
      await testOrder.save();
    });

    it('should cancel order as customer', async () => {
      const response = await request(server)
        .post('/api/orders/ORD123456/cancel')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        message: 'Order cancelled successfully'
      });

      // Verify order was cancelled
      const order = await Order.findOne({ orderId: 'ORD123456' });
      expect(order.status).toBe('cancelled');
      expect(order.cancelledAt).toBeDefined();
    });

    it('should cancel order as affiliate', async () => {
      const response = await request(server)
        .post('/api/orders/ORD123456/cancel')
        .set('Authorization', `Bearer ${affiliateToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should prevent cancelling non-cancellable orders', async () => {
      // Update to processing first
      await Order.updateOne(
        { orderId: 'ORD123456' },
        { status: 'processing' }
      );

      const response = await request(server)
        .post('/api/orders/ORD123456/cancel')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        message: 'Orders in processing status cannot be cancelled'
      });
    });

    it('should fail for unauthorized user', async () => {
      const otherCustomerToken = jwt.sign(
        { id: 'other', customerId: 'CUST999', role: 'customer' },
        process.env.JWT_SECRET || 'test-secret'
      );

      const response = await request(server)
        .post('/api/orders/ORD123456/cancel')
        .set('Authorization', `Bearer ${otherCustomerToken}`);

      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({
        success: false,
        message: 'Unauthorized'
      });
    });
  });
});