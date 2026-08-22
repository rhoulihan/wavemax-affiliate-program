# Service / Corporate Split → De-brand → Domain Migration — Program Design

**Date:** 2026-08-22
**Status:** Design — awaiting review
**Author:** CRHS (Rick Houlihan) + Claude
**Type:** Program spec (decomposes into four phased sub-projects, each of which gets its own detailed spec + implementation plan).

> `dc_private` (the legal case-file repo) is **out of scope** for all of this. Everything here is within the affiliate codebase.

---

## 1. Goal & the four-phase program

Today one Express app (`server.js`, 1,336 lines), on one MongoDB, as one PM2 app (`wavemax`), serves **both** the WDF affiliate *service* and all *corporate/marketing* content (the `crhsent.com` site, the `/wavemax` mediator+sales pages, WaveMAX franchise-recruitment marketing, the 4 Austin per-location SEO domains, design-explorer). We are separating these into independently-developed, independently-deployed products, removing the "WaveMAX" literal from the service codebase, and migrating off the `wavemax.promo` domain.

Sequenced (locked):

| Phase | Name | Outcome |
|---|---|---|
| **1** | Extract `@crhs/web-core` | The shared security/infra core is lifted out of the inline `server.js` into a versioned package both apps consume. |
| **2** | Repo + deploy split | New `crhs-corporate` repo + a second production app; corporate content and gates move out of the service repo; nginx routes by host. |
| **3** | De-brand the service repo | "WaveMAX" removed from the (now service-only) `wdf-affiliate-program` behind `server/config/brand.js`. Covered by the companion spec `2026-08-22-debrand-brand-config-design.md`. |
| **4** | Domain migration | `wavemax.promo` → new primary domain (app leaning `atxwashdryfold.com/<path>`), keeping a 301 alias. Separate Phase-4 spec. |

**Copyright is not blocked** by any of this — the deposit PDF is already scrubbed; the code de-brand is repo hygiene.

---

## 2. Target architecture — three repos

1. **`crhs-web-core`** (package `@crhs/web-core`) — shared security + infrastructure core. Consumed by both apps as a versioned dependency (published from its own repo, or a workspace package). See §3.C.
2. **`wdf-affiliate-program`** (existing repo, becomes service-only) — the WDF affiliate SERVICE. Own service-only `server.js`; PM2 `wavemax`, port 3000; hosts = app/API/embed domains.
3. **`crhs-corporate`** (new repo) — corporate/marketing content + the corporate gates + franchise-host rendering. Own `server.js`; PM2 `crhs-corporate`, port 3001; hosts = `crhsent.com` + the Austin marketing/per-location domains.

Both apps depend on `@crhs/web-core`; both talk to the **shared** MongoDB.

---

## 3. Split inventory

### A. SERVICE repo (`wdf-affiliate-program`)

- **routes:** auth, affiliate, affiliateInvite, customer, order, administrator, operator, bag, scan, expediter, addon, systemConfig, monitoring, embed, firebaseConfig.
- **controllers:** auth, affiliate, customer, order, administrator, operator, addon, expediter.
- **modules (all):** `bags/`, `onboarding/`, `orders/` (scan-gate state machine), `scan/`.
- **models:** Affiliate, Customer, Operator, Administrator, Order, Transaction, AddOn, RefreshToken, TokenBlacklist, Bag, AffiliateInvite. (`SystemConfig` → web-core.)
- **services:** authToken, passwordReset, codeAttemptLockout, firebasePhone, bagClaim, customerRegistration, adminDashboard, administratorAccount, operatorAdmin/ShiftStats/Support, orderExport, systemConfig, systemHealth, `email/dispatcher/*` (operational senders).
- **middleware:** auth, authorizationHelpers, rbac, scanAuth, expediterGuard, adminIpGate, operatorIpGate. (Rate limiting, sanitization, cspNonce, errorHandler → web-core.)
- **config:** csrf-config, storeIPs.
- **templates:** `server/templates/emails/**` (operational, all langs). **monitoring:** `server/monitoring/`.
- **public pages:** the `*-embed.html` app surfaces (affiliate/administrator/operator/order-expediter/claim/forgot/reset), `embed-app-v2.html`, `embed-landing.html`, `email-verified.html`, `scanbag.html`, `monitoring-dashboard.html`.
- **public JS:** SPA core (`embed-app-v2.js`, `embed-config`, `embed-navigation`, `api-client`, `csrf-utils`, `session-manager`, UI helpers) + affiliate/administrator/operator/scan/expediter/bag/claim/auth scripts + vendored `qrcode`/`jsqr`/firebase-compat.
- **locales:** `{en,es,pt,de}/common.json`.

### B. CORPORATE repo (`crhs-corporate`)

- **`crhsent/` (whole tree):** corporate site (`index/about/work/capabilities/contact/owners/404`) + `crhsent/wavemax/*` (mediator+sales, clickjacking-demo, load-order-demo, security-audit) + assets/fonts/robots/sitemap.
- **marketing HTML in public/:** franchise, become-a-franchisee, about, testimonials, why-invest-in-wavemax, wavemax-vs-zombiemat, virtual-tour, faq, contact, laundromat-investment-guide, wavemax-affiliate, franchise-host + `franchise-default/*`, the franchise `-embed.html` fragments (austin-landing-v3, about-us, self-serve-laundry, wash-dry-fold, commercial, contact), partner-program, integration examples.
- **franchise host rendering:** `franchiseRoutes`, `franchiseController`, `franchisePreviewRender`, `franchisePreview` middleware, `franchiseRegistryService`, `equipmentProfileService`, `gbpService`, `gbpToLocationData`, `franchisePreviewPages/Email`, config `locationData`, `domainSeoOverrides`, `franchisePreviewCopy`, model `FranchisePreviewRequest`, `scripts/franchise-build/*`.
- **corporate gates + models:** `accessGate` (+ `AccessGate/AccessRequest/AccessWhitelist/AccessClick`), `mediatorGate` (+ `MediatorAccess`), `explorerGuard`, `partnerLanding`.
- **corporate intake/AI:** `corporateInquiryRoutes/Controller/Service`, `affiliateApplicationRoutes/Controller/Service` + `affiliate-inquiry.js` + `public/affiliate.html` (the UT-student recruitment lead form), partner/contact routes+controllers, `conciergeController` (+ `conciergeFaq`), review services (google/network).
- **design-explorer/ (whole tree)** + generated `public/design-explorer/*`.
- **corporate JS:** `corporate-*`, `site-page-loader`, `austin-*`, `franchise-*`, self-serve/wash-dry-fold marketing scripts, `lead-capture-form`, `partner-inquiry`, `network-reviews-init`, `faq-accordion`, `wm-image-config`.
- **data/content:** `public/data/franchises*`, `public/content/site-pages.json`, marketing SEO assets (`flyers/`, brand logos, location imagery).
- **locales:** `{en,es,pt,de}/corporate.json`.
- **the per-host `robots.txt`/`sitemap.xml` generation** for the marketing domains (moves with the corporate app).

### C. `@crhs/web-core` (shared package)

Lifted (and, where inline, **modularized**) from `server.js`/`server/`:
- CSP: the directive builder (currently inline ~L287-466 of `server.js`), `cspNonce` middleware, `cspHelper` (`injectNonce`/`readHTMLWithNonce`/`serveHTMLWithNonce`).
- Security headers: the Helmet + custom-header block (HSTS, Permissions-Policy, COOP, CORP overrides), CORS config.
- Request hygiene: `sanitization`, `errorHandler`, `rateLimiting` + `rateLimitMongoStore`, `ipGate` factory, `clientIp`, `storeIPs`, `validateSecrets`, `previewUnlockCookie`.
- Data/email/infra: `SystemConfig` model + `initializeDefaults`, `mongoCursorRetry`, `mongoOracleDiagnostics`, email framework (`emailService` shim → `email/transport` + `email/template-manager`), `logger`, `auditLogger`, `encryption`, `controllerHelpers`, session/`connect-mongo` + CSRF config, `geocodingService`.
- Client shared assets: `i18n.js` + `language-switcher.js`, embed bridge (`iframe-bridge-v2`, `parent-iframe-bridge-v3`, `css-async`), shared fonts/vendor.
- Shared legal pages (`terms-and-conditions`, `privacy-policy`, `refund-policy`) shipped from web-core as a single source, served by both apps.

### D. Gray-zone assignments (recommendations — confirm on review)

| Item | Recommendation |
|---|---|
| `affiliateApplication*` + `affiliate-inquiry.js` + `public/affiliate.html` (UT recruitment lead form) | **Corporate** (Rick, 2026-08-22) — grouped with marketing/recruitment intake. |
| Legal pages (terms/privacy/refund) | **web-core** shared static, served by both. |
| `geocodingService` | **web-core** (service onboarding + corporate location both use it). |
| `docsRoutes` (`/docs`, non-prod only) | **Service** (dev tooling). |
| `locationQuarantine` + `quarantineConfig` | Largely **retired** once nginx `server_name` routes hosts; any residual → web-core. |
| Integration example HTML (`wavemaxlaundry-embed-code*`, `iframe-parent-example*`) | **Corporate** (franchisor-facing docs). |

---

## 4. Deployment topology

**Today:** Cloudflare → nginx → one PM2 app (`wavemax`, cluster/max) on :3000, per box (oci1/oci2), active-active; host selection is **in application code** (`req.hostname` chain: `accessGate → partnerLanding → mediatorGate → crhsent handler → franchisePreview → locationQuarantine → franchiseController`). One MongoDB (`MONGODB_URI`, db `wavemax`). Deploy = per-box `git pull` + `pm2 reload`. `npm run build:assets` regenerates committed `.min` bundles spanning both surfaces.

**Target:**
- **Two PM2 apps** per box: `wavemax` (service) :3000, `crhs-corporate` :3001. Service keeps `instances: max`; corporate is mostly static → fewer instances.
- **nginx `server_name` blocks** own host routing (moved out of app code): `crhsent.com` + Austin marketing/per-location domains + WaveMAX marketing hosts → :3001; app/API/embed hosts (`affiliate.*`, the app domain) → :3000.
- **Shared MongoDB** (one URI). Each app's `ensure-indexes` provisions **only its own** models; `SystemConfig.initializeDefaults()` is owned by one app (service) and read by both; corporate owns `Access*`/`MediatorAccess`/`FranchisePreviewRequest` indexes.
- **Shared secrets** (`SESSION_SECRET`/`JWT_SECRET` HMAC, `ENCRYPTION_KEY`, `MONGODB_URI`, email creds, `STORE_IP_ADDRESS`/`ADMIN_ALLOWLIST`, `CORPORATE_SITE_URL`) must match across both `.env` files; corporate adds `ACCESS_GATE_*`/`MEDIATOR_GATE_*`/`FRANCHISE_PREVIEW_ENABLED`/`PARTNER_PREVIEW_ALLOWLIST`/`GOOGLE_PLACES_*`/Turnstile; service adds Firebase/rate-limit/admin/operator.
- **Two checkouts** (`/var/www/wavemax/...`, `/var/www/crhs-corporate/...`), independent `git pull`s. `build:assets` list partitioned per repo; `/assets` + `/locales` cross-origin CORS behavior preserved on whichever origin owns each (embedded absolute `rundberglaundry.com/assets/...` URLs must be re-pointed or both apps serve an identical `/assets` tree — resolved in Phase 4).

---

## 5. Phases — scope, sequencing, acceptance

### Phase 1 — Extract `@crhs/web-core`
Modularize the inline `server.js` security core (§3.C) into `crhs-web-core`. **Done in-place first** as internal modules within the current repo (so the monorepo keeps working and tests stay green), then published as the package. Also resolves `server.js` > 800-line rule violation.
**Acceptance:** `server.js` composes from `@crhs/web-core` modules; full suite green; no behavior change (CSP headers, gates, email, nonce injection byte-identical in an integration test); `madge --circular` clean.

### Phase 2 — Repo + deploy split
Create `crhs-corporate`; move §3.B; both apps depend on `@crhs/web-core`; two `server.js`; stand up PM2 :3001 + nginx `server_name`; split `ensure-indexes`; partition `build:assets`. wavemax.promo/hosts unchanged (still land where they do today, now via nginx).
**Acceptance:** each app boots standalone and serves its hosts; corporate gates (accessGate/mediatorGate/franchisePreview) work from the corporate app; service app has zero corporate routes; both deploy independently; shared MongoDB reads/writes correct; no cross-repo `require`.

### Phase 3 — De-brand the service repo
Per `2026-08-22-debrand-brand-config-design.md`, now applied to the smaller service repo (most bucket-4 "about-WaveMAX" content has moved to corporate). `server/config/brand.js` (env-sourced, generic default), display→config, non-display→"Laundromat", guard test.
**Acceptance:** `git grep -i wavemax` in the service repo (minus deferred infra) = 0; page shows "Laundromat" default / "WaveMAX Austin" with env; 4-lang parity; build+tests green.

### Phase 4 — Domain migration
`wavemax.promo` → new primary domain; update refs + routing; 301 alias retained; re-point cross-origin `/assets` URLs; email/DB/Firebase disposition. Separate Phase-4 spec.

---

## 6. Decisions locked (2026-08-22)

- Shared core = **extract `@crhs/web-core` package** (not duplicate, not submodule).
- Database = **shared MongoDB**.
- Sequence = **modularize → split → de-brand → migrate**.
- Service repo stays `wdf-affiliate-program`; corporate repo proposed **`crhs-corporate`** (name to confirm); core repo **`crhs-web-core`**.
- Brand value (Phase 3) = env-only, production `BRAND_DISPLAY_NAME="WaveMAX Austin"`, committed default generic "Laundromat".
- App host (Phase 4) leaning `atxwashdryfold.com/<path>`; crhsent.com stays corporate.

---

## 7. Risks & mitigations

1. **Inline security core is the hardest lift** (risk #1). Mitigation: Phase 1 does it in-place with a byte-identical-headers integration test before any split.
2. **Host routing moves from app code to nginx** — a host can fall through to the wrong app. Mitigation: explicit `server_name` map + a per-host smoke test in Phase 2.
3. **Shared-DB init races / index ownership.** Mitigation: one owner for `SystemConfig.initializeDefaults`; per-app `ensure-indexes` scoped to owned models.
4. **Shared secrets drift** invalidates cookies/tokens on one side. Mitigation: single secret source synced to both `.env`; document the coupling.
5. **Cross-origin `/assets` + i18n** absolute URLs. Mitigation: keep an identical `/assets` origin during Phase 2; re-point in Phase 4.
6. **`@crhs/web-core` versioning drift** between apps. Mitigation: pin exact version; CI check both apps build against the same core version.

---

## 8. Open items (confirm on review)

- Corporate repo name (`crhs-corporate`?), core repo/package name.
- `@crhs/web-core` distribution: own git repo + npm-style install, or a monorepo workspace? (Leaning: own repo, install via git URL / private registry.)
- Gray-zone final calls (§3.D), esp. the `affiliateApplication` recruitment form.
- Where `@crhs/web-core` is published (private registry vs git dependency).
- Phase-4 specifics (domain, email addresses, DB/Firebase renames) — deferred to the Phase-4 spec.

---

## 9. Next step

On approval → invoke `superpowers:writing-plans` for the **Phase 1** implementation plan (extract `@crhs/web-core`), the first executable sub-project. Phases 2–4 get their own specs/plans as we reach them.
