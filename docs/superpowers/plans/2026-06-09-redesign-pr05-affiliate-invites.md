# PR 5 — AffiliateInvite + Invite-Bound Affiliate Registration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the (removed) BetaRequest gate with admin-minted, single-use, expiring, tokenized affiliate invites, and make `POST /api/v1/affiliates/register` invite-bound (email forced from the invite, atomic single-use consume with rollback on race loss).

**Architecture:** New domain module `server/modules/onboarding/` holds the `AffiliateInvite` model (only a SHA-256 hash of the token is persisted), `inviteService` (typed `InviteError`), and `inviteController`. Admin mint/list/resend/revoke endpoints mount under the existing `administratorRoutes` (authenticate + `checkRole(['administrator'])` + `checkAdminPermission(['manage_affiliates'])` + CSRF + `sensitiveOperationLimiter`); a public anti-enumeration validate endpoint mounts at `/api/v1/affiliate-invites/:token/validate`. The invite email is a new dispatcher (`server/services/email/dispatcher/onboarding.js`) + `affiliate-invite.html` template in en/es/pt/de; the frontend registration page reads `?invite=`, validates, prefills, and locks the email field.

**Tech Stack:** Node/Express, Mongoose, express-validator, Jest + Supertest + mongodb-memory-server (fallback), Winston, existing email transport/template-manager, vanilla-JS frontend under strict nonce CSP.

**Assumed starting state (PRs 1–4 of the redesign sequence are merged):**
- **PR 1** deleted V1 Paygistix. Not touched here.
- **PR 2** deleted BetaRequest end-to-end: `server/models/BetaRequest.js`, `affiliateController.submitBetaRequest` + the beta gate inside `registerAffiliate` (old lines 124–137 `BetaRequest.findOne(...)` / `isBetaRestriction`), the `/api/v1/affiliates/beta-request` route, the admin beta-request routes (`administratorRoutes.js` old lines 117–121), `server/services/email/dispatcher/beta.js` and its two lines in `dispatcher/index.js`, the `ensureBetaRequest` helper + `BetaRequest` usages in `tests/integration/passwordValidation.test.js` / `tests/integration/affiliate.test.js` / `tests/unit/affiliateController.test.js`, and `apiV1Router.use('/affiliates', affiliateScheduleRoutes)` in `server.js`. **Where this plan modifies code PR 2 also touched, it replaces whole functions/blocks so it applies cleanly regardless of PR 2's exact diff.** Quoted "current code" below is from pre-PR-2 main where noted.
- **PR 3** seeded `invite_token_ttl_hours` (default 72, range 1–336) in `SystemConfig.initializeDefaults()`. This plan always calls `SystemConfig.getValue('invite_token_ttl_hours', 72)` with the default fallback, so it is green even if the seed task ordered differently.
- **PR 4** (order state machine) is untouched by this PR.
- Repo facts verified against main: `encryptionUtil.generateToken(length=32)` returns `crypto.randomBytes(length).toString('hex')` (`server/utils/encryption.js:139`); `apiLimiter` is applied globally to all of `/api/` (`server.js:594`); CSRF is enforced on non-GET `/api` mutations by `conditionalCsrf` (tests send `x-csrf-token`); `ControllerHelpers.sendSuccess(res, data, message, statusCode)` / `sendError(res, message, statusCode, errors)`; email templates load via `loadTemplate(name, lang)` from `server/templates/emails/{lang}/{name}.html` with English top-level fallback and `[PLACEHOLDER]` filling (case-tolerant) via `fillTemplate`; the email transport **blocks attachments** — the invite is a link, never an attachment.
- **Out of scope for this PR (explicit):** the W-9 multipart upload field on registration is **PR 10** — registration here stays **JSON-only**. The OAuth affiliate path (`POST /api/v1/auth/social/register`) is not invite-gated in this PR (spec §6.2 gates the traditional path; flag any product decision separately). Service-area fields (`serviceLatitude`/`serviceLongitude`/`serviceRadius` + `serviceLocation`) were already removed from the model, route validators, and `registerAffiliate` by **PR 2 Task 10** — this PR's listings assume the post-PR-2 shape (no `service*` identifiers anywhere) and must not reintroduce them. (`serviceArea`, the plain string, survives PR 2 and stays.)

**Canonical interfaces this PR must honor (spec §4.2 / §6.2, verbatim):**
- `AffiliateInvite`: `inviteId` `'INV-'+uuid`; `tokenHash` = sha256(raw) hex; raw token = `encryptionUtil.generateToken(32)` (64 hex chars), **never persisted**; `email` (lowercase/trim); `prefill{firstName,lastName,businessName,phone}`; `status ∈ ['pending','accepted','expired','revoked']`; `expiresAt` from `invite_token_ttl_hours` (default 72); statics `hashToken(raw)`, `consume(rawToken,{affiliateId})` atomic single-use.
- `inviteService`: `createInvite({email,prefill,ttlHours,adminId})`, `validateInvite(rawToken)`, `consumeInvite(rawToken, affiliateId)`, `resendInvite`, `revokeInvite`; throws typed `InviteError`.
- Invite URL: `https://wavemax.promo/embed-app-v2.html?route=/affiliate-register&invite=<raw>`.
- Admin RBAC permission key: **`manage_affiliates`** (never `affiliates.manage`).
- Audit events: `INVITE_MINTED` / `INVITE_CONSUMED` / `INVITE_REVOKED`.

Run all commands from the repo root: `/mnt/c/Users/rickh/GitHub/wavemax-affiliate-program`.

---

## Task 1: `AffiliateInvite` model

**Files:**
- Create: `tests/unit/affiliateInvite.test.js`
- Create: `server/modules/onboarding/AffiliateInvite.js`

### Steps

- [ ] **1.1 Write the failing model test.** Create `tests/unit/affiliateInvite.test.js`:

```javascript
const mongoose = require('mongoose');
const AffiliateInvite = require('../../server/modules/onboarding/AffiliateInvite');
const encryptionUtil = require('../../server/utils/encryption');

describe('AffiliateInvite model', () => {
  beforeEach(async () => {
    await AffiliateInvite.deleteMany({});
  });

  const makeInvite = (overrides = {}) => {
    const raw = encryptionUtil.generateToken(32); // 64 hex chars
    return {
      raw,
      doc: {
        tokenHash: AffiliateInvite.hashToken(raw),
        email: 'Invitee@Example.com',
        prefill: { firstName: 'Ina', lastName: 'Vite', businessName: 'Vite LLC', phone: '555-0100' },
        expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
        createdBy: new mongoose.Types.ObjectId(),
        ...overrides
      }
    };
  };

  test('hashToken is deterministic sha256 hex and never equals the raw token', () => {
    const raw = encryptionUtil.generateToken(32);
    const h1 = AffiliateInvite.hashToken(raw);
    const h2 = AffiliateInvite.hashToken(raw);
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
    expect(h1).not.toBe(raw);
    expect(AffiliateInvite.hashToken('other')).not.toBe(h1);
  });

  test('generates an INV- prefixed inviteId, lowercases email, defaults status pending', async () => {
    const { doc } = makeInvite();
    const invite = await AffiliateInvite.create(doc);
    expect(invite.inviteId).toMatch(/^INV-[0-9a-f-]{36}$/);
    expect(invite.email).toBe('invitee@example.com');
    expect(invite.status).toBe('pending');
    expect(invite.resendCount).toBe(0);
  });

  test('consume flips a pending, unexpired invite exactly once (single-use)', async () => {
    const { raw, doc } = makeInvite();
    await AffiliateInvite.create(doc);

    const first = await AffiliateInvite.consume(raw, { affiliateId: 'AFF-111' });
    expect(first).not.toBeNull();
    expect(first.status).toBe('accepted');
    expect(first.acceptedAffiliateId).toBe('AFF-111');
    expect(first.acceptedAt).toBeInstanceOf(Date);

    const second = await AffiliateInvite.consume(raw, { affiliateId: 'AFF-222' });
    expect(second).toBeNull();
  });

  test('consume returns null for an expired invite', async () => {
    const { raw, doc } = makeInvite({ expiresAt: new Date(Date.now() - 1000) });
    await AffiliateInvite.create(doc);
    expect(await AffiliateInvite.consume(raw, { affiliateId: 'AFF-111' })).toBeNull();
  });

  test('consume returns null for an unknown token', async () => {
    expect(await AffiliateInvite.consume('deadbeef'.repeat(8), { affiliateId: 'AFF-111' })).toBeNull();
  });

  test('concurrent consume has exactly one winner', async () => {
    const { raw, doc } = makeInvite();
    await AffiliateInvite.create(doc);
    const results = await Promise.all([
      AffiliateInvite.consume(raw, { affiliateId: 'AFF-A' }),
      AffiliateInvite.consume(raw, { affiliateId: 'AFF-B' })
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
    const final = await AffiliateInvite.findOne({ tokenHash: AffiliateInvite.hashToken(raw) });
    expect(final.status).toBe('accepted');
    expect(['AFF-A', 'AFF-B']).toContain(final.acceptedAffiliateId);
  });

  test('rejects an invalid status value', async () => {
    const { doc } = makeInvite({ status: 'bogus' });
    await expect(AffiliateInvite.create(doc)).rejects.toThrow(/bogus/);
  });
});
```

- [ ] **1.2 Run it — expect failure for the right reason** (module does not exist):

```bash
npm test -- tests/unit/affiliateInvite.test.js
```

Expected: `Cannot find module '../../server/modules/onboarding/AffiliateInvite'`.

- [ ] **1.3 Implement the model.** Create `server/modules/onboarding/AffiliateInvite.js` (spec §4.2 verbatim; the only addition is the `default` generator on `inviteId`, matching the house `'{PREFIX}-' + uuidv4()` pattern from `server/models/Affiliate.js:12`):

```javascript
// AffiliateInvite — admin-minted, single-use, expiring invite for affiliate
// onboarding (spec §4.2). The raw token is NEVER persisted: only its SHA-256
// hash is stored; the raw value exists solely in the emailed link.

const mongoose = require('mongoose');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

const affiliateInviteSchema = new mongoose.Schema({
  inviteId:  { type: String, unique: true, index: true, default: () => 'INV-' + uuidv4() },
  tokenHash: { type: String, required: true, index: true },   // sha256(rawToken), hex
  email:     { type: String, required: true, lowercase: true, trim: true, index: true },
  prefill: { firstName: String, lastName: String, businessName: String, phone: String }, // read-only hints
  status:    { type: String, enum: ['pending', 'accepted', 'expired', 'revoked'], default: 'pending', index: true },
  expiresAt: { type: Date, required: true, index: true },      // now + invite_token_ttl_hours
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Administrator', required: true },
  acceptedAt: Date,
  acceptedAffiliateId: String,                                 // the AFF-… created on accept
  revokedAt: Date,
  revokedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Administrator' },
  sentAt:    Date,
  resendCount: { type: Number, default: 0 }
}, { timestamps: true });

affiliateInviteSchema.statics.hashToken = (raw) =>
  crypto.createHash('sha256').update(raw).digest('hex');

// Atomic single-use consume: only flips a pending, unexpired invite to accepted.
affiliateInviteSchema.statics.consume = function (rawToken, { affiliateId }) {
  return this.findOneAndUpdate(
    { tokenHash: this.hashToken(rawToken), status: 'pending', expiresAt: { $gt: new Date() } },
    { $set: { status: 'accepted', acceptedAt: new Date(), acceptedAffiliateId: affiliateId } },
    { new: true }
  );
};

module.exports = mongoose.model('AffiliateInvite', affiliateInviteSchema);
```

- [ ] **1.4 Run again — expect pass:**

```bash
npm test -- tests/unit/affiliateInvite.test.js
```

Expected: 7 passed.

- [ ] **1.5 Commit:**

```bash
git add server/modules/onboarding/AffiliateInvite.js tests/unit/affiliateInvite.test.js
git commit -m "feat(onboarding): AffiliateInvite model with hashed token and atomic single-use consume"
```

---

## Task 2: Invite email — onboarding dispatcher + 4-language template

**Files:**
- Create: `tests/unit/onboardingEmail.test.js`
- Create: `server/services/email/dispatcher/onboarding.js`
- Create: `server/templates/emails/en/affiliate-invite.html`
- Create: `server/templates/emails/es/affiliate-invite.html` (new `es/` dir)
- Create: `server/templates/emails/pt/affiliate-invite.html` (new `pt/` dir)
- Create: `server/templates/emails/de/affiliate-invite.html` (new `de/` dir)
- Modify: `server/services/email/dispatcher/index.js`

**Conventions read from the repo:** `template-manager.loadTemplate(name, lang)` reads `server/templates/emails/{lang}/{name}.html` and falls back to English (`server/services/email/template-manager.js:24-38`); `fillTemplate` replaces `[KEY]` tokens case-tolerantly (so data keys `invite_url`/`expires_at` fill `[INVITE_URL]`/`[EXPIRES_AT]`); transport signature is `sendEmail(to, subject, html)` (`server/services/email/transport.js:56`); subjects live in dispatcher code (per-language map). Only `en/` exists today — `es/`, `pt/`, `de/` template dirs are created here (loadTemplate already supports them).

### Steps

- [ ] **2.1 Write the failing dispatcher test.** Create `tests/unit/onboardingEmail.test.js`:

```javascript
// Mock the transport BEFORE requiring the dispatcher (house rule).
jest.mock('../../server/services/email/transport', () => ({
  sendEmail: jest.fn().mockResolvedValue(true)
}));

const fs = require('fs');
const path = require('path');
const { sendEmail } = require('../../server/services/email/transport');
const onboarding = require('../../server/services/email/dispatcher/onboarding');

describe('onboarding email dispatcher — sendAffiliateInviteEmail', () => {
  beforeEach(() => jest.clearAllMocks());

  test.each(['en', 'es', 'pt', 'de'])(
    '%s affiliate-invite template exists with the canonical placeholders and no script',
    (lang) => {
      const file = path.join(__dirname, '../../server/templates/emails', lang, 'affiliate-invite.html');
      const html = fs.readFileSync(file, 'utf8');
      expect(html).toContain('[INVITE_URL]');
      expect(html).toContain('[EXPIRES_AT]');
      expect(html).toContain('[FIRST_NAME]');
      expect(html).not.toMatch(/<script/i);
    }
  );

  test('fills invite_url / expires_at / first_name and sends with a language-specific subject', async () => {
    await onboarding.sendAffiliateInviteEmail({
      email: 'invitee@example.com',
      firstName: 'Ina',
      inviteUrl: 'https://wavemax.promo/embed-app-v2.html?route=/affiliate-register&invite=abc123',
      expiresAt: new Date('2026-06-12T12:00:00Z'),
      language: 'es'
    });

    expect(sendEmail).toHaveBeenCalledTimes(1);
    const [to, subject, html] = sendEmail.mock.calls[0];
    expect(to).toBe('invitee@example.com');
    expect(subject.toLowerCase()).toContain('invitaci'); // "invitación"
    expect(html).toContain('route=/affiliate-register&invite=abc123');
    expect(html).toContain('Ina');
    expect(html).not.toContain('[INVITE_URL]');
    expect(html).not.toContain('[EXPIRES_AT]');
  });

  test('falls back to English for an unknown language', async () => {
    await onboarding.sendAffiliateInviteEmail({
      email: 'invitee@example.com',
      firstName: 'Ina',
      inviteUrl: 'https://wavemax.promo/embed-app-v2.html?route=/affiliate-register&invite=abc123',
      expiresAt: new Date('2026-06-12T12:00:00Z'),
      language: 'fr'
    });
    const [, subject] = sendEmail.mock.calls[0];
    expect(subject).toBe('Your WaveMAX Affiliate Invitation');
  });

  test('propagates transport failure to the caller', async () => {
    sendEmail.mockRejectedValueOnce(new Error('smtp down'));
    await expect(onboarding.sendAffiliateInviteEmail({
      email: 'invitee@example.com',
      firstName: 'Ina',
      inviteUrl: 'https://x',
      expiresAt: new Date(),
      language: 'en'
    })).rejects.toThrow('smtp down');
  });
});
```

- [ ] **2.2 Run it — expect failure** (`Cannot find module '.../dispatcher/onboarding'`):

```bash
npm test -- tests/unit/onboardingEmail.test.js
```

- [ ] **2.3 Create the dispatcher.** `server/services/email/dispatcher/onboarding.js`:

```javascript
// Onboarding email dispatchers — affiliate invites (spec §6.2).
//
// LOAD-BEARING CONSTRAINT: the mail transport blocks attachments (upstream
// policy — see transport.js). The invite is therefore a LINK, never a file.
// Never log the invite URL or raw token — only the inviteId/email.

const { loadTemplate, fillTemplate } = require('../template-manager');
const { sendEmail } = require('../transport');
const logger = require('../../../utils/logger');

const SUBJECTS = {
  en: 'Your WaveMAX Affiliate Invitation',
  es: 'Su invitación de afiliado de WaveMAX',
  pt: 'Seu convite de afiliado WaveMAX',
  de: 'Ihre WaveMAX-Partner-Einladung'
};

const DATE_LOCALES = { en: 'en-US', es: 'es-ES', pt: 'pt-BR', de: 'de-DE' };

/**
 * Send the single-use affiliate invite email.
 *
 * @param {Object} params
 * @param {string} params.email      Recipient — the invite's locked email
 * @param {string} [params.firstName] Prefill first name ('' tolerated)
 * @param {string} params.inviteUrl  Full registration URL carrying the raw token
 * @param {Date|string} params.expiresAt Invite expiry timestamp
 * @param {string} [params.language='en'] en|es|pt|de (anything else → en)
 * @returns {Promise<boolean>} true once handed to the transport
 * @throws transport errors are propagated — the caller decides whether the
 *         failure is fatal (inviteService treats mint-time failure as
 *         non-fatal: the row stays resendable).
 */
exports.sendAffiliateInviteEmail = async function sendAffiliateInviteEmail({
  email, firstName, inviteUrl, expiresAt, language = 'en'
}) {
  const lang = SUBJECTS[language] ? language : 'en';
  const template = await loadTemplate('affiliate-invite', lang);
  const html = fillTemplate(template, {
    first_name: firstName || '',
    invite_url: inviteUrl,
    expires_at: new Date(expiresAt).toLocaleString(DATE_LOCALES[lang], {
      dateStyle: 'long',
      timeStyle: 'short'
    })
  });
  await sendEmail(email, SUBJECTS[lang], html);
  logger.info('Affiliate invite email sent', { email });
  return true;
};

module.exports = exports;
```

- [ ] **2.4 Create the four templates.** All four share one structure (modeled on `server/templates/emails/en/affiliate-welcome.html`: inline `<style>`, `.container/.header/.content/.button/.footer`, CRHS copyright). Placeholders: `[FIRST_NAME]`, `[INVITE_URL]`, `[EXPIRES_AT]`.

`server/templates/emails/en/affiliate-invite.html`:

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your WaveMAX Affiliate Invitation</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333333; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #1e3a8a; color: #ffffff !important; padding: 20px; text-align: center; }
    .content { padding: 20px; background-color: #ffffff; }
    .button { display: inline-block; background-color: #1e3a8a !important; color: #ffffff !important; padding: 12px 24px; text-decoration: none !important; border-radius: 4px; font-weight: bold; text-align: center; }
    a.button:link, a.button:visited, a.button:hover, a.button:active { color: #ffffff !important; text-decoration: none !important; }
    .notice { background-color: #fff8e1; border-left: 4px solid #f59e0b; padding: 12px 16px; margin: 20px 0; font-size: 14px; }
    .footer { background-color: #f5f5f5; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>You're Invited to Become a WaveMAX Affiliate</h1>
    </div>
    <div class="content">
      <p>Hi [FIRST_NAME],</p>
      <p>You have been invited to join the WaveMAX Laundry Affiliate Program. Click the button below to complete your registration — your email address is already linked to this invitation.</p>
      <center>
        <a href="[INVITE_URL]" class="button">Complete Your Registration</a>
      </center>
      <div class="notice">
        <p>This invitation link is unique to you, can be used only once, and expires on <strong>[EXPIRES_AT]</strong>. Please do not share it.</p>
      </div>
      <p>If you were not expecting this invitation, you can ignore this email.</p>
      <p>Best regards,<br>The WaveMAX Team</p>
    </div>
    <div class="footer">
      <p>&copy; 2025 CRHS Enterprises, LLC. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
```

`server/templates/emails/es/affiliate-invite.html` — same markup/styles; translated copy:

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Su invitación de afiliado de WaveMAX</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333333; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #1e3a8a; color: #ffffff !important; padding: 20px; text-align: center; }
    .content { padding: 20px; background-color: #ffffff; }
    .button { display: inline-block; background-color: #1e3a8a !important; color: #ffffff !important; padding: 12px 24px; text-decoration: none !important; border-radius: 4px; font-weight: bold; text-align: center; }
    a.button:link, a.button:visited, a.button:hover, a.button:active { color: #ffffff !important; text-decoration: none !important; }
    .notice { background-color: #fff8e1; border-left: 4px solid #f59e0b; padding: 12px 16px; margin: 20px 0; font-size: 14px; }
    .footer { background-color: #f5f5f5; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Está invitado a ser afiliado de WaveMAX</h1>
    </div>
    <div class="content">
      <p>Hola [FIRST_NAME]:</p>
      <p>Ha sido invitado a unirse al Programa de Afiliados de WaveMAX Laundry. Haga clic en el botón a continuación para completar su registro: su dirección de correo electrónico ya está vinculada a esta invitación.</p>
      <center>
        <a href="[INVITE_URL]" class="button">Completar mi registro</a>
      </center>
      <div class="notice">
        <p>Este enlace de invitación es único para usted, solo puede usarse una vez y expira el <strong>[EXPIRES_AT]</strong>. Por favor, no lo comparta.</p>
      </div>
      <p>Si no esperaba esta invitación, puede ignorar este correo.</p>
      <p>Atentamente,<br>El equipo de WaveMAX</p>
    </div>
    <div class="footer">
      <p>&copy; 2025 CRHS Enterprises, LLC. Todos los derechos reservados.</p>
    </div>
  </div>
</body>
</html>
```

`server/templates/emails/pt/affiliate-invite.html` — same markup/styles; translated copy:

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Seu convite de afiliado WaveMAX</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333333; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #1e3a8a; color: #ffffff !important; padding: 20px; text-align: center; }
    .content { padding: 20px; background-color: #ffffff; }
    .button { display: inline-block; background-color: #1e3a8a !important; color: #ffffff !important; padding: 12px 24px; text-decoration: none !important; border-radius: 4px; font-weight: bold; text-align: center; }
    a.button:link, a.button:visited, a.button:hover, a.button:active { color: #ffffff !important; text-decoration: none !important; }
    .notice { background-color: #fff8e1; border-left: 4px solid #f59e0b; padding: 12px 16px; margin: 20px 0; font-size: 14px; }
    .footer { background-color: #f5f5f5; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Você foi convidado a ser um afiliado WaveMAX</h1>
    </div>
    <div class="content">
      <p>Olá, [FIRST_NAME]!</p>
      <p>Você foi convidado a participar do Programa de Afiliados da WaveMAX Laundry. Clique no botão abaixo para concluir seu cadastro — seu endereço de e-mail já está vinculado a este convite.</p>
      <center>
        <a href="[INVITE_URL]" class="button">Concluir meu cadastro</a>
      </center>
      <div class="notice">
        <p>Este link de convite é exclusivo para você, pode ser usado apenas uma vez e expira em <strong>[EXPIRES_AT]</strong>. Por favor, não o compartilhe.</p>
      </div>
      <p>Se você não esperava este convite, pode ignorar este e-mail.</p>
      <p>Atenciosamente,<br>Equipe WaveMAX</p>
    </div>
    <div class="footer">
      <p>&copy; 2025 CRHS Enterprises, LLC. Todos os direitos reservados.</p>
    </div>
  </div>
</body>
</html>
```

`server/templates/emails/de/affiliate-invite.html` — same markup/styles; translated copy:

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ihre WaveMAX-Partner-Einladung</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333333; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #1e3a8a; color: #ffffff !important; padding: 20px; text-align: center; }
    .content { padding: 20px; background-color: #ffffff; }
    .button { display: inline-block; background-color: #1e3a8a !important; color: #ffffff !important; padding: 12px 24px; text-decoration: none !important; border-radius: 4px; font-weight: bold; text-align: center; }
    a.button:link, a.button:visited, a.button:hover, a.button:active { color: #ffffff !important; text-decoration: none !important; }
    .notice { background-color: #fff8e1; border-left: 4px solid #f59e0b; padding: 12px 16px; margin: 20px 0; font-size: 14px; }
    .footer { background-color: #f5f5f5; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Sie sind eingeladen, WaveMAX-Partner zu werden</h1>
    </div>
    <div class="content">
      <p>Hallo [FIRST_NAME],</p>
      <p>Sie wurden eingeladen, dem WaveMAX Laundry Partnerprogramm beizutreten. Klicken Sie auf die Schaltfläche unten, um Ihre Registrierung abzuschließen — Ihre E-Mail-Adresse ist bereits mit dieser Einladung verknüpft.</p>
      <center>
        <a href="[INVITE_URL]" class="button">Registrierung abschließen</a>
      </center>
      <div class="notice">
        <p>Dieser Einladungslink ist einmalig für Sie bestimmt, kann nur einmal verwendet werden und läuft am <strong>[EXPIRES_AT]</strong> ab. Bitte geben Sie ihn nicht weiter.</p>
      </div>
      <p>Falls Sie diese Einladung nicht erwartet haben, können Sie diese E-Mail ignorieren.</p>
      <p>Mit freundlichen Grüßen<br>Ihr WaveMAX-Team</p>
    </div>
    <div class="footer">
      <p>&copy; 2025 CRHS Enterprises, LLC. Alle Rechte vorbehalten.</p>
    </div>
  </div>
</body>
</html>
```

- [ ] **2.5 Wire the dispatcher into the aggregate index.** In `server/services/email/dispatcher/index.js` (post-PR-2 this file no longer has the `beta` lines): add a require after the `payment` require and a spread after `...payment,`:

```javascript
const payment = require('./payment');
const onboarding = require('./onboarding');
```

and in the `module.exports` object:

```javascript
  ...payment,
  ...onboarding,
```

- [ ] **2.6 Run — expect pass:**

```bash
npm test -- tests/unit/onboardingEmail.test.js
```

Expected: 7 passed (4 template tests + 3 behavior tests).

- [ ] **2.7 Commit:**

```bash
git add server/services/email/dispatcher/onboarding.js server/services/email/dispatcher/index.js server/templates/emails/en/affiliate-invite.html server/templates/emails/es/affiliate-invite.html server/templates/emails/pt/affiliate-invite.html server/templates/emails/de/affiliate-invite.html tests/unit/onboardingEmail.test.js
git commit -m "feat(email): affiliate-invite dispatcher + en/es/pt/de templates (link-only, no attachments)"
```

---

## Task 3: `inviteService` with typed `InviteError`

**Files:**
- Create: `tests/unit/inviteService.test.js`
- Create: `server/modules/onboarding/inviteService.js`

### Steps

- [ ] **3.1 Write the failing service test.** Create `tests/unit/inviteService.test.js`:

```javascript
// Mock the email dispatcher BEFORE requiring the service (house rule).
jest.mock('../../server/services/email/dispatcher/onboarding', () => ({
  sendAffiliateInviteEmail: jest.fn().mockResolvedValue(true)
}));

const mongoose = require('mongoose');
const onboardingEmail = require('../../server/services/email/dispatcher/onboarding');
const inviteService = require('../../server/modules/onboarding/inviteService');
const { InviteError } = inviteService;
const AffiliateInvite = require('../../server/modules/onboarding/AffiliateInvite');

describe('inviteService', () => {
  const adminId = new mongoose.Types.ObjectId();

  beforeEach(async () => {
    await AffiliateInvite.deleteMany({});
    jest.clearAllMocks();
    onboardingEmail.sendAffiliateInviteEmail.mockResolvedValue(true);
  });

  describe('createInvite', () => {
    test('persists only the hash, returns a 64-hex raw token, emails the invite URL', async () => {
      const { invite, rawToken } = await inviteService.createInvite({
        email: 'New.Affiliate@Example.com',
        prefill: { firstName: 'Nia', lastName: 'Liate' },
        adminId
      });

      expect(rawToken).toMatch(/^[0-9a-f]{64}$/);
      expect(invite.email).toBe('new.affiliate@example.com');
      expect(invite.status).toBe('pending');
      expect(invite.tokenHash).toBe(AffiliateInvite.hashToken(rawToken));
      // Raw token must never be persisted anywhere on the document.
      expect(JSON.stringify(invite.toObject())).not.toContain(rawToken);

      // TTL default 72h (invite_token_ttl_hours)
      const ttlMs = invite.expiresAt.getTime() - Date.now();
      expect(ttlMs).toBeGreaterThan(71 * 60 * 60 * 1000);
      expect(ttlMs).toBeLessThanOrEqual(72 * 60 * 60 * 1000);

      expect(onboardingEmail.sendAffiliateInviteEmail).toHaveBeenCalledTimes(1);
      const arg = onboardingEmail.sendAffiliateInviteEmail.mock.calls[0][0];
      expect(arg.email).toBe('new.affiliate@example.com');
      expect(arg.inviteUrl).toBe(
        `https://wavemax.promo/embed-app-v2.html?route=/affiliate-register&invite=${rawToken}`
      );
      expect(invite.sentAt).toBeInstanceOf(Date);
    });

    test('rejects a second pending invite for the same email with 409 duplicate_pending', async () => {
      await inviteService.createInvite({ email: 'dup@example.com', adminId });
      await expect(inviteService.createInvite({ email: 'DUP@example.com', adminId }))
        .rejects.toMatchObject({ name: 'InviteError', code: 'duplicate_pending', statusCode: 409 });
    });

    test('email send failure does NOT fail the mint — the row stays resendable', async () => {
      onboardingEmail.sendAffiliateInviteEmail.mockRejectedValueOnce(new Error('smtp down'));
      const { invite } = await inviteService.createInvite({ email: 'flaky@example.com', adminId });
      expect(invite.status).toBe('pending');
      expect(invite.sentAt).toBeUndefined();
      const persisted = await AffiliateInvite.findOne({ email: 'flaky@example.com' });
      expect(persisted).not.toBeNull();
    });
  });

  describe('validateInvite', () => {
    test('returns the invite for a valid pending token', async () => {
      const { rawToken } = await inviteService.createInvite({ email: 'ok@example.com', adminId });
      const invite = await inviteService.validateInvite(rawToken);
      expect(invite.email).toBe('ok@example.com');
    });

    test('unknown token → InviteError invalid 410', async () => {
      await expect(inviteService.validateInvite('ab'.repeat(32)))
        .rejects.toMatchObject({ code: 'invalid', statusCode: 410 });
    });

    test('expired-but-pending token → InviteError expired 410 (lazy expiry)', async () => {
      const { invite, rawToken } = await inviteService.createInvite({ email: 'old@example.com', adminId });
      await AffiliateInvite.updateOne({ _id: invite._id }, { expiresAt: new Date(Date.now() - 1000) });
      await expect(inviteService.validateInvite(rawToken))
        .rejects.toMatchObject({ code: 'expired', statusCode: 410 });
    });

    test('revoked token → InviteError invalid 410 (no oracle)', async () => {
      const { invite, rawToken } = await inviteService.createInvite({ email: 'rev@example.com', adminId });
      await inviteService.revokeInvite({ inviteId: invite.inviteId, adminId });
      await expect(inviteService.validateInvite(rawToken))
        .rejects.toMatchObject({ code: 'invalid', statusCode: 410 });
    });

    test('accepted token → InviteError already_used 409', async () => {
      const { rawToken } = await inviteService.createInvite({ email: 'used@example.com', adminId });
      await inviteService.consumeInvite(rawToken, 'AFF-1');
      await expect(inviteService.validateInvite(rawToken))
        .rejects.toMatchObject({ code: 'already_used', statusCode: 409 });
    });
  });

  describe('consumeInvite', () => {
    test('is single-use: first call wins, second returns null', async () => {
      const { rawToken } = await inviteService.createInvite({ email: 'once@example.com', adminId });
      const first = await inviteService.consumeInvite(rawToken, 'AFF-1');
      expect(first.status).toBe('accepted');
      expect(first.acceptedAffiliateId).toBe('AFF-1');
      expect(await inviteService.consumeInvite(rawToken, 'AFF-2')).toBeNull();
    });
  });

  describe('resendInvite', () => {
    test('re-mints the token: old link dies, new one validates, counters bump', async () => {
      const { invite, rawToken: oldRaw } = await inviteService.createInvite({ email: 're@example.com', adminId });
      const { rawToken: newRaw } = await inviteService.resendInvite({ inviteId: invite.inviteId, adminId });

      expect(newRaw).not.toBe(oldRaw);
      await expect(inviteService.validateInvite(oldRaw))
        .rejects.toMatchObject({ code: 'invalid' });
      const revalidated = await inviteService.validateInvite(newRaw);
      expect(revalidated.resendCount).toBe(1);
      expect(onboardingEmail.sendAffiliateInviteEmail).toHaveBeenCalledTimes(2);
    });

    test('resend refreshes the expiry of an expired-but-pending invite', async () => {
      const { invite } = await inviteService.createInvite({ email: 'stale@example.com', adminId });
      await AffiliateInvite.updateOne({ _id: invite._id }, { expiresAt: new Date(Date.now() - 1000) });
      const { rawToken } = await inviteService.resendInvite({ inviteId: invite.inviteId, adminId });
      const revived = await inviteService.validateInvite(rawToken);
      expect(revived.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    test('resend on a non-pending invite → 409 not_pending', async () => {
      const { invite, rawToken } = await inviteService.createInvite({ email: 'done@example.com', adminId });
      await inviteService.consumeInvite(rawToken, 'AFF-1');
      await expect(inviteService.resendInvite({ inviteId: invite.inviteId, adminId }))
        .rejects.toMatchObject({ code: 'not_pending', statusCode: 409 });
    });
  });

  describe('revokeInvite', () => {
    test('flips pending → revoked with audit fields', async () => {
      const { invite } = await inviteService.createInvite({ email: 'bye@example.com', adminId });
      const revoked = await inviteService.revokeInvite({ inviteId: invite.inviteId, adminId });
      expect(revoked.status).toBe('revoked');
      expect(revoked.revokedAt).toBeInstanceOf(Date);
      expect(String(revoked.revokedBy)).toBe(String(adminId));
    });

    test('revoke on an accepted invite → 409 not_pending', async () => {
      const { invite, rawToken } = await inviteService.createInvite({ email: 'gone@example.com', adminId });
      await inviteService.consumeInvite(rawToken, 'AFF-1');
      await expect(inviteService.revokeInvite({ inviteId: invite.inviteId, adminId }))
        .rejects.toMatchObject({ code: 'not_pending', statusCode: 409 });
    });
  });
});
```

- [ ] **3.2 Run — expect failure** (`Cannot find module '../../server/modules/onboarding/inviteService'`):

```bash
npm test -- tests/unit/inviteService.test.js
```

- [ ] **3.3 Implement the service.** Create `server/modules/onboarding/inviteService.js`:

```javascript
// inviteService — mint / validate / consume / resend / revoke single-use
// affiliate invites (spec §6.2). Raw tokens exist only in the emailed link;
// the DB stores sha256 hashes. Never log a raw token.

const AffiliateInvite = require('./AffiliateInvite');
const SystemConfig = require('../../models/SystemConfig');
const encryptionUtil = require('../../utils/encryption');
const onboardingEmail = require('../../services/email/dispatcher/onboarding');
const logger = require('../../utils/logger');

/**
 * Typed domain error. `code` is machine-readable; `statusCode` maps to HTTP.
 * Codes: invalid | expired | already_used | duplicate_pending | not_found | not_pending
 */
class InviteError extends Error {
  constructor(code, statusCode) {
    super(code);
    this.name = 'InviteError';
    this.code = code;
    this.statusCode = statusCode;
    Error.captureStackTrace(this, this.constructor);
  }
}

function buildInviteUrl(rawToken) {
  const baseUrl = process.env.BASE_URL || 'https://wavemax.promo';
  return `${baseUrl}/embed-app-v2.html?route=/affiliate-register&invite=${rawToken}`;
}

async function inviteTtlHours() {
  return SystemConfig.getValue('invite_token_ttl_hours', 72);
}

/**
 * Mint a single-use invite and email the link.
 * Email-send failure is NOT fatal — the row stays pending and resendable.
 * @returns {{ invite, rawToken }} rawToken is returned ONLY so the caller can
 *          build flows in-process (tests, registration); it must never be
 *          exposed on an API response or logged.
 * @throws InviteError('duplicate_pending', 409) if a live pending invite exists.
 */
async function createInvite({ email, prefill = {}, ttlHours, adminId }) {
  const normalizedEmail = String(email).toLowerCase().trim();

  const existing = await AffiliateInvite.findOne({
    email: normalizedEmail,
    status: 'pending',
    expiresAt: { $gt: new Date() }
  });
  if (existing) throw new InviteError('duplicate_pending', 409);

  const ttl = ttlHours || await inviteTtlHours();
  const rawToken = encryptionUtil.generateToken(32); // 64 hex chars, CSPRNG
  const invite = await AffiliateInvite.create({
    tokenHash: AffiliateInvite.hashToken(rawToken),
    email: normalizedEmail,
    prefill: {
      firstName: prefill.firstName,
      lastName: prefill.lastName,
      businessName: prefill.businessName,
      phone: prefill.phone
    },
    expiresAt: new Date(Date.now() + ttl * 60 * 60 * 1000),
    createdBy: adminId
  });

  try {
    await onboardingEmail.sendAffiliateInviteEmail({
      email: invite.email,
      firstName: invite.prefill.firstName,
      inviteUrl: buildInviteUrl(rawToken),
      expiresAt: invite.expiresAt
    });
    invite.sentAt = new Date();
    await invite.save();
  } catch (err) {
    logger.warn('Invite email failed to send; invite remains resendable', {
      inviteId: invite.inviteId, error: err.message
    });
  }

  return { invite, rawToken };
}

/**
 * Resolve a raw token to its live pending invite.
 * @throws InviteError invalid(410) | expired(410) | already_used(409)
 */
async function validateInvite(rawToken) {
  if (!rawToken || typeof rawToken !== 'string') throw new InviteError('invalid', 410);
  const invite = await AffiliateInvite.findOne({ tokenHash: AffiliateInvite.hashToken(rawToken) });
  if (!invite) throw new InviteError('invalid', 410);
  if (invite.status === 'accepted') throw new InviteError('already_used', 409);
  if (invite.status !== 'pending') throw new InviteError('invalid', 410); // revoked/expired-status — no oracle
  if (invite.expiresAt <= new Date()) throw new InviteError('expired', 410); // lazy expiry
  return invite;
}

/**
 * Atomic single-use consume (thin wrapper over the model static).
 * @returns the accepted invite, or null if the caller lost the race.
 */
async function consumeInvite(rawToken, affiliateId) {
  return AffiliateInvite.consume(rawToken, { affiliateId });
}

/**
 * Re-mint the token for a pending invite (old link dies), refresh expiry,
 * bump resendCount, re-send the email. Unlike mint, a resend email failure
 * IS surfaced (the admin explicitly asked for a send).
 */
async function resendInvite({ inviteId, adminId }) {
  const invite = await AffiliateInvite.findOne({ inviteId });
  if (!invite) throw new InviteError('not_found', 404);
  if (invite.status !== 'pending') throw new InviteError('not_pending', 409);

  const ttl = await inviteTtlHours();
  const rawToken = encryptionUtil.generateToken(32);
  invite.tokenHash = AffiliateInvite.hashToken(rawToken);
  invite.expiresAt = new Date(Date.now() + ttl * 60 * 60 * 1000);
  invite.resendCount += 1;
  await invite.save();

  await onboardingEmail.sendAffiliateInviteEmail({
    email: invite.email,
    firstName: invite.prefill.firstName,
    inviteUrl: buildInviteUrl(rawToken),
    expiresAt: invite.expiresAt
  });
  invite.sentAt = new Date();
  await invite.save();

  logger.info('Affiliate invite re-sent', { inviteId: invite.inviteId, resendCount: invite.resendCount });
  return { invite, rawToken };
}

/**
 * Revoke a pending invite. Guarded findOneAndUpdate so only pending flips.
 * @throws InviteError('not_pending', 409) when missing or not pending (same
 *         answer for both — no existence oracle).
 */
async function revokeInvite({ inviteId, adminId }) {
  const invite = await AffiliateInvite.findOneAndUpdate(
    { inviteId, status: 'pending' },
    { $set: { status: 'revoked', revokedAt: new Date(), revokedBy: adminId } },
    { new: true }
  );
  if (!invite) throw new InviteError('not_pending', 409);
  return invite;
}

module.exports = {
  createInvite,
  validateInvite,
  consumeInvite,
  resendInvite,
  revokeInvite,
  buildInviteUrl,
  InviteError
};
```

- [ ] **3.4 Run — expect pass:**

```bash
npm test -- tests/unit/inviteService.test.js
```

Expected: 14 passed.

- [ ] **3.5 Commit:**

```bash
git add server/modules/onboarding/inviteService.js tests/unit/inviteService.test.js
git commit -m "feat(onboarding): inviteService — create/validate/consume/resend/revoke with typed InviteError"
```

---

## Task 4: Audit events + admin invite endpoints (mint / list / resend / revoke)

**Files:**
- Create: `tests/integration/affiliateInvites.test.js` (admin section; later tasks extend this file)
- Create: `server/modules/onboarding/inviteController.js`
- Modify: `server/utils/auditLogger.js` (AuditEvents map, lines 87–92)
- Modify: `server/routes/administratorRoutes.js` (imports at top; routes after the unlock-payments block at lines 37–39)

All admin invite routes inherit `router.use(authenticate)` + `router.use(checkRole(['administrator']))` from the top of `administratorRoutes.js` (lines 11–12). Mutations additionally get `checkAdminPermission(['manage_affiliates'])` + `sensitiveOperationLimiter`; CSRF is already enforced globally on POST by `conditionalCsrf` (tests send `x-csrf-token`). `sensitiveOperationLimiter` is skipped under `NODE_ENV=test` (`skipInTest` in `server/middleware/rateLimiting.js:153`), so tests exercise RBAC/CSRF, not the limiter.

### Steps

- [ ] **4.1 Write the failing integration test.** Create `tests/integration/affiliateInvites.test.js`:

```javascript
jest.setTimeout(90000);

// Mock the invite email dispatcher BEFORE requiring the app.
jest.mock('../../server/services/email/dispatcher/onboarding', () => ({
  sendAffiliateInviteEmail: jest.fn().mockResolvedValue(true)
}));

const mongoose = require('mongoose');
const app = require('../../server');
const Administrator = require('../../server/models/Administrator');
const Affiliate = require('../../server/models/Affiliate');
const AffiliateInvite = require('../../server/modules/onboarding/AffiliateInvite');
const encryptionUtil = require('../../server/utils/encryption');
const { createTestToken } = require('../helpers/authHelper');
const { getCsrfToken, createAgent } = require('../helpers/csrfHelper');
const onboardingEmail = require('../../server/services/email/dispatcher/onboarding');

describe('Affiliate invites API', () => {
  let agent;
  let csrfToken;
  let admin;
  let adminToken;
  let limitedAdminToken;

  // Direct-DB invite factory (skips the admin API; used by validate/register tests)
  const seedInvite = async (overrides = {}) => {
    const raw = encryptionUtil.generateToken(32);
    const invite = await AffiliateInvite.create({
      tokenHash: AffiliateInvite.hashToken(raw),
      email: 'invitee@example.com',
      prefill: { firstName: 'Ina', lastName: 'Vite' },
      expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
      createdBy: new mongoose.Types.ObjectId(),
      ...overrides
    });
    return { raw, invite };
  };

  beforeEach(async () => {
    await Administrator.deleteMany({});
    await Affiliate.deleteMany({});
    await AffiliateInvite.deleteMany({});
    jest.clearAllMocks();
    onboardingEmail.sendAffiliateInviteEmail.mockResolvedValue(true);

    admin = await Administrator.create({
      firstName: 'Test', lastName: 'Admin', email: 'admin@test.com',
      username: 'testadmin', passwordSalt: 'salt', passwordHash: 'hash',
      permissions: ['manage_affiliates']
    });
    adminToken = createTestToken(admin._id, 'administrator');

    const limitedAdmin = await Administrator.create({
      firstName: 'Limited', lastName: 'Admin', email: 'limited@test.com',
      username: 'limitedadmin', passwordSalt: 'salt', passwordHash: 'hash',
      permissions: ['view_analytics']
    });
    limitedAdminToken = createTestToken(limitedAdmin._id, 'administrator');

    agent = createAgent(app);
    csrfToken = await getCsrfToken(app, agent);
  });

  describe('POST /api/v1/administrators/affiliate-invites (mint)', () => {
    const mintBody = {
      email: 'New.Invitee@Example.com',
      prefill: { firstName: 'Nia', lastName: 'Liate', businessName: 'Liate LLC', phone: '555-0100' }
    };

    test('mints a pending invite, emails the link, never returns the raw token', async () => {
      const res = await agent
        .post('/api/v1/administrators/affiliate-invites')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-csrf-token', csrfToken)
        .send(mintBody);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.invite).toMatchObject({
        email: 'new.invitee@example.com',
        status: 'pending',
        resendCount: 0
      });
      expect(res.body.invite.inviteId).toMatch(/^INV-/);
      // Anti-leak: no 64-hex raw token anywhere in the response.
      expect(JSON.stringify(res.body)).not.toMatch(/[0-9a-f]{64}/);

      expect(onboardingEmail.sendAffiliateInviteEmail).toHaveBeenCalledTimes(1);
      const arg = onboardingEmail.sendAffiliateInviteEmail.mock.calls[0][0];
      expect(arg.inviteUrl).toMatch(
        /^https:\/\/wavemax\.promo\/embed-app-v2\.html\?route=\/affiliate-register&invite=[0-9a-f]{64}$/
      );
    });

    test('403 without the manage_affiliates permission', async () => {
      const res = await agent
        .post('/api/v1/administrators/affiliate-invites')
        .set('Authorization', `Bearer ${limitedAdminToken}`)
        .set('x-csrf-token', csrfToken)
        .send(mintBody);
      expect(res.status).toBe(403);
      expect(await AffiliateInvite.countDocuments()).toBe(0);
    });

    test('403 without a CSRF token', async () => {
      const res = await agent
        .post('/api/v1/administrators/affiliate-invites')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(mintBody);
      expect(res.status).toBe(403);
    });

    test('400 on a malformed email', async () => {
      const res = await agent
        .post('/api/v1/administrators/affiliate-invites')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-csrf-token', csrfToken)
        .send({ email: 'not-an-email' });
      expect(res.status).toBe(400);
    });

    test('409 when a pending invite already exists for the email', async () => {
      await seedInvite({ email: 'new.invitee@example.com' });
      const res = await agent
        .post('/api/v1/administrators/affiliate-invites')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-csrf-token', csrfToken)
        .send(mintBody);
      expect(res.status).toBe(409);
      expect(await AffiliateInvite.countDocuments()).toBe(1);
    });
  });

  describe('GET /api/v1/administrators/affiliate-invites (list)', () => {
    test('lists invites filtered by status, without token hashes', async () => {
      await seedInvite({ email: 'a@example.com' });
      await seedInvite({ email: 'b@example.com', status: 'revoked' });

      const res = await agent
        .get('/api/v1/administrators/affiliate-invites?status=pending')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.invites).toHaveLength(1);
      expect(res.body.invites[0].email).toBe('a@example.com');
      expect(res.body.invites[0].tokenHash).toBeUndefined();
    });
  });

  describe('POST /api/v1/administrators/affiliate-invites/:inviteId/resend', () => {
    test('re-mints the token and bumps resendCount', async () => {
      const { invite } = await seedInvite();
      const oldHash = invite.tokenHash;

      const res = await agent
        .post(`/api/v1/administrators/affiliate-invites/${invite.inviteId}/resend`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-csrf-token', csrfToken)
        .send({});

      expect(res.status).toBe(200);
      const updated = await AffiliateInvite.findOne({ inviteId: invite.inviteId });
      expect(updated.tokenHash).not.toBe(oldHash);
      expect(updated.resendCount).toBe(1);
      expect(updated.sentAt).toBeInstanceOf(Date);
      expect(onboardingEmail.sendAffiliateInviteEmail).toHaveBeenCalledTimes(1);
    });

    test('409 when the invite is not pending', async () => {
      const { invite } = await seedInvite({ status: 'revoked' });
      const res = await agent
        .post(`/api/v1/administrators/affiliate-invites/${invite.inviteId}/resend`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-csrf-token', csrfToken)
        .send({});
      expect(res.status).toBe(409);
    });
  });

  describe('POST /api/v1/administrators/affiliate-invites/:inviteId/revoke', () => {
    test('revokes a pending invite', async () => {
      const { invite } = await seedInvite();
      const res = await agent
        .post(`/api/v1/administrators/affiliate-invites/${invite.inviteId}/revoke`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-csrf-token', csrfToken)
        .send({});

      expect(res.status).toBe(200);
      const updated = await AffiliateInvite.findOne({ inviteId: invite.inviteId });
      expect(updated.status).toBe('revoked');
      expect(String(updated.revokedBy)).toBe(String(admin._id));
    });

    test('409 on revoking an accepted invite', async () => {
      const { invite } = await seedInvite({ status: 'accepted' });
      const res = await agent
        .post(`/api/v1/administrators/affiliate-invites/${invite.inviteId}/revoke`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-csrf-token', csrfToken)
        .send({});
      expect(res.status).toBe(409);
    });
  });
});
```

- [ ] **4.2 Run — expect failure** (`Cannot find module '../modules/onboarding/inviteController'` once routes are wired, or 404s before that — first run fails at the route layer with 404 responses):

```bash
npm test -- tests/integration/affiliateInvites.test.js
```

Expected: every test fails with `expected 201/200/403/409, got 404` (routes don't exist yet).

- [ ] **4.3 Add the audit events.** In `server/utils/auditLogger.js`, the `AuditEvents` map currently ends (lines 87–92):

```javascript
  // Franchise self-serve preview
  PREVIEW_REQUESTED: 'PREVIEW_REQUESTED',
  PREVIEW_UNLOCKED: 'PREVIEW_UNLOCKED',
  PREVIEW_UNLOCK_FAILED: 'PREVIEW_UNLOCK_FAILED',
  PREVIEW_REVOKED: 'PREVIEW_REVOKED'
};
```

Replace with:

```javascript
  // Franchise self-serve preview
  PREVIEW_REQUESTED: 'PREVIEW_REQUESTED',
  PREVIEW_UNLOCKED: 'PREVIEW_UNLOCKED',
  PREVIEW_UNLOCK_FAILED: 'PREVIEW_UNLOCK_FAILED',
  PREVIEW_REVOKED: 'PREVIEW_REVOKED',

  // Affiliate invites (invite-only onboarding, spec §9)
  INVITE_MINTED: 'INVITE_MINTED',
  INVITE_CONSUMED: 'INVITE_CONSUMED',
  INVITE_REVOKED: 'INVITE_REVOKED'
};
```

- [ ] **4.4 Create the controller.** `server/modules/onboarding/inviteController.js` (includes the public `validateInvite` used by Task 5):

```javascript
// inviteController — admin mint/list/resend/revoke + public token validate.

const { validationResult } = require('express-validator');
const inviteService = require('./inviteService');
const { InviteError } = inviteService;
const AffiliateInvite = require('./AffiliateInvite');
const ControllerHelpers = require('../../utils/controllerHelpers');
const { logAuditEvent, AuditEvents } = require('../../utils/auditLogger');

// Admin-facing projection. NEVER include tokenHash (and the raw token is
// never available here at all — it lives only in the emailed link).
function inviteSummary(invite) {
  return {
    inviteId: invite.inviteId,
    email: invite.email,
    prefill: invite.prefill,
    status: invite.status,
    expiresAt: invite.expiresAt,
    sentAt: invite.sentAt,
    resendCount: invite.resendCount,
    acceptedAt: invite.acceptedAt,
    acceptedAffiliateId: invite.acceptedAffiliateId,
    revokedAt: invite.revokedAt,
    createdAt: invite.createdAt
  };
}

function sendInviteError(res, err) {
  return ControllerHelpers.sendError(res, 'Invite operation failed', err.statusCode, [{ code: err.code }]);
}

/**
 * POST /api/v1/administrators/affiliate-invites
 */
exports.mintInvite = ControllerHelpers.asyncWrapper(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const { email, prefill, ttlHours } = req.body;
  try {
    const { invite } = await inviteService.createInvite({
      email, prefill, ttlHours, adminId: req.user.id
    });
    logAuditEvent(AuditEvents.INVITE_MINTED, { inviteId: invite.inviteId, email: invite.email }, req);
    return ControllerHelpers.sendSuccess(res, { invite: inviteSummary(invite) }, 'Invite created', 201);
  } catch (err) {
    if (err instanceof InviteError) return sendInviteError(res, err);
    throw err;
  }
});

/**
 * GET /api/v1/administrators/affiliate-invites?status=
 */
exports.listInvites = ControllerHelpers.asyncWrapper(async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  const invites = await AffiliateInvite.find(filter).sort({ createdAt: -1 }).limit(200);
  return ControllerHelpers.sendSuccess(res, { invites: invites.map(inviteSummary) }, 'Invites retrieved');
});

/**
 * POST /api/v1/administrators/affiliate-invites/:inviteId/resend
 */
exports.resendInvite = ControllerHelpers.asyncWrapper(async (req, res) => {
  try {
    const { invite } = await inviteService.resendInvite({
      inviteId: req.params.inviteId, adminId: req.user.id
    });
    return ControllerHelpers.sendSuccess(res, { invite: inviteSummary(invite) }, 'Invite re-sent');
  } catch (err) {
    if (err instanceof InviteError) return sendInviteError(res, err);
    throw err;
  }
});

/**
 * POST /api/v1/administrators/affiliate-invites/:inviteId/revoke
 */
exports.revokeInvite = ControllerHelpers.asyncWrapper(async (req, res) => {
  try {
    const invite = await inviteService.revokeInvite({
      inviteId: req.params.inviteId, adminId: req.user.id
    });
    logAuditEvent(AuditEvents.INVITE_REVOKED, { inviteId: invite.inviteId, email: invite.email }, req);
    return ControllerHelpers.sendSuccess(res, { invite: inviteSummary(invite) }, 'Invite revoked');
  } catch (err) {
    if (err instanceof InviteError) return sendInviteError(res, err);
    throw err;
  }
});

/**
 * GET /api/v1/affiliate-invites/:token/validate  (PUBLIC — Task 5 mounts it)
 *
 * Anti-enumeration (spec §9): every failure is the same generic 410 shape.
 * 'expired' is the only specific reason (the holder already has the real
 * token, so naming expiry leaks nothing); already_used/revoked/unknown all
 * collapse to 'invalid'.
 */
exports.validateInvite = ControllerHelpers.asyncWrapper(async (req, res) => {
  try {
    const invite = await inviteService.validateInvite(req.params.token);
    return ControllerHelpers.sendSuccess(res, {
      valid: true,
      email: invite.email,
      prefill: invite.prefill,
      expiresAt: invite.expiresAt
    }, 'Invite valid');
  } catch (err) {
    if (err instanceof InviteError) {
      const reason = err.code === 'expired' ? 'expired' : 'invalid';
      return res.status(410).json({ success: false, valid: false, reason });
    }
    throw err;
  }
});
```

- [ ] **4.5 Mount the admin routes.** In `server/routes/administratorRoutes.js`:

(a) Add to the imports block at the top (after line 8, `const { customPasswordValidator } = require('../utils/passwordValidator');`):

```javascript
const inviteController = require('../modules/onboarding/inviteController');
const { sensitiveOperationLimiter } = require('../middleware/rateLimiting');
```

(b) Insert after the commission-lock block, i.e. directly below:

```javascript
router.post('/affiliates/:affiliateId/unlock-payments',
  checkAdminPermission(['manage_affiliates']),
  administratorController.unlockAffiliatePayments);
```

add:

```javascript
// Affiliate invites (invite-only onboarding) — spec §5 / §6.2.
// CSRF is enforced globally on POST by conditionalCsrf.
router.post('/affiliate-invites',
  checkAdminPermission(['manage_affiliates']),
  sensitiveOperationLimiter,
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('prefill.firstName').optional().isString().trim().isLength({ max: 50 }),
    body('prefill.lastName').optional().isString().trim().isLength({ max: 50 }),
    body('prefill.businessName').optional().isString().trim().isLength({ max: 100 }),
    body('prefill.phone').optional().isString().trim().isLength({ max: 25 }),
    body('ttlHours').optional().isInt({ min: 1, max: 336 })
  ],
  inviteController.mintInvite);
router.get('/affiliate-invites',
  checkAdminPermission(['manage_affiliates']),
  inviteController.listInvites);
router.post('/affiliate-invites/:inviteId/resend',
  checkAdminPermission(['manage_affiliates']),
  sensitiveOperationLimiter,
  inviteController.resendInvite);
router.post('/affiliate-invites/:inviteId/revoke',
  checkAdminPermission(['manage_affiliates']),
  sensitiveOperationLimiter,
  inviteController.revokeInvite);
```

(`body` is already imported at line 7. These literal paths sit well before the `/:id` catch-all routes at the bottom of the file, so no shadowing.)

- [ ] **4.6 Run — expect pass:**

```bash
npm test -- tests/integration/affiliateInvites.test.js
```

Expected: 11 passed.

- [ ] **4.7 Commit:**

```bash
git add server/modules/onboarding/inviteController.js server/routes/administratorRoutes.js server/utils/auditLogger.js tests/integration/affiliateInvites.test.js
git commit -m "feat(admin): affiliate-invite mint/list/resend/revoke (manage_affiliates + CSRF + sensitive limiter) + INVITE_* audit events"
```

---

## Task 5: Public validate endpoint — `GET /api/v1/affiliate-invites/:token/validate`

**Files:**
- Modify: `tests/integration/affiliateInvites.test.js` (append a describe block)
- Create: `server/routes/affiliateInviteRoutes.js`
- Modify: `server.js` (one mount line, in the "Mount v1 routes" block around line 944)

The controller method already exists (Task 4.4). The global `apiLimiter` on `/api/` (`server.js:594`) satisfies the spec's "public (rate-limited)" requirement — no extra limiter.

### Steps

- [ ] **5.1 Write the failing tests.** Append to `tests/integration/affiliateInvites.test.js`, inside the top-level `describe('Affiliate invites API', ...)`:

```javascript
  describe('GET /api/v1/affiliate-invites/:token/validate (public)', () => {
    test('valid pending token → 200 { valid, email, prefill }, no auth needed', async () => {
      const { raw } = await seedInvite({ email: 'valid@example.com' });
      const res = await agent.get(`/api/v1/affiliate-invites/${raw}/validate`);

      expect(res.status).toBe(200);
      expect(res.body.valid).toBe(true);
      expect(res.body.email).toBe('valid@example.com');
      expect(res.body.prefill).toMatchObject({ firstName: 'Ina', lastName: 'Vite' });
    });

    test('expired token → 410 reason "expired"', async () => {
      const { raw } = await seedInvite({ expiresAt: new Date(Date.now() - 1000) });
      const res = await agent.get(`/api/v1/affiliate-invites/${raw}/validate`);
      expect(res.status).toBe(410);
      expect(res.body).toEqual({ success: false, valid: false, reason: 'expired' });
    });

    test('unknown / revoked / accepted tokens all return the identical generic 410 (anti-enumeration)', async () => {
      const { raw: revokedRaw } = await seedInvite({ email: 'r@example.com', status: 'revoked' });
      const { raw: acceptedRaw } = await seedInvite({ email: 'a@example.com', status: 'accepted' });
      const unknownRaw = 'ab'.repeat(32);

      const responses = await Promise.all([
        agent.get(`/api/v1/affiliate-invites/${unknownRaw}/validate`),
        agent.get(`/api/v1/affiliate-invites/${revokedRaw}/validate`),
        agent.get(`/api/v1/affiliate-invites/${acceptedRaw}/validate`)
      ]);

      for (const res of responses) {
        expect(res.status).toBe(410);
        expect(res.body).toEqual({ success: false, valid: false, reason: 'invalid' });
      }
    });
  });
```

- [ ] **5.2 Run — expect failure** (404 — route not mounted):

```bash
npm test -- tests/integration/affiliateInvites.test.js -t "validate"
```

- [ ] **5.3 Create the route file.** `server/routes/affiliateInviteRoutes.js`:

```javascript
// Public affiliate-invite routes — token validation for the registration
// form. Anti-enumeration: all failures are one generic 410 shape (spec §9).

const express = require('express');
const router = express.Router();
const inviteController = require('../modules/onboarding/inviteController');

/**
 * @route   GET /api/v1/affiliate-invites/:token/validate
 * @desc    Validate an invite token for form prefill / email lock
 * @access  Public (rate-limited by the global apiLimiter on /api/)
 */
router.get('/:token/validate', inviteController.validateInvite);

module.exports = router;
```

- [ ] **5.4 Mount it.** In `server.js`, in the "Mount v1 routes" block, directly after the line:

```javascript
apiV1Router.use('/affiliates', affiliateRoutes);
```

add:

```javascript
apiV1Router.use('/affiliate-invites', require('./server/routes/affiliateInviteRoutes'));  // Public invite validate (invite-only onboarding)
```

(Anchor on the `/affiliates` mount — it survives PR 2's removal of the adjacent `affiliateScheduleRoutes` line.)

- [ ] **5.5 Run — expect pass:**

```bash
npm test -- tests/integration/affiliateInvites.test.js
```

Expected: 14 passed (11 from Task 4 + 3 new).

- [ ] **5.6 Commit:**

```bash
git add server/routes/affiliateInviteRoutes.js server.js tests/integration/affiliateInvites.test.js
git commit -m "feat(api): public GET /api/v1/affiliate-invites/:token/validate with generic 410 anti-enumeration"
```

---

## Task 6: Invite-bound `registerAffiliate` (rework + new tests + legacy-test updates, one commit)

This task changes the registration contract, so the **new integration tests, the controller rework, and the updates to every existing suite that registers an affiliate land in one commit** — the suite must be green at the end of the task (house rule: fix everything before advancing).

**Files:**
- Modify: `tests/integration/affiliateInvites.test.js` (append the registration describe)
- Modify: `server/routes/affiliateRoutes.js` (register-route validators, lines 18–32)
- Modify: `server/controllers/affiliateController.js` (imports + full `registerAffiliate` replacement)
- Modify: `tests/integration/affiliate.test.js` (the `should register a new affiliate` test, currently lines 60–102)
- Modify: `tests/integration/passwordValidation.test.js` (invite helper + the three register tests that pass validation)
- Modify: `tests/unit/affiliateController.test.js` (replace the `describe('registerAffiliate')` block, currently lines 125–~320)
- **Delete: `tests/integration/affiliateRegistrationOpen.test.js`** — PR 2 created it to pin "registers with NO invite → 201" and explicitly marked it "reworked by PR 5's invite gate". Its purpose (gate removed) is obsolete the moment the `inviteToken` validator lands; left in place it fails 400-vs-201 and the suite goes red. The invite-gated equivalent is the new `affiliateInvites.test.js` registration describe (6.1), so DELETE it in this same commit (step 6.6b).

### Steps

- [ ] **6.1 Write the failing integration tests.** Append to `tests/integration/affiliateInvites.test.js` (inside the top-level describe; uses the existing `seedInvite` helper). Also add this import at the top of the file with the other requires:

```javascript
const { getStrongPassword } = require('../helpers/testPasswords');
const inviteService = require('../../server/modules/onboarding/inviteService');
```

Then append:

```javascript
  describe('POST /api/v1/affiliates/register (invite-bound)', () => {
    // Valid Austin payload — city/state/zip must satisfy registrationAddressValidation.
    const basePayload = (overrides = {}) => ({
      firstName: 'New', lastName: 'Affiliate',
      email: 'client-sent@example.com',           // deliberately NOT the invite email
      phone: '555-5678',
      address: '456 Test St', city: 'Austin', state: 'TX', zipCode: '78701',
      serviceArea: 'Austin Area', // the plain string survives PR 2; the geo fields do NOT
      minimumDeliveryFee: 25, perBagDeliveryFee: 5,
      username: 'newaffiliate', password: getStrongPassword('affiliate', 7),
      paymentMethod: 'check',
      ...overrides
    });

    const register = (payload) => agent
      .post('/api/v1/affiliates/register')
      .set('x-csrf-token', csrfToken)
      .send(payload);

    test('400 without an inviteToken (the public gate is closed)', async () => {
      const res = await register(basePayload());
      expect(res.status).toBe(400);
      expect(res.body.errors.some(e => (e.path || e.param) === 'inviteToken')).toBe(true);
      expect(await Affiliate.countDocuments()).toBe(0);
    });

    test('410 with an unknown inviteToken', async () => {
      const res = await register(basePayload({ inviteToken: 'ab'.repeat(32) }));
      expect(res.status).toBe(410);
      expect(res.body.reason).toBe('invalid');
      expect(await Affiliate.countDocuments()).toBe(0);
    });

    test('410 reason expired with an expired invite', async () => {
      const { raw } = await seedInvite({ expiresAt: new Date(Date.now() - 1000) });
      const res = await register(basePayload({ inviteToken: raw }));
      expect(res.status).toBe(410);
      expect(res.body.reason).toBe('expired');
    });

    test('valid invite → 201, affiliate created, invite consumed', async () => {
      const { raw, invite } = await seedInvite({ email: 'real.invitee@example.com' });
      const res = await register(basePayload({ inviteToken: raw }));

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.affiliateId).toMatch(/^AFF-/);

      const affiliate = await Affiliate.findOne({ affiliateId: res.body.affiliateId });
      expect(affiliate).not.toBeNull();

      const consumed = await AffiliateInvite.findOne({ inviteId: invite.inviteId });
      expect(consumed.status).toBe('accepted');
      expect(consumed.acceptedAffiliateId).toBe(res.body.affiliateId);
    });

    test('client-sent email is IGNORED — the account email comes from the invite', async () => {
      const { raw } = await seedInvite({ email: 'real.invitee@example.com' });
      const res = await register(basePayload({ inviteToken: raw, email: 'attacker@evil.com' }));

      expect(res.status).toBe(201);
      const affiliate = await Affiliate.findOne({ affiliateId: res.body.affiliateId });
      expect(affiliate.email).toBe('real.invitee@example.com');
      expect(await Affiliate.countDocuments({ email: 'attacker@evil.com' })).toBe(0);
    });

    test('reused (already-accepted) invite → 409 and no second affiliate', async () => {
      const { raw } = await seedInvite({ email: 'real.invitee@example.com' });
      const first = await register(basePayload({ inviteToken: raw, username: 'firstuser' }));
      expect(first.status).toBe(201);

      const second = await register(basePayload({ inviteToken: raw, username: 'seconduser' }));
      expect(second.status).toBe(409);
      expect(await Affiliate.countDocuments()).toBe(1);
    });

    test('consume race loss rolls the affiliate back and returns 409', async () => {
      const { raw } = await seedInvite({ email: 'race@example.com' });
      // Force the loser branch deterministically: validate passes, consume loses.
      const consumeSpy = jest.spyOn(inviteService, 'consumeInvite').mockResolvedValueOnce(null);

      const res = await register(basePayload({ inviteToken: raw }));

      expect(res.status).toBe(409);
      expect(await Affiliate.countDocuments({ email: 'race@example.com' })).toBe(0); // rolled back
      consumeSpy.mockRestore();
    });

    test('two concurrent registrations on one invite → exactly one affiliate', async () => {
      const { raw, invite } = await seedInvite({ email: 'concurrent@example.com' });

      const [r1, r2] = await Promise.all([
        register(basePayload({ inviteToken: raw, username: 'racerone' })),
        register(basePayload({ inviteToken: raw, username: 'racertwo' }))
      ]);

      const statuses = [r1.status, r2.status].sort();
      expect(statuses[0]).toBe(201);          // exactly one winner...
      expect(statuses[1]).toBeGreaterThanOrEqual(400); // ...one loser (400 dup-email / 409 consume / 409 already_used)
      expect(await Affiliate.countDocuments({ email: 'concurrent@example.com' })).toBe(1);

      const final = await AffiliateInvite.findOne({ inviteId: invite.inviteId });
      expect(final.status).toBe('accepted');
    });
  });
```

> Why the race-loss test can spy: the controller calls `inviteService.consumeInvite(...)` as a property lookup on the required module object at call time, so `jest.spyOn(inviteService, 'consumeInvite')` intercepts it. Do **not** destructure `consumeInvite` in the controller.

- [ ] **6.2 Run — expect failure for the right reason:**

```bash
npm test -- tests/integration/affiliateInvites.test.js -t "invite-bound"
```

Expected: `400 without an inviteToken` fails (registration currently succeeds/fails without any invite involvement — e.g. got 201 or a non-invite 4xx), and the 410/consume tests fail similarly.

- [ ] **6.3 Add the `inviteToken` validator and relax the email validator.** In `server/routes/affiliateRoutes.js`, the register route's validator array currently begins (lines 18–22):

```javascript
router.post('/register', registrationLimiter, [
  body('firstName').notEmpty().withMessage('First name is required'),
  body('lastName').notEmpty().withMessage('Last name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('phone').notEmpty().withMessage('Phone number is required'),
```

Replace those lines with:

```javascript
router.post('/register', registrationLimiter, [
  body('inviteToken').notEmpty().isString().withMessage('Invite token is required'),
  body('firstName').notEmpty().withMessage('First name is required'),
  body('lastName').notEmpty().withMessage('Last name is required'),
  // Email is OPTIONAL and IGNORED — the account email is forced from the invite.
  body('email').optional({ checkFalsy: true }).isEmail().withMessage('Valid email is required'),
  body('phone').notEmpty().withMessage('Phone number is required'),
```

Leave every other validator in the array (address/service-area/fees/username/password/paymentMethod) exactly as found.

- [ ] **6.4 Rework the controller.** In `server/controllers/affiliateController.js`:

(a) Add to the imports block at the top (after `const logger = require('../utils/logger');`):

```javascript
const inviteService = require('../modules/onboarding/inviteService');
const { InviteError } = inviteService;
const { logAuditEvent, AuditEvents } = require('../utils/auditLogger');
```

(b) Replace the **entire** `exports.registerAffiliate` function (post-PR-2 it is the pre-PR-2 function minus the beta gate; replace whatever is there wholesale) with:

```javascript
/**
 * Register a new affiliate — INVITE-BOUND (spec §6.2).
 *
 * Contract:
 *  - `inviteToken` is required; it must resolve to a pending, unexpired invite.
 *  - The account email is ALWAYS `invite.email`; any client-sent email is ignored.
 *  - After the affiliate saves, the invite is consumed atomically (single-use).
 *    Losing that race deletes the just-created affiliate and returns 409.
 *  - JSON-only in this PR; the multipart W-9 field arrives in PR 10.
 */
exports.registerAffiliate = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.info('[Registration] Validation errors:', JSON.stringify(errors.array(), null, 2));
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const {
      inviteToken,
      firstName,
      lastName,
      phone,
      businessName,
      address,
      city,
      state,
      zipCode,
      minimumDeliveryFee,
      perBagDeliveryFee,
      username,
      password,
      paymentMethod,
      paypalEmail,
      venmoHandle,
      languagePreference
    } = req.body;

    // Invite gate — also the source of truth for the email (client email ignored).
    let invite;
    try {
      invite = await inviteService.validateInvite(inviteToken);
    } catch (inviteError) {
      if (inviteError instanceof InviteError) {
        return res.status(inviteError.statusCode).json({
          success: false,
          message: 'This invitation is no longer valid.',
          reason: inviteError.code === 'expired' ? 'expired' : 'invalid'
        });
      }
      throw inviteError;
    }
    const email = invite.email;

    // Check if email or username already exists (email keyed on the invite email)
    const existingEmail = await Affiliate.findOne({ email });
    const existingUsername = await Affiliate.findOne({ username });

    if (existingEmail && existingUsername) {
      return res.status(400).json({
        success: false,
        message: 'Both email and username are already in use',
        errors: {
          email: 'Email already registered',
          username: 'Username already taken'
        }
      });
    } else if (existingEmail) {
      return res.status(400).json({
        success: false,
        message: 'Email already registered',
        field: 'email'
      });
    } else if (existingUsername) {
      return res.status(400).json({
        success: false,
        message: 'Username already taken',
        field: 'username'
      });
    }

    // Hash password
    const { salt, hash } = encryptionUtil.hashPassword(password);

    // Create new affiliate (email from the invite — never from the client)
    const newAffiliate = new Affiliate({
      firstName,
      lastName,
      email,
      phone,
      businessName,
      address,
      city,
      state,
      zipCode,
      minimumDeliveryFee: parseFloat(minimumDeliveryFee) || 20,
      perBagDeliveryFee: parseFloat(perBagDeliveryFee) || 5,
      username,
      passwordSalt: salt,
      passwordHash: hash,
      paymentMethod,
      languagePreference: languagePreference || 'en'
    });

    // Add payment information if provided
    if (paymentMethod === 'paypal' && paypalEmail) {
      newAffiliate.paypalEmail = paypalEmail;
      // The encryption middleware will handle this automatically
    } else if (paymentMethod === 'venmo' && venmoHandle) {
      newAffiliate.venmoHandle = venmoHandle;
      // The encryption middleware will handle this automatically
    }

    await newAffiliate.save();

    // Atomic single-use consume. A null result means another registration
    // already used this invite — roll back the affiliate we just created.
    const consumed = await inviteService.consumeInvite(inviteToken, newAffiliate.affiliateId);
    if (!consumed) {
      await Affiliate.deleteOne({ _id: newAffiliate._id });
      return res.status(409).json({
        success: false,
        message: 'This invitation has already been used.',
        reason: 'already_used'
      });
    }

    logAuditEvent(AuditEvents.INVITE_CONSUMED, {
      inviteId: consumed.inviteId,
      affiliateId: newAffiliate.affiliateId,
      email
    }, req);

    // Send welcome email
    try {
      await emailService.sendAffiliateWelcomeEmail(newAffiliate);
      // Email sent successfully - no need to check result
    } catch (emailError) {
      logger.warn('Welcome email could not be sent:', emailError);
      // Continue with registration process even if email fails
    }

    res.status(201).json({
      success: true,
      affiliateId: newAffiliate.affiliateId,
      message: 'Affiliate registered successfully!'
    });
  } catch (error) {
    logger.error('Affiliate registration error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred during registration'
    });
  }
};
```

(The listing above is the post-PR-2 shape — no `service*` geo identifiers. Fallback ONLY if PR 2 Task 10 was somehow skipped and the model still carries `serviceLatitude/serviceLongitude/serviceRadius`: add the three identifiers back to the destructure and the `new Affiliate({...})`, and flag the PR 2 gap rather than silently absorbing it.)

- [ ] **6.5 Run the new tests — expect pass:**

```bash
npm test -- tests/integration/affiliateInvites.test.js
```

Expected: all pass (14 from Tasks 4–5 + 8 new = 22).

- [ ] **6.6 Update `tests/integration/affiliate.test.js`.** Replace the whole `should register a new affiliate` test (pre-PR-2 lines 60–102; PR 2 will have already removed the `BetaRequest.create` block) with:

```javascript
  test('should register a new affiliate', async () => {
    // Registration is invite-only: seed a pending invite for the email.
    const AffiliateInvite = require('../../server/modules/onboarding/AffiliateInvite');
    const encryptionUtil = require('../../server/utils/encryption');
    const inviteToken = encryptionUtil.generateToken(32);
    await AffiliateInvite.create({
      tokenHash: AffiliateInvite.hashToken(inviteToken),
      email: 'new@example.com',
      expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
      createdBy: new (require('mongoose').Types.ObjectId)()
    });

    const res = await agent
      .post('/api/v1/affiliates/register')
      .set('X-CSRF-Token', csrfToken)
      .send({
        inviteToken,
        firstName: 'New',
        lastName: 'Affiliate',
        email: 'new@example.com',
        phone: '555-5678',
        address: '456 Test St',
        city: 'Austin',
        state: 'TX',
        zipCode: '78701',
        serviceArea: 'Austin Area',
        minimumDeliveryFee: 25,
        perBagDeliveryFee: 5,
        username: 'newaffiliate',
        password: getStrongPassword('affiliate', 1),
        paymentMethod: 'check'
      });

    expect(res.statusCode).toEqual(201);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('affiliateId');
  });
```

Also add `await require('../../server/modules/onboarding/AffiliateInvite').deleteMany({});` to that file's `beforeEach` cleanup (next to the existing `Affiliate` cleanup if present; otherwise at the top of `beforeEach`).

- [ ] **6.6b Delete the obsolete open-registration regression** (PR 2 handoff — see the Files list rationale):

```bash
git rm tests/integration/affiliateRegistrationOpen.test.js
```

- [ ] **6.7 Update `tests/integration/passwordValidation.test.js`.** Three changes:

(a) Add an invite helper where the removed `ensureBetaRequest` used to live (after the `describe('Password Validation Integration Tests', ...)` opening, before `beforeEach`):

```javascript
  // Registration is invite-only — mint a pending invite and return its raw token.
  const ensureInvite = async (email) => {
    const AffiliateInvite = require('../../server/modules/onboarding/AffiliateInvite');
    const encryptionUtil = require('../../server/utils/encryption');
    const mongoose = require('mongoose');
    const raw = encryptionUtil.generateToken(32);
    await AffiliateInvite.create({
      tokenHash: AffiliateInvite.hashToken(raw),
      email: email.toLowerCase(),
      expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
      createdBy: new mongoose.Types.ObjectId()
    });
    return raw;
  };
```

(b) In the `beforeEach` cleanup block, add:

```javascript
    await require('../../server/modules/onboarding/AffiliateInvite').deleteMany({});
```

(c) Update only the affiliate-register tests that get **past** express-validator (the weak-password tests fail at the validator before the invite gate and need **no** change — if `inviteToken` is missing the errors array simply also contains an inviteToken entry, and those tests assert `some(...password...)`):

- `should accept strong passwords during affiliate registration` (the 5-password loop): where PR 2 removed the `await ensureBetaRequest(email, 'Test', 'User');` line inside the loop, add `const inviteToken = await ensureInvite(email);` in its place and add `inviteToken,` as the first property of that test's `registrationData`.
- `should accept passwords with mixed character distribution`: same change — `const inviteToken = await ensureInvite(email);` before the payload, `inviteToken,` added to the payload.
- `should handle Unicode characters in passwords appropriately` (and any other affiliate-register test in this file that expects `201`): same pattern. Grep to be exhaustive:

```bash
grep -n "affiliates/register" tests/integration/passwordValidation.test.js
```

For each hit, check the test's expected status: `201` ⇒ needs `ensureInvite` + `inviteToken`; `400` from the validator ⇒ leave unchanged.

- [ ] **6.8 Replace the `registerAffiliate` unit-test block.** In `tests/unit/affiliateController.test.js`:

(a) Add these mocks after the existing `jest.mock('express-validator');` line (line 20):

```javascript
jest.mock('../../server/modules/onboarding/inviteService', () => {
  class InviteError extends Error {
    constructor(code, statusCode) {
      super(code);
      this.name = 'InviteError';
      this.code = code;
      this.statusCode = statusCode;
    }
  }
  return {
    validateInvite: jest.fn(),
    consumeInvite: jest.fn(),
    InviteError
  };
});
jest.mock('../../server/utils/auditLogger', () => ({
  logAuditEvent: jest.fn(),
  AuditEvents: { INVITE_CONSUMED: 'INVITE_CONSUMED' }
}));
```

and a require with the other requires at the top:

```javascript
const inviteService = require('../../server/modules/onboarding/inviteService');
```

(b) Replace the entire `describe('registerAffiliate', ...)` block (every `it(...)` inside it — they were written against the beta/open flow) with:

```javascript
  describe('registerAffiliate', () => {
    const validBody = {
      inviteToken: 'a'.repeat(64),
      firstName: 'John',
      lastName: 'Doe',
      email: 'attacker@evil.com', // must be ignored
      phone: '123-456-7890',
      businessName: 'Johns Laundry',
      address: '123 Main St',
      city: 'Anytown',
      state: 'CA',
      zipCode: '12345',
      username: 'johndoe',
      password: 'password123',
      paymentMethod: 'venmo',
      venmoHandle: '@johndoe'
    };

    beforeEach(() => {
      validationResult.mockReturnValue({
        isEmpty: jest.fn().mockReturnValue(true),
        array: jest.fn().mockReturnValue([])
      });
      inviteService.validateInvite.mockResolvedValue({
        inviteId: 'INV-1',
        email: 'invitee@example.com',
        prefill: {}
      });
      inviteService.consumeInvite.mockResolvedValue({ inviteId: 'INV-1', status: 'accepted' });
      encryptionUtil.hashPassword.mockReturnValue({ hash: 'hashedPassword', salt: 'salt' });
      emailService.sendAffiliateWelcomeEmail.mockResolvedValue(true);
      Affiliate.deleteOne = jest.fn().mockResolvedValue({ deletedCount: 1 });
      Affiliate.prototype.save = jest.fn().mockImplementation(function () {
        this.affiliateId = 'AFF123456';
        return Promise.resolve(this);
      });
    });

    it('registers using the INVITE email, consumes the invite, returns 201', async () => {
      req.body = { ...validBody };
      Affiliate.findOne = jest.fn()
        .mockResolvedValueOnce(null)  // email check
        .mockResolvedValueOnce(null); // username check

      await affiliateController.registerAffiliate(req, res, next);

      // The duplicate check ran on the INVITE email, not the client email.
      expect(inviteService.validateInvite).toHaveBeenCalledWith(validBody.inviteToken);
      expect(Affiliate.findOne).toHaveBeenCalledWith({ email: 'invitee@example.com' });
      expect(inviteService.consumeInvite).toHaveBeenCalledWith(validBody.inviteToken, 'AFF123456');
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        affiliateId: 'AFF123456',
        message: 'Affiliate registered successfully!'
      });
    });

    it('returns the InviteError status when the invite is invalid', async () => {
      const { InviteError } = inviteService;
      inviteService.validateInvite.mockRejectedValue(new InviteError('invalid', 410));
      req.body = { ...validBody };

      await affiliateController.registerAffiliate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(410);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        reason: 'invalid'
      }));
      expect(inviteService.consumeInvite).not.toHaveBeenCalled();
    });

    it('rolls back the affiliate and returns 409 when the consume race is lost', async () => {
      inviteService.consumeInvite.mockResolvedValue(null);
      req.body = { ...validBody };
      Affiliate.findOne = jest.fn().mockResolvedValue(null);

      await affiliateController.registerAffiliate(req, res, next);

      expect(Affiliate.deleteOne).toHaveBeenCalledTimes(1);
      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        reason: 'already_used'
      }));
    });

    it('returns validation errors before touching the invite', async () => {
      validationResult.mockReturnValue({
        isEmpty: jest.fn().mockReturnValue(false),
        array: jest.fn().mockReturnValue([{ msg: 'Invite token is required' }])
      });

      await affiliateController.registerAffiliate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(inviteService.validateInvite).not.toHaveBeenCalled();
    });

    it('handles duplicate email on the invite email with 400', async () => {
      req.body = { ...validBody };
      Affiliate.findOne = jest.fn()
        .mockResolvedValueOnce({ email: 'invitee@example.com' }) // email taken
        .mockResolvedValueOnce(null);

      await affiliateController.registerAffiliate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ field: 'email' }));
      expect(inviteService.consumeInvite).not.toHaveBeenCalled();
    });
  });
```

- [ ] **6.9 Run every touched suite — expect all green:**

```bash
npm test -- tests/integration/affiliateInvites.test.js tests/integration/affiliate.test.js tests/integration/passwordValidation.test.js tests/unit/affiliateController.test.js
```

Expected: 0 failures. If anything else in the repo registers affiliates, find it now and apply the same `ensureInvite` pattern:

```bash
grep -rn "affiliates/register" tests/ --include=*.js
```

- [ ] **6.10 Run the full suite (this task changed a public contract):**

```bash
npm test
```

Expected: green, no `--forceExit`.

- [ ] **6.11 Commit:**

```bash
git add server/controllers/affiliateController.js server/routes/affiliateRoutes.js tests/integration/affiliateInvites.test.js tests/integration/affiliate.test.js tests/integration/passwordValidation.test.js tests/unit/affiliateController.test.js
# (the git rm of tests/integration/affiliateRegistrationOpen.test.js from 6.6b is already staged)
git commit -m "feat(affiliates): invite-bound registration — email forced from invite, atomic consume with rollback on race loss; drop the open-registration regression test"
```

---

## Task 7: Frontend invite gate on the registration page + i18n (en/es/pt/de)

**Files:**
- Create: `tests/unit/affiliateRegisterInvite.test.js`
- Create: `public/assets/js/affiliate-register-invite.js`
- Modify: `public/affiliate-register-embed.html` (4 insertions: notice div, hidden input, email-locked note, script tag)
- Modify: `public/assets/js/affiliate-register-init.js` (add `'inviteToken'` to the `formFields` array, line ~1296)
- Modify: `public/assets/js/embed-app-v2.js` (append the new script to the `/affiliate-register` `pageScripts` entry, line ~595)
- Modify: `public/locales/en/common.json`, `public/locales/es/common.json`, `public/locales/pt/common.json`, `public/locales/de/common.json` (new top-level `affiliateRegister` key)

**CSP:** the new file is an external script (no inline script/style), loaded via `<script src>` in the page **and** registered in `pageScripts` (PITFALLS #3 — `/affiliate-register` already exists in `EMBED_PAGES`, so only `pageScripts` gains the new entry). The invalid-state notice and email-locked note are static, hidden HTML with `data-i18n` attributes so the i18n init pass translates them — the script only toggles visibility (no dynamic copy injection, no `innerHTML`).

### Steps

- [ ] **7.1 Write the failing frontend unit test.** Create `tests/unit/affiliateRegisterInvite.test.js` (pattern copied from `tests/unit/affiliateLoginInit.test.js` — mocked globals, no jsdom):

```javascript
describe('affiliate-register-invite (invite gate)', () => {
  let elements;
  let originalWindow, originalDocument, originalFetch;

  const makeEl = () => ({
    value: '',
    readOnly: false,
    classList: { add: jest.fn(), remove: jest.fn() },
    setAttribute: jest.fn()
  });

  const loadScript = async () => {
    delete require.cache[require.resolve('../../public/assets/js/affiliate-register-invite.js')];
    require('../../public/assets/js/affiliate-register-invite.js');
    // The script auto-runs init() when readyState !== 'loading'; flush async work.
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));
  };

  beforeEach(() => {
    originalWindow = global.window;
    originalDocument = global.document;
    originalFetch = global.fetch;

    elements = {
      affiliateRegistrationForm: makeEl(),
      inviteInvalidNotice: makeEl(),
      inviteEmailLockedNote: makeEl(),
      inviteToken: makeEl(),
      email: makeEl(),
      firstName: makeEl(),
      lastName: makeEl(),
      businessName: makeEl(),
      phone: makeEl()
    };

    global.document = {
      readyState: 'complete',
      addEventListener: jest.fn(),
      getElementById: jest.fn((id) => elements[id] || null)
    };
    global.window = {
      location: { search: '', origin: 'https://wavemax.promo' },
      EMBED_CONFIG: { baseUrl: 'https://wavemax.promo' }
    };
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.window = originalWindow;
    global.document = originalDocument;
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  test('no ?invite= param → form hidden, invalid notice shown, no fetch', async () => {
    global.window.location.search = '';
    await loadScript();

    expect(global.fetch).not.toHaveBeenCalled();
    expect(elements.affiliateRegistrationForm.classList.add).toHaveBeenCalledWith('hidden');
    expect(elements.inviteInvalidNotice.classList.remove).toHaveBeenCalledWith('hidden');
  });

  test('valid invite → token stored, email locked + prefill applied', async () => {
    const raw = 'ab'.repeat(32);
    global.window.location.search = `?route=/affiliate-register&invite=${raw}`;
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        valid: true,
        email: 'invitee@example.com',
        prefill: { firstName: 'Ina', lastName: 'Vite', businessName: 'Vite LLC', phone: '555-0100' }
      })
    });

    await loadScript();

    expect(global.fetch).toHaveBeenCalledWith(
      `https://wavemax.promo/api/v1/affiliate-invites/${raw}/validate`,
      { credentials: 'include' }
    );
    expect(elements.inviteToken.value).toBe(raw);
    expect(elements.email.value).toBe('invitee@example.com');
    expect(elements.email.readOnly).toBe(true);
    expect(elements.inviteEmailLockedNote.classList.remove).toHaveBeenCalledWith('hidden');
    expect(elements.firstName.value).toBe('Ina');
    expect(elements.businessName.value).toBe('Vite LLC');
    // Existing user input is never overwritten:
    expect(elements.lastName.value).toBe('Vite');
  });

  test('410 from validate → invalid state', async () => {
    global.window.location.search = '?invite=' + 'cd'.repeat(32);
    global.fetch.mockResolvedValue({ ok: false, status: 410, json: async () => ({ valid: false }) });

    await loadScript();

    expect(elements.affiliateRegistrationForm.classList.add).toHaveBeenCalledWith('hidden');
    expect(elements.inviteInvalidNotice.classList.remove).toHaveBeenCalledWith('hidden');
  });

  test('network failure → invalid state (fail closed)', async () => {
    global.window.location.search = '?invite=' + 'ef'.repeat(32);
    global.fetch.mockRejectedValue(new Error('offline'));

    await loadScript();

    expect(elements.inviteInvalidNotice.classList.remove).toHaveBeenCalledWith('hidden');
  });
});
```

- [ ] **7.2 Run — expect failure** (`Cannot find module '.../affiliate-register-invite.js'`):

```bash
npm test -- tests/unit/affiliateRegisterInvite.test.js
```

- [ ] **7.3 Create the script.** `public/assets/js/affiliate-register-invite.js`:

```javascript
// Invite gate for the affiliate registration page (invite-only onboarding).
//
// The page is opened from an emailed link carrying ?invite=<raw token>.
// This script validates the token against the public endpoint, stores it in
// the hidden #inviteToken input (submitted by affiliate-register-init.js),
// locks the email field to the invite's email, and applies prefill hints.
// Without a valid token the form is replaced by the static invalid notice.
// CSP-compliant: external file, no inline handlers, no innerHTML.
(function() {
  'use strict';

  function getBaseUrl() {
    return (window.EMBED_CONFIG && window.EMBED_CONFIG.baseUrl) || window.location.origin;
  }

  function showInvalidState() {
    var form = document.getElementById('affiliateRegistrationForm');
    var notice = document.getElementById('inviteInvalidNotice');
    if (form) form.classList.add('hidden');
    if (notice) notice.classList.remove('hidden');
  }

  function applyInvite(token, body) {
    var tokenField = document.getElementById('inviteToken');
    if (tokenField) tokenField.value = token;

    var emailField = document.getElementById('email');
    if (emailField) {
      emailField.value = body.email || '';
      emailField.readOnly = true;
      emailField.setAttribute('aria-readonly', 'true');
    }
    var lockNote = document.getElementById('inviteEmailLockedNote');
    if (lockNote) lockNote.classList.remove('hidden');

    var prefill = body.prefill || {};
    ['firstName', 'lastName', 'businessName', 'phone'].forEach(function(name) {
      var field = document.getElementById(name);
      if (field && !field.value && prefill[name]) {
        field.value = prefill[name];
      }
    });
  }

  async function init() {
    var params = new URLSearchParams(window.location.search);
    var token = params.get('invite');
    if (!token) {
      showInvalidState();
      return;
    }

    try {
      var response = await fetch(
        getBaseUrl() + '/api/v1/affiliate-invites/' + encodeURIComponent(token) + '/validate',
        { credentials: 'include' }
      );
      if (!response.ok) {
        showInvalidState();
        return;
      }
      var body = await response.json();
      if (!body || body.valid !== true) {
        showInvalidState();
        return;
      }
      applyInvite(token, body);
    } catch (err) {
      // Fail closed: no validated invite, no open form.
      showInvalidState();
    }
  }

  // Exposed for unit tests.
  window.AffiliateInviteGate = { init: init };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
```

- [ ] **7.4 Run — expect pass:**

```bash
npm test -- tests/unit/affiliateRegisterInvite.test.js
```

Expected: 4 passed.

- [ ] **7.5 Wire the page HTML.** Four edits in `public/affiliate-register-embed.html`:

(a) Invalid-state notice — after the header block (lines 22–25), i.e. immediately after:

```html
                <p class="mt-2" data-i18n="affiliate.register.subtitle">Fill out the form below to register as a WaveMAX Laundry affiliate partner.</p>
            </div>
```

insert:

```html
            <!-- Invite-only gate: shown by affiliate-register-invite.js when ?invite= is missing/invalid -->
            <div id="inviteInvalidNotice" class="hidden p-6">
                <div class="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
                    <p class="text-red-700 font-semibold" data-i18n="affiliateRegister.invite.invalidOrExpired">This invitation link is invalid or has expired. Please contact WaveMAX to request a new invitation.</p>
                </div>
            </div>
```

(b) Hidden invite-token input — after the form's opening lines (27–31), i.e. immediately after:

```html
                <!-- Hidden language preference field -->
                <input type="hidden" id="languagePreference" name="languagePreference" value="en">
```

insert:

```html
                <!-- Invite token (populated from ?invite= by affiliate-register-invite.js) -->
                <input type="hidden" id="inviteToken" name="inviteToken" value="">
```

(c) Email-locked note — after the email input (lines 163–166), i.e. immediately after:

```html
                            <input type="email" id="email" name="email" required placeholder="example@email.com" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
```

insert:

```html
                            <p id="inviteEmailLockedNote" class="hidden text-xs text-gray-500 mt-1" data-i18n="affiliateRegister.invite.emailLocked">Your email is set by your invitation and cannot be changed.</p>
```

(d) Script tag — after (line ~381):

```html
    <script src="/assets/js/affiliate-register-page-init.js"></script>
```

insert:

```html
    <script src="/assets/js/affiliate-register-invite.js"></script>
```

- [ ] **7.6 Submit the token.** In `public/assets/js/affiliate-register-init.js`, the manual field-collection array (line ~1296) currently reads:

```javascript
          const formFields = [
            'firstName', 'lastName', 'email', 'phone', 'businessName',
            'address', 'city', 'state', 'zipCode',
            'minimumDeliveryFee', 'perBagDeliveryFee',
            'paymentMethod', 'accountNumber', 'routingNumber', 'paypalEmail',
            'languagePreference', 'termsAgreement', 'socialToken'
          ];
```

Replace with:

```javascript
          const formFields = [
            'inviteToken',
            'firstName', 'lastName', 'email', 'phone', 'businessName',
            'address', 'city', 'state', 'zipCode',
            'minimumDeliveryFee', 'perBagDeliveryFee',
            'paymentMethod', 'accountNumber', 'routingNumber', 'paypalEmail',
            'languagePreference', 'termsAgreement', 'socialToken'
          ];
```

- [ ] **7.7 Register the script in the SPA router.** In `public/assets/js/embed-app-v2.js` (line ~595) the `/affiliate-register` `pageScripts` entry ends with:

```javascript
'/assets/js/affiliate-register-init.js', '/assets/js/affiliate-register-page-init.js'],
```

Replace with:

```javascript
'/assets/js/affiliate-register-init.js', '/assets/js/affiliate-register-page-init.js', '/assets/js/affiliate-register-invite.js'],
```

(`/affiliate-register` already exists in `EMBED_PAGES` at line 52 — no change there. Both maps are now consistent per PITFALLS #3.)

- [ ] **7.8 Add the i18n keys — all four languages in this same commit.** Every locale file begins:

```json
{
  "common": {
```

In each file insert the new top-level key between `{` and `"common": {`:

`public/locales/en/common.json`:

```json
{
  "affiliateRegister": {
    "invite": {
      "invalidOrExpired": "This invitation link is invalid or has expired. Please contact WaveMAX to request a new invitation.",
      "emailLocked": "Your email is set by your invitation and cannot be changed."
    }
  },
  "common": {
```

`public/locales/es/common.json`:

```json
{
  "affiliateRegister": {
    "invite": {
      "invalidOrExpired": "Este enlace de invitación no es válido o ha expirado. Comuníquese con WaveMAX para solicitar una nueva invitación.",
      "emailLocked": "Su correo electrónico está definido por su invitación y no se puede cambiar."
    }
  },
  "common": {
```

`public/locales/pt/common.json`:

```json
{
  "affiliateRegister": {
    "invite": {
      "invalidOrExpired": "Este link de convite é inválido ou expirou. Entre em contato com a WaveMAX para solicitar um novo convite.",
      "emailLocked": "Seu e-mail é definido pelo seu convite e não pode ser alterado."
    }
  },
  "common": {
```

`public/locales/de/common.json`:

```json
{
  "affiliateRegister": {
    "invite": {
      "invalidOrExpired": "Dieser Einladungslink ist ungültig oder abgelaufen. Bitte kontaktieren Sie WaveMAX, um eine neue Einladung anzufordern.",
      "emailLocked": "Ihre E-Mail-Adresse ist durch Ihre Einladung festgelegt und kann nicht geändert werden."
    }
  },
  "common": {
```

Then verify all four files still parse:

```bash
node -e "['en','es','pt','de'].forEach(l => { JSON.parse(require('fs').readFileSync('public/locales/'+l+'/common.json','utf8')); console.log(l, 'OK'); })"
```

Expected: `en OK` / `es OK` / `pt OK` / `de OK`.

- [ ] **7.8b Retire the landing-page "Become an Affiliate" CTA — same commit as the gate.** PR 2 Task 4 rewired the old beta CTA in `public/embed-landing.html` to a plain link: `<a id="joinBetaBtn" href="/embed-app-v2.html?route=/affiliate-register" ...><span data-i18n="landing.cta.createAccount">Become an Affiliate</span></a>`. Once this PR's gate lands, that page without `?invite=` shows only the invalid-invitation notice — a permanent public dead-end. Replace the anchor with an informational line (no link, no inline styles — reuse an existing utility class on the page):

```html
                                    <p id="joinBetaBtn" class="landing-invite-note"><span data-i18n="landing.cta.inviteOnly">Affiliates join by invitation — contact WaveMAX to get started.</span></p>
```

  (If `landing-invite-note` doesn't exist in the page's stylesheet, add it to the page's external CSS file — strict CSP, no inline styles.) Then in all four locale files: add `landing.cta.inviteOnly` — en `"Affiliates join by invitation — contact WaveMAX to get started."` · es `"Los afiliados se unen por invitación — contacte a WaveMAX para comenzar."` · pt `"Os afiliados entram por convite — entre em contato com a WaveMAX para começar."` · de `"Partner werden nur auf Einladung aufgenommen — kontaktieren Sie WaveMAX, um zu starten."` — and DELETE the now-orphaned `landing.cta.createAccount` key from all four files (confirm orphanhood first: `grep -rn "landing.cta.createAccount" public/ --include='*.html' --include='*.js'` → only the line being replaced).

- [ ] **7.9 Run the touched unit test + full suite:**

```bash
npm test -- tests/unit/affiliateRegisterInvite.test.js
npm test
```

Expected: green.

- [ ] **7.10 Commit:**

```bash
git add public/assets/js/affiliate-register-invite.js public/affiliate-register-embed.html public/assets/js/affiliate-register-init.js public/assets/js/embed-app-v2.js public/embed-landing.html public/locales/en/common.json public/locales/es/common.json public/locales/pt/common.json public/locales/de/common.json tests/unit/affiliateRegisterInvite.test.js
git commit -m "feat(register-ui): invite gate on affiliate registration — email lock, prefill, invalid state, landing CTA retired + en/es/pt/de i18n"
```

---

## Verification

- [ ] **Full suite, clean exit (no `--forceExit`):**

```bash
npm test
```

Expected: 0 failures, Jest exits on its own.

- [ ] **No circular deps introduced:**

```bash
npx madge --circular server/
```

Expected: `No circular dependency found!`

- [ ] **Lint the new/changed server files (`console.*` is ESLint-blocked in `server/`):**

```bash
npx eslint server/modules/onboarding/ server/routes/affiliateInviteRoutes.js server/routes/administratorRoutes.js server/controllers/affiliateController.js server/services/email/dispatcher/onboarding.js
```

Expected: no errors.

- [ ] **No raw-token leaks:** confirm no log line or API response includes a raw invite token:

```bash
grep -rn "rawToken" server/ --include=*.js | grep -i "logger\|sendSuccess\|res\." 
```

Expected: no hits (the only `rawToken` consumers are the service internals, the email URL builder, and the registration consume call).

- [ ] **Manual smoke (dev server):**
  1. Start the app, log in as an admin with `manage_affiliates`.
  2. `POST /api/v1/administrators/affiliate-invites` with `{ "email": "you+invitee@example.com", "prefill": { "firstName": "Smoke" } }` (CSRF header from `/api/csrf-token`) → 201; with `EMAIL_PROVIDER=console` the invite email (with the `?route=/affiliate-register&invite=…` URL) prints to the console.
  3. Open `http://localhost:3000/embed-app-v2.html?route=/affiliate-register&invite=<raw-from-console>` → form shows, email field prefilled + read-only with the "set by your invitation" note, prefill hints applied.
  4. Open the same page with `&invite=garbage` (and with no `invite` param) → form hidden, red "invitation link is invalid or has expired" notice shown.
  5. Submit the valid-invite form → 201; re-open the same invite URL → invalid notice (single-use); `GET /api/v1/administrators/affiliate-invites?status=accepted` shows the consumed invite with `acceptedAffiliateId`.
  6. Switch the language picker to es/pt/de on the invalid-state page → the notice copy translates.

- [ ] **PR description text:**

```
PR 5 — AffiliateInvite + invite-bound registration

Implements spec §4.2 + §6.2 (invite half) + §12 PR5 of the invite/bag/workflow redesign.

- New module server/modules/onboarding/: AffiliateInvite model (sha256 tokenHash only —
  raw token exists solely in the emailed link; atomic single-use consume static),
  inviteService (createInvite/validateInvite/consumeInvite/resendInvite/revokeInvite,
  typed InviteError), inviteController.
- Admin endpoints (administrator + manage_affiliates + CSRF + sensitiveOperationLimiter):
  POST/GET /api/v1/administrators/affiliate-invites, POST .../:inviteId/resend (re-mints
  the token, old link dies), POST .../:inviteId/revoke.
- Public GET /api/v1/affiliate-invites/:token/validate — anti-enumeration: every failure
  is the same generic 410 {reason}; 'expired' is the only specific reason.
- Email: new dispatcher server/services/email/dispatcher/onboarding.js
  (sendAffiliateInviteEmail) + affiliate-invite.html template in en/es/pt/de
  (link-only; transport blocks attachments). Invite URL:
  https://wavemax.promo/embed-app-v2.html?route=/affiliate-register&invite=<raw>.
- registerAffiliate rework: inviteToken required; email is ALWAYS taken from the invite
  (client email ignored); after save the invite is consumed atomically — on race loss the
  affiliate is rolled back and 409 returned. Audit: INVITE_MINTED/CONSUMED/REVOKED.
- Frontend: affiliate-register page reads ?invite=, validates, locks the email field,
  applies prefill, and shows an invalid/expired state; new script registered in pageScripts;
  i18n keys affiliateRegister.invite.* shipped in en/es/pt/de.

Out of scope (per spec): W-9 multipart upload on registration (PR 10 — registration stays
JSON-only here); OAuth affiliate registration path is not invite-gated in this PR.

Tests: unit (model statics incl. concurrent consume; service incl. resend re-mint and
email-failure resendability; dispatcher templates ×4 langs; frontend gate) + integration
(RBAC/CSRF/duplicate on mint; resend/revoke; anti-enumeration validate; invite-bound
registration incl. client-email-ignored, reuse 409, deterministic race-loss rollback,
concurrent double-register → exactly one affiliate). Full suite green without --forceExit.
```

