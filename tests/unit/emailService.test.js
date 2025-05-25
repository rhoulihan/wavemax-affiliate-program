// Create a new file
const emailService = require('../../server/utils/emailService');

// Mock nodemailer
jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: jest.fn().mockResolvedValue({ messageId: 'test-id' })
  })
}));

describe('Email Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should send affiliate welcome email', async () => {
    const affiliate = {
      affiliateId: 'AFF123456',
      firstName: 'Test',
      lastName: 'Affiliate',
      email: 'test@example.com'
    };

    await emailService.sendAffiliateWelcomeEmail(affiliate);

    const nodemailer = require('nodemailer');
    const sendMailMock = nodemailer.createTransport().sendMail;

    expect(sendMailMock).toHaveBeenCalled();
    const emailArgs = sendMailMock.mock.calls[0][0];
    expect(emailArgs.to).toBe(affiliate.email);
    expect(emailArgs.subject).toContain('Welcome');
  });
});