// Open-order guard (spec §3/§6): at most one open order per bag is enforced by
// the read-then-write guard in the transition service. There is no DB-level
// partial unique index backstop (the Oracle ADB Mongo API does not support it,
// and the volume does not warrant it), so this covers the realistic sequential
// case — a second create-pending while an order is already open returns a clean
// 409 order_already_open — and that a fresh order is allowed once the prior one
// closes.

jest.mock('../../server/utils/emailService');

const jwt = require('jsonwebtoken');
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

async function createWorld() {
  const uniq = `${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
  const { salt, hash } = encryptionUtil.hashPassword('FixturePassword417!');

  const affiliate = await Affiliate.create({
    firstName: 'Race', lastName: 'Affiliate', email: `raceaff${uniq}@example.com`,
    phone: '5125551111', businessName: 'Race Wash Co',
    address: '1 Race St', city: 'Austin', state: 'TX', zipCode: '78701',
    username: `raceaff${uniq}`, passwordSalt: salt, passwordHash: hash,
    paymentMethod: 'check'
  });

  const customer = await Customer.create({
    affiliateId: affiliate.affiliateId,
    firstName: 'Race', lastName: 'Customer', email: `racecust${uniq}@example.com`,
    phone: '5125552222', address: '2 Race St', city: 'Austin', state: 'TX', zipCode: '78702',
    username: `racecust${uniq}`, passwordSalt: salt, passwordHash: hash
  });

  const operator = await Operator.create({
    firstName: 'Race', lastName: 'Operator', email: `raceop${uniq}@example.com`,
    username: `raceop${uniq}`, password: 'StrongOperatorPass417!',
    createdBy: new mongoose.Types.ObjectId(),
    scanCodeHmac: roleCodes.hmacCode('OPCODE99'), scanCodeSetAt: new Date()
  });

  const token = encryptionUtil.generateToken(16);
  const bag = await Bag.create({
    token, tokenHash: Bag.hashToken(token),
    affiliateId: affiliate.affiliateId, customerId: customer.customerId,
    status: 'active', batchId: `BATCH-${uniq}`, claimedAt: new Date()
  });

  return { affiliate, customer, operator, bag, bagToken: token };
}

function operatorToken(operator) {
  return jwt.sign({ id: operator._id.toString(), role: 'operator' },
    process.env.JWT_SECRET, { expiresIn: '1h' });
}

describe('open-order guard on pickup (application-level read-guard)', () => {
  beforeAll(async () => {
    await SystemConfig.initializeDefaults();
  });

  test('a second create-pending while an order is already open returns 409 order_already_open', async () => {
    const { bag, operator, bagToken: token } = await createWorld();

    const agent = createAgent(app);
    const csrfToken = await getCsrfToken(app, agent);
    const auth = `Bearer ${operatorToken(operator)}`;

    const fire = () => agent
      .post('/api/v1/operators/create-pending')
      .set('Authorization', auth)
      .set('x-csrf-token', csrfToken)
      .send({ bagToken: token });

    const first = await fire();
    expect(first.status).toBe(201);

    const second = await fire();
    expect(second.status).toBe(409);
    expect(second.body.errors.code).toBe('order_already_open');
    expect(second.body.message).not.toMatch(/E11000/);

    // Exactly one order exists for the bag.
    const orders = await Order.find({ bagId: bag.bagId });
    expect(orders).toHaveLength(1);
  });

  test('a new pending order is allowed once the prior one is cancelled', async () => {
    const { bag, operator, bagToken: token } = await createWorld();
    const agent = createAgent(app);
    const csrfToken = await getCsrfToken(app, agent);
    const auth = `Bearer ${operatorToken(operator)}`;

    const first = await agent
      .post('/api/v1/operators/create-pending')
      .set('Authorization', auth).set('x-csrf-token', csrfToken)
      .send({ bagToken: token });
    expect(first.status).toBe(201);

    await Order.updateOne({ orderId: first.body.order.orderId }, { $set: { status: 'cancelled' } });

    const second = await agent
      .post('/api/v1/operators/create-pending')
      .set('Authorization', auth).set('x-csrf-token', csrfToken)
      .send({ bagToken: token });
    expect(second.status).toBe(201);
    expect(second.body.order.orderId).not.toBe(first.body.order.orderId);
  });
});
