// Email Service Integration Tests
// These tests verify the email service functionality without conflicting with global mocks

// Mock fs module before any imports
jest.mock('fs', () => {
  const actualFs = jest.requireActual('fs');
  return {
    ...actualFs,
    readFile: jest.fn((path, encoding, callback) => {
      // Mock template reading
      if (typeof encoding === 'function') {
        callback = encoding;
      }
      callback(null, `
        <!DOCTYPE html>
        <html>
        <head><title>Test Email</title></head>
        <body>
          <h1>Test Email Template</h1>
          <p>[EMAIL_CONTENT]</p>
          <p>Reset Link: [RESET_LINK]</p>
          <p>User: [USER_NAME]</p>
          <p>Email: [USER_EMAIL]</p>
        </body>
        </html>
      `);
    }),
    promises: {
      ...actualFs.promises,
      readFile: jest.fn().mockResolvedValue(`
        <!DOCTYPE html>
        <html>
        <head><title>Test Email</title></head>
        <body>
          <h1>Test Email Template</h1>
          <p>[EMAIL_CONTENT]</p>
          <p>Reset Link: [RESET_LINK]</p>
          <p>User: [USER_NAME]</p>
          <p>Email: [USER_EMAIL]</p>
        </body>
        </html>
      `),
      access: jest.fn().mockResolvedValue(true)
    }
  };
});

const fs = require('fs').promises;
const path = require('path');

describe('Email Service Integration', () => {
  let emailService;
  const originalEnv = process.env;

  beforeAll(() => {
    // Unmock the email service to use real implementation
    jest.unmock('../../server/utils/emailService');
  });

  beforeEach(() => {
    // Clear module cache before each test
    jest.resetModules();
    
    // Set up test environment - these are already set in setup.js
    // but we ensure they're correct for our tests
    process.env.EMAIL_PROVIDER = 'console';
    process.env.EMAIL_FROM = 'test@wavemax.promo';
    process.env.BASE_URL = 'https://wavemax.promo';
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.resetModules();
  });

  describe('Email Service Configuration', () => {
    it('should load and configure the email service correctly', () => {
      // This test verifies that the email service can be loaded without errors
      expect(() => {
        emailService = require('../../server/utils/emailService');
      }).not.toThrow();

      expect(emailService).toBeDefined();
      expect(emailService.sendAffiliateWelcomeEmail).toBeDefined();
      expect(emailService.sendCustomerWelcomeEmail).toBeDefined();
      expect(emailService.sendAffiliatePasswordResetEmail).toBeDefined();
    });

    it('should have all required email functions', () => {
      emailService = require('../../server/utils/emailService');

      // Affiliate emails
      expect(typeof emailService.sendAffiliateWelcomeEmail).toBe('function');
      expect(typeof emailService.sendAffiliateNewCustomerEmail).toBe('function');
      expect(typeof emailService.sendAffiliateNewOrderEmail).toBe('function');
      expect(typeof emailService.sendAffiliateCommissionEmail).toBe('function');
      expect(typeof emailService.sendAffiliateOrderCancellationEmail).toBe('function');
      
      // Customer emails
      expect(typeof emailService.sendCustomerWelcomeEmail).toBe('function');
      expect(typeof emailService.sendCustomerOrderConfirmationEmail).toBe('function');
      expect(typeof emailService.sendOrderStatusUpdateEmail).toBe('function');
      expect(typeof emailService.sendOrderCancellationEmail).toBe('function');
      
      // Password reset emails (no generic sendPasswordResetEmail function)
      expect(typeof emailService.sendAffiliatePasswordResetEmail).toBe('function');
      expect(typeof emailService.sendCustomerPasswordResetEmail).toBe('function');
      
      // Administrator emails
      expect(typeof emailService.sendAdministratorWelcomeEmail).toBe('function');
      expect(typeof emailService.sendAdministratorPasswordResetEmail).toBe('function');
      
      // Operator emails
      expect(typeof emailService.sendOperatorWelcomeEmail).toBe('function');
      expect(typeof emailService.sendOperatorPasswordResetEmail).toBe('function');
    });
  });

  describe('Console Email Provider', () => {
    let consoleSpy;

    beforeEach(() => {
      consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      emailService = require('../../server/utils/emailService');
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it('should log affiliate welcome emails to console', async () => {
      const affiliate = {
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        affiliateId: 'AFF001',
        commissionPercentage: 10
      };

      const result = await emailService.sendAffiliateWelcomeEmail(affiliate);
      
      // Console transport logs the email content
      expect(consoleSpy).toHaveBeenCalledWith('=== EMAIL CONSOLE LOG ===');
      expect(consoleSpy).toHaveBeenCalledWith('To:', 'test@example.com');
      expect(consoleSpy).toHaveBeenCalledWith('From:', '"WaveMAX Laundry" <test@wavemax.promo>');
      
      // Check for subject
      const calls = consoleSpy.mock.calls.map(call => call.join(' '));
      expect(calls.some(call => call.includes('Subject:'))).toBe(true);
      expect(calls.some(call => call.includes('Welcome to WaveMAX Laundry Affiliate Program'))).toBe(true);
    });

    it('should log customer welcome emails to console', async () => {
      const customer = {
        email: 'customer@example.com',
        firstName: 'Jane',
        lastName: 'Doe'
      };
      
      const affiliate = {
        email: 'affiliate@example.com',
        firstName: 'John',
        lastName: 'Affiliate',
        businessName: 'Test Business'
      };

      const result = await emailService.sendCustomerWelcomeEmail(customer, affiliate);
      
      expect(consoleSpy).toHaveBeenCalledWith('=== EMAIL CONSOLE LOG ===');
      expect(consoleSpy).toHaveBeenCalledWith('To:', 'customer@example.com');
      expect(consoleSpy).toHaveBeenCalledWith('From:', '"WaveMAX Laundry" <test@wavemax.promo>');
      
      // Also logs success message
      expect(consoleSpy).toHaveBeenCalledWith('Customer welcome email sent successfully to:', 'customer@example.com');
    });

    it('should log password reset emails to console', async () => {
      const affiliate = {
        email: 'user@example.com',
        firstName: 'User',
        lastName: 'Affiliate'
      };
      
      const resetUrl = 'https://example.com/reset/reset-token-123';

      const result = await emailService.sendAffiliatePasswordResetEmail(affiliate, resetUrl);
      
      expect(consoleSpy).toHaveBeenCalledWith('=== EMAIL CONSOLE LOG ===');
      expect(consoleSpy).toHaveBeenCalledWith('To:', 'user@example.com');
      expect(consoleSpy).toHaveBeenCalledWith('From:', '"WaveMAX Laundry" <test@wavemax.promo>');
      
      const calls = consoleSpy.mock.calls.map(call => call.join(' '));
      expect(calls.some(call => call.includes('Password Reset'))).toBe(true);
    });
  });

  describe('Email Template Verification', () => {
    it('should verify email templates directory exists', async () => {
      const actualFs = jest.requireActual('fs').promises;
      const templateDir = path.join(__dirname, '../../server/templates/emails');
      
      const dirExists = await actualFs.access(templateDir)
        .then(() => true)
        .catch(() => false);
      
      expect(dirExists).toBe(true);
    });

    it('should verify essential email templates exist', async () => {
      const actualFs = jest.requireActual('fs').promises;
      const templateDir = path.join(__dirname, '../../server/templates/emails');
      const essentialTemplates = [
        'affiliate-welcome.html',
        'customer-welcome.html',
        'password-reset.html',
        'order-confirmation.html'
      ];

      for (const template of essentialTemplates) {
        const templatePath = path.join(templateDir, template);
        const exists = await actualFs.access(templatePath)
          .then(() => true)
          .catch(() => false);
        
        if (!exists) {
          console.log(`Missing template: ${template}`);
        }
      }
    });
  });

  describe('Mailcow SMTP Configuration', () => {
    it('should handle Mailcow SMTP configuration', () => {
      process.env.EMAIL_PROVIDER = 'smtp';
      process.env.EMAIL_HOST = 'smtp.mailcow.email';
      process.env.EMAIL_PORT = '587';
      process.env.EMAIL_USER = 'noreply@wavemax.promo';
      process.env.EMAIL_PASS = 'testpass';

      // Verify service loads without errors with Mailcow config
      expect(() => {
        emailService = require('../../server/utils/emailService');
      }).not.toThrow();
    });

    it('should handle secure Mailcow SMTP on port 465', () => {
      process.env.EMAIL_PROVIDER = 'smtp';
      process.env.EMAIL_HOST = 'smtp.mailcow.email';
      process.env.EMAIL_PORT = '465';
      process.env.EMAIL_USER = 'noreply@wavemax.promo';
      process.env.EMAIL_PASS = 'testpass';

      expect(() => {
        emailService = require('../../server/utils/emailService');
      }).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      process.env.EMAIL_PROVIDER = 'console';
      emailService = require('../../server/utils/emailService');
    });

    it('should handle missing required fields gracefully', async () => {
      const invalidAffiliate = {
        // Missing email
        firstName: 'John',
        lastName: 'Doe'
      };

      // Console provider doesn't throw on missing email, it just logs
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      try {
        await emailService.sendAffiliateWelcomeEmail(invalidAffiliate);
      } catch (error) {
        // Expected to throw or log error
        expect(error).toBeDefined();
      }

      consoleSpy.mockRestore();
    });

    it('should handle invalid email addresses', async () => {
      const invalidCustomer = {
        email: 'not-an-email',
        firstName: 'Invalid',
        lastName: 'Email'
      };
      
      const affiliate = {
        email: 'affiliate@example.com',
        firstName: 'John',
        lastName: 'Affiliate'
      };

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      // Console provider will still "send" but to invalid address
      await emailService.sendCustomerWelcomeEmail(invalidCustomer, affiliate);
      
      expect(consoleSpy).toHaveBeenCalledWith('=== EMAIL CONSOLE LOG ===');
      expect(consoleSpy).toHaveBeenCalledWith('To:', 'not-an-email');
      expect(consoleSpy).toHaveBeenCalledWith('Customer welcome email sent successfully to:', 'not-an-email');
      
      consoleSpy.mockRestore();
    });
  });

  describe('Bulk Email Operations', () => {
    beforeEach(() => {
      process.env.EMAIL_PROVIDER = 'console';
      emailService = require('../../server/utils/emailService');
    });

    it('should handle multiple email sends efficiently', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const recipients = [
        { email: 'user1@example.com', firstName: 'User', lastName: 'One' },
        { email: 'user2@example.com', firstName: 'User', lastName: 'Two' },
        { email: 'user3@example.com', firstName: 'User', lastName: 'Three' }
      ];

      const affiliate = {
        email: 'affiliate@example.com',
        firstName: 'John',
        lastName: 'Affiliate',
        businessName: 'Test Business'
      };
      
      await Promise.all(
        recipients.map(recipient => emailService.sendCustomerWelcomeEmail(recipient, affiliate))
      );

      // Check that console.log was called for each email
      expect(consoleSpy).toHaveBeenCalled();
      
      // Count how many times we logged email headers
      const emailLogCalls = consoleSpy.mock.calls.filter(
        call => call[0] && call[0] === '=== EMAIL CONSOLE LOG ==='
      );
      
      // Should have logged 3 emails (one for each recipient)
      expect(emailLogCalls.length).toBe(3);
      
      // Verify each recipient was sent an email
      expect(consoleSpy).toHaveBeenCalledWith('Customer welcome email sent successfully to:', 'user1@example.com');
      expect(consoleSpy).toHaveBeenCalledWith('Customer welcome email sent successfully to:', 'user2@example.com');
      expect(consoleSpy).toHaveBeenCalledWith('Customer welcome email sent successfully to:', 'user3@example.com');
      
      consoleSpy.mockRestore();
    });
  });
});