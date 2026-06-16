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

  it('loads scan-session.js before claim.js for /claim', () => {
    const m = routerSrc.match(/'\/claim':\s*\[([^\]]+)\]/);
    expect(m[1]).toContain('/assets/js/scan-session.js');
    expect(m[1].indexOf('/assets/js/scan-session.js'))
      .toBeLessThan(m[1].indexOf('/assets/js/claim.js'));
  });

  it('loads scan-session.js for /operator-scan', () => {
    const m = routerSrc.match(/'\/operator-scan':\s*\[([^\]]+)\]/);
    expect(m).not.toBeNull();
    expect(m[1]).toContain('/assets/js/scan-session.js');
    expect(m[1].indexOf('/assets/js/scan-session.js'))
      .toBeLessThan(m[1].indexOf('/assets/js/operator-scan-init.js'));
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
      'title', 'subtitle', 'resolving', 'cta',
      'registeredTitle', 'registeredBody',
      'alreadyClaimedTitle', 'alreadyClaimedBody',
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

describe('scan UIs drive the PR 4 /scan/* engine', () => {
  const claimJs = fs.readFileSync(path.join(ROOT, 'public/assets/js/claim.js'), 'utf8');
  const kioskJs = fs.readFileSync(path.join(ROOT, 'public/assets/js/operator-scan-init.js'), 'utf8');
  const scanSessionJs = fs.readFileSync(path.join(ROOT, 'public/assets/js/scan-session.js'), 'utf8');
  const claimHtml = fs.readFileSync(path.join(ROOT, 'public/claim-embed.html'), 'utf8');
  const kioskHtml = fs.readFileSync(path.join(ROOT, 'public/operator-scan-embed.html'), 'utf8');

  it('scan-session.js posts to /scan/session, resolve, apply, undo', () => {
    expect(scanSessionJs).toContain('/api/v1/scan/session');
    expect(scanSessionJs).toMatch(/scan\/'\s*\+\s*path|scan\/resolve|scan\/apply|scan\/undo/);
    // resolve/apply/undo via the shared postScan helper
    expect(scanSessionJs).toMatch(/postScan\('resolve'/);
    expect(scanSessionJs).toMatch(/postScan\('apply'/);
    expect(scanSessionJs).toMatch(/postScan\('undo'/);
  });

  it('claim.js + kiosk reference the scan engine via ScanSession', () => {
    for (const src of [claimJs, kioskJs]) {
      expect(src).toMatch(/ScanSession\.resolve/);
      expect(src).toMatch(/ScanSession\.apply/);
      expect(src).toMatch(/ScanSession\.undo/);
    }
    expect(claimJs).toMatch(/ScanSession\.mint/); // field/staff code flow
  });

  it('no source references the retired bag-action / operator endpoints', () => {
    const retired = [
      '/confirm-delivery', '/bags/', '/intake', '/operators/intake',
      '/operators/scan-processed', '/operators/advance'
    ];
    for (const src of [claimJs, kioskJs, scanSessionJs]) {
      for (const pat of retired) {
        expect(src).not.toContain(pat);
      }
    }
  });

  it('claim + kiosk HTML/JS are CSP-clean (no inline handlers/styles)', () => {
    for (const html of [claimHtml, kioskHtml]) {
      expect(html).not.toMatch(/onclick=/i);
      expect(html).not.toMatch(/ style="/i);
      expect(html).not.toMatch(/<style/i);
    }
    for (const src of [claimJs, kioskJs, scanSessionJs]) {
      expect(src).not.toMatch(/\.innerHTML\s*=/);
    }
  });

  it('kiosk HTML drops the jspdf/qrcode/label-print scripts', () => {
    expect(kioskHtml).not.toMatch(/jspdf/i);
    expect(kioskHtml).not.toMatch(/qrcode/i);
    expect(kioskHtml).not.toMatch(/label-print/i);
    expect(kioskHtml).toContain('/assets/js/scan-session.js');
  });
});
