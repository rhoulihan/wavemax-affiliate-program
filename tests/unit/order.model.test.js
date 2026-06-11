// Order model — redesigned schema + pre-save engine (design §4.4).
// Replaces orderModel.test.js / orderModelSimple.test.js /
// orderWithSystemConfig.test.js / wdfCreditModel.test.js.
const { v4: uuidv4 } = require('uuid');
const Order = require('../../server/models/Order');
const SystemConfig = require('../../server/models/SystemConfig');

function buildOrder(overrides = {}) {
  return new Order({
    customerId: 'CUST-model-test',
    affiliateId: 'AFF-model-test',
    bagId: 'BAG-' + uuidv4(),
    bagToken: 'a1b2c3d4e5f60718293a4b5c6d7e8f90', // 32-hex scan key
    actualWeight: 20,
    feeBreakdown: { numberOfBags: 1, minimumFee: 10, perBagFee: 2, totalFee: 10, minimumApplied: true },
    ...overrides
  });
}

describe('Order model (redesigned)', () => {
  beforeAll(async () => {
    await SystemConfig.initializeDefaults();
  });

  afterEach(async () => {
    await Order.deleteMany({});
  });

  describe('schema shape', () => {
    it('defaults status to in_progress', async () => {
      const order = await buildOrder().save();
      expect(order.status).toBe('in_progress');
    });

    it('rejects the old enum values', async () => {
      for (const dead of ['pending', 'processing', 'complete']) {
        await expect(buildOrder({ status: dead }).save())
          .rejects.toThrow(/is not a valid enum value/);
      }
    });

    it('accepts every new enum value', async () => {
      for (const status of ['in_progress', 'processed', 'ready_for_pickup', 'picked_up', 'delivered', 'cancelled']) {
        const order = await buildOrder({ status }).save();
        expect(order.status).toBe(status);
        await Order.deleteMany({});
      }
    });

    it('requires top-level bagId (the BAG-uuid join key)', async () => {
      const order = buildOrder();
      order.bagId = undefined;
      await expect(order.save()).rejects.toThrow(/bagId.*required/i);
    });

    it('bags[] sub-doc uses bagToken (never bagId) and the new sub-status enum', async () => {
      const order = await buildOrder({
        bags: [{
          bagToken: 'a1b2c3d4e5f60718293a4b5c6d7e8f90',
          bagNumber: 1,
          scannedAt: { intake: new Date() }
        }]
      }).save();
      expect(order.bags[0].bagToken).toBe('a1b2c3d4e5f60718293a4b5c6d7e8f90');
      expect(order.bags[0].status).toBe('intake'); // default
      expect(order.schema.path('bags').schema.path('bagId')).toBeUndefined();

      await expect(buildOrder({
        bags: [{ bagToken: 'b'.repeat(32), bagNumber: 1, status: 'processing' }] // old value
      }).save()).rejects.toThrow(/is not a valid enum value/);
    });

    it('has dropped the estimate / scheduling / multi-bag / refund fields', () => {
      for (const gone of [
        'estimatedWeight', 'estimatedTotal', 'weightDifference',
        'numberOfBags', 'bagsWeighed', 'bagsProcessed', 'bagsPickedUp', 'bagWeights',
        'pickupDate', 'pickupTime', 'specialPickupInstructions',
        'isImmediatePickup', 'pickupDeadline', 'immediatePickupRequestedAt',
        'refundAmount', 'refundReason', 'refundReference', 'refundedAt',
        'processingStartedAt', 'completedAt'
      ]) {
        expect(Order.schema.path(gone)).toBeUndefined();
      }
    });

    it('validates proofOfDelivery method + confirmedByRole enums', async () => {
      const ok = await buildOrder({
        proofOfDelivery: {
          method: 'customer_pin', confirmedByRole: 'customer',
          confirmedById: 'CUST-model-test', confirmedAt: new Date(),
          geo: { type: 'Point', coordinates: [-97.7431, 30.2672] }
        }
      }).save();
      expect(ok.proofOfDelivery.method).toBe('customer_pin');
      expect(ok.proofOfDelivery.geo.coordinates).toEqual([-97.7431, 30.2672]);

      await expect(buildOrder({
        proofOfDelivery: { method: 'carrier_photo', confirmedByRole: 'customer' }
      }).save()).rejects.toThrow(/is not a valid enum value/);
    });

    it('defaults the new payment-hold fields', async () => {
      const order = await buildOrder().save();
      expect(order.paymentEscalated).toBe(false);
      expect(order.heldAtStore).toBe(false);
      expect(order.holdNoticeSentAt).toBeUndefined();
      expect(order.commissionRealized).toBe(false);
    });
  });

  describe('pre-save pricing engine (actualWeight only)', () => {
    it('fetches baseRate from SystemConfig and computes totals from actualWeight', async () => {
      // defaults: wdf_base_rate_per_pound = 1.25
      const order = await buildOrder({ actualWeight: 20 }).save();
      expect(order.baseRate).toBe(1.25);
      // wdf 20*1.25=25.00; fee 10.00; no add-ons
      expect(order.actualTotal).toBeCloseTo(35.00, 2);
      expect(order.paymentAmount).toBeCloseTo(35.00, 2);
      // commission = wdf*0.1 + fee = 2.50 + 10.00
      expect(order.affiliateCommission).toBeCloseTo(12.50, 2);
    });

    it('falls back to the 1.25 default when SystemConfig.getValue throws', async () => {
      const original = SystemConfig.getValue;
      SystemConfig.getValue = jest.fn().mockRejectedValue(new Error('boom'));
      const order = await buildOrder().save();
      expect(order.baseRate).toBe(1.25);
      SystemConfig.getValue = original;
    });

    it('prices add-ons at 10c/lb each off actualWeight', async () => {
      const order = await buildOrder({
        actualWeight: 20,
        addOns: { premiumDetergent: true, fabricSoftener: true, stainRemover: false }
      }).save();
      // 2 add-ons * 20 lbs * 0.10 = 4.00
      expect(order.addOnTotal).toBeCloseTo(4.00, 2);
      expect(order.actualTotal).toBeCloseTo(25 + 10 + 4, 2);
      // add-ons are NOT in commission
      expect(order.affiliateCommission).toBeCloseTo(12.50, 2);
    });

    it('applies carry-in wdfCreditApplied to actualTotal but not paymentAmount-free commission', async () => {
      const order = await buildOrder({ actualWeight: 20, wdfCreditApplied: 5 }).save();
      expect(order.actualTotal).toBeCloseTo(30.00, 2);      // 35 - 5 credit
      expect(order.paymentAmount).toBeCloseTo(35.00, 2);    // gross, credit-free
      expect(order.affiliateCommission).toBeCloseTo(12.50, 2);
    });

    it('applies a negative credit (debit) by increasing the total', async () => {
      const order = await buildOrder({ actualWeight: 20, wdfCreditApplied: -5 }).save();
      expect(order.actualTotal).toBeCloseTo(40.00, 2);
    });

    it('never generates variance credit (wdfCreditGenerated stays 0)', async () => {
      const order = await buildOrder({ actualWeight: 47.3 }).save();
      expect(order.wdfCreditGenerated).toBe(0);
    });

    it('reads feeBreakdown.totalFee — does not compute the delivery fee', async () => {
      const order = await buildOrder({
        actualWeight: 10,
        feeBreakdown: { numberOfBags: 1, minimumFee: 25, perBagFee: 5, totalFee: 25, minimumApplied: true }
      }).save();
      // wdf 12.50 + fee 25
      expect(order.actualTotal).toBeCloseTo(37.50, 2);
      expect(order.affiliateCommission).toBeCloseTo(1.25 + 25, 2);
    });

    it('recomputes totals when add-ons are entered after creation', async () => {
      const order = await buildOrder({ actualWeight: 20 }).save();
      order.addOns.premiumDetergent = true;
      await order.save();
      expect(order.addOnTotal).toBeCloseTo(2.00, 2);
      expect(order.actualTotal).toBeCloseTo(37.00, 2);
    });
  });

  describe('pre-save lifecycle timestamps', () => {
    it('stamps intakeAt on creation', async () => {
      const order = await buildOrder().save();
      expect(order.intakeAt).toBeInstanceOf(Date);
    });

    it('stamps processedAt / pickedUpAt set-once', async () => {
      const order = await buildOrder().save();
      order.status = 'processed';
      await order.save();
      expect(order.processedAt).toBeInstanceOf(Date);
      const firstProcessedAt = order.processedAt;

      order.status = 'ready_for_pickup'; // direct write (gate normally does this)
      await order.save();
      order.status = 'picked_up';
      await order.save();
      expect(order.pickedUpAt).toBeInstanceOf(Date);
      expect(order.processedAt).toEqual(firstProcessedAt);
    });

    it('does NOT stamp readyForPickupAt (sole writer = applyReadyGate)', async () => {
      const order = await buildOrder({ status: 'processed' }).save();
      order.status = 'ready_for_pickup';
      await order.save();
      expect(order.readyForPickupAt).toBeUndefined();
    });

    it('stamps deliveredAt + commissionRealized/At once on delivered', async () => {
      const order = await buildOrder({ status: 'picked_up' }).save();
      order.status = 'delivered';
      await order.save();
      expect(order.deliveredAt).toBeInstanceOf(Date);
      expect(order.commissionRealized).toBe(true);
      const stamp = order.commissionRealizedAt;
      order.operatorNotes = 'touch';
      await order.save();
      expect(order.commissionRealizedAt).toEqual(stamp); // set-once
    });

    it('stamps cancelledAt on cancelled', async () => {
      const order = await buildOrder().save();
      order.status = 'cancelled';
      await order.save();
      expect(order.cancelledAt).toBeInstanceOf(Date);
    });

    it('stamps paymentVerifiedAt when paymentStatus flips to verified', async () => {
      const order = await buildOrder({ paymentStatus: 'awaiting' }).save();
      order.paymentStatus = 'verified';
      await order.save();
      expect(order.paymentVerifiedAt).toBeInstanceOf(Date);
    });
  });
});
