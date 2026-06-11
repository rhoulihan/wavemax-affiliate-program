// Spec §5 + §9: held-at-store list view + admin resend of the stored-link
// payment request. CSRF: both paths are unlisted in csrf-config, so the POST
// is default-enforced (token required); the GET is exempt by method.
jest.setTimeout(90000);

jest.mock('../../server/utils/emailService', () => ({
  sendV2PaymentRequest: jest.fn().mockResolvedValue(true)
}));

const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const app = require('../../server');
const Order = require('../../server/models/Order');
const Customer = require('../../server/models/Customer');
const Affiliate = require('../../server/models/Affiliate');
const emailService = require('../../server/utils/emailService');
const { getCsrfToken, createAgent } = require('../helpers/csrfHelper');

let agent;
let csrfToken;
let adminToken, operatorToken, customerToken;
let affiliateA, affiliateB, affiliateAToken;
let customer;

function signToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET || 'test-secret');
}

async function createAffiliate(tag) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync('testpass123', salt, 1000, 64, 'sha512').toString('hex');
  return Affiliate.create({
    firstName: 'Held', lastName: tag, email: `held-${tag}-${Date.now()}@test.com`,
    phone: '555-0001', address: '123 Test St', city: 'Austin', state: 'TX', zipCode: '78753',
    username: `held${tag}${Date.now()}`, passwordHash: hash, passwordSalt: salt, paymentMethod: 'check'
  });
}

async function createOrder(affiliate, overrides = {}) {
  const token = crypto.randomBytes(16).toString('hex');
  return Order.create({
    customerId: customer.customerId,
    affiliateId: affiliate.affiliateId,
    bagId: 'BAG-' + uuidv4(),
    bagToken: token,
    bags: [{ bagToken: token, bagNumber: 1 }],
    // 32 lbs @ $1.25 + $10 fee = exactly $50 — the pre-save hook recomputes
    // paymentAmount from weight, so the fixture must derive 50, not assert it.
    actualWeight: 32,
    status: 'processed',
    paymentStatus: 'awaiting',
    heldAtStore: true,
    paymentAmount: 50,
    paymentRequestedAt: new Date(),
    paymentLinks: { venmo: 'venmo://stored', paypal: 'https://paypal.me/stored', cashapp: 'https://cash.app/stored' },
    paymentQRCodes: { venmo: 'data:image/png;base64,v', paypal: 'data:image/png;base64,p', cashapp: 'data:image/png;base64,c' },
    feeBreakdown: { minimumFee: 10, perBagFee: 2, totalFee: 10, minimumApplied: true },
    ...overrides
  });
}

describe('Held-orders view + resend payment request (PR 8)', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await Promise.all([Order.deleteMany({}), Customer.deleteMany({}), Affiliate.deleteMany({})]);

    agent = createAgent(app);
    csrfToken = await getCsrfToken(app, agent);

    affiliateA = await createAffiliate('A');
    affiliateB = await createAffiliate('B');

    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync('testpass123', salt, 1000, 64, 'sha512').toString('hex');
    customer = await Customer.create({
      firstName: 'Held', lastName: 'Customer', email: `held-cust-${Date.now()}@test.com`,
      phone: '555-0002', address: '456 Customer St', city: 'Austin', state: 'TX', zipCode: '78753',
      username: `heldcust${Date.now()}`, passwordHash: hash, passwordSalt: salt,
      affiliateId: affiliateA.affiliateId
    });

    adminToken = signToken({ id: 'admin-held-1', role: 'admin' });
    operatorToken = signToken({ id: 'op-held-1', role: 'operator' });
    customerToken = signToken({ id: customer._id, customerId: customer.customerId, role: 'customer' });
    affiliateAToken = signToken({ id: affiliateA._id, affiliateId: affiliateA.affiliateId, role: 'affiliate' });
  });

  describe('GET /api/v1/orders/held', () => {
    it('admin sees every processed+held order and nothing else', async () => {
      const held = await createOrder(affiliateA);
      await createOrder(affiliateB, { heldAtStore: true });
      await createOrder(affiliateA, { status: 'ready_for_pickup', heldAtStore: false, paymentStatus: 'verified' });
      await createOrder(affiliateA, { status: 'in_progress', heldAtStore: false });

      const res = await request(app)
        .get('/api/v1/orders/held')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.orders).toHaveLength(2);
      expect(res.body.orders.map(o => o.orderId)).toContain(held.orderId);
      for (const o of res.body.orders) {
        expect(o.status).toBe('processed');
        expect(o.heldAtStore).toBe(true);
      }
    });

    it('operator gets the same unscoped view (spec §9)', async () => {
      await createOrder(affiliateA);
      const res = await request(app)
        .get('/api/v1/orders/held')
        .set('Authorization', `Bearer ${operatorToken}`);
      expect(res.status).toBe(200);
      expect(res.body.orders).toHaveLength(1);
    });

    it('affiliate is scoped to own orders', async () => {
      await createOrder(affiliateA);
      await createOrder(affiliateB);
      const res = await request(app)
        .get('/api/v1/orders/held')
        .set('Authorization', `Bearer ${affiliateAToken}`);
      expect(res.status).toBe(200);
      expect(res.body.orders).toHaveLength(1);
      expect(res.body.orders[0].affiliateId).toBe(affiliateA.affiliateId);
    });

    it('customer role is rejected (403)', async () => {
      const res = await request(app)
        .get('/api/v1/orders/held')
        .set('Authorization', `Bearer ${customerToken}`);
      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/v1/orders/:orderId/resend-payment-request', () => {
    it('admin resend reuses the STORED links and resets the reminder clock', async () => {
      const order = await createOrder(affiliateA, {
        paymentReminderCount: 8,
        paymentLastReminderAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
        paymentEscalated: true,
        holdNoticeSentAt: new Date()
      });

      const res = await agent
        .post(`/api/v1/orders/${order.orderId}/resend-payment-request`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-csrf-token', csrfToken)
        .send({});
      expect(res.status).toBe(200);

      expect(emailService.sendV2PaymentRequest).toHaveBeenCalledTimes(1);
      const callArg = emailService.sendV2PaymentRequest.mock.calls[0][0];
      expect(callArg.paymentLinks.venmo).toBe('venmo://stored'); // never regenerated
      expect(callArg.paymentAmount).toBeCloseTo(50, 2);

      const updated = await Order.findById(order._id);
      expect(updated.paymentReminderCount).toBe(0);
      expect(updated.paymentLastReminderAt.getTime()).toBeGreaterThan(Date.now() - 60 * 1000);
      expect(updated.paymentEscalated).toBe(false);              // cadence resumes
      expect(updated.holdNoticeSentAt).toBeInstanceOf(Date);     // hold notice stays one-time
      expect(updated.paymentLinks.venmo).toBe('venmo://stored');
    });

    it('rejects without a CSRF token (403, default-enforce)', async () => {
      const order = await createOrder(affiliateA);
      const res = await request(app)
        .post(`/api/v1/orders/${order.orderId}/resend-payment-request`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});
      expect(res.status).toBe(403);
      expect(emailService.sendV2PaymentRequest).not.toHaveBeenCalled();
    });

    it('rejects non-admin roles (403)', async () => {
      const order = await createOrder(affiliateA);
      for (const token of [affiliateAToken, operatorToken, customerToken]) {
        const res = await agent
          .post(`/api/v1/orders/${order.orderId}/resend-payment-request`)
          .set('Authorization', `Bearer ${token}`)
          .set('x-csrf-token', csrfToken)
          .send({});
        expect(res.status).toBe(403);
      }
      expect(emailService.sendV2PaymentRequest).not.toHaveBeenCalled();
    });

    it('400 on an already-verified order; 404 on an unknown orderId', async () => {
      const paid = await createOrder(affiliateA, { paymentStatus: 'verified', heldAtStore: false });
      const resPaid = await agent
        .post(`/api/v1/orders/${paid.orderId}/resend-payment-request`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-csrf-token', csrfToken)
        .send({});
      expect(resPaid.status).toBe(400);

      const resMissing = await agent
        .post('/api/v1/orders/ORD-does-not-exist/resend-payment-request')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-csrf-token', csrfToken)
        .send({});
      expect(resMissing.status).toBe(404);
    });
  });
});
