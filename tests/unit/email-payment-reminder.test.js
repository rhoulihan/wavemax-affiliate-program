// tests/unit/email-payment-reminder.test.js
// Spec §6.5: fix the broken v2 template path, source the reminder cap from
// SystemConfig (8, not the stale 3), drop the 24h-deadline framing.
jest.mock('../../server/services/email/transport', () => ({
  sendEmail: jest.fn().mockResolvedValue(true)
}));

const { sendEmail } = require('../../server/services/email/transport');
const emailService = require('../../server/utils/emailService');

describe('sendV2PaymentReminder retune (spec §6.5)', () => {
  const order = {
    orderId: 'ORD-12345678-1234-1234-1234-123456789012',
    affiliateId: 'AFF-1',
    paymentAmount: 42.5,
    actualWeight: 18,
    baseRate: 1.25,
    addOnTotal: 0,
    feeBreakdown: { totalFee: 10 },
    paymentRequestedAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
    paymentLinks: { venmo: 'venmo://pay/stored', paypal: 'https://paypal.me/stored', cashapp: 'https://cash.app/stored' },
    paymentQRCodes: { venmo: 'data:image/png;base64,v', paypal: 'data:image/png;base64,p', cashapp: 'data:image/png;base64,c' }
  };
  const customer = { firstName: 'Pat', lastName: 'Doe', email: 'pat@test.com', languagePreference: 'en' };

  beforeEach(() => jest.clearAllMocks());

  it('loads the real v2 template and sends (broken-path regression)', async () => {
    const ok = await emailService.sendV2PaymentReminder({ customer, order, reminderNumber: 1, maxReminders: 8 });
    expect(ok).toBe(true);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const [to, subject, html] = sendEmail.mock.calls[0];
    expect(to).toBe('pat@test.com');
    expect(html).toContain('Reminder #1');
    expect(html).toContain('venmo://pay/stored'); // stored links, passed through
    expect(subject).not.toMatch(/^URGENT/);
  });

  it('is NOT urgent at reminder 2 of 8 (old rule marked >=2 urgent; deadline framing dropped)', async () => {
    await emailService.sendV2PaymentReminder({ customer, order, reminderNumber: 2, maxReminders: 8 });
    const [, subject] = sendEmail.mock.calls[0];
    expect(subject).not.toMatch(/^URGENT/);
  });

  it('IS urgent on the last two reminders of the cap', async () => {
    await emailService.sendV2PaymentReminder({ customer, order, reminderNumber: 7, maxReminders: 8 });
    expect(sendEmail.mock.calls[0][1]).toMatch(/^URGENT/);
    await emailService.sendV2PaymentReminder({ customer, order, reminderNumber: 8, maxReminders: 8 });
    expect(sendEmail.mock.calls[1][1]).toMatch(/^URGENT/);
  });

  it('falls back to the SystemConfig cap when maxReminders is not passed', async () => {
    // payment_reminder_max_attempts defaults to 8 via initializeDefaults (PR 3)
    await emailService.sendV2PaymentReminder({ customer, order, reminderNumber: 2 });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail.mock.calls[0][1]).not.toMatch(/^URGENT/); // 2 < 8-1 — would be URGENT under the stale cap of 3
  });
});
