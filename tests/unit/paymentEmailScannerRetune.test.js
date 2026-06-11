// tests/unit/paymentEmailScannerRetune.test.js
// Spec §6.5: widen exact-match 'awaiting' to $in ['awaiting','confirming'];
// verifyAndUpdateOrder runs the canonical ready gate (Path B).
jest.mock('../../server/services/orderReadyGateService', () => ({
  applyReadyGate: jest.fn().mockResolvedValue(undefined)
}));
jest.mock('../../server/services/mailcowService', () => ({
  searchEmails: jest.fn().mockResolvedValue([]),
  markEmailAsProcessed: jest.fn().mockResolvedValue(true)
}));
jest.mock('../../server/utils/emailService', () => ({
  sendAdminNotification: jest.fn().mockResolvedValue(true)
}));

const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const paymentEmailScanner = require('../../server/services/paymentEmailScanner');
const orderReadyGateService = require('../../server/services/orderReadyGateService');
const Order = require('../../server/models/Order');
const Customer = require('../../server/models/Customer');

async function createOrder(overrides = {}) {
  const token = crypto.randomBytes(16).toString('hex');
  return Order.create({
    customerId: 'CUST-scan-1',
    affiliateId: 'AFF-scan-1',
    bagId: 'BAG-' + uuidv4(),
    bagToken: token,
    bags: [{ bagToken: token, bagNumber: 1 }],
    actualWeight: 20,
    status: 'in_progress',
    paymentStatus: 'awaiting',
    paymentAmount: 50,
    paymentRequestedAt: new Date(),
    feeBreakdown: { minimumFee: 10, perBagFee: 2, totalFee: 10, minimumApplied: true },
    ...overrides
  });
}

describe('paymentEmailScanner retune (spec §6.5)', () => {
  beforeEach(() => jest.clearAllMocks());
  afterEach(async () => {
    await Order.deleteMany({});
    await Customer.deleteMany({});
  });

  describe('findOrderById widening', () => {
    it('matches an awaiting order', async () => {
      const order = await createOrder({ paymentStatus: 'awaiting' });
      const found = await paymentEmailScanner.findOrderById(order.orderId);
      expect(found).not.toBeNull();
      expect(found.orderId).toBe(order.orderId);
    });

    it('matches a confirming order (customer self-reported — the regression)', async () => {
      const order = await createOrder({ paymentStatus: 'confirming' });
      const found = await paymentEmailScanner.findOrderById(order.orderId);
      expect(found).not.toBeNull();
      expect(found.orderId).toBe(order.orderId);
    });

    it('does not match a verified order', async () => {
      const order = await createOrder({ paymentStatus: 'verified' });
      const found = await paymentEmailScanner.findOrderById(order.orderId);
      expect(found).toBeNull();
    });
  });

  describe('verifyAndUpdateOrder gate wiring', () => {
    const paymentFor = (order, amount) => ({
      orderId: order.orderId, orderNumber: order.orderId, provider: 'venmo',
      amount, sender: 'Pat Doe', transactionId: 'TX-1',
      emailId: 1, emailSubject: 'paid', emailDate: new Date(), verifiedAt: new Date()
    });

    it('verifies and runs applyReadyGate (Path B)', async () => {
      const order = await createOrder({ status: 'processed', paymentStatus: 'awaiting' });
      const ok = await paymentEmailScanner.verifyAndUpdateOrder(paymentFor(order, 50));
      expect(ok).toBe(true);
      const updated = await Order.findById(order._id);
      expect(updated.paymentStatus).toBe('verified');
      expect(orderReadyGateService.applyReadyGate).toHaveBeenCalledTimes(1);
      expect(orderReadyGateService.applyReadyGate.mock.calls[0][0].orderId).toBe(order.orderId);
      expect(orderReadyGateService.applyReadyGate.mock.calls[0][1]).toEqual({ trigger: 'scanner_verify' });
    });

    it('still verifies an escalated-but-awaiting order (payment after the 8th reminder)', async () => {
      const order = await createOrder({
        status: 'processed', paymentStatus: 'awaiting',
        paymentEscalated: true, heldAtStore: true, holdNoticeSentAt: new Date()
      });
      const ok = await paymentEmailScanner.verifyAndUpdateOrder(paymentFor(order, 50));
      expect(ok).toBe(true);
      expect((await Order.findById(order._id)).paymentStatus).toBe('verified');
      expect(orderReadyGateService.applyReadyGate).toHaveBeenCalledTimes(1);
    });

    it('does not verify or run the gate on underpayment', async () => {
      const order = await createOrder({ status: 'processed', paymentStatus: 'awaiting' });
      const ok = await paymentEmailScanner.verifyAndUpdateOrder(paymentFor(order, 10));
      expect(ok).toBe(false);
      expect((await Order.findById(order._id)).paymentStatus).toBe('awaiting');
      expect(orderReadyGateService.applyReadyGate).not.toHaveBeenCalled();
    });
  });
});
