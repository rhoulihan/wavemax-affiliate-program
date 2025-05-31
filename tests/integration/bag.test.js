const request = require('supertest');
const app = require('../../server');
const Bag = require('../../server/models/Bag');
const Customer = require('../../server/models/Customer');
const Affiliate = require('../../server/models/Affiliate');
const Administrator = require('../../server/models/Administrator');
const Operator = require('../../server/models/Operator');
const encryptionUtil = require('../../server/utils/encryption');
const { getCsrfToken, createAgent } = require('../helpers/csrfHelper');
const mongoose = require('mongoose');

describe('Bag Management Integration Tests', () => {
  let agent;
  let customerAgent;
  let affiliateAgent;
  let adminAgent;
  let operatorAgent;
  let csrfToken;
  let customerCsrfToken;
  let affiliateCsrfToken;
  let adminCsrfToken;
  let operatorCsrfToken;
  let customerToken;
  let affiliateToken;
  let adminToken;
  let operatorToken;
  let testCustomer;
  let testAffiliate;
  let testAdmin;
  let testOperator;

  beforeEach(async () => {
    // Clear database
    await Bag.deleteMany({});
    await Customer.deleteMany({});
    await Affiliate.deleteMany({});
    await Administrator.deleteMany({});
    await Operator.deleteMany({});

    // Create agents with session support
    agent = createAgent(app);
    customerAgent = createAgent(app);
    affiliateAgent = createAgent(app);
    adminAgent = createAgent(app);
    operatorAgent = createAgent(app);

    // Get CSRF tokens for each agent (they have different sessions)
    csrfToken = await getCsrfToken(app, agent);
    customerCsrfToken = await getCsrfToken(app, customerAgent);
    affiliateCsrfToken = await getCsrfToken(app, affiliateAgent);
    adminCsrfToken = await getCsrfToken(app, adminAgent);
    operatorCsrfToken = await getCsrfToken(app, operatorAgent);

    // Create test affiliate
    const { hash: affHash, salt: affSalt } = encryptionUtil.hashPassword('AffPass123!');
    testAffiliate = await Affiliate.create({
      affiliateId: 'AFF001',
      firstName: 'Test',
      lastName: 'Affiliate',
      email: 'affiliate@test.com',
      phone: '555-123-4567',
      address: '123 Main St',
      city: 'Austin',
      state: 'TX',
      zipCode: '78701',
      serviceArea: 'Downtown',
      deliveryFee: 5.99,
      username: 'testaffiliate',
      passwordHash: affHash,
      passwordSalt: affSalt,
      paymentMethod: 'directDeposit'
    });

    // Create test customer
    const { hash: custHash, salt: custSalt } = encryptionUtil.hashPassword('CustPass123!');
    testCustomer = await Customer.create({
      customerId: 'CUST001',
      firstName: 'Test',
      lastName: 'Customer',
      email: 'customer@test.com',
      phone: '555-987-6543',
      address: '456 Oak St',
      city: 'Austin',
      state: 'TX',
      zipCode: '78702',
      username: 'testcustomer',
      passwordHash: custHash,
      passwordSalt: custSalt,
      affiliateId: testAffiliate.affiliateId,
      status: 'active'
    });

    // Create test administrator
    testAdmin = await Administrator.create({
      adminId: 'ADMIN001',
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin@wavemax.com',
      password: 'AdminPass123!',
      permissions: ['all']
    });

    // Create test operator
    testOperator = await Operator.create({
      operatorId: 'OPR001',
      firstName: 'Test',
      lastName: 'Operator',
      email: 'operator@wavemax.com',
      password: 'OperatorPass123!',
      createdBy: testAdmin._id
    });

    // Login as customer
    const customerLogin = await customerAgent
      .post('/api/v1/auth/customer/login')
      .send({
        username: 'testcustomer',
        password: 'CustPass123!'
      });
    customerToken = customerLogin.body.token;

    // Login as affiliate
    const affiliateLogin = await affiliateAgent
      .post('/api/v1/auth/affiliate/login')
      .send({
        username: 'testaffiliate',
        password: 'AffPass123!'
      });
    affiliateToken = affiliateLogin.body.token;

    // Login as admin
    const adminLogin = await adminAgent
      .post('/api/v1/auth/administrator/login')
      .send({
        email: 'admin@wavemax.com',
        password: 'AdminPass123!'
      });
    adminToken = adminLogin.body.token;

    // Login as operator
    const operatorLogin = await operatorAgent
      .post('/api/v1/auth/operator/login')
      .send({
        email: 'operator@wavemax.com',
        password: 'OperatorPass123!'
      });
    operatorToken = operatorLogin.body.token;
  });

  describe('POST /api/v1/bags', () => {
    it('should create a new bag for customer', async () => {
      const newBag = {
        tagNumber: 'BAG001',
        type: 'laundry',
        weight: 10.5,
        notes: 'Delicate items'
      };

      const response = await customerAgent
        .post('/api/v1/bags')
        .set('Authorization', `Bearer ${customerToken}`)
        .set('x-csrf-token', customerCsrfToken)
        .send(newBag);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.bag).toMatchObject({
        bagId: expect.stringMatching(/^BG/),
        tagNumber: 'BAG001',
        customer: testCustomer._id.toString(),
        affiliate: testAffiliate._id.toString(),
        type: 'laundry',
        weight: 10.5,
        status: 'pending',
        notes: 'Delicate items'
      });
    });

    it('should auto-generate bagId if not provided', async () => {
      const response = await customerAgent
        .post('/api/v1/bags')
        .set('Authorization', `Bearer ${customerToken}`)
        .set('x-csrf-token', customerCsrfToken)
        .send({
          type: 'laundry'
        });

      expect(response.status).toBe(201);
      expect(response.body.bag.bagId).toMatch(/^BG[A-Z0-9]+$/);
    });

    it('should validate required fields', async () => {
      const response = await customerAgent
        .post('/api/v1/bags')
        .set('Authorization', `Bearer ${customerToken}`)
        .set('x-csrf-token', customerCsrfToken)
        .send({
          // Missing type
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Bag type is required');
    });

    it('should validate bag type enum', async () => {
      const response = await customerAgent
        .post('/api/v1/bags')
        .set('Authorization', `Bearer ${customerToken}`)
        .set('x-csrf-token', customerCsrfToken)
        .send({
          type: 'invalid-type'
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Invalid bag type');
    });

    it('should allow affiliate to create bag for their customer', async () => {
      const response = await affiliateAgent
        .post('/api/v1/bags')
        .set('Authorization', `Bearer ${affiliateToken}`)
        .set('x-csrf-token', affiliateCsrfToken)
        .send({
          customerId: testCustomer.customerId,
          tagNumber: 'BAG002',
          type: 'dryClean',
          weight: 5.0
        });

      expect(response.status).toBe(201);
      expect(response.body.bag.customer).toBe(testCustomer._id.toString());
      expect(response.body.bag.affiliate).toBe(testAffiliate._id.toString());
    });

    it('should prevent affiliate from creating bag for other affiliate\'s customer', async () => {
      // Create another affiliate and customer
      const { hash, salt } = encryptionUtil.hashPassword('password123');
      const otherAffiliate = await Affiliate.create({
        affiliateId: 'AFF002',
        firstName: 'Other',
        lastName: 'Affiliate',
        email: 'other@test.com',
        username: 'otheraffil',
        passwordHash: hash,
        passwordSalt: salt,
        phone: '555-111-2222',
        address: '789 Pine St',
        city: 'Austin',
        state: 'TX',
        zipCode: '78703',
        serviceArea: 'North',
        deliveryFee: 5.99,
        paymentMethod: 'paypal'
      });

      const otherCustomer = await Customer.create({
        customerId: 'CUST002',
        firstName: 'Other',
        lastName: 'Customer',
        email: 'other@customer.com',
        username: 'othercust',
        passwordHash: hash,
        passwordSalt: salt,
        phone: '555-333-4444',
        address: '321 Elm St',
        city: 'Austin',
        state: 'TX',
        zipCode: '78704',
        affiliateId: otherAffiliate.affiliateId,
        status: 'active'
      });

      const response = await affiliateAgent
        .post('/api/v1/bags')
        .set('Authorization', `Bearer ${affiliateToken}`)
        .set('x-csrf-token', affiliateCsrfToken)
        .send({
          customerId: otherCustomer.customerId,
          type: 'laundry'
        });

      expect(response.status).toBe(403);
      expect(response.body.message).toContain('You can only create bags for your own customers');
    });

    it('should require authentication', async () => {
      const response = await agent
        .post('/api/v1/bags')
        .send({
          type: 'laundry'
        });

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/v1/bags', () => {
    let testBags;

    beforeEach(async () => {
      // Create test bags
      testBags = await Bag.create([
        {
          bagId: 'BG001',
          tagNumber: 'TAG001',
          customer: testCustomer._id,
          affiliate: testAffiliate._id,
          type: 'laundry',
          weight: 10,
          status: 'pending'
        },
        {
          bagId: 'BG002',
          tagNumber: 'TAG002',
          customer: testCustomer._id,
          affiliate: testAffiliate._id,
          type: 'dryClean',
          weight: 5,
          status: 'processing'
        },
        {
          bagId: 'BG003',
          tagNumber: 'TAG003',
          customer: testCustomer._id,
          affiliate: testAffiliate._id,
          type: 'laundry',
          weight: 15,
          status: 'ready',
          readyAt: new Date()
        }
      ]);
    });

    it('should get customer\'s bags', async () => {
      const response = await customerAgent
        .get('/api/v1/bags')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.bags).toHaveLength(3);
      expect(response.body.bags[0]).toMatchObject({
        bagId: expect.any(String),
        tagNumber: expect.any(String),
        type: expect.any(String),
        status: expect.any(String)
      });
    });

    it('should filter by status', async () => {
      const response = await customerAgent
        .get('/api/v1/bags?status=pending')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.bags).toHaveLength(1);
      expect(response.body.bags[0].status).toBe('pending');
    });

    it('should filter by type', async () => {
      const response = await customerAgent
        .get('/api/v1/bags?type=dryClean')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.bags).toHaveLength(1);
      expect(response.body.bags[0].type).toBe('dryClean');
    });

    it('should support pagination', async () => {
      // Create more bags
      const moreBags = [];
      for (let i = 4; i <= 15; i++) {
        moreBags.push({
          bagId: `BG${String(i).padStart(3, '0')}`,
          customer: testCustomer._id,
          affiliate: testAffiliate._id,
          type: 'laundry',
          status: 'pending'
        });
      }
      await Bag.create(moreBags);

      const response = await customerAgent
        .get('/api/v1/bags?page=2&limit=5')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.bags).toHaveLength(5);
      expect(response.body.pagination).toMatchObject({
        currentPage: 2,
        totalPages: 3,
        totalItems: 15,
        itemsPerPage: 5
      });
    });

    it('should allow affiliate to view customer bags', async () => {
      const response = await affiliateAgent
        .get(`/api/v1/bags?customerId=${testCustomer.customerId}`)
        .set('Authorization', `Bearer ${affiliateToken}`);

      expect(response.status).toBe(200);
      expect(response.body.bags).toHaveLength(3);
    });

    it('should allow admin to view all bags', async () => {
      const response = await adminAgent
        .get('/api/v1/bags')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.bags).toHaveLength(3);
    });
  });

  describe('GET /api/v1/bags/:id', () => {
    let testBag;

    beforeEach(async () => {
      testBag = await Bag.create({
        bagId: 'BG001',
        tagNumber: 'TAG001',
        customer: testCustomer._id,
        affiliate: testAffiliate._id,
        type: 'laundry',
        weight: 10,
        status: 'pending',
        notes: 'Handle with care'
      });
    });

    it('should get bag details', async () => {
      const response = await customerAgent
        .get(`/api/v1/bags/${testBag._id}`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.bag).toMatchObject({
        bagId: 'BG001',
        tagNumber: 'TAG001',
        type: 'laundry',
        weight: 10,
        status: 'pending',
        notes: 'Handle with care'
      });
    });

    it('should populate customer and affiliate details', async () => {
      const response = await adminAgent
        .get(`/api/v1/bags/${testBag._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.bag.customer).toMatchObject({
        _id: testCustomer._id.toString(),
        firstName: 'Test',
        lastName: 'Customer',
        email: 'customer@test.com'
      });
      expect(response.body.bag.affiliate).toMatchObject({
        _id: testAffiliate._id.toString(),
        firstName: 'Test',
        lastName: 'Affiliate',
        email: 'affiliate@test.com'
      });
    });

    it('should prevent access to other customer\'s bags', async () => {
      // Create another customer
      const { hash, salt } = encryptionUtil.hashPassword('password123');
      const otherCustomer = await Customer.create({
        customerId: 'CUST002',
        firstName: 'Other',
        lastName: 'Customer',
        email: 'other@customer.com',
        username: 'othercust',
        passwordHash: hash,
        passwordSalt: salt,
        phone: '555-111-2222',
        address: '789 Pine St',
        city: 'Austin',
        state: 'TX',
        zipCode: '78703',
        affiliateId: testAffiliate.affiliateId,
        status: 'active'
      });

      const otherLogin = await agent
        .post('/api/v1/auth/customer/login')
        .send({
          username: 'othercust',
          password: 'password123'
        });

      const response = await agent
        .get(`/api/v1/bags/${testBag._id}`)
        .set('Authorization', `Bearer ${otherLogin.body.token}`);

      expect(response.status).toBe(403);
      expect(response.body.message).toContain('You can only view your own bags');
    });

    it('should return 404 for non-existent bag', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      
      const response = await customerAgent
        .get(`/api/v1/bags/${fakeId}`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(response.status).toBe(404);
      expect(response.body.message).toContain('Bag not found');
    });
  });

  describe('PATCH /api/v1/bags/:id', () => {
    let testBag;

    beforeEach(async () => {
      testBag = await Bag.create({
        bagId: 'BG001',
        tagNumber: 'TAG001',
        customer: testCustomer._id,
        affiliate: testAffiliate._id,
        type: 'laundry',
        weight: 10,
        status: 'pending'
      });
    });

    it('should update bag details', async () => {
      const response = await affiliateAgent
        .patch(`/api/v1/bags/${testBag._id}`)
        .set('Authorization', `Bearer ${affiliateToken}`)
        .set('x-csrf-token', affiliateCsrfToken)
        .send({
          weight: 12.5,
          notes: 'Updated weight after inspection'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.bag.weight).toBe(12.5);
      expect(response.body.bag.notes).toBe('Updated weight after inspection');
    });

    it('should update bag status', async () => {
      const response = await operatorAgent
        .patch(`/api/v1/bags/${testBag._id}`)
        .set('Authorization', `Bearer ${operatorToken}`)
        .set('x-csrf-token', operatorCsrfToken)
        .send({
          status: 'processing'
        });

      expect(response.status).toBe(200);
      expect(response.body.bag.status).toBe('processing');
      expect(response.body.bag.processedBy).toBe(testOperator._id.toString());
      expect(response.body.bag.processingStartedAt).toBeDefined();
    });

    it('should set readyAt when status changes to ready', async () => {
      const response = await operatorAgent
        .patch(`/api/v1/bags/${testBag._id}`)
        .set('Authorization', `Bearer ${operatorToken}`)
        .set('x-csrf-token', operatorCsrfToken)
        .send({
          status: 'ready'
        });

      expect(response.status).toBe(200);
      expect(response.body.bag.status).toBe('ready');
      expect(response.body.bag.readyAt).toBeDefined();
    });

    it('should set deliveredAt when status changes to delivered', async () => {
      const response = await affiliateAgent
        .patch(`/api/v1/bags/${testBag._id}`)
        .set('Authorization', `Bearer ${affiliateToken}`)
        .set('x-csrf-token', affiliateCsrfToken)
        .send({
          status: 'delivered'
        });

      expect(response.status).toBe(200);
      expect(response.body.bag.status).toBe('delivered');
      expect(response.body.bag.deliveredAt).toBeDefined();
    });

    it('should prevent invalid status transitions', async () => {
      // Set bag to delivered
      testBag.status = 'delivered';
      testBag.deliveredAt = new Date();
      await testBag.save();

      const response = await operatorAgent
        .patch(`/api/v1/bags/${testBag._id}`)
        .set('Authorization', `Bearer ${operatorToken}`)
        .set('x-csrf-token', operatorCsrfToken)
        .send({
          status: 'pending'
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Invalid status transition');
    });

    it('should not allow updating bagId', async () => {
      const response = await adminAgent
        .patch(`/api/v1/bags/${testBag._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-csrf-token', adminCsrfToken)
        .send({
          bagId: 'CHANGED001'
        });

      expect(response.status).toBe(200);
      expect(response.body.bag.bagId).toBe('BG001'); // Unchanged
    });

    it('should not allow customers to update bags', async () => {
      const response = await customerAgent
        .patch(`/api/v1/bags/${testBag._id}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .set('x-csrf-token', customerCsrfToken)
        .send({
          weight: 20
        });

      expect(response.status).toBe(403);
      expect(response.body.message).toContain('Access denied');
    });
  });

  describe('DELETE /api/v1/bags/:id', () => {
    let testBag;

    beforeEach(async () => {
      testBag = await Bag.create({
        bagId: 'BG001',
        tagNumber: 'TAG001',
        customer: testCustomer._id,
        affiliate: testAffiliate._id,
        type: 'laundry',
        status: 'pending'
      });
    });

    it('should allow admin to delete bag', async () => {
      const response = await adminAgent
        .delete(`/api/v1/bags/${testBag._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-csrf-token', adminCsrfToken);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Bag deleted successfully');

      // Verify bag is deleted
      const checkBag = await Bag.findById(testBag._id);
      expect(checkBag).toBeNull();
    });

    it('should prevent deleting delivered bags', async () => {
      testBag.status = 'delivered';
      testBag.deliveredAt = new Date();
      await testBag.save();

      const response = await adminAgent
        .delete(`/api/v1/bags/${testBag._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-csrf-token', adminCsrfToken);

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Cannot delete delivered bags');
    });

    it('should prevent non-admins from deleting bags', async () => {
      const response = await affiliateAgent
        .delete(`/api/v1/bags/${testBag._id}`)
        .set('Authorization', `Bearer ${affiliateToken}`)
        .set('x-csrf-token', affiliateCsrfToken);

      expect(response.status).toBe(403);
      expect(response.body.message).toContain('Access denied');
    });
  });

  describe('GET /api/v1/bags/search', () => {
    beforeEach(async () => {
      // Create bags with different tag numbers
      await Bag.create([
        {
          bagId: 'BG001',
          tagNumber: 'TAG001',
          customer: testCustomer._id,
          affiliate: testAffiliate._id,
          type: 'laundry',
          status: 'pending'
        },
        {
          bagId: 'BG002',
          tagNumber: 'TAG002', 
          customer: testCustomer._id,
          affiliate: testAffiliate._id,
          type: 'dryClean',
          status: 'processing'
        },
        {
          bagId: 'BG003',
          tagNumber: 'SPECIAL123',
          customer: testCustomer._id,
          affiliate: testAffiliate._id,
          type: 'laundry',
          status: 'ready'
        }
      ]);
    });

    it('should search bags by tag number', async () => {
      const response = await affiliateAgent
        .get('/api/v1/bags/search?tagNumber=TAG')
        .set('Authorization', `Bearer ${affiliateToken}`);

      expect(response.status).toBe(200);
      expect(response.body.bags).toHaveLength(2);
      expect(response.body.bags.every(bag => bag.tagNumber.includes('TAG'))).toBe(true);
    });

    it('should find exact tag number match', async () => {
      const response = await operatorAgent
        .get('/api/v1/bags/search?tagNumber=SPECIAL123')
        .set('Authorization', `Bearer ${operatorToken}`);

      expect(response.status).toBe(200);
      expect(response.body.bags).toHaveLength(1);
      expect(response.body.bags[0].tagNumber).toBe('SPECIAL123');
    });

    it('should return empty array for no matches', async () => {
      const response = await adminAgent
        .get('/api/v1/bags/search?tagNumber=NONEXISTENT')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.bags).toHaveLength(0);
    });

    it('should require tagNumber parameter', async () => {
      const response = await adminAgent
        .get('/api/v1/bags/search')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Tag number is required');
    });

    it('should respect role-based access', async () => {
      // Create another affiliate's customer and bag
      const { hash, salt } = encryptionUtil.hashPassword('password123');
      const otherAffiliate = await Affiliate.create({
        affiliateId: 'AFF002',
        firstName: 'Other',
        lastName: 'Affiliate',
        email: 'other@affiliate.com',
        username: 'otheraffil',
        passwordHash: hash,
        passwordSalt: salt,
        phone: '555-111-2222',
        address: '789 Pine St',
        city: 'Austin',
        state: 'TX',
        zipCode: '78703',
        serviceArea: 'North',
        deliveryFee: 5.99,
        paymentMethod: 'paypal'
      });

      const otherCustomer = await Customer.create({
        customerId: 'CUST002',
        firstName: 'Other',
        lastName: 'Customer',
        email: 'other@customer.com',
        username: 'othercust',
        passwordHash: hash,
        passwordSalt: salt,
        phone: '555-333-4444',
        address: '321 Elm St',
        city: 'Austin',
        state: 'TX',
        zipCode: '78704',
        affiliateId: otherAffiliate.affiliateId,
        status: 'active'
      });

      await Bag.create({
        bagId: 'BG004',
        tagNumber: 'TAG004',
        customer: otherCustomer._id,
        affiliate: otherAffiliate._id,
        type: 'laundry',
        status: 'pending'
      });

      // Affiliate should only see their own customer's bags
      const response = await affiliateAgent
        .get('/api/v1/bags/search?tagNumber=TAG')
        .set('Authorization', `Bearer ${affiliateToken}`);

      expect(response.status).toBe(200);
      expect(response.body.bags).toHaveLength(2); // Only TAG001 and TAG002
      expect(response.body.bags.every(bag => 
        bag.affiliate._id === testAffiliate._id.toString()
      )).toBe(true);
    });
  });

  describe('POST /api/v1/bags/:id/report-lost', () => {
    let testBag;

    beforeEach(async () => {
      testBag = await Bag.create({
        bagId: 'BG001',
        tagNumber: 'TAG001',
        customer: testCustomer._id,
        affiliate: testAffiliate._id,
        type: 'laundry',
        status: 'ready'
      });
    });

    it('should report bag as lost', async () => {
      const response = await affiliateAgent
        .post(`/api/v1/bags/${testBag._id}/report-lost`)
        .set('Authorization', `Bearer ${affiliateToken}`)
        .set('x-csrf-token', affiliateCsrfToken)
        .send({
          reason: 'Cannot locate bag in storage area'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.bag.status).toBe('lost');
      expect(response.body.bag.lostDetails).toMatchObject({
        reportedAt: expect.any(String),
        reportedBy: testAffiliate._id.toString(),
        reason: 'Cannot locate bag in storage area'
      });
    });

    it('should require reason for lost report', async () => {
      const response = await affiliateAgent
        .post(`/api/v1/bags/${testBag._id}/report-lost`)
        .set('Authorization', `Bearer ${affiliateToken}`)
        .set('x-csrf-token', affiliateCsrfToken)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Reason is required');
    });

    it('should prevent reporting delivered bags as lost', async () => {
      testBag.status = 'delivered';
      testBag.deliveredAt = new Date();
      await testBag.save();

      const response = await affiliateAgent
        .post(`/api/v1/bags/${testBag._id}/report-lost`)
        .set('Authorization', `Bearer ${affiliateToken}`)
        .set('x-csrf-token', affiliateCsrfToken)
        .send({
          reason: 'Lost after delivery'
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Cannot report delivered bag as lost');
    });

    it('should allow customer to report their own bag as lost', async () => {
      const response = await customerAgent
        .post(`/api/v1/bags/${testBag._id}/report-lost`)
        .set('Authorization', `Bearer ${customerToken}`)
        .set('x-csrf-token', customerCsrfToken)
        .send({
          reason: 'Did not receive my bag'
        });

      expect(response.status).toBe(200);
      expect(response.body.bag.status).toBe('lost');
    });
  });
});