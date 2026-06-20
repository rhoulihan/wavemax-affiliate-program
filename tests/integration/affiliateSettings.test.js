// PR A — admin per-affiliate settings (serviceType + order notifications).
// PATCH /api/v1/administrators/affiliates/:affiliateId
jest.setTimeout(90000);

const app = require('../../server');
const Administrator = require('../../server/models/Administrator');
const Affiliate = require('../../server/models/Affiliate');
const encryptionUtil = require('../../server/utils/encryption');
const { createTestToken } = require('../helpers/authHelper');
const { getCsrfToken, createAgent } = require('../helpers/csrfHelper');

describe('Admin affiliate settings API', () => {
  let agent, csrfToken, adminToken, limitedToken;

  const makeAffiliate = async (overrides = {}) => {
    const { salt, hash } = encryptionUtil.hashPassword('FixturePass123!');
    const uniq = `${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
    return Affiliate.create({
      firstName: 'Aff', lastName: 'Iliate', email: `aff${uniq}@example.com`,
      phone: '5125550001', address: '1 A St', city: 'Austin', state: 'TX', zipCode: '78701',
      username: `aff${uniq}`, passwordSalt: salt, passwordHash: hash, paymentMethod: 'check',
      ...overrides
    });
  };

  beforeEach(async () => {
    await Administrator.deleteMany({});
    await Affiliate.deleteMany({});

    const admin = await Administrator.create({
      firstName: 'Test', lastName: 'Admin', email: 'admin@test.com',
      username: 'testadmin', passwordSalt: 'salt', passwordHash: 'hash',
      permissions: ['manage_affiliates', 'view_analytics']
    });
    adminToken = createTestToken(admin._id, 'administrator');

    const limited = await Administrator.create({
      firstName: 'Lim', lastName: 'Ited', email: 'limited@test.com',
      username: 'limitedadmin', passwordSalt: 'salt', passwordHash: 'hash',
      permissions: ['view_analytics']
    });
    limitedToken = createTestToken(limited._id, 'administrator');

    agent = createAgent(app);
    csrfToken = await getCsrfToken(app, agent);
  });

  it('updates serviceType + notifications and persists', async () => {
    const aff = await makeAffiliate({ serviceType: 'pickup_location' });
    expect(aff.orderNotificationsEnabled).toBe(false);

    const res = await agent
      .patch(`/api/v1/administrators/affiliates/${aff.affiliateId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-csrf-token', csrfToken)
      .send({ serviceType: 'full_service', orderNotificationsEnabled: true });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.affiliate.serviceType).toBe('full_service');
    expect(res.body.affiliate.orderNotificationsEnabled).toBe(true);

    const reloaded = await Affiliate.findOne({ affiliateId: aff.affiliateId });
    expect(reloaded.serviceType).toBe('full_service');
    expect(reloaded.orderNotificationsEnabled).toBe(true);
  });

  it('can turn notifications off independently of serviceType', async () => {
    const aff = await makeAffiliate({ serviceType: 'full_service' }); // defaults notifications ON
    expect(aff.orderNotificationsEnabled).toBe(true);

    const res = await agent
      .patch(`/api/v1/administrators/affiliates/${aff.affiliateId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-csrf-token', csrfToken)
      .send({ orderNotificationsEnabled: false });

    expect(res.status).toBe(200);
    expect(res.body.affiliate.orderNotificationsEnabled).toBe(false);
    expect(res.body.affiliate.serviceType).toBe('full_service');
  });

  it('updates pickupInstructions and persists', async () => {
    const aff = await makeAffiliate({ pickupInstructions: 'old text' });
    const res = await agent
      .patch(`/api/v1/administrators/affiliates/${aff.affiliateId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-csrf-token', csrfToken)
      .send({ pickupInstructions: 'Leave bag on the porch by 8am.' });
    expect(res.status).toBe(200);
    expect(res.body.affiliate.pickupInstructions).toBe('Leave bag on the porch by 8am.');
    const reloaded = await Affiliate.findOne({ affiliateId: aff.affiliateId });
    expect(reloaded.pickupInstructions).toBe('Leave bag on the porch by 8am.');
  });

  it('rejects blanking pickupInstructions (cannot be emptied)', async () => {
    const aff = await makeAffiliate({ pickupInstructions: 'keep me' });
    const res = await agent
      .patch(`/api/v1/administrators/affiliates/${aff.affiliateId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-csrf-token', csrfToken)
      .send({ pickupInstructions: '   ' });
    expect(res.status).toBe(400);
    const reloaded = await Affiliate.findOne({ affiliateId: aff.affiliateId });
    expect(reloaded.pickupInstructions).toBe('keep me');
  });

  it('rejects an invalid serviceType with 400', async () => {
    const aff = await makeAffiliate();
    const res = await agent
      .patch(`/api/v1/administrators/affiliates/${aff.affiliateId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-csrf-token', csrfToken)
      .send({ serviceType: 'nope' });
    expect(res.status).toBe(400);
  });

  it('404 for an unknown affiliate', async () => {
    const res = await agent
      .patch('/api/v1/administrators/affiliates/AFF-does-not-exist')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-csrf-token', csrfToken)
      .send({ orderNotificationsEnabled: true });
    expect(res.status).toBe(404);
  });

  it('forbids an admin lacking manage_affiliates (403)', async () => {
    const aff = await makeAffiliate();
    const res = await agent
      .patch(`/api/v1/administrators/affiliates/${aff.affiliateId}`)
      .set('Authorization', `Bearer ${limitedToken}`)
      .set('x-csrf-token', csrfToken)
      .send({ orderNotificationsEnabled: true });
    expect(res.status).toBe(403);
  });

  it('POST create with serviceType full_service defaults notifications ON', async () => {
    const uniq = `${Date.now()}c`;
    const res = await agent
      .post('/api/v1/administrators/affiliates')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-csrf-token', csrfToken)
      .send({
        firstName: 'Full', lastName: 'Service', email: `fs${uniq}@example.com`,
        phone: '5125550002', address: '2 B St', city: 'Austin', state: 'TX', zipCode: '78702',
        username: `fs${uniq}`, affiliateType: 'standard', serviceType: 'full_service',
        pickupInstructions: 'Leave your bag by the door.'
      });
    expect(res.status).toBe(201);
    const created = await Affiliate.findOne({ affiliateId: res.body.affiliateId });
    expect(created.serviceType).toBe('full_service');
    expect(created.orderNotificationsEnabled).toBe(true);
  });

  it('POST create without serviceType defaults to pickup_location + notifications OFF', async () => {
    const uniq = `${Date.now()}d`;
    const res = await agent
      .post('/api/v1/administrators/affiliates')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-csrf-token', csrfToken)
      .send({
        firstName: 'Pick', lastName: 'Up', email: `pu${uniq}@example.com`,
        phone: '5125550003', address: '3 C St', city: 'Austin', state: 'TX', zipCode: '78703',
        username: `pu${uniq}`, pickupInstructions: 'Drop at the counter, 9–5.'
      });
    expect(res.status).toBe(201);
    const created = await Affiliate.findOne({ affiliateId: res.body.affiliateId });
    expect(created.serviceType).toBe('pickup_location');
    expect(created.orderNotificationsEnabled).toBe(false);
  });

  it('POST create with affiliateType=location + serviceType=full_service: fees default to 0, both independent', async () => {
    const uniq = `${Date.now()}e`;
    const res = await agent
      .post('/api/v1/administrators/affiliates')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-csrf-token', csrfToken)
      .send({
        firstName: 'Loc', lastName: 'Full', email: `lf${uniq}@example.com`,
        phone: '5125550004', address: '4 D St', city: 'Austin', state: 'TX', zipCode: '78704',
        username: `lf${uniq}`, affiliateType: 'location', serviceType: 'full_service',
        pickupInstructions: 'Bags collected daily at 10am.'
      });
    expect(res.status).toBe(201);
    const created = await Affiliate.findOne({ affiliateId: res.body.affiliateId });
    expect(created.affiliateType).toBe('location');
    expect(created.serviceType).toBe('full_service');
    expect(created.orderNotificationsEnabled).toBe(true);
    expect(created.minimumDeliveryFee).toBe(0);
    expect(created.perBagDeliveryFee).toBe(0);
  });

  it('forbids POST create for an admin lacking manage_affiliates (403)', async () => {
    const uniq = `${Date.now()}f`;
    const res = await agent
      .post('/api/v1/administrators/affiliates')
      .set('Authorization', `Bearer ${limitedToken}`)
      .set('x-csrf-token', csrfToken)
      .send({
        firstName: 'No', lastName: 'Perm', email: `np${uniq}@example.com`,
        phone: '5125550005', address: '5 E St', city: 'Austin', state: 'TX', zipCode: '78705',
        username: `np${uniq}`
      });
    expect(res.status).toBe(403);
  });

  it('ignores deprecated V1 fee fields (minimumDeliveryFee/perBagDeliveryFee) — no longer editable here', async () => {
    const aff = await makeAffiliate(); // defaults: minimumDeliveryFee 25, perBagDeliveryFee 5
    const res = await agent
      .patch(`/api/v1/administrators/affiliates/${aff.affiliateId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-csrf-token', csrfToken)
      .send({ minimumDeliveryFee: 50, perBagDeliveryFee: 25 });
    expect(res.status).toBe(200); // accepted but the V1 fields are dropped from the whitelist
    const reloaded = await Affiliate.findOne({ affiliateId: aff.affiliateId });
    expect(reloaded.minimumDeliveryFee).toBe(25); // unchanged
    expect(reloaded.perBagDeliveryFee).toBe(5); // unchanged
  });

  it('updates the flat deliveryFee and persists', async () => {
    const aff = await makeAffiliate();
    const res = await agent
      .patch(`/api/v1/administrators/affiliates/${aff.affiliateId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-csrf-token', csrfToken)
      .send({ deliveryFee: 8.5 });
    expect(res.status).toBe(200);
    expect(res.body.affiliate.deliveryFee).toBe(8.5);
    expect((await Affiliate.findOne({ affiliateId: aff.affiliateId })).deliveryFee).toBe(8.5);
  });

  it('PATCH can toggle isActive', async () => {
    const aff = await makeAffiliate();
    const res = await agent
      .patch(`/api/v1/administrators/affiliates/${aff.affiliateId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-csrf-token', csrfToken)
      .send({ isActive: false });
    expect(res.status).toBe(200);
    expect((await Affiliate.findOne({ affiliateId: aff.affiliateId })).isActive).toBe(false);
  });

  it('changing serviceType (no explicit notifications) re-applies the type default', async () => {
    const aff = await makeAffiliate({ serviceType: 'pickup_location' }); // notifications off
    // pickup -> full_service, no notifications field → notifications becomes ON
    const up = await agent
      .patch(`/api/v1/administrators/affiliates/${aff.affiliateId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-csrf-token', csrfToken)
      .send({ serviceType: 'full_service' });
    expect(up.status).toBe(200);
    expect(up.body.affiliate.orderNotificationsEnabled).toBe(true);

    // full_service -> pickup, no notifications field → notifications becomes OFF
    const down = await agent
      .patch(`/api/v1/administrators/affiliates/${aff.affiliateId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-csrf-token', csrfToken)
      .send({ serviceType: 'pickup_location' });
    expect(down.body.affiliate.orderNotificationsEnabled).toBe(false);
  });

  it('explicit notifications wins even when serviceType is also changed', async () => {
    const aff = await makeAffiliate({ serviceType: 'pickup_location' });
    const res = await agent
      .patch(`/api/v1/administrators/affiliates/${aff.affiliateId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-csrf-token', csrfToken)
      .send({ serviceType: 'full_service', orderNotificationsEnabled: false });
    expect(res.status).toBe(200);
    expect(res.body.affiliate.serviceType).toBe('full_service');
    expect(res.body.affiliate.orderNotificationsEnabled).toBe(false);
  });

  it('GET /affiliates exposes serviceType + orderNotificationsEnabled', async () => {
    const aff = await makeAffiliate({ serviceType: 'full_service' });
    const res = await agent
      .get('/api/v1/administrators/affiliates')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    const row = res.body.affiliates.find(a => a.affiliateId === aff.affiliateId);
    expect(row).toBeTruthy();
    expect(row.serviceType).toBe('full_service');
    expect(row.orderNotificationsEnabled).toBe(true);
  });

  // ── GET a single affiliate (raw editable record for the admin edit form) ───
  it('GET /affiliates/:affiliateId returns the raw editable record', async () => {
    const aff = await makeAffiliate({
      businessName: 'Bubbles Co', serviceType: 'full_service',
      pickupInstructions: 'Leave on porch', deliveryInstructions: 'Ring twice', deliveryFee: 7.25
    });
    const res = await agent
      .get(`/api/v1/administrators/affiliates/${aff.affiliateId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const a = res.body.affiliate;
    expect(a.affiliateId).toBe(aff.affiliateId);
    expect(a.username).toBe(aff.username); // shown read-only in the form
    expect(a.firstName).toBe('Aff');
    expect(a.businessName).toBe('Bubbles Co');
    expect(a.serviceType).toBe('full_service');
    expect(a.pickupInstructions).toBe('Leave on porch');
    expect(a.deliveryInstructions).toBe('Ring twice');
    expect(a.deliveryFee).toBe(7.25); // raw number, not a formatted currency string
    expect(a.orderNotificationsEnabled).toBe(true);
  });

  it('GET /affiliates/:affiliateId is 404 for an unknown affiliate', async () => {
    const res = await agent
      .get('/api/v1/administrators/affiliates/AFF-nope')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });

  it('GET /affiliates/:affiliateId forbids an admin lacking manage_affiliates (403)', async () => {
    const aff = await makeAffiliate();
    const res = await agent
      .get(`/api/v1/administrators/affiliates/${aff.affiliateId}`)
      .set('Authorization', `Bearer ${limitedToken}`);
    expect(res.status).toBe(403);
  });

  // ── Full affiliate edit (all fields except username) ──────────────────────
  it('edits the full affiliate record (contact, address, fee, both instruction sets)', async () => {
    const aff = await makeAffiliate({ pickupInstructions: 'old pickup' });
    const res = await agent
      .patch(`/api/v1/administrators/affiliates/${aff.affiliateId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-csrf-token', csrfToken)
      .send({
        firstName: 'Edited', lastName: 'Partner', phone: '5125559999',
        businessName: 'Edited Wash Co', address: '99 New St', city: 'Pflugerville',
        state: 'TX', zipCode: '78660', languagePreference: 'es', affiliateType: 'location',
        deliveryFee: 12.5, pickupInstructions: 'Leave at the front desk.',
        deliveryInstructions: 'Ring the bell; hand to staff.', isActive: true
      });
    expect(res.status).toBe(200);
    const r = await Affiliate.findOne({ affiliateId: aff.affiliateId });
    expect(r.firstName).toBe('Edited');
    expect(r.lastName).toBe('Partner');
    expect(r.phone).toBe('5125559999');
    expect(r.businessName).toBe('Edited Wash Co');
    expect(r.address).toBe('99 New St');
    expect(r.city).toBe('Pflugerville');
    expect(r.zipCode).toBe('78660');
    expect(r.languagePreference).toBe('es');
    expect(r.affiliateType).toBe('location');
    expect(r.deliveryFee).toBe(12.5);
    expect(r.pickupInstructions).toBe('Leave at the front desk.');
    expect(r.deliveryInstructions).toBe('Ring the bell; hand to staff.');
  });

  it('changes the email when the new address is free', async () => {
    const aff = await makeAffiliate();
    const fresh = `moved${Date.now()}@example.com`;
    const res = await agent
      .patch(`/api/v1/administrators/affiliates/${aff.affiliateId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-csrf-token', csrfToken)
      .send({ email: fresh });
    expect(res.status).toBe(200);
    expect((await Affiliate.findOne({ affiliateId: aff.affiliateId })).email).toBe(fresh);
  });

  it('rejects an email change that collides with another affiliate (409)', async () => {
    const a = await makeAffiliate();
    const b = await makeAffiliate();
    const res = await agent
      .patch(`/api/v1/administrators/affiliates/${b.affiliateId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-csrf-token', csrfToken)
      .send({ email: a.email });
    expect(res.status).toBe(409);
    expect((await Affiliate.findOne({ affiliateId: b.affiliateId })).email).toBe(b.email); // unchanged
  });

  it('rejects an out-of-range deliveryFee (400)', async () => {
    const aff = await makeAffiliate();
    const res = await agent
      .patch(`/api/v1/administrators/affiliates/${aff.affiliateId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-csrf-token', csrfToken)
      .send({ deliveryFee: 99999 });
    expect(res.status).toBe(400);
  });
});
