jest.mock('../../server/utils/emailService');

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../server');
const emailService = require('../../server/utils/emailService');
const Order = require('../../server/models/Order');
const Customer = require('../../server/models/Customer');
const Affiliate = require('../../server/models/Affiliate');
const Operator = require('../../server/models/Operator');
const Bag = require('../../server/modules/bags/Bag');
const encryptionUtil = require('../../server/utils/encryption');
const roleCodes = require('../../server/utils/roleCodes');

jest.setTimeout(60000);

// ---- shared fixture (copied from tests/integration/operatorScanOut.test.js) ----
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

describe('Re-intake of a picked_up bag (operator code on the bag URL)', () => {
  beforeEach(() => jest.clearAllMocks());

  test('auto-delivers the prior order (method reintake, commission once) and opens a new in_progress order', async () => {
    const { bagToken, bag, order: prior } = await createWorld({
      orderStatus: 'picked_up'
    });

    const res = await request(app)
      .post(`/api/v1/bags/${bagToken}/intake`)
      .send({
        operatorCode: 'OPCODE99', weight: 12,
        addOns: { premiumDetergent: false, fabricSoftener: false, stainRemover: false },
        freshAddOnsFormPlaced: true
      });
    expect(res.status).toBe(201);

    const closed = await Order.findOne({ orderId: prior.orderId });
    expect(closed.status).toBe('delivered');
    expect(closed.proofOfDelivery.method).toBe('reintake');
    expect(closed.proofOfDelivery.confirmedByRole).toBe('operator');
    expect(closed.commissionRealized).toBe(true);
    expect(closed.commissionRealizedAt).toBeInstanceOf(Date);

    const orders = await Order.find({ bagId: bag.bagId }).sort({ createdAt: 1 });
    expect(orders).toHaveLength(2);
    expect(orders[1].status).toBe('in_progress');
    expect(orders[1].actualWeight).toBeCloseTo(12, 2);
    expect(orders[1].orderId).not.toBe(prior.orderId);

    // Prior order's close-out notifications fired exactly once.
    expect(emailService.sendCustomerDeliveredEmail).toHaveBeenCalledTimes(1);
    expect(emailService.sendAffiliateCommissionEmail).toHaveBeenCalledTimes(1);
  });

  test('double re-intake scan cannot double-close or double-realize commission', async () => {
    const { bagToken, order: prior } = await createWorld({
      orderStatus: 'picked_up'
    });
    const body = { operatorCode: 'OPCODE99', weight: 12, addOns: {}, freshAddOnsFormPlaced: true };

    const first = await request(app).post(`/api/v1/bags/${bagToken}/intake`).send(body);
    expect(first.status).toBe(201);
    const stamped = (await Order.findOne({ orderId: prior.orderId })).commissionRealizedAt;

    // Second scan: an in_progress order is now open at the store -> 409.
    const second = await request(app).post(`/api/v1/bags/${bagToken}/intake`).send(body);
    expect(second.status).toBe(409);

    const closed = await Order.findOne({ orderId: prior.orderId });
    expect(closed.commissionRealizedAt.getTime()).toBe(stamped.getTime());
    expect(emailService.sendAffiliateCommissionEmail).toHaveBeenCalledTimes(1);
  });

  test('customer/vendor code on the intake endpoint cannot trigger re-intake (401)', async () => {
    const { bagToken, order: prior } = await createWorld({
      orderStatus: 'picked_up'
    });
    const res = await request(app)
      .post(`/api/v1/bags/${bagToken}/intake`)
      .send({ operatorCode: 'VENDOR', weight: 12, addOns: {}, freshAddOnsFormPlaced: true });
    expect(res.status).toBe(401);
    expect((await Order.findOne({ orderId: prior.orderId })).status).toBe('picked_up');
  });
});
