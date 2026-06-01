// tests/unit/design-explorer/content-model.test.js
const model = require('../../../design-explorer/content-model');

describe('content-model', () => {
  it('exposes the 6 pages and EN/ES/PT/DE', () => {
    expect(model.PAGES).toEqual(['home','self-serve','wash-dry-fold','commercial','about','contact']);
    expect(model.LANGS).toEqual(['en','es','pt','de']);
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
  it('all language pages have independent object references from EN (no shared mutable refs)', () => {
    for (const lang of model.LANGS.filter(l => l !== 'en')) {
      for (const page of model.PAGES) {
        const enPage = model.content.en.pages[page];
        const langPage = model.content[lang].pages[page];
        expect(langPage.cta).not.toBe(enPage.cta);
        expect(langPage.sections).not.toBe(enPage.sections);
      }
    }
  });

  it('all pages (incl. home) are genuinely translated in every non-EN language (no English section leak)', () => {
    for (const lang of model.LANGS.filter(l => l !== 'en')) {
      for (const page of model.PAGES) {
        const en = model.content.en.pages[page];
        const lp = model.content[lang].pages[page];
        expect(lp.sections.map(s => s.kind)).toEqual(en.sections.map(s => s.kind)); // structural parity
        expect(JSON.stringify(lp.sections)).not.toEqual(JSON.stringify(en.sections)); // actually translated
        expect(lp.sections).not.toBe(en.sections); // independent refs
        // CTA must also be translated (not EN copy)
        expect(JSON.stringify(lp.cta)).not.toEqual(JSON.stringify(en.cta));
      }
    }
  });

  it('home is re-based on the self-serve + WDF franchise landing (not the affiliate program copy)', () => {
    const homeKeywords = {
      en: /self-serve|wash-dry-fold/,
      es: /autoservicio|lava-seca-dobla/,
      pt: /autoatendimento|lavar-secar-dobrar/,
      de: /sb-w.scherei|waschen-trocknen-falten/i,
    };
    // price strings differ by locale decimal separator
    const priceStrings = {
      en: '$1.20/lb', es: '$1.20/lb', pt: '$1,20/lb', de: '$1,20/lb',
    };
    for (const lang of model.LANGS) {
      const home = model.content[lang].pages.home;
      // self-serve + WDF framing present
      expect(home.hero.title.toLowerCase()).toMatch(homeKeywords[lang]);
      // real location facts surfaced
      const j = JSON.stringify(home).toLowerCase();
      expect(j).toContain('electrolux');
      expect(j).toContain(priceStrings[lang].toLowerCase());
      // structural shape from the franchise landing: stats, services, reviews
      const kinds = home.sections.map(s => s.kind);
      expect(kinds).toContain('stats');
      expect(kinds).toContain('reviews');
    }
  });

  it('home (and all pages) contain no pickup/delivery framing — Austin is self-serve + WDF only', () => {
    const j = JSON.stringify(model.content);
    // Two-word and one-word EN forms
    expect(j).not.toMatch(/pick ?up|picked up/i);
    // DE pickup/collection/delivery forms
    expect(j).not.toMatch(/abhol|abgeholt|Abholung|Lieferung/i);
    // Broader EN/multi-lang delivery indicators
    expect(j).not.toMatch(/pickup|door-to-door|recogida|\bentrega\b|\bdelivery\b/i);
  });
});
