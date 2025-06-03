// Mock email service for testing
const mockEmailService = {
  sendAffiliateWelcomeEmail: jest.fn().mockResolvedValue({ messageId: 'mock-affiliate-welcome' }),
  sendAffiliateNewCustomerEmail: jest.fn().mockResolvedValue({ messageId: 'mock-affiliate-new-customer' }),
  sendAffiliateNewOrderEmail: jest.fn().mockResolvedValue({ messageId: 'mock-affiliate-new-order' }),
  sendAffiliateCommissionEmail: jest.fn().mockResolvedValue({ messageId: 'mock-affiliate-commission' }),
  sendAffiliateLostBagEmail: jest.fn().mockResolvedValue({ messageId: 'mock-affiliate-lost-bag' }),
  sendAffiliateOrderCancellationEmail: jest.fn().mockResolvedValue({ messageId: 'mock-affiliate-order-cancel' }),
  sendAffiliatePasswordResetEmail: jest.fn().mockResolvedValue({ messageId: 'mock-affiliate-password-reset' }),
  sendCustomerWelcomeEmail: jest.fn().mockResolvedValue({ messageId: 'mock-customer-welcome' }),
  sendCustomerOrderConfirmationEmail: jest.fn().mockResolvedValue({ messageId: 'mock-customer-order-confirm' }),
  sendOrderStatusUpdateEmail: jest.fn().mockResolvedValue({ messageId: 'mock-order-status' }),
  sendOrderCancellationEmail: jest.fn().mockResolvedValue({ messageId: 'mock-order-cancel' }),
  sendCustomerPasswordResetEmail: jest.fn().mockResolvedValue({ messageId: 'mock-customer-password-reset' }),
  sendAdministratorWelcomeEmail: jest.fn().mockResolvedValue({ messageId: 'mock-admin-welcome' }),
  sendAdministratorPasswordResetEmail: jest.fn().mockResolvedValue({ messageId: 'mock-admin-password-reset' }),
  sendOperatorWelcomeEmail: jest.fn().mockResolvedValue({ messageId: 'mock-operator-welcome' }),
  sendOperatorPinResetEmail: jest.fn().mockResolvedValue({ messageId: 'mock-operator-pin-reset' }),
  sendOperatorShiftReminderEmail: jest.fn().mockResolvedValue({ messageId: 'mock-operator-shift' }),
  sendOperatorPasswordResetEmail: jest.fn().mockResolvedValue({ messageId: 'mock-operator-password-reset' })
};

module.exports = mockEmailService;