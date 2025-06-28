// Full test for social auth routes including all edge cases
const express = require('express');
const request = require('supertest');

// Mock passport-config
jest.mock('../../server/config/passport-config', () => ({
  authenticate: jest.fn((strategy, options) => {
    return (req, res, next) => {
      // Simulate passport authentication behavior
      if (strategy === 'google' || strategy === 'facebook' || strategy === 'linkedin') {
        if (options && options.session === false) {
          // This is a callback route
          req.user = { id: '12345', email: 'test@example.com', provider: strategy };
          next();
        } else {
          // This is an initial auth route - redirect to provider
          const state = options && options.state ? `&state=${options.state}` : '';
          res.redirect(`https://${strategy}.com/oauth?scope=${options.scope}${state}`);
        }
      }
    };
  })
}));

// Mock auth controller
const mockAuthController = {
  handleSocialCallback: jest.fn((req, res) => res.json({ success: true, provider: req.user.provider })),
  handleCustomerSocialCallback: jest.fn((req, res) => res.json({ success: true, provider: req.user.provider, isCustomer: true })),
  completeSocialRegistration: jest.fn((req, res) => res.status(201).json({ success: true, message: 'Registration completed' })),
  linkSocialAccount: jest.fn((req, res) => res.json({ success: true, message: 'Account linked' })),
  socialLogin: jest.fn((req, res) => res.json({ success: true, token: 'jwt-token' })),
  completeSocialCustomerRegistration: jest.fn((req, res) => res.status(201).json({ success: true, message: 'Customer registered' }))
};

jest.mock('../../server/controllers/authController', () => mockAuthController);

// Mock password validator
jest.mock('../../server/utils/passwordValidator', () => ({
  customPasswordValidator: jest.fn()
}));

describe('Social Auth Routes - Full Coverage', () => {
  let app;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Reset environment variables
    process.env = { ...originalEnv };
    
    // Clear all mocks
    jest.clearAllMocks();
    
    // Create express app
    app = express();
    app.use(express.json());
    
    // Load the actual routes
    const socialAuthRoutes = require('../../server/routes/socialAuthRoutes');
    app.use('/api/auth', socialAuthRoutes);
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
    jest.resetModules();
  });

  describe('Google OAuth Routes', () => {
    it('should initiate Google OAuth when configured', async () => {
      process.env.GOOGLE_CLIENT_ID = 'test-client-id';
      process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';

      const response = await request(app)
        .get('/api/auth/google');

      expect(response.status).toBe(302);
      expect(response.headers.location).toContain('https://google.com/oauth');
      expect(response.headers.location).toContain('scope=profile,email');
    });

    it('should pass state parameter through Google OAuth', async () => {
      process.env.GOOGLE_CLIENT_ID = 'test-client-id';
      process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';

      const response = await request(app)
        .get('/api/auth/google?state=test-state-123');

      expect(response.status).toBe(302);
      expect(response.headers.location).toContain('state=test-state-123');
    });

    it('should return 404 when Google OAuth is not configured', async () => {
      delete process.env.GOOGLE_CLIENT_ID;
      delete process.env.GOOGLE_CLIENT_SECRET;

      const response = await request(app)
        .get('/api/auth/google');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        success: false,
        message: 'Google OAuth is not configured'
      });
    });

    it('should handle Google OAuth callback', async () => {
      const response = await request(app)
        .get('/api/auth/google/callback?code=auth_code');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true, provider: 'google' });
      expect(mockAuthController.handleSocialCallback).toHaveBeenCalled();
    });
  });

  describe('Facebook OAuth Routes', () => {
    it('should initiate Facebook OAuth when configured', async () => {
      process.env.FACEBOOK_APP_ID = 'test-app-id';
      process.env.FACEBOOK_APP_SECRET = 'test-app-secret';

      const response = await request(app)
        .get('/api/auth/facebook');

      expect(response.status).toBe(302);
      expect(response.headers.location).toContain('https://facebook.com/oauth');
      expect(response.headers.location).toContain('scope=email');
    });

    it('should return 404 when Facebook OAuth is not configured (missing app ID)', async () => {
      delete process.env.FACEBOOK_APP_ID;
      process.env.FACEBOOK_APP_SECRET = 'test-app-secret';

      const response = await request(app)
        .get('/api/auth/facebook');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        success: false,
        message: 'Facebook OAuth is not configured'
      });
    });

    it('should return 404 when Facebook OAuth is not configured (missing app secret)', async () => {
      process.env.FACEBOOK_APP_ID = 'test-app-id';
      delete process.env.FACEBOOK_APP_SECRET;

      const response = await request(app)
        .get('/api/auth/facebook');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        success: false,
        message: 'Facebook OAuth is not configured'
      });
    });

    it('should handle Facebook OAuth callback', async () => {
      const response = await request(app)
        .get('/api/auth/facebook/callback?code=auth_code');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true, provider: 'facebook' });
      expect(mockAuthController.handleSocialCallback).toHaveBeenCalled();
    });
  });

  describe('LinkedIn OAuth Routes', () => {
    it('should initiate LinkedIn OAuth when configured', async () => {
      process.env.LINKEDIN_CLIENT_ID = 'test-client-id';
      process.env.LINKEDIN_CLIENT_SECRET = 'test-client-secret';

      const response = await request(app)
        .get('/api/auth/linkedin');

      expect(response.status).toBe(302);
      expect(response.headers.location).toContain('https://linkedin.com/oauth');
      expect(response.headers.location).toContain('scope=r_emailaddress,r_liteprofile');
    });

    it('should return 404 when LinkedIn OAuth is not configured (both missing)', async () => {
      delete process.env.LINKEDIN_CLIENT_ID;
      delete process.env.LINKEDIN_CLIENT_SECRET;

      const response = await request(app)
        .get('/api/auth/linkedin');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        success: false,
        message: 'LinkedIn OAuth is not configured'
      });
    });

    it('should return 404 when LinkedIn OAuth is not configured (missing client ID)', async () => {
      delete process.env.LINKEDIN_CLIENT_ID;
      process.env.LINKEDIN_CLIENT_SECRET = 'test-client-secret';

      const response = await request(app)
        .get('/api/auth/linkedin');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        success: false,
        message: 'LinkedIn OAuth is not configured'
      });
    });

    it('should handle LinkedIn OAuth callback', async () => {
      const response = await request(app)
        .get('/api/auth/linkedin/callback?code=auth_code');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true, provider: 'linkedin' });
      expect(mockAuthController.handleSocialCallback).toHaveBeenCalled();
    });
  });

  describe('Customer OAuth Routes', () => {
    it('should initiate Google OAuth for customers when configured', async () => {
      process.env.GOOGLE_CLIENT_ID = 'test-client-id';
      process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';

      const response = await request(app)
        .get('/api/auth/customer/google');

      expect(response.status).toBe(302);
      expect(response.headers.location).toContain('https://google.com/oauth');
      expect(response.headers.location).toContain('state=customer');
    });

    it('should pass state parameter for customer Google OAuth', async () => {
      process.env.GOOGLE_CLIENT_ID = 'test-client-id';
      process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';

      const response = await request(app)
        .get('/api/auth/customer/google?state=session123');

      expect(response.status).toBe(302);
      expect(response.headers.location).toContain('state=customer_session123');
    });

    it('should return 404 when customer Google OAuth is not configured', async () => {
      delete process.env.GOOGLE_CLIENT_ID;
      delete process.env.GOOGLE_CLIENT_SECRET;

      const response = await request(app)
        .get('/api/auth/customer/google');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        success: false,
        message: 'Google OAuth is not configured'
      });
    });

    it('should handle customer Google OAuth callback redirect', async () => {
      const response = await request(app)
        .get('/api/auth/customer/google/callback?code=auth_code&state=customer_123');

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/api/v1/auth/google/callback?code=auth_code&state=customer_123');
    });

    it('should handle customer Google OAuth callback redirect with multiple query params', async () => {
      const response = await request(app)
        .get('/api/auth/customer/google/callback?code=auth_code&state=customer_123&scope=email%20profile');

      expect(response.status).toBe(302);
      expect(response.headers.location).toContain('code=auth_code');
      expect(response.headers.location).toContain('state=customer_123');
      expect(response.headers.location).toContain('scope=email%20profile');
    });

    it('should initiate Facebook OAuth for customers when configured', async () => {
      process.env.FACEBOOK_APP_ID = 'test-app-id';
      process.env.FACEBOOK_APP_SECRET = 'test-app-secret';

      const response = await request(app)
        .get('/api/auth/customer/facebook');

      expect(response.status).toBe(302);
      expect(response.headers.location).toContain('https://facebook.com/oauth');
    });

    it('should pass state parameter for customer Facebook OAuth', async () => {
      process.env.FACEBOOK_APP_ID = 'test-app-id';
      process.env.FACEBOOK_APP_SECRET = 'test-app-secret';

      const response = await request(app)
        .get('/api/auth/customer/facebook?state=fb-state-456');

      expect(response.status).toBe(302);
      expect(response.headers.location).toContain('state=fb-state-456');
    });

    it('should return 404 when customer Facebook OAuth is not configured', async () => {
      delete process.env.FACEBOOK_APP_ID;
      delete process.env.FACEBOOK_APP_SECRET;

      const response = await request(app)
        .get('/api/auth/customer/facebook');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        success: false,
        message: 'Facebook OAuth is not configured'
      });
    });

    it('should handle customer Facebook callback', async () => {
      const response = await request(app)
        .get('/api/auth/customer/facebook/callback?code=auth_code');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true, provider: 'facebook', isCustomer: true });
      expect(mockAuthController.handleCustomerSocialCallback).toHaveBeenCalled();
    });

    it('should initiate LinkedIn OAuth for customers when configured', async () => {
      process.env.LINKEDIN_CLIENT_ID = 'test-client-id';
      process.env.LINKEDIN_CLIENT_SECRET = 'test-client-secret';

      const response = await request(app)
        .get('/api/auth/customer/linkedin');

      expect(response.status).toBe(302);
      expect(response.headers.location).toContain('https://linkedin.com/oauth');
    });

    it('should pass state parameter for customer LinkedIn OAuth', async () => {
      process.env.LINKEDIN_CLIENT_ID = 'test-client-id';
      process.env.LINKEDIN_CLIENT_SECRET = 'test-client-secret';

      const response = await request(app)
        .get('/api/auth/customer/linkedin?state=li-state-789');

      expect(response.status).toBe(302);
      expect(response.headers.location).toContain('state=li-state-789');
    });

    it('should return 404 when customer LinkedIn OAuth is not configured', async () => {
      delete process.env.LINKEDIN_CLIENT_ID;
      delete process.env.LINKEDIN_CLIENT_SECRET;

      const response = await request(app)
        .get('/api/auth/customer/linkedin');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        success: false,
        message: 'LinkedIn OAuth is not configured'
      });
    });

    it('should handle customer LinkedIn callback', async () => {
      const response = await request(app)
        .get('/api/auth/customer/linkedin/callback?code=auth_code');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true, provider: 'linkedin', isCustomer: true });
      expect(mockAuthController.handleCustomerSocialCallback).toHaveBeenCalled();
    });
  });

  describe('Social Registration Routes', () => {
    it('should handle social registration with valid data', async () => {
      const response = await request(app)
        .post('/api/auth/social/register')
        .send({
          socialToken: 'valid-token',
          phone: '123-456-7890',
          address: '123 Main St',
          city: 'Austin',
          state: 'TX',
          zipCode: '78701',
          serviceLatitude: 30.2672,
          serviceLongitude: -97.7431,
          serviceRadius: 10,
          paymentMethod: 'paypal'
        });

      expect(response.status).toBe(201);
      expect(response.body).toEqual({ success: true, message: 'Registration completed' });
      expect(mockAuthController.completeSocialRegistration).toHaveBeenCalled();
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/auth/social/register')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors).toContainEqual(
        expect.objectContaining({ msg: 'Social authentication token is required' })
      );
    });

    it('should validate numeric fields', async () => {
      const response = await request(app)
        .post('/api/auth/social/register')
        .send({
          socialToken: 'valid-token',
          phone: '123-456-7890',
          address: '123 Main St',
          city: 'Austin',
          state: 'TX',
          zipCode: '78701',
          serviceLatitude: 'not-a-number',
          serviceLongitude: 'not-a-number',
          serviceRadius: 'not-a-number',
          paymentMethod: 'paypal'
        });

      expect(response.status).toBe(400);
      expect(response.body.errors).toContainEqual(
        expect.objectContaining({ msg: 'Service latitude is required' })
      );
    });

    it('should validate optional delivery fee fields', async () => {
      const response = await request(app)
        .post('/api/auth/social/register')
        .send({
          socialToken: 'valid-token',
          phone: '123-456-7890',
          address: '123 Main St',
          city: 'Austin',
          state: 'TX',
          zipCode: '78701',
          serviceLatitude: 30.2672,
          serviceLongitude: -97.7431,
          serviceRadius: 10,
          minimumDeliveryFee: 'not-a-number',
          perBagDeliveryFee: 'not-a-number',
          paymentMethod: 'paypal'
        });

      expect(response.status).toBe(400);
      expect(response.body.errors).toContainEqual(
        expect.objectContaining({ msg: 'Minimum delivery fee must be a number' })
      );
      expect(response.body.errors).toContainEqual(
        expect.objectContaining({ msg: 'Per-bag delivery fee must be a number' })
      );
    });
  });

  describe('Social Account Linking', () => {
    it('should handle social account linking', async () => {
      const response = await request(app)
        .post('/api/auth/social/link')
        .send({
          provider: 'google',
          socialToken: 'valid-token'
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true, message: 'Account linked' });
      expect(mockAuthController.linkSocialAccount).toHaveBeenCalled();
    });

    it('should validate provider', async () => {
      const response = await request(app)
        .post('/api/auth/social/link')
        .send({
          provider: 'invalid-provider',
          socialToken: 'valid-token'
        });

      expect(response.status).toBe(400);
      expect(response.body.errors).toContainEqual(
        expect.objectContaining({ msg: 'Invalid social media provider' })
      );
    });
  });

  describe('Social Login Callback', () => {
    it('should handle social login callback', async () => {
      const response = await request(app)
        .post('/api/auth/social/callback')
        .send({
          provider: 'linkedin',
          socialId: 'linkedin123'
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true, token: 'jwt-token' });
      expect(mockAuthController.socialLogin).toHaveBeenCalled();
    });
  });

  describe('Customer Social Registration', () => {
    it('should handle customer social registration', async () => {
      const response = await request(app)
        .post('/api/auth/customer/social/register')
        .send({
          socialToken: 'valid-token',
          affiliateId: 'AFF123',
          phone: '123-456-7890',
          address: '123 Main St',
          city: 'Austin',
          state: 'TX',
          zipCode: '78701',
          serviceFrequency: 'weekly'
        });

      expect(response.status).toBe(201);
      expect(response.body).toEqual({ success: true, message: 'Customer registered' });
      expect(mockAuthController.completeSocialCustomerRegistration).toHaveBeenCalled();
    });

    it('should validate service frequency', async () => {
      const response = await request(app)
        .post('/api/auth/customer/social/register')
        .send({
          socialToken: 'valid-token',
          affiliateId: 'AFF123',
          phone: '123-456-7890',
          address: '123 Main St',
          city: 'Austin',
          state: 'TX',
          zipCode: '78701',
          serviceFrequency: 'daily'
        });

      expect(response.status).toBe(400);
      expect(response.body.errors).toContainEqual(
        expect.objectContaining({ msg: 'Invalid service frequency' })
      );
    });
  });
});