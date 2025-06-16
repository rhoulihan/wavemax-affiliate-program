const CallbackPoolManager = require('../../server/services/callbackPoolManager');
const CallbackPool = require('../../server/models/CallbackPool');
const logger = require('../../server/utils/logger');

// Mock dependencies
jest.mock('../../server/models/CallbackPool');
jest.mock('../../server/utils/logger');
jest.mock('../../server/config/paygistix-forms.json', () => ({
  baseUrl: 'https://test.example.com',
  lockTimeoutMinutes: 30,
  form: {
    formId: 'test-form-id',
    formHash: 'test-form-hash'
  },
  callbackPaths: [
    '/api/v1/payments/callback/form-1',
    '/api/v1/payments/callback/form-2',
    '/api/v1/payments/callback/form-3'
  ]
}), { virtual: true });

describe('CallbackPoolManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Clear any existing intervals
    if (CallbackPoolManager.cleanupInterval) {
      clearInterval(CallbackPoolManager.cleanupInterval);
      CallbackPoolManager.cleanupInterval = null;
    }
  });

  afterEach(() => {
    // Clean up intervals after each test
    if (CallbackPoolManager.cleanupInterval) {
      clearInterval(CallbackPoolManager.cleanupInterval);
      CallbackPoolManager.cleanupInterval = null;
    }
  });

  describe('constructor', () => {
    it('should initialize with correct configuration', () => {
      expect(CallbackPoolManager.baseUrl).toBe('https://test.example.com');
      expect(CallbackPoolManager.lockTimeoutMinutes).toBe(30);
      expect(CallbackPoolManager.formId).toBe('test-form-id');
      expect(CallbackPoolManager.formHash).toBe('test-form-hash');
      expect(CallbackPoolManager.cleanupInterval).toBeNull();
    });
  });

  describe('initializePool', () => {
    it('should create or update callback entries for all paths', async () => {
      CallbackPool.findOneAndUpdate.mockResolvedValue({});

      await CallbackPoolManager.initializePool();

      expect(CallbackPool.findOneAndUpdate).toHaveBeenCalledTimes(3);
      
      // Check first callback path
      expect(CallbackPool.findOneAndUpdate).toHaveBeenCalledWith(
        { callbackPath: '/api/v1/payments/callback/form-1' },
        {
          $setOnInsert: {
            callbackPath: '/api/v1/payments/callback/form-1',
            isLocked: false,
            lockedBy: null,
            lockedAt: null,
            lastUsedAt: null,
            usageCount: 0
          }
        },
        { upsert: true, new: true }
      );

      // Check second callback path
      expect(CallbackPool.findOneAndUpdate).toHaveBeenCalledWith(
        { callbackPath: '/api/v1/payments/callback/form-2' },
        {
          $setOnInsert: {
            callbackPath: '/api/v1/payments/callback/form-2',
            isLocked: false,
            lockedBy: null,
            lockedAt: null,
            lastUsedAt: null,
            usageCount: 0
          }
        },
        { upsert: true, new: true }
      );

      expect(logger.info).toHaveBeenCalledWith('Initializing callback pool...');
      expect(logger.info).toHaveBeenCalledWith('Initialized 3 callback handlers');
    });

    it('should start cleanup job after initialization', async () => {
      CallbackPool.findOneAndUpdate.mockResolvedValue({});
      const startCleanupJobSpy = jest.spyOn(CallbackPoolManager, 'startCleanupJob');

      await CallbackPoolManager.initializePool();

      expect(startCleanupJobSpy).toHaveBeenCalled();
    });
  });

  describe('acquireCallback', () => {
    it('should acquire callback successfully', async () => {
      const mockCallback = {
        callbackPath: '/api/v1/payments/callback/form-1',
        isLocked: true,
        lockedBy: 'test-token-123'
      };

      CallbackPool.acquireCallback.mockResolvedValue(mockCallback);

      const result = await CallbackPoolManager.acquireCallback('test-token-123');

      expect(CallbackPool.acquireCallback).toHaveBeenCalledWith('test-token-123', 30);
      expect(result).toEqual({
        formId: 'test-form-id',
        formHash: 'test-form-hash',
        callbackPath: '/api/v1/payments/callback/form-1',
        callbackUrl: 'https://test.example.com/api/v1/payments/callback/form-1'
      });
      expect(logger.info).toHaveBeenCalledWith(
        'Acquired callback handler for payment token test-token-123:',
        {
          callbackPath: '/api/v1/payments/callback/form-1',
          callbackUrl: 'https://test.example.com/api/v1/payments/callback/form-1'
        }
      );
    });

    it('should throw error when no callbacks available', async () => {
      CallbackPool.acquireCallback.mockResolvedValue(null);

      await expect(CallbackPoolManager.acquireCallback('test-token-123'))
        .rejects.toThrow('No callback handlers available. All handlers are currently in use.');

      expect(CallbackPool.acquireCallback).toHaveBeenCalledWith('test-token-123', 30);
    });
  });

  describe('releaseCallback', () => {
    it('should release callback successfully', async () => {
      const mockCallback = {
        callbackPath: '/api/v1/payments/callback/form-1',
        isLocked: false,
        lockedBy: null
      };

      CallbackPool.releaseCallback.mockResolvedValue(mockCallback);

      const result = await CallbackPoolManager.releaseCallback('test-token-123');

      expect(CallbackPool.releaseCallback).toHaveBeenCalledWith('test-token-123');
      expect(result).toEqual(mockCallback);
      expect(logger.info).toHaveBeenCalledWith(
        'Released callback handler for payment token test-token-123:',
        { callbackPath: '/api/v1/payments/callback/form-1' }
      );
    });

    it('should handle null callback gracefully', async () => {
      CallbackPool.releaseCallback.mockResolvedValue(null);

      const result = await CallbackPoolManager.releaseCallback('test-token-123');

      expect(CallbackPool.releaseCallback).toHaveBeenCalledWith('test-token-123');
      expect(result).toBeNull();
      expect(logger.info).not.toHaveBeenCalledWith(
        expect.stringContaining('Released callback handler')
      );
    });
  });

  describe('getPoolStatus', () => {
    it('should return pool status with all handler details', async () => {
      const mockCallbacks = [
        {
          callbackPath: '/api/v1/payments/callback/form-1',
          isLocked: false,
          lockedBy: null,
          lockedAt: null,
          usageCount: 5,
          lastUsedAt: new Date('2024-01-01')
        },
        {
          callbackPath: '/api/v1/payments/callback/form-2',
          isLocked: true,
          lockedBy: 'token-456',
          lockedAt: new Date('2024-01-02'),
          usageCount: 3,
          lastUsedAt: new Date('2024-01-02')
        },
        {
          callbackPath: '/api/v1/payments/callback/form-3',
          isLocked: false,
          lockedBy: null,
          lockedAt: null,
          usageCount: 0,
          lastUsedAt: null
        }
      ];

      CallbackPool.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue(mockCallbacks)
      });

      const result = await CallbackPoolManager.getPoolStatus();

      expect(CallbackPool.find).toHaveBeenCalledWith({});
      expect(result).toEqual({
        total: 3,
        available: 2,
        locked: 1,
        handlers: [
          {
            path: '/api/v1/payments/callback/form-1',
            isLocked: false,
            lockedBy: null,
            lockedAt: null,
            usageCount: 5,
            lastUsedAt: new Date('2024-01-01')
          },
          {
            path: '/api/v1/payments/callback/form-2',
            isLocked: true,
            lockedBy: 'token-456',
            lockedAt: new Date('2024-01-02'),
            usageCount: 3,
            lastUsedAt: new Date('2024-01-02')
          },
          {
            path: '/api/v1/payments/callback/form-3',
            isLocked: false,
            lockedBy: null,
            lockedAt: null,
            usageCount: 0,
            lastUsedAt: null
          }
        ]
      });
    });

    it('should handle empty pool', async () => {
      CallbackPool.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue([])
      });

      const result = await CallbackPoolManager.getPoolStatus();

      expect(result).toEqual({
        total: 0,
        available: 0,
        locked: 0,
        handlers: []
      });
    });
  });

  describe('startCleanupJob', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should start cleanup interval', () => {
      CallbackPoolManager.startCleanupJob();

      expect(CallbackPoolManager.cleanupInterval).toBeDefined();
      expect(logger.info).toHaveBeenCalledWith(
        'Callback pool cleanup job started (runs every 5 minutes)'
      );
    });

    it('should run cleanup task every 5 minutes', async () => {
      CallbackPool.releaseExpiredLocks.mockResolvedValue(2);

      CallbackPoolManager.startCleanupJob();

      // Fast forward 5 minutes
      jest.advanceTimersByTime(5 * 60 * 1000);

      // Wait for async operations
      await Promise.resolve();

      expect(CallbackPool.releaseExpiredLocks).toHaveBeenCalledWith(30);
      expect(logger.info).toHaveBeenCalledWith('Released 2 expired callback locks');
    });

    it('should handle cleanup errors gracefully', async () => {
      CallbackPool.releaseExpiredLocks.mockRejectedValue(new Error('Cleanup error'));

      CallbackPoolManager.startCleanupJob();

      // Fast forward 5 minutes
      jest.advanceTimersByTime(5 * 60 * 1000);

      // Wait for async operations
      await Promise.resolve();

      expect(logger.error).toHaveBeenCalledWith(
        'Error in callback pool cleanup job:',
        expect.any(Error)
      );
    });

    it('should not log when no locks are released', async () => {
      CallbackPool.releaseExpiredLocks.mockResolvedValue(0);

      CallbackPoolManager.startCleanupJob();

      // Fast forward 5 minutes
      jest.advanceTimersByTime(5 * 60 * 1000);

      // Wait for async operations
      await Promise.resolve();

      expect(CallbackPool.releaseExpiredLocks).toHaveBeenCalledWith(30);
      expect(logger.info).not.toHaveBeenCalledWith(
        expect.stringContaining('Released')
      );
    });
  });

  describe('stopCleanupJob', () => {
    it('should stop cleanup interval when running', () => {
      // Start the job first
      CallbackPoolManager.startCleanupJob();
      expect(CallbackPoolManager.cleanupInterval).toBeDefined();

      // Now stop it
      CallbackPoolManager.stopCleanupJob();

      expect(CallbackPoolManager.cleanupInterval).toBeNull();
      expect(logger.info).toHaveBeenCalledWith('Callback pool cleanup job stopped');
    });

    it('should handle stopping when no interval exists', () => {
      CallbackPoolManager.cleanupInterval = null;

      CallbackPoolManager.stopCleanupJob();

      expect(CallbackPoolManager.cleanupInterval).toBeNull();
      expect(logger.info).not.toHaveBeenCalledWith(
        'Callback pool cleanup job stopped'
      );
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete payment flow', async () => {
      // Acquire callback
      const mockCallback = {
        callbackPath: '/api/v1/payments/callback/form-1',
        isLocked: true,
        lockedBy: 'test-token-123'
      };
      CallbackPool.acquireCallback.mockResolvedValue(mockCallback);

      const acquired = await CallbackPoolManager.acquireCallback('test-token-123');
      expect(acquired.callbackPath).toBe('/api/v1/payments/callback/form-1');

      // Release callback
      const releasedCallback = {
        ...mockCallback,
        isLocked: false,
        lockedBy: null
      };
      CallbackPool.releaseCallback.mockResolvedValue(releasedCallback);

      const released = await CallbackPoolManager.releaseCallback('test-token-123');
      expect(released.isLocked).toBe(false);
    });

    it('should handle concurrent acquire attempts', async () => {
      // First acquire succeeds
      CallbackPool.acquireCallback
        .mockResolvedValueOnce({
          callbackPath: '/api/v1/payments/callback/form-1',
          isLocked: true
        })
        .mockResolvedValueOnce({
          callbackPath: '/api/v1/payments/callback/form-2',
          isLocked: true
        })
        .mockResolvedValueOnce({
          callbackPath: '/api/v1/payments/callback/form-3',
          isLocked: true
        })
        .mockResolvedValueOnce(null); // Fourth attempt fails

      const result1 = await CallbackPoolManager.acquireCallback('token-1');
      const result2 = await CallbackPoolManager.acquireCallback('token-2');
      const result3 = await CallbackPoolManager.acquireCallback('token-3');

      expect(result1.callbackPath).toBe('/api/v1/payments/callback/form-1');
      expect(result2.callbackPath).toBe('/api/v1/payments/callback/form-2');
      expect(result3.callbackPath).toBe('/api/v1/payments/callback/form-3');

      await expect(CallbackPoolManager.acquireCallback('token-4'))
        .rejects.toThrow('No callback handlers available');
    });
  });
});