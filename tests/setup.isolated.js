// Isolated test setup for tests that need to mock core modules like fs
// This setup doesn't create directories or connect to MongoDB

require('dotenv').config();

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
process.env.SESSION_SECRET = 'test-session-secret';
process.env.EMAIL_PROVIDER = 'smtp';
process.env.EMAIL_FROM = 'test@example.com';
process.env.BASE_URL = 'https://wavemax.promo';

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
  sendOperatorPasswordResetEmail: jest.fn().mockResolvedValue({ MessageId: 'test-message-id' })
}));

// Set default test timeout
jest.setTimeout(10000);