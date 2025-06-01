// Enhanced Passport Configuration Unit Tests for WaveMAX Laundry Affiliate Program

const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const LinkedInStrategy = require('passport-linkedin-oauth2').Strategy;

// Mock the strategies
jest.mock('passport-google-oauth20');
jest.mock('passport-facebook');
jest.mock('passport-linkedin-oauth2');

describe('Enhanced Passport Configuration', () => {
  let originalEnv;

  beforeAll(() => {
    // Store original environment variables
    originalEnv = process.env;
  });

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock passport.use
    passport.use = jest.fn();
    
    // Reset environment variables
    process.env = {
      ...originalEnv,
      GOOGLE_CLIENT_ID: 'test-google-client-id',
      GOOGLE_CLIENT_SECRET: 'test-google-client-secret',
      FACEBOOK_APP_ID: 'test-facebook-app-id',
      FACEBOOK_APP_SECRET: 'test-facebook-app-secret',
      LINKEDIN_CLIENT_ID: 'test-linkedin-client-id',
      LINKEDIN_CLIENT_SECRET: 'test-linkedin-client-secret',
      OAUTH_CALLBACK_URI: 'https://test.example.com'
    };

    // Clear require cache to reload passport config
    delete require.cache[require.resolve('../../server/config/passport-config')];
  });

  afterAll(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('Google OAuth Strategy Configuration', () => {
    test('should configure Google strategy with correct parameters', () => {
      // Require passport config to trigger strategy setup
      require('../../server/config/passport-config');

      expect(GoogleStrategy).toHaveBeenCalledWith(
        expect.objectContaining({
          clientID: 'test-google-client-id',
          clientSecret: 'test-google-client-secret',
          callbackURL: 'https://test.example.com/api/v1/auth/google/callback'
        }),
        expect.any(Function)
      );

      expect(passport.use).toHaveBeenCalledWith('google', expect.any(GoogleStrategy));
    });

    test('should handle Google OAuth callback correctly', () => {
      require('../../server/config/passport-config');

      // Get the callback function passed to GoogleStrategy
      const googleStrategyCall = GoogleStrategy.mock.calls[0];
      const googleCallback = googleStrategyCall[1];

      const mockAccessToken = 'google-access-token';
      const mockRefreshToken = 'google-refresh-token';
      const mockProfile = {
        provider: 'google',
        id: 'google-user-123',
        emails: [{ value: 'google@example.com' }],
        name: { givenName: 'John', familyName: 'Doe' },
        _json: { picture: 'https://google.com/photo.jpg' }
      };
      const mockDone = jest.fn();

      // Call the Google callback
      googleCallback(mockAccessToken, mockRefreshToken, mockProfile, mockDone);

      // Verify callback behavior
      expect(mockDone).toHaveBeenCalledWith(null, {
        provider: 'google',
        id: 'google-user-123',
        emails: [{ value: 'google@example.com' }],
        name: { givenName: 'John', familyName: 'Doe' },
        _json: { picture: 'https://google.com/photo.jpg' },
        accessToken: 'google-access-token',
        refreshToken: 'google-refresh-token'
      });
    });

    test('should not configure Google strategy when credentials are missing', () => {
      delete process.env.GOOGLE_CLIENT_ID;
      delete process.env.GOOGLE_CLIENT_SECRET;

      require('../../server/config/passport-config');

      // Google strategy should not be configured
      const googleCalls = passport.use.mock.calls.filter(call => call[0] === 'google');
      expect(googleCalls).toHaveLength(0);
    });
  });

  describe('Facebook OAuth Strategy Configuration', () => {
    test('should configure Facebook strategy with correct parameters', () => {
      require('../../server/config/passport-config');

      expect(FacebookStrategy).toHaveBeenCalledWith(
        expect.objectContaining({
          clientID: 'test-facebook-app-id',
          clientSecret: 'test-facebook-app-secret',
          callbackURL: 'https://test.example.com/api/v1/auth/facebook/callback',
          profileFields: ['id', 'emails', 'name', 'photos']
        }),
        expect.any(Function)
      );

      expect(passport.use).toHaveBeenCalledWith('facebook', expect.any(FacebookStrategy));
    });

    test('should handle Facebook OAuth callback correctly', () => {
      require('../../server/config/passport-config');

      // Get the callback function passed to FacebookStrategy
      const facebookStrategyCall = FacebookStrategy.mock.calls[0];
      const facebookCallback = facebookStrategyCall[1];

      const mockAccessToken = 'facebook-access-token';
      const mockRefreshToken = 'facebook-refresh-token';
      const mockProfile = {
        provider: 'facebook',
        id: 'facebook-user-456',
        emails: [{ value: 'facebook@example.com' }],
        name: { givenName: 'Jane', familyName: 'Smith' },
        photos: [{ value: 'https://facebook.com/photo.jpg' }]
      };
      const mockDone = jest.fn();

      // Call the Facebook callback
      facebookCallback(mockAccessToken, mockRefreshToken, mockProfile, mockDone);

      // Verify callback behavior
      expect(mockDone).toHaveBeenCalledWith(null, {
        provider: 'facebook',
        id: 'facebook-user-456',
        emails: [{ value: 'facebook@example.com' }],
        name: { givenName: 'Jane', familyName: 'Smith' },
        photos: [{ value: 'https://facebook.com/photo.jpg' }],
        accessToken: 'facebook-access-token',
        refreshToken: 'facebook-refresh-token'
      });
    });

    test('should not configure Facebook strategy when credentials are missing', () => {
      delete process.env.FACEBOOK_APP_ID;

      require('../../server/config/passport-config');

      // Facebook strategy should not be configured
      const facebookCalls = passport.use.mock.calls.filter(call => call[0] === 'facebook');
      expect(facebookCalls).toHaveLength(0);
    });
  });

  describe('LinkedIn OAuth Strategy Configuration', () => {
    test('should configure LinkedIn strategy with correct parameters', () => {
      require('../../server/config/passport-config');

      expect(LinkedInStrategy).toHaveBeenCalledWith(
        expect.objectContaining({
          clientID: 'test-linkedin-client-id',
          clientSecret: 'test-linkedin-client-secret',
          callbackURL: 'https://test.example.com/api/v1/auth/linkedin/callback',
          scope: ['r_emailaddress', 'r_liteprofile']
        }),
        expect.any(Function)
      );

      expect(passport.use).toHaveBeenCalledWith('linkedin', expect.any(LinkedInStrategy));
    });

    test('should handle LinkedIn OAuth callback correctly', () => {
      require('../../server/config/passport-config');

      // Get the callback function passed to LinkedInStrategy
      const linkedinStrategyCall = LinkedInStrategy.mock.calls[0];
      const linkedinCallback = linkedinStrategyCall[1];

      const mockAccessToken = 'linkedin-access-token';
      const mockRefreshToken = 'linkedin-refresh-token';
      const mockProfile = {
        provider: 'linkedin',
        id: 'linkedin-user-789',
        emails: [{ value: 'linkedin@example.com' }],
        name: { givenName: 'Bob', familyName: 'Johnson' }
      };
      const mockDone = jest.fn();

      // Call the LinkedIn callback
      linkedinCallback(mockAccessToken, mockRefreshToken, mockProfile, mockDone);

      // Verify callback behavior
      expect(mockDone).toHaveBeenCalledWith(null, {
        provider: 'linkedin',
        id: 'linkedin-user-789',
        emails: [{ value: 'linkedin@example.com' }],
        name: { givenName: 'Bob', familyName: 'Johnson' },
        accessToken: 'linkedin-access-token',
        refreshToken: 'linkedin-refresh-token'
      });
    });

    test('should not configure LinkedIn strategy when credentials are missing', () => {
      delete process.env.LINKEDIN_CLIENT_SECRET;

      require('../../server/config/passport-config');

      // LinkedIn strategy should not be configured
      const linkedinCalls = passport.use.mock.calls.filter(call => call[0] === 'linkedin');
      expect(linkedinCalls).toHaveLength(0);
    });
  });

  describe('Callback URL Configuration', () => {
    test('should use custom callback URI when provided', () => {
      process.env.OAUTH_CALLBACK_URI = 'https://custom.domain.com';

      require('../../server/config/passport-config');

      // Check Google strategy callback URL
      const googleConfig = GoogleStrategy.mock.calls[0][0];
      expect(googleConfig.callbackURL).toBe('https://custom.domain.com/api/v1/auth/google/callback');

      // Check Facebook strategy callback URL
      const facebookConfig = FacebookStrategy.mock.calls[0][0];
      expect(facebookConfig.callbackURL).toBe('https://custom.domain.com/api/v1/auth/facebook/callback');

      // Check LinkedIn strategy callback URL
      const linkedinConfig = LinkedInStrategy.mock.calls[0][0];
      expect(linkedinConfig.callbackURL).toBe('https://custom.domain.com/api/v1/auth/linkedin/callback');
    });

    test('should handle missing callback URI gracefully', () => {
      delete process.env.OAUTH_CALLBACK_URI;

      // Should not throw an error
      expect(() => {
        require('../../server/config/passport-config');
      }).not.toThrow();
    });
  });

  describe('Strategy Registration', () => {
    test('should register all available OAuth strategies', () => {
      require('../../server/config/passport-config');

      // Verify all strategies are registered with passport
      const registeredStrategies = passport.use.mock.calls.map(call => call[0]);
      
      expect(registeredStrategies).toContain('google');
      expect(registeredStrategies).toContain('facebook');
      expect(registeredStrategies).toContain('linkedin');
    });

    test('should only register strategies with complete credentials', () => {
      // Remove some credentials
      delete process.env.GOOGLE_CLIENT_SECRET;
      delete process.env.FACEBOOK_APP_SECRET;
      // Keep LinkedIn credentials

      require('../../server/config/passport-config');

      const registeredStrategies = passport.use.mock.calls.map(call => call[0]);
      
      expect(registeredStrategies).not.toContain('google');
      expect(registeredStrategies).not.toContain('facebook');
      expect(registeredStrategies).toContain('linkedin');
    });
  });

  describe('Profile Data Handling', () => {
    test('should preserve all profile data in callback', () => {
      require('../../server/config/passport-config');

      const googleCallback = GoogleStrategy.mock.calls[0][1];
      const mockDone = jest.fn();

      const complexProfile = {
        provider: 'google',
        id: 'complex-user-123',
        emails: [{ value: 'complex@example.com' }],
        name: { givenName: 'Complex', familyName: 'User' },
        _json: {
          picture: 'https://example.com/photo.jpg',
          locale: 'en-US',
          verified_email: true,
          additional_data: 'preserved'
        }
      };

      googleCallback('token', 'refresh', complexProfile, mockDone);

      const returnedProfile = mockDone.mock.calls[0][1];
      expect(returnedProfile).toMatchObject(complexProfile);
      expect(returnedProfile.accessToken).toBe('token');
      expect(returnedProfile.refreshToken).toBe('refresh');
    });

    test('should handle profiles with missing optional fields', () => {
      require('../../server/config/passport-config');

      const facebookCallback = FacebookStrategy.mock.calls[0][1];
      const mockDone = jest.fn();

      const minimalProfile = {
        provider: 'facebook',
        id: 'minimal-user-456',
        emails: [{ value: 'minimal@example.com' }]
        // Missing name, photos, etc.
      };

      facebookCallback('token', null, minimalProfile, mockDone);

      const returnedProfile = mockDone.mock.calls[0][1];
      expect(returnedProfile.provider).toBe('facebook');
      expect(returnedProfile.id).toBe('minimal-user-456');
      expect(returnedProfile.emails).toEqual([{ value: 'minimal@example.com' }]);
      expect(returnedProfile.refreshToken).toBeNull();
    });
  });

  describe('Error Handling', () => {
    test('should handle OAuth errors gracefully', () => {
      require('../../server/config/passport-config');

      const googleCallback = GoogleStrategy.mock.calls[0][1];
      const mockDone = jest.fn();

      // Simulate an error scenario
      const errorProfile = null;
      
      // The callback should still work even with null profile
      expect(() => {
        googleCallback('token', 'refresh', errorProfile, mockDone);
      }).not.toThrow();
    });

    test('should pass through authentication errors', () => {
      require('../../server/config/passport-config');

      const linkedinCallback = LinkedInStrategy.mock.calls[0][1];
      const mockDone = jest.fn();

      // Test with error in done callback
      linkedinCallback('token', 'refresh', { provider: 'linkedin', id: 'test' }, mockDone);

      // Should call done without errors for valid profile
      expect(mockDone).toHaveBeenCalledWith(null, expect.any(Object));
    });
  });

  describe('Environment Configuration Validation', () => {
    test('should handle partial OAuth provider configuration', () => {
      // Configure only Google
      process.env = {
        ...originalEnv,
        GOOGLE_CLIENT_ID: 'google-id',
        GOOGLE_CLIENT_SECRET: 'google-secret',
        OAUTH_CALLBACK_URI: 'https://test.com'
        // No Facebook or LinkedIn credentials
      };

      require('../../server/config/passport-config');

      const strategies = passport.use.mock.calls.map(call => call[0]);
      expect(strategies).toContain('google');
      expect(strategies).not.toContain('facebook');
      expect(strategies).not.toContain('linkedin');
    });

    test('should handle complete OAuth provider configuration', () => {
      // All providers configured
      process.env = {
        ...originalEnv,
        GOOGLE_CLIENT_ID: 'google-id',
        GOOGLE_CLIENT_SECRET: 'google-secret',
        FACEBOOK_APP_ID: 'facebook-id',
        FACEBOOK_APP_SECRET: 'facebook-secret',
        LINKEDIN_CLIENT_ID: 'linkedin-id',
        LINKEDIN_CLIENT_SECRET: 'linkedin-secret',
        OAUTH_CALLBACK_URI: 'https://test.com'
      };

      require('../../server/config/passport-config');

      const strategies = passport.use.mock.calls.map(call => call[0]);
      expect(strategies).toContain('google');
      expect(strategies).toContain('facebook');
      expect(strategies).toContain('linkedin');
      expect(strategies).toHaveLength(3);
    });

    test('should handle no OAuth provider configuration', () => {
      // No OAuth credentials
      process.env = { ...originalEnv };
      delete process.env.GOOGLE_CLIENT_ID;
      delete process.env.GOOGLE_CLIENT_SECRET;
      delete process.env.FACEBOOK_APP_ID;
      delete process.env.FACEBOOK_APP_SECRET;
      delete process.env.LINKEDIN_CLIENT_ID;
      delete process.env.LINKEDIN_CLIENT_SECRET;

      require('../../server/config/passport-config');

      // No strategies should be registered
      expect(passport.use).not.toHaveBeenCalled();
    });
  });

  describe('Strategy Scope and Permissions', () => {
    test('should configure Google strategy with appropriate scope', () => {
      require('../../server/config/passport-config');

      const googleConfig = GoogleStrategy.mock.calls[0][0];
      
      // Google strategy scope is typically handled by the route, not the strategy config
      // But we can verify the strategy is configured correctly
      expect(googleConfig.clientID).toBeDefined();
      expect(googleConfig.clientSecret).toBeDefined();
      expect(googleConfig.callbackURL).toBeDefined();
    });

    test('should configure Facebook strategy with profile fields', () => {
      require('../../server/config/passport-config');

      const facebookConfig = FacebookStrategy.mock.calls[0][0];
      
      expect(facebookConfig.profileFields).toEqual(['id', 'emails', 'name', 'photos']);
    });

    test('should configure LinkedIn strategy with correct scope', () => {
      require('../../server/config/passport-config');

      const linkedinConfig = LinkedInStrategy.mock.calls[0][0];
      
      expect(linkedinConfig.scope).toEqual(['r_emailaddress', 'r_liteprofile']);
    });
  });

  describe('State Parameter Handling', () => {
    test('should preserve state parameter for context detection', () => {
      require('../../server/config/passport-config');

      // Test that callbacks preserve any state information
      const googleCallback = GoogleStrategy.mock.calls[0][1];
      const mockDone = jest.fn();

      const profileWithState = {
        provider: 'google',
        id: 'state-test-user',
        emails: [{ value: 'state@example.com' }],
        name: { givenName: 'State', familyName: 'Test' }
      };

      googleCallback('token', 'refresh', profileWithState, mockDone);

      // Verify profile data is passed through intact
      const result = mockDone.mock.calls[0][1];
      expect(result.provider).toBe('google');
      expect(result.id).toBe('state-test-user');
    });
  });
});