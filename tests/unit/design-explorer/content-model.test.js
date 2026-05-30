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
  it('ES pages with no full ES override fall back to EN cta/sections (and are independent copies)', () => {
    const enPage = model.content.en.pages['wash-dry-fold'];
    const esPage = model.content.es.pages['wash-dry-fold'];
    // ES cta equals EN cta value (fallback worked)
    expect(esPage.cta.primaryLabel).toBe(enPage.cta.primaryLabel);
    // But they must not be the same object reference (I-2 clone fix)
    expect(esPage.cta).not.toBe(enPage.cta);
    expect(esPage.sections).not.toBe(enPage.sections);
  });
});
