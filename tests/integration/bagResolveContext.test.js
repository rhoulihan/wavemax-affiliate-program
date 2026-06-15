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

describe('Resolve endpoints expose order context (PR 9)', () => {
  test.each([
    ['in_progress', false, 'advance'],
    ['processed', false, 'advance'],
    ['ready_for_pickup', false, 'advance'],
    ['picked_up', true, 'deliver-or-reintake']
  ])('claimed bag with a %s order -> awaitingDelivery=%s, nextAction=%s', async (status, awaiting, nextAction) => {
    const { bagToken } = await createWorld({ orderStatus: status });

    const resolve = await request(app).get(`/api/v1/bags/resolve/${bagToken}`);
    expect(resolve.status).toBe(200);
    expect(resolve.body.order.status).toBe(status);
    expect(resolve.body.order.awaitingDelivery).toBe(awaiting);
    expect(resolve.body.order.nextAction).toBe(nextAction);

    const claim = await request(app).get(`/api/v1/customers/claim/${bagToken}`);
    expect(claim.status).toBe(200);
    expect(claim.body.state).toBe('claimed');
    expect(claim.body.order.status).toBe(status);
    expect(claim.body.order.awaitingDelivery).toBe(awaiting);
    expect(claim.body.order.nextAction).toBe(nextAction);
  });

  test('claimed bag with NO open order -> nextAction intake, no order object', async () => {
    const { bagToken } = await createWorld({});
    const resolve = await request(app).get(`/api/v1/bags/resolve/${bagToken}`);
    expect(resolve.status).toBe(200);
    expect(resolve.body.nextAction).toBe('intake');
    expect(resolve.body.order).toBeFalsy();
  });

  test('delivered orders are not "open" -> nextAction intake on both resolvers', async () => {
    const { bagToken } = await createWorld({ orderStatus: 'delivered' });
    const resolve = await request(app).get(`/api/v1/bags/resolve/${bagToken}`);
    expect(resolve.body.nextAction).toBe('intake');
    expect(resolve.body.order).toBeFalsy();

    const claim = await request(app).get(`/api/v1/customers/claim/${bagToken}`);
    expect(claim.body.state).toBe('claimed');
    expect(claim.body.order).toBeFalsy();
  });

  test('no customer PII leaks through either resolver', async () => {
    const { bagToken, customer } = await createWorld({
      orderStatus: 'picked_up'
    });
    for (const path of [`/api/v1/bags/resolve/${bagToken}`, `/api/v1/customers/claim/${bagToken}`]) {
      const res = await request(app).get(path);
      const body = JSON.stringify(res.body);
      expect(body).not.toContain(customer.email);
      expect(body).not.toContain(customer.lastName);
      expect(body).not.toContain(customer.phone);
    }
  });
});
