// Integration: the /operator clean URL + the IP-gated operator surface.
//
// GET /operator serves the SPA shell with window.__DEFAULT_ROUTE='/operator-login'
// injected. The operator surface — /operator, the operator login/scan embed pages,
// and the operator PIN-login endpoint — is gated to the store + admin IPs;
// non-whitelisted clients (by cf-connecting-ip) get a stealth 404.
jest.mock('../../server/utils/emailService');

const request = require('supertest');
const app = require('../../server');

const STORE_IP = '72.190.1.227';
const ADMIN_IP = '70.114.167.145';
const BAD_IP = '198.51.100.9';

const ENV = ['STORE_IP_ADDRESS', 'ADMIN_IP', 'OPERATOR_ALLOWLIST', 'OPERATOR_IP_GATE_TEST'];
const saved = {};
beforeAll(() => { ENV.forEach((k) => { saved[k] = process.env[k]; }); });
afterAll(() => { ENV.forEach((k) => { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }); });
beforeEach(() => {
  process.env.OPERATOR_IP_GATE_TEST = '1';
  process.env.STORE_IP_ADDRESS = STORE_IP;
  process.env.ADMIN_IP = ADMIN_IP;
});

describe('/operator clean URL + operator IP gate', () => {
  it('serves the SPA shell with the operator default route for the store IP', async () => {
    const res = await request(app).get('/operator').set('cf-connecting-ip', STORE_IP);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/html/);
    expect(res.text).toContain("window.__DEFAULT_ROUTE='/operator-login'");
    expect(res.text).toContain('embed-app-v2.min.js');
  });

  it('also allows the admin IP', async () => {
    const res = await request(app).get('/operator').set('cf-connecting-ip', ADMIN_IP);
    expect(res.status).toBe(200);
  });

  it('returns a stealth 404 for a non-whitelisted IP', async () => {
    const res = await request(app).get('/operator').set('cf-connecting-ip', BAD_IP);
    expect(res.status).toBe(404);
    expect(res.text).not.toContain('__DEFAULT_ROUTE');
  });

  it('FAILS CLOSED: 404 when no allowlist is configured', async () => {
    delete process.env.STORE_IP_ADDRESS;
    delete process.env.ADMIN_IP;
    const res = await request(app).get('/operator').set('cf-connecting-ip', STORE_IP);
    expect(res.status).toBe(404);
  });

  it('gates the operator login + scan embed pages', async () => {
    expect((await request(app).get('/operator-scan-embed.html').set('cf-connecting-ip', BAD_IP)).status).toBe(404);
    expect((await request(app).get('/operator-login-embed.html').set('cf-connecting-ip', BAD_IP)).status).toBe(404);
    expect((await request(app).get('/operator-scan-embed.html').set('cf-connecting-ip', STORE_IP)).status).toBe(200);
  });

  it('gates the operator PIN-login endpoint (404 off-allowlist, reaches auth on-allowlist)', async () => {
    const blocked = await request(app)
      .post('/api/v1/auth/operator/login')
      .set('cf-connecting-ip', BAD_IP)
      .send({ pinCode: '0000' });
    expect(blocked.status).toBe(404);

    const allowed = await request(app)
      .post('/api/v1/auth/operator/login')
      .set('cf-connecting-ip', STORE_IP)
      .send({ pinCode: '000000' });
    // Gate passed → the real auth handler ran (invalid PIN), never the gate's 404.
    expect(allowed.status).not.toBe(404);
  });

  it('also gates the GET auto-login token-mint path off-allowlist', async () => {
    const res = await request(app)
      .get('/api/v1/auth/operator/login')
      .set('cf-connecting-ip', BAD_IP);
    expect(res.status).toBe(404);
  });
});
