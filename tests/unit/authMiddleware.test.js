const { authenticate, authorize, authLimiter } = require('../../server/middleware/auth');
const jwt = require('jsonwebtoken');

// Mock jwt
jest.mock('jsonwebtoken');

describe('Auth Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      headers: {},
      user: null,
      get: jest.fn().mockReturnValue('Mozilla/5.0')
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  describe('authenticate', () => {
    it('should authenticate valid Bearer token', () => {
      req.headers.authorization = 'Bearer validtoken';
      const decodedToken = {
        id: 'user123',
        role: 'affiliate',
        affiliateId: 'AFF123'
      };
      jwt.verify.mockReturnValue(decodedToken);

      authenticate(req, res, next);

      expect(jwt.verify).toHaveBeenCalledWith('validtoken', process.env.JWT_SECRET);
      expect(req.user).toEqual(decodedToken);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should authenticate valid x-auth-token header', () => {
      req.headers['x-auth-token'] = 'validtoken';
      const decodedToken = {
        id: 'user123',
        role: 'customer',
        customerId: 'CUST123'
      };
      jwt.verify.mockReturnValue(decodedToken);

      authenticate(req, res, next);

      expect(jwt.verify).toHaveBeenCalledWith('validtoken', process.env.JWT_SECRET);
      expect(req.user).toEqual(decodedToken);
      expect(next).toHaveBeenCalled();
    });

    it('should reject request with no token', () => {
      authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'No token provided'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject request with invalid token', () => {
      req.headers.authorization = 'Bearer invalidtoken';
      jwt.verify.mockImplementation(() => {
        const error = new Error('Invalid token');
        error.name = 'JsonWebTokenError';
        throw error;
      });

      authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid token'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject request with expired token', () => {
      req.headers.authorization = 'Bearer expiredtoken';
      jwt.verify.mockImplementation(() => {
        const error = new Error('Token expired');
        error.name = 'TokenExpiredError';
        throw error;
      });

      authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Token expired'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should handle malformed Authorization header', () => {
      req.headers.authorization = 'InvalidFormat';

      authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'No token provided'
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