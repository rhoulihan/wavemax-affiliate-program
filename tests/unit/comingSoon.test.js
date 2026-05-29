// Unit tests for the coming-soon placeholder middleware (rundberglaundry.com).
// Same noindex page to everyone (no cloaking); exempt paths pass through.
const comingSoon = require('../../server/middleware/comingSoon');

const mkRes = () => {
  const res = { headers: {} };
  res.status = jest.fn(() => res);
  res.type = jest.fn(() => res);
  res.send = jest.fn(() => res);
  res.set = jest.fn((k, v) => { res.headers[k] = v; return res; });
  return res;
};
const mkReq = (over = {}) => ({ method: 'GET', path: '/', headers: { host: 'rundberglaundry.com' }, ...over });

describe('comingSoon middleware', () => {
  it('serves a noindex coming-soon page for a marketing path on rundberglaundry.com', () => {
    const req = mkReq({ path: '/austin-tx/' }); const res = mkRes(); const next = jest.fn();
    comingSoon(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.headers['X-Robots-Tag']).toBe('noindex, nofollow');
    const html = res.send.mock.calls[0][0];
    expect(html).toContain('coming soon');
    expect(html).toContain('noindex, nofollow'); // meta tag too
    expect(html).not.toContain('<script'); // self-contained, no script (CSP-clean)
  });

  it('serves the same page on www.rundberglaundry.com and for any non-exempt path', () => {
    for (const [host, path] of [['www.rundberglaundry.com', '/'], ['rundberglaundry.com', '/austin-tx/about-us/'], ['rundberglaundry.com', '/commercial']]) {
      const req = mkReq({ host: undefined, headers: { host }, path }); const res = mkRes(); const next = jest.fn();
      comingSoon(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    }
  });

  it('lets exempt paths through to normal handling (privacy/OAuth/well-known/assets/favicon/robots)', () => {
    for (const path of [
      '/privacy-policy', '/privacy-policy/', '/privacy-policy.html', '/terms-and-conditions',
      '/api/v1/auth/google/callback', '/api/health',
      '/.well-known/acme-challenge/abc', '/assets/css/wavemax-components.min.css',
      '/favicon.ico', '/robots.txt', '/sitemap.xml',
    ]) {
      const req = mkReq({ path }); const res = mkRes(); const next = jest.fn();
      comingSoon(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(res.send).not.toHaveBeenCalled();
    }
  });

  it('does NOT touch other hosts — wavemax.promo and crhsent.com pass through', () => {
    for (const host of ['wavemax.promo', 'www.wavemax.promo', 'crhsent.com', 'wavemaxlaundry.com']) {
      const req = mkReq({ host: undefined, headers: { host }, path: '/' }); const res = mkRes(); const next = jest.fn();
      comingSoon(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(res.send).not.toHaveBeenCalled();
    }
  });

  it('uses x-forwarded-host when present (behind the proxy)', () => {
    const req = mkReq({ headers: { host: 'localhost', 'x-forwarded-host': 'rundberglaundry.com' }, path: '/austin-tx/' });
    const res = mkRes(); const next = jest.fn();
    comingSoon(req, res, next);
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
