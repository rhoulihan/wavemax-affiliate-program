const { resetRateLimits } = require('../../server/controllers/administratorController');
const mongoose = require('mongoose');

describe('Administrator Controller - Reset Rate Limits', () => {
  let req, res, mockDb, mockCollection;
  let consoleErrorSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock console.error
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    
    // Mock request and response
    req = {
      body: {},
      user: { id: 'admin123', role: 'administrator' }
    };
    
    res = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis()
    };
    
    // Mock MongoDB collection
    mockCollection = {
      deleteMany: jest.fn()
    };
    
    mockDb = {
      collection: jest.fn().mockReturnValue(mockCollection)
    };
    
    // Mock mongoose connection
    mongoose.connection.db = mockDb;
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('resetRateLimits', () => {
    it('should reset all rate limits when no filters provided', async () => {
      mockCollection.deleteMany.mockResolvedValue({ deletedCount: 10 });

      await resetRateLimits(req, res);

      expect(mockDb.collection).toHaveBeenCalledWith('rate_limits');
      expect(mockCollection.deleteMany).toHaveBeenCalledWith({});
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Reset 10 rate limit entries',
        deletedCount: 10
      });
    });

    it('should reset rate limits with type filter', async () => {
      req.body = { type: 'login' };
      mockCollection.deleteMany.mockResolvedValue({ deletedCount: 5 });

      await resetRateLimits(req, res);

      expect(mockCollection.deleteMany).toHaveBeenCalledWith({
        key: expect.any(RegExp)
      });
      
      const filter = mockCollection.deleteMany.mock.calls[0][0];
      expect(filter.key.source).toBe('^login:');
      expect(filter.key.flags).toBe('');
      
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Reset 5 rate limit entries',
        deletedCount: 5
      });
    });

    it('should reset rate limits with IP filter', async () => {
      req.body = { ip: '192.168.1.100' };
      mockCollection.deleteMany.mockResolvedValue({ deletedCount: 3 });

      await resetRateLimits(req, res);

      expect(mockCollection.deleteMany).toHaveBeenCalledWith({
        key: expect.any(RegExp)
      });
      
      const filter = mockCollection.deleteMany.mock.calls[0][0];
      expect(filter.key.source).toBe('192\\.168\\.1\\.100');
      
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Reset 3 rate limit entries',
        deletedCount: 3
      });
    });

    it('should handle IP filter overwriting type filter', async () => {
      req.body = { type: 'api', ip: '10.0.0.1' };
      mockCollection.deleteMany.mockResolvedValue({ deletedCount: 1 });

      await resetRateLimits(req, res);

      const filter = mockCollection.deleteMany.mock.calls[0][0];
      // IP filter should overwrite type filter
      expect(filter.key.source).toBe('10\\.0\\.0\\.1');
      
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Reset 1 rate limit entries',
        deletedCount: 1
      });
    });

    it('should handle database errors gracefully', async () => {
      mockCollection.deleteMany.mockRejectedValue(new Error('Database connection failed'));

      await resetRateLimits(req, res);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error resetting rate limits:', 
        expect.any(Error)
      );
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Failed to reset rate limits',
        error: 'Database connection failed'
      });
    });

    it('should handle missing database connection', async () => {
      mongoose.connection.db = undefined;

      await resetRateLimits(req, res);

      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Database connection not available'
      });
    });

    it('should handle collection not found error', async () => {
      mockDb.collection.mockImplementation(() => {
        throw new Error('Collection not found');
      });

      await resetRateLimits(req, res);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error resetting rate limits:', 
        expect.objectContaining({ message: 'Collection not found' })
      );
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Failed to reset rate limits',
        error: 'Collection not found'
      });
    });

    it('should report zero deletions correctly', async () => {
      req.body = { type: 'nonexistent' };
      mockCollection.deleteMany.mockResolvedValue({ deletedCount: 0 });

      await resetRateLimits(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Reset 0 rate limit entries',
        deletedCount: 0
      });
    });

    it('should handle special regex characters in IP', async () => {
      req.body = { ip: '10.20.30.40' };
      mockCollection.deleteMany.mockResolvedValue({ deletedCount: 2 });

      await resetRateLimits(req, res);

      const filter = mockCollection.deleteMany.mock.calls[0][0];
      // All dots should be escaped
      expect(filter.key.source).toBe('10\\.20\\.30\\.40');
      // Check that the regex pattern has escaped dots (contains backslash)
      expect(filter.key.source).toContain('\\.');
    });
  });
});