jest.mock('../../server/utils/emailService');

const request = require('supertest');
const app = require('../../server');
const Order = require('../../server/models/Order');
const Bag = require('../../server/modules/bags/Bag');
const { ensureTestAffiliate, ensureTestCustomer } = require('../helpers/v2TestHelpers');

jest.setTimeout(90000);

describe('GET /api/v1/bags/resolve/:token exposes open-order context (PR 7)', () => {
  const TOKEN = 'cccccccccccccccccccccccccccccccc'; // 32 hex chars
  let affiliate, customer, bag;

  beforeEach(async () => {
    await Promise.all([Order.deleteMany({}), Bag.deleteMany({})]);
    affiliate = await ensureTestAffiliate();
    customer = await ensureTestCustomer({ affiliateId: affiliate.affiliateId });
    bag = await Bag.create({
      token: TOKEN, tokenHash: Bag.hashToken(TOKEN),
      affiliateId: affiliate.affiliateId, customerId: customer.customerId,
      status: 'active', batchId: 'BATCH-ctx', claimedAt: new Date()
    });
  });

  function createOrder(status) {
    return Order.create({
      customerId: customer.customerId,
      affiliateId: affiliate.affiliateId,
      bagId: bag.bagId,
      bagToken: bag.token,
      status,
      paymentStatus: 'verified',
      actualWeight: 15,
      feeBreakdown: { numberOfBags: 1, minimumFee: 25, perBagFee: 5, totalFee: 25, minimumApplied: true }
    });
  }

  test.each([
    ['in_progress', false, 'advance'],
    ['processed', false, 'advance'],
    ['ready_for_pickup', false, 'advance'],
    ['picked_up', true, 'deliver-or-reintake']
  ])('claimed bag with a %s order -> awaitingDelivery=%s, nextAction=%s', async (status, awaiting, nextAction) => {
    await createOrder(status);
    const res = await request(app).get(`/api/v1/bags/resolve/${TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body.order.status).toBe(status);
    expect(res.body.order.awaitingDelivery).toBe(awaiting);
    expect(res.body.order.nextAction).toBe(nextAction);
    expect(res.body.nextAction).toBe(nextAction);
  });

  test('claimed bag with NO open order -> nextAction intake, no order object', async () => {
    const res = await request(app).get(`/api/v1/bags/resolve/${TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body.nextAction).toBe('intake');
    expect(res.body.order).toBeFalsy();
  });

  test('delivered orders are not "open" -> nextAction intake', async () => {
    await createOrder('delivered');
    const res = await request(app).get(`/api/v1/bags/resolve/${TOKEN}`);
    expect(res.body.nextAction).toBe('intake');
    expect(res.body.order).toBeFalsy();
  });

  test('no customer PII leaks through the resolver', async () => {
    await createOrder('picked_up');
    const res = await request(app).get(`/api/v1/bags/resolve/${TOKEN}`);
    const body = JSON.stringify(res.body);
    expect(body).not.toContain(customer.email);
    expect(body).not.toContain(customer.lastName);
  });
});
