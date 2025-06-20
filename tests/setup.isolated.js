// Minimal setup for isolated unit tests that don't need database access
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';

// Mock console to reduce noise
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn()
};