const mongoose = require('mongoose');
const AffiliateInvite = require('../../server/modules/onboarding/AffiliateInvite');
const encryptionUtil = require('../../server/utils/encryption');

describe('AffiliateInvite model', () => {
  beforeEach(async () => {
    await AffiliateInvite.deleteMany({});
  });

  const makeInvite = (overrides = {}) => {
    const raw = encryptionUtil.generateToken(32); // 64 hex chars
    return {
      raw,
      doc: {
        tokenHash: AffiliateInvite.hashToken(raw),
        email: 'Invitee@Example.com',
        prefill: { firstName: 'Ina', lastName: 'Vite', businessName: 'Vite LLC', phone: '555-0100' },
        expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
        createdBy: new mongoose.Types.ObjectId(),
        ...overrides
      }
    };
  };

  test('hashToken is deterministic sha256 hex and never equals the raw token', () => {
    const raw = encryptionUtil.generateToken(32);
    const h1 = AffiliateInvite.hashToken(raw);
    const h2 = AffiliateInvite.hashToken(raw);
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
    expect(h1).not.toBe(raw);
    expect(AffiliateInvite.hashToken('other')).not.toBe(h1);
  });

  test('generates an INV- prefixed inviteId, lowercases email, defaults status pending', async () => {
    const { doc } = makeInvite();
    const invite = await AffiliateInvite.create(doc);
    expect(invite.inviteId).toMatch(/^INV-[0-9a-f-]{36}$/);
    expect(invite.email).toBe('invitee@example.com');
    expect(invite.status).toBe('pending');
    expect(invite.resendCount).toBe(0);
  });

  test('consume flips a pending, unexpired invite exactly once (single-use)', async () => {
    const { raw, doc } = makeInvite();
    await AffiliateInvite.create(doc);

    const first = await AffiliateInvite.consume(raw, { affiliateId: 'AFF-111' });
    expect(first).not.toBeNull();
    expect(first.status).toBe('accepted');
    expect(first.acceptedAffiliateId).toBe('AFF-111');
    expect(first.acceptedAt).toBeInstanceOf(Date);

    const second = await AffiliateInvite.consume(raw, { affiliateId: 'AFF-222' });
    expect(second).toBeNull();
  });

  test('consume returns null for an expired invite', async () => {
    const { raw, doc } = makeInvite({ expiresAt: new Date(Date.now() - 1000) });
    await AffiliateInvite.create(doc);
    expect(await AffiliateInvite.consume(raw, { affiliateId: 'AFF-111' })).toBeNull();
  });

  test('consume returns null for an unknown token', async () => {
    expect(await AffiliateInvite.consume('deadbeef'.repeat(8), { affiliateId: 'AFF-111' })).toBeNull();
  });

  test('concurrent consume has exactly one winner', async () => {
    const { raw, doc } = makeInvite();
    await AffiliateInvite.create(doc);
    const results = await Promise.all([
      AffiliateInvite.consume(raw, { affiliateId: 'AFF-A' }),
      AffiliateInvite.consume(raw, { affiliateId: 'AFF-B' })
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
    const final = await AffiliateInvite.findOne({ tokenHash: AffiliateInvite.hashToken(raw) });
    expect(final.status).toBe('accepted');
    expect(['AFF-A', 'AFF-B']).toContain(final.acceptedAffiliateId);
  });

  test('rejects an invalid status value', async () => {
    const { doc } = makeInvite({ status: 'bogus' });
    await expect(AffiliateInvite.create(doc)).rejects.toThrow(/bogus/);
  });
});
