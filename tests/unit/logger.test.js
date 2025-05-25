const winston = require('winston');
const path = require('path');

// Mock winston before requiring logger
jest.mock('winston', () => {
  const mockFormat = {
    combine: jest.fn().mockReturnValue('combined-format'),
    timestamp: jest.fn().mockReturnValue('timestamp-format'),
    json: jest.fn().mockReturnValue('json-format'),
    colorize: jest.fn().mockReturnValue('colorize-format'),
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
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  };

  return {
    format: mockFormat,
    transports: mockTransports,
    createLogger: jest.fn().mockReturnValue(mockLogger),
    mockLogger // Export for test access
  };
});

describe('Logger Utility', () => {
  let logger;
  let originalEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };

    // Clear module cache to allow re-importing with different env vars
    jest.resetModules();
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('Logger configuration', () => {
    it('should create logger with default configuration', () => {
      delete process.env.LOG_LEVEL;
      delete process.env.LOG_DIR;

      logger = require('../../server/utils/logger');

      expect(winston.createLogger).toHaveBeenCalledWith({
        level: 'info',
        format: 'combined-format',
        defaultMeta: { service: 'wavemax-affiliate' },
        transports: expect.any(Array)
      });
    });

    it('should use custom log level from environment', () => {
      process.env.LOG_LEVEL = 'debug';

      logger = require('../../server/utils/logger');

      expect(winston.createLogger).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'debug'
        })
      );
    });

    it('should use custom log directory from environment', () => {
      process.env.LOG_DIR = '/custom/log/path';

      logger = require('../../server/utils/logger');

      const createLoggerCall = winston.createLogger.mock.calls[0][0];
      const fileTransports = createLoggerCall.transports.filter(t => t.type === 'file');

      expect(fileTransports[0].filename).toBe('/custom/log/path/error.log');
      expect(fileTransports[1].filename).toBe('/custom/log/path/combined.log');
    });

    it('should use default log directory when not specified', () => {
      delete process.env.LOG_DIR;

      logger = require('../../server/utils/logger');

      const createLoggerCall = winston.createLogger.mock.calls[0][0];
      const fileTransports = createLoggerCall.transports.filter(t => t.type === 'file');

      expect(fileTransports[0].filename).toContain('logs/error.log');
      expect(fileTransports[1].filename).toContain('logs/combined.log');
    });
  });

  describe('File transports', () => {
    it('should create error log transport with error level', () => {
      logger = require('../../server/utils/logger');

      const createLoggerCall = winston.createLogger.mock.calls[0][0];
      const errorTransport = createLoggerCall.transports.find(
        t => t.type === 'file' && t.level === 'error'
      );

      expect(errorTransport).toBeDefined();
      expect(errorTransport.filename).toContain('error.log');
      expect(errorTransport.level).toBe('error');
    });

    it('should create combined log transport', () => {
      logger = require('../../server/utils/logger');

      const createLoggerCall = winston.createLogger.mock.calls[0][0];
      const combinedTransport = createLoggerCall.transports.find(
        t => t.type === 'file' && t.filename.includes('combined.log')
      );

      expect(combinedTransport).toBeDefined();
      expect(combinedTransport.level).toBeUndefined(); // Should use logger's default level
    });
  });

  describe('Console transport', () => {
    it('should add console transport in development', () => {
      process.env.NODE_ENV = 'development';

      logger = require('../../server/utils/logger');

      expect(winston.mockLogger.add).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'console'
        })
      );
    });

    it('should add console transport when not in production', () => {
      process.env.NODE_ENV = 'test';

      logger = require('../../server/utils/logger');

      expect(winston.mockLogger.add).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'console'
        })
      );
    });

    it('should not add console transport in production', () => {
      process.env.NODE_ENV = 'production';

      logger = require('../../server/utils/logger');

      expect(winston.mockLogger.add).not.toHaveBeenCalled();
    });

    it('should configure console transport with correct format', () => {
      process.env.NODE_ENV = 'development';

      logger = require('../../server/utils/logger');

      const consoleTransportCall = winston.mockLogger.add.mock.calls[0][0];
      expect(consoleTransportCall.format).toBe('combined-format');

      // Verify format combination was called correctly
      expect(winston.format.combine).toHaveBeenCalledWith(
        'colorize-format',
        'simple-format'
      );
    });
  });

  describe('Logger format', () => {
    it('should use combined format with timestamp and json', () => {
      logger = require('../../server/utils/logger');

      expect(winston.format.combine).toHaveBeenCalledWith(
        'timestamp-format',
        'json-format'
      );
    });

    it('should set default metadata', () => {
      logger = require('../../server/utils/logger');

      const createLoggerCall = winston.createLogger.mock.calls[0][0];
      expect(createLoggerCall.defaultMeta).toEqual({
        service: 'wavemax-affiliate'
      });
    });
  });

  describe('Logger instance', () => {
    it('should export winston logger instance', () => {
      logger = require('../../server/utils/logger');

      expect(logger).toBe(winston.mockLogger);
      expect(logger.info).toBeDefined();
      expect(logger.error).toBeDefined();
      expect(logger.warn).toBeDefined();
      expect(logger.debug).toBeDefined();
    });

    it('should be callable with logging methods', () => {
      logger = require('../../server/utils/logger');

      logger.info('Test info message');
      logger.error('Test error message');
      logger.warn('Test warning message');
      logger.debug('Test debug message');

      expect(winston.mockLogger.info).toHaveBeenCalledWith('Test info message');
      expect(winston.mockLogger.error).toHaveBeenCalledWith('Test error message');
      expect(winston.mockLogger.warn).toHaveBeenCalledWith('Test warning message');
      expect(winston.mockLogger.debug).toHaveBeenCalledWith('Test debug message');
    });
  });

  describe('Environment variations', () => {
    it('should handle missing NODE_ENV', () => {
      delete process.env.NODE_ENV;

      logger = require('../../server/utils/logger');

      // Should add console transport when NODE_ENV is not set
      expect(winston.mockLogger.add).toHaveBeenCalled();
    });

    it('should handle all environment configurations', () => {
      const environments = [
        { NODE_ENV: 'production', LOG_LEVEL: 'error', shouldAddConsole: false },
        { NODE_ENV: 'development', LOG_LEVEL: 'debug', shouldAddConsole: true },
        { NODE_ENV: 'test', LOG_LEVEL: 'warn', shouldAddConsole: true },
        { NODE_ENV: 'staging', LOG_LEVEL: 'info', shouldAddConsole: true }
      ];

      environments.forEach(({ NODE_ENV, LOG_LEVEL, shouldAddConsole }) => {
        jest.resetModules();
        jest.clearAllMocks();

        process.env.NODE_ENV = NODE_ENV;
        process.env.LOG_LEVEL = LOG_LEVEL;

        const testLogger = require('../../server/utils/logger');

        expect(winston.createLogger).toHaveBeenCalledWith(
          expect.objectContaining({
            level: LOG_LEVEL
          })
        );

        if (shouldAddConsole) {
          expect(winston.mockLogger.add).toHaveBeenCalled();
        } else {
          expect(winston.mockLogger.add).not.toHaveBeenCalled();
        }
      });
    });
  });

  describe('Path handling', () => {
    it('should correctly resolve log directory paths', () => {
      delete process.env.LOG_DIR;

      logger = require('../../server/utils/logger');

      const createLoggerCall = winston.createLogger.mock.calls[0][0];
      const fileTransports = createLoggerCall.transports.filter(t => t.type === 'file');

      fileTransports.forEach(transport => {
        expect(transport.filename).toMatch(/logs\/(error|combined)\.log$/);
        // Verify it's using path.join
        expect(transport.filename).not.toContain('//');
      });
    });

    it('should handle absolute paths in LOG_DIR', () => {
      process.env.LOG_DIR = '/var/log/wavemax';

      logger = require('../../server/utils/logger');

      const createLoggerCall = winston.createLogger.mock.calls[0][0];
      const fileTransports = createLoggerCall.transports.filter(t => t.type === 'file');

      expect(fileTransports[0].filename).toBe('/var/log/wavemax/error.log');
      expect(fileTransports[1].filename).toBe('/var/log/wavemax/combined.log');
    });

    it('should handle relative paths in LOG_DIR', () => {
      process.env.LOG_DIR = './custom-logs';

      logger = require('../../server/utils/logger');

      const createLoggerCall = winston.createLogger.mock.calls[0][0];
      const fileTransports = createLoggerCall.transports.filter(t => t.type === 'file');

      expect(fileTransports[0].filename).toBe('./custom-logs/error.log');
      expect(fileTransports[1].filename).toBe('./custom-logs/combined.log');
    });
  });
});