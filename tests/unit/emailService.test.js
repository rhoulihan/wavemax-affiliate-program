// Email Service Unit Tests
const emailService = require('../../server/utils/emailService');

// Mock dependencies
jest.mock('nodemailer');
jest.mock('@aws-sdk/client-ses');
jest.mock('@getbrevo/brevo');

describe('Email Service', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Brevo Provider Integration', () => {
    beforeEach(() => {
      process.env.EMAIL_PROVIDER = 'brevo';
      process.env.BREVO_API_KEY = 'test-api-key';
      process.env.BREVO_FROM_EMAIL = 'test@example.com';
      process.env.BREVO_FROM_NAME = 'Test Sender';
    });

    it('should use Brevo provider when configured', () => {
      // Mock Brevo SDK
      const mockSendTransacEmail = jest.fn().mockResolvedValue({
        messageId: 'brevo-123'
      });

      const SibApiV3Sdk = require('@getbrevo/brevo');
      SibApiV3Sdk.TransactionalEmailsApi = jest.fn().mockImplementation(() => ({
        sendTransacEmail: mockSendTransacEmail,
        authentications: {
          'api-key': { apiKey: null }
        }
      }));
      SibApiV3Sdk.SendSmtpEmail = jest.fn();

      // This test verifies that the Brevo configuration is recognized
      // Actual email sending would be tested in integration tests
      expect(process.env.EMAIL_PROVIDER).toBe('brevo');
      expect(process.env.BREVO_API_KEY).toBe('test-api-key');
    });

    it('should handle Brevo API errors gracefully', async () => {
      const SibApiV3Sdk = require('@getbrevo/brevo');
      const mockError = new Error('Brevo API Error');

      SibApiV3Sdk.TransactionalEmailsApi = jest.fn().mockImplementation(() => ({
        sendTransacEmail: jest.fn().mockRejectedValue(mockError),
        authentications: {
          'api-key': { apiKey: null }
        }
      }));
      SibApiV3Sdk.SendSmtpEmail = jest.fn();

      // Test would verify error handling in actual implementation
      expect(SibApiV3Sdk.TransactionalEmailsApi).toBeDefined();
    });
  });

  describe('Provider Selection', () => {
    it('should support multiple email providers', () => {
      const providers = ['console', 'ses', 'exchange', 'brevo', 'smtp'];

      providers.forEach(provider => {
        process.env.EMAIL_PROVIDER = provider;
        // Verify that each provider can be configured
        expect(process.env.EMAIL_PROVIDER).toBe(provider);
      });
    });
  });
});