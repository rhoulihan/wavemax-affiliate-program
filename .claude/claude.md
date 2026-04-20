# WaveMAX Affiliate Program — Architecture Handbook

> Reference documentation for the codebase. Operational rules live in root `CLAUDE.md`; session startup in `init.prompt`. This file is the architecture source of truth — models, API surface, business logic, security model, integrations.

> **Note:** project is mid-refactor (see `docs/refactor/REFACTORING_PLAN.md`). V1 payment code (Paygistix, `Payment` model, `CallbackPool`, `PaymentToken`, v1 registration) is being **deleted** in Phase 2, not migrated. Sections below marked *V1 (legacy, being removed)* describe dead code being cleaned up.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Technology Stack](#technology-stack)
3. [Architecture Overview](#architecture-overview)
4. [Database Schema](#database-schema)
5. [API Structure](#api-structure)
6. [Security Implementation](#security-implementation)
7. [Frontend Architecture](#frontend-architecture)
8. [Business Logic](#business-logic)
9. [Integration Points](#integration-points)
10. [Coding Standards](#coding-standards)
11. [Testing](#testing)
12. [Deployment & Operations](#deployment--operations)
13. [Quick Reference](#quick-reference)

---

## Project Overview

Node.js/Express application managing a laundry service affiliate network. Affiliates (independent service providers) register customers, manage pickup/delivery logistics, track orders through a three-stage bag scanning workflow, and earn commissions.

### Key Features

- **Multi-role**: Administrators, Affiliates, Customers, Operators
- **OAuth**: Google, Facebook, LinkedIn social auth
- **Payment** (post-refactor): Post-weigh payment via Venmo/PayPal/CashApp (V2 flow; V1 Paygistix being removed in Phase 2)
- **Geospatial service areas**: Location-based affiliate matching
- **QR code bag tracking**: Three-stage workflow (weighing → processing → pickup)
- **Commission system**: 10% WDF + 100% delivery fee
- **W-9 tax compliance**: DocuSign integration
- **i18n**: English, Spanish, Portuguese, German
- **CSP v2 compliant**: Strict Content Security Policy for iframe embedding

### Project Structure

```
wavemax-affiliate-program/
├── server/                    # Node.js/Express backend
│   ├── config/               # CSRF, Passport OAuth, Paygistix (legacy)
│   ├── controllers/          # API endpoint controllers
│   ├── middleware/           # auth, RBAC, security, rate limiting
│   ├── models/               # Mongoose data models
│   ├── routes/               # Express route definitions
│   ├── services/             # Business logic (email, payments, docusign)
│   ├── utils/                # Encryption, logging, helpers
│   ├── jobs/                 # Background jobs
│   └── templates/            # Email templates (multi-language)
├── public/                    # Frontend static files
│   ├── assets/js/            # Client-side JavaScript
│   ├── assets/css/           # CSP-compliant stylesheets
│   ├── locales/              # i18n translations (en, es, pt, de)
│   └── *.html                # Embedded HTML pages
├── tests/                     # Unit + integration tests
├── docs/                      # Documentation (refactor plan, guides, pitfalls)
├── scripts/                   # Migration/setup scripts
└── server.js                  # Entry point
```

File counts change with the active refactor; trust `ls` / `git ls-files` over documentation.

---

## Technology Stack

**Backend:** Node.js 20+ · Express 4.x · MongoDB 7.0+ (Mongoose) · JWT + Passport.js · Winston logging · PM2 cluster mode

**Security:** Helmet.js · csurf (CSRF) · express-rate-limit (MongoDB-backed) · AES-256-GCM encryption · express-mongo-sanitize · XSS escaping

**Frontend:** Vanilla JS (ES6+) · Bootstrap 5.3.0 · Font Awesome 6.4.0 · Single-page iframe application · Strict CSP v2 (nonce-based, no unsafe-inline)

**Testing:** Jest 29.7.0 · Supertest · MongoDB Memory Server

**External:** Paygistix *(V1, legacy)* · OAuth (Google/Facebook/LinkedIn) · DocuSign · Mailcow SMTP / Brevo · OpenStreetMap Nominatim

---

## Architecture Overview

Request path: **WordPress parent site** (www.wavemaxlaundry.com) → embeds **iframe** → **Nginx** reverse proxy (→ `localhost:3000`) → **Node.js/Express** (PM2 cluster) → **MongoDB Atlas**.

Within Express: Routes → Middleware (auth/CSRF/rate limit/sanitize) → Controllers → Services → Models. Utilities (encryption, logging, helpers) cross-cut.

### Request Flow

1. Browser loads `/embed-app-v2.html?route=/page-name` in iframe
2. SPA router fetches page HTML, injects page-specific scripts
3. Client hits `/api/v1/...` with JWT in Authorization header
4. Controller → Service → Mongoose model → MongoDB
5. JSON response updates UI; PostMessage sends height to parent frame

### Embedded Iframe System

Single-page architecture within an iframe on the WordPress parent site.

- **Entry:** `public/embed-app-v2.html`
- **Router:** `public/assets/js/embed-app-v2.js` (URL param `?route=/page-name`)
- **Session state:** `public/assets/js/session-manager.js`
- **Iframe → parent:** PostMessage API (height updates)

---

## Database Schema

Mongoose models live in `server/models/`. Encrypted fields use AES-256-GCM via `server/utils/encryption.js`. IDs follow the `{PREFIX}-{uuid}` pattern (`AFF-…`, `CUST-…`, `ORD-…`).

### Affiliate Model
**File**: `server/models/Affiliate.js`

```javascript
{
  affiliateId: String,              // "AFF-uuid" (unique, indexed)
  firstName, lastName, email, phone, username,
  passwordSalt, passwordHash,       // PBKDF2 with 100k iterations

  // Business information
  businessName, address, city, state, zipCode,

  // Geospatial service area
  serviceLocation: {
    type: 'Point',
    coordinates: [longitude, latitude]  // 2dsphere indexed
  },
  serviceRadius: Number,            // 1-50 miles

  // Custom delivery fees
  minimumDeliveryFee: Number,       // Default: 25
  perBagDeliveryFee: Number,        // Default: 5

  // Payment information (encrypted)
  paymentMethod: Enum['check', 'paypal', 'venmo'],
  paypalEmail: Mixed,               // AES-256-GCM encrypted
  venmoHandle: Mixed,               // AES-256-GCM encrypted

  // OAuth social accounts
  socialAccounts: {
    google: { id, email, name, accessToken, refreshToken, linkedAt },
    facebook: { id, email, name, accessToken, linkedAt },
    linkedin: { id, email, name, accessToken, refreshToken, linkedAt }
  },
  registrationMethod: Enum,         // 'traditional', 'google', 'facebook', 'linkedin'

  // W-9 tax compliance
  w9Information: {
    status: Enum,                   // 'not_submitted', 'pending_review', 'verified', 'rejected'
    submittedAt, verifiedAt, verifiedBy, rejectedAt, rejectionReason,
    docusignEnvelopeId, docusignStatus,
    quickbooksVendorId
  },

  languagePreference: Enum,         // 'en', 'es', 'pt', 'de'
  isActive: Boolean
}
```

**Key methods / hooks:**
- `canReceivePayments()` — true when W-9 verified + active
- Pre-save: hash password, encrypt payment data

### Customer Model
**File**: `server/models/Customer.js`

```javascript
{
  customerId: String,               // "CUST-uuid" (unique, indexed)
  affiliateId: String,              // References Affiliate
  firstName, lastName, email, phone, username,
  passwordSalt, passwordHash,
  address, city, state, zipCode,

  // Service preferences
  serviceFrequency: Enum,           // 'weekly', 'biweekly', 'monthly'
  deliveryInstructions, specialInstructions,

  // OAuth support (same structure as Affiliate)
  socialAccounts: { google, facebook, linkedin },
  registrationMethod: Enum,

  // Bag system
  numberOfBags: Number,
  bagCredit: Number,                // Credit from initial purchase (V1 only)
  bagCreditApplied: Boolean,

  // WDF Credit tracking
  wdfCredit: Number,                // Positive = credit, Negative = debit
  wdfCreditUpdatedAt: Date,
  wdfCreditFromOrderId: String,

  // Payment system version (V1 field being removed in Phase 2)
  registrationVersion: Enum,        // 'v1' (upfront) or 'v2' (post-weigh)
  initialBagsRequested: Number,     // 1 or 2

  languagePreference: Enum,
  isActive: Boolean
}
```

### Order Model
**File**: `server/models/Order.js`

```javascript
{
  orderId: String,                  // "ORD-uuid" (unique, indexed)
  customerId: String,
  affiliateId: String,

  // Pickup scheduling
  pickupDate: Date,
  pickupTime: Enum,                 // 'morning', 'afternoon', 'evening'
  specialPickupInstructions: String,
  estimatedWeight: Number,

  // Order lifecycle
  status: Enum,                     // 'pending', 'processing', 'processed', 'complete', 'cancelled'
  createdAt, processingStartedAt, processedAt, completedAt, cancelledAt,

  // Bag tracking system (QR codes)
  numberOfBags: Number,
  bags: [{
    bagId: String,                  // Unique bag identifier (indexed)
    bagNumber: Number,
    status: Enum,                   // 'processing', 'processed', 'completed'
    weight: Number,                 // Actual weight in pounds
    scannedAt: { processing: Date, processed: Date, completed: Date },
    scannedBy: { processing: ObjectId, processed: ObjectId, completed: ObjectId }
  }],

  // Pricing breakdown
  baseRate: Number,                 // WDF rate from SystemConfig
  feeBreakdown: { numberOfBags, minimumFee, perBagFee, totalFee, minimumApplied },
  estimatedTotal, actualTotal,
  bagCreditApplied: Number,
  wdfCreditApplied: Number,
  wdfCreditGenerated: Number,
  weightDifference: Number,
  affiliateCommission: Number,

  // V1 Payment (Paygistix — being removed in Phase 2)
  paymentStatus: Enum,              // 'pending', 'processing', 'completed', 'failed'
  paymentMethod: Enum,
  isPaid: Boolean,

  // V2 Payment (Post-weigh — will be renamed to paymentStatus/paymentMethod post-Phase 2)
  v2PaymentStatus: Enum,            // 'pending', 'awaiting', 'confirming', 'verified', 'failed'
  v2PaymentMethod: Enum,            // 'venmo', 'paypal', 'cashapp', 'credit_card'
  v2PaymentAmount: Number,
  v2PaymentLinks: { venmo, paypal, cashapp },
  v2PaymentQRCodes: { venmo, paypal, cashapp },  // Base64 encoded
  v2PaymentReminders: [{ sentAt, reminderNumber, sentBy, method }],

  // Add-ons
  addOns: { premiumDetergent, fabricSoftener, stainRemover },
  addOnTotal: Number,

  // Operator workflow
  assignedOperator: ObjectId,
  operatorNotes, qualityCheckPassed, qualityCheckNotes
}
```

**Pre-save middleware:**
- Fetches current WDF rate from SystemConfig
- Recalculates pricing from weights + add-ons
- Flips `isPaid` when `v2PaymentStatus === 'verified'`

### SystemConfig Model
**File**: `server/models/SystemConfig.js` — runtime business config, avoids redeploys for rate changes.

```javascript
{
  key: String,                      // Unique (indexed)
  value: Mixed,
  description, category, dataType,
  defaultValue,
  isEditable: Boolean,
  isPublic: Boolean,                // Accessible without auth
  validation: { min, max, regex, allowedValues },
  updatedBy: ObjectId               // → Administrator
}
```

**Key configurations (public):**
- `wdf_base_rate_per_pound` (default 1.25, range 0.50–10.00)
- `laundry_bag_fee` (10.00)
- `delivery_minimum_fee` (10.00)
- `delivery_per_bag_fee` (2.00)
- `payment_version` ('v1' | 'v2')
- `max_operators_per_shift` (10)
- `order_processing_timeout_minutes` (120)

**Usage:** always go through `SystemConfig.getValue(key, default)`; never hardcode rates, fees, or limits. Admin mutations use `SystemConfig.setValue(key, value, adminId)`.

### Other Models

- **Administrator** — system managers, role-based permissions
- **Operator** — facility staff, PIN-based auth
- **RefreshToken** — JWT refresh token tracking
- **TokenBlacklist** — logout blacklist
- **OAuthSession** — temporary OAuth session storage
- **DataDeletionRequest** — GDPR compliance
- *V1 (legacy, being removed):* **Payment**, **CallbackPool**, **PaymentToken**

---

## API Structure

### Versioning

- `/api/v1/` — current stable
- `/api/v2/` — new customer registration (post-weigh payment flow)
- `/api/` — redirects to v1

### Authentication (`server/routes/authRoutes.js`)

```
POST   /api/v1/auth/affiliate/login
POST   /api/v1/auth/customer/login
POST   /api/v1/auth/administrator/login
POST   /api/v1/auth/operator/login
POST   /api/v1/auth/forgot-password
POST   /api/v1/auth/reset-password
POST   /api/v1/auth/refresh-token
GET    /api/v1/auth/verify
POST   /api/v1/auth/logout
```

### Social Auth (`server/routes/socialAuthRoutes.js`)

```
GET    /api/v1/auth/{google|facebook|linkedin}
GET    /api/v1/auth/{google|facebook|linkedin}/callback
POST   /api/v1/auth/social/register
POST   /api/v1/auth/customer/social/register
POST   /api/v1/auth/social/link
```

### Affiliate (`server/routes/affiliateRoutes.js`)

```
POST   /api/v1/affiliates/register
GET    /api/v1/affiliates/:affiliateId
PUT    /api/v1/affiliates/:affiliateId
GET    /api/v1/affiliates/:affiliateId/public
GET    /api/v1/affiliates/:affiliateId/dashboard
GET    /api/v1/affiliates/:affiliateId/customers
GET    /api/v1/affiliates/:affiliateId/orders
POST   /api/v1/affiliates/:affiliateId/change-password
DELETE /api/v1/affiliates/:affiliateId/delete-all-data
```

### Customer (`server/routes/customerRoutes.js`)

```
POST   /api/v1/customers/register         # V1 — legacy, being removed
POST   /api/v2/customers/register         # V2 — post-weigh payment
GET    /api/v1/customers/:customerId
PUT    /api/v1/customers/:customerId
GET    /api/v1/customers/:customerId/orders
POST   /api/v1/customers/:customerId/change-password
DELETE /api/v1/customers/:customerId/delete-all-data
```

### Order (`server/routes/orderRoutes.js`)

```
POST   /api/v1/orders
GET    /api/v1/orders/:orderId
PUT    /api/v1/orders/:orderId
POST   /api/v1/orders/:orderId/cancel
PUT    /api/v1/orders/:orderId/status
GET    /api/v1/orders
```

### Operator (`server/routes/operatorRoutes.js`)

```
POST   /api/v1/operators/login
POST   /api/v1/operators/scan-bag          # QR code scanning
GET    /api/v1/operators/dashboard
GET    /api/v1/operators/orders
POST   /api/v1/operators/orders/:orderId/status
```

### Administrator (`server/routes/administratorRoutes.js`)

```
POST   /api/v1/administrators/operators
GET    /api/v1/administrators/operators
PUT    /api/v1/administrators/operators/:operatorId
DELETE /api/v1/administrators/operators/:operatorId
GET    /api/v1/administrators/dashboard
GET    /api/v1/administrators/config       # SystemConfig management
PUT    /api/v1/administrators/config
```

### W-9 (`server/routes/w9Routes.js`)

```
POST   /api/v1/w9/initiate-signing         # DocuSign
POST   /api/v1/w9/webhook/docusign
POST   /api/v1/w9/upload
GET    /api/v1/w9/status
GET    /api/v1/w9/download
GET    /api/v1/w9/admin/pending
POST   /api/v1/w9/admin/:affiliateId/verify
POST   /api/v1/w9/admin/:affiliateId/reject
```

### Response Format

Success: `{ success: true, message, data, pagination? }`
Error:   `{ success: false, message, error?: { details, type } }` — `error` field only in development.

---

## Security Implementation

### Authentication

**Passwords** — PBKDF2-SHA512, 100,000 iterations, 16-byte random salt, 64-byte hash. Implementation: `server/utils/passwordUtils.js` (`hashPassword`, `verifyPassword`). Constant-time comparison.

**JWT** — two tokens:
- **Access** (1h): `{ id, role, affiliateId?, iat, exp }` — `role` is one of `affiliate | customer | administrator | operator`
- **Refresh** (30d): `{ id, tokenId, iat, exp }` — tracked in `RefreshToken` model; rotated on use; blacklisted on logout (`TokenBlacklist`)
- Signed with `JWT_SECRET`; stored in httpOnly cookies in production

**OAuth** — Google, Facebook, LinkedIn. Flow: provider redirect → callback code → exchange for access token → fetch profile → match by social ID or email → link/create → encrypt and store tokens in `user.socialAccounts.{provider}` → issue JWT. Config: `server/config/passport-config.js`. Google + LinkedIn refresh tokens rotate.

### CSRF Protection

`server/config/csrf-config.js` — conditional enforcement:

| Endpoint class | CSRF |
|:---|:---|
| Public (health, OAuth, webhooks) | No |
| Auth | No (rate-limited instead) |
| Registration | No (CAPTCHA instead) |
| Critical (W-9, payments, deletions) | **Yes, always** |
| Read-only (GET) | No |

Client: `GET /api/csrf-token` then send header `x-csrf-token` on mutations.

### Rate Limiting

`server/middleware/rateLimiting.js` — MongoDB-backed for distributed enforcement:

| Limiter | Strict | Relaxed |
|:---|:---:|:---:|
| `authLimiter` | 5/15min | 50/15min |
| `passwordResetLimiter` | 3/hour | 10/hour |
| `registrationLimiter` | 10/hour | 50/hour |
| `apiLimiter` | 100/15min | 500/15min |
| `sensitiveOperationLimiter` | 10/hour | — |

Test bypass: `RELAX_RATE_LIMITING=true` multiplies limits 10×; `NODE_ENV=test` disables entirely.

### Input Validation & Sanitization

`server/middleware/sanitization.js` — `mongoSanitize()` strips `$` / `.` to prevent NoSQL injection; `sanitizeRequest` escapes HTML for XSS. Validation via Express Validator (simple fields) and Joi (complex schemas).

### Data Encryption

`server/utils/encryption.js` — AES-256-GCM with random 16-byte IV per value; `{ iv, encryptedData, authTag }` stored as the field value. Encrypted fields:

- `Affiliate.paypalEmail`, `Affiliate.venmoHandle`
- OAuth access tokens in `user.socialAccounts.{provider}.accessToken`
- W-9 documents

Key source: `ENCRYPTION_KEY` env var (64-char hex).

### Security Headers

Helmet.js in `server.js`:
- **CSP:** `default-src 'self'`; `script-src 'self' https://cdn.jsdelivr.net 'nonce-{nonce}'`; `style-src` same; `frame-src 'self' https://safepay.paymentlogistics.net` *(Paygistix, legacy)*; `frame-ancestors 'self' https://www.wavemaxlaundry.com`
- **HSTS:** 1 year, `includeSubDomains`, `preload`
- **Referrer-Policy:** `strict-origin-when-cross-origin`

Per-request nonce is generated in middleware and made available as `res.locals.cspNonce`; client reads it from `<meta name="csp-nonce">`.

---

## Frontend Architecture

### Embedded SPA

```
WordPress Page
  └── <iframe src="https://wavemax.promo/embed-app-v2.html?route=/affiliate-dashboard">
        └── embed-app-v2.html (SPA router)
              ├── Dynamic page loading (fetch HTML)
              ├── Script injection (sequential)
              └── PostMessage (height updates)
```

**Key files:**
- `public/embed-app-v2.html` — entry
- `public/assets/js/embed-app-v2.js` — router
- `public/assets/js/session-manager.js` — multi-role auth state

### Route Mapping

`EMBED_PAGES` in `embed-app-v2.js`:

```javascript
const EMBED_PAGES = {
  '/': '/embed-landing.html',
  '/landing': '/embed-landing.html',
  '/affiliate-register': '/affiliate-register-embed.html',
  '/affiliate-login': '/affiliate-login-embed.html',
  '/affiliate-dashboard': '/affiliate-dashboard-embed.html',
  '/customer-register': '/customer-register-embed.html',
  '/customer-login': '/customer-login-embed.html',
  '/customer-dashboard': '/customer-dashboard-embed.html',
  '/administrator-login': '/administrator-login-embed.html',
  '/administrator-dashboard': '/administrator-dashboard-embed.html',
  '/operator-scan': '/operator-scan-embed.html',
  '/schedule-pickup': '/schedule-pickup-embed.html',
  '/terms-of-service': '/terms-and-conditions-embed.html',
  '/privacy-policy': '/privacy-policy.html',
  '/refund-policy': '/refund-policy.html'
};
```

### Page-Specific Scripts

Scripts must be registered in the `pageScripts` map in `embed-app-v2.js` **and** referenced from the page HTML. If you skip one, the page works via one access path but breaks via the other (see `docs/development/PITFALLS.md` #3).

### CSP Compliance

Strict CSP v2 — **no inline scripts or styles**. Per-request nonce, external handlers only. For dynamic script injection, set `script.nonce = window.CSP_NONCE` (read from `<meta name="csp-nonce">`).

### Auto-Resize (iframe → parent)

`ResizeObserver` + `MutationObserver` watch content size; on change, `window.parent.postMessage({ type: 'resize', height: document.body.scrollHeight }, '*')`. The WordPress parent listens and adjusts iframe height.

### Session Management (`public/assets/js/session-manager.js`)

- Multi-role (affiliate, customer, administrator, operator)
- 10-minute inactivity timeout
- Activity tracked in localStorage
- Auto-logout on timeout; route adjusts to login page based on auth state

API: `SessionManager.isAuthenticated(role)`, `.updateActivity(role)`, `.checkInactivity(role)`.

### Internationalization

Languages: `en`, `es`, `pt`, `de`. Translation files: `public/locales/{lang}/common.json`. Client: `public/assets/js/i18n.js` — `await window.i18n.init()`, `window.i18n.setLanguage(lang)`, `window.i18n.translate(key)`.

Auto-translation markers in HTML:
```html
<p data-i18n="landing.title">Fallback text</p>
<input data-i18n-placeholder="register.firstName">
```

Always maintain all 4 languages when adding user-facing copy. See `docs/guides/i18n-best-practices.md`.

---

## Business Logic

### Commission Calculation

Formula: `(WDF amount × 10%) + delivery fee`

```javascript
const wdfAmount = actualWeight * baseRate;
const wdfCommission = wdfAmount * 0.1;
const affiliateCommission = wdfCommission + totalDeliveryFee;

// Example: 15 lbs @ $1.25/lb = $18.75 WDF
// Delivery (3 bags): max($25 min, 3 × $5) = $25
// Commission: ($18.75 × 0.1) + $25 = $26.88
```

Add-ons and credits are **not** included in commission.

### Delivery Fee

Per-affiliate config: `minimumDeliveryFee` (0–100) and `perBagDeliveryFee` (0–50).

```javascript
totalFee = Math.max(minimumDeliveryFee, numberOfBags * perBagDeliveryFee);

// 1 bag:  max($25, $5)  = $25 (min applied)
// 3 bags: max($25, $15) = $25 (min applied)
// 6 bags: max($25, $30) = $30 (per-bag)
```

### WDF Credit System

Weight variance between estimate and actual generates a credit or debit on the customer account, applied to the next order.

```javascript
weightDifference = actualWeight - estimatedWeight;
wdfCreditGenerated = weightDifference * baseRate;

// Estimated 20 lbs, actual 15 lbs → customer overcharged → +$6.25 credit
// Estimated 10 lbs, actual 15 lbs → customer undercharged → -$6.25 debit
```

Application on next order:
```javascript
order.wdfCreditApplied = customer.wdfCredit;
order.actualTotal = subtotal - order.wdfCreditApplied;
customer.wdfCredit = 0;
customer.wdfCreditUpdatedAt = Date.now();
```

### Bag Tracking Workflow

**QR code format:** `customerId#bagId` (e.g. `CUST-12345#BAG001`).

Three-stage state machine per bag:

| Stage | Trigger | Bag status | Order status transition | Side effect |
|:---|:---|:---|:---|:---|
| 1. Weighing | Operator scans + enters weight | `processing` | `pending` → `processing` (first bag) | — |
| 2. After WDF | Operator scans | `processed` | `processing` → `processed` (when all bags) | Email affiliate |
| 3. Pickup | Operator scans | `completed` | `processed` → `complete` (when all bags) | Email customer |

### Payment Flow (V2 — current)

1. Customer registers (OAuth or traditional). No upfront payment.
2. Customer schedules pickup → order created, `v2PaymentStatus = 'pending'`
3. Affiliate picks up and weighs
4. System calculates actual price
5. Email sent with payment links (Venmo / PayPal / CashApp) → `v2PaymentStatus = 'awaiting'`
6. Customer pays via link
7. Email scanner detects payment → `v2PaymentStatus = 'verified'`, `isPaid = true`
8. Order proceeds to WDF processing
9. Automated reminders at 24h / 72h / 7d if still unpaid

*V1 flow (upfront Paygistix payment at registration) is being deleted in Phase 2.*

---

## Integration Points

| Service | Config | Entry point |
|:---|:---|:---|
| **OAuth Google** | `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`; callback `/api/v1/auth/google/callback`; scopes `email, profile` | `server/config/passport-config.js` |
| **OAuth Facebook** | `FACEBOOK_APP_ID` / `FACEBOOK_APP_SECRET`; callback `/api/v1/auth/facebook/callback`; perms `email, public_profile` | `server/config/passport-config.js` |
| **OAuth LinkedIn** | `LINKEDIN_CLIENT_ID` / `LINKEDIN_CLIENT_SECRET`; callback `/api/v1/auth/linkedin/callback`; scopes `r_emailaddress, r_liteprofile` | `server/config/passport-config.js` |
| **DocuSign (W-9)** | `DOCUSIGN_INTEGRATION_KEY`, `DOCUSIGN_USER_ID`, `DOCUSIGN_ACCOUNT_ID`, `DOCUSIGN_BASE_URL`, `DOCUSIGN_W9_TEMPLATE_ID` | `server/services/docusignService.js` |
| **Email (Mailcow SMTP)** | `EMAIL_PROVIDER=smtp`, `EMAIL_HOST=mail.wavemax.promo`, `EMAIL_PORT=587`, `EMAIL_FROM` | `server/services/emailService.js` |
| **Email (Brevo alt.)** | `EMAIL_PROVIDER=brevo`, `BREVO_API_KEY`, `BREVO_FROM_EMAIL` | `server/services/emailService.js` |
| **Geocoding (Nominatim)** | `https://nominatim.openstreetmap.org`, 1 req/sec, UA `WaveMAX-Affiliate-Program` | `server/middleware/locationValidation.js` |
| *V1* **Paygistix** | `PAYGISTIX_MERCHANT_ID`, `PAYGISTIX_FORM_ACTION_URL`, pool of 10 callback URLs | `server/services/paygistixService.js` — *being removed in Phase 2* |

All env variable names are in `.env.example`. Email templates live under `server/templates/emails/{lang}/`.

### DocuSign W-9 Workflow

1. `POST /api/v1/w9/initiate-signing` → creates envelope with pre-filled W-9 → returns signing URL
2. `POST /api/v1/w9/webhook/docusign` (DocuSign callback) → updates `w9Information.docusignStatus` → notifies admin
3. Admin verifies/rejects via `POST /api/v1/w9/admin/:affiliateId/verify|reject` → sets `w9Information.status`

### Geocoding Usage

Validate customer address falls within the affiliate's service radius:
```javascript
const coords = await geocodeAddress(address, city, state, zipCode);
const distance = calculateDistance(affiliateLocation, coords);
if (distance > serviceRadius) throw new Error('Address outside service area');
```

---

## Coding Standards

### File Naming

- **Models:** PascalCase (`Affiliate.js`)
- **Routes, controllers, middleware:** camelCase (`affiliateRoutes.js`, `affiliateController.js`, `rateLimiting.js`)
- **HTML, API paths:** kebab-case (`affiliate-register-embed.html`, `/api/v1/affiliates`)

### Controller Pattern

Use `asyncWrapper` from `server/utils/controllerHelpers.js` to catch errors; respond via `ControllerHelpers.sendSuccess` / `sendError`.

```javascript
exports.getAffiliate = asyncWrapper(async (req, res) => {
  const affiliate = await Affiliate.findOne({ affiliateId: req.params.affiliateId });
  if (!affiliate) return ControllerHelpers.sendError(res, 'Affiliate not found', 404);
  ControllerHelpers.sendSuccess(res, { affiliate }, 'Affiliate retrieved');
});
```

### Error Handling

Use `sendError(res, message, status)` for expected errors (validation/not-found/permission). Throw for unexpected failures — the error middleware catches and formats. For domain errors needing a status code, use `AppError`:

```javascript
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    Error.captureStackTrace(this, this.constructor);
  }
}

throw new AppError('W-9 not verified', 403);
```

### Environment & Config

- **Secrets:** always `process.env.*`, never hardcode
- **Business values:** always `await SystemConfig.getValue(key, default)`, never hardcode rates/fees/limits

### Logging

Winston logger (`server/utils/logger.js`) — use `logger.info/warn/error/debug`. `console.*` is ESLint-blocked in `server/`.

```javascript
logger.info('Order created', { orderId, customerId });
logger.error('Payment failed', { error: err.message, orderId, stack: err.stack });
```

Audit events (`server/utils/auditLogger.js`) — use for security-relevant actions:
```javascript
logAuditEvent(AuditEvents.AUTH_SUCCESS, { userId, role }, req);
logAuditEvent(AuditEvents.W9_VERIFIED, { affiliateId }, req);
```

### Documentation

Non-trivial functions get a JSDoc header documenting parameters, return shape, and any side effects. Reserve comments for *why*, not *what* — well-named identifiers explain what.

---

## Testing

Strict TDD — see root `CLAUDE.md` for the project testing rules. Layout and conventions live in [`tests/README.md`](../tests/README.md).

Quick reference:

- **Unit tests:** `tests/unit/` — models, utils, services
- **Integration tests:** `tests/integration/` — API endpoints via Supertest
- **Helpers:** `tests/helpers/` — `testUtils.js` (factories), `csrf.js` (CSRF helper)

### Essentials

**Database:** MongoDB Memory Server. Setup/teardown in `beforeAll`/`afterAll`; clean collections in `beforeEach`. `SystemConfig.initializeDefaults()` must run in `tests/setup.js` — tests depending on config fail silently without it.

**CSRF in tests:**
```javascript
const { getCsrfToken } = require('./helpers/csrf');

const agent = request.agent(app);
const csrfToken = await getCsrfToken(agent);
await agent.post('/api/v1/...').set('x-csrf-token', csrfToken).send(body);
```

**Mocking external services:** `jest.mock('../services/emailService')` before the `require`; assert with `expect(fn).toHaveBeenCalledWith(...)`.

**Floating-point:** use `toBeCloseTo(value, 2)`, never `toBe` for computed money amounts.

**Commands:** `npm test`, `npm run test:coverage`, `npm test -- tests/integration/affiliates.test.js`, `npm test -- --watch`, `npm test -- --detectOpenHandles`.

Tests must run clean without `--forceExit` after Phase 1.

---

## Deployment & Operations

### PM2

`ecosystem.config.js`:
```javascript
module.exports = {
  apps: [{
    name: 'wavemax',
    script: 'server.js',
    instances: 'max',
    exec_mode: 'cluster',
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: { NODE_ENV: 'production' }
  }]
};
```

Common operations: `pm2 start ecosystem.config.js`, `pm2 restart wavemax`, `pm2 logs wavemax --lines 50`, `pm2 status`, `pm2 monit`. After env changes: `pm2 restart wavemax --update-env`.

### Required Environment Variables

```bash
# Core
NODE_ENV=production
PORT=3000

# Database
MONGODB_URI=mongodb+srv://...

# Security — each a 64-char random/hex string
JWT_SECRET=...
ENCRYPTION_KEY=...        # 64-char hex
SESSION_SECRET=...
CSRF_SECRET=...

# OAuth
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
FACEBOOK_APP_ID=...
FACEBOOK_APP_SECRET=...
LINKEDIN_CLIENT_ID=...
LINKEDIN_CLIENT_SECRET=...

# Email (Mailcow SMTP)
EMAIL_PROVIDER=smtp
EMAIL_HOST=mail.wavemax.promo
EMAIL_PORT=587
EMAIL_USER=no-reply@wavemax.promo
EMAIL_PASS=...

# DocuSign
DOCUSIGN_INTEGRATION_KEY=...
DOCUSIGN_USER_ID=...
DOCUSIGN_ACCOUNT_ID=...

# Payment (V1, legacy — being removed in Phase 2)
PAYGISTIX_MERCHANT_ID=wmaxaustWEB
```

See `.env.example` for the full set.

### Logs

- Application: `logs/combined.log`
- Errors: `logs/error.log`
- Audit: `logs/audit.log`
- PM2: `/root/.pm2/logs/wavemax-*.log`

Log level via `LOG_LEVEL` env (`debug` / `info` / `warn`).

### First-Time Database Setup

```bash
npm run init-config       # Initialize SystemConfig defaults
npm run create-admin      # Create default admin account
```

Manual alternative in a Node script:
```javascript
await SystemConfig.initializeDefaults();
await callbackPoolManager.initializePool();   // V1 only — legacy
```

### Nginx Reverse Proxy

```nginx
location /austin-tx/wavemax-austin-affiliate {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
}
```

### Health Check

`GET /api/health` → `{ status, timestamp, uptime, database }`

---

## Quick Reference

### Key File Paths

```
Server:
  Entry point:       server.js
  Models:            server/models/
  Controllers:       server/controllers/
  Routes:            server/routes/
  Middleware:        server/middleware/
  Services:          server/services/
  Utils:             server/utils/

Frontend:
  Entry point:       public/embed-app-v2.html
  Router:            public/assets/js/embed-app-v2.js
  Session manager:   public/assets/js/session-manager.js
  i18n:              public/assets/js/i18n.js
  Translations:      public/locales/{lang}/common.json

Configuration:
  Environment:       .env (.env.example is the reference)
  PM2:               ecosystem.config.js
  Passport OAuth:    server/config/passport-config.js
  CSRF:              server/config/csrf-config.js

Documentation:
  Refactor plan:     docs/refactor/REFACTORING_PLAN.md
  Best practices:    docs/development/OPERATING_BEST_PRACTICES.md
  Pitfalls guide:    docs/development/PITFALLS.md
  i18n guide:        docs/guides/i18n-best-practices.md
  Tests layout:      tests/README.md
```

### Important URLs

```
Production:
  Main site:         https://www.wavemaxlaundry.com
  Affiliate app:     https://wavemax.promo
  Embedded iframe:   /austin-tx/wavemax-austin-affiliate

API:
  Base URL:          https://wavemax.promo/api/v1
  Health check:      /api/health
  CSRF token:        /api/csrf-token

OAuth callbacks:
  Google:            /api/v1/auth/google/callback
  Facebook:          /api/v1/auth/facebook/callback
  LinkedIn:          /api/v1/auth/linkedin/callback

DocuSign webhook:    /api/v1/w9/webhook/docusign

V1 Paygistix (legacy):
  Gateway URL:       https://safepay.paymentlogistics.net/transaction.asp
```

### Role Hierarchy

```
admin (super admin)
  └── administrator (system manager)
        ├── operator (facility staff)
        ├── affiliate (service provider)
        └── customer (end user)
```

### Workflow Cheat Sheet

- **Affiliate registration:** Register → W-9 submission → Admin verification → Active
- **Customer registration (V2, current):** Register (no payment) → Active
- **Order lifecycle:** `pending → processing → processed → complete`
- **Bag workflow:** `processing (weighed) → processed (WDF done) → completed (picked up)`
- **Payment (V2) flow:** `pending → awaiting → confirming → verified`

### Common Pitfalls

See [`docs/development/PITFALLS.md`](../docs/development/PITFALLS.md) — 10 traps with fixes (hardcoding, inline scripts, missing `pageScripts`, iframe-context testing, leaky JSON responses, missing CSRF, i18n drift, float precision, test cleanup, copyright).

### Copyright Notice

`© 2025 CRHS Enterprises, LLC. All rights reserved.`

---

*Operational rules and session startup live in the root `CLAUDE.md` and `~/.claude/CLAUDE.md`. This handbook is architectural reference only.*
