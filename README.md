# WaveMAX Laundry Affiliate Program

A Node.js / Express / MongoDB platform that powers a laundry pickup-delivery affiliate network: affiliates onboard customers, manage pickups and deliveries, track individual bags via QR codes, and earn commissions.

> **Status:** production system, active refactor in progress. See [`docs/refactor/`](docs/refactor/) for the design + phased plan.

## Quick start (development)

```sh
git clone https://github.com/rhoulihan/wavemax-affiliate-program
cd wavemax-affiliate-program
cp .env.example .env        # fill in secrets
npm install
docker compose up -d mongo  # or point MONGODB_URI at your own mongo
npm run setup:database
npm run init:defaults
npm run dev                 # nodemon on :3000
```

Tests:

```sh
npm test                    # full jest suite
npm run test:unit           # unit only
npm run test:integration    # integration only
npm run test:coverage       # with coverage report
```

## Production

- Deployment: PM2 cluster behind Nginx on a single host. See `ecosystem.config.js`.
- Database: MongoDB Atlas.
- Embed domain: `wavemax.promo` — iframe-embedded on the WaveMAX marketing site at `www.wavemaxlaundry.com`.

## What's inside

| | |
|---|---|
| `server/` | Express app — routes, controllers, middleware, models, services, jobs |
| `public/` | Iframe SPA — HTML pages, JS, CSS, i18n locales |
| `tests/` | Jest suite — unit, integration, helpers |
| `scripts/` | CLI utilities — admin tools, setup, security, ops, diagnostics. See [`scripts/README.md`](scripts/README.md) |
| `docs/` | All documentation. See [`docs/README.md`](docs/README.md) for the index |

---

## Implementation overview

The application is a multi-role iframe SPA at `wavemax.promo` backed by a REST API at `/api/v1` (with a `/api/v2` namespace for the post-weigh payment flow). It runs as a PM2 cluster behind Nginx, talks to MongoDB Atlas, and is embedded inside the WaveMAX marketing site over `postMessage`. The codebase is engineered around three deliberate constraints, each addressed below.

### Security features

Defense-in-depth, with each control implemented as a discrete module so it can be reasoned about and tested in isolation.

| Control | Module | What it does |
|---|---|---|
| Password storage | `server/utils/passwordUtils.js`, `server/utils/passwordValidator.js` | PBKDF2-SHA512, 100k iterations, 16-byte random salt, 64-byte hash; constant-time compare on verify; minimum-strength enforcement |
| JWT auth | `server/middleware/auth.js` | 1-hour access token + 30-day refresh token; refresh tokens tracked in `RefreshToken` model and rotated on use; `TokenBlacklist` for logout |
| OAuth | `server/config/passport-config.js` | Google / Facebook / LinkedIn; provider tokens encrypted at rest before being stored on the user record |
| RBAC | `server/middleware/rbac.js`, `server/middleware/authorizationHelpers.js` | Role-based gates on every protected route — `administrator`, `operator`, `affiliate`, `customer` |
| CSRF | `server/config/csrf-config.js` | Conditional CSRF — required on state-changing critical endpoints (W-9, payment, account deletion); skipped on read-only and rate-limited public endpoints (auth, registration) |
| Rate limiting | `server/middleware/rateLimiting.js` | MongoDB-backed for distributed enforcement: `authLimiter` (5/15min), `passwordResetLimiter` (3/hr), `registrationLimiter` (10/hr), `apiLimiter` (100/15min), `sensitiveOperationLimiter` (10/hr) |
| Input sanitization | `server/middleware/sanitization.js` | `mongoSanitize()` strips `$` / `.` against NoSQL injection; `sanitizeRequest` HTML-escapes for XSS; Joi + express-validator for schema validation |
| Encryption at rest | `server/utils/encryption.js` | AES-256-GCM with a fresh 16-byte IV per value; `{iv, encryptedData, authTag}` envelope; used for OAuth tokens, payment handles (PayPal email, Venmo handle), and W-9 documents |
| CSP | `server/middleware/cspNonce.js`, Helmet config | Strict CSP v2 — no inline scripts or styles; per-request nonce surfaced via `<meta name="csp-nonce">`; explicit allow-list for `frame-ancestors` (the WordPress parent only) |
| Audit logging | `server/utils/auditLogger.js` | Security-relevant events (auth, RBAC denials, W-9 verification, payment unlock) write to a separate `audit.log` stream for retention and SIEM ingestion |
| Validation | `server/utils/validators.js`, `server/middleware/locationValidation.js` | Server-side validation for all user input; geocoding-based service-area validation (Nominatim) prevents customers being routed outside their affiliate's radius |
| Secrets | `keys/`, `secure/`, `*.pem`, `*.key` | All gitignored; runtime secrets via `process.env`; business-config values via `SystemConfig` (Mongo) — never hardcoded |

The CSP is the most opinionated control: every page is rendered with a per-request nonce, so any third-party script that gets injected anywhere in the stack runs with no privilege unless it has the matching nonce. There are no inline `<script>` blocks anywhere in `public/` and ESLint blocks new ones.

### TDD process

The project enforces strict TDD as a hard rule, not a guideline. The full rule set lives in [`CLAUDE.md`](CLAUDE.md); the operative parts:

1. **Red → green → refactor for every non-trivial change.** Failing test first, confirmed to fail for the right reason, then the implementation.
2. **No production code lands without a regression test.** A bug fix is a test that would have caught the bug, plus the fix.
3. **Integration tests are preferred at controller/route seams.** Unit tests are reserved for pure logic — pricing, encryption envelopes, formatters, validators. The reason is that the interesting failure modes in this app are at the boundary between request handling, authorization, and the data layer; tests at the seam catch those, tests one level deeper from the seam don't.
4. **Fix everything before advancing.** When a refactor breaks a test, the fix happens before the next subtask. No "I'll come back to it." Surgical assertion updates where the change was intentional, skip-with-comment only if the test was coupled to removed functionality.
5. **`npm test` runs clean without `--forceExit`.** No leaked handles, no hanging connections.
6. **`SystemConfig.initializeDefaults()` runs in `tests/setup.js`.** Tests that depend on config (rates, fees, limits) fail loudly if it doesn't.

### Test code line ratio and coverage

The test suite is intentionally larger than the application code. Current state on `main`:

- **Test code:** ~61,500 lines across **142 test files** with **~3,640** `describe` / `test` / `it` blocks.
- **Server code:** ~29,800 lines.
- **Test-to-source ratio:** ~**2.07 : 1**.
- **Targets:** ≥80% line coverage, ≥75% branch coverage; per-file thresholds enforced via Jest config; coverage report regenerated on every `npm run test:coverage`.

The 2:1 ratio reflects the integration-test bias: many short specs around each controller seam exercise the full request → middleware → controller → service → model → DB path, with both the happy and failure paths covered. The investment is deliberate — the audit log shows that production incidents in this codebase have, without exception, been at the seams the integration suite covers, not in the pure-logic units.

Test layout:

```
tests/
├── unit/         # pure-logic specs (pricing, encryption, validators, formatters)
├── integration/  # API-level specs via supertest, MongoDB Memory Server
├── frontend/     # client-side specs (DOM, i18n, form behavior)
├── debug/        # diagnostic specs kept around for repro of past incidents
├── helpers/      # testUtils.js (factories), csrf.js (CSRF helper)
├── setup.js      # global setup; calls SystemConfig.initializeDefaults()
└── README.md     # suite layout, conventions, common patterns
```

---

## Search-optimized content pages

The application serves a small set of customer-facing **content** pages (separate from the dashboards / registration / order-management iframes) that exist primarily to rank in local search and answer Google's local-business-intent queries. These pages are embedded in the WaveMAX marketing site under location slugs like `/austin-tx/self-serve-laundry/` and `/austin-tx/wash-dry-fold/`, and they are instrumented end-to-end for SEO.

### Pages

| Page | Source | SEO config |
|---|---|---|
| Self-service laundry | `public/self-serve-laundry-embed.html` | `public/assets/js/seo-config-self-serve.js` |
| Wash-dry-fold | `public/wash-dry-fold-embed.html` | `public/assets/js/seo-config-wash-dry-fold.js` |
| Generic location page (template) | `public/site-page-embed.html` | parent-driven via `assets/js/site-page-loader.js` |

Styles live in matching `*-modern.css` files; client behavior in `*-modern.js`. All pages are i18n-aware (en / es / pt / de) via `data-i18n` attributes resolved by `assets/js/i18n.js`.

### What's instrumented

Each content page ships a structured SEO config object that the iframe pushes to the parent frame over `postMessage` via [`public/assets/js/parent-iframe-bridge-v2.js`](public/assets/js/parent-iframe-bridge-v2.js). The parent (the WaveMAX marketing site) injects the values into the actual `<head>` so search engine crawlers see them on the canonical URL, not on the iframe origin.

What gets injected, per page:

1. **Title and meta description.** Local-intent phrasing. Self-serve example: `"Self-Service Laundry Austin TX | WaveMAX Laundromat"`. Descriptions are ≤160 characters, lead with the city, and include the differentiators (UV sanitization, 450G machines, 24-hour turnaround, hours).
2. **Keyword targets.** Local + service combinations: `"self-service laundry Austin"`, `"laundromat near me Austin"`, `"wash dry fold Austin"`, `"laundry pickup delivery Austin"`, etc. Used as supplementary signal; primary ranking comes from the structured-data + content-density pairing.
3. **Canonical URL.** Points to the marketing-site URL (`https://www.wavemaxlaundry.com/austin-tx/self-serve-laundry/`), not the iframe origin. Prevents duplicate-content dilution between `wavemax.promo` and `wavemaxlaundry.com`.
4. **Open Graph tags.** `og:type=business.business`, `og:title`, `og:description`, `og:image` (1200×630 hero, validated dimensions), `og:url`, `og:site_name`, `og:locale`. Drives Facebook / LinkedIn / iMessage preview cards.
5. **Twitter Card tags.** `summary_large_image` card with `@wavemaxlaundry` as the site handle, dedicated `twitter:image` and `twitter:imageAlt`.
6. **`schema.org/LocalBusiness` JSON-LD.** This is the load-bearing piece for local search. Each page emits a fully-populated `LocalBusiness` block including:
   - `name`, multi-image `image` array, `description`, `url`, `telephone`, `priceRange`
   - `address` (`PostalAddress` with full street / city / state / zip)
   - `geo` (`GeoCoordinates` with lat / lng to four decimals)
   - `openingHoursSpecification` (per-day hours; the WDF and self-serve pages publish 7-days/week 7AM–10PM)
   - `paymentAccepted`, `currenciesAccepted`
   - `areaServed` (`City` entries — the WDF page extends this to neighboring cities like Round Rock and Pflugerville to capture pickup-delivery search intent)
   - `sameAs` links to social profiles (Facebook, Instagram)
   - `amenityFeature` array (`UV Sanitization`, `Free WiFi`, `Wheelchair Accessible`, `Touchless Payment`, `Free Parking` for self-serve; `24-Hour Turnaround`, `Professional Folding`, `Hospital-Grade UV` for WDF)
   - `hasMap` link to the Google Maps place
7. **Stable `@id` cross-linking.** All structured-data blocks share a single `@id` (`https://www.wavemaxlaundry.com/austin-tx/#localbusiness`) so Google treats the multiple service pages as views of the same business entity rather than as separate businesses.
8. **Hreflang via i18n.** The same content is served in en / es / pt / de from `public/locales/`; translations are loaded at runtime by `i18n.js` and the parent-frame bridge updates `<link rel="alternate" hreflang="...">` to match.

### Why this lives in the iframe app, not the marketing site

The marketing site (`wavemaxlaundry.com`) historically rendered location pages from a content management system, and pushing per-page schema and OG tags through that pipeline required the marketing-site vendor to be in the loop for every change. By moving the SEO-instrumented content into iframes served from `wavemax.promo` and pushing meta-tag updates over `postMessage`, page-level SEO becomes a code change in this repository — reviewable, testable, versioned, and deployable on the same cadence as the rest of the application.

The `parent-iframe-bridge-v2.js` contract is also what allows multiple cities to share a single content template: the iframe knows its slug from the parent URL, the loader chooses the right SEO config bundle, and the location-specific values (telephone, address, geo, hours) flow into the schema before the parent frame writes it into the DOM.

---

## Key integrations

- **OAuth** — Google, Facebook, LinkedIn (affiliate + customer login)
- **Mailcow SMTP** — transactional email; **IMAP** for post-weigh payment verification
- **OpenStreetMap Nominatim** — address geocoding and service-area validation
- **QuickBooks Online** — vendor + commission export
- **Venmo / PayPal / CashApp** — V2 post-weigh payments, detected via email scanning

_(Paygistix V1 upfront payment and DocuSign W-9 automation are being retired — see [`docs/refactor/REFACTORING_PLAN.md`](docs/refactor/REFACTORING_PLAN.md) §4.1 and §4.1.1.)_

## Roles

| Role | Purpose |
|---|---|
| **Administrator** | System management, operator + affiliate CRUD, system configuration, payment unlock |
| **Operator** | Facility staff; scans bags through the three-stage workflow |
| **Affiliate** | Independent service provider; onboards customers, earns commissions |
| **Customer** | End user; registers via affiliate link, schedules pickups |

## Documentation

- [`docs/README.md`](docs/README.md) — full documentation index
- [`docs/FEATURES.md`](docs/FEATURES.md) — current feature list
- [`docs/refactor/DESIGN.md`](docs/refactor/DESIGN.md) — current and target architecture
- [`docs/refactor/REFACTORING_PLAN.md`](docs/refactor/REFACTORING_PLAN.md) — phased execution plan
- [`docs/guides/`](docs/guides/) — embed, i18n, mobile integration guides
- [`docs/security/`](docs/security/) — security audits and remediation plans
- [`CLAUDE.md`](CLAUDE.md) — project instructions for AI pair-programming (strict TDD, security, code-org rules)

## Environment variables

See [`.env.example`](.env.example) for the full set. The critical ones:

- `MONGODB_URI` — MongoDB connection string
- `JWT_SECRET`, `SESSION_SECRET`, `CSRF_SECRET`, `ENCRYPTION_KEY` — generate with `openssl rand -hex 32`
- `EMAIL_PROVIDER` / `EMAIL_HOST` etc. — email transport
- OAuth provider credentials for Google, Facebook, LinkedIn

## License

MIT. See [`LICENSE`](LICENSE).

---

_Older, long-form README archived at [`docs/archive/README-2026-04-17-full.md`](docs/archive/README-2026-04-17-full.md) for reference during the refactor._
