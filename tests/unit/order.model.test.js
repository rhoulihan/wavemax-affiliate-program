// Order model — slim state record (Phase 1 PR 3, spec §6).
// The order holds NO money/weight/pricing/commission — just bag linkage,
// status, and per-scan {at, by, role} stamps.
const { v4: uuidv4 } = require('uuid');
const Order = require('../../server/models/Order');

function buildOrder(overrides = {}) {
  return new Order({
    customerId: 'CUST-model-test',
    affiliateId: 'AFF-model-test',
    bagId: 'BAG-' + uuidv4(),
    bagToken: 'a1b2c3d4e5f60718293a4b5c6d7e8f90', // 32-hex scan key
    ...overrides
  });
}

describe('Order model (slim state record)', () => {
  afterEach(async () => {
    await Order.deleteMany({});
  });

  describe('schema shape', () => {
    it('defaults status to pending', async () => {
      const order = await buildOrder().save();
      expect(order.status).toBe('pending');
    });

    it('accepts every new enum value', async () => {
      for (const status of ['pending', 'in_progress', 'out_for_delivery', 'complete', 'cancelled']) {
        const order = await buildOrder({ status }).save();
        expect(order.status).toBe(status);
        await Order.deleteMany({});
      }
    });

    it('rejects the old enum values', async () => {
      for (const dead of ['processed', 'ready_for_pickup', 'picked_up', 'delivered', 'processing']) {
        await expect(buildOrder({ status: dead }).save())
          .rejects.toThrow(/is not a valid enum value/);
      }
    });

    it('requires top-level bagId (the BAG-uuid join key)', async () => {
      const order = buildOrder();
      order.bagId = undefined;
      await expect(order.save()).rejects.toThrow(/bagId.*required/i);
    });

    it('stamps the per-scan sub-objects on save', async () => {
      const now = new Date();
      const order = await buildOrder({
        status: 'pending',
        pickup: { at: now, by: 'AFF-1', role: 'affiliate' }
      }).save();
      expect(order.pickup.by).toBe('AFF-1');
      expect(order.pickup.role).toBe('affiliate');
      expect(order.pickup.at).toBeInstanceOf(Date);
    });

    it('stores by as a String (operators AND affiliates scan)', async () => {
      const order = await buildOrder({
        intake: { at: new Date(), by: '507f1f77bcf86cd799439011', role: 'operator' }
      }).save();
      expect(typeof order.intake.by).toBe('string');
      expect(order.intake.by).toBe('507f1f77bcf86cd799439011');
    });

    it('has the paymentConfirmedManually flag (no payment data)', async () => {
      const order = await buildOrder({ paymentConfirmedManually: true }).save();
      expect(order.paymentConfirmedManually).toBe(true);
    });

    it('captures add-ons (key list) + special instructions on the order', async () => {
      const order = await buildOrder({
        addOns: ['premium_detergent', 'stain_remover'],
        specialInstructions: 'Fold shirts on hangers, please.'
      }).save();
      expect(order.addOns).toEqual(['premium_detergent', 'stain_remover']);
      expect(order.specialInstructions).toBe('Fold shirts on hangers, please.');
      // defaults: empty list, no instructions
      const bare = await buildOrder().save();
      expect(bare.addOns).toEqual([]);
      expect(bare.specialInstructions === '' || bare.specialInstructions === undefined).toBe(true);
    });

    it('has dropped every removed money/weight/lifecycle field', () => {
      for (const gone of [
        'actualWeight', 'washInstructions', 'bags',
        'addOnTotal', 'addOnsEnteredBy', 'addOnsEnteredAt',
        'freshAddOnsFormPlaced', 'baseRate', 'feeBreakdown', 'actualTotal',
        'wdfCreditApplied', 'wdfCreditGenerated', 'affiliateCommission',
        'zeroCommission', 'commissionRealized', 'commissionRealizedAt',
        'assignedOperator', 'operatorNotes', 'qualityCheckPassed',
        'processingTimeMinutes', 'wdfAmount', 'mdfAmount', 'proofOfDelivery',
        'processedAt', 'readyForPickupAt', 'pickedUpAt', 'deliveredAt', 'intakeAt',
        'estimatedWeight', 'estimatedTotal', 'numberOfBags', 'pickupDate'
      ]) {
        expect(Order.schema.path(gone)).toBeUndefined();
      }
    });

    it('has no embedded intake sub-block fields (intake is a scan stamp now)', () => {
      // intake is {at, by, role}; it should NOT have a weight/weighedAt
      expect(Order.schema.path('intake.weight')).toBeUndefined();
      expect(Order.schema.path('intake.weighedBy')).toBeUndefined();
      expect(Order.schema.path('intake.at')).toBeDefined();
    });
  });

  // "At most one open order per bag" is enforced at the application layer
  // (orderTransitionService read-guard), not by a DB constraint — the ADB Mongo
  // API does not support the partial unique index, and the volume does not
  // warrant it. The model therefore places NO uniqueness constraint on bagId;
  // multiple open orders for a bag are physically possible and the service guard
  // is what prevents them. Coverage lives in the transition-service / scan
  // integration tests (see orderIntakeRace.test.js).
  describe('no DB-level open-order uniqueness constraint', () => {
    it('does not enforce open-order uniqueness at the model layer', async () => {
      await Order.syncIndexes();
      const bagId = 'BAG-' + uuidv4();
      await buildOrder({ bagId, status: 'pending' }).save();
      // No partial unique index → a second open order is not blocked by the DB.
      const second = await buildOrder({ bagId, status: 'pending' }).save();
      expect(second.status).toBe('pending');
    });
  });

  describe('no pre-save pricing/commission engine', () => {
    it('does not set baseRate or any total on save', async () => {
      const order = await buildOrder().save();
      expect(order.baseRate).toBeUndefined();
      expect(order.actualTotal).toBeUndefined();
      expect(order.affiliateCommission).toBeUndefined();
    });
  });
});
