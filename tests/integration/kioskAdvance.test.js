jest.mock('../../server/utils/emailService');

const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const app = require('../../server');
const Order = require('../../server/models/Order');
const Customer = require('../../server/models/Customer');
const Affiliate = require('../../server/models/Affiliate');
const Operator = require('../../server/models/Operator');
const Bag = require('../../server/modules/bags/Bag');
const encryptionUtil = require('../../server/utils/encryption');
const roleCodes = require('../../server/utils/roleCodes');
const { getCsrfToken, createAgent } = require('../helpers/csrfHelper');

jest.setTimeout(60000);

// ---- shared fixture (from tests/integration/operatorScanOut.test.js) -------
async function createWorld({ orderStatus } = {}) {
  const uniq = `${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
  const { salt, hash } = encryptionUtil.hashPassword('FixturePassword417!');

  const affiliate = await Affiliate.create({
    firstName: 'Fix', lastName: 'Affiliate', email: `fixaff${uniq}@example.com`,
    phone: '5125551111', businessName: 'Fixture Wash Co',
    address: '1 Fixture St', city: 'Austin', state: 'TX', zipCode: '78701',
    serviceLatitude: 30.27, serviceLongitude: -97.74, // dropped silently if removed
    username: `fixaff${uniq}`, passwordSalt: salt, passwordHash: hash,
    paymentMethod: 'check',
    affiliateDeliveryCodeHash: roleCodes.hashCode('VENDOR'),
    affiliateDeliveryCodeSetAt: new Date()
  });

  const customer = await Customer.create({
    affiliateId: affiliate.affiliateId,
    firstName: 'Fix', lastName: 'Customer', email: `fixcust${uniq}@example.com`,
    phone: '5125552222', address: '2 Fixture St', city: 'Austin', state: 'TX', zipCode: '78702',
    username: `fixcust${uniq}`, passwordSalt: salt, passwordHash: hash,
    deliveryPinHash: roleCodes.hashCode('PINPIN'), deliveryPinSetAt: new Date()
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
      actualWeight: 15,
      feeBreakdown: { numberOfBags: 1, minimumFee: 25, perBagFee: 5, totalFee: 25, minimumApplied: true },
      bags: [{
        bagToken: bag.token, bagNumber: 1, status: 'intake',
        scannedAt: { intake: new Date() }, scannedBy: { intake: operator._id }
      }],
      intake: { weight: 15, weighedAt: new Date(), weighedBy: operator._id }
    });
  }

  return { affiliate, customer, operator, bag, order, bagToken: token };
}
// ---------------------------------------------------------------------------

function operatorToken(operator) {
  return jwt.sign({ id: operator._id.toString(), role: 'operator' },
    process.env.JWT_SECRET, { expiresIn: '1h' });
}

describe('Kiosk advance endpoint', () => {
  test('POST /api/v1/operators/advance (JWT + CSRF) advances in_progress -> ready_for_pickup', async () => {
    const { bagToken, operator } = await createWorld({
      orderStatus: 'in_progress'
    });
    const agent = createAgent(app);
    const csrfToken = await getCsrfToken(app, agent);

    const res = await agent
      .post('/api/v1/operators/advance')
      .set('Authorization', `Bearer ${operatorToken(operator)}`)
      .set('x-csrf-token', csrfToken)
      .send({ bagToken });
    expect(res.status).toBe(200);
    expect(res.body.action).toBe('ready_for_pickup');
  });

  test('legacy /scan-processed delegates to advance (accepts the printed claim URL in bagToken)', async () => {
    const { bagToken, operator } = await createWorld({
      orderStatus: 'in_progress'
    });
    const agent = createAgent(app);
    const csrfToken = await getCsrfToken(app, agent);

    // The one-sprint payload-key tolerance (bagToken||bagId||qrCode) ended —
    // only `bagToken` is read; it may carry the raw token or the printed URL.
    const res = await agent
      .post('/api/v1/operators/scan-processed')
      .set('Authorization', `Bearer ${operatorToken(operator)}`)
      .set('x-csrf-token', csrfToken)
      .send({ bagToken: `https://wavemax.promo/embed-app-v2.html?route=/claim&bag=${bagToken}` });
    expect(res.status).toBe(200);
    expect(res.body.action).toBe('ready_for_pickup');
  });

  test('legacy qrCode payload key is no longer accepted (400)', async () => {
    const { bagToken, operator } = await createWorld({
      orderStatus: 'in_progress'
    });
    const agent = createAgent(app);
    const csrfToken = await getCsrfToken(app, agent);

    const res = await agent
      .post('/api/v1/operators/advance')
      .set('Authorization', `Bearer ${operatorToken(operator)}`)
      .set('x-csrf-token', csrfToken)
      .send({ qrCode: bagToken });
    expect(res.status).toBe(400);
  });

  test('advance on a processed order heals it to ready_for_pickup', async () => {
    const { bagToken, operator } = await createWorld({
      orderStatus: 'processed'
    });
    const agent = createAgent(app);
    const csrfToken = await getCsrfToken(app, agent);

    const res = await agent
      .post('/api/v1/operators/advance')
      .set('Authorization', `Bearer ${operatorToken(operator)}`)
      .set('x-csrf-token', csrfToken)
      .send({ bagToken });
    expect(res.status).toBe(200);
    expect(res.body.order.status).toBe('ready_for_pickup');
  });

  test('advance requires the operator role', async () => {
    const { bagToken, customer } = await createWorld({ orderStatus: 'in_progress' });
    const agent = createAgent(app);
    const csrfToken = await getCsrfToken(app, agent);
    const customerJwt = jwt.sign(
      { id: customer._id.toString(), customerId: customer.customerId, role: 'customer' },
      process.env.JWT_SECRET, { expiresIn: '1h' });

    const res = await agent
      .post('/api/v1/operators/advance')
      .set('Authorization', `Bearer ${customerJwt}`)
      .set('x-csrf-token', csrfToken)
      .send({ bagToken });
    expect(res.status).toBe(403);
  });

  test('legacy pickup endpoints are gone (404) — incl. the markOrderReady gate bypass', async () => {
    const { operator } = await createWorld({});
    const agent = createAgent(app);
    const csrfToken = await getCsrfToken(app, agent);
    const auth = { Authorization: `Bearer ${operatorToken(operator)}` };

    for (const [method, path] of [
      ['post', '/api/v1/operators/complete-pickup'],
      ['post', '/api/v1/operators/confirm-pickup'],
      // GATE BYPASS regression pin: this route set status=processed and
      // emailed the affiliate WITHOUT the payment gate. It must stay dead.
      ['post', '/api/v1/operators/orders/ORD-x/ready'],
      ['post', '/api/v1/operators/orders/ORD-x/process-bag']
    ]) {
      const res = await agent[method](path).set(auth).set('x-csrf-token', csrfToken).send({});
      expect(res.status).toBe(404);
      // The old handlers ALSO 404'd on unknown orderIds — make the pin real:
      // a router miss never carries the legacy handlers' error payloads.
      expect(res.body.error).not.toBe('Order not found');
    }

    // Belt and braces: the controller exports themselves are deleted, so the
    // routes cannot be silently re-wired.
    const operatorController = require('../../server/controllers/operatorController');
    for (const fn of ['markOrderReady', 'completePickup', 'confirmPickup', 'markBagProcessed']) {
      expect(operatorController[fn]).toBeUndefined();
    }
  });
});
