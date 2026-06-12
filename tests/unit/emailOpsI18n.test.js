// Ops dispatcher i18n — Notification A (order-ready) loads language-resolved
// templates; the dead pre-redesign picked-up dispatcher is gone (PR 9
// replaced it with sendOrderOnTheWayEmail).
jest.mock('../../server/services/email/transport', () => ({
  sendEmail: jest.fn(() => Promise.resolve(true))
}));
jest.mock('../../server/services/email/template-manager', () => {
  const actual = jest.requireActual('../../server/services/email/template-manager');
  return {
    ...actual,
    loadTemplate: jest.fn(() => Promise.resolve(
      '<p>[AFFILIATE_NAME][CUSTOMER_NAME][ORDER_ID][TOTAL_WEIGHT]</p>'
    ))
  };
});

const { loadTemplate } = require('../../server/services/email/template-manager');
const { sendEmail } = require('../../server/services/email/transport');
const ops = require('../../server/services/email/dispatcher/ops');

describe('ops dispatcher i18n', () => {
  beforeEach(() => {
    // jest.config.js sets resetMocks: true — re-arm implementations.
    loadTemplate.mockImplementation(() => Promise.resolve(
      '<p>[AFFILIATE_NAME][CUSTOMER_NAME][ORDER_ID][TOTAL_WEIGHT]</p>'
    ));
    sendEmail.mockImplementation(() => Promise.resolve(true));
  });

  it('sendOrderReadyNotification loads the language-resolved order-ready template', async () => {
    await ops.sendOrderReadyNotification('aff@example.com', {
      affiliateName: 'Maria', orderId: 'ORD-1', customerName: 'Cust',
      totalWeight: 12, language: 'pt'
    });
    expect(loadTemplate).toHaveBeenCalledWith('order-ready', 'pt');
    const [to, subject, html] = sendEmail.mock.calls[0];
    expect(to).toBe('aff@example.com');
    expect(subject).toContain('ORD-1');
    expect(html).toContain('Maria');
  });

  it('sendOrderReadyNotification defaults to en', async () => {
    await ops.sendOrderReadyNotification('aff@example.com', {
      affiliateName: 'A', orderId: 'ORD-2', customerName: 'C', totalWeight: 1
    });
    expect(loadTemplate).toHaveBeenCalledWith('order-ready', 'en');
  });

  it('the dead pre-redesign picked-up dispatcher is gone (PR 9 replaced it with sendOrderOnTheWayEmail)', () => {
    expect(ops.sendOrderPickedUpNotification).toBeUndefined();
    expect(typeof ops.sendOrderOnTheWayEmail).toBe('function'); // PR 9's localized replacement
  });
});
