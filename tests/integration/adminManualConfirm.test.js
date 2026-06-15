// Admin status override (spec §11): an admin can PUT an order to `complete`
// directly. No proofOfDelivery / commission concepts remain.

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

describe('admin status override -> complete', () => {
  let agent, csrfToken, adminToken;

  beforeAll(async () => { await SystemConfig.initializeDefaults(); });

  beforeEach(async () => {
    agent = createAgent(app);
    csrfToken = await getCsrfToken(app, agent);
    adminToken = jwt.sign(
      { id: new mongoose.Types.ObjectId().toString(), role: 'admin' },
      process.env.JWT_SECRET || 'test-secret'
    );
  });

  test('admin PUT out_for_delivery -> complete sets status + completedAt, no proofOfDelivery', async () => {
    const { order } = await createWorld({ orderStatus: 'out_for_delivery' });

    const res = await agent
      .put(`/api/v1/orders/${order.orderId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-csrf-token', csrfToken)
      .send({ status: 'complete' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('complete');

    const reloaded = await Order.findOne({ orderId: order.orderId });
    expect(reloaded.status).toBe('complete');
    expect(reloaded.completedAt).toBeInstanceOf(Date);
    expect(reloaded.delivery.role).toBe('operator'); // admin maps to operator role on stamp
    expect(reloaded.proofOfDelivery).toBeUndefined();
  });

  test('admin cannot make an invalid transition (pending -> complete) (400)', async () => {
    const { order } = await createWorld({ orderStatus: 'pending' });

    const res = await agent
      .put(`/api/v1/orders/${order.orderId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-csrf-token', csrfToken)
      .send({ status: 'complete' });
    expect(res.status).toBe(400);
    expect((await Order.findOne({ orderId: order.orderId })).status).toBe('pending');
  });
});
