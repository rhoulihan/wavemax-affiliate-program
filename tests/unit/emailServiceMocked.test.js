// tests/unit/emailServiceMocked.test.js
// Test email service with proper mocking

// Mock fs module BEFORE requiring anything else
jest.mock('fs', () => ({
  readFile: jest.fn((path, encoding, callback) => {
    // Return a simple template for all requests
    callback(null, '<html><body>Test template [FIRST_NAME] [EMAIL]</body></html>');
  })
}));

jest.mock('util', () => ({
  promisify: (fn) => {
    return (...args) => {
      return new Promise((resolve, reject) => {
        fn(...args, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });
    };
  }
}));

// Now we can test the email service
describe('EmailService with Mocked FS', () => {
  let emailService;
  let consoleLogSpy;
  let consoleErrorSpy;
  
  beforeEach(() => {
    // Clear module cache to ensure fresh load
    jest.resetModules();
    
    // Set up console spies
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    // Set console transport for testing
    process.env.EMAIL_PROVIDER = 'console';
    process.env.EMAIL_FROM = 'test@wavemax.com';
  });
  
  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });
  
  test('should send email using console transport', async () => {
    emailService = require('../../server/utils/emailService');
    
    await emailService.sendAffiliateWelcomeEmail({
      email: 'test@example.com',
      firstName: 'John',
      lastName: 'Doe',
      affiliateId: 'AFF123'
    });
    
    // Verify console transport was used
    expect(consoleLogSpy).toHaveBeenCalledWith('=== EMAIL CONSOLE LOG ===');
    expect(consoleLogSpy).toHaveBeenCalledWith('From:', 'test@wavemax.com');
    expect(consoleLogSpy).toHaveBeenCalledWith('To:', 'test@example.com');
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Subject:'),
      expect.stringContaining('Welcome to WaveMAX')
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Email sent:'),
      expect.stringContaining('console-')
    );
  });
  
  test('should send multiple email types', async () => {
    emailService = require('../../server/utils/emailService');
    
    const emailFunctions = [
      () => emailService.sendAffiliateWelcomeEmail({ email: 'test@example.com' }),
      () => emailService.sendCustomerWelcomeEmail({ email: 'test@example.com' }, 'BAG123', {}),
      () => emailService.sendOperatorWelcomeEmail({ email: 'test@example.com' }, '1234'),
      () => emailService.sendAdministratorWelcomeEmail({ email: 'test@example.com' })
    ];
    
    for (const sendEmail of emailFunctions) {
      await sendEmail();
    }
    
    // Each email should log the console transport output
    const emailLogCalls = consoleLogSpy.mock.calls.filter(
      call => call[0] === '=== EMAIL CONSOLE LOG ==='
    );
    expect(emailLogCalls).toHaveLength(4);
  });
  
  test('should handle errors gracefully', async () => {
    emailService = require('../../server/utils/emailService');
    
    // Send email without required data
    await emailService.sendAffiliateWelcomeEmail({});
    
    // Should log error but not throw
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Error sending affiliate welcome email:'),
      expect.any(Error)
    );
  });
});