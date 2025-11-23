const request = require('supertest');
const app = require('../../server');
const { createAgent } = require('../helpers/csrfHelper');

// Set timeout for integration tests
jest.setTimeout(90000);

describe('Social Auth Routes Integration Tests', () => {
  let agent;

  beforeEach(async () => {
    // Create agent with session support
    agent = createAgent(app);
  });

  describe('OAuth Configuration Error Handling', () => {
    it('should return 404 when Google OAuth is not configured', async () => {
      const originalGoogleId = process.env.GOOGLE_CLIENT_ID;
      const originalGoogleSecret = process.env.GOOGLE_CLIENT_SECRET;

      // Temporarily unset Google OAuth credentials
      delete process.env.GOOGLE_CLIENT_ID;
      delete process.env.GOOGLE_CLIENT_SECRET;

      const response = await agent
        .get('/api/auth/google');

      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({
        success: false,
        message: 'Google OAuth is not configured'
      });

      // Restore environment variables
      if (originalGoogleId) process.env.GOOGLE_CLIENT_ID = originalGoogleId;
      if (originalGoogleSecret) process.env.GOOGLE_CLIENT_SECRET = originalGoogleSecret;
    });

    it('should return 404 when Facebook OAuth is not configured', async () => {
      const originalFacebookId = process.env.FACEBOOK_APP_ID;
      const originalFacebookSecret = process.env.FACEBOOK_APP_SECRET;

      // Temporarily unset Facebook OAuth credentials
      delete process.env.FACEBOOK_APP_ID;
      delete process.env.FACEBOOK_APP_SECRET;

      const response = await agent
        .get('/api/auth/facebook');

      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({
        success: false,
        message: 'Facebook OAuth is not configured'
      });

      // Restore environment variables
      if (originalFacebookId) process.env.FACEBOOK_APP_ID = originalFacebookId;
      if (originalFacebookSecret) process.env.FACEBOOK_APP_SECRET = originalFacebookSecret;
    });
  });
});
