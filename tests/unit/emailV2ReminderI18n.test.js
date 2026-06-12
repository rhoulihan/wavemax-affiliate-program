// tests/unit/emailV2ReminderI18n.test.js
// PR 11 Task 3: sendV2PaymentReminder must resolve its template through
// template-manager.loadTemplate(name, language) so es/pt/de copies are picked
// up, instead of a direct readFile of a hardcoded English path.
jest.mock('../../server/services/email/transport', () => ({
  sendEmail: jest.fn(() => Promise.resolve(true))
}));
jest.mock('../../server/services/email/template-manager', () => {
  const actual = jest.requireActual('../../server/services/email/template-manager');
  return {
    ...actual,
    loadTemplate: jest.fn(() => Promise.resolve('<p>{{customerName}} {{amount}}</p>'))
  };
});

const { loadTemplate } = require('../../server/services/email/template-manager');
const { sendEmail } = require('../../server/services/email/transport');
const payment = require('../../server/services/email/dispatcher/payment');

describe('sendV2PaymentReminder i18n', () => {
  beforeEach(() => {
    // jest.config.js sets resetMocks: true, which strips even factory
    // implementations — restore them per test.
    loadTemplate.mockResolvedValue('<p>{{customerName}} {{amount}}</p>');
    sendEmail.mockResolvedValue(true);
  });

  it('loads the language-resolved v2/payment-reminder template for the customer language', async () => {
    const customer = { email: 'c@example.com', firstName: 'Ana', lastName: 'García', languagePreference: 'es' };
    const order = {
      orderId: 'ORD-123', actualWeight: 10, paymentRequestedAt: new Date(),
      feeBreakdown: { totalFee: 10 }, affiliateId: 'AFF-1'
    };
    await payment.sendV2PaymentReminder({
      customer, order, reminderNumber: 1, paymentAmount: 25, maxReminders: 8,
      paymentLinks: { venmo: 'v', paypal: 'p', cashapp: 'c' },
      qrCodes: { venmo: '', paypal: '', cashapp: '' }
    });
    expect(loadTemplate).toHaveBeenCalledWith('v2/payment-reminder', 'es');
  });
});
