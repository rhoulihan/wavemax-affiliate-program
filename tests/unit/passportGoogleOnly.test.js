// Google OAuth Passport Configuration - Isolated Test
// WaveMAX Laundry Affiliate Program

// Mock passport BEFORE any other requires
jest.mock('passport', () => ({
  use: jest.fn(),
  serializeUser: jest.fn(),
  deserializeUser: jest.fn()
}));

// Mock ONLY Google strategy
jest.mock('passport-google-oauth20', () => ({
  Strategy: jest.fn().mockImplementation((config, callback) => {
    return { name: 'google', config, callback };
  })
}));

// Mock models and utilities
jest.mock('../../server/models/Affiliate');
jest.mock('../../server/models/Customer');
jest.mock('../../server/utils/auditLogger');

const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

describe('Google OAuth Passport Configuration - Isolated', () => {
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

    // Set up ONLY Google environment
    process.env.GOOGLE_CLIENT_ID = 'test-google-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'test-google-client-secret';
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
    capturedMockCalls = [...GoogleStrategy.mock.calls];
    capturedPassportCalls = [...passport.use.mock.calls];
  });

  test('should handle Google OAuth callback correctly', () => {
    // Use captured mock calls since Jest clears them
    expect(capturedMockCalls.length).toBeGreaterThan(0);

    // Get the callback function passed to GoogleStrategy
    const googleStrategyCall = capturedMockCalls[0];
    expect(googleStrategyCall).toBeDefined();
    expect(googleStrategyCall.length).toBeGreaterThan(1);

    const googleCallback = googleStrategyCall[1];

    // Verify the callback function exists and is callable
    expect(typeof googleCallback).toBe('function');
    expect(googleCallback.length).toBe(5); // req, accessToken, refreshToken, profile, done
  });

  test('should configure Google strategy with correct parameters', () => {
    // Use captured mock calls
    expect(capturedMockCalls.length).toBeGreaterThan(0);

    const googleConfig = capturedMockCalls[0][0];
    expect(googleConfig).toMatchObject({
      clientID: 'test-google-client-id',
      clientSecret: 'test-google-client-secret',
      callbackURL: 'https://test.example.com/api/v1/auth/google/callback',
      passReqToCallback: true
    });

    expect(capturedPassportCalls.length).toBeGreaterThan(0);
  });

  test('should support state parameter for context detection', () => {
    // Use captured mock calls
    expect(capturedMockCalls.length).toBeGreaterThan(0);

    // Verify Google strategy supports req parameter for state handling
    const googleConfig = capturedMockCalls[0][0];
    expect(googleConfig.passReqToCallback).toBe(true);
  });
});