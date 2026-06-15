// Delivery-rescan-prompt behavior (4h reopen window, spec §3).
//
// A bag whose last order is `complete` within order_reopen_window_minutes
// returns a 'delivery-rescan-prompt' (no mutation) so the kiosk UI can ask
// "deliver again or start a new cycle?". Beyond the window, a scan opens a
// fresh pending order.

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
      pickup: { at: new Date(), by: affiliate.affiliateId, role: 'affiliate' },
      ...(orderStatus === 'complete' ? { completedAt: new Date() } : {})
    });
  }

  return { affiliate, customer, operator, bag, order, bagToken: token };
}

describe('Delivery-rescan-prompt within the reopen window', () => {
  beforeAll(async () => { await SystemConfig.initializeDefaults(); });
  beforeEach(() => jest.clearAllMocks());

  test('scanning a recently-completed bag returns delivery-rescan-prompt and creates NO new order', async () => {
    const { bagToken, order } = await createWorld({ orderStatus: 'complete' });

    const res = await request(app)
      .post(`/api/v1/bags/${bagToken}/advance`)
      .send({ operatorCode: 'OPCODE99' });
    expect(res.status).toBe(200);
    expect(res.body.action).toBe('delivery-rescan-prompt');
    expect(res.body.orderId).toBe(order.orderId);

    // No mutation: still exactly one (completed) order for the bag.
    const orders = await Order.find({ bagId: order.bagId });
    expect(orders).toHaveLength(1);
    expect(orders[0].status).toBe('complete');
  });

  test('a bag completed beyond the reopen window opens a fresh pending on scan', async () => {
    const { bagToken, order } = await createWorld({ orderStatus: 'complete' });
    // Force completedAt to 5h ago (> default 240-min window).
    await Order.updateOne(
      { orderId: order.orderId },
      { $set: { completedAt: new Date(Date.now() - 5 * 60 * 60 * 1000) } }
    );

    const res = await request(app)
      .post(`/api/v1/bags/${bagToken}/advance`)
      .send({ operatorCode: 'OPCODE99' });
    expect(res.status).toBe(200);
    expect(res.body.action).toBe('create-pending');
    expect(res.body.order.status).toBe('pending');

    const orders = await Order.find({ bagId: order.bagId });
    expect(orders).toHaveLength(2);
  });

  test('after a prompt, create-pending opens the new cycle', async () => {
    const { bagToken, order, operator } = await createWorld({ orderStatus: 'complete' });

    const jwt = require('jsonwebtoken');
    const opToken = jwt.sign(
      { id: operator._id.toString(), role: 'operator' },
      process.env.JWT_SECRET, { expiresIn: '1h' });
    const { getCsrfToken, createAgent } = require('../helpers/csrfHelper');
    const agent = createAgent(app);
    const csrfToken = await getCsrfToken(app, agent);

    // The scan prompts (no mutation)...
    const prompt = await request(app)
      .post(`/api/v1/bags/${bagToken}/advance`)
      .send({ operatorCode: 'OPCODE99' });
    expect(prompt.body.action).toBe('delivery-rescan-prompt');

    // ...then "yes" -> create-pending opens a new order.
    const created = await agent
      .post('/api/v1/operators/create-pending')
      .set('Authorization', `Bearer ${opToken}`)
      .set('x-csrf-token', csrfToken)
      .send({ bagToken });
    expect(created.status).toBe(201);
    expect(created.body.order.status).toBe('pending');

    const orders = await Order.find({ bagId: order.bagId });
    expect(orders).toHaveLength(2);
  });
});
