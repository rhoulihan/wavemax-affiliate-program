// tests/unit/design-explorer/explorerGuard.test.js
const explorerGuard = require('../../../server/middleware/explorerGuard');

const mkRes = () => {
  const res = { headers: {} };
  res.status = jest.fn(() => res);
  res.set = jest.fn((k, v) => { res.headers[k] = v; return res; });
  res.send = jest.fn(() => res);
  res.type = jest.fn(() => res);
  return res;
};
const mkReq = (over = {}) => ({ path: '/design-explorer/index.html', query: {}, ...over });

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
});
