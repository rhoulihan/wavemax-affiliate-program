// Full test for social auth routes including all edge cases
const express = require('express');
const request = require('supertest');

describe('Social Auth Routes - Full Coverage', () => {
  let app;
  let socialAuthRoutes;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Reset modules before each test
    jest.resetModules();
    
    // Reset environment variables
    process.env = { ...originalEnv };
    
    // Mock auth controller with all required methods
    const mockAuthController = {
      // OAuth callback handlers
      handleSocialCallback: jest.fn((req, res) => res.json({ success: true, provider: req.user.provider })),
      handleCustomerSocialCallback: jest.fn((req, res) => res.json({ success: true, provider: req.user.provider, isCustomer: true })),
      completeSocialRegistration: jest.fn((req, res) => res.status(201).json({ success: true, message: 'Registration completed' })),
      completeSocialCustomerRegistration: jest.fn((req, res) => res.status(201).json({ success: true, message: 'Customer registered' })),
      
      // Other auth methods that might be used by routes
      affiliateLogin: jest.fn(),
      customerLogin: jest.fn(),
      administratorLogin: jest.fn(),
      operatorLogin: jest.fn(),
      operatorAutoLogin: jest.fn(),
      checkEmail: jest.fn(),
      checkUsername: jest.fn(),
      forgotPassword: jest.fn(),
      resetPassword: jest.fn(),
      verifyToken: jest.fn(),
      refreshToken: jest.fn(),
      logout: jest.fn(),
      pollOAuthSession: jest.fn()
    };
    
    // Use doMock to ensure it's applied before require
    jest.doMock('../../server/controllers/authController', () => mockAuthController);
    
    jest.doMock('../../server/config/passport-config', () => ({
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
    
    jest.doMock('../../server/utils/passwordValidator', () => ({
      customPasswordValidator: jest.fn()
    }));
    
    // Create express app
    app = express();
    app.use(express.json());
    
    // Now require the routes after mocks are set up
    socialAuthRoutes = require('../../server/routes/socialAuthRoutes');
    app.use('/api/auth', socialAuthRoutes);
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
    jest.resetModules();
    jest.clearAllMocks();
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
        .get('/api/auth/google/callback');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ 
        success: true, 
        provider: 'google' 
      });
    });

    it('should pass state parameter through OAuth', async () => {
      process.env.GOOGLE_CLIENT_ID = 'test-client-id';
      process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';

      const response = await request(app)
        .get('/api/auth/google?state=test-state-123');

      expect(response.status).toBe(302);
      expect(response.headers.location).toContain('state=test-state-123');
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

    it('should return 404 when Facebook OAuth is not configured', async () => {
      delete process.env.FACEBOOK_APP_ID;
      delete process.env.FACEBOOK_APP_SECRET;

      const response = await request(app)
        .get('/api/auth/facebook');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        success: false,
        message: 'Facebook OAuth is not configured'
      });
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
    });
  });

  describe('Customer OAuth Routes', () => {
    it('should initiate Google OAuth for customers', async () => {
      process.env.GOOGLE_CLIENT_ID = 'test-client-id';
      process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';

      const response = await request(app)
        .get('/api/auth/customer/google');

      expect(response.status).toBe(302);
      expect(response.headers.location).toContain('https://google.com/oauth');
      expect(response.headers.location).toContain('state=customer');
    });

    it('should redirect customer Google OAuth callback', async () => {
      const response = await request(app)
        .get('/api/auth/customer/google/callback?code=test-code&state=test-state');

      expect(response.status).toBe(302);
      expect(response.headers.location).toContain('/api/v1/auth/google/callback');
      expect(response.headers.location).toContain('code=test-code');
      expect(response.headers.location).toContain('state=test-state');
    });
    
    it('should handle customer Facebook OAuth callback', async () => {
      const response = await request(app)
        .get('/api/auth/customer/facebook/callback');

      expect(response.status).toBe(200);
      expect(response.body.isCustomer).toBe(true);
    });
  });

  describe('Social Registration Completion', () => {
    it('should complete affiliate social registration', async () => {
      const authController = require('../../server/controllers/authController');
      
      const response = await request(app)
        .post('/api/auth/social/register')
        .send({
          password: 'TestPassword123!',
          businessName: 'Test Business',
          streetAddress: '123 Test St',
          city: 'Test City',
          state: 'CA',
          zipCode: '12345',
          serviceRadius: 10,
          minimumDeliveryFee: 25,
          perBagDeliveryFee: 5,
          paymentMethod: 'stripe'
        });

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('Registration completed');
      expect(authController.completeSocialRegistration).toHaveBeenCalled();
    });
  });
});