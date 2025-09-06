// Tests for passport customer OAuth flow
const passport = require('passport');

describe('Passport Customer OAuth Flow', () => {
  let originalEnv;
  let strategies;
  let FacebookStrategy;
  let Affiliate;
  let Customer;
  let consoleLogSpy;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
    
    // Set required environment variables
    process.env.FACEBOOK_CLIENT_ID = 'test-facebook-id';
    process.env.FACEBOOK_CLIENT_SECRET = 'test-facebook-secret';
    process.env.BASE_URL = 'http://localhost:3000';

    // Clear module cache
    jest.resetModules();

    // Mock console
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    
    // Reset strategies
    strategies = {};

    // Mock Affiliate model
    Affiliate = {
      findOne: jest.fn(),
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      create: jest.fn()
    };
    jest.doMock('../../server/models/Affiliate', () => Affiliate);

    // Mock Customer model
    Customer = {
      findOne: jest.fn(),
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      create: jest.fn()
    };
    jest.doMock('../../server/models/Customer', () => Customer);

    // Mock Facebook Strategy
    FacebookStrategy = jest.fn(function(options, verify) {
      this.name = 'facebook';
      this._verify = verify;
      this._callbackURL = options.callbackURL;
      strategies.facebook = this;
    });
    jest.doMock('passport-facebook', () => ({ Strategy: FacebookStrategy }));

    // Mock passport
    jest.doMock('passport', () => ({
      use: jest.fn((strategy) => {
        if (strategy.name === 'facebook') {
          strategies.facebook = strategy;
        }
      }),
      serializeUser: jest.fn(),
      deserializeUser: jest.fn()
    }));

    // Mock encryption utilities
    jest.doMock('../../server/utils/encryption', () => ({
      encryptToString: jest.fn((data) => data), // Return data as-is for testing
      decryptFromString: jest.fn((data) => data) // Return data as-is for testing
    }));

    // Mock audit logger
    jest.doMock('../../server/utils/auditLogger', () => ({
      logAuditEvent: jest.fn(),
      AuditEvents: {
        AUTH_ERROR: 'AUTH_ERROR',
        LOGIN: 'LOGIN'
      }
    }));

    // Load the config which will set up strategies
    require('../../server/config/passport-config');
  });

  afterEach(() => {
    // Restore environment
    process.env = originalEnv;
    // Restore console
    consoleLogSpy.mockRestore();
    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('Facebook Strategy - Customer Context', () => {
    it('should handle existing customer login with Facebook ID', async () => {
      const mockCustomer = {
        _id: 'customer123',
        customerId: 'CUST001',
        email: 'customer@example.com',
        socialAccounts: {
          facebook: { id: 'fb123' , save: jest.fn().mockResolvedValue(true)}
        }
      };

      Customer.findOne.mockResolvedValueOnce(mockCustomer);
      Customer.findByIdAndUpdate.mockResolvedValueOnce(mockCustomer);
      Customer.findById.mockResolvedValueOnce(mockCustomer);

      const profile = {
        id: 'fb123',
        displayName: 'Test Customer',
        emails: [{ value: 'customer@example.com' }],
        name: { givenName: 'Test', familyName: 'Customer' },
        _json: { id: 'fb123' }
      };

      const done = jest.fn();
      const req = { 
        isCustomerOAuth: true,
        headers: { origin: 'http://localhost:3000/wavemax-customer-app' },
        query: { state: 'customer' }
      };

      await strategies.facebook._verify(req, 'accessToken123', 'refreshToken123', profile, done);

      expect(Customer.findOne).toHaveBeenCalledWith({ 'socialAccounts.facebook.id': 'fb123' });
      expect(Customer.findByIdAndUpdate).toHaveBeenCalledWith(
        'customer123',
        {
          'socialAccounts.facebook.accessToken': 'accessToken123',
          'lastLogin': expect.any(Date)
        },
        { runValidators: false }
      );
      expect(done).toHaveBeenCalledWith(null, mockCustomer);
    });

    it('should link Facebook to existing customer by email', async () => {
      const mockCustomer = {
        _id: 'customer456',
        customerId: 'CUST002',
        email: 'existing@example.com'
      , save: jest.fn().mockResolvedValue(true)};

      // First findOne returns null (no Facebook ID match)
      Customer.findOne.mockResolvedValueOnce(null);
      // Second findOne returns customer (email match)
      Customer.findOne.mockResolvedValueOnce(mockCustomer);
      Customer.findByIdAndUpdate.mockResolvedValueOnce(mockCustomer);
      Customer.findById.mockResolvedValueOnce(mockCustomer);

      const profile = {
        id: 'fb456',
        displayName: 'Existing Customer',
        emails: [{ value: 'existing@example.com' }],
        name: { givenName: 'Existing', familyName: 'Customer' },
        _json: { id: 'fb456' }
      };

      const done = jest.fn();
      const req = { 
        isCustomerOAuth: true,
        headers: { origin: 'http://localhost:3000/wavemax-customer-app' },
        query: { state: 'customer' }
      };

      await strategies.facebook._verify(req, 'accessToken456', 'refreshToken456', profile, done);

      expect(Customer.findOne).toHaveBeenNthCalledWith(1, { 'socialAccounts.facebook.id': 'fb456' });
      expect(Customer.findOne).toHaveBeenNthCalledWith(2, { email: 'existing@example.com' });
      expect(Customer.findByIdAndUpdate).toHaveBeenCalledWith(
        'customer456',
        {
          'socialAccounts.facebook': {
            id: 'fb456',
            accessToken: 'accessToken456',
            email: 'existing@example.com',
            name: 'Existing Customer',
            linkedAt: expect.any(Date)
          },
          'lastLogin': expect.any(Date)
        },
        { runValidators: false }
      );
      expect(done).toHaveBeenCalledWith(null, mockCustomer);
    });

    it('should detect when affiliate exists with same Facebook account', async () => {
      const mockAffiliate = {
        _id: 'affiliate123',
        affiliateId: 'AFF001',
        email: 'affiliate@example.com',
        socialAccounts: {
          facebook: { id: 'fb789' , save: jest.fn().mockResolvedValue(true)}
        }
      };

      // No customer found
      Customer.findOne.mockResolvedValue(null);
      // Affiliate found with same Facebook ID
      Affiliate.findOne.mockResolvedValueOnce(mockAffiliate);

      const profile = {
        id: 'fb789',
        displayName: 'Test User',
        emails: [{ value: 'test@example.com' }],
        name: { givenName: 'Test', familyName: 'User' },
        _json: { id: 'fb789' }
      };

      const done = jest.fn();
      const req = { 
        isCustomerOAuth: true,
        headers: { origin: 'http://localhost:3000/wavemax-customer-app' },
        query: { state: 'customer' }
      };

      await strategies.facebook._verify(req, 'accessToken789', 'refreshToken789', profile, done);

      expect(Affiliate.findOne).toHaveBeenCalledWith({
        $or: [
          { 'socialAccounts.facebook.id': 'fb789' },
          { email: 'test@example.com' }
        ]
      });
      expect(done).toHaveBeenCalledWith(null, {
        isExistingAffiliate: true,
        provider: 'facebook',
        socialId: 'fb789',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        affiliate: mockAffiliate,
        accessToken: 'accessToken789',
        refreshToken: 'refreshToken789',
        profileData: { id: 'fb789' }
      });
    });

    it('should handle new customer registration', async () => {
      // No existing customer or affiliate
      Customer.findOne.mockResolvedValue(null);
      Affiliate.findOne.mockResolvedValue(null);

      const profile = {
        id: 'fb999',
        displayName: 'New Customer',
        emails: [{ value: 'new@example.com' }],
        name: { givenName: 'New', familyName: 'Customer' },
        _json: { id: 'fb999' }
      };

      const done = jest.fn();
      const req = { 
        isCustomerOAuth: true,
        headers: { origin: 'http://localhost:3000/wavemax-customer-app' },
        query: { state: 'customer' }
      };

      await strategies.facebook._verify(req, 'accessToken999', 'refreshToken999', profile, done);

      expect(done).toHaveBeenCalledWith(null, {
        isNewUser: true,
        userType: 'customer',
        provider: 'facebook',
        socialId: 'fb999',
        email: 'new@example.com',
        firstName: 'New',
        lastName: 'Customer',
        displayName: 'New Customer',
        accessToken: 'accessToken999',
        refreshToken: 'refreshToken999',
        profileData: { id: 'fb999' }
      });
    });

    it('should parse display name when structured name not available', async () => {
      Customer.findOne.mockResolvedValue(null);
      Affiliate.findOne.mockResolvedValue(null);

      const profile = {
        id: 'fb111',
        displayName: 'John Doe Smith',
        emails: [{ value: 'john@example.com' }],
        name: { givenName: '', familyName: '' }, // Empty structured names
        _json: { id: 'fb111' }
      };

      const done = jest.fn();
      const req = { 
        isCustomerOAuth: true,
        headers: { origin: 'http://localhost:3000/wavemax-customer-app' },
        query: { state: 'customer' }
      };

      await strategies.facebook._verify(req, 'accessToken111', 'refreshToken111', profile, done);

      expect(done).toHaveBeenCalledWith(null, expect.objectContaining({
        firstName: 'John',
        lastName: 'Doe Smith'
      }));
    });

    it('should handle single name in display name', async () => {
      Customer.findOne.mockResolvedValue(null);
      Affiliate.findOne.mockResolvedValue(null);

      const profile = {
        id: 'fb222',
        displayName: 'SingleName',
        emails: [{ value: 'single@example.com' }],
        name: {}, // No structured name
        _json: { id: 'fb222' }
      };

      const done = jest.fn();
      const req = { 
        isCustomerOAuth: true,
        headers: { origin: 'http://localhost:3000/wavemax-customer-app' },
        query: { state: 'customer' }
      };

      await strategies.facebook._verify(req, 'accessToken222', 'refreshToken222', profile, done);

      expect(done).toHaveBeenCalledWith(null, expect.objectContaining({
        firstName: 'SingleName',
        lastName: ''
      }));
    });
  });

  describe('Facebook Strategy - Affiliate Context with Customer Check', () => {
    it('should detect when customer exists during affiliate OAuth', async () => {
      const mockCustomer = {
        _id: 'customer789',
        customerId: 'CUST003',
        email: 'customer@example.com',
        socialAccounts: {
          facebook: { id: 'fb333' , save: jest.fn().mockResolvedValue(true)}
        }
      };

      // No affiliate found
      Affiliate.findOne.mockResolvedValue(null);
      // Customer found with same Facebook ID
      Customer.findOne.mockResolvedValueOnce(mockCustomer);

      const profile = {
        id: 'fb333',
        displayName: 'Test User',
        emails: [{ value: 'test@example.com' }],
        name: { givenName: 'Test', familyName: 'User' },
        _json: { id: 'fb333' }
      };

      const done = jest.fn();
      const req = { 
        isCustomerOAuth: false,
        headers: { origin: 'http://localhost:3000' },
        query: {}
      };

      await strategies.facebook._verify(req, 'accessToken333', 'refreshToken333', profile, done);

      expect(Customer.findOne).toHaveBeenCalledWith({
        $or: [
          { 'socialAccounts.facebook.id': 'fb333' },
          { email: 'test@example.com' }
        ]
      });
      expect(done).toHaveBeenCalledWith(null, {
        isExistingCustomer: true,
        provider: 'facebook',
        socialId: 'fb333',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        customer: mockCustomer,
        accessToken: 'accessToken333',
        refreshToken: 'refreshToken333',
        profileData: { id: 'fb333' }
      });
    });

    it('should parse display name in affiliate context', async () => {
      // No existing affiliate or customer
      Affiliate.findOne.mockResolvedValue(null);
      Customer.findOne.mockResolvedValue(null);

      const profile = {
        id: 'fb444',
        displayName: 'Jane Doe',
        emails: [{ value: 'jane@example.com' }],
        name: {}, // No structured name
        _json: { id: 'fb444' }
      };

      const done = jest.fn();
      const req = { 
        isCustomerOAuth: false,
        headers: { origin: 'http://localhost:3000' },
        query: {}
      };

      await strategies.facebook._verify(req, 'accessToken444', 'refreshToken444', profile, done);

      expect(done).toHaveBeenCalledWith(null, expect.objectContaining({
        isNewUser: true,
        userType: 'affiliate',
        firstName: 'Jane',
        lastName: 'Doe'
      }));
    });
  });
});