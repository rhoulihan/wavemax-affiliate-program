// tests/unit/design-explorer/explorerGuard.test.js
const explorerGuard = require('../../../server/middleware/explorerGuard');

const mkRes = () => {
  const res = { headers: {}, cookies: {} };
  res.status = jest.fn(() => res);
  res.set = jest.fn((k, v) => { res.headers[k] = v; return res; });
  res.send = jest.fn(() => res);
  res.type = jest.fn(() => res);
  res.cookie = jest.fn((name, value, opts) => { res.cookies[name] = { value, opts }; return res; });
  return res;
};
const mkReq = (over = {}) => ({ path: '/design-explorer/index.html', query: {}, cookies: {}, ...over });

describe('explorerGuard', () => {
  const OLD = process.env.EXPLORER_TOKEN;
  beforeAll(() => { process.env.EXPLORER_TOKEN = 'secret123'; });
  afterAll(() => { process.env.EXPLORER_TOKEN = OLD; });

  it('passes through non-explorer paths untouched', () => {
    const req = mkReq({ path: '/austin-tx/' }); const res = mkRes(); const next = jest.fn();
    explorerGuard(req, res, next);
    expect(next).toHaveBeenCalled();
  });
  it('404s an explorer path without the token', () => {
    const req = mkReq({ query: {} }); const res = mkRes(); const next = jest.fn();
    explorerGuard(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
  });
  it('allows an explorer path with the correct token and marks noindex', () => {
    const req = mkReq({ query: { k: 'secret123' } }); const res = mkRes(); const next = jest.fn();
    explorerGuard(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.headers['X-Robots-Tag']).toBe('noindex, nofollow');
  });
  it('does not guard look-alike paths like /design-explorerX', () => {
    const req = mkReq({ path: '/design-explorerX', query: {} }); const res = mkRes(); const next = jest.fn();
    explorerGuard(req, res, next);
    expect(next).toHaveBeenCalled();          // passes through, not 404'd
  });
  it('still guards the exact /design-explorer path', () => {
    const req = mkReq({ path: '/design-explorer', query: {} }); const res = mkRes(); const next = jest.fn();
    explorerGuard(req, res, next);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  // --- cookie-based sub-resource auth ---
  it('sets the explorer_k cookie when a valid ?k is provided', () => {
    const req = mkReq({ query: { k: 'secret123' } }); const res = mkRes(); const next = jest.fn();
    explorerGuard(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.cookie).toHaveBeenCalled();
    expect(res.cookies.explorer_k.value).toBe('secret123');
    expect(res.cookies.explorer_k.opts).toMatchObject({
      httpOnly: true, sameSite: 'lax', path: '/design-explorer'
    });
  });
  it('accepts a request authenticated only by the explorer_k cookie (no ?k)', () => {
    const req = mkReq({ query: {}, cookies: { explorer_k: 'secret123' } }); const res = mkRes(); const next = jest.fn();
    explorerGuard(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.headers['X-Robots-Tag']).toBe('noindex, nofollow');
  });
  it('404s when the explorer_k cookie does not match', () => {
    const req = mkReq({ query: {}, cookies: { explorer_k: 'wrong' } }); const res = mkRes(); const next = jest.fn();
    explorerGuard(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
  });

  // --- scoped CSP for the explorer ---
  it('sets a scoped Content-Security-Policy on an authenticated explorer response', () => {
    const req = mkReq({ query: { k: 'secret123' } }); const res = mkRes(); const next = jest.fn();
    explorerGuard(req, res, next);
    const csp = res.headers['Content-Security-Policy'];
    expect(csp).toBeDefined();
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
    expect(csp).toContain("frame-src 'self' https://www.google.com");
  });
  it('keeps no-store and noindex on authenticated explorer responses', () => {
    const req = mkReq({ query: { k: 'secret123' } }); const res = mkRes(); const next = jest.fn();
    explorerGuard(req, res, next);
    expect(res.headers['Cache-Control']).toBe('no-store');
    expect(res.headers['X-Robots-Tag']).toBe('noindex, nofollow');
  });
});
