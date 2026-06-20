// PR 2 — add-ons + special instructions captured at order start.
// The customer/field start form sends addOns[] + specialInstructions; they
// thread scan apply → createPendingOrder and persist on the pending order,
// validated against the active add-on catalog (unknown/inactive keys dropped).
jest.mock('../../server/utils/emailService');

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../server');
const Customer = require('../../server/models/Customer');
const Affiliate = require('../../server/models/Affiliate');
const Operator = require('../../server/models/Operator');
const Bag = require('../../server/modules/bags/Bag');
const Order = require('../../server/models/Order');
const AddOn = require('../../server/models/AddOn');
const SystemConfig = require('../../server/models/SystemConfig');
const encryptionUtil = require('../../server/utils/encryption');
const roleCodes = require('../../server/utils/roleCodes');

jest.setTimeout(60000);

const OP_CODE = 'OPCODE99';

async function createWorld() {
  const uniq = `${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
  const { salt, hash } = encryptionUtil.hashPassword('FixturePassword417!');
  const affiliate = await Affiliate.create({
    firstName: 'Fix', lastName: 'Affiliate', email: `fixaff${uniq}@example.com`,
    phone: '5125551111', businessName: 'Fixture Wash Co',
    address: '1 Fixture St', city: 'Austin', state: 'TX', zipCode: '78701',
    username: `fixaff${uniq}`, passwordSalt: salt, passwordHash: hash, paymentMethod: 'check'
  });
  const customer = await Customer.create({
    affiliateId: affiliate.affiliateId,
    firstName: 'Fix', lastName: 'Customer', email: `FixCust${uniq}@Example.com`,
    phone: '512-555-2222', address: '2 Fixture St', city: 'Austin', state: 'TX', zipCode: '78702'
  });
  await Operator.create({
    firstName: 'Fix', lastName: 'Operator', email: `fixop${uniq}@example.com`,
    username: `fixop${uniq}`, password: 'StrongOperatorPass417!',
    createdBy: new mongoose.Types.ObjectId(),
    scanCodeHmac: roleCodes.hmacCode(OP_CODE), scanCodeSetAt: new Date()
  });
  const token = encryptionUtil.generateToken(16);
  const bag = await Bag.create({
    token, tokenHash: Bag.hashToken(token),
    affiliateId: affiliate.affiliateId, customerId: customer.customerId,
    status: 'active', batchId: `BATCH-${uniq}`, claimedAt: new Date()
  });
  return { affiliate, customer, bag, bagToken: token };
}

const mint = (bagToken, code) =>
  request(app).post('/api/v1/scan/session').send({ bagToken, code });
const applyWith = (token, bagToken, expectedAction, extra = {}) =>
  request(app).post('/api/v1/scan/apply')
    .set('x-scan-session', token).send({ bagToken, expectedAction, ...extra });
const resolveWith = (token, bagToken) =>
  request(app).post('/api/v1/scan/resolve').set('x-scan-session', token).send({ bagToken });

describe('order add-ons + special instructions capture', () => {
  beforeAll(async () => { await SystemConfig.initializeDefaults(); await AddOn.initializeDefaults(); });

  test('customer create-pending persists valid add-ons + special instructions', async () => {
    const { bagToken, bag } = await createWorld();
    const session = (await mint(bagToken, '5125552222')).body.sessionToken;
    const res = await applyWith(session, bagToken, 'create-pending', {
      addOns: ['premium_detergent', 'stain_remover'],
      specialInstructions: 'Please fold delicates separately.'
    });
    expect(res.status).toBe(200);
    const order = await Order.findOne({ bagId: bag.bagId });
    expect(order.addOns.sort()).toEqual(['premium_detergent', 'stain_remover']);
    expect(order.specialInstructions).toBe('Please fold delicates separately.');
  });

  test('unknown + inactive add-on keys are dropped (only active catalog keys persist)', async () => {
    const { bagToken, bag } = await createWorld();
    await AddOn.updateOne({ key: 'stain_remover' }, { $set: { isActive: false } });
    const session = (await mint(bagToken, '5125552222')).body.sessionToken;
    const res = await applyWith(session, bagToken, 'create-pending', {
      addOns: ['premium_detergent', 'stain_remover', 'totally_made_up', 123, '']
    });
    expect(res.status).toBe(200);
    const order = await Order.findOne({ bagId: bag.bagId });
    expect(order.addOns).toEqual(['premium_detergent']); // inactive + unknown + junk all dropped
  });

  test('duplicate add-on keys are de-duplicated', async () => {
    const { bagToken, bag } = await createWorld();
    const session = (await mint(bagToken, '5125552222')).body.sessionToken;
    await applyWith(session, bagToken, 'create-pending', {
      addOns: ['premium_detergent', 'premium_detergent', 'fabric_softener']
    });
    const order = await Order.findOne({ bagId: bag.bagId });
    expect(order.addOns.sort()).toEqual(['fabric_softener', 'premium_detergent']);
  });

  test('over-long special instructions are truncated, never rejected', async () => {
    const { bagToken, bag } = await createWorld();
    const session = (await mint(bagToken, '5125552222')).body.sessionToken;
    const huge = 'x'.repeat(5000);
    const res = await applyWith(session, bagToken, 'create-pending', { specialInstructions: huge });
    expect(res.status).toBe(200);
    const order = await Order.findOne({ bagId: bag.bagId });
    expect(order.specialInstructions.length).toBe(1000);
  });

  test('create-pending with no add-ons leaves an empty list', async () => {
    const { bagToken, bag } = await createWorld();
    const session = (await mint(bagToken, '5125552222')).body.sessionToken;
    await applyWith(session, bagToken, 'create-pending');
    const order = await Order.findOne({ bagId: bag.bagId });
    expect(order.addOns).toEqual([]);
    expect(order.specialInstructions === '' || order.specialInstructions === undefined).toBe(true);
  });

  test('resolve on a PENDING bag returns the add-ons (localizable) + instructions', async () => {
    const { bagToken } = await createWorld();
    const session = (await mint(bagToken, '5125552222')).body.sessionToken;
    await applyWith(session, bagToken, 'create-pending', {
      addOns: ['premium_detergent', 'fabric_softener'],
      specialInstructions: 'Hang dry the linens.'
    });
    // re-mint (the customer session is fine to resolve) and read the resolve payload
    const res = await resolveWith(session, bagToken);
    expect(res.status).toBe(200);
    expect(res.body.currentStatus).toBe('pending');
    const keys = res.body.addOns.map(a => a.key).sort();
    expect(keys).toEqual(['fabric_softener', 'premium_detergent']);
    // each carries name + translations so the operator UI can localize
    const pd = res.body.addOns.find(a => a.key === 'premium_detergent');
    expect(pd.name).toBe('Premium Detergent');
    expect(pd.translations.es).toBe('Detergente premium');
    expect(res.body.specialInstructions).toBe('Hang dry the linens.');
  });

  test('resolve on a non-pending (in_progress) bag does NOT expose add-ons/instructions', async () => {
    const { bagToken } = await createWorld();
    const op = (await mint(bagToken, OP_CODE)).body.sessionToken;
    await applyWith(op, bagToken, 'create-pending', {
      addOns: ['premium_detergent'], specialInstructions: 'secret'
    });
    await applyWith(op, bagToken, 'advance'); // -> in_progress
    const res = await resolveWith(op, bagToken);
    expect(res.body.currentStatus).toBe('in_progress');
    expect(res.body.addOns).toEqual([]);
    expect(res.body.specialInstructions === '' || res.body.specialInstructions === undefined).toBe(true);
  });

  test('add-ons sent on a non-creating advance do NOT mutate the order', async () => {
    const { bagToken, bag } = await createWorld();
    // operator opens with add-ons, then advances sending different add-ons
    const op = (await mint(bagToken, OP_CODE)).body.sessionToken;
    await applyWith(op, bagToken, 'create-pending', { addOns: ['premium_detergent'] });
    await applyWith(op, bagToken, 'advance', { addOns: ['fabric_softener', 'stain_remover'] });
    const order = await Order.findOne({ bagId: bag.bagId });
    expect(order.status).toBe('in_progress');
    expect(order.addOns).toEqual(['premium_detergent']); // unchanged by the advance
  });
});
