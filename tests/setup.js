// Basic test setup
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
process.env.SESSION_SECRET = 'test-session-secret';
process.env.EMAIL_PROVIDER = 'ses'; // Keep SES to test the mocking
process.env.SES_FROM_EMAIL = 'test@example.com';

let mongoServer;

// Mock the email service to prevent actual email sending during tests
jest.mock('../server/utils/emailService', () => ({
  sendAffiliateWelcomeEmail: jest.fn().mockResolvedValue({ MessageId: 'test-message-id' }),
  sendAffiliateNewCustomerEmail: jest.fn().mockResolvedValue({ MessageId: 'test-message-id' }),
  sendAffiliateNewOrderEmail: jest.fn().mockResolvedValue({ MessageId: 'test-message-id' }),
  sendAffiliateCommissionEmail: jest.fn().mockResolvedValue({ MessageId: 'test-message-id' }),
  sendAffiliateLostBagEmail: jest.fn().mockResolvedValue({ MessageId: 'test-message-id' }),
  sendAffiliateOrderCancellationEmail: jest.fn().mockResolvedValue({ MessageId: 'test-message-id' }),
  sendCustomerWelcomeEmail: jest.fn().mockResolvedValue({ MessageId: 'test-message-id' }),
  sendCustomerOrderConfirmationEmail: jest.fn().mockResolvedValue({ MessageId: 'test-message-id' }),
  sendOrderStatusUpdateEmail: jest.fn().mockResolvedValue({ MessageId: 'test-message-id' }),
  sendOrderCancellationEmail: jest.fn().mockResolvedValue({ MessageId: 'test-message-id' }),
  sendPasswordResetEmail: jest.fn().mockResolvedValue({ MessageId: 'test-message-id' })
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