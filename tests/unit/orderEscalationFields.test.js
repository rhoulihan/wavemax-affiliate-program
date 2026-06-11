// tests/unit/orderEscalationFields.test.js
// PR 8 precondition (spec §4.4): the three payment-escalation fields exist.
const Order = require('../../server/models/Order');

describe('Order payment-escalation fields (spec §4.4)', () => {
  afterEach(async () => {
    await Order.deleteMany({});
  });

  it('defaults paymentEscalated/heldAtStore to false and persists holdNoticeSentAt', async () => {
    const token = 'a'.repeat(32);
    const order = await Order.create({
      customerId: 'CUST-esc-1',
      affiliateId: 'AFF-esc-1',
      bagId: 'BAG-esc-1',
      bagToken: token,
      bags: [{ bagToken: token, bagNumber: 1 }],
      actualWeight: 10,
      status: 'in_progress',
      paymentStatus: 'awaiting',
      feeBreakdown: { minimumFee: 10, perBagFee: 2, totalFee: 10, minimumApplied: true }
    });

    expect(order.paymentEscalated).toBe(false);
    expect(order.heldAtStore).toBe(false);

    order.paymentEscalated = true;
    order.holdNoticeSentAt = new Date();
    order.heldAtStore = true;
    await order.save();

    const reread = await Order.findById(order._id);
    expect(reread.paymentEscalated).toBe(true);
    expect(reread.holdNoticeSentAt).toBeInstanceOf(Date);
    expect(reread.heldAtStore).toBe(true);
  });
});
