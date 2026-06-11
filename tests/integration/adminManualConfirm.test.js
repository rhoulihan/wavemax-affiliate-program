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

// ---- shared fixture (copied from tests/integration/operatorScanOut.test.js) ----
async function createWorld({ orderStatus, paymentStatus = 'pending' } = {}) {
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
      paymentStatus,
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

describe('admin manual_confirm override (spec §6.6 / §11)', () => {
  let agent;
  let csrfToken;
  let adminToken;

  beforeEach(async () => {
    agent = createAgent(app);
    csrfToken = await getCsrfToken(app, agent);
    adminToken = jwt.sign(
      { id: new mongoose.Types.ObjectId().toString(), role: 'admin' },
      process.env.JWT_SECRET || 'test-secret'
    );
  });

  test('admin PUT picked_up -> delivered stamps proofOfDelivery manual_confirm + realizes commission', async () => {
    const { order } = await createWorld({ orderStatus: 'picked_up', paymentStatus: 'verified' });

    const res = await agent
      .put(`/api/v1/orders/${order.orderId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-csrf-token', csrfToken)
      .send({ status: 'delivered' });
    expect(res.status).toBe(200);

    const reloaded = await Order.findOne({ orderId: order.orderId });
    expect(reloaded.status).toBe('delivered');
    expect(reloaded.proofOfDelivery.method).toBe('manual_confirm');
    expect(reloaded.proofOfDelivery.confirmedByRole).toBe('admin');
    expect(reloaded.proofOfDelivery.confirmedById).toBeTruthy();
    expect(reloaded.proofOfDelivery.confirmedAt).toBeInstanceOf(Date);
    expect(reloaded.commissionRealized).toBe(true);
    expect(reloaded.commissionRealizedAt).toBeInstanceOf(Date);
  });

  test('does not overwrite an existing proofOfDelivery method', async () => {
    // Defensive: if a delivered-bound save already carries a proof (e.g. a
    // service set affiliate_code in the same request), the stamp must not
    // clobber it. Simulate by pre-setting proofOfDelivery on a picked_up
    // order before the admin PUT.
    const { order } = await createWorld({ orderStatus: 'picked_up', paymentStatus: 'verified' });
    order.proofOfDelivery = {
      method: 'affiliate_code', confirmedByRole: 'affiliate',
      confirmedById: order.affiliateId, confirmedAt: new Date()
    };
    await order.save();

    const res = await agent
      .put(`/api/v1/orders/${order.orderId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-csrf-token', csrfToken)
      .send({ status: 'delivered' });
    expect(res.status).toBe(200);

    const reloaded = await Order.findOne({ orderId: order.orderId });
    expect(reloaded.proofOfDelivery.method).toBe('affiliate_code'); // untouched
  });
});
