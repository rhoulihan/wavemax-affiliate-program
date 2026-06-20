// PR 3 — add-on selector + special-instructions on the customer start-order form.
// Source-level wiring test (matches claimPageWiring style; no jsdom needed).
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');

const html = fs.readFileSync(path.join(ROOT, 'public/claim-embed.html'), 'utf8');
const claimJs = fs.readFileSync(path.join(ROOT, 'public/assets/js/claim.js'), 'utf8');

describe('start-order form: add-ons + special instructions', () => {
  it('has an order-options container on BOTH start surfaces', () => {
    // customer [Start my order] actions panel + the post-registration start screen
    expect(html).toContain('id="customer-order-options"');
    expect(html).toContain('id="pickup-order-options"');
  });

  it('fetches the public add-on catalog and renders/collects options', () => {
    expect(claimJs).toContain('/api/v1/addons');
    expect(claimJs).toContain('renderOrderOptions');
    expect(claimJs).toContain('collectOrderOptions');
  });

  it('passes the collected add-ons + instructions into create-pending on both starts', () => {
    // customerStartOrder and requestPickupNow both collect options and forward
    // them to ScanSession.apply(..., 'create-pending', opts).
    expect(claimJs).toMatch(/collectOrderOptions\(['"]customer-order-options['"]\)/);
    expect(claimJs).toMatch(/collectOrderOptions\(['"]pickup-order-options['"]\)/);
    // apply is called with an options object carrying addOns
    expect(claimJs).toMatch(/apply\(bagToken,\s*'create-pending',\s*[a-zA-Z]/);
  });

  it('builds the options DOM without innerHTML (CSP-clean)', () => {
    expect(claimJs).not.toMatch(/\.innerHTML\s*=/);
    expect(claimJs).toMatch(/createElement\(/);
  });

  it('localizes add-on labels with the active language', () => {
    expect(claimJs).toMatch(/i18n.*getLanguage|getLanguage\(\)/);
    expect(claimJs).toMatch(/translations/);
  });

  it('re-localizes the options on a language switch (static via data-i18n, dynamic in place)', () => {
    // static title/label/placeholder carry data-i18n so translatePage() handles them
    expect(claimJs).toMatch(/setAttribute\('data-i18n',\s*'claim\.order\.addonsTitle'\)/);
    expect(claimJs).toMatch(/setAttribute\('data-i18n-placeholder',\s*'claim\.order\.instructionsPlaceholder'\)/);
    // dynamic catalog labels re-localized in place on the languageChanged event
    expect(claimJs).toMatch(/addEventListener\('languageChanged'/);
  });

  it('ships claim.order.* form keys in all four languages', () => {
    for (const lang of ['en', 'es', 'pt', 'de']) {
      const dict = JSON.parse(fs.readFileSync(path.join(ROOT, `public/locales/${lang}/common.json`), 'utf8'));
      for (const k of ['addonsTitle', 'instructionsLabel', 'instructionsPlaceholder']) {
        expect(`${lang}:claim.order.${k}:${typeof (dict.claim.order && dict.claim.order[k])}`)
          .toBe(`${lang}:claim.order.${k}:string`);
      }
    }
  });
});
