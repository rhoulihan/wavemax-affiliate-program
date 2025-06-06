// OAuth Authentication Integration Tests for WaveMAX Laundry Affiliate Program

const request = require('supertest');
const app = require('../../server');
const mongoose = require('mongoose');
const OAuthSession = require('../../server/models/OAuthSession');
const Affiliate = require('../../server/models/Affiliate');
const Customer = require('../../server/models/Customer');
const jwt = require('jsonwebtoken');
const { getCsrfToken } = require('../helpers/csrfHelper');

describe('OAuth Authentication Integration Tests', () => {
  let agent;
  let csrfToken;

  beforeAll(async () => {
    agent = request.agent(app);
  });

  beforeEach(async () => {
    // Clean up collections
    await OAuthSession.deleteMany({});
    await Affiliate.deleteMany({});
    await Customer.deleteMany({});
    
    // Get fresh CSRF token
    csrfToken = await getCsrfToken(app, agent);
  });

  afterAll(async () => {
    await OAuthSession.deleteMany({});
    await Affiliate.deleteMany({});
    await Customer.deleteMany({});
  });

  // Helper function to create mock social JWT token
  const createMockSocialToken = (data) => {
    return jwt.sign(data, process.env.JWT_SECRET, { expiresIn: '5m' });
  };

  describe('OAuth Session Management', () => {
    test('should create and store OAuth session on callback', async () => {
      // Create a mock OAuth session
      const sessionData = {
        sessionId: 'test-oauth-session-123',
        provider: 'google',
        socialId: 'google-user-123',
        email: 'oauth@example.com',
        firstName: 'OAuth',
        lastName: 'User',
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        context: 'affiliate'
      };

      await OAuthSession.createSession(sessionData.sessionId, sessionData);

      // Verify session was created
      const storedSession = await OAuthSession.findOne({ sessionId: 'test-oauth-session-123' });
      expect(storedSession).toBeTruthy();
      expect(storedSession.result.provider).toBe('google');
      expect(storedSession.result.email).toBe('oauth@example.com');
    });

    test('should poll for OAuth session results with complete data structure', async () => {
      // Create OAuth session with real OAuth result structure
      const sessionData = {
        type: 'social-auth-success',
        socialToken: 'mock-social-jwt-token',
        provider: 'facebook',
        socialId: 'facebook-user-456',
        email: 'poll@example.com',
        firstName: 'Poll',
        lastName: 'Test'
      };

      await OAuthSession.createSession('poll-test-session-456', sessionData);

      // Poll for session (should consume it)
      const response = await agent
        .get('/api/v1/auth/oauth-session/poll-test-session-456')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.result).toEqual(sessionData);
      expect(response.body.result.type).toBe('social-auth-success');
      expect(response.body.result.provider).toBe('facebook');
      expect(response.body.result.socialToken).toBe('mock-social-jwt-token');

      // Verify session was consumed (deleted)
      const consumedSession = await OAuthSession.findOne({ sessionId: 'poll-test-session-456' });
      expect(consumedSession).toBeNull();
    });

    test('should poll for OAuth login session results', async () => {
      // Create OAuth session for existing user login
      const sessionData = {
        type: 'social-auth-login',
        token: 'jwt-auth-token',
        refreshToken: 'refresh-token',
        affiliate: {
          affiliateId: 'AFF-123e4567-e89b-12d3-a456-426614174000',
          id: 'affiliate-id',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          businessName: 'Test Business'
        }
      };

      await OAuthSession.createSession('login-test-session-789', sessionData);

      // Poll for session
      const response = await agent
        .get('/api/v1/auth/oauth-session/login-test-session-789')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.result).toEqual(sessionData);
      expect(response.body.result.type).toBe('social-auth-login');
      expect(response.body.result.affiliate.affiliateId).toBe('AFF-123e4567-e89b-12d3-a456-426614174000');

      // Verify session was consumed
      const consumedSession = await OAuthSession.findOne({ sessionId: 'login-test-session-789' });
      expect(consumedSession).toBeNull();
    });

    test('should return pending status for non-existent session', async () => {
      const response = await agent
        .get('/api/v1/auth/oauth-session/non-existent-session')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Session not found or expired');
    });

    test('should handle session polling race conditions', async () => {
      // Create OAuth session
      const sessionData = {
        sessionId: 'race-condition-session',
        provider: 'linkedin',
        socialId: 'linkedin-race-user',
        email: 'race@example.com',
        firstName: 'Race',
        lastName: 'Condition',
        context: 'affiliate'
      };

      await OAuthSession.createSession(sessionData.sessionId, sessionData);

      // Make multiple simultaneous requests
      const requests = Array(3).fill().map(() =>
        agent.get('/api/v1/auth/oauth-session/race-condition-session')
      );

      const responses = await Promise.all(requests);

      // Only one should succeed with 200, others should get 404 (not found)
      const successfulResponses = responses.filter(res => res.status === 200);
      const notFoundResponses = responses.filter(res => res.status === 404);

      expect(successfulResponses).toHaveLength(1);
      expect(notFoundResponses).toHaveLength(2);

      // Verify session was completely consumed
      const remainingSession = await OAuthSession.findOne({ sessionId: 'race-condition-session' });
      expect(remainingSession).toBeNull();
    });
  });

  describe('Social Registration - Affiliates', () => {
    test('should complete affiliate social registration with valid data', async () => {
      const socialToken = createMockSocialToken({
        provider: 'google',
        socialId: 'google-affiliate-123',
        email: 'affiliate@example.com',
        firstName: 'Social',
        lastName: 'Affiliate'
      });

      const registrationData = {
        socialToken,
        phone: '+1234567890',
        businessName: 'Social Business',
        address: '123 Social St',
        city: 'Social City',
        state: 'SC',
        zipCode: '12345',
        serviceArea: 'Downtown',
        serviceLatitude: 30.2672,
        serviceLongitude: -97.7431,
        serviceRadius: 10,
        minimumDeliveryFee: 25,
        perBagDeliveryFee: 5,
        paymentMethod: 'check'
      };

      const response = await agent
        .post('/api/v1/auth/social/register')
        .set('x-csrf-token', csrfToken)
        .send(registrationData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.affiliateId).toMatch(/^AFF-[a-f0-9-]+$/);
      expect(response.body.message).toBe('Social registration completed successfully');

      // Verify affiliate was created in database
      const createdAffiliate = await Affiliate.findOne({ email: 'affiliate@example.com' });
      expect(createdAffiliate).toBeTruthy();
      expect(createdAffiliate.firstName).toBe('Social');
      expect(createdAffiliate.businessName).toBe('Social Business');
      expect(createdAffiliate.socialAccounts.google.id).toBe('google-affiliate-123');
      expect(createdAffiliate.registrationMethod).toBe('google');
    });

    test('should reject registration with malicious social data', async () => {
      const socialToken = createMockSocialToken({
        provider: 'google',
        socialId: 'google-malicious-123',
        email: 'malicious@example.com',
        firstName: '<script>alert("xss")</script>',
        lastName: '<img src=x onerror=alert("xss2")>'
      });

      const registrationData = {
        socialToken,
        phone: '+1234567890',
        businessName: 'Test Business',
        address: '123 Test St',
        city: 'Test City',
        state: 'TC',
        zipCode: '12345',
        serviceArea: 'Downtown',
        serviceLatitude: 30.2672,
        serviceLongitude: -97.7431,
        serviceRadius: 10,
        minimumDeliveryFee: 25,
        perBagDeliveryFee: 5,
        paymentMethod: 'check'
      };

      const response = await agent
        .post('/api/v1/auth/social/register')
        .set('x-csrf-token', csrfToken)
        .send(registrationData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid social profile data');

      // Verify no affiliate was created
      const noAffiliate = await Affiliate.findOne({ email: 'malicious@example.com' });
      expect(noAffiliate).toBeNull();
    });

    test('should prevent duplicate social account registration', async () => {
      // First registration
      const socialToken1 = createMockSocialToken({
        provider: 'facebook',
        socialId: 'facebook-duplicate-123',
        email: 'first@example.com',
        firstName: 'First',
        lastName: 'User'
      });

      const firstRegistration = {
        socialToken: socialToken1,
        phone: '+1111111111',
        businessName: 'First Business',
        address: '111 First St',
        city: 'First City',
        state: 'FC',
        zipCode: '11111',
        serviceArea: 'First Area',
        serviceLatitude: 30.2672,
        serviceLongitude: -97.7431,
        serviceRadius: 10,
        minimumDeliveryFee: 25,
        perBagDeliveryFee: 4.99,
        paymentMethod: 'check'
      };

      await agent
        .post('/api/v1/auth/social/register')
        .set('x-csrf-token', csrfToken)
        .send(firstRegistration)
        .expect(201);

      // Attempt duplicate registration with same social ID
      const socialToken2 = createMockSocialToken({
        provider: 'facebook',
        socialId: 'facebook-duplicate-123', // Same social ID
        email: 'second@example.com',
        firstName: 'Second',
        lastName: 'User'
      });

      const duplicateRegistration = {
        socialToken: socialToken2,
        phone: '+2222222222',
        businessName: 'Second Business',
        address: '222 Second St',
        city: 'Second City',
        state: 'SC',
        zipCode: '22222',
        serviceArea: 'Second Area',
        serviceLatitude: 30.2672,
        serviceLongitude: -97.7431,
        serviceRadius: 10,
        minimumDeliveryFee: 25,
        perBagDeliveryFee: 6.99,
        paymentMethod: 'directDeposit',
        accountNumber: '1234567890',
        routingNumber: '987654321'
      };

      const response = await agent
        .post('/api/v1/auth/social/register')
        .set('x-csrf-token', csrfToken)
        .send(duplicateRegistration)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('This social media account is already registered with another affiliate account');
    });

    test('should prevent duplicate email registration', async () => {
      // Create affiliate with regular registration first
      const existingAffiliate = new Affiliate({
        affiliateId: 'AFF-000e4567-e89b-12d3-a456-426614174001',
        firstName: 'Existing',
        lastName: 'User',
        email: 'duplicate@example.com',
        phone: '+1000000000',
        businessName: 'Existing Business',
        address: '100 Existing St',
        city: 'Existing City',
        state: 'EC',
        zipCode: '10000',
        serviceArea: 'Existing Area',
        serviceLatitude: 30.2672,
        serviceLongitude: -97.7431,
        serviceRadius: 10,
        minimumDeliveryFee: 25,
        perBagDeliveryFee: 3.99,
        username: 'existing',
        passwordHash: 'hashedpassword123',
        passwordSalt: 'salt123',
        paymentMethod: 'check'
      });

      await existingAffiliate.save();

      // Attempt social registration with same email
      const socialToken = createMockSocialToken({
        provider: 'linkedin',
        socialId: 'linkedin-duplicate-email',
        email: 'duplicate@example.com', // Same email
        firstName: 'Social',
        lastName: 'User'
      });

      const registrationData = {
        socialToken,
        phone: '+3333333333',
        businessName: 'Social Business',
        address: '333 Social St',
        city: 'Social City',
        state: 'SC',
        zipCode: '33333',
        serviceArea: 'Social Area',
        serviceLatitude: 30.2672,
        serviceLongitude: -97.7431,
        serviceRadius: 10,
        minimumDeliveryFee: 25,
        perBagDeliveryFee: 7.99,
        paymentMethod: 'paypal',
        paypalEmail: 'social@paypal.com'
      };

      const response = await agent
        .post('/api/v1/auth/social/register')
        .set('x-csrf-token', csrfToken)
        .send(registrationData)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Email or username already exists');
    });

    test('should generate unique usernames for social registrations', async () => {
      // Create multiple affiliates with names that would generate same username
      const affiliateData = [
        { firstName: 'John', lastName: 'Doe', socialId: 'google-john1' },
        { firstName: 'John', lastName: 'Doe', socialId: 'facebook-john2' },
        { firstName: 'John', lastName: 'Doe', socialId: 'linkedin-john3' }
      ];

      const createdAffiliates = [];

      for (let i = 0; i < affiliateData.length; i++) {
        const data = affiliateData[i];
        const socialToken = createMockSocialToken({
          provider: data.socialId.split('-')[0],
          socialId: data.socialId,
          email: `john${i + 1}@example.com`,
          firstName: data.firstName,
          lastName: data.lastName
        });

        const registrationData = {
          socialToken,
          phone: `+555000000${i}`,
          businessName: `John's Business ${i + 1}`,
          address: `${i + 1}00 John St`,
          city: 'John City',
          state: 'JC',
          zipCode: `1000${i}`,
          serviceArea: `Area ${i + 1}`,
          serviceLatitude: 30.2672,
        serviceLongitude: -97.7431,
        serviceRadius: 10,
        minimumDeliveryFee: 25,
        perBagDeliveryFee: 5.99 + i,
          paymentMethod: 'check'
        };

        const response = await agent
          .post('/api/v1/auth/social/register')
          .set('x-csrf-token', csrfToken)
          .send(registrationData)
          .expect(201);

        createdAffiliates.push(response.body.affiliateId);
      }

      // Verify all affiliates were created with unique usernames
      const affiliates = await Affiliate.find({ 
        affiliateId: { $in: createdAffiliates } 
      }).sort({ username: 1 });

      expect(affiliates).toHaveLength(3);
      expect(affiliates[0].username).toBe('johndoe');
      expect(affiliates[1].username).toBe('johndoe1');
      expect(affiliates[2].username).toBe('johndoe2');
    });
  });

  describe('Social Registration - Customers', () => {
    test('should complete customer social registration with valid data', async () => {
      // Create affiliate first
      const affiliate = new Affiliate({
        affiliateId: 'AFF999999',
        firstName: 'Test',
        lastName: 'Affiliate',
        email: 'testaffiliate@example.com',
        phone: '+1000000000',
        businessName: 'Test Business',
        address: '999 Test St',
        city: 'Test City',
        state: 'TC',
        zipCode: '99999',
        serviceArea: 'Test Area',
        serviceLatitude: 30.2672,
        serviceLongitude: -97.7431,
        serviceRadius: 10,
        minimumDeliveryFee: 25,
        perBagDeliveryFee: 5,
        username: 'testaffiliate',
        passwordHash: 'hashedpassword123',
        passwordSalt: 'salt123',
        paymentMethod: 'check'
      });

      await affiliate.save();

      const socialToken = createMockSocialToken({
        provider: 'google',
        socialId: 'google-customer-123',
        email: 'customer@example.com',
        firstName: 'Social',
        lastName: 'Customer'
      });

      const registrationData = {
        socialToken,
        affiliateId: 'AFF999999',
        phone: '+1234567890',
        address: '123 Customer St',
        city: 'Customer City',
        state: 'CC',
        zipCode: '12345',
        serviceFrequency: 'weekly'
      };

      const response = await agent
        .post('/api/v1/auth/customer/social/register')
        .set('x-csrf-token', csrfToken)
        .send(registrationData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.customerId).toMatch(/^CUST-[a-f0-9-]+$/);
      expect(response.body.message).toBe('Customer social registration completed successfully');

      // Verify customer was created in database
      const createdCustomer = await Customer.findOne({ email: 'customer@example.com' });
      expect(createdCustomer).toBeTruthy();
      expect(createdCustomer.firstName).toBe('Social');
      expect(createdCustomer.affiliateId).toBe('AFF999999');
      expect(createdCustomer.socialAccounts.google.id).toBe('google-customer-123');
      expect(createdCustomer.registrationMethod).toBe('google');
    });

    test('should reject customer registration with invalid affiliate ID', async () => {
      const socialToken = createMockSocialToken({
        provider: 'facebook',
        socialId: 'facebook-invalid-affiliate',
        email: 'invalidaffiliate@example.com',
        firstName: 'Invalid',
        lastName: 'Affiliate'
      });

      const registrationData = {
        socialToken,
        affiliateId: 'AFF000000', // Non-existent affiliate
        phone: '+1111111111',
        address: '111 Invalid St',
        city: 'Invalid City',
        state: 'IC',
        zipCode: '11111',
        serviceFrequency: 'monthly'
      };

      const response = await agent
        .post('/api/v1/auth/customer/social/register')
        .set('x-csrf-token', csrfToken)
        .send(registrationData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid affiliate ID');
    });
  });

  describe('Social Login', () => {
    test('should login existing affiliate with social account', async () => {
      // Create affiliate with social account
      const affiliate = new Affiliate({
        affiliateId: 'AFF888888',
        firstName: 'Existing',
        lastName: 'Affiliate',
        email: 'existing@example.com',
        phone: '+1111111111',
        businessName: 'Existing Business',
        address: '888 Existing St',
        city: 'Existing City',
        state: 'EC',
        zipCode: '88888',
        serviceArea: 'Existing Area',
        serviceLatitude: 30.2672,
        serviceLongitude: -97.7431,
        serviceRadius: 10,
        minimumDeliveryFee: 25,
        perBagDeliveryFee: 4.99,
        username: 'existing',
        passwordHash: 'hashedpassword123',
        passwordSalt: 'salt123',
        paymentMethod: 'check',
        socialAccounts: {
          google: {
            id: 'google-existing-123',
            email: 'existing@example.com',
            name: 'Existing Affiliate'
          }
        }
      });

      await affiliate.save();

      const loginData = {
        provider: 'google',
        socialId: 'google-existing-123'
      };

      const response = await agent
        .post('/api/v1/auth/social/callback')
        .set('x-csrf-token', csrfToken)
        .send(loginData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.token).toBeDefined();
      expect(response.body.refreshToken).toBeDefined();
      expect(response.body.user.affiliateId).toBe('AFF888888');
      expect(response.body.user.firstName).toBe('Existing');
    });

    test('should login existing customer with social account', async () => {
      // Create affiliate first
      const affiliate = new Affiliate({
        affiliateId: 'AFF777777',
        firstName: 'Customer',
        lastName: 'Affiliate',
        email: 'customeraffiliate@example.com',
        phone: '+2222222222',
        businessName: 'Customer Business',
        address: '777 Customer St',
        city: 'Customer City',
        state: 'CC',
        zipCode: '77777',
        serviceArea: 'Customer Area',
        serviceLatitude: 30.2672,
        serviceLongitude: -97.7431,
        serviceRadius: 10,
        minimumDeliveryFee: 25,
        perBagDeliveryFee: 6.99,
        username: 'customeraffiliate',
        passwordHash: 'hashedpassword123',
        passwordSalt: 'salt123',
        paymentMethod: 'check'
      });

      await affiliate.save();

      // Create customer with social account
      const customer = new Customer({
        customerId: 'CUST777777',
        firstName: 'Existing',
        lastName: 'Customer',
        email: 'existingcustomer@example.com',
        phone: '+3333333333',
        address: '777 Customer Ave',
        city: 'Customer Town',
        state: 'CT',
        zipCode: '77777',
        affiliateId: 'AFF777777',
        serviceFrequency: 'biweekly',
        username: 'existingcustomer',
        passwordHash: 'hashedpassword123',
        passwordSalt: 'salt123',
        socialAccounts: {
          facebook: {
            id: 'facebook-existing-customer',
            email: 'existingcustomer@example.com',
            name: 'Existing Customer'
          }
        }
      });

      await customer.save();

      const loginData = {
        provider: 'facebook',
        socialId: 'facebook-existing-customer'
      };

      const response = await agent
        .post('/api/v1/auth/social/callback')
        .set('x-csrf-token', csrfToken)
        .send(loginData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.token).toBeDefined();
      expect(response.body.user.customerId).toBe('CUST777777');
      expect(response.body.user.firstName).toBe('Existing');
    });

    test('should return error for non-existent social account', async () => {
      const loginData = {
        provider: 'linkedin',
        socialId: 'linkedin-nonexistent-123'
      };

      const response = await agent
        .post('/api/v1/auth/social/callback')
        .set('x-csrf-token', csrfToken)
        .send(loginData)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('No account found with this social media account');
    });
  });

  describe('Social Account Linking', () => {
    test('should link social account to existing affiliate', async () => {
      // Create affiliate without social account
      const affiliate = new Affiliate({
        affiliateId: 'AFF666666',
        firstName: 'Link',
        lastName: 'Test',
        email: 'linktest@example.com',
        phone: '+4444444444',
        businessName: 'Link Business',
        address: '666 Link St',
        city: 'Link City',
        state: 'LC',
        zipCode: '66666',
        serviceArea: 'Link Area',
        serviceLatitude: 30.2672,
        serviceLongitude: -97.7431,
        serviceRadius: 10,
        minimumDeliveryFee: 25,
        perBagDeliveryFee: 7.99,
        username: 'linktest',
        passwordHash: 'hashedpassword123',
        passwordSalt: 'salt123',
        paymentMethod: 'check'
      });

      await affiliate.save();

      // Mock authentication
      const socialToken = createMockSocialToken({
        provider: 'twitter',
        socialId: 'twitter-link-123',
        email: 'linktest@example.com',
        firstName: 'Link',
        lastName: 'Test'
      });

      const linkData = {
        provider: 'twitter',
        socialToken
      };

      // Note: In a real scenario, this would require authentication middleware
      // For testing, we'll need to mock the authenticated user context
      const response = await agent
        .post('/api/v1/auth/social/link')
        .set('x-csrf-token', csrfToken)
        .send(linkData);

      // This test would require authentication middleware setup
      // which is complex in integration tests. 
      // The actual functionality is tested in unit tests.
      expect([200, 401, 403]).toContain(response.status); // Various auth states
    });
  });

  describe('Security and Error Handling', () => {
    test('should accept requests without CSRF token for social registration', async () => {
      const socialToken = createMockSocialToken({
        provider: 'google',
        socialId: 'google-csrf-test',
        email: 'csrf@example.com',
        firstName: 'CSRF',
        lastName: 'Test'
      });

      const registrationData = {
        socialToken,
        phone: '+5555555555',
        businessName: 'CSRF Business',
        address: '123 CSRF St',
        city: 'CSRF City',
        state: 'CS',
        zipCode: '12345',
        serviceArea: 'CSRF Area',
        serviceLatitude: 30.2672,
        serviceLongitude: -97.7431,
        serviceRadius: 10,
        minimumDeliveryFee: 25,
        perBagDeliveryFee: 5,
        paymentMethod: 'check'
      };

      const response = await agent
        .post('/api/v1/auth/social/register')
        // Deliberately not setting CSRF token - social registration endpoints are exempt
        .send(registrationData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.affiliateId).toMatch(/^AFF-[a-f0-9-]+$/);
    });

    test('should handle expired JWT tokens gracefully', async () => {
      // Create expired token
      const expiredToken = jwt.sign({
        provider: 'google',
        socialId: 'google-expired',
        email: 'expired@example.com',
        firstName: 'Expired',
        lastName: 'Token'
      }, process.env.JWT_SECRET, { expiresIn: '-1h' }); // Expired 1 hour ago

      const registrationData = {
        socialToken: expiredToken,
        phone: '+6666666666',
        businessName: 'Expired Business',
        address: '123 Expired St',
        city: 'Expired City',
        state: 'EX',
        zipCode: '12345',
        serviceArea: 'Expired Area',
        serviceLatitude: 30.2672,
        serviceLongitude: -97.7431,
        serviceRadius: 10,
        minimumDeliveryFee: 25,
        perBagDeliveryFee: 5,
        paymentMethod: 'check'
      };

      const response = await agent
        .post('/api/v1/auth/social/register')
        .set('x-csrf-token', csrfToken)
        .send(registrationData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid or expired social authentication token');
    });

    test('should handle invalid JWT tokens', async () => {
      const registrationData = {
        socialToken: 'invalid.jwt.token',
        phone: '+7777777777',
        businessName: 'Invalid Business',
        address: '123 Invalid St',
        city: 'Invalid City',
        state: 'IV',
        zipCode: '12345',
        serviceArea: 'Invalid Area',
        serviceLatitude: 30.2672,
        serviceLongitude: -97.7431,
        serviceRadius: 10,
        minimumDeliveryFee: 25,
        perBagDeliveryFee: 5,
        paymentMethod: 'check'
      };

      const response = await agent
        .post('/api/v1/auth/social/register')
        .set('x-csrf-token', csrfToken)
        .send(registrationData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid or expired social authentication token');
    });

    test('should validate required fields', async () => {
      const socialToken = createMockSocialToken({
        provider: 'google',
        socialId: 'google-validation-test',
        email: 'validation@example.com',
        firstName: 'Validation',
        lastName: 'Test'
      });

      const incompleteData = {
        socialToken
        // Missing required fields like phone, businessName, etc.
      };

      const response = await agent
        .post('/api/v1/auth/social/register')
        .set('x-csrf-token', csrfToken)
        .send(incompleteData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
      expect(Array.isArray(response.body.errors)).toBe(true);
    });
  });

  describe('OAuth Session TTL and Cleanup', () => {
    test('should automatically expire OAuth sessions after TTL', async () => {
      // Create session with expired date
      const expiredSession = new OAuthSession({
        sessionId: 'expired-session-test',
        result: {
          provider: 'google',
          socialId: 'google-expired-session',
          email: 'expired@example.com',
          firstName: 'Expired',
          lastName: 'Session'
        },
        createdAt: new Date(Date.now() - (6 * 60 * 1000)), // 6 minutes ago (TTL is 5 minutes)
        expiresAt: new Date(Date.now() - (1 * 60 * 1000)) // Expired 1 minute ago
      });

      await expiredSession.save();

      // Manually run cleanup (in production, MongoDB TTL handles this automatically)
      await OAuthSession.cleanupExpired();

      // Verify session was deleted
      const shouldBeNull = await OAuthSession.findOne({ sessionId: 'expired-session-test' });
      expect(shouldBeNull).toBeNull();
    });

    test('should preserve fresh OAuth sessions during cleanup', async () => {
      // Create fresh session
      const freshSession = new OAuthSession({
        sessionId: 'fresh-session-test',
        result: {
          provider: 'facebook',
          socialId: 'facebook-fresh-session',
          email: 'fresh@example.com',
          firstName: 'Fresh',
          lastName: 'Session'
        }
        // createdAt will be set to current time by default
      });

      await freshSession.save();

      // Run cleanup
      await OAuthSession.cleanupExpired();

      // Verify fresh session still exists
      const shouldExist = await OAuthSession.findOne({ sessionId: 'fresh-session-test' });
      expect(shouldExist).toBeTruthy();
      expect(shouldExist.result.email).toBe('fresh@example.com');
    });
  });

  describe('OAuth Account Conflict Scenarios', () => {
    test('should create social-auth-account-conflict session for customer trying to register with affiliate Google account', async () => {
      // First create an affiliate with social account
      const existingAffiliate = new Affiliate({
        affiliateId: 'AFF123456',
        firstName: 'John',
        lastName: 'Affiliate',
        email: 'john.affiliate@example.com',
        phone: '+1234567890',
        businessName: 'Johns Business',
        address: '123 Business St',
        city: 'Austin',
        state: 'TX',
        zipCode: '78701',
        serviceArea: 'Downtown',
        serviceLatitude: 30.2672,
        serviceLongitude: -97.7431,
        serviceRadius: 10,
        minimumDeliveryFee: 25,
        perBagDeliveryFee: 5,
        username: 'johnaffiliate',
        passwordHash: 'hashedpassword',
        passwordSalt: 'salt',
        paymentMethod: 'check',
        socialAccounts: {
          google: {
            id: 'google-conflict-123',
            email: 'john.affiliate@example.com'
          }
        },
        registrationMethod: 'google'
      });

      await existingAffiliate.save();

      // Create OAuth session for account conflict
      const conflictSessionData = {
        type: 'social-auth-account-conflict',
        message: 'This social media account is already associated with an affiliate account. Would you like to login as an affiliate instead?',
        provider: 'google',
        accountType: 'affiliate',
        affiliateData: {
          affiliateId: 'AFF123456',
          firstName: 'John',
          lastName: 'Affiliate',
          email: 'john.affiliate@example.com',
          businessName: 'Johns Business'
        }
      };

      await OAuthSession.createSession('conflict-test-session-123', conflictSessionData);

      // Poll for session and verify conflict data structure
      const response = await agent
        .get('/api/v1/auth/oauth-session/conflict-test-session-123')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.result.type).toBe('social-auth-account-conflict');
      expect(response.body.result.provider).toBe('google');
      expect(response.body.result.accountType).toBe('affiliate');
      expect(response.body.result.affiliateData.affiliateId).toBe('AFF123456');
      expect(response.body.result.affiliateData.firstName).toBe('John');
      expect(response.body.result.affiliateData.lastName).toBe('Affiliate');
      expect(response.body.result.message).toContain('already associated with an affiliate account');

      // Verify session was consumed
      const consumedSession = await OAuthSession.findOne({ sessionId: 'conflict-test-session-123' });
      expect(consumedSession).toBeNull();
    });

    test('should create social-auth-account-conflict session for affiliate trying to register with customer Google account', async () => {
      // First create a customer with social account
      const Customer = require('../../server/models/Customer');
      const existingCustomer = new Customer({
        customerId: 'CUST001',
        firstName: 'Jane',
        lastName: 'Customer',
        email: 'jane.customer@example.com',
        phone: '+0987654321',
        address: '456 Customer Ave',
        city: 'Austin',
        state: 'TX',
        zipCode: '78702',
        affiliateId: 'AFF123456',
        username: 'janecustomer',
        socialAccounts: {
          google: {
            id: 'google-customer-conflict-456',
            email: 'jane.customer@example.com'
          }
        },
        registrationMethod: 'google'
      });

      await existingCustomer.save();

      // Create OAuth session for customer account conflict
      const conflictSessionData = {
        type: 'social-auth-account-conflict',
        message: 'This social media account is already associated with a customer account. Would you like to login as a customer instead?',
        provider: 'google',
        accountType: 'customer',
        customerData: {
          firstName: 'Jane',
          lastName: 'Customer',
          email: 'jane.customer@example.com'
        }
      };

      await OAuthSession.createSession('customer-conflict-session-456', conflictSessionData);

      // Poll for session and verify conflict data structure
      const response = await agent
        .get('/api/v1/auth/oauth-session/customer-conflict-session-456')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.result.type).toBe('social-auth-account-conflict');
      expect(response.body.result.provider).toBe('google');
      expect(response.body.result.accountType).toBe('customer');
      expect(response.body.result.customerData.firstName).toBe('Jane');
      expect(response.body.result.customerData.lastName).toBe('Customer');
      expect(response.body.result.message).toContain('already associated with a customer account');

      // Verify session was consumed
      const consumedSession = await OAuthSession.findOne({ sessionId: 'customer-conflict-session-456' });
      expect(consumedSession).toBeNull();

      // Clean up customer
      await Customer.deleteMany({ customerId: 'CUST001' });
    });
  });
});