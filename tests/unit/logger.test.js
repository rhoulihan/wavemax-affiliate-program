describe('Logger Utility', () => {
  let logger;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('should export logger methods', () => {
    logger = require('../../server/utils/logger');
    
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.debug).toBe('function');
  });

  it('should be a winston logger instance', () => {
    logger = require('../../server/utils/logger');
    
    // Logger should have winston logger properties
    expect(logger.level).toBeDefined();
    expect(logger.transports).toBeDefined();
  });
});