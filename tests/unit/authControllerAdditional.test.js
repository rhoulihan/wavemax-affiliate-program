// Additional tests for authController to improve coverage
const authController = require('../../server/controllers/authController');
const Affiliate = require('../../server/models/Affiliate');
const Customer = require('../../server/models/Customer');
const Administrator = require('../../server/models/Administrator');
const Operator = require('../../server/models/Operator');
const OAuthSession = require('../../server/models/OAuthSession');
const emailService = require('../../server/utils/emailService');
const { logAuditEvent } = require('../../server/utils/auditLogger');

// Mock dependencies
jest.mock('../../server/models/Affiliate');
jest.mock('../../server/models/Customer');
jest.mock('../../server/models/Administrator');
jest.mock('../../server/models/Operator');
jest.mock('../../server/models/OAuthSession');
jest.mock('../../server/utils/emailService');
jest.mock('../../server/utils/auditLogger');

describe('Auth Controller - Additional Coverage', () => {
  let req, res;

  beforeEach(() => {
    req = {
      body: {},
      params: {},
      query: {},
      user: null,
      session: {},
      ip: '127.0.0.1'
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      redirect: jest.fn(),
      cookie: jest.fn()
    };
    jest.clearAllMocks();
  });

  describe('checkEmail', () => {
    it('should return available when email does not exist', async () => {
      req.body.email = 'new@example.com';
      
      Affiliate.findOne.mockResolvedValue(null);
      Customer.findOne.mockResolvedValue(null);
      Administrator.findOne.mockResolvedValue(null);
      Operator.findOne.mockResolvedValue(null);

      await authController.checkEmail(req, res);

      expect(res.json).toHaveBeenCalledWith({
        available: true,
        message: 'Email is available'
      });
    });

    it('should return not available when email exists in Affiliate', async () => {
      req.body.email = 'existing@example.com';
      
      Affiliate.findOne.mockResolvedValue({ email: 'existing@example.com' });

      await authController.checkEmail(req, res);

      expect(res.json).toHaveBeenCalledWith({
        available: false,
        message: 'Email is already registered'
      });
    });

    it('should return not available when email exists in Customer', async () => {
      req.body.email = 'customer@example.com';
      
      Affiliate.findOne.mockResolvedValue(null);
      Customer.findOne.mockResolvedValue({ email: 'customer@example.com' });

      await authController.checkEmail(req, res);

      expect(res.json).toHaveBeenCalledWith({
        available: false,
        message: 'Email is already registered'
      });
    });

    it('should handle errors', async () => {
      req.body.email = 'test@example.com';
      
      Affiliate.findOne.mockRejectedValue(new Error('DB error'));

      await authController.checkEmail(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Error checking email availability'
      });
    });

    it('should return error for missing email', async () => {
      await authController.checkEmail(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Email is required'
      });
    });
  });

  describe('checkUsername', () => {
    it('should return available when username does not exist', async () => {
      req.body.username = 'newuser';
      
      Affiliate.findOne.mockResolvedValue(null);
      Administrator.findOne.mockResolvedValue(null);

      await authController.checkUsername(req, res);

      expect(res.json).toHaveBeenCalledWith({
        available: true,
        message: 'Username is available'
      });
    });

    it('should return not available when username exists', async () => {
      req.body.username = 'existinguser';
      
      Affiliate.findOne.mockResolvedValue({ username: 'existinguser' });

      await authController.checkUsername(req, res);

      expect(res.json).toHaveBeenCalledWith({
        available: false,
        message: 'Username is already taken'
      });
    });

    it('should handle errors', async () => {
      req.body.username = 'testuser';
      
      Affiliate.findOne.mockRejectedValue(new Error('DB error'));

      await authController.checkUsername(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Error checking username availability'
      });
    });

    it('should return error for missing username', async () => {
      await authController.checkUsername(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Username is required'
      });
    });
  });

  describe('operatorAutoLogin', () => {
    it('should auto-login operator with valid PIN', async () => {
      req.body = {
        pin: '1234',
        storeIp: '192.168.1.100'
      };

      const mockOperator = {
        _id: 'op123',
        operatorId: 'OP001',
        firstName: 'John',
        lastName: 'Doe',
        email: 'operator@example.com',
        isActive: true,
        toObject: jest.fn().mockReturnValue({
          _id: 'op123',
          operatorId: 'OP001',
          firstName: 'John',
          lastName: 'Doe',
          email: 'operator@example.com'
        })
      };

      Operator.findOne.mockResolvedValue(mockOperator);

      await authController.operatorAutoLogin(req, res);

      expect(Operator.findOne).toHaveBeenCalledWith({
        pin: '1234',
        storeIpAddress: '192.168.1.100',
        isActive: true
      });

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        operator: expect.objectContaining({
          operatorId: 'OP001',
          firstName: 'John'
        }),
        token: expect.any(String)
      });
    });

    it('should fail with invalid PIN', async () => {
      req.body = {
        pin: '0000',
        storeIp: '192.168.1.100'
      };

      Operator.findOne.mockResolvedValue(null);

      await authController.operatorAutoLogin(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid PIN or store IP'
      });
    });

    it('should handle missing PIN', async () => {
      req.body = { storeIp: '192.168.1.100' };

      await authController.operatorAutoLogin(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'PIN and store IP are required'
      });
    });

    it('should handle errors', async () => {
      req.body = {
        pin: '1234',
        storeIp: '192.168.1.100'
      };

      Operator.findOne.mockRejectedValue(new Error('DB error'));

      await authController.operatorAutoLogin(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Login failed',
        details: 'DB error'
      });
    });
  });

  describe('handleSocialCallback', () => {
    it('should handle successful social auth callback', async () => {
      req.user = {
        provider: 'google',
        providerId: 'google123',
        email: 'user@gmail.com',
        firstName: 'John',
        lastName: 'Doe'
      };
      req.query = { state: 'affiliate' };

      const mockSession = {
        _id: 'session123',
        save: jest.fn()
      };

      OAuthSession.findOne.mockResolvedValue(null);
      OAuthSession.prototype.save = jest.fn().mockResolvedValue(mockSession);

      await authController.handleSocialCallback(req, res);

      expect(res.redirect).toHaveBeenCalledWith(
        `${process.env.FRONTEND_URL}/complete-social-registration?session=session123&type=affiliate`
      );
    });

    it('should handle existing linked account', async () => {
      req.user = {
        provider: 'google',
        providerId: 'google123',
        email: 'existing@gmail.com'
      };
      req.query = { state: 'affiliate' };

      const mockAffiliate = {
        _id: 'aff123',
        email: 'existing@gmail.com',
        oauthProviders: {
          google: { id: 'google123' }
        }
      };

      Affiliate.findOne.mockResolvedValue(mockAffiliate);

      await authController.handleSocialCallback(req, res);

      expect(res.redirect).toHaveBeenCalledWith(
        expect.stringContaining('/dashboard?token=')
      );
    });

    it('should handle errors', async () => {
      req.user = {
        provider: 'google',
        providerId: 'google123',
        email: 'user@gmail.com'
      };
      req.query = { state: 'affiliate' };

      OAuthSession.findOne.mockRejectedValue(new Error('Session error'));

      await authController.handleSocialCallback(req, res);

      expect(res.redirect).toHaveBeenCalledWith(
        `${process.env.FRONTEND_URL}/auth/error?message=Social+login+failed`
      );
    });
  });

  describe('handleCustomerSocialCallback', () => {
    it('should handle customer social auth callback', async () => {
      req.user = {
        provider: 'facebook',
        providerId: 'fb123',
        email: 'customer@facebook.com',
        firstName: 'Jane',
        lastName: 'Smith'
      };
      req.query = { 
        state: JSON.stringify({ 
          affiliateCode: 'AFF001',
          bags: '2',
          redirectUrl: '/checkout'
        })
      };

      const mockSession = {
        _id: 'session456',
        save: jest.fn()
      };

      OAuthSession.findOne.mockResolvedValue(null);
      OAuthSession.prototype.save = jest.fn().mockResolvedValue(mockSession);

      await authController.handleCustomerSocialCallback(req, res);

      expect(res.redirect).toHaveBeenCalledWith(
        expect.stringContaining('/complete-customer-social-registration')
      );
    });

    it('should handle parsing errors in state', async () => {
      req.user = {
        provider: 'facebook',
        providerId: 'fb123',
        email: 'customer@facebook.com'
      };
      req.query = { state: 'invalid-json' };

      await authController.handleCustomerSocialCallback(req, res);

      expect(res.redirect).toHaveBeenCalledWith(
        expect.stringContaining('/complete-customer-social-registration')
      );
    });
  });

  describe('completeSocialRegistration', () => {
    it('should complete affiliate social registration', async () => {
      req.body = {
        sessionId: 'session123',
        username: 'johndoe',
        businessName: 'John\'s Business',
        phone: '1234567890',
        type: 'affiliate'
      };

      const mockSession = {
        provider: 'google',
        providerId: 'google123',
        email: 'john@gmail.com',
        firstName: 'John',
        lastName: 'Doe',
        used: false,
        save: jest.fn()
      };

      const mockAffiliate = {
        _id: 'aff123',
        save: jest.fn(),
        toObject: jest.fn().mockReturnValue({
          _id: 'aff123',
          email: 'john@gmail.com'
        })
      };

      OAuthSession.findById.mockResolvedValue(mockSession);
      Affiliate.findOne.mockResolvedValue(null);
      Affiliate.prototype.save = jest.fn().mockResolvedValue(mockAffiliate);

      await authController.completeSocialRegistration(req, res);

      expect(mockSession.used).toBe(true);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        token: expect.any(String),
        user: expect.objectContaining({
          email: 'john@gmail.com'
        })
      });
    });

    it('should handle existing username', async () => {
      req.body = {
        sessionId: 'session123',
        username: 'existinguser',
        type: 'affiliate'
      };

      const mockSession = {
        provider: 'google',
        providerId: 'google123',
        email: 'new@gmail.com',
        used: false
      };

      OAuthSession.findById.mockResolvedValue(mockSession);
      Affiliate.findOne
        .mockResolvedValueOnce(null) // email check
        .mockResolvedValueOnce({ username: 'existinguser' }); // username check

      await authController.completeSocialRegistration(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Username already exists'
      });
    });

    it('should handle invalid session', async () => {
      req.body = {
        sessionId: 'invalid',
        username: 'johndoe',
        type: 'affiliate'
      };

      OAuthSession.findById.mockResolvedValue(null);

      await authController.completeSocialRegistration(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid or expired session'
      });
    });

    it('should handle used session', async () => {
      req.body = {
        sessionId: 'session123',
        username: 'johndoe',
        type: 'affiliate'
      };

      const mockSession = {
        used: true
      };

      OAuthSession.findById.mockResolvedValue(mockSession);

      await authController.completeSocialRegistration(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Session already used'
      });
    });
  });

  describe('completeSocialCustomerRegistration', () => {
    it('should complete customer social registration', async () => {
      req.body = {
        sessionId: 'session456',
        phone: '9876543210',
        address: {
          street: '123 Main St',
          city: 'Austin',
          state: 'TX',
          zipCode: '78701'
        },
        affiliateCode: 'AFF001'
      };

      const mockSession = {
        provider: 'facebook',
        providerId: 'fb123',
        email: 'jane@facebook.com',
        firstName: 'Jane',
        lastName: 'Smith',
        used: false,
        save: jest.fn()
      };

      const mockAffiliate = {
        _id: 'aff001',
        affiliateId: 'AFF001'
      };

      const mockCustomer = {
        _id: 'cust123',
        save: jest.fn(),
        toObject: jest.fn().mockReturnValue({
          _id: 'cust123',
          email: 'jane@facebook.com'
        })
      };

      OAuthSession.findById.mockResolvedValue(mockSession);
      Customer.findOne.mockResolvedValue(null);
      Affiliate.findOne.mockResolvedValue(mockAffiliate);
      Customer.prototype.save = jest.fn().mockResolvedValue(mockCustomer);

      await authController.completeSocialCustomerRegistration(req, res);

      expect(mockSession.used).toBe(true);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        token: expect.any(String),
        customer: expect.objectContaining({
          email: 'jane@facebook.com'
        })
      });
    });

    it('should handle invalid affiliate code', async () => {
      req.body = {
        sessionId: 'session456',
        phone: '9876543210',
        affiliateCode: 'INVALID'
      };

      const mockSession = {
        provider: 'facebook',
        providerId: 'fb123',
        email: 'jane@facebook.com',
        used: false
      };

      OAuthSession.findById.mockResolvedValue(mockSession);
      Affiliate.findOne.mockResolvedValue(null);

      await authController.completeSocialCustomerRegistration(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid affiliate code'
      });
    });
  });

  describe('pollOAuthSession', () => {
    it('should return completed session data', async () => {
      req.params.sessionId = 'session123';

      const mockSession = {
        _id: 'session123',
        provider: 'google',
        email: 'user@gmail.com',
        firstName: 'John',
        lastName: 'Doe',
        used: false,
        completed: true,
        token: 'jwt-token-123'
      };

      OAuthSession.findById.mockResolvedValue(mockSession);

      await authController.pollOAuthSession(req, res);

      expect(res.json).toHaveBeenCalledWith({
        completed: true,
        token: 'jwt-token-123',
        user: {
          email: 'user@gmail.com',
          firstName: 'John',
          lastName: 'Doe'
        }
      });
    });

    it('should return pending status for incomplete session', async () => {
      req.params.sessionId = 'session123';

      const mockSession = {
        _id: 'session123',
        completed: false
      };

      OAuthSession.findById.mockResolvedValue(mockSession);

      await authController.pollOAuthSession(req, res);

      expect(res.json).toHaveBeenCalledWith({
        completed: false
      });
    });

    it('should handle session not found', async () => {
      req.params.sessionId = 'invalid';

      OAuthSession.findById.mockResolvedValue(null);

      await authController.pollOAuthSession(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Session not found'
      });
    });

    it('should handle errors', async () => {
      req.params.sessionId = 'session123';

      OAuthSession.findById.mockRejectedValue(new Error('DB error'));

      await authController.pollOAuthSession(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Error polling session'
      });
    });
  });
});