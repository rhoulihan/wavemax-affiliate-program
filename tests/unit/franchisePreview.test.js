jest.mock('../../server/services/gbpService', () => ({
  getPlaceDetails: jest.fn(),
  resolveGbpLink: jest.fn(),
  resolveByText: jest.fn()
}));
jest.mock('../../server/utils/turnstile', () => ({ verifyTurnstile: jest.fn() }));
jest.mock('../../server/services/franchisePreviewEmail', () => ({ sendPreviewUnlockEmail: jest.fn().mockResolvedValue() }));

const gbp = require('../../server/services/gbpService');
const { verifyTurnstile } = require('../../server/utils/turnstile');
const { sendPreviewUnlockEmail } = require('../../server/services/franchisePreviewEmail');
const { verifyPassword, hashPassword } = require('../../server/utils/encryption');
const { DISCLAIMER_VERSION } = require('../../server/config/franchisePreviewCopy');
const unlockCookie = require('../../server/utils/previewUnlockCookie');
const FranchisePreviewRequest = require('../../server/models/FranchisePreviewRequest');
const franchisePreview = require('../../server/middleware/franchisePreview');

function mockRes() {
  const res = { statusCode: 200, body: undefined, cookies: {}, redirectedTo: null, locals: {} };
  res.status = jest.fn((c) => { res.statusCode = c; return res; });
  res.json = jest.fn((b) => { res.body = b; return res; });
  res.type = jest.fn(() => res);
  res.send = jest.fn((b) => { res.body = b; return res; });
  res.cookie = jest.fn((n, v, o) => { res.cookies[n] = { value: v, opts: o }; return res; });
  res.redirect = jest.fn((code, url) => { res.statusCode = code; res.redirectedTo = url; return res; });
  return res;
}
function mockReq(over = {}) {
  return { method: 'POST', path: '/__preview/request', hostname: 'crhsent.com', headers: {}, ip: '9.9.9.9', body: {}, query: {}, cookies: {}, ...over };
}

const DETAILS = {
  placeId: 'PLACE-1',
  name: 'WaveMAX Laundry Austin',
  formattedAddress: '825 E Rundberg Ln, Austin, TX 78753',
  phone: '+1 512-553-1674',
  rating: 4.8
};

describe('franchisePreview middleware', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    process.env.FRANCHISE_PREVIEW_ENABLED = 'true';
    await FranchisePreviewRequest.deleteMany({});
  });
  afterAll(() => { delete process.env.FRANCHISE_PREVIEW_ENABLED; });

  it('is a no-op (calls next) when the feature is disabled', async () => {
    delete process.env.FRANCHISE_PREVIEW_ENABLED;
    const req = mockReq(); const res = mockRes(); const next = jest.fn();
    await franchisePreview(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  it('resolve returns the place when the link resolves', async () => {
    gbp.resolveGbpLink.mockResolvedValueOnce(DETAILS);
    const req = mockReq({ path: '/__preview/resolve', body: { gbpLink: 'https://maps.google.com/?cid=1' } });
    const res = mockRes();
    await franchisePreview(req, res, jest.fn());
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true, placeId: 'PLACE-1', name: 'WaveMAX Laundry Austin' }));
  });

  it('request happy path: creates a grant, records attestation, emails a valid password', async () => {
    verifyTurnstile.mockResolvedValueOnce({ success: true });
    gbp.getPlaceDetails.mockResolvedValueOnce(DETAILS);
    const req = mockReq({ body: { placeId: 'PLACE-1', email: 'Owner@Example.com', attestation: true, turnstileToken: 'tok' } });
    const res = mockRes();
    await franchisePreview(req, res, jest.fn());

    expect(res.json).toHaveBeenCalledWith({ ok: true });
    const doc = await FranchisePreviewRequest.findOne({ placeId: 'PLACE-1' });
    expect(doc).toBeTruthy();
    expect(doc.email).toBe('owner@example.com');             // normalized
    expect(doc.locationSlug).toBe('austin-tx');               // city/state slug
    expect(doc.token).toHaveLength(64);                       // 32 bytes hex
    expect(doc.attestation.version).toBe(DISCLAIMER_VERSION);
    expect(doc.passwordHash).toBeTruthy();

    // the emailed password must verify against the stored hash (round-trip)
    expect(sendPreviewUnlockEmail).toHaveBeenCalledTimes(1);
    const sent = sendPreviewUnlockEmail.mock.calls[0][0];
    expect(sent.unlockUrl).toContain(`?key=${doc.token}`);
    expect(verifyPassword(sent.password, doc.passwordSalt, doc.passwordHash)).toBe(true);
  });

  it('request rejects a failed captcha (no grant, no email)', async () => {
    verifyTurnstile.mockResolvedValueOnce({ success: false });
    const req = mockReq({ body: { placeId: 'PLACE-1', email: 'a@b.com', attestation: true, turnstileToken: 'x' } });
    const res = mockRes();
    await franchisePreview(req, res, jest.fn());
    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ ok: false, code: 'CAPTCHA_FAILED' });
    expect(await FranchisePreviewRequest.countDocuments()).toBe(0);
    expect(sendPreviewUnlockEmail).not.toHaveBeenCalled();
  });

  it('request rejects an invalid email', async () => {
    verifyTurnstile.mockResolvedValueOnce({ success: true });
    const req = mockReq({ body: { placeId: 'PLACE-1', email: 'nope', attestation: true, turnstileToken: 'x' } });
    const res = mockRes();
    await franchisePreview(req, res, jest.fn());
    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ code: 'INVALID_EMAIL' });
  });

  it('request requires the attestation checkbox', async () => {
    verifyTurnstile.mockResolvedValueOnce({ success: true });
    const req = mockReq({ body: { placeId: 'PLACE-1', email: 'a@b.com', attestation: false, turnstileToken: 'x' } });
    const res = mockRes();
    await franchisePreview(req, res, jest.fn());
    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ code: 'ATTESTATION_REQUIRED' });
  });

  it('request throttles a rapid re-send from the same email (ok, no duplicate)', async () => {
    await FranchisePreviewRequest.create({
      token: 'a'.repeat(64), locationSlug: 'austin-tx', placeId: 'PLACE-1',
      email: 'owner@example.com', passwordSalt: 's', passwordHash: 'h',
      requestIp: '1.1.1.1', createdAt: new Date()
    });
    verifyTurnstile.mockResolvedValueOnce({ success: true });
    gbp.getPlaceDetails.mockResolvedValueOnce(DETAILS);
    const req = mockReq({ body: { placeId: 'PLACE-1', email: 'owner@example.com', attestation: true, turnstileToken: 'x' } });
    const res = mockRes();
    await franchisePreview(req, res, jest.fn());
    expect(res.body).toEqual({ ok: true });
    expect(await FranchisePreviewRequest.countDocuments()).toBe(1); // no duplicate
    expect(sendPreviewUnlockEmail).not.toHaveBeenCalled();
  });

  it('locationSlug parses city/state from the formatted address', () => {
    expect(franchisePreview._internals.locationSlug(DETAILS)).toBe('austin-tx');
    expect(franchisePreview._internals.locationSlug({ name: 'Joe Laundry' })).toBe('joe-laundry');
  });
});

describe('franchisePreview gated route + unlock (Phase 2)', () => {
  const TOKEN = 'c'.repeat(64);
  beforeEach(async () => {
    jest.clearAllMocks();
    process.env.FRANCHISE_PREVIEW_ENABLED = 'true';
    await FranchisePreviewRequest.deleteMany({});
  });
  afterAll(() => { delete process.env.FRANCHISE_PREVIEW_ENABLED; });

  function seed(password) {
    const { salt, hash } = hashPassword(password);
    return FranchisePreviewRequest.create({
      token: TOKEN, locationSlug: 'austin-tx', placeId: 'P1',
      businessName: 'WaveMAX Austin', formattedAddress: '825 E Rundberg Ln, Austin, TX',
      email: 'o@e.com', passwordSalt: salt, passwordHash: hash,
      gbpData: { name: 'WaveMAX Austin', phone: '+1 512-553-1674', rating: 4.8, userRatingCount: 48, hours: ['Mon: 7 AM–9 PM'] },
      requestIp: '1.1.1.1', createdAt: new Date()
    });
  }

  it('GET without a key falls through (next)', async () => {
    const req = mockReq({ method: 'GET', path: '/austin-tx', query: {} });
    const res = mockRes(); const next = jest.fn();
    await franchisePreview(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('GET with an invalid key 404s', async () => {
    const req = mockReq({ method: 'GET', path: '/austin-tx', query: { key: 'nope' } });
    const res = mockRes();
    await franchisePreview(req, res, jest.fn());
    expect(res.statusCode).toBe(404);
    expect(res.body).toMatch(/not found/i);
  });

  it('GET with a valid key but no cookie shows the unlock form', async () => {
    await seed('GOOD-PASS');
    const req = mockReq({ method: 'GET', path: '/austin-tx', query: { key: TOKEN } });
    const res = mockRes();
    await franchisePreview(req, res, jest.fn());
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('action="/__preview/unlock"');
    expect(res.body).toContain('WaveMAX Austin');
  });

  it('GET with a valid key + valid unlock cookie serves the preview', async () => {
    await seed('GOOD-PASS');
    const req = mockReq({
      method: 'GET', path: '/austin-tx', query: { key: TOKEN },
      cookies: { [unlockCookie.COOKIE_NAME]: unlockCookie.sign(TOKEN) }
    });
    const res = mockRes();
    await franchisePreview(req, res, jest.fn());
    expect(res.body).toContain('Your private preview');
    expect(res.body).toContain('WaveMAX Austin');
  });

  it('unlock with the wrong password re-shows the form, sets no cookie', async () => {
    await seed('GOOD-PASS');
    const req = mockReq({ path: '/__preview/unlock', body: { key: TOKEN, password: 'WRONG', attest: 'yes' } });
    const res = mockRes();
    await franchisePreview(req, res, jest.fn());
    expect(res.body).toMatch(/Incorrect password/i);
    expect(res.cookies[unlockCookie.COOKIE_NAME]).toBeUndefined();
  });

  it('unlock without attestation re-shows the form with an error', async () => {
    await seed('GOOD-PASS');
    const req = mockReq({ path: '/__preview/unlock', body: { key: TOKEN, password: 'GOOD-PASS', attest: '' } });
    const res = mockRes();
    await franchisePreview(req, res, jest.fn());
    expect(res.body).toMatch(/authorized/i);
    expect(res.cookies[unlockCookie.COOKIE_NAME]).toBeUndefined();
  });

  it('unlock with the correct password sets the 1-hour cookie and redirects', async () => {
    await seed('GOOD-PASS');
    const req = mockReq({ path: '/__preview/unlock', body: { key: TOKEN, password: 'GOOD-PASS', attest: 'yes' } });
    const res = mockRes();
    await franchisePreview(req, res, jest.fn());
    const set = res.cookies[unlockCookie.COOKIE_NAME];
    expect(set).toBeDefined();
    expect(unlockCookie.verify(set.value, TOKEN)).toBe(true);
    expect(set.opts).toMatchObject({ httpOnly: true });
    expect(res.statusCode).toBe(303);
    expect(res.redirectedTo).toBe('/austin-tx?key=' + TOKEN);
    const doc = await FranchisePreviewRequest.findOne({ token: TOKEN });
    expect(doc.lastUnlockedAt).toBeTruthy();
  });
});
