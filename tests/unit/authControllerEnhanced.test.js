// Enhanced Auth Controller Unit Tests for New OAuth Functionality

const authController = require('../../server/controllers/authController');
const OAuthSession = require('../../server/models/OAuthSession');
const Affiliate = require('../../server/models/Affiliate');
const Customer = require('../../server/models/Customer');
const jwt = require('jsonwebtoken');
const { sanitizeInput } = require('../../server/middleware/sanitization');

// Mock dependencies
jest.mock('../../server/models/OAuthSession');
jest.mock('../../server/models/Affiliate');
jest.mock('../../server/models/Customer');
jest.mock('jsonwebtoken');
jest.mock('../../server/middleware/sanitization');

describe('Enhanced Auth Controller - OAuth Methods', () => {
  let req, res;

  beforeEach(() => {
    req = {
      body: {},
      user: {},
      query: {},
      params: {}
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      redirect: jest.fn()
    };

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('handleSocialCallback', () => {
    beforeEach(() => {
      req.user = {
        provider: 'google',
        id: 'google123',
        emails: [{ value: 'test@example.com' }],
        name: { givenName: 'John', familyName: 'Doe' },
        _json: { picture: 'https://example.com/photo.jpg' }
      };
      req.query = { state: 'test-session-id' };
    });

    test('should create OAuth session and redirect for affiliate context', async () => {
      OAuthSession.createSession = jest.fn().mockResolvedValue({
        sessionId: 'test-session-id'
      });

      await authController.handleSocialCallback(req, res);

      expect(OAuthSession.createSession).toHaveBeenCalledWith({
        sessionId: 'test-session-id',
        provider: 'google',
        socialId: 'google123',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        profileData: expect.any(Object),
        context: 'affiliate'
      });

      expect(res.redirect).toHaveBeenCalledWith('/affiliate-register-embed.html?session=test-session-id');
    });

    test('should handle customer context from state parameter', async () => {
      req.query.state = 'customer_test-session-id';

      OAuthSession.createSession = jest.fn().mockResolvedValue({
        sessionId: 'test-session-id'
      });

      await authController.handleSocialCallback(req, res);

      expect(OAuthSession.createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'test-session-id',
          context: 'customer'
        })
      );

      expect(res.redirect).toHaveBeenCalledWith('/customer-register-embed.html?session=test-session-id');
    });

    test('should handle missing user data gracefully', async () => {
      req.user = null;

      await authController.handleSocialCallback(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'OAuth authentication failed'
      });
    });

    test('should handle OAuth session creation errors', async () => {
      OAuthSession.createSession = jest.fn().mockRejectedValue(new Error('Database error'));

      await authController.handleSocialCallback(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Authentication processing failed'
      });
    });

    test('should extract profile data correctly for different providers', async () => {
      // Test Facebook profile structure
      req.user = {
        provider: 'facebook',
        id: 'facebook123',
        emails: [{ value: 'facebook@example.com' }],
        name: { givenName: 'Jane', familyName: 'Smith' },
        photos: [{ value: 'https://facebook.com/photo.jpg' }]
      };

      OAuthSession.createSession = jest.fn().mockResolvedValue({});

      await authController.handleSocialCallback(req, res);

      expect(OAuthSession.createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'facebook',
          socialId: 'facebook123',
          email: 'facebook@example.com',
          firstName: 'Jane',
          lastName: 'Smith'
        })
      );
    });
  });

  describe('handleCustomerSocialCallback', () => {
    beforeEach(() => {
      req.user = {
        provider: 'google',
        id: 'google123',
        emails: [{ value: 'customer@example.com' }],
        name: { givenName: 'Customer', familyName: 'User' }
      };
      req.query = { state: 'customer-session-id' };
    });

    test('should create customer OAuth session', async () => {
      OAuthSession.createSession = jest.fn().mockResolvedValue({});

      await authController.handleCustomerSocialCallback(req, res);

      expect(OAuthSession.createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'customer-session-id',
          context: 'customer'
        })
      );

      expect(res.redirect).toHaveBeenCalledWith('/customer-register-embed.html?session=customer-session-id');
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

      sanitizeInput = jest.fn().mockImplementation(data => data);
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

      sanitizeInput = jest.fn().mockReturnValue({
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
        .mockResolvedValueOnce({ email: 'test@example.com' }); // First call for email check

      await authController.completeSocialRegistration(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Email or username already exists'
      });
    });

    test('should check for existing social account', async () => {
      Affiliate.findOne = jest.fn()
        .mockResolvedValueOnce(null) // First call for email/username check
        .mockResolvedValueOnce({ affiliateId: 'AFF123456' }); // Second call for social account check

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
        .mockResolvedValueOnce(null) // Email/username check
        .mockResolvedValueOnce(null) // Social account check
        .mockResolvedValueOnce({ username: 'johndoesmith' }) // First username taken
        .mockResolvedValueOnce(null); // Second username available

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

      sanitizeInput = jest.fn().mockImplementation(data => data);
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

      sanitizeInput = jest.fn().mockReturnValue({
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

  describe('socialLogin', () => {
    beforeEach(() => {
      req.body = {
        provider: 'google',
        socialId: 'google123'
      };
    });

    test('should login existing affiliate with social account', async () => {
      const mockAffiliate = {
        affiliateId: 'AFF123456',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        socialAccounts: {
          google: { id: 'google123' }
        },
        save: jest.fn().mockResolvedValue()
      };

      Affiliate.findOne = jest.fn().mockResolvedValue(mockAffiliate);
      jwt.sign = jest.fn().mockReturnValue('jwt-token');

      await authController.socialLogin(req, res);

      expect(Affiliate.findOne).toHaveBeenCalledWith({
        'socialAccounts.google.id': 'google123'
      });

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        token: 'jwt-token',
        refreshToken: expect.any(String),
        user: expect.objectContaining({
          affiliateId: 'AFF123456',
          firstName: 'John',
          lastName: 'Doe'
        })
      });
    });

    test('should return error for non-existent social account', async () => {
      Affiliate.findOne = jest.fn().mockResolvedValue(null);
      Customer.findOne = jest.fn().mockResolvedValue(null);

      await authController.socialLogin(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'No account found with this social media login'
      });
    });

    test('should login existing customer with social account', async () => {
      const mockCustomer = {
        customerId: 'CUST123456',
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@example.com',
        socialAccounts: {
          facebook: { id: 'facebook123' }
        },
        save: jest.fn().mockResolvedValue()
      };

      req.body.provider = 'facebook';
      req.body.socialId = 'facebook123';

      Affiliate.findOne = jest.fn().mockResolvedValue(null);
      Customer.findOne = jest.fn().mockResolvedValue(mockCustomer);
      jwt.sign = jest.fn().mockReturnValue('customer-jwt-token');

      await authController.socialLogin(req, res);

      expect(Customer.findOne).toHaveBeenCalledWith({
        'socialAccounts.facebook.id': 'facebook123'
      });

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        token: 'customer-jwt-token',
        refreshToken: expect.any(String),
        user: expect.objectContaining({
          customerId: 'CUST123456',
          firstName: 'Jane',
          lastName: 'Doe'
        })
      });
    });
  });

  describe('linkSocialAccount', () => {
    beforeEach(() => {
      req.body = {
        provider: 'linkedin',
        socialToken: 'linkedin-jwt-token'
      };
      req.user = {
        userId: '507f1f77bcf86cd799439011',
        role: 'affiliate',
        affiliateId: 'AFF123456'
      };

      jwt.verify = jest.fn().mockReturnValue({
        provider: 'linkedin',
        socialId: 'linkedin789',
        email: 'john@example.com',
        firstName: 'John',
        lastName: 'Doe'
      });
    });

    test('should link social account to existing affiliate', async () => {
      const mockAffiliate = {
        affiliateId: 'AFF123456',
        socialAccounts: {},
        save: jest.fn().mockResolvedValue()
      };

      Affiliate.findOne = jest.fn()
        .mockResolvedValueOnce(null) // Check if social account exists
        .mockResolvedValueOnce(mockAffiliate); // Get current user

      await authController.linkSocialAccount(req, res);

      expect(mockAffiliate.socialAccounts.linkedin).toEqual({
        id: 'linkedin789',
        email: 'john@example.com',
        name: 'John Doe'
      });

      expect(mockAffiliate.save).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });

    test('should prevent linking already existing social account', async () => {
      Affiliate.findOne = jest.fn()
        .mockResolvedValueOnce({ affiliateId: 'AFF999999' }); // Social account exists

      await authController.linkSocialAccount(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'This social media account is already linked to another account'
      });
    });

    test('should handle user not found error', async () => {
      Affiliate.findOne = jest.fn()
        .mockResolvedValueOnce(null) // No existing social account
        .mockResolvedValueOnce(null); // User not found

      await authController.linkSocialAccount(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'User not found'
      });
    });
  });

  describe('pollOAuthSession', () => {
    beforeEach(() => {
      req.params = { sessionId: 'test-session-123' };
    });

    test('should return session data when available', async () => {
      const mockSessionData = {
        sessionId: 'test-session-123',
        provider: 'google',
        socialId: 'google123',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        context: 'affiliate'
      };

      OAuthSession.consumeSession = jest.fn().mockResolvedValue(mockSessionData);
      jwt.sign = jest.fn().mockReturnValue('social-jwt-token');

      await authController.pollOAuthSession(req, res);

      expect(OAuthSession.consumeSession).toHaveBeenCalledWith('test-session-123');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        socialToken: 'social-jwt-token',
        userData: expect.objectContaining({
          provider: 'google',
          email: 'test@example.com'
        })
      });
    });

    test('should return pending status when session not ready', async () => {
      OAuthSession.consumeSession = jest.fn().mockResolvedValue(null);

      await authController.pollOAuthSession(req, res);

      expect(res.status).toHaveBeenCalledWith(202);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'OAuth session not ready yet'
      });
    });

    test('should handle database errors gracefully', async () => {
      OAuthSession.consumeSession = jest.fn().mockRejectedValue(new Error('Database error'));

      await authController.pollOAuthSession(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Error checking OAuth session'
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

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Registration failed'
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

      sanitizeInput = jest.fn().mockImplementation(data => data);

      await authController.completeSocialRegistration(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid social profile data'
      });
    });
  });
});