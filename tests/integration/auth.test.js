const request = require('supertest');
const app = require('../../server');
const Affiliate = require('../../server/models/Affiliate');
const Customer = require('../../server/models/Customer');
const RefreshToken = require('../../server/models/RefreshToken');
const encryptionUtil = require('../../server/utils/encryption');

describe('Authentication Integration Tests', () => {
  let server;

  beforeAll(() => {
    server = app.listen(0);
  });

  afterAll(async () => {
    await server.close();
  });

  beforeEach(async () => {
    // Clear database
    await Affiliate.deleteMany({});
    await Customer.deleteMany({});
    await RefreshToken.deleteMany({});
  });

  describe('POST /api/auth/affiliate/login', () => {
    it('should login affiliate with valid credentials', async () => {
      // Create test affiliate
      const { hash, salt } = encryptionUtil.hashPassword('password123');
      const affiliate = new Affiliate({
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
      await affiliate.save();

      const response = await request(server)
        .post('/api/auth/affiliate/login')
        .send({
          username: 'johndoe',
          password: 'password123'
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        token: expect.any(String),
        refreshToken: expect.any(String),
        affiliate: {
          affiliateId: 'AFF123',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com'
        }
      });
    });

    it('should fail with invalid credentials', async () => {
      const { hash, salt } = encryptionUtil.hashPassword('password123');
      const affiliate = new Affiliate({
        affiliateId: 'AFF123',
        username: 'johndoe',
        passwordHash: hash,
        passwordSalt: salt,
        email: 'john@example.com',
        phone: '555-123-4567',
        address: '123 Main St',
        city: 'Austin',
        state: 'TX',
        zipCode: '78701',
        serviceArea: 'Downtown',
        deliveryFee: 5.99,
        paymentMethod: 'directDeposit'
      });
      await affiliate.save();

      const response = await request(server)
        .post('/api/auth/affiliate/login')
        .send({
          username: 'johndoe',
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        success: false,
        message: 'Invalid username or password'
      });
    });

    it('should fail with non-existent username', async () => {
      const response = await request(server)
        .post('/api/auth/affiliate/login')
        .send({
          username: 'nonexistent',
          password: 'password123'
        });

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        success: false,
        message: 'Invalid username or password'
      });
    });
  });

  describe('POST /api/auth/customer/login', () => {
    it('should login customer with valid credentials', async () => {
      // Create test affiliate
      const affiliate = new Affiliate({
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
        passwordHash: 'hash',
        passwordSalt: 'salt',
        paymentMethod: 'directDeposit'
      });
      await affiliate.save();

      // Create test customer
      const { hash, salt } = encryptionUtil.hashPassword('customerpass');
      const customer = new Customer({
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
        passwordHash: hash,
        passwordSalt: salt,
        affiliateId: 'AFF123'
      });
      await customer.save();

      const response = await request(server)
        .post('/api/auth/customer/login')
        .send({
          username: 'janesmith',
          password: 'customerpass'
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        token: expect.any(String),
        refreshToken: expect.any(String),
        customer: {
          customerId: 'CUST123',
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane@example.com',
          affiliate: {
            deliveryFee: 5.99
          }
        }
      });
    });
  });

  describe('GET /api/auth/verify', () => {
    it('should verify valid token', async () => {
      // Create affiliate and get token
      const { hash, salt } = encryptionUtil.hashPassword('password123');
      const affiliate = new Affiliate({
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
      await affiliate.save();

      const loginResponse = await request(server)
        .post('/api/auth/affiliate/login')
        .send({
          username: 'johndoe',
          password: 'password123'
        });

      const token = loginResponse.body.token;

      const response = await request(server)
        .get('/api/auth/verify')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        valid: true,
        user: {
          id: expect.any(String),
          affiliateId: 'AFF123',
          role: 'affiliate'
        }
      });
    });

    it('should fail with invalid token', async () => {
      const response = await request(server)
        .get('/api/auth/verify')
        .set('Authorization', 'Bearer invalidtoken');

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        success: false,
        message: 'Invalid token'
      });
    });

    it('should fail with missing token', async () => {
      const response = await request(server)
        .get('/api/auth/verify');

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        success: false,
        message: 'No token provided'
      });
    });
  });

  describe('POST /api/auth/refresh-token', () => {
    it('should refresh token successfully', async () => {
      // Create affiliate and get refresh token
      const { hash, salt } = encryptionUtil.hashPassword('password123');
      const affiliate = new Affiliate({
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
      await affiliate.save();

      const loginResponse = await request(server)
        .post('/api/auth/affiliate/login')
        .send({
          username: 'johndoe',
          password: 'password123'
        });

      const refreshToken = loginResponse.body.refreshToken;

      const response = await request(server)
        .post('/api/auth/refresh-token')
        .send({
          refreshToken: refreshToken
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        token: expect.any(String),
        refreshToken: expect.any(String)
      });
      expect(response.body.refreshToken).not.toBe(refreshToken); // Should be a new token
    });

    it('should fail with invalid refresh token', async () => {
      const response = await request(server)
        .post('/api/auth/refresh-token')
        .send({
          refreshToken: 'invalidrefreshtoken'
        });

      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({
        success: false,
        message: 'Invalid refresh token'
      });
    });

    it('should fail with expired refresh token', async () => {
      // Create an expired refresh token
      const expiredToken = new RefreshToken({
        token: 'expiredtoken',
        userId: 'user123',
        userType: 'affiliate',
        expiryDate: new Date(Date.now() - 86400000), // Yesterday
        createdByIp: '127.0.0.1'
      });
      await expiredToken.save();

      const response = await request(server)
        .post('/api/auth/refresh-token')
        .send({
          refreshToken: 'expiredtoken'
        });

      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({
        success: false,
        message: 'Refresh token expired'
      });
    });
  });
});