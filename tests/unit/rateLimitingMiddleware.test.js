// Mock dependencies before requiring the module
jest.mock('express-rate-limit', () => {
  return jest.fn((config) => {
    // Return a middleware function
    return (req, res, next) => {
      // Store config for testing
      req.rateLimitConfig = config;
      
      // Test key generator if provided
      if (config.keyGenerator && req.keyGeneratorTest) {
        req.generatedKey = config.keyGenerator(req);
      }
      
      // Test skip function if provided
      if (config.skip && req.skipTest) {
        req.shouldSkip = config.skip(req);
      }
      
      next();
    };
  });
});

jest.mock('rate-limit-mongo', () => {
  return jest.fn().mockImplementation((options) => {
    return {
      uri: options.uri,
      collectionName: options.collectionName,
      expireTimeMs: options.expireTimeMs,
      _isMongoStore: true
    };
  });
});

const request = require('supertest');
const express = require('express');

describe('Rate Limiting Middleware', () => {
  let originalEnv;
  let rateLimitingModule;
  
  beforeAll(() => {
    // Save original environment
    originalEnv = { ...process.env };
  });
  
  afterAll(() => {
    // Restore original environment
    process.env = originalEnv;
  });
  
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });
  
  describe('createMongoStore', () => {
    it('should return undefined in test environment', () => {
      process.env.NODE_ENV = 'test';
      
      rateLimitingModule = require('../../server/middleware/rateLimiting');
      const limiter = rateLimitingModule.createCustomLimiter({ windowMs: 60000 });
      
      const req = {};
      const res = {};
      const next = jest.fn();
      
      limiter(req, res, next);
      
      expect(req.rateLimitConfig.store).toBeUndefined();
    });
    
    it('should create MongoStore in non-test environment', () => {
      process.env.NODE_ENV = 'production';
      process.env.MONGODB_URI = 'mongodb://localhost:27017/test';
      
      rateLimitingModule = require('../../server/middleware/rateLimiting');
      const MongoStore = require('rate-limit-mongo');
      
      const limiter = rateLimitingModule.createCustomLimiter({ windowMs: 60000 });
      
      const req = {};
      const res = {};
      const next = jest.fn();
      
      limiter(req, res, next);
      
      expect(req.rateLimitConfig.store).toBeDefined();
      expect(req.rateLimitConfig.store._isMongoStore).toBe(true);
      expect(MongoStore).toHaveBeenCalledWith({
        uri: 'mongodb://localhost:27017/test',
        collectionName: 'rate_limits',
        expireTimeMs: 60000,
        errorHandler: expect.any(Function)
      });
    });
    
    it('should handle MongoStore creation errors', () => {
      process.env.NODE_ENV = 'production';
      process.env.MONGODB_URI = 'invalid-uri';
      
      // Spy on console.error
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      // Clear module cache to ensure fresh require
      jest.resetModules();
      
      // Make MongoStore throw error
      jest.doMock('rate-limit-mongo', () => {
        return jest.fn().mockImplementation(() => {
          throw new Error('Invalid MongoDB URI');
        });
      });
      
      rateLimitingModule = require('../../server/middleware/rateLimiting');
      const limiter = rateLimitingModule.createCustomLimiter({ windowMs: 60000 });
      
      const req = {};
      const res = {};
      const next = jest.fn();
      
      limiter(req, res, next);
      
      // Should fall back to undefined (memory store)
      expect(req.rateLimitConfig.store).toBeUndefined();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to create MongoDB rate limit store:',
        expect.any(Error)
      );
      
      consoleErrorSpy.mockRestore();
    });
  });
  
  describe('Key Generators', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
      rateLimitingModule = require('../../server/middleware/rateLimiting');
    });
    
    it('should generate key for sensitive operations based on user ID', () => {
      const app = express();
      app.use((req, res, next) => {
        req.user = { id: 'user123' };
        req.keyGeneratorTest = true;
        next();
      });
      app.use(rateLimitingModule.sensitiveOperationLimiter);
      app.get('/test', (req, res) => res.json({ key: req.generatedKey }));
      
      return request(app)
        .get('/test')
        .expect(200)
        .then(response => {
          expect(response.body.key).toBe('user_user123');
        });
    });
    
    it('should generate key for sensitive operations based on IP when no user', () => {
      const app = express();
      app.use((req, res, next) => {
        req.keyGeneratorTest = true;
        next();
      });
      app.use(rateLimitingModule.sensitiveOperationLimiter);
      app.get('/test', (req, res) => res.json({ key: req.generatedKey }));
      
      return request(app)
        .get('/test')
        .expect(200)
        .then(response => {
          // Supertest uses ::ffff:127.0.0.1 as the IP
          expect(response.body.key).toBe('::ffff:127.0.0.1');
        });
    });
    
    it('should generate key for email verification based on email', () => {
      const app = express();
      app.use(express.json());
      app.use((req, res, next) => {
        req.keyGeneratorTest = true;
        next();
      });
      app.post('/test', rateLimitingModule.emailVerificationLimiter, (req, res) => {
        res.json({ key: req.generatedKey });
      });
      
      return request(app)
        .post('/test')
        .send({ email: 'test@example.com' })
        .expect(200)
        .then(response => {
          expect(response.body.key).toBe('test@example.com');
        });
    });
    
    it('should generate key for email verification based on user ID when no email', () => {
      const app = express();
      app.use(express.json());
      app.use((req, res, next) => {
        req.user = { id: 'user456' };
        req.keyGeneratorTest = true;
        next();
      });
      app.post('/test', rateLimitingModule.emailVerificationLimiter, (req, res) => {
        res.json({ key: req.generatedKey });
      });
      
      return request(app)
        .post('/test')
        .send({})
        .expect(200)
        .then(response => {
          expect(response.body.key).toBe('user456');
        });
    });
    
    it('should generate key for email verification based on IP when no email or user', () => {
      const app = express();
      app.use(express.json());
      app.use((req, res, next) => {
        req.keyGeneratorTest = true;
        next();
      });
      app.post('/test', rateLimitingModule.emailVerificationLimiter, (req, res) => {
        res.json({ key: req.generatedKey });
      });
      
      return request(app)
        .post('/test')
        .send({})
        .expect(200)
        .then(response => {
          // Supertest uses ::ffff:127.0.0.1 as the IP
          expect(response.body.key).toBe('::ffff:127.0.0.1');
        });
    });
    
    it('should generate key for file upload based on user ID', () => {
      const app = express();
      app.use((req, res, next) => {
        req.user = { id: 'user789' };
        req.keyGeneratorTest = true;
        next();
      });
      app.use(rateLimitingModule.fileUploadLimiter);
      app.get('/test', (req, res) => res.json({ key: req.generatedKey }));
      
      return request(app)
        .get('/test')
        .expect(200)
        .then(response => {
          expect(response.body.key).toBe('user_user789');
        });
    });
    
    it('should generate key for admin login based on IP and username', () => {
      const app = express();
      app.use(express.json());
      app.use((req, res, next) => {
        req.keyGeneratorTest = true;
        next();
      });
      app.post('/test', rateLimitingModule.adminLoginLimiter, (req, res) => {
        res.json({ key: req.generatedKey });
      });
      
      return request(app)
        .post('/test')
        .send({ username: 'admin123' })
        .expect(200)
        .then(response => {
          expect(response.body.key).toBe('admin_login_::ffff:127.0.0.1_admin123');
        });
    });
    
    it('should generate key for admin login based on IP and email when no username', () => {
      const app = express();
      app.use(express.json());
      app.use((req, res, next) => {
        req.keyGeneratorTest = true;
        next();
      });
      app.post('/test', rateLimitingModule.adminLoginLimiter, (req, res) => {
        res.json({ key: req.generatedKey });
      });
      
      return request(app)
        .post('/test')
        .send({ email: 'admin@example.com' })
        .expect(200)
        .then(response => {
          expect(response.body.key).toBe('admin_login_::ffff:127.0.0.1_admin@example.com');
        });
    });
  });
  
  describe('Skip Functions', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
      rateLimitingModule = require('../../server/middleware/rateLimiting');
    });
    
    it('should skip admin operation limiter for non-admin users', () => {
      const app = express();
      app.use((req, res, next) => {
        req.user = { role: 'user' };
        req.skipTest = true;
        next();
      });
      app.use(rateLimitingModule.adminOperationLimiter);
      app.get('/test', (req, res) => res.json({ shouldSkip: req.shouldSkip }));
      
      return request(app)
        .get('/test')
        .expect(200)
        .then(response => {
          expect(response.body.shouldSkip).toBe(true);
        });
    });
    
    it('should not skip admin operation limiter for admin users', () => {
      const app = express();
      app.use((req, res, next) => {
        req.user = { role: 'admin' };
        req.skipTest = true;
        next();
      });
      app.use(rateLimitingModule.adminOperationLimiter);
      app.get('/test', (req, res) => res.json({ shouldSkip: req.shouldSkip }));
      
      return request(app)
        .get('/test')
        .expect(200)
        .then(response => {
          expect(response.body.shouldSkip).toBe(false);
        });
    });
    
    it('should skip admin operation limiter when no user', () => {
      const app = express();
      app.use((req, res, next) => {
        req.skipTest = true;
        next();
      });
      app.use(rateLimitingModule.adminOperationLimiter);
      app.get('/test', (req, res) => res.json({ shouldSkip: req.shouldSkip }));
      
      return request(app)
        .get('/test')
        .expect(200)
        .then(response => {
          expect(response.body.shouldSkip).toBe(true);
        });
    });
  });
  
  describe('createCustomLimiter', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
      rateLimitingModule = require('../../server/middleware/rateLimiting');
    });
    
    it('should create limiter with custom options', () => {
      const customOptions = {
        windowMs: 30000,
        max: 50,
        message: 'Custom rate limit message'
      };
      
      const limiter = rateLimitingModule.createCustomLimiter(customOptions);
      const req = {};
      const res = {};
      const next = jest.fn();
      
      limiter(req, res, next);
      
      expect(req.rateLimitConfig.windowMs).toBe(30000);
      expect(req.rateLimitConfig.max).toBe(50);
      expect(req.rateLimitConfig.message).toBe('Custom rate limit message');
      expect(req.rateLimitConfig.standardHeaders).toBe(true);
      expect(req.rateLimitConfig.legacyHeaders).toBe(false);
    });
    
    it('should merge defaults with custom options', () => {
      const customOptions = {
        max: 100
      };
      
      const limiter = rateLimitingModule.createCustomLimiter(customOptions);
      const req = {};
      const res = {};
      const next = jest.fn();
      
      limiter(req, res, next);
      
      expect(req.rateLimitConfig.max).toBe(100);
      expect(req.rateLimitConfig.message).toEqual({
        success: false,
        message: 'Too many requests, please try again later'
      });
      expect(req.rateLimitConfig.standardHeaders).toBe(true);
    });
    
    it('should use custom windowMs for store creation', () => {
      const MongoStore = require('rate-limit-mongo');
      jest.clearAllMocks();
      
      const customOptions = {
        windowMs: 120000, // 2 minutes
        max: 200
      };
      
      const limiter = rateLimitingModule.createCustomLimiter(customOptions);
      const req = {};
      const res = {};
      const next = jest.fn();
      
      limiter(req, res, next);
      
      // Check that MongoStore was called with correct expireTimeMs
      expect(MongoStore).toHaveBeenCalledWith(
        expect.objectContaining({
          expireTimeMs: 120000
        })
      );
    });
  });
});