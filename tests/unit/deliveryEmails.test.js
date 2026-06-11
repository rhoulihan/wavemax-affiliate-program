jest.mock('../../server/services/email/transport', () => ({
  sendEmail: jest.fn().mockResolvedValue(true)
}));

const { sendEmail } = require('../../server/services/email/transport');
const ops = require('../../server/services/email/dispatcher/ops');
// "delivered" lives in PR 7's customer dispatcher — this PR EXTENDS it, never
// re-creates it in ops.js (the dispatcher index spread would shadow one copy).
const customerDispatcher = require('../../server/services/email/dispatcher/customer');

const order = { orderId: 'ORD-test-1', actualWeight: 15 };

describe('PR 9 delivery emails', () => {
  beforeEach(() => sendEmail.mockClear());

  test.each(['en', 'es', 'pt', 'de'])(
    'sendOrderOnTheWayEmail (%s) includes the delivery PIN and order id',
    async (lang) => {
      const customer = {
        firstName: 'Pat', lastName: 'Doe',
        email: 'pat@example.com', languagePreference: lang
      };
      await ops.sendOrderOnTheWayEmail(customer, order, {
        deliveryPin: 'ABC234', affiliateName: 'Austin Wash Co'
      });
      expect(sendEmail).toHaveBeenCalledTimes(1);
      const [to, subject, html] = sendEmail.mock.calls[0];
      expect(to).toBe('pat@example.com');
      expect(subject).toContain('ORD-test-1');
      expect(html).toContain('ABC234');
      expect(html).toContain('Austin Wash Co');
      expect(html).not.toContain('[delivery_pin]'); // placeholder filled
    }
  );

  // Extended PR 7 dispatcher: subjects stay PR 7's per-language EMAIL_TITLEs
  // (pinned by tests/unit/emailCustomerDelivered.test.js) — they do NOT
  // contain the order id; the order id renders in the body.
  test.each([
    ['en', 'delivered'],
    ['es', 'entregada'],
    ['pt', 'entregue'],
    ['de', 'geliefert']
  ])(
    'sendCustomerDeliveredEmail (%s) renders order id and affiliate name',
    async (lang, subjectFragment) => {
      const customer = {
        firstName: 'Pat', lastName: 'Doe',
        email: 'pat@example.com', languagePreference: lang
      };
      await customerDispatcher.sendCustomerDeliveredEmail(customer, order, { affiliateName: 'Austin Wash Co' });
      expect(sendEmail).toHaveBeenCalledTimes(1);
      const [to, subject, html] = sendEmail.mock.calls[0];
      expect(to).toBe('pat@example.com');
      expect(subject.toLowerCase()).toContain(subjectFragment);
      expect(html).toContain('ORD-test-1');
      expect(html).toContain('Austin Wash Co');
      expect(html).not.toMatch(/\[[A-Z_]+\]/); // uppercase token convention, all filled
    }
  );

  test('sendCustomerDeliveredEmail keeps PR 7 contract: two-arg call fills the delivered-by row with the fallback', async () => {
    const customer = { firstName: 'Pat', lastName: 'Doe', email: 'pat@example.com', languagePreference: 'en' };
    await customerDispatcher.sendCustomerDeliveredEmail(customer, order);
    const [, , html] = sendEmail.mock.calls[0];
    expect(html).toContain('Your delivery provider'); // AFFILIATE_NAME fallback
    expect(html).not.toMatch(/\[[A-Z_]+\]/);
  });
});
