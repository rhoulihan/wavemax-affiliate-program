// affiliateRegister.w9.* must ship in en/es/pt/de in the SAME commit (house rule).
const fs = require('fs');
const path = require('path');

describe('affiliateRegister.w9 i18n keys', () => {
  const langs = ['en', 'es', 'pt', 'de'];
  const required = ['uploadLabel', 'fileTypeHint', 'tooLarge', 'wrongType', 'optionalNote'];

  it.each(langs)('%s/common.json ships every affiliateRegister.w9 key', (lang) => {
    const file = path.join(__dirname, `../../public/locales/${lang}/common.json`);
    const json = JSON.parse(fs.readFileSync(file, 'utf8'));
    const w9 = json.affiliateRegister && json.affiliateRegister.w9;
    expect(w9).toBeDefined();
    for (const key of required) {
      expect(typeof w9[key]).toBe('string');
      expect(w9[key].length).toBeGreaterThan(0);
    }
  });

  it('non-English copy is actually translated (not an en duplicate)', () => {
    const read = (lang) => JSON.parse(fs.readFileSync(
      path.join(__dirname, `../../public/locales/${lang}/common.json`), 'utf8'))
      .affiliateRegister.w9;
    const en = read('en');
    for (const lang of ['es', 'pt', 'de']) {
      expect(read(lang).uploadLabel).not.toBe(en.uploadLabel);
    }
  });
});
