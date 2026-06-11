const path = require('path');

const LANGS = ['en', 'es', 'pt', 'de'];
const KEYS = [
  'claim.deliver.title', 'claim.deliver.codeLabel', 'claim.deliver.codePlaceholder',
  'claim.deliver.geoOptIn', 'claim.deliver.rememberCode', 'claim.deliver.confirm',
  'claim.deliver.success', 'claim.deliver.badCode', 'claim.deliver.lockedOut',
  'claim.reintake.prompt', 'claim.reintake.confirm',
  'claim.scan.operatorCodeLabel',
  'claim.status.in_progress', 'claim.status.processed', 'claim.status.ready_for_pickup',
  'claim.status.picked_up', 'claim.status.delivered', 'claim.status.loginCta'
];

function dig(obj, dotted) {
  return dotted.split('.').reduce((o, k) => (o ? o[k] : undefined), obj);
}

describe('claim deliver/status/reintake i18n parity', () => {
  for (const lang of LANGS) {
    describe(lang, () => {
      const json = require(path.join(__dirname, `../../public/locales/${lang}/common.json`));
      for (const key of KEYS) {
        test(`has ${key}`, () => {
          expect(typeof dig(json, key)).toBe('string');
          expect(dig(json, key).length).toBeGreaterThan(0);
        });
      }
    });
  }
});
