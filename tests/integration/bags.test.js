// /api/v1/bags — mint / labels / issue / resolve / inventory (spec §5, §6.1, §9)
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../server');
const Administrator = require('../../server/models/Administrator');
const Affiliate = require('../../server/models/Affiliate');
const Bag = require('../../server/modules/bags/Bag');
const bagService = require('../../server/modules/bags/bagService');
const { getCsrfToken } = require('../helpers/csrfHelper');
const { hashPassword } = require('../../server/utils/encryption');

describe('Bag endpoints', () => {
  let agent, csrfToken;
  let admin, adminToken, weakAdmin, weakAdminToken;
  let affiliate, affiliateToken;

  beforeEach(async () => {
    await Administrator.deleteMany({});
    await Affiliate.deleteMany({});
    await Bag.deleteMany({});

    admin = await Administrator.create({
      administratorId: 'ADM-bags-1', firstName: 'Bag', lastName: 'Admin',
      email: 'bagadmin@test.com', username: 'bagadmin',
      passwordSalt: 'salt', passwordHash: 'hash',
      permissions: ['manage_affiliates']
    });
    weakAdmin = await Administrator.create({
      administratorId: 'ADM-bags-2', firstName: 'No', lastName: 'Perm',
      email: 'nopermadmin@test.com', username: 'nopermadmin',
      passwordSalt: 'salt', passwordHash: 'hash',
      permissions: ['view_analytics']
    });
    adminToken = jwt.sign({ id: admin._id, role: 'administrator' }, process.env.JWT_SECRET);
    weakAdminToken = jwt.sign({ id: weakAdmin._id, role: 'administrator' }, process.env.JWT_SECRET);

    const { salt, hash } = hashPassword('TestAffiliatePass123!');
    affiliate = new Affiliate({
      firstName: 'Bag', lastName: 'Owner', email: 'bagowner@test.com',
      username: 'bagowner', passwordHash: hash, passwordSalt: salt,
      phone: '+15125550100', address: '1 Main', city: 'Austin', state: 'TX',
      zipCode: '78701', businessName: 'Bag Owner Wash',
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

  describe('POST /api/v1/bags/mint', () => {
    it('mints a batch for an admin with manage_affiliates (CSRF required)', async () => {
      const res = await agent
        .post('/api/v1/bags/mint')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-csrf-token', csrfToken)
        .send({ affiliateId: affiliate.affiliateId, quantity: 3 });
      expect(res.status).toBe(201);
      expect(res.body.batchId).toMatch(/^BATCH-/);
      expect(res.body.count).toBe(3);
      expect(res.body.bags).toHaveLength(3);
      // raw token returned ONCE at mint (feeds label printing)
      expect(res.body.bags[0].token).toMatch(/^[0-9a-f]{32}$/);
      expect(res.body.bags[0].bagId).toMatch(/^BAG-/);
      expect(res.body.bags[0].status).toBe('minted');
    });

    it('rejects without CSRF token', async () => {
      const res = await agent
        .post('/api/v1/bags/mint')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ affiliateId: affiliate.affiliateId, quantity: 1 });
      expect(res.status).toBe(403);
    });

    it('403s an admin without manage_affiliates', async () => {
      const res = await agent
        .post('/api/v1/bags/mint')
        .set('Authorization', `Bearer ${weakAdminToken}`)
        .set('x-csrf-token', csrfToken)
        .send({ affiliateId: affiliate.affiliateId, quantity: 1 });
      expect(res.status).toBe(403);
    });

    it('403s an affiliate', async () => {
      const res = await agent
        .post('/api/v1/bags/mint')
        .set('Authorization', `Bearer ${affiliateToken}`)
        .set('x-csrf-token', csrfToken)
        .send({ affiliateId: affiliate.affiliateId, quantity: 1 });
      expect(res.status).toBe(403);
    });

    it('400s an out-of-bounds quantity and 404s an unknown affiliate', async () => {
      const tooMany = await agent
        .post('/api/v1/bags/mint')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-csrf-token', csrfToken)
        .send({ affiliateId: affiliate.affiliateId, quantity: 9999 });
      expect(tooMany.status).toBe(400);
      const noAff = await agent
        .post('/api/v1/bags/mint')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-csrf-token', csrfToken)
        .send({ affiliateId: 'AFF-nope', quantity: 1 });
      expect(noAff.status).toBe(404);
    });
  });

  describe('GET /api/v1/bags/batch/:batchId/labels', () => {
    it('returns text/html with QR imgs for the admin, 404 for unknown batch', async () => {
      const { batchId } = await bagService.mintBatch({
        affiliateId: affiliate.affiliateId, quantity: 2, adminId: admin._id
      });
      const res = await agent
        .get(`/api/v1/bags/batch/${batchId}/labels`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/html/);
      expect(res.text).toContain('data:image/png');
      expect(res.text).toContain('Bag Owner Wash');
      expect(res.text).not.toMatch(/<script/i);

      const missing = await agent
        .get('/api/v1/bags/batch/BATCH-nope/labels')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(missing.status).toBe(404);
    });

    it('403s a non-admin', async () => {
      const res = await agent
        .get('/api/v1/bags/batch/BATCH-x/labels')
        .set('Authorization', `Bearer ${affiliateToken}`);
      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/v1/bags/batch/:batchId/issue', () => {
    it('issues the batch (admin + CSRF)', async () => {
      const { batchId } = await bagService.mintBatch({
        affiliateId: affiliate.affiliateId, quantity: 2, adminId: admin._id
      });
      const res = await agent
        .post(`/api/v1/bags/batch/${batchId}/issue`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-csrf-token', csrfToken)
        .send({});
      expect(res.status).toBe(200);
      expect(res.body.issued).toBe(2);
      const bags = await Bag.find({ batchId });
      expect(bags.every((b) => b.status === 'issued')).toBe(true);
    });
  });

  describe('GET /api/v1/bags/resolve/:token (public)', () => {
    let token, batchId;

    beforeEach(async () => {
      const minted = await bagService.mintBatch({
        affiliateId: affiliate.affiliateId, quantity: 1, adminId: admin._id
      });
      batchId = minted.batchId;
      token = minted.bags[0].token;
    });

    it('404s generically for unknown AND minted tokens (anti-enumeration)', async () => {
      const unknown = await agent.get(`/api/v1/bags/resolve/${'f'.repeat(32)}`);
      const minted = await agent.get(`/api/v1/bags/resolve/${token}`);
      expect(unknown.status).toBe(404);
      expect(minted.status).toBe(404);
      expect(unknown.body.message).toBe(minted.body.message); // same generic error
    });

    it('returns outcome unclaimed + affiliate name only (no PII) for an issued bag', async () => {
      await bagService.issueBatch({ batchId, adminId: admin._id });
      const res = await agent.get(`/api/v1/bags/resolve/${token}`);
      expect(res.status).toBe(200);
      expect(res.body.outcome).toBe('unclaimed');
      expect(res.body.affiliate).toEqual({ name: 'Bag Owner Wash' });
      expect(res.body.order).toBeNull();
      expect(JSON.stringify(res.body)).not.toContain(affiliate.email);
    });

    it('returns outcome claimed + customerId only for an active bag', async () => {
      await bagService.issueBatch({ batchId, adminId: admin._id });
      await bagService.claim({ token, customerId: 'CUST-claimed-1' });
      const res = await agent.get(`/api/v1/bags/resolve/${token}`);
      expect(res.status).toBe(200);
      expect(res.body.outcome).toBe('claimed');
      expect(res.body.customerId).toBe('CUST-claimed-1');
      expect(res.body.order).toBeNull(); // populated by PR 7/9
      expect(res.body.affiliate).toBeUndefined();
    });
  });

  describe('GET /api/v1/bags (inventory)', () => {
    beforeEach(async () => {
      await bagService.mintBatch({ affiliateId: affiliate.affiliateId, quantity: 2, adminId: admin._id });
    });

    it('scopes an affiliate to their own bags even if they ask for another id', async () => {
      const res = await agent
        .get('/api/v1/bags?affiliateId=AFF-someone-else')
        .set('Authorization', `Bearer ${affiliateToken}`);
      expect(res.status).toBe(200);
      expect(res.body.bags).toHaveLength(2);
      expect(res.body.bags.every((b) => b.affiliateId === affiliate.affiliateId)).toBe(true);
      expect(res.body.bags.every((b) => b.token === undefined && b.tokenHash === undefined)).toBe(true);
    });

    it('lets an admin filter freely; 403s a customer token; 401s anonymous', async () => {
      const adminRes = await agent
        .get(`/api/v1/bags?affiliateId=${affiliate.affiliateId}&status=minted`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(adminRes.status).toBe(200);
      expect(adminRes.body.pagination.total).toBe(2);

      const customerToken = jwt.sign(
        { id: admin._id, customerId: 'CUST-x', role: 'customer' }, process.env.JWT_SECRET
      );
      const customerRes = await agent
        .get('/api/v1/bags')
        .set('Authorization', `Bearer ${customerToken}`);
      expect(customerRes.status).toBe(403);

      const anonRes = await agent.get('/api/v1/bags');
      expect(anonRes.status).toBe(401);
    });
  });
});
