# WaveMAX Affiliate Program - Claude AI Development Guide

> **Last Updated**: 2025-01-16
> **Version**: 2.0

This document provides a comprehensive overview of the WaveMAX Affiliate Program architecture, key components, and coding guidelines for the `/init` command.

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
11. [Testing Patterns](#testing-patterns)
12. [Deployment & Operations](#deployment--operations)
13. [Common Pitfalls](#common-pitfalls)
14. [Quick Reference](#quick-reference)

---

## Project Overview

The **WaveMAX Affiliate Program** is a sophisticated Node.js/Express application that manages a laundry service affiliate network. The system enables affiliates (independent service providers) to register customers, manage pickup/delivery logistics, track orders through a three-stage bag scanning workflow, and earn commissions.

### Key Features

- **Multi-Role System**: Administrators, Affiliates, Customers, and Operators
- **OAuth Integration**: Google, Facebook, LinkedIn social authentication
- **Dual Payment Systems**:
  - V1: Upfront payment with Paygistix
  - V2: Post-weigh payment via Venmo/PayPal/CashApp
- **Geospatial Service Areas**: Location-based affiliate matching
- **QR Code Bag Tracking**: Three-stage workflow (weighing → processing → pickup)
- **Commission System**: 10% WDF + 100% delivery fee
- **W-9 Tax Compliance**: DocuSign integration for tax forms
- **Multi-Language Support**: English, Spanish, Portuguese, German
- **CSP v2 Compliant**: Strict Content Security Policy for iframe embedding
- **Comprehensive Testing**: 86.16% code coverage

### Project Structure

```
/var/www/wavemax/wavemax-affiliate-program/
├── server/                    # Server-side Node.js/Express code
│   ├── config/               # Configuration (CSRF, Passport OAuth, Paygistix)
│   ├── controllers/          # API endpoint controllers (10 files)
│   ├── middleware/           # Express middleware (auth, RBAC, security)
│   ├── models/               # Mongoose data models (17 models)
│   ├── routes/               # Express route definitions (22 files)
│   ├── services/             # Business logic (email, payments, validation)
│   ├── utils/                # Utilities (encryption, logging, helpers)
│   ├── jobs/                 # Background jobs (payment verification)
│   └── templates/            # Email templates (multi-language)
├── public/                    # Frontend static files
│   ├── assets/
│   │   ├── js/              # Client-side JavaScript (60+ files)
│   │   ├── css/             # Stylesheets (CSP-compliant)
│   │   └── images/          # Static images
│   ├── locales/             # i18n translation files (en, es, pt, de)
│   └── *.html               # Embedded HTML pages (25+ pages)
├── tests/                     # Comprehensive test suite
│   ├── unit/                # Unit tests (130+ test suites)
│   ├── integration/         # API integration tests
│   └── helpers/             # Test utilities
├── docs/                      # Documentation
├── scripts/                   # Utility scripts (migrations, setup)
└── server.js                  # Main application entry point
```

---

## Technology Stack

### Backend

- **Runtime**: Node.js v20+
- **Framework**: Express.js 4.x
- **Database**: MongoDB 7.0+ with Mongoose ODM
- **Authentication**: JWT tokens + Passport.js (OAuth)
- **Logging**: Winston
- **Process Management**: PM2 (cluster mode)

### Security

- **Headers**: Helmet.js
- **CSRF Protection**: csurf
- **Rate Limiting**: express-rate-limit with MongoDB store
- **Encryption**: AES-256-GCM
- **Sanitization**: express-mongo-sanitize, XSS prevention

### Frontend

- **JavaScript**: Vanilla JS (ES6+)
- **UI Framework**: Bootstrap 5.3.0
- **Icons**: Font Awesome 6.4.0
- **Architecture**: Single-page iframe application
- **CSP Level**: Strict CSP v2 (no unsafe-inline)

### Testing

- **Framework**: Jest 29.7.0
- **API Testing**: Supertest
- **Database**: MongoDB Memory Server
- **Coverage**: 86.16%

### External Services

- **Payment Gateway**: Paygistix (PCI-compliant hosted forms)
- **OAuth Providers**: Google, Facebook, LinkedIn
- **Document Signing**: DocuSign
- **Email**: Mailcow SMTP / Brevo / MS Exchange
- **Geocoding**: OpenStreetMap Nominatim

---

## Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    WordPress Parent Site                     │
│              (www.wavemaxlaundry.com)                       │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        │ Embeds iframe
                        ▼
┌─────────────────────────────────────────────────────────────┐
│              Nginx Reverse Proxy                             │
│         (Proxy to Node.js on port 3000)                     │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│          Node.js/Express Application (PM2)                   │
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐ │
│  │  Controllers  │◄──►│  Services    │◄──►│   Models     │ │
│  └──────────────┘    └──────────────┘    └──────────────┘ │
│          ▲                   ▲                    ▲         │
│          │                   │                    │         │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐ │
│  │  Middleware   │    │  Routes      │    │   Utils      │ │
│  └──────────────┘    └──────────────┘    └──────────────┘ │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│              MongoDB Atlas (Database)                        │
└─────────────────────────────────────────────────────────────┘
```

### Request Flow

```
1. User → WordPress Page → Iframe loads /embed-app-v2.html
2. embed-app-v2.html → Routes based on ?route= parameter
3. Dynamic page loading → Fetches HTML content
4. Script loading → Injects page-specific JS files
5. API calls → JWT authentication → Controller → Service → Model
6. Response → JSON format → Client updates UI
```

### Embedded Iframe System

The application uses a **single-page architecture** within an iframe:

- **Entry Point**: `/embed-app-v2.html`
- **Router**: `embed-app-v2.js` with route mapping
- **Navigation**: URL parameter `?route=/page-name`
- **Communication**: PostMessage API for height updates
- **CSP Compliance**: All scripts external, nonce-based CSP

**Key Files**:
- `public/embed-app-v2.html` - Main entry point
- `public/assets/js/embed-app-v2.js` - Router and loader
- `public/assets/js/session-manager.js` - Auth state management

---

## Database Schema

### Core Models

#### Affiliate Model
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

**Key Methods**:
- `canReceivePayments()`: Returns true if W-9 verified and active
- Pre-save middleware: Hash password, encrypt payment data

#### Customer Model
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
  numberOfBags: Number,             // Initial bags purchased
  bagCredit: Number,                // Credit from initial purchase
  bagCreditApplied: Boolean,

  // WDF Credit tracking
  wdfCredit: Number,                // Positive = credit, Negative = debit
  wdfCreditUpdatedAt: Date,
  wdfCreditFromOrderId: String,

  // V2 Payment system
  registrationVersion: Enum,        // 'v1' (upfront) or 'v2' (post-weigh)
  initialBagsRequested: Number,     // 1 or 2

  languagePreference: Enum,
  isActive: Boolean
}
```

#### Order Model
**File**: `server/models/Order.js`

```javascript
{
  orderId: String,                  // "ORD-uuid" (unique, indexed)
  customerId: String,               // References Customer
  affiliateId: String,              // References Affiliate

  // Pickup scheduling
  pickupDate: Date,
  pickupTime: Enum,                 // 'morning', 'afternoon', 'evening'
  specialPickupInstructions: String,
  estimatedWeight: Number,

  // Order lifecycle
  status: Enum,                     // 'pending', 'processing', 'processed', 'complete', 'cancelled'
  createdAt, processingStartedAt, processedAt, completedAt, cancelledAt,

  // NEW: Bag tracking system (QR codes)
  numberOfBags: Number,
  bags: [{
    bagId: String,                  // Unique bag identifier (indexed)
    bagNumber: Number,              // 1, 2, 3, etc.
    status: Enum,                   // 'processing', 'processed', 'completed'
    weight: Number,                 // Actual weight in pounds
    scannedAt: {
      processing: Date,             // When weighed
      processed: Date,              // After WDF
      completed: Date               // When picked up
    },
    scannedBy: {
      processing: ObjectId,         // Operator who weighed
      processed: ObjectId,          // Operator who processed
      completed: ObjectId           // Operator who completed
    }
  }],

  // Pricing breakdown
  baseRate: Number,                 // WDF rate from SystemConfig
  feeBreakdown: {
    numberOfBags, minimumFee, perBagFee, totalFee, minimumApplied
  },
  estimatedTotal, actualTotal,
  bagCreditApplied: Number,
  wdfCreditApplied: Number,
  wdfCreditGenerated: Number,
  weightDifference: Number,
  affiliateCommission: Number,

  // V1 Payment (Paygistix)
  paymentStatus: Enum,              // 'pending', 'processing', 'completed', 'failed'
  paymentMethod: Enum,
  isPaid: Boolean,

  // V2 Payment (Post-weigh)
  v2PaymentStatus: Enum,            // 'pending', 'awaiting', 'confirming', 'verified', 'failed'
  v2PaymentMethod: Enum,            // 'venmo', 'paypal', 'cashapp', 'credit_card'
  v2PaymentAmount: Number,
  v2PaymentLinks: { venmo, paypal, cashapp },
  v2PaymentQRCodes: { venmo, paypal, cashapp },  // Base64 encoded
  v2PaymentReminders: [{
    sentAt, reminderNumber, sentBy, method
  }],

  // Add-ons
  addOns: { premiumDetergent, fabricSoftener, stainRemover },
  addOnTotal: Number,

  // Operator workflow
  assignedOperator: ObjectId,
  operatorNotes, qualityCheckPassed, qualityCheckNotes
}
```

**Pre-save Middleware**:
- Fetches current WDF rate from SystemConfig
- Calculates pricing based on weights and add-ons
- Auto-updates `isPaid` when v2PaymentStatus becomes 'verified'

#### SystemConfig Model
**File**: `server/models/SystemConfig.js`

**Purpose**: Dynamic configuration without code changes

```javascript
{
  key: String,                      // Unique identifier (indexed)
  value: Mixed,                     // Actual configuration value
  description: String,
  category: Enum,                   // 'operator', 'payment', 'system', etc.
  dataType: Enum,                   // 'string', 'number', 'boolean', 'array', 'object'
  defaultValue: Mixed,
  isEditable: Boolean,
  isPublic: Boolean,                // Can be accessed without auth
  validation: { min, max, regex, allowedValues },
  updatedBy: ObjectId               // References Administrator
}
```

**Key Configurations**:
- `wdf_base_rate_per_pound`: 1.25 (public, min: 0.50, max: 10.00)
- `laundry_bag_fee`: 10.00 (public)
- `delivery_minimum_fee`: 10.00 (public)
- `delivery_per_bag_fee`: 2.00 (public)
- `payment_version`: 'v1' | 'v2' (public)
- `max_operators_per_shift`: 10
- `order_processing_timeout_minutes`: 120

**Usage Pattern**:
```javascript
// Always use SystemConfig instead of hardcoding
const wdfRate = await SystemConfig.getValue('wdf_base_rate_per_pound', 1.25);
const bagFee = await SystemConfig.getValue('laundry_bag_fee', 10.00);

// Update config (admin only)
await SystemConfig.setValue('wdf_base_rate_per_pound', 1.50, adminId);
```

#### Other Models
- **Administrator**: System managers with role-based permissions
- **Operator**: Facility staff with PIN-based auth
- **Payment**: Payment transaction records (Paygistix)
- **CallbackPool**: Payment callback URL management
- **RefreshToken**: JWT refresh token tracking
- **TokenBlacklist**: Logged-out token blacklist
- **OAuthSession**: Temporary OAuth session storage
- **DataDeletionRequest**: GDPR compliance tracking

---

## API Structure

### Route Versioning

- **v1 API**: `/api/v1/` (current stable)
- **v2 API**: `/api/v2/` (new customer registration)
- **Legacy**: `/api/` redirects to v1

### Authentication Routes
**File**: `server/routes/authRoutes.js`

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

### Social Auth Routes
**File**: `server/routes/socialAuthRoutes.js`

```
GET    /api/v1/auth/google
GET    /api/v1/auth/google/callback
GET    /api/v1/auth/facebook
GET    /api/v1/auth/facebook/callback
GET    /api/v1/auth/linkedin
GET    /api/v1/auth/linkedin/callback
POST   /api/v1/auth/social/register
POST   /api/v1/auth/customer/social/register
POST   /api/v1/auth/social/link
```

### Affiliate Routes
**File**: `server/routes/affiliateRoutes.js`

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

### Customer Routes
**File**: `server/routes/customerRoutes.js`

```
POST   /api/v1/customers/register         # V1 registration (upfront payment)
POST   /api/v2/customers/register         # V2 registration (no payment)
GET    /api/v1/customers/:customerId
PUT    /api/v1/customers/:customerId
GET    /api/v1/customers/:customerId/orders
POST   /api/v1/customers/:customerId/change-password
DELETE /api/v1/customers/:customerId/delete-all-data
```

### Order Routes
**File**: `server/routes/orderRoutes.js`

```
POST   /api/v1/orders
GET    /api/v1/orders/:orderId
PUT    /api/v1/orders/:orderId
POST   /api/v1/orders/:orderId/cancel
PUT    /api/v1/orders/:orderId/status
GET    /api/v1/orders
```

### Operator Routes
**File**: `server/routes/operatorRoutes.js`

```
POST   /api/v1/operators/login
POST   /api/v1/operators/scan-bag         # QR code scanning
GET    /api/v1/operators/dashboard
GET    /api/v1/operators/orders
POST   /api/v1/operators/orders/:orderId/status
```

### Administrator Routes
**File**: `server/routes/administratorRoutes.js`

```
POST   /api/v1/administrators/operators
GET    /api/v1/administrators/operators
PUT    /api/v1/administrators/operators/:operatorId
DELETE /api/v1/administrators/operators/:operatorId
GET    /api/v1/administrators/dashboard
GET    /api/v1/administrators/config      # SystemConfig management
PUT    /api/v1/administrators/config
```

### W-9 Routes
**File**: `server/routes/w9Routes.js`

```
POST   /api/v1/w9/initiate-signing        # DocuSign integration
POST   /api/v1/w9/webhook/docusign
POST   /api/v1/w9/upload
GET    /api/v1/w9/status
GET    /api/v1/w9/download
GET    /api/v1/w9/admin/pending
POST   /api/v1/w9/admin/:affiliateId/verify
POST   /api/v1/w9/admin/:affiliateId/reject
```

### API Response Format

**Success Response**:
```javascript
{
  success: true,
  message: "Operation completed successfully",
  data: { ... },
  // Optional pagination
  pagination: {
    page: 1,
    limit: 10,
    totalPages: 5,
    totalItems: 48
  }
}
```

**Error Response**:
```javascript
{
  success: false,
  message: "Error description",
  // Development only
  error: {
    details: "Detailed error message",
    type: "ValidationError"
  }
}
```

---

## Security Implementation

### Authentication Methods

#### 1. Traditional (Username/Password)

**Password Hashing**: PBKDF2 with SHA-512
- **Iterations**: 100,000
- **Hash length**: 64 bytes (512 bits)
- **Salt**: 16 random bytes per password

**Implementation**:
```javascript
// server/utils/passwordUtils.js
hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return { salt, hash };
}

verifyPassword(password, storedSalt, storedHash) {
  const hash = crypto.pbkdf2Sync(password, storedSalt, 100000, 64, 'sha512').toString('hex');
  return hash === storedHash;  // Constant-time comparison
}
```

#### 2. JWT Tokens

**Access Token** (1 hour expiry):
```javascript
{
  id: userId,
  role: 'affiliate' | 'customer' | 'administrator' | 'operator',
  affiliateId: "AFF-123",  // Role-specific ID
  iat: issuedAt,
  exp: expiresAt
}
```

**Refresh Token** (30 days expiry):
```javascript
{
  id: userId,
  tokenId: refreshTokenId,
  iat: issuedAt,
  exp: expiresAt
}
```

**Token Security**:
- Signed with `JWT_SECRET` environment variable
- Blacklist on logout (`TokenBlacklist` model)
- Refresh token rotation
- Stored in httpOnly cookies (production)

#### 3. OAuth (Social Login)

**Supported Providers**:
- Google OAuth 2.0
- Facebook OAuth
- LinkedIn OAuth 2.0

**OAuth Flow**:
```
1. User clicks "Login with Google"
2. Redirect to OAuth provider
3. User authorizes on provider
4. Callback receives authorization code
5. Exchange code for access token
6. Fetch user profile from provider
7. Check for existing account (by social ID or email)
8. Create new user or link account
9. Encrypt and store OAuth tokens (AES-256-GCM)
10. Generate JWT tokens
11. Return to client with JWT
```

**Configuration**: `server/config/passport-config.js`

**OAuth Token Storage**:
- Encrypted with AES-256-GCM
- Stored in `user.socialAccounts.{provider}`
- Refresh token rotation for Google/LinkedIn

### CSRF Protection

**Implementation**: `server/config/csrf-config.js`

**Conditional Enforcement**:
- **PUBLIC_ENDPOINTS**: No CSRF (health checks, OAuth, webhooks)
- **AUTH_ENDPOINTS**: Rate limiting instead of CSRF
- **REGISTRATION_ENDPOINTS**: CAPTCHA instead of CSRF
- **CRITICAL_ENDPOINTS**: Always enforce CSRF (W-9, payments, deletions)
- **READ_ONLY_ENDPOINTS**: No CSRF for GET requests

**Usage**:
```javascript
// 1. Get CSRF token
GET /api/csrf-token

// 2. Include in requests
POST /api/v1/affiliates/register
Headers: {
  'x-csrf-token': token
}
```

### Rate Limiting

**Implementation**: `server/middleware/rateLimiting.js`

**MongoDB-backed distributed rate limiting**:
```javascript
authLimiter: 5 req/15min (strict), 50 req/15min (relaxed)
passwordResetLimiter: 3 req/hour (strict), 10 req/hour (relaxed)
registrationLimiter: 10 reg/hour (strict), 50 reg/hour (relaxed)
apiLimiter: 100 req/15min (strict), 500 req/15min (relaxed)
sensitiveOperationLimiter: 10 ops/hour
```

**Bypass for testing**:
```javascript
RELAX_RATE_LIMITING=true  // Increases all limits 10x
NODE_ENV=test             // Disables rate limiting
```

### Input Validation & Sanitization

**Sanitization Middleware**: `server/middleware/sanitization.js`

```javascript
// NoSQL injection prevention
mongoSanitize()  // Removes $ and . from user input

// XSS prevention
sanitizeRequest  // Escapes HTML entities
```

**Validation Libraries**:
- **Express Validator**: Email, phone, ZIP code validation
- **Joi**: Schema validation for complex objects

**Example**:
```javascript
const schema = Joi.object({
  firstName: Joi.string().min(2).max(50).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).required(),
  serviceRadius: Joi.number().min(1).max(50).required()
});
```

### Data Encryption

**AES-256-GCM Encryption**: `server/utils/encryption.js`

**Encrypted Fields**:
- `Affiliate.paypalEmail`
- `Affiliate.venmoHandle`
- OAuth access tokens
- W-9 documents

**Implementation**:
```javascript
encrypt(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  const encrypted = cipher.update(text, 'utf8', 'hex') + cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return { iv: iv.toString('hex'), encryptedData: encrypted, authTag };
}

decrypt(encryptedObj) {
  const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY,
                                           Buffer.from(encryptedObj.iv, 'hex'));
  decipher.setAuthTag(Buffer.from(encryptedObj.authTag, 'hex'));

  return decipher.update(encryptedObj.encryptedData, 'hex', 'utf8')
       + decipher.final('utf8');
}
```

### Security Headers

**Helmet.js Configuration**: `server.js`

```javascript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://cdn.jsdelivr.net", "'nonce-{nonce}'"],
      styleSrc: ["'self'", "https://cdn.jsdelivr.net", "'nonce-{nonce}'"],
      frameSrc: ["'self'", "https://safepay.paymentlogistics.net"],
      frameAncestors: ["'self'", "https://www.wavemaxlaundry.com"]
    }
  },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}));
```

---

## Frontend Architecture

### Embedded Iframe System

**Single-Page Application within Iframe**

**Architecture**:
```
WordPress Page
  └── <iframe src="https://wavemax.promo/embed-app-v2.html?route=/affiliate-dashboard">
        └── embed-app-v2.html (SPA router)
              ├── Dynamic page loading (fetch HTML)
              ├── Script injection (sequential loading)
              └── PostMessage communication (height updates)
```

**Key Files**:
- **Entry Point**: `public/embed-app-v2.html`
- **Router**: `public/assets/js/embed-app-v2.js`
- **Session Manager**: `public/assets/js/session-manager.js`

### Route Mapping

**Configuration**: `public/assets/js/embed-app-v2.js`

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

**IMPORTANT**: Scripts must be registered in `pageScripts` mapping

```javascript
const pageScripts = {
  '/affiliate-register': [
    '/assets/js/i18n.js',
    '/assets/js/language-switcher.js',
    '/assets/js/modal-utils.js',
    '/assets/js/errorHandler.js',
    '/assets/js/csrf-utils.js',
    '/assets/js/swirl-spinner.js',
    '/assets/js/form-validation.js',
    '/assets/js/affiliate-register-init.js'
  ],
  '/affiliate-dashboard': [
    '/assets/js/i18n.js',
    '/assets/js/dashboard-utils.js',
    '/assets/js/chart.min.js',
    '/assets/js/affiliate-dashboard-init.js'
  ]
};
```

**Best Practice**: Always add scripts to BOTH:
1. HTML file (for direct access)
2. `pageScripts` mapping (for embedded access)

### CSP Compliance

**Strict CSP v2**: No inline scripts or styles

**Nonce-based CSP**:
```javascript
// Server generates nonce per request
res.locals.cspNonce = crypto.randomBytes(16).toString('base64');

// Client accesses nonce
window.CSP_NONCE = document.querySelector('meta[name="csp-nonce"]')?.getAttribute('content');

// Dynamic script loading
const script = document.createElement('script');
script.src = '/assets/js/file.js';
script.nonce = window.CSP_NONCE;
document.body.appendChild(script);
```

**Event Handlers**:
```html
<!-- Bad: Inline event handler -->
<button onclick="doSomething()">Click</button>

<!-- Good: External event listener -->
<button id="myButton">Click</button>
<script src="/assets/js/handlers.js"></script>
```

### Auto-Resize Mechanism

**Height Tracking**:
```javascript
// ResizeObserver monitors content height
const resizeObserver = new ResizeObserver(() => {
  updateHeight();
});

// MutationObserver detects DOM changes
const mutationObserver = new MutationObserver(() => {
  updateHeight();
});

// PostMessage sends height to parent
function updateHeight() {
  const height = document.body.scrollHeight;
  window.parent.postMessage({
    type: 'resize',
    height: height
  }, '*');
}
```

### Session Management

**Client-Side**: `public/assets/js/session-manager.js`

**Features**:
- Multi-role support (affiliate, customer, administrator, operator)
- 10-minute inactivity timeout
- Activity tracking via localStorage
- Auto-logout on timeout
- Route adjustment based on auth state

**Usage**:
```javascript
// Check authentication
if (window.SessionManager.isAuthenticated('affiliate')) {
  // User is logged in as affiliate
}

// Update activity (called on user interactions)
window.SessionManager.updateActivity('affiliate');

// Auto-logout check (runs every minute)
window.SessionManager.checkInactivity('affiliate');
```

### Internationalization (i18n)

**Supported Languages**:
- English (en)
- Spanish (es)
- Portuguese (pt)
- German (de)

**Translation Files**: `public/locales/{lang}/common.json`

**Client-Side i18n**: `public/assets/js/i18n.js`

```javascript
// Initialize
await window.i18n.init();

// Change language
await window.i18n.setLanguage('es');

// Translate
const text = window.i18n.translate('landing.title');

// Auto-translate page
<p data-i18n="landing.title">Fallback text</p>
<input data-i18n-placeholder="register.firstName">
```

**Best Practice**: Always maintain translations for all 4 languages

---

## Business Logic

### Commission Calculation

**Formula**: `(WDF amount × 10%) + delivery fee`

```javascript
const wdfAmount = actualWeight * baseRate;
const wdfCommission = wdfAmount * 0.1;
const affiliateCommission = wdfCommission + totalDeliveryFee;

// Example:
// 15 lbs at $1.25/lb = $18.75 WDF
// Delivery fee (3 bags): max($25 minimum, 3 × $5) = $25
// Commission: ($18.75 × 0.1) + $25 = $1.88 + $25 = $26.88
```

**Note**: Add-ons and credits are NOT included in commission

### Delivery Fee Calculation

**Structure**:
```javascript
// Configured per affiliate
minimumDeliveryFee: 25  // Range: 0-100
perBagDeliveryFee: 5    // Range: 0-50

// Calculation
totalFee = Math.max(minimumDeliveryFee, numberOfBags * perBagDeliveryFee);

// Examples:
// 1 bag: max($25, 1 × $5) = $25 (minimum applied)
// 3 bags: max($25, 3 × $5) = $25 (minimum applied)
// 6 bags: max($25, 6 × $5) = $30 (per-bag fee)
```

### WDF Credit System

**Mechanism**:
```javascript
weightDifference = actualWeight - estimatedWeight;
wdfCreditGenerated = weightDifference * baseRate;

// Positive difference (actual > estimated)
// Customer charged less → earns credit
// Example: Estimated 20 lbs, actual 15 lbs
// Credit: (15 - 20) × $1.25 = -$6.25 → +$6.25 credit

// Negative difference (actual < estimated)
// Customer charged more → owes debit
// Example: Estimated 10 lbs, actual 15 lbs
// Debit: (15 - 10) × $1.25 = $6.25 → -$6.25 debit
```

**Application**:
```javascript
// On next order
order.wdfCreditApplied = customer.wdfCredit;
order.actualTotal = subtotal - wdfCreditApplied;

// Update customer
customer.wdfCredit = 0;
customer.wdfCreditUpdatedAt = Date.now();
```

### Bag Tracking Workflow

**QR Code Format**: `customerId#bagId`
**Example**: `CUST-12345#BAG001`

**Three-Stage Process**:

```
Stage 1: Weighing (processing)
  ├── Operator scans bag QR code
  ├── Enter weight
  ├── Bag status → 'processing'
  └── Order status → 'pending' → 'processing' (first bag)

Stage 2: After WDF (processed)
  ├── Operator scans bag QR code
  ├── Bag status → 'processed'
  ├── Order status → 'processing' → 'processed' (all bags)
  └── Email notification to affiliate

Stage 3: Pickup (completed)
  ├── Operator scans bag QR code
  ├── Bag status → 'completed'
  ├── Order status → 'processed' → 'complete' (all bags)
  └── Email notification to customer
```

**Bag Data Structure**:
```javascript
bags: [{
  bagId: 'BAG001',
  bagNumber: 1,
  status: 'processing' → 'processed' → 'completed',
  weight: 5.2,
  scannedAt: {
    processing: Date,
    processed: Date,
    completed: Date
  },
  scannedBy: {
    processing: OperatorId,
    processed: OperatorId,
    completed: OperatorId
  }
}]
```

### Payment Systems

#### V1 Payment Flow (Upfront)

```
1. Customer registers → Paygistix payment form
2. Payment processed → Customer created with bagCredit
3. Customer schedules pickup
4. Order created with estimated pricing
5. Affiliate picks up and weighs
6. Final price calculated
7. WDF credit/debit applied to customer account
8. Order marked complete
```

#### V2 Payment Flow (Post-Weigh)

```
1. Customer registers (OAuth or traditional)
2. No payment required (bagCredit = 0)
3. Customer schedules pickup
4. Order created with v2PaymentStatus = 'pending'
5. Affiliate picks up and weighs
6. System calculates actual price
7. Email sent with payment links (Venmo/PayPal/CashApp)
8. v2PaymentStatus = 'awaiting'
9. Customer pays via link
10. Email scanner detects payment
11. v2PaymentStatus = 'verified'
12. Order proceeds to WDF processing
13. Automatic reminders (24h, 72h, 7d)
```

---

## Integration Points

### Paygistix (Payment Gateway)

**Configuration**:
```javascript
PAYGISTIX_MERCHANT_ID: 'wmaxaustWEB'
PAYGISTIX_FORM_ACTION_URL: 'https://safepay.paymentlogistics.net/transaction.asp'
PAYGISTIX_ENVIRONMENT: 'production'
```

**Callback URL Pool System**:
- Pool of 10 callback URLs
- Single Paygistix form ID
- Dynamic callback assignment
- Automatic pool recycling

**Integration**: `server/services/paygistixService.js`

### OAuth Providers

**Google OAuth 2.0**:
```javascript
GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET
Callback: /api/v1/auth/google/callback
Scopes: email, profile
```

**Facebook OAuth**:
```javascript
FACEBOOK_APP_ID: process.env.FACEBOOK_APP_ID
FACEBOOK_APP_SECRET: process.env.FACEBOOK_APP_SECRET
Callback: /api/v1/auth/facebook/callback
Permissions: email, public_profile
```

**LinkedIn OAuth 2.0**:
```javascript
LINKEDIN_CLIENT_ID: process.env.LINKEDIN_CLIENT_ID
LINKEDIN_CLIENT_SECRET: process.env.LINKEDIN_CLIENT_SECRET
Callback: /api/v1/auth/linkedin/callback
Scopes: r_emailaddress, r_liteprofile
```

**Configuration**: `server/config/passport-config.js`

### DocuSign (W-9 Signing)

**Configuration**:
```javascript
DOCUSIGN_INTEGRATION_KEY: process.env.DOCUSIGN_INTEGRATION_KEY
DOCUSIGN_USER_ID: process.env.DOCUSIGN_USER_ID
DOCUSIGN_ACCOUNT_ID: process.env.DOCUSIGN_ACCOUNT_ID
DOCUSIGN_BASE_URL: 'https://demo.docusign.net/restapi'
DOCUSIGN_W9_TEMPLATE_ID: process.env.DOCUSIGN_W9_TEMPLATE_ID
```

**Workflow**:
```
1. POST /api/v1/w9/initiate-signing
   ├── Create envelope with pre-filled W-9
   └── Return signing URL

2. POST /api/v1/w9/webhook/docusign (callback)
   ├── Update w9Information.docusignStatus
   └── Trigger admin notification

3. Administrator verifies/rejects
   ├── POST /api/v1/w9/admin/:affiliateId/verify
   └── Affiliate.w9Information.status = 'verified'
```

**Integration**: `server/services/docusignService.js`

### Email Services

**Mailcow SMTP** (current):
```javascript
EMAIL_PROVIDER: 'smtp'
EMAIL_HOST: 'mail.wavemax.promo'
EMAIL_PORT: 587
EMAIL_SECURE: false  // STARTTLS
EMAIL_FROM: 'no-reply@wavemax.promo'
```

**Brevo (SendInBlue)** (alternative):
```javascript
EMAIL_PROVIDER: 'brevo'
BREVO_API_KEY: process.env.BREVO_API_KEY
BREVO_FROM_EMAIL: process.env.BREVO_FROM_EMAIL
```

**Multi-Language Templates**: `server/templates/emails/{language}/`

**Integration**: `server/services/emailService.js`

### OpenStreetMap Nominatim (Geocoding)

**Purpose**: Address validation and service area checks

**Configuration**:
```javascript
Base URL: 'https://nominatim.openstreetmap.org'
Rate Limit: 1 request per second
User-Agent: 'WaveMAX-Affiliate-Program'
```

**Usage**:
```javascript
// Validate address within service area
const coordinates = await geocodeAddress(address, city, state, zipCode);
const distance = calculateDistance(affiliateLocation, coordinates);
if (distance > serviceRadius) {
  throw new Error('Address outside service area');
}
```

**Integration**: `server/middleware/locationValidation.js`

---

## Coding Standards

### File Naming Conventions

- **Models**: PascalCase (`Affiliate.js`, `Order.js`)
- **Routes**: camelCase (`affiliateRoutes.js`, `orderRoutes.js`)
- **Controllers**: camelCase (`affiliateController.js`)
- **Middleware**: camelCase (`auth.js`, `rateLimiting.js`)
- **HTML**: kebab-case (`affiliate-register-embed.html`)
- **API Routes**: kebab-case (`/api/v1/affiliates`)

### Code Organization Patterns

**Controller Pattern**:
```javascript
// Using asyncWrapper for automatic error handling
const { asyncWrapper } = require('../utils/controllerHelpers');

exports.getAffiliate = asyncWrapper(async (req, res) => {
  const affiliate = await Affiliate.findOne({
    affiliateId: req.params.affiliateId
  });

  if (!affiliate) {
    return ControllerHelpers.sendError(res, 'Affiliate not found', 404);
  }

  ControllerHelpers.sendSuccess(res, { affiliate }, 'Affiliate retrieved');
});
```

**Service Pattern**:
```javascript
// Separate business logic from controllers
class EmailService {
  async sendAffiliateWelcome(affiliate) {
    const template = this.getTemplate('affiliate-welcome', affiliate.languagePreference);
    return this.send({
      to: affiliate.email,
      subject: template.subject,
      html: template.html
    });
  }
}
```

**Utility Pattern**:
```javascript
// Reusable helper functions
module.exports = {
  generateUniqueId: (prefix) => `${prefix}-${uuidv4()}`,
  calculateDistance: (lat1, lon1, lat2, lon2) => { /* ... */ },
  formatCurrency: (amount) => `$${amount.toFixed(2)}`
};
```

### Error Handling

**Controller Errors**:
```javascript
// Validation error
if (!email) {
  return ControllerHelpers.sendError(res, 'Email is required', 400);
}

// Not found
if (!resource) {
  return ControllerHelpers.sendError(res, 'Resource not found', 404);
}

// Permission denied
if (user.role !== 'admin') {
  return ControllerHelpers.sendError(res, 'Insufficient permissions', 403);
}

// Internal error
throw new Error('Something went wrong');  // Caught by errorHandler middleware
```

**Custom Error Classes**:
```javascript
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Usage
throw new AppError('W-9 not verified', 403);
```

### Async/Await Best Practices

```javascript
// Always use try-catch or asyncWrapper
async function createOrder(req, res) {
  try {
    const order = await Order.create(req.body);
    res.json({ success: true, order });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

// Or use asyncWrapper
exports.createOrder = asyncWrapper(async (req, res) => {
  const order = await Order.create(req.body);
  ControllerHelpers.sendSuccess(res, { order }, 'Order created', 201);
});
```

### Environment Variables

**Never hardcode sensitive values**:
```javascript
// Bad
const jwtSecret = 'my-secret-key-123';

// Good
const jwtSecret = process.env.JWT_SECRET;
```

**Use SystemConfig for business values**:
```javascript
// Bad
const wdfRate = 1.25;

// Good
const wdfRate = await SystemConfig.getValue('wdf_base_rate_per_pound', 1.25);
```

### Logging

**Winston Logger**: `server/utils/logger.js`

```javascript
const logger = require('../utils/logger');

// Info logging
logger.info('Order created', { orderId: order.orderId, customerId: customer.customerId });

// Error logging
logger.error('Payment failed', {
  error: error.message,
  orderId: order.orderId,
  stack: error.stack
});

// Debug logging (only in development)
logger.debug('Processing order', { orderData });
```

**Audit Logger**: `server/utils/auditLogger.js`

```javascript
const { logAuditEvent, AuditEvents } = require('../utils/auditLogger');

// Security events
logAuditEvent(AuditEvents.AUTH_SUCCESS, { userId, role }, req);
logAuditEvent(AuditEvents.PASSWORD_CHANGED, { userId }, req);
logAuditEvent(AuditEvents.W9_VERIFIED, { affiliateId }, req);
```

### Documentation

**JSDoc Comments**:
```javascript
/**
 * Calculate delivery fee for an order
 * @param {number} numberOfBags - Number of bags in order
 * @param {Object} affiliate - Affiliate model instance
 * @returns {Object} Fee breakdown with totalFee, minimumFee, perBagFee
 */
function calculateDeliveryFee(numberOfBags, affiliate) {
  // Implementation
}
```

**README Updates**:
- Add new features to `README.md`
- Update API documentation
- Document configuration changes

---

## Testing Patterns

### Test Structure

**File Organization**:
```
tests/
├── unit/                      # Unit tests
│   ├── models/               # Model methods and validations
│   ├── utils/                # Utility function tests
│   └── services/             # Service logic tests
├── integration/               # Integration tests
│   ├── auth.test.js          # Authentication flows
│   ├── affiliates.test.js    # Affiliate endpoints
│   ├── customers.test.js     # Customer endpoints
│   └── orders.test.js        # Order endpoints
└── helpers/                   # Test utilities
    ├── testUtils.js          # Helper functions
    └── csrf.js               # CSRF token helpers
```

### Test Patterns

**Setup and Teardown**:
```javascript
describe('Affiliate Controller', () => {
  let mongoServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await Affiliate.deleteMany({});
    await SystemConfig.initializeDefaults();
  });

  // Tests...
});
```

**API Testing with Supertest**:
```javascript
const request = require('supertest');
const app = require('../server');

describe('POST /api/v1/affiliates/register', () => {
  it('should register a new affiliate', async () => {
    const response = await request(app)
      .post('/api/v1/affiliates/register')
      .send({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        password: 'SecurePass123!'
      })
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(response.body.affiliate).toHaveProperty('affiliateId');
  });

  it('should reject duplicate email', async () => {
    await Affiliate.create({ email: 'john@example.com', /* ... */ });

    const response = await request(app)
      .post('/api/v1/affiliates/register')
      .send({ email: 'john@example.com', /* ... */ })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.message).toContain('already exists');
  });
});
```

**CSRF Token Testing**:
```javascript
const { getCsrfToken } = require('./helpers/csrf');

it('should require CSRF token for state-changing operations', async () => {
  const agent = request.agent(app);
  const csrfToken = await getCsrfToken(agent);

  const response = await agent
    .post('/api/v1/affiliates/:id/change-password')
    .set('x-csrf-token', csrfToken)
    .send({ newPassword: 'NewPass123!' })
    .expect(200);
});
```

**Mocking External Services**:
```javascript
jest.mock('../services/emailService');
const emailService = require('../services/emailService');

beforeEach(() => {
  emailService.sendAffiliateWelcome.mockResolvedValue(true);
});

it('should send welcome email after registration', async () => {
  await createAffiliate({ email: 'test@example.com' });

  expect(emailService.sendAffiliateWelcome).toHaveBeenCalledWith(
    expect.objectContaining({ email: 'test@example.com' })
  );
});
```

**Test Factories**:
```javascript
// tests/helpers/testUtils.js
const createTestAffiliate = async (overrides = {}) => {
  return await Affiliate.create({
    firstName: 'Test',
    lastName: 'Affiliate',
    email: faker.internet.email(),
    username: faker.internet.userName(),
    passwordSalt: 'salt',
    passwordHash: 'hash',
    serviceRadius: 10,
    ...overrides
  });
};

const createTestCustomer = async (affiliateId, overrides = {}) => {
  return await Customer.create({
    customerId: `CUST-${uuidv4()}`,
    affiliateId,
    firstName: 'Test',
    lastName: 'Customer',
    email: faker.internet.email(),
    ...overrides
  });
};
```

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- tests/integration/affiliates.test.js

# Run in watch mode
npm test -- --watch

# Detect open handles
npm test -- --detectOpenHandles
```

**Current Coverage**: 86.16%

---

## Deployment & Operations

### PM2 Process Management

**Ecosystem Configuration**: `ecosystem.config.js`

```javascript
module.exports = {
  apps: [{
    name: 'wavemax',
    script: 'server.js',
    instances: 'max',           // Cluster mode (all CPU cores)
    exec_mode: 'cluster',
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production'
    }
  }]
};
```

**PM2 Commands**:
```bash
# Start application
pm2 start ecosystem.config.js

# Restart application
pm2 restart wavemax

# Stop application
pm2 stop wavemax

# View logs
pm2 logs wavemax --lines 50

# View status
pm2 status

# Monitor resources
pm2 monit

# Update environment variables
pm2 restart wavemax --update-env
```

### Environment Variables

**Required**:
```bash
# Core
NODE_ENV=production
PORT=3000

# Database
MONGODB_URI=mongodb+srv://...

# Security
JWT_SECRET=<64-char-random-string>
ENCRYPTION_KEY=<64-char-hex-string>
SESSION_SECRET=<64-char-random-string>
CSRF_SECRET=<64-char-random-string>

# OAuth
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
FACEBOOK_APP_ID=...
FACEBOOK_APP_SECRET=...

# Email
EMAIL_PROVIDER=smtp
EMAIL_HOST=mail.wavemax.promo
EMAIL_PORT=587
EMAIL_USER=no-reply@wavemax.promo
EMAIL_PASS=...

# Payment
PAYGISTIX_MERCHANT_ID=wmaxaustWEB

# DocuSign
DOCUSIGN_INTEGRATION_KEY=...
DOCUSIGN_USER_ID=...
DOCUSIGN_ACCOUNT_ID=...
```

### Logging

**Log Locations**:
- Application logs: `logs/combined.log`
- Error logs: `logs/error.log`
- Audit logs: `logs/audit.log`
- PM2 logs: `/root/.pm2/logs/wavemax-*.log`

**Log Levels**:
```bash
LOG_LEVEL=debug     # Development
LOG_LEVEL=info      # Staging
LOG_LEVEL=warn      # Production
```

### Database Initialization

**First-Time Setup**:
```bash
# Initialize SystemConfig defaults
npm run init-config

# Create default admin account
npm run create-admin
```

**Manual Initialization**:
```javascript
// In MongoDB shell or Node.js script
await SystemConfig.initializeDefaults();
await callbackPoolManager.initializePool();
```

### Nginx Configuration

**Reverse Proxy**:
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

### Monitoring

**Health Check Endpoint**:
```bash
GET /api/health

Response:
{
  status: 'ok',
  timestamp: '2025-01-16T10:30:00Z',
  uptime: 3600,
  database: 'connected'
}
```

**PM2 Monitoring**:
```bash
# Real-time monitoring
pm2 monit

# CPU and memory usage
pm2 list

# Process details
pm2 describe wavemax
```

---

## Common Pitfalls

### 1. Hardcoding Business Values

❌ **Bad**:
```javascript
const wdfRate = 1.25;
const deliveryFee = 25;
```

✅ **Good**:
```javascript
const wdfRate = await SystemConfig.getValue('wdf_base_rate_per_pound', 1.25);
const deliveryFee = affiliate.minimumDeliveryFee;
```

### 2. Inline Scripts in HTML

❌ **Bad**:
```html
<script>
  function handleClick() { /* ... */ }
</script>
<button onclick="handleClick()">Click</button>
```

✅ **Good**:
```html
<button id="myButton">Click</button>
<script src="/assets/js/handlers.js"></script>
```

### 3. Forgetting pageScripts Mapping

❌ **Bad**:
```html
<!-- Only in HTML file -->
<script src="/assets/js/my-feature.js"></script>
```

✅ **Good**:
```javascript
// In embed-app-v2.js
const pageScripts = {
  '/my-page': [
    '/assets/js/my-feature.js'
  ]
};
```

### 4. Not Testing in Embedded Context

❌ **Bad**: Only testing direct access (`/page.html`)

✅ **Good**: Test both:
- Direct: `https://wavemax.promo/page.html`
- Embedded: `https://wavemax.promo/embed-app-v2.html?route=/page`

### 5. Exposing Sensitive Data

❌ **Bad**:
```javascript
res.json({ user: affiliateDoc });  // Includes passwordHash
```

✅ **Good**:
```javascript
const { passwordHash, passwordSalt, ...safeData } = affiliateDoc.toObject();
res.json({ user: safeData });
```

### 6. Missing CSRF Tokens

❌ **Bad**:
```javascript
await fetch('/api/v1/affiliates/register', {
  method: 'POST',
  body: JSON.stringify(data)
});
```

✅ **Good**:
```javascript
const csrfToken = await getCsrfToken();
await fetch('/api/v1/affiliates/register', {
  method: 'POST',
  headers: { 'x-csrf-token': csrfToken },
  body: JSON.stringify(data)
});
```

### 7. Forgetting Language Translations

❌ **Bad**: Only updating English translations

✅ **Good**: Update all 4 languages:
```json
// en/common.json
"new.feature": "New Feature"

// es/common.json
"new.feature": "Nueva Función"

// pt/common.json
"new.feature": "Novo Recurso"

// de/common.json
"new.feature": "Neue Funktion"
```

### 8. Not Handling Floating-Point Precision

❌ **Bad**:
```javascript
expect(commission).toBe(281.25);  // Might be 281.2500000000001
```

✅ **Good**:
```javascript
expect(commission).toBeCloseTo(281.25, 2);
```

### 9. Missing Test Cleanup

❌ **Bad**:
```javascript
describe('Tests', () => {
  it('test 1', async () => {
    await Affiliate.create({ email: 'test@example.com' });
  });

  it('test 2', async () => {
    await Affiliate.create({ email: 'test@example.com' });  // Duplicate key error!
  });
});
```

✅ **Good**:
```javascript
describe('Tests', () => {
  beforeEach(async () => {
    await Affiliate.deleteMany({});
  });

  it('test 1', async () => { /* ... */ });
  it('test 2', async () => { /* ... */ });
});
```

### 10. Using Wrong Copyright Notice

❌ **Bad**: `© 2025 WaveMAX`

✅ **Good**: `© 2025 CRHS Enterprises, LLC. All rights reserved.`

---

## Quick Reference

### Project Commands

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Start production server
npm start

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests with memory optimization
npm run test:memory

# Initialize database
npm run init-config

# PM2 commands
pm2 start ecosystem.config.js
pm2 restart wavemax
pm2 logs wavemax
pm2 status
```

### Key File Paths

```
Server:
  Entry point:          server.js
  Models:               server/models/
  Controllers:          server/controllers/
  Routes:               server/routes/
  Middleware:           server/middleware/
  Services:             server/services/
  Utils:                server/utils/

Frontend:
  Entry point:          public/embed-app-v2.html
  Router:               public/assets/js/embed-app-v2.js
  Session manager:      public/assets/js/session-manager.js
  i18n:                 public/assets/js/i18n.js
  Translations:         public/locales/{lang}/common.json

Configuration:
  Environment:          .env
  PM2:                  ecosystem.config.js
  Passport OAuth:       server/config/passport-config.js
  CSRF:                 server/config/csrf-config.js

Documentation:
  Init prompt:          init.prompt
  Best practices:       docs/development/OPERATING_BEST_PRACTICES.md
  i18n guide:           docs/guides/i18n-best-practices.md
  This file:            .claude/claude.md
```

### Important URLs

```
Production:
  Main site:            https://www.wavemaxlaundry.com
  Affiliate app:        https://wavemax.promo
  Embedded iframe:      /austin-tx/wavemax-austin-affiliate

API Endpoints:
  Base URL:             https://wavemax.promo/api/v1
  Health check:         /api/health
  CSRF token:           /api/csrf-token

Payment:
  Paygistix:            https://safepay.paymentlogistics.net/transaction.asp

OAuth Callbacks:
  Google:               /api/v1/auth/google/callback
  Facebook:             /api/v1/auth/facebook/callback
  LinkedIn:             /api/v1/auth/linkedin/callback

DocuSign:
  Webhook:              /api/v1/w9/webhook/docusign
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

**Affiliate Registration**:
```
1. Register → 2. W-9 submission → 3. Admin verification → 4. Active
```

**Customer Registration V1**:
```
1. Register → 2. Paygistix payment → 3. Active with bagCredit
```

**Customer Registration V2**:
```
1. Register (no payment) → 2. Active with no bagCredit
```

**Order Lifecycle**:
```
pending → processing → processed → complete
```

**Bag Workflow**:
```
processing (weighed) → processed (WDF done) → completed (picked up)
```

**Payment V2 Flow**:
```
pending → awaiting → confirming → verified
```

---

## Session Startup Checklist

When starting a new development session:

- [ ] Review `init.prompt` for persona and expertise
- [ ] Review this file (`.claude/claude.md`)
- [ ] Check `git status` for uncommitted changes
- [ ] Review `docs/development/OPERATING_BEST_PRACTICES.md` for known issues
- [ ] Check for in-progress tasks in project logs
- [ ] Verify PM2 status: `pm2 status`
- [ ] Check recent logs: `tail -n 50 /root/.pm2/logs/wavemax-error.log`

---

**Ready to build, debug, and improve the WaveMAX codebase together!**

---

*Last updated: 2025-01-16 | Version: 2.0*
