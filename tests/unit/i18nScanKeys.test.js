// Phase 1 PR 5 — scan-UI i18n parity (en/es/pt/de) for the new staff-scan and
// kiosk copy.
const path = require('path');

const LANGS = ['en', 'es', 'pt', 'de'];
const KEYS = [
  // staff scan-session panel (claim overload)
  'claim.scan.staffTitle', 'claim.scan.staffIntro', 'claim.scan.codePlaceholder',
  'claim.scan.startSession', 'claim.scan.badCode', 'claim.scan.lockedOut',
  'claim.scan.paymentConfirmed', 'claim.scan.yes', 'claim.scan.no',
  'claim.scan.applied', 'claim.scan.scanNext', 'claim.scan.confirmGeneric',
  'claim.scan.stateChanged', 'claim.scan.undo', 'claim.scan.undone',
  'claim.scan.nothingToUndo', 'claim.scan.sessionActiveUntil',
  'claim.scan.sessionExpired', 'claim.scan.endSession', 'claim.scan.notRegistered',
  'claim.scan.networkError',
  // order-start redesign (no persistent session): customer/staff start prompt + result
  'claim.scan.startAnOrder', 'claim.scan.startBtn', 'claim.scan.cancelBtn',
  'claim.scan.orderReceived', 'claim.scan.alreadyInProgress',
  // kiosk
  'operator.scan.heading', 'operator.scan.subheading', 'operator.scan.tallyLabel',
  'operator.scan.legend.intake', 'operator.scan.legend.outForDelivery',
  'operator.scan.legend.complete', 'operator.scan.paymentConfirmed',
  'operator.scan.yes', 'operator.scan.no', 'operator.scan.undo',
  'operator.scan.applied', 'operator.scan.undone', 'operator.scan.nothingToUndo',
  'operator.scan.stateChanged', 'operator.scan.notRegistered',
  'operator.scan.networkError', 'operator.scan.confirmGeneric',
  'operator.scan.successTitle', 'operator.scan.errorTitle',
  'operator.scan.infoTitle', 'operator.scan.noChange'
];

function dig(obj, dotted) {
  return dotted.split('.').reduce((o, k) => (o ? o[k] : undefined), obj);
}

describe('scan-UI i18n parity', () => {
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
