// OAuthSession Model Unit Tests for WaveMAX Laundry Affiliate Program

const mongoose = require('mongoose');
const OAuthSession = require('../../server/models/OAuthSession');

describe('OAuthSession Model', () => {
  beforeEach(async () => {
    // Clear the collection before each test
    await OAuthSession.deleteMany({});
  });

  afterAll(async () => {
    // Cleanup after all tests
    await OAuthSession.deleteMany({});
  });

  describe('Schema Validation', () => {
    test('should create a valid OAuth session with all required fields', async () => {
      const sessionData = {
        sessionId: 'test-session-123',
        provider: 'google',
        socialId: 'google-user-123',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        profileData: {
          picture: 'https://example.com/photo.jpg',
          locale: 'en'
        },
        accessToken: 'access-token-123',
        refreshToken: 'refresh-token-123',
        context: 'affiliate'
      };

      const session = new OAuthSession(sessionData);
      const savedSession = await session.save();

      expect(savedSession.sessionId).toBe(sessionData.sessionId);
      expect(savedSession.provider).toBe(sessionData.provider);
      expect(savedSession.socialId).toBe(sessionData.socialId);
      expect(savedSession.email).toBe(sessionData.email);
      expect(savedSession.firstName).toBe(sessionData.firstName);
      expect(savedSession.lastName).toBe(sessionData.lastName);
      expect(savedSession.accessToken).toBe(sessionData.accessToken);
      expect(savedSession.refreshToken).toBe(sessionData.refreshToken);
      expect(savedSession.context).toBe(sessionData.context);
      expect(savedSession.profileData).toEqual(sessionData.profileData);
      expect(savedSession.createdAt).toBeInstanceOf(Date);
    });

    test('should require sessionId field', async () => {
      const session = new OAuthSession({
        provider: 'google',
        socialId: 'google-user-123',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe'
      });

      await expect(session.save()).rejects.toThrow('Path `sessionId` is required');
    });

    test('should require provider field', async () => {
      const session = new OAuthSession({
        sessionId: 'test-session-123',
        socialId: 'google-user-123',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe'
      });

      await expect(session.save()).rejects.toThrow('Path `provider` is required');
    });

    test('should require socialId field', async () => {
      const session = new OAuthSession({
        sessionId: 'test-session-123',
        provider: 'google',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe'
      });

      await expect(session.save()).rejects.toThrow('Path `socialId` is required');
    });

    test('should require email field', async () => {
      const session = new OAuthSession({
        sessionId: 'test-session-123',
        provider: 'google',
        socialId: 'google-user-123',
        firstName: 'John',
        lastName: 'Doe'
      });

      await expect(session.save()).rejects.toThrow('Path `email` is required');
    });

    test('should require firstName field', async () => {
      const session = new OAuthSession({
        sessionId: 'test-session-123',
        provider: 'google',
        socialId: 'google-user-123',
        email: 'test@example.com',
        lastName: 'Doe'
      });

      await expect(session.save()).rejects.toThrow('Path `firstName` is required');
    });

    test('should require lastName field', async () => {
      const session = new OAuthSession({
        sessionId: 'test-session-123',
        provider: 'google',
        socialId: 'google-user-123',
        email: 'test@example.com',
        firstName: 'John'
      });

      await expect(session.save()).rejects.toThrow('Path `lastName` is required');
    });

    test('should validate provider enum values', async () => {
      const session = new OAuthSession({
        sessionId: 'test-session-123',
        provider: 'invalid-provider',
        socialId: 'user-123',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe'
      });

      await expect(session.save()).rejects.toThrow('`invalid-provider` is not a valid enum value for path `provider`');
    });

    test('should validate context enum values', async () => {
      const session = new OAuthSession({
        sessionId: 'test-session-123',
        provider: 'google',
        socialId: 'user-123',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        context: 'invalid-context'
      });

      await expect(session.save()).rejects.toThrow('`invalid-context` is not a valid enum value for path `context`');
    });

    test('should allow valid provider values', async () => {
      const providers = ['google', 'facebook', 'linkedin'];
      
      for (const provider of providers) {
        const session = new OAuthSession({
          sessionId: `test-session-${provider}`,
          provider: provider,
          socialId: `${provider}-user-123`,
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe'
        });

        const savedSession = await session.save();
        expect(savedSession.provider).toBe(provider);
      }
    });

    test('should allow valid context values', async () => {
      const contexts = ['affiliate', 'customer'];
      
      for (const context of contexts) {
        const session = new OAuthSession({
          sessionId: `test-session-${context}`,
          provider: 'google',
          socialId: `google-user-${context}`,
          email: `test-${context}@example.com`,
          firstName: 'John',
          lastName: 'Doe',
          context: context
        });

        const savedSession = await session.save();
        expect(savedSession.context).toBe(context);
      }
    });

    test('should default context to "affiliate"', async () => {
      const session = new OAuthSession({
        sessionId: 'test-session-123',
        provider: 'google',
        socialId: 'google-user-123',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe'
      });

      const savedSession = await session.save();
      expect(savedSession.context).toBe('affiliate');
    });

    test('should enforce unique sessionId', async () => {
      const sessionData = {
        sessionId: 'unique-session-123',
        provider: 'google',
        socialId: 'google-user-123',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe'
      };

      // Create first session
      const session1 = new OAuthSession(sessionData);
      await session1.save();

      // Try to create second session with same sessionId
      const session2 = new OAuthSession({
        ...sessionData,
        socialId: 'different-user-456',
        email: 'different@example.com'
      });

      await expect(session2.save()).rejects.toThrow();
    });
  });

  describe('Static Methods', () => {
    describe('createSession', () => {
      test('should create and save a new OAuth session', async () => {
        const sessionData = {
          sessionId: 'create-test-123',
          provider: 'facebook',
          socialId: 'facebook-user-456',
          email: 'create@example.com',
          firstName: 'Jane',
          lastName: 'Smith',
          accessToken: 'access-123',
          refreshToken: 'refresh-123',
          context: 'customer'
        };

        const createdSession = await OAuthSession.createSession(sessionData);

        expect(createdSession.sessionId).toBe(sessionData.sessionId);
        expect(createdSession.provider).toBe(sessionData.provider);
        expect(createdSession.context).toBe(sessionData.context);
        expect(createdSession._id).toBeDefined();
        expect(createdSession.createdAt).toBeInstanceOf(Date);

        // Verify it was actually saved to database
        const foundSession = await OAuthSession.findOne({ sessionId: sessionData.sessionId });
        expect(foundSession).toBeTruthy();
        expect(foundSession.email).toBe(sessionData.email);
      });

      test('should throw error if required fields are missing', async () => {
        const invalidData = {
          sessionId: 'invalid-test-123',
          provider: 'google'
          // Missing required fields
        };

        await expect(OAuthSession.createSession(invalidData)).rejects.toThrow();
      });
    });

    describe('getSession', () => {
      test('should retrieve existing session by sessionId', async () => {
        // Create a session first
        const sessionData = {
          sessionId: 'get-test-123',
          provider: 'linkedin',
          socialId: 'linkedin-user-789',
          email: 'get@example.com',
          firstName: 'Bob',
          lastName: 'Johnson'
        };

        await OAuthSession.createSession(sessionData);

        // Retrieve the session
        const retrievedSession = await OAuthSession.getSession('get-test-123');

        expect(retrievedSession).toBeTruthy();
        expect(retrievedSession.sessionId).toBe(sessionData.sessionId);
        expect(retrievedSession.provider).toBe(sessionData.provider);
        expect(retrievedSession.email).toBe(sessionData.email);
      });

      test('should return null for non-existent session', async () => {
        const retrievedSession = await OAuthSession.getSession('non-existent-session');
        expect(retrievedSession).toBeNull();
      });
    });

    describe('consumeSession', () => {
      test('should retrieve and delete session in one operation', async () => {
        // Create a session first
        const sessionData = {
          sessionId: 'consume-test-123',
          provider: 'google',
          socialId: 'google-user-consume',
          email: 'consume@example.com',
          firstName: 'Alice',
          lastName: 'Brown'
        };

        await OAuthSession.createSession(sessionData);

        // Consume the session
        const consumedSession = await OAuthSession.consumeSession('consume-test-123');

        expect(consumedSession).toBeTruthy();
        expect(consumedSession.sessionId).toBe(sessionData.sessionId);
        expect(consumedSession.email).toBe(sessionData.email);

        // Verify it was deleted from database
        const shouldBeNull = await OAuthSession.findOne({ sessionId: 'consume-test-123' });
        expect(shouldBeNull).toBeNull();
      });

      test('should return null when consuming non-existent session', async () => {
        const consumedSession = await OAuthSession.consumeSession('non-existent-consume');
        expect(consumedSession).toBeNull();
      });

      test('should handle race conditions safely', async () => {
        // Create a session
        const sessionData = {
          sessionId: 'race-test-123',
          provider: 'facebook',
          socialId: 'facebook-race-user',
          email: 'race@example.com',
          firstName: 'Race',
          lastName: 'Condition'
        };

        await OAuthSession.createSession(sessionData);

        // Try to consume the same session simultaneously
        const [result1, result2] = await Promise.all([
          OAuthSession.consumeSession('race-test-123'),
          OAuthSession.consumeSession('race-test-123')
        ]);

        // One should succeed, one should return null
        const successfulResults = [result1, result2].filter(result => result !== null);
        const nullResults = [result1, result2].filter(result => result === null);

        expect(successfulResults).toHaveLength(1);
        expect(nullResults).toHaveLength(1);
        expect(successfulResults[0].sessionId).toBe('race-test-123');

        // Verify session is completely gone
        const shouldBeNull = await OAuthSession.findOne({ sessionId: 'race-test-123' });
        expect(shouldBeNull).toBeNull();
      });
    });

    describe('cleanupExpired', () => {
      test('should manually delete expired sessions', async () => {
        // Create a session and manually set it to be expired
        const sessionData = {
          sessionId: 'cleanup-test-123',
          provider: 'google',
          socialId: 'google-cleanup-user',
          email: 'cleanup@example.com',
          firstName: 'Cleanup',
          lastName: 'Test'
        };

        const session = await OAuthSession.createSession(sessionData);
        
        // Manually set createdAt to be older than TTL (5 minutes)
        const expiredDate = new Date(Date.now() - (6 * 60 * 1000)); // 6 minutes ago
        await OAuthSession.updateOne(
          { sessionId: 'cleanup-test-123' },
          { createdAt: expiredDate }
        );

        // Create a fresh session that should not be deleted
        const freshSessionData = {
          sessionId: 'fresh-test-123',
          provider: 'facebook',
          socialId: 'facebook-fresh-user',
          email: 'fresh@example.com',
          firstName: 'Fresh',
          lastName: 'Session'
        };

        await OAuthSession.createSession(freshSessionData);

        // Run cleanup
        const deleteResult = await OAuthSession.cleanupExpired();

        // Verify expired session was deleted
        const expiredSession = await OAuthSession.findOne({ sessionId: 'cleanup-test-123' });
        expect(expiredSession).toBeNull();

        // Verify fresh session remains
        const freshSession = await OAuthSession.findOne({ sessionId: 'fresh-test-123' });
        expect(freshSession).toBeTruthy();

        // Check that deleteResult indicates at least one deletion
        expect(deleteResult.deletedCount).toBeGreaterThanOrEqual(1);
      });

      test('should return zero deletions when no expired sessions exist', async () => {
        // Create only fresh sessions
        await OAuthSession.createSession({
          sessionId: 'fresh-only-123',
          provider: 'google',
          socialId: 'google-fresh-only',
          email: 'freshonly@example.com',
          firstName: 'Fresh',
          lastName: 'Only'
        });

        const deleteResult = await OAuthSession.cleanupExpired();
        expect(deleteResult.deletedCount).toBe(0);

        // Verify session still exists
        const session = await OAuthSession.findOne({ sessionId: 'fresh-only-123' });
        expect(session).toBeTruthy();
      });
    });
  });

  describe('TTL Behavior', () => {
    test('should have TTL index configured on createdAt field', async () => {
      const indexes = await OAuthSession.collection.getIndexes();
      
      // Look for TTL index on createdAt
      const ttlIndex = Object.values(indexes).find(index => 
        index.expireAfterSeconds !== undefined
      );

      expect(ttlIndex).toBeDefined();
      expect(ttlIndex.expireAfterSeconds).toBe(300); // 5 minutes
    });

    test('should set createdAt automatically on save', async () => {
      const beforeSave = new Date();
      
      const session = new OAuthSession({
        sessionId: 'ttl-test-123',
        provider: 'google',
        socialId: 'google-ttl-user',
        email: 'ttl@example.com',
        firstName: 'TTL',
        lastName: 'Test'
      });

      const savedSession = await session.save();
      const afterSave = new Date();

      expect(savedSession.createdAt).toBeInstanceOf(Date);
      expect(savedSession.createdAt.getTime()).toBeGreaterThanOrEqual(beforeSave.getTime());
      expect(savedSession.createdAt.getTime()).toBeLessThanOrEqual(afterSave.getTime());
    });
  });

  describe('Data Integrity', () => {
    test('should preserve complex profileData object', async () => {
      const complexProfileData = {
        picture: 'https://example.com/photo.jpg',
        locale: 'en-US',
        verified: true,
        links: {
          website: 'https://example.com',
          linkedin: 'https://linkedin.com/in/user'
        },
        metadata: {
          lastLogin: new Date(),
          preferences: ['privacy', 'marketing']
        }
      };

      const session = new OAuthSession({
        sessionId: 'complex-data-123',
        provider: 'linkedin',
        socialId: 'linkedin-complex-user',
        email: 'complex@example.com',
        firstName: 'Complex',
        lastName: 'Data',
        profileData: complexProfileData
      });

      const savedSession = await session.save();
      expect(savedSession.profileData).toEqual(complexProfileData);

      // Verify after retrieval from database
      const retrievedSession = await OAuthSession.findOne({ sessionId: 'complex-data-123' });
      expect(retrievedSession.profileData).toEqual(complexProfileData);
    });

    test('should handle null and undefined optional fields', async () => {
      const session = new OAuthSession({
        sessionId: 'optional-fields-123',
        provider: 'google',
        socialId: 'google-optional-user',
        email: 'optional@example.com',
        firstName: 'Optional',
        lastName: 'Fields',
        accessToken: null,
        refreshToken: undefined,
        profileData: null
      });

      const savedSession = await session.save();
      expect(savedSession.accessToken).toBeNull();
      expect(savedSession.refreshToken).toBeUndefined();
      expect(savedSession.profileData).toBeNull();
    });
  });
});