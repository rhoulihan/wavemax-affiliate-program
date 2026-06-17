// extractBagToken — kiosk scan-input parser (raw 32-hex or claim URL).

const { extractBagToken } = require('../../public/assets/js/bag-token-parser');

describe('extractBagToken', () => {
  const TOKEN = '0123456789abcdef0123456789abcdef';

  it('accepts a raw lowercase 32-hex token', () => {
    expect(extractBagToken(TOKEN)).toBe(TOKEN);
  });

  it('lowercases an uppercased scan of the token', () => {
    expect(extractBagToken(TOKEN.toUpperCase())).toBe(TOKEN);
  });

  it('trims scanner whitespace/newlines', () => {
    expect(extractBagToken(`  ${TOKEN}\n`)).toBe(TOKEN);
  });

  it('extracts the token from the full printed claim URL', () => {
    expect(extractBagToken(
      `https://wavemax.promo/embed-app-v2.html?route=/claim&bag=${TOKEN}`
    )).toBe(TOKEN);
  });

  it('extracts when bag is the first query param', () => {
    expect(extractBagToken(`https://wavemax.promo/claim?bag=${TOKEN}`)).toBe(TOKEN);
  });

  it('extracts when more params follow the bag param', () => {
    expect(extractBagToken(
      `https://wavemax.promo/embed-app-v2.html?route=/claim&bag=${TOKEN}&lang=es`
    )).toBe(TOKEN);
  });

  it('lowercases a token inside a URL', () => {
    expect(extractBagToken(`https://x.test/?bag=${TOKEN.toUpperCase()}`)).toBe(TOKEN);
  });

  // Hardware keyboard-wedge scanners often UPPERCASE the whole QR and/or mangle
  // URL punctuation on non-US layouts; the hex token survives. These must still
  // resolve to the (lowercase) token.
  it('extracts from a fully UPPERCASED claim URL (BAG=)', () => {
    expect(extractBagToken(
      `HTTPS://WAVEMAX.PROMO/EMBED-APP-V2.HTML?ROUTE=/CLAIM&BAG=${TOKEN.toUpperCase()}`
    )).toBe(TOKEN);
  });

  it('recovers the token when the URL punctuation is mangled but the hex survives', () => {
    expect(extractBagToken(`httpsX__wavemax.promoX_claimX_bagX${TOKEN}`)).toBe(TOKEN);
  });

  it('recovers a token preceded by a mangled separator', () => {
    expect(extractBagToken(`§route=§claim¤bag¤${TOKEN}`)).toBe(TOKEN);
  });

  it.each([
    ['legacy customer#bag QR', 'CUST-123abc#BAG001'],
    ['bare customer id', 'CUST-7f3a2b1c-aaaa-bbbb-cccc-1234567890ab'],
    ['31 hex chars', '0123456789abcdef0123456789abcde'],
    ['33 hex chars', '0123456789abcdef0123456789abcdef0'],
    ['non-hex 32 chars', 'zzzz456789abcdef0123456789abcdef'],
    ['URL without bag param', 'https://wavemax.promo/embed-app-v2.html?route=/claim'],
    ['URL with malformed bag value', 'https://x.test/?bag=nothex'],
    ['empty string', ''],
    ['null', null],
    ['number', 42]
  ])('returns null for %s', (_label, input) => {
    expect(extractBagToken(input)).toBeNull();
  });
});
