// orderIntakeService — order birth at store intake (spec §6.4).
// MANDATORY: the silent-zero regression guard (non-zero totalFee /
// affiliateCommission / actualTotal after intake).

jest.mock('../../server/utils/emailService', () => ({
  sendCustomerDeliveredEmail: jest.fn().mockResolvedValue(true),
  sendAffiliateCommissionEmail: jest.fn().mockResolvedValue(true),
  sendOrderReadyNotification: jest.fn().mockResolvedValue(true)
}));

const mongoose = require('mongoose');
const emailService = require('../../server/utils/emailService');
const Order = require('../../server/models/Order');
const Customer = require('../../server/models/Customer');
const Affiliate = require('../../server/models/Affiliate');
const Bag = require('../../server/modules/bags/Bag');
const { createOrderFromBag } = require('../../server/modules/orders/orderIntakeService');
const { ensureTestAffiliate, ensureTestCustomer } = require('../helpers/v2TestHelpers');

describe('orderIntakeService.createOrderFromBag', () => {
  let affiliate, customer, bag, operatorId;
  const TOKEN = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'; // 32 hex chars

  beforeEach(async () => {
    await Promise.all([
      Order.deleteMany({}), Customer.deleteMany({}),
      Affiliate.deleteMany({}), Bag.deleteMany({})
    ]);
    jest.clearAllMocks();

    affiliate = await ensureTestAffiliate();           // minimumDeliveryFee 10, perBagDeliveryFee 2.50
    customer = await ensureTestCustomer({ affiliateId: affiliate.affiliateId });
    operatorId = new mongoose.Types.ObjectId();

    bag = await Bag.create({
      token: TOKEN,
      tokenHash: Bag.hashToken(TOKEN),
      affiliateId: affiliate.affiliateId,
      customerId: customer.customerId,
      status: 'active',
      batchId: 'BATCH-test'
    });
  });

  it('creates exactly one in_progress order with ids derived from the bag', async () => {
    const { order } = await createOrderFromBag({
      bagToken: TOKEN, weight: 10,
      addOns: { premiumDetergent: true, fabricSoftener: false, stainRemover: false },
      freshAddOnsFormPlaced: true, operatorId
    });

    expect(order.status).toBe('in_progress');
    expect(order.customerId).toBe(customer.customerId);   // from the bag, not from input
    expect(order.affiliateId).toBe(affiliate.affiliateId);
    expect(order.bagId).toBe(bag.bagId);                  // BAG-uuid join key
    expect(order.bagToken).toBe(TOKEN);                   // 32-hex scan key
    expect(order.bags).toHaveLength(1);
    expect(order.bags[0].bagToken).toBe(TOKEN);           // sub-doc uses bagToken, never bagId
    expect(order.bags[0].bagNumber).toBe(1);
    expect(order.bags[0].status).toBe('intake');
    expect(order.bags[0].scannedAt.intake).toBeInstanceOf(Date);
    expect(String(order.bags[0].scannedBy.intake)).toBe(String(operatorId));
    expect(order.intake.weight).toBe(10);
    expect(String(order.intake.weighedBy)).toBe(String(operatorId));
    expect(order.intakeAt).toBeInstanceOf(Date);
    expect(order.actualWeight).toBe(10);
    expect(order.freshAddOnsFormPlaced).toBe(true);
    expect(String(order.freshAddOnsFormAckBy)).toBe(String(operatorId));
    expect(order.freshAddOnsFormAckAt).toBeInstanceOf(Date);
    expect(String(order.addOnsEnteredBy)).toBe(String(operatorId));

    expect(await Order.countDocuments({ bagId: bag.bagId })).toBe(1);
  });

  it('SILENT-ZERO GUARD: saved order has non-zero totalFee, affiliateCommission, actualTotal', async () => {
    await createOrderFromBag({
      bagToken: TOKEN, weight: 10,
      addOns: { premiumDetergent: true }, freshAddOnsFormPlaced: true, operatorId
    });

    const saved = await Order.findOne({ bagId: bag.bagId });
    // 10 lbs @ 1.25 = 12.50 WDF; fee = max(10, 1×2.50) = 10.00 (min applied);
    // add-on = 1 × 10 × 0.10 = 1.00; total = 23.50; commission = 1.25 + 10 = 11.25
    expect(saved.feeBreakdown.totalFee).toBeGreaterThan(0);
    expect(saved.feeBreakdown.totalFee).toBeCloseTo(10.0, 2);
    expect(saved.feeBreakdown.minimumApplied).toBe(true);
    expect(saved.addOnTotal).toBeCloseTo(1.0, 2);
    expect(saved.actualTotal).toBeGreaterThan(0);
    expect(saved.actualTotal).toBeCloseTo(23.5, 2);
    expect(saved.affiliateCommission).toBeGreaterThan(0);
    expect(saved.affiliateCommission).toBeCloseTo(11.25, 2);
  });

  it('does not send a payment notice at intake (payment is external)', async () => {
    await createOrderFromBag({
      bagToken: TOKEN, weight: 10, addOns: {}, freshAddOnsFormPlaced: true, operatorId
    });
    expect(emailService.sendV2PaymentRequest).toBeUndefined();
  });

  it('applies carry-in WDF credit at intake and resets the customer balance', async () => {
    customer.wdfCredit = 5;
    await customer.save();

    await createOrderFromBag({
      bagToken: TOKEN, weight: 10, addOns: {}, freshAddOnsFormPlaced: false, operatorId
    });

    const saved = await Order.findOne({ bagId: bag.bagId });
    expect(saved.wdfCreditApplied).toBeCloseTo(5, 2);
    // actualTotal nets the credit (12.50 + 10 − 5 = 17.50)
    expect(saved.actualTotal).toBeCloseTo(17.5, 2);

    const freshCustomer = await Customer.findOne({ customerId: customer.customerId });
    expect(freshCustomer.wdfCredit).toBe(0);
  });

  describe('guards', () => {
    it('rejects an unknown token with a generic 404 (anti-enumeration)', async () => {
      await expect(createOrderFromBag({
        bagToken: 'f'.repeat(32), weight: 10, addOns: {}, freshAddOnsFormPlaced: false, operatorId
      })).rejects.toMatchObject({ isIntakeError: true, code: 'invalid_bag', status: 404 });
    });

    it('rejects a non-active (issued) bag with 409 bag_not_active', async () => {
      bag.status = 'issued';
      bag.customerId = null;
      await bag.save();
      await expect(createOrderFromBag({
        bagToken: TOKEN, weight: 10, addOns: {}, freshAddOnsFormPlaced: false, operatorId
      })).rejects.toMatchObject({ isIntakeError: true, code: 'bag_not_active', status: 409 });
    });

    it.each(['in_progress', 'processed', 'ready_for_pickup'])(
      'rejects intake while an at-store order is open (%s) with 409 order_already_open',
      async (openStatus) => {
        await createOrderFromBag({
          bagToken: TOKEN, weight: 10, addOns: {}, freshAddOnsFormPlaced: false, operatorId
        });
        // Force the open order into the at-store status under test.
        await Order.updateOne({ bagId: bag.bagId }, { $set: { status: openStatus } });

        await expect(createOrderFromBag({
          bagToken: TOKEN, weight: 12, addOns: {}, freshAddOnsFormPlaced: false, operatorId
        })).rejects.toMatchObject({ isIntakeError: true, code: 'order_already_open', status: 409 });

        expect(await Order.countDocuments({ bagId: bag.bagId })).toBe(1); // no second order
      }
    );

    it('allows intake when prior orders are delivered or cancelled', async () => {
      await createOrderFromBag({
        bagToken: TOKEN, weight: 10, addOns: {}, freshAddOnsFormPlaced: false, operatorId
      });
      await Order.updateOne({ bagId: bag.bagId }, { $set: { status: 'delivered' } });

      const { order } = await createOrderFromBag({
        bagToken: TOKEN, weight: 8, addOns: {}, freshAddOnsFormPlaced: false, operatorId
      });
      expect(order.status).toBe('in_progress');
      expect(await Order.countDocuments({ bagId: bag.bagId })).toBe(2);
    });

    it.each([0, -1, 'abc', undefined])('rejects invalid weight %p with 400', async (badWeight) => {
      await expect(createOrderFromBag({
        bagToken: TOKEN, weight: badWeight, addOns: {}, freshAddOnsFormPlaced: false, operatorId
      })).rejects.toMatchObject({ isIntakeError: true, code: 'invalid_weight', status: 400 });
    });
  });

  describe('re-intake (picked_up open order)', () => {
    let priorOrder;

    beforeEach(async () => {
      const { order } = await createOrderFromBag({
        bagToken: TOKEN, weight: 10, addOns: {}, freshAddOnsFormPlaced: false, operatorId
      });
      // Simulate operator scan-out (PR 9 owns the real path): force picked_up.
      await Order.updateOne({ orderId: order.orderId }, { $set: { status: 'picked_up' } });
      priorOrder = await Order.findOne({ orderId: order.orderId });
      jest.clearAllMocks();
    });

    it('auto-delivers the prior order with method reintake, realizes commission once, then opens a new order', async () => {
      const { order: newOrder, reIntake } = await createOrderFromBag({
        bagToken: TOKEN, weight: 7, addOns: {}, freshAddOnsFormPlaced: true, operatorId
      });

      expect(reIntake).toBe(true);

      const delivered = await Order.findOne({ orderId: priorOrder.orderId });
      expect(delivered.status).toBe('delivered');
      expect(delivered.deliveredAt).toBeInstanceOf(Date);
      expect(delivered.proofOfDelivery.method).toBe('reintake');
      expect(delivered.proofOfDelivery.confirmedByRole).toBe('operator');
      expect(delivered.proofOfDelivery.confirmedById).toBe(String(operatorId));
      expect(delivered.commissionRealized).toBe(true);
      expect(delivered.commissionRealizedAt).toBeInstanceOf(Date);
      expect(delivered.bags[0].status).toBe('delivered');

      expect(newOrder.status).toBe('in_progress');
      expect(newOrder.orderId).not.toBe(priorOrder.orderId);
      expect(await Order.countDocuments({ bagId: bag.bagId })).toBe(2);

      // Delivered email (Notification B) + commission email fire on auto-deliver.
      expect(emailService.sendCustomerDeliveredEmail).toHaveBeenCalledTimes(1);
      expect(emailService.sendAffiliateCommissionEmail).toHaveBeenCalledTimes(1);
    });

    it('does not double-close on a double scan (one delivered + one in_progress)', async () => {
      await createOrderFromBag({
        bagToken: TOKEN, weight: 7, addOns: {}, freshAddOnsFormPlaced: false, operatorId
      });
      // Second scan now hits the NEW open in_progress order -> 409, not another auto-deliver.
      await expect(createOrderFromBag({
        bagToken: TOKEN, weight: 7, addOns: {}, freshAddOnsFormPlaced: false, operatorId
      })).rejects.toMatchObject({ code: 'order_already_open', status: 409 });

      expect(await Order.countDocuments({ bagId: bag.bagId, status: 'delivered' })).toBe(1);
      expect(await Order.countDocuments({ bagId: bag.bagId, status: 'in_progress' })).toBe(1);
    });

    it('still delivers the prior order when emails throw (best-effort)', async () => {
      emailService.sendCustomerDeliveredEmail.mockRejectedValueOnce(new Error('smtp down'));
      const { order: newOrder } = await createOrderFromBag({
        bagToken: TOKEN, weight: 7, addOns: {}, freshAddOnsFormPlaced: false, operatorId
      });
      const delivered = await Order.findOne({ orderId: priorOrder.orderId });
      expect(delivered.status).toBe('delivered');
      expect(newOrder.status).toBe('in_progress');
    });
  });
});
