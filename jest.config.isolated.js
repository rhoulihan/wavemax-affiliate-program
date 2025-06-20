module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.isolated.test.js'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.isolated.js'],
  testTimeout: 5000,
  verbose: true,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true
};