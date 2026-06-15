// Delivery is now a state-driven advance (out_for_delivery -> complete) through
// the public bag-URL /advance endpoint, authorized by an operator scan code.
// The old code-specific confirm-delivery route is deleted (PR 3).

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
    firstName: 'Del', lastName: 'Iverer', email: `fixaff${uniq}@example.com`,
    phone: '5125551111', businessName: 'Del Iverer LLC',
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

describe('Delivery completion via public bag-URL advance', () => {
  beforeAll(async () => { await SystemConfig.initializeDefaults(); });

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
      .send({ code: 'VENDOR' });
    expect(res.status).toBe(404);
  });

  test('scanning an out_for_delivery bag with an operator code completes it', async () => {
    const { bagToken, order } = await createWorld({ orderStatus: 'out_for_delivery' });
    const res = await request(app)
      .post(`/api/v1/bags/${bagToken}/advance`)
      .send({ operatorCode: 'OPCODE99' });
    expect(res.status).toBe(200);
    expect(res.body.action).toBe('advance');
    expect(res.body.order.status).toBe('complete');

    const reloaded = await Order.findOne({ orderId: order.orderId });
    expect(reloaded.status).toBe('complete');
    expect(reloaded.completedAt).toBeInstanceOf(Date);
  });

  test('a wrong code cannot complete the order (401, order untouched)', async () => {
    const { bagToken, order } = await createWorld({ orderStatus: 'out_for_delivery' });
    const res = await request(app)
      .post(`/api/v1/bags/${bagToken}/advance`)
      .send({ operatorCode: 'WRONGC99' });
    expect(res.status).toBe(401);
    expect((await Order.findOne({ orderId: order.orderId })).status).toBe('out_for_delivery');
  });
});
