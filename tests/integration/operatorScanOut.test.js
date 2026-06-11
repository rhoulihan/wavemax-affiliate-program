jest.mock('../../server/utils/emailService');

const mongoose = require('mongoose');
const app = require('../../server'); // ensures models/config registered
const emailService = require('../../server/utils/emailService');
const Order = require('../../server/models/Order');
const Customer = require('../../server/models/Customer');
const Affiliate = require('../../server/models/Affiliate');
const Operator = require('../../server/models/Operator');
const Bag = require('../../server/modules/bags/Bag');
const encryptionUtil = require('../../server/utils/encryption');
const roleCodes = require('../../server/utils/roleCodes');
const orderAdvanceService = require('../../server/modules/orders/orderAdvanceService');

jest.setTimeout(60000);

// ---- shared fixture (reused by Tasks 8-11 test files) ----------------------
async function createWorld({ orderStatus, paymentStatus = 'pending' } = {}) {
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
      paymentStatus,
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

describe('orderAdvanceService.advance', () => {
  beforeEach(() => jest.clearAllMocks());

  test('in_progress -> processed, stamps intake + bag sub-status, runs the ready gate (held when unpaid)', async () => {
    const { bagToken, operator, order } = await createWorld({
      orderStatus: 'in_progress', paymentStatus: 'awaiting'
    });
    const result = await orderAdvanceService.advance({ bagToken, operatorId: operator._id });
    expect(result.action).toBe('processed');

    const reloaded = await Order.findOne({ orderId: order.orderId });
    expect(reloaded.status).toBe('processed');         // unpaid -> gate holds
    expect(reloaded.heldAtStore).toBe(true);
    expect(reloaded.intake.processedAt).toBeInstanceOf(Date);
    expect(reloaded.intake.processedBy.toString()).toBe(operator._id.toString());
    expect(reloaded.bags[0].status).toBe('processed');
    expect(reloaded.bags[0].scannedBy.processed.toString()).toBe(operator._id.toString());
  });

  test('in_progress + already-verified payment promotes straight to ready_for_pickup (Path B)', async () => {
    const { bagToken, operator, order } = await createWorld({
      orderStatus: 'in_progress', paymentStatus: 'verified'
    });
    const result = await orderAdvanceService.advance({ bagToken, operatorId: operator._id });
    expect(result.action).toBe('ready_for_pickup');

    const reloaded = await Order.findOne({ orderId: order.orderId });
    expect(reloaded.status).toBe('ready_for_pickup');
    expect(reloaded.readyForPickupAt).toBeInstanceOf(Date);
    expect(reloaded.heldAtStore).toBe(false);
  });

  test('processed + unpaid -> 409 awaiting_payment (held; no workflow email)', async () => {
    const { bagToken, operator } = await createWorld({
      orderStatus: 'processed', paymentStatus: 'awaiting'
    });
    await expect(orderAdvanceService.advance({ bagToken, operatorId: operator._id }))
      .rejects.toMatchObject({ code: 'awaiting_payment', status: 409 });
    expect(emailService.sendOrderOnTheWayEmail).not.toHaveBeenCalled();
  });

  test('ready_for_pickup -> picked_up: stamps, rotates PIN, sends on-the-way email with the NEW pin, no commission', async () => {
    const { bagToken, operator, order, customer } = await createWorld({
      orderStatus: 'ready_for_pickup', paymentStatus: 'verified'
    });
    const before = await Customer.findOne({ customerId: customer.customerId })
      .select('+deliveryPinHash');

    const result = await orderAdvanceService.advance({ bagToken, operatorId: operator._id });
    expect(result.action).toBe('picked_up');

    const reloaded = await Order.findOne({ orderId: order.orderId });
    expect(reloaded.status).toBe('picked_up');
    expect(reloaded.pickedUpAt).toBeInstanceOf(Date);
    expect(reloaded.intake.pickedUpBy.toString()).toBe(operator._id.toString());
    expect(reloaded.bags[0].status).toBe('picked_up');
    expect(reloaded.commissionRealized).toBeFalsy();   // commission ONLY at delivered

    const after = await Customer.findOne({ customerId: customer.customerId })
      .select('+deliveryPinHash');
    expect(after.deliveryPinHash).not.toBe(before.deliveryPinHash); // rotated
    // Rotation INVALIDATES the previous PIN — the fixture's plaintext no
    // longer verifies against the stored hash (orchestrator amendment 4).
    expect(roleCodes.verifyCode('PINPIN', after.deliveryPinHash)).toBe(false);

    expect(emailService.sendOrderOnTheWayEmail).toHaveBeenCalledTimes(1);
    const [, , opts] = emailService.sendOrderOnTheWayEmail.mock.calls[0];
    expect(roleCodes.verifyCode(opts.deliveryPin, after.deliveryPinHash)).toBe(true);
  });

  test('picked_up -> 409 (deliver or re-intake, not advance); unknown bag -> 404; no open order -> 409', async () => {
    const w1 = await createWorld({ orderStatus: 'picked_up', paymentStatus: 'verified' });
    await expect(orderAdvanceService.advance({ bagToken: w1.bagToken, operatorId: w1.operator._id }))
      .rejects.toMatchObject({ code: 'awaiting_delivery_confirmation', status: 409 });

    await expect(orderAdvanceService.advance({
      bagToken: encryptionUtil.generateToken(16), operatorId: w1.operator._id
    })).rejects.toMatchObject({ code: 'invalid_bag', status: 404 });

    const w2 = await createWorld({}); // active bag, no order
    await expect(orderAdvanceService.advance({ bagToken: w2.bagToken, operatorId: w2.operator._id }))
      .rejects.toMatchObject({ code: 'no_open_order', status: 409 });
  });
});
