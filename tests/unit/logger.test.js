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

  it('bounds every file transport so logs cannot grow without limit', () => {
    logger = require('../../server/utils/logger');

    // File transports expose a `filename`; the Console transport does not.
    const fileTransports = logger.transports.filter((t) => t.filename);
    expect(fileTransports.length).toBeGreaterThanOrEqual(2); // error.log + combined.log

    for (const t of fileTransports) {
      expect(t.maxsize).toBeGreaterThan(0);   // per-file byte cap
      expect(t.maxFiles).toBeGreaterThan(0);  // capped number of rotated files
      expect(t.tailable).toBe(true);          // newest data stays in the base file
    }
  });
});