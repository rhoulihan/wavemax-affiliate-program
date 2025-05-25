const request = require('supertest');
const app = require('../../server');
const Customer = require('../../server/models/Customer');
const Affiliate = require('../../server/models/Affiliate');
const Order = require('../../server/models/Order');
const Bag = require('../../server/models/Bag');
const encryptionUtil = require('../../server/utils/encryption');
const jwt = require('jsonwebtoken');

describe('Customer Integration Tests', () => {
  let testAffiliate;
  let testCustomer;
  let customerToken;
  let affiliateToken;

  beforeEach(async () => {
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

  describe('POST /api/customers/register', () => {
    it('should register a new customer', async () => {
      const response = await request(app)
        .post('/api/customers/register')
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
      const bag = await Bag.findOne({ customerId: customer.customerId });
      expect(bag).toBeTruthy();
      expect(bag.status).toBe('active');
    });

    it('should fail with invalid affiliate ID', async () => {
      const response = await request(app)
        .post('/api/customers/register')
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
      const response = await request(app)
        .post('/api/customers/register')
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
        message: 'Email or username already exists'
      });
    });

    it('should fail with duplicate username', async () => {
      const response = await request(app)
        .post('/api/customers/register')
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
        message: 'Email or username already exists'
      });
    });
  });

  describe('GET /api/customers/:customerId/profile', () => {
    it('should return customer profile for authenticated customer', async () => {
      const response = await request(app)
        .get('/api/customers/CUST123/profile')
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
      const response = await request(app)
        .get('/api/customers/CUST123/profile')
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

      const response = await request(app)
        .get('/api/customers/CUST123/profile')
        .set('Authorization', `Bearer ${otherCustomerToken}`);

      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({
        success: false,
        message: 'Unauthorized'
      });
    });

    it('should fail without authentication', async () => {
      const response = await request(app)
        .get('/api/customers/CUST123/profile');

      expect(response.status).toBe(401);
    });
  });

  describe('PUT /api/customers/:customerId/profile', () => {
    it('should update customer profile', async () => {
      const response = await request(app)
        .put('/api/customers/CUST123/profile')
        .set('Authorization', `Bearer ${customerToken}`)
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
      const response = await request(app)
        .put('/api/customers/CUST123/profile')
        .set('Authorization', `Bearer ${customerToken}`)
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

  describe('GET /api/customers/:customerId/orders', () => {
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
      const response = await request(app)
        .get('/api/customers/CUST123/orders')
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
      const response = await request(app)
        .get('/api/customers/CUST123/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .query({ status: 'delivered' });

      expect(response.status).toBe(200);
      expect(response.body.orders).toHaveLength(1);
      expect(response.body.orders[0].orderId).toBe('ORD001');
    });
  });

  describe('POST /api/customers/report-lost-bag', () => {
    beforeEach(async () => {
      // Create test bag
      const bag = new Bag({
        bagBarcode: 'BAG123',
        customerId: 'CUST123',
        status: 'active'
      });
      await bag.save();
    });

    it('should report lost bag', async () => {
      const response = await request(app)
        .post('/api/customers/report-lost-bag')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          bagBarcode: 'BAG123'
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        message: 'Lost bag report submitted successfully'
      });

      // Verify bag status was updated
      const bag = await Bag.findOne({ bagBarcode: 'BAG123' });
      expect(bag.status).toBe('lost');
    });

    it('should fail for non-existent bag', async () => {
      const response = await request(app)
        .post('/api/customers/report-lost-bag')
        .set('Authorization', `Bearer ${customerToken}`)
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
        bagBarcode: 'BAG999',
        customerId: 'CUST999',
        status: 'active'
      });
      await otherBag.save();

      const response = await request(app)
        .post('/api/customers/report-lost-bag')
        .set('Authorization', `Bearer ${customerToken}`)
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

  describe('PUT /api/customers/:customerId/password', () => {
    it('should update customer password', async () => {
      const response = await request(app)
        .put('/api/customers/CUST123/password')
        .set('Authorization', `Bearer ${customerToken}`)
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
      const loginResponse = await request(app)
        .post('/api/auth/customer/login')
        .send({
          username: 'janesmith',
          password: 'newPassword123!'
        });

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body.success).toBe(true);
    });

    it('should fail with incorrect current password', async () => {
      const response = await request(app)
        .put('/api/customers/CUST123/password')
        .set('Authorization', `Bearer ${customerToken}`)
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
      const response = await request(app)
        .put('/api/customers/CUST123/password')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          currentPassword: 'customerpass',
          newPassword: 'weak'
        });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('Password')
      });
    });
  });

  describe('GET /api/customers/:customerId/bags', () => {
    beforeEach(async () => {
      const bags = [
        {
          bagBarcode: 'BAG001',
          customerId: 'CUST123',
          status: 'active',
          issuedDate: new Date('2025-01-01')
        },
        {
          bagBarcode: 'BAG002',
          customerId: 'CUST123',
          status: 'active',
          issuedDate: new Date('2025-02-01')
        },
        {
          bagBarcode: 'BAG003',
          customerId: 'CUST123',
          status: 'lost',
          issuedDate: new Date('2025-03-01'),
          reportedLostAt: new Date('2025-03-15')
        }
      ];

      await Bag.insertMany(bags);
    });

    it('should return customer bags', async () => {
      const response = await request(app)
        .get('/api/customers/CUST123/bags')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        bags: expect.arrayContaining([
          expect.objectContaining({ bagBarcode: 'BAG001', status: 'active' }),
          expect.objectContaining({ bagBarcode: 'BAG002', status: 'active' }),
          expect.objectContaining({ bagBarcode: 'BAG003', status: 'lost' })
        ])
      });
      expect(response.body.bags).toHaveLength(3);
    });

    it('should filter bags by status', async () => {
      const response = await request(app)
        .get('/api/customers/CUST123/bags')
        .set('Authorization', `Bearer ${customerToken}`)
        .query({ status: 'active' });

      expect(response.status).toBe(200);
      expect(response.body.bags).toHaveLength(2);
      expect(response.body.bags.every(bag => bag.status === 'active')).toBe(true);
    });

    it('should allow affiliate to view customer bags', async () => {
      const response = await request(app)
        .get('/api/customers/CUST123/bags')
        .set('Authorization', `Bearer ${affiliateToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.bags).toHaveLength(3);
    });
  });

  describe('GET /api/customers/:customerId/dashboard', () => {
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
      const response = await request(app)
        .get('/api/customers/CUST123/dashboard')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        dashboard: {
          statistics: {
            totalOrders: 3,
            completedOrders: 2,
            activeOrders: 1,
            totalSpent: 122.55,
            averageOrderValue: 61.275,
            lastOrderDate: expect.any(String)
          },
          recentOrders: expect.arrayContaining([
            expect.objectContaining({ orderId: 'ORD003' }),
            expect.objectContaining({ orderId: 'ORD002' }),
            expect.objectContaining({ orderId: 'ORD001' })
          ]),
          upcomingPickups: expect.arrayContaining([
            expect.objectContaining({ orderId: 'ORD003', status: 'processing' })
          ]),
          affiliate: {
            affiliateId: 'AFF123',
            name: 'John Doe',
            phone: '555-123-4567',
            deliveryFee: 5.99
          }
        }
      });
    });

    it('should return monthly statistics', async () => {
      const response = await request(app)
        .get('/api/customers/CUST123/dashboard')
        .set('Authorization', `Bearer ${customerToken}`)
        .query({ includeMonthlyStats: true });

      expect(response.status).toBe(200);
      expect(response.body.dashboard).toHaveProperty('monthlyStatistics');
      expect(response.body.dashboard.monthlyStatistics).toMatchObject({
        currentMonth: {
          orders: 3,
          spent: 122.55
        },
        lastMonth: {
          orders: 0,
          spent: 0
        },
        monthlyAverage: {
          orders: expect.any(Number),
          spent: expect.any(Number)
        }
      });
    });

    it('should allow affiliate to view customer dashboard', async () => {
      const response = await request(app)
        .get('/api/customers/CUST123/dashboard')
        .set('Authorization', `Bearer ${affiliateToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.dashboard).toHaveProperty('statistics');
      // Affiliate should not see financial details
      expect(response.body.dashboard.statistics).not.toHaveProperty('totalSpent');
    });
  });
});