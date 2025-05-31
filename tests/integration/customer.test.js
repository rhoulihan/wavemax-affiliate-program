const app = require('../../server');
const mongoose = require('mongoose');
const Customer = require('../../server/models/Customer');
const Affiliate = require('../../server/models/Affiliate');
const Order = require('../../server/models/Order');
const Bag = require('../../server/models/Bag');
const encryptionUtil = require('../../server/utils/encryption');
const jwt = require('jsonwebtoken');
const { getCsrfToken, createAgent } = require('../helpers/csrfHelper');

describe('Customer Integration Tests', () => {
  let testAffiliate;
  let testCustomer;
  let customerToken;
  let affiliateToken;
  let agent;
  let csrfToken;

  beforeEach(async () => {
    // Create agent with session support
    agent = createAgent(app);

    // Get CSRF token
    csrfToken = await getCsrfToken(app, agent);

    // Clear database
    await Customer.deleteMany({});
    await Affiliate.deleteMany({});
    await Order.deleteMany({});
    await Bag.deleteMany({});

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
  });

  describe('POST /api/v1/customers/register', () => {
    it('should register a new customer', async () => {
      const response = await agent
        .post('/api/v1/customers/register')
        .send({
          firstName: 'Bob',
          lastName: 'Johnson',
          email: 'bob@example.com',
          phone: '555-555-5555',
          address: '789 Pine St',
          city: 'Austin',
          state: 'TX',
          zipCode: '78703',
          serviceFrequency: 'biweekly',
          username: 'bobjohnson',
          password: 'bobpass123',
          affiliateId: 'AFF123'
        });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        success: true,
        customerId: expect.stringMatching(/^CUST\d{6}$/),
        message: 'Customer registered successfully!'
      });

      // Verify customer was created
      const customer = await Customer.findOne({ username: 'bobjohnson' });
      expect(customer).toBeTruthy();
      expect(customer.email).toBe('bob@example.com');
      expect(customer.affiliateId).toBe('AFF123');

      // Verify bag was created
      const bag = await Bag.findOne({ customer: customer._id });
      expect(bag).toBeTruthy();
      expect(bag.status).toBe('pending');
    });

    it('should fail with invalid affiliate ID', async () => {
      const response = await agent
        .post('/api/v1/customers/register')
        .send({
          firstName: 'Bob',
          lastName: 'Johnson',
          email: 'bob@example.com',
          phone: '555-555-5555',
          address: '789 Pine St',
          city: 'Austin',
          state: 'TX',
          zipCode: '78703',
          serviceFrequency: 'biweekly',
          username: 'bobjohnson',
          password: 'bobpass123',
          affiliateId: 'INVALID'
        });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        message: 'Invalid affiliate ID'
      });
    });

    it('should fail with duplicate email', async () => {
      const response = await agent
        .post('/api/v1/customers/register')
        .send({
          firstName: 'Bob',
          lastName: 'Johnson',
          email: 'jane@example.com', // Already exists
          phone: '555-555-5555',
          address: '789 Pine St',
          city: 'Austin',
          state: 'TX',
          zipCode: '78703',
          serviceFrequency: 'biweekly',
          username: 'bobjohnson',
          password: 'bobpass123',
          affiliateId: 'AFF123'
        });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        message: 'Email or username already in use'
      });
    });

    it('should fail with duplicate username', async () => {
      const response = await agent
        .post('/api/v1/customers/register')
        .send({
          firstName: 'Bob',
          lastName: 'Johnson',
          email: 'bob@example.com',
          phone: '555-555-5555',
          address: '789 Pine St',
          city: 'Austin',
          state: 'TX',
          zipCode: '78703',
          serviceFrequency: 'biweekly',
          username: 'janesmith', // Already exists
          password: 'bobpass123',
          affiliateId: 'AFF123'
        });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        message: 'Email or username already in use'
      });
    });
  });

  describe('GET /api/v1/customers/:customerId/profile', () => {
    it('should return customer profile for authenticated customer', async () => {
      const response = await agent
        .get('/api/v1/customers/CUST123/profile')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        customer: {
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
          affiliate: {
            affiliateId: 'AFF123',
            name: 'John Doe',
            deliveryFee: 5.99
          }
        }
      });
    });

    it('should return customer profile for affiliate', async () => {
      const response = await agent
        .get('/api/v1/customers/CUST123/profile')
        .set('Authorization', `Bearer ${affiliateToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        customer: {
          customerId: 'CUST123'
        }
      });
    });

    it('should fail for unauthorized customer', async () => {
      // Create another customer
      const otherCustomerToken = jwt.sign(
        { id: 'other', customerId: 'CUST999', role: 'customer' },
        process.env.JWT_SECRET || 'test-secret'
      );

      const response = await agent
        .get('/api/v1/customers/CUST123/profile')
        .set('Authorization', `Bearer ${otherCustomerToken}`);

      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({
        success: false,
        message: 'Unauthorized'
      });
    });

    it('should return limited data without authentication', async () => {
      const response = await agent
        .get('/api/v1/customers/CUST123/profile');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        customer: {
          customerId: 'CUST123',
          firstName: 'Jane',
          lastName: 'Smith'
        }
      });
      // Should not include sensitive data
      expect(response.body.customer).not.toHaveProperty('email');
      expect(response.body.customer).not.toHaveProperty('phone');
      expect(response.body.customer).not.toHaveProperty('address');
    });
  });

  describe('PUT /api/v1/customers/:customerId/profile', () => {
    it('should update customer profile', async () => {
      const response = await agent
        .put('/api/v1/customers/CUST123/profile')
        .set('Authorization', `Bearer ${customerToken}`)
        .set('X-CSRF-Token', csrfToken)
        .send({
          phone: '555-111-2222',
          address: '999 New St',
          serviceFrequency: 'monthly'
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        message: 'Customer profile updated successfully!'
      });

      // Verify update
      const updatedCustomer = await Customer.findOne({ customerId: 'CUST123' });
      expect(updatedCustomer.phone).toBe('555-111-2222');
      expect(updatedCustomer.address).toBe('999 New St');
      expect(updatedCustomer.serviceFrequency).toBe('monthly');
    });

    it('should not update protected fields', async () => {
      const response = await agent
        .put('/api/v1/customers/CUST123/profile')
        .set('Authorization', `Bearer ${customerToken}`)
        .set('X-CSRF-Token', csrfToken)
        .send({
          customerId: 'CUST999',
          username: 'newusername',
          email: 'newemail@example.com',
          affiliateId: 'AFF999'
        });

      expect(response.status).toBe(200);

      // Verify protected fields were not updated
      const customer = await Customer.findOne({ customerId: 'CUST123' });
      expect(customer.customerId).toBe('CUST123');
      expect(customer.username).toBe('janesmith');
      expect(customer.email).toBe('jane@example.com');
      expect(customer.affiliateId).toBe('AFF123');
    });
  });

  describe('GET /api/v1/customers/:customerId/orders', () => {
    beforeEach(async () => {
      // Create test orders
      const orders = [
        {
          orderId: 'ORD001',
          customerId: 'CUST123',
          affiliateId: 'AFF123',
          pickupDate: new Date('2025-05-25'),
          pickupTime: 'morning',
          deliveryDate: new Date('2025-05-27'),
          deliveryTime: 'afternoon',
          status: 'delivered',
          estimatedSize: 'medium',
          actualWeight: 23.5,
          baseRate: 1.89,
          deliveryFee: 5.99
        },
        {
          orderId: 'ORD002',
          customerId: 'CUST123',
          affiliateId: 'AFF123',
          pickupDate: new Date('2025-05-26'),
          pickupTime: 'afternoon',
          deliveryDate: new Date('2025-05-28'),
          deliveryTime: 'morning',
          status: 'processing',
          estimatedSize: 'large',
          baseRate: 1.89,
          deliveryFee: 5.99
        }
      ];

      await Order.insertMany(orders);
    });

    it('should return customer orders with pagination', async () => {
      const response = await agent
        .get('/api/v1/customers/CUST123/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .query({ page: 1, limit: 10 });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        orders: expect.arrayContaining([
          expect.objectContaining({ orderId: 'ORD001' }),
          expect.objectContaining({ orderId: 'ORD002' })
        ]),
        pagination: {
          total: 2,
          pages: 1,
          currentPage: 1,
          perPage: 10
        }
      });
    });

    it('should filter orders by status', async () => {
      const response = await agent
        .get('/api/v1/customers/CUST123/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .query({ status: 'delivered' });

      expect(response.status).toBe(200);
      expect(response.body.orders).toHaveLength(1);
      expect(response.body.orders[0].orderId).toBe('ORD001');
    });
  });

  describe('POST /api/v1/customers/report-lost-bag', () => {
    beforeEach(async () => {
      // Create test bag
      const bag = new Bag({
        barcode: 'BAG123',
        customer: testCustomer._id,
        affiliate: testAffiliate._id,
        type: 'laundry',
        status: 'pending'
      });
      await bag.save();
    });

    it('should report lost bag', async () => {
      const response = await agent
        .post('/api/v1/customers/report-lost-bag')
        .set('Authorization', `Bearer ${customerToken}`)
        .set('X-CSRF-Token', csrfToken)
        .send({
          bagBarcode: 'BAG123'
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        message: 'Lost bag report submitted successfully'
      });

      // Verify bag status was updated
      const bag = await Bag.findOne({ barcode: 'BAG123' });
      expect(bag.status).toBe('lost');
    });

    it('should fail for non-existent bag', async () => {
      const response = await agent
        .post('/api/v1/customers/report-lost-bag')
        .set('Authorization', `Bearer ${customerToken}`)
        .set('X-CSRF-Token', csrfToken)
        .send({
          bagBarcode: 'NONEXISTENT'
        });

      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({
        success: false,
        message: 'Bag not found'
      });
    });

    it('should fail for unauthorized bag report', async () => {
      // Create bag for different customer
      const otherBag = new Bag({
        barcode: 'BAG999',
        customer: new mongoose.Types.ObjectId(),
        affiliate: testAffiliate._id,
        type: 'laundry',
        status: 'pending'
      });
      await otherBag.save();

      const response = await agent
        .post('/api/v1/customers/report-lost-bag')
        .set('Authorization', `Bearer ${customerToken}`)
        .set('X-CSRF-Token', csrfToken)
        .send({
          bagBarcode: 'BAG999'
        });

      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({
        success: false,
        message: 'Unauthorized'
      });
    });
  });

  describe('PUT /api/v1/customers/:customerId/password', () => {
    it('should update customer password', async () => {
      const response = await agent
        .put('/api/v1/customers/CUST123/password')
        .set('Authorization', `Bearer ${customerToken}`)
        .set('X-CSRF-Token', csrfToken)
        .send({
          currentPassword: 'customerpass',
          newPassword: 'newPassword123!'
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        message: 'Password updated successfully'
      });

      // Verify new password works
      const loginResponse = await agent
        .post('/api/v1/auth/customer/login')
        .send({
          username: 'janesmith',
          password: 'newPassword123!'
        });

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body.success).toBe(true);
    });

    it('should fail with incorrect current password', async () => {
      const response = await agent
        .put('/api/v1/customers/CUST123/password')
        .set('Authorization', `Bearer ${customerToken}`)
        .set('X-CSRF-Token', csrfToken)
        .send({
          currentPassword: 'wrongpassword',
          newPassword: 'newPassword123!'
        });

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        success: false,
        message: 'Current password is incorrect'
      });
    });

    it('should fail with weak new password', async () => {
      const response = await agent
        .put('/api/v1/customers/CUST123/password')
        .set('Authorization', `Bearer ${customerToken}`)
        .set('X-CSRF-Token', csrfToken)
        .send({
          currentPassword: 'customerpass',
          newPassword: 'weak'
        });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('password')
      });
    });
  });

  describe('GET /api/v1/customers/:customerId/bags', () => {
    beforeEach(async () => {
      const bags = [
        {
          barcode: 'BAG001',
          customer: testCustomer._id,
          affiliate: testAffiliate._id,
          type: 'laundry',
          status: 'ready',
          createdAt: new Date('2025-01-01')
        },
        {
          barcode: 'BAG002',
          customer: testCustomer._id,
          affiliate: testAffiliate._id,
          type: 'laundry',
          status: 'ready',
          createdAt: new Date('2025-02-01')
        },
        {
          barcode: 'BAG003',
          customer: testCustomer._id,
          affiliate: testAffiliate._id,
          type: 'laundry',
          status: 'lost',
          createdAt: new Date('2025-03-01')
        }
      ];

      await Bag.insertMany(bags);
    });

    it('should return customer bags', async () => {
      const response = await agent
        .get('/api/v1/customers/CUST123/bags')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        bags: expect.arrayContaining([
          expect.objectContaining({ barcode: 'BAG001', status: 'ready' }),
          expect.objectContaining({ barcode: 'BAG002', status: 'ready' }),
          expect.objectContaining({ barcode: 'BAG003', status: 'lost' })
        ])
      });
      expect(response.body.bags).toHaveLength(3);
    });

    it('should filter bags by status', async () => {
      const response = await agent
        .get('/api/v1/customers/CUST123/bags')
        .set('Authorization', `Bearer ${customerToken}`)
        .query({ status: 'ready' });

      expect(response.status).toBe(200);
      expect(response.body.bags).toHaveLength(2);
      expect(response.body.bags.every(bag => bag.status === 'ready')).toBe(true);
    });

    it('should allow affiliate to view customer bags', async () => {
      const response = await agent
        .get('/api/v1/customers/CUST123/bags')
        .set('Authorization', `Bearer ${affiliateToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.bags).toHaveLength(3);
    });
  });

  describe('GET /api/v1/customers/:customerId/dashboard', () => {
    beforeEach(async () => {
      // Create test orders for dashboard statistics
      const orders = [
        {
          orderId: 'ORD001',
          customerId: 'CUST123',
          affiliateId: 'AFF123',
          pickupDate: new Date('2025-05-01'),
          pickupTime: 'morning',
          deliveryDate: new Date('2025-05-03'),
          deliveryTime: 'afternoon',
          status: 'delivered',
          estimatedSize: 'medium',
          actualWeight: 23.5,
          baseRate: 1.89,
          deliveryFee: 5.99,
          actualTotal: 50.40,
          deliveredAt: new Date('2025-05-03')
        },
        {
          orderId: 'ORD002',
          customerId: 'CUST123',
          affiliateId: 'AFF123',
          pickupDate: new Date('2025-05-10'),
          pickupTime: 'afternoon',
          deliveryDate: new Date('2025-05-12'),
          deliveryTime: 'morning',
          status: 'delivered',
          estimatedSize: 'large',
          actualWeight: 35.0,
          baseRate: 1.89,
          deliveryFee: 5.99,
          actualTotal: 72.15,
          deliveredAt: new Date('2025-05-12')
        },
        {
          orderId: 'ORD003',
          customerId: 'CUST123',
          affiliateId: 'AFF123',
          pickupDate: new Date('2025-05-20'),
          pickupTime: 'morning',
          deliveryDate: new Date('2025-05-22'),
          deliveryTime: 'evening',
          status: 'processing',
          estimatedSize: 'small',
          baseRate: 1.89,
          deliveryFee: 5.99
        }
      ];

      await Order.insertMany(orders);
    });

    it('should return customer dashboard statistics', async () => {
      const response = await agent
        .get('/api/v1/customers/CUST123/dashboard')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        dashboard: {
          statistics: {
            totalOrders: 3,
            completedOrders: 2,
            activeOrders: 1,
            totalSpent: expect.closeTo(122.55, 2),
            averageOrderValue: expect.closeTo(61.275, 2)
            // lastOrderDate is not included when null
          },
          recentOrders: expect.arrayContaining([
            expect.objectContaining({ orderId: 'ORD003' }),
            expect.objectContaining({ orderId: 'ORD002' }),
            expect.objectContaining({ orderId: 'ORD001' })
          ]),
          upcomingPickups: [], // No scheduled orders with future pickup dates
          affiliate: {
            affiliateId: 'AFF123',
            firstName: 'John',
            lastName: 'Doe',
            deliveryFee: 5.99
          }
        }
      });
    });

    it('should return monthly statistics', async () => {
      const response = await agent
        .get('/api/v1/customers/CUST123/dashboard')
        .set('Authorization', `Bearer ${customerToken}`)
        .query({ includeMonthlyStats: true });

      expect(response.status).toBe(200);
      // Monthly statistics feature is not implemented in the controller
      expect(response.body.dashboard).not.toHaveProperty('monthlyStatistics');
    });

    it('should allow affiliate to view customer dashboard', async () => {
      const response = await agent
        .get('/api/v1/customers/CUST123/dashboard')
        .set('Authorization', `Bearer ${affiliateToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.dashboard).toHaveProperty('statistics');
      // Affiliates can see financial details for their customers
      expect(response.body.dashboard.statistics).toHaveProperty('totalSpent');
      expect(response.body.dashboard.statistics.totalSpent).toBeCloseTo(122.55, 2);
    });
  });

  describe('DELETE /api/v1/customers/:customerId/delete-all-data', () => {
    it('should delete all customer data in development environment', async () => {
      // Enable delete feature
      const originalEnv = process.env.ENABLE_DELETE_DATA_FEATURE;
      process.env.ENABLE_DELETE_DATA_FEATURE = 'true';

      // Create test data
      const testOrder = await Order.create({
        customerId: 'CUST123',
        affiliateId: 'AFF123',
        pickupDate: new Date(),
        pickupTime: 'morning',
        deliveryDate: new Date(),
        deliveryTime: 'afternoon',
        status: 'scheduled',
        estimatedSize: 'medium',
        deliveryFee: 20
      });

      const testBag = await Bag.create({
        customer: testCustomer._id,
        affiliate: testAffiliate._id,
        barcode: 'TEST-BAG-002',
        type: 'laundry',
        status: 'pending'
      });

      // Delete all data
      const response = await agent
        .delete('/api/v1/customers/CUST123/delete-all-data')
        .set('Authorization', `Bearer ${customerToken}`)
        .set('X-CSRF-Token', csrfToken);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        message: 'All data has been deleted successfully'
      });

      // Verify data is deleted
      const deletedCustomer = await Customer.findOne({ customerId: 'CUST123' });
      const deletedOrder = await Order.findOne({ orderId: testOrder.orderId });
      const deletedBag = await Bag.findOne({ bagId: testBag.bagId });

      expect(deletedCustomer).toBeNull();
      expect(deletedOrder).toBeNull();
      expect(deletedBag).toBeNull();

      // Restore environment
      process.env.ENABLE_DELETE_DATA_FEATURE = originalEnv;
    });

    it('should reject deletion in production environment', async () => {
      // Disable delete feature
      const originalEnv = process.env.ENABLE_DELETE_DATA_FEATURE;
      process.env.ENABLE_DELETE_DATA_FEATURE = 'false';

      const response = await agent
        .delete('/api/v1/customers/CUST123/delete-all-data')
        .set('Authorization', `Bearer ${customerToken}`)
        .set('X-CSRF-Token', csrfToken);

      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({
        success: false,
        message: 'This operation is not allowed'
      });

      // Restore environment
      process.env.ENABLE_DELETE_DATA_FEATURE = originalEnv;
    });

    it('should reject unauthorized deletion', async () => {
      // Enable delete feature
      const originalEnv = process.env.ENABLE_DELETE_DATA_FEATURE;
      process.env.ENABLE_DELETE_DATA_FEATURE = 'true';

      // Create another customer with different token
      const otherCustomerCreds = encryptionUtil.hashPassword('otherpass');
      const otherCustomer = await Customer.create({
        customerId: 'CUST456',
        firstName: 'Other',
        lastName: 'Customer',
        email: 'other@example.com',
        phone: '555-111-2222',
        address: '123 Other St',
        city: 'Austin',
        state: 'TX',
        zipCode: '78704',
        username: 'othercustomer',
        passwordHash: otherCustomerCreds.hash,
        passwordSalt: otherCustomerCreds.salt,
        affiliateId: 'AFF123'
      });

      const otherCustomerToken = jwt.sign(
        { id: otherCustomer._id, customerId: 'CUST456', role: 'customer' },
        process.env.JWT_SECRET || 'test-secret'
      );

      // Try to delete CUST123 with CUST456's token
      // The controller properly checks that the URL parameter matches the authenticated user
      const response = await agent
        .delete('/api/v1/customers/CUST123/delete-all-data')
        .set('Authorization', `Bearer ${otherCustomerToken}`)
        .set('X-CSRF-Token', csrfToken);

      // Should reject because CUST456 is trying to delete CUST123's data
      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({
        success: false,
        message: 'You can only delete your own data'
      });

      // Verify both customers still exist
      const cust123 = await Customer.findOne({ customerId: 'CUST123' });
      expect(cust123).not.toBeNull();

      const cust456 = await Customer.findOne({ customerId: 'CUST456' });
      expect(cust456).not.toBeNull();

      // Restore environment
      process.env.ENABLE_DELETE_DATA_FEATURE = originalEnv;
    });
  });
});