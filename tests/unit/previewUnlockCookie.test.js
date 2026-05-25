const cookie = require('../../server/utils/previewUnlockCookie');

describe('previewUnlockCookie', () => {
  const TOKEN = 'a'.repeat(64);

  it('round-trips: a freshly signed cookie verifies for its token', () => {
    const v = cookie.sign(TOKEN);
    expect(cookie.verify(v, TOKEN)).toBe(true);
  });

  it('rejects a cookie for a different token', () => {
    const v = cookie.sign(TOKEN);
    expect(cookie.verify(v, 'b'.repeat(64))).toBe(false);
  });

  it('rejects a tampered cookie', () => {
    const v = cookie.sign(TOKEN);
    const decoded = Buffer.from(v, 'base64url').toString('utf8');
    const tampered = Buffer.from(decoded.slice(0, -2) + 'ff', 'utf8').toString('base64url');
    expect(cookie.verify(tampered, TOKEN)).toBe(false);
  });

  it('rejects an expired cookie', () => {
    const v = cookie.sign(TOKEN, -1000); // already expired
    expect(cookie.verify(v, TOKEN)).toBe(false);
  });

  it('rejects garbage / empty values', () => {
    expect(cookie.verify('', TOKEN)).toBe(false);
    expect(cookie.verify('not-a-cookie', TOKEN)).toBe(false);
    expect(cookie.verify(null, TOKEN)).toBe(false);
  });
});
