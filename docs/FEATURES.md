# WaveMAX Affiliate Program — Features

Current feature inventory. Some features are scheduled for removal in the active refactor — see [`docs/refactor/REFACTORING_PLAN.md`](refactor/REFACTORING_PLAN.md) for the current target state.

## Core business flow

- **Affiliate registration & management** — onboarding, dashboard, commission tracking.
- **Customer registration** via affiliate-unique links.
- **Order management** — pickup scheduling, status tracking, delivery.
- **Individual bag tracking** — unique QR codes per bag, three-stage workflow (weighing → processing → pickup).
- **Commission system** — 10 % on WDF + 100 % of delivery fee.
- **WDF credit system** — actual-vs-estimated weight difference carried as credit/debit against the next order.
- **Flexible delivery pricing** — per-affiliate minimum plus per-bag fee.

## Identity, auth, roles

- **Four-role system** — administrator, operator, affiliate, customer.
- **JWT auth** with refresh tokens, blacklist on logout, short-lived access tokens.
- **OAuth 2.0** for affiliates and customers via Google, Facebook, LinkedIn.
- **Operator auto-login** — IP-based authentication for store terminals.
- **Two-step registration** — OAuth or credentials first, personal details second.
- **RBAC** with per-role field filtering and permission matrices.

## Payments

- **V2 post-weigh payment** — customer pays after bags are weighed; payment links via Venmo/PayPal/CashApp with QR codes.
- **Email-scan verification** — IMAP scanner detects Venmo/PayPal payments from confirmation emails and marks orders verified.
- **Smart reminders** — 24 h / 72 h / 7-day nudges for outstanding payments.
- **PCI-compliant storage** — no raw card data at rest; tokenization only.

> _V1 Paygistix upfront-payment flow is scheduled for deletion in the refactor's Phase 2._

## Service area & logistics

- **Location-based service areas** — configurable radius (default 50 mi around Austin, TX).
- **Address validation** — OpenStreetMap Nominatim geocoding with manual confirmation.
- **Immediate pickup** — same-day requests with 4-hour window, 7 AM-7 PM operating hours, after-hours auto-scheduled next day.
- **Affiliate schedule management** — availability windows configured per affiliate.

## Frontend & embedding

- **Iframe SPA** — single entry point (`embed-app-v2.html`) with client-side routing, CSP v2 compliant, nonce-based.
- **Parent-iframe bridge** — PostMessage API for height sync, language sync, origin validation.
- **Mobile-responsive** — automatic chrome hiding on mobile/tablet viewport.
- **Android kiosk mode** — full-screen operator scanning via Fully Kiosk Browser.
- **Tablet-optimized input** — wide modals for bag-weight entry on touch keyboards.

## Internationalization

- Four languages: English, Spanish, Portuguese, German.
- Automatic browser-language detection, per-user preference, translated emails.
- Server- and client-side translation systems.

## Compliance & tax

- **W-9 tax process** — affiliate payments are locked when IRS reporting threshold is reached; admin manually unlocks after collecting the W-9 out of band. _(Replaces the previous DocuSign-driven automation, being removed in Phase 2.)_
- **QuickBooks export** — vendor list, payment summaries, commission details.
- **Facebook data deletion** — GDPR-compliant OAuth data-deletion callback.

## Security

- **CSP v2** — strict policy, nonce-based, no inline scripts or styles.
- **CSRF protection** — conditional per endpoint tier (public / auth / registration / critical).
- **Rate limiting** — MongoDB-backed distributed limiter.
- **Field-level encryption** (AES-256-GCM) for payment handles (PayPal email, Venmo handle) and OAuth tokens.
- **Input sanitization** — NoSQL injection guard, XSS escape.
- **Audit logging** — security-relevant events (auth, password change, etc.).

## Notifications & communication

- **Email service** — Mailcow SMTP primary, console transport for dev.
- **Lifecycle emails** — registration, order confirmation, payment reminder, completion, etc.
- **Marketing outreach** — healthcare, caregiving, catering sector templates.

## Observability

- **Connectivity monitor** — health checks for MongoDB, SMTP, OAuth providers, payment dependencies.
- **Service health dashboard** — availability metrics at `/monitoring-dashboard.html`.

## Admin tooling

- **Beta program** — email-based request system with admin dashboard approval.
- **Customer / affiliate / order management UI** — full CRUD from admin dashboard.
- **System configuration** — `SystemConfig` collection for runtime-tunable values (rates, limits, thresholds).

---

_This list reflects current state at 2026-04-17. For target state, see `docs/refactor/DESIGN.md`._
