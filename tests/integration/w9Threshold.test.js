// Spec §6.2 W-9 lifecycle, first transition + spec §8 w9_threshold_usd.
// Real models + SystemConfig (initializeDefaults in tests/setup.js).
jest.setTimeout(90000);

const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const app = require('../../server'); // registers models/config
const Order = require('../../server/models/Order');
const Affiliate = require('../../server/models/Affiliate');
const SystemConfig = require('../../server/models/SystemConfig');
const { getCsrfToken, createAgent } = require('../helpers/csrfHelper');
const { applyW9ThresholdCheck } = require('../../server/modules/onboarding/w9ThresholdService');

async function createAffiliate(overrides = {}) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync('testpass123', salt, 1000, 64, 'sha512').toString('hex');
  return Affiliate.create({
    firstName: 'Thresh', lastName: 'Old', email: `thresh-${Date.now()}-${Math.random()}@test.com`,
    phone: '555-0001', address: '1 Test St', city: 'Austin', state: 'TX', zipCode: '78753',
    username: `thresh${Date.now()}${Math.floor(Math.random() * 1e4)}`,
    passwordHash: hash, passwordSalt: salt, paymentMethod: 'check',
    ...overrides
  });
}

// Commission = actualWeight * baseRate * 0.1 + feeBreakdown.totalFee (Order
// pre-save). Control the magnitude via totalFee; mark realized explicitly.
async function realizedOrder(affiliate, totalFee) {
  const token = crypto.randomBytes(16).toString('hex');
  return Order.create({
    customerId: 'CUST-' + uuidv4(),
    affiliateId: affiliate.affiliateId,
    bagId: 'BAG-' + uuidv4(),
    bagToken: token,
    bags: [{ bagToken: token, bagNumber: 1 }],
    actualWeight: 10,
    status: 'delivered',
    paymentStatus: 'verified',
    commissionRealized: true,
    commissionRealizedAt: new Date(),
    feeBreakdown: { minimumFee: 10, perBagFee: 2, totalFee, minimumApplied: false }
  });
}

describe('w9ThresholdService.applyW9ThresholdCheck', () => {
  afterEach(async () => {
    await Order.deleteMany({});
    await Affiliate.deleteMany({});
    await SystemConfig.initializeDefaults(); // restore any rows the alias test removed
  });

  it('crossing the threshold flips not_required -> required and locks payments (reason w9_required)', async () => {
    const affiliate = await createAffiliate(); // w9Status defaults to not_required
    await realizedOrder(affiliate, 700);       // commission ≈ 701.25 > 600 default

    const result = await applyW9ThresholdCheck(affiliate.affiliateId);
    expect(result.triggered).toBe(true);

    const saved = await Affiliate.findOne({ affiliateId: affiliate.affiliateId });
    expect(saved.w9Status).toBe('required');
    expect(saved.paymentProcessingLocked).toBe(true);
    expect(saved.paymentLockReason).toBe('w9_required');
  });

  it('below the threshold: no flip, no lock', async () => {
    const affiliate = await createAffiliate();
    await realizedOrder(affiliate, 100); // ≈ 101.25 < 600

    const result = await applyW9ThresholdCheck(affiliate.affiliateId);
    expect(result.triggered).toBe(false);

    const saved = await Affiliate.findOne({ affiliateId: affiliate.affiliateId });
    expect(saved.w9Status).toBe('not_required');
    expect(saved.paymentProcessingLocked).toBe(false);
  });

  it('only counts REALIZED commission for the current year', async () => {
    const affiliate = await createAffiliate();
    const o = await realizedOrder(affiliate, 700);
    o.commissionRealizedAt = new Date(Date.UTC(new Date().getUTCFullYear() - 1, 11, 31));
    await o.save();

    const result = await applyW9ThresholdCheck(affiliate.affiliateId);
    expect(result.triggered).toBe(false);
  });

  it.each(['required', 'pending_review', 'on_file', 'rejected'])(
    'is a no-op when w9Status is already %s (idempotent, never double-locks)',
    async (w9Status) => {
      const affiliate = await createAffiliate({ w9Status });
      await realizedOrder(affiliate, 700);

      const result = await applyW9ThresholdCheck(affiliate.affiliateId);
      expect(result.triggered).toBe(false);

      const saved = await Affiliate.findOne({ affiliateId: affiliate.affiliateId });
      expect(saved.w9Status).toBe(w9Status);
      expect(saved.paymentProcessingLocked).toBe(false); // lock untouched
    }
  );

  it('falls back to the legacy w9_earnings_threshold key when w9_threshold_usd is absent (PR 3 handoff)', async () => {
    await SystemConfig.deleteOne({ key: 'w9_threshold_usd' });
    await SystemConfig.updateOne({ key: 'w9_earnings_threshold' }, { $set: { value: 50 } });

    const affiliate = await createAffiliate();
    await realizedOrder(affiliate, 100); // ≈ 101.25 > 50 legacy threshold

    const result = await applyW9ThresholdCheck(affiliate.affiliateId);
    expect(result.triggered).toBe(true);
    expect((await Affiliate.findOne({ affiliateId: affiliate.affiliateId })).w9Status).toBe('required');
  });

  it('never throws — a DB error is swallowed and reported as untriggered (delivery must not block)', async () => {
    const result = await applyW9ThresholdCheck('AFF-does-not-exist');
    expect(result.triggered).toBe(false);
  });
});

describe('threshold trigger fires through the admin delivered override', () => {
  afterEach(async () => {
    await Order.deleteMany({});
    await Affiliate.deleteMany({});
  });

  it('PUT picked_up -> delivered realizes commission and locks the over-threshold affiliate', async () => {
    // build: affiliate (not_required) + a picked_up, paid order whose
    // commission crosses the default $600 threshold; admin PUT -> delivered.
    const affiliate = await createAffiliate();
    const token = crypto.randomBytes(16).toString('hex');
    const order = await Order.create({
      customerId: 'CUST-' + uuidv4(),
      affiliateId: affiliate.affiliateId,
      bagId: 'BAG-' + uuidv4(),
      bagToken: token,
      bags: [{ bagToken: token, bagNumber: 1 }],
      actualWeight: 10,
      status: 'picked_up',
      paymentStatus: 'verified',
      commissionRealized: false,
      feeBreakdown: { minimumFee: 10, perBagFee: 2, totalFee: 700, minimumApplied: false }
    });

    const agent = createAgent(app);
    const csrfToken = await getCsrfToken(app, agent);
    // Same admin JWT pattern as tests/integration/adminManualConfirm.test.js
    const adminToken = jwt.sign(
      { id: new mongoose.Types.ObjectId().toString(), role: 'admin' },
      process.env.JWT_SECRET || 'test-secret'
    );

    const res = await agent
      .put(`/api/v1/orders/${order.orderId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-csrf-token', csrfToken)
      .send({ status: 'delivered' });

    expect(res.status).toBe(200);
    const savedOrder = await Order.findOne({ orderId: order.orderId });
    expect(savedOrder.status).toBe('delivered');
    expect(savedOrder.commissionRealized).toBe(true);

    const savedAffiliate = await Affiliate.findOne({ affiliateId: affiliate.affiliateId });
    expect(savedAffiliate.w9Status).toBe('required');
    expect(savedAffiliate.paymentProcessingLocked).toBe(true);
    expect(savedAffiliate.paymentLockReason).toBe('w9_required');
  });
});
