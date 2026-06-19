// Unit tests for the admin-surface IP gate.
//
// The gate restricts the admin surface (the /admin clean URL, the administrator
// embed pages, the admin login endpoint, and the /api/v1/administrators API) to
// a small allowlist of IPs, derived from env. Behind Cloudflare the real client
// IP is cf-connecting-ip (req.ip would be the CF edge). Non-whitelisted requests
// get a stealth 404. It FAILS CLOSED: with no allowlist configured, nobody is
// allowed (so a missing env can never silently expose admin).
const adminIpGate = require('../../server/middleware/adminIpGate');

const ENV_KEYS = ['ADMIN_ALLOWLIST', 'ADMIN_IP', 'STORE_IP_ADDRESS', 'ADDITIONAL_STORE_IPS', 'STORE_IP_RANGES', 'ADMIN_IP_GATE_TEST'];
const saved = {};
beforeEach(() => {
  ENV_KEYS.forEach((k) => { saved[k] = process.env[k]; delete process.env[k]; });
  process.env.ADMIN_IP_GATE_TEST = '1'; // opt this suite into live enforcement
});
afterEach(() => { ENV_KEYS.forEach((k) => { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }); });

function mockReq({ cf, ip, originalUrl = '/admin', path = '/admin' } = {}) {
  return { headers: cf ? { 'cf-connecting-ip': cf } : {}, ip, originalUrl, path };
}
function mockRes() {
  const res = { statusCode: 200, body: undefined, _type: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; res.ended = true; return res; };
  res.send = (b) => { res.body = b; res.ended = true; return res; };
  res.type = (t) => { res._type = t; return res; };
  res.setHeader = () => res;
  return res;
}

describe('adminIpGate', () => {
  it('allows when cf-connecting-ip is in ADMIN_ALLOWLIST', () => {
    process.env.ADMIN_ALLOWLIST = '1.2.3.4, 5.6.7.8';
    const next = jest.fn();
    const res = mockRes();
    adminIpGate(mockReq({ cf: '5.6.7.8', ip: '172.16.0.9' }), res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(200);
  });

  it('allows when there is no cf-connecting-ip and req.ip is in the allowlist', () => {
    process.env.ADMIN_ALLOWLIST = '1.2.3.4';
    const next = jest.fn();
    const res = mockRes();
    adminIpGate(mockReq({ ip: '1.2.3.4' }), res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('blocks with a 404 when the IP is not allowed', () => {
    process.env.ADMIN_ALLOWLIST = '1.2.3.4';
    const next = jest.fn();
    const res = mockRes();
    adminIpGate(mockReq({ cf: '9.9.9.9' }), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(404);
  });

  it('FAILS CLOSED: with no allowlist configured nobody is allowed', () => {
    const next = jest.fn();
    const res = mockRes();
    adminIpGate(mockReq({ cf: '1.2.3.4' }), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(404);
  });

  it('uses cf-connecting-ip as the client even when req.ip would be allowed (no edge spoofing)', () => {
    process.env.ADMIN_ALLOWLIST = '1.2.3.4'; // req.ip is allowed...
    const next = jest.fn();
    const res = mockRes();
    // ...but the real client (cf-connecting-ip) is NOT — must block.
    adminIpGate(mockReq({ cf: '9.9.9.9', ip: '1.2.3.4' }), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(404);
  });

  it('normalizes IPv4-mapped IPv6 (::ffff:) before comparing', () => {
    process.env.ADMIN_ALLOWLIST = '1.2.3.4';
    const next = jest.fn();
    const res = mockRes();
    adminIpGate(mockReq({ ip: '::ffff:1.2.3.4' }), res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('falls back to ADMIN_IP + STORE_IP_ADDRESS when ADMIN_ALLOWLIST is unset', () => {
    process.env.ADMIN_IP = '1.2.3.4';
    process.env.STORE_IP_ADDRESS = '5.6.7.8';
    const res1 = mockRes(); const n1 = jest.fn();
    adminIpGate(mockReq({ cf: '1.2.3.4' }), res1, n1);
    expect(n1).toHaveBeenCalledTimes(1);
    const res2 = mockRes(); const n2 = jest.fn();
    adminIpGate(mockReq({ cf: '5.6.7.8' }), res2, n2);
    expect(n2).toHaveBeenCalledTimes(1);
    const res3 = mockRes(); const n3 = jest.fn();
    adminIpGate(mockReq({ cf: '9.9.9.9' }), res3, n3);
    expect(n3).not.toHaveBeenCalled();
    expect(res3.statusCode).toBe(404);
  });

  it('supports a CIDR entry in the allowlist', () => {
    process.env.ADMIN_ALLOWLIST = '10.0.0.0/24';
    const res1 = mockRes(); const n1 = jest.fn();
    adminIpGate(mockReq({ cf: '10.0.0.42' }), res1, n1);
    expect(n1).toHaveBeenCalledTimes(1);
    const res2 = mockRes(); const n2 = jest.fn();
    adminIpGate(mockReq({ cf: '10.0.1.42' }), res2, n2);
    expect(n2).not.toHaveBeenCalled();
  });

  it('returns a JSON 404 for API paths and an HTML 404 for page paths (stealth, content-appropriate)', () => {
    process.env.ADMIN_ALLOWLIST = '1.2.3.4';
    const apiRes = mockRes();
    adminIpGate(mockReq({ cf: '9.9.9.9', originalUrl: '/api/v1/administrators/dashboard', path: '/dashboard' }), apiRes, jest.fn());
    expect(apiRes.statusCode).toBe(404);
    expect(apiRes.body && typeof apiRes.body === 'object').toBe(true);
    expect(apiRes.body.success).toBe(false);

    const pageRes = mockRes();
    adminIpGate(mockReq({ cf: '9.9.9.9', originalUrl: '/admin', path: '/admin' }), pageRes, jest.fn());
    expect(pageRes.statusCode).toBe(404);
    expect(typeof pageRes.body).toBe('string');
  });
});
