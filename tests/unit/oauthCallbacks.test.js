// Set NODE_ENV before any requires
process.env.NODE_ENV = 'test';

// Mock all dependencies first
jest.mock('../../server/models/Affiliate');
jest.mock('../../server/models/Customer');
jest.mock('../../server/models/OAuthSession');
jest.mock('../../server/models/RefreshToken');
jest.mock('../../server/models/TokenBlacklist');
jest.mock('../../server/utils/auditLogger');
jest.mock('jsonwebtoken');
jest.mock('crypto');

const Affiliate = require('../../server/models/Affiliate');
const Customer = require('../../server/models/Customer');
const OAuthSession = require('../../server/models/OAuthSession');
const RefreshToken = require('../../server/models/RefreshToken');
const { logLoginAttempt } = require('../../server/utils/auditLogger');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Import controller after mocks
const authController = require('../../server/controllers/authController');

describe('OAuth Callback Functions', () => {
  let mockReq;
  let mockRes;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock crypto for token generation
    crypto.randomBytes.mockReturnValue(Buffer.from('mock-token-data'));
    
    // Mock JWT
    jwt.sign.mockReturnValue('mock-jwt-token');
    jwt.decode.mockReturnValue({ exp: Math.floor(Date.now() / 1000) + 3600 });
    
    // Setup default request/response
    mockReq = {
      user: null,
      query: {},
      headers: {},
      ip: '127.0.0.1'
    };
    
    mockRes = {
      locals: { cspNonce: 'test-nonce' },
      redirect: jest.fn(),
      send: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      setHeader: jest.fn()
    };
  });
  
  describe('handleSocialCallback', () => {
    it('should handle customer OAuth request by delegating to customer handler', async () => {
      const next = jest.fn();
      mockReq.query.state = 'customer_12345';
      
      // Mock the handleCustomerSocialCallback
      const handleCustomerSocialCallbackSpy = jest.spyOn(authController, 'handleCustomerSocialCallback')
        .mockImplementation(() => {});
      
      await authController.handleSocialCallback(mockReq, mockRes);
      
      expect(handleCustomerSocialCallbackSpy).toHaveBeenCalledWith(mockReq, mockRes);
    });
    
    it('should handle popup request with no user (auth failed)', async () => {
      const next = jest.fn();
      mockReq.query.state = 'oauth_session_123';
      mockReq.user = null;
      
      OAuthSession.createSession = jest.fn().mockResolvedValue({});
      
      await authController.handleSocialCallback(mockReq, mockRes);
      
      expect(OAuthSession.createSession).toHaveBeenCalledWith('oauth_session_123', {
        type: 'social-auth-error',
        message: 'Social authentication failed'
      });
      
      expect(mockRes.redirect).toHaveBeenCalledWith(
        expect.stringContaining('/oauth-success.html?message=')
      );
    });
    
    it('should handle existing user login with popup', async () => {
      const mockUser = {
        _id: 'user123',
        affiliateId: 'AFF001',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        businessName: 'Test Business',
        username: 'john_doe',
        registrationMethod: 'google',
        isNewUser: false
      };
      
      mockReq.user = mockUser;
      mockReq.query.state = 'oauth_session_456';
      
      OAuthSession.createSession = jest.fn().mockResolvedValue({});
      RefreshToken.generateRefreshToken = jest.fn().mockResolvedValue('mock-refresh-token');
      
      // Mock the generateRefreshToken function
      authController.generateRefreshToken = jest.fn().mockResolvedValue('mock-refresh-token');
      
      await authController.handleSocialCallback(mockReq, mockRes);
      
      expect(logLoginAttempt).toHaveBeenCalledWith(
        true,
        'affiliate',
        'john_doe',
        mockReq,
        'Social login successful'
      );
      
      const callArgs = OAuthSession.createSession.mock.calls[0];
      expect(callArgs[0]).toBe('oauth_session_456');
      expect(callArgs[1]).toMatchObject({
        type: 'social-auth-login',
        token: 'mock-jwt-token',
        affiliate: {
          affiliateId: 'AFF001',
          email: 'john@example.com'
        }
      });
      
      expect(mockRes.redirect).toHaveBeenCalledWith(
        expect.stringContaining('/oauth-success.html?message=')
      );
    });
    
    it('should handle new user registration flow', async () => {
      const mockUser = {
        _id: 'user123',
        provider: 'google',
        email: 'new@example.com',
        firstName: 'New',
        lastName: 'User',
        isNewUser: true
      };
      
      mockReq.user = mockUser;
      mockReq.query.state = null; // Not a popup
      
      // Mock jwt.sign
      jwt.sign.mockReturnValue('test-social-token');
      
      await authController.handleSocialCallback(mockReq, mockRes);
      
      // Should not create session when not a popup
      expect(OAuthSession.createSession).not.toHaveBeenCalled();
      
      // Should redirect to registration with social token
      expect(mockRes.redirect).toHaveBeenCalledWith(
        expect.stringContaining('/affiliate-register-embed.html?socialToken=test-social-token&provider=google')
      );
    });
    
    it('should handle OAuth callback errors', async () => {
      // Mock console.error to avoid test output noise
      const originalConsoleError = console.error;
      console.error = jest.fn();
      
      // Create a request object that will cause an error during processing
      const errorUser = {
        get isNewUser() { throw new Error('Test error'); }
      };
      
      mockReq.user = errorUser;
      mockReq.query.state = 'oauth_session_123';
      mockReq.headers.referer = 'https://accounts.google.com/signin/oauth';
      
      await authController.handleSocialCallback(mockReq, mockRes);
      
      expect(mockRes.send).toHaveBeenCalledWith(
        expect.stringContaining('social-auth-error')
      );
      
      // Restore console.error
      console.error = originalConsoleError;
    });
  });
  
  describe('handleCustomerSocialCallback', () => {
    beforeEach(() => {
      // Restore handleCustomerSocialCallback if it was mocked
      if (authController.handleCustomerSocialCallback.mockRestore) {
        authController.handleCustomerSocialCallback.mockRestore();
      }
    });
    
    it('should handle affiliate conflict when social account is already an affiliate', async () => {
      const mockAffiliate = {
        _id: 'aff123',
        affiliateId: 'AFF001',
        email: 'affiliate@example.com',
        firstName: 'Jane',
        lastName: 'Doe',
        businessName: 'Jane\'s Business'
      , save: jest.fn().mockResolvedValue(true)};
      
      mockReq.user = {
        email: 'affiliate@example.com',
        provider: 'google',
        isExistingAffiliate: true,
        affiliate: mockAffiliate
      };
      mockReq.query.state = 'customer_oauth_789';
      
      OAuthSession.createSession = jest.fn().mockResolvedValue({});
      
      await authController.handleCustomerSocialCallback(mockReq, mockRes);
      
      // Should not call Affiliate.findOne since it uses user.isExistingAffiliate
      expect(Affiliate.findOne).not.toHaveBeenCalled();
      
      expect(OAuthSession.createSession).toHaveBeenCalledWith(
        'oauth_789',
        expect.objectContaining({
          type: 'social-auth-account-conflict',
          accountType: 'affiliate'
        })
      );
      
      expect(mockRes.send).toHaveBeenCalledWith(
        expect.stringContaining('Account Type Mismatch')
      );
    });
    
    it('should handle existing customer login', async () => {
      const mockCustomer = {
        _id: 'cust123',
        customerId: 'CUST001',
        firstName: 'John',
        lastName: 'Customer',
        email: 'customer@example.com',
        affiliateId: 'AFF001'
      , save: jest.fn().mockResolvedValue(true)};
      
      mockReq.user = {
        _id: 'cust123',
        customerId: 'CUST001',
        firstName: 'John',
        lastName: 'Customer',
        email: 'customer@example.com',
        provider: 'facebook',
        isNewUser: false
      };
      mockReq.query.state = 'customer_oauth_999';
      
      jwt.sign.mockReturnValue('mock-customer-token');
      RefreshToken.create.mockResolvedValue({ token: 'mock-refresh-token' });
      OAuthSession.createSession = jest.fn().mockResolvedValue({});
      
      await authController.handleCustomerSocialCallback(mockReq, mockRes);
      
      // Should not call findOne methods since user is already provided
      expect(Affiliate.findOne).not.toHaveBeenCalled();
      expect(Customer.findOne).not.toHaveBeenCalled();
      
      expect(OAuthSession.createSession).toHaveBeenCalledWith(
        'oauth_999',
        expect.objectContaining({
          type: 'social-auth-login',
          token: 'mock-customer-token',
          customer: expect.objectContaining({
            customerId: 'CUST001',
            email: 'customer@example.com'
          })
        })
      );
      
      expect(mockRes.send).toHaveBeenCalledWith(
        expect.stringContaining('Login Successful!')
      );
    });
    
    it('should handle new customer registration', async () => {
      mockReq.user = {
        email: 'newcustomer@example.com',
        provider: 'google',
        firstName: 'New',
        lastName: 'Customer',
        socialId: 'google123',
        isNewUser: true
      };
      mockReq.query.state = 'customer_oauth_100';
      
      jwt.sign.mockReturnValue('test-social-token');
      OAuthSession.createSession = jest.fn().mockResolvedValue({});
      
      await authController.handleCustomerSocialCallback(mockReq, mockRes);
      
      // Should store session with the OAuth session ID
      expect(OAuthSession.createSession).toHaveBeenCalledWith(
        'oauth_100',
        expect.objectContaining({
          type: 'social-auth-success',
          socialToken: 'test-social-token',
          provider: 'google'
        })
      );
      
      // Should send HTML with script
      expect(mockRes.send).toHaveBeenCalledWith(
        expect.stringContaining('<script>')
      );
      expect(mockRes.send).toHaveBeenCalledWith(
        expect.stringContaining('social-auth-success')
      );
    });
    
    it('should handle errors during customer OAuth callback', async () => {
      const next = jest.fn();
      mockReq.user = null;
      mockReq.query.state = 'customer_error';
      
      await authController.handleCustomerSocialCallback(mockReq, mockRes);
      
      expect(mockRes.send).toHaveBeenCalledWith(
        expect.stringContaining('social-auth-error')
      );
    });
  });
  
  describe('OAuth State Parameter Handling', () => {
    it('should correctly parse sessionId from state parameter', async () => {
      const next = jest.fn();
      mockReq.query.state = 'oauth_session_12345';
      mockReq.user = null;
      
      OAuthSession.createSession = jest.fn().mockResolvedValue({});
      
      await authController.handleSocialCallback(mockReq, mockRes);
      
      expect(OAuthSession.createSession).toHaveBeenCalledWith(
        'oauth_session_12345',
        expect.any(Object)
      );
    });
    
    it('should handle state parameter without oauth_ prefix', async () => {
      const next = jest.fn();
      mockReq.query.state = 'popup=true';
      mockReq.user = null;
      
      await authController.handleSocialCallback(mockReq, mockRes);
      
      // Should redirect without trying to store in database
      expect(OAuthSession.createSession).not.toHaveBeenCalled();
      // Without oauth_ prefix and no user, it should redirect to registration page
      expect(mockRes.redirect).toHaveBeenCalledWith(
        '/affiliate-register-embed.html?error=social_auth_failed'
      );
    });
    
    it('should detect popup from referer headers', async () => {
      const next = jest.fn();
      mockReq.headers.referer = 'https://accounts.google.com/oauth/authorize';
      mockReq.user = null;
      
      await authController.handleSocialCallback(mockReq, mockRes);
      
      expect(mockRes.redirect).toHaveBeenCalledWith(
        expect.stringContaining('/oauth-success.html')
      );
    });
  });
});