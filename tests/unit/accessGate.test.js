// Unit tests for the site access-gate middleware.
jest.mock('../../server/utils/logger', () => ({ info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() }));
jest.mock('../../server/models/AccessGate', () => ({ findOne: jest.fn(() => ({ lean: () => Promise.resolve(null) })) }));
jest.mock('../../server/models/AccessWhitelist', () => ({
  findOne: jest.fn(() => ({ lean: () => Promise.resolve(null) })),
  find: jest.fn(() => ({ lean: () => Promise.resolve([]) })),
  updateOne: jest.fn(() => Promise.resolve({})),
}));
jest.mock('../../server/models/AccessClick', () => ({ create: jest.fn(() => Promise.resolve({})) }));
jest.mock('../../server/models/AccessRequest', () => ({
  create: jest.fn(() => Promise.resolve({})),
  findOne: jest.fn(() => ({ lean: () => Promise.resolve(null) })),
  updateOne: jest.fn(() => Promise.resolve({})),
}));
jest.mock('../../server/services/email/transport', () => ({ sendEmail: jest.fn(() => Promise.resolve({ messageId: 'x' })) }));
jest.mock('dns', () => ({ promises: { reverse: jest.fn(), resolve4: jest.fn(), resolve6: jest.fn() } }));

const dns = require('dns').promises;
const { hashPassword } = require('../../server/utils/encryption');
const AccessWhitelist = require('../../server/models/AccessWhitelist');
const AccessClick = require('../../server/models/AccessClick');
const AccessRequest = require('../../server/models/AccessRequest');
const { sendEmail } = require('../../server/services/email/transport');
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
    AccessRequest.create.mockResolvedValue({});
    AccessRequest.findOne.mockReturnValue({ lean: () => Promise.resolve(null) });
    AccessRequest.updateOne.mockResolvedValue({});
    sendEmail.mockResolvedValue({ messageId: 'x' });
    accessGate._botCache.clear();
    accessGate._sendThrottle.clear();
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
    expect(res.send.mock.calls[0][0]).toContain('name="email"');
  });

  it('uses the real client IP from CF-Connecting-IP', async () => {
    accessGate._cache.ips.set('203.0.113.7', { trackClicks: true });
    const req = mkReq({ ip: '172.16.0.1', headers: { 'cf-connecting-ip': '203.0.113.7' } });
    const res = mkRes(); const next = jest.fn();
    await accessGate(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('emails a single-use link on valid email+password and redirects to /__gate/sent (no immediate whitelist)', async () => {
    const req = mkReq({
      method: 'POST', path: '/__gate', ip: '7.7.7.7',
      headers: { host: 'rundberglaundry.com' },
      body: { email: 'user@example.com', password: 'correct-horse', next: '/orders' }
    });
    const res = mkRes(); const next = jest.fn();
    await accessGate(req, res, next);
    expect(AccessRequest.create).toHaveBeenCalledTimes(1);
    const created = AccessRequest.create.mock.calls[0][0];
    expect(created.email).toBe('user@example.com');
    expect(created.token).toEqual(expect.any(String));
    expect(created.next).toBe('/orders');
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail.mock.calls[0][3]).toContain('admin@rundberglaundry.com'); // From override
    expect(sendEmail.mock.calls[0][2]).toContain('/__gate/confirm?token='); // link with token param
    expect(AccessWhitelist.updateOne).not.toHaveBeenCalled(); // not whitelisted yet
    expect(res.redirect).toHaveBeenCalledWith('/__gate/sent');
  });

  it('re-renders the form with an error on valid password but invalid email', async () => {
    const req = mkReq({ method: 'POST', path: '/__gate', ip: '7.7.7.9', body: { email: 'not-an-email', password: 'correct-horse' } });
    const res = mkRes(); const next = jest.fn();
    await accessGate(req, res, next);
    expect(AccessRequest.create).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send.mock.calls[0][0]).toContain('valid email');
  });

  it('rejects a wrong password POST /__gate with 401 + error (no email sent)', async () => {
    const req = mkReq({ method: 'POST', path: '/__gate', ip: '7.7.7.8', body: { email: 'user@example.com', password: 'nope' } });
    const res = mkRes(); const next = jest.fn();
    await accessGate(req, res, next);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(AccessWhitelist.updateOne).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.send.mock.calls[0][0]).toContain('Incorrect password');
  });

  it('serves the landing form (email + password) on GET /__gate', async () => {
    const req = mkReq({ path: '/__gate' }); const res = mkRes(); const next = jest.fn();
    await accessGate(req, res, next);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send.mock.calls[0][0]).toContain('name="email"');
    expect(res.send.mock.calls[0][0]).toContain('Send me a link');
  });

  it('GET /__gate/sent shows the check-your-email page', async () => {
    const req = mkReq({ path: '/__gate/sent', ip: '9.3.3.3' }); const res = mkRes(); const next = jest.fn();
    await accessGate(req, res, next);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send.mock.calls[0][0]).toContain('Check your email');
  });

  it('GET /__gate/confirm with a valid token shows the confirm button (no whitelist yet)', async () => {
    AccessRequest.findOne.mockReturnValue({ lean: () => Promise.resolve({ token: 'tok1', email: 'u@e.com', next: '/dash', used: false, expiresAt: new Date(Date.now() + 60000) }) });
    const req = mkReq({ path: '/__gate/confirm', query: { token: 'tok1' }, ip: '8.8.8.9' });
    const res = mkRes(); const next = jest.fn();
    await accessGate(req, res, next);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send.mock.calls[0][0]).toContain('Enter the site');
    expect(AccessWhitelist.updateOne).not.toHaveBeenCalled();
  });

  it('GET /__gate/confirm with an expired token shows the error page', async () => {
    AccessRequest.findOne.mockReturnValue({ lean: () => Promise.resolve({ token: 'tok2', email: 'u@e.com', used: false, expiresAt: new Date(Date.now() - 1000) }) });
    const req = mkReq({ path: '/__gate/confirm', query: { token: 'tok2' }, ip: '8.8.8.10' });
    const res = mkRes(); const next = jest.fn();
    await accessGate(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send.mock.calls[0][0]).toContain('expired');
    expect(AccessWhitelist.updateOne).not.toHaveBeenCalled();
  });

  it('POST /__gate/confirm with a valid token whitelists the clicking IP and redirects to next', async () => {
    AccessRequest.findOne.mockReturnValue({ lean: () => Promise.resolve({ token: 'tok3', email: 'u@e.com', next: '/dash', used: false, expiresAt: new Date(Date.now() + 60000) }) });
    const req = mkReq({ method: 'POST', path: '/__gate/confirm', ip: '9.1.1.1', body: { token: 'tok3', next: '/dash' } });
    const res = mkRes(); const next = jest.fn();
    await accessGate(req, res, next);
    expect(AccessWhitelist.updateOne.mock.calls[0][0]).toEqual({ ip: '9.1.1.1' });
    expect(AccessRequest.updateOne).toHaveBeenCalledWith({ token: 'tok3' }, expect.objectContaining({ $set: expect.objectContaining({ used: true, usedIp: '9.1.1.1' }) }));
    expect(accessGate._cache.ips.get('9.1.1.1')).toEqual({ trackClicks: true });
    expect(res.redirect).toHaveBeenCalledWith('/dash');
  });

  it('POST /__gate/confirm with an already-used token shows the error page and does not whitelist', async () => {
    AccessRequest.findOne.mockReturnValue({ lean: () => Promise.resolve({ token: 'tok4', email: 'u@e.com', used: true, usedIp: '5.5.5.5', expiresAt: new Date(Date.now() + 60000) }) });
    const req = mkReq({ method: 'POST', path: '/__gate/confirm', ip: '9.2.2.2', body: { token: 'tok4' } });
    const res = mkRes(); const next = jest.fn();
    await accessGate(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(AccessWhitelist.updateOne).not.toHaveBeenCalled();
  });

  it('passes a verified Googlebot IP without recording a click', async () => {
    dns.reverse.mockResolvedValue(['crawl-66-249-66-1.googlebot.com']);
    dns.resolve4.mockResolvedValue(['66.249.66.1']);
    const req = mkReq({ ip: '66.249.66.1', headers: { 'user-agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' } });
    const res = mkRes(); const next = jest.fn();
    await accessGate(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(AccessClick.create).not.toHaveBeenCalled();
  });

  it('caches a verified Googlebot IP (second hit does not re-query DNS)', async () => {
    dns.reverse.mockResolvedValue(['crawl-66-249-66-1.googlebot.com']);
    dns.resolve4.mockResolvedValue(['66.249.66.1']);
    const mk = () => mkReq({ ip: '66.249.66.1', headers: { 'user-agent': 'Googlebot/2.1' } });
    await accessGate(mk(), mkRes(), jest.fn());
    await accessGate(mk(), mkRes(), jest.fn());
    expect(dns.reverse).toHaveBeenCalledTimes(1);
  });

  it('blocks a spoofed Googlebot UA whose reverse DNS is not Google', async () => {
    dns.reverse.mockResolvedValue(['host.evil.example']);
    const req = mkReq({ ip: '203.0.113.99', headers: { 'user-agent': 'Googlebot/2.1' } });
    const res = mkRes(); const next = jest.fn();
    await accessGate(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('blocks Googlebot UA when forward-confirm does not match the IP', async () => {
    dns.reverse.mockResolvedValue(['crawl.googlebot.com']);
    dns.resolve4.mockResolvedValue(['8.8.8.8']);
    const req = mkReq({ ip: '203.0.113.100', headers: { 'user-agent': 'Googlebot/2.1' } });
    const res = mkRes(); const next = jest.fn();
    await accessGate(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('does not perform DNS for a normal browser UA (non-whitelisted → landing)', async () => {
    const req = mkReq({ ip: '203.0.113.101', headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0)' } });
    const res = mkRes(); const next = jest.fn();
    await accessGate(req, res, next);
    expect(dns.reverse).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });
});
