// Basic test setup
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;

// Mock encryption utilities for tests
jest.mock('../server/utils/encryption', () => ({
  encrypt: jest.fn((data) => ({ encrypted: data })),
  decrypt: jest.fn((data) => data.encrypted || data),
  hashPassword: jest.fn((password) => ({
    hash: 'hashed_' + password,
    salt: 'salt_' + password
  })),
  verifyPassword: jest.fn(() => true),
  generateUniqueCustomerId: jest.fn(() => 'CUST' + Math.floor(100000 + Math.random() * 900000)),
  encryptData: jest.fn((data) => 'encrypted_' + data),
  decryptData: jest.fn((data) => data.replace('encrypted_', ''))
}));

// Set up MongoDB Memory Server before tests
beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
});

// Clean up after tests
afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

// Reset database between tests
afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});