jest.mock('../../server/utils/emailService');

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../server');
const Order = require('../../server/models/Order');
const Customer = require('../../server/models/Customer');
const Affiliate = require('../../server/models/Affiliate');
const Operator = require('../../server/models/Operator');
const Bag = require('../../server/modules/bags/Bag');
const SystemConfig = require('../../server/models/SystemConfig');
const encryptionUtil = require('../../server/utils/encryption');
const roleCodes = require('../../server/utils/roleCodes');
const { getCsrfToken, createAgent } = require('../helpers/csrfHelper');

jest.setTimeout(60000);

async function createWorld({ orderStatus } = {}) {
  const uniq = `${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
  const { salt, hash } = encryptionUtil.hashPassword('FixturePassword417!');

  const affiliate = await Affiliate.create({
    firstName: 'Fix', lastName: 'Affiliate', email: `fixaff${uniq}@example.com`,
    phone: '5125551111', businessName: 'Fixture Wash Co',
    address: '1 Fixture St', city: 'Austin', state: 'TX', zipCode: '78701',
    username: `fixaff${uniq}`, passwordSalt: salt, passwordHash: hash,
    paymentMethod: 'check'
  });

  const customer = await Customer.create({
    affiliateId: affiliate.affiliateId,
    firstName: 'Fix', lastName: 'Customer', email: `fixcust${uniq}@example.com`,
    phone: '5125552222', address: '2 Fixture St', city: 'Austin', state: 'TX', zipCode: '78702',
    username: `fixcust${uniq}`, passwordSalt: salt, passwordHash: hash
  });

  const operator = await Operator.create({
    firstName: 'Fix', lastName: 'Operator', email: `fixop${uniq}@example.com`,
    username: `fixop${uniq}`, password: 'StrongOperatorPass417!',
    createdBy: new mongoose.Types.ObjectId(),
    scanCodeHmac: roleCodes.hmacCode('OPCODE99'), scanCodeSetAt: new Date()
  });

  const token = encryptionUtil.generateToken(16);
  const bag = await Bag.create({
    token, tokenHash: Bag.hashToken(token),
    affiliateId: affiliate.affiliateId, customerId: customer.customerId,
    status: 'active', batchId: `BATCH-${uniq}`, claimedAt: new Date()
  });

  let order = null;
  if (orderStatus) {
    order = await Order.create({
      customerId: customer.customerId,
      affiliateId: affiliate.affiliateId,
      bagId: bag.bagId,
      bagToken: bag.token,
      status: orderStatus,
      pickup: { at: new Date(), by: affiliate.affiliateId, role: 'affiliate' }
    });
  }

  return { affiliate, customer, operator, bag, order, bagToken: token };
}

describe('Public bag-URL operator-code endpoints', () => {
  beforeAll(async () => { await SystemConfig.initializeDefaults(); });

  test('POST /:bagToken/intake with a valid operator code opens a pending order (no CSRF, no JWT)', async () => {
    const { bagToken, operator } = await createWorld({}); // active bag, no order
    const res = await request(app)
      .post(`/api/v1/bags/${bagToken}/intake`)
      .send({ operatorCode: 'OPCODE99' });
    expect(res.status).toBe(201);
    expect(res.body.order.status).toBe('pending');

    const order = await Order.findOne({ bagToken });
    expect(order).toBeTruthy();
    expect(order.status).toBe('pending');
    expect(order.pickup.by).toBe(String(operator._id));
    expect(order.pickup.role).toBe('operator');
  });

  test('POST /:bagToken/advance with a valid operator code advances the order one step', async () => {
    const { bagToken } = await createWorld({ orderStatus: 'pending' });
    const res = await request(app)
      .post(`/api/v1/bags/${bagToken}/advance`)
      .send({ operatorCode: 'OPCODE99' });
    expect(res.status).toBe(200);
    expect(res.body.action).toBe('advance');
    expect(res.body.order.status).toBe('in_progress');
  });

  test('open order -> 409 order_already_open on intake (advance it instead)', async () => {
    const { bagToken } = await createWorld({ orderStatus: 'pending' });
    const res = await request(app)
      .post(`/api/v1/bags/${bagToken}/intake`)
      .send({ operatorCode: 'OPCODE99' });
    expect(res.status).toBe(409);
    expect(res.body.errors.code).toBe('order_already_open');
  });

  test('wrong operator code -> generic 401; lockout after operator_scan_code_max_attempts failures', async () => {
    const { bagToken } = await createWorld({ orderStatus: 'pending' });

    for (let i = 0; i < 5; i++) { // default operator_scan_code_max_attempts = 5
      const res = await request(app)
        .post(`/api/v1/bags/${bagToken}/advance`)
        .send({ operatorCode: 'WRONGC99' });
      expect(res.status).toBe(401);
      expect(res.body.message).not.toMatch(/operator/i); // no role oracle on a bad guess
    }

    // 6th attempt: locked out even with the CORRECT code.
    const locked = await request(app)
      .post(`/api/v1/bags/${bagToken}/advance`)
      .send({ operatorCode: 'OPCODE99' });
    expect(locked.status).toBe(429);
  });

  test('lockout expires with the window (an expired counter no longer locks)', async () => {
    const { bagToken } = await createWorld({ orderStatus: 'pending' });
    for (let i = 0; i < 5; i++) {
      await request(app).post(`/api/v1/bags/${bagToken}/advance`).send({ operatorCode: 'WRONGC99' });
    }
    const locked = await request(app)
      .post(`/api/v1/bags/${bagToken}/advance`)
      .send({ operatorCode: 'OPCODE99' });
    expect(locked.status).toBe(429);

    // Force the window to expire (simulates the 15-min TTL passing).
    await mongoose.connection.collection('ratelimit_bag_codes').updateMany(
      {}, { $set: { _expiresAt: new Date(Date.now() - 1000) } }
    );
    const afterWindow = await request(app)
      .post(`/api/v1/bags/${bagToken}/advance`)
      .send({ operatorCode: 'OPCODE99' });
    expect(afterWindow.status).toBe(200);
  });

  test('a successful code clears the failure counter', async () => {
    const { bagToken } = await createWorld({ orderStatus: 'pending' });
    for (let i = 0; i < 3; i++) {
      await request(app).post(`/api/v1/bags/${bagToken}/advance`).send({ operatorCode: 'NOPE9999' });
    }
    const ok = await request(app)
      .post(`/api/v1/bags/${bagToken}/advance`)
      .send({ operatorCode: 'OPCODE99' });
    expect(ok.status).toBe(200);
  });

  test('the legacy confirm-delivery route is gone (404)', async () => {
    const { bagToken } = await createWorld({ orderStatus: 'out_for_delivery' });
    // confirm-delivery is not on the CSRF-exempt list (it was deleted), so a
    // tokenless POST is rejected at the CSRF layer (403) before routing. Send a
    // valid token so the request reaches the router and proves the route itself
    // is gone (404), not merely CSRF-blocked.
    const agent = createAgent(app);
    const csrfToken = await getCsrfToken(app, agent);
    const res = await agent
      .post(`/api/v1/bags/${bagToken}/confirm-delivery`)
      .set('x-csrf-token', csrfToken)
      .send({ operatorCode: 'OPCODE99' });
    expect(res.status).toBe(404);
  });
});
