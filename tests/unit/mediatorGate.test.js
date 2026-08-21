// mediatorGate — IP-binding password gate for the crhsent.com/wavemax mediator
// documentation package. Verifies the single-viewer binding (first IP binds; same
// IP allowed; other IP denied; admin reset), password matching, and the unlock
// cookie's (passwordHash, IP) binding.
'use strict';

const MediatorAccess = require('../../server/models/MediatorAccess');
const gate = require('../../server/middleware/mediatorGate');

describe('MediatorAccess.authorize — single-viewer IP binding', () => {
  beforeEach(async () => { await MediatorAccess.deleteMany({}); });

  it('binds the first IP to a password, allows that IP again, denies any other IP', async () => {
    const pw = 'code-alpha';
    const first = await MediatorAccess.authorize(pw, '203.0.113.5');
    expect(first).toMatchObject({ ok: true, reason: 'bound' });

    const same = await MediatorAccess.authorize(pw, '203.0.113.5');
    expect(same).toMatchObject({ ok: true, reason: 'allowed' });

    const other = await MediatorAccess.authorize(pw, '198.51.100.9');
    expect(other).toMatchObject({ ok: false, reason: 'denied_wrong_ip' });

    const rec = await MediatorAccess.findOne({ passwordHash: MediatorAccess.hashPassword(pw) });
    expect(rec.boundIp).toBe('203.0.113.5');
    expect(rec.accessLog.map((e) => e.result)).toEqual(['bound', 'allowed', 'denied_wrong_ip']);
  });

  it('binds two different passwords to two different IPs independently', async () => {
    expect((await MediatorAccess.authorize('code-1', '203.0.113.1')).ok).toBe(true);
    expect((await MediatorAccess.authorize('code-2', '203.0.113.2')).ok).toBe(true);
    // code-1 is locked to .1, code-2 to .2 — crossing them is denied
    expect((await MediatorAccess.authorize('code-1', '203.0.113.2')).ok).toBe(false);
    expect((await MediatorAccess.authorize('code-2', '203.0.113.1')).ok).toBe(false);
  });

  it('admin reset clears the binding so a new IP can bind', async () => {
    await MediatorAccess.authorize('code-x', '203.0.113.5');
    expect(await MediatorAccess.resetBinding('code-x')).toBe(true);
    const rebound = await MediatorAccess.authorize('code-x', '10.0.0.7');
    expect(rebound).toMatchObject({ ok: true, reason: 'bound' });
  });
});

describe('mediatorGate helpers', () => {
  const OLD = process.env.MEDIATOR_GATE_PASSWORDS;
  beforeAll(() => { process.env.MEDIATOR_GATE_PASSWORDS = 'secret-one, secret-two'; });
  afterAll(() => { process.env.MEDIATOR_GATE_PASSWORDS = OLD; });

  it('matchPassword accepts a configured code and rejects others', () => {
    expect(gate.matchPassword('secret-one')).toBe('secret-one');
    expect(gate.matchPassword('secret-two')).toBe('secret-two');
    expect(gate.matchPassword('nope')).toBeNull();
    expect(gate.matchPassword('')).toBeNull();
  });

  it('only fronts crhsent.com /wavemax paths', () => {
    const mk = (host, p) => ({ hostname: host, path: p });
    expect(gate.isCrhsentWavemax(mk('crhsent.com', '/wavemax/'))).toBe(true);
    expect(gate.isCrhsentWavemax(mk('crhsent.com', '/wavemax/security-audit.html'))).toBe(true);
    expect(gate.isCrhsentWavemax(mk('crhsent.com', '/work'))).toBe(false);
    expect(gate.isCrhsentWavemax(mk('wavemax.promo', '/wavemax/'))).toBe(false);
  });

  it('unlock cookie is valid only for the issuing IP and rejects tampering', () => {
    const hash = MediatorAccess.hashPassword('secret-one');
    const token = gate.signUnlock(hash, '203.0.113.5');
    expect(gate.verifyUnlock(token, '203.0.113.5')).toBe(true);
    expect(gate.verifyUnlock(token, '198.51.100.9')).toBe(false); // different IP
    // tamper the signature -> must fail the HMAC check
    const parts = Buffer.from(token, 'base64url').toString('utf8').split(':');
    parts[3] = parts[3].slice(0, -1) + (parts[3].endsWith('a') ? 'b' : 'a');
    const tampered = Buffer.from(parts.join(':')).toString('base64url');
    expect(gate.verifyUnlock(tampered, '203.0.113.5')).toBe(false);
    expect(gate.verifyUnlock('not-a-valid-token', '203.0.113.5')).toBe(false);
    expect(gate.verifyUnlock('', '203.0.113.5')).toBe(false);
  });

  it('unlock cookie works for an IPv6 client address (no colon-split lockout)', () => {
    const hash = MediatorAccess.hashPassword('secret-one');
    const ip6 = '2001:db8::1'; // IPv6 addresses contain colons — must not break parsing
    const token = gate.signUnlock(hash, ip6);
    expect(gate.verifyUnlock(token, ip6)).toBe(true);
    expect(gate.verifyUnlock(token, '2001:db8::2')).toBe(false); // different IPv6 → denied
  });

  it('rejects a well-signed cookie whose password hash is not a configured code', () => {
    const bogus = MediatorAccess.hashPassword('not-a-configured-code');
    const token = gate.signUnlock(bogus, '203.0.113.5');
    expect(gate.verifyUnlock(token, '203.0.113.5')).toBe(false);
  });
});

describe('mediatorGate middleware — trusted-IP whitelist bypass', () => {
  const adminIpGate = require('../../server/middleware/adminIpGate');
  const OLD_EN = process.env.MEDIATOR_GATE_ENABLED;
  const OLD_PW = process.env.MEDIATOR_GATE_PASSWORDS;
  beforeAll(() => { process.env.MEDIATOR_GATE_ENABLED = 'true'; process.env.MEDIATOR_GATE_PASSWORDS = 'code-a'; });
  afterAll(() => { process.env.MEDIATOR_GATE_ENABLED = OLD_EN; process.env.MEDIATOR_GATE_PASSWORDS = OLD_PW; });
  afterEach(() => { if (adminIpGate.isAllowed.mockRestore) adminIpGate.isAllowed.mockRestore(); });

  const mkRes = () => ({
    locals: {}, send: jest.fn(), end: jest.fn(), cookie: jest.fn(), redirect: jest.fn(),
    status: jest.fn().mockReturnThis(), type: jest.fn().mockReturnThis(), setHeader: jest.fn().mockReturnThis()
  });
  const mkReq = () => ({ hostname: 'crhsent.com', path: '/wavemax/', method: 'GET', headers: {}, ip: '203.0.113.9', cookies: {} });

  it('serves content (calls next, no prompt) from a trusted admin/home IP without a password', async () => {
    jest.spyOn(adminIpGate, 'isAllowed').mockReturnValue(true);
    const next = jest.fn(); const res = mkRes();
    await gate(mkReq(), res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.send).not.toHaveBeenCalled();
  });

  it('prompts (no next) from a non-whitelisted IP with no unlock cookie', async () => {
    jest.spyOn(adminIpGate, 'isAllowed').mockReturnValue(false);
    const next = jest.fn(); const res = mkRes();
    await gate(mkReq(), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.send).toHaveBeenCalledTimes(1); // the password prompt page
  });
});
