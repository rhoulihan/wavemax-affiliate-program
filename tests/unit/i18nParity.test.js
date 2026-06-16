// tests/unit/i18nParity.test.js
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  flattenKeys,
  diffLocales,
  checkEmailTemplates,
  placeholderSet,
  REQUIRED_KEYS,
  REQUIRED_EMAIL_TEMPLATES
} = require('../../scripts/check-i18n-parity');

function writeJson(p, obj) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(obj));
}

describe('check-i18n-parity', () => {
  let tmp;
  beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'i18n-parity-')); });
  afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

  describe('flattenKeys', () => {
    it('flattens nested objects to dot-paths', () => {
      expect(flattenKeys({ a: { b: 'x', c: { d: 'y' } }, e: 'z' }).sort())
        .toEqual(['a.b', 'a.c.d', 'e']);
    });
  });

  describe('diffLocales', () => {
    it('reports keys missing from a non-en locale and extra keys', () => {
      writeJson(path.join(tmp, 'locales/en/common.json'), { a: '1', b: { c: '2' } });
      writeJson(path.join(tmp, 'locales/es/common.json'), { a: '1', b: {}, z: 'extra' });
      writeJson(path.join(tmp, 'locales/pt/common.json'), { a: '1', b: { c: '2' } });
      writeJson(path.join(tmp, 'locales/de/common.json'), { a: '1', b: { c: '2' } });
      const { errors } = diffLocales({
        localesDir: path.join(tmp, 'locales'), requiredKeys: [], requiredPrefixes: []
      });
      expect(errors.some(e => e.includes('es') && e.includes('missing') && e.includes('b.c'))).toBe(true);
      expect(errors.some(e => e.includes('es') && e.includes('extra') && e.includes('z'))).toBe(true);
      expect(errors.some(e => e.includes('pt:'))).toBe(false);
      expect(errors.some(e => e.includes('de:'))).toBe(false);
    });

    it('reports spec-required keys absent from en and empty required prefixes', () => {
      for (const l of ['en', 'es', 'pt', 'de']) {
        writeJson(path.join(tmp, `locales/${l}/common.json`), { present: 'x' });
      }
      const { errors } = diffLocales({
        localesDir: path.join(tmp, 'locales'),
        requiredKeys: ['present', 'claim.title'],
        requiredPrefixes: ['admin.invites']
      });
      expect(errors.some(e => e.includes('required key missing from en: claim.title'))).toBe(true);
      expect(errors.some(e => e.includes('required namespace empty in en: admin.invites'))).toBe(true);
      expect(errors.some(e => e.includes('required key missing from en: present'))).toBe(false);
    });
  });

  describe('checkEmailTemplates', () => {
    it('passes when lang copies exist with identical placeholder sets (en may use the flat default)', () => {
      const emails = path.join(tmp, 'emails');
      fs.mkdirSync(emails, { recursive: true });
      fs.writeFileSync(path.join(emails, 'customer-order-delivered.html'), '<p>[NAME] [AMOUNT]</p>');
      for (const l of ['es', 'pt', 'de']) {
        fs.mkdirSync(path.join(emails, l), { recursive: true });
        fs.writeFileSync(path.join(emails, l, 'customer-order-delivered.html'), '<p>[AMOUNT] y [NAME]</p>');
      }
      expect(checkEmailTemplates({ emailRoot: emails, required: ['customer-order-delivered'] })).toEqual([]);
    });

    it('flags a missing language copy and placeholder drift', () => {
      const emails = path.join(tmp, 'emails');
      fs.mkdirSync(path.join(emails, 'es'), { recursive: true });
      fs.mkdirSync(path.join(emails, 'pt'), { recursive: true });
      fs.writeFileSync(path.join(emails, 'order-ready.html'), '<p>[ORDER_ID]</p>');
      fs.writeFileSync(path.join(emails, 'es', 'order-ready.html'), '<p>[ORDER_ID] [OOPS]</p>');
      fs.writeFileSync(path.join(emails, 'pt', 'order-ready.html'), '<p>[ORDER_ID]</p>');
      const errors = checkEmailTemplates({ emailRoot: emails, required: ['order-ready'] });
      expect(errors.some(e => e.includes('de/order-ready.html') && e.includes('missing'))).toBe(true);
      expect(errors.some(e => e.includes('es/order-ready.html') && e.includes('OOPS'))).toBe(true);
      expect(errors.some(e => e.includes('pt/order-ready.html'))).toBe(false);
    });
  });

  describe('placeholderSet', () => {
    it('extracts [TOKEN]s', () => {
      expect([...placeholderSet('a [FOO] b [BAR_2] c [foo]')].sort())
        .toEqual(['BAR_2', 'FOO', 'foo']);
    });
  });

  describe('spec §10 manifest', () => {
    it('carries the load-bearing inventory entries', () => {
      expect(REQUIRED_KEYS).toContain('claim.title');
      expect(REQUIRED_KEYS).toContain('claim.scan.badCode');
      expect(REQUIRED_KEYS).toContain('operator.intake.error.bagNotActive');
      expect(REQUIRED_KEYS).toContain('order.status.ready_for_pickup');
      expect(REQUIRED_EMAIL_TEMPLATES).toContain('affiliate-invite');
      expect(REQUIRED_EMAIL_TEMPLATES).toContain('customer-order-delivered');
    });
  });
});
