<!-- Generated from a multi-agent analysis of wavemax-affiliate-program (2026-06-20).
     Decisions applied: sellable/OSS starter · full commercial-grade scope ·
     Docker-first + PM2/nginx · Oracle ADB first-class. See README.md + ADDENDUM. -->

# Baseline Full-Stack Platform — Extraction & Implementation Plan

**Source:** `/mnt/c/Users/rickh/GitHub/wavemax-affiliate-program`
**Target:** a new, content-free, commercial-grade Node/Express + MongoDB + embedded-SPA starter stack
**Author:** lead engineer (extraction planning)
**Status:** spec input → execution plan

---

## 0. Guiding principles (read first)

1. **Greenfield-copy of platform modules, NOT clone-and-strip.** (Rationale in §2.) The new repo starts empty; we *copy in* the ~40 verified platform-core files and *re-author* the ~25 platform-generalize files. We never carry the WaveMAX git history, the 192 copyright-stamped files, or the 7,517 brand-string occurrences into the baseline.
2. **Two layers, hard boundary.** `platform/` (domain-free, reusable) vs `app/` (sample/domain). The baseline ships a *trivial* sample domain ("Widgets") to prove the platform end-to-end; a real customer deletes `app/` and writes their own.
3. **Config over code for everything brand/host-specific.** Every WaveMAX hardcode (domains, colors, copy, IPs, service names, roles) becomes a value in `platform/config/` loaded from env or a `brand.config.js` / `site.config.json`.
4. **TDD gate carries over verbatim.** The security/header/encryption/CSRF/IP-gate tests are the baseline's quality contract. They get copied first and must stay green through every phase.
5. **Lighthouse-100 release gate is inherited** as a documented standard, parameterized off WaveMAX's domains.

---

## 1. Repo scaffolding, naming, layout, licensing

### 1.1 Name & repo

- Working name: **`stack-baseline`** (placeholder; final name is a `git init` decision, not a code decision — nothing should hardcode it).
- Fresh `git init` (no history import). First commit = empty scaffold + LICENSE + README + CI skeleton.

### 1.2 Directory layout

```
stack-baseline/
├── server.js                      # slim bootstrap (target ≤ 350 lines vs WaveMAX's 1,294)
├── platform/                      # DOMAIN-FREE, reusable core
│   ├── config/
│   │   ├── brand.config.js        # NEW — brand name, colors, logo paths, contact
│   │   ├── hosts.js               # NEW — ALLOWED_HOSTS, CORS origins, frame-ancestors, redirect host
│   │   ├── roles.js               # NEW — role registry (replaces hardcoded 5-role hierarchy)
│   │   ├── routes.registry.js     # NEW — pluggable route mount table
│   │   ├── csrf-config.js         # from server/config/csrf-config.js (de-hardcode endpoint lists)
│   │   ├── storeIPs.js            # from server/config/storeIPs.js (verbatim — pure CIDR util)
│   │   └── seo-overrides.template.js  # from server/config/domainSeoOverrides.js (structure only)
│   ├── middleware/
│   │   ├── cspNonce.js            # verbatim
│   │   ├── sanitization.js        # de-hardcode "wavemax" password term
│   │   ├── errorHandler.js        # verbatim (+ Accept-header HTML/JSON split — see §8 risk)
│   │   ├── auth.js                # generalize role/id population
│   │   ├── rbac.js                # generalize role hierarchy → roles.js
│   │   ├── rateLimiting.js        # parameterize limits via env; drop conciergeLimiter
│   │   ├── rateLimitMongoStore.js # verbatim (custom store, avoids vulnerable underscore)
│   │   ├── ipGate.js              # NEW — generalized from adminIpGate.js + operatorIpGate.js
│   │   ├── accessGate.js          # generalize GATED_HOSTS + templates
│   │   └── comingSoon.js          # generalize hosts + page template
│   ├── services/
│   │   ├── authTokenService.js    # parameterize issuer/audience; role→idField via roles.js
│   │   ├── passwordResetService.js# pluggable USER_TYPES + email-sender map
│   │   ├── codeAttemptLockout.js  # parameterize store name + window
│   │   └── email/
│   │       ├── transport.js       # parameterize From/domain/TLS servername
│   │       ├── template-manager.js# keep loader+fill; strip formatTimeSlot/formatSize
│   │       └── dispatcher/
│   │           ├── index.js       # aggregator
│   │           ├── account.js     # NEW — generic welcome/reset/invite (replaces admin/affiliate/operator)
│   │           └── ops.js         # generalize service-down alert
│   ├── utils/
│   │   ├── encryption.js          # verbatim
│   │   ├── auditLogger.js         # strip domain AuditEvents; keep auth/security set
│   │   ├── logger.js              # service name from env
│   │   ├── controllerHelpers.js   # verbatim
│   │   ├── securityUtils.js       # verbatim
│   │   ├── passwordValidator.js   # strip "wavemax"/"laundry" from commonPasswords
│   │   ├── cspHelper.js           # verbatim
│   │   ├── paginationMiddleware.js# verbatim
│   │   ├── fieldFilter.js         # verbatim
│   │   ├── validators.js          # de-hardcode any brand terms
│   │   ├── formatters.js          # keep generic; drop currency/laundry specifics
│   │   ├── mongoCursorRetry.js    # verbatim (optional, gated ORACLE_BACKEND)
│   │   └── mongoOracleDiagnostics.js # verbatim (optional, gated ORACLE_DIAG)
│   ├── models/
│   │   ├── SystemConfig.js        # EMPTY initializeDefaults() (strip 40 laundry keys)
│   │   ├── Administrator.js       # keep auth scaffold; generalize permission enum
│   │   ├── User.js                # NEW — generic base user (auth fields only)
│   │   ├── RefreshToken.js        # verbatim; userType enum → free string
│   │   ├── TokenBlacklist.js      # verbatim; userType enum → free string
│   │   ├── AccessGate.js / AccessRequest.js / AccessWhitelist.js / AccessClick.js  # verbatim
│   │   └── Invite.js              # NEW — generalized from modules/onboarding/AffiliateInvite.js
│   ├── routes/
│   │   ├── authRoutes.js          # generalize to pluggable login strategies
│   │   ├── administratorRoutes.js # keep CRUD/config/health/env; drop affiliate/addon/analytics
│   │   ├── monitoringRoutes.js    # wire to real connectivity-monitor
│   │   ├── systemConfigRoutes.js  # verbatim-ish
│   │   ├── robotsSitemap.js       # NEW — generalized from server.js robots/sitemap routes
│   │   └── firebaseConfigRoute.js # optional, feature-flagged
│   ├── controllers/
│   │   ├── authController.js      # generalize 3 login flows → strategy pattern
│   │   ├── administratorController.js # strip domain-model imports + analytics
│   │   └── healthController.js     # NEW — extract /health
│   ├── monitoring/
│   │   └── connectivity-monitor.js# env-driven service registry
│   └── boot/
│       ├── db.js                  # NEW — Mongoose connect + pool + TLS (from server.js)
│       ├── security.js            # NEW — helmet + CSP + CORS + HTTPS redirect (from server.js)
│       ├── session.js             # NEW — express-session + connect-mongo (from server.js)
│       └── jobs.js                # NEW — RUN_BACKGROUND_JOBS leader gate
├── app/                           # SAMPLE DOMAIN ("Widget" CRUD) — deletable
│   ├── models/Widget.js
│   ├── routes/widgetRoutes.js
│   ├── controllers/widgetController.js
│   └── pages/ (sample embed pages + sample landing)
├── public/                        # platform SPA shell + sample assets only
│   ├── embed-app-v2.html          # generalize (route registry, roles, branding)
│   ├── assets/js/                 # platform JS (see Phase D copy list)
│   ├── assets/css/                # generic shell CSS + theme.css (tokens only)
│   └── locales/{en,es,pt,de}/common.json  # ~300 generic keys (not 1,553)
├── server/templates/emails/       # base + generic account/ops templates (en/es/pt/de)
├── scripts/                       # build-assets, ensure-indexes (auto-discover), setup, check-i18n
├── tests/                         # harness + platform-core tests + sample-domain test templates
├── docs/                          # LIGHTHOUSE-QUALITY-BAR, GA4-SETUP, HA, NEW-CUSTOMER-RUNBOOK
├── .env.example                   # platform-core vars only
├── ecosystem.config.js            # app name from env
├── jest.config.js / playwright.config.js / testSequencer.js
├── LICENSE / README.md / CONTRIBUTING.md
└── .github/workflows/ci.yml       # NEW
```

### 1.3 License / copyright genericization

- WaveMAX's `LICENSE` exists — **do not copy it**. Choose the baseline's license deliberately (MIT if it's a sellable starter shipped to customers; proprietary "All rights reserved" if it's an internal CRHS asset they resell). This is a Rick decision — flag at kickoff.
- The string `© 2025 CRHS Enterprises, LLC. All rights reserved.` appears in **192 files**. In the baseline it becomes a single template token `{{COPYRIGHT}}` sourced from `brand.config.js` (`copyright: '© {{YEAR}} {{COMPANY}}. All rights reserved.'`). No literal company name in any HTML/JS/email.
- Add a one-time CI guard (`scripts/check-no-brand.js`) that greps the tree for the forbidden literals (`wavemax`, `rundberglaundry`, `atxwashateria`, `atxwashdryfold`, `crhsent`, `CRHS`, `Austin`, `laundry`, `affiliate`, `bag`, `commission`) and fails the build if any appear outside `app/` or `docs/history/`. This makes genericization *enforced*, not aspirational.

---

## 2. Extraction strategy — recommendation

**Recommendation: greenfield-copy of platform modules into a fresh repo, with a per-file copy/generalize/reauthor decision.**

Why, over clone-and-strip:

- **The strip surface is enormous and intermixed.** `server.js` is 1,294 lines mixing infra with domain wiring; the brand footprint is ~7,517 string occurrences across 192 copyright-stamped files; locales are 1,553 lines (we want ~300). Clone-and-strip leaves a long tail of "did I get all of it?" — exactly what the `check-no-brand.js` guard is meant to prevent, and that guard is far easier to satisfy on a tree you *added to* than one you *subtracted from*.
- **Domain models are foreign-keyed into "platform" code.** `Bag` references `affiliateId`/`customerId`; `AffiliateInvite.acceptedAffiliateId` bakes "affiliate" into the schema; `Operator` fuses auth fields with `scanCodeHmac`/`qualityScore`. Stripping in place produces orphaned refs and broken pre-save hooks. Re-authoring `User`/`Invite`/`Administrator` cleanly is less work than untangling.
- **History hygiene.** The source repo has a committed private key (`keys/docusign_private.pem`, flagged compromised in CLAUDE.md). A clone inherits that in history forever. Greenfield gives a clean secret-free history.
- **The platform-core set is small and well-bounded.** I verified the exact files exist: ~18 utils, ~18 middleware, ~6 config, the email engine, the test harness. Copying these verbatim/near-verbatim is fast and low-risk.

Concretely: **copy verbatim** the pure-infra files (encryption, cspNonce, rateLimitMongoStore, storeIPs, errorHandler, controllerHelpers, securityUtils, cspHelper, paginationMiddleware, the Access* models, the test harness). **Re-author** the role-/domain-coupled ones (server.js → `boot/*`, auth/rbac, the 3 login flows → strategy, the user models, the email dispatchers, the locales). **Drop entirely** the domain set (see §5).

---

## 3 & 4. Phased sequence — subtasks, copy/strip/parameterize, acceptance

> Each phase ends green on `npm test` and (from Phase F) on CI. Phases A–C have no UI; D adds it. Effort estimates in §8.

### Phase A — Bootstrap + Security + Config skeleton

**Goal:** an Express app that boots, connects to Mongo, serves `/health`, and passes the security-header contract — with zero domain code.

**Copy (verbatim):**
- `server/utils/{encryption,logger,controllerHelpers,securityUtils,cspHelper,paginationMiddleware,fieldFilter,mongoCursorRetry,mongoOracleDiagnostics}.js`
- `server/middleware/{cspNonce,errorHandler,sanitization,rateLimitMongoStore}.js`
- `server/config/storeIPs.js`
- `server/utils/passwordValidator.js`

**Re-author from `server.js` into `platform/boot/`:**
- `db.js` ← lines 66–160 (Mongoose connect, pool 5/2, TLS, autoIndex:false, Oracle diagnostics gated by `ORACLE_DIAG`/`ORACLE_BACKEND`).
- `security.js` ← lines 164–512 (helmet, manual CSP w/ nonce, CORS, HTTPS redirect). CSP origin allowlist + `frame-ancestors` + CORS origins + redirect host all read from new `platform/config/hosts.js`.
- `session.js` ← lines 599–707 (express-session, connect-mongo, `/health` exempt from session, cookie name from env `SESSION_COOKIE_NAME`, `maxAge` from `SESSION_INACTIVITY_MINUTES`).
- New slim `server.js` that wires: token-redaction → helmet/CSP → CORS → sanitize → rate-limit → session → routes → errorHandler.

**New:**
- `platform/config/hosts.js`, `brand.config.js`, `platform/controllers/healthController.js`.
- `.env.example` — **platform-core vars only**: `PORT, NODE_ENV, LOG_LEVEL, LOG_DIR, MONGODB_URI, MONGODB_TLS, MONGODB_MAX_POOL_SIZE, MONGODB_MIN_POOL_SIZE, JWT_SECRET, ENCRYPTION_KEY, SESSION_SECRET, CSRF_SECRET, SESSION_COOKIE_NAME, SESSION_INACTIVITY_MINUTES, CORS_ORIGIN, ALLOWED_HOSTS, BASE_URL, FRONTEND_URL, TRUST_PROXY, COOKIE_SECURE, RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX_REQUESTS, AUTH_RATE_LIMIT_MAX, RELAX_RATE_LIMITING`. Each secret carries the `openssl rand -hex 32` comment.

**Strip/parameterize:** delete `conciergeLimiter` and all WaveMAX domains from CSP/CORS; remove `GOOGLE_PLACES_*`, `FIREBASE_*`, `PAYGISTIX_*`, `STRIPE_*`, `AWS_S3_*`, `SERVICE_STATE/CITY/RADIUS`, `EXPLORER/EXPEDITER_TOKEN`, `QUARANTINE_NON_AUSTIN`, `CORPORATE_SITE_URL` from `.env.example`.

**Copy tests (must pass):** `tests/integration/securityHeaders.test.js`, `tests/unit/{encryption,encryptionEnhanced,cspHelper,securityUtils,errorHandler}.test.js`, `tests/setup.js` + `tests/setup.isolated.js` (de-hardcode `MONGODB_URI=/wavemax_test`, `BASE_URL`, `EMAIL_FROM`), `jest.config.js`, `testSequencer.js`.

**Acceptance:** `npm start` boots; `GET /health` → `{status:'UP',...}`; `securityHeaders.test.js` green (HSTS, Referrer-Policy, nonce-based CSP with no `unsafe-inline` in `script-src`, frame-ancestors from config); `check-no-brand.js` returns clean for `platform/`.

---

### Phase B — Auth / RBAC / Admin shell (server-side)

**Goal:** JWT auth + refresh rotation + blacklist + pluggable RBAC + a generic Administrator account model + admin config/health/env endpoints. No UI yet.

**Copy (verbatim/near):**
- `server/models/{RefreshToken,TokenBlacklist}.js` (`userType` enum → free string).
- `server/utils/auditLogger.js` (keep `LOGIN_*`, `PASSWORD_RESET_*`, `ACCOUNT_*`, `UNAUTHORIZED_ACCESS`, `PERMISSION_DENIED`, `SUSPICIOUS_ACTIVITY`, `RATE_LIMIT_EXCEEDED`, `INVALID_CSRF_TOKEN`; **drop** `OPERATOR_SCAN`, `BAG_*`, `ORDER_*`, `AFFILIATE_*`, `COMMISSION_*`, `ADDON_*`, `DELIVERY_*`, `INVITE_*`→generic).
- `server/services/{authTokenService,passwordResetService,codeAttemptLockout}.js`.
- `server/config/csrf-config.js` (endpoint lists → config-driven allowlist built from `routes.registry.js`).

**Re-author:**
- `platform/models/Administrator.js` — keep `passwordSalt/Hash`, `setPassword/verifyPassword`, history, lockout (5/2h), reset-token, `hasPermission*`; **generalize the permission enum** to a free-form array validated against `roles.js` (drop `manage_affiliates`, `orders.read`, `operator_management`, etc.).
- `platform/models/User.js` — NEW base user: `userId, firstName, lastName, email(unique), role, passwordSalt/Hash, isActive, lastLogin, loginAttempts, lockUntil, passwordHistory, passwordResetToken/Expiry` + the same instance methods. This replaces Affiliate/Customer/Operator's auth half.
- `platform/middleware/auth.js` — populate `req.user = {id, role, ...}` generically; role→idField via `roles.js`; keep HS256 pinning + blacklist check + `requirePasswordChange` gate.
- `platform/middleware/rbac.js` — role hierarchy + permissions read from `roles.js` (no hardcoded 5-level chain); keep `checkRole/checkAllRoles/checkResourceOwnership/field-filter`; `checkOperatorStatus` → generic `checkRoleStatus(callback)`.
- `platform/controllers/authController.js` — **collapse the 3 login flows into a strategy pattern**: `POST /api/v1/auth/:userType/login` dispatching to a registered strategy (username/email/PIN). Keep lockout, constant-time PIN compare, refresh rotation, audit, rate-limit. Sample app registers an `email` strategy against `User`.
- `platform/controllers/administratorController.js` — keep administrator CRUD, password mgmt, permission listing, `/config`, `/env-variables`, `/system/health`, rate-limit reset; **remove** imports of Affiliate/Order/Customer/Operator and all `getOrderAnalytics`/`getAffiliateAnalytics`/`getDashboard` domain queries (replace `/dashboard` with a stub returning admin/user counts + a documented "register your own analytics" hook).
- `platform/routes/{authRoutes,administratorRoutes,systemConfigRoutes}.js` — drop `/affiliates`, `/addons`, `/analytics/{orders,affiliates,operators}`; rename `/operators` → `/staff` (or leave as a configurable entity route).
- `platform/models/SystemConfig.js` — keep schema + `getValue/setValue/getByCategory/getPublicConfigs`; **`initializeDefaults()` returns `[]`** (strip the 40 laundry keys: `wdf_base_rate_per_pound`, `bag_token_bytes`, `delivery_per_bag_fee`, `scan_session_ttl_minutes`, `max_operators_per_shift`, `store_pickup_address`, etc.); generalize category enum to `core|feature|operational`.

**New:** `platform/config/roles.js` (registry: `{ name, rank, permissions, idField, loginStrategy }`), `init-defaults.js` re-authored to seed **only** an Administrator (no hardcoded password — read `INITIAL_ADMIN_EMAIL` and either prompt or generate-and-print a one-time password, force `requirePasswordChange=true`; **no operator seed**).

**Copy tests:** `tests/unit/{authMiddleware,authController,csrfConfig,administrator,administratorController}.test.js`, `tests/integration/{auth,accountLockout,administratorRoutes,passwordValidation}.test.js`, plus `tests/helpers/{authHelper,csrfHelper,mockHelpers,responseHelpers,testUtils,testPasswords}.js` — `authHelper` role default `'affiliate'` → param; `testPasswords` keys `affiliate1/customer1/...` → `role[index]` scheme.

**Acceptance:** generic `email` login issues access+refresh; refresh rotates and old token is rejected (reuse-detected); logout blacklists; admin CRUD enforces RBAC from `roles.js`; `SystemConfig.initializeDefaults()` seeds nothing; `administrator.test.js` + `auth.test.js` green; `check-no-brand.js` clean.

---

### Phase C — Access gates + rate limiting

**Goal:** the full gate suite, generalized: IP gate(s), site access-gate (password + magic-link), coming-soon, rate limiters — all toggleable, fail-closed, host-scoped via config.

**Copy (verbatim):** `server/middleware/rateLimiting.js` (already in A's tree — finalize: limits from env, drop `conciergeLimiter`/`contactFormLimiter` brand copy, keep `skipInTest`, keep the production `RELAX_RATE_LIMITING` safety abort), `rateLimitMongoStore.js`, `server/config/storeIPs.js`.

**Re-author:**
- `platform/middleware/ipGate.js` — **merge** `adminIpGate.js` + `operatorIpGate.js` into one factory `makeIpGate({ allowlistEnvVars, label })`. Keep cf-connecting-ip extraction, CIDR (IPv4+IPv6 w/ `::` compression via `storeIPs.isInRange`), fail-closed-in-prod, stealth 404, path-normalization defense, call-time env read. Admin path = `makeIpGate({allowlistEnvVars:['ADMIN_ALLOWLIST','ADMIN_IP'],label:'admin'})`.
- `platform/middleware/accessGate.js` — keep double-opt-in magic-link, PBKDF2 password, in-memory cache + 60s refresh, send-throttle, token TTL, exempt paths, `SystemConfig` runtime toggle. **Parameterize:** `GATED_HOSTS` (env), `GATE_FROM` (env), all HTML/CSS templates → `platform/templates/gate/*.html` with `{{tokens}}`, link domain from request host, exempt `/owners/` → configurable exempt list. Models `Access{Gate,Request,Whitelist,Click}.js` copied verbatim.
- `platform/middleware/comingSoon.js` — keep noindex/nofollow holding-page + store-IP bypass + exempt paths. `COMING_SOON_HOSTS` from env; page content (business name/phone/address/hours/map) from `brand.config.js`; colors from theme tokens.

**Drop entirely (domain/tenant-specific, not baseline):** `explorerGuard.js`, `expediterGuard.js`, `franchisePreview.js`, `locationQuarantine.js`, `locationValidation.js`, `scanAuth.js`, and `server/config/{quarantineConfig,franchisePreviewCopy,locationData,domainSeoOverrides→template-only}.js`. (Document `franchisePreview` + `explorerGuard` patterns in `docs/patterns/` as optional add-ons; do not ship in core.)

**Copy tests:** `tests/unit/{adminIpGate,operatorIpGate→ipGate,accessGate,comingSoon,rateLimitingMiddleware,rateLimitMongoStore}.test.js` (merge the two IP-gate suites; parameterize hardcoded hosts).

**Acceptance:** unconfigured admin IP gate in `NODE_ENV=production` denies all (fail-closed) with stealth 404; CIDR match works for `::1` and `192.168.0.0/24`; access-gate magic-link flow (GET check → POST confirm) whitelists IP and survives worker restart via DB; coming-soon serves holding page to non-store IPs and real app to store IPs; rate limiter shares counter across workers; prod boot aborts if `RELAX_RATE_LIMITING=true`. Gate tests green.

---

### Phase D — SPA + build pipeline + i18n

**Goal:** the embedded CSP-compliant SPA shell, generalized to a route registry + config-driven roles + theme tokens, with the minification/cache-bust pipeline and the 4-language i18n engine (generic keys).

**Copy (verbatim — platform-core, no domain logic):**
- `public/assets/js/{modal-utils,swirl-spinner,csrf-utils,api-client,errorHandler,embed-config,i18n,language-switcher}.js`
- `public/assets/css/{modal-utils,swirl-spinner,language-switcher}.css`
- `public/assets/js/{iframe-bridge-v2,parent-iframe-bridge-v3}.js` (parameterize `allowedOrigins` → `hosts.js`; strip Austin standalone fallback + franchise location-data assumption)
- `server/middleware/cspNonce.js` (already copied)
- `scripts/build-assets.js` (the `ASSETS` array → loaded from `assets-config.json`)
- `scripts/check-i18n-parity.js` (update `REQUIRED_KEYS`/`REQUIRED_EMAIL_TEMPLATES`/`REQUIRED_PREFIXES` to the generic set)

**Re-author:**
- `public/embed-app-v2.html` + `public/assets/js/embed-app-v2.js` — keep router, height observer, postMessage, CSP-safe script/style injection, history, page cleanup. **Replace** the hardcoded `EMBED_PAGES` (70+ routes) and `pageScripts` maps with an externally-loaded `route-registry.json`. Replace hardcoded roles (`affiliate/administrator/operator`) and the email-param onboarding hack with `roles.js`-driven auth checks. Re-run minification → `.min.js`.
- `public/assets/js/session-manager.js` — role list + `PROTECTED_ROUTES`/`LOGIN_ROUTES` + localStorage key scheme (`${role}Token`) all config-driven; `SESSION_TIMEOUT` parameterized.
- `public/locales/{en,es,pt,de}/common.json` — **rebuild to ~300 generic keys** (`common.buttons.*`, `validation.*`, `navigation.*`, `errors.*`, `auth.*`, generic `orders.*`/`forms.*`). Drop `affiliateDashboard.*`, `claim.*`, `bag.*`, `operator.*`, `expediter.*`, landing marketing copy, admin laundry-ops keys. Drop `corporate.json` + `corporate-i18n.js` entirely (or stub as sample). `storageKey: 'wavemax-language'` → `'app-language'`; remove the `rundberglaundry.com` hostname check in `i18n.js`.
- `public/assets/css/{embed-app-v2,mobile-embed}.css` — keep shell layout/loading/modal-zfix/mobile; strip `wavemax-blue` etc. Drop `wavemax-embed.css`, `wavemax-mhr-modal.css`, `wavemax-theme.css`. New `theme.css` = CSS custom properties only (`--brand,--accent,--ink,--paper,--lead`) sourced from `brand.config.js` at render.

**Drop:** all `*-embed.html` domain pages (180+), all page-init scripts (`affiliate-*`, `operator-scan-*`, `claim.js`, `administrator-dashboard-*`, etc.), `franchise-host.html`, `austin-*` assets, `public/data/franchises*`, `public/content/site-pages.json`, `design-explorer/`, `crhsent/`.

**New (sample app, in `app/pages/`):** a generic `sample-login-embed.html` + `sample-list-embed.html` + their init scripts wired through the SPA shell, registered in `route-registry.json` — proves the platform end-to-end and serves as the page-builder template.

**Copy tests:** `tests/unit/cspHelper.test.js` (already), `tests/integration/assetCaching.test.js` (asset list → config). Add a router unit test (route resolution, cleanup, height-loop guard) as the new platform spec.

**Acceptance:** SPA boots in iframe; navigates between two sample pages via route registry; `i18n.init()` loads + switches en/es/pt/de on generic keys; `check:i18n` parity passes; `build:assets` regenerates `.min` with GENERATED banner; immutable cache headers on `/assets/*`, `max-age=60` on HTML; CSP strict (nonce, no inline). `check-no-brand.js` clean for `public/` + `platform/`.

---

### Phase E — Email engine

**Goal:** transport + template loader + i18n fallback + a generic dispatcher (welcome / password-reset / invite / ops-alert). No domain dispatchers.

**Copy (near-verbatim):**
- `server/services/email/transport.js` — From/domain/default-email/TLS-servername → config (`EMAIL_FROM`, `brand.config.js`).
- `server/services/email/template-manager.js` — keep `loadTemplate` (lang fallback), `fillTemplate`, `TEMPLATE_ROOT`; **strip** `formatTimeSlot`/`formatSize`; generalize `FALLBACK_TEMPLATE` branding.
- `server/services/email/dispatcher/index.js` (aggregator), `ops.js` (generalize URLs/brand/email → env+config).

**Re-author:**
- `platform/services/email/dispatcher/account.js` — NEW, replaces `admin.js`+`affiliate.js`+`customer.js`+`operator.js`+`onboarding.js`. Generic role-based functions: `sendWelcomeEmail({to, role, name, lang})`, `sendPasswordResetEmail(...)`, `sendInviteEmail({to, token, expiresAt, lang})`, `sendAdminNotification(...)`. **No** SystemConfig hard-dependency for admin email — inject via config. Move inline en/es/pt/de subjects to a content map.
- `platform/utils/emailService.js` — keep as compat shim re-exporting the generic dispatcher.
- `passwordResetService.js` (from Phase B) wires to `account.js` sender map.

**Templates:** copy `server/templates/emails/base-template.html` (logo `{{LOGO_URL}}`, copyright `{{COPYRIGHT}}`, brand `{{COMPANY_NAME}}`); author **generic** `account-welcome.html`, `password-reset.html`, `invite.html`, `order-status.html` (sample), each with matching `[PLACEHOLDER]` tokens across `en/es/pt/de`. Drop all `affiliate-*`, `customer-*`, `operator-*`, `order-ready/customer-on-the-way/customer-order-delivered` domain templates.

**Copy tests:** `tests/integration/emailService.integration.test.js` (mock domain dispatchers → mock generic ones), `tests/unit/emailService.test.js` (rewrite assertions). Update `check-i18n-parity.js` `REQUIRED_EMAIL_TEMPLATES`.

**Acceptance:** console transport renders a welcome + reset + invite email with correct lang fallback (es→en) and all placeholders filled; SMTP path configurable via env; parity check passes on the 4 generic templates × 4 langs. Email tests green.

---

### Phase F — Testing harness + CI gate

**Goal:** the Jest/Playwright harness as a *baseline* (config + helpers + platform tests + domain templates), and a GitHub Actions CI that runs lint, brand-guard, i18n-parity, and the full test suite.

**Copy (verbatim):** `jest.config.js`, `tests/setup.js`, `tests/setup.isolated.js`, `tests/testSequencer.js`, `tests/helpers/{mockHelpers,testUtils,csrfHelper,responseHelpers}.js`, `playwright.config.js`, `tests/e2e/static-server.js` (port → env, drop Austin comments), `tests/runAllTests.sh` + `runMemoryOptimizedTests.sh` (MONGODB_URI → placeholder).

**Generalize:** `tests/helpers/authHelper.js` (role param), `tests/helpers/testPasswords.js` (role-indexed). **Replace** `tests/testUtils.js` + `tests/helpers/v2TestHelpers.js` factories with a generic `createTestEntity(Model, overrides)` builder (deterministic IDs, password hashing, cleanup tracking).

**Provide as templates (not finished tests):** `tests/unit/GenericUserModel.test.js`, `tests/integration/{AuthFlow,ResourceCRUD,AccessControl}.integration.test.js`, `tests/e2e/template-reference/{landing,form,assets,seo}.spec.js` — each commented with "what to test for your domain."

**Keep as platform regression suite (already copied across A–E):** security headers, encryption, CSRF config, CSP helper, error handler, auth middleware/controller, rate limiting (×2), pagination, logger, validators, helpers, IP gate, access gate, coming soon, admin, account lockout, asset caching, seo crawlability, email integration, password validation.

**Drop:** all domain test files (~40 integration + ~30 unit: `affiliate*`, `customer*`, `operator*`, `order*`, `bags/*`, `scan*`, `kiosk*`, `franchise*`, `addons*`, `administrator addon UI`, `qrCodeGenerator`, `bagTokenParser`, `scanAuth`, the entire `tests/e2e/austin-reference/`).

**New CI (`.github/workflows/ci.yml`):** matrix on Node 20; steps = `npm ci` → `npm run lint` → `node scripts/check-no-brand.js` → `npm run check:i18n` → `npm test` (mongodb-memory-server, `RELAX_RATE_LIMITING` unset, `NODE_ENV=test`). Coverage gate: platform modules 90%, sample domain 60% (documented per-area thresholds).

**Acceptance:** `npm test` green with **no `--forceExit` needed** (carry over the WaveMAX "fully green, no env baseline" discipline); CI green on a clean clone; brand-guard + i18n-parity wired as required checks.

---

### Phase G — Deploy/ops + SEO/quality

**Goal:** PM2/HA/ops scaffolding and the SEO + Lighthouse-100 release gate, parameterized.

**Copy (near-verbatim):**
- `ecosystem.config.js` (app name from env).
- `scripts/ensure-indexes.js` — **auto-discover models** from `platform/models/` + `app/models/` (drop hardcoded model list) so new models always get indexes.
- `scripts/adb-heartbeat.js` (keep heartbeat pattern; strip Oracle comments → generic idle-DB keepalive).
- `scripts/ops/clean-logs.sh`.
- `platform/monitoring/connectivity-monitor.js` + `platform/routes/monitoringRoutes.js` (env-driven service registry; wire `/status` to real data; alert via generic `ops.js`).
- `platform/boot/jobs.js` — `RUN_BACKGROUND_JOBS` leader gate (default false), with `maybeStartBackgroundJobs(env)` helper + unit test; document the Phase-1.5 distributed-lease upgrade.

**Re-author SEO into `platform/`:**
- `platform/routes/robotsSitemap.js` ← `server.js` robots.txt + sitemap routes. Keep per-hostname resolution, AI-crawler blocklist, the **critical** `/embed-app-v2.html` not-disallowed rule, valid origin directives (the Cloudflare-injection fix). Disallow defaults `/api/,/admin/,/monitoring/`; per-host page list from `site.config.json`; domain list from `hosts.js`.
- `platform/config/seo-overrides.template.js` ← `domainSeoOverrides.js` structure only (per-host title/desc/H1/canonical/sameAs/FAQ-pool pattern; **no WaveMAX copy** — exemplar with placeholder values).
- `platform/controllers/seoTemplateController.js` ← the SSR `{{PLACEHOLDER}}` substitution engine from `franchiseController.js` (`loadTemplate/escapeHtml/escapeJsonForScript/buildPageSeo`), domain-agnostic; `PAGE_SEO_SPEC` → registry. Sample landing page in `app/pages/` exercises it.
- JSON-LD schema **structures** (LocalBusiness/Service/BreadcrumbList/FAQPage/Organization/WebSite+SearchAction), OG/Twitter, geo, hreflang — kept as `{{token}}` templates in the sample landing.

**Copy tests:** `tests/integration/seoCrawlability.test.js` (fixture-based domains), `crhsentCsp.test.js` → generic `staticPageCsp.test.js`.

**Docs:** `docs/LIGHTHOUSE-QUALITY-BAR.md` (strip rundberglaundry/IPs/pm2 specifics → "your domain / your infra"; keep procedure, `?lh=` cache-buster, per-category playbook, 100×4×2 gate), `docs/HA.md` (dual-AZ active-active + Cloudflare LB pattern, secrets-byte-identical, leader gate, `/health` monitor — strip IPs/hostnames/Ultahost), `docs/GA4-TRACKING-SETUP.md` (verbatim, generic analytics). Capture **nginx reverse-proxy as a template** in `docs/ops/nginx.conf.template` (it lives on prod boxes, not in the source repo — must be authored, see §8 risk).

**Acceptance:** `ensure-indexes` creates indexes for every discovered model; `/robots.txt` per-host valid + does not block `/embed-app-v2.html`; `/sitemap.xml` lists only canonicals; sample landing renders with self-canonical + JSON-LD; Lighthouse run on the sample landing (local, against running app) hits ≥95 across all four categories mobile+desktop (target 100). SEO tests green.

---

### Phase H — Theming/content layer + sample app

**Goal:** prove "new customer in a day" — a thin, deletable sample domain + a documented config-only path to rebrand.

**New:**
- `app/` sample "Widget" domain: `Widget` model (generic CRUD), routes/controller, two embed pages, one sample test using the generic factory. Registered via `routes.registry.js` + `route-registry.json`.
- `platform/config/brand.config.js` fully wired: company name, copyright, logo URLs, color tokens, contact (phone/address/hours), social `sameAs`, parent-frame origins. Changing only this file + `.env` + `site.config.json` rebrands the entire app (theme CSS tokens, email branding, coming-soon page, OG/schema, copyright).
- `site.config.json`: per-host SEO overrides + page registry + service definitions (the generic replacement for `domainSeoOverrides.js` + `site-pages.json`).
- `docs/NEW-CUSTOMER-RUNBOOK.md` (see §7).

**Acceptance:** following the runbook on a clean checkout, a fresh "Acme" brand boots, themes, sends a branded welcome email, serves a self-canonical landing with Acme schema, and passes `check-no-brand.js` — in well under a day. Delete `app/` → platform still boots, tests still green (proves the boundary).

---

## 5. Domain-removal checklist (excise from baseline)

**Models** (`server/models/`, `server/modules/`): `Affiliate.js`, `Customer.js`, `Order.js`, `Transaction.js`, `FranchisePreviewRequest.js`, `AddOn.js`, `Operator.js` (→ subsumed by generic `User`), `modules/bags/Bag.js`, `modules/onboarding/AffiliateInvite.js` (→ generic `Invite`).

**Modules (whole dirs):** `modules/bags/*`, `modules/orders/*` (`orderStateMachine`, `orderTransitionService`, `openOrderContext`), `modules/scan/*`, `modules/onboarding/{inviteController,inviteService,manualAffiliateController}` (re-author invite generically).

**Routes** (`server/routes/`): `affiliateRoutes`, `affiliateInviteRoutes`, `customerRoutes`, `orderRoutes`, `bagRoutes`, `operatorRoutes`, `scanRoutes`, `addonRoutes`, `expediterRoutes`, `franchiseRoutes`, `contactRoutes`, `corporateInquiryRoutes`, `serviceAreaRoutes`, `locationRoutes`, `mapsConfigRoute`, `docsRoutes`, `testRoutes`. **Keep+generalize:** `authRoutes`, `administratorRoutes`, `systemConfigRoutes`, `monitoringRoutes`, `firebaseConfigRoute` (optional).

**Controllers** (`server/controllers/`): `affiliateController`, `customerController`, `orderController`, `operatorController`, `addonController`, `expediterController`, `franchiseController` (SSR engine extracted to `seoTemplateController`), `conciergeController`, `contactController`, `corporateInquiryController`, `locationController`.

**Services** (`server/services/`): `bagClaimService`, `customerRegistrationService`, `orderBulkService`, `orderExportService`, `adminDashboardService`, `operatorAdminService`, `operatorShiftStatsService`, `operatorSupportService`, `serviceAreaService`, `addressValidationService`, `equipmentProfileService`, `gbpService`, `gbpToLocationData`, `googleReviewsService`, `networkReviewsService`, `franchiseRegistryService`, `franchisePreview{Email,Pages,Render}`, `conciergeFaq`, `contactNotificationService`, `corporateInquiryService`, `mailcowService`. Email dispatchers `affiliate.js`/`customer.js`/`operator.js`/`admin.js` (→ generic `account.js`).

**Middleware:** `scanAuth`, `expediterGuard`, `explorerGuard`, `franchisePreview`, `locationQuarantine`, `locationValidation`. (Admin+operator IP gates → merged generic `ipGate`.)

**Utils:** `qrCodeGenerator`, `roleCodes` (extract crypto primitives only if needed), `turnstile`, `previewUnlockCookie`. Domain `AuditEvents`.

**Config:** `domainSeoOverrides` (template only), `quarantineConfig`, `franchisePreviewCopy`, `locationData`.

**Pages/assets** (`public/`): all `*-embed.html` (affiliate/customer/operator/admin-dashboard/claim/scan/expediter), `franchise.html`, `about.html`, `become-a-franchisee.html`, `contact.html`, `testimonials.html`, `faq.html`, `virtual-tour.html`, `franchise-host.html`, all `austin-*` JS/CSS, `wavemax-*` CSS, `public/data/franchises*`, `public/content/site-pages.json`, `design-explorer/`, `crhsent/`, `clickjacking-demo.html`.

**Locale keys** (per language): `affiliateDashboard.*`, `claim.*`, `bag.*`, `operator.*`, `expediter.*`, `admin.invites.*` (→ generic), landing/marketing copy (`landing.*`), commission/WDF/delivery/service-name strings, entire `corporate.json`.

**Emails:** all `affiliate-*`, `customer-*`, `operator-*`, `order-ready`, `customer-on-the-way`, `customer-order-delivered` (+ their en/es/pt/de variants).

**Scripts:** `generate:sample-data`, `clear:customer-data`, `build:explorer`, sample-data generators.

**Env vars** (from `.env.example`): `PAYGISTIX_*`, `STRIPE_*`, `AWS_S3_*`, `GOOGLE_PLACES_*`, `FIREBASE_*` (optional-gate instead), `SERVICE_STATE/CITY/RADIUS_MILES`, `BAG_FEE`, `EXPLORER_TOKEN`, `EXPEDITER_TOKEN`, `QUARANTINE_NON_AUSTIN`, `CORPORATE_SITE_URL`, `DEFAULT_OPERATOR_ID`, `OPERATOR_PIN`.

---

## 6. Genericization checklist (parameterize, don't delete)

| Hardcode (real source) | Replacement |
|---|---|
| Domains `wavemaxlaundry.com`, `wavemax.promo`, `rundberglaundry.com`, `atxwashateria.com`, `atxwashdryfold.com`, `runberglaundry.com`, `crhsent.com` (in `server.js` CSP/CORS/HTTPS-redirect/robots/sitemap, `iframe-bridge-v2.js`, `domainSeoOverrides.js`, `accessGate.js`, `comingSoon.js`) | `platform/config/hosts.js` (`ALLOWED_HOSTS`, `CORS_ORIGIN`, `FRAME_ANCESTORS`, `GATED_HOSTS`, `COMING_SOON_HOSTS`, `DEFAULT_REDIRECT_HOST` from env) |
| `© 2025 CRHS Enterprises, LLC.` (192 files) | `{{COPYRIGHT}}` from `brand.config.js` |
| `WaveMAX`/`WaveMAX Laundry` (titles, logos, email From, copy) | `brand.config.js` `companyName` / `{{COMPANY_NAME}}` |
| Logo paths `logo-wavemax.png`, favicon set | `brand.config.js` `logoUrl`/`faviconBase`, asset dir `/assets/images/brand/` |
| Colors `#0c93ad`, `#0b1f43`, `#1e3a8a`, `wavemax-blue` | `theme.css` custom properties from `brand.config.js` palette |
| Contact `(512) 553-1674`, `825 E Rundberg Ln, Austin TX 78753`, `7AM–10PM`, geo `30.356,-97.685`, `US-TX` | `brand.config.js` contact + `site.config.json` per-host geo |
| Roles `affiliate/customer/administrator/operator`, permission enum, `roleHierarchy` | `platform/config/roles.js` registry |
| Session cookie `__Host-wavemax.sid`/`wavemax.sid` | `SESSION_COOKIE_NAME` env |
| i18n `storageKey: 'wavemax-language'`, `rundberglaundry.com` hostname check | `'app-language'` + config |
| Logger `defaultMeta: 'wavemax-affiliate'` | `SERVICE_NAME` env |
| JWT issuer/audience `wavemax-api`/`wavemax-client` | `JWT_ISSUER`/`JWT_AUDIENCE` env |
| `commonPasswords` includes `wavemax`,`laundry` | drop; configurable list |
| Email From `WaveMAX <admin@rundberglaundry.com>`, TLS servername `mail.crhsent.com`, monitoring dashboard URL | `EMAIL_FROM`, `EMAIL_TLS_SERVERNAME`, `OPS_DASHBOARD_URL` env |
| `init-defaults.js` admin `admin@wavemaxlaundry.com` / `WaveMAX!2024`, operator `Operator!2024`/`OP001`/`W1` | `INITIAL_ADMIN_EMAIL` + generated one-time password, **no operator seed** |
| Token-redaction params `?t=`,`?k=` | `REDACT_QUERY_PARAMS` env (default `t,k`) |
| IP allowlist env names `STORE_IP_ADDRESS`, `ADDITIONAL_STORE_IPS`, `STORE_IP_RANGES` | keep generic; documented |

---

## 7. CI/CD, secrets, "new customer in a day" runbook

**CI/CD:** GitHub Actions (`ci.yml`) on PR + main: `npm ci` → `lint` → `check-no-brand` → `check:i18n` → `test` (memory-server) → coverage thresholds. Deploy workflow (manual/tag): `build:assets` → bump `?v=` → push → `git pull --ff-only` on both boxes → `pm2 reload` only for server/template changes → smoke-test `/health` before LB re-adds origin (carry the WaveMAX deploy discipline into `docs/ops/DEPLOY.md`).

**Secrets:** never committed. `.env.example` documents every var with `openssl rand -hex 32` for the four secrets (`JWT_SECRET`, `ENCRYPTION_KEY`, `SESSION_SECRET`, `CSRF_SECRET`). HA rule documented: secrets must be **byte-identical** across instances (sessions/JWTs break on failover otherwise). Add `scripts/check-secrets-match.js` as an optional pre-deploy hook (the WaveMAX gap — secret sync is manual). `keys/ secure/ *.pem *.key` in `.gitignore` from commit 1; brand-guard also greps for accidental key material.

**New-customer-in-a-day runbook (`docs/NEW-CUSTOMER-RUNBOOK.md`):**
1. `git clone` baseline → new repo; pick LICENSE; `npm ci`.
2. Generate 4 secrets, fill `.env` (Mongo URI, hosts, BASE_URL).
3. Edit `brand.config.js` (name, copyright, logo, colors, contact, socials) + drop brand assets in `/assets/images/brand/`.
4. Edit `site.config.json` (domains, per-host SEO, pages, services) + `hosts.js`-backed env.
5. Define roles in `roles.js`; register login strategies.
6. Replace `app/` with your domain models/routes/controllers/pages; register routes in `routes.registry.js` + `route-registry.json`.
7. Fill `public/locales/*/common.json` domain keys (start from generic stubs; `npm run check:i18n`).
8. Customize 4 email templates × 4 langs.
9. `npm run ensure-indexes` → `npm run init:defaults` (creates admin, prints one-time password).
10. `npm test` (green) → `npm run build:assets` → deploy → Lighthouse-check landing.

---

## 8. Risks, dependencies, effort

**Sequencing dependencies (hard):**
- A → everything (boot/security/config underpin all).
- B depends on A (audit logger, encryption, SystemConfig, config/roles).
- C depends on A (rate-limit store, storeIPs) + B (auth for admin gate context).
- D depends on A (cspNonce, hosts) + B (session-manager roles) — but is otherwise parallelizable with E.
- E depends on A (template-manager, transport) + B (passwordResetService); independent of C/D.
- F depends on A–E (it tests them); CI requires F.
- G depends on A (boot/jobs/db) + D (SSR engine reuses cspHelper, sample landing).
- H depends on all (it's the integration proof).
- **Parallelizable:** D ∥ E after B; G's SEO/SSR ∥ E.

**Key risks & mitigations:**
1. **`errorHandler.js` returns JSON for HTML routes** (inventory risk) — split by `Accept` header; add a regression test. *Do this in Phase A.*
2. **Brand-string long tail (7,517 occurrences).** Greenfield + `check-no-brand.js` CI gate is the control; without the gate, leakage is near-certain. *Wire the guard in Phase A, enforce in F.*
3. **nginx config not in source repo** (lives on prod boxes) — must be authored fresh as `nginx.conf.template`. *Phase G; flag at kickoff so ops can supply the real vhost.*
4. **Role/login generalization is the deepest refactor** (3 login flows + 3 user models → strategy + base `User`). Biggest correctness risk; covered by `AuthFlow.integration.test.js`. *Budget extra in Phase B.*
5. **Custom `rateLimitMongoStore`** carries maintenance burden (built to dodge vulnerable `underscore@1.12.1`); document and re-evaluate vs upgraded `express-rate-limit`. *Phase C note.*
6. **Background-job leader gate is a static env flag** (no auto-failover). Ship as-is + document the distributed-lease (`findOneAndUpdate` on `expiresAt`, no TTL index for Oracle) as Phase 1.5. *Phase G.*
7. **CSP/analytics coordination** — enabling GA4 without CSP updates fails silently. *Document in GA4 setup; add a startup check.*
8. **License decision** (MIT vs proprietary) and **final repo name** are non-engineering blockers. *Resolve at kickoff.*

**Effort estimate (engineer-days, Opus-assisted):**

| Phase | Scope | Est. |
|---|---|---|
| A | bootstrap + security + config skeleton | 2–3 d |
| B | auth/RBAC/admin shell (role+login generalization) | 4–6 d |
| C | gates + rate limiting | 1.5–2 d |
| D | SPA + build + i18n (route registry, locale rebuild) | 4–5 d |
| E | email engine | 1.5–2 d |
| F | testing harness + CI + brand/i18n guards | 2–3 d |
| G | deploy/ops + SEO/quality (SSR extract, robots/sitemap, docs) | 3–4 d |
| H | theming/content layer + sample app + runbook | 2–3 d |
| **Total** | | **~20–28 engineer-days** |

Critical path: A → B → (D ∥ E) → F → G → H. B and D are the long poles; C and E are cheap. The platform-core copy set (encryption, cspNonce, rateLimitMongoStore, storeIPs, errorHandler, controllerHelpers, securityUtils, cspHelper, paginationMiddleware, Access* models, test harness) is verified to exist and lands fast; the cost is concentrated in the generalize/re-author work (server.js split, role/login strategy, locale rebuild, SSR extraction).

---

**Plan delivered above as the verbatim return value.** It is grounded in verified repo state: `server.js` = 1,294 lines; 119 unit + 47 integration tests; 192 copyright-stamped files; ~7,517 brand-string occurrences; `en/common.json` = 1,553 lines; and the exact platform-core utils/middleware/config/email/model files confirmed present. No report file was written per instructions.