// PR 4 — the customer order-status email itemizes pickup instructions + the
// per-affiliate delivery fee + selected paid add-ons (on 'pending'), and the
// affiliate delivery instructions (on 'out_for_delivery'). We mock the email
// transport and call the REAL dispatcher to assert the rendered HTML.
jest.setTimeout(30000);

jest.mock('../../server/services/email/transport', () => ({
  sendEmail: jest.fn().mockResolvedValue(true)
}));

const transport = require('../../server/services/email/transport');
const customerDispatcher = require('../../server/services/email/dispatcher/customer');

describe('customer order-status email — itemized extras', () => {
  const customer = { firstName: 'Pat', email: 'pat@example.com', languagePreference: 'en' };
  const order = { orderId: 'ORD-1' };

  beforeEach(() => jest.clearAllMocks());

  // transport.sendEmail(to, subject, html)
  const lastHtml = () => transport.sendEmail.mock.calls[0][2];

  it('pending: shows pickup instructions, delivery fee, and ONLY paid add-ons', async () => {
    await customerDispatcher.sendOrderStatusUpdateEmail(customer, order, 'pending', {
      pickupInstructions: 'Leave on the porch by 8am',
      deliveryFee: 7.5,
      addOns: [
        { key: 'premium_detergent', name: 'Premium Detergent', price: 5, translations: {} },
        { key: 'fabric_softener', name: 'Fabric Softener', price: 0, translations: {} }
      ]
    });
    const html = lastHtml();
    expect(html).toContain('Pickup instructions');
    expect(html).toContain('Leave on the porch by 8am');
    expect(html).toContain('Delivery fee');
    expect(html).toContain('$7.50');
    expect(html).toContain('Premium options');
    expect(html).toContain('Premium Detergent');
    expect(html).toContain('$5.00');
    expect(html).not.toContain('Fabric Softener'); // free add-on is NOT itemized as premium
  });

  it('pending: omits a zero delivery fee and the premium list when none are paid', async () => {
    await customerDispatcher.sendOrderStatusUpdateEmail(customer, order, 'pending', {
      pickupInstructions: 'Counter, 9-5',
      deliveryFee: 0,
      addOns: [{ key: 'fabric_softener', name: 'Fabric Softener', price: 0, translations: {} }]
    });
    const html = lastHtml();
    expect(html).toContain('Counter, 9-5');
    expect(html).not.toContain('Delivery fee');
    expect(html).not.toContain('Premium options');
  });

  it('out_for_delivery: shows the affiliate delivery instructions', async () => {
    await customerDispatcher.sendOrderStatusUpdateEmail(customer, order, 'out_for_delivery', {
      deliveryInstructions: 'Ring the bell twice'
    });
    const html = lastHtml();
    expect(html).toContain('Delivery instructions');
    expect(html).toContain('Ring the bell twice');
  });

  it('fills the placeholder cleanly when there is nothing to show', async () => {
    await customerDispatcher.sendOrderStatusUpdateEmail(customer, order, 'in_progress', {});
    const html = lastHtml();
    expect(html).not.toContain('[EXTRA_BLOCK]'); // placeholder substituted (to empty)
  });

  it('escapes HTML in affiliate-supplied instructions (no injection)', async () => {
    await customerDispatcher.sendOrderStatusUpdateEmail(customer, order, 'pending', {
      pickupInstructions: '<script>alert(1)</script>'
    });
    const html = lastHtml();
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('renders per-pound add-on prices with a /lb suffix in the email', async () => {
    await customerDispatcher.sendOrderStatusUpdateEmail(customer, order, 'pending', {
      addOns: [{ key: 'pp', name: 'Per Pound Wash', price: 0.5, priceUnit: 'per_lb', translations: {} }]
    });
    const html = lastHtml();
    expect(html).toContain('Per Pound Wash');
    expect(html).toContain('$0.50/lb');
  });

  it('localizes the add-on label and premium heading to the customer language', async () => {
    await customerDispatcher.sendOrderStatusUpdateEmail(
      { ...customer, languagePreference: 'es' }, order, 'pending', {
        addOns: [{ key: 'premium_detergent', name: 'Premium Detergent', price: 5, translations: { es: 'Detergente premium' } }]
      });
    const html = lastHtml();
    expect(html).toContain('Detergente premium');     // localized add-on label
    expect(html).toContain('Opciones premium');       // Spanish PREMIUM_OPTIONS_LABEL
  });
});
