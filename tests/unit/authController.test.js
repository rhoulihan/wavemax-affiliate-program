const authController = require('../../server/controllers/authController');
const Affiliate = require('../../server/models/Affiliate');
const Customer = require('../../server/models/Customer');
const Administrator = require('../../server/models/Administrator');
const Operator = require('../../server/models/Operator');
const RefreshToken = require('../../server/models/RefreshToken');
const TokenBlacklist = require('../../server/models/TokenBlacklist');
const OAuthSession = require('../../server/models/OAuthSession');
const encryptionUtil = require('../../server/utils/encryption');
const emailService = require('../../server/utils/emailService');
const { logLoginAttempt, logAuditEvent } = require('../../server/utils/auditLogger');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Mock dependencies
jest.mock('../../server/models/Affiliate');
jest.mock('../../server/models/Customer');
jest.mock('../../server/models/Administrator');
jest.mock('../../server/models/Operator');
jest.mock('../../server/models/RefreshToken');
jest.mock('../../server/models/TokenBlacklist');
jest.mock('../../server/models/OAuthSession');
jest.mock('../../server/utils/encryption');
jest.mock('../../server/utils/emailService');
jest.mock('../../server/utils/auditLogger');
jest.mock('jsonwebtoken');
jest.mock('crypto');

describe('Auth Controller', () => {
  let req, res;

  beforeEach(() => {
    req = {
      body: {},
      query: {},
      headers: {},
      ip: '127.0.0.1',
      session: {},
      user: null,
      get: jest.fn().mockReturnValue('User-Agent')
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      cookie: jest.fn().mockReturnThis(),
      clearCookie: jest.fn().mockReturnThis()
    };
    
    // Default mocks
    crypto.randomBytes.mockReturnValue({ toString: jest.fn().mockReturnValue('mock-token') });
    jwt.sign.mockReturnValue('mock-jwt-token');
    jwt.verify.mockReturnValue({ id: 'user123', role: 'affiliate' });
    
    jest.clearAllMocks();
  });

  describe('affiliateLogin', () => {
    it('should successfully login an affiliate with valid credentials', async () => {
      const mockAffiliate = {
        _id: 'affiliate123',
        affiliateId: 'AFF123',
        username: 'testaffiliate',
        passwordHash: 'hashedPassword',
        passwordSalt: 'salt',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        save: jest.fn()
      };

      req.body = {
        username: 'testaffiliate',
        password: 'password123'
      };

      Affiliate.findOne.mockResolvedValue(mockAffiliate);
      encryptionUtil.verifyPassword.mockReturnValue(true);
      jwt.sign.mockReturnValue('mockToken');
      RefreshToken.prototype.save = jest.fn();

      await authController.affiliateLogin(req, res);

      expect(Affiliate.findOne).toHaveBeenCalledWith({ username: 'testaffiliate' });
      expect(encryptionUtil.verifyPassword).toHaveBeenCalledWith(
        'password123',
        'salt',
        'hashedPassword'
      );
      expect(mockAffiliate.save).toHaveBeenCalled();
      expect(res.cookie).toHaveBeenCalledWith('refreshToken', expect.any(String), expect.any(Object));
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          token: 'mockToken',
          affiliate: expect.objectContaining({
            affiliateId: 'AFF123',
            firstName: 'John',
            lastName: 'Doe'
          })
        })
      );
    });

    it('should return 401 for non-existent affiliate', async () => {
      req.body = {
        username: 'nonexistent',
        password: 'password123'
      };

      Affiliate.findOne.mockResolvedValue(null);

      await authController.affiliateLogin(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid username or password'
      });
    });

    it('should return 401 for incorrect password', async () => {
      const mockAffiliate = {
        username: 'testaffiliate',
        passwordHash: 'hashedPassword',
        passwordSalt: 'salt'
      };

      req.body = {
        username: 'testaffiliate',
        password: 'wrongpassword'
      };

      Affiliate.findOne.mockResolvedValue(mockAffiliate);
      encryptionUtil.verifyPassword.mockReturnValue(false);

      await authController.affiliateLogin(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid username or password'
      });
    });
  });

  describe('customerLogin', () => {
    it('should successfully login a customer with valid credentials', async () => {
      const mockCustomer = {
        _id: 'customer123',
        customerId: 'CUST123',
        username: 'testcustomer',
        passwordHash: 'hashedPassword',
        passwordSalt: 'salt',
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@example.com',
        affiliateId: 'AFF123',
        save: jest.fn()
      };

      const mockAffiliate = {
        affiliateId: 'AFF123',
        deliveryFee: 5.99
      };

      req.body = {
        username: 'testcustomer',
        password: 'password123'
      };

      Customer.findOne.mockResolvedValue(mockCustomer);
      Affiliate.findOne.mockResolvedValue(mockAffiliate);
      encryptionUtil.verifyPassword.mockReturnValue(true);
      jwt.sign.mockReturnValue('mockToken');
      RefreshToken.prototype.save = jest.fn();

      await authController.customerLogin(req, res);

      expect(Customer.findOne).toHaveBeenCalledWith({ username: 'testcustomer' });
      expect(encryptionUtil.verifyPassword).toHaveBeenCalledWith(
        'password123',
        'salt',
        'hashedPassword'
      );
      expect(mockCustomer.save).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          token: 'mockToken',
          customer: expect.objectContaining({
            customerId: 'CUST123',
            firstName: 'Jane',
            lastName: 'Smith',
            affiliate: expect.objectContaining({
              minimumDeliveryFee: undefined,
              perBagDeliveryFee: undefined
            })
          })
        })
      );
    });

    it('should return 401 for non-existent customer', async () => {
      req.body = {
        username: 'nonexistent',
        password: 'password123'
      };

      Customer.findOne.mockResolvedValue(null);

      await authController.customerLogin(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid username or password'
      });
    });
  });

  describe('verifyToken', () => {
    it('should verify a valid JWT token', async () => {
      req.user = {
        id: 'user123',
        role: 'affiliate',
        affiliateId: 'AFF123'
      };

      await authController.verifyToken(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        user: {
          id: 'user123',
          role: 'affiliate',
          affiliateId: 'AFF123'
        }
      });
    });

    it('should handle missing user data', async () => {
      req.user = null;

      await authController.verifyToken(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'An error occurred during token verification'
      });
    });

    it('should return customer user data', async () => {
      req.user = {
        id: 'user456',
        role: 'customer',
        customerId: 'CUST456'
      };

      await authController.verifyToken(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        user: {
          id: 'user456',
          role: 'customer',
          customerId: 'CUST456'
        }
      });
    });
  });

  describe('refreshToken', () => {
    it('should refresh token successfully', async () => {
      req.body = {
        refreshToken: 'validRefreshToken'
      };

      const mockRefreshToken = {
        token: 'validRefreshToken',
        userId: 'user123',
        userType: 'affiliate',
        expiryDate: new Date(Date.now() + 86400000),
        isActive: true,
        save: jest.fn(),
        remove: jest.fn()
      };

      const mockAffiliate = {
        _id: 'user123',
        affiliateId: 'AFF123',
        role: 'affiliate'
      };

      RefreshToken.findOneAndUpdate.mockResolvedValue(mockRefreshToken);
      Affiliate.findById.mockResolvedValue(mockAffiliate);
      jwt.sign.mockReturnValue('newMockToken');
      RefreshToken.prototype.save = jest.fn();
      RefreshToken.create.mockResolvedValue({
        token: 'newRefreshToken',
        save: jest.fn()
      });

      await authController.refreshToken(req, res);

      expect(RefreshToken.findOneAndUpdate).toHaveBeenCalledWith(
        {
          token: 'validRefreshToken',
          revoked: null,
          expiryDate: { $gt: expect.any(Date) }
        },
        {
          revoked: expect.any(Date),
          revokedByIp: req.ip
        },
        {
          new: false
        }
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          token: 'newMockToken',
          refreshToken: expect.any(String)
        })
      );
    });

    it('should return error for invalid refresh token', async () => {
      req.body = {
        refreshToken: 'invalidRefreshToken'
      };

      RefreshToken.findOne.mockResolvedValue(null);

      await authController.refreshToken(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid or expired refresh token'
      });
    });

    it('should return error for expired refresh token', async () => {
      req.body = {
        refreshToken: 'expiredRefreshToken'
      };

      // Expired tokens won't be found by the query
      RefreshToken.findOne.mockResolvedValue(null);

      await authController.refreshToken(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid or expired refresh token'
      });
    });
  });

  describe('administratorLogin', () => {
    test('should successfully login administrator', async () => {
      req.body = { email: 'admin@example.com', password: 'AdminPass123!' };
      
      const mockAdmin = {
        _id: 'admin123',
        adminId: 'ADM001',
        email: 'admin@example.com',
        firstName: 'Admin',
        isActive: true,
        comparePassword: jest.fn().mockResolvedValue(true),
        resetLoginAttempts: jest.fn()
      };
      
      Administrator.findOne.mockResolvedValue(mockAdmin);
      RefreshToken.prototype.save = jest.fn().mockResolvedValue(true);

      await authController.administratorLogin(req, res);

      expect(Administrator.findOne).toHaveBeenCalledWith({ email: 'admin@example.com' });
      expect(mockAdmin.comparePassword).toHaveBeenCalledWith('AdminPass123!');
      expect(mockAdmin.resetLoginAttempts).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        token: 'mock-jwt-token',
        refreshToken: 'mock-token',
        administrator: expect.objectContaining({
          adminId: 'ADM001'
        })
      });
    });

    test('should handle locked account', async () => {
      req.body = { email: 'locked@example.com', password: 'password' };
      
      const mockAdmin = {
        email: 'locked@example.com',
        isLocked: true
      };
      
      Administrator.findOne.mockResolvedValue(mockAdmin);

      await authController.administratorLogin(req, res);

      expect(res.status).toHaveBeenCalledWith(423);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Account is locked due to too many failed login attempts. Please try again later.'
      });
    });

    test('should handle inactive administrator', async () => {
      req.body = { email: 'inactive@example.com', password: 'password' };
      
      const mockAdmin = {
        email: 'inactive@example.com',
        isActive: false,
        isLocked: false
      };
      
      Administrator.findOne.mockResolvedValue(mockAdmin);

      await authController.administratorLogin(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Account is deactivated. Please contact support.'
      });
    });
  });

  describe('operatorLogin', () => {
    test('should successfully login operator with PIN', async () => {
      req.body = { operatorId: 'OP001', pin: '1234' };
      
      const mockOperator = {
        _id: 'op123',
        operatorId: 'OP001',
        firstName: 'John',
        isActive: true,
        comparePassword: jest.fn().mockResolvedValue(true),
        resetLoginAttempts: jest.fn()
      };
      
      Operator.findOne.mockResolvedValue(mockOperator);
      RefreshToken.prototype.save = jest.fn().mockResolvedValue(true);

      await authController.operatorLogin(req, res);

      expect(Operator.findOne).toHaveBeenCalledWith({ operatorId: 'OP001' });
      expect(mockOperator.comparePassword).toHaveBeenCalledWith('1234');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        token: 'mock-jwt-token',
        refreshToken: 'mock-token',
        operator: expect.objectContaining({
          operatorId: 'OP001',
          firstName: 'John'
        })
      });
    });

    test('should increment login attempts on failure', async () => {
      req.body = { operatorId: 'OP001', pin: 'wrong' };
      
      const mockOperator = {
        operatorId: 'OP001',
        comparePassword: jest.fn().mockResolvedValue(false),
        incLoginAttempts: jest.fn()
      };
      
      Operator.findOne.mockResolvedValue(mockOperator);

      await authController.operatorLogin(req, res);

      expect(mockOperator.incLoginAttempts).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  describe('logout', () => {
    test('should logout user and blacklist token', async () => {
      req.user = { id: 'user123', role: 'affiliate' };
      req.headers.authorization = 'Bearer mock-jwt-token';
      req.body = { refreshToken: 'refresh-token' };
      
      TokenBlacklist.prototype.save = jest.fn().mockResolvedValue(true);
      RefreshToken.findOneAndUpdate.mockResolvedValue(true);

      await authController.logout(req, res);

      expect(TokenBlacklist.prototype.save).toHaveBeenCalled();
      expect(RefreshToken.findOneAndUpdate).toHaveBeenCalledWith(
        { token: 'refresh-token' },
        expect.objectContaining({ revokedByIp: '127.0.0.1' })
      );
      expect(res.clearCookie).toHaveBeenCalledWith('refreshToken');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Logged out successfully'
      });
    });
  });

  describe('forgotPassword', () => {
    test('should send password reset email for affiliate', async () => {
      req.body = { email: 'affiliate@example.com', userType: 'affiliate' };
      
      const mockAffiliate = {
        _id: 'aff123',
        email: 'affiliate@example.com',
        save: jest.fn().mockResolvedValue(true)
      };
      
      Affiliate.findOne.mockResolvedValue(mockAffiliate);
      encryptionUtil.hashData.mockReturnValue('hashed-token');
      emailService.sendPasswordResetEmail.mockResolvedValue(true);

      await authController.forgotPassword(req, res);

      expect(mockAffiliate.passwordResetToken).toBe('hashed-token');
      expect(mockAffiliate.passwordResetExpires).toBeDefined();
      expect(emailService.sendPasswordResetEmail).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Password reset instructions sent to your email'
      });
    });

    test('should handle non-existent email gracefully', async () => {
      req.body = { email: 'notfound@example.com', userType: 'customer' };
      
      Customer.findOne.mockResolvedValue(null);

      await authController.forgotPassword(req, res);

      // Should still return success to prevent email enumeration
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Password reset instructions sent to your email'
      });
    });
  });

  describe('resetPassword', () => {
    test('should reset password with valid token', async () => {
      req.body = {
        token: 'valid-token',
        newPassword: 'NewPass123!',
        userType: 'affiliate'
      };
      
      const mockAffiliate = {
        _id: 'aff123',
        passwordResetToken: 'hashed-token',
        passwordResetExpires: new Date(Date.now() + 3600000),
        save: jest.fn().mockResolvedValue(true)
      };
      
      Affiliate.findOne.mockResolvedValue(mockAffiliate);
      encryptionUtil.hashData.mockReturnValue('hashed-token');
      encryptionUtil.hashPassword.mockReturnValue({
        salt: 'new-salt',
        hash: 'new-hash'
      });

      await authController.resetPassword(req, res);

      expect(mockAffiliate.passwordSalt).toBe('new-salt');
      expect(mockAffiliate.passwordHash).toBe('new-hash');
      expect(mockAffiliate.passwordResetToken).toBeUndefined();
      expect(mockAffiliate.passwordResetExpires).toBeUndefined();
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Password reset successfully'
      });
    });

    test('should reject expired token', async () => {
      req.body = {
        token: 'expired-token',
        newPassword: 'NewPass123!',
        userType: 'customer'
      };
      
      Customer.findOne.mockResolvedValue(null);
      encryptionUtil.hashData.mockReturnValue('hashed-token');

      await authController.resetPassword(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Password reset token is invalid or has expired'
      });
    });
  });

  describe('OAuth functions', () => {
    test('startOAuthSession should create session', async () => {
      req.query = { 
        state: 'oauth_123',
        isCustomer: 'true',
        popup: 'false'
      };
      
      const mockSession = {
        save: jest.fn().mockResolvedValue(true)
      };
      OAuthSession.mockImplementation(() => mockSession);

      await authController.startOAuthSession(req, res);

      expect(mockSession.save).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        sessionId: 'oauth_123'
      });
    });

    test('completeOAuthSession should handle successful OAuth', async () => {
      req.body = { sessionId: 'oauth_123' };
      
      const mockSession = {
        sessionId: 'oauth_123',
        status: 'completed',
        token: 'oauth-token',
        refreshToken: 'oauth-refresh',
        userType: 'affiliate',
        userId: 'aff123',
        remove: jest.fn().mockResolvedValue(true)
      };
      
      const mockAffiliate = {
        _id: 'aff123',
        affiliateId: 'AFF001',
        firstName: 'John'
      };
      
      OAuthSession.findOne.mockResolvedValue(mockSession);
      Affiliate.findById.mockResolvedValue(mockAffiliate);

      await authController.completeOAuthSession(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        token: 'oauth-token',
        refreshToken: 'oauth-refresh',
        affiliate: expect.objectContaining({
          affiliateId: 'AFF001'
        })
      });
      expect(mockSession.remove).toHaveBeenCalled();
    });

    test('checkOAuthSession should return session status', async () => {
      req.params = { sessionId: 'oauth_123' };
      
      const mockSession = {
        sessionId: 'oauth_123',
        status: 'pending'
      };
      
      OAuthSession.findOne.mockResolvedValue(mockSession);

      await authController.checkOAuthSession(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        status: 'pending'
      });
    });
  });
});