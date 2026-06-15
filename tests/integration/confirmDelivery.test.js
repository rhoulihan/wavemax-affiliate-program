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

const confirm = (bagToken, body) =>
  request(app).post(`/api/v1/bags/${bagToken}/confirm-delivery`).send(body);

describe('POST /api/v1/bags/:bagToken/confirm-delivery', () => {
  beforeEach(() => jest.clearAllMocks());

  test('vendor (affiliate) code on a picked_up order -> delivered, commission realized, both emails', async () => {
    const { bagToken, order, affiliate } = await createWorld({
      orderStatus: 'picked_up'
    });
    const res = await confirm(bagToken, { code: 'VENDOR' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('delivered');
    expect(res.body.proofOfDelivery.method).toBe('affiliate_code');
    expect(res.body.proofOfDelivery.confirmedByRole).toBe('affiliate');

    const reloaded = await Order.findOne({ orderId: order.orderId });
    expect(reloaded.status).toBe('delivered');
    expect(reloaded.deliveredAt).toBeInstanceOf(Date);
    expect(reloaded.bags[0].status).toBe('delivered');
    expect(reloaded.commissionRealized).toBe(true);
    expect(reloaded.commissionRealizedAt).toBeInstanceOf(Date);
    expect(reloaded.proofOfDelivery.confirmedById).toBe(affiliate.affiliateId);

    expect(emailService.sendCustomerDeliveredEmail).toHaveBeenCalledTimes(1);
    expect(emailService.sendAffiliateCommissionEmail).toHaveBeenCalledTimes(1);
  });

  test('customer PIN -> delivered with confirmedByRole customer; optional geo persists [lng,lat]', async () => {
    const { bagToken, order, customer } = await createWorld({
      orderStatus: 'picked_up'
    });
    const res = await confirm(bagToken, { code: 'PINPIN', geo: { lat: 30.2672, lng: -97.7431 } });
    expect(res.status).toBe(200);
    expect(res.body.proofOfDelivery.method).toBe('customer_pin');
    expect(res.body.proofOfDelivery.confirmedByRole).toBe('customer');

    const reloaded = await Order.findOne({ orderId: order.orderId });
    expect(reloaded.proofOfDelivery.confirmedById).toBe(customer.customerId);
    expect(reloaded.proofOfDelivery.geo.type).toBe('Point');
    expect(reloaded.proofOfDelivery.geo.coordinates[0]).toBeCloseTo(-97.7431, 4); // lng first
    expect(reloaded.proofOfDelivery.geo.coordinates[1]).toBeCloseTo(30.2672, 4);
  });

  test('operator code -> 401 with errors.code operator_code (re-intake hint, not a delivery)', async () => {
    const { bagToken } = await createWorld({ orderStatus: 'picked_up' });
    const res = await confirm(bagToken, { code: 'OPCODE99' });
    expect(res.status).toBe(401);
    expect(res.body.errors.code).toBe('operator_code');

    const order = await Order.findOne({ bagToken });
    expect(order.status).toBe('picked_up'); // untouched
  });

  test("ANOTHER affiliate's valid code -> generic 401 (verified against this order's parties only)", async () => {
    const { bagToken } = await createWorld({ orderStatus: 'picked_up' });
    const otherWorld = await createWorld({});
    await Affiliate.updateOne(
      { affiliateId: otherWorld.affiliate.affiliateId },
      { $set: { affiliateDeliveryCodeHash: roleCodes.hashCode('OTHERV') } }
    );
    const res = await confirm(bagToken, { code: 'OTHERV' });
    expect(res.status).toBe(401);
    expect(res.body.errors.code).toBe('invalid_code'); // same generic error as a wrong guess
  });

  test('non-picked_up order -> 409 not_picked_up', async () => {
    const { bagToken } = await createWorld({ orderStatus: 'processed' });
    const res = await confirm(bagToken, { code: 'VENDOR' });
    expect(res.status).toBe(409);
    expect(res.body.errors.code).toBe('not_picked_up');
  });

  test('double-confirm -> 409; commission realized exactly once', async () => {
    const { bagToken, order } = await createWorld({ orderStatus: 'picked_up' });
    const first = await confirm(bagToken, { code: 'VENDOR' });
    expect(first.status).toBe(200);
    const stamped = (await Order.findOne({ orderId: order.orderId })).commissionRealizedAt;

    const second = await confirm(bagToken, { code: 'VENDOR' });
    expect(second.status).toBe(409);

    const reloaded = await Order.findOne({ orderId: order.orderId });
    expect(reloaded.commissionRealizedAt.getTime()).toBe(stamped.getTime()); // unchanged
    expect(emailService.sendAffiliateCommissionEmail).toHaveBeenCalledTimes(1);
  });

  test('wrong code -> 401 and lockout after delivery_code_max_attempts; success still blocked while locked', async () => {
    const { bagToken } = await createWorld({ orderStatus: 'picked_up' });
    for (let i = 0; i < 5; i++) { // default delivery_code_max_attempts = 5
      const res = await confirm(bagToken, { code: 'NOPE99' });
      expect(res.status).toBe(401);
    }
    const locked = await confirm(bagToken, { code: 'VENDOR' });
    expect(locked.status).toBe(429);
  });

  test('delivery still succeeds when the customer email throws', async () => {
    const { bagToken } = await createWorld({ orderStatus: 'picked_up' });
    emailService.sendCustomerDeliveredEmail.mockRejectedValueOnce(new Error('SMTP down'));
    const res = await confirm(bagToken, { code: 'VENDOR' });
    expect(res.status).toBe(200);
    const order = await Order.findOne({ bagToken });
    expect(order.status).toBe('delivered');
  });
});
