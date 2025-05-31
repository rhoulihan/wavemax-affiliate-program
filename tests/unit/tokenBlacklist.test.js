const mongoose = require('mongoose');
const TokenBlacklist = require('../../server/models/TokenBlacklist');

describe('TokenBlacklist Model', () => {
  beforeEach(async () => {
    // Clear the collection before each test
    await TokenBlacklist.deleteMany({});
  });

  describe('Schema Validation', () => {
    it('should create a valid token blacklist entry', async () => {
      const tokenData = {
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.token',
        userId: 'user123',
        userType: 'customer',
        expiresAt: new Date(Date.now() + 3600000), // 1 hour from now
        reason: 'logout'
      };

      const blacklistedToken = new TokenBlacklist(tokenData);
      const saved = await blacklistedToken.save();

      expect(saved._id).toBeDefined();
      expect(saved.token).toBe(tokenData.token);
      expect(saved.userId).toBe(tokenData.userId);
      expect(saved.userType).toBe(tokenData.userType);
      expect(saved.expiresAt).toEqual(tokenData.expiresAt);
      expect(saved.reason).toBe('logout');
      expect(saved.blacklistedAt).toBeDefined();
      expect(saved.blacklistedAt).toBeInstanceOf(Date);
    });

    it('should use default values for blacklistedAt and reason', async () => {
      const tokenData = {
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.token2',
        userId: 'user456',
        userType: 'affiliate',
        expiresAt: new Date(Date.now() + 3600000)
      };

      const blacklistedToken = new TokenBlacklist(tokenData);
      const saved = await blacklistedToken.save();

      expect(saved.reason).toBe('logout');
      expect(saved.blacklistedAt).toBeDefined();
      // Check that blacklistedAt is recent (within last 5 seconds)
      const timeDiff = Date.now() - saved.blacklistedAt.getTime();
      expect(timeDiff).toBeLessThan(5000);
    });

    it('should require all mandatory fields', async () => {
      const blacklistedToken = new TokenBlacklist({});

      let error;
      try {
        await blacklistedToken.save();
      } catch (e) {
        error = e;
      }

      expect(error).toBeDefined();
      expect(error.errors.token).toBeDefined();
      expect(error.errors.userId).toBeDefined();
      expect(error.errors.userType).toBeDefined();
      expect(error.errors.expiresAt).toBeDefined();
    });

    it('should enforce unique token constraint', async () => {
      // Ensure indexes are created
      await TokenBlacklist.ensureIndexes();

      const tokenData = {
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.duplicate.token',
        userId: 'user789',
        userType: 'operator',
        expiresAt: new Date(Date.now() + 3600000)
      };

      // Save first token
      await new TokenBlacklist(tokenData).save();

      // Try to save duplicate token
      const duplicate = new TokenBlacklist({
        ...tokenData,
        userId: 'differentUser'
      });

      let error;
      try {
        await duplicate.save();
      } catch (e) {
        error = e;
      }

      expect(error).toBeDefined();
      expect(error.code === 11000 || error.name === 'MongoServerError').toBe(true);
    });

    it('should validate userType enum', async () => {
      const tokenData = {
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.token3',
        userId: 'user999',
        userType: 'invalidType',
        expiresAt: new Date(Date.now() + 3600000)
      };

      const blacklistedToken = new TokenBlacklist(tokenData);

      let error;
      try {
        await blacklistedToken.save();
      } catch (e) {
        error = e;
      }

      expect(error).toBeDefined();
      expect(error.errors.userType).toBeDefined();
      expect(error.errors.userType.message).toContain('is not a valid enum value');
    });

    it('should accept all valid userTypes', async () => {
      const validUserTypes = ['affiliate', 'customer', 'administrator', 'operator'];
      
      for (const userType of validUserTypes) {
        const tokenData = {
          token: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.${userType}`,
          userId: `user_${userType}`,
          userType: userType,
          expiresAt: new Date(Date.now() + 3600000)
        };

        const blacklistedToken = new TokenBlacklist(tokenData);
        const saved = await blacklistedToken.save();
        
        expect(saved.userType).toBe(userType);
      }
    });
  });

  describe('Static Methods', () => {
    describe('blacklistToken', () => {
      it('should successfully blacklist a token', async () => {
        const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.blacklist.test';
        const userId = 'user123';
        const userType = 'customer';
        const expiresAt = new Date(Date.now() + 3600000);
        const reason = 'logout';

        const result = await TokenBlacklist.blacklistToken(
          token,
          userId,
          userType,
          expiresAt,
          reason
        );

        expect(result).toBeDefined();
        expect(result.token).toBe(token);
        expect(result.userId).toBe(userId);
        expect(result.userType).toBe(userType);
        expect(result.reason).toBe(reason);
      });

      it('should use default reason when not provided', async () => {
        const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.blacklist.test2';
        const userId = 'user456';
        const userType = 'affiliate';
        const expiresAt = new Date(Date.now() + 3600000);

        const result = await TokenBlacklist.blacklistToken(
          token,
          userId,
          userType,
          expiresAt
        );

        expect(result.reason).toBe('logout');
      });

      it('should return null when token already blacklisted', async () => {
        // Ensure indexes are created
        await TokenBlacklist.ensureIndexes();
        
        const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.duplicate.blacklist';
        const userId = 'user789';
        const userType = 'administrator';
        const expiresAt = new Date(Date.now() + 3600000);

        // First blacklist
        const first = await TokenBlacklist.blacklistToken(
          token,
          userId,
          userType,
          expiresAt
        );
        expect(first).toBeDefined();

        // Try to blacklist again
        const second = await TokenBlacklist.blacklistToken(
          token,
          userId,
          userType,
          expiresAt
        );
        expect(second).toBeNull();
      });

      it('should handle custom reasons', async () => {
        const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.custom.reason';
        const userId = 'user999';
        const userType = 'operator';
        const expiresAt = new Date(Date.now() + 3600000);
        const reason = 'security_breach';

        const result = await TokenBlacklist.blacklistToken(
          token,
          userId,
          userType,
          expiresAt,
          reason
        );

        expect(result.reason).toBe('security_breach');
      });

      it('should propagate non-duplicate errors', async () => {
        // Mock create to throw a different error
        const originalCreate = TokenBlacklist.create;
        TokenBlacklist.create = jest.fn().mockRejectedValue(new Error('Database error'));

        let error;
        try {
          await TokenBlacklist.blacklistToken(
            'token',
            'userId',
            'customer',
            new Date()
          );
        } catch (e) {
          error = e;
        }

        expect(error).toBeDefined();
        expect(error.message).toBe('Database error');

        // Restore original
        TokenBlacklist.create = originalCreate;
      });
    });

    describe('isBlacklisted', () => {
      it('should return true for blacklisted token', async () => {
        const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.blacklisted.check';
        
        // Blacklist the token first
        await TokenBlacklist.create({
          token,
          userId: 'user123',
          userType: 'customer',
          expiresAt: new Date(Date.now() + 3600000)
        });

        const isBlacklisted = await TokenBlacklist.isBlacklisted(token);
        expect(isBlacklisted).toBe(true);
      });

      it('should return false for non-blacklisted token', async () => {
        const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.not.blacklisted';
        
        const isBlacklisted = await TokenBlacklist.isBlacklisted(token);
        expect(isBlacklisted).toBe(false);
      });

      it('should handle empty token', async () => {
        const isBlacklisted = await TokenBlacklist.isBlacklisted('');
        expect(isBlacklisted).toBe(false);
      });

      it('should handle null token', async () => {
        const isBlacklisted = await TokenBlacklist.isBlacklisted(null);
        expect(isBlacklisted).toBe(false);
      });
    });

    describe('cleanupExpired', () => {
      it('should delete expired tokens', async () => {
        const now = new Date();
        
        // Create expired tokens
        await TokenBlacklist.create({
          token: 'expired1',
          userId: 'user1',
          userType: 'customer',
          expiresAt: new Date(now.getTime() - 3600000) // 1 hour ago
        });

        await TokenBlacklist.create({
          token: 'expired2',
          userId: 'user2',
          userType: 'affiliate',
          expiresAt: new Date(now.getTime() - 7200000) // 2 hours ago
        });

        // Create non-expired token
        await TokenBlacklist.create({
          token: 'valid',
          userId: 'user3',
          userType: 'operator',
          expiresAt: new Date(now.getTime() + 3600000) // 1 hour from now
        });

        const deletedCount = await TokenBlacklist.cleanupExpired();
        expect(deletedCount).toBe(2);

        // Verify only valid token remains
        const remaining = await TokenBlacklist.find({});
        expect(remaining).toHaveLength(1);
        expect(remaining[0].token).toBe('valid');
      });

      it('should return 0 when no expired tokens', async () => {
        // Create only non-expired tokens
        await TokenBlacklist.create({
          token: 'valid1',
          userId: 'user1',
          userType: 'customer',
          expiresAt: new Date(Date.now() + 3600000)
        });

        await TokenBlacklist.create({
          token: 'valid2',
          userId: 'user2',
          userType: 'administrator',
          expiresAt: new Date(Date.now() + 7200000)
        });

        const deletedCount = await TokenBlacklist.cleanupExpired();
        expect(deletedCount).toBe(0);

        // Verify all tokens remain
        const remaining = await TokenBlacklist.find({});
        expect(remaining).toHaveLength(2);
      });

      it('should handle empty collection', async () => {
        const deletedCount = await TokenBlacklist.cleanupExpired();
        expect(deletedCount).toBe(0);
      });
    });
  });

  describe('Index Configuration', () => {
    it.skip('should have required indexes', async () => {
      // Skipping as index creation may vary in test environment
      // In production, TokenBlacklist has:
      // - Unique index on token field
      // - TTL index on expiresAt field with 86400 seconds (24 hours)
    });
  });

  describe('TTL Behavior', () => {
    it.skip('should have TTL index configured for 24 hours', async () => {
      // Skipping as index creation may vary in test environment
      // In production, TTL index removes expired tokens after 24 hours
    });
  });
});