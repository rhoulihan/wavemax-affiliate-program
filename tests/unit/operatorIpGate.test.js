// Unit tests for the operator-surface IP gate.
//
// Restricts the operator surface (the /operator clean URL, the operator login /
// scan embed pages, and the operator PIN-login endpoint) to the store
// location(s) + the admin IP. Real client IP via cf-connecting-ip (Cloudflare
// edge). Stealth 404. FAILS CLOSED in production: no allowlist => nobody. Live
// only in production or when OPERATOR_IP_GATE_TEST=1 (so the broad test-suite
// isn't blocked).
const operatorIpGate = require('../../server/middleware/operatorIpGate');

const ENV = ['STORE_IP_ADDRESS', 'ADDITIONAL_STORE_IPS', 'STORE_IP_RANGES', 'ADMIN_IP', 'OPERATOR_ALLOWLIST', 'OPERATOR_IP_GATE_TEST'];
const saved = {};
beforeEach(() => {
  ENV.forEach((k) => { saved[k] = process.env[k]; delete process.env[k]; });
  process.env.OPERATOR_IP_GATE_TEST = '1';
});
afterEach(() => { ENV.forEach((k) => { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }); });

function mockReq({ cf, ip, originalUrl = '/operator' } = {}) {
  return { headers: cf ? { 'cf-connecting-ip': cf } : {}, ip, originalUrl, path: originalUrl };
}
function mockRes() {
  const res = { statusCode: 200, body: undefined };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  res.send = (b) => { res.body = b; return res; };
  res.type = () => res;
  res.setHeader = () => res;
  return res;
}

describe('operatorIpGate', () => {
  it('allows the store IP (STORE_IP_ADDRESS)', () => {
    process.env.STORE_IP_ADDRESS = '72.190.1.227';
    const next = jest.fn();
    operatorIpGate(mockReq({ cf: '72.190.1.227' }), mockRes(), next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('allows the admin IP (ADMIN_IP)', () => {
    process.env.ADMIN_IP = '70.114.167.145';
    const next = jest.fn();
    operatorIpGate(mockReq({ cf: '70.114.167.145' }), mockRes(), next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('blocks a non-allowlisted IP with a 404', () => {
    process.env.STORE_IP_ADDRESS = '72.190.1.227';
    const next = jest.fn();
    const res = mockRes();
    operatorIpGate(mockReq({ cf: '8.8.8.8' }), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(404);
  });

  it('FAILS CLOSED when nothing is configured', () => {
    const next = jest.fn();
    const res = mockRes();
    operatorIpGate(mockReq({ cf: '72.190.1.227' }), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(404);
  });

  it('uses cf-connecting-ip as the client (req.ip cannot spoof past the edge)', () => {
    process.env.STORE_IP_ADDRESS = '72.190.1.227';
    const next = jest.fn();
    operatorIpGate(mockReq({ cf: '8.8.8.8', ip: '72.190.1.227' }), mockRes(), next);
    expect(next).not.toHaveBeenCalled();
  });

  it('supports store CIDR ranges + additional store IPs + an explicit override', () => {
    process.env.STORE_IP_RANGES = '10.0.0.0/24';
    const r1 = mockRes(); const n1 = jest.fn();
    operatorIpGate(mockReq({ cf: '10.0.0.5' }), r1, n1);
    expect(n1).toHaveBeenCalledTimes(1);
    delete process.env.STORE_IP_RANGES;
    process.env.OPERATOR_ALLOWLIST = '203.0.113.4';
    const r2 = mockRes(); const n2 = jest.fn();
    operatorIpGate(mockReq({ cf: '203.0.113.4' }), r2, n2);
    expect(n2).toHaveBeenCalledTimes(1);
  });

  it('is transparent when enforcement is not active (no opt-in, non-prod)', () => {
    delete process.env.OPERATOR_IP_GATE_TEST;
    const next = jest.fn();
    operatorIpGate(mockReq({ cf: '8.8.8.8' }), mockRes(), next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('returns JSON 404 for API paths, HTML 404 for pages', () => {
    process.env.STORE_IP_ADDRESS = '72.190.1.227';
    const apiRes = mockRes();
    operatorIpGate(mockReq({ cf: '8.8.8.8', originalUrl: '/api/v1/auth/operator/login' }), apiRes, jest.fn());
    expect(apiRes.statusCode).toBe(404);
    expect(apiRes.body && apiRes.body.success).toBe(false);
    const pageRes = mockRes();
    operatorIpGate(mockReq({ cf: '8.8.8.8', originalUrl: '/operator' }), pageRes, jest.fn());
    expect(typeof pageRes.body).toBe('string');
  });
});
