const paymentController = require('../../server/controllers/paymentController');
const paygistixConfig = require('../../server/config/paygistix.config');
const PaymentToken = require('../../server/models/PaymentToken');
const callbackPoolManager = require('../../server/services/callbackPoolManager');
const logger = require('../../server/utils/logger');

// Mock dependencies
jest.mock('../../server/config/paygistix.config');
jest.mock('../../server/models/PaymentToken');
jest.mock('../../server/services/callbackPoolManager');
jest.mock('../../server/utils/logger');

describe('Payment Controller', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      body: {},
      params: {},
      query: {},
      ip: '127.0.0.1',
      hostname: 'localhost',
      get: jest.fn().mockReturnValue('test-user-agent'),
      method: 'GET'
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      redirect: jest.fn()
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  describe('getConfig', () => {
    it('should return payment configuration when properly configured', async () => {
      const mockConfig = {
        formUrl: 'https://test.paygistix.com/form',
        formHash: 'test-hash-123',
        merchantId: 'test-merchant'
      };

      paygistixConfig.isConfigured.mockReturnValue(true);
      paygistixConfig.getClientConfig.mockReturnValue(mockConfig);

      await paymentController.getConfig(req, res);

      expect(paygistixConfig.isConfigured).toHaveBeenCalled();
      expect(paygistixConfig.getClientConfig).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('Payment config accessed', {
        ip: '127.0.0.1',
        hostname: 'localhost',
        userAgent: 'test-user-agent',
        hasHash: true
      });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        config: mockConfig
      });
    });

    it('should return error when Paygistix is not configured', async () => {
      const next = jest.fn();
      paygistixConfig.isConfigured.mockReturnValue(false);

      await paymentController.getConfig(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Payment configuration not properly set up'
      });
    });

    it('should handle errors gracefully', async () => {
      paygistixConfig.isConfigured.mockReturnValue(true);
      paygistixConfig.getClientConfig.mockImplementation(() => {
        throw new Error('Config error');
      });

      await paymentController.getConfig(req, res);

      expect(logger.error).toHaveBeenCalledWith('Error getting payment config:', expect.any(Error));
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Failed to load payment configuration'
      });
    });
  });

  describe('logSubmission', () => {
    it('should log payment submission successfully', async () => {
      const next = jest.fn();
      req.body = {
        formId: 'form-123',
        timestamp: '2024-01-01T12:00:00Z',
        status: 'submitted'
      };

      await paymentController.logSubmission(req, res);

      expect(logger.info).toHaveBeenCalledWith('Paygistix payment submission:', {
        formId: 'form-123',
        timestamp: '2024-01-01T12:00:00Z',
        status: 'submitted',
        ip: '127.0.0.1',
        userAgent: 'test-user-agent'
      });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Payment submission logged'
      });
    });

    it('should handle logging errors', async () => {
      const next = jest.fn();
      logger.info.mockImplementation(() => {
        throw new Error('Logging error');
      });

      await paymentController.logSubmission(req, res);

      expect(logger.error).toHaveBeenCalledWith('Error logging payment submission:', expect.any(Error));
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Failed to log submission'
      });
    });
  });

  describe('createPaymentToken', () => {
    beforeEach(() => {
      PaymentToken.generateToken = jest.fn().mockReturnValue('test-token-123');
      PaymentToken.prototype.save = jest.fn();
    });

    it('should create payment token successfully', async () => {
      req.body = {
        customerData: {
          email: 'test@example.com',
          name: 'Test User'
        },
        paymentData: {
          amount: 100.00,
          description: 'Test payment'
        }
      };

      const mockCallbackConfig = {
        callbackPath: '/api/v1/payments/callback/form-1',
        formId: 'form-1'
      };

      callbackPoolManager.acquireCallback.mockResolvedValue(mockCallbackConfig);

      await paymentController.createPaymentToken(req, res);

      expect(PaymentToken.generateToken).toHaveBeenCalled();
      expect(callbackPoolManager.acquireCallback).toHaveBeenCalledWith('test-token-123');
      expect(PaymentToken).toHaveBeenCalledWith({
        token: 'test-token-123',
        customerData: req.body.customerData,
        paymentData: req.body.paymentData,
        callbackPath: '/api/v1/payments/callback/form-1',
        status: 'pending'
      });
      expect(logger.info).toHaveBeenCalledWith('Payment token created with callback assignment:', {
        token: 'test-token-123',
        customerEmail: 'test@example.com',
        callbackPath: '/api/v1/payments/callback/form-1'
      });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        token: 'test-token-123',
        formConfig: mockCallbackConfig,
        message: 'Payment token created successfully'
      });
    });

    it('should handle no available callbacks', async () => {
      req.body = {
        customerData: { email: 'test@example.com' },
        paymentData: { amount: 100.00 }
      };

      callbackPoolManager.acquireCallback.mockResolvedValue(null);

      await paymentController.createPaymentToken(req, res);

      expect(res.status).toHaveBeenCalledWith(503);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'No payment handlers available. Please try again in a moment.'
      });
    });

    it('should handle token creation errors', async () => {
      req.body = {
        customerData: { email: 'test@example.com' },
        paymentData: { amount: 100.00 }
      };

      callbackPoolManager.acquireCallback.mockRejectedValue(new Error('Pool error'));

      await paymentController.createPaymentToken(req, res);

      expect(logger.error).toHaveBeenCalledWith('Error creating payment token:', expect.any(Error));
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Failed to create payment token'
      });
    });
  });

  describe('checkPaymentStatus', () => {
    it('should return payment status successfully', async () => {
      req.params = { token: 'test-token-123' };

      const mockPaymentToken = {
        token: 'test-token-123',
        status: 'success',
        errorMessage: null,
        transactionId: 'txn-123'
      };

      PaymentToken.findOne.mockResolvedValue(mockPaymentToken);

      await paymentController.checkPaymentStatus(req, res);

      expect(PaymentToken.findOne).toHaveBeenCalledWith({ token: 'test-token-123' });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        status: 'success',
        errorMessage: null,
        transactionId: 'txn-123'
      });
    });

    it('should handle token not found', async () => {
      const next = jest.fn();
      req.params = { token: 'nonexistent-token' };
      PaymentToken.findOne.mockResolvedValue(null);

      await paymentController.checkPaymentStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Payment token not found'
      });
    });

    it('should handle database errors', async () => {
      req.params = { token: 'test-token-123' };
      PaymentToken.findOne.mockRejectedValue(new Error('DB error'));

      await paymentController.checkPaymentStatus(req, res);

      expect(logger.error).toHaveBeenCalledWith('Error checking payment status:', expect.any(Error));
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Failed to check payment status'
      });
    });
  });

  describe('cancelPaymentToken', () => {
    it('should cancel pending payment token', async () => {
      req.params = { token: 'test-token-123' };

      const mockPaymentToken = {
        token: 'test-token-123',
        status: 'pending',
        callbackPath: '/api/v1/payments/callback/form-1',
        customerId: 'customer-123',
        assignedFormId: 'form-1',
      save: jest.fn()
      };

      PaymentToken.findOne.mockResolvedValue(mockPaymentToken);

      await paymentController.cancelPaymentToken(req, res);

      expect(mockPaymentToken.status).toBe('cancelled');
      expect(mockPaymentToken.errorMessage).toBe('Payment cancelled by user');
      expect(mockPaymentToken.save).toHaveBeenCalled();
      expect(callbackPoolManager.releaseCallback).toHaveBeenCalledWith('test-token-123');
      expect(logger.info).toHaveBeenCalledWith('Payment token cancelled:', {
        token: 'test-token-123',
        customerId: 'customer-123',
        formReleased: 'form-1'
      });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Payment token cancelled',
        status: 'cancelled'
      });
    });

    it('should not cancel non-pending tokens', async () => {
      req.params = { token: 'test-token-123' };

      const mockPaymentToken = {
        token: 'test-token-123',
        status: 'success',
      save: jest.fn()
      };

      PaymentToken.findOne.mockResolvedValue(mockPaymentToken);

      await paymentController.cancelPaymentToken(req, res);

      expect(mockPaymentToken.save).not.toHaveBeenCalled();
      expect(callbackPoolManager.releaseCallback).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Payment token cancelled',
        status: 'success'
      });
    });

    it('should handle token not found', async () => {
      const next = jest.fn();
      req.params = { token: 'nonexistent-token' };
      PaymentToken.findOne.mockResolvedValue(null);

      await paymentController.cancelPaymentToken(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Payment token not found'
      });
    });
  });

  describe('updatePaymentStatus', () => {
    it('should update payment status to success', async () => {
      req.params = { token: 'test-token-123' };
      req.body = {
        status: 'success',
        result: '0',
        message: 'Payment successful'
      };

      const mockPaymentToken = {
        token: 'test-token-123',
        callbackPath: '/api/v1/payments/callback/form-1',
      save: jest.fn()
      };

      PaymentToken.findOne.mockResolvedValue(mockPaymentToken);

      await paymentController.updatePaymentStatus(req, res);

      expect(mockPaymentToken.status).toBe('success');
      expect(mockPaymentToken.paygistixResponse).toEqual({
        Result: '0',
        testMode: true,
        message: 'Payment successful'
      });
      expect(mockPaymentToken.errorMessage).toBeUndefined();
      expect(mockPaymentToken.save).toHaveBeenCalled();
      expect(callbackPoolManager.releaseCallback).toHaveBeenCalledWith('test-token-123');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Payment status updated',
        status: 'success'
      });
    });

    it('should update payment status to failed', async () => {
      req.params = { token: 'test-token-123' };
      req.body = {
        status: 'failed',
        result: '1',
        message: 'Card declined'
      };

      const mockPaymentToken = {
        token: 'test-token-123',
        callbackPath: '/api/v1/payments/callback/form-1',
      save: jest.fn()
      };

      PaymentToken.findOne.mockResolvedValue(mockPaymentToken);

      await paymentController.updatePaymentStatus(req, res);

      expect(mockPaymentToken.status).toBe('failed');
      expect(mockPaymentToken.errorMessage).toBe('Card declined');
      expect(mockPaymentToken.save).toHaveBeenCalled();
    });
  });

  describe('handleFormCallback', () => {
    it('should process callback successfully', async () => {
      req.query = {
        Result: '0',
        PNRef: 'txn-123',
        token: 'test-token-123'
      };

      const mockPaymentToken = {
        token: 'test-token-123',
        status: 'pending',
        callbackPath: '/api/v1/payments/callback/form-1',
      save: jest.fn()
      };

      PaymentToken.findOne.mockResolvedValue(mockPaymentToken);

      await paymentController.handleFormCallback(req, res, '/api/v1/payments/callback/form-1');

      expect(PaymentToken.findOne).toHaveBeenCalledWith({
        callbackPath: '/api/v1/payments/callback/form-1',
        status: 'pending'
      });
      expect(mockPaymentToken.status).toBe('success');
      expect(mockPaymentToken.transactionId).toBe('txn-123');
      expect(mockPaymentToken.save).toHaveBeenCalled();
      expect(callbackPoolManager.releaseCallback).toHaveBeenCalledWith('test-token-123');
      expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining('/payment-callback-handler.html'));
    });

    it('should handle no pending payment for callback', async () => {
      PaymentToken.findOne.mockResolvedValue(null);

      await paymentController.handleFormCallback(req, res, '/api/v1/payments/callback/form-1');

      expect(logger.error).toHaveBeenCalledWith(
        'No pending payment found for callback path:',
        '/api/v1/payments/callback/form-1'
      );
      expect(res.redirect).toHaveBeenCalledWith('/payment-callback-handler.html?error=no_pending_payment');
    });

    it('should handle callback processing errors', async () => {
      const next = jest.fn();
      PaymentToken.findOne.mockRejectedValue(new Error('DB error'));

      await paymentController.handleFormCallback(req, res, '/api/v1/payments/callback/form-1');

      expect(logger.error).toHaveBeenCalledWith('Error handling form callback:', expect.any(Error));
      expect(res.redirect).toHaveBeenCalledWith('/payment-callback-handler.html?error=processing_failed');
    });
  });

  describe('processCallbackResult', () => {
    it('should process successful payment from query params', async () => {
      req.query = { Result: '0', PNRef: 'txn-123' };
      req.body = {};

      const mockPaymentToken = {
        token: 'test-token-123',
      save: jest.fn()
      };

      await paymentController.processCallbackResult(req, res, mockPaymentToken);

      expect(mockPaymentToken.status).toBe('success');
      expect(mockPaymentToken.transactionId).toBe('txn-123');
      expect(mockPaymentToken.paygistixResponse).toEqual({ Result: '0', PNRef: 'txn-123' });
      expect(mockPaymentToken.save).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('Transaction ID saved:', {
        token: 'test-token-123',
        transactionId: 'txn-123'
      });
    });

    it('should process failed payment', async () => {
      req.query = { Result: '1', error: 'Insufficient funds' };
      req.body = {};

      const mockPaymentToken = {
        token: 'test-token-123',
      save: jest.fn()
      };

      await paymentController.processCallbackResult(req, res, mockPaymentToken);

      expect(mockPaymentToken.status).toBe('failed');
      expect(mockPaymentToken.errorMessage).toBe('Insufficient funds');
    });

    it('should handle body parameters', async () => {
      req.query = {};
      req.body = { Result: '0', transactionId: 'txn-456' };

      const mockPaymentToken = {
        token: 'test-token-123',
      save: jest.fn()
      };

      await paymentController.processCallbackResult(req, res, mockPaymentToken);

      expect(mockPaymentToken.status).toBe('success');
      expect(mockPaymentToken.transactionId).toBe('txn-456');
    });

    it('should redirect with all parameters', async () => {
      req.query = { Result: '0', PNRef: 'txn-789' };
      req.body = {};

      const mockPaymentToken = {
        token: 'test-token-123',
      save: jest.fn()
      };

      await paymentController.processCallbackResult(req, res, mockPaymentToken);

      expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining('token=test-token-123'));
      expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining('status=success'));
      expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining('transactionId=txn-789'));
    });
  });

  describe('getPoolStats', () => {
    it('should return pool statistics', async () => {
      const mockStats = {
        availableCallbacks: 5,
        totalCallbacks: 10,
        activePayments: 5
      };

      callbackPoolManager.getPoolStatus.mockResolvedValue(mockStats);

      await paymentController.getPoolStats(req, res);

      expect(callbackPoolManager.getPoolStatus).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        stats: mockStats
      });
    });

    it('should handle stats retrieval errors', async () => {
      callbackPoolManager.getPoolStatus.mockRejectedValue(new Error('Stats error'));

      await paymentController.getPoolStats(req, res);

      expect(logger.error).toHaveBeenCalledWith('Error getting pool stats:', expect.any(Error));
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Failed to get pool statistics'
      });
    });
  });
});