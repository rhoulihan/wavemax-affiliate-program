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
  it('EN and ES pages have independent object references (no shared mutable refs)', () => {
    for (const page of model.PAGES) {
      const enPage = model.content.en.pages[page];
      const esPage = model.content.es.pages[page];
      expect(esPage.cta).not.toBe(enPage.cta);
      expect(esPage.sections).not.toBe(enPage.sections);
    }
  });

  it('all pages (incl. home) are genuinely translated in ES (no English section leak)', () => {
    for (const page of model.PAGES) {
      const en = model.content.en.pages[page];
      const es = model.content.es.pages[page];
      expect(es.sections.map(s => s.kind)).toEqual(en.sections.map(s => s.kind)); // structural parity
      expect(JSON.stringify(es.sections)).not.toEqual(JSON.stringify(en.sections)); // actually translated
      expect(es.sections).not.toBe(en.sections); // independent refs
      // CTA must also be translated (not EN copy)
      expect(JSON.stringify(es.cta)).not.toEqual(JSON.stringify(en.cta));
    }
  });

  it('home is re-based on the self-serve + WDF franchise landing (not the affiliate program copy)', () => {
    for (const lang of model.LANGS) {
      const home = model.content[lang].pages.home;
      // self-serve + WDF framing present
      expect(home.hero.title.toLowerCase()).toMatch(lang === 'es' ? /autoservicio|lava-seca-dobla/ : /self-serve|wash-dry-fold/);
      // real location facts surfaced
      const j = JSON.stringify(home).toLowerCase();
      expect(j).toContain('electrolux');
      expect(j).toContain('$1.20/lb');
      // structural shape from the franchise landing: stats, services, reviews
      const kinds = home.sections.map(s => s.kind);
      expect(kinds).toContain('stats');
      expect(kinds).toContain('reviews');
    }
  });

  it('home (and all pages) contain no pickup/delivery framing — Austin is self-serve + WDF only', () => {
    const j = JSON.stringify(model.content);
    expect(j).not.toMatch(/pickup|door-to-door|recogida|\bentrega\b/i);
    // 'delivery' check: allow none
    expect(j.toLowerCase()).not.toContain('delivery');
  });
});
