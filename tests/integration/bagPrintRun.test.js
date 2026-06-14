// POST /api/v1/bags/print-run — combined mint+issue (admin + manage_affiliates).
// Labels are ALWAYS tied to an affiliate: affiliateId required, no partial state.
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../server');
const Administrator = require('../../server/models/Administrator');
const Affiliate = require('../../server/models/Affiliate');
const Bag = require('../../server/modules/bags/Bag');
const { getCsrfToken } = require('../helpers/csrfHelper');
const { hashPassword } = require('../../server/utils/encryption');

describe('POST /api/v1/bags/print-run', () => {
  let agent, csrfToken;
  let admin, adminToken, weakAdmin, weakAdminToken, affiliate, affiliateToken;

  beforeEach(async () => {
    await Administrator.deleteMany({});
    await Affiliate.deleteMany({});
    await Bag.deleteMany({});

    admin = await Administrator.create({
      administratorId: 'ADM-pr-1', firstName: 'Print', lastName: 'Admin',
      email: 'printadmin@test.com', username: 'printadmin',
      passwordSalt: 'salt', passwordHash: 'hash',
      permissions: ['manage_affiliates']
    });
    weakAdmin = await Administrator.create({
      administratorId: 'ADM-pr-2', firstName: 'No', lastName: 'Perm',
      email: 'nopermpr@test.com', username: 'nopermpr',
      passwordSalt: 'salt', passwordHash: 'hash',
      permissions: ['view_analytics']
    });
    adminToken = jwt.sign({ id: admin._id, role: 'administrator' }, process.env.JWT_SECRET);
    weakAdminToken = jwt.sign({ id: weakAdmin._id, role: 'administrator' }, process.env.JWT_SECRET);

    const { salt, hash } = hashPassword('TestAffiliatePass123!');
    affiliate = new Affiliate({
      firstName: 'Bag', lastName: 'Owner', email: 'prowner@test.com',
      username: 'prowner', passwordHash: hash, passwordSalt: salt,
      phone: '+15125550100', address: '1 Main', city: 'Austin', state: 'TX',
      zipCode: '78701', businessName: 'Print Owner Wash',
      serviceArea: 'Downtown', serviceLatitude: 30.2672, serviceLongitude: -97.7431,
      serviceRadius: 10, minimumDeliveryFee: 25, perBagDeliveryFee: 5,
      paymentMethod: 'check'
    });
    await affiliate.save();
    affiliateToken = jwt.sign(
      { id: affiliate._id, affiliateId: affiliate.affiliateId, role: 'affiliate' },
      process.env.JWT_SECRET
    );

    agent = request.agent(app);
    csrfToken = await getCsrfToken(app, agent);
  });

  it('mints AND issues a batch, returning 201 {batchId,count}; bags exist as issued', async () => {
    const res = await agent
      .post('/api/v1/bags/print-run')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-csrf-token', csrfToken)
      .send({ affiliateId: affiliate.affiliateId, quantity: 5 });
    expect(res.status).toBe(201);
    expect(res.body.batchId).toMatch(/^BATCH-/);
    expect(res.body.count).toBe(5);

    const bags = await Bag.find({ batchId: res.body.batchId });
    expect(bags).toHaveLength(5);
    expect(bags.every((b) => b.status === 'issued')).toBe(true);
    expect(bags.every((b) => b.affiliateId === affiliate.affiliateId)).toBe(true);
  });

  it('rejects without a CSRF token (403)', async () => {
    const res = await agent
      .post('/api/v1/bags/print-run')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ affiliateId: affiliate.affiliateId, quantity: 1 });
    expect(res.status).toBe(403);
  });

  it('403s a non-admin (affiliate)', async () => {
    const res = await agent
      .post('/api/v1/bags/print-run')
      .set('Authorization', `Bearer ${affiliateToken}`)
      .set('x-csrf-token', csrfToken)
      .send({ affiliateId: affiliate.affiliateId, quantity: 1 });
    expect(res.status).toBe(403);
  });

  it('403s an admin without manage_affiliates', async () => {
    const res = await agent
      .post('/api/v1/bags/print-run')
      .set('Authorization', `Bearer ${weakAdminToken}`)
      .set('x-csrf-token', csrfToken)
      .send({ affiliateId: affiliate.affiliateId, quantity: 1 });
    expect(res.status).toBe(403);
  });

  it('404s an unknown affiliate', async () => {
    const res = await agent
      .post('/api/v1/bags/print-run')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-csrf-token', csrfToken)
      .send({ affiliateId: 'AFF-nope', quantity: 1 });
    expect(res.status).toBe(404);
    expect(await Bag.countDocuments({})).toBe(0);
  });

  it('400s an out-of-bounds quantity (0, negative, over max)', async () => {
    for (const quantity of [0, -3, 9999]) {
      const res = await agent
        .post('/api/v1/bags/print-run')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-csrf-token', csrfToken)
        .send({ affiliateId: affiliate.affiliateId, quantity });
      expect(res.status).toBe(400);
    }
    expect(await Bag.countDocuments({})).toBe(0);
  });
});
