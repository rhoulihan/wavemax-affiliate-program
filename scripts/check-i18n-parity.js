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
  'claim.title', 'claim.subtitle', 'claim.cta',
  'claim.registeredTitle', 'claim.registeredBody',
  'claim.alreadyClaimedTitle', 'claim.alreadyClaimedBody',
  'claim.invalidTitle', 'claim.invalidBody', 'claim.raceLost', 'claim.resolving',
  'claim.deliver.title', 'claim.deliver.codeLabel', 'claim.deliver.codePlaceholder',
  'claim.deliver.geoOptIn', 'claim.deliver.rememberCode', 'claim.deliver.confirm',
  'claim.deliver.success', 'claim.deliver.badCode', 'claim.deliver.lockedOut',
  'claim.reintake.prompt', 'claim.reintake.confirm',
  'claim.scan.operatorCodeLabel',
  'claim.scan.staffTitle', 'claim.scan.staffIntro', 'claim.scan.codePlaceholder',
  'claim.scan.startSession', 'claim.scan.badCode', 'claim.scan.lockedOut',
  'claim.scan.paymentConfirmed', 'claim.scan.yes', 'claim.scan.no',
  'claim.scan.applied', 'claim.scan.scanNext', 'claim.scan.confirmGeneric',
  'claim.scan.stateChanged', 'claim.scan.undo', 'claim.scan.undone',
  'claim.scan.nothingToUndo', 'claim.scan.sessionActiveUntil',
  'claim.scan.sessionExpired', 'claim.scan.endSession', 'claim.scan.notRegistered',
  'claim.scan.networkError',
  'operator.scan.heading', 'operator.scan.subheading', 'operator.scan.tallyLabel',
  'operator.scan.legend.intake', 'operator.scan.legend.outForDelivery',
  'operator.scan.legend.complete', 'operator.scan.paymentConfirmed',
  'operator.scan.yes', 'operator.scan.no', 'operator.scan.undo',
  'operator.scan.applied', 'operator.scan.undone', 'operator.scan.nothingToUndo',
  'operator.scan.stateChanged', 'operator.scan.notRegistered',
  'operator.scan.networkError', 'operator.scan.confirmGeneric',
  'operator.scan.successTitle', 'operator.scan.errorTitle',
  'claim.status.in_progress', 'claim.status.processed', 'claim.status.ready_for_pickup',
  'claim.status.picked_up', 'claim.status.delivered',
  'bag.label.affiliateHeading', 'bag.label.bagRef', 'bag.label.printInstructions',
  'admin.bags.mint.title', 'admin.bags.mint.affiliate', 'admin.bags.mint.quantity',
  'admin.bags.mint.submit', 'admin.bags.mint.success', 'admin.bags.issue.confirm',
  'admin.bags.inventory.status.minted', 'admin.bags.inventory.status.issued',
  'admin.bags.inventory.status.active', 'admin.bags.inventory.status.retired',
  'affiliate.bags.inventory.title', 'affiliate.bags.inventory.empty',
  'affiliateRegister.invite.invalidOrExpired', 'affiliateRegister.invite.emailLocked',
  'operator.intake.weightLabel', 'operator.intake.addOns.premiumDetergent',
  'operator.intake.addOns.fabricSoftener', 'operator.intake.addOns.stainRemover',
  'operator.intake.freshFormAck', 'operator.intake.created',
  'operator.intake.error.bagNotActive', 'operator.intake.error.orderAlreadyOpen',
  'operator.intake.error.bagNotFound',
  'affiliateDashboard.deliveryCode.title', 'affiliateDashboard.deliveryCode.current',
  'affiliateDashboard.deliveryCode.reset', 'affiliateDashboard.deliveryCode.resetConfirm',
  'affiliateDashboard.deliveryCode.shownOnceNote', 'affiliateDashboard.deliverHelp',
  'admin.operators.scanCode.reset', 'admin.operators.scanCode.shownOnceNote',
  'email.onTheWay.deliveryPinNote',
  'order.status.in_progress', 'order.status.processed', 'order.status.ready_for_pickup',
  'order.status.picked_up', 'order.status.delivered', 'order.status.cancelled'
];

// Namespaces whose leaf names are owned by earlier PRs (5 = invites) — at
// least one key must exist under each prefix in en.
const REQUIRED_PREFIXES = ['admin.invites'];

// Spec §10 email templates that must resolve in all four languages via
// template-manager.loadTemplate(name, lang). Names are loadTemplate names (no
// .html). If an earlier PR shipped one of these under a different name, align
// THIS list with the shipped name (grep the dispatchers) — never ship two
// templates for one email.
const REQUIRED_EMAIL_TEMPLATES = [
  'affiliate-invite',
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
