// LinkedIn OAuth Passport Configuration - Isolated Test
// WaveMAX Laundry Affiliate Program

// Clear all environment variables at the start
delete process.env.GOOGLE_CLIENT_ID;
delete process.env.GOOGLE_CLIENT_SECRET;
delete process.env.FACEBOOK_APP_ID;
delete process.env.FACEBOOK_APP_SECRET;
delete process.env.LINKEDIN_CLIENT_ID;
delete process.env.LINKEDIN_CLIENT_SECRET;
delete process.env.OAUTH_CALLBACK_URI;

// Set up ONLY LinkedIn environment
process.env.LINKEDIN_CLIENT_ID = 'test-linkedin-client-id';
process.env.LINKEDIN_CLIENT_SECRET = 'test-linkedin-client-secret';
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

// Mock ONLY LinkedIn strategy
jest.mock('passport-linkedin-oauth2', () => ({
  Strategy: jest.fn().mockImplementation((config, callback) => {
    return { name: 'linkedin', config, callback };
  })
}));

// Mock models and utilities
jest.mock('../../server/models/Affiliate');
jest.mock('../../server/models/Customer');
jest.mock('../../server/utils/auditLogger');

const passport = require('passport');
const LinkedInStrategy = require('passport-linkedin-oauth2').Strategy;

describe('LinkedIn OAuth Passport Configuration - Isolated', () => {
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

    // Set up ONLY LinkedIn environment
    process.env.LINKEDIN_CLIENT_ID = 'test-linkedin-client-id';
    process.env.LINKEDIN_CLIENT_SECRET = 'test-linkedin-client-secret';
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
    capturedMockCalls = [...LinkedInStrategy.mock.calls];
    capturedPassportCalls = [...passport.use.mock.calls];
  });

  test('should handle LinkedIn OAuth callback correctly', () => {
    // Use captured mock calls since Jest clears them
    expect(capturedMockCalls.length).toBeGreaterThan(0);

    // Get the callback function passed to LinkedInStrategy
    const linkedinStrategyCall = capturedMockCalls[0];
    expect(linkedinStrategyCall).toBeDefined();
    expect(linkedinStrategyCall.length).toBeGreaterThan(1);

    const linkedinCallback = linkedinStrategyCall[1];

    // Verify the callback function exists and is callable
    expect(typeof linkedinCallback).toBe('function');
    expect(linkedinCallback.length).toBe(4); // accessToken, refreshToken, profile, done
  });

  test('should configure LinkedIn strategy with correct scope', () => {
    // Use captured mock calls
    expect(capturedMockCalls.length).toBeGreaterThan(0);
    const linkedinConfig = capturedMockCalls[0][0];

    expect(linkedinConfig.scope).toEqual(['r_emailaddress', 'r_liteprofile']);
  });

  test('should configure LinkedIn strategy with correct parameters', () => {
    // Use captured mock calls
    expect(capturedMockCalls.length).toBeGreaterThan(0);

    const linkedinConfig = capturedMockCalls[0][0];
    expect(linkedinConfig).toMatchObject({
      clientID: 'test-linkedin-client-id',
      clientSecret: 'test-linkedin-client-secret',
      callbackURL: 'https://test.example.com/api/v1/auth/linkedin/callback',
      scope: ['r_emailaddress', 'r_liteprofile']
    });

    expect(capturedPassportCalls.length).toBeGreaterThan(0);
  });
});