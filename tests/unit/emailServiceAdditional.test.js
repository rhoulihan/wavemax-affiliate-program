// Test additional uncovered email service functions
// Don't mock fs at the top level to avoid breaking test setup

describe('Email Service - Additional Coverage', () => {
  let mockTransporter;
  let consoleLogSpy;
  let consoleErrorSpy;
  let consoleWarnSpy;
  let emailService;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    
    // Mock console to capture logs
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

    // Mock transporter
    mockTransporter = {
      sendMail: jest.fn().mockResolvedValue({ messageId: 'test-id' })
    };
    
    // Mock nodemailer
    jest.doMock('nodemailer', () => ({
      createTransport: jest.fn(() => mockTransporter)
    }));

    // Set environment variables
    process.env.EMAIL_PROVIDER = 'smtp';
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_SECURE = 'false';
    process.env.SMTP_USER = 'test@example.com';
    process.env.SMTP_PASS = 'password';
    process.env.EMAIL_FROM = 'noreply@example.com';

    // Mock fs for template loading
    jest.doMock('fs', () => ({
      readFile: jest.fn((path, encoding, callback) => {
        if (typeof encoding === 'function') {
          callback = encoding;
          encoding = 'utf8';
        }
        // Return different templates based on path
        if (path.includes('affiliate-commission')) {
          callback(null, '<html>Commission: [commission] for order [order_id]</html>');
        } else if (path.includes('customer-password-reset')) {
        callback(null, '<html>Reset your password [first_name]: [reset_url]</html>');
      } else if (path.includes('administrator-welcome')) {
        callback(null, '<html>Welcome Admin [first_name] ID: [admin_id]</html>');
      } else if (path.includes('administrator-password-reset')) {
        callback(null, '<html>Admin Reset [first_name]: [reset_url]</html>');
      } else if (path.includes('operator-pin-reset')) {
        callback(null, '<html>Operator [first_name] new PIN: [new_pin]</html>');
      } else if (path.includes('operator-shift-reminder')) {
        callback(null, '<html>Shift reminder [first_name]: [shift_date] [shift_time]</html>');
      } else if (path.includes('service-down-alert')) {
        callback(null, '<html>Service [service_name] is down: [error_message]</html>');
      } else if (path.includes('order-ready')) {
        callback(null, '<html>Order [order_id] ready, code: [pickup_code]</html>');
      } else if (path.includes('order-picked-up')) {
        callback(null, '<html>Order [order_id] picked up, total: [total_amount]</html>');
      } else {
        callback(null, '<html>Default template [placeholder]</html>');
      }
    })
  }));

    // Require the actual email service
    emailService = require('../../server/utils/emailService');
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    jest.resetModules();
  });

  describe('Affiliate Commission Email', () => {
    it('should send affiliate commission email successfully', async () => {
      const affiliate = {
        email: 'affiliate@example.com',
        firstName: 'John',
        lastName: 'Doe'
      };
      const order = {
        orderId: 'ORD123',
        actualTotal: 50,
        commission: 5
      };
      const customer = {
        customerId: 'CUST001',
        firstName: 'Jane',
        lastName: 'Smith'
      };

      await emailService.sendAffiliateCommissionEmail(affiliate, order, customer);
      
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'affiliate@example.com',
          subject: 'Commission Earned: Order Delivered',
          html: expect.any(String)
        })
      );
    });

    it('should handle email sending error', async () => {
      mockTransporter.sendMail.mockRejectedValueOnce(new Error('SMTP error'));
      
      const affiliate = { email: 'affiliate@example.com', firstName: 'John' };
      const order = { orderId: 'ORD123', commission: 5 };
      const customer = { customerId: 'CUST001', firstName: 'Jane' };

      await emailService.sendAffiliateCommissionEmail(affiliate, order, customer);
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error sending email'),
        expect.any(Error)
      );
    });
  });

  describe('Customer Password Reset Email', () => {
    it('should send customer password reset email', async () => {
      const customer = {
        email: 'customer@example.com',
        firstName: 'Jane',
        lastName: 'Smith',
        customerId: 'CUST001'
      };
      const resetUrl = 'https://example.com/reset/token123';

      await emailService.sendCustomerPasswordResetEmail(customer, resetUrl);
      
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'customer@example.com',
          subject: expect.stringContaining('Password Reset'),
          html: expect.stringContaining('Reset your password Jane')
        })
      );
    });
  });

  describe('Administrator Emails', () => {
    it('should send administrator welcome email with language support', async () => {
      const admin = {
        email: 'admin@example.com',
        firstName: 'Admin',
        lastName: 'User',
        adminId: 'ADM001',
        permissions: ['system_config', 'operator_management'],
        languagePreference: 'en'
      };

      await emailService.sendAdministratorWelcomeEmail(admin);
      
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'admin@example.com',
          subject: expect.stringContaining('Welcome'),
          html: expect.stringContaining('Welcome Admin Admin')
        })
      );
    });

    it('should send administrator password reset email', async () => {
      const admin = {
        email: 'admin@example.com',
        firstName: 'Admin',
        lastName: 'User',
        adminId: 'ADM001'
      };
      const resetUrl = 'https://example.com/admin/reset/token456';

      await emailService.sendAdministratorPasswordResetEmail(admin, resetUrl);
      
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'admin@example.com',
          subject: expect.stringContaining('Password Reset'),
          html: expect.stringContaining('Admin Reset Admin')
        })
      );
    });
  });

  describe('Operator Emails', () => {
    it('should send operator PIN reset email', async () => {
      const operator = {
        email: 'operator@example.com',
        firstName: 'Op',
        lastName: 'User',
        operatorId: 'OPR001'
      };
      const newPin = '1234';

      await emailService.sendOperatorPinResetEmail(operator, newPin);
      
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'operator@example.com',
          subject: 'Your PIN Has Been Reset',
          html: expect.any(String)
        })
      );
    });

    it('should send operator shift reminder email', async () => {
      const operator = {
        email: 'operator@example.com',
        firstName: 'Op',
        lastName: 'User',
        operatorId: 'OPR001'
      };
      const shift = {
        startTime: '08:00',
        endTime: '16:00',
        date: new Date('2025-01-15'),
        location: 'Main Store'
      };

      await emailService.sendOperatorShiftReminderEmail(operator, shift);
      
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'operator@example.com',
          subject: expect.stringContaining('Shift Reminder')
        })
      );
    });
  });

  describe('System Alerts', () => {
    it('should send service down alert to multiple admins', async () => {
      const alertData = {
        serviceName: 'Payment Gateway',
        error: 'Connection timeout',
        timestamp: new Date(),
        serviceData: {
          lastSuccess: new Date(),
          totalChecks: 100,
          failedChecks: 1,
          uptime: 99
        }
      };

      await emailService.sendServiceDownAlert(alertData);
      
      // Should send one email to admin emails configured in env
      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(1);
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: expect.any(String),
          subject: expect.stringContaining('CRITICAL')
        })
      );
    });

    it('should handle service alert with minimal details', async () => {
      await emailService.sendServiceDownAlert({
        serviceName: 'Unknown Service',
        error: 'Unknown error',
        timestamp: new Date(),
        serviceData: {}
      });
      
      expect(mockTransporter.sendMail).toHaveBeenCalled();
    });
  });


  describe('Template Loading Errors', () => {
    it('should handle template file read errors', async () => {
      // Reset modules and re-mock fs with error
      jest.resetModules();
      jest.doMock('fs', () => ({
        readFile: jest.fn((path, encoding, callback) => {
          if (typeof encoding === 'function') {
            callback = encoding;
          }
          callback(new Error('ENOENT: File not found'));
        })
      }));
      
      const emailServiceWithError = require('../../server/utils/emailService');

      await emailServiceWithError.sendAffiliateCommissionEmail(
        { email: 'test@example.com', firstName: 'Test' },
        { orderId: '123', commission: 10 },
        { customerId: 'CUST001', firstName: 'Customer' }
      );

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error'),
        expect.any(Error)
      );
    });
  });

  describe('Console Email Provider', () => {
    it('should log emails to console when using console provider', async () => {
      jest.resetModules();
      process.env.EMAIL_PROVIDER = 'console';
      
      // Re-mock fs for the new module instance
      jest.doMock('fs', () => ({
        readFile: jest.fn((path, encoding, callback) => {
          if (typeof encoding === 'function') {
            callback = encoding;
          }
          // Provide a template for customer order confirmation
          callback(null, '<html>Order [order_id] Total: [actual_total]</html>');
        })
      }));
      
      // Also need to mock path module
      jest.doMock('path', () => ({
        join: jest.fn((...args) => args.join('/'))
      }));
      
      // No need to mock nodemailer when using console provider
      const consoleEmailService = require('../../server/utils/emailService');
      
      try {
        await consoleEmailService.sendCustomerOrderConfirmationEmail(
          { 
            email: 'customer@example.com', 
            firstName: 'John', 
            languagePreference: 'en' 
          },
          { 
            orderId: 'ORD123', 
            actualTotal: 50, 
            estimatedTotal: 50,
            pickupDate: new Date(),
            pickupTime: 'morning'
          },
          { 
            businessName: 'Test Business',
            firstName: 'Test',
            lastName: 'Affiliate',
            phone: '555-1234',
            email: 'affiliate@example.com'
          }
        );
      } catch (error) {
        console.error('Email sending failed:', error.message);
        console.error('Stack:', error.stack);
      }
      
      expect(consoleLogSpy).toHaveBeenCalledWith('=== EMAIL CONSOLE LOG ===');
      expect(consoleLogSpy).toHaveBeenCalledWith('To:', 'customer@example.com');
    });
  });

});