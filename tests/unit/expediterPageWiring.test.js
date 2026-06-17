// PR D — Order Expediter page wiring (router maps + page assets + CSP-clean).
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const routerSrc = fs.readFileSync(path.join(ROOT, 'public/assets/js/embed-app-v2.js'), 'utf8');

describe('/order-expediter wiring', () => {
  it('is registered in EMBED_PAGES', () => {
    expect(routerSrc).toMatch(/'\/order-expediter':\s*'\/order-expediter-embed\.html'/);
  });

  it('is registered in pageScripts with order-expediter-init.js', () => {
    const m = routerSrc.match(/'\/order-expediter':\s*\[([^\]]+)\]/);
    expect(m).not.toBeNull();
    expect(m[1]).toContain('/assets/js/order-expediter-init.js');
  });

  it('is excluded from route persistence (needs a ?k= token)', () => {
    const m = routerSrc.match(/const excludedRoutes = \[([\s\S]*?)\]/);
    expect(m[1]).toContain("'/order-expediter'");
  });

  it('page + init + css exist and the page is CSP-clean', () => {
    const html = fs.readFileSync(path.join(ROOT, 'public/order-expediter-embed.html'), 'utf8');
    expect(html).toContain('/assets/css/order-expediter.css');
    expect(html).toContain('data-i18n="expediter.title"');
    expect(html).not.toMatch(/ style="/i);
    expect(html).not.toMatch(/onclick=/i);
    expect(html).not.toMatch(/<script/i); // scripts come from pageScripts, not inline
    expect(fs.existsSync(path.join(ROOT, 'public/assets/js/order-expediter-init.js'))).toBe(true);
    expect(fs.existsSync(path.join(ROOT, 'public/assets/css/order-expediter.css'))).toBe(true);
    const initJs = fs.readFileSync(path.join(ROOT, 'public/assets/js/order-expediter-init.js'), 'utf8');
    expect(initJs).not.toMatch(/\.innerHTML\s*=/); // DOM construction only (no XSS surface)
  });

  it('ships expediter.* keys in all four languages', () => {
    const required = ['title', 'accessDenied', 'pending', 'inProgress', 'outForDelivery',
      'totalActive', 'byAffiliate', 'partner', 'noActive', 'todaySummary',
      'completedToday', 'avgProcessing', 'avgTurnaround'];
    for (const lang of ['en', 'es', 'pt', 'de']) {
      const dict = JSON.parse(fs.readFileSync(path.join(ROOT, `public/locales/${lang}/common.json`), 'utf8'));
      for (const key of required) {
        const val = dict.expediter && dict.expediter[key];
        expect(`${lang}:expediter.${key}:${typeof val}`).toBe(`${lang}:expediter.${key}:string`);
      }
    }
  });
});
