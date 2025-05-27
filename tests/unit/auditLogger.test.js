const winston = require('winston');
const {
  AuditEvents,
  logAuditEvent,
  auditMiddleware,
  logLoginAttempt,
  logSensitiveDataAccess,
  logPaymentActivity,
  logSuspiciousActivity
} = require('../../server/utils/auditLogger');

// Mock winston
jest.mock('winston', () => {
  const mockFormat = {
    combine: jest.fn().mockReturnValue('combined-format'),
    timestamp: jest.fn().mockReturnValue('timestamp-format'),
    json: jest.fn().mockReturnValue('json-format'),
    simple: jest.fn().mockReturnValue('simple-format')
  };

  const mockTransports = {
    File: jest.fn().mockImplementation((options) => ({
      type: 'file',
      ...options
    })),
    Console: jest.fn().mockImplementation((options) => ({
      type: 'console',
      ...options
    }))
  };

  const mockLogger = {
    add: jest.fn(),
    log: jest.fn(),
    info: jest.fn(),
    error: jest.fn()
  };

  return {
    format: mockFormat,
    transports: mockTransports,
    createLogger: jest.fn().mockReturnValue(mockLogger),
    mockLogger
  };
});

describe('Audit Logger', () => {
  let originalEnv;
  let mockDate;

  beforeEach(() => {
    originalEnv = { ...process.env };
    jest.clearAllMocks();

    // Mock Date
    mockDate = new Date('2024-01-15T10:30:00.000Z');
    jest.spyOn(global, 'Date').mockImplementation(() => mockDate);
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  describe('AuditEvents', () => {
    it('should define all audit event types', () => {
      expect(AuditEvents.LOGIN_SUCCESS).toBe('LOGIN_SUCCESS');
      expect(AuditEvents.LOGIN_FAILED).toBe('LOGIN_FAILED');
      expect(AuditEvents.UNAUTHORIZED_ACCESS).toBe('UNAUTHORIZED_ACCESS');
      expect(AuditEvents.SENSITIVE_DATA_ACCESS).toBe('SENSITIVE_DATA_ACCESS');
      expect(AuditEvents.PAYMENT_INFO_ACCESS).toBe('PAYMENT_INFO_ACCESS');
      expect(AuditEvents.ACCOUNT_CREATED).toBe('ACCOUNT_CREATED');
      expect(AuditEvents.SUSPICIOUS_ACTIVITY).toBe('SUSPICIOUS_ACTIVITY');
      expect(AuditEvents.ORDER_CREATED).toBe('ORDER_CREATED');
      expect(AuditEvents.COMMISSION_CALCULATED).toBe('COMMISSION_CALCULATED');
    });

    it('should have unique event names', () => {
      const eventValues = Object.values(AuditEvents);
      const uniqueValues = [...new Set(eventValues)];
      expect(eventValues.length).toBe(uniqueValues.length);
    });
  });

  describe('logAuditEvent', () => {
    it('should log basic audit event', () => {
      logAuditEvent(AuditEvents.LOGIN_SUCCESS, {
        username: 'testuser',
        userType: 'affiliate'
      });

      expect(winston.mockLogger.log).toHaveBeenCalledWith('info', {
        eventType: 'LOGIN_SUCCESS',
        timestamp: '2024-01-15T10:30:00.000Z',
        username: 'testuser',
        userType: 'affiliate'
      });
    });

    it('should add request context when provided', () => {
      const req = {
        ip: '192.168.1.1',
        method: 'POST',
        path: '/api/login',
        get: jest.fn().mockReturnValue('Mozilla/5.0'),
        user: {
          id: 'user123',
          role: 'affiliate',
          username: 'johndoe',
          affiliateId: 'AFF123'
        }
      };

      logAuditEvent(AuditEvents.LOGIN_SUCCESS, { success: true }, req);

      expect(winston.mockLogger.log).toHaveBeenCalledWith('info', expect.objectContaining({
        eventType: 'LOGIN_SUCCESS',
        success: true,
        ip: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        method: 'POST',
        path: '/api/login',
        userId: 'user123',
        userRole: 'affiliate',
        username: 'johndoe',
        affiliateId: 'AFF123'
      }));
    });

    it('should handle customer context', () => {
      const req = {
        ip: '192.168.1.2',
        user: {
          _id: 'customer456',
          role: 'customer',
          email: 'customer@example.com',
          customerId: 'CUST456'
        },
        get: jest.fn().mockReturnValue('Mozilla/5.0')
      };

      logAuditEvent(AuditEvents.ORDER_CREATED, { orderId: 'ORD123' }, req);

      expect(winston.mockLogger.log).toHaveBeenCalledWith('info', expect.objectContaining({
        userId: 'customer456',
        userRole: 'customer',
        username: 'customer@example.com',
        customerId: 'CUST456'
      }));
    });

    it('should use error level for critical events', () => {
      const criticalEvents = [
        AuditEvents.UNAUTHORIZED_ACCESS,
        AuditEvents.PERMISSION_DENIED,
        AuditEvents.SUSPICIOUS_ACTIVITY,
        AuditEvents.SQL_INJECTION_ATTEMPT,
        AuditEvents.XSS_ATTEMPT,
        AuditEvents.INVALID_CSRF_TOKEN
      ];

      criticalEvents.forEach(eventType => {
        logAuditEvent(eventType, { details: 'test' });

        const lastCall = winston.mockLogger.log.mock.calls[winston.mockLogger.log.mock.calls.length - 1];
        expect(lastCall[0]).toBe('error');
      });
    });

    it('should use info level for non-critical events', () => {
      logAuditEvent(AuditEvents.LOGIN_SUCCESS, { username: 'test' });

      expect(winston.mockLogger.log).toHaveBeenCalledWith('info', expect.any(Object));
    });

    it('should handle missing user context', () => {
      const req = {
        ip: '192.168.1.3',
        method: 'GET',
        path: '/public',
        get: jest.fn().mockReturnValue('Mozilla/5.0')
      };

      logAuditEvent(AuditEvents.LOGIN_FAILED, { reason: 'Invalid credentials' }, req);

      const logCall = winston.mockLogger.log.mock.calls[0][1];
      expect(logCall.userId).toBeUndefined();
      expect(logCall.userRole).toBeUndefined();
      expect(logCall.username).toBeUndefined();
    });

    it('should handle connection.remoteAddress fallback', () => {
      const req = {
        connection: { remoteAddress: '10.0.0.1' },
        method: 'POST',
        path: '/api/test',
        get: jest.fn().mockReturnValue('Mozilla/5.0')
      };

      logAuditEvent(AuditEvents.LOGIN_SUCCESS, {}, req);

      expect(winston.mockLogger.log).toHaveBeenCalledWith('info', expect.objectContaining({
        ip: '10.0.0.1'
      }));
    });
  });

  describe('auditMiddleware', () => {
    let req, res, next;

    beforeEach(() => {
      req = {
        ip: '192.168.1.1',
        method: 'POST',
        path: '/api/test',
        get: jest.fn().mockReturnValue('Test User Agent')
      };
      res = {
        statusCode: 200,
        on: jest.fn()
      };
      next = jest.fn();
    });

    it('should create middleware that logs on response finish', () => {
      const middleware = auditMiddleware(AuditEvents.ACCOUNT_CREATED);

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.on).toHaveBeenCalledWith('finish', expect.any(Function));
    });

    it('should log successful responses', () => {
      const middleware = auditMiddleware(AuditEvents.ACCOUNT_CREATED);

      middleware(req, res, next);

      // Simulate response finish
      res.statusCode = 201;
      const finishHandler = res.on.mock.calls[0][1];
      finishHandler();

      expect(winston.mockLogger.log).toHaveBeenCalledWith('info', expect.objectContaining({
        eventType: 'ACCOUNT_CREATED',
        statusCode: 201,
        success: true
      }));
    });

    it('should not log failed responses', () => {
      const middleware = auditMiddleware(AuditEvents.ACCOUNT_CREATED);

      middleware(req, res, next);

      // Simulate error response
      res.statusCode = 400;
      const finishHandler = res.on.mock.calls[0][1];
      finishHandler();

      expect(winston.mockLogger.log).not.toHaveBeenCalled();
    });

    it('should include request context in logs', () => {
      req.user = {
        id: 'user123',
        role: 'admin'
      };

      const middleware = auditMiddleware(AuditEvents.ACCOUNT_UPDATED);

      middleware(req, res, next);

      res.statusCode = 200;
      const finishHandler = res.on.mock.calls[0][1];
      finishHandler();

      expect(winston.mockLogger.log).toHaveBeenCalledWith('info', expect.objectContaining({
        ip: '192.168.1.1',
        method: 'POST',
        path: '/api/test',
        userId: 'user123',
        userRole: 'admin'
      }));
    });
  });

  describe('logLoginAttempt', () => {
    let req;

    beforeEach(() => {
      req = {
        ip: '192.168.1.1',
        method: 'POST',
        path: '/api/login',
        get: jest.fn().mockReturnValue('Chrome')
      };
    });

    it('should log successful login', () => {
      logLoginAttempt(true, 'affiliate', 'johndoe', req);

      expect(winston.mockLogger.log).toHaveBeenCalledWith('info', expect.objectContaining({
        eventType: 'LOGIN_SUCCESS',
        userType: 'affiliate',
        username: 'johndoe',
        success: true,
        reason: null
      }));
    });

    it('should log failed login with reason', () => {
      logLoginAttempt(false, 'customer', 'janedoe', req, 'Invalid password');

      expect(winston.mockLogger.log).toHaveBeenCalledWith('info', expect.objectContaining({
        eventType: 'LOGIN_FAILED',
        userType: 'customer',
        username: 'janedoe',
        success: false,
        reason: 'Invalid password'
      }));
    });

    it('should handle null reason', () => {
      logLoginAttempt(false, 'affiliate', 'testuser', req);

      expect(winston.mockLogger.log).toHaveBeenCalledWith('info', expect.objectContaining({
        reason: null
      }));
    });
  });

  describe('logSensitiveDataAccess', () => {
    let req;

    beforeEach(() => {
      req = {
        ip: '192.168.1.1',
        user: {
          id: 'admin123',
          role: 'admin'
        },
        get: jest.fn().mockReturnValue('Mozilla/5.0')
      };
    });

    it('should log sensitive data access', () => {
      logSensitiveDataAccess('payment_info', 'CUST123', 'view', req);

      expect(winston.mockLogger.log).toHaveBeenCalledWith('info', expect.objectContaining({
        eventType: 'SENSITIVE_DATA_ACCESS',
        dataType: 'payment_info',
        dataId: 'CUST123',
        action: 'view',
        userId: 'admin123'
      }));
    });

    it('should handle different data types and actions', () => {
      logSensitiveDataAccess('personal_info', 'AFF456', 'update', req);

      expect(winston.mockLogger.log).toHaveBeenCalledWith('info', expect.objectContaining({
        dataType: 'personal_info',
        dataId: 'AFF456',
        action: 'update'
      }));
    });
  });

  describe('logPaymentActivity', () => {
    let req;

    beforeEach(() => {
      req = {
        ip: '192.168.1.1',
        user: {
          id: 'user123',
          role: 'customer',
          customerId: 'CUST123'
        },
        get: jest.fn().mockReturnValue('Mozilla/5.0')
      };
    });

    it('should log payment info access', () => {
      logPaymentActivity('access', 'CUST123', req);

      expect(winston.mockLogger.log).toHaveBeenCalledWith('info', expect.objectContaining({
        eventType: 'PAYMENT_INFO_ACCESS',
        customerId: 'CUST123',
        action: 'access'
      }));
    });

    it('should log payment info update', () => {
      logPaymentActivity('update', 'CUST456', req, {
        field: 'credit_card',
        masked: '**** 1234'
      });

      expect(winston.mockLogger.log).toHaveBeenCalledWith('info', expect.objectContaining({
        eventType: 'PAYMENT_INFO_UPDATE',
        customerId: 'CUST456',
        action: 'update',
        field: 'credit_card',
        masked: '**** 1234'
      }));
    });

    it('should handle additional details', () => {
      logPaymentActivity('delete', 'CUST789', req, {
        reason: 'Customer request',
        timestamp: '2024-01-15'
      });

      expect(winston.mockLogger.log).toHaveBeenCalledWith('info', expect.objectContaining({
        reason: 'Customer request',
        timestamp: '2024-01-15'
      }));
    });
  });

  describe('logSuspiciousActivity', () => {
    let req;

    beforeEach(() => {
      req = {
        ip: '192.168.1.100',
        method: 'POST',
        path: '/api/admin',
        get: jest.fn().mockReturnValue('Suspicious Bot')
      };
    });

    it('should log suspicious activity with error level', () => {
      logSuspiciousActivity('multiple_failed_logins', {
        attempts: 10,
        timeframe: '5 minutes'
      }, req);

      expect(winston.mockLogger.log).toHaveBeenCalledWith('error', expect.objectContaining({
        eventType: 'SUSPICIOUS_ACTIVITY',
        activityType: 'multiple_failed_logins',
        attempts: 10,
        timeframe: '5 minutes',
        severity: 'high'
      }));
    });

    it('should include request context', () => {
      logSuspiciousActivity('unauthorized_api_access', {
        endpoint: '/api/admin/users',
        attemptedAction: 'DELETE'
      }, req);

      expect(winston.mockLogger.log).toHaveBeenCalledWith('error', expect.objectContaining({
        ip: '192.168.1.100',
        method: 'POST',
        path: '/api/admin',
        userAgent: 'Suspicious Bot'
      }));
    });

    it('should merge all details', () => {
      logSuspiciousActivity('sql_injection_attempt', {
        query: 'SELECT * FROM users WHERE id = 1 OR 1=1',
        parameter: 'userId',
        additionalInfo: 'Pattern detected in request'
      }, req);

      const logCall = winston.mockLogger.log.mock.calls[0][1];
      expect(logCall.query).toBeDefined();
      expect(logCall.parameter).toBe('userId');
      expect(logCall.additionalInfo).toBe('Pattern detected in request');
      expect(logCall.severity).toBe('high');
    });
  });

  describe('Logger configuration', () => {
    it('should export audit logger with required methods', () => {
      const auditLoggerModule = require('../../server/utils/auditLogger');

      expect(auditLoggerModule.AuditEvents).toBeDefined();
      expect(typeof auditLoggerModule.logAuditEvent).toBe('function');
      expect(typeof auditLoggerModule.auditMiddleware).toBe('function');
      expect(typeof auditLoggerModule.logLoginAttempt).toBe('function');
      expect(typeof auditLoggerModule.logSensitiveDataAccess).toBe('function');
      expect(typeof auditLoggerModule.logPaymentActivity).toBe('function');
      expect(typeof auditLoggerModule.logSuspiciousActivity).toBe('function');
    });

    it('should not add console transport in production', () => {
      process.env.NODE_ENV = 'production';

      jest.resetModules();
      require('../../server/utils/auditLogger');

      expect(winston.mockLogger.add).not.toHaveBeenCalled();
    });
  });
});