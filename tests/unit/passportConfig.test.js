// tests/unit/passportConfigFixed.test.js
// Tests for passport OAuth strategies configuration

describe('Passport Configuration Tests', () => {
  let originalEnv;
  let passport;
  let strategies;
  let consoleLogSpy;
  let consoleErrorSpy;
  
  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
    
    // Clear module cache
    jest.resetModules();
    
    // Mock console methods
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    
    // Reset strategies
    strategies = {};
    
    // Create mock passport object
    passport = {
      use: jest.fn((strategy) => {
        if (strategy.name === 'google') {
          strategies.google = strategy;
        } else if (strategy.name === 'facebook') {
          strategies.facebook = strategy;
        } else if (strategy.name === 'linkedin') {
          strategies.linkedin = strategy;
        }
      }),
      serializeUser: jest.fn((fn) => {
        strategies.serializeUser = fn;
      }),
      deserializeUser: jest.fn((fn) => {
        strategies.deserializeUser = fn;
      })
    };
    
    // Mock all external modules
    jest.doMock('passport', () => passport);
    
    jest.doMock('passport-google-oauth20', () => ({
      Strategy: jest.fn(function(options, verify) {
        this.name = 'google';
        this._verify = verify;
        this._passReqToCallback = options.passReqToCallback;
        this.options = options;
      })
    }));
    
    jest.doMock('passport-facebook', () => ({
      Strategy: jest.fn(function(options, verify) {
        this.name = 'facebook';
        this._verify = verify;
        this._passReqToCallback = options.passReqToCallback;
        this.options = options;
      })
    }));
    
    jest.doMock('passport-linkedin-oauth2', () => ({
      Strategy: jest.fn(function(options, verify) {
        this.name = 'linkedin';
        this._verify = verify;
        this._passReqToCallback = options.passReqToCallback;
        this.options = options;
      })
    }));
    
    jest.doMock('../../server/models/Affiliate', () => ({
      findOne: jest.fn(),
      findById: jest.fn()
    }));
    
    jest.doMock('../../server/models/Customer', () => ({
      findOne: jest.fn(),
      findById: jest.fn()
    }));
    
    jest.doMock('../../server/utils/auditLogger', () => ({
      logAuditEvent: jest.fn(),
      AuditEvents: {
        AUTH_ERROR: 'AUTH_ERROR',
        LOGIN: 'LOGIN'
      }
    }));
  });
  
  afterEach(() => {
    // Restore environment
    process.env = originalEnv;
    
    // Restore console
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    
    // Clear all mocks
    jest.clearAllMocks();
  });
  
  describe('Strategy Configuration', () => {
    test('should configure Google strategy when credentials are present', () => {
      process.env.GOOGLE_CLIENT_ID = 'test-google-client-id';
      process.env.GOOGLE_CLIENT_SECRET = 'test-google-client-secret';
      process.env.OAUTH_CALLBACK_URI = 'https://test.wavemax.com';
      
      require('../../server/config/passport-config');
      
      expect(passport.use).toHaveBeenCalled();
      expect(strategies.google).toBeDefined();
      expect(strategies.google.options).toEqual({
        clientID: 'test-google-client-id',
        clientSecret: 'test-google-client-secret',
        callbackURL: 'https://test.wavemax.com/api/v1/auth/google/callback',
        passReqToCallback: true
      });
    });
    
    test('should not configure Google strategy without credentials', () => {
      delete process.env.GOOGLE_CLIENT_ID;
      delete process.env.GOOGLE_CLIENT_SECRET;
      
      require('../../server/config/passport-config');
      
      expect(strategies.google).toBeUndefined();
    });
    
    test('should configure Facebook strategy when credentials are present', () => {
      process.env.FACEBOOK_APP_ID = 'test-facebook-app-id';
      process.env.FACEBOOK_APP_SECRET = 'test-facebook-app-secret';
      
      require('../../server/config/passport-config');
      
      expect(passport.use).toHaveBeenCalled();
      expect(strategies.facebook).toBeDefined();
      expect(strategies.facebook.options).toEqual({
        clientID: 'test-facebook-app-id',
        clientSecret: 'test-facebook-app-secret',
        callbackURL: 'https://wavemax.promo/api/v1/auth/facebook/callback',
        profileFields: ['id', 'emails', 'name', 'picture.type(large)']
      });
    });
    
    test('should not configure Facebook strategy without credentials', () => {
      delete process.env.FACEBOOK_APP_ID;
      delete process.env.FACEBOOK_APP_SECRET;
      
      require('../../server/config/passport-config');
      
      expect(strategies.facebook).toBeUndefined();
    });
    
    test('should configure LinkedIn strategy when credentials are present', () => {
      process.env.LINKEDIN_CLIENT_ID = 'test-linkedin-client-id';
      process.env.LINKEDIN_CLIENT_SECRET = 'test-linkedin-client-secret';
      
      require('../../server/config/passport-config');
      
      expect(passport.use).toHaveBeenCalled();
      expect(strategies.linkedin).toBeDefined();
      expect(strategies.linkedin.options).toEqual({
        clientID: 'test-linkedin-client-id',
        clientSecret: 'test-linkedin-client-secret',
        callbackURL: 'https://wavemax.promo/api/v1/auth/linkedin/callback',
        scope: ['r_emailaddress', 'r_liteprofile']
      });
    });
  });
  
  describe('Google OAuth Strategy', () => {
    let googleVerify;
    let Affiliate;
    let Customer;
    let logAuditEvent;
    
    beforeEach(() => {
      process.env.GOOGLE_CLIENT_ID = 'test-google-client-id';
      process.env.GOOGLE_CLIENT_SECRET = 'test-google-client-secret';
      
      Affiliate = require('../../server/models/Affiliate');
      Customer = require('../../server/models/Customer');
      const auditLogger = require('../../server/utils/auditLogger');
      logAuditEvent = auditLogger.logAuditEvent;
      
      require('../../server/config/passport-config');
      
      googleVerify = strategies.google._verify;
    });
    
    describe('Customer Context', () => {
      const mockReq = { query: { state: 'customer_oauth_123' } };
      const mockProfile = {
        id: 'google123',
        emails: [{ value: 'test@example.com' }],
        name: { givenName: 'John', familyName: 'Doe' },
        displayName: 'John Doe',
        _json: { sub: 'google123' }
      };
      
      test('should handle existing customer with Google account', async () => {
        const mockCustomer = {
          _id: 'customer123',
          customerId: 'CUST000001',
          socialAccounts: { google: { id: 'google123' } },
          save: jest.fn().mockResolvedValue(true)
        };
        
        Customer.findOne.mockResolvedValue(mockCustomer);
        
        const done = jest.fn();
        await googleVerify(mockReq, 'access-token', 'refresh-token', mockProfile, done);
        
        expect(Customer.findOne).toHaveBeenCalledWith({ 'socialAccounts.google.id': 'google123' });
        expect(mockCustomer.save).toHaveBeenCalled();
        expect(done).toHaveBeenCalledWith(null, mockCustomer);
      });
      
      test('should link Google account to existing customer', async () => {
        const mockCustomer = {
          _id: 'customer123',
          socialAccounts: {},
          save: jest.fn().mockResolvedValue(true)
        };
        
        Customer.findOne
          .mockResolvedValueOnce(null) // No customer with Google ID
          .mockResolvedValueOnce(mockCustomer); // Customer with same email
        
        const done = jest.fn();
        await googleVerify(mockReq, 'access-token', 'refresh-token', mockProfile, done);
        
        expect(mockCustomer.socialAccounts.google).toEqual({
          id: 'google123',
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          email: 'test@example.com',
          name: 'John Doe',
          linkedAt: expect.any(Date)
        });
        expect(done).toHaveBeenCalledWith(null, mockCustomer);
      });
      
      test('should handle existing affiliate conflict', async () => {
        const mockAffiliate = { affiliateId: 'AFF000001', email: 'test@example.com' };
        
        Customer.findOne.mockResolvedValue(null);
        Affiliate.findOne.mockResolvedValue(mockAffiliate);
        
        const done = jest.fn();
        await googleVerify(mockReq, 'access-token', 'refresh-token', mockProfile, done);
        
        expect(done).toHaveBeenCalledWith(null, expect.objectContaining({
          isExistingAffiliate: true,
          provider: 'google',
          socialId: 'google123',
          email: 'test@example.com',
          affiliate: mockAffiliate
        }));
      });
      
      test('should return new user data', async () => {
        Customer.findOne.mockResolvedValue(null);
        Affiliate.findOne.mockResolvedValue(null);
        
        const done = jest.fn();
        await googleVerify(mockReq, 'access-token', 'refresh-token', mockProfile, done);
        
        expect(done).toHaveBeenCalledWith(null, expect.objectContaining({
          isNewUser: true,
          userType: 'customer',
          provider: 'google',
          socialId: 'google123',
          email: 'test@example.com'
        }));
      });
    });
    
    describe('Affiliate Context', () => {
      const mockReq = { query: { state: 'affiliate_oauth' } };
      const mockProfile = {
        id: 'google123',
        emails: [{ value: 'affiliate@example.com' }],
        name: { givenName: 'Jane', familyName: 'Smith' },
        displayName: 'Jane Smith',
        _json: { sub: 'google123' }
      };
      
      test('should handle existing affiliate with Google account', async () => {
        const mockAffiliate = {
          _id: 'affiliate123',
          affiliateId: 'AFF000001',
          socialAccounts: { google: { id: 'google123' } },
          save: jest.fn().mockResolvedValue(true)
        };
        
        Affiliate.findOne.mockResolvedValue(mockAffiliate);
        
        const done = jest.fn();
        await googleVerify(mockReq, 'access-token', 'refresh-token', mockProfile, done);
        
        expect(Affiliate.findOne).toHaveBeenCalledWith({ 'socialAccounts.google.id': 'google123' });
        expect(mockAffiliate.save).toHaveBeenCalled();
        expect(done).toHaveBeenCalledWith(null, mockAffiliate);
      });
      
      test('should handle customer conflict', async () => {
        const mockCustomer = { customerId: 'CUST000001', email: 'affiliate@example.com' };
        
        Affiliate.findOne.mockResolvedValue(null);
        Customer.findOne.mockResolvedValue(mockCustomer);
        
        const done = jest.fn();
        await googleVerify(mockReq, 'access-token', 'refresh-token', mockProfile, done);
        
        expect(done).toHaveBeenCalledWith(null, expect.objectContaining({
          isExistingCustomer: true,
          provider: 'google',
          socialId: 'google123',
          customer: mockCustomer
        }));
      });
      
      test('should link Google account to existing affiliate with email', async () => {
        const mockAffiliate = {
          _id: 'affiliate123',
          affiliateId: 'AFF000001',
          socialAccounts: {},
          save: jest.fn().mockResolvedValue(true)
        };
        
        Affiliate.findOne
          .mockResolvedValueOnce(null) // No affiliate with Google ID
          .mockResolvedValueOnce(mockAffiliate); // Affiliate with same email
        
        const done = jest.fn();
        await googleVerify(mockReq, 'access-token', 'refresh-token', mockProfile, done);
        
        expect(mockAffiliate.socialAccounts.google).toEqual({
          id: 'google123',
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          email: 'affiliate@example.com',
          name: 'Jane Smith',
          linkedAt: expect.any(Date)
        });
        expect(mockAffiliate.save).toHaveBeenCalled();
        expect(done).toHaveBeenCalledWith(null, mockAffiliate);
      });
      
      test('should return new affiliate user data', async () => {
        Affiliate.findOne.mockResolvedValue(null);
        Customer.findOne.mockResolvedValue(null);
        
        const done = jest.fn();
        await googleVerify(mockReq, 'access-token', 'refresh-token', mockProfile, done);
        
        expect(done).toHaveBeenCalledWith(null, expect.objectContaining({
          isNewUser: true,
          userType: 'affiliate',
          provider: 'google',
          socialId: 'google123',
          email: 'affiliate@example.com'
        }));
      });
    });
    
    test('should handle database errors', async () => {
      Customer.findOne.mockRejectedValue(new Error('Database error'));
      
      const done = jest.fn();
      await googleVerify(
        { query: { state: 'customer_oauth' } },
        'token',
        'refresh',
        { id: 'g123', emails: [{ value: 'test@example.com' }], name: {}, _json: {} },
        done
      );
      
      expect(consoleErrorSpy).toHaveBeenCalledWith('Google OAuth error:', expect.any(Error));
      expect(done).toHaveBeenCalledWith(expect.any(Error), null);
    });
  });
  
  describe('Facebook OAuth Strategy', () => {
    let facebookVerify;
    let Affiliate;
    
    beforeEach(() => {
      process.env.FACEBOOK_APP_ID = 'test-facebook-app-id';
      process.env.FACEBOOK_APP_SECRET = 'test-facebook-app-secret';
      
      Affiliate = require('../../server/models/Affiliate');
      
      require('../../server/config/passport-config');
      
      facebookVerify = strategies.facebook._verify;
    });
    
    test('should handle existing affiliate', async () => {
      const mockAffiliate = {
        _id: 'affiliate123',
        socialAccounts: { facebook: { id: 'fb123' } },
        save: jest.fn().mockResolvedValue(true)
      };
      
      Affiliate.findOne.mockResolvedValue(mockAffiliate);
      
      const done = jest.fn();
      await facebookVerify(
        'access-token',
        'refresh-token',
        { id: 'fb123', emails: [{ value: 'test@example.com' }], name: {}, _json: {} },
        done
      );
      
      expect(done).toHaveBeenCalledWith(null, mockAffiliate);
    });
    
    test('should return new user data for registration', async () => {
      Affiliate.findOne.mockResolvedValue(null);
      
      const done = jest.fn();
      await facebookVerify(
        'access-token',
        'refresh-token',
        {
          id: 'fb123',
          emails: [{ value: 'test@example.com' }],
          name: { givenName: 'Bob', familyName: 'Johnson' },
          _json: {}
        },
        done
      );
      
      expect(done).toHaveBeenCalledWith(null, expect.objectContaining({
        isNewUser: true,
        provider: 'facebook',
        socialId: 'fb123'
      }));
    });
    
    test('should link Facebook account to existing affiliate', async () => {
      const mockAffiliate = {
        _id: 'affiliate123',
        socialAccounts: {},
        save: jest.fn().mockResolvedValue(true)
      };
      
      Affiliate.findOne
        .mockResolvedValueOnce(null) // No affiliate with Facebook ID
        .mockResolvedValueOnce(mockAffiliate); // Affiliate with same email
      
      const done = jest.fn();
      await facebookVerify(
        'access-token',
        null, // No refresh token for Facebook
        {
          id: 'fb123',
          emails: [{ value: 'test@example.com' }],
          name: { givenName: 'Bob', familyName: 'Johnson' },
          displayName: 'Bob Johnson',
          _json: {}
        },
        done
      );
      
      expect(mockAffiliate.socialAccounts.facebook).toEqual({
        id: 'fb123',
        accessToken: 'access-token',
        email: 'test@example.com',
        name: 'Bob Johnson',
        linkedAt: expect.any(Date)
      });
      expect(mockAffiliate.save).toHaveBeenCalled();
      expect(done).toHaveBeenCalledWith(null, mockAffiliate);
    });
    
    test('should handle Facebook error', async () => {
      Affiliate.findOne.mockRejectedValue(new Error('Database error'));
      
      const done = jest.fn();
      await facebookVerify(
        'access-token',
        'refresh-token',
        { id: 'fb123', emails: [{ value: 'test@example.com' }], name: {}, _json: {} },
        done
      );
      
      expect(consoleErrorSpy).toHaveBeenCalledWith('Facebook OAuth error:', expect.any(Error));
      expect(done).toHaveBeenCalledWith(expect.any(Error), null);
    });
  });
  
  describe('LinkedIn OAuth Strategy', () => {
    let linkedinVerify;
    let Affiliate;
    
    beforeEach(() => {
      process.env.LINKEDIN_CLIENT_ID = 'test-linkedin-client-id';
      process.env.LINKEDIN_CLIENT_SECRET = 'test-linkedin-client-secret';
      
      Affiliate = require('../../server/models/Affiliate');
      
      require('../../server/config/passport-config');
      
      linkedinVerify = strategies.linkedin._verify;
    });
    
    test('should handle existing affiliate', async () => {
      const mockAffiliate = {
        _id: 'affiliate123',
        socialAccounts: { linkedin: { id: 'li123' } },
        save: jest.fn().mockResolvedValue(true)
      };
      
      Affiliate.findOne.mockResolvedValue(mockAffiliate);
      
      const done = jest.fn();
      await linkedinVerify(
        'access-token',
        'refresh-token',
        { id: 'li123', emails: [{ value: 'test@example.com' }], name: {}, _json: {} },
        done
      );
      
      expect(done).toHaveBeenCalledWith(null, mockAffiliate);
    });
    
    test('should link LinkedIn account to existing affiliate', async () => {
      const mockAffiliate = {
        _id: 'affiliate123',
        socialAccounts: {},
        save: jest.fn().mockResolvedValue(true)
      };
      
      Affiliate.findOne
        .mockResolvedValueOnce(null) // No affiliate with LinkedIn ID
        .mockResolvedValueOnce(mockAffiliate); // Affiliate with same email
      
      const done = jest.fn();
      await linkedinVerify(
        'access-token',
        'refresh-token',
        {
          id: 'li123',
          emails: [{ value: 'test@example.com' }],
          name: { givenName: 'Alice', familyName: 'Williams' },
          displayName: 'Alice Williams',
          _json: {}
        },
        done
      );
      
      expect(mockAffiliate.socialAccounts.linkedin).toEqual({
        id: 'li123',
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        email: 'test@example.com',
        name: 'Alice Williams',
        linkedAt: expect.any(Date)
      });
      expect(mockAffiliate.save).toHaveBeenCalled();
      expect(done).toHaveBeenCalledWith(null, mockAffiliate);
    });
    
    test('should return new LinkedIn user data', async () => {
      Affiliate.findOne.mockResolvedValue(null);
      
      const done = jest.fn();
      await linkedinVerify(
        'access-token',
        'refresh-token',
        {
          id: 'li123',
          emails: [{ value: 'test@example.com' }],
          name: { givenName: 'Alice', familyName: 'Williams' },
          _json: {}
        },
        done
      );
      
      expect(done).toHaveBeenCalledWith(null, expect.objectContaining({
        isNewUser: true,
        provider: 'linkedin',
        socialId: 'li123',
        email: 'test@example.com'
      }));
    });
    
    test('should handle LinkedIn error', async () => {
      Affiliate.findOne.mockRejectedValue(new Error('Database error'));
      
      const done = jest.fn();
      await linkedinVerify(
        'access-token',
        'refresh-token',
        { id: 'li123', emails: [{ value: 'test@example.com' }], name: {}, _json: {} },
        done
      );
      
      expect(consoleErrorSpy).toHaveBeenCalledWith('LinkedIn OAuth error:', expect.any(Error));
      expect(done).toHaveBeenCalledWith(expect.any(Error), null);
    });
  });
  
  describe('Serialization', () => {
    let serializeUser;
    let deserializeUser;
    let Affiliate;
    
    beforeEach(() => {
      Affiliate = require('../../server/models/Affiliate');
      
      require('../../server/config/passport-config');
      
      serializeUser = strategies.serializeUser;
      deserializeUser = strategies.deserializeUser;
    });
    
    test('should serialize user with _id', (done) => {
      const user = { _id: 'user123' };
      
      serializeUser(user, (err, id) => {
        expect(err).toBeNull();
        expect(id).toBe('user123');
        done();
      });
    });
    
    test('should serialize user with socialId', (done) => {
      const user = { socialId: 'social123' };
      
      serializeUser(user, (err, id) => {
        expect(err).toBeNull();
        expect(id).toBe('social123');
        done();
      });
    });
    
    test('should deserialize user', async () => {
      const mockAffiliate = { _id: 'user123', affiliateId: 'AFF001' };
      Affiliate.findById.mockResolvedValue(mockAffiliate);
      
      const done = jest.fn();
      await deserializeUser('user123', done);
      
      expect(Affiliate.findById).toHaveBeenCalledWith('user123');
      expect(done).toHaveBeenCalledWith(null, mockAffiliate);
    });
    
    test('should handle deserialization errors', async () => {
      Affiliate.findById.mockRejectedValue(new Error('Database error'));
      
      const done = jest.fn();
      await deserializeUser('user123', done);
      
      expect(done).toHaveBeenCalledWith(expect.any(Error), null);
    });
  });
});