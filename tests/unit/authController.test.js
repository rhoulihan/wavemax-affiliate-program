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
    crypto.createHash = jest.fn().mockReturnValue({
      update: jest.fn().mockReturnValue({
        digest: jest.fn().mockReturnValue('hashed-token')
      })
    });
    jwt.sign.mockReturnValue('mock-jwt-token');
    jwt.verify.mockReturnValue({ id: 'user123', role: 'affiliate' });

    // Mock encryption utilities
    encryptionUtil.hashData = jest.fn().mockReturnValue('hashed-token');
    encryptionUtil.hashPassword = jest.fn().mockReturnValue({ salt: 'salt', hash: 'hash' });
    encryptionUtil.verifyPassword = jest.fn().mockReturnValue(true);

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

      expect(Affiliate.findOne).toHaveBeenCalledWith({ 
        username: { $regex: new RegExp('^testaffiliate$', 'i') } 
      });
      expect(encryptionUtil.verifyPassword).toHaveBeenCalledWith(
        'password123',
        'salt',
        'hashedPassword'
      );
      expect(mockAffiliate.save).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          token: 'mockToken',
          refreshToken: 'mock-token',
          affiliate: expect.objectContaining({
            affiliateId: 'AFF123',
            firstName: 'John',
            lastName: 'Doe',
            email: 'john@example.com'
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

      expect(Customer.findOne).toHaveBeenCalledWith({
        $or: [
          { username: { $regex: new RegExp('^testcustomer$', 'i') } },
          { email: 'testcustomer' }
        ]
      });
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
        message: 'Invalid username/email or password'
      });
    });

    it('should login customer using emailOrUsername field', async () => {
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
        emailOrUsername: 'jane@example.com',
        password: 'password123'
      };

      Customer.findOne.mockResolvedValue(mockCustomer);
      Affiliate.findOne.mockResolvedValue(mockAffiliate);
      encryptionUtil.verifyPassword.mockReturnValue(true);
      jwt.sign.mockReturnValue('mockToken');
      RefreshToken.prototype.save = jest.fn();

      await authController.customerLogin(req, res);

      expect(Customer.findOne).toHaveBeenCalledWith({
        $or: [
          { username: { $regex: new RegExp('^jane@example\\.com$', 'i') } },
          { email: 'jane@example.com' }
        ]
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          token: 'mockToken'
        })
      );
    });

    it('should prioritize emailOrUsername over username field', async () => {
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
        username: 'oldusername',
        emailOrUsername: 'testcustomer',
        password: 'password123'
      };

      Customer.findOne.mockResolvedValue(mockCustomer);
      Affiliate.findOne.mockResolvedValue(mockAffiliate);
      encryptionUtil.verifyPassword.mockReturnValue(true);
      jwt.sign.mockReturnValue('mockToken');
      RefreshToken.prototype.save = jest.fn();

      await authController.customerLogin(req, res);

      // Should use emailOrUsername value, not username
      expect(Customer.findOne).toHaveBeenCalledWith({
        $or: [
          { username: { $regex: new RegExp('^testcustomer$', 'i') } },
          { email: 'testcustomer' }
        ]
      });
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should return error when neither username nor emailOrUsername provided', async () => {
      req.body = {
        password: 'password123'
      };

      await authController.customerLogin(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Username or email is required'
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
        requirePasswordChange: false,
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
        requirePasswordChange: false,
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
        verifyPassword: jest.fn().mockReturnValue(true),
        resetLoginAttempts: jest.fn()
      };

      Administrator.findOne.mockResolvedValue(mockAdmin);
      RefreshToken.prototype.save = jest.fn().mockResolvedValue(true);

      await authController.administratorLogin(req, res);

      expect(Administrator.findOne).toHaveBeenCalledWith({ email: 'admin@example.com' });
      expect(mockAdmin.verifyPassword).toHaveBeenCalledWith('AdminPass123!');
      expect(mockAdmin.resetLoginAttempts).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        token: 'mock-jwt-token',
        refreshToken: 'mock-token',
        user: expect.objectContaining({
          adminId: 'ADM001'
        })
      });
    });

    test('should handle locked account', async () => {
      req.body = { email: 'locked@example.com', password: 'password' };

      const mockAdmin = {
        _id: 'admin123',
        email: 'locked@example.com',
        isActive: true,
        isLocked: true
      };

      Administrator.findOne.mockResolvedValue(mockAdmin);

      await authController.administratorLogin(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Account is locked due to multiple failed login attempts.'
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
        message: 'Account is deactivated. Please contact system administrator.'
      });
    });
  });

  describe('operatorLogin', () => {
    test('should successfully login operator with PIN', async () => {
      // Set up environment for PIN-based auth
      process.env.OPERATOR_PIN = '1234';
      process.env.DEFAULT_OPERATOR_ID = 'OP001';
      
      req.body = { pinCode: '1234' };

      const mockOperator = {
        _id: 'op123',
        operatorId: 'OP001',
        email: 'operator@example.com',
        firstName: 'John',
        lastName: 'Doe',
        isActive: true,
        isOnShift: true,
        shiftStart: '00:00',
        shiftEnd: '23:59',
        resetLoginAttempts: jest.fn()
      };

      Operator.findOne = jest.fn().mockResolvedValue(mockOperator);
      RefreshToken.prototype.save = jest.fn().mockResolvedValue(true);

      await authController.operatorLogin(req, res);

      expect(Operator.findOne).toHaveBeenCalledWith({ operatorId: 'OP001' });
      expect(res.status).toHaveBeenCalledWith(200);
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

    test('should fail with invalid PIN', async () => {
      // Set up environment for PIN-based auth
      process.env.OPERATOR_PIN = '1234';
      process.env.DEFAULT_OPERATOR_ID = 'OP001';
      
      req.body = { pinCode: 'wrong' };

      await authController.operatorLogin(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid PIN code'
      });
    });
  });

  describe('logout', () => {
    test('should logout user and blacklist token', async () => {
      req.user = { id: 'user123', role: 'affiliate' };
      req.headers.authorization = 'Bearer mock-jwt-token';
      req.body = { refreshToken: 'refresh-token' };

      TokenBlacklist.blacklistToken = jest.fn().mockResolvedValue(true);
      RefreshToken.findOneAndDelete.mockResolvedValue(true);
      jwt.decode.mockReturnValue({ exp: Math.floor(Date.now() / 1000) + 3600 });

      await authController.logout(req, res);

      expect(TokenBlacklist.blacklistToken).toHaveBeenCalled();
      expect(RefreshToken.findOneAndDelete).toHaveBeenCalledWith({ token: 'refresh-token' });
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
      emailService.sendAffiliatePasswordResetEmail = jest.fn().mockResolvedValue(true);
      emailService.sendPasswordResetEmail = jest.fn().mockResolvedValue(true);

      await authController.forgotPassword(req, res);

      expect(mockAffiliate.save).toHaveBeenCalled();
      expect(emailService.sendAffiliatePasswordResetEmail).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Password reset email sent'
      });
    });

    test('should handle non-existent email gracefully', async () => {
      req.body = { email: 'notfound@example.com', userType: 'customer' };

      Customer.findOne.mockResolvedValue(null);

      await authController.forgotPassword(req, res);

      // Should return 404 for non-existent email
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'No account found with that email address'
      });
    });
  });

  describe('resetPassword', () => {
    test('should reset password with valid token', async () => {
      req.body = {
        token: 'valid-token',
        password: 'NewPass123!',
        userType: 'affiliate'
      };

      const mockAffiliate = {
        _id: 'aff123',
        resetToken: 'hashed-token',
        resetTokenExpiry: Date.now() + 3600000,
        save: jest.fn().mockResolvedValue(true)
      };

      Affiliate.findOne.mockResolvedValue(mockAffiliate);
      encryptionUtil.hashPassword.mockReturnValue({
        salt: 'new-salt',
        hash: 'new-hash'
      });

      await authController.resetPassword(req, res);

      expect(Affiliate.findOne).toHaveBeenCalledWith({
        resetToken: 'hashed-token',
        resetTokenExpiry: { $gt: expect.any(Number) }
      });
      expect(mockAffiliate.passwordSalt).toBe('new-salt');
      expect(mockAffiliate.passwordHash).toBe('new-hash');
      expect(mockAffiliate.resetToken).toBeUndefined();
      expect(mockAffiliate.resetTokenExpiry).toBeUndefined();
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Password has been reset successfully'
      });
    });

    test('should reject expired token', async () => {
      req.body = {
        token: 'expired-token',
        password: 'NewPass123!',
        userType: 'customer'
      };

      Customer.findOne.mockResolvedValue(null);

      await authController.resetPassword(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid or expired token'
      });
    });
  });
});