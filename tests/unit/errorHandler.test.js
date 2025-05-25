const { errorHandler, AppError } = require('../../server/middleware/errorHandler');
const logger = require('../../server/utils/logger');

// Mock the logger
jest.mock('../../server/utils/logger');

describe('Error Handler Middleware', () => {
  let req, res, next, consoleErrorSpy;

  beforeEach(() => {
    req = {
      path: '/api/test',
      method: 'GET',
      ip: '127.0.0.1',
      user: null
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();

    // Mock console.error to avoid test output clutter
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.clearAllMocks();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('errorHandler', () => {
    it('should handle generic errors with 500 status', () => {
      const error = new Error('Something went wrong');

      errorHandler(error, req, res, next);

      expect(consoleErrorSpy).toHaveBeenCalledWith('=== API ERROR ===');
      expect(logger.error).toHaveBeenCalledWith('API Error:', expect.objectContaining({
        error: 'Something went wrong',
        path: '/api/test',
        method: 'GET',
        ip: '127.0.0.1'
      }));
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'An error occurred. Please try again later.',
        error: expect.objectContaining({
          details: 'Something went wrong'
        })
      });
    });

    it('should handle custom status codes', () => {
      const error = new Error('Custom error');
      error.statusCode = 418;

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(418);
    });

    it('should handle Mongoose validation errors', () => {
      const error = new Error('Validation failed');
      error.name = 'ValidationError';

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        message: 'Invalid input data'
      }));
    });

    it('should handle MongoDB duplicate key errors', () => {
      const error = new Error('Duplicate key');
      error.code = 11000;

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        message: 'This record already exists'
      }));
    });

    it('should handle JWT errors', () => {
      const error = new Error('Invalid token');
      error.name = 'JsonWebTokenError';

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        message: 'Authentication failed'
      }));
    });

    it('should handle JWT token expiration errors', () => {
      const error = new Error('Token expired');
      error.name = 'TokenExpiredError';

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        message: 'Session expired. Please login again'
      }));
    });

    it('should handle rate limiting errors', () => {
      const error = new Error('Too many requests');
      error.status = 429;

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        message: 'Too many requests. Please try again later'
      }));
    });

    it('should handle CastError (invalid MongoDB ObjectId)', () => {
      const error = new Error('Cast to ObjectId failed');
      error.name = 'CastError';

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        message: 'Invalid data format'
      }));
    });

    it('should include user context when available', () => {
      const error = new Error('User error');
      req.user = {
        id: 'user123',
        role: 'affiliate',
        affiliateId: 'AFF123'
      };

      errorHandler(error, req, res, next);

      expect(logger.error).toHaveBeenCalledWith('API Error:', expect.objectContaining({
        userId: 'user123',
        errorType: 'Error',
        path: '/api/test'
      }));
    });

    it('should handle errors with customer context', () => {
      const error = new Error('Customer error');
      req.user = {
        id: 'user456',
        role: 'customer',
        customerId: 'CUST456'
      };

      errorHandler(error, req, res, next);

      expect(logger.error).toHaveBeenCalledWith('API Error:', expect.objectContaining({
        userId: 'CUST456'
      }));
    });

    it('should hide error details in production', () => {
      process.env.NODE_ENV = 'production';
      const error = new Error('Secret error details');
      error.stack = 'Secret stack trace';

      errorHandler(error, req, res, next);

      const response = res.json.mock.calls[0][0];
      expect(response.error).toBeUndefined();
      expect(response.message).toBe('An error occurred. Please try again later.');
    });

    it('should show error details in development', () => {
      process.env.NODE_ENV = 'development';
      const error = new Error('Dev error');
      error.stack = 'Stack trace';

      errorHandler(error, req, res, next);

      const response = res.json.mock.calls[0][0];
      expect(response.error).toBeDefined();
      expect(response.error.details).toBe('Dev error');
      expect(response.error.stack).toBe('Stack trace');
    });

    it('should use original message for non-500 errors in production', () => {
      process.env.NODE_ENV = 'production';
      const error = new Error('Bad request data');
      error.statusCode = 400;

      errorHandler(error, req, res, next);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Bad request data'
      }));
    });

    it('should handle errors without message', () => {
      const error = new Error();
      error.name = 'EmptyError';

      errorHandler(error, req, res, next);

      expect(logger.error).toHaveBeenCalledWith('API Error:', expect.objectContaining({
        error: '',
        errorType: 'EmptyError'
      }));
    });

    it('should handle errors with code property', () => {
      const error = new Error('MongoDB error');
      error.code = 'ECONNREFUSED';

      errorHandler(error, req, res, next);

      expect(logger.error).toHaveBeenCalledWith('API Error:', expect.objectContaining({
        errorCode: 'ECONNREFUSED'
      }));
    });

    it('should log all console error sections', () => {
      const error = new Error('Test error');
      error.name = 'TestError';
      error.code = 'TEST_CODE';
      error.stack = 'Test stack trace';

      errorHandler(error, req, res, next);

      expect(consoleErrorSpy).toHaveBeenCalledWith('=== API ERROR ===');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error message:', 'Test error');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error stack:', 'Test stack trace');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Request path:', '/api/test');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Request method:', 'GET');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error type:', 'TestError');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error code:', 'TEST_CODE');
      expect(consoleErrorSpy).toHaveBeenCalledWith('================');
    });
  });

  describe('AppError', () => {
    it('should create custom error with status code', () => {
      const error = new AppError('Custom error message', 403);

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AppError);
      expect(error.message).toBe('Custom error message');
      expect(error.statusCode).toBe(403);
      expect(error.name).toBe('AppError');
    });

    it('should have stack trace', () => {
      const error = new AppError('Test error', 400);

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('AppError');
    });

    it('should work with error handler', () => {
      const error = new AppError('Forbidden', 403);

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Forbidden'
      }));
    });
  });

  describe('Edge cases', () => {
    it('should handle null error', () => {
      errorHandler(null, req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
    });

    it('should handle undefined error', () => {
      errorHandler(undefined, req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
    });

    it('should handle non-error objects', () => {
      const notAnError = { message: 'Not really an error' };

      errorHandler(notAnError, req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
    });

    it('should handle errors thrown from within error handler', () => {
      const error = new Error('Original error');
      logger.error.mockImplementation(() => {
        throw new Error('Logger failed');
      });

      // Should not throw
      expect(() => errorHandler(error, req, res, next)).not.toThrow();
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });
});