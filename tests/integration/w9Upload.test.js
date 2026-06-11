// POST /api/v1/affiliates/:affiliateId/w9 — encrypted W-9 upload (spec §5/§6.2).
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const request = require('supertest');

// Tmp storage root BEFORE the app loads anything.
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'w9-upload-'));
process.env.W9_STORAGE_PATH = tmpRoot;

// Mock the status emails BEFORE the controller is required by the app.
jest.mock('../../server/services/email/dispatcher/onboarding', () => ({
  ...jest.requireActual('../../server/services/email/dispatcher/onboarding'),
  sendAffiliateW9StatusEmail: jest.fn().mockResolvedValue(undefined)
}));

const app = require('../../server');
const Affiliate = require('../../server/models/Affiliate');
const Administrator = require('../../server/models/Administrator');
const onboardingEmails = require('../../server/services/email/dispatcher/onboarding');
const { getCsrfToken } = require('../helpers/csrfHelper');

afterAll(() => fs.rmSync(tmpRoot, { recursive: true, force: true }));

const PDF = Buffer.from('%PDF-1.4 integration-test w9 plaintext payload');

function affiliateToken(aff) {
  return jwt.sign({ id: aff._id.toString(), role: 'affiliate', affiliateId: aff.affiliateId },
    process.env.JWT_SECRET, { expiresIn: '1h' });
}
function adminToken(admin) {
  return jwt.sign({ id: admin._id.toString(), role: 'administrator' },
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

describe('POST /api/v1/affiliates/:affiliateId/w9', () => {
  let agent, csrfToken;
  beforeEach(async () => {
    onboardingEmails.sendAffiliateW9StatusEmail.mockClear();
    agent = request.agent(app);
    csrfToken = await getCsrfToken(app, agent);
  });

  it('lets the affiliate upload their own W-9 -> 201 pending_review, encrypted at rest, received email', async () => {
    const aff = await createAffiliate();
    const res = await agent
      .post(`/api/v1/affiliates/${aff.affiliateId}/w9`)
      .set('Authorization', `Bearer ${affiliateToken(aff)}`)
      .set('x-csrf-token', csrfToken)
      .attach('w9', PDF, { filename: 'my w9 (final).pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.w9Status).toBe('pending_review');

    const saved = await Affiliate.findOne({ affiliateId: aff.affiliateId });
    expect(saved.w9Status).toBe('pending_review');
    expect(saved.w9SubmittedAt).toBeInstanceOf(Date);
    expect(saved.w9Document.storageKey).toMatch(new RegExp(`^aff/${aff.affiliateId}/`));
    expect(saved.w9Document.contentType).toBe('application/pdf');
    expect(saved.w9Document.sha256)
      .toBe(crypto.createHash('sha256').update(PDF).digest('hex'));

    const onDisk = fs.readFileSync(path.join(tmpRoot, saved.w9Document.storageKey));
    expect(onDisk.includes(PDF)).toBe(false); // never plaintext at rest

    expect(onboardingEmails.sendAffiliateW9StatusEmail).toHaveBeenCalledWith(
      expect.objectContaining({ affiliateId: aff.affiliateId }), 'received');
  });

  it("rejects another affiliate's upload with 403", async () => {
    const owner = await createAffiliate();
    const intruder = await createAffiliate();
    const res = await agent
      .post(`/api/v1/affiliates/${owner.affiliateId}/w9`)
      .set('Authorization', `Bearer ${affiliateToken(intruder)}`)
      .set('x-csrf-token', csrfToken)
      .attach('w9', PDF, { filename: 'w9.pdf', contentType: 'application/pdf' });
    expect(res.status).toBe(403);
  });

  it('lets an administrator upload on behalf of an affiliate', async () => {
    const aff = await createAffiliate();
    const admin = await createAdmin();
    const res = await agent
      .post(`/api/v1/affiliates/${aff.affiliateId}/w9`)
      .set('Authorization', `Bearer ${adminToken(admin)}`)
      .set('x-csrf-token', csrfToken)
      .attach('w9', PDF, { filename: 'w9.pdf', contentType: 'application/pdf' });
    expect(res.status).toBe(201);
  });

  it('400s when no file is attached', async () => {
    const aff = await createAffiliate();
    const res = await agent
      .post(`/api/v1/affiliates/${aff.affiliateId}/w9`)
      .set('Authorization', `Bearer ${affiliateToken(aff)}`)
      .set('x-csrf-token', csrfToken)
      .send({});
    expect(res.status).toBe(400);
  });

  it('re-upload deletes the prior encrypted file (no orphans)', async () => {
    const aff = await createAffiliate();
    const token = affiliateToken(aff);

    await agent.post(`/api/v1/affiliates/${aff.affiliateId}/w9`)
      .set('Authorization', `Bearer ${token}`).set('x-csrf-token', csrfToken)
      .attach('w9', PDF, { filename: 'w9-v1.pdf', contentType: 'application/pdf' });
    const first = (await Affiliate.findOne({ affiliateId: aff.affiliateId })).w9Document.storageKey;
    expect(fs.existsSync(path.join(tmpRoot, first))).toBe(true);

    await agent.post(`/api/v1/affiliates/${aff.affiliateId}/w9`)
      .set('Authorization', `Bearer ${token}`).set('x-csrf-token', csrfToken)
      .attach('w9', Buffer.concat([PDF, Buffer.from(' v2')]), { filename: 'w9-v2.pdf', contentType: 'application/pdf' });
    const second = (await Affiliate.findOne({ affiliateId: aff.affiliateId })).w9Document.storageKey;

    expect(second).not.toBe(first);
    expect(fs.existsSync(path.join(tmpRoot, first))).toBe(false);   // old file gone
    expect(fs.existsSync(path.join(tmpRoot, second))).toBe(true);
  });

  it('403s without a CSRF token (critical endpoint)', async () => {
    const aff = await createAffiliate();
    const res = await request(app)   // plain request: no csrf cookie/header
      .post(`/api/v1/affiliates/${aff.affiliateId}/w9`)
      .set('Authorization', `Bearer ${affiliateToken(aff)}`)
      .attach('w9', PDF, { filename: 'w9.pdf', contentType: 'application/pdf' });
    expect(res.status).toBe(403);
  });
});
