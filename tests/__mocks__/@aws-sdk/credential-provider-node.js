// Mock for AWS credential provider
const defaultProvider = jest.fn(() => () => Promise.resolve({
  accessKeyId: 'mock-access-key',
  secretAccessKey: 'mock-secret-key'
}));

module.exports = {
  defaultProvider
};