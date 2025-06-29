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
  sendAffiliateOrderCancellationEmail: jest.fn().mockResolvedValue({ MessageId: 'test-message-id' }),
  sendCustomerWelcomeEmail: jest.fn().mockResolvedValue({ MessageId: 'test-message-id' }),
  sendCustomerOrderConfirmationEmail: jest.fn().mockResolvedValue({ MessageId: 'test-message-id' }),
  sendOrderStatusUpdateEmail: jest.fn().mockResolvedValue({ MessageId: 'test-message-id' }),
  sendOrderCancellationEmail: jest.fn().mockResolvedValue({ MessageId: 'test-message-id' }),
  sendPasswordResetEmail: jest.fn().mockResolvedValue({ MessageId: 'test-message-id' }),
  sendAffiliatePasswordResetEmail: jest.fn().mockResolvedValue({ MessageId: 'test-message-id' }),
  sendCustomerPasswordResetEmail: jest.fn().mockResolvedValue({ MessageId: 'test-message-id' }),
  sendAdministratorWelcomeEmail: jest.fn().mockResolvedValue({ MessageId: 'test-message-id' }),
  sendAdministratorPasswordResetEmail: jest.fn().mockResolvedValue({ MessageId: 'test-message-id' }),
  sendOperatorWelcomeEmail: jest.fn().mockResolvedValue({ MessageId: 'test-message-id' }),
  sendOperatorPinResetEmail: jest.fn().mockResolvedValue({ MessageId: 'test-message-id' }),
  sendOperatorShiftReminderEmail: jest.fn().mockResolvedValue({ MessageId: 'test-message-id' }),
  sendOperatorPasswordResetEmail: jest.fn().mockResolvedValue({ MessageId: 'test-message-id' }),
  sendServiceDownAlert: jest.fn().mockResolvedValue({ MessageId: 'test-message-id' }),
  sendOrderReadyNotification: jest.fn().mockResolvedValue({ MessageId: 'test-message-id' }),
  sendOrderPickedUpNotification: jest.fn().mockResolvedValue({ MessageId: 'test-message-id' }),
  sendEmail: jest.fn().mockResolvedValue({ MessageId: 'test-message-id' })
}));

// Global connection promise to prevent multiple connections
let connectionPromise = null;

// Set up MongoDB connection before tests
beforeAll(async () => {
  try {
    // Only connect if not already connected or connecting
    if (mongoose.connection.readyState === 0) {
      if (!connectionPromise) {
        connectionPromise = mongoose.connect(testUri, {
          serverSelectionTimeoutMS: 30000, // 30 second timeout
          socketTimeoutMS: 45000,
          connectTimeoutMS: 30000,
          maxPoolSize: 10,
          minPoolSize: 5
        });
      }
      await connectionPromise;
      console.log('Connected to test database:', testUri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@'));
    } else if (mongoose.connection.readyState === 2) {
      // Connecting - wait for it
      await new Promise((resolve) => {
        mongoose.connection.once('connected', resolve);
      });
    }
    
    // Create necessary directories for file uploads
    const fs = require('fs').promises;
    const path = require('path');
    const uploadsDir = path.join(__dirname, '../uploads/w9');
    await fs.mkdir(uploadsDir, { recursive: true });
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