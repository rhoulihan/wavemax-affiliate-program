// Bag model — durable bag entity (spec §4.1)
const crypto = require('crypto');
const Bag = require('../../../server/modules/bags/Bag');

describe('Bag model', () => {
  beforeEach(async () => {
    await Bag.deleteMany({});
  });

  function bagDoc(overrides = {}) {
    const token = crypto.randomBytes(16).toString('hex');
    return {
      token,
      tokenHash: Bag.hashToken(token),
      affiliateId: 'AFF-test-affiliate',
      ...overrides
    };
  }

  it('generates a BAG- prefixed bagId and sane defaults', async () => {
    const bag = await Bag.create(bagDoc());
    expect(bag.bagId).toMatch(/^BAG-[0-9a-f-]{36}$/);
    expect(bag.status).toBe('minted');
    expect(bag.customerId).toBeNull();
    expect(bag.orderCount).toBe(0);
    expect(bag.mintedAt).toBeInstanceOf(Date);
  });

  it('hashToken is a deterministic HMAC-SHA256 keyed by ENCRYPTION_KEY', () => {
    const raw = 'a'.repeat(32);
    const expected = crypto
      .createHmac('sha256', Buffer.from(process.env.ENCRYPTION_KEY, 'hex'))
      .update(raw)
      .digest('hex');
    expect(Bag.hashToken(raw)).toBe(expected);
    expect(Bag.hashToken(raw)).toBe(Bag.hashToken(raw));
    expect(Bag.hashToken(raw)).not.toBe(raw);
    expect(Bag.hashToken(raw)).toHaveLength(64);
  });

  it('enforces tokenHash uniqueness (E11000)', async () => {
    await Bag.createIndexes(); // ensure unique index is built before asserting (setup.js afterEach drops indexes; init() caches)
    const doc = bagDoc();
    await Bag.create(doc);
    await expect(
      Bag.create({ ...doc, token: doc.token }) // same tokenHash
    ).rejects.toMatchObject({ code: 11000 });
  });

  it('rejects an unknown status', async () => {
    const bag = new Bag(bagDoc({ status: 'weird' }));
    await expect(bag.validate()).rejects.toThrow(/weird/);
  });

  describe('claim static', () => {
    it('does NOT claim a minted bag (issued-only)', async () => {
      const doc = bagDoc();
      await Bag.create(doc); // status: minted
      const result = await Bag.claim(doc.token, 'CUST-1');
      expect(result).toBeNull();
    });

    it('claims an issued bag: issued -> active, links customer, stamps claimedAt', async () => {
      const doc = bagDoc({ status: 'issued' });
      await Bag.create(doc);
      const claimed = await Bag.claim(doc.token, 'CUST-1');
      expect(claimed).not.toBeNull();
      expect(claimed.status).toBe('active');
      expect(claimed.customerId).toBe('CUST-1');
      expect(claimed.claimedAt).toBeInstanceOf(Date);
    });

    it('a second claim loses (returns null)', async () => {
      const doc = bagDoc({ status: 'issued' });
      await Bag.create(doc);
      await Bag.claim(doc.token, 'CUST-1');
      const second = await Bag.claim(doc.token, 'CUST-2');
      expect(second).toBeNull();
    });

    it('concurrent claims: exactly one winner', async () => {
      const doc = bagDoc({ status: 'issued' });
      await Bag.create(doc);
      const [a, b] = await Promise.all([
        Bag.claim(doc.token, 'CUST-A'),
        Bag.claim(doc.token, 'CUST-B')
      ]);
      const winners = [a, b].filter(Boolean);
      expect(winners).toHaveLength(1);
      const fresh = await Bag.findOne({ tokenHash: Bag.hashToken(doc.token) });
      expect(['CUST-A', 'CUST-B']).toContain(fresh.customerId);
    });
  });
});
