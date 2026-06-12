// W-9 status / admin pending / audited document download (spec §5, §9).
const fs = require('fs');
const os = require('os');
const path = require('path');
const jwt = require('jsonwebtoken');
const request = require('supertest');

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'w9-admin-'));
process.env.W9_STORAGE_PATH = tmpRoot;

// Wrap logAuditEvent so we can assert the W9_DOCUMENT_ACCESSED audit fires.
jest.mock('../../server/utils/auditLogger', () => {
  const actual = jest.requireActual('../../server/utils/auditLogger');
  return { ...actual, logAuditEvent: jest.fn(actual.logAuditEvent) };
});

const app = require('../../server');
const Affiliate = require('../../server/models/Affiliate');
const Administrator = require('../../server/models/Administrator');
const secureFileStore = require('../../server/services/secureFileStore');
const { logAuditEvent, AuditEvents } = require('../../server/utils/auditLogger');

afterAll(() => fs.rmSync(tmpRoot, { recursive: true, force: true }));

const PDF = Buffer.from('%PDF-1.4 admin-download plaintext payload');

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
/** Seed an affiliate with a real encrypted W-9 on disk (bypasses HTTP). */
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

describe('GET /api/v1/w9/status', () => {
  it('returns the caller-affiliate status', async () => {
    const aff = await seedPendingW9(await createAffiliate());
    const res = await request(app)
      .get('/api/v1/w9/status')
      .set('Authorization', `Bearer ${tokenFor(aff, 'affiliate', { affiliateId: aff.affiliateId })}`);
    expect(res.status).toBe(200);
    expect(res.body.w9Status).toBe('pending_review');
    expect(res.body.submittedAt).toBeTruthy();
  });

  it('403s for an administrator (affiliate-only endpoint)', async () => {
    const admin = await createAdmin();
    const res = await request(app)
      .get('/api/v1/w9/status')
      .set('Authorization', `Bearer ${tokenFor(admin, 'administrator')}`);
    expect(res.status).toBe(403);
  });
});

describe('GET /api/v1/w9/admin/pending', () => {
  it('lists only pending_review affiliates, oldest first', async () => {
    const pending = await seedPendingW9(await createAffiliate());
    await createAffiliate({ w9Status: 'on_file' });
    await createAffiliate(); // not_required
    const admin = await createAdmin();

    const res = await request(app)
      .get('/api/v1/w9/admin/pending')
      .set('Authorization', `Bearer ${tokenFor(admin, 'administrator')}`);
    expect(res.status).toBe(200);
    expect(res.body.affiliates).toHaveLength(1);
    expect(res.body.affiliates[0].affiliateId).toBe(pending.affiliateId);
    expect(res.body.affiliates[0].w9Document.filename).toBe('w9.pdf');
  });

  it('403s for an affiliate token', async () => {
    const aff = await createAffiliate();
    const res = await request(app)
      .get('/api/v1/w9/admin/pending')
      .set('Authorization', `Bearer ${tokenFor(aff, 'affiliate', { affiliateId: aff.affiliateId })}`);
    expect(res.status).toBe(403);
  });

  it('403s for an administrator WITHOUT manage_affiliates', async () => {
    const admin = await createAdmin(['view_analytics']);
    const res = await request(app)
      .get('/api/v1/w9/admin/pending')
      .set('Authorization', `Bearer ${tokenFor(admin, 'administrator')}`);
    expect(res.status).toBe(403);
  });
});

describe('GET /api/v1/w9/admin/:affiliateId/document', () => {
  it('streams the decrypted bytes with attachment + nosniff and audits the read', async () => {
    const aff = await seedPendingW9(await createAffiliate());
    const admin = await createAdmin();
    logAuditEvent.mockClear();

    const res = await request(app)
      .get(`/api/v1/w9/admin/${aff.affiliateId}/document`)
      .set('Authorization', `Bearer ${tokenFor(admin, 'administrator')}`)
      .buffer(true)
      .parse((res2, cb) => {
        const chunks = [];
        res2.on('data', (c) => chunks.push(c));
        res2.on('end', () => cb(null, Buffer.concat(chunks)));
      });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/pdf/);
    expect(res.headers['content-disposition']).toMatch(/^attachment/);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(Buffer.compare(res.body, PDF)).toBe(0);   // exact plaintext round-trip

    expect(logAuditEvent).toHaveBeenCalledWith(
      AuditEvents.W9_DOCUMENT_ACCESSED,
      expect.objectContaining({ affiliateId: aff.affiliateId }),
      expect.anything()
    );
  });

  it('404s when the affiliate has no document on file', async () => {
    const aff = await createAffiliate();
    const admin = await createAdmin();
    const res = await request(app)
      .get(`/api/v1/w9/admin/${aff.affiliateId}/document`)
      .set('Authorization', `Bearer ${tokenFor(admin, 'administrator')}`);
    expect(res.status).toBe(404);
  });

  it('500s + SUSPICIOUS_ACTIVITY audit on a tampered file', async () => {
    const aff = await seedPendingW9(await createAffiliate());
    const admin = await createAdmin();
    const abs = path.join(tmpRoot, aff.w9Document.storageKey);
    const framed = fs.readFileSync(abs);
    framed[20] ^= 0xff; // corrupt the authTag
    fs.writeFileSync(abs, framed);
    logAuditEvent.mockClear();

    const res = await request(app)
      .get(`/api/v1/w9/admin/${aff.affiliateId}/document`)
      .set('Authorization', `Bearer ${tokenFor(admin, 'administrator')}`);
    expect(res.status).toBe(500);
    expect(logAuditEvent).toHaveBeenCalledWith(
      AuditEvents.SUSPICIOUS_ACTIVITY,
      expect.objectContaining({ activityType: 'W9_DECRYPT_FAILED' }),
      expect.anything()
    );
  });
});
