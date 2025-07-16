// Set NODE_ENV before any requires
process.env.NODE_ENV = 'test';

// Mock dependencies
jest.mock('../../server/models/Affiliate');
jest.mock('../../server/models/Customer');
jest.mock('../../server/models/OAuthSession');
jest.mock('../../server/models/RefreshToken');
jest.mock('../../server/utils/auditLogger');
jest.mock('jsonwebtoken');

const authController = require('../../server/controllers/authController');
const OAuthSession = require('../../server/models/OAuthSession');

describe('OAuth Callback Functions - Simple', () => {
  let mockReq;
  let mockRes;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
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
    it('should delegate to customer handler for customer requests', async () => {
      mockReq.query.state = 'customer_12345';
      
      // Save the original function
      const originalHandleCustomerSocialCallback = authController.handleCustomerSocialCallback;
      
      // Mock the function
      authController.handleCustomerSocialCallback = jest.fn();
      
      await authController.handleSocialCallback(mockReq, mockRes);
      
      expect(authController.handleCustomerSocialCallback).toHaveBeenCalledWith(mockReq, mockRes);
      
      // Restore the original function
      authController.handleCustomerSocialCallback = originalHandleCustomerSocialCallback;
    });
    
    it('should handle failed authentication with popup', async () => {
      mockReq.query.state = 'oauth_session_123';
      mockReq.user = null;
      
      OAuthSession.createSession = jest.fn().mockResolvedValue({});
      
      await authController.handleSocialCallback(mockReq, mockRes);
      
      expect(OAuthSession.createSession).toHaveBeenCalledWith(
        'oauth_session_123',
        {
          type: 'social-auth-error',
          message: 'Social authentication failed'
        }
      );
      
      expect(mockRes.redirect).toHaveBeenCalled();
    });
    
    it('should handle errors gracefully', async () => {
      // Mock console.error to avoid test output noise
      const originalConsoleError = console.error;
      console.error = jest.fn();
      
      // Create a request object that will cause an error during processing
      // We'll mock the user object to throw when accessed deeply
      const errorUser = {
        get isNewUser() { throw new Error('Test error'); }
      };
      
      mockReq.user = errorUser;
      mockReq.query.state = 'oauth_session_123';
      mockReq.headers.referer = 'https://accounts.google.com/signin/oauth';
      
      await authController.handleSocialCallback(mockReq, mockRes);
      
      // Should send HTML with script tag for popup error handling
      expect(mockRes.send).toHaveBeenCalledWith(
        expect.stringContaining('<script>')
      );
      expect(mockRes.send).toHaveBeenCalledWith(
        expect.stringContaining('social-auth-error')
      );
      
      // Restore console.error
      console.error = originalConsoleError;
    });
  });
  
  describe('handleCustomerSocialCallback', () => {
    it('should handle missing user', async () => {
      mockReq.user = null;
      mockReq.query.state = 'customer_error';
      
      await authController.handleCustomerSocialCallback(mockReq, mockRes);
      
      // When there's no sessionId extracted and no referer, it sends HTML  
      expect(mockRes.send).toHaveBeenCalledWith(
        expect.stringContaining('<script>')
      );
      expect(mockRes.send).toHaveBeenCalledWith(
        expect.stringContaining('Authentication Failed')
      );
    });
    
    it('should store session data for popup requests', async () => {
      mockReq.user = null;
      mockReq.query.state = 'customer_oauth_123';
      
      OAuthSession.createSession = jest.fn().mockResolvedValue({});
      
      await authController.handleCustomerSocialCallback(mockReq, mockRes);
      
      expect(OAuthSession.createSession).toHaveBeenCalledWith(
        'oauth_123',
        expect.objectContaining({
          type: 'social-auth-error'
        })
      );
      
      // Should redirect to OAuth success page
      expect(mockRes.redirect).toHaveBeenCalledWith(
        expect.stringContaining('/oauth-success.html')
      );
    });
  });
  
  describe('State Parameter Parsing', () => {
    it('should extract sessionId from oauth_ prefixed state', async () => {
      mockReq.query.state = 'oauth_test_session_456';
      mockReq.user = null;
      
      OAuthSession.createSession = jest.fn().mockResolvedValue({});
      
      await authController.handleSocialCallback(mockReq, mockRes);
      
      expect(OAuthSession.createSession).toHaveBeenCalledWith(
        'oauth_test_session_456',
        expect.any(Object)
      );
    });
    
    it('should handle missing state parameter', async () => {
      mockReq.query.state = undefined;
      mockReq.user = null;
      
      await authController.handleSocialCallback(mockReq, mockRes);
      
      expect(mockRes.redirect).toHaveBeenCalledWith(
        '/affiliate-register-embed.html?error=social_auth_failed'
      );
    });
    
    it('should detect popup from referer header', async () => {
      mockReq.headers.referer = 'https://accounts.google.com/signin/oauth';
      mockReq.user = null;
      
      await authController.handleSocialCallback(mockReq, mockRes);
      
      expect(mockRes.redirect).toHaveBeenCalledWith(
        expect.stringContaining('/oauth-success.html')
      );
    });
  });
});