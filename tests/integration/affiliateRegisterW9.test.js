// Invited registration with an optional multipart W-9 (spec §6.2).
// ASSUMES PR 5: AffiliateInvite at server/modules/onboarding/AffiliateInvite.js
// (statics: hashToken(raw) = sha256 hex), registration requires inviteToken,
// and email is forced from the invite.
const fs = require('fs');
const os = require('os');
const path = require('path');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const { v4: uuidv4 } = require('uuid');

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'w9-register-'));
process.env.W9_STORAGE_PATH = tmpRoot;

const app = require('../../server');
const Affiliate = require('../../server/models/Affiliate');
const Administrator = require('../../server/models/Administrator');
const AffiliateInvite = require('../../server/modules/onboarding/AffiliateInvite');
const encryptionUtil = require('../../server/utils/encryption');

afterAll(() => fs.rmSync(tmpRoot, { recursive: true, force: true }));

const PDF = Buffer.from('%PDF-1.4 registration w9 plaintext payload');

async function mintInvite(email) {
  const admin = await Administrator.create({
    firstName: 'Ad', lastName: 'Min', email: `adm${Date.now()}${Math.random()}@test.com`,
    passwordSalt: 's', passwordHash: 'h', permissions: ['manage_affiliates']
  });
  const rawToken = encryptionUtil.generateToken(32);            // 64 hex (canon)
  await AffiliateInvite.create({
    inviteId: 'INV-' + uuidv4(),
    tokenHash: AffiliateInvite.hashToken(rawToken),
    email,
    status: 'pending',
    expiresAt: new Date(Date.now() + 72 * 3600 * 1000),
    createdBy: admin._id
  });
  return rawToken;
}

/** Multipart-friendly field map for the invited-registration form. */
function registrationFields(inviteToken, n) {
  return {
    inviteToken,
    firstName: 'Reg', lastName: 'Ister', phone: '512-555-0100',
    businessName: 'Reg LLC', address: '1 Congress Ave', city: 'Austin',
    state: 'TX', zipCode: '78701',
    username: `regu${n}`, password: 'StrongP@ssw0rd!2026',
    paymentMethod: 'check', languagePreference: 'en'
  };
}

describe('POST /api/v1/affiliates/register with multipart W-9', () => {
  it('registers and stores the W-9 -> w9Status pending_review', async () => {
    const n = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
    const email = `invitee${n}@test.com`;
    const inviteToken = await mintInvite(email);

    let req = request(app).post('/api/v1/affiliates/register');
    for (const [k, v] of Object.entries(registrationFields(inviteToken, n))) {
      req = req.field(k, v);
    }
    const res = await req.attach('w9', PDF, { filename: 'w9.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(201);
    const saved = await Affiliate.findOne({ email });
    expect(saved).toBeTruthy();
    expect(saved.w9Status).toBe('pending_review');
    expect(saved.w9SubmittedAt).toBeInstanceOf(Date);
    expect(saved.w9Document.storageKey).toMatch(new RegExp(`^aff/${saved.affiliateId}/`));

    const onDisk = fs.readFileSync(path.join(tmpRoot, saved.w9Document.storageKey));
    expect(onDisk.includes(PDF)).toBe(false);   // encrypted at rest
  });

  it('still registers WITHOUT a W-9 -> w9Status stays not_required (JSON body)', async () => {
    const n = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
    const email = `invitee${n}@test.com`;
    const inviteToken = await mintInvite(email);

    const res = await request(app)
      .post('/api/v1/affiliates/register')
      .send(registrationFields(inviteToken, n));

    expect(res.status).toBe(201);
    const saved = await Affiliate.findOne({ email });
    expect(saved.w9Status).toBe('not_required');
    expect(saved.w9Document ? saved.w9Document.storageKey : undefined).toBeUndefined();
  });

  it('rejects an SVG W-9 at registration with 400', async () => {
    const n = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
    const inviteToken = await mintInvite(`invitee${n}@test.com`);

    let req = request(app).post('/api/v1/affiliates/register');
    for (const [k, v] of Object.entries(registrationFields(inviteToken, n))) {
      req = req.field(k, v);
    }
    const res = await req.attach('w9', Buffer.from('<svg/>'),
      { filename: 'w9.svg', contentType: 'image/svg+xml' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('W9_INVALID_FILE_TYPE');
    // No affiliate may be created off a rejected multipart parse
    expect(await Affiliate.findOne({ username: `regu${n}` })).toBeNull();
  });
});
