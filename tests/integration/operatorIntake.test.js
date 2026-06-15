const request = require('supertest');
const app = require('../../server');
const mongoose = require('mongoose');
const Operator = require('../../server/models/Operator');
const Administrator = require('../../server/models/Administrator');
const Order = require('../../server/models/Order');
const Customer = require('../../server/models/Customer');
const Affiliate = require('../../server/models/Affiliate');
const Bag = require('../../server/modules/bags/Bag');
const { getCsrfToken, createAgent } = require('../helpers/csrfHelper');
const { ensureTestAffiliate, ensureTestCustomer } = require('../helpers/v2TestHelpers');
const encryptionUtil = require('../../server/utils/encryption');

jest.setTimeout(90000);

describe('POST /api/v1/operators/intake (kiosk)', () => {
  let operatorAgent, adminAgent;
  let operatorToken, operatorCsrfToken, adminToken, adminCsrfToken;
  let testAdmin, testOperator, affiliate, customer, bag;
  const TOKEN = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'; // 32 hex chars

  beforeEach(async () => {
    await Promise.all([
      Operator.deleteMany({}), Administrator.deleteMany({}), Order.deleteMany({}),
      Customer.deleteMany({}), Affiliate.deleteMany({}), Bag.deleteMany({})
    ]);

    operatorAgent = createAgent(app);
    adminAgent = createAgent(app);

    const { salt, hash } = encryptionUtil.hashPassword('CompletelyUniquePassword417!');
    testAdmin = await Administrator.create({
      adminId: 'ADMIN001', firstName: 'Super', lastName: 'User',
      email: 'superuser@wavemax.com', passwordSalt: salt, passwordHash: hash,
      permissions: ['all']
    });
    const adminLogin = await adminAgent
      .post('/api/v1/auth/administrator/login')
      .send({ email: 'superuser@wavemax.com', password: 'CompletelyUniquePassword417!' });
    adminToken = adminLogin.body.token;
    adminCsrfToken = await getCsrfToken(app, adminAgent);

    process.env.OPERATOR_PIN = '1234';
    process.env.DEFAULT_OPERATOR_ID = 'OPR001';
    testOperator = await Operator.create({
      operatorId: 'OPR001', firstName: 'Test', lastName: 'Operator',
      email: 'operator@wavemax.com', username: 'testoperator',
      password: 'OperatorStrongPassword951!',
      shiftStart: '00:00', shiftEnd: '23:59', createdBy: testAdmin._id
    });
    const operatorLogin = await operatorAgent
      .post('/api/v1/auth/operator/login')
      .send({ pinCode: '1234' });
    operatorToken = operatorLogin.body.token;
    operatorCsrfToken = await getCsrfToken(app, operatorAgent);

    affiliate = await ensureTestAffiliate();
    customer = await ensureTestCustomer({ affiliateId: affiliate.affiliateId });
    bag = await Bag.create({
      token: TOKEN, tokenHash: Bag.hashToken(TOKEN),
      affiliateId: affiliate.affiliateId, customerId: customer.customerId,
      status: 'active', batchId: 'BATCH-int'
    });
  });

  function intakeBody(overrides = {}) {
    return {
      bagToken: TOKEN,
      weight: 10,
      addOns: { premiumDetergent: true, fabricSoftener: false, stainRemover: false },
      freshAddOnsFormPlaced: true,
      ...overrides
    };
  }

  it('creates an in_progress order with non-zero totals (silent-zero guard at the API seam)', async () => {
    const res = await operatorAgent
      .post('/api/v1/operators/intake')
      .set('Authorization', `Bearer ${operatorToken}`)
      .set('x-csrf-token', operatorCsrfToken)
      .send(intakeBody());

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.order.status).toBe('in_progress');
    expect(res.body.order.feeBreakdown.totalFee).toBeGreaterThan(0);
    expect(res.body.order.affiliateCommission).toBeGreaterThan(0);
    expect(res.body.order.actualTotal).toBeGreaterThan(0);

    const saved = await Order.findOne({ orderId: res.body.order.orderId });
    expect(saved.bagId).toBe(bag.bagId);
    expect(saved.bagToken).toBe(TOKEN);
    expect(String(saved.intake.weighedBy)).toBe(String(testOperator._id));
    expect(saved.freshAddOnsFormPlaced).toBe(true);
  });

  it('rejects without a CSRF token (403)', async () => {
    const res = await operatorAgent
      .post('/api/v1/operators/intake')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send(intakeBody());
    expect(res.status).toBe(403);
    expect(await Order.countDocuments({})).toBe(0);
  });

  it('rejects a non-operator role (403)', async () => {
    const res = await adminAgent
      .post('/api/v1/operators/intake')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-csrf-token', adminCsrfToken)
      .send(intakeBody());
    expect(res.status).toBe(403);
  });

  it('rejects unauthenticated requests (401)', async () => {
    const agent = createAgent(app);
    const csrf = await getCsrfToken(app, agent);
    const res = await agent
      .post('/api/v1/operators/intake')
      .set('x-csrf-token', csrf)
      .send(intakeBody());
    expect(res.status).toBe(401);
  });

  it('maps service errors: 409 bag_not_active', async () => {
    bag.status = 'issued';
    bag.customerId = null;
    await bag.save();
    const res = await operatorAgent
      .post('/api/v1/operators/intake')
      .set('Authorization', `Bearer ${operatorToken}`)
      .set('x-csrf-token', operatorCsrfToken)
      .send(intakeBody());
    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.errors.code).toBe('bag_not_active');
  });

  it('maps service errors: 409 order_already_open on a second intake', async () => {
    await operatorAgent
      .post('/api/v1/operators/intake')
      .set('Authorization', `Bearer ${operatorToken}`)
      .set('x-csrf-token', operatorCsrfToken)
      .send(intakeBody());
    const res = await operatorAgent
      .post('/api/v1/operators/intake')
      .set('Authorization', `Bearer ${operatorToken}`)
      .set('x-csrf-token', operatorCsrfToken)
      .send(intakeBody({ weight: 12 }));
    expect(res.status).toBe(409);
    expect(res.body.errors.code).toBe('order_already_open');
    expect(await Order.countDocuments({})).toBe(1);
  });

  it('re-intake: picked_up open order is auto-delivered, new order created (201 + reIntake)', async () => {
    const first = await operatorAgent
      .post('/api/v1/operators/intake')
      .set('Authorization', `Bearer ${operatorToken}`)
      .set('x-csrf-token', operatorCsrfToken)
      .send(intakeBody());
    await Order.updateOne({ orderId: first.body.order.orderId }, { $set: { status: 'picked_up' } });

    const res = await operatorAgent
      .post('/api/v1/operators/intake')
      .set('Authorization', `Bearer ${operatorToken}`)
      .set('x-csrf-token', operatorCsrfToken)
      .send(intakeBody({ weight: 8 }));

    expect(res.status).toBe(201);
    expect(res.body.reIntake).toBe(true);
    const prior = await Order.findOne({ orderId: first.body.order.orderId });
    expect(prior.status).toBe('delivered');
    expect(prior.proofOfDelivery.method).toBe('reintake');
    expect(await Order.countDocuments({ status: 'in_progress' })).toBe(1);
  });

  it('400 when bagToken is missing', async () => {
    const res = await operatorAgent
      .post('/api/v1/operators/intake')
      .set('Authorization', `Bearer ${operatorToken}`)
      .set('x-csrf-token', operatorCsrfToken)
      .send(intakeBody({ bagToken: undefined }));
    expect(res.status).toBe(400);
  });
});
