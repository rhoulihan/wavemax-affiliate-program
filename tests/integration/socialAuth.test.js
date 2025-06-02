// Social Authentication Integration Tests
// Tests for complete social media authentication flows including OAuth callbacks and user registration

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../server');
const Affiliate = require('../../server/models/Affiliate');
const { hashPassword } = require('../../server/utils/encryption');
const { getCsrfToken, createAgent } = require('../helpers/csrfHelper');

describe('Social Authentication Integration Tests', () => {
  let affiliateId;
  let agent;
  let csrfToken;

  beforeEach(async () => {
    // Clean up test data
    await Affiliate.deleteMany({});
    
    // Create agent and get CSRF token for tests that need it
    agent = createAgent(app);
    csrfToken = await getCsrfToken(app, agent);
  });

  describe('OAuth Initiation Endpoints', () => {
    test('should redirect to Google OAuth when Google auth is configured', async () => {
      // Skip if Google OAuth is not configured
      if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
        return;
      }

      const response = await request(app)
        .get('/api/v1/auth/google');
      
      expect(response.status).toBe(302);
      expect(response.headers.location).toContain('accounts.google.com');
      expect(response.headers.location).toContain('oauth2');
    });

    test('should redirect to Facebook OAuth when Facebook auth is configured', async () => {
      // Skip if Facebook OAuth is not configured
      if (!process.env.FACEBOOK_APP_ID || !process.env.FACEBOOK_APP_SECRET) {
        return;
      }

      const response = await request(app)
        .get('/api/v1/auth/facebook');
      
      expect(response.status).toBe(302);
      expect(response.headers.location).toContain('facebook.com');
      expect(response.headers.location).toContain('oauth');
    });

    test('should redirect to LinkedIn OAuth when LinkedIn auth is configured', async () => {
      // Skip if LinkedIn OAuth is not configured
      if (!process.env.LINKEDIN_CLIENT_ID || !process.env.LINKEDIN_CLIENT_SECRET) {
        return;
      }

      const response = await request(app)
        .get('/api/v1/auth/linkedin');
      
      expect(response.status).toBe(302);
      expect(response.headers.location).toContain('linkedin.com');
      expect(response.headers.location).toContain('oauth');
    });

    test('should return 404 for unconfigured OAuth providers', async () => {
      // Temporarily remove environment variables
      const originalGoogleId = process.env.GOOGLE_CLIENT_ID;
      const originalGoogleSecret = process.env.GOOGLE_CLIENT_SECRET;
      
      delete process.env.GOOGLE_CLIENT_ID;
      delete process.env.GOOGLE_CLIENT_SECRET;

      // The server uses the current environment variables

      const response = await request(app)
        .get('/api/v1/auth/google');
      
      expect(response.status).toBe(404);

      // Restore environment variables
      if (originalGoogleId) process.env.GOOGLE_CLIENT_ID = originalGoogleId;
      if (originalGoogleSecret) process.env.GOOGLE_CLIENT_SECRET = originalGoogleSecret;
    });
  });

  describe('Social Registration Flow', () => {
    test('should complete social registration with all required fields', async () => {
      const socialData = {
        socialToken: generateMockSocialToken({
          provider: 'google',
          socialId: 'google123',
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe'
        }),
        businessName: 'Test Business',
        address: '123 Test St',
        city: 'Test City',
        state: 'TS',
        zipCode: '12345',
        phone: '+1234567890',
        serviceArea: 'Downtown, Uptown',
        deliveryFee: 5.99,
        paymentMethod: 'paypal',
        paypalEmail: 'payments@test.com',
        username: 'socialuser123',
        password: 'SecurePassw0rd!',
        termsAgreement: true
      };

      const response = await agent
        .post('/api/v1/auth/social/register')
        .set('x-csrf-token', csrfToken)
        .send(socialData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.affiliate.affiliateId).toBeDefined();
      expect(response.body.message).toContain('successfully');

      // Verify affiliate was created in database
      const affiliate = await Affiliate.findOne({ email: 'test@example.com' });
      expect(affiliate).toBeTruthy();
      expect(affiliate.firstName).toBe('John');
      expect(affiliate.lastName).toBe('Doe');
      expect(affiliate.registrationMethod).toBe('google');
      expect(affiliate.socialAccounts.google).toBeDefined();
      expect(affiliate.socialAccounts.google.id).toBe('google123');
    });

    test('should reject social registration with invalid social token', async () => {
      const socialData = {
        socialToken: 'invalid_token',
        businessName: 'Test Business',
        address: '123 Test St',
        city: 'Test City',
        state: 'TS',
        zipCode: '12345',
        phone: '+1234567890',
        serviceArea: 'Downtown',
        deliveryFee: 5.99,
        paymentMethod: 'check',
        username: 'testuser123',
        password: 'SecurePassw0rd!',
        termsAgreement: true
      };

      const response = await agent
        .post('/api/v1/auth/social/register')
        .set('x-csrf-token', csrfToken)
        .send(socialData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      // Check for either message or errors array format
      if (response.body.message) {
        expect(response.body.message).toContain('Invalid or expired social authentication token');
      } else if (response.body.errors) {
        expect(Array.isArray(response.body.errors)).toBe(true);
        expect(response.body.errors.some(err => err.msg && err.msg.includes('Invalid social token'))).toBe(true);
      }
    });

    test('should reject social registration with missing required fields', async () => {
      const socialData = {
        socialToken: generateMockSocialToken({
          provider: 'google',
          socialId: 'google123',
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe'
        }),
        // Missing required fields like address, city, etc.
        businessName: 'Test Business',
        deliveryFee: 5.99,
        termsAgreement: true
      };

      const response = await agent
        .post('/api/v1/auth/social/register')
        .set('x-csrf-token', csrfToken)
        .send(socialData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
    });

    test('should prevent duplicate social registrations', async () => {
      // Create first affiliate
      const hashedPassword = hashPassword('SecurePassword123!');
      const existingAffiliate = new Affiliate({
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@example.com',
        username: 'janesmith',
        passwordHash: hashedPassword.hash,
        passwordSalt: hashedPassword.salt,
        phone: '+1234567890',
        address: '456 Test Ave',
        city: 'Test City',
        state: 'TS',
        zipCode: '54321',
        serviceArea: 'Downtown',
        deliveryFee: 6.99,
        paymentMethod: 'check',
        registrationMethod: 'social',
        socialAccounts: {
          google: {
            id: 'google123',
            email: 'jane@example.com',
            linkedAt: new Date()
          }
        }
      });
      await existingAffiliate.save();

      // Try to register with same social ID
      const socialData = {
        socialToken: generateMockSocialToken({
          provider: 'google',
          socialId: 'google123', // Same social ID
          email: 'different@example.com',
          firstName: 'Different',
          lastName: 'User'
        }),
        businessName: 'Different Business',
        address: '789 Different St',
        city: 'Different City',
        state: 'DS',
        zipCode: '99999',
        phone: '+9876543210',
        serviceArea: 'Suburbs',
        deliveryFee: 7.99,
        paymentMethod: 'paypal',
        paypalEmail: 'different@example.com',
        username: 'differentuser123',
        password: 'SecurePassw0rd!',
        termsAgreement: true
      };

      const response = await agent
        .post('/api/v1/auth/social/register')
        .set('x-csrf-token', csrfToken)
        .send(socialData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('already registered');
    });
  });

  describe('Account Linking Flow', () => {
    beforeEach(async () => {
      // Create agent and get CSRF token
      agent = createAgent(app);
      csrfToken = await getCsrfToken(app, agent);
      
      // Create a traditional affiliate account for linking tests
      const hashedPassword = hashPassword('SecurePassword123!');
      const affiliate = new Affiliate({
        firstName: 'Link',
        lastName: 'Test',
        email: 'linktest@example.com',
        username: 'linktest',
        passwordHash: hashedPassword.hash,
        passwordSalt: hashedPassword.salt,
        phone: '+1234567890',
        address: '123 Link St',
        city: 'Link City',
        state: 'LC',
        zipCode: '12345',
        serviceArea: 'Downtown',
        deliveryFee: 5.99,
        paymentMethod: 'check',
        registrationMethod: 'traditional'
      });
      const savedAffiliate = await affiliate.save();
      affiliateId = savedAffiliate._id;
    });

    test('should link social account to existing affiliate by email', async () => {
      // Mock OAuth callback that would trigger account linking
      const linkingData = {
        provider: 'facebook',
        socialToken: generateMockSocialToken({
          provider: 'facebook',
          socialId: 'facebook456',
          email: 'linktest@example.com', // Same email as existing affiliate
          firstName: 'Link',
          lastName: 'Test'
        })
      };

      const response = await agent
        .post('/api/v1/auth/social/link')
        .set('x-csrf-token', csrfToken)
        .send(linkingData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('linked');

      // Verify social account was linked
      const updatedAffiliate = await Affiliate.findById(affiliateId);
      expect(updatedAffiliate.socialAccounts.facebook).toBeDefined();
      expect(updatedAffiliate.socialAccounts.facebook.id).toBe('facebook456');
      expect(updatedAffiliate.socialAccounts.facebook.linkedAt).toBeDefined();
    });

    test('should reject linking if social account already exists', async () => {
      // First, link a social account
      const affiliate = await Affiliate.findById(affiliateId);
      affiliate.socialAccounts.google = {
        id: 'google789',
        email: 'linktest@example.com',
        linkedAt: new Date()
      };
      await affiliate.save();

      // Try to link the same social account
      const linkingData = {
        provider: 'google',
        socialToken: generateMockSocialToken({
          provider: 'google',
          socialId: 'google789', // Same social ID
          email: 'linktest@example.com',
          firstName: 'Link',
          lastName: 'Test'
        })
      };

      const response = await agent
        .post('/api/v1/auth/social/link')
        .set('x-csrf-token', csrfToken)
        .send(linkingData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('already linked');
    });
  });

  describe('Social Login Flow', () => {
    beforeEach(async () => {
      // Create agent and get CSRF token
      agent = createAgent(app);
      csrfToken = await getCsrfToken(app, agent);
      
      // Create affiliate with linked social account
      const hashedPassword = hashPassword('SecurePassword123!');
      const affiliate = new Affiliate({
        firstName: 'Social',
        lastName: 'User',
        email: 'socialuser@example.com',
        username: 'socialuser',
        passwordHash: hashedPassword.hash,
        passwordSalt: hashedPassword.salt,
        phone: '+1234567890',
        address: '123 Social St',
        city: 'Social City',
        state: 'SC',
        zipCode: '12345',
        serviceArea: 'Downtown',
        deliveryFee: 5.99,
        paymentMethod: 'check',
        registrationMethod: 'social',
        socialAccounts: {
          linkedin: {
            id: 'linkedin999',
            email: 'socialuser@example.com',
            accessToken: 'mock_access_token',
            refreshToken: 'mock_refresh_token',
            linkedAt: new Date()
          }
        }
      });
      const savedAffiliate = await affiliate.save();
      affiliateId = savedAffiliate._id;
    });

    test('should successfully login with existing social account', async () => {
      // Simulate successful OAuth callback
      const loginData = {
        provider: 'linkedin',
        socialId: 'linkedin999'
      };

      const response = await agent
        .post('/api/v1/auth/social/callback')
        .set('x-csrf-token', csrfToken)
        .send(loginData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.token).toBeDefined();
      expect(response.body.refreshToken).toBeDefined();
      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe('socialuser@example.com');

      // Verify lastLogin was updated
      const updatedAffiliate = await Affiliate.findById(affiliateId);
      expect(updatedAffiliate.lastLogin).toBeDefined();
    });

    test('should update social account tokens on login', async () => {
      const loginData = {
        provider: 'linkedin',
        socialId: 'linkedin999',
        accessToken: 'new_access_token',
        refreshToken: 'new_refresh_token'
      };

      const response = await agent
        .post('/api/v1/auth/social/callback')
        .set('x-csrf-token', csrfToken)
        .send(loginData);

      expect(response.status).toBe(200);

      // Verify tokens were updated
      const updatedAffiliate = await Affiliate.findById(affiliateId);
      expect(updatedAffiliate.socialAccounts.linkedin.accessToken).toBe('new_access_token');
      expect(updatedAffiliate.socialAccounts.linkedin.refreshToken).toBe('new_refresh_token');
    });
  });

  describe('Security and Edge Cases', () => {
    test('should handle malformed social tokens gracefully', async () => {
      const response = await agent
        .post('/api/v1/auth/social/register')
        .set('x-csrf-token', csrfToken)
        .send({
          socialToken: 'malformed.token.here',
          businessName: 'Test Business',
          address: '123 Test St',
          city: 'Test City',
          state: 'TS',
          zipCode: '12345',
          phone: '+1234567890',
          serviceArea: 'Downtown',
          deliveryFee: 5.99,
          paymentMethod: 'check',
          username: 'testuser123',
          password: 'SecurePassw0rd!',
          termsAgreement: true
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      // Check for either message or errors array format
      if (response.body.message) {
        expect(response.body.message).toContain('Invalid or expired social authentication token');
      } else if (response.body.errors) {
        expect(Array.isArray(response.body.errors)).toBe(true);
        expect(response.body.errors.some(err => err.msg && err.msg.includes('Invalid social token'))).toBe(true);
      }
    });

    test('should handle expired social tokens', async () => {
      const expiredToken = generateMockSocialToken({
        provider: 'google',
        socialId: 'google123',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User'
      }, { expiresIn: -3600 }); // Expired 1 hour ago

      const response = await agent
        .post('/api/v1/auth/social/register')
        .set('x-csrf-token', csrfToken)
        .send({
          socialToken: expiredToken,
          businessName: 'Test Business',
          address: '123 Test St',
          city: 'Test City',
          state: 'TS',
          zipCode: '12345',
          phone: '+1234567890',
          serviceArea: 'Downtown',
          deliveryFee: 5.99,
          paymentMethod: 'check',
          username: 'testuser123',
          password: 'SecurePassw0rd!',
          termsAgreement: true
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      // Check for either message or errors array format
      if (response.body.message) {
        expect(response.body.message).toContain('expired');
      } else if (response.body.errors) {
        expect(Array.isArray(response.body.errors)).toBe(true);
        expect(response.body.errors.some(err => err.msg && err.msg.includes('expired'))).toBe(true);
      }
    });

    test('should sanitize social profile data', async () => {
      const socialData = {
        socialToken: generateMockSocialToken({
          provider: 'google',
          socialId: 'google123',
          email: '<script>alert("xss")</script>@example.com',
          firstName: '<img src=x onerror=alert("xss")>',
          lastName: 'User'
        }),
        businessName: 'Test Business',
        address: '123 Test St',
        city: 'Test City',
        state: 'TS',
        zipCode: '12345',
        phone: '+1234567890',
        serviceArea: 'Downtown',
        deliveryFee: 5.99,
        paymentMethod: 'check',
        termsAgreement: true
      };

      const response = await agent
        .post('/api/v1/auth/social/register')
        .set('x-csrf-token', csrfToken)
        .send(socialData);

      // Should either sanitize or reject malicious data
      if (response.status === 201) {
        const affiliate = await Affiliate.findOne({ 'socialAccounts.google.id': 'google123' });
        expect(affiliate.firstName).not.toContain('<script>');
        expect(affiliate.firstName).not.toContain('<img');
      } else {
        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
      }
    });

    test('should handle database errors during social registration', async () => {
      // Mock a database error
      const originalSave = Affiliate.prototype.save;
      Affiliate.prototype.save = jest.fn().mockRejectedValue(new Error('Database connection failed'));

      const socialData = {
        socialToken: generateMockSocialToken({
          provider: 'google',
          socialId: 'google123',
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User'
        }),
        businessName: 'Test Business',
        address: '123 Test St',
        city: 'Test City',
        state: 'TS',
        zipCode: '12345',
        phone: '+1234567890',
        serviceArea: 'Downtown',
        deliveryFee: 5.99,
        paymentMethod: 'check',
        username: 'testuser123',
        password: 'SecurePassw0rd!',
        termsAgreement: true
      };

      const response = await agent
        .post('/api/v1/auth/social/register')
        .set('x-csrf-token', csrfToken)
        .send(socialData);

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('failed');

      // Restore original save method
      Affiliate.prototype.save = originalSave;
    });
  });

  // Helper function to generate mock social tokens for testing
  function generateMockSocialToken(payload, options = {}) {
    const secret = process.env.JWT_SECRET || 'test-secret';
    const defaultOptions = {
      expiresIn: '1h',
      issuer: 'wavemax-social-auth'
    };
    
    return jwt.sign(payload, secret, { ...defaultOptions, ...options });
  }
});