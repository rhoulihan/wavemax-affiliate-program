// codeAttemptLockout.attemptKey — Cloudflare edge-IP correctness (PR 9 review item).
//
// Deployment chain is Cloudflare → nginx → node with trust proxy = 1, so
// req.ip resolves to the CF edge IP. The attempt key must use the real client
// IP from the cf-connecting-ip header (accessGate.js precedent) or one busy
// edge would lock out everyone behind it.

const codeAttemptLockout = require('../../server/services/codeAttemptLockout');

function fakeReq({ cfIp, reqIp } = {}) {
  return {
    headers: cfIp ? { 'cf-connecting-ip': cfIp } : {},
    ip: reqIp
  };
}

describe('codeAttemptLockout.attemptKey', () => {
  const bagToken = 'a'.repeat(32);

  it('uses cf-connecting-ip when present — two clients behind the same edge IP get independent keys', () => {
    const keyA = codeAttemptLockout.attemptKey({
      scope: 'op', bagToken, req: fakeReq({ cfIp: '203.0.113.10', reqIp: '172.70.0.1' })
    });
    const keyB = codeAttemptLockout.attemptKey({
      scope: 'op', bagToken, req: fakeReq({ cfIp: '203.0.113.20', reqIp: '172.70.0.1' })
    });
    expect(keyA).not.toBe(keyB);
    expect(keyA.endsWith(':203.0.113.10')).toBe(true);
    expect(keyB.endsWith(':203.0.113.20')).toBe(true);
  });

  it('falls back to req.ip when cf-connecting-ip is absent', () => {
    const key = codeAttemptLockout.attemptKey({
      scope: 'deliver', bagToken, req: fakeReq({ reqIp: '198.51.100.7' })
    });
    expect(key.endsWith(':198.51.100.7')).toBe(true);
  });

  it('falls back to no-ip when no request context exists', () => {
    const key = codeAttemptLockout.attemptKey({ scope: 'deliver', bagToken, req: undefined });
    expect(key.endsWith(':no-ip')).toBe(true);
  });

  it('never embeds the raw bag token in the key', () => {
    const key = codeAttemptLockout.attemptKey({
      scope: 'op', bagToken, req: fakeReq({ cfIp: '203.0.113.10' })
    });
    expect(key).not.toContain(bagToken);
  });
});
