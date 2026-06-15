jest.setTimeout(90000);

// Mock email BEFORE requiring the app (house rule) — the gate and status
// updates send mail; we assert on the ready notification only.
jest.mock('../../server/utils/emailService', () => ({
  sendOrderReadyNotification: jest.fn().mockResolvedValue(true),
  sendOrderStatusUpdateEmail: jest.fn().mockResolvedValue(true),
  sendAffiliateCommissionEmail: jest.fn().mockResolvedValue(true),
  sendOrderCancellationEmail: jest.fn().mockResolvedValue(true),
  sendAffiliateOrderCancellationEmail: jest.fn().mockResolvedValue(true)
}));

const jwt = require('jsonwebtoken');
const app = require('../../server');
const Order = require('../../server/models/Order');
const emailService = require('../../server/utils/emailService');
const { getCsrfToken, createAgent } = require('../helpers/csrfHelper');
const {
  TEST_IDS,
  ensureTestAffiliate,
  ensureTestCustomer,
  createTestOrder
} = require('../helpers/v2TestHelpers');

describe('ready_for_pickup gate (PUT /api/v1/orders/:orderId/status)', () => {
  let adminToken;
  let affiliate;
  let customer;
  let agent;
  let csrfToken;

  beforeEach(async () => {
    jest.clearAllMocks();
    await Order.deleteMany({});
    // House pattern (see tests/integration/order.test.js): /orders/:orderId/status
    // and /:orderId/cancel are CRITICAL_ENDPOINTS in csrf-config — CSRF is
    // ALWAYS enforced (even under NODE_ENV=test). Every mutation below needs
    // agent + x-csrf-token.
    agent = createAgent(app);
    csrfToken = await getCsrfToken(app, agent);
    affiliate = await ensureTestAffiliate({});
    customer = await ensureTestCustomer({ affiliateId: affiliate.affiliateId });
    adminToken = jwt.sign(
      { id: 'admin-test-id', role: 'admin' },
      process.env.JWT_SECRET || 'test-secret'
    );
  });

  function makeOrder(overrides = {}) {
    return createTestOrder({
      customerId: customer.customerId,
      affiliateId: affiliate.affiliateId,
      ...overrides
    });
  }

  it('PUT processed promotes to ready_for_pickup unconditionally (payment removed)', async () => {
    const order = await makeOrder({ status: 'in_progress' });

    const res = await agent
      .put(`/api/v1/orders/${order.orderId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-csrf-token', csrfToken)
      .send({ status: 'processed' });
    expect(res.status).toBe(200);

    const persisted = await Order.findById(order._id);
    expect(persisted.status).toBe('ready_for_pickup');
    expect(persisted.readyForPickupAt).toBeInstanceOf(Date);
    expect(emailService.sendOrderReadyNotification).toHaveBeenCalledTimes(1);
  });

  it('rejects a direct PUT to ready_for_pickup (gate is the only writer)', async () => {
    const order = await makeOrder({ status: 'processed' });
    const res = await agent
      .put(`/api/v1/orders/${order.orderId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-csrf-token', csrfToken)
      .send({ status: 'ready_for_pickup' });
    expect(res.status).toBe(400);
    expect((await Order.findById(order._id)).status).toBe('processed');
  });

  it('rejects transitions the shared map forbids (in_progress -> delivered)', async () => {
    const order = await makeOrder({ status: 'in_progress' });
    const res = await agent
      .put(`/api/v1/orders/${order.orderId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-csrf-token', csrfToken)
      .send({ status: 'delivered' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Invalid status transition/);
  });

  it('cancelOrder allows in_progress and processed, rejects ready_for_pickup', async () => {
    const inProgress = await makeOrder({ status: 'in_progress' });
    const resA = await agent
      .post(`/api/v1/orders/${inProgress.orderId}/cancel`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-csrf-token', csrfToken)
      .send({});
    expect(resA.status).toBe(200);
    expect((await Order.findById(inProgress._id)).status).toBe('cancelled');

    // createTestOrder defaults _id to the fixed TEST_IDS.order and
    // deletes-then-creates by _id — coexisting orders need distinct _ids.
    const processed = await makeOrder({ status: 'processed', _id: TEST_IDS.order2 });
    const resB = await agent
      .post(`/api/v1/orders/${processed.orderId}/cancel`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-csrf-token', csrfToken)
      .send({});
    expect(resB.status).toBe(200);

    const ready = await makeOrder({ status: 'ready_for_pickup', _id: TEST_IDS.order3 });
    const resC = await agent
      .post(`/api/v1/orders/${ready.orderId}/cancel`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-csrf-token', csrfToken)
      .send({});
    expect(resC.status).toBe(400);
    expect((await Order.findById(ready._id)).status).toBe('ready_for_pickup');
  });
});
