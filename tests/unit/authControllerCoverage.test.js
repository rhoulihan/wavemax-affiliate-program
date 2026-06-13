const authController = require('../../server/controllers/authController');
const Affiliate = require('../../server/models/Affiliate');
const Customer = require('../../server/models/Customer');
const Administrator = require('../../server/models/Administrator');
const Operator = require('../../server/models/Operator');
const RefreshToken = require('../../server/models/RefreshToken');
const TokenBlacklist = require('../../server/models/TokenBlacklist');
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
jest.mock('../../server/utils/encryption');
jest.mock('../../server/utils/emailService');
jest.mock('../../server/utils/auditLogger');
jest.mock('jsonwebtoken');
jest.mock('crypto');

// Helper function to extract handler from wrapped middleware
const extractHandler = (middleware) => {
  // If the middleware is already a function, return it
  if (typeof middleware === 'function') {
    return middleware;
  }
  // If it's wrapped, extract the handler
  return middleware;
};

describe('Auth Controller - Additional Coverage Tests Fixed', () => {
  let req, res, next;

  beforeEach(() => {
    // Mock RefreshToken operations
    RefreshToken.findOneAndUpdate = jest.fn().mockResolvedValue(null);
    RefreshToken.create = jest.fn().mockResolvedValue({ 
      token: 'mock-refresh-token',
      save: jest.fn().mockResolvedValue(true)
    });
    RefreshToken.prototype.save = jest.fn().mockResolvedValue(true);
    
    // Mock RefreshToken constructor
    RefreshToken.mockImplementation(() => ({
      token: 'mock-refresh-token',
      save: jest.fn().mockResolvedValue({ token: 'mock-refresh-token' })
    }));
    
    req = {
      body: {},
      query: {},
      headers: {},
      ip: '127.0.0.1',
      session: {},
      user: null,
      get: jest.fn().mockReturnValue('User-Agent'),
      cspNonce: 'test-nonce'
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      cookie: jest.fn().mockReturnThis(),
      clearCookie: jest.fn().mockReturnThis(),
      redirect: jest.fn(),
      send: jest.fn(),
      setHeader: jest.fn(),
      locals: {
        cspNonce: 'test-nonce'
      }
    };
    next = jest.fn();

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
    
    // Mock audit logger functions
    logLoginAttempt.mockImplementation(() => {});
    logAuditEvent.mockImplementation(() => {});

    jest.clearAllMocks();
  });

  afterEach(() => {
    // Clear all mocks after each test
    jest.clearAllMocks();
  });

  describe('resetPassword - Fixed Tests', () => {
    it('should reset password for administrator', async () => {
      req.body = {
        token: 'valid-token',
        password: 'NewPass123!',
        userType: 'administrator'
      };

      const mockAdmin = {
        _id: 'admin123',
        resetToken: 'hashed-token',
        resetTokenExpiry: Date.now() + 3600000,
        save: jest.fn().mockResolvedValue(true)
      };

      Administrator.findOne.mockResolvedValue(mockAdmin);

      const handler = extractHandler(authController.resetPassword);
      await handler(req, res, next);

      expect(Administrator.findOne).toHaveBeenCalledWith({
        resetToken: 'hashed-token',
        resetTokenExpiry: { $gt: expect.any(Number) }
      });
      // Administrators use bcrypt, password is set directly
      expect(mockAdmin.password).toBe('NewPass123!');
      expect(mockAdmin.resetToken).toBeUndefined();
      expect(mockAdmin.resetTokenExpiry).toBeUndefined();
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Password has been reset successfully'
      });
    });

    it('should handle operator password reset attempt', async () => {
      req.body = {
        token: 'valid-token',
        password: 'NewPass123!',
        userType: 'operator'
      };

      const mockOperator = {
        _id: 'op123',
        resetToken: 'hashed-token',
        resetTokenExpiry: Date.now() + 3600000,
        save: jest.fn().mockResolvedValue(true)
      };

      Operator.findOne.mockResolvedValue(mockOperator);

      const handler = extractHandler(authController.resetPassword);
      await handler(req, res, next);

      // Operators cannot reset passwords
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Operators cannot reset passwords. Please contact your supervisor to reset your PIN.'
      });
    });
  });
});