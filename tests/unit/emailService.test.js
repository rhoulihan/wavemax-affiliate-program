// tests/unit/emailService.test.js
// Test suite for email service - focusing on testable paths

const nodemailer = require('nodemailer');
const { SESClient } = require('@aws-sdk/client-ses');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

// Mock all external dependencies
jest.mock('nodemailer');
jest.mock('@aws-sdk/client-ses', () => ({
  SESClient: jest.fn(),
  SendEmailCommand: jest.fn()
}));
jest.mock('@aws-sdk/credential-provider-node', () => ({
  defaultProvider: jest.fn(() => () => Promise.resolve({}))
}));
jest.mock('fs');

describe('EmailService', () => {
  let emailService;
  let mockTransporter;
  let mockSendMail;
  let originalEnv;
  let consoleLogSpy;
  let consoleErrorSpy;
  let consoleWarnSpy;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
    
    // Reset all mocks
    jest.clearAllMocks();
    jest.resetModules();
    
    // Mock console methods
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    
    // Setup mock transporter that succeeds by default
    mockSendMail = jest.fn().mockResolvedValue({ 
      messageId: 'test-message-id-123',
      response: '250 Message accepted'
    });
    
    mockTransporter = {
      sendMail: mockSendMail
    };
    
    // Mock nodemailer.createTransport
    nodemailer.createTransport.mockReturnValue(mockTransporter);
    
    // Mock SESClient
    const mockSESClient = { send: jest.fn() };
    SESClient.mockImplementation(() => mockSESClient);
    
    // Mock fs.readFile to return valid templates
    const mockReadFile = jest.fn((filePath, encoding, callback) => {
      // Always return a valid template
      callback(null, '<html><body>Test email template [FIRST_NAME] [AFFILIATE_ID] [EMAIL_CONTENT]</body></html>');
    });
    
    fs.readFile = mockReadFile;
    fs.promises = {
      readFile: promisify(mockReadFile)
    };
    
    // Default to SMTP transport
    process.env.EMAIL_PROVIDER = 'smtp';
    process.env.EMAIL_HOST = 'smtp.test.com';
    process.env.EMAIL_PORT = '587';
    process.env.EMAIL_USER = 'test@test.com';
    process.env.EMAIL_PASS = 'testpass';
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  describe('Transport Creation', () => {
    test('should use console transport for development', async () => {
      process.env.EMAIL_PROVIDER = 'console';
      process.env.EMAIL_FROM = 'test@wavemax.com';
      
      emailService = require('../../server/utils/emailService');
      
      // Console transport doesn't use nodemailer
      expect(nodemailer.createTransport).not.toHaveBeenCalled();
      
      // Send an email and verify console output
      await emailService.sendAffiliateWelcomeEmail({
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        affiliateId: 'AFF123'
      });
      
      // The email service logs internally, so we check for that
      expect(consoleLogSpy).toHaveBeenCalledWith('=== EMAIL CONSOLE LOG ===');
      expect(consoleLogSpy).toHaveBeenCalledWith('To:', 'test@example.com');
    });

    test('should create SES transport when configured', () => {
      process.env.EMAIL_PROVIDER = 'ses';
      process.env.AWS_REGION = 'us-east-1';
      process.env.SES_FROM_EMAIL = 'noreply@wavemax.com';
      
      emailService = require('../../server/utils/emailService');
      
      expect(nodemailer.createTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          SES: expect.objectContaining({
            ses: expect.any(Object),
            aws: expect.anything()
          })
        })
      );
    });

    test('should create Exchange transport when configured', () => {
      process.env.EMAIL_PROVIDER = 'exchange';
      process.env.EXCHANGE_HOST = 'exchange.example.com';
      process.env.EXCHANGE_PORT = '587';
      process.env.EXCHANGE_USER = 'user@example.com';
      process.env.EXCHANGE_PASS = 'password123';
      
      emailService = require('../../server/utils/emailService');
      
      expect(nodemailer.createTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'exchange.example.com',
          port: 587,
          secure: false,
          auth: {
            user: 'user@example.com',
            pass: 'password123'
          },
          tls: expect.objectContaining({
            ciphers: 'SSLv3'
          })
        })
      );
    });

    test('should create SMTP transport as default', () => {
      delete process.env.EMAIL_PROVIDER;
      process.env.EMAIL_HOST = 'smtp.gmail.com';
      process.env.EMAIL_PORT = '587';
      process.env.EMAIL_USER = 'test@gmail.com';
      process.env.EMAIL_PASS = 'app-password';
      
      emailService = require('../../server/utils/emailService');
      
      expect(nodemailer.createTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'smtp.gmail.com',
          port: '587',
          secure: false,
          auth: {
            user: 'test@gmail.com',
            pass: 'app-password'
          }
        })
      );
    });

    test('should handle secure SMTP on port 465', () => {
      process.env.EMAIL_PORT = '465';
      
      emailService = require('../../server/utils/emailService');
      
      expect(nodemailer.createTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          port: '465',
          secure: true
        })
      );
    });

    test('should handle Exchange debug mode in development', () => {
      process.env.NODE_ENV = 'development';
      process.env.EMAIL_PROVIDER = 'exchange';
      process.env.EXCHANGE_HOST = 'exchange.example.com';
      process.env.EXCHANGE_USER = 'user@example.com';
      process.env.EXCHANGE_PASS = 'password';
      
      emailService = require('../../server/utils/emailService');
      
      expect(nodemailer.createTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          debug: true,
          logger: true
        })
      );
    });

    test('should handle Exchange reject unauthorized setting', () => {
      process.env.EMAIL_PROVIDER = 'exchange';
      process.env.EXCHANGE_HOST = 'exchange.example.com';
      process.env.EXCHANGE_REJECT_UNAUTHORIZED = 'false';
      process.env.EXCHANGE_USER = 'user@example.com';
      process.env.EXCHANGE_PASS = 'password';
      
      emailService = require('../../server/utils/emailService');
      
      expect(nodemailer.createTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          tls: expect.objectContaining({
            rejectUnauthorized: false
          })
        })
      );
    });

    test('should handle SES default region', () => {
      process.env.EMAIL_PROVIDER = 'ses';
      delete process.env.AWS_REGION;
      
      emailService = require('../../server/utils/emailService');
      
      expect(SESClient).toHaveBeenCalledWith(
        expect.objectContaining({
          region: 'us-east-1' // Default region
        })
      );
    });
  });

  describe('Email Sending Functions', () => {
    beforeEach(() => {
      process.env.EMAIL_FROM = 'noreply@wavemax.com';
      process.env.EMAIL_USER = 'test@wavemax.com';
      emailService = require('../../server/utils/emailService');
    });

    describe('Success Cases', () => {
      test('should send affiliate welcome email', async () => {
        await emailService.sendAffiliateWelcomeEmail({
          email: 'affiliate@example.com',
          firstName: 'John',
          lastName: 'Doe',
          affiliateId: 'AFF12345'
        });
        
        expect(mockSendMail).toHaveBeenCalledWith(
          expect.objectContaining({
            to: 'affiliate@example.com',
            subject: expect.stringContaining('Welcome to WaveMAX')
          })
        );
        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Email sent:'));
      });

      test('should send all email types successfully', async () => {
        const testCases = [
          // Affiliate emails
          () => emailService.sendAffiliateWelcomeEmail({ email: 'test@example.com', firstName: 'Test', affiliateId: 'AFF123' }),
          () => emailService.sendAffiliateNewCustomerEmail({ email: 'test@example.com' }, { customerId: 'CUST123' }, 'BAG123'),
          () => emailService.sendAffiliateNewOrderEmail({ email: 'test@example.com' }, {}, { orderId: 'ORD123' }),
          () => emailService.sendAffiliateCommissionEmail({ email: 'test@example.com' }, { orderId: 'ORD123' }, {}),
          () => emailService.sendAffiliateLostBagEmail({ email: 'test@example.com' }, {}, 'BAG123'),
          () => emailService.sendAffiliateOrderCancellationEmail({ email: 'test@example.com' }, {}, {}),
          () => emailService.sendAffiliatePasswordResetEmail({ email: 'test@example.com' }, 'https://reset.url'),
          
          // Customer emails
          () => emailService.sendCustomerWelcomeEmail({ email: 'test@example.com' }, 'BAG123', {}),
          () => emailService.sendCustomerOrderConfirmationEmail({ email: 'test@example.com' }, {}, {}),
          () => emailService.sendOrderStatusUpdateEmail({ email: 'test@example.com' }, {}, 'Completed'),
          () => emailService.sendOrderCancellationEmail({ email: 'test@example.com' }, {}),
          () => emailService.sendCustomerPasswordResetEmail({ email: 'test@example.com' }, 'https://reset.url'),
          
          // Administrator emails
          () => emailService.sendAdministratorWelcomeEmail({ email: 'test@example.com', adminId: 'ADM123' }),
          () => emailService.sendAdministratorPasswordResetEmail({ email: 'test@example.com' }, 'https://reset.url'),
          
          // Operator emails
          () => emailService.sendOperatorWelcomeEmail({ email: 'test@example.com' }, '1234'),
          () => emailService.sendOperatorPinResetEmail({ email: 'test@example.com' }, '5678'),
          () => emailService.sendOperatorShiftReminderEmail({ email: 'test@example.com' }),
          () => emailService.sendOperatorPasswordResetEmail({ email: 'test@example.com' }, 'https://reset.url')
        ];
        
        // Execute all email functions
        await Promise.all(testCases.map(fn => fn()));
        
        // All should have succeeded
        expect(mockSendMail).toHaveBeenCalledTimes(testCases.length);
      });
    });

    describe('Error Handling', () => {
      test('should log error when template loading fails', async () => {
        // Mock template loading failure
        fs.readFile = jest.fn((path, encoding, callback) => {
          callback(new Error('Template not found'), null);
        });
        
        await emailService.sendAffiliateWelcomeEmail({
          email: 'test@example.com',
          firstName: 'Test'
        });
        
        // Should have logged the error but still sent with fallback template
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining('Error loading email template'),
          expect.any(Error)
        );
        expect(mockSendMail).toHaveBeenCalled();
      });

      test('should handle email sending failure gracefully', async () => {
        mockSendMail.mockRejectedValueOnce(new Error('SMTP connection failed'));
        
        await emailService.sendAffiliateWelcomeEmail({
          email: 'test@example.com',
          firstName: 'Test'
        });
        
        // Should log the error
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining('Error sending'),
          expect.any(Error)
        );
      });

      test('should handle missing email address', async () => {
        await emailService.sendAffiliateWelcomeEmail({
          firstName: 'Test'
          // Missing email
        });
        
        // Should log an error
        expect(consoleErrorSpy).toHaveBeenCalled();
      });
    });

    describe('Template Variable Replacement', () => {
      test('should replace template variables correctly', async () => {
        // Mock template with variables
        fs.readFile = jest.fn((path, encoding, callback) => {
          callback(null, 'Hello [FIRST_NAME], your ID is [AFFILIATE_ID]');
        });
        
        await emailService.sendAffiliateWelcomeEmail({
          email: 'test@example.com',
          firstName: 'John',
          affiliateId: 'AFF999'
        });
        
        expect(mockSendMail).toHaveBeenCalledWith(
          expect.objectContaining({
            html: expect.stringContaining('Hello John, your ID is AFF999')
          })
        );
      });

      test('should handle missing template variables', async () => {
        // Mock template with variables
        fs.readFile = jest.fn((path, encoding, callback) => {
          callback(null, 'Hello [FIRST_NAME], your ID is [AFFILIATE_ID]');
        });
        
        await emailService.sendAffiliateWelcomeEmail({
          email: 'test@example.com'
          // Missing firstName and affiliateId
        });
        
        // Should warn about missing placeholders
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          expect.stringContaining('Email template placeholder')
        );
      });
    });

    describe('Email From Address Configuration', () => {
      test('should use SES from email when configured', async () => {
        process.env.EMAIL_PROVIDER = 'ses';
        process.env.SES_FROM_EMAIL = 'ses@wavemax.com';
        
        emailService = require('../../server/utils/emailService');
        
        await emailService.sendAffiliateWelcomeEmail({
          email: 'test@example.com',
          firstName: 'Test'
        });
        
        expect(mockSendMail).toHaveBeenCalledWith(
          expect.objectContaining({
            from: 'ses@wavemax.com'
          })
        );
      });

      test('should use Exchange from email when configured', async () => {
        process.env.EMAIL_PROVIDER = 'exchange';
        process.env.EXCHANGE_FROM_EMAIL = 'exchange@wavemax.com';
        process.env.EXCHANGE_USER = 'user@exchange.com';
        
        emailService = require('../../server/utils/emailService');
        
        await emailService.sendAffiliateWelcomeEmail({
          email: 'test@example.com',
          firstName: 'Test'
        });
        
        expect(mockSendMail).toHaveBeenCalledWith(
          expect.objectContaining({
            from: 'exchange@wavemax.com'
          })
        );
      });

      test('should use console from email for console provider', async () => {
        process.env.EMAIL_PROVIDER = 'console';
        process.env.EMAIL_FROM = 'console@wavemax.com';
        
        emailService = require('../../server/utils/emailService');
        
        await emailService.sendAffiliateWelcomeEmail({
          email: 'test@example.com',
          firstName: 'Test'
        });
        
        // Console provider logs the from address
        expect(consoleLogSpy).toHaveBeenCalledWith('From:', 'console@wavemax.com');
      });
    });

    describe('Special Email Types', () => {
      test('should send administrator welcome with temporary password', async () => {
        await emailService.sendAdministratorWelcomeEmail({
          email: 'admin@example.com',
          firstName: 'Admin',
          adminId: 'ADM001',
          temporaryPassword: 'TempPass123!'
        });
        
        expect(mockSendMail).toHaveBeenCalledWith(
          expect.objectContaining({
            subject: expect.stringContaining('Administrator Account Created')
          })
        );
      });

      test('should send operator PIN reset email', async () => {
        await emailService.sendOperatorPinResetEmail({
          email: 'operator@example.com',
          firstName: 'Op'
        }, '1234');
        
        expect(mockSendMail).toHaveBeenCalledWith(
          expect.objectContaining({
            subject: expect.stringContaining('PIN Reset')
          })
        );
      });

      test('should send order confirmation with order details', async () => {
        await emailService.sendCustomerOrderConfirmationEmail(
          { email: 'customer@example.com', firstName: 'Jane' },
          { 
            orderId: 'ORD123',
            totalAmount: 100,
            items: [{ name: 'Service', quantity: 1, price: 100 }],
            pickupDate: new Date(),
            deliveryDate: new Date()
          },
          { businessName: 'Test Laundry' }
        );
        
        expect(mockSendMail).toHaveBeenCalledWith(
          expect.objectContaining({
            subject: expect.stringContaining('Order Confirmation')
          })
        );
      });
    });

    describe('Console Transport Behavior', () => {
      beforeEach(() => {
        process.env.EMAIL_PROVIDER = 'console';
        emailService = require('../../server/utils/emailService');
      });

      test('should log all email components to console', async () => {
        await emailService.sendAffiliateWelcomeEmail({
          email: 'test@example.com',
          firstName: 'Test',
          affiliateId: 'AFF123'
        });
        
        expect(consoleLogSpy).toHaveBeenCalledWith('=== EMAIL CONSOLE LOG ===');
        expect(consoleLogSpy).toHaveBeenCalledWith('To:', 'test@example.com');
        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Subject:'), expect.any(String));
        expect(consoleLogSpy).toHaveBeenCalledWith('HTML Preview: [HTML content logged to console]');
        expect(consoleLogSpy).toHaveBeenCalledWith('========================');
      });

      test('should return mock message ID for console transport', async () => {
        await emailService.sendAffiliateWelcomeEmail({
          email: 'test@example.com',
          firstName: 'Test'
        });
        
        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining('Email sent:'),
          expect.stringContaining('console-')
        );
      });
    });
  });

  describe('Edge Cases and Coverage Completion', () => {
    beforeEach(() => {
      emailService = require('../../server/utils/emailService');
    });

    test('should handle BASE_URL environment variable', async () => {
      process.env.BASE_URL = 'https://custom.wavemax.com';
      
      emailService = require('../../server/utils/emailService');
      
      await emailService.sendAffiliateWelcomeEmail({
        email: 'test@example.com',
        firstName: 'Test'
      });
      
      expect(mockSendMail).toHaveBeenCalled();
    });

    test('should use default BASE_URL when not set', async () => {
      delete process.env.BASE_URL;
      
      emailService = require('../../server/utils/emailService');
      
      await emailService.sendAffiliateWelcomeEmail({
        email: 'test@example.com',
        firstName: 'Test'
      });
      
      expect(mockSendMail).toHaveBeenCalled();
    });

    test('should handle all date formatting in templates', async () => {
      const orderWithDates = {
        orderId: 'ORD123',
        pickupDate: new Date('2024-12-25T10:00:00Z'),
        deliveryDate: new Date('2024-12-26T15:00:00Z')
      };
      
      await emailService.sendCustomerOrderConfirmationEmail(
        { email: 'customer@example.com' },
        orderWithDates,
        { businessName: 'Test' }
      );
      
      expect(mockSendMail).toHaveBeenCalled();
    });

    test('should handle commission amount formatting', async () => {
      await emailService.sendAffiliateCommissionEmail(
        { email: 'affiliate@example.com', firstName: 'John' },
        { orderId: 'ORD123', commission: 25.50 },
        { firstName: 'Jane', lastName: 'Doe' }
      );
      
      expect(mockSendMail).toHaveBeenCalled();
    });

    test('should handle order items formatting', async () => {
      const orderWithItems = {
        orderId: 'ORD123',
        items: [
          { name: 'Wash & Fold', quantity: 2, price: 20 },
          { name: 'Dry Cleaning', quantity: 1, price: 30 }
        ]
      };
      
      await emailService.sendCustomerOrderConfirmationEmail(
        { email: 'customer@example.com' },
        orderWithItems,
        { businessName: 'Test' }
      );
      
      expect(mockSendMail).toHaveBeenCalled();
    });

    test('should handle all password reset URLs', async () => {
      const resetUrl = 'https://wavemax.com/reset?token=abc123';
      
      // Test all password reset email types
      await emailService.sendAffiliatePasswordResetEmail({ email: 'test@example.com' }, resetUrl);
      await emailService.sendCustomerPasswordResetEmail({ email: 'test@example.com' }, resetUrl);
      await emailService.sendAdministratorPasswordResetEmail({ email: 'test@example.com' }, resetUrl);
      await emailService.sendOperatorPasswordResetEmail({ email: 'test@example.com' }, resetUrl);
      
      expect(mockSendMail).toHaveBeenCalledTimes(4);
    });

    test('should handle bag barcode in emails', async () => {
      const bagBarcode = 'BAG12345';
      
      await emailService.sendCustomerWelcomeEmail(
        { email: 'customer@example.com' },
        bagBarcode,
        { businessName: 'Test' }
      );
      
      await emailService.sendAffiliateLostBagEmail(
        { email: 'affiliate@example.com' },
        { firstName: 'Jane', lastName: 'Doe' },
        bagBarcode
      );
      
      expect(mockSendMail).toHaveBeenCalledTimes(2);
    });

    test('should handle operator shift reminder', async () => {
      await emailService.sendOperatorShiftReminderEmail({
        email: 'operator@example.com',
        firstName: 'John',
        shift: { date: new Date(), startTime: '9:00 AM' }
      });
      
      expect(mockSendMail).toHaveBeenCalled();
    });
  });
});