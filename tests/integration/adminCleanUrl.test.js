// Integration: the /admin clean URL + the IP-gated admin surface.
//
// GET /admin serves the SPA shell with window.__DEFAULT_ROUTE='/administrator-login'
// injected (clean address bar). The admin surface — /admin, the administrator
// embed pages, the admin login endpoint, and /api/v1/administrators — is gated to
// ADMIN_ALLOWLIST; non-whitelisted clients (by cf-connecting-ip) get a stealth 404.
jest.mock('../../server/utils/emailService');

const request = require('supertest');
const app = require('../../server');

const GOOD_IP = '203.0.113.7';   // in the allowlist for these tests
const BAD_IP = '198.51.100.9';   // not in the allowlist

let savedAllowlist;
let savedGateTest;
beforeAll(() => { savedAllowlist = process.env.ADMIN_ALLOWLIST; savedGateTest = process.env.ADMIN_IP_GATE_TEST; });
afterAll(() => {
  if (savedAllowlist === undefined) delete process.env.ADMIN_ALLOWLIST;
  else process.env.ADMIN_ALLOWLIST = savedAllowlist;
  if (savedGateTest === undefined) delete process.env.ADMIN_IP_GATE_TEST;
  else process.env.ADMIN_IP_GATE_TEST = savedGateTest;
});

describe('/admin clean URL + admin IP gate', () => {
  // Opt into live enforcement (the gate is transparent in test by default).
  beforeEach(() => { process.env.ADMIN_ALLOWLIST = GOOD_IP; process.env.ADMIN_IP_GATE_TEST = '1'; });

  describe('GET /admin', () => {
    it('serves the SPA shell with the admin default route injected for an allowed IP', async () => {
      const res = await request(app).get('/admin').set('cf-connecting-ip', GOOD_IP);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/html/);
      expect(res.text).toContain("window.__DEFAULT_ROUTE='/administrator-login'");
      expect(res.text).toContain('embed-app-v2.min.js'); // it really is the SPA shell
    });

    it('returns a stealth 404 for a non-whitelisted IP', async () => {
      const res = await request(app).get('/admin').set('cf-connecting-ip', BAD_IP);
      expect(res.status).toBe(404);
      expect(res.text).not.toContain('__DEFAULT_ROUTE');
    });

    it('FAILS CLOSED: 404 when no allowlist is configured', async () => {
      delete process.env.ADMIN_ALLOWLIST;
      const res = await request(app).get('/admin').set('cf-connecting-ip', GOOD_IP);
      expect(res.status).toBe(404);
    });
  });

  describe('administrator embed pages', () => {
    it('serves the dashboard page for an allowed IP but 404s a non-whitelisted one', async () => {
      const ok = await request(app).get('/administrator-dashboard-embed.html').set('cf-connecting-ip', GOOD_IP);
      expect(ok.status).toBe(200);
      const blocked = await request(app).get('/administrator-dashboard-embed.html').set('cf-connecting-ip', BAD_IP);
      expect(blocked.status).toBe(404);
    });

    it('gates the administrator login page too', async () => {
      const blocked = await request(app).get('/administrator-login-embed.html').set('cf-connecting-ip', BAD_IP);
      expect(blocked.status).toBe(404);
    });
  });

  describe('admin login endpoint', () => {
    it('blocks a non-whitelisted IP with a 404 before auth is attempted', async () => {
      const res = await request(app)
        .post('/api/v1/auth/administrator/login')
        .set('cf-connecting-ip', BAD_IP)
        .send({ email: 'admin@wavemax.promo', password: 'whatever' });
      expect(res.status).toBe(404);
    });

    it('lets an allowed IP through to auth (not a 404)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/administrator/login')
        .set('cf-connecting-ip', GOOD_IP)
        .send({ email: 'nobody@example.com', password: 'wrong-password' });
      // Gate passed → real auth ran → invalid creds / validation, never the gate's 404.
      expect(res.status).not.toBe(404);
      expect([400, 401, 403, 429]).toContain(res.status);
    });
  });

  describe('admin API', () => {
    it('returns a stealth JSON 404 for a non-whitelisted IP', async () => {
      const res = await request(app)
        .get('/api/v1/administrators/dashboard')
        .set('cf-connecting-ip', BAD_IP);
      expect(res.status).toBe(404);
      expect(res.body).toBeTruthy();
      expect(res.body.success).toBe(false);
    });
  });
});
