// /claim page wiring — both router maps + excludedRoutes + i18n parity
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const routerSrc = fs.readFileSync(path.join(ROOT, 'public/assets/js/embed-app-v2.js'), 'utf8');

describe('/claim page wiring', () => {
  it('is registered in EMBED_PAGES', () => {
    expect(routerSrc).toMatch(/'\/claim':\s*'\/claim-embed\.html'/);
  });

  it('is registered in pageScripts with claim.js last', () => {
    const m = routerSrc.match(/'\/claim':\s*\[([^\]]+)\]/);
    expect(m).not.toBeNull();
    expect(m[1]).toContain('/assets/js/claim.js');
  });

  it('is in excludedRoutes (requires a ?bag= parameter, never persisted)', () => {
    const m = routerSrc.match(/const excludedRoutes = \[([\s\S]*?)\]/);
    expect(m).not.toBeNull();
    expect(m[1]).toContain("'/claim'");
  });

  it('claim-embed.html exists, is CSP-clean, and references claim assets', () => {
    const html = fs.readFileSync(path.join(ROOT, 'public/claim-embed.html'), 'utf8');
    expect(html).toContain('/assets/css/claim.css');
    expect(html).not.toMatch(/ style="/i);
    expect(html).not.toMatch(/onclick=/i);
    expect(html).toContain('data-i18n="claim.title"');
  });

  it('ships claim.* and bag.label.* keys in all four languages', () => {
    const langs = ['en', 'es', 'pt', 'de'];
    const required = [
      'title', 'subtitle', 'resolving', 'cta', 'ctaOAuthGoogle', 'ctaOAuthFacebook',
      'alreadyClaimedTitle', 'alreadyClaimedBody', 'alreadyClaimedCta',
      'invalidTitle', 'invalidBody', 'raceLost'
    ];
    for (const lang of langs) {
      const dict = JSON.parse(fs.readFileSync(
        path.join(ROOT, `public/locales/${lang}/common.json`), 'utf8'));
      for (const key of required) {
        const val = dict.claim && dict.claim[key];
        // typeof guard: `${undefined}` stringifies to 'undefined' and would
        // spuriously satisfy a bare .+ match.
        expect(`${lang}:claim.${key}:${typeof val}`).toBe(`${lang}:claim.${key}:string`);
        expect(`${lang}:claim.${key}=${val}`)
          .toMatch(new RegExp(`^${lang}:claim\\.${key}=.+`)); // present + non-empty
      }
      for (const key of ['affiliateHeading', 'bagRef', 'printInstructions']) {
        const val = dict.bag && dict.bag.label && dict.bag.label[key];
        expect(`${lang}:bag.label.${key}:${typeof val}`).toBe(`${lang}:bag.label.${key}:string`);
        expect(`${lang}:bag.label.${key}=${val}`)
          .toMatch(new RegExp(`^${lang}:bag\\.label\\.${key}=.+`));
      }
    }
  });
});
