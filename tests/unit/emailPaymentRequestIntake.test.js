// sendV2PaymentRequest must render cleanly for intake-born orders
// (no pickupDate/numberOfBags on the redesigned Order).

jest.mock('../../server/services/email/transport', () => ({
  sendEmail: jest.fn().mockResolvedValue(true)
}));

const { sendEmail } = require('../../server/services/email/transport');
const { sendV2PaymentRequest } = require('../../server/utils/emailService');

describe('sendV2PaymentRequest (intake-born order)', () => {
  beforeEach(() => sendEmail.mockClear());

  it('renders without Invalid Date or undefined for an order with no pickupDate', async () => {
    const customer = { firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com', languagePreference: 'en' };
    const order = {
      orderId: 'ORD-test-5678',
      actualWeight: 10,
      baseRate: 1.25,
      addOnTotal: 1,
      feeBreakdown: { totalFee: 10 },
      paymentAmount: 23.5,
      intakeAt: new Date('2026-06-09T10:00:00Z'),
      affiliateId: 'AFF-test'
    };
    const paymentLinks = { venmo: 'v', paypal: 'p', cashapp: 'c' };
    const qrCodes = { venmo: 'data:image/png;base64,x', paypal: 'data:image/png;base64,x', cashapp: 'data:image/png;base64,x' };

    await sendV2PaymentRequest({ customer, order, paymentAmount: 23.5, paymentLinks, qrCodes });

    expect(sendEmail).toHaveBeenCalledTimes(1);
    const [, , html] = sendEmail.mock.calls[0];
    expect(html).not.toContain('Invalid Date');
    expect(html).not.toContain('undefined');
  });
});
