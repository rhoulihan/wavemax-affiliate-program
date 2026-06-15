// orderTransitionService — the seam the scan layer (PR 4/5) calls.
// create-at-pickup, state-driven advance, cancel, undo, 4h delivery-rescan.

jest.mock('../../server/utils/emailService', () => ({
  sendCustomerDeliveredEmail: jest.fn().mockResolvedValue(true),
  sendOrderStatusUpdateEmail: jest.fn().mockResolvedValue(true),
  sendOrderCancellationEmail: jest.fn().mockResolvedValue(true)
}));

const mongoose = require('mongoose');
const Order = require('../../server/models/Order');
const Customer = require('../../server/models/Customer');
const Affiliate = require('../../server/models/Affiliate');
const Bag = require('../../server/modules/bags/Bag');
const SystemConfig = require('../../server/models/SystemConfig');
const svc = require('../../server/modules/orders/orderTransitionService');
const { ensureTestAffiliate, ensureTestCustomer } = require('../helpers/v2TestHelpers');

const TOKEN = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'; // 32 hex

describe('orderTransitionService', () => {
  let affiliate, customer, bag;
  const opRole = { by: '507f1f77bcf86cd799439011', role: 'operator' };
  const affRole = () => ({ by: affiliate.affiliateId, role: 'affiliate' });

  beforeEach(async () => {
    await Promise.all([
      Order.deleteMany({}), Customer.deleteMany({}),
      Affiliate.deleteMany({}), Bag.deleteMany({})
    ]);
    jest.clearAllMocks();
    await SystemConfig.initializeDefaults();
    affiliate = await ensureTestAffiliate();
    customer = await ensureTestCustomer({ affiliateId: affiliate.affiliateId });
    bag = await Bag.create({
      token: TOKEN, tokenHash: Bag.hashToken(TOKEN),
      affiliateId: affiliate.affiliateId, customerId: customer.customerId,
      status: 'active', batchId: 'BATCH-test'
    });
  });

  async function freshBag() {
    return Bag.findOne({ bagId: bag.bagId });
  }

  describe('createPendingOrder', () => {
    it('creates one pending order with ids from the bag (never client input)', async () => {
      const { order } = await svc.createPendingOrder({ bag: await freshBag(), ...affRole() });
      expect(order.status).toBe('pending');
      expect(order.customerId).toBe(customer.customerId);
      expect(order.affiliateId).toBe(affiliate.affiliateId);
      expect(order.bagId).toBe(bag.bagId);
      expect(order.bagToken).toBe(TOKEN);
      expect(order.pickup.by).toBe(affiliate.affiliateId);
      expect(order.pickup.role).toBe('affiliate');
      expect(order.pickup.at).toBeInstanceOf(Date);
    });

    it('rejects an unregistered bag (no customer) with bag_not_registered', async () => {
      bag.customerId = null; bag.status = 'issued'; await bag.save();
      await expect(svc.createPendingOrder({ bag: await freshBag(), ...affRole() }))
        .rejects.toMatchObject({ code: 'bag_not_registered' });
    });

    it('maps the duplicate-open E11000 to order_already_open', async () => {
      await svc.createPendingOrder({ bag: await freshBag(), ...affRole() });
      await expect(svc.createPendingOrder({ bag: await freshBag(), ...affRole() }))
        .rejects.toMatchObject({ code: 'order_already_open', status: 409 });
      expect(await Order.countDocuments({ bagId: bag.bagId })).toBe(1);
    });
  });

  describe('advanceOrder (state-driven)', () => {
    async function openPending() {
      const { order } = await svc.createPendingOrder({ bag: await freshBag(), ...affRole() });
      return order;
    }

    it('pending -> in_progress stamps intake', async () => {
      await openPending();
      const { order, action } = await svc.advanceOrder({ bag: await freshBag(), ...opRole });
      expect(order.status).toBe('in_progress');
      expect(action).toBe('advance');
      expect(order.intake.by).toBe(opRole.by);
      expect(order.intake.role).toBe('operator');
    });

    it('in_progress -> out_for_delivery stamps storePickup + payment flag', async () => {
      await openPending();
      await svc.advanceOrder({ bag: await freshBag(), ...opRole }); // -> in_progress
      const { order } = await svc.advanceOrder({ bag: await freshBag(), ...opRole, paymentConfirmed: true });
      expect(order.status).toBe('out_for_delivery');
      expect(order.storePickup.at).toBeInstanceOf(Date);
      expect(order.paymentConfirmedManually).toBe(true);
    });

    it('out_for_delivery -> complete stamps delivery + completedAt + sends delivered email', async () => {
      const emailService = require('../../server/utils/emailService');
      await openPending();
      await svc.advanceOrder({ bag: await freshBag(), ...opRole });
      await svc.advanceOrder({ bag: await freshBag(), ...opRole });
      const { order } = await svc.advanceOrder({ bag: await freshBag(), ...affRole() });
      expect(order.status).toBe('complete');
      expect(order.completedAt).toBeInstanceOf(Date);
      expect(order.delivery.role).toBe('affiliate');
      expect(emailService.sendCustomerDeliveredEmail).toHaveBeenCalledTimes(1);
    });

    it('no open order -> create-pending action (opens a new pending)', async () => {
      const { order, action } = await svc.advanceOrder({ bag: await freshBag(), ...affRole() });
      expect(action).toBe('create-pending');
      expect(order.status).toBe('pending');
    });

    it('complete within reopen window -> delivery-rescan-prompt (no mutation)', async () => {
      await openPending();
      await svc.advanceOrder({ bag: await freshBag(), ...opRole });
      await svc.advanceOrder({ bag: await freshBag(), ...opRole });
      const done = await svc.advanceOrder({ bag: await freshBag(), ...affRole() });
      expect(done.order.status).toBe('complete');

      const res = await svc.advanceOrder({ bag: await freshBag(), ...affRole() });
      expect(res.action).toBe('delivery-rescan-prompt');
      expect(res.orderId).toBe(done.order.orderId);
      // no new order created
      expect(await Order.countDocuments({ bagId: bag.bagId })).toBe(1);
    });

    it('complete beyond reopen window -> opens a fresh pending', async () => {
      await openPending();
      await svc.advanceOrder({ bag: await freshBag(), ...opRole });
      await svc.advanceOrder({ bag: await freshBag(), ...opRole });
      const done = await svc.advanceOrder({ bag: await freshBag(), ...affRole() });
      // Force completedAt far in the past.
      await Order.updateOne({ orderId: done.order.orderId },
        { $set: { completedAt: new Date(Date.now() - 5 * 60 * 60 * 1000) } });

      const res = await svc.advanceOrder({ bag: await freshBag(), ...affRole() });
      expect(res.action).toBe('create-pending');
      expect(res.order.status).toBe('pending');
      expect(await Order.countDocuments({ bagId: bag.bagId })).toBe(2);
    });
  });

  describe('cancelOrder', () => {
    it('cancels an open order and stamps cancelledAt', async () => {
      const { order } = await svc.createPendingOrder({ bag: await freshBag(), ...affRole() });
      const { order: cancelled } = await svc.cancelOrder({ order, ...opRole });
      expect(cancelled.status).toBe('cancelled');
      expect(cancelled.cancelledAt).toBeInstanceOf(Date);
    });
  });

  describe('undoLastTransition', () => {
    it('deletes a just-created pending order', async () => {
      const { order } = await svc.createPendingOrder({ bag: await freshBag(), ...affRole() });
      const res = await svc.undoLastTransition({ order, by: opRole.by });
      expect(res.undone).toBe('deleted');
      expect(await Order.countDocuments({ orderId: order.orderId })).toBe(0);
    });

    it('rolls in_progress back to pending', async () => {
      await svc.createPendingOrder({ bag: await freshBag(), ...affRole() });
      const { order } = await svc.advanceOrder({ bag: await freshBag(), ...opRole });
      expect(order.status).toBe('in_progress');
      const res = await svc.undoLastTransition({ order, by: opRole.by });
      expect(res.order.status).toBe('pending');
    });

    it('rolls out_for_delivery back to in_progress', async () => {
      await svc.createPendingOrder({ bag: await freshBag(), ...affRole() });
      await svc.advanceOrder({ bag: await freshBag(), ...opRole });
      const { order } = await svc.advanceOrder({ bag: await freshBag(), ...opRole });
      expect(order.status).toBe('out_for_delivery');
      const res = await svc.undoLastTransition({ order, by: opRole.by });
      expect(res.order.status).toBe('in_progress');
    });
  });
});
