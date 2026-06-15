// The canonical ready-for-pickup gate (design §6.5, settled §13 #3).
// jest.mock BEFORE require (house rule).
jest.mock('../../server/utils/emailService', () => ({
  sendOrderReadyNotification: jest.fn().mockResolvedValue(true)
}));

const { applyReadyGate } = require('../../server/services/orderReadyGateService');
const emailService = require('../../server/utils/emailService');
const Order = require('../../server/models/Order');
const {
  ensureTestAffiliate,
  ensureTestCustomer,
  createTestOrder,
  cleanupV2TestData
} = require('../helpers/v2TestHelpers');

describe('orderReadyGateService.applyReadyGate', () => {
  let affiliate;
  let customer;

  beforeEach(async () => {
    jest.clearAllMocks();
    affiliate = await ensureTestAffiliate({});
    customer = await ensureTestCustomer({ affiliateId: affiliate.affiliateId });
  });

  afterEach(async () => {
    await cleanupV2TestData();
  });

  function gateOrder(overrides = {}) {
    return createTestOrder({
      customerId: customer.customerId,
      affiliateId: affiliate.affiliateId,
      ...overrides
    });
  }

  it('promotes a processed order to ready_for_pickup unconditionally, stamps readyForPickupAt, notifies the affiliate', async () => {
    const order = await gateOrder({ status: 'processed' });
    const result = await applyReadyGate(order, { trigger: 'unit_test' });

    expect(result).toEqual({ promoted: true, held: false });
    expect(order.status).toBe('ready_for_pickup');
    expect(order.readyForPickupAt).toBeInstanceOf(Date);

    const persisted = await Order.findById(order._id);
    expect(persisted.status).toBe('ready_for_pickup');
    expect(persisted.readyForPickupAt).toBeInstanceOf(Date);

    expect(emailService.sendOrderReadyNotification).toHaveBeenCalledTimes(1);
    const [email, data] = emailService.sendOrderReadyNotification.mock.calls[0];
    expect(email).toBe(affiliate.email);
    expect(data.orderId).toBe(order.orderId);
    expect(data.numberOfBags).toBe(1);
  });

  it('is a no-op for non-processed orders', async () => {
    const order = await gateOrder({ status: 'in_progress' });
    const result = await applyReadyGate(order, { trigger: 'unit_test' });
    expect(result).toEqual({ promoted: false, held: false });
    expect(order.status).toBe('in_progress');
    expect(emailService.sendOrderReadyNotification).not.toHaveBeenCalled();
  });

  it('is idempotent — second call on a ready order is a no-op and does not re-notify', async () => {
    const order = await gateOrder({ status: 'processed' });
    await applyReadyGate(order, { trigger: 'first' });
    const firstStamp = order.readyForPickupAt;

    const second = await applyReadyGate(order, { trigger: 'second' });
    expect(second).toEqual({ promoted: false, held: false });
    expect(order.readyForPickupAt).toEqual(firstStamp);
    expect(emailService.sendOrderReadyNotification).toHaveBeenCalledTimes(1);
  });

  it('still promotes when the notification email throws (best-effort)', async () => {
    emailService.sendOrderReadyNotification.mockRejectedValueOnce(new Error('smtp down'));
    const order = await gateOrder({ status: 'processed' });
    const result = await applyReadyGate(order, { trigger: 'unit_test' });
    expect(result.promoted).toBe(true);
    expect((await Order.findById(order._id)).status).toBe('ready_for_pickup');
  });
});
