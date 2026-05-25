// End-to-end through the real Express app on the crhsent host: confirms the
// wiring (host detection, middleware order, body parsing, redirect+cookie
// round-trip, franchise-host render) that the unit tests can't cover.
jest.setTimeout(60000);

jest.mock('../../server/services/gbpService', () => ({
  resolveGbpLink: jest.fn(), getPlaceDetails: jest.fn(), resolveByText: jest.fn()
}));
jest.mock('../../server/utils/turnstile', () => ({ verifyTurnstile: jest.fn() }));
jest.mock('../../server/services/franchisePreviewEmail', () => ({
  sendPreviewUnlockEmail: jest.fn(), buildUnlockEmailHtml: jest.fn()
}));

const request = require('supertest');
const gbp = require('../../server/services/gbpService');
const { verifyTurnstile } = require('../../server/utils/turnstile');
const { sendPreviewUnlockEmail } = require('../../server/services/franchisePreviewEmail');
const FranchisePreviewRequest = require('../../server/models/FranchisePreviewRequest');
const app = require('../../server');

const HOST = 'crhsent.com';
// Use a city that is NOT a registered franchise, so the bare-slug (no-key) case
// doesn't render a real franchise page.
const DETAILS = {
  placeId: 'P-E2E',
  name: 'WaveMAX E2E',
  formattedAddress: '1 Test Way, Prevue City, ZZ 00000',
  phone: '+1 512-000-0000',
  hours: ['Monday: 7 AM–9 PM'],
  location: { latitude: 30.3, longitude: -97.7 },
  mapsUri: 'https://maps.google.com/?cid=9'
};

describe('franchise preview E2E (crhsent host)', () => {
  beforeAll(() => { process.env.FRANCHISE_PREVIEW_ENABLED = 'true'; });
  afterAll(() => { delete process.env.FRANCHISE_PREVIEW_ENABLED; });
  beforeEach(async () => { await FranchisePreviewRequest.deleteMany({}); });

  it('request → unlock form → unlock → localized preview; bare slug is not the preview', async () => {
    verifyTurnstile.mockResolvedValue({ success: true });
    sendPreviewUnlockEmail.mockResolvedValue();
    gbp.resolveGbpLink.mockResolvedValue(DETAILS);
    gbp.getPlaceDetails.mockResolvedValue(DETAILS);

    // 1. request a preview
    const reqRes = await request(app).post('/__preview/request').set('Host', HOST)
      .send({ placeId: 'P-E2E', email: 'owner@e2e.com', attestation: true, turnstileToken: 't' });
    expect(reqRes.status).toBe(200);
    expect(reqRes.body).toEqual({ ok: true });

    const doc = await FranchisePreviewRequest.findOne({ placeId: 'P-E2E' });
    expect(doc).toBeTruthy();
    expect(sendPreviewUnlockEmail).toHaveBeenCalledTimes(1);
    const password = sendPreviewUnlockEmail.mock.calls[0][0].password;
    const token = doc.token;
    const slug = doc.locationSlug;

    // bare slug (no key) must NOT serve the preview
    const bare = await request(app).get('/' + slug).set('Host', HOST);
    expect(bare.text || '').not.toContain('window.LOCATION_DATA');

    // 2. gated GET with key, no cookie → unlock form
    const form = await request(app).get('/' + slug + '?key=' + token).set('Host', HOST);
    expect(form.status).toBe(200);
    expect(form.text).toContain('action="/__preview/unlock"');

    // 3. unlock with the right password
    const unlock = await request(app).post('/__preview/unlock').set('Host', HOST)
      .type('form').send({ key: token, password, attest: 'yes' });
    expect(unlock.status).toBe(303);
    const setCookie = unlock.headers['set-cookie'];
    expect(setCookie).toBeTruthy();
    const cookie = setCookie.map((c) => c.split(';')[0]).join('; ');

    // 4. gated GET with key + cookie → localized franchise-host preview
    const preview = await request(app).get('/' + slug + '?key=' + token).set('Host', HOST).set('Cookie', cookie);
    expect(preview.status).toBe(200);
    expect(preview.text).toContain('window.LOCATION_DATA');
    expect(preview.text).toContain('WaveMAX E2E');
    expect(preview.text).toContain('/franchise-default/landing.html');
  });

  it('a wrong password does not unlock', async () => {
    verifyTurnstile.mockResolvedValue({ success: true });
    sendPreviewUnlockEmail.mockResolvedValue();
    gbp.getPlaceDetails.mockResolvedValue(DETAILS);
    await request(app).post('/__preview/request').set('Host', HOST)
      .send({ placeId: 'P-E2E', email: 'owner2@e2e.com', attestation: true, turnstileToken: 't' });
    const doc = await FranchisePreviewRequest.findOne({ placeId: 'P-E2E' });

    const unlock = await request(app).post('/__preview/unlock').set('Host', HOST)
      .type('form').send({ key: doc.token, password: 'WRONG-PASS', attest: 'yes' });
    expect(unlock.headers['set-cookie']).toBeFalsy();
    expect(unlock.text).toMatch(/Incorrect password/i);
  });
});
