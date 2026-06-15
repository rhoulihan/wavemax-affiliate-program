// Location affiliates — WaveMAX-operated collection points with ZERO commission.
//
// Two seams under test:
//   1. POST /api/v1/administrators/affiliates — admin hand-creates an affiliate
//      (no invite), server provisions a one-time temporary password + delivery code.
//   2. Commission zeroing at the source: an order intaken for a 'location'
//      affiliate computes affiliateCommission 0 and realizes 0 at delivery,
//      so the W-9 threshold trigger never fires for it.

jest.mock('../../server/utils/emailService');
jest.setTimeout(90000);

const mongoose = require('mongoose');
const app = require('../../server');
const Administrator = require('../../server/models/Administrator');
const Affiliate = require('../../server/models/Affiliate');
const Customer = require('../../server/models/Customer');
const Operator = require('../../server/models/Operator');
const Order = require('../../server/models/Order');
const Bag = require('../../server/modules/bags/Bag');
const SystemConfig = require('../../server/models/SystemConfig');
const encryptionUtil = require('../../server/utils/encryption');
const roleCodes = require('../../server/utils/roleCodes');
const { createTestToken } = require('../helpers/authHelper');
const { getCsrfToken, createAgent } = require('../helpers/csrfHelper');

describe('Location affiliates (zero-commission collection points)', () => {

  // ========================================================================
  // 1. Admin manual-create endpoint
  // ========================================================================
  describe('POST /api/v1/administrators/affiliates', () => {
    let agent, csrfToken, adminToken, limitedAdminToken;

    const createBody = (overrides = {}) => ({
      firstName: 'Loc',
      lastName: 'Point',
      email: 'locpoint@example.com',
      phone: '512-555-0100',
      businessName: 'WaveMAX North Austin Drop',
      address: '1 Collect St',
      city: 'Austin',
      state: 'TX',
      zipCode: '78753',
      username: 'locpoint1',
      ...overrides
    });

    beforeEach(async () => {
      await Administrator.deleteMany({});
      await Affiliate.deleteMany({});

      const admin = await Administrator.create({
        firstName: 'Test', lastName: 'Admin', email: 'admin@test.com',
        username: 'testadmin', passwordSalt: 'salt', passwordHash: 'hash',
        permissions: ['manage_affiliates']
      });
      adminToken = createTestToken(admin._id, 'administrator');

      const limitedAdmin = await Administrator.create({
        firstName: 'Limited', lastName: 'Admin', email: 'limited@test.com',
        username: 'limitedadmin', passwordSalt: 'salt', passwordHash: 'hash',
        permissions: ['view_analytics']
      });
      limitedAdminToken = createTestToken(limitedAdmin._id, 'administrator');

      agent = createAgent(app);
      csrfToken = await getCsrfToken(app, agent);
    });

    const post = (body, token = adminToken, withCsrf = true) => {
      const req = agent
        .post('/api/v1/administrators/affiliates')
        .set('Authorization', `Bearer ${token}`);
      if (withCsrf) req.set('x-csrf-token', csrfToken);
      return req.send(body);
    };

    test('201 creates a location affiliate with one-time temporary password + delivery code', async () => {
      const res = await post(createBody());

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.affiliateId).toMatch(/^AFF-/);
      expect(typeof res.body.temporaryPassword).toBe('string');
      expect(res.body.temporaryPassword.length).toBeGreaterThanOrEqual(12);
      expect(typeof res.body.deliveryCode).toBe('string');
      expect(res.body.deliveryCode.length).toBeGreaterThanOrEqual(6);

      const persisted = await Affiliate.findOne({ affiliateId: res.body.affiliateId })
        .select('+affiliateDeliveryCodeHash');
      expect(persisted).toBeTruthy();
      expect(persisted.affiliateType).toBe('location');
      expect(persisted.isActive).toBe(true);
      expect(persisted.w9Status).toBe('not_required');
      // Location affiliates charge no delivery fees by default
      expect(persisted.minimumDeliveryFee).toBe(0);
      expect(persisted.perBagDeliveryFee).toBe(0);
      // The returned one-time secrets verify against the stored hashes
      expect(encryptionUtil.verifyPassword(
        res.body.temporaryPassword, persisted.passwordSalt, persisted.passwordHash
      )).toBe(true);
      expect(roleCodes.verifyCode(res.body.deliveryCode, persisted.affiliateDeliveryCodeHash)).toBe(true);
    });

    test("accepts affiliateType 'standard' with normal fee defaults", async () => {
      const res = await post(createBody({
        email: 'std@example.com', username: 'stdaff1', affiliateType: 'standard'
      }));
      expect(res.status).toBe(201);
      const persisted = await Affiliate.findOne({ affiliateId: res.body.affiliateId });
      expect(persisted.affiliateType).toBe('standard');
      expect(persisted.minimumDeliveryFee).toBe(25);
      expect(persisted.perBagDeliveryFee).toBe(5);
    });

    test('403 without the manage_affiliates permission', async () => {
      const res = await post(createBody(), limitedAdminToken);
      expect(res.status).toBe(403);
      expect(await Affiliate.countDocuments()).toBe(0);
    });

    test('403 without a CSRF token', async () => {
      const res = await post(createBody(), adminToken, false);
      expect(res.status).toBe(403);
      expect(await Affiliate.countDocuments()).toBe(0);
    });

    test('409 on duplicate email', async () => {
      await post(createBody());
      const res = await post(createBody({ username: 'otheruser' }));
      expect(res.status).toBe(409);
      expect(await Affiliate.countDocuments()).toBe(1);
    });

    test('409 on duplicate username', async () => {
      await post(createBody());
      const res = await post(createBody({ email: 'other@example.com' }));
      expect(res.status).toBe(409);
      expect(await Affiliate.countDocuments()).toBe(1);
    });

    test('400 on invalid email', async () => {
      const res = await post(createBody({ email: 'not-an-email' }));
      expect(res.status).toBe(400);
    });
  });

  // ========================================================================
  // 2. Commission zeroing through the real intake -> delivered path
  // ========================================================================
  describe('commission zeroing for location affiliates', () => {
    let operatorAgent, operatorToken, operatorCsrfToken;

    async function createWorld({ affiliateType = 'standard' } = {}) {
      const uniq = `${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
      const { salt, hash } = encryptionUtil.hashPassword('FixturePassword417!');

      const affiliate = await Affiliate.create({
        firstName: 'Fix', lastName: 'Affiliate', email: `fixaff${uniq}@example.com`,
        phone: '5125551111', businessName: 'Fixture Wash Co',
        address: '1 Fixture St', city: 'Austin', state: 'TX', zipCode: '78701',
        username: `fixaff${uniq}`, passwordSalt: salt, passwordHash: hash,
        paymentMethod: 'check',
        affiliateType,
        ...(affiliateType === 'location' ? { minimumDeliveryFee: 0, perBagDeliveryFee: 0 } : {}),
        affiliateDeliveryCodeHash: roleCodes.hashCode('VENDOR'),
        affiliateDeliveryCodeSetAt: new Date()
      });

      const customer = await Customer.create({
        affiliateId: affiliate.affiliateId,
        firstName: 'Fix', lastName: 'Customer', email: `fixcust${uniq}@example.com`,
        phone: '5125552222', address: '2 Fixture St', city: 'Austin', state: 'TX', zipCode: '78702',
        username: `fixcust${uniq}`, passwordSalt: salt, passwordHash: hash
      });

      const token = encryptionUtil.generateToken(16);
      const bag = await Bag.create({
        token, tokenHash: Bag.hashToken(token),
        affiliateId: affiliate.affiliateId, customerId: customer.customerId,
        status: 'active', batchId: `BATCH-${uniq}`, claimedAt: new Date()
      });

      return { affiliate, customer, bag, bagToken: token };
    }

    async function intakeAndDeliver(bagToken) {
      const intakeRes = await operatorAgent
        .post('/api/v1/operators/intake')
        .set('Authorization', `Bearer ${operatorToken}`)
        .set('x-csrf-token', operatorCsrfToken)
        .send({ bagToken, weight: 20 });
      expect(intakeRes.status).toBe(201);

      // Advance to picked_up so confirm-delivery can close it
      const order = await Order.findOne({ orderId: intakeRes.body.order.orderId });
      order.status = 'picked_up';
      await order.save();

      const confirmRes = await require('supertest')(app)
        .post(`/api/v1/bags/${bagToken}/confirm-delivery`)
        .send({ code: 'VENDOR' });
      expect(confirmRes.status).toBe(200);

      return Order.findOne({ orderId: intakeRes.body.order.orderId });
    }

    beforeEach(async () => {
      await Promise.all([
        Administrator.deleteMany({}), Operator.deleteMany({}), Order.deleteMany({}),
        Customer.deleteMany({}), Affiliate.deleteMany({}), Bag.deleteMany({})
      ]);

      // Tiny threshold so ANY realized commission > 0 triggers the W-9 flow —
      // this is what makes "stays not_required" a meaningful assertion.
      await SystemConfig.updateOne({ key: 'w9_threshold_usd' }, { $set: { value: 1 } });

      const admin = await Administrator.create({
        firstName: 'Super', lastName: 'User', email: `super${Date.now()}@wavemax.com`,
        passwordSalt: 'salt', passwordHash: 'hash', permissions: ['all']
      });

      process.env.OPERATOR_PIN = '1234';
      process.env.DEFAULT_OPERATOR_ID = 'OPR001';
      await Operator.create({
        operatorId: 'OPR001', firstName: 'Test', lastName: 'Operator',
        email: `operator${Date.now()}@wavemax.com`, username: `testop${Date.now()}`,
        password: 'OperatorStrongPassword951!',
        shiftStart: '00:00', shiftEnd: '23:59', createdBy: admin._id
      });

      operatorAgent = createAgent(app);
      const operatorLogin = await operatorAgent
        .post('/api/v1/auth/operator/login')
        .send({ pinCode: '1234' });
      operatorToken = operatorLogin.body.token;
      operatorCsrfToken = await getCsrfToken(app, operatorAgent);
    });

    afterEach(async () => {
      await SystemConfig.initializeDefaults(); // restore the threshold row
    });

    test('location affiliate: order computes commission 0, realizes 0, w9Status stays not_required', async () => {
      const { affiliate, bagToken } = await createWorld({ affiliateType: 'location' });

      const delivered = await intakeAndDeliver(bagToken);
      expect(delivered.status).toBe('delivered');
      expect(delivered.commissionRealized).toBe(true);
      expect(delivered.affiliateCommission).toBe(0);
      // Customer still owes for the wash itself
      expect(delivered.actualTotal).toBeGreaterThan(0);

      const reloadedAffiliate = await Affiliate.findOne({ affiliateId: affiliate.affiliateId });
      expect(reloadedAffiliate.w9Status).toBe('not_required');
      expect(reloadedAffiliate.paymentProcessingLocked).toBe(false);
    });

    test('standard affiliate: commission unchanged and the W-9 trigger still fires (contrast)', async () => {
      const { affiliate, bagToken } = await createWorld({ affiliateType: 'standard' });

      const delivered = await intakeAndDeliver(bagToken);
      expect(delivered.status).toBe('delivered');
      expect(delivered.commissionRealized).toBe(true);
      // (20 lbs x baseRate x 10%) + delivery fee — definitely > 0
      expect(delivered.affiliateCommission).toBeGreaterThan(0);

      const reloadedAffiliate = await Affiliate.findOne({ affiliateId: affiliate.affiliateId });
      expect(reloadedAffiliate.w9Status).toBe('required'); // threshold of $1 crossed
    });
  });
});
