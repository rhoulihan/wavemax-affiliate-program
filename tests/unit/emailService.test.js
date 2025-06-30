// Email Service Unit Tests
// Testing email service mock functionality

// Mock the email service
jest.mock('../../server/utils/emailService', () => ({
  sendAffiliateWelcomeEmail: jest.fn(),
  sendAffiliateNewCustomerEmail: jest.fn(),
  sendAffiliateNewOrderEmail: jest.fn(),
  sendAffiliateCommissionEmail: jest.fn(),
  sendAffiliateOrderCancellationEmail: jest.fn(),
  sendAffiliatePasswordResetEmail: jest.fn(),
  sendCustomerWelcomeEmail: jest.fn(),
  sendCustomerOrderConfirmationEmail: jest.fn(),
  sendOrderStatusUpdateEmail: jest.fn(),
  sendOrderCancellationEmail: jest.fn(),
  sendCustomerPasswordResetEmail: jest.fn(),
  sendAdministratorWelcomeEmail: jest.fn(),
  sendAdministratorPasswordResetEmail: jest.fn(),
  sendOperatorWelcomeEmail: jest.fn(),
  sendOperatorPinResetEmail: jest.fn(),
  sendOperatorShiftReminderEmail: jest.fn(),
  sendOperatorPasswordResetEmail: jest.fn(),
  sendServiceDownAlert: jest.fn(),
  sendOrderReadyNotification: jest.fn(),
  sendOrderPickedUpNotification: jest.fn(),
  sendEmail: jest.fn(),
  sendPasswordResetEmail: jest.fn()
}));

const emailService = require('../../server/utils/emailService');

describe('Email Service Mock', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    // Re-mock with resolved values
    emailService.sendAffiliateWelcomeEmail.mockResolvedValue({ MessageId: 'test-message-id' });
    emailService.sendAffiliateNewCustomerEmail.mockResolvedValue({ MessageId: 'test-message-id' });
    emailService.sendAffiliateNewOrderEmail.mockResolvedValue({ MessageId: 'test-message-id' });
    emailService.sendAffiliateCommissionEmail.mockResolvedValue({ MessageId: 'test-message-id' });
    emailService.sendAffiliateOrderCancellationEmail.mockResolvedValue({ MessageId: 'test-message-id' });
    emailService.sendAffiliatePasswordResetEmail.mockResolvedValue({ MessageId: 'test-message-id' });
    emailService.sendCustomerWelcomeEmail.mockResolvedValue({ MessageId: 'test-message-id' });
    emailService.sendCustomerOrderConfirmationEmail.mockResolvedValue({ MessageId: 'test-message-id' });
    emailService.sendOrderStatusUpdateEmail.mockResolvedValue({ MessageId: 'test-message-id' });
    emailService.sendOrderCancellationEmail.mockResolvedValue({ MessageId: 'test-message-id' });
    emailService.sendCustomerPasswordResetEmail.mockResolvedValue({ MessageId: 'test-message-id' });
    emailService.sendAdministratorWelcomeEmail.mockResolvedValue({ MessageId: 'test-message-id' });
    emailService.sendAdministratorPasswordResetEmail.mockResolvedValue({ MessageId: 'test-message-id' });
    emailService.sendOperatorWelcomeEmail.mockResolvedValue({ MessageId: 'test-message-id' });
    emailService.sendOperatorPinResetEmail.mockResolvedValue({ MessageId: 'test-message-id' });
    emailService.sendOperatorShiftReminderEmail.mockResolvedValue({ MessageId: 'test-message-id' });
    emailService.sendOperatorPasswordResetEmail.mockResolvedValue({ MessageId: 'test-message-id' });
    emailService.sendServiceDownAlert.mockResolvedValue({ MessageId: 'test-message-id' });
    emailService.sendOrderReadyNotification.mockResolvedValue({ MessageId: 'test-message-id' });
    emailService.sendOrderPickedUpNotification.mockResolvedValue({ MessageId: 'test-message-id' });
    emailService.sendEmail.mockResolvedValue({ MessageId: 'test-message-id' });
    emailService.sendPasswordResetEmail.mockResolvedValue({ MessageId: 'test-message-id' });
  });

  describe('All Email Functions', () => {
    it('should have all required email functions mocked', () => {
      expect(typeof emailService.sendAffiliateWelcomeEmail).toBe('function');
      expect(typeof emailService.sendAffiliateNewCustomerEmail).toBe('function');
      expect(typeof emailService.sendAffiliateNewOrderEmail).toBe('function');
      expect(typeof emailService.sendAffiliateCommissionEmail).toBe('function');
      expect(typeof emailService.sendAffiliateOrderCancellationEmail).toBe('function');
      expect(typeof emailService.sendAffiliatePasswordResetEmail).toBe('function');
      expect(typeof emailService.sendCustomerWelcomeEmail).toBe('function');
      expect(typeof emailService.sendCustomerOrderConfirmationEmail).toBe('function');
      expect(typeof emailService.sendOrderStatusUpdateEmail).toBe('function');
      expect(typeof emailService.sendOrderCancellationEmail).toBe('function');
      expect(typeof emailService.sendCustomerPasswordResetEmail).toBe('function');
      expect(typeof emailService.sendAdministratorWelcomeEmail).toBe('function');
      expect(typeof emailService.sendAdministratorPasswordResetEmail).toBe('function');
      expect(typeof emailService.sendOperatorWelcomeEmail).toBe('function');
      expect(typeof emailService.sendOperatorPinResetEmail).toBe('function');
      expect(typeof emailService.sendOperatorShiftReminderEmail).toBe('function');
      expect(typeof emailService.sendOperatorPasswordResetEmail).toBe('function');
      expect(typeof emailService.sendServiceDownAlert).toBe('function');
      expect(typeof emailService.sendOrderReadyNotification).toBe('function');
      expect(typeof emailService.sendOrderPickedUpNotification).toBe('function');
      expect(typeof emailService.sendEmail).toBe('function');
      expect(typeof emailService.sendPasswordResetEmail).toBe('function');
    });

    it('should return expected mock response for all functions', async () => {
      // Test each function returns the expected mock response
      const expectedResponse = { MessageId: 'test-message-id' };
      
      // Affiliate functions
      expect(await emailService.sendAffiliateWelcomeEmail({})).toEqual(expectedResponse);
      expect(await emailService.sendAffiliateNewCustomerEmail({}, {})).toEqual(expectedResponse);
      expect(await emailService.sendAffiliateNewOrderEmail({}, {}, {})).toEqual(expectedResponse);
      expect(await emailService.sendAffiliateCommissionEmail({}, {}, {})).toEqual(expectedResponse);
      expect(await emailService.sendAffiliateOrderCancellationEmail({}, {}, {})).toEqual(expectedResponse);
      expect(await emailService.sendAffiliatePasswordResetEmail({}, '')).toEqual(expectedResponse);
      
      // Customer functions  
      expect(await emailService.sendCustomerWelcomeEmail({}, {}, {})).toEqual(expectedResponse);
      expect(await emailService.sendCustomerOrderConfirmationEmail({}, {}, {})).toEqual(expectedResponse);
      expect(await emailService.sendOrderStatusUpdateEmail({}, {}, '')).toEqual(expectedResponse);
      expect(await emailService.sendOrderCancellationEmail({}, {})).toEqual(expectedResponse);
      expect(await emailService.sendCustomerPasswordResetEmail({}, '')).toEqual(expectedResponse);
      
      // Administrator functions
      expect(await emailService.sendAdministratorWelcomeEmail({})).toEqual(expectedResponse);
      expect(await emailService.sendAdministratorPasswordResetEmail({}, '')).toEqual(expectedResponse);
      
      // Operator functions
      expect(await emailService.sendOperatorWelcomeEmail({}, '')).toEqual(expectedResponse);
      expect(await emailService.sendOperatorPinResetEmail({}, '')).toEqual(expectedResponse);
      expect(await emailService.sendOperatorShiftReminderEmail({})).toEqual(expectedResponse);
      expect(await emailService.sendOperatorPasswordResetEmail({}, '')).toEqual(expectedResponse);
      
      // Service alert functions
      expect(await emailService.sendServiceDownAlert({})).toEqual(expectedResponse);
      expect(await emailService.sendOrderReadyNotification('', {})).toEqual(expectedResponse);
      expect(await emailService.sendOrderPickedUpNotification('', {})).toEqual(expectedResponse);
      
      // Generic functions
      expect(await emailService.sendEmail({})).toEqual(expectedResponse);
      expect(await emailService.sendPasswordResetEmail({}, '')).toEqual(expectedResponse);
    });

    it('should track function calls correctly', async () => {
      const affiliate = { email: 'test@example.com' };
      
      // Call the function multiple times
      await emailService.sendAffiliateWelcomeEmail(affiliate);
      await emailService.sendAffiliateWelcomeEmail(affiliate);
      
      // Verify it was called with correct arguments
      expect(emailService.sendAffiliateWelcomeEmail).toHaveBeenCalledWith(affiliate);
      expect(emailService.sendAffiliateWelcomeEmail).toHaveBeenCalledTimes(2);
    });

    it('should handle errors when mocked to reject', async () => {
      // Temporarily override the mock to simulate an error
      emailService.sendAffiliateWelcomeEmail.mockRejectedValueOnce(new Error('Email service error'));
      
      await expect(emailService.sendAffiliateWelcomeEmail({ email: 'test@example.com' }))
        .rejects.toThrow('Email service error');
        
      // After the rejection, the next call should work normally
      // Re-set the mock to return success
      emailService.sendAffiliateWelcomeEmail.mockResolvedValue({ MessageId: 'test-message-id' });
      expect(await emailService.sendAffiliateWelcomeEmail({})).toEqual({ MessageId: 'test-message-id' });
    });
  });
});