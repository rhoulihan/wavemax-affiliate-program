// tests/integration/payment-ready-gate.test.js
// PR 8 integration: both verify paths run the canonical ready gate; the
// reminder cadence escalates-and-holds; confirmPayment no longer escalates.
// Real scanner + real gate + real dispatchers (console transport); only the
// IMAP/mailcow leaf services are mocked.
jest.setTimeout(90000);

jest.mock('../../server/services/mailcowService', () => ({
  searchEmails: jest.fn().mockResolvedValue([]),
  markEmailAsProcessed: jest.fn().mockResolvedValue(true)
}));
jest.mock('../../server/services/imapEmailScanner', () => ({
  connect: jest.fn().mockResolvedValue(false),
  getUnreadEmails: jest.fn().mockResolvedValue([]),
  markAsRead: jest.fn().mockResolvedValue(true),
  disconnect: jest.fn()
}));

const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const app = require('../../server');
const Order = require('../../server/models/Order');
const Customer = require('../../server/models/Customer');
const Affiliate = require('../../server/models/Affiliate');
const Administrator = require('../../server/models/Administrator');
const mailcowService = require('../../server/services/mailcowService');
const paymentEmailScanner = require('../../server/services/paymentEmailScanner');
const paymentVerificationJob = require('../../server/jobs/paymentVerificationJob');
const orderReadyGateService = require('../../server/services/orderReadyGateService');
const emailService = require('../../server/utils/emailService');
const encryptionUtil = require('../../server/utils/encryption');
const { getCsrfToken, createAgent } = require('../helpers/csrfHelper');

const HOUR = 60 * 60 * 1000;
let agent;
let csrfToken;
let adminToken;
let testAffiliate;
let testCustomer;

async function createOrder(overrides = {}) {
  const token = crypto.randomBytes(16).toString('hex');
  return Order.create({
    customerId: testCustomer.customerId,
    affiliateId: testAffiliate.affiliateId,
    bagId: 'BAG-' + uuidv4(),
    bagToken: token,
    bags: [{ bagToken: token, bagNumber: 1 }],
    // 32 lbs @ $1.25 + $10 fee = exactly $50 — the pre-save hook recomputes
    // paymentAmount from weight, so the fixture must derive 50, not assert it.
    actualWeight: 32,
    status: 'in_progress',
    paymentStatus: 'awaiting',
    paymentAmount: 50,
    paymentRequestedAt: new Date(Date.now() - 2 * HOUR),
    paymentLinks: { venmo: 'venmo://stored', paypal: 'https://paypal.me/stored', cashapp: 'https://cash.app/stored' },
    paymentQRCodes: { venmo: 'data:image/png;base64,v', paypal: 'data:image/png;base64,p', cashapp: 'data:image/png;base64,c' },
    feeBreakdown: { minimumFee: 10, perBagFee: 2, totalFee: 10, minimumApplied: true },
    ...overrides
  });
}

// A Venmo notification email that the real parser matches for `order`:
// amount pattern /\$\s*(\d+)\s*[\.\n\s]+(\d{2})/, note pattern
// /WaveMAX\s+Order\s+(ORD-[uuid])/, sender /([A-Za-z\s]+)\s+paid\s+you/.
function venmoEmailFor(order, dollars = '50', cents = '00') {
  return {
    uid: 1,
    id: 1,
    from: 'Venmo <venmo@venmo.com>',
    fromAddress: 'venmo@venmo.com',
    subject: 'John Smith paid you',
    date: new Date().toISOString(),
    text: `John Smith paid you $ ${dollars} . ${cents}\nNote: WaveMAX Order ${order.orderId}\nTransaction ID 1234567890`
  };
}

describe('Payment ready gate (PR 8 integration)', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    mailcowService.searchEmails.mockResolvedValue([]);
    paymentVerificationJob.reminderIntervalMinutes = 60;
    paymentVerificationJob.maxReminders = 8;
    paymentVerificationJob.holdNoticeEnabled = true;

    agent = createAgent(app);
    csrfToken = await getCsrfToken(app, agent);

    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync('testpass123', salt, 1000, 64, 'sha512').toString('hex');
    testAffiliate = await Affiliate.create({
      firstName: 'Gate', lastName: 'Affiliate', email: 'gate-affiliate@test.com', phone: '555-0001',
      address: '123 Test St', city: 'Austin', state: 'TX', zipCode: '78753',
      username: `gateaff${Date.now()}`, passwordHash: hash, passwordSalt: salt, paymentMethod: 'check'
    });
    testCustomer = await Customer.create({
      firstName: 'Gate', lastName: 'Customer', email: 'gate-customer@test.com', phone: '555-0002',
      address: '456 Customer St', city: 'Austin', state: 'TX', zipCode: '78753',
      username: `gatecust${Date.now()}`, passwordHash: hash, passwordSalt: salt,
      affiliateId: testAffiliate.affiliateId
    });

    // Admin for the manual-verify path
    const adminPw = encryptionUtil.hashPassword('GateAdmin2026!Strong');
    await Administrator.create({
      adminId: 'ADM-PR8-1', firstName: 'Gate', lastName: 'Admin',
      email: 'gate-admin@test.com', passwordSalt: adminPw.salt, passwordHash: adminPw.hash,
      permissions: ['all'], isActive: true
    });
    const loginRes = await agent
      .post('/api/v1/auth/administrator/login')
      .set('x-csrf-token', csrfToken)
      .send({ email: 'gate-admin@test.com', password: 'GateAdmin2026!Strong' });
    adminToken = loginRes.body.token;
  });

  afterEach(async () => {
    await Order.deleteMany({});
    await Customer.deleteMany({});
    await Affiliate.deleteMany({});
    await Administrator.deleteMany({});
  });

  describe('confirmPayment (customer "already paid?")', () => {
    it('marks the order confirming WITHOUT escalating to admin (spec §6.5)', async () => {
      const escalateSpy = jest.spyOn(paymentVerificationJob, 'escalateToAdmin');
      const order = await createOrder({ status: 'in_progress', paymentStatus: 'awaiting' });

      const res = await agent
        .post('/api/v1/orders/confirm-payment')
        .set('x-csrf-token', csrfToken)
        .send({ orderId: order._id.toString(), paymentMethod: 'venmo', paymentDetails: 'paid via app' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const updated = await Order.findById(order._id);
      expect(updated.paymentStatus).toBe('confirming');
      expect(escalateSpy).not.toHaveBeenCalled();
      escalateSpy.mockRestore();
    });
  });

  describe('verifyPaymentManually (admin)', () => {
    it('verifies a processed order and promotes it through the gate', async () => {
      const order = await createOrder({ status: 'processed', paymentStatus: 'awaiting', heldAtStore: true });

      const res = await agent
        .put(`/api/v1/orders/${order._id}/verify-payment`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-csrf-token', csrfToken)
        .send({ transactionId: 'MANUAL-TEST-1', notes: 'verified by phone' });

      expect(res.status).toBe(200);
      const updated = await Order.findById(order._id);
      expect(updated.paymentStatus).toBe('verified');
      expect(updated.status).toBe('ready_for_pickup');
      expect(updated.readyForPickupAt).toBeInstanceOf(Date);
      expect(updated.heldAtStore).toBe(false);
    });
  });

  describe('REGRESSION: confirming order auto-verifies and promotes (the $in widening)', () => {
    it('cron run on a confirming+processed order with a matching inbound payment -> verified + ready_for_pickup', async () => {
      const order = await createOrder({ status: 'processed', paymentStatus: 'confirming' });
      mailcowService.searchEmails.mockResolvedValue([venmoEmailFor(order)]);

      await paymentVerificationJob.checkPendingPayments();

      const updated = await Order.findById(order._id);
      expect(updated.paymentStatus).toBe('verified');           // findOrderById matched 'confirming'
      expect(updated.status).toBe('ready_for_pickup');          // gate promoted (Path B)
      expect(updated.readyForPickupAt).toBeInstanceOf(Date);
      expect(updated.heldAtStore).toBe(false);
    });
  });

  describe('REGRESSION: payment after escalation still verifies and promotes', () => {
    it('escalated order is skipped by the reminder cadence but a late payment verifies via the scanner', async () => {
      const order = await createOrder({
        status: 'processed', paymentStatus: 'awaiting',
        paymentEscalated: true, heldAtStore: true,
        holdNoticeSentAt: new Date(Date.now() - HOUR),
        paymentReminderCount: 8,
        paymentLastReminderAt: new Date(Date.now() - 5 * HOUR)
      });

      // 1) Reminder cadence excludes it — no reminder, no second hold notice.
      const reminderSpy = jest.spyOn(emailService, 'sendV2PaymentReminder');
      const holdSpy = jest.spyOn(emailService, 'sendV2ComeToStoreNotice');
      await paymentVerificationJob.checkPendingPayments();
      expect(reminderSpy).not.toHaveBeenCalled();
      expect(holdSpy).not.toHaveBeenCalled();
      reminderSpy.mockRestore();
      holdSpy.mockRestore();

      // 2) ...but the inbox path still verifies the late payment (no "too late" state).
      mailcowService.searchEmails.mockResolvedValue([venmoEmailFor(order)]);
      const verified = await paymentEmailScanner.checkOrderPayment(order._id);
      expect(verified).toBe(true);

      const updated = await Order.findById(order._id);
      expect(updated.paymentStatus).toBe('verified');
      expect(updated.status).toBe('ready_for_pickup');
      expect(updated.heldAtStore).toBe(false);
    });
  });

  describe('REGRESSION: held-at-store and the full escalation run', () => {
    it('processed + unpaid -> heldAtStore=true, NOT ready_for_pickup, readyForPickupAt unset', async () => {
      const order = await createOrder({ status: 'processed', paymentStatus: 'awaiting' });

      const fresh = await Order.findById(order._id);
      await orderReadyGateService.applyReadyGate(fresh, { trigger: 'processed' });

      const updated = await Order.findById(order._id);
      expect(updated.status).toBe('processed');
      expect(updated.heldAtStore).toBe(true);
      expect(updated.readyForPickupAt).toBeUndefined();
    });

    it('a full cron run at reminder 7-of-8 due sends the 8th reminder + hold notice, then goes quiet — never failed', async () => {
      const order = await createOrder({
        status: 'processed', paymentStatus: 'awaiting',
        paymentReminderCount: 7,
        paymentLastReminderAt: new Date(Date.now() - 2 * HOUR)
      });
      const reminderSpy = jest.spyOn(emailService, 'sendV2PaymentReminder').mockResolvedValue(true);
      const holdSpy = jest.spyOn(emailService, 'sendV2ComeToStoreNotice').mockResolvedValue(true);
      const adminSpy = jest.spyOn(emailService, 'sendV2PaymentTimeoutEscalation').mockResolvedValue(true);

      await paymentVerificationJob.checkPendingPayments();   // run 1: 8th reminder + escalation
      await paymentVerificationJob.checkPendingPayments();   // run 2: must be a no-op

      expect(reminderSpy).toHaveBeenCalledTimes(1);
      expect(holdSpy).toHaveBeenCalledTimes(1);
      expect(adminSpy).toHaveBeenCalledTimes(1);

      const updated = await Order.findById(order._id);
      expect(updated.paymentReminderCount).toBe(8);
      expect(updated.paymentEscalated).toBe(true);
      expect(updated.holdNoticeSentAt).toBeInstanceOf(Date);
      expect(updated.heldAtStore).toBe(true);
      expect(updated.paymentStatus).toBe('awaiting');        // NEVER 'failed'

      reminderSpy.mockRestore();
      holdSpy.mockRestore();
      adminSpy.mockRestore();
    });
  });
});
