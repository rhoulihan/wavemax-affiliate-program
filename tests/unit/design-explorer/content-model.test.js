// tests/unit/design-explorer/content-model.test.js
const model = require('../../../design-explorer/content-model');

describe('content-model', () => {
  it('exposes the 6 pages and EN/ES', () => {
    expect(model.PAGES).toEqual(['home','self-serve','wash-dry-fold','commercial','about','contact']);
    expect(model.LANGS).toEqual(['en','es']);
  });
  it('carries correct NAP', () => {
    expect(model.NAP.street).toBe('825 E Rundberg Ln F1');
    expect(model.NAP.phone).toBe('(512) 553-1674');
    expect(model.NAP.mapsEmbed).toContain('output=embed');
    expect(model.NAP.mapsEmbed).toContain('t=k'); // satellite
  });
  it('carries the §12.2 trademark + license notice', () => {
    expect(model.TRADEMARK_NOTICE).toMatch(/trademarks of WaveMAX Franchise, LLC/);
    expect(model.TRADEMARK_NOTICE).toMatch(/independently owned and operated by CRHS/);
  });
  it('provides a hero title for every page in every language', () => {
    for (const lang of model.LANGS) {
      for (const page of model.PAGES) {
        expect(typeof model.content[lang].pages[page].hero.title).toBe('string');
        expect(model.content[lang].pages[page].hero.title.length).toBeGreaterThan(0);
      }
    }
  });
});
