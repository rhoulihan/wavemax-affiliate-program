// In-process integration smoke for the explorer guard: mirrors the curl checks
// (404 without token; 200 + Set-Cookie + scoped CSP with ?k; cookie-only sub-resource)
// using supertest against a real Express app + static file serving.
const express = require('express');
const request = require('supertest');
const cookieParser = require('cookie-parser');
const path = require('path');
const guard = require('../../../server/middleware/explorerGuard');

const PUBLIC = path.join(__dirname, '../../../public');

function makeApp() {
  const app = express();
  // simulate helmet setting a strict global CSP the guard must override
  app.use((req, res, next) => {
    res.set('Content-Security-Policy', "default-src 'self'; style-src 'self' 'nonce-xyz'");
    next();
  });
  app.use(cookieParser());
  app.use(guard);
  app.use(express.static(PUBLIC));
  return app;
}

describe('explorer guard — HTTP integration', () => {
  const OLD = process.env.EXPLORER_TOKEN;
  let app;
  beforeAll(() => { process.env.EXPLORER_TOKEN = 'testtok'; app = makeApp(); });
  afterAll(() => { process.env.EXPLORER_TOKEN = OLD; });

  it('(a) 404s index.html with no token and no cookie', async () => {
    const r = await request(app).get('/design-explorer/index.html');
    expect(r.status).toBe(404);
    expect(r.headers['cache-control']).toBe('no-store');
  });

  it('(b) serves index.html with ?k, setting cookie + scoped CSP + noindex', async () => {
    const r = await request(app).get('/design-explorer/index.html?k=testtok');
    expect(r.status).toBe(200);
    expect(r.headers['set-cookie'][0]).toMatch(/^explorer_k=testtok/);
    expect(r.headers['set-cookie'][0]).toMatch(/HttpOnly/i);
    expect(r.headers['set-cookie'][0]).toMatch(/Path=\/design-explorer/);
    expect(r.headers['content-security-policy']).toContain("frame-src 'self' https://www.google.com");
    expect(r.headers['content-security-policy']).toContain("style-src 'self' 'unsafe-inline'");
    expect(r.headers['content-security-policy']).not.toContain('nonce-xyz'); // helmet overridden
    expect(r.headers['x-robots-tag']).toBe('noindex, nofollow');
    expect(r.text).toContain('Design Explorer');
  });

  it('(c) serves a sub-resource (manifest) authenticated by cookie only', async () => {
    const r = await request(app)
      .get('/design-explorer/render/manifest.json')
      .set('Cookie', 'explorer_k=testtok');
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body.states)).toBe(true);
    expect(r.body.states.length).toBeGreaterThan(0);
  });

  it('(d) 404s a sub-resource with a wrong cookie', async () => {
    const r = await request(app)
      .get('/design-explorer/explorer.css')
      .set('Cookie', 'explorer_k=nope');
    expect(r.status).toBe(404);
  });

  // --- encoded-path bypass: authoritative proof the bypass is CLOSED ---
  it('(e) 404s /%64esign-explorer/render/manifest.json with no token (encoded-path bypass closed)', async () => {
    // Before the fix: express.static decoded %64→d and served the real file (200).
    // After the fix: the guard decodes first, matches the explorer namespace, and 404s.
    const r = await request(app).get('/%64esign-explorer/render/manifest.json');
    expect(r.status).toBe(404);
    expect(r.headers['cache-control']).toBe('no-store');
  });

  it('(f) still serves /%64esign-explorer/render/manifest.json when the cookie is valid', async () => {
    // Ensures the fix doesn't break authenticated access via encoded paths.
    const r = await request(app)
      .get('/%64esign-explorer/render/manifest.json')
      .set('Cookie', 'explorer_k=testtok');
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body.states)).toBe(true);
  });
});
