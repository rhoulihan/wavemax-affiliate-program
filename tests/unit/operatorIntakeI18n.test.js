// operator.intake.* must exist in all four locales (spec §10).
const fs = require('fs');
const path = require('path');

const REQUIRED_KEYS = [
  'operator.intake.title',
  'operator.intake.weightLabel',
  'operator.intake.weightPlaceholder',
  'operator.intake.addOnsHeading',
  'operator.intake.addOns.premiumDetergent',
  'operator.intake.addOns.fabricSoftener',
  'operator.intake.addOns.stainRemover',
  'operator.intake.freshFormAck',
  'operator.intake.submit',
  'operator.intake.cancel',
  'operator.intake.created',
  'operator.intake.processedScan',
  'operator.intake.alreadyProcessed',
  'operator.intake.reintakePrompt',
  'operator.intake.reintakeConfirm',
  'operator.intake.error.bagNotActive',
  'operator.intake.error.orderAlreadyOpen',
  'operator.intake.error.bagNotFound'
];

function dig(obj, dotted) {
  return dotted.split('.').reduce((o, k) => (o ? o[k] : undefined), obj);
}

describe.each(['en', 'es', 'pt', 'de'])('locale %s', (lang) => {
  const file = path.join(__dirname, `../../public/locales/${lang}/common.json`);
  const json = JSON.parse(fs.readFileSync(file, 'utf8'));

  it.each(REQUIRED_KEYS)('has %s', (key) => {
    const value = dig(json, key);
    expect(typeof value).toBe('string');
    expect(value.length).toBeGreaterThan(0);
  });
});
