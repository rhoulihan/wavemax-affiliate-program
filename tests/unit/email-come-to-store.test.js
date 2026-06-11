// tests/unit/email-come-to-store.test.js
// Spec §6.5 hold notice: one-time "come to the store" email after the final
// payment reminder. Template lives in the lang-agnostic v2/ dir and must
// resolve for all four languages; locale keys ship in the same commit.
jest.mock('../../server/services/email/transport', () => ({
  sendEmail: jest.fn().mockResolvedValue(true)
}));

const { sendEmail } = require('../../server/services/email/transport');
const SystemConfig = require('../../server/models/SystemConfig');
const emailService = require('../../server/utils/emailService');

describe('sendV2ComeToStoreNotice (spec §6.5)', () => {
  const order = {
    orderId: 'ORD-12345678-1234-1234-1234-123456789012',
    paymentAmount: 42.5,
    actualWeight: 18
  };

  // beforeEach, not beforeAll: the global test harness wipes every collection
  // in afterEach and reseeds SystemConfig defaults, so a one-time upsert would
  // only survive the first test.
  beforeEach(async () => {
    jest.clearAllMocks();
    await SystemConfig.findOneAndUpdate(
      { key: 'store_pickup_address' },
      { $set: { value: '123 Rundberg Ln, Austin, TX 78753', dataType: 'string', category: 'payment', isPublic: true } },
      { upsert: true }
    );
  });

  it.each(['en', 'es', 'pt', 'de'])('resolves the template and sends for language %s', async (lang) => {
    const customer = { firstName: 'Pat', lastName: 'Doe', email: 'pat@test.com', languagePreference: lang };

    const result = await emailService.sendV2ComeToStoreNotice({ customer, order });

    expect(result).toBe(true);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const [to, subject, html] = sendEmail.mock.calls[0];
    expect(to).toBe('pat@test.com');
    expect(subject).toContain('12345678');
    expect(html).toContain('Pat Doe');
    expect(html).toContain('123 Rundberg Ln, Austin, TX 78753');
    expect(html).toContain('42.50');
    expect(html).not.toContain('[EMAIL_CONTENT]'); // not the fallback container
    expect(html).not.toMatch(/{{\w+}}/);           // every placeholder filled
  });

  it('ships payment.holdNotice keys in all four locales (i18n parity)', () => {
    ['en', 'es', 'pt', 'de'].forEach((lang) => {
      const dict = require(`../../public/locales/${lang}/common.json`);
      const hold = dict.payment && dict.payment.holdNotice;
      expect(hold).toBeDefined();
      ['subject', 'heading', 'body', 'amountDue', 'orderNumber', 'storeContact', 'cta'].forEach((k) => {
        expect(typeof hold[k]).toBe('string');
        expect(hold[k].length).toBeGreaterThan(0);
      });
    });
  });
});
