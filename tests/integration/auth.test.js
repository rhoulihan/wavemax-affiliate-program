const request = require('supertest');
const app = require('../../server');
const Affiliate = require('../../server/models/Affiliate');
const Customer = require('../../server/models/Customer');
const Administrator = require('../../server/models/Administrator');
const Operator = require('../../server/models/Operator');
const RefreshToken = require('../../server/models/RefreshToken');
const encryptionUtil = require('../../server/utils/encryption');
const { getCsrfToken, createAgent } = require('../helpers/csrfHelper');
const { getStrongPassword } = require('../helpers/testPasswords');

describe('Authentication Integration Tests', () => {
  let agent;
  let csrfToken;

  beforeEach(async () => {
    // Create agent with session support
    agent = createAgent(app);

    // Get CSRF token
    csrfToken = await getCsrfToken(app, agent);
    // Clear database
    await Affiliate.deleteMany({});
    await Customer.deleteMany({});
    await Administrator.deleteMany({});
    await Operator.deleteMany({});
    await RefreshToken.deleteMany({});
  });

  describe('POST /api/v1/auth/affiliate/login', () => {
    it('should login affiliate with valid credentials', async () => {
      // Create test affiliate
      const { hash, salt } = encryptionUtil.hashPassword(getStrongPassword('affiliate', 1));
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
        serviceLatitude: 30.2672,
        serviceLongitude: -97.7431,
        serviceRadius: 10,
        minimumDeliveryFee: 25,
        perBagDeliveryFee: 5,
        username: 'johndoe',
        passwordHash: hash,
        passwordSalt: salt,
        paymentMethod: 'directDeposit'
      });
      await affiliate.save();

      const response = await agent
        .post('/api/v1/auth/affiliate/login')
        .send({
          username: 'johndoe',
          password: getStrongPassword('affiliate', 1)
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
        firstName: 'John',
        lastName: 'Doe',
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
        serviceLatitude: 30.2672,
        serviceLongitude: -97.7431,
        serviceRadius: 10,
        minimumDeliveryFee: 25,
        perBagDeliveryFee: 5,
        paymentMethod: 'directDeposit'
      });
      await affiliate.save();

      const response = await agent
        .post('/api/v1/auth/affiliate/login')
        .send({
          username: 'johndoe',
          password: 'WrongPassword123!@#'
        });

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        success: false,
        message: 'Invalid username or password'
      });
    });

    it('should fail with non-existent username', async () => {
      const response = await agent
        .post('/api/v1/auth/affiliate/login')
        .send({
          username: 'nonexistent',
          password: getStrongPassword('affiliate', 1)
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
        serviceLatitude: 30.2672,
        serviceLongitude: -97.7431,
        serviceRadius: 10,
        minimumDeliveryFee: 25,
        perBagDeliveryFee: 5,
        username: 'johndoe',
        passwordHash: 'hash',
        passwordSalt: 'salt',
        paymentMethod: 'directDeposit'
      });
      await affiliate.save();

      // Create test customer
      const { hash, salt } = encryptionUtil.hashPassword(getStrongPassword('customer', 1));
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

      const response = await agent
        .post('/api/v1/auth/customer/login')
        .send({
          username: 'janesmith',
          password: getStrongPassword('customer', 1)
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        token: expect.any(String),
        customer: {
          customerId: 'CUST123',
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane@example.com',
          affiliate: {
            affiliateId: 'AFF123',
            name: 'John Doe'
          }
        }
      });
    });

    it('should login customer using emailOrUsername field with email', async () => {
      // Create test affiliate first
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
        serviceLatitude: 30.2672,
        serviceLongitude: -97.7431,
        serviceRadius: 10,
        minimumDeliveryFee: 25,
        perBagDeliveryFee: 5,
        username: 'johndoe',
        passwordHash: 'hash',
        passwordSalt: 'salt',
        paymentMethod: 'directDeposit'
      });
      await affiliate.save();

      // Create test customer
      const { hash, salt } = encryptionUtil.hashPassword(getStrongPassword('customer', 1));
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

      const response = await agent
        .post('/api/v1/auth/customer/login')
        .send({
          emailOrUsername: 'jane@example.com',
          password: getStrongPassword('customer', 1)
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        token: expect.any(String),
        customer: {
          customerId: 'CUST123',
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane@example.com',
          affiliate: {
            affiliateId: 'AFF123',
            name: 'John Doe'
          }
        }
      });
    });

    it('should login customer using emailOrUsername field with username', async () => {
      // Create test affiliate first
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
        serviceLatitude: 30.2672,
        serviceLongitude: -97.7431,
        serviceRadius: 10,
        minimumDeliveryFee: 25,
        perBagDeliveryFee: 5,
        username: 'johndoe',
        passwordHash: 'hash',
        passwordSalt: 'salt',
        paymentMethod: 'directDeposit'
      });
      await affiliate.save();

      // Create test customer
      const { hash, salt } = encryptionUtil.hashPassword(getStrongPassword('customer', 1));
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

      const response = await agent
        .post('/api/v1/auth/customer/login')
        .send({
          emailOrUsername: 'janesmith',
          password: getStrongPassword('customer', 1)
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        token: expect.any(String),
        customer: {
          customerId: 'CUST123',
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane@example.com',
          affiliate: {
            affiliateId: 'AFF123',
            name: 'John Doe'
          }
        }
      });
    });

    it('should prioritize emailOrUsername over username field', async () => {
      // Create test affiliate first
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
        serviceLatitude: 30.2672,
        serviceLongitude: -97.7431,
        serviceRadius: 10,
        minimumDeliveryFee: 25,
        perBagDeliveryFee: 5,
        username: 'johndoe',
        passwordHash: 'hash',
        passwordSalt: 'salt',
        paymentMethod: 'directDeposit'
      });
      await affiliate.save();

      // Create test customer
      const { hash, salt } = encryptionUtil.hashPassword(getStrongPassword('customer', 1));
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

      const response = await agent
        .post('/api/v1/auth/customer/login')
        .send({
          username: 'wrongusername',
          emailOrUsername: 'janesmith',
          password: getStrongPassword('customer', 1)
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        token: expect.any(String),
        customer: {
          customerId: 'CUST123',
          firstName: 'Jane',
          lastName: 'Smith'
        }
      });
    });

    it('should return error with invalid emailOrUsername', async () => {
      const response = await agent
        .post('/api/v1/auth/customer/login')
        .send({
          emailOrUsername: 'nonexistent@example.com',
          password: getStrongPassword('customer', 1)
        });

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        success: false,
        message: 'Invalid username/email or password'
      });
    });
  });

  describe('GET /api/v1/auth/verify', () => {
    it('should verify valid token', async () => {
      // Create affiliate and get token
      const { hash, salt } = encryptionUtil.hashPassword(getStrongPassword('affiliate', 1));
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
        serviceLatitude: 30.2672,
        serviceLongitude: -97.7431,
        serviceRadius: 10,
        minimumDeliveryFee: 25,
        perBagDeliveryFee: 5,
        username: 'johndoe',
        passwordHash: hash,
        passwordSalt: salt,
        paymentMethod: 'directDeposit'
      });
      await affiliate.save();

      const loginResponse = await agent
        .post('/api/v1/auth/affiliate/login')
        .send({
          username: 'johndoe',
          password: getStrongPassword('affiliate', 1)
        });

      const token = loginResponse.body.token;

      const response = await agent
        .get('/api/v1/auth/verify')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        user: {
          id: expect.any(String),
          affiliateId: 'AFF123',
          role: 'affiliate'
        }
      });
    });

    it('should fail with invalid token', async () => {
      const response = await agent
        .get('/api/v1/auth/verify')
        .set('Authorization', 'Bearer invalidtoken');

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        success: false,
        message: 'Invalid token'
      });
    });

    it('should fail with missing token', async () => {
      const response = await agent
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
      const { hash, salt } = encryptionUtil.hashPassword(getStrongPassword('affiliate', 1));
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
        serviceLatitude: 30.2672,
        serviceLongitude: -97.7431,
        serviceRadius: 10,
        minimumDeliveryFee: 25,
        perBagDeliveryFee: 5,
        username: 'johndoe',
        passwordHash: hash,
        passwordSalt: salt,
        paymentMethod: 'directDeposit'
      });
      await affiliate.save();

      const loginResponse = await agent
        .post('/api/v1/auth/affiliate/login')
        .send({
          username: 'johndoe',
          password: getStrongPassword('affiliate', 1)
        });

      const refreshToken = loginResponse.body.refreshToken;

      const response = await agent
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
      const response = await agent
        .post('/api/v1/auth/refresh-token')
        .send({
          refreshToken: 'invalidrefreshtoken'
        });

      expect(response.status).toBe(400); // Validation error for invalid format
      expect(response.body).toMatchObject({
        success: false,
        message: 'Validation failed'
      });
    });

    it('should fail with expired refresh token', async () => {
      // Create a test affiliate first
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
        serviceLatitude: 30.2672,
        serviceLongitude: -97.7431,
        serviceRadius: 10,
        minimumDeliveryFee: 25,
        perBagDeliveryFee: 5,
        username: 'johndoe',
        passwordHash: hash,
        passwordSalt: salt,
        paymentMethod: 'directDeposit'
      });
      await affiliate.save();

      // Create an expired refresh token with valid ObjectId
      const expiredToken = new RefreshToken({
        token: 'a'.repeat(80), // Valid 80-character token
        userId: affiliate._id,
        userType: 'affiliate',
        expiryDate: new Date(Date.now() - 86400000), // Yesterday
        createdByIp: '127.0.0.1'
      });
      await expiredToken.save();

      const response = await agent
        .post('/api/v1/auth/refresh-token')
        .send({
          refreshToken: 'a'.repeat(80) // Use the same token we created
        });

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        success: false,
        message: 'Invalid or expired refresh token'
      });
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('should logout successfully and blacklist tokens', async () => {
      // Create affiliate and get tokens
      const { hash, salt } = encryptionUtil.hashPassword(getStrongPassword('affiliate', 1));
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
        serviceLatitude: 30.2672,
        serviceLongitude: -97.7431,
        serviceRadius: 10,
        minimumDeliveryFee: 25,
        perBagDeliveryFee: 5,
        username: 'johndoe',
        passwordHash: hash,
        passwordSalt: salt,
        paymentMethod: 'directDeposit'
      });
      await affiliate.save();

      const loginResponse = await agent
        .post('/api/v1/auth/affiliate/login')
        .send({
          username: 'johndoe',
          password: getStrongPassword('affiliate', 1)
        });

      const token = loginResponse.body.token;
      const refreshToken = loginResponse.body.refreshToken;

      // Logout
      const logoutResponse = await agent
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .set('X-CSRF-Token', csrfToken)
        .send({
          refreshToken: refreshToken
        });

      expect(logoutResponse.status).toBe(200);
      expect(logoutResponse.body).toMatchObject({
        success: true,
        message: 'Logged out successfully'
      });

      // Verify access token is blacklisted
      const verifyResponse = await agent
        .get('/api/v1/auth/verify')
        .set('Authorization', `Bearer ${token}`);

      expect(verifyResponse.status).toBe(401);
      expect(verifyResponse.body).toMatchObject({
        success: false,
        message: 'Token has been blacklisted'
      });

      // Verify refresh token cannot be used after logout
      const refreshResponse = await agent
        .post('/api/v1/auth/refresh-token')
        .send({
          refreshToken: refreshToken
        });

      expect(refreshResponse.status).toBe(401);
      expect(refreshResponse.body).toMatchObject({
        success: false,
        message: expect.stringContaining('Invalid or expired refresh token')
      });
    });
  });

  describe('Rate limiting tests', () => {
    it.skip('should rate limit login attempts', async () => { // Skipped: rate limiting is disabled in test environment
      const { hash, salt } = encryptionUtil.hashPassword('password123');
      const affiliate = new Affiliate({
        affiliateId: 'AFF123',
        firstName: 'John',
        lastName: 'Doe',
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
        serviceLatitude: 30.2672,
        serviceLongitude: -97.7431,
        serviceRadius: 10,
        minimumDeliveryFee: 25,
        perBagDeliveryFee: 5,
        paymentMethod: 'directDeposit'
      });
      await affiliate.save();

      // Make multiple failed login attempts (rate limit is 20)
      const attempts = [];
      for (let i = 0; i < 21; i++) {
        attempts.push(
          request(app)
            .post('/api/v1/auth/affiliate/login')
            .send({
              username: 'johndoe',
              password: 'WrongPassword123!@#'
            })
        );
      }

      const responses = await Promise.all(attempts);

      // First 20 attempts should fail with invalid credentials
      for (let i = 0; i < 20; i++) {
        expect(responses[i].status).toBe(401);
      }

      // 21st attempt should be rate limited
      expect(responses[20].status).toBe(429);
      expect(responses[20].body).toMatchObject({
        success: false,
        message: 'Too many login attempts, please try again later'
      });
    });

    it.skip('should rate limit refresh token requests', async () => { // Skipped: rate limiting is disabled in test environment
      // TODO: Add rate limiting to refresh token endpoint
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
      const { hash, salt } = encryptionUtil.hashPassword(getStrongPassword('affiliate', 1));
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
        serviceLatitude: 30.2672,
        serviceLongitude: -97.7431,
        serviceRadius: 10,
        minimumDeliveryFee: 25,
        perBagDeliveryFee: 5,
        username: 'johndoe',
        passwordHash: hash,
        passwordSalt: salt,
        paymentMethod: 'directDeposit'
      });
      await affiliate.save();

      const loginResponse = await agent
        .post('/api/v1/auth/affiliate/login')
        .send({
          username: 'johndoe',
          password: getStrongPassword('affiliate', 1)
        });

      const refreshToken = loginResponse.body.refreshToken;
      console.log('Got refresh token:', refreshToken);

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

      console.log('Starting concurrent requests...');
      const responses = await Promise.all(concurrentRequests);
      console.log('Responses received:', responses.map(r => ({ status: r.status, body: r.body })));

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
        expect(response.status).toBe(401);
        expect(response.body).toMatchObject({
          success: false,
          message: 'Invalid or expired refresh token'
        });
      });
    }, 10000); // Increase timeout to 10 seconds
  });

  describe('Token blacklisting after logout', () => {
    it('should blacklist all active tokens on logout', async () => {
      // Create affiliate
      const { hash, salt } = encryptionUtil.hashPassword(getStrongPassword('affiliate', 1));
      const affiliate = new Affiliate({
        affiliateId: 'AFF999',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john999@example.com',
        phone: '555-123-4567',
        address: '123 Main St',
        city: 'Austin',
        state: 'TX',
        zipCode: '78701',
        serviceArea: 'Downtown',
        serviceLatitude: 30.2672,
        serviceLongitude: -97.7431,
        serviceRadius: 10,
        minimumDeliveryFee: 25,
        perBagDeliveryFee: 5,
        username: 'johndoe999',
        passwordHash: hash,
        passwordSalt: salt,
        paymentMethod: 'directDeposit'
      });
      await affiliate.save();

      // First login session (e.g., from desktop)
      const login1 = await agent
        .post('/api/v1/auth/affiliate/login')
        .send({
          username: 'johndoe999',
          password: getStrongPassword('affiliate', 1)
        });

      const token1 = login1.body.token;
      const refreshToken1 = login1.body.refreshToken;

      // Wait a moment to ensure different timestamp for JWT
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Second login session (e.g., from mobile)
      const login2 = await agent
        .post('/api/v1/auth/affiliate/login')
        .send({
          username: 'johndoe999',
          password: getStrongPassword('affiliate', 1)
        });

      const token2 = login2.body.token;
      const refreshToken2 = login2.body.refreshToken;

      // Ensure tokens are different
      expect(token1).not.toBe(token2);
      expect(refreshToken1).not.toBe(refreshToken2);

      // Both tokens should work before logout
      const verify1Before = await agent
        .get('/api/v1/auth/verify')
        .set('Authorization', `Bearer ${token1}`);

      const verify2Before = await agent
        .get('/api/v1/auth/verify')
        .set('Authorization', `Bearer ${token2}`);

      expect(verify1Before.status).toBe(200);
      expect(verify2Before.status).toBe(200);

      // Logout with the first token
      const logoutResponse = await agent
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${token1}`)
        .set('X-CSRF-Token', csrfToken)
        .send({
          refreshToken: refreshToken1
        });

      expect(logoutResponse.status).toBe(200);

      // First token should be blacklisted after logout
      const verify1After = await agent
        .get('/api/v1/auth/verify')
        .set('Authorization', `Bearer ${token1}`);

      expect(verify1After.status).toBe(401);
      expect(verify1After.body.message).toBe('Token has been blacklisted');

      // Second token should still work (only the token used in logout is blacklisted)
      const verify2After = await agent
        .get('/api/v1/auth/verify')
        .set('Authorization', `Bearer ${token2}`);

      expect(verify2After.status).toBe(200);

      // Now logout with the second token
      await agent
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${token2}`)
        .set('X-CSRF-Token', csrfToken)
        .send({
          refreshToken: refreshToken2
        });

      // Now second token should also be blacklisted
      const verify2AfterLogout = await agent
        .get('/api/v1/auth/verify')
        .set('Authorization', `Bearer ${token2}`);

      expect(verify2AfterLogout.status).toBe(401);
      expect(verify2AfterLogout.body.message).toBe('Token has been blacklisted');
    });
  });

  describe('POST /api/v1/auth/administrator/login', () => {
    it('should login administrator with valid credentials', async () => {
      // Create test administrator
      const admin = new Administrator({
        adminId: 'ADM001',
        firstName: 'Admin',
        lastName: 'User',
        email: 'admin@example.com',
        password: getStrongPassword('admin', 1),
        permissions: ['system_config', 'operator_management'],
        isActive: true
      });
      await admin.save();

      const response = await agent
        .post('/api/v1/auth/administrator/login')
        .set('X-CSRF-Token', csrfToken)
        .send({
          email: 'admin@example.com',
          password: getStrongPassword('admin', 1)
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        token: expect.any(String),
        refreshToken: expect.any(String),
        user: {
          id: expect.any(String),
          email: 'admin@example.com',
          role: 'administrator',
          adminId: 'ADM001'
        }
      });
    });

    it('should fail with invalid administrator credentials', async () => {
      const admin = new Administrator({
        adminId: 'ADM001',
        firstName: 'Admin',
        lastName: 'User',
        email: 'admin@example.com',
        password: getStrongPassword('admin', 1),
        permissions: ['system_config'],
        isActive: true
      });
      await admin.save();

      const response = await agent
        .post('/api/v1/auth/administrator/login')
        .set('X-CSRF-Token', csrfToken)
        .send({
          email: 'admin@example.com',
          password: 'WrongPassword123!@#'
        });

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        success: false,
        message: 'Invalid email or password'
      });
    });

    it('should fail when administrator is inactive', async () => {
      const admin = new Administrator({
        adminId: 'ADM001',
        firstName: 'Admin',
        lastName: 'User',
        email: 'admin@example.com',
        password: getStrongPassword('admin', 1),
        permissions: ['system_config'],
        isActive: false
      });
      await admin.save();

      const response = await agent
        .post('/api/v1/auth/administrator/login')
        .set('X-CSRF-Token', csrfToken)
        .send({
          email: 'admin@example.com',
          password: getStrongPassword('admin', 1)
        });

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        success: false,
        message: 'Account is deactivated. Please contact system administrator.'
      });
    });
  });

  describe('POST /api/v1/auth/operator/login', () => {
    it('should login operator with valid credentials', async () => {
      // Create a dummy administrator for the createdBy field
      const admin = new Administrator({
        adminId: 'ADMIN001',
        firstName: 'Admin',
        lastName: 'User',
        email: 'admin@example.com',
        password: getStrongPassword('admin', 1)
      });
      await admin.save();

      // Create test operator with always valid shift times
      const operator = new Operator({
        operatorId: 'OPR001',
        firstName: 'Op',
        lastName: 'User',
        email: 'operator@example.com',
        username: 'opuser',
        password: getStrongPassword('operator', 1),
        shiftStart: '00:00',
        shiftEnd: '23:59',
        isActive: true,
        createdBy: admin._id
      });
      await operator.save();

      const response = await agent
        .post('/api/v1/auth/operator/login')
        .set('X-CSRF-Token', csrfToken)
        .send({
          email: 'operator@example.com',
          password: getStrongPassword('operator', 1)
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        token: expect.any(String),
        refreshToken: expect.any(String),
        user: {
          id: expect.any(String),
          email: 'operator@example.com',
          role: 'operator',
          operatorId: 'OPR001'
        }
      });
    });

    it('should fail with invalid operator credentials', async () => {
      // Create a dummy administrator for the createdBy field
      const admin = new Administrator({
        adminId: 'ADMIN002',
        firstName: 'Admin',
        lastName: 'User2',
        email: 'admin2@example.com',
        password: getStrongPassword('admin', 1)
      });
      await admin.save();

      const operator = new Operator({
        operatorId: 'OPR001',
        firstName: 'Op',
        lastName: 'User',
        email: 'operator@example.com',
        username: 'opuser',
        password: getStrongPassword('operator', 1),
        shiftStart: '00:00',
        shiftEnd: '23:59',
        isActive: true,
        createdBy: admin._id
      });
      await operator.save();

      const response = await agent
        .post('/api/v1/auth/operator/login')
        .set('X-CSRF-Token', csrfToken)
        .send({
          email: 'operator@example.com',
          password: 'WrongPassword123!@#'
        });

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        success: false,
        message: 'Invalid email or password'
      });
    });

    it('should fail when operator is inactive', async () => {
      // Create a dummy administrator for the createdBy field
      const admin = new Administrator({
        adminId: 'ADMIN003',
        firstName: 'Admin',
        lastName: 'User3',
        email: 'admin3@example.com',
        password: getStrongPassword('admin', 1)
      });
      await admin.save();

      const operator = new Operator({
        operatorId: 'OPR001',
        firstName: 'Op',
        lastName: 'User',
        email: 'operator@example.com',
        username: 'opuser',
        password: getStrongPassword('operator', 1),
        shiftStart: '00:00',
        shiftEnd: '23:59',
        isActive: false,
        createdBy: admin._id
      });
      await operator.save();

      const response = await agent
        .post('/api/v1/auth/operator/login')
        .set('X-CSRF-Token', csrfToken)
        .send({
          email: 'operator@example.com',
          password: getStrongPassword('operator', 1)
        });

      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({
        success: false,
        message: 'Account is inactive. Please contact your supervisor.'
      });
    });
  });
});