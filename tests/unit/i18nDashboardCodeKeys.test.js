const path = require('path');

const LANGS = ['en', 'es', 'pt', 'de'];
const KEYS = [
  'affiliateDashboard.deliveryCode.title', 'affiliateDashboard.deliveryCode.current',
  'affiliateDashboard.deliveryCode.reset', 'affiliateDashboard.deliveryCode.resetConfirm',
  'affiliateDashboard.deliveryCode.shownOnceNote', 'affiliateDashboard.deliverHelp',
  'customerDashboard.deliveryPin.title', 'customerDashboard.deliveryPin.current',
  'customerDashboard.deliveryPin.reset', 'customerDashboard.deliveryPin.shownOnceNote'
];

function dig(obj, dotted) {
  return dotted.split('.').reduce((o, k) => (o ? o[k] : undefined), obj);
}

describe('dashboard role-code i18n parity', () => {
  for (const lang of LANGS) {
    describe(lang, () => {
      const json = require(path.join(__dirname, `../../public/locales/${lang}/common.json`));
      for (const key of KEYS) {
        test(`has ${key}`, () => {
          expect(typeof dig(json, key)).toBe('string');
        });
      }
    });
  }
});
