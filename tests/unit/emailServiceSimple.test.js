// tests/unit/emailServiceSimple.test.js
// Simplified test suite for email service focusing on testable parts

const path = require('path');

// Set up environment variables before requiring email service
process.env.EMAIL_PROVIDER = 'console';
process.env.EMAIL_FROM = 'test@wavemax.com';

describe('EmailService Simple Tests', () => {
  let emailService;
  let consoleLogSpy;
  let consoleErrorSpy;
  
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    
    // Spy on console methods
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  
  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });
  
  test('should load email service module', () => {
    emailService = require('../../server/utils/emailService');
    expect(emailService).toBeDefined();
    expect(emailService.sendAffiliateWelcomeEmail).toBeDefined();
  });
  
  test('should send affiliate welcome email with console transport', async () => {
    process.env.EMAIL_PROVIDER = 'console';
    emailService = require('../../server/utils/emailService');
    
    await emailService.sendAffiliateWelcomeEmail({
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      affiliateId: 'AFF123'
    });
    
    // Console transport should log the email
    expect(consoleLogSpy).toHaveBeenCalledWith('=== EMAIL CONSOLE LOG ===');
    expect(consoleLogSpy).toHaveBeenCalledWith('To:', 'test@example.com');
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Subject:'), expect.any(String));
  });
  
  test('should handle missing affiliate data gracefully', async () => {
    emailService = require('../../server/utils/emailService');
    
    // Call with minimal data
    await emailService.sendAffiliateWelcomeEmail({
      email: 'test@example.com'
    });
    
    // Should still send email without errors
    expect(consoleLogSpy).toHaveBeenCalledWith('=== EMAIL CONSOLE LOG ===');
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });
  
  test('should list all available email functions', () => {
    emailService = require('../../server/utils/emailService');
    
    const expectedFunctions = [
      'sendAffiliateWelcomeEmail',
      'sendAffiliateNewCustomerEmail',
      'sendAffiliateNewOrderEmail',
      'sendAffiliateCommissionEmail',
      'sendAffiliateLostBagEmail',
      'sendAffiliateOrderCancellationEmail',
      'sendAffiliatePasswordResetEmail',
      'sendCustomerWelcomeEmail',
      'sendCustomerOrderConfirmationEmail',
      'sendOrderStatusUpdateEmail',
      'sendOrderCancellationEmail',
      'sendCustomerPasswordResetEmail',
      'sendAdministratorWelcomeEmail',
      'sendAdministratorPasswordResetEmail',
      'sendOperatorWelcomeEmail',
      'sendOperatorPinResetEmail',
      'sendOperatorShiftReminderEmail',
      'sendOperatorPasswordResetEmail'
    ];
    
    expectedFunctions.forEach(func => {
      expect(emailService[func]).toBeDefined();
      expect(typeof emailService[func]).toBe('function');
    });
  });
});