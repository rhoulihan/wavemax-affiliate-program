// Two-kiosk re-intake race (PR 9): the open-order guard in
// orderIntakeService is read-then-write, so two simultaneous intakes of the
// SAME bag can both pass it. The partial unique index on open Order.bagId is
// the backstop — exactly one save wins; the loser's E11000 is mapped to a
// clean 409 order_already_open.

jest.mock('../../server/utils/emailService');

const mongoose = require('mongoose');
const app = require('../../server'); // ensures models/config registered
const Order = require('../../server/models/Order');
const Customer = require('../../server/models/Customer');
const Affiliate = require('../../server/models/Affiliate');
const Bag = require('../../server/modules/bags/Bag');
const encryptionUtil = require('../../server/utils/encryption');
const { createOrderFromBag } = require('../../server/modules/orders/orderIntakeService');

jest.setTimeout(60000);

async function createWorld() {
  const uniq = `${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
  const { salt, hash } = encryptionUtil.hashPassword('FixturePassword417!');

  const affiliate = await Affiliate.create({
    firstName: 'Race', lastName: 'Affiliate', email: `raceaff${uniq}@example.com`,
    phone: '5125551111', businessName: 'Race Wash Co',
    address: '1 Race St', city: 'Austin', state: 'TX', zipCode: '78701',
    username: `raceaff${uniq}`, passwordSalt: salt, passwordHash: hash,
    paymentMethod: 'check'
  });

  const customer = await Customer.create({
    affiliateId: affiliate.affiliateId,
    firstName: 'Race', lastName: 'Customer', email: `racecust${uniq}@example.com`,
    phone: '5125552222', address: '2 Race St', city: 'Austin', state: 'TX', zipCode: '78702',
    username: `racecust${uniq}`, passwordSalt: salt, passwordHash: hash
  });

  const token = encryptionUtil.generateToken(16);
  const bag = await Bag.create({
    token, tokenHash: Bag.hashToken(token),
    affiliateId: affiliate.affiliateId, customerId: customer.customerId,
    status: 'active', batchId: `BATCH-${uniq}`, claimedAt: new Date()
  });

  return { affiliate, customer, bag, bagToken: token };
}

describe('order intake concurrency (partial unique index on open bagId)', () => {
  beforeEach(async () => {
    // setup.js afterEach drops indexes; the partial unique index must exist
    // for the race backstop (repo pattern — see tests/unit/models/Bag.test.js).
    await Order.createIndexes();
  });

  test('two simultaneous createOrderFromBag for the same bag: exactly one success, loser gets clean 409 order_already_open', async () => {
    const { bagToken } = await createWorld();
    const operatorA = new mongoose.Types.ObjectId();
    const operatorB = new mongoose.Types.ObjectId();

    const results = await Promise.allSettled([
      createOrderFromBag({ bagToken, weight: 10, addOns: {}, freshAddOnsFormPlaced: false, operatorId: operatorA }),
      createOrderFromBag({ bagToken, weight: 12, addOns: {}, freshAddOnsFormPlaced: false, operatorId: operatorB })
    ]);

    const fulfilled = results.filter(r => r.status === 'fulfilled');
    const rejected = results.filter(r => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    // The loser gets a clean mapped IntakeError, never a raw Mongo E11000.
    const err = rejected[0].reason;
    expect(err.isIntakeError).toBe(true);
    expect(err.code).toBe('order_already_open');
    expect(err.status).toBe(409);
    expect(err.message).not.toMatch(/E11000/);

    // Exactly one open order exists for the bag.
    const bag = await Bag.findOne({ tokenHash: Bag.hashToken(bagToken) });
    const openOrders = await Order.find({
      bagId: bag.bagId,
      status: { $in: ['in_progress', 'processed', 'ready_for_pickup', 'picked_up'] }
    });
    expect(openOrders).toHaveLength(1);
  });

  test('the partial index does NOT block a new order after the previous one is delivered', async () => {
    const { bagToken, bag } = await createWorld();
    const operatorId = new mongoose.Types.ObjectId();

    const { order: first } = await createOrderFromBag({
      bagToken, weight: 10, addOns: {}, freshAddOnsFormPlaced: false, operatorId
    });
    await Order.updateOne({ orderId: first.orderId }, { $set: { status: 'delivered' } });

    const { order: second } = await createOrderFromBag({
      bagToken, weight: 11, addOns: {}, freshAddOnsFormPlaced: false, operatorId
    });
    expect(second.orderId).not.toBe(first.orderId);
    expect(second.bagId).toBe(bag.bagId);
    expect(second.status).toBe('in_progress');
  });
});
