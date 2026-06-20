// PR 4 — operator scan modal shows the order's add-ons + special instructions
// when scanning a PENDING bag (the intake scan), and hides them on scan-out.
// Source-level wiring test (matches operatorScanModal style; no jsdom needed).
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');

const html = fs.readFileSync(path.join(ROOT, 'public/operator-scan-embed.html'), 'utf8');
const js = fs.readFileSync(path.join(ROOT, 'public/assets/js/operator-scan-init.js'), 'utf8');

describe('operator scan modal: add-ons + special instructions at intake', () => {
  it('has add-ons + special-instructions containers in the confirm modal', () => {
    expect(html).toContain('id="scanAddOns"');
    expect(html).toContain('id="scanInstructions"');
  });

  it('renders add-ons + instructions, gated on a PENDING order (intake scan)', () => {
    // Only shown when the resolved order is pending (the next scan is intake);
    // hidden for in_progress / out_for_delivery / none.
    expect(js).toMatch(/currentStatus === 'pending'/);
    expect(js).toContain('scanAddOns');
    expect(js).toContain('scanInstructions');
    // reads them off the resolve payload
    expect(js).toMatch(/resolveData\.addOns|\.addOns/);
    expect(js).toMatch(/resolveData\.specialInstructions|\.specialInstructions/);
  });

  it('builds the add-on list without innerHTML (CSP-clean)', () => {
    expect(js).not.toMatch(/\.innerHTML\s*=/);
    expect(js).toMatch(/createElement\(/);
  });

  it('localizes add-on labels with the active language', () => {
    expect(js).toMatch(/getLanguage\(\)|i18n.*getLanguage/);
  });

  it('ships operator.scan add-on/instructions labels in all four languages', () => {
    for (const lang of ['en', 'es', 'pt', 'de']) {
      const dict = JSON.parse(fs.readFileSync(path.join(ROOT, `public/locales/${lang}/common.json`), 'utf8'));
      for (const k of ['addonsLabel', 'instructionsLabel']) {
        expect(`${lang}:operator.scan.${k}:${typeof (dict.operator.scan && dict.operator.scan[k])}`)
          .toBe(`${lang}:operator.scan.${k}:string`);
      }
    }
  });
});
