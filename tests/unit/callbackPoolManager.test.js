// Mock dependencies
jest.mock('../../server/models/CallbackPool');
jest.mock('../../server/utils/logger');

const callbackPoolManager = require('../../server/services/callbackPoolManager');
const CallbackPool = require('../../server/models/CallbackPool');
const logger = require('../../server/utils/logger');

// Test configuration
const testConfig = {
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
};

describe('CallbackPoolManager', () => {
  beforeAll(() => {
    // Set test configuration
    callbackPoolManager.setTestConfig(testConfig);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Clear any existing intervals
    if (callbackPoolManager.cleanupInterval) {
      clearInterval(callbackPoolManager.cleanupInterval);
      callbackPoolManager.cleanupInterval = null;
    }
  });

  afterEach(() => {
    // Clean up intervals after each test
    if (callbackPoolManager.cleanupInterval) {
      clearInterval(callbackPoolManager.cleanupInterval);
      callbackPoolManager.cleanupInterval = null;
    }
  });

  describe('constructor', () => {
    it('should initialize with correct configuration', () => {
      expect(callbackPoolManager.baseUrl).toBe('https://test.example.com');
      expect(callbackPoolManager.lockTimeoutMinutes).toBe(30);
      expect(callbackPoolManager.formId).toBe('test-form-id');
      expect(callbackPoolManager.formHash).toBe('test-form-hash');
      expect(callbackPoolManager.cleanupInterval).toBeNull();
    });
  });

  describe('initializePool', () => {
    it('should create or update callback entries for all paths', async () => {
      CallbackPool.findOneAndUpdate.mockResolvedValue({});

      await callbackPoolManager.initializePool();

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
      const startCleanupJobSpy = jest.spyOn(callbackPoolManager, 'startCleanupJob');

      await callbackPoolManager.initializePool();

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

      const result = await callbackPoolManager.acquireCallback('test-token-123');

      expect(CallbackPool.acquireCallback).toHaveBeenCalledWith('test-token-123', 30);
      expect(result).toEqual({
        formId: 'test-form-id',
        formHash: 'test-form-hash',
        callbackPath: '/api/v1/payments/callback/form-1',
        callbackUrl: 'https://test.example.com/api/v1/payments/callback/form-1',
        formActionUrl: 'https://safepay.paymentlogistics.net/transaction.asp',
        merchantId: 'wmaxaustWEB',
        testModeEnabled: false
      });
      expect(logger.info).toHaveBeenCalledWith(
        'Acquired callback handler for payment token test-token-123:',
        {
          callbackPath: '/api/v1/payments/callback/form-1',
          callbackUrl: 'https://test.example.com/api/v1/payments/callback/form-1'
        }
      );
    });

    it('should return null when no callbacks available', async () => {
      CallbackPool.acquireCallback.mockResolvedValue(null);

      const result = await callbackPoolManager.acquireCallback('test-token-123');
      
      expect(result).toBeNull();
      expect(CallbackPool.acquireCallback).toHaveBeenCalledWith('test-token-123', 30);
      expect(logger.warn).toHaveBeenCalledWith('No callback handlers available. All handlers are currently in use.');
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

      const result = await callbackPoolManager.releaseCallback('test-token-123');

      expect(CallbackPool.releaseCallback).toHaveBeenCalledWith('test-token-123');
      expect(result).toEqual(mockCallback);
      expect(logger.info).toHaveBeenCalledWith(
        'Released callback handler for payment token test-token-123:',
        { callbackPath: '/api/v1/payments/callback/form-1' }
      );
    });

    it('should handle null callback gracefully', async () => {
      CallbackPool.releaseCallback.mockResolvedValue(null);

      const result = await callbackPoolManager.releaseCallback('test-token-123');

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

      const result = await callbackPoolManager.getPoolStatus();

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

      const result = await callbackPoolManager.getPoolStatus();

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
      callbackPoolManager.startCleanupJob();

      expect(callbackPoolManager.cleanupInterval).toBeDefined();
      expect(logger.info).toHaveBeenCalledWith(
        'Callback pool cleanup job started (runs every 5 minutes)'
      );
    });

    it('should run cleanup task every 5 minutes', async () => {
      CallbackPool.releaseExpiredLocks.mockResolvedValue(2);

      callbackPoolManager.startCleanupJob();

      // Fast forward 5 minutes
      jest.advanceTimersByTime(5 * 60 * 1000);

      // Wait for async operations
      await Promise.resolve();

      expect(CallbackPool.releaseExpiredLocks).toHaveBeenCalledWith(30);
      expect(logger.info).toHaveBeenCalledWith('Released 2 expired callback locks');
    });

    it('should handle cleanup errors gracefully', async () => {
      CallbackPool.releaseExpiredLocks.mockRejectedValue(new Error('Cleanup error'));

      callbackPoolManager.startCleanupJob();

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

      callbackPoolManager.startCleanupJob();

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
      callbackPoolManager.startCleanupJob();
      expect(callbackPoolManager.cleanupInterval).toBeDefined();

      // Now stop it
      callbackPoolManager.stopCleanupJob();

      expect(callbackPoolManager.cleanupInterval).toBeNull();
      expect(logger.info).toHaveBeenCalledWith('Callback pool cleanup job stopped');
    });

    it('should handle stopping when no interval exists', () => {
      callbackPoolManager.cleanupInterval = null;

      callbackPoolManager.stopCleanupJob();

      expect(callbackPoolManager.cleanupInterval).toBeNull();
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

      const acquired = await callbackPoolManager.acquireCallback('test-token-123');
      expect(acquired.callbackPath).toBe('/api/v1/payments/callback/form-1');

      // Release callback
      const releasedCallback = {
        ...mockCallback,
        isLocked: false,
        lockedBy: null
      };
      CallbackPool.releaseCallback.mockResolvedValue(releasedCallback);

      const released = await callbackPoolManager.releaseCallback('test-token-123');
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

      const result1 = await callbackPoolManager.acquireCallback('token-1');
      const result2 = await callbackPoolManager.acquireCallback('token-2');
      const result3 = await callbackPoolManager.acquireCallback('token-3');

      expect(result1.callbackPath).toBe('/api/v1/payments/callback/form-1');
      expect(result2.callbackPath).toBe('/api/v1/payments/callback/form-2');
      expect(result3.callbackPath).toBe('/api/v1/payments/callback/form-3');

      const result4 = await callbackPoolManager.acquireCallback('token-4');
      expect(result4).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith('No callback handlers available. All handlers are currently in use.');
    });
  });
});