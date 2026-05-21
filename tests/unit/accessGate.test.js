// Unit tests for the site access-gate middleware.
jest.mock('../../server/utils/logger', () => ({ info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() }));
jest.mock('../../server/models/AccessGate', () => ({ findOne: jest.fn(() => ({ lean: () => Promise.resolve(null) })) }));
jest.mock('../../server/models/AccessWhitelist', () => ({
  findOne: jest.fn(() => ({ lean: () => Promise.resolve(null) })),
  find: jest.fn(() => ({ lean: () => Promise.resolve([]) })),
  updateOne: jest.fn(() => Promise.resolve({})),
}));
jest.mock('../../server/models/AccessClick', () => ({ create: jest.fn(() => Promise.resolve({})) }));

const { hashPassword } = require('../../server/utils/encryption');
const AccessWhitelist = require('../../server/models/AccessWhitelist');
const AccessClick = require('../../server/models/AccessClick');
const accessGate = require('../../server/middleware/accessGate');

const mkRes = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.type = jest.fn(() => res);
  res.send = jest.fn(() => res);
  res.redirect = jest.fn(() => res);
  return res;
};
const mkReq = (over = {}) => ({ method: 'GET', path: '/', originalUrl: '/', headers: {}, query: {}, body: {}, ip: '9.9.9.9', ...over });

describe('accessGate middleware', () => {
  const { salt, hash } = hashPassword('correct-horse');
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ACCESS_GATE_ENABLED = 'true';
    accessGate._cache.salt = salt;
    accessGate._cache.hash = hash;
    accessGate._cache.ips = new Map();
    AccessWhitelist.findOne.mockReturnValue({ lean: () => Promise.resolve(null) });
    AccessWhitelist.updateOne.mockResolvedValue({});
    AccessClick.create.mockResolvedValue({});
  });
  afterAll(() => { delete process.env.ACCESS_GATE_ENABLED; });

  it('is a no-op when ACCESS_GATE_ENABLED is not true', async () => {
    process.env.ACCESS_GATE_ENABLED = 'false';
    const req = mkReq(); const res = mkRes(); const next = jest.fn();
    await accessGate(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.send).not.toHaveBeenCalled();
  });

  it('lets exempt paths through (logo) without whitelist', async () => {
    const req = mkReq({ path: '/assets/images/brand/logo-wavemax.png' }); const res = mkRes(); const next = jest.fn();
    await accessGate(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('passes a whitelisted IP and records the click when trackClicks=true', async () => {
    accessGate._cache.ips.set('1.2.3.4', { trackClicks: true });
    const req = mkReq({ ip: '1.2.3.4' }); const res = mkRes(); const next = jest.fn();
    await accessGate(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(AccessClick.create).toHaveBeenCalledTimes(1);
  });

  it('passes the admin IP WITHOUT recording a click (trackClicks=false)', async () => {
    accessGate._cache.ips.set('5.5.5.5', { trackClicks: false });
    const req = mkReq({ ip: '5.5.5.5' }); const res = mkRes(); const next = jest.fn();
    await accessGate(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(AccessClick.create).not.toHaveBeenCalled();
  });

  it('serves the landing page (401) for a non-whitelisted GET', async () => {
    const req = mkReq({ ip: '8.8.8.8', originalUrl: '/dashboard' }); const res = mkRes(); const next = jest.fn();
    await accessGate(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.send.mock.calls[0][0]).toContain('Enter password');
  });

  it('uses the real client IP from CF-Connecting-IP', async () => {
    accessGate._cache.ips.set('203.0.113.7', { trackClicks: true });
    const req = mkReq({ ip: '172.16.0.1', headers: { 'cf-connecting-ip': '203.0.113.7' } });
    const res = mkRes(); const next = jest.fn();
    await accessGate(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('whitelists the IP and redirects on correct password POST /__gate', async () => {
    const req = mkReq({ method: 'POST', path: '/__gate', ip: '7.7.7.7', body: { password: 'correct-horse', next: '/orders' } });
    const res = mkRes(); const next = jest.fn();
    await accessGate(req, res, next);
    expect(AccessWhitelist.updateOne).toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith('/orders');
    expect(accessGate._cache.ips.get('7.7.7.7')).toEqual({ trackClicks: true });
  });

  it('rejects a wrong password POST /__gate with 401 + error', async () => {
    const req = mkReq({ method: 'POST', path: '/__gate', ip: '7.7.7.8', body: { password: 'nope' } });
    const res = mkRes(); const next = jest.fn();
    await accessGate(req, res, next);
    expect(AccessWhitelist.updateOne).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.send.mock.calls[0][0]).toContain('Incorrect password');
  });

  it('serves the landing page on GET /__gate', async () => {
    const req = mkReq({ path: '/__gate' }); const res = mkRes(); const next = jest.fn();
    await accessGate(req, res, next);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send.mock.calls[0][0]).toContain('Enter password');
  });
});
