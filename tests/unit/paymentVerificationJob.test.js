// tests/unit/paymentVerificationJob.test.js
// Rewritten for the spec §6.5 retune: decoupled detection/reminder counters,
// time-based 60-min reminders capped at 8, escalate-and-hold (never 'failed'),
// widened cron query, stored-links reuse, applyReadyGate on verify.
jest.mock('../../server/services/paymentEmailScanner', () => ({
  scanForPayments: jest.fn().mockResolvedValue([]),
  checkOrderPayment: jest.fn().mockResolvedValue(false)
}));
jest.mock('../../server/services/paymentLinkService', () => ({
  generatePaymentLinks: jest.fn()
}));
jest.mock('../../server/services/orderReadyGateService', () => ({
  applyReadyGate: jest.fn().mockResolvedValue(undefined)
}));
jest.mock('../../server/utils/emailService', () => ({
  sendV2PaymentReminder: jest.fn().mockResolvedValue(true),
  sendV2ComeToStoreNotice: jest.fn().mockResolvedValue(true),
  sendV2PaymentTimeoutEscalation: jest.fn().mockResolvedValue(true)
}));
jest.mock('../../server/utils/auditLogger', () => ({
  logAuditEvent: jest.fn(),
  AuditEvents: { PAYMENT_ESCALATED: 'PAYMENT_ESCALATED' }
}));

const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const paymentVerificationJob = require('../../server/jobs/paymentVerificationJob');
const paymentEmailScanner = require('../../server/services/paymentEmailScanner');
const paymentLinkService = require('../../server/services/paymentLinkService');
const orderReadyGateService = require('../../server/services/orderReadyGateService');
const emailService = require('../../server/utils/emailService');
const { logAuditEvent } = require('../../server/utils/auditLogger');
const Order = require('../../server/models/Order');
const Customer = require('../../server/models/Customer');
const Affiliate = require('../../server/models/Affiliate');
const SystemConfig = require('../../server/models/SystemConfig');

const HOUR = 60 * 60 * 1000;
let testAffiliate;
let testCustomer;

async function createAwaitingOrder(overrides = {}) {
  const token = crypto.randomBytes(16).toString('hex');
  return Order.create({
    customerId: testCustomer.customerId,
    affiliateId: testAffiliate.affiliateId,
    bagId: 'BAG-' + uuidv4(),
    bagToken: token,
    bags: [{ bagToken: token, bagNumber: 1 }],
    actualWeight: 20,
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

describe('PaymentVerificationJob (spec §6.5 retune)', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    // Deterministic instance config (start() would read the same from SystemConfig)
    paymentVerificationJob.scanIntervalMs = 120000;
    paymentVerificationJob.reminderIntervalMinutes = 60;
    paymentVerificationJob.maxReminders = 8;
    paymentVerificationJob.holdNoticeEnabled = true;

    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync('testpass123', salt, 1000, 64, 'sha512').toString('hex');
    testAffiliate = await Affiliate.create({
      firstName: 'Test', lastName: 'Affiliate', email: 'affiliate@test.com', phone: '555-0001',
      address: '123 Test St', city: 'Austin', state: 'TX', zipCode: '78753',
      username: `affiliate${Date.now()}`, passwordHash: hash, passwordSalt: salt, paymentMethod: 'check'
    });
    testCustomer = await Customer.create({
      firstName: 'Test', lastName: 'Customer', email: 'customer@test.com', phone: '555-0002',
      address: '456 Customer St', city: 'Austin', state: 'TX', zipCode: '78753',
      username: `customer${Date.now()}`, passwordHash: hash, passwordSalt: salt,
      affiliateId: testAffiliate.affiliateId
    });
  });

  afterEach(async () => {
    paymentVerificationJob.stop();
    await Order.deleteMany({});
    await Customer.deleteMany({});
    await Affiliate.deleteMany({});
  });

  describe('start()', () => {
    it('reads the retuned SystemConfig keys (payment_scan_interval_ms, not payment_check_interval)', async () => {
      await paymentVerificationJob.start();
      expect(paymentVerificationJob.scanIntervalMs).toBe(120000);
      expect(paymentVerificationJob.reminderIntervalMinutes).toBe(60);
      expect(paymentVerificationJob.maxReminders).toBe(8);
      expect(paymentVerificationJob.job).not.toBeNull();
    });
  });

  describe('shouldSendReminder (time-based)', () => {
    it('is false when escalated, capped, not yet due, or without a clock base', () => {
      const job = paymentVerificationJob;
      const twoHoursAgo = new Date(Date.now() - 2 * HOUR);
      expect(job.shouldSendReminder({ paymentEscalated: true, paymentReminderCount: 0, paymentRequestedAt: twoHoursAgo })).toBe(false);
      expect(job.shouldSendReminder({ paymentReminderCount: 8, paymentRequestedAt: twoHoursAgo })).toBe(false);
      expect(job.shouldSendReminder({ paymentReminderCount: 0, paymentRequestedAt: new Date(Date.now() - 59 * 60 * 1000) })).toBe(false);
      expect(job.shouldSendReminder({ paymentReminderCount: 0 })).toBe(false);
    });

    it('is true once the interval elapses, clocked from the LAST reminder when one exists', () => {
      const job = paymentVerificationJob;
      expect(job.shouldSendReminder({ paymentReminderCount: 0, paymentRequestedAt: new Date(Date.now() - 61 * 60 * 1000) })).toBe(true);
      // requested 4h ago but reminded 30min ago -> not due
      expect(job.shouldSendReminder({
        paymentReminderCount: 3,
        paymentRequestedAt: new Date(Date.now() - 4 * HOUR),
        paymentLastReminderAt: new Date(Date.now() - 30 * 60 * 1000)
      })).toBe(false);
    });
  });

  describe('maybeSendReminderOrHold', () => {
    it('sends a due reminder reusing STORED links and never calls generatePaymentLinks', async () => {
      const order = await createAwaitingOrder();
      await paymentVerificationJob.maybeSendReminderOrHold(order, testCustomer);
      await order.save();

      expect(emailService.sendV2PaymentReminder).toHaveBeenCalledTimes(1);
      const args = emailService.sendV2PaymentReminder.mock.calls[0][0];
      expect(args.reminderNumber).toBe(1);
      expect(args.maxReminders).toBe(8);
      expect(args.paymentLinks.venmo).toBe('venmo://stored');
      expect(args.qrCodes.venmo).toBe('data:image/png;base64,v');
      expect(paymentLinkService.generatePaymentLinks).not.toHaveBeenCalled();

      const updated = await Order.findById(order._id);
      expect(updated.paymentReminderCount).toBe(1);
      expect(updated.paymentLastReminderAt).toBeInstanceOf(Date);
      expect(updated.paymentEscalated).toBe(false);
    });

    it('does nothing when not due', async () => {
      const order = await createAwaitingOrder({ paymentLastReminderAt: new Date(Date.now() - 10 * 60 * 1000), paymentReminderCount: 2 });
      await paymentVerificationJob.maybeSendReminderOrHold(order, testCustomer);
      expect(emailService.sendV2PaymentReminder).not.toHaveBeenCalled();
      expect(emailService.sendV2ComeToStoreNotice).not.toHaveBeenCalled();
    });

    it('8th reminder escalates: come-to-store once, flags set, admin hook, audit, stays awaiting (NEVER failed)', async () => {
      const order = await createAwaitingOrder({
        status: 'processed',
        paymentReminderCount: 7,
        paymentLastReminderAt: new Date(Date.now() - 2 * HOUR)
      });
      await paymentVerificationJob.maybeSendReminderOrHold(order, testCustomer);
      await order.save();

      expect(emailService.sendV2PaymentReminder).toHaveBeenCalledTimes(1); // reminder #8
      expect(emailService.sendV2ComeToStoreNotice).toHaveBeenCalledTimes(1);
      expect(emailService.sendV2PaymentTimeoutEscalation).toHaveBeenCalledTimes(1); // admin-visibility hook
      expect(logAuditEvent).toHaveBeenCalledWith('PAYMENT_ESCALATED', expect.objectContaining({ orderId: order.orderId }));

      const updated = await Order.findById(order._id);
      expect(updated.paymentReminderCount).toBe(8);
      expect(updated.paymentEscalated).toBe(true);
      expect(updated.holdNoticeSentAt).toBeInstanceOf(Date);
      expect(updated.heldAtStore).toBe(true);
      expect(updated.paymentStatus).toBe('awaiting'); // never 'failed'
    });

    it('escalated orders never get another reminder or a second hold notice', async () => {
      const order = await createAwaitingOrder({
        paymentEscalated: true, heldAtStore: true,
        holdNoticeSentAt: new Date(), paymentReminderCount: 8,
        paymentLastReminderAt: new Date(Date.now() - 5 * HOUR)
      });
      await paymentVerificationJob.maybeSendReminderOrHold(order, testCustomer);
      expect(emailService.sendV2PaymentReminder).not.toHaveBeenCalled();
      expect(emailService.sendV2ComeToStoreNotice).not.toHaveBeenCalled();
      expect(emailService.sendV2PaymentTimeoutEscalation).not.toHaveBeenCalled();
    });

    it('payment_hold_notice_enabled=false suppresses the notice but still escalates and holds', async () => {
      paymentVerificationJob.holdNoticeEnabled = false;
      const order = await createAwaitingOrder({
        paymentReminderCount: 7,
        paymentLastReminderAt: new Date(Date.now() - 2 * HOUR)
      });
      await paymentVerificationJob.maybeSendReminderOrHold(order, testCustomer);
      await order.save();
      expect(emailService.sendV2ComeToStoreNotice).not.toHaveBeenCalled();
      const updated = await Order.findById(order._id);
      expect(updated.paymentEscalated).toBe(true);
      expect(updated.heldAtStore).toBe(true);
      expect(updated.holdNoticeSentAt).toBeUndefined();
    });
  });

  describe('checkPendingPayments cron query', () => {
    it('includes awaiting/in_progress and confirming/processed; excludes escalated, verified, and post-processed statuses', async () => {
      const included1 = await createAwaitingOrder({ status: 'in_progress', paymentStatus: 'awaiting' });
      const included2 = await createAwaitingOrder({ status: 'processed', paymentStatus: 'confirming' });
      await createAwaitingOrder({ status: 'processed', paymentStatus: 'awaiting', paymentEscalated: true });
      await createAwaitingOrder({ status: 'processed', paymentStatus: 'verified' });
      await createAwaitingOrder({ status: 'ready_for_pickup', paymentStatus: 'awaiting' });

      const spy = jest.spyOn(paymentVerificationJob, 'processOrder').mockResolvedValue(undefined);
      await paymentVerificationJob.checkPendingPayments();

      const processedIds = spy.mock.calls.map(([o]) => o.orderId).sort();
      expect(processedIds).toEqual([included1.orderId, included2.orderId].sort());
      spy.mockRestore();
    });
  });

  describe('processOrder', () => {
    it('on verify: runs applyReadyGate with trigger payment_verified and sends no reminder', async () => {
      const order = await createAwaitingOrder({ status: 'processed' });
      paymentEmailScanner.checkOrderPayment.mockResolvedValue(true);

      await paymentVerificationJob.processOrder(order);

      expect(orderReadyGateService.applyReadyGate).toHaveBeenCalledTimes(1);
      expect(orderReadyGateService.applyReadyGate.mock.calls[0][0].orderId).toBe(order.orderId);
      expect(orderReadyGateService.applyReadyGate.mock.calls[0][1]).toEqual({ trigger: 'payment_verified' });
      expect(emailService.sendV2PaymentReminder).not.toHaveBeenCalled();
    });

    it('on no-payment: increments ONLY the detection counter and never flips to failed', async () => {
      const order = await createAwaitingOrder({
        paymentCheckAttempts: 999,                       // huge detection count is irrelevant
        paymentLastReminderAt: new Date(Date.now() - 10 * 60 * 1000), // reminder not due
        paymentReminderCount: 2
      });
      paymentEmailScanner.checkOrderPayment.mockResolvedValue(false);

      await paymentVerificationJob.processOrder(order);

      const updated = await Order.findById(order._id);
      expect(updated.paymentCheckAttempts).toBe(1000);   // detection counter
      expect(updated.paymentReminderCount).toBe(2);      // reminder counter untouched
      expect(updated.paymentStatus).toBe('awaiting');    // NEVER 'failed'
      expect(emailService.sendV2PaymentReminder).not.toHaveBeenCalled();
    });
  });
});
