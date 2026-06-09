# PR 11 — i18n Completion + Lighthouse Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close out the redesign by proving (script-enforced) that every spec §10 i18n key and email template ships in all four languages, measuring the new public claim page to ~100 in all four Lighthouse categories on mobile + desktop, and updating the two CLAUDE.md docs so the handbook stops describing removed V1/scheduling flows as live.

**Architecture:** A new `scripts/check-i18n-parity.js` (unit-tested, wired as `npm run check:i18n`) diffs the flattened key sets of `public/locales/{en,es,pt,de}/common.json`, asserts the spec §10 required-key inventory, and verifies email-template language parity (file presence + `[PLACEHOLDER]` token-set equality) under `server/templates/emails/`. Audit-driven fill tasks then make it exit 0. The dispatcher emails still inline-English after PRs 1–10 (`sendV2PaymentReminder` direct-path read, `sendOrderReadyNotification` inline HTML) are migrated to the existing `template-manager.loadTemplate(name, language)` resolution with 4-language template files; the dead pre-redesign `sendOrderPickedUpNotification` (orphaned by PR 9, which shipped the localized `sendOrderOnTheWayEmail` replacement) is deleted. Lighthouse runs against a locally seeded claim URL with the quality-bar doc's exact command shape.

**Tech Stack:** Node (CommonJS), Jest (+ `tests/setup.js` MongoMemoryServer harness), `npx lighthouse` with headless Chrome, `npx madge`. No new npm dependencies.

**Assumed starting state:** Redesign PRs 1–10 are merged. That means: V1 Paygistix / scheduling / Pickup Now / BetaRequest / `?affid` are gone (PRs 1–2); the new SystemConfig keys exist (PR 3); `server/modules/orders/orderStateMachine.js` + `server/services/orderReadyGateService.js` exist (PR 4/8); `server/modules/onboarding/` invites (PR 5); `server/modules/bags/` + `public/claim-embed.html` + `public/assets/js/claim.js` + `/claim` registered in `EMBED_PAGES`/`pageScripts`/`excludedRoutes` (PR 6); `orderIntakeService`/`orderAdvanceService` + kiosk/bag-URL endpoints + role codes (PRs 7/9); W-9 upload/`secureFileStore` (PR 10). Each of those PRs shipped its own i18n keys in-commit per house rule — **this PR audits and fills the drift; it does not re-create those features.** The full test suite is green on `main` before starting.

**Grounding notes (verified on current tree, 2026-06-09):**
- Locale files: `public/locales/{en,es,pt,de}/common.json` all exist; drift is real (e.g. `de` is missing `common.buttons.refresh`, `common.buttons.applyFilters`, `common.buttons.clearFilters` that `en` has).
- Email templates: language resolution already exists in `server/services/email/template-manager.js` — `loadTemplate(templateName, language)` tries `server/templates/emails/{language}/{templateName}.html`, then falls back to the flat default `server/templates/emails/{templateName}.html`, then a hardcoded `FALLBACK_TEMPLATE`. Today only `en/affiliate-welcome.html` exists as a language copy; **there are no `es/`, `pt/`, or `de/` directories at all.**
- `server/services/email/dispatcher/payment.js` loads `v2/payment-request` via `loadTemplate` (line 21) but reads `v2/payment-reminder` via a **broken direct path** (`path.join(__dirname, '../templates/emails/v2/payment-reminder.html')` resolves to `server/services/email/templates/emails/...`, which does not exist — verified). PR 8 retuned this function; re-locate before editing.
- `server/services/email/dispatcher/ops.js` `sendOrderReadyNotification` (line 73) and `sendOrderPickedUpNotification` (line 115) build inline English-only HTML on main; `ops.js` already imports `loadTemplate`/`fillTemplate` (line 4). **Post-PR 9:** `sendOrderPickedUpNotification` is DEAD CODE (its sole caller, `operatorPickupService`, is deleted by PR 9 Task 7) and the scan-out path uses PR 9's already-localized `sendOrderOnTheWayEmail` + `customer-on-the-way` templates (lowercase `[delivery_pin]`-style tokens) — Task 4 deletes the dead export and only localizes `order-ready`.
- `public/embed-app-v2.html` (the document Lighthouse measures for `?route=/claim`) has **no meta description** (head is lines 1–32).
- `madge` is not a devDependency — use `npx --yes madge`.
- `jest.config.js` has `clearMocks/resetMocks/restoreMocks: true` — define mock return values inside the `jest.mock` factory, not via `mockResolvedValue` at module scope.

---

## Task 1: i18n parity checker (`scripts/check-i18n-parity.js`)

**Files:**
- Create: `tests/unit/i18nParity.test.js`
- Create: `scripts/check-i18n-parity.js`
- Modify: `package.json` (add `check:i18n` script, line 27 area in `"scripts"`)

The checker is a module (testable pure functions) with a CLI entry. **Errors** (exit 1): locale key drift vs `en`, spec §10 required keys missing from `en`, required email templates missing a language copy, placeholder-token drift in a translated template. **Warnings** (exit 0): live `loadTemplate(...)` template names outside the required set that lack language copies (legacy backlog), non-literal `loadTemplate` first arguments.

- [ ] **Step 1: Write the failing test**

```js
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
      fs.mkdirSync(path.join(emails, 'v2'), { recursive: true });
      fs.writeFileSync(path.join(emails, 'v2', 'payment-request.html'), '<p>[NAME] [AMOUNT]</p>');
      for (const l of ['es', 'pt', 'de']) {
        fs.mkdirSync(path.join(emails, l, 'v2'), { recursive: true });
        fs.writeFileSync(path.join(emails, l, 'v2', 'payment-request.html'), '<p>[AMOUNT] y [NAME]</p>');
      }
      expect(checkEmailTemplates({ emailRoot: emails, required: ['v2/payment-request'] })).toEqual([]);
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
      expect(REQUIRED_KEYS).toContain('claim.deliver.badCode');
      expect(REQUIRED_KEYS).toContain('operator.intake.error.bagNotActive');
      expect(REQUIRED_KEYS).toContain('order.status.ready_for_pickup');
      expect(REQUIRED_EMAIL_TEMPLATES).toContain('affiliate-invite');
      expect(REQUIRED_EMAIL_TEMPLATES).toContain('v2/come-to-store');
    });
  });
});
```

- [ ] **Step 2: Run it — expect failure for the right reason**

Run: `npm test -- tests/unit/i18nParity.test.js`
Expected: FAIL — `Cannot find module '../../scripts/check-i18n-parity'`.

- [ ] **Step 3: Implement the checker**

```js
#!/usr/bin/env node
// scripts/check-i18n-parity.js
//
// i18n parity checker for the invite/bag/intake redesign (spec §10 — PR 11).
//
// ERRORS (exit 1):
//   1. any locale (es/pt/de) missing a key that en/common.json has, or carrying
//      an extra key en does not have;
//   2. any REQUIRED_KEYS entry (spec §10 client-UI inventory) missing from en;
//   3. any REQUIRED_PREFIXES namespace with zero keys in en;
//   4. any REQUIRED_EMAIL_TEMPLATES entry missing a language copy under
//      server/templates/emails/{lang}/ (en may satisfy via the flat default —
//      mirrors template-manager.loadTemplate fallback);
//   5. a translated template whose [PLACEHOLDER] token set differs from en's.
//
// WARNINGS (exit 0): legacy loadTemplate() call-site templates outside the
// required set that lack language copies; non-literal loadTemplate arguments.
//
// Usage: npm run check:i18n   (or: node scripts/check-i18n-parity.js)
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const LANGS = ['en', 'es', 'pt', 'de'];
const DEFAULT_LOCALES_DIR = path.join(ROOT, 'public', 'locales');
const DEFAULT_EMAIL_ROOT = path.join(ROOT, 'server', 'templates', 'emails');
const DEFAULT_DISPATCHER_DIR = path.join(ROOT, 'server', 'services', 'email');

// --- Spec §10 client-UI inventory (exact keys; en is the source of truth) ---
const REQUIRED_KEYS = [
  'claim.title', 'claim.subtitle', 'claim.cta', 'claim.ctaOAuthGoogle', 'claim.ctaOAuthFacebook',
  'claim.alreadyClaimedTitle', 'claim.alreadyClaimedBody', 'claim.alreadyClaimedCta',
  'claim.invalidTitle', 'claim.invalidBody', 'claim.raceLost', 'claim.resolving',
  'claim.deliver.title', 'claim.deliver.codeLabel', 'claim.deliver.codePlaceholder',
  'claim.deliver.geoOptIn', 'claim.deliver.rememberCode', 'claim.deliver.confirm',
  'claim.deliver.success', 'claim.deliver.badCode', 'claim.deliver.lockedOut',
  'claim.reintake.prompt', 'claim.reintake.confirm',
  'claim.scan.operatorCodeLabel',
  'claim.status.in_progress', 'claim.status.processed', 'claim.status.ready_for_pickup',
  'claim.status.picked_up', 'claim.status.delivered', 'claim.status.loginCta',
  'bag.label.affiliateHeading', 'bag.label.bagRef', 'bag.label.printInstructions',
  'admin.bags.mint.title', 'admin.bags.mint.affiliate', 'admin.bags.mint.quantity',
  'admin.bags.mint.submit', 'admin.bags.mint.success', 'admin.bags.issue.confirm',
  'admin.bags.inventory.status.minted', 'admin.bags.inventory.status.issued',
  'admin.bags.inventory.status.active', 'admin.bags.inventory.status.retired',
  'affiliate.bags.inventory.title', 'affiliate.bags.inventory.empty',
  'affiliateRegister.invite.invalidOrExpired', 'affiliateRegister.invite.emailLocked',
  'affiliateRegister.w9.uploadLabel', 'affiliateRegister.w9.fileTypeHint',
  'affiliateRegister.w9.tooLarge', 'affiliateRegister.w9.wrongType', 'affiliateRegister.w9.optionalNote',
  'operator.intake.weightLabel', 'operator.intake.addOns.premiumDetergent',
  'operator.intake.addOns.fabricSoftener', 'operator.intake.addOns.stainRemover',
  'operator.intake.freshFormAck', 'operator.intake.created',
  'operator.intake.error.bagNotActive', 'operator.intake.error.orderAlreadyOpen',
  'operator.intake.error.bagNotFound',
  'affiliateDashboard.deliveryCode.title', 'affiliateDashboard.deliveryCode.current',
  'affiliateDashboard.deliveryCode.reset', 'affiliateDashboard.deliveryCode.resetConfirm',
  'affiliateDashboard.deliveryCode.shownOnceNote', 'affiliateDashboard.deliverHelp',
  'customerDashboard.deliveryPin.title', 'customerDashboard.deliveryPin.current',
  'customerDashboard.deliveryPin.reset', 'customerDashboard.deliveryPin.shownOnceNote',
  'admin.operators.scanCode.reset', 'admin.operators.scanCode.shownOnceNote',
  'email.onTheWay.deliveryPinNote',
  'order.status.in_progress', 'order.status.processed', 'order.status.ready_for_pickup',
  'order.status.picked_up', 'order.status.delivered', 'order.status.cancelled'
];

// Namespaces whose leaf names are owned by earlier PRs (5 = invites, 10 = W-9
// admin UI) — at least one key must exist under each prefix in en.
const REQUIRED_PREFIXES = ['admin.invites', 'admin.w9'];

// Spec §10 email templates that must resolve in all four languages via
// template-manager.loadTemplate(name, lang). Names are loadTemplate names (no
// .html). If an earlier PR shipped one of these under a different name, align
// THIS list with the shipped name (grep the dispatchers) — never ship two
// templates for one email.
const REQUIRED_EMAIL_TEMPLATES = [
  'affiliate-invite',
  'affiliate-w9-status',
  'v2/payment-request',
  'v2/payment-reminder',
  'v2/come-to-store',
  'customer-order-delivered',
  'order-ready',
  'customer-on-the-way'
];

function flattenKeys(obj, prefix = '', out = []) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) flattenKeys(v, key, out);
    else out.push(key);
  }
  return out;
}

function loadLocale(localesDir, lang) {
  return JSON.parse(fs.readFileSync(path.join(localesDir, lang, 'common.json'), 'utf8'));
}

function diffLocales({
  localesDir = DEFAULT_LOCALES_DIR,
  requiredKeys = REQUIRED_KEYS,
  requiredPrefixes = REQUIRED_PREFIXES
} = {}) {
  const errors = [];
  const en = new Set(flattenKeys(loadLocale(localesDir, 'en')));

  for (const key of requiredKeys) {
    if (!en.has(key)) errors.push(`required key missing from en: ${key}`);
  }
  for (const prefix of requiredPrefixes) {
    if (![...en].some(k => k.startsWith(prefix + '.'))) {
      errors.push(`required namespace empty in en: ${prefix}.*`);
    }
  }
  for (const lang of LANGS.filter(l => l !== 'en')) {
    const keys = new Set(flattenKeys(loadLocale(localesDir, lang)));
    for (const k of en) if (!keys.has(k)) errors.push(`${lang}: missing key (in en, not in ${lang}): ${k}`);
    for (const k of keys) if (!en.has(k)) errors.push(`${lang}: extra key (not in en): ${k}`);
  }
  return { errors, enKeyCount: en.size };
}

function emailTemplatePath(emailRoot, name, lang) {
  const langPath = path.join(emailRoot, lang, `${name}.html`);
  if (fs.existsSync(langPath)) return langPath;
  if (lang === 'en') {
    const flat = path.join(emailRoot, `${name}.html`);
    if (fs.existsSync(flat)) return flat; // loadTemplate's flat-default fallback
  }
  return null;
}

function placeholderSet(html) {
  return new Set([...html.matchAll(/\[([A-Za-z0-9_]+)\]/g)].map(m => m[1]));
}

function checkEmailTemplates({ emailRoot = DEFAULT_EMAIL_ROOT, required = REQUIRED_EMAIL_TEMPLATES } = {}) {
  const errors = [];
  for (const name of required) {
    const enPath = emailTemplatePath(emailRoot, name, 'en');
    if (!enPath) { errors.push(`email template missing entirely (no en or flat default): ${name}`); continue; }
    const enTokens = placeholderSet(fs.readFileSync(enPath, 'utf8'));
    for (const lang of LANGS.filter(l => l !== 'en')) {
      const p = emailTemplatePath(emailRoot, name, lang);
      if (!p) { errors.push(`email template missing: ${lang}/${name}.html`); continue; }
      const tokens = placeholderSet(fs.readFileSync(p, 'utf8'));
      const missing = [...enTokens].filter(t => !tokens.has(t));
      const extra = [...tokens].filter(t => !enTokens.has(t));
      if (missing.length || extra.length) {
        errors.push(`placeholder drift in ${lang}/${name}.html — missing: [${missing.join(', ')}] extra: [${extra.join(', ')}]`);
      }
    }
  }
  return errors;
}

function walkJs(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walkJs(p, out);
    else if (entry.name.endsWith('.js') && entry.name !== 'template-manager.js') out.push(p);
  }
  return out;
}

function scrapeLiveTemplateNames({ dispatcherDir = DEFAULT_DISPATCHER_DIR } = {}) {
  const names = new Set();
  const warnings = [];
  for (const file of walkJs(dispatcherDir)) {
    const src = fs.readFileSync(file, 'utf8');
    for (const m of src.matchAll(/loadTemplate\(\s*['"`]([^'"`]+)['"`]/g)) names.add(m[1]);
    if (/loadTemplate\(\s*[^'"`)\s]/.test(src)) {
      warnings.push(`non-literal loadTemplate() argument in ${path.relative(ROOT, file)} — verify its template parity by hand`);
    }
  }
  return { names, warnings };
}

function run() {
  const errors = [];
  const warnings = [];

  const locale = diffLocales({});
  errors.push(...locale.errors);

  errors.push(...checkEmailTemplates({}));

  const live = scrapeLiveTemplateNames({});
  warnings.push(...live.warnings);
  for (const name of live.names) {
    if (REQUIRED_EMAIL_TEMPLATES.includes(name)) continue;
    for (const lang of LANGS.filter(l => l !== 'en')) {
      if (!emailTemplatePath(DEFAULT_EMAIL_ROOT, name, lang)) {
        warnings.push(`legacy template not language-resolved for ${lang}: ${name} (backlog, non-blocking)`);
      }
    }
  }

  return { errors, warnings, enKeyCount: locale.enKeyCount };
}

module.exports = {
  flattenKeys, diffLocales, checkEmailTemplates, placeholderSet,
  scrapeLiveTemplateNames, run,
  REQUIRED_KEYS, REQUIRED_PREFIXES, REQUIRED_EMAIL_TEMPLATES, LANGS
};

if (require.main === module) {
  const { errors, warnings, enKeyCount } = run();
  console.log(`i18n parity check — en key count: ${enKeyCount}`);
  for (const w of warnings) console.log(`  WARN  ${w}`);
  for (const e of errors) console.log(`  ERROR ${e}`);
  console.log(errors.length
    ? `FAILED: ${errors.length} error(s), ${warnings.length} warning(s)`
    : `OK: 0 errors, ${warnings.length} warning(s)`);
  process.exit(errors.length ? 1 : 0);
}
```

- [ ] **Step 4: Run the test — expect pass**

Run: `npm test -- tests/unit/i18nParity.test.js`
Expected: PASS (8 tests).

- [ ] **Step 5: Wire the npm script**

In `package.json`, inside `"scripts"`, after `"build:explorer": "node design-explorer/build.js"` (line 27), add:

```json
    "build:explorer": "node design-explorer/build.js",
    "check:i18n": "node scripts/check-i18n-parity.js"
```

(i.e. add a comma after the `build:explorer` line and the new `check:i18n` line below it.)

- [ ] **Step 6: Lint + commit**

Run: `npm run lint` — expect clean (`scripts/` is outside the `server/` no-console rule; `build-assets.js` is precedent).

```bash
git add scripts/check-i18n-parity.js tests/unit/i18nParity.test.js package.json
git commit -m "feat(i18n): add script-assisted locale + email-template parity checker (spec §10)"
```

---

## Task 2: Locale audit — fill every missing key in en/es/pt/de

**Files:**
- Modify: `public/locales/en/common.json`
- Modify: `public/locales/es/common.json`
- Modify: `public/locales/pt/common.json`
- Modify: `public/locales/de/common.json`
- Modify: `public/assets/js/i18n.js` (line 3 — stale comment, one-line accuracy fix)

This task is audit-driven: the checker's output is the worklist. The reference translation tables below carry the **complete spec §10 inventory in all four languages** — when the checker reports a §10 key missing, take its value verbatim from these tables.

- [ ] **Step 1: Run the audit (this is the failing "test" for this task)**

Run: `npm run check:i18n`
Expected: exit 1 with `ERROR` lines. Save the output:

```bash
npm run check:i18n | tee /tmp/i18n-audit-before.txt
```

Three classes of error will appear:
1. `required key missing from en: …` — a §10 key an earlier PR missed → add it to **all four** files from the tables below.
2. `<lang>: missing key (in en, not in <lang>): …` — translation drift → add the translation. For §10 keys use the tables below; for legacy keys (e.g. the known `de` gaps `common.buttons.refresh` / `applyFilters` / `clearFilters`) translate the en value (see Step 3).
3. `<lang>: extra key (not in en): …` — orphan → if `grep -rn "<key>" public/ server/` shows no consumer, delete it from that locale; if it has a consumer, the en key is missing — add the en (and other-language) values instead.

- [ ] **Step 2: Merge the §10 reference blocks (deep-merge by hand — never overwrite an existing namespace)**

The four blocks below are the spec §10 inventory. **Deep-merge** each into the corresponding `common.json`: if a namespace (e.g. `admin`, `order`, `affiliate`) already exists, add only the missing sub-keys inside it; if PRs 5–10 already shipped a key with the same name, keep the shipped value (it was reviewed in-context) and skip the reference value. Do NOT rename shipped keys to match — the names below ARE the canon names all PR plans were given, so a mismatch means the key is missing, not renamed.

**`public/locales/en/common.json`:**

```json
{
  "claim": {
    "title": "Claim your bag",
    "subtitle": "You're signing up with {{affiliateName}} for wash, dry, fold service.",
    "cta": "Create my account",
    "ctaOAuthGoogle": "Continue with Google",
    "ctaOAuthFacebook": "Continue with Facebook",
    "alreadyClaimedTitle": "This bag is already claimed",
    "alreadyClaimedBody": "This bag belongs to an existing account. Log in to see your order status.",
    "alreadyClaimedCta": "Log in",
    "invalidTitle": "Bag not recognized",
    "invalidBody": "We couldn't find this bag. Check with your laundry provider.",
    "raceLost": "Someone just claimed this bag. If that wasn't you, please log in or contact support.",
    "resolving": "Checking your bag…",
    "deliver": {
      "title": "Confirm delivery",
      "codeLabel": "Delivery code",
      "codePlaceholder": "Enter your code",
      "geoOptIn": "Use my location",
      "rememberCode": "Remember my code on this device",
      "confirm": "Confirm delivery",
      "success": "Delivery confirmed. Thank you!",
      "badCode": "That code is not valid for this order.",
      "lockedOut": "Too many attempts. Please try again later."
    },
    "reintake": {
      "prompt": "Mark delivered & start a new order?",
      "confirm": "Yes, start a new order"
    },
    "scan": { "operatorCodeLabel": "Operator code" },
    "status": {
      "in_progress": "In progress",
      "processed": "Processed",
      "ready_for_pickup": "Ready for pickup",
      "picked_up": "Out for delivery",
      "delivered": "Delivered",
      "loginCta": "Log in to see details"
    }
  },
  "bag": {
    "label": {
      "affiliateHeading": "Laundry service by",
      "bagRef": "Bag ref",
      "printInstructions": "Print at 100% scale. One label per bag tag sleeve."
    }
  },
  "admin": {
    "bags": {
      "mint": {
        "title": "Mint bags",
        "affiliate": "Affiliate",
        "quantity": "Quantity",
        "submit": "Mint batch",
        "success": "Batch minted"
      },
      "issue": { "confirm": "Issue this batch to the affiliate?" },
      "inventory": {
        "status": { "minted": "Minted", "issued": "Issued", "active": "Active", "retired": "Retired" }
      }
    },
    "operators": {
      "scanCode": {
        "reset": "Reset scan code",
        "shownOnceNote": "Shown once — store it somewhere safe."
      }
    }
  },
  "affiliate": {
    "bags": { "inventory": { "title": "My bags", "empty": "No bags yet" } }
  },
  "affiliateRegister": {
    "invite": {
      "invalidOrExpired": "This invite link is invalid or has expired.",
      "emailLocked": "Your email is set by your invitation and cannot be changed."
    },
    "w9": {
      "uploadLabel": "Upload your completed W-9",
      "fileTypeHint": "PDF, JPG, or PNG, max {{max}} MB",
      "tooLarge": "File is too large.",
      "wrongType": "File type not allowed.",
      "optionalNote": "You can also upload your W-9 later from your dashboard."
    }
  },
  "operator": {
    "intake": {
      "weightLabel": "Weight (lbs)",
      "addOns": {
        "premiumDetergent": "Premium detergent",
        "fabricSoftener": "Fabric softener",
        "stainRemover": "Stain remover"
      },
      "freshFormAck": "A fresh add-ons form is in the bag pocket",
      "created": "Order created",
      "error": {
        "bagNotActive": "This bag is not active.",
        "orderAlreadyOpen": "This bag already has an open order.",
        "bagNotFound": "Bag not found."
      }
    }
  },
  "affiliateDashboard": {
    "deliveryCode": {
      "title": "Delivery code",
      "current": "Your delivery code",
      "reset": "Reset code",
      "resetConfirm": "Reset your delivery code? The old code stops working immediately.",
      "shownOnceNote": "Shown once — store it somewhere safe."
    },
    "deliverHelp": "To deliver or check a bag, scan the bag's QR code with your phone camera."
  },
  "customerDashboard": {
    "deliveryPin": {
      "title": "Delivery PIN",
      "current": "Your delivery PIN",
      "reset": "Reset PIN",
      "shownOnceNote": "Shown once — store it somewhere safe."
    }
  },
  "email": {
    "onTheWay": {
      "deliveryPinNote": "Use your delivery PIN {{pin}} to confirm receipt at your door."
    }
  },
  "order": {
    "status": {
      "in_progress": "In progress",
      "processed": "Processed",
      "ready_for_pickup": "Ready for pickup",
      "picked_up": "Out for delivery",
      "delivered": "Delivered",
      "cancelled": "Cancelled"
    }
  }
}
```

**`public/locales/es/common.json`:**

```json
{
  "claim": {
    "title": "Reclama tu bolsa",
    "subtitle": "Te estás registrando con {{affiliateName}} para el servicio de lavado, secado y doblado.",
    "cta": "Crear mi cuenta",
    "ctaOAuthGoogle": "Continuar con Google",
    "ctaOAuthFacebook": "Continuar con Facebook",
    "alreadyClaimedTitle": "Esta bolsa ya está reclamada",
    "alreadyClaimedBody": "Esta bolsa pertenece a una cuenta existente. Inicia sesión para ver el estado de tu pedido.",
    "alreadyClaimedCta": "Iniciar sesión",
    "invalidTitle": "Bolsa no reconocida",
    "invalidBody": "No pudimos encontrar esta bolsa. Consulta con tu proveedor de lavandería.",
    "raceLost": "Alguien acaba de reclamar esta bolsa. Si no fuiste tú, inicia sesión o contacta con soporte.",
    "resolving": "Verificando tu bolsa…",
    "deliver": {
      "title": "Confirmar entrega",
      "codeLabel": "Código de entrega",
      "codePlaceholder": "Introduce tu código",
      "geoOptIn": "Usar mi ubicación",
      "rememberCode": "Recordar mi código en este dispositivo",
      "confirm": "Confirmar entrega",
      "success": "Entrega confirmada. ¡Gracias!",
      "badCode": "Ese código no es válido para este pedido.",
      "lockedOut": "Demasiados intentos. Inténtalo de nuevo más tarde."
    },
    "reintake": {
      "prompt": "¿Marcar como entregado y empezar un nuevo pedido?",
      "confirm": "Sí, empezar un nuevo pedido"
    },
    "scan": { "operatorCodeLabel": "Código de operador" },
    "status": {
      "in_progress": "En proceso",
      "processed": "Procesado",
      "ready_for_pickup": "Listo para recoger",
      "picked_up": "En reparto",
      "delivered": "Entregado",
      "loginCta": "Inicia sesión para ver los detalles"
    }
  },
  "bag": {
    "label": {
      "affiliateHeading": "Servicio de lavandería de",
      "bagRef": "Ref. de bolsa",
      "printInstructions": "Imprime al 100 % de escala. Una etiqueta por funda de bolsa."
    }
  },
  "admin": {
    "bags": {
      "mint": {
        "title": "Crear bolsas",
        "affiliate": "Afiliado",
        "quantity": "Cantidad",
        "submit": "Crear lote",
        "success": "Lote creado"
      },
      "issue": { "confirm": "¿Entregar este lote al afiliado?" },
      "inventory": {
        "status": { "minted": "Creada", "issued": "Entregada", "active": "Activa", "retired": "Retirada" }
      }
    },
    "operators": {
      "scanCode": {
        "reset": "Restablecer código de escaneo",
        "shownOnceNote": "Se muestra una sola vez — guárdalo en un lugar seguro."
      }
    }
  },
  "affiliate": {
    "bags": { "inventory": { "title": "Mis bolsas", "empty": "Aún no hay bolsas" } }
  },
  "affiliateRegister": {
    "invite": {
      "invalidOrExpired": "Este enlace de invitación no es válido o ha caducado.",
      "emailLocked": "Tu correo electrónico lo establece la invitación y no se puede cambiar."
    },
    "w9": {
      "uploadLabel": "Sube tu W-9 completado",
      "fileTypeHint": "PDF, JPG o PNG, máx. {{max}} MB",
      "tooLarge": "El archivo es demasiado grande.",
      "wrongType": "Tipo de archivo no permitido.",
      "optionalNote": "También puedes subir tu W-9 más tarde desde tu panel."
    }
  },
  "operator": {
    "intake": {
      "weightLabel": "Peso (lbs)",
      "addOns": {
        "premiumDetergent": "Detergente premium",
        "fabricSoftener": "Suavizante",
        "stainRemover": "Quitamanchas"
      },
      "freshFormAck": "Hay un formulario de extras nuevo en el bolsillo de la bolsa",
      "created": "Pedido creado",
      "error": {
        "bagNotActive": "Esta bolsa no está activa.",
        "orderAlreadyOpen": "Esta bolsa ya tiene un pedido abierto.",
        "bagNotFound": "Bolsa no encontrada."
      }
    }
  },
  "affiliateDashboard": {
    "deliveryCode": {
      "title": "Código de entrega",
      "current": "Tu código de entrega",
      "reset": "Restablecer código",
      "resetConfirm": "¿Restablecer tu código de entrega? El código anterior dejará de funcionar de inmediato.",
      "shownOnceNote": "Se muestra una sola vez — guárdalo en un lugar seguro."
    },
    "deliverHelp": "Para entregar o consultar una bolsa, escanea el código QR de la bolsa con la cámara de tu teléfono."
  },
  "customerDashboard": {
    "deliveryPin": {
      "title": "PIN de entrega",
      "current": "Tu PIN de entrega",
      "reset": "Restablecer PIN",
      "shownOnceNote": "Se muestra una sola vez — guárdalo en un lugar seguro."
    }
  },
  "email": {
    "onTheWay": {
      "deliveryPinNote": "Usa tu PIN de entrega {{pin}} para confirmar la recepción en tu puerta."
    }
  },
  "order": {
    "status": {
      "in_progress": "En proceso",
      "processed": "Procesado",
      "ready_for_pickup": "Listo para recoger",
      "picked_up": "En reparto",
      "delivered": "Entregado",
      "cancelled": "Cancelado"
    }
  }
}
```

**`public/locales/pt/common.json`:**

```json
{
  "claim": {
    "title": "Reivindique sua sacola",
    "subtitle": "Você está se cadastrando com {{affiliateName}} para o serviço de lavar, secar e dobrar.",
    "cta": "Criar minha conta",
    "ctaOAuthGoogle": "Continuar com o Google",
    "ctaOAuthFacebook": "Continuar com o Facebook",
    "alreadyClaimedTitle": "Esta sacola já foi reivindicada",
    "alreadyClaimedBody": "Esta sacola pertence a uma conta existente. Faça login para ver o status do seu pedido.",
    "alreadyClaimedCta": "Fazer login",
    "invalidTitle": "Sacola não reconhecida",
    "invalidBody": "Não encontramos esta sacola. Verifique com seu provedor de lavanderia.",
    "raceLost": "Alguém acabou de reivindicar esta sacola. Se não foi você, faça login ou contate o suporte.",
    "resolving": "Verificando sua sacola…",
    "deliver": {
      "title": "Confirmar entrega",
      "codeLabel": "Código de entrega",
      "codePlaceholder": "Digite seu código",
      "geoOptIn": "Usar minha localização",
      "rememberCode": "Lembrar meu código neste dispositivo",
      "confirm": "Confirmar entrega",
      "success": "Entrega confirmada. Obrigado!",
      "badCode": "Esse código não é válido para este pedido.",
      "lockedOut": "Muitas tentativas. Tente novamente mais tarde."
    },
    "reintake": {
      "prompt": "Marcar como entregue e iniciar um novo pedido?",
      "confirm": "Sim, iniciar um novo pedido"
    },
    "scan": { "operatorCodeLabel": "Código do operador" },
    "status": {
      "in_progress": "Em andamento",
      "processed": "Processado",
      "ready_for_pickup": "Pronto para retirada",
      "picked_up": "Saiu para entrega",
      "delivered": "Entregue",
      "loginCta": "Faça login para ver os detalhes"
    }
  },
  "bag": {
    "label": {
      "affiliateHeading": "Serviço de lavanderia de",
      "bagRef": "Ref. da sacola",
      "printInstructions": "Imprima em escala de 100%. Uma etiqueta por sacola."
    }
  },
  "admin": {
    "bags": {
      "mint": {
        "title": "Criar sacolas",
        "affiliate": "Afiliado",
        "quantity": "Quantidade",
        "submit": "Criar lote",
        "success": "Lote criado"
      },
      "issue": { "confirm": "Entregar este lote ao afiliado?" },
      "inventory": {
        "status": { "minted": "Criada", "issued": "Emitida", "active": "Ativa", "retired": "Desativada" }
      }
    },
    "operators": {
      "scanCode": {
        "reset": "Redefinir código de escaneamento",
        "shownOnceNote": "Exibido uma única vez — guarde em um local seguro."
      }
    }
  },
  "affiliate": {
    "bags": { "inventory": { "title": "Minhas sacolas", "empty": "Nenhuma sacola ainda" } }
  },
  "affiliateRegister": {
    "invite": {
      "invalidOrExpired": "Este link de convite é inválido ou expirou.",
      "emailLocked": "Seu e-mail é definido pelo convite e não pode ser alterado."
    },
    "w9": {
      "uploadLabel": "Envie seu W-9 preenchido",
      "fileTypeHint": "PDF, JPG ou PNG, máx. {{max}} MB",
      "tooLarge": "O arquivo é muito grande.",
      "wrongType": "Tipo de arquivo não permitido.",
      "optionalNote": "Você também pode enviar seu W-9 mais tarde no seu painel."
    }
  },
  "operator": {
    "intake": {
      "weightLabel": "Peso (lbs)",
      "addOns": {
        "premiumDetergent": "Detergente premium",
        "fabricSoftener": "Amaciante",
        "stainRemover": "Removedor de manchas"
      },
      "freshFormAck": "Um novo formulário de adicionais está no bolso da sacola",
      "created": "Pedido criado",
      "error": {
        "bagNotActive": "Esta sacola não está ativa.",
        "orderAlreadyOpen": "Esta sacola já tem um pedido aberto.",
        "bagNotFound": "Sacola não encontrada."
      }
    }
  },
  "affiliateDashboard": {
    "deliveryCode": {
      "title": "Código de entrega",
      "current": "Seu código de entrega",
      "reset": "Redefinir código",
      "resetConfirm": "Redefinir seu código de entrega? O código antigo deixa de funcionar imediatamente.",
      "shownOnceNote": "Exibido uma única vez — guarde em um local seguro."
    },
    "deliverHelp": "Para entregar ou consultar uma sacola, escaneie o código QR da sacola com a câmera do seu celular."
  },
  "customerDashboard": {
    "deliveryPin": {
      "title": "PIN de entrega",
      "current": "Seu PIN de entrega",
      "reset": "Redefinir PIN",
      "shownOnceNote": "Exibido uma única vez — guarde em um local seguro."
    }
  },
  "email": {
    "onTheWay": {
      "deliveryPinNote": "Use seu PIN de entrega {{pin}} para confirmar o recebimento na sua porta."
    }
  },
  "order": {
    "status": {
      "in_progress": "Em andamento",
      "processed": "Processado",
      "ready_for_pickup": "Pronto para retirada",
      "picked_up": "Saiu para entrega",
      "delivered": "Entregue",
      "cancelled": "Cancelado"
    }
  }
}
```

**`public/locales/de/common.json`:**

```json
{
  "claim": {
    "title": "Beutel registrieren",
    "subtitle": "Sie melden sich bei {{affiliateName}} für den Wasch-, Trocken- und Faltservice an.",
    "cta": "Konto erstellen",
    "ctaOAuthGoogle": "Mit Google fortfahren",
    "ctaOAuthFacebook": "Mit Facebook fortfahren",
    "alreadyClaimedTitle": "Dieser Beutel ist bereits registriert",
    "alreadyClaimedBody": "Dieser Beutel gehört zu einem bestehenden Konto. Melden Sie sich an, um Ihren Bestellstatus zu sehen.",
    "alreadyClaimedCta": "Anmelden",
    "invalidTitle": "Beutel nicht erkannt",
    "invalidBody": "Wir konnten diesen Beutel nicht finden. Wenden Sie sich an Ihren Wäschedienst.",
    "raceLost": "Jemand hat diesen Beutel gerade registriert. Falls Sie das nicht waren, melden Sie sich an oder kontaktieren Sie den Support.",
    "resolving": "Beutel wird überprüft…",
    "deliver": {
      "title": "Lieferung bestätigen",
      "codeLabel": "Liefercode",
      "codePlaceholder": "Code eingeben",
      "geoOptIn": "Meinen Standort verwenden",
      "rememberCode": "Code auf diesem Gerät merken",
      "confirm": "Lieferung bestätigen",
      "success": "Lieferung bestätigt. Vielen Dank!",
      "badCode": "Dieser Code ist für diese Bestellung nicht gültig.",
      "lockedOut": "Zu viele Versuche. Bitte versuchen Sie es später erneut."
    },
    "reintake": {
      "prompt": "Als geliefert markieren und neue Bestellung starten?",
      "confirm": "Ja, neue Bestellung starten"
    },
    "scan": { "operatorCodeLabel": "Mitarbeitercode" },
    "status": {
      "in_progress": "In Bearbeitung",
      "processed": "Bearbeitet",
      "ready_for_pickup": "Abholbereit",
      "picked_up": "Unterwegs",
      "delivered": "Geliefert",
      "loginCta": "Anmelden, um Details zu sehen"
    }
  },
  "bag": {
    "label": {
      "affiliateHeading": "Wäscheservice von",
      "bagRef": "Beutel-Nr.",
      "printInstructions": "In 100 % Größe drucken. Ein Etikett pro Beutel."
    }
  },
  "admin": {
    "bags": {
      "mint": {
        "title": "Beutel erstellen",
        "affiliate": "Partner",
        "quantity": "Anzahl",
        "submit": "Charge erstellen",
        "success": "Charge erstellt"
      },
      "issue": { "confirm": "Diese Charge an den Partner ausgeben?" },
      "inventory": {
        "status": { "minted": "Erstellt", "issued": "Ausgegeben", "active": "Aktiv", "retired": "Stillgelegt" }
      }
    },
    "operators": {
      "scanCode": {
        "reset": "Scan-Code zurücksetzen",
        "shownOnceNote": "Wird nur einmal angezeigt — bewahren Sie ihn sicher auf."
      }
    }
  },
  "affiliate": {
    "bags": { "inventory": { "title": "Meine Beutel", "empty": "Noch keine Beutel" } }
  },
  "affiliateRegister": {
    "invite": {
      "invalidOrExpired": "Dieser Einladungslink ist ungültig oder abgelaufen.",
      "emailLocked": "Ihre E-Mail-Adresse wird durch die Einladung festgelegt und kann nicht geändert werden."
    },
    "w9": {
      "uploadLabel": "Laden Sie Ihr ausgefülltes W-9 hoch",
      "fileTypeHint": "PDF, JPG oder PNG, max. {{max}} MB",
      "tooLarge": "Die Datei ist zu groß.",
      "wrongType": "Dateityp nicht erlaubt.",
      "optionalNote": "Sie können Ihr W-9 auch später über Ihr Dashboard hochladen."
    }
  },
  "operator": {
    "intake": {
      "weightLabel": "Gewicht (lbs)",
      "addOns": {
        "premiumDetergent": "Premium-Waschmittel",
        "fabricSoftener": "Weichspüler",
        "stainRemover": "Fleckenentferner"
      },
      "freshFormAck": "Ein neues Zusatzleistungs-Formular liegt in der Beuteltasche",
      "created": "Bestellung erstellt",
      "error": {
        "bagNotActive": "Dieser Beutel ist nicht aktiv.",
        "orderAlreadyOpen": "Für diesen Beutel ist bereits eine Bestellung offen.",
        "bagNotFound": "Beutel nicht gefunden."
      }
    }
  },
  "affiliateDashboard": {
    "deliveryCode": {
      "title": "Liefercode",
      "current": "Ihr Liefercode",
      "reset": "Code zurücksetzen",
      "resetConfirm": "Liefercode zurücksetzen? Der alte Code funktioniert sofort nicht mehr.",
      "shownOnceNote": "Wird nur einmal angezeigt — bewahren Sie ihn sicher auf."
    },
    "deliverHelp": "Um einen Beutel zu liefern oder zu prüfen, scannen Sie den QR-Code des Beutels mit Ihrer Handykamera."
  },
  "customerDashboard": {
    "deliveryPin": {
      "title": "Liefer-PIN",
      "current": "Ihre Liefer-PIN",
      "reset": "PIN zurücksetzen",
      "shownOnceNote": "Wird nur einmal angezeigt — bewahren Sie sie sicher auf."
    }
  },
  "email": {
    "onTheWay": {
      "deliveryPinNote": "Bestätigen Sie den Erhalt an Ihrer Tür mit Ihrer Liefer-PIN {{pin}}."
    }
  },
  "order": {
    "status": {
      "in_progress": "In Bearbeitung",
      "processed": "Bearbeitet",
      "ready_for_pickup": "Abholbereit",
      "picked_up": "Unterwegs",
      "delivered": "Geliefert",
      "cancelled": "Storniert"
    }
  }
}
```

- [ ] **Step 3: Fill the legacy (non-§10) drift the checker reports**

Known on current main and almost certainly still present — `de` `common.buttons` gaps:

```json
      "refresh": "Aktualisieren",
      "applyFilters": "Filter anwenden",
      "clearFilters": "Filter zurücksetzen",
```

(insert inside `common.buttons` in `public/locales/de/common.json`, matching the en key order — after `"confirm"`). If the checker reports the same keys missing in `es`/`pt`, use: es `"refresh": "Actualizar"`, `"applyFilters": "Aplicar filtros"`, `"clearFilters": "Borrar filtros"`; pt `"refresh": "Atualizar"`, `"applyFilters": "Aplicar filtros"`, `"clearFilters": "Limpar filtros"`. For every other legacy key the checker lists: translate the en value into the target language, keeping `{{param}}` placeholders byte-identical, and matching the surrounding register (es/pt informal tú/você, de formal Sie — consistent with the existing files). Never delete an en key to silence the checker without `grep -rn "<key>" public/ server/` proving it has no consumer (and then delete it from all four files).

- [ ] **Step 4: Fix the stale i18n.js header comment**

`public/assets/js/i18n.js` line 3 currently reads:

```js
 * Supports: English (en), Spanish (es), Portuguese (pt)
```

change to:

```js
 * Supports: English (en), Spanish (es), Portuguese (pt), German (de)
```

(comment-only; no `?v=` bump needed — behavior unchanged.)

- [ ] **Step 5: Validate JSON + re-run the audit — locale section green**

```bash
for l in en es pt de; do node -e "JSON.parse(require('fs').readFileSync('public/locales/$l/common.json','utf8')); console.log('$l ok')"; done
npm run check:i18n
```

Expected: all four `ok`; the checker shows **zero locale `ERROR` lines** (email-template errors may remain — Tasks 3–4 clear those).

- [ ] **Step 6: Run the suite slice that consumes locales, then commit**

Run: `npm test -- tests/unit/i18nParity.test.js` — PASS. Also run any claim/i18n integration tests PRs 5–10 added (e.g. `npm test -- tests/integration/customerClaim.test.js` if present) — PASS.

```bash
git add public/locales/en/common.json public/locales/es/common.json public/locales/pt/common.json public/locales/de/common.json public/assets/js/i18n.js
git commit -m "fix(i18n): complete spec §10 locale inventory + fill legacy drift in en/es/pt/de"
```

---

## Task 3: Email template parity — language-resolve the v2 payment emails + ship missing language copies

**Files:**
- Create: `tests/unit/emailV2ReminderI18n.test.js`
- Modify: `server/services/email/dispatcher/payment.js` (`sendV2PaymentReminder` — direct-path read at ~line 105 on pre-PR-8 main; PR 8 retuned this function, so **re-locate with** `grep -n "payment-reminder" server/services/email/dispatcher/payment.js` first. Also the dead fallback block in `sendV2PaymentRequest` at ~lines 23–28.)
- Create (only those the checker still flags after PRs 5–10): `server/templates/emails/{es,pt,de}/v2/payment-request.html`, `server/templates/emails/{es,pt,de}/v2/payment-reminder.html`, and any missing language copies of `affiliate-invite`, `affiliate-w9-status`, `v2/come-to-store`, `customer-order-delivered`.

Background (verified on main): `template-manager.loadTemplate(name, lang)` already resolves `emails/{lang}/{name}.html` → flat `emails/{name}.html`. `sendV2PaymentRequest` uses it; `sendV2PaymentReminder` instead does a direct `readFile(path.join(__dirname, '../templates/emails/v2/payment-reminder.html'))` — a path under `server/services/email/templates/` that **does not exist** (latent bug; the real file is `server/templates/emails/v2/payment-reminder.html`). Switching to `loadTemplate` fixes the bug AND makes the template language-resolved. If PR 8 already made this exact change, Step 2's test passes immediately — skip Step 3 and continue at Step 4.

- [ ] **Step 1: Write the failing test**

```js
// tests/unit/emailV2ReminderI18n.test.js
jest.mock('../../server/services/email/transport', () => ({
  sendEmail: jest.fn(() => Promise.resolve(true))
}));
jest.mock('../../server/services/email/template-manager', () => {
  const actual = jest.requireActual('../../server/services/email/template-manager');
  return {
    ...actual,
    loadTemplate: jest.fn(() => Promise.resolve('<p>{{customerName}} {{amount}}</p>'))
  };
});

const { loadTemplate } = require('../../server/services/email/template-manager');
const payment = require('../../server/services/email/dispatcher/payment');

describe('sendV2PaymentReminder i18n', () => {
  it('loads the language-resolved v2/payment-reminder template for the customer language', async () => {
    const customer = { email: 'c@example.com', firstName: 'Ana', lastName: 'García', languagePreference: 'es' };
    const order = {
      orderId: 'ORD-123', actualWeight: 10, paymentRequestedAt: new Date(),
      feeBreakdown: { totalFee: 10 }, affiliateId: 'AFF-1'
    };
    await payment.sendV2PaymentReminder({
      customer, order, reminderNumber: 1, paymentAmount: 25,
      paymentLinks: { venmo: 'v', paypal: 'p', cashapp: 'c' },
      qrCodes: { venmo: '', paypal: '', cashapp: '' }
    });
    expect(loadTemplate).toHaveBeenCalledWith('v2/payment-reminder', 'es');
  });
});
```

Note: `jest.config.js` sets `resetMocks: true`, so the mock implementations live in the factory (arrow functions), not in `mockResolvedValue` calls at module scope. If PR 8 changed `sendV2PaymentReminder`'s argument shape, adapt the call args to the shipped signature (read the function) — the assertion under test stays `loadTemplate('v2/payment-reminder', <customer language>)`.

- [ ] **Step 2: Run it — expect failure for the right reason**

Run: `npm test -- tests/unit/emailV2ReminderI18n.test.js`
Expected: FAIL — `expect(loadTemplate).toHaveBeenCalledWith(...)` — `Number of calls: 0` (the function reads the file directly). If it PASSES, PR 8 already migrated it — skip Step 3.

- [ ] **Step 3: Minimal implementation**

In `server/services/email/dispatcher/payment.js`, inside `sendV2PaymentReminder` (locate with the grep above), replace the direct read (pre-PR-8 main text shown):

```js
    // Load V2 reminder template (correct path with emails directory)
    const v2TemplatePath = path.join(__dirname, '../templates/emails/v2/payment-reminder.html');
    let template = await readFile(v2TemplatePath, 'utf8');
```

with:

```js
    let template = await loadTemplate('v2/payment-reminder', language);
```

(`language` is already defined at the top of the function: `const language = customer.languagePreference || 'en';`.) Then delete the dead fallback block in `sendV2PaymentRequest` (pre-PR-8 main, lines 23–28):

```js
    // If template doesn't exist, load from v2 folder (correct path with emails directory)
    let finalTemplate = template;
    if (template.includes('[EMAIL_CONTENT]')) {
      const v2TemplatePath = path.join(__dirname, '../templates/emails/v2/payment-request.html');
      finalTemplate = await readFile(v2TemplatePath, 'utf8');
    }
```

replace with:

```js
    const finalTemplate = template;
```

Finally run `grep -n "readFile\|require('fs')\|require('util')" server/services/email/dispatcher/payment.js` — if `readFile` has no remaining callers in the file, delete the now-dead imports (`const fs = require('fs');`, `const { promisify } = require('util');`, `const readFile = promisify(fs.readFile);`, and `const path = require('path');` if `path` is also unused).

- [ ] **Step 4: Run the test + the payment email suites — expect pass**

```bash
npm test -- tests/unit/emailV2ReminderI18n.test.js
npm test -- tests/unit/paymentVerificationJob.test.js
npm test -- tests/unit/email-come-to-store.test.js
```

Expected: PASS (the latter two exist from PR 8; if a file is named differently, `ls tests/unit | grep -i payment`).

- [ ] **Step 5: Create the missing language template copies the checker flags**

Run `npm run check:i18n`. For each `email template missing: <lang>/<name>.html` error, create the file by copying the en/default copy and translating **only human-visible text** — keep every `[PLACEHOLDER]` and `{{placeholder}}` token and all HTML/CSS byte-identical (the checker's placeholder-set comparison enforces this mechanically). Subjects for these templates live in dispatcher code or were shipped by PRs 5–10; this step is template files only.

For `v2/payment-request` and `v2/payment-reminder`: copy `server/templates/emails/v2/payment-request.html` / `payment-reminder.html` into `server/templates/emails/{es,pt,de}/v2/` and translate. (PR 8 already retuned the en reminder copy — no 24h-deadline framing, `maxReminders` from config — translate the retuned text as-is.)

For `affiliate-invite`, `affiliate-w9-status`, `v2/come-to-store`, `customer-order-delivered` (authored by PRs 5/10/8/9 — expected present in 4 langs already; fill ONLY if flagged), translate using this reference copy table:

| Key concept | en | es | pt | de |
|:--|:--|:--|:--|:--|
| invite greeting | Hello [FIRST_NAME], | Hola [FIRST_NAME]: | Olá, [FIRST_NAME]! | Hallo [FIRST_NAME], |
| invite body | You've been invited to join the WaveMAX affiliate program. Click the button below to complete your registration. | Has sido invitado/a a unirte al programa de afiliados de WaveMAX. Haz clic en el botón para completar tu registro. | Você foi convidado(a) a participar do programa de afiliados WaveMAX. Clique no botão abaixo para concluir seu cadastro. | Sie wurden eingeladen, dem WaveMAX-Partnerprogramm beizutreten. Klicken Sie auf die Schaltfläche unten, um Ihre Registrierung abzuschließen. |
| invite cta | Complete registration | Completar registro | Concluir cadastro | Registrierung abschließen |
| invite expires | This invitation expires on [EXPIRES_AT]. | Esta invitación caduca el [EXPIRES_AT]. | Este convite expira em [EXPIRES_AT]. | Diese Einladung läuft am [EXPIRES_AT] ab. |
| w9 received | We received your W-9 and it is under review. | Hemos recibido tu W-9 y está en revisión. | Recebemos seu W-9 e ele está em análise. | Wir haben Ihr W-9 erhalten; es wird derzeit geprüft. |
| w9 verified | Your W-9 has been verified — you're all set to receive payments. | Tu W-9 ha sido verificado: ya puedes recibir pagos. | Seu W-9 foi verificado — você já pode receber pagamentos. | Ihr W-9 wurde verifiziert — Sie können jetzt Zahlungen erhalten. |
| w9 rejected | Your W-9 was rejected: [REJECT_REASON]. Please upload a corrected copy. | Tu W-9 fue rechazado: [REJECT_REASON]. Sube una copia corregida. | Seu W-9 foi rejeitado: [REJECT_REASON]. Envie uma cópia corrigida. | Ihr W-9 wurde abgelehnt: [REJECT_REASON]. Bitte laden Sie eine korrigierte Kopie hoch. |
| hold-notice heading | Your laundry is being held at the store | Tu ropa está retenida en la tienda | Sua roupa está retida na loja | Ihre Wäsche wird im Geschäft aufbewahrt |
| hold-notice body | We haven't received payment for order [ORDER_ID] ($[AMOUNT_DUE]). Your cleaned laundry is held at [STORE_ADDRESS]. Pay online or come to the store to retrieve it. | No hemos recibido el pago del pedido [ORDER_ID] ($[AMOUNT_DUE]). Tu ropa limpia está retenida en [STORE_ADDRESS]. Paga en línea o ven a la tienda a recogerla. | Não recebemos o pagamento do pedido [ORDER_ID] ($[AMOUNT_DUE]). Sua roupa limpa está retida em [STORE_ADDRESS]. Pague on-line ou venha à loja para retirá-la. | Wir haben die Zahlung für Bestellung [ORDER_ID] ($[AMOUNT_DUE]) nicht erhalten. Ihre gereinigte Wäsche wird unter [STORE_ADDRESS] aufbewahrt. Zahlen Sie online oder holen Sie sie im Geschäft ab. |
| delivered heading | Your laundry was delivered! | ¡Tu ropa fue entregada! | Sua roupa foi entregue! | Ihre Wäsche wurde geliefert! |
| delivered body | Your laundry (order [ORDER_ID]) was delivered on [DELIVERED_AT]. Thank you for choosing WaveMAX! | Tu ropa (pedido [ORDER_ID]) fue entregada el [DELIVERED_AT]. ¡Gracias por elegir WaveMAX! | Sua roupa (pedido [ORDER_ID]) foi entregue em [DELIVERED_AT]. Obrigado por escolher a WaveMAX! | Ihre Wäsche (Bestellung [ORDER_ID]) wurde am [DELIVERED_AT] geliefert. Danke, dass Sie WaveMAX gewählt haben! |

If a shipped template uses different placeholder names, **mirror the shipped en placeholders exactly** — the table's bracket tokens are illustrative copy anchors, the en file is the structural source of truth.

- [ ] **Step 6: Re-run the checker — only `order-ready` errors may remain**

Run: `npm run check:i18n`
Expected: the only remaining `ERROR` lines reference `order-ready` (created in Task 4). `customer-on-the-way` must already be clean — PR 9 Task 5.4 shipped the root + `{es,pt,de}` copies; an error on it means PR 9 deviated (different name or missing copy): update `REQUIRED_EMAIL_TEMPLATES` in `scripts/check-i18n-parity.js` to the shipped name (one-line edit) or fill the missing copy matching the SHIPPED template's lowercase token set, and adjust Task 4 accordingly.

- [ ] **Step 7: Full payment-suite pass + commit**

Run: `npm test -- tests/unit tests/integration --listTests | grep -i payment` then run those files; expect PASS.

```bash
git add server/services/email/dispatcher/payment.js server/templates/emails tests/unit/emailV2ReminderI18n.test.js
git commit -m "fix(i18n): language-resolve v2 payment emails + ship es/pt/de template copies"
```

---

## Task 4: Localize Notification A (`order-ready`); clean up the dead pre-redesign "picked up" dispatcher

> **Post-PR-9 reality (this task was re-scoped against it):** the "on the way" email is ALREADY localized — PR 9 Task 5 shipped `ops.sendOrderOnTheWayEmail(customer, order, { deliveryPin, affiliateName })` which does `loadTemplate('customer-on-the-way', customer.languagePreference)` against `server/templates/emails/customer-on-the-way.html` + `{es,pt,de}/` copies (lowercase `[delivery_pin]`-style tokens), and PR 9 Task 6's `orderAdvanceService` calls it at scan-out with the rotated PIN. Language threading and PIN delivery are DONE. Meanwhile PR 9 Task 7 deleted `operatorPickupService` — the SOLE production caller of the old `sendOrderPickedUpNotification` — leaving that export and its inline-English HTML dead. This task therefore: (a) localizes `sendOrderReadyNotification` (Notification A — genuinely still inline English), and (b) DELETES the dead `sendOrderPickedUpNotification` instead of retuning it. Do NOT create any `customer-on-the-way` template file — they exist (PR 9); creating them again would clobber PR 9's lowercase-token files with a different token set and break the parity checker.

**Files:**
- Create: `tests/unit/emailOpsI18n.test.js`
- Modify: `server/services/email/dispatcher/ops.js` (`sendOrderReadyNotification` — inline English HTML on main at line 73; DELETE `sendOrderPickedUpNotification` — dead since PR 9 Task 7; `ops.js` already imports `loadTemplate`/`fillTemplate` at line 4)
- Create: `server/templates/emails/order-ready.html` + `server/templates/emails/{en,es,pt,de}/order-ready.html`
- Modify: ONE call site (thread the affiliate's `languagePreference`): the ready gate (`server/services/orderReadyGateService.js`, PR 4/8) — locate with `grep -rn "sendOrderReadyNotification" server/ --include=*.js`

Spec anchors: §6.6 Notification A — **reuse** `sendOrderReadyNotification`, retune copy in place, no parallel dispatcher/template named `affiliate-order-ready`. **Audit first (still mandatory):** `grep -n "sendOrderPickedUpNotification\|sendOrderOnTheWayEmail" server/ -r --include=*.js` — confirm `sendOrderOnTheWayEmail` exists with a `loadTemplate('customer-on-the-way', …)` call (PR 9) and that `sendOrderPickedUpNotification` has zero production callers. If PR 9 deviated (e.g. retuned `sendOrderPickedUpNotification` in place instead of adding the new export), keep the shipped name, point `REQUIRED_EMAIL_TEMPLATES`/tests at it, and skip the deletion below.

- [ ] **Step 1: Write the failing test**

```js
// tests/unit/emailOpsI18n.test.js
jest.mock('../../server/services/email/transport', () => ({
  sendEmail: jest.fn(() => Promise.resolve(true))
}));
jest.mock('../../server/services/email/template-manager', () => {
  const actual = jest.requireActual('../../server/services/email/template-manager');
  return {
    ...actual,
    loadTemplate: jest.fn(() => Promise.resolve(
      '<p>[AFFILIATE_NAME][CUSTOMER_NAME][ORDER_ID][TOTAL_WEIGHT]</p>'
    ))
  };
});

const { loadTemplate } = require('../../server/services/email/template-manager');
const { sendEmail } = require('../../server/services/email/transport');
const ops = require('../../server/services/email/dispatcher/ops');

describe('ops dispatcher i18n', () => {
  it('sendOrderReadyNotification loads the language-resolved order-ready template', async () => {
    await ops.sendOrderReadyNotification('aff@example.com', {
      affiliateName: 'Maria', orderId: 'ORD-1', customerName: 'Cust',
      totalWeight: 12, language: 'pt'
    });
    expect(loadTemplate).toHaveBeenCalledWith('order-ready', 'pt');
    const [to, subject, html] = sendEmail.mock.calls[0];
    expect(to).toBe('aff@example.com');
    expect(subject).toContain('ORD-1');
    expect(html).toContain('Maria');
  });

  it('sendOrderReadyNotification defaults to en', async () => {
    await ops.sendOrderReadyNotification('aff@example.com', {
      affiliateName: 'A', orderId: 'ORD-2', customerName: 'C', totalWeight: 1
    });
    expect(loadTemplate).toHaveBeenCalledWith('order-ready', 'en');
  });

  it('the dead pre-redesign picked-up dispatcher is gone (PR 9 replaced it with sendOrderOnTheWayEmail)', () => {
    expect(ops.sendOrderPickedUpNotification).toBeUndefined();
    expect(typeof ops.sendOrderOnTheWayEmail).toBe('function'); // PR 9's localized replacement
  });
});
```

(The on-the-way email itself is pinned by PR 9's `tests/unit/deliveryEmails.test.js` — do not duplicate its assertions here.)

- [ ] **Step 2: Run it — expect failure for the right reason**

Run: `npm test -- tests/unit/emailOpsI18n.test.js`
Expected: FAIL — `loadTemplate` `Number of calls: 0` for the order-ready tests (inline HTML today), and `expect(ops.sendOrderPickedUpNotification).toBeUndefined()` receives a function (the dead export still present).

- [ ] **Step 3: Rewrite `sendOrderReadyNotification`; delete the dead dispatcher**

In `server/services/email/dispatcher/ops.js`, replace the body of `sendOrderReadyNotification` (currently lines 73–112: subject string + ~33-line inline HTML literal ending `return sendEmail(affiliateEmail, subject, html);`) with:

```js
// Send order ready notification to affiliate (Notification A — the ready gate's
// "collect from store" email; spec §6.5/§6.6). Language-resolved via
// template-manager; data.language is the affiliate's languagePreference.
exports.sendOrderReadyNotification = async (affiliateEmail, data) => {
  const language = data.language || 'en';
  const subjects = {
    en: `Order ${data.orderId} Ready for Pickup`,
    es: `Pedido ${data.orderId} listo para recoger`,
    pt: `Pedido ${data.orderId} pronto para retirada`,
    de: `Bestellung ${data.orderId} abholbereit`
  };
  const template = await loadTemplate('order-ready', language);
  const html = fillTemplate(template, {
    AFFILIATE_NAME: data.affiliateName,
    ORDER_ID: data.orderId,
    CUSTOMER_NAME: data.customerName,
    TOTAL_WEIGHT: data.totalWeight
  });
  return sendEmail(affiliateEmail, subjects[language] || subjects.en, html);
};
```

Then DELETE the whole `exports.sendOrderPickedUpNotification = async (…) => { … };` block (the pre-redesign inline-English "picked up" email; on main at lines 115–155). PR 9 Task 7 removed its only production caller (`operatorPickupService`) and PR 9's `sendOrderOnTheWayEmail` is the live, already-localized replacement on the scan-out path. Confirm before deleting:

```bash
grep -rn "sendOrderPickedUpNotification" server/ tests/ --include=*.js
```

Expected: only the ops.js definition, any dispatcher-index pass-through, and stale test mocks. Remove stale `sendOrderPickedUpNotification: jest.fn()…` lines from any test-file `jest.mock('../../server/utils/emailService', …)` factories as you hit them (mocking a deleted export is harmless but misleading; deleting the mock lines keeps the seam honest).

- [ ] **Step 4: Create the five `order-ready` template files (and ONLY those)**

`customer-on-the-way.html` + its `{es,pt,de}` copies already exist (PR 9 Task 5.4, lowercase `[delivery_pin]`-style tokens) — touching them here would change their token set and fail the Task 1 parity checker's token-set-equality rule. The five new files (`order-ready.html` flat default + `{en,es,pt,de}/order-ready.html`) use this shell — substitute `{LANG}` / `{HEADING}` / `{BODY}` per the table; everything in `[BRACKETS]` is a runtime placeholder and must be byte-identical in all four languages:

```html
<!DOCTYPE html>
<html lang="{LANG}">
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f4f4;">
  <div style="font-family: Arial, sans-serif; max-width:600px; margin:0 auto; background:#ffffff;">
    <div style="background-color:#1e3a8a;color:#ffffff;padding:20px;text-align:center;">
      <h2 style="margin:0;">{HEADING}</h2>
    </div>
    <div style="padding:20px;color:#333333;line-height:1.6;">
      {BODY}
    </div>
    <div style="background-color:#f5f5f5;padding:10px;text-align:center;font-size:12px;color:#666666;">
      &copy; 2025 CRHS Enterprises, LLC. All rights reserved.
    </div>
  </div>
</body>
</html>
```

**`order-ready.html`** (flat default = en copy; plus `en/`, `es/`, `pt/`, `de/` copies):

| lang | HEADING | BODY |
|:--|:--|:--|
| en | Order Ready — Collect from Store | `<p>Hello [AFFILIATE_NAME],</p><p>Order <strong>[ORDER_ID]</strong> for [CUSTOMER_NAME] ([TOTAL_WEIGHT] lbs) is processed and paid. Please collect it from the store and deliver it to your customer.</p>` |
| es | Pedido listo — Recoger en la tienda | `<p>Hola [AFFILIATE_NAME]:</p><p>El pedido <strong>[ORDER_ID]</strong> de [CUSTOMER_NAME] ([TOTAL_WEIGHT] lbs) está procesado y pagado. Recógelo en la tienda y entrégaselo a tu cliente.</p>` |
| pt | Pedido pronto — Retirar na loja | `<p>Olá, [AFFILIATE_NAME]!</p><p>O pedido <strong>[ORDER_ID]</strong> de [CUSTOMER_NAME] ([TOTAL_WEIGHT] lbs) está processado e pago. Retire-o na loja e entregue ao seu cliente.</p>` |
| de | Bestellung bereit — Im Geschäft abholen | `<p>Hallo [AFFILIATE_NAME],</p><p>die Bestellung <strong>[ORDER_ID]</strong> für [CUSTOMER_NAME] ([TOTAL_WEIGHT] lbs) ist bearbeitet und bezahlt. Bitte holen Sie sie im Geschäft ab und liefern Sie sie an Ihren Kunden aus.</p>` |

- [ ] **Step 5: Run the test — expect pass**

Run: `npm test -- tests/unit/emailOpsI18n.test.js`
Expected: PASS (3 tests).

- [ ] **Step 6: Thread the language at the ONE remaining call site**

`grep -rn "sendOrderReadyNotification" server/ --include=*.js` — exactly one production call site is expected (plus tests):

1. **Ready gate** (`server/services/orderReadyGateService.js`, PR 4/8): the gate already loads the affiliate to address the email. Add `language: affiliate.languagePreference` to the `data` object it passes (one line). If the gate fetches only the email string, extend the lookup to include `languagePreference` in its field selection.

(The on-the-way path needs NOTHING: PR 9's `sendOrderOnTheWayEmail` already resolves `customer.languagePreference` internally and `orderAdvanceService` already passes the rotated `deliveryPin` — verify with `grep -n "sendOrderOnTheWayEmail" server/modules/orders/orderAdvanceService.js server/services/email/dispatcher/ops.js`.)

Then run the seams' integration tests: `npm test -- tests/integration/readyForPickupGate.test.js tests/integration/operatorScanOut.test.js` (PR 4/9 files; adjust names via `ls tests/integration | grep -iE "ready|scanout|advance"`). Expected: PASS. If an existing PR 4/8 test asserted on the old inline-English `order-ready` HTML body, update that assertion to the new template copy (surgical, the change is intentional).

- [ ] **Step 7: Checker fully green + commit**

Run: `npm run check:i18n`
Expected: `OK: 0 errors` (warnings about legacy templates like `affiliate-commission`/`customer-welcome` lacking es/pt/de copies are acceptable backlog — they predate the redesign and are out of §10 scope).

```bash
git add server/services/email/dispatcher/ops.js server/templates/emails server/services/orderReadyGateService.js tests/unit/emailOpsI18n.test.js
git commit -m "feat(i18n): localize order-ready (Notification A); delete the dead pre-redesign picked-up dispatcher"
```

---

## Task 5: Lighthouse pass on the claim page (mobile + desktop)

**Files:**
- Create: `scripts/seed-claim-bag.js`
- Modify (only if the corresponding audit is flagged): `public/embed-app-v2.html` (no meta description today — head is lines 1–32), `public/claim-embed.html`, `public/assets/js/claim.js`, `public/assets/css/` claim stylesheet (PR 6 file — locate with `grep -n "stylesheet" public/claim-embed.html`)

The claim page is the redesign's new public surface (spec §12 PR 11: "new pages measured mobile + desktop"). Procedure follows `docs/development/LIGHTHOUSE-QUALITY-BAR.md`: measure with a `?lh=<ts>` cache-buster, target ~100 in all four categories on BOTH form factors, re-run for variance, fix-and-remeasure. There is no Jest TDD here — the failing "test" is the Lighthouse run itself.

- [ ] **Step 1: Seed a claimable bag (create `scripts/seed-claim-bag.js`)**

```js
#!/usr/bin/env node
// Seeds one affiliate + one ISSUED bag and prints the claim URL, so the
// /claim page can be measured (Lighthouse) or smoke-tested locally.
// Usage: node scripts/seed-claim-bag.js   (needs .env: MONGODB_URI, ENCRYPTION_KEY)
'use strict';
require('dotenv').config();
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const encryptionUtil = require('../server/utils/encryption');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/wavemax_affiliate');
  const Bag = require('../server/modules/bags/Bag');

  const affiliateId = 'AFF-' + uuidv4();
  // Minimal affiliate via the collection — bypasses password/required-field churn;
  // the claim resolver reads only affiliateId/businessName/name fields/isActive.
  await mongoose.connection.collection('affiliates').insertOne({
    affiliateId,
    firstName: 'Lighthouse',
    lastName: 'Seed',
    businessName: 'WaveMAX Lighthouse Test',
    email: `lh-seed-${Date.now()}@example.com`,
    isActive: true,
    languagePreference: 'en',
    createdAt: new Date(),
    updatedAt: new Date()
  });

  const token = encryptionUtil.generateToken(16); // 32 hex chars (spec §4.1 canon)
  const bag = await Bag.create({
    token,
    tokenHash: Bag.hashToken(token),
    affiliateId,
    status: 'issued',
    batchId: 'BATCH-' + uuidv4()
  });

  console.log('bagId:     ', bag.bagId);
  console.log('claim URL: ', `http://localhost:3000/embed-app-v2.html?route=/claim&bag=${token}`);
  await mongoose.disconnect();
})().catch((err) => { console.error(err); process.exit(1); });
```

- [ ] **Step 2: Start the app and prove the claim route renders**

```bash
node server.js &           # or: npm run dev — needs local Mongo + .env
sleep 3
node scripts/seed-claim-bag.js   # copy the printed claim URL → $CLAIM_URL below
curl -s "http://localhost:3000/embed-app-v2.html?route=/claim" -o /tmp/claim-shell.html
grep -c "embed-app-v2.js" /tmp/claim-shell.html   # expect 1 — the SPA shell, not a gate page
curl -s "http://localhost:3000/api/v1/bags/resolve/$(echo "$CLAIM_URL" | sed 's/.*bag=//')" | head -c 300
# expect JSON with outcome:"unclaimed" and the affiliate name "WaveMAX Lighthouse Test"
```

If a gate/coming-soon page comes back instead of the shell, the local `.env` has an access gate enabled — the claim surfaces must pass `locationQuarantine`/`comingSoon` by existing allowlist pattern (spec §6.3, §12 deploy checklist; patterns live in `server/config/quarantineConfig.js`). Disable the gate toggles in the local `.env` for measurement, and file the §12 deploy-checklist item for production verification.

- [ ] **Step 3: Measure — desktop + mobile, with the cache-buster (quality-bar doc commands)**

```bash
CLAIM_URL="http://localhost:3000/embed-app-v2.html?route=/claim&bag=<TOKEN-FROM-SEED>"
CHROME="${CHROME_PATH:-/usr/bin/google-chrome}"   # the quality-bar boxes use /opt/google/chrome/chrome

# Desktop
CHROME_PATH="$CHROME" npx --yes lighthouse "$CLAIM_URL&lh=$(date +%s)" \
  --preset=desktop --output=json --output-path=/tmp/lh-claim-desktop.json \
  --chrome-flags="--headless=new --no-sandbox --disable-dev-shm-usage" --quiet

# Mobile
CHROME_PATH="$CHROME" npx --yes lighthouse "$CLAIM_URL&lh=$(date +%s)" \
  --form-factor=mobile --screenEmulation.mobile=true --output=json --output-path=/tmp/lh-claim-mobile.json \
  --chrome-flags="--headless=new --no-sandbox --disable-dev-shm-usage" --quiet

# Scores (target: ~100 / 100 / 100 / 100; perf ±3–5 run-to-run on mobile is normal — re-run and take the median)
for f in /tmp/lh-claim-desktop.json /tmp/lh-claim-mobile.json; do
  node -e "const r=require('$f');console.log('$f'.split('/').pop(), Object.entries(r.categories).map(([k,c])=>k+'='+Math.round(c.score*100)).join('  '))"
done

# Worklist: every audit scoring < 1
node -e "const r=require('/tmp/lh-claim-mobile.json');Object.values(r.audits).filter(a=>a.score!==null&&a.score<1).sort((a,b)=>a.score-b.score).forEach(a=>console.log(a.score, a.id, '-', a.title))"
```

- [ ] **Step 4: Apply the playbook fixes for whatever the worklist shows (each item: fix → re-run Step 3)**

Apply ONLY what is flagged; quality-bar per-category playbook + known facts about this page:

- **`meta-description` (SEO — will be flagged: the shell has none).** In `public/embed-app-v2.html`, after line 6 (`<meta name="csp-nonce" content="">`), add:
  ```html
    <meta name="description" content="WaveMAX laundry pickup and delivery — claim your laundry bag, track your order, and manage your account.">
  ```
- **`color-contrast` (a11y).** Any white-on-brand-cyan CTA in the claim stylesheet must use the darkened token `#0e7490` (5.36:1) instead of `#29b6d4` (2.4:1) — verify with a contrast calculator, don't eyeball.
- **`tap-targets` (SEO mobile).** Claim/deliver buttons and the language switcher need ≥48×48 px effective size — add `min-height: 48px; padding: 12px 16px;` in the claim stylesheet rather than inline styles (strict CSP).
- **`image-size-responsive` / `unsized-images` (CLS).** Any `<img>` on the claim page (logo, icons) gets explicit `width`/`height` attributes; decorative icons get `aria-hidden="true"`.
- **`errors-in-console` (Best Practices — must be zero).** A bad/missing `?bag=` must surface as the i18n'd `claim.invalidTitle/Body` card, not an unhandled fetch rejection. Check: `claim.js` resolve-failure path renders UI state and does not `console.error`.
- **`label` / `label-content-name-mismatch` (a11y).** The code input must have a `<label data-i18n="claim.deliver.codeLabel">`; don't override visible text with a mismatched `aria-label`.
- **`uses-rel-preconnect` (perf).** If flagged for the CDN css, add to the shell head:
  ```html
    <link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
    <link rel="preconnect" href="https://cdnjs.cloudflare.com" crossorigin>
  ```
- **`html-has-lang` is satisfied** (`<html lang="en">`, line 2); if `valid-lang` is flagged after a language switch, ensure `i18n.js` sets `document.documentElement.lang` on `setLanguage`.

Deploy/cache rules if any `/assets/*` file changed: bump its `?v=` stamp in **every** referencing page (`grep -rl "claim.js" public/`), and remember assets are immutable-cached for a year. If a minified sibling exists for a changed asset (check `scripts/build-assets.js` `ASSETS` manifest), run `npm run build:assets` and commit both.

- [ ] **Step 5: Record the final scores**

Re-run Step 3 until both form factors hold ~100/100/100/100 (perf ≥ ~95 acceptable with median-of-3 evidence). Paste the two score lines into the PR description (template in Verification below). Stop the local server (`kill %1`).

- [ ] **Step 6: Suite still green + commit**

Run: `npm test -- tests/unit/i18nParity.test.js` and any claim-page integration tests (`ls tests/integration | grep -i claim`). Expected: PASS.

```bash
git add scripts/seed-claim-bag.js public/embed-app-v2.html public/claim-embed.html public/assets
git commit -m "chore(quality): Lighthouse pass on /claim — meta description, contrast, tap targets; seed script"
```

(Stage only the files actually touched in Step 4; the seed script always.)

---

## Task 6: Docs — "replaced by" notes in the handbook + root project-state note

**Files:**
- Modify: `.claude/CLAUDE.md` (architecture handbook — exact current text quoted below, verified 2026-06-09; PRs 1–10 did not touch this file, docs were explicitly deferred to PR 11)
- Modify: `CLAUDE.md` (root — Project State section, lines 7–17)

Short notes only — point at the spec; do not rewrite the handbook. Each bullet below is one exact-string Edit (old → new).

- [ ] **Step 1: Root `CLAUDE.md` — replace the stale scope-context paragraph (line 15)**

Old:
```
**Scope context:** clean-slate redeploy. Production data is **not** being preserved. V1 payment code (Paygistix, `Payment` model, `CallbackPool`, `PaymentToken`, `v1` registration/pickup pages) is being **deleted**, not migrated. The `.claude/CLAUDE.md` handbook still describes V1 as live — treat it as current-state reference until Phase 2 removes V1 code.
```

New:
```
**Scope context:** clean-slate redeploy — **the invite-only onboarding + durable-bags + order-at-intake redesign is built** (canonical spec: [`docs/superpowers/specs/2026-06-08-invite-bag-workflow-redesign-design.md`](docs/superpowers/specs/2026-06-08-invite-bag-workflow-redesign-design.md)). V1 Paygistix, customer scheduling / Pickup Now, BetaRequest, and the `?affid` referral funnel are removed. Superseded `.claude/CLAUDE.md` handbook sections carry a *Replaced (redesign)* note pointing at the spec.
```

- [ ] **Step 2: Handbook top note (`.claude/CLAUDE.md` line 5)**

Old:
```
> **Note:** project is mid-refactor (see `docs/refactor/REFACTORING_PLAN.md`). V1 payment code (Paygistix, `Payment` model, `CallbackPool`, `PaymentToken`, v1 registration) is being **deleted** in Phase 2, not migrated. Sections below marked *V1 (legacy, being removed)* describe dead code being cleaned up.
```

New:
```
> **Note:** the invite-only + durable-bags + order-at-intake redesign is built (spec: `docs/superpowers/specs/2026-06-08-invite-bag-workflow-redesign-design.md` — §4 models, §5 API, §6 subsystems are authoritative). V1 Paygistix, customer scheduling/Pickup Now, BetaRequest, DocuSign W-9, and `?affid` referrals are **removed**. Sections below carrying a *Replaced (redesign)* note describe the pre-redesign system — read them only as history; trust the spec + code.
```

- [ ] **Step 3: Key Features bullets (lines 35–39)**

Old:
```
- **Payment** (post-refactor): Post-weigh payment via Venmo/PayPal/CashApp (V2 flow; V1 Paygistix being removed in Phase 2)
- **Geospatial service areas**: Location-based affiliate matching
- **QR code bag tracking**: Three-stage workflow (weighing → processing → pickup)
- **Commission system**: 10% WDF + 100% delivery fee
- **W-9 tax compliance**: DocuSign integration
```

New:
```
- **Payment**: post-weigh Venmo/PayPal/CashApp links generated once at store intake; hourly reminders ×8, then held-at-store escalation (spec §6.5; V1 Paygistix deleted)
- **Bag-bound relationships**: customers bind to an affiliate by claiming a durable bag QR — *replaced* location-based service-area matching (spec §6.3; service area no longer enforced)
- **Durable bag QR tracking**: one reusable bag per customer, one order per store intake; order lifecycle `in_progress → processed → ready_for_pickup → picked_up → delivered` (spec §6.4)
- **Commission system**: 10% WDF + 100% delivery fee, realized at `delivered`
- **W-9 tax compliance**: encrypted in-app W-9 file upload + admin review — *replaced* the DocuSign flow (spec §6.2)
```

- [ ] **Step 4: Order Model section note (after line 207, `**File**: `server/models/Order.js``)**

Insert directly below that line:
```
> **Replaced (redesign §4.4):** status enum is now `in_progress / processed / ready_for_pickup / picked_up / delivered / cancelled`; scheduling fields (`pickupDate`, `pickupTime`, `estimatedWeight`), `numberOfBags`, and the multi-bag `bags[]` machinery are removed; one durable bag per order via top-level `bagId`/`bagToken`. The block below predates the redesign — trust the spec + `server/models/Order.js`.
```

- [ ] **Step 5: API sections — Customer + Order route notes**

Under `### Customer (`server/routes/customerRoutes.js`)` (line 359), insert before the code fence:
```
> **Replaced (redesign §5/§6.3):** customer registration is QR-claim only — `GET /api/v1/customers/claim/:bagToken` + `POST /api/v1/customers/claim/:bagToken/register`. The V1/V2 register routes below are gone.
```

Under `### Order (`server/routes/orderRoutes.js`)` (line 371), insert before the code fence:
```
> **Replaced (redesign §5/§6.4):** `POST /api/v1/orders` is removed — orders are created at operator intake (`POST /api/v1/operators/intake` or `POST /api/v1/bags/:bagToken/intake`).
```

Under `### W-9 (`server/routes/w9Routes.js`)` (line 404), insert before the code fence:
```
> **Replaced (redesign §6.2):** the DocuSign signing/webhook endpoints below were never built; the shipped surface is upload/review (`POST /api/v1/affiliates/:affiliateId/w9`, `GET /api/v1/w9/status`, `GET /api/v1/w9/admin/pending`, `GET /api/v1/w9/admin/:affiliateId/document`, verify/reject).
```

- [ ] **Step 6: Business Logic notes**

Above the `### WDF Credit System` body (after line 597's heading), insert:
```
> **Replaced (redesign §4.4):** there is no customer weight estimate — orders are born at intake with `actualWeight`, so estimate-variance credit generation is gone (`wdfCreditGenerated = 0` in the new flow). Carry-in `wdfCreditApplied` still applies at intake.
```

Above the `### Bag Tracking Workflow` body (after line 617's heading), insert:
```
> **Replaced (redesign §4.1/§6.4):** the QR is an opaque 32-hex bag token in a claim URL (never `customerId#bagId`); the durable Bag lives across orders (`minted → issued → active`), and order stages are `intake → processed → picked_up → delivered`.
```

Above the `### Payment Flow (V2 — current)` body (after line 629's heading), insert:
```
> **Replaced (redesign §6.5):** no scheduling — links are generated once at intake; reminders run hourly, max 8, then a "come to the store" notice (`paymentEscalated`, never auto-cancel); `ready_for_pickup` is gated on processed AND payment-verified.
```

- [ ] **Step 7: Integration Points + Quick Reference cleanups**

In the Integration Points table (line 656), delete the Paygistix row:
```
| *V1* **Paygistix** | `PAYGISTIX_MERCHANT_ID`, `PAYGISTIX_FORM_ACTION_URL`, pool of 10 callback URLs | `server/services/paygistixService.js` — *being removed in Phase 2* |
```

Above `### DocuSign W-9 Workflow` (line 660), insert:
```
> **Replaced (redesign §6.2):** DocuSign is not used — W-9s are uploaded in-app, AES-256-GCM-encrypted to `W9_STORAGE_PATH` via `server/services/secureFileStore.js`, and admin-reviewed.
```

Above `### Geocoding Usage` (line 666), insert:
```
> **Replaced (redesign §6.3, settled #8):** service area is no longer enforced — no geocoding/radius check at claim or registration.
```

In Required Environment Variables (lines 830–831), delete:
```
# Payment (V1, legacy — being removed in Phase 2)
PAYGISTIX_MERCHANT_ID=wmaxaustWEB
```

In First-Time Database Setup (line 855), delete:
```
await callbackPoolManager.initializePool();   // V1 only — legacy
```

In Important URLs (lines 935–936), delete:
```
V1 Paygistix (legacy):
  Gateway URL:       https://safepay.paymentlogistics.net/transaction.asp
```

Replace the Workflow Cheat Sheet block (lines 951–955):

Old:
```
- **Affiliate registration:** Register → W-9 submission → Admin verification → Active
- **Customer registration (V2, current):** Register (no payment) → Active
- **Order lifecycle:** `pending → processing → processed → complete`
- **Bag workflow:** `processing (weighed) → processed (WDF done) → completed (picked up)`
- **Payment (V2) flow:** `pending → awaiting → confirming → verified`
```

New:
```
- **Affiliate onboarding:** Admin invite → invited registration (email locked) → W-9 upload → admin verify → Active
- **Customer onboarding:** scan bag QR → claim registration (affiliate derived from bag) → Active
- **Order lifecycle:** `in_progress → processed → ready_for_pickup → picked_up → delivered` (cancel from in_progress/processed only)
- **Bag (durable):** `minted → issued → active` (stays active across orders); per-order stages `intake → processed → picked_up → delivered`
- **Payment flow:** `pending → awaiting → confirming → verified`; hourly reminders ×8 → come-to-store notice (`paymentEscalated`, held at store)
```

Also update the Route Mapping `EMBED_PAGES` sample (line 525): delete the line `  '/schedule-pickup': '/schedule-pickup-embed.html',` and add `  '/claim': '/claim-embed.html',` after the `'/operator-scan'` line — then verify against the real map: `grep -n "claim\|schedule-pickup" public/assets/js/embed-app-v2.js` (the doc must mirror the code as PRs 2/6 left it).

- [ ] **Step 8: Verify no stale claims remain + commit**

```bash
grep -n "Paygistix\|DocuSign\|schedule-pickup\|pending → processing\|estimatedWeight" .claude/CLAUDE.md
```
Expected: remaining hits only inside *Replaced (redesign…)* notes or history-marked blocks (e.g. the Order Model legacy block under its note). Then:

```bash
git add .claude/CLAUDE.md CLAUDE.md
git commit -m "docs: mark removed V1/scheduling/DocuSign flows as replaced; point handbook at redesign spec"
```

---

## Task 7: Final gate — full suite, madge, lint, parity, spec checklist

**Files:**
- Modify: `docs/superpowers/specs/2026-06-08-invite-bag-workflow-redesign-design.md` (line 837 — tick the PR 11 checklist box)

- [ ] **Step 1: Full suite**

Run: `npm test`
Expected: all suites pass. If any pre-existing test broke in Tasks 3–4 (assertions on the old inline-English email HTML), fix the assertion surgically — the copy change is intentional; do not skip tests.

- [ ] **Step 2: Circular-dependency + lint gates**

```bash
npx --yes madge --circular server/
npm run lint
```
Expected: `✔ No circular dependency found!` and a clean lint run.

- [ ] **Step 3: Parity checker final run**

Run: `npm run check:i18n`
Expected: `OK: 0 errors` (legacy-template warnings acceptable; copy them into the PR description as the documented backlog).

- [ ] **Step 4: Tick the spec build checklist**

In `docs/superpowers/specs/2026-06-08-invite-bag-workflow-redesign-design.md` line 837, change:
```
- [ ] PR 11 — all 4 languages shipped; new pages measured mobile + desktop
```
to:
```
- [x] PR 11 — all 4 languages shipped; new pages measured mobile + desktop
```

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/specs/2026-06-08-invite-bag-workflow-redesign-design.md
git commit -m "chore(redesign): PR 11 final gate — suite, madge, lint, i18n parity green; tick spec checklist"
```

---

## Verification

**Automated (run all; all must be green):**

```bash
npm test                                          # full suite, no --forceExit reliance
npm run check:i18n                                # OK: 0 errors
npx --yes madge --circular server/                # ✔ No circular dependency found!
npm run lint                                      # clean
for l in en es pt de; do node -e "JSON.parse(require('fs').readFileSync('public/locales/$l/common.json','utf8'))" && echo "$l ok"; done
```

**Manual smoke checks:**

1. Email language resolution end-to-end:
   ```bash
   node -e "require('dotenv').config(); require('./server/services/email/template-manager').loadTemplate('v2/payment-reminder','es').then(t=>console.log(t.slice(0,200)))"
   ```
   — must print the Spanish template, not the English default or the `[EMAIL_CONTENT]` fallback. Repeat for `('order-ready','de')` and `('customer-on-the-way','pt')`.
2. Claim page in all four languages: with the server + seeded bag from Task 5, open `…route=/claim&bag=<token>&lang=es` (then `pt`, `de`) — title/subtitle/CTA render translated, no raw `data-i18n` keys visible, zero console errors.
3. Lighthouse evidence: `/tmp/lh-claim-desktop.json` + `/tmp/lh-claim-mobile.json` exist with the recorded ~100 scores (Task 5 Step 5). After production deploy (not part of this PR), re-measure against the live origin per `docs/development/LIGHTHOUSE-QUALITY-BAR.md` (deploy to BOTH boxes, bump `?v=` on changed assets, `?lh=<ts>` cache-buster).
4. Handbook spot-check: open `.claude/CLAUDE.md` — top note references the redesign spec; Order Model / W-9 / Payment Flow sections carry *Replaced (redesign …)* notes; no Paygistix env vars or gateway URL remain outside history notes.

**PR description (use as-is):**

```
PR 11/11 — i18n completion + Lighthouse pass (redesign close-out)

- Adds scripts/check-i18n-parity.js (npm run check:i18n, unit-tested): flattened
  key-set parity across public/locales/{en,es,pt,de}/common.json, spec §10
  required-key manifest, email-template language parity incl. [PLACEHOLDER]
  token-set equality. Exits non-zero on drift — wire into CI at will.
- Fills every missing §10 key in all four locales (claim.*, claim.deliver.*,
  claim.reintake.*, claim.status.*, bag.label.*, admin.bags.*, admin.invites.*,
  admin.w9.*, affiliate.bags.*, affiliateRegister.invite/w9.*, operator.intake.*,
  affiliateDashboard.deliveryCode.*, customerDashboard.deliveryPin.*,
  admin.operators.scanCode.*, email.onTheWay.*, order.status.*) + legacy drift.
- Language-resolves the v2 payment emails (fixes sendV2PaymentReminder's broken
  direct template path) and ships es/pt/de copies of the v2 templates.
- Localizes Notification A (order-ready, gate "collect from store") via
  template-manager in 4 languages; deletes the dead pre-redesign
  sendOrderPickedUpNotification (PR 9's sendOrderOnTheWayEmail already ships
  the localized on-the-way email with the delivery PIN).
- Lighthouse on the new public claim page: desktop <scores>, mobile <scores>
  (all four categories; ?lh cache-buster per LIGHTHOUSE-QUALITY-BAR.md).
  Fixes applied: <list — e.g. meta description on embed-app-v2.html>.
- Docs: .claude/CLAUDE.md sections describing removed V1/scheduling/DocuSign
  flows now carry "Replaced (redesign)" notes pointing at the spec; root
  CLAUDE.md project state updated; spec §12 PR 11 checkbox ticked.
- Known backlog (warnings, pre-redesign scope): legacy email templates
  (affiliate-welcome etc.) still lack es/pt/de copies — listed by the checker.

Suite green; madge --circular server/ clean; npm run check:i18n → 0 errors.
```
