const request = require('supertest');
const app = require('../../server');
const Affiliate = require('../../server/models/Affiliate');
const Customer = require('../../server/models/Customer');
const RefreshToken = require('../../server/models/RefreshToken');
const encryptionUtil = require('../../server/utils/encryption');

describe('Authentication Integration Tests', () => {
  beforeEach(async () => {
    // Clear database
    await Affiliate.deleteMany({});
    await Customer.deleteMany({});
    await RefreshToken.deleteMany({});
  });

  describe('POST /api/v1/auth/affiliate/login', () => {
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

      const response = await request(app)
        .post('/api/v1/auth/affiliate/login')
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

      const response = await request(app)
        .post('/api/v1/auth/affiliate/login')
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
      const response = await request(app)
        .post('/api/v1/auth/affiliate/login')
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

  describe('POST /api/v1/auth/customer/login', () => {
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

      const response = await request(app)
        .post('/api/v1/auth/customer/login')
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

  describe('GET /api/v1/auth/verify', () => {
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

      const loginResponse = await request(app)
        .post('/api/v1/auth/affiliate/login')
        .send({
          username: 'johndoe',
          password: 'password123'
        });

      const token = loginResponse.body.token;

      const response = await request(app)
        .get('/api/v1/auth/verify')
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
      const response = await request(app)
        .get('/api/v1/auth/verify')
        .set('Authorization', 'Bearer invalidtoken');

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        success: false,
        message: 'Invalid token'
      });
    });

    it('should fail with missing token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/verify');

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        success: false,
        message: 'No token provided'
      });
    });
  });

  describe('POST /api/v1/auth/refresh-token', () => {
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

      const loginResponse = await request(app)
        .post('/api/v1/auth/affiliate/login')
        .send({
          username: 'johndoe',
          password: 'password123'
        });

      const refreshToken = loginResponse.body.refreshToken;

      const response = await request(app)
        .post('/api/v1/auth/refresh-token')
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
      const response = await request(app)
        .post('/api/v1/auth/refresh-token')
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

      const response = await request(app)
        .post('/api/v1/auth/refresh-token')
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

  describe('POST /api/v1/auth/logout', () => {
    it('should logout successfully and blacklist tokens', async () => {
      // Create affiliate and get tokens
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

      const loginResponse = await request(app)
        .post('/api/v1/auth/affiliate/login')
        .send({
          username: 'johndoe',
          password: 'password123'
        });

      const token = loginResponse.body.token;
      const refreshToken = loginResponse.body.refreshToken;

      // Logout
      const logoutResponse = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .send({
          refreshToken: refreshToken
        });

      expect(logoutResponse.status).toBe(200);
      expect(logoutResponse.body).toMatchObject({
        success: true,
        message: 'Logged out successfully'
      });

      // Verify token is blacklisted
      const verifyResponse = await request(app)
        .get('/api/v1/auth/verify')
        .set('Authorization', `Bearer ${token}`);

      expect(verifyResponse.status).toBe(401);
      expect(verifyResponse.body).toMatchObject({
        success: false,
        message: 'Token has been blacklisted'
      });

      // Verify refresh token is revoked
      const refreshResponse = await request(app)
        .post('/api/v1/auth/refresh-token')
        .send({
          refreshToken: refreshToken
        });

      expect(refreshResponse.status).toBe(403);
    });
  });

  describe('Rate limiting tests', () => {
    it('should rate limit login attempts', async () => {
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

      // Make multiple failed login attempts
      const attempts = [];
      for (let i = 0; i < 6; i++) {
        attempts.push(
          request(app)
            .post('/api/v1/auth/affiliate/login')
            .send({
              username: 'johndoe',
              password: 'wrongpassword'
            })
        );
      }

      const responses = await Promise.all(attempts);

      // First 5 attempts should fail with invalid credentials
      for (let i = 0; i < 5; i++) {
        expect(responses[i].status).toBe(401);
      }

      // 6th attempt should be rate limited
      expect(responses[5].status).toBe(429);
      expect(responses[5].body).toMatchObject({
        success: false,
        message: 'Too many login attempts. Please try again later.'
      });
    });

    it('should rate limit refresh token requests', async () => {
      const attempts = [];
      for (let i = 0; i < 11; i++) {
        attempts.push(
          request(app)
            .post('/api/v1/auth/refresh-token')
            .send({
              refreshToken: 'invalidtoken'
            })
        );
      }

      const responses = await Promise.all(attempts);

      // First 10 attempts should fail with invalid token
      for (let i = 0; i < 10; i++) {
        expect(responses[i].status).toBe(403);
      }

      // 11th attempt should be rate limited
      expect(responses[10].status).toBe(429);
    });
  });

  describe('Concurrent refresh token usage', () => {
    it('should handle concurrent refresh token requests safely', async () => {
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

      const loginResponse = await request(app)
        .post('/api/v1/auth/affiliate/login')
        .send({
          username: 'johndoe',
          password: 'password123'
        });

      const refreshToken = loginResponse.body.refreshToken;

      // Make concurrent refresh requests
      const concurrentRequests = [];
      for (let i = 0; i < 5; i++) {
        concurrentRequests.push(
          request(app)
            .post('/api/v1/auth/refresh-token')
            .send({
              refreshToken: refreshToken
            })
        );
      }

      const responses = await Promise.all(concurrentRequests);

      // Only one should succeed
      const successfulResponses = responses.filter(r => r.status === 200);
      const failedResponses = responses.filter(r => r.status !== 200);

      expect(successfulResponses).toHaveLength(1);
      expect(failedResponses).toHaveLength(4);

      // The successful response should have new tokens
      expect(successfulResponses[0].body).toMatchObject({
        success: true,
        token: expect.any(String),
        refreshToken: expect.any(String)
      });

      // Failed responses should indicate the token was already used
      failedResponses.forEach(response => {
        expect(response.status).toBe(403);
        expect(response.body).toMatchObject({
          success: false,
          message: expect.stringContaining('Invalid refresh token')
        });
      });
    });
  });

  describe('Token blacklisting after logout', () => {
    it('should blacklist all active tokens on logout', async () => {
      // Create affiliate and get multiple tokens
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

      // Login and get first token
      const login1 = await request(app)
        .post('/api/v1/auth/affiliate/login')
        .send({
          username: 'johndoe',
          password: 'password123'
        });

      const token1 = login1.body.token;
      const refreshToken1 = login1.body.refreshToken;

      // Use refresh token to get second token
      const refresh1 = await request(app)
        .post('/api/v1/auth/refresh-token')
        .send({
          refreshToken: refreshToken1
        });

      const token2 = refresh1.body.token;

      // Both tokens should work before logout
      const verify1Before = await request(app)
        .get('/api/v1/auth/verify')
        .set('Authorization', `Bearer ${token1}`);

      const verify2Before = await request(app)
        .get('/api/v1/auth/verify')
        .set('Authorization', `Bearer ${token2}`);

      expect(verify1Before.status).toBe(200);
      expect(verify2Before.status).toBe(200);

      // Logout with the second token
      await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${token2}`)
        .send({
          refreshToken: refresh1.body.refreshToken
        });

      // Both tokens should be blacklisted after logout
      const verify1After = await request(app)
        .get('/api/v1/auth/verify')
        .set('Authorization', `Bearer ${token1}`);

      const verify2After = await request(app)
        .get('/api/v1/auth/verify')
        .set('Authorization', `Bearer ${token2}`);

      expect(verify1After.status).toBe(401);
      expect(verify2After.status).toBe(401);
    });
  });
});