# WaveMAX Affiliate Program — Refactor Design Document

**Status:** Draft for review — clean-slate redeploy
**Date:** 2026-04-17
**Audience:** Engineering, operations
**Companion doc:** [REFACTORING_PLAN.md](REFACTORING_PLAN.md)

> **Scope note (2026-04-17):** Production has no data requiring preservation. This refactor will be completed via a complete redeployment with a fresh database. The "current state" sections below remain accurate. The "target state" is still the goal. The migration-risk discussion (§6) is largely moot — we build the target directly instead of migrating. See `REFACTORING_PLAN.md` for the revised phase structure.

---

## 1. Executive Summary

WaveMAX Affiliate Program is a production Node.js / Express / MongoDB system that powers a laundry pickup-delivery affiliate network. Core business functions (affiliate onboarding, customer registration, order lifecycle, bag tracking, payments, W-9 compliance, QuickBooks export, OAuth, iframe embedding) all work. The system is **functional and secure**; it is not functional *clearly*.

Accumulated technical debt includes:

- **Four controller files over 1,500 lines each** (combined ~8,800 lines across 4 files).
- **One 3,618-line email service** doing transport, templating, dispatch, and logging.
- **One circular dependency** between `customerController` and `paymentController`.
- **V1 and V2 payment systems coexisting** inside the same `Order` model and controllers, switched at runtime via `SystemConfig`.
- **~40% of the 94 documentation files** are redundant, stale HTML, or superseded.
- **~60% of the 115 scripts** in `scripts/` are one-time migrations or debug tools that should be archived.
- **`self-serve-laundry.css` at 2.7 MB** (almost certainly bundled debris).
- **Two 78 KB copies of the parent-iframe bridge** (`parent-iframe-bridge-v2.js`, `parent-iframe-bridge-inline.js`).
- **DocuSign access/refresh tokens and OAuth provider tokens stored as plaintext** in MongoDB.
- **`keys/*.pem` committed to the git repository** (DocuSign private key).
- **`coverage-test-run.txt` (2.1 MB) and a literal `[A` file** at repo root.
- **48 consistently failing tests and 70 skipped tests** out of ~2,700; suite requires `--runInBand --forceExit` because of unclosed handles.

None of these issues individually blocks operation. Together they create a codebase where making the next change is substantially harder than it should be. The target of this refactor is a cleaner, more maintainable shape — with **zero production downtime, zero customer data loss, and a reversible migration path for every change**.

---

## 2. Current State

### 2.1 High-Level Topology

```
                ┌──────────────────────────────────────┐
                │  wavemax.promo (parent marketing site) │
                │  ─ embeds iframe via parent-iframe-bridge-v2.js │
                └──────────────┬───────────────────────┘
                               │ postMessage
                               ▼
                ┌──────────────────────────────────────┐
                │  embed-app-v2.html (SPA shell)       │
                │  ─ client router, dynamic page load  │
                │  ─ CSP v2 compliant, nonce-based     │
                └──────────────┬───────────────────────┘
                               │ fetch /api/v1/*
                               ▼
        ┌──────────────────────────────────────────────────┐
        │  server.js (Express)                             │
        │  ─ helmet, CSP, CORS, sanitize, CSRF, rate-limit │
        │  ─ routes/ → controllers/ → services/ → models/  │
        └──┬─────────┬────────┬────────┬─────────┬─────────┘
           │         │        │        │         │
           ▼         ▼        ▼        ▼         ▼
        MongoDB  Mailcow  DocuSign  Paygistix  OAuth (G/F/LI)
                 (SMTP+   (W-9)    (V1 pay)   + IMAP (V2 pay)
                 IMAP)
```

### 2.2 Backend Structure

**`server/`**

| Subdir | Files | Notes |
|---|---|---|
| `models/` | 17 | Mongoose schemas. Core entities solid; two carry crypto (`Affiliate`, weak spots in `DocuSignToken`/OAuth tokens). |
| `controllers/` | 12 | Four are severely bloated (see §2.4). |
| `routes/` | 23 | No API versioning (`/api/v1/*`) — a thin `v2CustomerRoutes` exists but is underused. `testRoutes.js` is 513 lines and registered in production. |
| `middleware/` | 8 | Auth, RBAC (split across two files totaling 729 lines), CSRF, rate limiting, sanitization. Stack order is correct. |
| `services/` | 9 | DocuSign, Paygistix, payment email scanner (IMAP), Mailcow SMTP, address validation, callback pool, service area. |
| `jobs/` | 1 | `paymentVerificationJob.js` (V2 only, cron). |
| `monitoring/` | 1 | `connectivity-monitor.js` — healthchecks for Mongo, SMTP, Paygistix, DocuSign, QB. |
| `utils/` | 15 | Includes the **3,618-line `emailService.js`**. |
| `config/` | 4 | `passport-config.js` (594), `csrf-config.js` (350), `paygistix.config.js`, `storeIPs.js`. |
| `templates/` | — | Email templates, V1 plus a `v2/` variant. |

### 2.3 Frontend Structure (`public/`)

- **65 HTML**, **47 CSS**, **94 JS** files.
- **Active SPA shell:** `embed-app-v2.html` + `embed-app-v2.js` (50 KB client router).
- **Deprecated stub:** `embed-app.html` (redirect only).
- **iframe bridge:** `parent-iframe-bridge-v2.js` (78 KB) is live on the parent domain; `parent-iframe-bridge-inline.js` (78 KB) appears to be a duplicate.
- **Demo / dev pages shipping in public/:** `test-operator-scan.html`, `test-payment-form.html`, `test-v2-payment.html`, `swirl-spinner-demo.html`, `wavemax-development-prompt.html`, `products-placeholder.html`, `iframe-parent-example*.html`, `privacy-policy-old.html`.
- **Internal tooling in public/:** `public/coverage-analysis/` (5 files, test-coverage reports), `public/filmwalk/` (4 files, 132 KB, standalone demo, unclear status), `public/monitoring-dashboard.html`.
- **V1/V2 duplication (both wired up):**
  - `customer-register-embed.html` ↔ `customer-register-v2-embed.html` (plus 4+ JS variants: `customer-register.js`, `-v2.js`, `-navigation.js`, `-v2-navigation.js`, `-paygistix.js`, `-updated.js`).
  - `schedule-pickup-embed.html` ↔ `schedule-pickup-v2-embed.html`.
  - `paygistix-payment-form-v2.js` (62 KB) vs legacy payment forms (quarantined).
- **Anomalies:**
  - `public/assets/css/self-serve-laundry.css` is **2.7 MB** — almost certainly a bundled-in framework (Tailwind build?) that should be trimmed, minified, or tree-shaken.
  - Top init bundles are large: `administrator-dashboard-init.js` (137 KB), `affiliate-register-init.js` (121 KB), `operator-scan-init.js` (93 KB).
- **i18n:** `public/locales/{en,es,pt,de}/common.json` — four languages, consistent, solid.

### 2.4 Controller & Service Bloat

| File | Lines | Exported ops | Problem |
|---|---:|---:|---|
| `controllers/administratorController.js` | 2,729 | 35 | Admin CRUD + operator mgmt + system config + analytics + beta + audit |
| `controllers/authController.js` | 2,442 | 18 | Traditional auth + OAuth + password reset + token refresh |
| `controllers/operatorController.js` | 1,887 | 23 | Operator auth + bag scanning + order workflow |
| `controllers/orderController.js` | 1,746 | 16 | Order CRUD + pricing + WDF + payment + commission |
| `utils/emailService.js` | 3,618 | — | SMTP transport + template loader + dispatcher + logging |
| `controllers/customerController.js` | 1,209 | 12 | Customer CRUD + V1/V2 registration branching |
| `controllers/affiliateController.js` | 1,055 | 12 | Focused, but over the healthy size |
| `services/docusignService.js` | 630 | — | Envelope creation, webhooks, token refresh |
| `services/paymentEmailScanner.js` | 585 | — | IMAP monitoring for Venmo/PayPal |
| `routes/testRoutes.js` | 513 | — | Test endpoints reachable in production |

### 2.5 Data Model

17 Mongoose models. Summary table follows.

| Collection | Role | Refs | Encryption | Risk |
|---|---|---|---|---|
| `affiliates` | Core actor | owns customers | `paypalEmail`, `venmoHandle` (AES-256-GCM); OAuth tokens **plaintext** | HIGH |
| `customers` | Core actor | → affiliate | none | HIGH |
| `orders` | Core txn | → customer, affiliate, operator (×3) | none; dual payment fields (V1 + V2) + legacy `bagWeights[]` alongside new `bags[]` | CRITICAL |
| `payments` | V1 Paygistix ledger | → order, customer | none | HIGH |
| `operators` | Facility staff | → administrator (createdBy) | PBKDF2 password | MEDIUM |
| `administrators` | System users | — | PBKDF2 password | MEDIUM |
| `systemconfigs` | Runtime config (e.g. `payment_version`) | → admin (optional) | none | MEDIUM |
| `transactions` | Affiliate payout ledger | → affiliate, orders[] | none | MEDIUM |
| `paymentexports` | QuickBooks export records | → admin | none | MEDIUM |
| `docusigntokens` | W-9 OAuth tokens | — | **plaintext tokens** | MEDIUM-HIGH |
| `datadeletionrequests` | GDPR/FB compliance | → affiliate, customer | none | MEDIUM |
| `callbackpools` | Paygistix callback slot mgmt | — | none | LOW |
| `refreshtokens` | JWT refresh | polymorphic user | none; TTL index | LOW |
| `tokenblacklists` | Logout tracking | polymorphic user | none; TTL index | LOW |
| `oauthsessions` | OAuth handshake state | — | none; TTL index | LOW |
| `paymenttokens` | V1 payment handshake state | — | none; TTL index | LOW |
| `betarequests` | Dormant contact-form archive | — | none | LOW |

**Notable facts:**

- **V1 and V2 payment systems coexist inside `Order`.** Parallel field sets: `paymentStatus`/`isPaid` (V1) and `v2PaymentStatus`/`v2PaymentMethod`/`v2PaymentAmount`/`v2PaymentLinks`/`v2PaymentQRCodes`/`v2PaymentReminders` (V2). Choice is driven by `Customer.registrationVersion` + `SystemConfig.payment_version`.
- **`Order` has legacy `bagWeights[]` alongside modern `bags[]`** (QR-tracked three-stage workflow). Legacy kept for backward compat.
- **Audit log is file-based** (Winston → filesystem), not persisted in MongoDB. Compliance review may want this in a collection.
- **Rate-limit counters live in MongoDB** via `rate-limit-mongo`.
- **No discriminators.** All variation handled by conditional logic in controllers and pre-save hooks.

### 2.6 Security Posture (Current)

Strengths:

- JWT with blacklist on logout, short-lived access tokens, separate refresh tokens.
- AES-256-GCM encryption helper with authenticated encryption.
- CSP v2 with per-request nonces (most pages; some legacy pages still use `unsafe-inline`).
- Conditional CSRF with public / auth / registration / critical endpoint tiers.
- MongoDB-backed rate limiting, NoSQL sanitization, XSS escaping.
- RBAC matrix with per-role field filtering.

Weaknesses:

- **`keys/*.pem`** (DocuSign private key) committed to git. This is the single most urgent finding in this document.
- **`DocuSignToken.accessToken` / `refreshToken` stored plaintext.** Anyone with DB read access can act as the DocuSign integration.
- **`Affiliate.socialAccounts.{provider}.accessToken` / `refreshToken` stored plaintext.** Same class of issue.
- `secure/w9-documents/` may contain PII; needs audit. If real W-9 PDFs, should not be in git.
- `temp/pkce/` is written at runtime but not gitignored.
- `testRoutes.js` (513 lines) is mounted unconditionally.

### 2.7 Documentation

- **94 doc files** (70 MD + 24 HTML) in `docs/` and root.
- **`README.md` is 88 KB** with a 52-item marketing feature list and a 200-line file-tree dump.
- **9 Paygistix docs** exist across 3 locations; only `docs/implementation/PAYGISTIX_INTEGRATION_GUIDE.md` (952 lines) is actually current.
- **23 HTML docs are undated** and largely superseded by MD equivalents.
- **Two CLAUDE.md files** may exist (`.claude/CLAUDE.md` and `docs/development/CLAUDE.md`); needs dedup.
- **`REFACTORING_COMPLETE.md`** at root describes a *previous* refactor (Sept 2025).

### 2.8 Tests

- **150 test files, ~2,700 tests**, ~96% pass rate.
- **48 consistently failing tests** — root cause is `SystemConfig` defaults not seeded in `tests/setup.js`, breaking Mailcow/config-dependent tests.
- **70 skipped tests** — some deprecated (WDF credit system integration), some for unimplemented endpoints, some frontend placeholders.
- **`--runInBand --forceExit`** is required — unclosed Mongo connections and/or timers leak between suites.
- **Zero real frontend test coverage** — `tests/frontend/` uses `describe.skip()` and has no jsdom env.
- **Untested or barely tested:** `quickbooksController`, `marketingController`, `imapEmailScanner`, `paymentEmailScanner`, `callbackPoolManager`, `affiliateScheduleController`.

### 2.9 Operational Cruft

Root-level debris:

- `coverage-test-run.txt` — 2.1 MB of Jest output.
- `[A` — a file literally named `[A` (shell escape sequence mis-written), 843 bytes.
- `.env.example` (3.5 KB) *and* `env.example` (5.2 KB) — pick one.
- `REFACTORING_COMPLETE.md` at root — historical, belongs under `docs/project-history/`.
- `init.prompt` — Claude Code dev artifact, keep but note its role.
- `operator-credentials-example.json` — unreferenced, should move to `docs/examples/`.

Directory debris:

- `quarantine/` (4 subdirs: `legacy-embed-app`, `legacy-payment-forms`, `unused-paygistix-pages`, `unused-payment-pages`) — nothing references any of it.
- `scripts/` — 115 files; ~60% are one-time migrations or debug. A dozen are active admin tools.
- `project-logs/` — implementation notes mixed with date-stamped logs; should live under `docs/`.
- `temp/`, `secure/`, `keys/` — ungitignored, potentially sensitive.
- `public/coverage-analysis/`, `public/filmwalk/` — internal / demo, not production.

---

## 3. Pain Points, Ranked

| # | Pain | Severity | Effort to Fix |
|---:|---|:---:|:---:|
| 1 | `keys/*.pem` committed to git | **Critical (security)** | Small (+ key rotation) |
| 2 | DocuSign / OAuth tokens stored plaintext in Mongo | High (security) | Medium |
| 3 | `emailService.js` (3,618 lines) is a god object | High | Medium |
| 4 | Four 1,500+ line controllers | High | Medium-large |
| 5 | V1/V2 payment systems tangled inside `Order` | High | Large (data migration) |
| 6 | Circular dep `customerController ↔ paymentController` | Medium | Small |
| 7 | `self-serve-laundry.css` at 2.7 MB | Medium | Small |
| 8 | ~40% stale docs, duplicate Paygistix guides, 88 KB README | Medium | Small-medium |
| 9 | 48 failing tests from `SystemConfig` seeding gap | Medium | Small |
| 10 | `--runInBand --forceExit` hides leaked handles | Medium | Medium |
| 11 | `quarantine/`, `coverage-test-run.txt`, `[A`, duplicate env files | Low | Trivial |
| 12 | 115 scripts, ~60% obsolete | Low | Small |
| 13 | `testRoutes.js` mounted in production | Medium (security/perf) | Small |
| 14 | Inconsistent logging (`console.*` vs `logger.*`) | Low | Small |
| 15 | RBAC split across two files (729 lines combined) | Low | Small |
| 16 | Duplicate 78 KB parent-iframe bridges | Low | Small |
| 17 | Zero real frontend tests | Medium | Medium |
| 18 | Legacy `bagWeights[]` coexists with `bags[]` | Low | Small (once V1 removed) |
| 19 | No API versioning discipline (all `/api/v1/*`) | Low | Medium |
| 20 | Audit log is file-only, not persisted | Low | Medium |

---

## 4. Target State

### 4.1 Guiding Principles

1. **Production runs throughout the refactor.** No scheduled downtime. No coordinated flag-day migrations.
2. **Every change is reversible.** Database migrations are additive until the feature that consumes the old shape is retired. Feature flags gate cutovers. Backups precede every migration window.
3. **Replace, don't rewrite.** The goal is not a green-field rebuild; it is systematic decomposition of the existing tree.
4. **Tests first for any non-trivial change.** The suite is our safety net; stabilize it before leaning on it.
5. **One concern per file.** Controllers under ~500 lines, services under ~400, utils under ~300 unless there's a strong reason.
6. **No more V1/V2-in-one-file.** Where they must coexist, separate by strategy/module so they can be independently retired.
7. **Secrets out of git, always.** Every remaining `.pem`, API key, and credential gets evicted and rotated.
8. **Docs that are current or gone.** No "archive" middle ground that accretes indefinitely.

### 4.2 Target Architecture

```
server/
├─ api/                        ← renamed from routes/; versioned
│  ├─ v1/                      ← legacy endpoints; frozen, kept alive
│  └─ v2/                      ← refactored endpoints; all new work lands here
├─ modules/                    ← new: feature-scoped modules
│  ├─ affiliate/
│  │  ├─ controller.js         (<500 lines)
│  │  ├─ service.js
│  │  ├─ model.js              (re-export of models/Affiliate)
│  │  └─ __tests__/
│  ├─ auth/
│  │  ├─ controller.js         (core auth)
│  │  ├─ oauth-controller.js   (split-out OAuth flows)
│  │  ├─ password-reset-controller.js
│  │  └─ service.js            (token issuance, blacklist)
│  ├─ customer/
│  ├─ order/
│  │  ├─ controller.js
│  │  ├─ pricing-service.js    ← extracted from controller + pre-save hook
│  │  ├─ bag-tracking-service.js
│  │  └─ payment/
│  │     ├─ v1-strategy.js     ← Paygistix
│  │     └─ v2-strategy.js     ← post-weigh (Venmo/PayPal/CashApp)
│  ├─ operator/
│  │  ├─ auth-controller.js
│  │  ├─ scan-controller.js
│  │  └─ service.js
│  ├─ administrator/
│  │  ├─ controller.js         (admin CRUD only)
│  │  ├─ system-config-controller.js
│  │  ├─ audit-controller.js
│  │  └─ analytics-controller.js
│  ├─ w9/                      (DocuSign W-9)
│  ├─ quickbooks/
│  ├─ marketing/
│  └─ billing/                 (affiliate payouts, commissions)
├─ models/                     ← unchanged location; schemas continue here
├─ middleware/
│  ├─ auth.js
│  ├─ authorization.js         ← merged authorizationHelpers + rbac
│  ├─ rate-limit.js
│  ├─ csrf.js
│  ├─ sanitize.js
│  └─ error-handler.js
├─ services/                   ← cross-module services only
│  ├─ email/
│  │  ├─ transport.js          ← SMTP (Mailcow) adapter
│  │  ├─ template-manager.js   ← template loading, i18n fallback
│  │  ├─ dispatcher.js         ← queue, retry, send API
│  │  └─ templates/            (moved from server/templates/)
│  ├─ encryption.js
│  ├─ address-validation.js
│  ├─ docusign/
│  ├─ paygistix/
│  ├─ payment-email-scanner/   (IMAP)
│  └─ callback-pool.js
├─ jobs/                       ← cron + background workers
├─ monitoring/
├─ config/
│  └─ passport.js
├─ utils/                      ← genuinely-shared low-level utils only
└─ index.js                    ← renamed from server.js → ./server/index.js
```

Entry point (`server.js`) stays at repo root for deployment compatibility, but it becomes a thin bootstrap that imports from `server/index.js`.

### 4.3 Frontend Target

- **Single embed shell:** `embed-app-v2.html` + `embed-app-v2.js`. `embed-app.html` redirect stub retained for 1 release cycle, then removed.
- **Single bridge file:** one `parent-iframe-bridge.js`. The `-inline` duplicate goes.
- **Module-scoped JS bundles:** one init script per page, under `public/assets/js/pages/`. Stop growing individual files past ~50 KB; split by concern.
- **CSS:** `self-serve-laundry.css` re-built (minified, unused rules stripped). Consolidate `*-embed.css` / `*.css` pairs. Keep `theme.css`, `modal-utils.css`, `language-switcher.css` as shared primitives.
- **Demo / test / dev pages removed** from `public/`. Anything still useful moves to `docs/examples/`.
- **`public/coverage-analysis/`** removed; coverage reports are a CI artifact, not a deployable.
- **`public/filmwalk/`** decision: confirm whether live, migrate or remove.
- **V1 registration/schedule-pickup pages** kept alive until V1 payments are retired; then removed together.

### 4.4 Data Model Target

- **`Affiliate.socialAccounts.{provider}.accessToken` / `refreshToken` encrypted** at rest using the existing `encryption.js` helper.
- **`DocuSignToken` tokens encrypted** at rest.
- **`Order` payment fields factored via strategy**:
  - Short-term: keep existing fields; move logic into per-version strategy modules.
  - Medium-term: once V1 is retired, drop V1 fields (`paymentStatus`, `isPaid`, Paygistix metadata) in a separate migration.
- **`Order.bagWeights[]` removed** after confirming no reader remains. Replaced entirely by `bags[].weight`.
- **Pricing engine** becomes a pure function in `modules/order/pricing-service.js`; `Order.pre('save')` calls it rather than recomputing inline.
- **Audit log** promoted to a MongoDB collection (`audit_events`) in addition to Winston. Feature-flagged; can be disabled.
- **Indexes reviewed**: spot-check `orders` for missing indexes on `customerId`, `affiliateId`, `createdAt`, `status`. Add as needed.

### 4.5 Security Target

1. `keys/` purged from git history; DocuSign integration key rotated; new keys loaded from env / secret manager only.
2. All third-party tokens (DocuSign, OAuth providers) encrypted at rest.
3. `testRoutes.js` mounted **only** when `NODE_ENV !== 'production'`.
4. `secure/w9-documents/` audited; if it contains real PII, moved to object storage with server-side encryption and no git presence.
5. Legacy CSP `unsafe-inline` fallbacks removed once all pages are nonce-compliant.

### 4.6 Testing Target

- `SystemConfig.initializeDefaults()` runs in `tests/setup.js` — removes the 48-test failure class.
- `--forceExit` removed once handle leaks are fixed; suite exits cleanly.
- `maxWorkers` raised from 1 back to `%50` once parallel safety is restored.
- Frontend test suite either implemented (jsdom-based, real tests) or deleted. No placeholder `describe.skip()`.
- Critical-path integration tests added for `quickbooksController`, `imapEmailScanner`, `paymentEmailScanner`, `affiliateScheduleController`.
- Coverage thresholds raised in `jest.config.js` once gaps close.

### 4.7 Documentation Target

- **Root:** `README.md` trimmed to ~2 KB — overview, quick start, link hub.
- **`docs/` restructured into 5 top-level areas:**
  - `docs/architecture/` — one `ARCHITECTURE.md`, one `DATA_MODEL.md`, one `SECURITY.md`.
  - `docs/integrations/` — Paygistix, DocuSign, QuickBooks, Venmo/IMAP, OAuth (one doc each).
  - `docs/operations/` — deployment, env vars, monitoring, runbooks.
  - `docs/guides/` — embed, i18n, mobile (keep as-is, already solid).
  - `docs/project-history/` — CHANGELOG + completed migration trackers.
- **Deleted entirely:** all HTML docs in `docs/` except `docs/examples/*` (which are reference implementations, not documentation). HTML redirects to their MD replacements during the transition.
- **Paygistix docs consolidated** to one guide + one quick reference.
- **Duplicate CLAUDE.md** reconciled; one lives in `.claude/`.
- **Every doc carries a `Last updated: YYYY-MM-DD`** header; staleness becomes visible.

### 4.8 Repo Hygiene Target

- `.gitignore` expanded to cover `keys/`, `temp/`, `secure/` (after verifying contents are reproducible), `project-logs/`, `coverage-test-run.txt`, `*.log`.
- `quarantine/` deleted.
- `scripts/` reorganized into `scripts/admin/`, `scripts/migrations/`, `scripts/debug/`, `scripts/setup/`. Obsolete scripts deleted.
- One env template (`.env.example`).
- `[A`, `coverage-test-run.txt`, `REFACTORING_COMPLETE.md` (→ `docs/project-history/`), `init-defaults.js` (→ `scripts/setup/`), `operator-credentials-example.json` (→ `docs/examples/`) all relocated or removed.

---

## 5. Non-Goals

These are explicitly **out of scope** for this refactor. They may be worth doing, but they are separate efforts:

- Migrating off Mongoose to another ORM or to a different database.
- Introducing TypeScript.
- Switching email provider away from Mailcow or payment gateway away from Paygistix.
- Rewriting the frontend in a framework (React/Vue/Svelte).
- Adding a microservices layer. The monolith stays.
- Changing deployment topology (Docker/PM2) beyond what's required to remove secrets from git.
- Feature additions. Scope is strictly cleanup + decomposition + migration.

---

## 6. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|:---:|:---:|---|
| Payment regression during V1/V2 strategy split | Medium | Critical | Feature flag + shadow-run new strategy; compare outputs; revert via flag |
| Data loss during encryption-at-rest migration for OAuth / DocuSign tokens | Low | High | Backup + per-field migration + re-link flow for users whose tokens fail to decrypt |
| Test suite not catching a regression (given current flake rate) | Medium | High | Stabilize suite *first*; add targeted integration tests for every controller split |
| `keys/` removal breaks production DocuSign until new key loaded | High | High | Coordinate with ops; new key in secret manager **before** git history rewrite |
| Frontend iframe bridge change breaks embed on parent site | Low | Critical | Keep both bridges live during transition; cut over via parent-site script tag swap |
| Mongo index rebuild during migration causes query latency | Low | Medium | Build indexes in `background: true`; run during low-traffic window |
| Someone needs an archived script and it's gone | Medium | Low | Archive, don't delete, until 6 months have passed |
| Refactor takes longer than estimated and blocks feature work | High | Medium | Phased delivery; each phase is independently valuable; pause between phases is fine |

---

## 7. Appendices

### 7.1 Appendix A — File-level Hot List

Files most likely to cause pain in the next 6 months if left alone:

```
server/utils/emailService.js                          3618 lines
server/controllers/administratorController.js         2729 lines
server/controllers/authController.js                  2442 lines
server/controllers/operatorController.js              1887 lines
server/controllers/orderController.js                 1746 lines
server/controllers/customerController.js              1209 lines
server/controllers/affiliateController.js             1055 lines
public/assets/css/self-serve-laundry.css              2.7 MB
public/assets/js/administrator-dashboard-init.js       137 KB
public/assets/js/affiliate-register-init.js            121 KB
public/assets/js/operator-scan-init.js                  93 KB
README.md                                               88 KB
```

### 7.2 Appendix B — Circular Dependency

```
server/controllers/customerController.js:750  require('./paymentController')
server/controllers/paymentController.js:338   require('./customerController')
```

Resolved by extracting the shared V2 payment verification logic into `modules/order/payment/v2-strategy.js` (or `services/payment-verification.js`), removing both requires.

### 7.3 Appendix C — Complete Script Categorization

See `REFACTORING_PLAN.md` §6 for the per-script keep/archive/delete table.

### 7.4 Appendix D — V1/V2 Coexistence Map

Clean-slate redeploy (see §0) means we delete V1 outright rather than retire it gradually. Paygistix itself is **not** being retired — it's the payment processor for the post-weigh workflow, and its callback pool is how status is returned for every payment. The split below is about which *workflow* (upfront vs post-weigh) uses Paygistix, not about Paygistix itself.

| Surface | V1 upfront-capture | V2 post-weigh (target state) | Action |
|---|---|---|---|
| Customer registration page | `customer-register-embed.html` | `customer-register-v2-embed.html` | Delete V1, rename V2 → unversioned |
| Schedule pickup page | `schedule-pickup-embed.html` | `schedule-pickup-v2-embed.html` | Delete V1, rename V2 → unversioned |
| Customer model | `registrationVersion: 'v1'` flag branch | `registrationVersion: 'v2'` flag branch | Delete the field; every customer is post-weigh |
| Order payment fields | `paymentStatus`, `isPaid` set at registration | `v2PaymentStatus`, `v2PaymentMethod` set post-weigh | Drop V1-only `isPaid`-at-registration semantics; rename `v2*` fields to unversioned. Paygistix-status fields (`paymentStatus` in its general sense, `transactionId`) stay. |
| Payment processor | Paygistix (called at registration) | Paygistix (called post-weigh) + Venmo/PayPal/CashApp (email-scan verification) | **Paygistix stays.** Just the timing of when it's called changes. |
| Email templates | `server/templates/emails/` | `server/templates/v2/` | Audit; keep the union used by the post-weigh flow, delete the rest |
| Route | `/api/v1/customers/register` | `/api/v2/customers/register` via `v2CustomerRoutes` | Merge into a single unversioned `/api/v1/customers/register`; drop `v2CustomerRoutes.js` |

### 7.5 Appendix E — Success Metrics

The refactor is complete when:

- No server-side file exceeds 800 lines (excluding generated code, `package-lock.json`).
- No controller exceeds 500 lines.
- `emailService.js` is removed, replaced by `services/email/{transport,template-manager,dispatcher}.js`.
- Zero `require()` cycles detected by `madge --circular .` on `server/`.
- No secret files in `git ls-files | grep -E '\.(pem|key|p12)$'` output.
- Test suite passes without `--forceExit`.
- Frontend test suite either has real tests or has been removed.
- `README.md` is under 5 KB and links to `docs/`.
- `docs/` contains zero stale HTML docs duplicated by MD.
- `quarantine/` does not exist.
- `scripts/` is under 50 files and each is categorized.
- CI runs `eslint`, `jest`, and a `madge --circular` check.

---

**End of DESIGN.md.** See `REFACTORING_PLAN.md` for phased execution.
