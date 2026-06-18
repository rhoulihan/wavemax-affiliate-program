// Scan 4 — delivery at the partner: out_for_delivery -> complete (spec §3).
// Replaces the old picked_up scan-out + delivery-PIN concept (removed).

jest.mock('../../server/utils/emailService');

const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const app = require('../../server');
const emailService = require('../../server/utils/emailService');
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
    username: `fixcust${uniq}`, passwordSalt: salt, passwordHash: hash,
    emailVerified: true // verified so the delivered email isn't suppressed by the gate
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

function operatorToken(operator) {
  return jwt.sign({ id: operator._id.toString(), role: 'operator' },
    process.env.JWT_SECRET, { expiresIn: '1h' });
}

describe('Delivery scan: out_for_delivery -> complete', () => {
  beforeAll(async () => { await SystemConfig.initializeDefaults(); });
  beforeEach(() => jest.clearAllMocks());

  test('advancing an out_for_delivery order completes it and sends the delivered email', async () => {
    const { bagToken, operator, order } = await createWorld({ orderStatus: 'out_for_delivery' });
    const agent = createAgent(app);
    const csrfToken = await getCsrfToken(app, agent);

    const res = await agent
      .post('/api/v1/operators/advance')
      .set('Authorization', `Bearer ${operatorToken(operator)}`)
      .set('x-csrf-token', csrfToken)
      .send({ bagToken });
    expect(res.status).toBe(200);
    expect(res.body.action).toBe('advance');
    expect(res.body.order.status).toBe('complete');

    const reloaded = await Order.findOne({ orderId: order.orderId });
    expect(reloaded.status).toBe('complete');
    expect(reloaded.completedAt).toBeInstanceOf(Date);

    expect(emailService.sendCustomerDeliveredEmail).toHaveBeenCalledTimes(1);
  });

  test('complete stamps delivery.by/role with the operator', async () => {
    const { bagToken, operator, order } = await createWorld({ orderStatus: 'out_for_delivery' });
    const agent = createAgent(app);
    const csrfToken = await getCsrfToken(app, agent);

    await agent
      .post('/api/v1/operators/advance')
      .set('Authorization', `Bearer ${operatorToken(operator)}`)
      .set('x-csrf-token', csrfToken)
      .send({ bagToken });

    const reloaded = await Order.findOne({ orderId: order.orderId });
    expect(reloaded.delivery.role).toBe('operator');
    expect(reloaded.delivery.by).toBe(String(operator._id));
    expect(reloaded.delivery.at).toBeInstanceOf(Date);
  });
});
