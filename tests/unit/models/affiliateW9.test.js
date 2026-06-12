// Affiliate W-9 fields (spec §4.3): pending_review status + w9Document
// metadata subdocument. Bytes never live in the DB — only metadata here.
const Affiliate = require('../../../server/models/Affiliate');

// Post-PR-2 field set: no serviceLatitude/serviceLongitude/serviceRadius.
function baseAffiliate(overrides = {}) {
  const n = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
  return new Affiliate({
    firstName: 'Wanda', lastName: 'Nine',
    email: `w9-${n}@test.com`, phone: '512-555-0100',
    address: '123 Main St', city: 'Austin', state: 'TX', zipCode: '78701',
    username: `w9user${n}`, passwordSalt: 'salt', passwordHash: 'hash',
    paymentMethod: 'check',
    ...overrides
  });
}

describe('Affiliate W-9 fields', () => {
  it('accepts the pending_review status', async () => {
    const aff = baseAffiliate({ w9Status: 'pending_review' });
    await aff.save();
    const found = await Affiliate.findOne({ affiliateId: aff.affiliateId });
    expect(found.w9Status).toBe('pending_review');
  });

  it('persists the w9Document metadata subdocument and review-trail fields', async () => {
    const submittedAt = new Date();
    const aff = baseAffiliate({
      w9Status: 'pending_review',
      w9SubmittedAt: submittedAt,
      w9Document: {
        storageKey: 'aff/AFF-x/123e4567-e89b-12d3-a456-426614174000.enc',
        filename: 'w9.pdf', contentType: 'application/pdf',
        sizeBytes: 12345, sha256: 'ab'.repeat(32), submittedAt
      }
    });
    await aff.save();
    const found = await Affiliate.findOne({ affiliateId: aff.affiliateId });
    expect(found.w9Document.storageKey).toBe('aff/AFF-x/123e4567-e89b-12d3-a456-426614174000.enc');
    expect(found.w9Document.contentType).toBe('application/pdf');
    expect(found.w9Document.sizeBytes).toBe(12345);
    expect(found.w9Document.sha256).toBe('ab'.repeat(32));
    expect(found.w9SubmittedAt).toBeInstanceOf(Date);
  });

  it('rejects disallowed w9Document content types (SVG)', async () => {
    const aff = baseAffiliate({
      w9Document: { storageKey: 'aff/x/y.enc', contentType: 'image/svg+xml' }
    });
    await expect(aff.save()).rejects.toThrow(/image\/svg\+xml|validation/i);
  });
});
