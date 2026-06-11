// Notification B — customer "your laundry was delivered" (spec §6.6).
// Mocks the transport; asserts per-language subject + filled template.

jest.mock('../../server/services/email/transport', () => ({
  sendEmail: jest.fn().mockResolvedValue(true)
}));

const { sendEmail } = require('../../server/services/email/transport');
const emailService = require('../../server/utils/emailService');

describe('sendCustomerDeliveredEmail', () => {
  beforeEach(() => {
    sendEmail.mockClear();
  });

  const order = {
    orderId: 'ORD-test-1234',
    deliveredAt: new Date('2026-06-09T15:30:00Z'),
    actualTotal: 23.5
  };

  it('exports the dispatcher', () => {
    expect(typeof emailService.sendCustomerDeliveredEmail).toBe('function');
  });

  it('sends the English email with filled placeholders', async () => {
    const customer = {
      firstName: 'Jane', lastName: 'Doe',
      email: 'jane@example.com', languagePreference: 'en'
    };
    await emailService.sendCustomerDeliveredEmail(customer, order);

    expect(sendEmail).toHaveBeenCalledTimes(1);
    const [to, subject, html] = sendEmail.mock.calls[0];
    expect(to).toBe('jane@example.com');
    expect(subject).toContain('Delivered');
    expect(html).toContain('Jane');
    expect(html).toContain('ORD-test-1234');
    expect(html).not.toMatch(/\[[A-Z_]+\]/); // no unfilled placeholders
  });

  it.each([
    ['es', 'entregada'],
    ['pt', 'entregue'],
    ['de', 'geliefert']
  ])('sends the %s subject', async (lang, fragment) => {
    const customer = {
      firstName: 'Jane', lastName: 'Doe',
      email: 'jane@example.com', languagePreference: lang
    };
    await emailService.sendCustomerDeliveredEmail(customer, order);
    const [, subject] = sendEmail.mock.calls[0];
    expect(subject.toLowerCase()).toContain(fragment);
  });

  it('does not throw when transport fails (best-effort)', async () => {
    sendEmail.mockRejectedValueOnce(new Error('smtp down'));
    const customer = { firstName: 'J', lastName: 'D', email: 'j@example.com', languagePreference: 'en' };
    await expect(emailService.sendCustomerDeliveredEmail(customer, order)).resolves.toBe(false);
  });
});
