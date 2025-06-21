const { authenticate, authorize, authLimiter } = require('../../server/middleware/auth');
const jwt = require('jsonwebtoken');
const TokenBlacklist = require('../../server/models/TokenBlacklist');

// Mock jwt
jest.mock('jsonwebtoken');

// Mock TokenBlacklist
jest.mock('../../server/models/TokenBlacklist', () => ({
  isBlacklisted: jest.fn()
}));

describe('Auth Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      headers: {},
      user: null,
      path: '/api/test',
      get: jest.fn().mockReturnValue('Mozilla/5.0')
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();
    jest.clearAllMocks();

    // Reset TokenBlacklist mock
    TokenBlacklist.isBlacklisted.mockReset();
  });

  describe('authenticate', () => {
    it('should authenticate valid Bearer token', async () => {
      req.headers.authorization = 'Bearer validtoken';
      const decodedToken = {
        id: 'user123',
        role: 'affiliate',
        affiliateId: 'AFF123'
      };
      jwt.verify.mockReturnValue(decodedToken);
      TokenBlacklist.isBlacklisted.mockResolvedValue(false);

      await authenticate(req, res, next);

      expect(jwt.verify).toHaveBeenCalledWith('validtoken', process.env.JWT_SECRET);
      expect(TokenBlacklist.isBlacklisted).toHaveBeenCalledWith('validtoken');
      expect(req.user).toEqual({
        id: 'user123',
        _id: 'user123',
        role: 'affiliate',
        affiliateId: 'AFF123'
      });
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should authenticate valid x-auth-token header', async () => {
      req.headers['x-auth-token'] = 'validtoken';
      const decodedToken = {
        id: 'user123',
        role: 'customer',
        customerId: 'CUST123'
      };
      jwt.verify.mockReturnValue(decodedToken);
      TokenBlacklist.isBlacklisted.mockResolvedValue(false);

      await authenticate(req, res, next);

      expect(jwt.verify).toHaveBeenCalledWith('validtoken', process.env.JWT_SECRET);
      expect(TokenBlacklist.isBlacklisted).toHaveBeenCalledWith('validtoken');
      expect(req.user).toEqual({
        id: 'user123',
        _id: 'user123',
        role: 'customer',
        customerId: 'CUST123'
      });
      expect(next).toHaveBeenCalled();
    });

    it('should reject request with no token', async () => {
      await authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'No token provided'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject request with invalid token', async () => {
      req.headers.authorization = 'Bearer invalidtoken';
      jwt.verify.mockImplementation(() => {
        const error = new Error('Invalid token');
        error.name = 'JsonWebTokenError';
        throw error;
      });

      await authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid token'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject request with expired token', async () => {
      req.headers.authorization = 'Bearer expiredtoken';
      jwt.verify.mockImplementation(() => {
        const error = new Error('Token expired');
        error.name = 'TokenExpiredError';
        throw error;
      });

      await authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Token expired'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should handle malformed Authorization header', async () => {
      req.headers.authorization = 'InvalidFormat';

      await authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'No token provided'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject blacklisted token', async () => {
      req.headers.authorization = 'Bearer blacklistedtoken';
      const decodedToken = {
        id: 'user123',
        role: 'customer',
        customerId: 'CUST123'
      };
      jwt.verify.mockReturnValue(decodedToken);
      TokenBlacklist.isBlacklisted.mockResolvedValue(true);

      await authenticate(req, res, next);

      expect(jwt.verify).toHaveBeenCalledWith('blacklistedtoken', process.env.JWT_SECRET);
      expect(TokenBlacklist.isBlacklisted).toHaveBeenCalledWith('blacklistedtoken');
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Token has been blacklisted'
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('authorize', () => {
    it('should authorize user with correct role', () => {
      req.user = { role: 'admin' };

      const middleware = authorize('admin');
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should authorize user with one of multiple roles', () => {
      req.user = { role: 'affiliate' };

      const middleware = authorize('admin', 'affiliate');
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should reject user with incorrect role', () => {
      req.user = { role: 'customer' };

      const middleware = authorize('admin', 'affiliate');
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Insufficient permissions'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject user with no role', () => {
      req.user = {};

      const middleware = authorize('admin');
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Insufficient permissions'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject when user is not set', () => {
      req.user = null;

      const middleware = authorize('admin');
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Insufficient permissions'
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('authLimiter', () => {
    it('should be a function', () => {
      expect(typeof authLimiter).toBe('function');
    });

    it('should have rate limit configuration', () => {
      // authLimiter is created by express-rate-limit
      // We can't test its internal behavior easily without mocking express-rate-limit
      // But we can verify it exists and is a middleware function
      expect(authLimiter).toBeDefined();
      expect(authLimiter.length).toBe(3); // middleware functions have 3 params: req, res, next
    });
  });
});