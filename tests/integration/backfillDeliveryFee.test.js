// Integration test for scripts/migrate/backfill-delivery-fee.js
//
// The migration backfills the flat `deliveryFee` from the legacy V1
// minimumDeliveryFee/perBagDeliveryFee pair (preserving each partner's prior
// effective fee) and removes the orphaned V1 fields. A dry-run must write
// nothing; it must never lower a partner who already has a flat fee.
const Affiliate = require('../../server/models/Affiliate');
const { backfillDeliveryFee, legacyEffectiveFee, decideMode, V1_QUERY } = require('../../scripts/migrate/backfill-delivery-fee');

// Seed via the raw collection so we can write the removed V1 fields (the model
// no longer maps them) and control the exact stored shape.
async function seed() {
  await Affiliate.collection.insertMany([
    // legacy: per-bag wins -> deliveryFee should become 5
    { affiliateId: 'AFF-perbag', deliveryFee: 0, minimumDeliveryFee: 25, perBagDeliveryFee: 5 },
    // legacy: only minimum present, deliveryFee unset -> becomes 25
    { affiliateId: 'AFF-minonly', minimumDeliveryFee: 25 },
    // already migrated: has a flat fee AND orphan V1 -> keep 8, just clean V1
    { affiliateId: 'AFF-hasflat', deliveryFee: 8, minimumDeliveryFee: 25, perBagDeliveryFee: 5 },
    // location: both V1 zero, deliveryFee 0 -> stays 0 (uses house default), V1 cleaned
    { affiliateId: 'AFF-location', deliveryFee: 0, minimumDeliveryFee: 0, perBagDeliveryFee: 0 },
    // fully modern: no V1 fields at all -> not matched, untouched
    { affiliateId: 'AFF-modern', deliveryFee: 12 }
  ]);
}

const get = (id) => Affiliate.collection.findOne({ affiliateId: id });

describe('backfill-delivery-fee migration', () => {
  it('legacyEffectiveFee mirrors the old perBag||min||0 formula', () => {
    expect(legacyEffectiveFee({ perBagDeliveryFee: 5, minimumDeliveryFee: 25 })).toBe(5);
    expect(legacyEffectiveFee({ minimumDeliveryFee: 25 })).toBe(25);
    expect(legacyEffectiveFee({ perBagDeliveryFee: 0, minimumDeliveryFee: 0 })).toBe(0);
    expect(legacyEffectiveFee({})).toBe(0);
  });

  it('dry-run reports backfills but writes nothing', async () => {
    await seed();
    const report = await backfillDeliveryFee({ dryRun: true });

    expect(report.dryRun).toBe(true);
    expect(report.scanned).toBe(4); // the 4 docs carrying a V1 field (modern excluded)
    expect(report.backfilled).toBe(2); // perbag + minonly
    expect(report.cleaned).toBe(4);

    // nothing actually changed
    expect((await get('AFF-perbag')).deliveryFee).toBe(0);
    expect((await get('AFF-perbag')).perBagDeliveryFee).toBe(5);
    expect((await get('AFF-minonly')).deliveryFee).toBeUndefined();
  });

  it('execute backfills the flat fee and removes the V1 fields', async () => {
    await seed();
    const report = await backfillDeliveryFee({ dryRun: false });

    expect(report.dryRun).toBe(false);
    expect(report.backfilled).toBe(2);

    // per-bag wins
    const perbag = await get('AFF-perbag');
    expect(perbag.deliveryFee).toBe(5);
    expect(perbag.minimumDeliveryFee).toBeUndefined();
    expect(perbag.perBagDeliveryFee).toBeUndefined();

    // minimum-only
    const minonly = await get('AFF-minonly');
    expect(minonly.deliveryFee).toBe(25);
    expect(minonly.minimumDeliveryFee).toBeUndefined();

    // already had a flat fee -> preserved, never lowered; V1 cleaned
    const hasflat = await get('AFF-hasflat');
    expect(hasflat.deliveryFee).toBe(8);
    expect(hasflat.minimumDeliveryFee).toBeUndefined();
    expect(hasflat.perBagDeliveryFee).toBeUndefined();

    // location -> stays 0 (house default applies), V1 cleaned
    const location = await get('AFF-location');
    expect(location.deliveryFee).toBe(0);
    expect(location.minimumDeliveryFee).toBeUndefined();

    // modern doc untouched
    const modern = await get('AFF-modern');
    expect(modern.deliveryFee).toBe(12);

    // no V1-bearing docs remain
    expect(await Affiliate.collection.countDocuments(V1_QUERY)).toBe(0);
  });

  it('is idempotent — a second run finds nothing to migrate', async () => {
    await seed();
    await backfillDeliveryFee({ dryRun: false });
    const second = await backfillDeliveryFee({ dryRun: false });
    expect(second.scanned).toBe(0);
    expect(second.backfilled).toBe(0);
  });

  it('defaults to dry-run when called with no arguments (writes nothing)', async () => {
    await seed();
    const report = await backfillDeliveryFee();
    expect(report.dryRun).toBe(true);
    expect((await get('AFF-perbag')).deliveryFee).toBe(0); // untouched
  });

  it('decideMode is dry-run by default and case-sensitive', () => {
    expect(decideMode([]).dryRun).toBe(true);
    expect(decideMode().dryRun).toBe(true);
    expect(decideMode(['--yes']).dryRun).toBe(false);
    expect(decideMode(['--confirm']).dryRun).toBe(false);
    expect(decideMode(['--YES']).dryRun).toBe(true); // wrong case -> safe
  });
});
