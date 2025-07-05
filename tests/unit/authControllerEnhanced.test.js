// Enhanced Auth Controller Unit Tests for New OAuth Functionality

const authController = require('../../server/controllers/authController');
const OAuthSession = require('../../server/models/OAuthSession');
const Affiliate = require('../../server/models/Affiliate');
const Customer = require('../../server/models/Customer');
const RefreshToken = require('../../server/models/RefreshToken');
const jwt = require('jsonwebtoken');
const { sanitizeInput } = require('../../server/middleware/sanitization');

// Mock dependencies
jest.mock('../../server/models/OAuthSession');
jest.mock('../../server/models/Affiliate');
jest.mock('../../server/models/Customer');
jest.mock('../../server/models/RefreshToken');
jest.mock('jsonwebtoken');
jest.mock('../../server/middleware/sanitization');

describe('Enhanced Auth Controller - OAuth Methods', () => {
  let req, res;

  beforeEach(() => {
    req = {
      body: {},
      user: {},
      query: {},
      params: {},
      headers: {}
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      redirect: jest.fn(),
      send: jest.fn()
    };

    // Reset all mocks
    jest.clearAllMocks();

    // Setup RefreshToken mock
    RefreshToken.mockImplementation(() => ({
      save: jest.fn().mockResolvedValue({
        _id: 'refresh-token-id',
        token: 'mock-refresh-token',
        userId: 'mock-user-id',
        userType: 'affiliate'
      })
    }));
  });

  describe('handleSocialCallback', () => {
    beforeEach(() => {
      req.user = {
        isNewUser: true,  // Key flag for new user registration flow
        provider: 'google',
        socialId: 'google123',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        profileData: { picture: 'https://example.com/photo.jpg' }
      };
      req.query = {
        state: 'oauth_test-session-id',  // OAuth prefix required for sessionId
        popup: 'true'  // Ensure popup mode
      };
    });

    test('should create OAuth session and redirect for affiliate context', async () => {
      // Mock user not found to trigger OAuth session creation for new user
      Affiliate.findOne = jest.fn().mockResolvedValue(null);

      OAuthSession.createSession = jest.fn().mockResolvedValue({
        sessionId: 'oauth_test-session-id'
      });

      await authController.handleSocialCallback(req, res);

      expect(OAuthSession.createSession).toHaveBeenCalledWith('oauth_test-session-id', expect.objectContaining({
        provider: 'google',
        type: 'social-auth-success'
      }));

      expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining('oauth-success.html'));
      expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining('social-auth-success'));
      expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining('google'));
    });

    test('should handle customer context from state parameter', async () => {
      req.query.state = 'customer_test-session-id';

      // Mock the handleCustomerSocialCallback function
      const originalHandleCustomerSocialCallback = authController.handleCustomerSocialCallback;
      authController.handleCustomerSocialCallback = jest.fn().mockResolvedValue();

      await authController.handleSocialCallback(req, res);

      expect(authController.handleCustomerSocialCallback).toHaveBeenCalledWith(req, res);

      // Restore original function
      authController.handleCustomerSocialCallback = originalHandleCustomerSocialCallback;
    });

    test('should handle missing user data gracefully', async () => {
      req.user = null;
      req.query = {}; // Ensure no popup or state parameters
      req.headers = {}; // Ensure no referer headers

      await authController.handleSocialCallback(req, res);

      // When user is null and not a popup, it redirects to registration page with error
      expect(res.redirect).toHaveBeenCalledWith('/affiliate-register-embed.html?error=social_auth_failed');
    });

    test('should handle OAuth session creation errors', async () => {
      // Set up popup request with sessionId and existing user to trigger session creation
      req.query.state = 'oauth_test-session-id';
      req.user = {
        _id: 'user123',
        affiliateId: 'AFF123',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        businessName: 'Test Business',
        username: 'johndoe',
        isNewUser: false
      };

      OAuthSession.createSession = jest.fn().mockRejectedValue(new Error('Database error'));
      jwt.sign = jest.fn().mockReturnValue('mock-token');

      await authController.handleSocialCallback(req, res);

      // Should still redirect despite database error (error is logged but doesn't stop execution)
      expect(res.redirect).toHaveBeenCalled();
      expect(OAuthSession.createSession).toHaveBeenCalled();
    });

    test('should extract profile data correctly for different providers', async () => {
      // Set up state to trigger session creation and set user as new user
      req.query.state = 'oauth_test-session-id';
      req.user = {
        provider: 'facebook',
        socialId: 'facebook123',
        email: 'facebook@example.com',
        firstName: 'Jane',
        lastName: 'Smith',
        accessToken: 'facebook-access-token',
        refreshToken: 'facebook-refresh-token',
        profileData: { photos: [{ value: 'https://facebook.com/photo.jpg' }] },
        isNewUser: true // This will trigger registration flow
      };

      OAuthSession.createSession = jest.fn().mockResolvedValue({});
      jwt.sign = jest.fn().mockReturnValue('mock-social-token');

      await authController.handleSocialCallback(req, res);

      expect(OAuthSession.createSession).toHaveBeenCalledWith('oauth_test-session-id',
        expect.objectContaining({
          type: 'social-auth-success',
          provider: 'facebook',
          socialToken: expect.any(String)
        })
      );
    });
  });

  describe('handleCustomerSocialCallback', () => {
    beforeEach(() => {
      req.user = {
        provider: 'google',
        socialId: 'google123',
        email: 'customer@example.com',
        firstName: 'Customer',
        lastName: 'User',
        isNewUser: true
      };
      req.query = { state: 'customer_oauth_test-session-id' };
    });

    test('should create customer OAuth session', async () => {
      OAuthSession.createSession = jest.fn().mockResolvedValue({});
      jwt.sign = jest.fn().mockReturnValue('mock-customer-social-token');

      await authController.handleCustomerSocialCallback(req, res);

      expect(OAuthSession.createSession).toHaveBeenCalledWith('oauth_test',
        expect.objectContaining({
          type: 'social-auth-success',
          provider: 'google',
          socialToken: 'mock-customer-social-token'
        })
      );

      expect(res.send).toHaveBeenCalledWith(expect.stringContaining('social-auth-success'));
      expect(res.send).toHaveBeenCalledWith(expect.stringContaining('mock-customer-social-token'));
      expect(res.send).toHaveBeenCalledWith(expect.stringContaining('google'));
    });
  });

  describe('completeSocialRegistration', () => {
    beforeEach(() => {
      req.body = {
        socialToken: 'valid-jwt-token',
        phone: '+1234567890',
        businessName: 'Test Business',
        address: '123 Test St',
        city: 'Test City',
        state: 'TS',
        zipCode: '12345',
        serviceArea: 'Downtown',
        deliveryFee: 5.99,
        paymentMethod: 'check'
      };

      jwt.verify = jest.fn().mockReturnValue({
        provider: 'google',
        socialId: 'google123',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe'
      });

      sanitizeInput.mockImplementation(data => data);
      Affiliate.findOne = jest.fn().mockResolvedValue(null);
      Affiliate.countDocuments = jest.fn().mockResolvedValue(5);
    });

    test('should complete social registration successfully', async () => {
      const mockAffiliate = {
        save: jest.fn().mockResolvedValue({
          affiliateId: 'AFF000006',
          firstName: 'John',
          lastName: 'Doe'
        })
      };

      Affiliate.mockImplementation(() => mockAffiliate);

      await authController.completeSocialRegistration(req, res);

      expect(jwt.verify).toHaveBeenCalledWith('valid-jwt-token', process.env.JWT_SECRET);
      expect(sanitizeInput).toHaveBeenCalled();
      expect(mockAffiliate.save).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
    });

    test('should sanitize social data and reject if fields become empty', async () => {
      jwt.verify = jest.fn().mockReturnValue({
        provider: 'google',
        socialId: 'google123',
        email: 'test@example.com',
        firstName: '<script>alert("xss")</script>',
        lastName: 'Doe'
      });

      sanitizeInput.mockReturnValue({
        provider: 'google',
        socialId: 'google123',
        email: 'test@example.com',
        firstName: '', // Sanitization removed malicious content
        lastName: 'Doe'
      });

      await authController.completeSocialRegistration(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid social profile data'
      });
    });

    test('should check for existing email and username', async () => {
      Affiliate.findOne = jest.fn()
        .mockResolvedValueOnce(null) // Username uniqueness check (line 1170)
        .mockResolvedValueOnce({ email: 'test@example.com' }); // Email/username conflict check (line 1180)

      await authController.completeSocialRegistration(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Email or username already exists'
      });
    });

    test('should check for existing social account', async () => {
      Affiliate.findOne = jest.fn()
        .mockResolvedValueOnce(null) // Username uniqueness check (line 1170)
        .mockResolvedValueOnce(null) // Email/username conflict check (line 1180)
        .mockResolvedValueOnce({ affiliateId: 'AFF123456' }); // Social account conflict check (line 1193)

      await authController.completeSocialRegistration(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'This social media account is already registered with another affiliate account'
      });
    });

    test('should generate unique username from social data', async () => {
      jwt.verify = jest.fn().mockReturnValue({
        provider: 'google',
        socialId: 'google123',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe-Smith'
      });

      Affiliate.findOne = jest.fn()
        .mockResolvedValueOnce({ username: 'johndoesmith' }) // First username taken (line 1170)
        .mockResolvedValueOnce(null) // Second username available (line 1170)
        .mockResolvedValueOnce(null) // Email/username conflict check (line 1180)
        .mockResolvedValueOnce(null); // Social account conflict check (line 1193)

      const mockAffiliate = {
        save: jest.fn().mockResolvedValue({
          affiliateId: 'AFF000006',
          username: 'johndoesmith1'
        })
      };

      Affiliate.mockImplementation((data) => {
        expect(data.username).toBe('johndoesmith1');
        return mockAffiliate;
      });

      await authController.completeSocialRegistration(req, res);

      expect(mockAffiliate.save).toHaveBeenCalled();
    });

    test('should handle JWT verification errors', async () => {
      jwt.verify = jest.fn().mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await authController.completeSocialRegistration(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid or expired social authentication token'
      });
    });
  });

  describe('completeSocialCustomerRegistration', () => {
    beforeEach(() => {
      req.body = {
        socialToken: 'valid-customer-jwt-token',
        affiliateId: 'AFF123456',
        phone: '+1234567890',
        address: '456 Customer St',
        city: 'Customer City',
        state: 'CS',
        zipCode: '54321',
        serviceFrequency: 'weekly'
      };

      jwt.verify = jest.fn().mockReturnValue({
        provider: 'facebook',
        socialId: 'facebook456',
        email: 'customer@example.com',
        firstName: 'Jane',
        lastName: 'Customer'
      });

      sanitizeInput.mockImplementation(data => data);
      Customer.findOne = jest.fn().mockResolvedValue(null);
      Customer.countDocuments = jest.fn().mockResolvedValue(10);
      Affiliate.findOne = jest.fn().mockResolvedValue({ affiliateId: 'AFF123456' });
    });

    test('should complete customer social registration successfully', async () => {
      const mockCustomer = {
        save: jest.fn().mockResolvedValue({
          customerId: 'CUST000011',
          firstName: 'Jane',
          lastName: 'Customer'
        })
      };

      Customer.mockImplementation(() => mockCustomer);

      await authController.completeSocialCustomerRegistration(req, res);

      expect(jwt.verify).toHaveBeenCalledWith('valid-customer-jwt-token', process.env.JWT_SECRET);
      expect(sanitizeInput).toHaveBeenCalled();
      expect(mockCustomer.save).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
    });

    test('should validate affiliate existence', async () => {
      Affiliate.findOne = jest.fn().mockResolvedValue(null);

      await authController.completeSocialCustomerRegistration(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid affiliate ID'
      });
    });

    test('should sanitize customer social data', async () => {
      jwt.verify = jest.fn().mockReturnValue({
        provider: 'facebook',
        socialId: 'facebook456',
        email: 'customer@example.com',
        firstName: '<img src=x onerror=alert("xss")>',
        lastName: 'Customer'
      });

      sanitizeInput.mockReturnValue({
        provider: 'facebook',
        socialId: 'facebook456',
        email: 'customer@example.com',
        firstName: '', // Sanitized to empty
        lastName: 'Customer'
      });

      await authController.completeSocialCustomerRegistration(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid social profile data'
      });
    });
  });

  // Note: socialLogin and linkSocialAccount methods were removed as dead code
  // OAuth functionality is handled through handleSocialCallback and handleCustomerSocialCallback methods
  
  /*
  describe('socialLogin - REMOVED', () => {
    // This method was removed from authController as it was not being used
    // Social login is handled through OAuth callback methods instead
  });
  
  describe('linkSocialAccount - REMOVED', () => {
    // This method was removed from authController as it was not being used
    // Social account linking happens automatically during OAuth registration
  });
  */

  describe('pollOAuthSession', () => {
    beforeEach(() => {
      req.params = { sessionId: 'test-session-123' };
    });

    test('should return complete session data when available', async () => {
      const mockSessionData = {
        type: 'social-auth-success',
        provider: 'google',
        socialToken: 'social-jwt-token',
        socialId: 'google123',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe'
      };

      OAuthSession.consumeSession = jest.fn().mockResolvedValue(mockSessionData);

      await authController.pollOAuthSession(req, res);

      expect(OAuthSession.consumeSession).toHaveBeenCalledWith('test-session-123');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        result: mockSessionData
      });
    });

    test('should return social-auth-login session data', async () => {
      const mockSessionData = {
        type: 'social-auth-login',
        token: 'jwt-token',
        refreshToken: 'refresh-token',
        affiliate: {
          affiliateId: 'AFF001',
          id: 'affiliate-id',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          businessName: 'Test Business'
        }
      };

      OAuthSession.consumeSession = jest.fn().mockResolvedValue(mockSessionData);

      await authController.pollOAuthSession(req, res);

      expect(OAuthSession.consumeSession).toHaveBeenCalledWith('test-session-123');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        result: mockSessionData
      });
    });

    test('should return social-auth-error session data', async () => {
      const mockSessionData = {
        type: 'social-auth-error',
        message: 'Social authentication failed'
      };

      OAuthSession.consumeSession = jest.fn().mockResolvedValue(mockSessionData);

      await authController.pollOAuthSession(req, res);

      expect(OAuthSession.consumeSession).toHaveBeenCalledWith('test-session-123');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        result: mockSessionData
      });
    });

    test('should return social-auth-account-conflict session data for affiliate conflict', async () => {
      const mockSessionData = {
        type: 'social-auth-account-conflict',
        message: 'This social media account is already associated with an affiliate account. Would you like to login as an affiliate instead?',
        provider: 'google',
        accountType: 'affiliate',
        affiliateData: {
          affiliateId: 'AFF123456',
          firstName: 'John',
          lastName: 'Affiliate',
          email: 'john@example.com',
          businessName: 'Johns Business'
        }
      };

      OAuthSession.consumeSession = jest.fn().mockResolvedValue(mockSessionData);

      await authController.pollOAuthSession(req, res);

      expect(OAuthSession.consumeSession).toHaveBeenCalledWith('test-session-123');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        result: mockSessionData
      });
    });

    test('should return social-auth-account-conflict session data for customer conflict', async () => {
      const mockSessionData = {
        type: 'social-auth-account-conflict',
        message: 'This social media account is already associated with a customer account. Would you like to login as a customer instead?',
        provider: 'google',
        accountType: 'customer',
        customerData: {
          firstName: 'Jane',
          lastName: 'Customer',
          email: 'jane@example.com'
        }
      };

      OAuthSession.consumeSession = jest.fn().mockResolvedValue(mockSessionData);

      await authController.pollOAuthSession(req, res);

      expect(OAuthSession.consumeSession).toHaveBeenCalledWith('test-session-123');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        result: mockSessionData
      });
    });

    test('should return pending status when session not ready', async () => {
      OAuthSession.consumeSession = jest.fn().mockResolvedValue(null);

      await authController.pollOAuthSession(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Session not found or expired'
      });
    });

    test('should handle database errors gracefully', async () => {
      OAuthSession.consumeSession = jest.fn().mockRejectedValue(new Error('Database error'));

      await authController.pollOAuthSession(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'An error occurred while polling OAuth session'
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle malformed JWT tokens', async () => {
      req.body = {
        socialToken: 'malformed.jwt.token',
        phone: '+1234567890',
        businessName: 'Test Business'
      };

      jwt.verify = jest.fn().mockImplementation(() => {
        throw new Error('jwt malformed');
      });

      await authController.completeSocialRegistration(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid or expired social authentication token'
      });
    });

    test('should handle database connection errors', async () => {
      req.body = {
        socialToken: 'valid-jwt-token',
        phone: '+1234567890',
        businessName: 'Test Business'
      };

      jwt.verify = jest.fn().mockReturnValue({
        provider: 'google',
        socialId: 'google123',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe'
      });

      Affiliate.findOne = jest.fn().mockRejectedValue(new Error('Database connection failed'));

      await authController.completeSocialRegistration(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid or expired social authentication token'
      });
    });

    test('should handle missing required fields in social data', async () => {
      req.body = {
        socialToken: 'incomplete-jwt-token',
        phone: '+1234567890'
      };

      jwt.verify = jest.fn().mockReturnValue({
        provider: 'google',
        socialId: 'google123'
        // Missing email, firstName, lastName
      });

      sanitizeInput.mockImplementation(data => data);

      await authController.completeSocialRegistration(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid social profile data'
      });
    });
  });
});