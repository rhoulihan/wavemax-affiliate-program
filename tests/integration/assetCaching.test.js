// Performance: versioned static assets under /assets must be served with a
// long-lived immutable Cache-Control so Cloudflare can serve them from edge
// without an origin revalidation round-trip on every page load. Assets are
// cache-busted via ?v= query strings, so immutable is safe — a content change
// ships a new URL. HTML must NEVER be immutable-cached (it carries the version
// stamps and per-request nonce), so that path is asserted separately.
const request = require('supertest');
const app = require('../../server');

describe('Static asset caching — /assets immutable', () => {
  it('serves CSS under /assets with a 1-year immutable Cache-Control', async () => {
    const res = await request(app).get('/assets/css/wavemax-mhr-chrome.css');
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBeDefined();
    expect(res.headers['cache-control']).toMatch(/max-age=31536000/);
    expect(res.headers['cache-control']).toMatch(/immutable/);
    expect(res.headers['cache-control']).toMatch(/public/);
  });

  it('serves JS under /assets with a 1-year immutable Cache-Control', async () => {
    const res = await request(app).get('/assets/js/franchise-page-helpers.js');
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toMatch(/max-age=31536000/);
    expect(res.headers['cache-control']).toMatch(/immutable/);
  });

  it('serves the immutable header even when a ?v= cache-buster is present', async () => {
    const res = await request(app).get('/assets/js/franchise-page-helpers.js?v=20260524');
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toMatch(/immutable/);
  });

  it('does NOT set a session cookie on /assets responses (else Cloudflare BYPASSes the cache)', async () => {
    // The /assets static mount must run BEFORE express-session. If session
    // middleware runs first it stamps Set-Cookie: __Host-wavemax.sid on the
    // asset, and Cloudflare refuses to cache any response with a session
    // cookie (cf-cache-status: BYPASS) — silently defeating the asset cache.
    const res = await request(app).get('/assets/js/franchise-page-helpers.js?v=20260524');
    expect(res.status).toBe(200);
    const cookies = res.headers['set-cookie'] || [];
    const sessionCookie = cookies.find((c) => /\.sid=/.test(c));
    expect(sessionCookie).toBeUndefined();
  });

  it('does NOT immutable-cache the franchise host HTML', async () => {
    const res = await request(app).get('/austin-tx/').set('Host', 'rundberglaundry.com');
    expect(res.status).toBe(200);
    expect(res.headers['cache-control'] || '').not.toMatch(/immutable/);
    // The HTML keeps its short-lived cache window set by the controller.
    expect(res.headers['cache-control'] || '').toMatch(/max-age=60/);
  });
});
