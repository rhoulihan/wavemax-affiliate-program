// Basic test setup
const mongoose = require('mongoose');
require('dotenv').config();

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
process.env.SESSION_SECRET = 'test-session-secret';
process.env.EMAIL_PROVIDER = 'ses'; // Keep SES to test the mocking
process.env.SES_FROM_EMAIL = 'test@example.com';
process.env.BASE_URL = 'https://wavemax.promo';

// Get MongoDB URI and append test database name
const baseUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/wavemax_affiliate';
const testUri = baseUri.includes('?') 
  ? baseUri.replace(/\/[^/\?]+\?/, '/wavemax_test?')
  : baseUri.replace(/\/[^/]+$/, '/wavemax_test');

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
  sendPasswordResetEmail: jest.fn().mockResolvedValue({ MessageId: 'test-message-id' }),
  sendAdministratorWelcomeEmail: jest.fn().mockResolvedValue({ MessageId: 'test-message-id' }),
  sendAdministratorPasswordResetEmail: jest.fn().mockResolvedValue({ MessageId: 'test-message-id' }),
  sendOperatorWelcomeEmail: jest.fn().mockResolvedValue({ MessageId: 'test-message-id' }),
  sendOperatorPinResetEmail: jest.fn().mockResolvedValue({ MessageId: 'test-message-id' }),
  sendOperatorShiftReminderEmail: jest.fn().mockResolvedValue({ MessageId: 'test-message-id' })
}));

// Set up MongoDB connection before tests
beforeAll(async () => {
  try {
    await mongoose.connect(testUri);
    console.log('Connected to test database:', testUri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@'));
  } catch (error) {
    console.error('Failed to connect to test database:', error);
    throw error;
  }
});

// Clean up after tests
afterAll(async () => {
  // Clean all collections instead of dropping database (permission issue)
  if (mongoose.connection.db) {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
  }
  await mongoose.disconnect();
});

// Reset database between tests
afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
  // Also clear any indexes that might have been created
  for (const key in collections) {
    try {
      await collections[key].dropIndexes();
    } catch (error) {
      // Ignore errors from dropping indexes on _id field
    }
  }
});