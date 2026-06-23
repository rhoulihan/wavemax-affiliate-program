// Rate-limiter key generators must bucket by the REAL visitor IP (cf-connecting-ip),
// not Express's req.ip (= the Cloudflare edge). Before this fix every visitor
// behind a given CF edge shared one rate-limit counter — a shared throttle a few
// users (or one abuser) could exhaust for everyone.
//
// The limiters themselves are skipped in NODE_ENV=test (skipInTest), so their
// keyGenerators never run during the integration suite. These unit tests exercise
// the generators directly via the test-only `_keyGenerators` export.

const { _keyGenerators } = require('../../server/middleware/rateLimiting');

// A request that arrives at the origin from a Cloudflare edge: req.ip is the
// edge, cf-connecting-ip is the real visitor.
const edgeReq = (overrides = {}) => ({
  headers: { 'cf-connecting-ip': '203.0.113.7' },
  ip: '172.69.1.1',
  body: {},
  ...overrides
});

describe('rateLimiting._keyGenerators', () => {
  it('exposes the generator set', () => {
    expect(_keyGenerators).toBeDefined();
    ['ip', 'userOrIp', 'emailOrUserOrIp', 'adminLogin'].forEach((k) => {
      expect(typeof _keyGenerators[k]).toBe('function');
    });
  });

  describe('ip', () => {
    it('keys on the real visitor IP, not the CF edge', () => {
      expect(_keyGenerators.ip(edgeReq())).toBe('203.0.113.7');
    });
    it('collapses IPv6 to /64', () => {
      expect(_keyGenerators.ip(edgeReq({ headers: { 'cf-connecting-ip': '2001:db8:1:2:3:4:5:6' } })))
        .toBe('2001:db8:1:2::/64');
    });
  });

  describe('userOrIp', () => {
    it('keys by user id when authenticated', () => {
      expect(_keyGenerators.userOrIp(edgeReq({ user: { id: 'AFF-9' } }))).toBe('user_AFF-9');
    });
    it('keys by real visitor IP when anonymous', () => {
      expect(_keyGenerators.userOrIp(edgeReq())).toBe('203.0.113.7');
    });
  });

  describe('emailOrUserOrIp', () => {
    it('keys by email when present', () => {
      expect(_keyGenerators.emailOrUserOrIp(edgeReq({ body: { email: 'a@b.com' } }))).toBe('a@b.com');
    });
    it('keys by user id when no email', () => {
      expect(_keyGenerators.emailOrUserOrIp(edgeReq({ user: { id: 'CUST-3' } }))).toBe('CUST-3');
    });
    it('keys by real visitor IP when neither', () => {
      expect(_keyGenerators.emailOrUserOrIp(edgeReq())).toBe('203.0.113.7');
    });
  });

  describe('adminLogin', () => {
    it('composes the real visitor IP with the username', () => {
      expect(_keyGenerators.adminLogin(edgeReq({ body: { username: 'root' } })))
        .toBe('admin_login_203.0.113.7_root');
    });
    it('uses the real IP, not the CF edge', () => {
      const key = _keyGenerators.adminLogin(edgeReq({ body: { username: 'root' } }));
      expect(key).toContain('203.0.113.7');
      expect(key).not.toContain('172.69.1.1');
    });
    it('handles a missing body gracefully', () => {
      const req = { headers: { 'cf-connecting-ip': '203.0.113.7' }, ip: '172.69.1.1' };
      expect(_keyGenerators.adminLogin(req)).toBe('admin_login_203.0.113.7_');
    });
  });
});
