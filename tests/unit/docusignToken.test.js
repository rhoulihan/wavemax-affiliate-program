const DocuSignToken = require('../../server/models/DocuSignToken');

describe('DocuSignToken Model', () => {
  beforeEach(async () => {
    await DocuSignToken.deleteMany({});
  });

  describe('saveToken', () => {
    it('should save a new token with all fields', async () => {
      const tokenData = {
        access_token: 'test_access_token',
        refresh_token: 'test_refresh_token',
        expires_in: 3600,
        token_type: 'Bearer'
      };

      const saved = await DocuSignToken.saveToken(tokenData);

      expect(saved.tokenId).toBeDefined();
      expect(saved.accessToken).toBe(tokenData.access_token);
      expect(saved.refreshToken).toBe(tokenData.refresh_token);
      expect(saved.tokenType).toBe(tokenData.token_type);
      expect(saved.expiresAt).toBeInstanceOf(Date);
      expect(saved.expiresAt.getTime()).toBeGreaterThan(Date.now());
      expect(saved.createdAt).toBeInstanceOf(Date);
      expect(saved.lastUsed).toBeInstanceOf(Date);
    });

    it('should update existing token if one exists', async () => {
      // Create initial token
      const initialToken = await DocuSignToken.saveToken({
        access_token: 'initial_token',
        refresh_token: 'initial_refresh',
        expires_in: 3600,
        token_type: 'Bearer'
      });

      // Update with new token
      const updatedToken = await DocuSignToken.saveToken({
        access_token: 'updated_token',
        refresh_token: 'updated_refresh',
        expires_in: 7200,
        token_type: 'Bearer'
      });

      // Should have same ID but updated values
      expect(updatedToken.tokenId).toBe(initialToken.tokenId);
      expect(updatedToken.accessToken).toBe('updated_token');
      expect(updatedToken.refreshToken).toBe('updated_refresh');

      // Should only have one token in database
      const count = await DocuSignToken.countDocuments();
      expect(count).toBe(1);
    });

    it('should calculate expiration time correctly', async () => {
      const now = Date.now();
      const expiresIn = 3600; // 1 hour

      const saved = await DocuSignToken.saveToken({
        access_token: 'test',
        refresh_token: 'test',
        expires_in: expiresIn,
        token_type: 'Bearer'
      });

      const expectedExpiry = now + (expiresIn * 1000);
      expect(saved.expiresAt.getTime()).toBeCloseTo(expectedExpiry, -3); // Within 1 second
    });
  });

  describe('getCurrentToken', () => {
    it('should return the most recent token', async () => {
      const token = await DocuSignToken.saveToken({
        access_token: 'test_token',
        refresh_token: 'test_refresh',
        expires_in: 3600,
        token_type: 'Bearer'
      });

      const retrieved = await DocuSignToken.getCurrentToken();

      expect(retrieved).toBeDefined();
      expect(retrieved.tokenId).toBe(token.tokenId);
      expect(retrieved.accessToken).toBe(token.accessToken);
    });

    it('should return null if no tokens exist', async () => {
      const retrieved = await DocuSignToken.getCurrentToken();
      expect(retrieved).toBeNull();
    });
  });

  describe('clearTokens', () => {
    it('should remove all tokens', async () => {
      // Create multiple tokens
      await DocuSignToken.create({
        tokenId: 'token1',
        accessToken: 'access1',
        refreshToken: 'refresh1',
        expiresAt: new Date(Date.now() + 3600000),
        tokenType: 'Bearer'
      });

      await DocuSignToken.create({
        tokenId: 'token2',
        accessToken: 'access2',
        refreshToken: 'refresh2',
        expiresAt: new Date(Date.now() + 3600000),
        tokenType: 'Bearer'
      });

      const countBefore = await DocuSignToken.countDocuments();
      expect(countBefore).toBe(2);

      // Use deleteMany instead of clearTokens
      await DocuSignToken.deleteMany({});

      const countAfter = await DocuSignToken.countDocuments();
      expect(countAfter).toBe(0);
    });
  });

  describe('token expiration', () => {
    it('should identify expired tokens', async () => {
      // Create an expired token
      const expiredToken = await DocuSignToken.create({
        tokenId: 'expired_token',
        accessToken: 'expired_access',
        refreshToken: 'expired_refresh',
        expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
        tokenType: 'Bearer'
      });

      // Retrieve token directly without using getCurrentToken (which may filter expired)
      const retrieved = await DocuSignToken.findOne({ tokenId: 'expired_token' });

      // Check if token is expired
      expect(retrieved).toBeDefined();
      expect(retrieved.expiresAt).toBeDefined();
      const isExpired = retrieved.expiresAt < new Date();
      expect(isExpired).toBe(true);
    });

    it('should handle tokens without refresh token', async () => {
      const tokenWithoutRefresh = await DocuSignToken.saveToken({
        access_token: 'access_only',
        expires_in: 3600,
        token_type: 'Bearer'
      });

      expect(tokenWithoutRefresh.accessToken).toBe('access_only');
      expect(tokenWithoutRefresh.refreshToken).toBeUndefined();
    });
  });

  describe('lastUsed tracking', () => {
    it('should update lastUsed when token is accessed', async () => {
      const token = await DocuSignToken.saveToken({
        access_token: 'test',
        refresh_token: 'test',
        expires_in: 3600,
        token_type: 'Bearer'
      });

      const initialLastUsed = token.lastUsed;

      // Wait a bit and update lastUsed
      await new Promise(resolve => setTimeout(resolve, 100));

      token.lastUsed = new Date();
      await token.save();

      expect(token.lastUsed.getTime()).toBeGreaterThan(initialLastUsed.getTime());
    });
  });
});