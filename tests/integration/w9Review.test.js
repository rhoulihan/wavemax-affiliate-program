// W-9 admin verify/reject + affiliatePaymentLockService integration
// (spec §6.2 W-9 lifecycle + §11). unlockPayments was READ before writing
// this: it throws without notes, and itself sets w9Status='on_file' when
// paymentLockReason === 'w9_required' && w9Received.
const fs = require('fs');
const os = require('os');
const path = require('path');
const jwt = require('jsonwebtoken');
const request = require('supertest');

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'w9-review-'));
process.env.W9_STORAGE_PATH = tmpRoot;

jest.mock('../../server/services/email/dispatcher/onboarding', () => ({
  ...jest.requireActual('../../server/services/email/dispatcher/onboarding'),
  sendAffiliateW9StatusEmail: jest.fn().mockResolvedValue(undefined)
}));

const app = require('../../server');
const Affiliate = require('../../server/models/Affiliate');
const Administrator = require('../../server/models/Administrator');
const secureFileStore = require('../../server/services/secureFileStore');
const onboardingEmails = require('../../server/services/email/dispatcher/onboarding');
const { getCsrfToken } = require('../helpers/csrfHelper');

afterAll(() => fs.rmSync(tmpRoot, { recursive: true, force: true }));

const PDF = Buffer.from('%PDF-1.4 review-loop plaintext payload');

function tokenFor(user, role, extra = {}) {
  return jwt.sign({ id: user._id.toString(), role, ...extra },
    process.env.JWT_SECRET, { expiresIn: '1h' });
}
async function createAffiliate(overrides = {}) {
  const n = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
  return Affiliate.create({
    firstName: 'Aff', lastName: 'One', email: `aff${n}@test.com`, phone: '512-555-0100',
    address: '1 Congress Ave', city: 'Austin', state: 'TX', zipCode: '78701',
    username: `affu${n}`, passwordSalt: 's', passwordHash: 'h', paymentMethod: 'check',
    ...overrides
  });
}
async function createAdmin(permissions = ['manage_affiliates']) {
  const n = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
  return Administrator.create({
    firstName: 'Ad', lastName: 'Min', email: `adm${n}@test.com`,
    passwordSalt: 's', passwordHash: 'h', permissions
  });
}
async function seedPendingW9(affiliate) {
  const { storageKey, sha256 } = await secureFileStore.storeEncrypted(PDF, {
    affiliateId: affiliate.affiliateId, contentType: 'application/pdf', filename: 'w9.pdf'
  });
  affiliate.w9Document = {
    storageKey, filename: 'w9.pdf', contentType: 'application/pdf',
    sizeBytes: PDF.length, sha256, submittedAt: new Date()
  };
  affiliate.w9Status = 'pending_review';
  affiliate.w9SubmittedAt = new Date();
  await affiliate.save();
  return affiliate;
}

describe('W-9 admin review loop', () => {
  let agent, csrfToken, admin, adminAuth;
  beforeEach(async () => {
    onboardingEmails.sendAffiliateW9StatusEmail.mockClear();
    agent = request.agent(app);
    csrfToken = await getCsrfToken(app, agent);
    admin = await createAdmin();
    adminAuth = `Bearer ${tokenFor(admin, 'administrator')}`;
  });

  it('verify: pending_review -> on_file + unlockPayments when locked for w9_required', async () => {
    const aff = await seedPendingW9(await createAffiliate({
      paymentProcessingLocked: true,
      paymentLockedAt: new Date(),
      paymentLockReason: 'w9_required'
    }));

    const res = await agent
      .post(`/api/v1/w9/admin/${aff.affiliateId}/verify`)
      .set('Authorization', adminAuth)
      .set('x-csrf-token', csrfToken)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.w9Status).toBe('on_file');
    expect(res.body.paymentsUnlocked).toBe(true);

    const saved = await Affiliate.findOne({ affiliateId: aff.affiliateId });
    expect(saved.w9Status).toBe('on_file');
    expect(saved.w9OnFileAt).toBeInstanceOf(Date);
    expect(saved.w9VerifiedAt).toBeInstanceOf(Date);
    expect(saved.w9VerifiedBy.toString()).toBe(admin._id.toString());
    expect(saved.paymentProcessingLocked).toBe(false);       // ← the unlock
    expect(saved.paymentUnlockedAt).toBeInstanceOf(Date);
    expect(saved.paymentUnlockedBy.toString()).toBe(admin._id.toString());

    expect(onboardingEmails.sendAffiliateW9StatusEmail)
      .toHaveBeenCalledWith(expect.objectContaining({ affiliateId: aff.affiliateId }), 'verified');
  });

  it('verify: does NOT touch the lock when locked for a non-W9 reason', async () => {
    const aff = await seedPendingW9(await createAffiliate({
      paymentProcessingLocked: true, paymentLockReason: 'compliance_review'
    }));
    const res = await agent
      .post(`/api/v1/w9/admin/${aff.affiliateId}/verify`)
      .set('Authorization', adminAuth).set('x-csrf-token', csrfToken).send({});
    expect(res.status).toBe(200);
    expect(res.body.paymentsUnlocked).toBe(false);
    const saved = await Affiliate.findOne({ affiliateId: aff.affiliateId });
    expect(saved.paymentProcessingLocked).toBe(true);        // untouched
    expect(saved.w9Status).toBe('on_file');
  });

  it('verify on a non-pending W-9 -> 409', async () => {
    const aff = await createAffiliate({ w9Status: 'on_file' });
    const res = await agent
      .post(`/api/v1/w9/admin/${aff.affiliateId}/verify`)
      .set('Authorization', adminAuth).set('x-csrf-token', csrfToken).send({});
    expect(res.status).toBe(409);
  });

  it('verify without a CSRF token -> 403 (critical endpoint)', async () => {
    const aff = await seedPendingW9(await createAffiliate());
    const res = await request(app)
      .post(`/api/v1/w9/admin/${aff.affiliateId}/verify`)
      .set('Authorization', adminAuth).send({});
    expect(res.status).toBe(403);
  });

  it('reject requires a reason -> 400 without one', async () => {
    const aff = await seedPendingW9(await createAffiliate());
    const res = await agent
      .post(`/api/v1/w9/admin/${aff.affiliateId}/reject`)
      .set('Authorization', adminAuth).set('x-csrf-token', csrfToken).send({});
    expect(res.status).toBe(400);
  });

  it('reject -> rejected + reason + email; re-upload returns to pending_review', async () => {
    const aff = await seedPendingW9(await createAffiliate());

    const rej = await agent
      .post(`/api/v1/w9/admin/${aff.affiliateId}/reject`)
      .set('Authorization', adminAuth).set('x-csrf-token', csrfToken)
      .send({ reason: 'Signature missing on line 6' });
    expect(rej.status).toBe(200);

    let saved = await Affiliate.findOne({ affiliateId: aff.affiliateId });
    expect(saved.w9Status).toBe('rejected');
    expect(saved.w9RejectedReason).toBe('Signature missing on line 6');
    expect(saved.w9RejectedAt).toBeInstanceOf(Date);
    expect(onboardingEmails.sendAffiliateW9StatusEmail).toHaveBeenCalledWith(
      expect.objectContaining({ affiliateId: aff.affiliateId }),
      'rejected', { reason: 'Signature missing on line 6' });

    // Re-upload loop: rejected -> pending_review, old file replaced
    const oldKey = saved.w9Document.storageKey;
    const up = await agent
      .post(`/api/v1/affiliates/${aff.affiliateId}/w9`)
      .set('Authorization', `Bearer ${tokenFor(aff, 'affiliate', { affiliateId: aff.affiliateId })}`)
      .set('x-csrf-token', csrfToken)
      .attach('w9', Buffer.concat([PDF, Buffer.from(' corrected')]),
        { filename: 'w9-corrected.pdf', contentType: 'application/pdf' });
    expect(up.status).toBe(201);

    saved = await Affiliate.findOne({ affiliateId: aff.affiliateId });
    expect(saved.w9Status).toBe('pending_review');
    expect(saved.w9Document.storageKey).not.toBe(oldKey);
    expect(fs.existsSync(path.join(tmpRoot, oldKey))).toBe(false); // no orphan
  });

  it('verify/reject 403 for an affiliate token and for an admin without manage_affiliates', async () => {
    const aff = await seedPendingW9(await createAffiliate());
    const weakAdmin = await createAdmin(['view_analytics']);

    for (const [auth, name] of [
      [`Bearer ${tokenFor(aff, 'affiliate', { affiliateId: aff.affiliateId })}`, 'affiliate'],
      [`Bearer ${tokenFor(weakAdmin, 'administrator')}`, 'weak admin']
    ]) {
      const v = await agent.post(`/api/v1/w9/admin/${aff.affiliateId}/verify`)
        .set('Authorization', auth).set('x-csrf-token', csrfToken).send({});
      expect(v.status).toBe(403);
      const r = await agent.post(`/api/v1/w9/admin/${aff.affiliateId}/reject`)
        .set('Authorization', auth).set('x-csrf-token', csrfToken).send({ reason: 'x' });
      expect(r.status).toBe(403);
    }
  });
});
