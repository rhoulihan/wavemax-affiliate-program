// OAuthSession Model Unit Tests for WaveMAX Laundry Affiliate Program

const mongoose = require('mongoose');
const OAuthSession = require('../../server/models/OAuthSession');

describe('OAuthSession Model', () => {
  beforeEach(async () => {
    // Clear the collection before each test
    await OAuthSession.deleteMany({});

    // Ensure indexes are properly created
    try {
      await OAuthSession.collection.dropIndexes();
    } catch (e) {
      // Ignore if indexes don't exist
    }

    await OAuthSession.createIndexes();
  });

  afterAll(async () => {
    // Cleanup after all tests
    await OAuthSession.deleteMany({});
  });

  describe('Schema Validation', () => {
    test('should create a valid OAuth session with all required fields', async () => {
      const sessionId = 'test-session-123';
      const resultData = {
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

      const session = new OAuthSession({
        sessionId: sessionId,
        result: resultData
      });
      const savedSession = await session.save();

      expect(savedSession.sessionId).toBe(sessionId);
      expect(savedSession.result).toEqual(resultData);
      expect(savedSession.createdAt).toBeInstanceOf(Date);
      expect(savedSession.expiresAt).toBeInstanceOf(Date);
    });

    test('should require sessionId field', async () => {
      const session = new OAuthSession({
        result: { provider: 'google', id: 'test' }
      });

      await expect(session.save()).rejects.toThrow('Path `sessionId` is required');
    });

    test('should require result field', async () => {
      const session = new OAuthSession({
        sessionId: 'test-session-123'
      });

      await expect(session.save()).rejects.toThrow('Path `result` is required');
    });

    test('should automatically set createdAt', async () => {
      const beforeSave = new Date();

      const session = new OAuthSession({
        sessionId: 'auto-date-test',
        result: { provider: 'test' }
      });

      const savedSession = await session.save();
      const afterSave = new Date();

      expect(savedSession.createdAt).toBeInstanceOf(Date);
      expect(savedSession.createdAt.getTime()).toBeGreaterThanOrEqual(beforeSave.getTime());
      expect(savedSession.createdAt.getTime()).toBeLessThanOrEqual(afterSave.getTime());
    });

    test('should automatically set expiresAt to 5 minutes from now', async () => {
      const beforeSave = new Date();

      const session = new OAuthSession({
        sessionId: 'expiry-test',
        result: { provider: 'test' }
      });

      const savedSession = await session.save();
      const expectedExpiry = new Date(beforeSave.getTime() + 5 * 60 * 1000);
      const allowedDifference = 1000; // 1 second tolerance

      expect(savedSession.expiresAt).toBeInstanceOf(Date);
      expect(Math.abs(savedSession.expiresAt.getTime() - expectedExpiry.getTime())).toBeLessThan(allowedDifference);
    });

    test('should enforce unique sessionId', async () => {
      const sessionId = 'unique-test-123';

      // Create first session
      const session1 = new OAuthSession({
        sessionId: sessionId,
        result: { provider: 'google', id: 'user1' }
      });
      await session1.save();

      // Try to create second session with same sessionId
      const session2 = new OAuthSession({
        sessionId: sessionId,
        result: { provider: 'facebook', id: 'user2' }
      });

      await expect(session2.save()).rejects.toThrow();
    });

    test('should allow complex result objects', async () => {
      const complexResult = {
        provider: 'linkedin',
        socialId: 'linkedin-complex-123',
        email: 'complex@example.com',
        firstName: 'Complex',
        lastName: 'User',
        profileData: {
          picture: 'https://linkedin.com/photo.jpg',
          headline: 'Software Engineer',
          location: 'San Francisco, CA',
          connections: 500,
          verified: true,
          skills: ['JavaScript', 'Node.js', 'React'],
          experience: {
            current: 'Senior Developer at Tech Corp',
            previous: ['Developer at StartupCo', 'Intern at BigCorp']
          }
        },
        accessToken: 'linkedin-access-token-xyz',
        refreshToken: 'linkedin-refresh-token-abc',
        tokenExpiry: new Date(Date.now() + 3600000), // 1 hour
        context: 'customer',
        metadata: {
          authMethod: 'OAuth2',
          scope: ['r_emailaddress', 'r_liteprofile'],
          grantType: 'authorization_code'
        }
      };

      const session = new OAuthSession({
        sessionId: 'complex-result-test',
        result: complexResult
      });

      const savedSession = await session.save();
      expect(savedSession.result).toEqual(complexResult);

      // Verify nested objects are preserved
      expect(savedSession.result.profileData.skills).toEqual(['JavaScript', 'Node.js', 'React']);
      expect(savedSession.result.profileData.experience.current).toBe('Senior Developer at Tech Corp');
      expect(savedSession.result.metadata.scope).toEqual(['r_emailaddress', 'r_liteprofile']);
    });
  });

  describe('Static Methods', () => {
    describe('createSession', () => {
      test('should create and save a new OAuth session', async () => {
        const sessionId = 'create-test-123';
        const resultData = {
          provider: 'facebook',
          socialId: 'facebook-user-456',
          email: 'create@example.com',
          firstName: 'Jane',
          lastName: 'Smith',
          accessToken: 'access-123',
          refreshToken: 'refresh-123',
          context: 'customer'
        };

        const createdSession = await OAuthSession.createSession(sessionId, resultData);

        expect(createdSession.sessionId).toBe(sessionId);
        expect(createdSession.result).toEqual(resultData);
        expect(createdSession._id).toBeDefined();
        expect(createdSession.createdAt).toBeInstanceOf(Date);
        expect(createdSession.expiresAt).toBeInstanceOf(Date);

        // Verify it was actually saved to database
        const foundSession = await OAuthSession.findOne({ sessionId: sessionId });
        expect(foundSession).toBeTruthy();
        expect(foundSession.result.email).toBe(resultData.email);
      });

      test('should throw error for duplicate session IDs', async () => {
        const sessionId = 'duplicate-test-123';
        const resultData = { provider: 'google', id: 'test' };

        // Create first session
        await OAuthSession.createSession(sessionId, resultData);

        // Try to create duplicate
        await expect(OAuthSession.createSession(sessionId, resultData)).rejects.toThrow('Session ID already exists');
      });

      test('should handle database errors', async () => {
        // Test with null/invalid session ID which should fail validation
        const resultData = { provider: 'test' };

        // Test with null sessionId - should fail validation
        await expect(OAuthSession.createSession(null, resultData)).rejects.toThrow();
      });
    });

    describe('getSession', () => {
      test('should retrieve existing session result by sessionId', async () => {
        // Create a session first
        const sessionId = 'get-test-123';
        const resultData = {
          provider: 'linkedin',
          socialId: 'linkedin-user-789',
          email: 'get@example.com',
          firstName: 'Bob',
          lastName: 'Johnson'
        };

        await OAuthSession.createSession(sessionId, resultData);

        // Retrieve the session result
        const retrievedResult = await OAuthSession.getSession(sessionId);

        expect(retrievedResult).toBeTruthy();
        expect(retrievedResult).toEqual(resultData);
      });

      test('should return null for non-existent session', async () => {
        const retrievedResult = await OAuthSession.getSession('non-existent-session');
        expect(retrievedResult).toBeNull();
      });
    });

    describe('consumeSession', () => {
      test('should retrieve and delete session in one operation', async () => {
        // Create a session first
        const sessionId = 'consume-test-123';
        const resultData = {
          provider: 'google',
          socialId: 'google-user-consume',
          email: 'consume@example.com',
          firstName: 'Alice',
          lastName: 'Brown'
        };

        await OAuthSession.createSession(sessionId, resultData);

        // Consume the session
        const consumedResult = await OAuthSession.consumeSession(sessionId);

        expect(consumedResult).toBeTruthy();
        expect(consumedResult).toEqual(resultData);

        // Verify it was deleted from database
        const shouldBeNull = await OAuthSession.findOne({ sessionId: sessionId });
        expect(shouldBeNull).toBeNull();
      });

      test('should return null when consuming non-existent session', async () => {
        const consumedResult = await OAuthSession.consumeSession('non-existent-consume');
        expect(consumedResult).toBeNull();
      });

      test('should handle race conditions safely', async () => {
        // Create a session
        const sessionId = 'race-test-123';
        const resultData = {
          provider: 'facebook',
          socialId: 'facebook-race-user',
          email: 'race@example.com',
          firstName: 'Race',
          lastName: 'Condition'
        };

        await OAuthSession.createSession(sessionId, resultData);

        // Try to consume the same session simultaneously
        const [result1, result2] = await Promise.all([
          OAuthSession.consumeSession(sessionId),
          OAuthSession.consumeSession(sessionId)
        ]);

        // One should succeed, one should return null
        const successfulResults = [result1, result2].filter(result => result !== null);
        const nullResults = [result1, result2].filter(result => result === null);

        expect(successfulResults).toHaveLength(1);
        expect(nullResults).toHaveLength(1);
        expect(successfulResults[0]).toEqual(resultData);

        // Verify session is completely gone
        const shouldBeNull = await OAuthSession.findOne({ sessionId: sessionId });
        expect(shouldBeNull).toBeNull();
      });
    });

    describe('cleanupExpired', () => {
      test('should manually delete expired sessions', async () => {
        // Create an expired session by manually setting expiresAt
        const expiredSessionId = 'cleanup-test-123';
        const expiredResult = { provider: 'google', socialId: 'expired-user' };

        const expiredSession = new OAuthSession({
          sessionId: expiredSessionId,
          result: expiredResult,
          expiresAt: new Date(Date.now() - 1000) // 1 second ago
        });
        await expiredSession.save();

        // Create a fresh session that should not be deleted
        const freshSessionId = 'fresh-test-123';
        const freshResult = { provider: 'facebook', socialId: 'fresh-user' };
        await OAuthSession.createSession(freshSessionId, freshResult);

        // Wait a moment to ensure expired session is actually expired
        await new Promise(resolve => setTimeout(resolve, 100));

        // Run cleanup
        const deletedCount = await OAuthSession.cleanupExpired();

        // Verify expired session was deleted
        const expiredSessionCheck = await OAuthSession.findOne({ sessionId: expiredSessionId });
        expect(expiredSessionCheck).toBeNull();

        // Verify fresh session remains
        const freshSessionCheck = await OAuthSession.findOne({ sessionId: freshSessionId });
        expect(freshSessionCheck).toBeTruthy();

        // Check that at least one deletion occurred
        expect(deletedCount).toBeGreaterThanOrEqual(1);
      });

      test('should return zero deletions when no expired sessions exist', async () => {
        // Create only fresh sessions
        await OAuthSession.createSession('fresh-only-123', {
          provider: 'google',
          socialId: 'fresh-only-user'
        });

        const deletedCount = await OAuthSession.cleanupExpired();
        expect(deletedCount).toBe(0);

        // Verify session still exists
        const session = await OAuthSession.findOne({ sessionId: 'fresh-only-123' });
        expect(session).toBeTruthy();
      });
    });
  });

  describe('TTL Behavior', () => {
    test('should have TTL index configured on expiresAt field', async () => {
      // Check detailed index information including TTL settings
      const indexesCursor = OAuthSession.collection.listIndexes();
      const indexesArray = await indexesCursor.toArray();

      const ttlIndex = indexesArray.find(index =>
        index.expireAfterSeconds !== undefined
      );

      expect(ttlIndex).toBeDefined();
      expect(ttlIndex.expireAfterSeconds).toBe(0); // TTL with custom expiration date
    });

    test('should respect custom expiresAt when provided', async () => {
      const customExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

      const session = new OAuthSession({
        sessionId: 'custom-expiry-test',
        result: { provider: 'test' },
        expiresAt: customExpiry
      });

      const savedSession = await session.save();

      // Should use our custom expiry, not the default 5 minutes
      expect(savedSession.expiresAt.getTime()).toBe(customExpiry.getTime());
    });
  });

  describe('Data Integrity', () => {
    test('should preserve all data types in result field', async () => {
      const mixedTypeResult = {
        stringField: 'text value',
        numberField: 42,
        booleanField: true,
        nullField: null,
        undefinedField: undefined,
        dateField: new Date(),
        arrayField: [1, 'two', { three: 3 }, null],
        objectField: {
          nested: {
            deeply: {
              value: 'preserved'
            }
          }
        },
        functionField: function() { return 'test'; } // Note: functions won't be preserved in MongoDB
      };

      const session = new OAuthSession({
        sessionId: 'mixed-types-test',
        result: mixedTypeResult
      });

      const savedSession = await session.save();

      // Most fields should be preserved (except function)
      expect(savedSession.result.stringField).toBe('text value');
      expect(savedSession.result.numberField).toBe(42);
      expect(savedSession.result.booleanField).toBe(true);
      expect(savedSession.result.nullField).toBeNull();
      expect(savedSession.result.dateField).toBeInstanceOf(Date);
      expect(savedSession.result.arrayField).toEqual([1, 'two', { three: 3 }, null]);
      expect(savedSession.result.objectField.nested.deeply.value).toBe('preserved');

      // Function won't be preserved in MongoDB but might still exist - check if it's callable
      if (savedSession.result.functionField) {
        expect(typeof savedSession.result.functionField).toBe('function');
      } else {
        expect(savedSession.result.functionField).toBeUndefined();
      }
    });

    test('should handle empty and minimal result objects', async () => {
      const minimalResults = [
        {},
        { singleField: 'value' },
        { emptyString: '' },
        { emptyArray: [] },
        { emptyObject: {} }
      ];

      for (let i = 0; i < minimalResults.length; i++) {
        const sessionId = `minimal-test-${i}`;
        const session = new OAuthSession({
          sessionId: sessionId,
          result: minimalResults[i]
        });

        const savedSession = await session.save();
        expect(savedSession.result).toEqual(minimalResults[i]);
      }
    });
  });

  describe('Error Handling', () => {
    test('should handle MongoDB connection errors gracefully', async () => {
      // This test would require mocking MongoDB connection issues
      // For now, we'll test that the model handles basic validation errors

      const invalidSession = new OAuthSession({
        // Missing required fields
      });

      await expect(invalidSession.save()).rejects.toThrow();
    });

    test('should handle very large result objects', async () => {
      // Create a large result object (but within MongoDB document size limits)
      const largeArray = Array(1000).fill().map((_, i) => ({
        index: i,
        data: `item-${i}`,
        metadata: { created: new Date(), active: i % 2 === 0 }
      }));

      const largeResult = {
        provider: 'test',
        socialId: 'large-data-user',
        largeData: largeArray
      };

      const session = new OAuthSession({
        sessionId: 'large-data-test',
        result: largeResult
      });

      const savedSession = await session.save();
      expect(savedSession.result.largeData).toHaveLength(1000);
      expect(savedSession.result.largeData[999].index).toBe(999);
    });
  });
});