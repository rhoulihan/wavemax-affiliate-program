const { 
  handleDeletionCallback, 
  checkDeletionStatus,
  processStaleRequests 
} = require('../../server/controllers/facebookDataController');
const DataDeletionRequest = require('../../server/models/DataDeletionRequest');
const { 
  parseSignedRequest, 
  generateStatusUrl, 
  deleteFacebookData,
  findUsersByFacebookId,
  anonymizeUserData
} = require('../../server/utils/facebookUtils');
const logger = require('../../server/utils/logger');

// Mock dependencies
jest.mock('../../server/models/DataDeletionRequest');
jest.mock('../../server/utils/facebookUtils');
jest.mock('../../server/utils/logger');
jest.mock('../../server/controllers/administratorController', () => ({
  logUserAction: jest.fn()
}));

describe('Facebook Data Controller', () => {
  let req, res;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default request and response objects
    req = {
      body: {},
      params: {},
      ip: '127.0.0.1',
      protocol: 'https',
      get: jest.fn((header) => {
        if (header === 'user-agent') return 'test-agent';
        if (header === 'host') return 'test.com';
      })
    };
    
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    
    // Default mock implementations
    DataDeletionRequest.generateConfirmationCode = jest.fn().mockReturnValue('test-code-123');
    generateStatusUrl.mockReturnValue('https://test.com/status/test-code-123');
    logger.info = jest.fn();
    logger.error = jest.fn();
  });
  
  describe('handleDeletionCallback', () => {
    it('should handle missing signed_request', async () => {
      await handleDeletionCallback(req, res);
      
      expect(logger.error).toHaveBeenCalledWith('Facebook deletion callback: missing signed_request');
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ 
        error: 'Missing signed_request parameter' 
      });
    });
    
    it('should handle missing app secret', async () => {
      req.body.signed_request = 'test-signed-request';
      delete process.env.FACEBOOK_APP_SECRET;
      
      await handleDeletionCallback(req, res);
      
      expect(logger.error).toHaveBeenCalledWith('Facebook app secret not configured');
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ 
        error: 'Server configuration error' 
      });
    });
    
    it('should handle invalid signed request', async () => {
      req.body.signed_request = 'invalid-signed-request';
      process.env.FACEBOOK_APP_SECRET = 'test-secret';
      parseSignedRequest.mockReturnValue(null);
      
      await handleDeletionCallback(req, res);
      
      expect(logger.error).toHaveBeenCalledWith('Invalid signed request received');
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ 
        error: 'Invalid signed request' 
      });
    });
    
    it('should handle missing user_id in payload', async () => {
      req.body.signed_request = 'test-signed-request';
      process.env.FACEBOOK_APP_SECRET = 'test-secret';
      parseSignedRequest.mockReturnValue({ algorithm: 'HMAC-SHA256' });
      
      await handleDeletionCallback(req, res);
      
      expect(logger.error).toHaveBeenCalledWith('No user_id in signed request payload');
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ 
        error: 'Invalid request payload' 
      });
    });
    
    it('should handle case when no users are found', async () => {
      req.body.signed_request = 'test-signed-request';
      process.env.FACEBOOK_APP_SECRET = 'test-secret';
      parseSignedRequest.mockReturnValue({ 
        user_id: 'fb-123',
        algorithm: 'HMAC-SHA256',
        issued_at: 1234567890
      });
      findUsersByFacebookId.mockResolvedValue({ affiliate: null, customer: null });
      
      const mockDeletionRequest = {
        save: jest.fn(),
        markAsProcessing: jest.fn(),
        markAsCompleted: jest.fn(),
        markAsFailed: jest.fn()
      };
      DataDeletionRequest.mockImplementation(() => mockDeletionRequest);
      
      await handleDeletionCallback(req, res);
      
      expect(mockDeletionRequest.save).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        url: 'https://test.com/status/test-code-123',
        confirmation_code: 'test-code-123'
      });
    });
    
    it('should handle customer-only deletion request', async () => {
      req.body.signed_request = 'test-signed-request';
      process.env.FACEBOOK_APP_SECRET = 'test-secret';
      process.env.BASE_URL = 'https://example.com';
      
      parseSignedRequest.mockReturnValue({ 
        user_id: 'fb-123',
        algorithm: 'HMAC-SHA256',
        issued_at: 1234567890
      });
      
      const mockCustomer = { _id: 'customer-id' , save: jest.fn().mockResolvedValue(true)};
      findUsersByFacebookId.mockResolvedValue({ affiliate: null, customer: mockCustomer });
      
      const mockDeletionRequest = {
        _id: 'deletion-request-id',
        facebookUserId: 'fb-123',
      save: jest.fn(),
        markAsProcessing: jest.fn(),
        markAsCompleted: jest.fn()
      };
      DataDeletionRequest.mockImplementation(() => mockDeletionRequest);
      
      // Mock successful deletion
      deleteFacebookData.mockResolvedValue(['facebookId', 'facebookEmail']);
      
      await handleDeletionCallback(req, res);
      
      expect(mockDeletionRequest.save).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        url: 'https://test.com/status/test-code-123',
        confirmation_code: 'test-code-123'
      });
    });
    
    it('should handle errors during deletion callback', async () => {
      req.body.signed_request = 'test-signed-request';
      process.env.FACEBOOK_APP_SECRET = 'test-secret';
      
      parseSignedRequest.mockImplementation(() => {
        throw new Error('Test error');
      });
      
      await handleDeletionCallback(req, res);
      
      expect(logger.error).toHaveBeenCalledWith(
        'Error handling Facebook deletion callback:', 
        expect.any(Error)
      );
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ 
        error: 'Internal server error' 
      });
    });
    
    it('should handle affiliate and customer (both) deletion', async () => {
      req.body.signed_request = 'test-signed-request';
      process.env.FACEBOOK_APP_SECRET = 'test-secret';
      
      parseSignedRequest.mockReturnValue({ 
        user_id: 'fb-123',
        algorithm: 'HMAC-SHA256',
        issued_at: 1234567890
      });
      
      const mockAffiliate = { _id: 'affiliate-id' , save: jest.fn().mockResolvedValue(true)};
      const mockCustomer = { _id: 'customer-id' , save: jest.fn().mockResolvedValue(true)};
      findUsersByFacebookId.mockResolvedValue({ 
        affiliate: mockAffiliate, 
        customer: mockCustomer 
      });
      
      const mockDeletionRequest = {
        _id: 'deletion-request-id',
        facebookUserId: 'fb-123',
      save: jest.fn(),
        markAsProcessing: jest.fn(),
        markAsCompleted: jest.fn()
      };
      DataDeletionRequest.mockImplementation(() => mockDeletionRequest);
      
      deleteFacebookData.mockResolvedValue(['facebookId', 'facebookEmail']);
      
      await handleDeletionCallback(req, res);
      
      expect(mockDeletionRequest.save).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        url: 'https://test.com/status/test-code-123',
        confirmation_code: 'test-code-123'
      });
    });
  });
  
  describe('checkDeletionStatus', () => {
    it('should handle missing confirmation code', async () => {
      await checkDeletionStatus(req, res);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Missing confirmation code'
      });
    });
    
    it('should handle deletion request not found', async () => {
      req.params.code = 'non-existent-code';
      DataDeletionRequest.findByConfirmationCode = jest.fn().mockResolvedValue(null);
      
      await checkDeletionStatus(req, res);
      
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Deletion request not found'
      });
    });
    
    it('should return completed deletion request status', async () => {
      req.params.code = 'test-code';
      const mockRequest = {
        confirmationCode: 'test-code',
        status: 'completed',
        formattedStatus: 'Completed',
        requestedAt: new Date('2023-01-01'),
        completedAt: new Date('2023-01-02'),
        ageInHours: 24,
        deletionDetails: {
          dataDeleted: ['facebookId'],
          completedActions: ['Deleted Facebook data'],
          errors: []
        }
      };
      DataDeletionRequest.findByConfirmationCode = jest.fn().mockResolvedValue(mockRequest);
      
      await checkDeletionStatus(req, res);
      
      expect(res.json).toHaveBeenCalledWith({
        confirmationCode: 'test-code',
        status: 'completed',
        formattedStatus: 'Completed',
        requestedAt: mockRequest.requestedAt,
        completedAt: mockRequest.completedAt,
        ageInHours: 24,
        deletionDetails: {
          dataDeleted: ['facebookId'],
          completedActions: ['Deleted Facebook data']
        },
        errors: null
      });
    });
    
    it('should handle errors during status check', async () => {
      req.params.code = 'test-code';
      DataDeletionRequest.findByConfirmationCode = jest.fn().mockRejectedValue(new Error('DB error'));
      
      await checkDeletionStatus(req, res);
      
      expect(logger.error).toHaveBeenCalledWith('Error checking deletion status:', expect.any(Error));
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Internal server error'
      });
    });
  });
  
  describe('processStaleRequests', () => {
    it('should process stale deletion requests', async () => {
      const mockRequests = [
        { 
          _id: 'request-1',
          facebookUserId: 'fb-1',
          markAsProcessing: jest.fn(),
          markAsCompleted: jest.fn()
        },
        { 
          _id: 'request-2',
          facebookUserId: 'fb-2',
          markAsProcessing: jest.fn(),
          markAsCompleted: jest.fn()
        }
      ];
      
      DataDeletionRequest.findStaleRequests = jest.fn().mockResolvedValue(mockRequests);
      findUsersByFacebookId.mockResolvedValue({ affiliate: null, customer: null });
      
      await processStaleRequests();
      
      expect(DataDeletionRequest.findStaleRequests).toHaveBeenCalledWith(24);
      expect(logger.info).toHaveBeenCalledWith('Found 2 stale deletion requests');
      expect(mockRequests[0].markAsProcessing).toHaveBeenCalled();
      expect(mockRequests[1].markAsProcessing).toHaveBeenCalled();
    });
    
    it('should handle errors during stale request processing', async () => {
      DataDeletionRequest.findStaleRequests = jest.fn().mockRejectedValue(new Error('DB error'));
      
      await processStaleRequests();
      
      expect(logger.error).toHaveBeenCalledWith(
        'Error processing stale deletion requests:', 
        expect.any(Error)
      );
    });
    
    it('should handle empty stale requests', async () => {
      DataDeletionRequest.findStaleRequests = jest.fn().mockResolvedValue([]);
      
      await processStaleRequests();
      
      expect(logger.info).toHaveBeenCalledWith('Found 0 stale deletion requests');
    });
  });
  
  describe('processDeletion error handling', () => {
    it('should handle errors during affiliate data deletion', async () => {
      req.body.signed_request = 'test-signed-request';
      process.env.FACEBOOK_APP_SECRET = 'test-secret';
      
      parseSignedRequest.mockReturnValue({ 
        user_id: 'fb-123',
        algorithm: 'HMAC-SHA256',
        issued_at: 1234567890
      });
      
      const mockAffiliate = { _id: 'affiliate-id' , save: jest.fn().mockResolvedValue(true)};
      findUsersByFacebookId.mockResolvedValue({ affiliate: mockAffiliate, customer: null });
      
      const mockDeletionRequest = {
        _id: 'deletion-request-id',
        facebookUserId: 'fb-123',
      save: jest.fn(),
        markAsProcessing: jest.fn(),
        markAsFailed: jest.fn()
      };
      DataDeletionRequest.mockImplementation(() => mockDeletionRequest);
      
      // Mock deletion error
      deleteFacebookData.mockRejectedValue(new Error('Deletion failed'));
      
      await handleDeletionCallback(req, res);
      
      expect(logger.error).toHaveBeenCalledWith(
        'Error deleting affiliate Facebook data:', 
        expect.any(Error)
      );
      expect(mockDeletionRequest.markAsFailed).toHaveBeenCalled();
    });
    
    it('should handle errors during customer data deletion', async () => {
      req.body.signed_request = 'test-signed-request';
      process.env.FACEBOOK_APP_SECRET = 'test-secret';
      
      parseSignedRequest.mockReturnValue({ 
        user_id: 'fb-123',
        algorithm: 'HMAC-SHA256',
        issued_at: 1234567890
      });
      
      const mockCustomer = { _id: 'customer-id' , save: jest.fn().mockResolvedValue(true)};
      findUsersByFacebookId.mockResolvedValue({ affiliate: null, customer: mockCustomer });
      
      const mockDeletionRequest = {
        _id: 'deletion-request-id',
        facebookUserId: 'fb-123',
      save: jest.fn(),
        markAsProcessing: jest.fn(),
        markAsFailed: jest.fn()
      };
      DataDeletionRequest.mockImplementation(() => mockDeletionRequest);
      
      // Mock deletion error
      deleteFacebookData.mockRejectedValue(new Error('Customer deletion failed'));
      
      await handleDeletionCallback(req, res);
      
      expect(logger.error).toHaveBeenCalledWith(
        'Error deleting customer Facebook data:', 
        expect.any(Error)
      );
      expect(mockDeletionRequest.markAsFailed).toHaveBeenCalled();
    });
    
    it('should handle general errors during deletion processing', async () => {
      const mockRequest = {
        _id: 'request-1',
        facebookUserId: 'fb-1',
        markAsProcessing: jest.fn().mockRejectedValue(new Error('Processing error')),
        markAsFailed: jest.fn()
      };
      
      DataDeletionRequest.findStaleRequests = jest.fn().mockResolvedValue([mockRequest]);
      
      await processStaleRequests();
      
      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(logger.error).toHaveBeenCalledWith(
        'Error processing deletion request:', 
        expect.any(Error)
      );
      expect(mockRequest.markAsFailed).toHaveBeenCalled();
    });
  });
});