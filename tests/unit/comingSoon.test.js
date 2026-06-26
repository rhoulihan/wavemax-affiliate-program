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
    expect(html).toMatch(/coming soon/i);
    expect(html).toContain('noindex, nofollow'); // meta tag too
    expect(html).not.toContain('<script'); // self-contained, no script (CSP-clean)
    // De-WaveMAX'd: only the Google map + a "Coming soon" label remain.
    expect(html).toContain('google.com/maps');
    expect(html).not.toMatch(/wavemax/i);
  });

  it('serves the same page on www.rundberglaundry.com and for any non-exempt path', () => {
    for (const [host, path] of [['www.rundberglaundry.com', '/'], ['rundberglaundry.com', '/austin-tx/about-us/'], ['rundberglaundry.com', '/commercial']]) {
      const req = mkReq({ host: undefined, headers: { host }, path }); const res = mkRes(); const next = jest.fn();
      comingSoon(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    }
  });

  it('lets exempt paths through to normal handling (privacy/api/well-known/assets/favicon/robots)', () => {
    for (const path of [
      '/privacy-policy', '/privacy-policy/', '/privacy-policy.html', '/terms-and-conditions',
      '/api/v1/health', '/api/health',
      '/.well-known/acme-challenge/abc', '/assets/css/wavemax-components.min.css',
      '/favicon.ico', '/robots.txt', '/sitemap.xml',
    ]) {
      const req = mkReq({ path }); const res = mkRes(); const next = jest.fn();
      comingSoon(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(res.send).not.toHaveBeenCalled();
    }
  });

  it('lets the token-gated /design-explorer review tool through (explorerGuard then enforces the token)', () => {
    for (const path of [
      '/design-explorer', '/design-explorer/', '/design-explorer/index.html',
      '/design-explorer/explorer.js', '/design-explorer/explorer.css',
      '/design-explorer/render/manifest.json',
      '/design-explorer/render/service-os.heavy.home.en.html',
    ]) {
      const req = mkReq({ path }); const res = mkRes(); const next = jest.fn();
      comingSoon(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(res.send).not.toHaveBeenCalled();
    }
  });

  it('does NOT exempt a lookalike path (/design-explorer-foo is still held)', () => {
    const req = mkReq({ path: '/design-exploreriffic' }); const res = mkRes(); const next = jest.fn();
    comingSoon(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
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

// The store location must reach the REAL app on EVERY route while the public is
// still held — a store-IP bypass (IPv4 + the store's IPv6 /64).
describe('comingSoon store-IP bypass', () => {
  const ORIG = { ...process.env };
  afterEach(() => { process.env = { ...ORIG }; });

  function freshComingSoon(env) {
    let mod;
    jest.isolateModules(() => {
      Object.assign(process.env, env);
      mod = require('../../server/middleware/comingSoon');
    });
    return mod;
  }
  const STORE_ENV = { STORE_IP_ADDRESS: '72.190.1.227', STORE_IP_RANGES: '2603:8080:db00:21b9::/64' };
  const mkRes2 = () => { const r = { headers: {} }; r.status = jest.fn(() => r); r.type = jest.fn(() => r); r.send = jest.fn(() => r); r.set = jest.fn((k, v) => { r.headers[k] = v; return r; }); return r; };
  const heldReq = (ip) => ({ method: 'GET', path: '/austin-tx/', headers: { host: 'rundberglaundry.com', 'cf-connecting-ip': ip } });

  it('serves the real app (next) for the store IPv4 on a held marketing path', () => {
    const cs = freshComingSoon(STORE_ENV);
    const res = mkRes2(); const next = jest.fn();
    cs(heldReq('72.190.1.227'), res, next);
    expect(next).toHaveBeenCalled();
    expect(res.send).not.toHaveBeenCalled();
  });

  it('serves the real app for a store IPv6 within the /64 (incl. IPv4-mapped form)', () => {
    const cs = freshComingSoon(STORE_ENV);
    for (const ip of ['2603:8080:db00:21b9:1d5b:e02c:7105:97f6', '::ffff:72.190.1.227']) {
      const res = mkRes2(); const next = jest.fn();
      cs(heldReq(ip), res, next);
      expect(next).toHaveBeenCalled();
    }
  });

  it('still holds (placeholder) for a non-store IP on the same path', () => {
    const cs = freshComingSoon(STORE_ENV);
    const res = mkRes2(); const next = jest.fn();
    cs(heldReq('8.8.8.8'), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
