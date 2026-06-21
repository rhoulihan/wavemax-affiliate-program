// Add-on catalog API — public active-only read + admin CRUD (soft-delete).
// Public:  GET  /api/v1/addons
// Admin:   GET  /api/v1/administrators/addons
//          POST /api/v1/administrators/addons
//          PATCH/DELETE /api/v1/administrators/addons/:addOnId
jest.setTimeout(90000);

// Spy on the audit logger while keeping the real AuditEvents constants — the
// controller destructures logAuditEvent at load, so the mock must be in place
// before the app (and the controller) is required (jest.mock is hoisted).
jest.mock('../../server/utils/auditLogger', () => {
  const actual = jest.requireActual('../../server/utils/auditLogger');
  return { ...actual, logAuditEvent: jest.fn() };
});

const app = require('../../server');
const Administrator = require('../../server/models/Administrator');
const AddOn = require('../../server/models/AddOn');
const auditLogger = require('../../server/utils/auditLogger');
const { createTestToken } = require('../helpers/authHelper');
const { getCsrfToken, createAgent } = require('../helpers/csrfHelper');

describe('Add-on catalog API', () => {
  let agent, csrfToken, adminToken, limitedToken;

  beforeEach(async () => {
    auditLogger.logAuditEvent.mockClear();
    await Administrator.deleteMany({});
    await AddOn.deleteMany({});

    const admin = await Administrator.create({
      firstName: 'Test', lastName: 'Admin', email: 'admin@test.com',
      username: 'testadmin', passwordSalt: 'salt', passwordHash: 'hash',
      permissions: ['system_config']
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

  describe('public GET /api/v1/addons', () => {
    it('returns only active add-ons (key + name + translations), sorted, no auth', async () => {
      await AddOn.create([
        { key: 'b_one', name: 'B One', sortOrder: 2, isActive: true, translations: { es: 'B Uno' } },
        { key: 'a_two', name: 'A Two', sortOrder: 1, isActive: true },
        { key: 'c_off', name: 'C Off', sortOrder: 3, isActive: false }
      ]);
      const res = await agent.get('/api/v1/addons');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const keys = res.body.addOns.map(a => a.key);
      expect(keys).toEqual(['a_two', 'b_one']); // active only, sorted
      const b = res.body.addOns.find(a => a.key === 'b_one');
      expect(b.name).toBe('B One');
      expect(b.translations.es).toBe('B Uno');
    });

    it('exposes each add-on price (free = 0)', async () => {
      await AddOn.create([
        { key: 'paid', name: 'Paid', sortOrder: 1, isActive: true, price: 5.5 },
        { key: 'free', name: 'Free', sortOrder: 2, isActive: true }
      ]);
      const res = await agent.get('/api/v1/addons');
      expect(res.status).toBe(200);
      expect(res.body.addOns.find(a => a.key === 'paid').price).toBe(5.5);
      expect(res.body.addOns.find(a => a.key === 'free').price).toBe(0);
    });

    it('exposes each add-on priceUnit (defaults flat; per_lb passes through)', async () => {
      await AddOn.create([
        { key: 'perlb', name: 'Per Lb', sortOrder: 1, isActive: true, price: 0.5, priceUnit: 'per_lb' },
        { key: 'flatone', name: 'Flat One', sortOrder: 2, isActive: true, price: 5 }
      ]);
      const res = await agent.get('/api/v1/addons');
      expect(res.body.addOns.find(a => a.key === 'perlb').priceUnit).toBe('per_lb');
      expect(res.body.addOns.find(a => a.key === 'flatone').priceUnit).toBe('flat');
    });
  });

  describe('admin GET /api/v1/administrators/addons', () => {
    it('returns ALL add-ons including inactive', async () => {
      await AddOn.create([
        { key: 'live', name: 'Live', isActive: true },
        { key: 'dead', name: 'Dead', isActive: false }
      ]);
      const res = await agent
        .get('/api/v1/administrators/addons')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.addOns.map(a => a.key).sort()).toEqual(['dead', 'live']);
    });

    it('forbids an admin lacking system_config (403)', async () => {
      const res = await agent
        .get('/api/v1/administrators/addons')
        .set('Authorization', `Bearer ${limitedToken}`);
      expect(res.status).toBe(403);
    });
  });

  describe('admin POST /api/v1/administrators/addons', () => {
    it('creates an add-on, slugifying the key from name when omitted', async () => {
      const res = await agent
        .post('/api/v1/administrators/addons')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-csrf-token', csrfToken)
        .send({ name: 'Hypoallergenic Wash', translations: { es: 'Lavado hipoalergénico' } });
      expect(res.status).toBe(201);
      expect(res.body.addOn.key).toBe('hypoallergenic_wash');
      expect(res.body.addOn.translations.es).toBe('Lavado hipoalergénico');
      const stored = await AddOn.findOne({ key: 'hypoallergenic_wash' });
      expect(stored).toBeTruthy();
      // audit trail written for the admin mutation
      expect(auditLogger.logAuditEvent).toHaveBeenCalledWith(
        auditLogger.AuditEvents.ADDON_CREATED,
        expect.objectContaining({ key: 'hypoallergenic_wash' }),
        expect.anything()
      );
    });

    it('honors an explicit key (lowercased)', async () => {
      const res = await agent
        .post('/api/v1/administrators/addons')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-csrf-token', csrfToken)
        .send({ key: 'Extra_Starch', name: 'Extra Starch' });
      expect(res.status).toBe(201);
      expect(res.body.addOn.key).toBe('extra_starch');
    });

    it('stores a price on create and returns it (defaults 0 when omitted)', async () => {
      const paid = await agent
        .post('/api/v1/administrators/addons')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-csrf-token', csrfToken)
        .send({ name: 'Premium Soap', price: 4.25 });
      expect(paid.status).toBe(201);
      expect(paid.body.addOn.price).toBe(4.25);
      expect((await AddOn.findOne({ key: 'premium_soap' })).price).toBe(4.25);

      const free = await agent
        .post('/api/v1/administrators/addons')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-csrf-token', csrfToken)
        .send({ name: 'Free Extra' });
      expect(free.status).toBe(201);
      expect(free.body.addOn.price).toBe(0);
    });

    it('rejects an out-of-range price (400)', async () => {
      const res = await agent
        .post('/api/v1/administrators/addons')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-csrf-token', csrfToken)
        .send({ name: 'Too Pricey', price: 99999 });
      expect(res.status).toBe(400);
    });

    it('stores priceUnit per_lb on create (defaults flat when omitted)', async () => {
      const perlb = await agent
        .post('/api/v1/administrators/addons')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-csrf-token', csrfToken)
        .send({ name: 'Per Pound Wash', price: 0.5, priceUnit: 'per_lb' });
      expect(perlb.status).toBe(201);
      expect(perlb.body.addOn.priceUnit).toBe('per_lb');
      expect((await AddOn.findOne({ key: 'per_pound_wash' })).priceUnit).toBe('per_lb');

      const flat = await agent
        .post('/api/v1/administrators/addons')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-csrf-token', csrfToken)
        .send({ name: 'Flat Wash', price: 5 });
      expect(flat.body.addOn.priceUnit).toBe('flat');
    });

    it('rejects an invalid priceUnit (400)', async () => {
      const res = await agent
        .post('/api/v1/administrators/addons')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-csrf-token', csrfToken)
        .send({ name: 'Bad Unit', price: 1, priceUnit: 'per_kg' });
      expect(res.status).toBe(400);
    });

    it('rejects a missing name (400)', async () => {
      const res = await agent
        .post('/api/v1/administrators/addons')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-csrf-token', csrfToken)
        .send({ translations: { es: 'x' } });
      expect(res.status).toBe(400);
    });

    it('rejects a duplicate key (409)', async () => {
      await AddOn.create({ key: 'dup', name: 'Dup' });
      const res = await agent
        .post('/api/v1/administrators/addons')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-csrf-token', csrfToken)
        .send({ key: 'dup', name: 'Another' });
      expect(res.status).toBe(409);
    });

    it('forbids create for an admin lacking system_config (403)', async () => {
      const res = await agent
        .post('/api/v1/administrators/addons')
        .set('Authorization', `Bearer ${limitedToken}`)
        .set('x-csrf-token', csrfToken)
        .send({ name: 'Nope' });
      expect(res.status).toBe(403);
    });
  });

  describe('admin PATCH /api/v1/administrators/addons/:addOnId', () => {
    it('updates name, translations, sortOrder, isActive — but NOT the key', async () => {
      const a = await AddOn.create({ key: 'orig', name: 'Orig', sortOrder: 1 });
      const res = await agent
        .patch(`/api/v1/administrators/addons/${a.addOnId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-csrf-token', csrfToken)
        .send({ name: 'New Name', translations: { de: 'Neuer Name' }, sortOrder: 5, isActive: false, key: 'hacked' });
      expect(res.status).toBe(200);
      expect(res.body.addOn.name).toBe('New Name');
      expect(res.body.addOn.translations.de).toBe('Neuer Name');
      expect(res.body.addOn.sortOrder).toBe(5);
      expect(res.body.addOn.isActive).toBe(false);
      const reloaded = await AddOn.findOne({ addOnId: a.addOnId });
      expect(reloaded.key).toBe('orig'); // key immutable
    });

    it('preserves untouched-language translations on a single-language PATCH', async () => {
      const a = await AddOn.create({
        key: 'softener', name: 'Fabric Softener',
        translations: { es: 'Suavizante', pt: 'Amaciante', de: 'Weichspüler' }
      });
      const res = await agent
        .patch(`/api/v1/administrators/addons/${a.addOnId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-csrf-token', csrfToken)
        .send({ translations: { de: 'Neu' } }); // only German
      expect(res.status).toBe(200);
      const reloaded = await AddOn.findOne({ addOnId: a.addOnId });
      expect(reloaded.translations.de).toBe('Neu');       // updated
      expect(reloaded.translations.es).toBe('Suavizante'); // preserved
      expect(reloaded.translations.pt).toBe('Amaciante');  // preserved
      expect(auditLogger.logAuditEvent).toHaveBeenCalledWith(
        auditLogger.AuditEvents.ADDON_UPDATED,
        expect.objectContaining({ addOnId: a.addOnId }),
        expect.anything()
      );
    });

    it('updates the price', async () => {
      const a = await AddOn.create({ key: 'priceable', name: 'Priceable', price: 1 });
      const res = await agent
        .patch(`/api/v1/administrators/addons/${a.addOnId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-csrf-token', csrfToken)
        .send({ price: 7.5 });
      expect(res.status).toBe(200);
      expect(res.body.addOn.price).toBe(7.5);
      expect((await AddOn.findOne({ addOnId: a.addOnId })).price).toBe(7.5);
    });

    it('updates the priceUnit (flat -> per_lb)', async () => {
      const a = await AddOn.create({ key: 'unitable', name: 'Unitable', price: 0.5 });
      const res = await agent
        .patch(`/api/v1/administrators/addons/${a.addOnId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-csrf-token', csrfToken)
        .send({ priceUnit: 'per_lb' });
      expect(res.status).toBe(200);
      expect(res.body.addOn.priceUnit).toBe('per_lb');
      expect((await AddOn.findOne({ addOnId: a.addOnId })).priceUnit).toBe('per_lb');
    });

    it('rejects an out-of-range price on update (400)', async () => {
      const a = await AddOn.create({ key: 'pr2', name: 'Pr2', price: 1 });
      const res = await agent
        .patch(`/api/v1/administrators/addons/${a.addOnId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-csrf-token', csrfToken)
        .send({ price: -5 });
      expect(res.status).toBe(400);
    });

    it('404 for an unknown add-on', async () => {
      const res = await agent
        .patch('/api/v1/administrators/addons/ADDON-nope')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-csrf-token', csrfToken)
        .send({ name: 'x' });
      expect(res.status).toBe(404);
    });
  });

  describe('admin DELETE /api/v1/administrators/addons/:addOnId (soft-delete)', () => {
    it('deactivates rather than removing (history still resolves)', async () => {
      const a = await AddOn.create({ key: 'retire_me', name: 'Retire Me', isActive: true });
      const res = await agent
        .delete(`/api/v1/administrators/addons/${a.addOnId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-csrf-token', csrfToken);
      expect(res.status).toBe(200);
      const reloaded = await AddOn.findOne({ addOnId: a.addOnId });
      expect(reloaded).toBeTruthy();          // still in the DB
      expect(reloaded.isActive).toBe(false);  // just deactivated
      // and it disappears from the public list
      const pub = await agent.get('/api/v1/addons');
      expect(pub.body.addOns.find(x => x.key === 'retire_me')).toBeUndefined();
      expect(auditLogger.logAuditEvent).toHaveBeenCalledWith(
        auditLogger.AuditEvents.ADDON_DEACTIVATED,
        expect.objectContaining({ addOnId: a.addOnId }),
        expect.anything()
      );
    });

    it('forbids delete for an admin lacking system_config (403)', async () => {
      const a = await AddOn.create({ key: 'keep', name: 'Keep' });
      const res = await agent
        .delete(`/api/v1/administrators/addons/${a.addOnId}`)
        .set('Authorization', `Bearer ${limitedToken}`)
        .set('x-csrf-token', csrfToken);
      expect(res.status).toBe(403);
    });
  });
});
