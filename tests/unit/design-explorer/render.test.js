// tests/unit/design-explorer/render.test.js
const { renderState } = require('../../../design-explorer/render');
const stub = require('../../../design-explorer/skins/_stub');

describe('renderState (core)', () => {
  const base = { skin: stub, page: 'home', lang: 'en', nonce: 'TESTNONCE' };

  it('produces a full HTML document with correct lang', () => {
    const html = renderState({ ...base, intensity: 'heavy' });
    expect(html).toMatch(/^<!DOCTYPE html>/);
    expect(html).toContain('<html lang="en"');
  });
  it('includes the §12.2 trademark notice in every state', () => {
    for (const intensity of ['heavy', 'light']) {
      const html = renderState({ ...base, intensity });
      expect(html).toContain('trademarks of WaveMAX Franchise, LLC');
      expect(html).toContain('independently owned and operated by CRHS');
    }
  });
  it('applies the intensity theme class and brand title', () => {
    const heavy = renderState({ ...base, intensity: 'heavy' });
    const light = renderState({ ...base, intensity: 'light' });
    expect(heavy).toContain('data-intensity="heavy"');
    expect(light).toContain('data-intensity="light"');
    expect(heavy).toContain('WaveMAX Austin');
    expect(light).toContain('independently owned');
    // Fix #2: skin id is coerced to a safe attribute token
    expect(heavy).toContain('data-skin="stub"');
  });
  it('throws on unknown lang', () => {
    expect(() => renderState({ ...base, intensity: 'heavy', lang: 'xx' }))
      .toThrow(/unknown lang/);
  });
  it('delegates the body to the skin and carries the skin css', () => {
    const html = renderState({ ...base, intensity: 'heavy' });
    expect(html).toContain('STUB-BODY-home');
    expect(html).toContain('STUB-CSS');
  });
  it('emits the nonce placeholder substitution (no raw {{NONCE}})', () => {
    const html = renderState({ ...base, intensity: 'heavy' });
    expect(html).toContain('nonce="TESTNONCE"');
    expect(html).not.toContain('{{NONCE}}');
  });
  it('contains no inline event handlers and no INLINE scripts (CSP-clean)', () => {
    const html = renderState({ ...base, intensity: 'heavy' });
    // No on*= handlers.
    expect(html).not.toMatch(/\son\w+=/);
    // No INLINE script — a <script> WITHOUT a src. The legitimate external
    // concierge client (<script src=...>) is allowed by script-src 'self'.
    expect(html).not.toMatch(/<script(?![^>]*\ssrc=)/i);
  });
  it('loads the external (CSP-clean) concierge client script', () => {
    const html = renderState({ ...base, intensity: 'heavy' });
    expect(html).toContain('/design-explorer/concierge-client.js');
    // It must be an external script (has a src) — not an inline one.
    expect(html).toMatch(/<script[^>]*\ssrc="\/design-explorer\/concierge-client\.js"/);
  });
});
