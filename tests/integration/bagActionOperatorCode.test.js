jest.mock('../../server/utils/emailService');

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../server');
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

describe('Public bag-URL operator-code endpoints', () => {
  test('POST /api/v1/bags/:bagToken/intake with a valid operator code creates the order (no CSRF, no JWT)', async () => {
    const { bagToken, operator } = await createWorld({}); // active bag, no order
    const res = await request(app)
      .post(`/api/v1/bags/${bagToken}/intake`)
      .send({
        operatorCode: 'OPCODE99',
        weight: 18.5,
        addOns: { premiumDetergent: true, fabricSoftener: false, stainRemover: false },
        freshAddOnsFormPlaced: true
      });
    expect(res.status).toBe(201);

    const order = await Order.findOne({ bagToken });
    expect(order).toBeTruthy();
    expect(order.status).toBe('in_progress');
    expect(order.actualWeight).toBeCloseTo(18.5, 2);
    // The operator was resolved from the code and recorded as the scanner.
    expect(order.intake.weighedBy.toString()).toBe(operator._id.toString());
  });

  test('POST /api/v1/bags/:bagToken/advance with a valid operator code advances the order', async () => {
    const { bagToken } = await createWorld({ orderStatus: 'in_progress' });
    const res = await request(app)
      .post(`/api/v1/bags/${bagToken}/advance`)
      .send({ operatorCode: 'OPCODE99' });
    expect(res.status).toBe(200);
    expect(res.body.action).toBe('ready_for_pickup');
  });

  test('wrong operator code -> generic 401; lockout after operator_scan_code_max_attempts failures', async () => {
    const { bagToken } = await createWorld({ orderStatus: 'in_progress' });

    for (let i = 0; i < 5; i++) { // default operator_scan_code_max_attempts = 5
      const res = await request(app)
        .post(`/api/v1/bags/${bagToken}/advance`)
        .send({ operatorCode: 'WRONGC99' });
      expect(res.status).toBe(401);
      expect(res.body.message).not.toMatch(/operator/i); // no role oracle on a bad guess
    }

    // 6th attempt: locked out even with the CORRECT code.
    const locked = await request(app)
      .post(`/api/v1/bags/${bagToken}/advance`)
      .send({ operatorCode: 'OPCODE99' });
    expect(locked.status).toBe(429);
  });

  test('lockout expires with the window (an expired counter no longer locks)', async () => {
    const { bagToken } = await createWorld({ orderStatus: 'in_progress' });
    for (let i = 0; i < 5; i++) {
      await request(app).post(`/api/v1/bags/${bagToken}/advance`).send({ operatorCode: 'WRONGC99' });
    }
    const locked = await request(app)
      .post(`/api/v1/bags/${bagToken}/advance`)
      .send({ operatorCode: 'OPCODE99' });
    expect(locked.status).toBe(429);

    // Force the window to expire (simulates the 15-min TTL passing).
    await mongoose.connection.collection('ratelimit_bag_codes').updateMany(
      {}, { $set: { _expiresAt: new Date(Date.now() - 1000) } }
    );
    const afterWindow = await request(app)
      .post(`/api/v1/bags/${bagToken}/advance`)
      .send({ operatorCode: 'OPCODE99' });
    expect(afterWindow.status).toBe(200);
  });

  test('a successful code clears the failure counter', async () => {
    const { bagToken } = await createWorld({ orderStatus: 'in_progress' });
    for (let i = 0; i < 3; i++) {
      await request(app).post(`/api/v1/bags/${bagToken}/advance`).send({ operatorCode: 'NOPE9999' });
    }
    const ok = await request(app)
      .post(`/api/v1/bags/${bagToken}/advance`)
      .send({ operatorCode: 'OPCODE99' });
    expect(ok.status).toBe(200);
  });

  test('open at-store order -> 409 on intake (advance it instead)', async () => {
    const { bagToken } = await createWorld({ orderStatus: 'in_progress' });
    const res = await request(app)
      .post(`/api/v1/bags/${bagToken}/intake`)
      .send({ operatorCode: 'OPCODE99', weight: 10, addOns: {}, freshAddOnsFormPlaced: true });
    expect(res.status).toBe(409);
  });
});
