// Facebook OAuth Passport Configuration - Isolated Test
// WaveMAX Laundry Affiliate Program

// Clear all environment variables at the start
delete process.env.GOOGLE_CLIENT_ID;
delete process.env.GOOGLE_CLIENT_SECRET;
delete process.env.FACEBOOK_APP_ID;
delete process.env.FACEBOOK_APP_SECRET;
delete process.env.LINKEDIN_CLIENT_ID;
delete process.env.LINKEDIN_CLIENT_SECRET;
delete process.env.OAUTH_CALLBACK_URI;

// Set up ONLY Facebook environment
process.env.FACEBOOK_APP_ID = 'test-facebook-app-id';
process.env.FACEBOOK_APP_SECRET = 'test-facebook-app-secret';
process.env.OAUTH_CALLBACK_URI = 'https://test.example.com';

// Clear require cache completely
Object.keys(require.cache).forEach(key => {
  if (key.includes('passport-config') ||
      key.includes('passport-google-oauth20') ||
      key.includes('passport-facebook') ||
      key.includes('passport-linkedin-oauth2') ||
      key.includes('server/models') ||
      key.includes('auditLogger')) {
    delete require.cache[key];
  }
});

// Mock passport BEFORE any other requires
jest.mock('passport', () => ({
  use: jest.fn(),
  serializeUser: jest.fn(),
  deserializeUser: jest.fn()
}));

// Mock ONLY Facebook strategy
jest.mock('passport-facebook', () => ({
  Strategy: jest.fn().mockImplementation((config, callback) => {
    return { name: 'facebook', config, callback };
  })
}));

// Mock models and utilities
jest.mock('../../server/models/Affiliate');
jest.mock('../../server/models/Customer');
jest.mock('../../server/utils/auditLogger');

const passport = require('passport');
const FacebookStrategy = require('passport-facebook').Strategy;

describe('Facebook OAuth Passport Configuration - Isolated', () => {
  let capturedMockCalls = [];
  let capturedPassportCalls = [];

  beforeAll(() => {
    // Clear all environment variables
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.FACEBOOK_APP_ID;
    delete process.env.FACEBOOK_APP_SECRET;
    delete process.env.LINKEDIN_CLIENT_ID;
    delete process.env.LINKEDIN_CLIENT_SECRET;
    delete process.env.OAUTH_CALLBACK_URI;

    // Set up ONLY Facebook environment
    process.env.FACEBOOK_APP_ID = 'test-facebook-app-id';
    process.env.FACEBOOK_APP_SECRET = 'test-facebook-app-secret';
    process.env.OAUTH_CALLBACK_URI = 'https://test.example.com';

    // Clear require cache completely
    Object.keys(require.cache).forEach(key => {
      if (key.includes('passport-config') ||
          key.includes('server/models') ||
          key.includes('auditLogger')) {
        delete require.cache[key];
      }
    });

    // Require passport config after all mocks are set up
    require('../../server/config/passport-config');

    // Capture mock calls before Jest clears them
    capturedMockCalls = [...FacebookStrategy.mock.calls];
    capturedPassportCalls = [...passport.use.mock.calls];
  });

  test('should handle Facebook OAuth callback correctly', () => {
    // Use captured mock calls since Jest clears them
    expect(capturedMockCalls.length).toBeGreaterThan(0);

    // Get the callback function passed to FacebookStrategy
    const facebookStrategyCall = capturedMockCalls[0];
    expect(facebookStrategyCall).toBeDefined();
    expect(facebookStrategyCall.length).toBeGreaterThan(1);

    const facebookCallback = facebookStrategyCall[1];

    // Verify the callback function exists and is callable
    expect(typeof facebookCallback).toBe('function');
    expect(facebookCallback.length).toBe(4); // accessToken, refreshToken, profile, done
  });

  test('should configure Facebook strategy with profile fields', () => {
    // Use captured mock calls
    expect(capturedMockCalls.length).toBeGreaterThan(0);
    const facebookConfig = capturedMockCalls[0][0];

    expect(facebookConfig.profileFields).toEqual(['id', 'emails', 'name', 'picture.type(large)']);
  });

  test('should configure Facebook strategy with correct parameters', () => {
    // Use captured mock calls
    expect(capturedMockCalls.length).toBeGreaterThan(0);

    const facebookConfig = capturedMockCalls[0][0];
    expect(facebookConfig).toMatchObject({
      clientID: 'test-facebook-app-id',
      clientSecret: 'test-facebook-app-secret',
      callbackURL: 'https://test.example.com/api/v1/auth/facebook/callback',
      profileFields: ['id', 'emails', 'name', 'picture.type(large)']
    });

    expect(capturedPassportCalls.length).toBeGreaterThan(0);
  });
});