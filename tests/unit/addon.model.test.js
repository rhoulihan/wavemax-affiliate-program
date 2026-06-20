// AddOn catalog model — admin-managed order add-ons (premium detergent, stain
// remover, fabric softener, …). Per-language labels (en + es/pt/de); a stable
// `key` slug is what an Order stores. Money lives in Cents — add-ons are
// label-only here (no price field).
const AddOn = require('../../server/models/AddOn');

function build(overrides = {}) {
  return new AddOn({ key: 'extra_rinse', name: 'Extra Rinse', ...overrides });
}

describe('AddOn model', () => {
  // tests/setup.js seeds the catalog defaults in a global beforeEach; clear them
  // so each model test starts from a known-empty collection.
  beforeEach(async () => { await AddOn.deleteMany({}); });
  afterEach(async () => { await AddOn.deleteMany({}); });

  describe('schema shape', () => {
    it('mints an ADDON- id and defaults isActive true / sortOrder 0', async () => {
      const a = await build().save();
      expect(a.addOnId).toMatch(/^ADDON-/);
      expect(a.isActive).toBe(true);
      expect(a.sortOrder).toBe(0);
    });

    it('requires key and name', async () => {
      await expect(new AddOn({ name: 'No Key' }).save()).rejects.toThrow(/key.*required/i);
      await expect(new AddOn({ key: 'no_name' }).save()).rejects.toThrow(/name.*required/i);
    });

    it('lowercases the key and rejects a non-slug key', async () => {
      const a = await build({ key: 'Premium_Detergent' }).save();
      expect(a.key).toBe('premium_detergent');
      await expect(build({ key: 'has spaces' }).save()).rejects.toThrow();
      await expect(build({ key: 'no-dashes' }).save()).rejects.toThrow();
    });

    it('enforces a unique key', async () => {
      await build({ key: 'dup' }).save();
      await AddOn.syncIndexes();
      await expect(build({ key: 'dup', name: 'Other' }).save()).rejects.toThrow();
    });

    it('carries es/pt/de translations (default empty string)', async () => {
      const a = await build().save();
      expect(a.translations.es).toBe('');
      expect(a.translations.pt).toBe('');
      expect(a.translations.de).toBe('');
      const b = await build({ key: 'softener', name: 'Softener', translations: { es: 'Suavizante' } }).save();
      expect(b.translations.es).toBe('Suavizante');
    });

    it('holds NO price/money field (money lives in Cents)', () => {
      for (const gone of ['price', 'amount', 'cost', 'fee']) {
        expect(AddOn.schema.path(gone)).toBeUndefined();
      }
    });
  });

  describe('initializeDefaults', () => {
    it('seeds the three current add-ons with all four languages, active', async () => {
      await AddOn.deleteMany({});
      await AddOn.initializeDefaults();
      const all = await AddOn.find().sort('sortOrder');
      const keys = all.map(a => a.key);
      expect(keys).toEqual(['premium_detergent', 'fabric_softener', 'stain_remover']);
      for (const a of all) {
        expect(a.isActive).toBe(true);
        expect(a.name).toBeTruthy();
        expect(a.translations.es).toBeTruthy();
        expect(a.translations.pt).toBeTruthy();
        expect(a.translations.de).toBeTruthy();
      }
    });

    it('is idempotent and does not clobber admin edits', async () => {
      await AddOn.deleteMany({});
      await AddOn.initializeDefaults();
      await AddOn.updateOne({ key: 'premium_detergent' }, { $set: { isActive: false, name: 'Renamed' } });
      await AddOn.initializeDefaults(); // second run
      const count = await AddOn.countDocuments();
      expect(count).toBe(3);
      const pd = await AddOn.findOne({ key: 'premium_detergent' });
      expect(pd.isActive).toBe(false); // admin edit preserved
      expect(pd.name).toBe('Renamed');
    });
  });

  describe('getActive', () => {
    it('returns only active add-ons sorted by sortOrder then name', async () => {
      await AddOn.create([
        { key: 'b_one', name: 'B One', sortOrder: 2, isActive: true },
        { key: 'a_two', name: 'A Two', sortOrder: 1, isActive: true },
        { key: 'c_off', name: 'C Off', sortOrder: 3, isActive: false }
      ]);
      const active = await AddOn.getActive();
      expect(active.map(a => a.key)).toEqual(['a_two', 'b_one']);
    });
  });
});
