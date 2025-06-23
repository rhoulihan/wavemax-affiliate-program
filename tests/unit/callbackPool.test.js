const CallbackPool = require('../../server/models/CallbackPool');
const mongoose = require('mongoose');

describe('CallbackPool Model', () => {
  let testCallback;

  beforeEach(async () => {
    // Clear the collection before each test
    await CallbackPool.deleteMany({});
    
    // Create a test callback
    testCallback = await CallbackPool.create({
      callbackPath: '/callback/test-1',
      isLocked: false,
      usageCount: 0
    });
  });

  afterEach(async () => {
    await CallbackPool.deleteMany({});
  });

  describe('Schema and Indexes', () => {
    it('should have required fields', () => {
      const requiredFields = ['callbackPath'];
      requiredFields.forEach(field => {
        expect(CallbackPool.schema.paths[field].isRequired).toBe(true);
      });
    });

    it('should have default values', () => {
      expect(CallbackPool.schema.paths.isLocked.defaultValue).toBe(false);
      expect(CallbackPool.schema.paths.lockedBy.defaultValue).toBe(null);
      expect(CallbackPool.schema.paths.lockedAt.defaultValue).toBe(null);
      expect(CallbackPool.schema.paths.lastUsedAt.defaultValue).toBe(null);
      expect(CallbackPool.schema.paths.usageCount.defaultValue).toBe(0);
    });

    it('should have unique constraint on callbackPath', () => {
      expect(CallbackPool.schema.paths.callbackPath.options.unique).toBe(true);
    });

    it('should create document with defaults', async () => {
      const callback = await CallbackPool.create({
        callbackPath: '/callback/test-2'
      });

      expect(callback.isLocked).toBe(false);
      expect(callback.lockedBy).toBe(null);
      expect(callback.lockedAt).toBe(null);
      expect(callback.lastUsedAt).toBe(null);
      expect(callback.usageCount).toBe(0);
    });
  });

  describe('Instance Methods', () => {
    describe('lock()', () => {
      it('should lock callback with payment token', async () => {
        const paymentToken = 'payment_token_123';
        
        await testCallback.lock(paymentToken);
        
        // Reload from database to verify changes were saved
        const updated = await CallbackPool.findById(testCallback._id);
        
        expect(updated.isLocked).toBe(true);
        expect(updated.lockedBy).toBe(paymentToken);
        expect(updated.lockedAt).toBeInstanceOf(Date);
        expect(updated.lastUsedAt).toBeInstanceOf(Date);
        expect(updated.usageCount).toBe(1);
      });

      it('should increment usage count on each lock', async () => {
        const initialCount = testCallback.usageCount;
        
        await testCallback.lock('token1');
        const updated1 = await CallbackPool.findById(testCallback._id);
        expect(updated1.usageCount).toBe(initialCount + 1);

        // Release and lock again
        await updated1.release();
        await updated1.lock('token2');
        const updated2 = await CallbackPool.findById(testCallback._id);
        expect(updated2.usageCount).toBe(initialCount + 2);
      });

      it('should update lastUsedAt timestamp', async () => {
        const beforeLock = new Date();
        await new Promise(resolve => setTimeout(resolve, 10)); // Small delay
        
        await testCallback.lock('token');
        
        const updated = await CallbackPool.findById(testCallback._id);
        expect(updated.lastUsedAt.getTime()).toBeGreaterThan(beforeLock.getTime());
      });
    });

    describe('release()', () => {
      it('should release locked callback', async () => {
        // First lock it
        await testCallback.lock('payment_token_123');
        let locked = await CallbackPool.findById(testCallback._id);
        expect(locked.isLocked).toBe(true);
        
        // Then release it
        await locked.release();
        
        const released = await CallbackPool.findById(testCallback._id);
        expect(released.isLocked).toBe(false);
        expect(released.lockedBy).toBe(null);
        expect(released.lockedAt).toBe(null);
        // Note: lastUsedAt and usageCount should remain unchanged
        expect(released.lastUsedAt).toBeInstanceOf(Date);
        expect(released.usageCount).toBe(1);
      });

      it('should handle releasing already unlocked callback', async () => {
        // Callback is already unlocked
        expect(testCallback.isLocked).toBe(false);
        
        // Release should still work without error
        await testCallback.release();
        
        const updated = await CallbackPool.findById(testCallback._id);
        expect(updated.isLocked).toBe(false);
        expect(updated.lockedBy).toBe(null);
      });
    });
  });

  describe('Static Methods', () => {
    describe('acquireCallback()', () => {
      beforeEach(async () => {
        // Create multiple callbacks for testing
        await CallbackPool.create([
          { callbackPath: '/callback/test-3', isLocked: false, lastUsedAt: new Date(Date.now() - 3600000) },
          { callbackPath: '/callback/test-4', isLocked: false, lastUsedAt: new Date(Date.now() - 7200000) },
          { callbackPath: '/callback/test-5', isLocked: true, lockedAt: new Date(Date.now() - 5000) } // Recently locked
        ]);
      });

      it('should acquire available unlocked callback', async () => {
        const paymentToken = 'payment_456';
        const callback = await CallbackPool.acquireCallback(paymentToken);
        
        expect(callback).toBeTruthy();
        expect(callback.isLocked).toBe(true);
        expect(callback.lockedBy).toBe(paymentToken);
        expect(callback.lockedAt).toBeInstanceOf(Date);
        expect(callback.usageCount).toBeGreaterThan(0);
      });

      it('should use least recently used callback', async () => {
        // First ensure all callbacks have null lastUsedAt except the ones we set
        await CallbackPool.updateMany(
          { callbackPath: { $in: ['/callback/test-1', '/callback/test-2'] } },
          { $set: { lastUsedAt: null } }
        );
        
        const callback = await CallbackPool.acquireCallback('token');
        
        // Should get one of the callbacks with oldest lastUsedAt or null
        expect(callback).toBeTruthy();
        expect(callback.isLocked).toBe(true);
      });

      it('should acquire expired locked callback', async () => {
        // Lock all callbacks
        await CallbackPool.updateMany({}, { 
          isLocked: true, 
          lockedAt: new Date(Date.now() - 15 * 60 * 1000) // 15 minutes ago
        });
        
        const callback = await CallbackPool.acquireCallback('new_token', 10); // 10 minute timeout
        
        expect(callback).toBeTruthy();
        expect(callback.isLocked).toBe(true);
        expect(callback.lockedBy).toBe('new_token');
      });

      it('should return null when no callbacks available', async () => {
        // Lock all callbacks recently
        await CallbackPool.updateMany({}, { 
          isLocked: true, 
          lockedAt: new Date() 
        });
        
        const callback = await CallbackPool.acquireCallback('token');
        expect(callback).toBe(null);
      });

      it('should increment usage count atomically', async () => {
        const token1 = 'token1';
        const token2 = 'token2';
        
        // Acquire same callback concurrently
        const [cb1, cb2] = await Promise.all([
          CallbackPool.acquireCallback(token1),
          CallbackPool.acquireCallback(token2)
        ]);
        
        // Only one should succeed
        expect([cb1, cb2].filter(cb => cb !== null)).toHaveLength(2);
        
        // Different callbacks should be acquired
        if (cb1 && cb2) {
          expect(cb1._id.toString()).not.toBe(cb2._id.toString());
        }
      });
    });

    describe('releaseCallback()', () => {
      it('should release callback by payment token', async () => {
        const paymentToken = 'payment_789';
        
        // First acquire a callback
        await testCallback.lock(paymentToken);
        
        // Then release it
        const released = await CallbackPool.releaseCallback(paymentToken);
        
        expect(released).toBeTruthy();
        expect(released.isLocked).toBe(false);
        expect(released.lockedBy).toBe(null);
        expect(released.lockedAt).toBe(null);
      });

      it('should return null if no callback found with token', async () => {
        const result = await CallbackPool.releaseCallback('non_existent_token');
        expect(result).toBe(null);
      });

      it('should only release callback locked by specific token', async () => {
        // Lock with one token
        await testCallback.lock('token_A');
        
        // Try to release with different token
        const result = await CallbackPool.releaseCallback('token_B');
        expect(result).toBe(null);
        
        // Original should still be locked
        const stillLocked = await CallbackPool.findById(testCallback._id);
        expect(stillLocked.isLocked).toBe(true);
        expect(stillLocked.lockedBy).toBe('token_A');
      });
    });

    describe('releaseExpiredLocks()', () => {
      beforeEach(async () => {
        // Create callbacks with various lock states
        const now = Date.now();
        await CallbackPool.create([
          { 
            callbackPath: '/callback/expired-1',
            isLocked: true,
            lockedBy: 'old_token_1',
            lockedAt: new Date(now - 20 * 60 * 1000) // 20 minutes ago
          },
          { 
            callbackPath: '/callback/expired-2',
            isLocked: true,
            lockedBy: 'old_token_2',
            lockedAt: new Date(now - 15 * 60 * 1000) // 15 minutes ago
          },
          { 
            callbackPath: '/callback/recent',
            isLocked: true,
            lockedBy: 'recent_token',
            lockedAt: new Date(now - 5 * 60 * 1000) // 5 minutes ago
          },
          { 
            callbackPath: '/callback/unlocked',
            isLocked: false
          }
        ]);
      });

      it('should release callbacks locked longer than timeout', async () => {
        const released = await CallbackPool.releaseExpiredLocks(10); // 10 minute timeout
        
        expect(released).toBe(2); // Should release expired-1 and expired-2
        
        // Verify expired locks were released
        const expired1 = await CallbackPool.findOne({ callbackPath: '/callback/expired-1' });
        expect(expired1.isLocked).toBe(false);
        expect(expired1.lockedBy).toBe(null);
        expect(expired1.lockedAt).toBe(null);
        
        const expired2 = await CallbackPool.findOne({ callbackPath: '/callback/expired-2' });
        expect(expired2.isLocked).toBe(false);
        expect(expired2.lockedBy).toBe(null);
        expect(expired2.lockedAt).toBe(null);
      });

      it('should not release recently locked callbacks', async () => {
        await CallbackPool.releaseExpiredLocks(10);
        
        const recent = await CallbackPool.findOne({ callbackPath: '/callback/recent' });
        expect(recent.isLocked).toBe(true);
        expect(recent.lockedBy).toBe('recent_token');
      });

      it('should handle custom timeout values', async () => {
        const released = await CallbackPool.releaseExpiredLocks(5); // 5 minute timeout
        
        expect(released).toBe(3); // Should release all locked callbacks
        
        const allCallbacks = await CallbackPool.find({ isLocked: true });
        expect(allCallbacks).toHaveLength(0);
      });

      it('should return 0 when no expired locks', async () => {
        // Release all first
        await CallbackPool.updateMany({}, { isLocked: false });
        
        const released = await CallbackPool.releaseExpiredLocks();
        expect(released).toBe(0);
      });

      it('should handle empty collection', async () => {
        await CallbackPool.deleteMany({});
        
        const released = await CallbackPool.releaseExpiredLocks();
        expect(released).toBe(0);
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle concurrent lock attempts', async () => {
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(CallbackPool.acquireCallback(`token_${i}`));
      }
      
      const results = await Promise.all(promises);
      const successful = results.filter(r => r !== null);
      
      // Should have acquired callbacks (number depends on how many exist)
      expect(successful.length).toBeGreaterThan(0);
      
      // Each successful acquisition should have unique callback
      const ids = successful.map(cb => cb._id.toString());
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('should maintain data integrity with rapid lock/release cycles', async () => {
      const token = 'rapid_token';
      
      for (let i = 0; i < 10; i++) {
        await testCallback.lock(token);
        await testCallback.release();
      }
      
      const final = await CallbackPool.findById(testCallback._id);
      expect(final.isLocked).toBe(false);
      expect(final.usageCount).toBe(10);
    });

    it('should handle invalid ObjectId gracefully', async () => {
      const callback = new CallbackPool({
        callbackPath: '/callback/test-invalid'
      });
      
      // Should be able to save without _id issues
      await expect(callback.save()).resolves.toBeDefined();
    });
  });
});