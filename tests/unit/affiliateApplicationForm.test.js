// Guard test: the /affiliate page's application form must stay in sync with the
// server validators (server/routes/affiliateApplicationRoutes.js) and stay free
// of WaveMAX branding (it's a public, no-WaveMAX recruitment page).
const fs = require('fs');
const path = require('path');

const HTML = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'affiliate.html'), 'utf8');
const JS = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'assets', 'js', 'affiliate-inquiry.js'), 'utf8');

const VALIDATOR_FIELDS = ['firstName', 'lastName', 'email', 'phone', 'affiliation', 'serviceArea', 'transport', 'availability', 'message', 'source'];

function formNames(html) {
  const names = new Set();
  const re = /<(?:input|select|textarea)\b[^>]*\bname="([^"]+)"/g;
  let m;
  while ((m = re.exec(html))) names.add(m[1]);
  return names;
}

describe('affiliate application form ↔ server contract', () => {
  const names = formNames(HTML);

  test('every server validator field has a matching form control', () => {
    for (const f of VALIDATOR_FIELDS) expect(names.has(f)).toBe(true);
  });

  test('the form introduces no named field the server does not validate', () => {
    for (const n of names) expect(VALIDATOR_FIELDS).toContain(n);
  });

  test('affiliation + transport option values match the server enums', () => {
    for (const v of ['ut-student', 'ut-alum', 'other']) expect(HTML).toContain(`value="${v}"`);
    for (const v of ['car', 'bike', 'scooter', 'on-foot']) expect(HTML).toContain(`value="${v}"`);
  });

  test('required contact fields are marked required', () => {
    for (const f of ['firstName', 'lastName', 'email', 'phone']) {
      expect(new RegExp(`name="${f}"[^>]*\\brequired`).test(HTML)).toBe(true);
    }
  });

  test('has the US-work-eligible / 1099 acknowledgement checkbox (required)', () => {
    expect(/id="af-eligible"[^>]*\brequired/.test(HTML)).toBe(true);
    expect(HTML).toMatch(/1099/);
    expect(HTML).toMatch(/eligible to work in the U\.?S/i);
  });

  test('the page carries ZERO WaveMAX branding', () => {
    expect(HTML).not.toMatch(/wavemax/i);
  });

  test('canonical + og image are the affiliate page (no WaveMAX storefront photo)', () => {
    expect(HTML).toMatch(/<link rel="canonical" href="https:\/\/rundberglaundry\.com\/affiliate">/);
    expect(HTML).not.toContain('locations/austin-tx/hero-1.webp');
  });

  test('handler posts to the public affiliate-application endpoint', () => {
    expect(JS).toContain('/api/v1/affiliate-application');
  });

  test('external (non-inline) css/js only; no Google Fonts CDN', () => {
    expect(HTML).toContain('/assets/css/affiliate.css');
    expect(HTML).toContain('/assets/js/affiliate-inquiry.js');
    expect(HTML).not.toMatch(/fonts\.googleapis\.com|fonts\.gstatic\.com/);
  });
});
