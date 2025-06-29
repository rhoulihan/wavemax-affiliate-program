// Email Service Unit Tests
// Testing email service mock functionality

const emailService = require('../../server/utils/emailService');

describe('Email Service Mock', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
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
        
      // Verify the mock is restored
      expect(await emailService.sendAffiliateWelcomeEmail({})).toEqual({ MessageId: 'test-message-id' });
    });
  });
});