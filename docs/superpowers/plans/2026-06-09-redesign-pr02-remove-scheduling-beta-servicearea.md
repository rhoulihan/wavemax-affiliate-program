# PR 2 — Remove Scheduling, Pickup Now, BetaRequest, ?affid, Service Area — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Delete the customer-scheduling/"Pickup Now" order-creation path, the BetaRequest onboarding gate, the `?affid` referral funnel, and per-affiliate service-area enforcement — pairing every deletion with its test deletions so the suite is green at every commit.

**Architecture:** This is a pure-removal PR (spec §7, §12 PR 2, §4.5/§4.6). Orders will be created at operator intake (PR 7), affiliates will be invite-only (PR 5), and customers will bind to affiliates via bag QR claim (PR 6) — so everything those flows replace is deleted now. Registration endpoints stay mounted but become *temporarily open* (affiliate register has no gate until PR 5's invite gate; the customer-register page loses its self-serve `?affid` binding and is effectively closed until PR 6's claim page replaces it). The `Order` model itself is **not** touched here — its scheduling/Pickup-Now fields (`pickupDate`, `pickupTime`, `isImmediatePickup`, `estimatedWeight`, …) are removed by PR 4's enum/schema redesign; PR 2 only deletes their *writers*.

**Tech Stack:** Node/Express + Mongoose, Jest + Supertest + MongoMemoryServer (`tests/setup.js` runs `SystemConfig.initializeDefaults()`), Winston logger, vanilla-JS embedded SPA (`public/assets/js/embed-app-v2.js` with `EMBED_PAGES` + `pageScripts` maps), i18n in `public/locales/{en,es,pt,de}/common.json`.

**Assumed starting state:** PR 1 (V1 Paygistix removal) is merged: `server/controllers/paymentController.js`, `server/routes/paymentRoutes.js`/`paymentCallbackRoute.js`/`generalPaymentCallback.js`, `server/models/Payment.js`/`PaymentToken.js`/`CallbackPool.js`, `server/services/callbackPoolManager.js`/`paygistix/`/`customerPaymentService.js`/`orderPaymentService.js`, and their `server.js` mounts/CSP entries are gone, with their tests. **None of the code quoted in this plan lives in those files** — every quote below was verified against the current tree. If a quoted line number has drifted a few lines, locate by the quoted code, never by the number alone.

**Working rules for this plan:**
- Strict TDD where there is observable behavior to pin (gate removal, 404s, schema-path removal): write the failing test, run it, watch it fail *for the right reason*, implement, watch it pass, commit.
- Pure deletions (whole files, frontend blocks) use the deletion format: delete → grep for dangling references (exact command given) → run the suite → commit.
- Run a targeted test file with: `npm test -- tests/integration/<file>.test.js`. Run the whole suite with `npm test` (must pass with no `--forceExit`).
- Commit after every task with the exact command given. Do **not** push.

---

## Task 1 — Open affiliate registration: delete the BetaRequest gate

The gate inside `registerAffiliate` 403s any email without a welcomed `BetaRequest` row. PR 5 adds the invite gate; until then **registration is deliberately open** (clean-slate redeploy, nothing in production).

**Files:**
- Create: `tests/integration/affiliateRegistrationOpen.test.js`
- Modify: `server/controllers/affiliateController.js` (delete lines ~124–137)
- Modify: `tests/unit/affiliateController.test.js` (remove BetaRequest mocks at ~127, ~207, ~247, ~297)
- Modify: `tests/integration/affiliate.test.js` (remove BetaRequest setup at ~61–74)
- Modify: `tests/integration/passwordValidation.test.js` (remove `ensureBetaRequest` helper ~17–36, cleanup ~43–44, call sites ~119–120 and ~814–815)

**Steps:**

- [ ] Write the failing test. Create `tests/integration/affiliateRegistrationOpen.test.js`:

```javascript
// PR 2: affiliate registration is temporarily OPEN — the BetaRequest gate is
// removed here; PR 5 replaces it with the invite gate (PR 5 Task 6.6b DELETES
// this file — its no-invite-201 purpose inverts when the gate lands).
const request = require('supertest');
const app = require('../../server');
const Affiliate = require('../../server/models/Affiliate');

describe('Affiliate registration without a beta request (gate removed)', () => {
  beforeEach(async () => {
    await Affiliate.deleteMany({});
  });

  it('registers an affiliate whose email has no BetaRequest row', async () => {
    const res = await request(app)
      .post('/api/v1/affiliates/register')
      .send({
        firstName: 'Open',
        lastName: 'Gate',
        email: 'open.gate@example.com',
        phone: '512-555-0100',
        businessName: 'Open Gate Laundry',
        address: '123 Congress Ave',
        city: 'Austin',
        state: 'TX',
        zipCode: '78701',
        // NOTE: service* fields still required by route validators until Task 10
        serviceLatitude: 30.2672,
        serviceLongitude: -97.7431,
        serviceRadius: 10,
        username: 'opengate',
        password: 'SecurePass123!',
        paymentMethod: 'check',
        languagePreference: 'en'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.affiliateId).toMatch(/^AFF-/);
  });
});
```

  If the request 400s on address validation, copy the exact passing payload shape from the `should register a new affiliate` test in `tests/integration/affiliate.test.js` (city `Austin` / state `TX` / zip `78701` are in the static service-area config and are known-good there).

- [ ] Run it and confirm it fails for the right reason — a 403 beta restriction, not a 400:
  `npm test -- tests/integration/affiliateRegistrationOpen.test.js`
  Expected failure: `expect(res.status).toBe(201)` received `403` (body contains `isBetaRestriction: true`).

- [ ] Implement: in `server/controllers/affiliateController.js`, delete this exact block (currently lines 124–137, just after the destructure of `req.body`):

```javascript
    // Beta validation: Check if email is associated with an invited beta user
    const BetaRequest = require('../models/BetaRequest');
    const betaRequest = await BetaRequest.findOne({ 
      email: email.toLowerCase(),
      welcomeEmailSent: true 
    });

    if (!betaRequest) {
      return res.status(403).json({
        success: false,
        message: 'We are currently in closed beta. Please check back in a few days or contact us if you believe you should have access.',
        isBetaRestriction: true
      });
    }
```

  (Leave the top-of-file `const BetaRequest = require('../models/BetaRequest');` at line 7 alone for now — `submitBetaRequest` still uses it; Task 2 removes both.)

- [ ] Run the new test again — expect pass: `npm test -- tests/integration/affiliateRegistrationOpen.test.js`

- [ ] Test surgery (the gate's old fixtures). In `tests/unit/affiliateController.test.js`, remove all four `BetaRequest` mock blocks of this shape (sites at ~127–132, ~207–212, ~247–252, ~297–298):

```javascript
      const BetaRequest = require('../../server/models/BetaRequest');
      BetaRequest.findOne = jest.fn().mockResolvedValue({
        email: 'john@example.com',
        welcomeEmailSent: true
      });
```

  At ~297 the mock is `BetaRequest.findOne = jest.fn().mockRejectedValue(new Error('Database error'));` — if the surrounding `it(...)` exists *only* to test the beta-gate DB error path, delete that whole `it` block; otherwise just delete the mock lines. Also delete any `it('… beta …')` cases that assert the 403/`isBetaRestriction` response (search the file for `isBetaRestriction` and `closed beta`).

- [ ] In `tests/integration/affiliate.test.js` delete the setup block at ~61–74 (`// Create beta request for the new affiliate …` through the closing `});` of `BetaRequest.create({...})`).

- [ ] In `tests/integration/passwordValidation.test.js` delete: the `ensureBetaRequest` helper (~17–36), the two lines `const BetaRequest = require('../../server/models/BetaRequest'); await BetaRequest.deleteMany({});` in `beforeEach` (~43–44), and every `await ensureBetaRequest(...)` call site (~119–120, ~814–815 — `grep -n ensureBetaRequest tests/integration/passwordValidation.test.js` to catch all).

- [ ] Run the touched suites:
  `npm test -- tests/unit/affiliateController.test.js tests/integration/affiliate.test.js tests/integration/passwordValidation.test.js tests/integration/affiliateRegistrationOpen.test.js`
  Expected: all pass.

- [ ] Commit:
  `git add server/controllers/affiliateController.js tests/integration/affiliateRegistrationOpen.test.js tests/unit/affiliateController.test.js tests/integration/affiliate.test.js tests/integration/passwordValidation.test.js && git commit -m "refactor(affiliate): open registration — remove BetaRequest gate (invite gate lands in PR5)"`

---

## Task 2 — Delete the public beta-request endpoint

**Files:**
- Create: `tests/integration/pr2RemovedRoutes.test.js`
- Modify: `server/controllers/affiliateController.js` (delete `submitBetaRequest` ~19–84 + `BetaRequest` import line 7)
- Modify: `server/routes/affiliateRoutes.js` (delete the beta-request route ~34–48)
- Modify: `server/config/csrf-config.js` (delete lines 139–140)

**Steps:**

- [ ] Write the failing test. Create `tests/integration/pr2RemovedRoutes.test.js` (this file grows across Tasks 2–8):

```javascript
// PR 2 removal regressions (spec §7 / §11 "Removal regressions").
// Every route deleted in this PR must 404 (or the static file must be gone).
const request = require('supertest');
const app = require('../../server');
const { getCsrfToken, createAgent } = require('../helpers/csrfHelper');

describe('PR 2 removed routes return 404', () => {
  // POST probes must carry a CSRF token: this same task deletes the
  // beta-request entries from csrf-config REGISTRATION_ENDPOINTS, after which
  // the global conditionalCsrf default-enforces the path. A tokenless POST
  // would 403 before routing and never reach the 404 handler. (Same trap
  // Task 6 dodges by using GET probes on /api/v1/orders.)
  let agent;
  let csrfToken;

  beforeAll(async () => {
    agent = createAgent(app);
    csrfToken = await getCsrfToken(app, agent);
  });

  it('POST /api/v1/affiliates/beta-request is gone', async () => {
    const res = await agent
      .post('/api/v1/affiliates/beta-request')
      .set('x-csrf-token', csrfToken)
      .send({
        firstName: 'A', lastName: 'B', email: 'x@y.com', phone: '1',
        address: '123 Test St', city: 'Austin', state: 'TX', zipCode: '78701'
      });
    expect(res.status).toBe(404);
  });
});
```

- [ ] Run it — `npm test -- tests/integration/pr2RemovedRoutes.test.js` — expected failure: received `200` (the endpoint currently accepts the request; the CSRF token is a no-op while the exemption is still in place), not 404. A `403` means the agent/`x-csrf-token` wiring is broken — fix the test before proceeding.

- [ ] Implement. In `server/routes/affiliateRoutes.js` delete the whole block (currently lines 34–48):

```javascript
/**
 * @route   POST /api/affiliates/beta-request
 * @desc    Submit a beta program request
 * @access  Public
 */
router.post('/beta-request', registrationLimiter, [
  body('firstName').notEmpty().withMessage('First name is required'),
  body('lastName').notEmpty().withMessage('Last name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('phone').notEmpty().withMessage('Phone number is required'),
  body('address').notEmpty().withMessage('Address is required'),
  body('city').notEmpty().withMessage('City is required'),
  body('state').notEmpty().isLength({ min: 2, max: 2 }).withMessage('State is required'),
  body('zipCode').notEmpty().matches(/^\d{5}$/).withMessage('Valid ZIP code is required')
], handleValidationErrors, affiliateController.submitBetaRequest);
```

- [ ] In `server/controllers/affiliateController.js` delete the whole `submitBetaRequest` export (lines ~19–84, from `/** Submit a beta program request */` through its closing `};`) **and** the now-unused import at line 7: `const BetaRequest = require('../models/BetaRequest');`

- [ ] In `server/config/csrf-config.js` delete these two array entries (lines 139–140 inside `REGISTRATION_ENDPOINTS`):

```javascript
    '/api/v1/affiliates/beta-request',
    '/api/affiliates/beta-request',
```

- [ ] Run: `npm test -- tests/integration/pr2RemovedRoutes.test.js tests/unit/csrfConfig.test.js` — expected: pass (csrfConfig.test.js has no beta-request assertions; running it guards the edit). The beta-request probe still reaches the 404 handler post-exemption-removal **only because it sends `x-csrf-token`** — if it 403s here, the test's CSRF wiring regressed.

- [ ] Grep for dangling references to the route:
  `grep -rn "beta-request" server/ --include="*.js"` → expected **0** hits.
  (`public/` still hits — frontend goes in Tasks 3–4.)

- [ ] Commit:
  `git add server/routes/affiliateRoutes.js server/controllers/affiliateController.js server/config/csrf-config.js tests/integration/pr2RemovedRoutes.test.js && git commit -m "refactor(affiliate): delete public beta-request endpoint and CSRF entries"`

---

## Task 3 — Delete the admin beta endpoints, betaRequestService, and the admin-dashboard beta UI

**Files:**
- Create: `tests/unit/pr2Removals.test.js`
- Modify: `server/controllers/administratorController.js` (delete handlers ~745–812 + imports at lines 11 and 23)
- Modify: `server/routes/administratorRoutes.js` (delete lines 117–121)
- Delete: `server/services/betaRequestService.js`
- Modify: `server/utils/auditLogger.js` (delete line 85)
- Modify: `public/assets/js/administrator-dashboard-init.js` (beta subtab hooks ~172–174, beta functions ~3299–3560)
- Modify: `public/administrator-dashboard-embed.html` (subtab button line 42, subtab content ~152–160)
- Modify: `public/locales/{en,es,pt,de}/common.json` (remove `administrator.dashboard.subtabs.betaRequests`)

**Steps:**

- [ ] Write the failing test. Create `tests/unit/pr2Removals.test.js` (admin routes sit behind a router-level `router.use(authenticate)`, so an unauthenticated 404 probe can't distinguish removed-vs-present — assert at module level instead; Express itself enforces that no route references a deleted handler, because `router.get(path, undefined)` throws at app load):

```javascript
// PR 2 module-level removal regressions. Express guarantees the route table
// can't reference a deleted handler (Route.get() throws at load), so handler
// absence + module absence is sufficient here.
describe('PR 2 — beta program code removed', () => {
  it('administratorController no longer exports beta handlers', () => {
    const administratorController = require('../../server/controllers/administratorController');
    expect(administratorController.getBetaRequests).toBeUndefined();
    expect(administratorController.sendBetaWelcomeEmail).toBeUndefined();
    expect(administratorController.sendBetaReminderEmail).toBeUndefined();
    expect(administratorController.checkAffiliateExists).toBeUndefined();
  });

  it('betaRequestService module is deleted', () => {
    expect(() => require('../../server/services/betaRequestService')).toThrow();
  });
});
```

- [ ] Run it — `npm test -- tests/unit/pr2Removals.test.js` — expected failures: handlers are defined functions; `require` resolves.

- [ ] Implement. In `server/routes/administratorRoutes.js` delete (lines 117–121):

```javascript
// Beta Request Management
router.get('/beta-requests', administratorController.getBetaRequests);
router.post('/beta-requests/:id/send-welcome', administratorController.sendBetaWelcomeEmail);
router.get('/check-affiliate-exists', administratorController.checkAffiliateExists);
router.post('/beta-requests/:id/send-reminder', administratorController.sendBetaReminderEmail);
```

- [ ] In `server/controllers/administratorController.js` delete the four exports `getBetaRequests`, `sendBetaWelcomeEmail`, `checkAffiliateExists`, `sendBetaReminderEmail` (the contiguous region from `/** Get all beta requests */` at ~742 through the final `};` at ~812 — it is the end of the file region quoted in planning), plus the imports:
  - line 11: `const BetaRequest = require('../models/BetaRequest');`
  - line 23: `const betaRequestService = require('../services/betaRequestService');`

- [ ] Delete the service: `git rm server/services/betaRequestService.js`

- [ ] In `server/utils/auditLogger.js` delete line 85: `  ADMIN_SENT_BETA_WELCOME: 'ADMIN_SENT_BETA_WELCOME',` (note: `ADMIN_SENT_BETA_REMINDER` was referenced by the deleted service but never defined in `AuditEvents` — nothing else to remove).

- [ ] Run: `npm test -- tests/unit/pr2Removals.test.js tests/unit/administratorControllerEnhanced.test.js` — expected: pass. If `administratorControllerEnhanced.test.js` has beta-handler cases, delete those `describe`/`it` blocks (search it for `Beta`).

- [ ] Frontend. In `public/administrator-dashboard-embed.html` delete the subtab button (line 42):

```html
                <button class="sub-nav-tab" data-subtab="beta-requests" data-i18n="administrator.dashboard.subtabs.betaRequests">Beta Requests</button>
```

  and the whole `<div class="sub-tab-content" id="beta-requests-subtab">…</div>` block starting at line 152 (contains `betaRequestsList`).

- [ ] In `public/assets/js/administrator-dashboard-init.js` delete:
  - the subtab dispatch at ~172–174:
    ```javascript
        if (targetSubTab === 'beta-requests' && typeof loadBetaRequests === 'function') {
          loadBetaRequests();
        }
    ```
  - the beta function region ~3299–3560: `loadBetaRequests()`, `renderBetaRequests()`, the send-welcome handler (fetch to `/beta-requests/${requestId}/send-welcome` ~3489), the send-reminder handler (~3513), and the `refreshBetaRequestsBtn` listener branch (~3546). Use `grep -n "BetaRequest\|betaRequest\|beta-request" public/assets/js/administrator-dashboard-init.js` and remove every hit plus its enclosing function/branch.

- [ ] Remove the i18n key `administrator.dashboard.subtabs.betaRequests` from **all four** locale files (en line ~891; find the same path in es/pt/de): `grep -n "betaRequests" public/locales/*/common.json`.

- [ ] Verify zero dangling references:
  `grep -rn "betaRequest\|beta-request\|BetaRequest" server/ public/assets/js/administrator-dashboard-init.js public/administrator-dashboard-embed.html public/locales/ --include="*.js" --include="*.html" --include="*.json" | grep -v "models/BetaRequest.js" | grep -v "dispatcher/beta.js"` → expected **0** hits (the model + dispatcher fall in Task 4).

- [ ] Run the full suite: `npm test` — expected: green.

- [ ] Commit:
  `git add -A server/ public/administrator-dashboard-embed.html public/assets/js/administrator-dashboard-init.js public/locales/ tests/unit/pr2Removals.test.js && git commit -m "refactor(admin): delete beta-request management (endpoints, service, dashboard UI, audit event)"`

## Task 4 — Relocate shared email senders, delete `dispatcher/beta.js`, the `BetaRequest` model, and the landing beta modal

`server/services/email/dispatcher/beta.js` exports two functions that are **not** beta concerns and have live consumers: `sendAdminNotification` (used by `server/services/paymentEmailScanner.js:572` — the kept V2 stack) and `sendMarketingEmail` (used by `server/controllers/marketingController.js:83`). Move them, then delete the file. Two latent path bugs get fixed by the move (both `require`/`path.join` calls in beta.js resolve relative to the dispatcher directory and point at non-existent paths):
- `sendAdminNotification` does `require('../models/SystemConfig')` → must be `require('../../../models/SystemConfig')`.
- `sendMarketingEmail` does `path.join(__dirname, '../templates/emails/marketing', …)` → must be `path.join(__dirname, '../../../../server/templates/emails/marketing', …)` — simpler: `path.join(__dirname, '../../../templates/emails/marketing', …)` (dispatcher dir → `server/services/email/dispatcher`, three `..` = `server/`, then `templates/emails/marketing`).

**Files:**
- Create: `tests/unit/emailDispatcherRelocation.test.js`
- Create: `server/services/email/dispatcher/marketing.js`
- Modify: `server/services/email/dispatcher/admin.js` (append `sendAdminNotification`)
- Modify: `server/services/email/dispatcher/index.js` (swap `beta` for `marketing`)
- Delete: `server/services/email/dispatcher/beta.js`, `server/models/BetaRequest.js`, `tests/unit/betaRequest.test.js`, `public/assets/js/beta-request-modal.js`
- Modify: `public/assets/js/embed-app-v2.js` (pageScripts `/` and `/landing` entries, lines 586–587)
- Modify: `public/embed-landing.html` (script tag line 339, `joinBetaBtn` CTA lines 246–248)
- Modify: `public/locales/{en,es,pt,de}/common.json` (`landing.cta.createAccount` copy)

**Steps:**

- [ ] Write the failing test. Create `tests/unit/emailDispatcherRelocation.test.js`:

```javascript
// PR 2: beta dispatcher deleted; the two shared senders it carried are relocated.
describe('email dispatcher after beta removal', () => {
  it('no longer exports the beta senders', () => {
    const emailService = require('../../server/utils/emailService');
    expect(emailService.sendBetaRequestNotification).toBeUndefined();
    expect(emailService.sendBetaInvitationEmail).toBeUndefined();
    expect(emailService.sendBetaWelcomeEmail).toBeUndefined();
    expect(emailService.sendBetaReminderEmail).toBeUndefined();
  });

  it('still exports the relocated shared senders', () => {
    const emailService = require('../../server/utils/emailService');
    expect(typeof emailService.sendAdminNotification).toBe('function');
    expect(typeof emailService.sendMarketingEmail).toBe('function');
  });

  it('BetaRequest model is deleted', () => {
    expect(() => require('../../server/models/BetaRequest')).toThrow();
  });
});
```

- [ ] Run it — `npm test -- tests/unit/emailDispatcherRelocation.test.js` — expected failures: beta senders are defined; `BetaRequest` resolves.

- [ ] Implement the moves. Append to `server/services/email/dispatcher/admin.js` (verbatim move from beta.js lines 11–67, with the one-line require fix):

```javascript
/**
 * Send notification to admin
 * @param {Object} options - Email options
 * @param {String} options.subject - Email subject
 * @param {String} options.html - HTML content
 * @param {String} options.priority - Email priority (high, normal, low)
 * @returns {Promise<Boolean>}
 */
exports.sendAdminNotification = async function(options) {
  try {
    const { subject, html, priority = 'normal' } = options;

    // Get admin email from SystemConfig or use default
    const SystemConfig = require('../../../models/SystemConfig');
    let adminEmail = await SystemConfig.getValue('admin_notification_email', null);

    if (!adminEmail) {
      adminEmail = process.env.ADMIN_EMAIL || 'admin@wavemaxlaundry.com';
    }

    const headers = priority === 'high' ? {
      'X-Priority': '1',
      'Importance': 'high'
    } : {};

    const fullHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            h2 { color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px; }
            h3 { color: #34495e; margin-top: 20px; }
            ul { background: #f4f4f4; padding: 15px; border-radius: 5px; }
            li { margin: 5px 0; }
            .alert { background: #fff3cd; border: 1px solid #ffc107; padding: 15px; border-radius: 5px; margin: 20px 0; }
            .error { background: #f8d7da; border: 1px solid #dc3545; }
            hr { border: none; border-top: 1px solid #ddd; margin: 30px 0; }
          </style>
        </head>
        <body>
          ${html}
        </body>
      </html>
    `;

    await sendEmail(adminEmail, subject, fullHtml, headers);

    logger.info(`Admin notification sent: ${subject}`);
    return true;
  } catch (error) {
    logger.error('Error sending admin notification:', error);
    throw error;
  }
};
```

  `admin.js` already has `logger` and `sendEmail` in scope (lines 1 and 6) — do not re-require them.

- [ ] Create `server/services/email/dispatcher/marketing.js` (verbatim move of `sendMarketingEmail` from beta.js lines 467–523, with the template-path fix):

```javascript
// Marketing email dispatcher. Extracted from dispatcher/beta.js when the
// beta program was removed (PR 2) — marketing outreach is not a beta concern.

const { fillTemplate } = require('../template-manager');
const { sendEmail } = require('../transport');
const fs = require('fs');
const path = require('path');
const logger = require('../../../utils/logger');

/**
 * Send marketing email
 * @param {string} recipientEmail - Recipient's email address
 * @param {string} recipientName - Recipient's name
 * @param {string} templateType - Type of marketing email (e.g., 'healthcare-catering-outreach')
 */
exports.sendMarketingEmail = async (recipientEmail, recipientName, templateType = 'healthcare-catering-outreach') => {
  try {
    logger.info(`[sendMarketingEmail] Sending ${templateType} email to:`, recipientEmail);

    if (!recipientEmail) {
      throw new Error('Recipient email address is required');
    }
    if (!recipientName) {
      throw new Error('Recipient name is required');
    }

    // Load the marketing email template (server/templates/emails/marketing)
    const templatePath = path.join(__dirname, '../../../templates/emails/marketing', `${templateType}.html`);
    let template;
    try {
      template = await fs.promises.readFile(templatePath, 'utf8');
    } catch (error) {
      logger.error(`Error loading marketing template ${templateType}:`, error);
      throw new Error(`Marketing template '${templateType}' not found`);
    }

    const html = fillTemplate(template, { recipientName });

    const subjects = {
      'healthcare-catering-outreach': 'Hospital-Quality Laundry Service for Your Business - WaveMAX Laundry'
    };
    const subject = subjects[templateType] || 'WaveMAX Laundry Services';

    await sendEmail(recipientEmail, subject, html);

    logger.info(`Marketing email (${templateType}) sent successfully to:`, recipientEmail);
    return { success: true, recipient: recipientEmail, templateType };
  } catch (error) {
    logger.error('Error sending marketing email:', error);
    throw error;
  }
};

module.exports = exports;
```

- [ ] In `server/services/email/dispatcher/index.js` replace the beta wiring. Change line 16 `const beta = require('./beta');` to `const marketing = require('./marketing');`, and in the `module.exports` spread change `...beta,` to `...marketing,`. Also update the file-header comment list (`…, payment, beta` → `…, payment, marketing`).

- [ ] Delete the dead files:
  `git rm server/services/email/dispatcher/beta.js server/models/BetaRequest.js tests/unit/betaRequest.test.js`

- [ ] Run — expect pass: `npm test -- tests/unit/emailDispatcherRelocation.test.js tests/unit/paymentEmailScanner.test.js` (the scanner test exercises `sendAdminNotification`'s import path indirectly).

- [ ] Frontend: delete the landing beta modal.
  - `git rm public/assets/js/beta-request-modal.js`
  - In `public/assets/js/embed-app-v2.js` remove `'/assets/js/beta-request-modal.js'` from **both** the `'/'` (line 586) and `'/landing'` (line 587) `pageScripts` arrays.
  - In `public/embed-landing.html` delete line 339 (`<script src="/assets/js/beta-request-modal.js"></script>`) and the comment line above it (`<!-- Beta Request Modal -->`), and rewire the CTA at lines 246–248. Replace:

    ```html
                                    <button id="joinBetaBtn" class="btn btn-primary-custom">
                                        <i class="fas fa-user-plus me-2"></i><span data-i18n="landing.cta.createAccount">Join Beta Program</span>
                                    </button>
    ```

    with a plain navigation link (no modal, no inline JS — strict CSP, the SPA router handles `?route=`):

    ```html
                                    <a id="joinBetaBtn" href="/embed-app-v2.html?route=/affiliate-register" class="btn btn-primary-custom">
                                        <i class="fas fa-user-plus me-2"></i><span data-i18n="landing.cta.createAccount">Become an Affiliate</span>
                                    </a>
    ```

    > **Lifespan note:** this open-registration CTA is correct only for the PR 2→PR 5 window. PR 5 Task 7.8b retires it (registration becomes invite-only; the link without `?invite=` would dead-end on the invalid-invitation notice) and replaces it with invitation-only copy + the `landing.cta.inviteOnly` key.

- [ ] i18n (same commit — house rule): update `landing.cta.createAccount` in **all four** locale files to the non-beta copy:
  - en: `"Become an Affiliate"`
  - es: `"Conviértete en afiliado"`
  - pt: `"Torne-se um afiliado"`
  - de: `"Werden Sie Partner"`
  Locate with `grep -n "createAccount" public/locales/*/common.json`.

- [ ] Final grep for this task — expected **0** hits:
  `grep -rn "BetaRequest\|sendBeta\|beta-request\|betaRequest" server/ public/assets/js/ public/embed-landing.html tests/ --include="*.js" --include="*.html"`

- [ ] Full suite: `npm test` — green.

- [ ] Commit:
  `git add -A && git commit -m "refactor(email): relocate sendAdminNotification/sendMarketingEmail, delete beta dispatcher + BetaRequest model + landing beta modal"`

---

## Task 5 — Delete affiliate scheduling (routes, controller, dashboard schedule tab)

**Files:**
- Modify: `tests/integration/pr2RemovedRoutes.test.js` (add schedule 404 test)
- Delete: `server/routes/affiliateScheduleRoutes.js`, `server/controllers/affiliateScheduleController.js`
- Modify: `server.js` (delete lines 24 and 945)
- Delete: `tests/integration/affiliateSchedule.test.js`, `tests/unit/affiliateSchedule.test.js`
- Delete: `public/assets/js/affiliate-schedule.js`
- Modify: `public/assets/js/embed-app-v2.js` (remove `/assets/js/affiliate-schedule.js` from the `/affiliate-dashboard` pageScripts entry, line 596)
- Modify: `public/affiliate-dashboard-embed.html` (schedule tab button line 104, `#schedule-tab` content block from line 289, script tag line 523)
- Modify: `public/locales/{en,es,pt,de}/common.json` (remove `affiliate.dashboard.tabs.schedule` + the `affiliate.dashboard.schedule.*` group)

**Steps:**

- [ ] Write the failing test. Append to the `describe` in `tests/integration/pr2RemovedRoutes.test.js`:

```javascript
  it('GET /api/v1/affiliates/:affiliateId/schedule is gone', async () => {
    // Route had per-route `authenticate`: before removal an anonymous request
    // gets 401; after removal nothing matches the two-segment path → global 404.
    const res = await request(app).get('/api/v1/affiliates/AFF-test/schedule');
    expect(res.status).toBe(404);
  });
```

- [ ] Run — `npm test -- tests/integration/pr2RemovedRoutes.test.js` — expected failure: received `401` (authenticate middleware on the still-existing route).

- [ ] Implement. In `server.js` delete line 24:

```javascript
const affiliateScheduleRoutes = require('./server/routes/affiliateScheduleRoutes');
```

  and line 945:

```javascript
apiV1Router.use('/affiliates', affiliateScheduleRoutes);  // Affiliate schedule management
```

- [ ] Delete the backend files and their suites:
  `git rm server/routes/affiliateScheduleRoutes.js server/controllers/affiliateScheduleController.js tests/integration/affiliateSchedule.test.js tests/unit/affiliateSchedule.test.js`

- [ ] Run — expect pass: `npm test -- tests/integration/pr2RemovedRoutes.test.js`

- [ ] Frontend. Delete the page script and its registrations:
  - `git rm public/assets/js/affiliate-schedule.js`
  - In `public/assets/js/embed-app-v2.js` line 596 (`'/affiliate-dashboard'` pageScripts array): remove the `'/assets/js/affiliate-schedule.js',` entry. Leave the leaflet/service-area entries — Task 11 handles those.
  - In `public/affiliate-dashboard-embed.html`: delete the tab button (line 104) `<button class="tab-btn …" data-tab="schedule" data-i18n="affiliate.dashboard.tabs.schedule">Schedule</button>`; delete the whole `<div class="tab-content" id="schedule-tab">…</div>` block starting at line 289 (it contains `scheduleCalendar`, `editTemplateBtn`/`blockDateBtn`/`scheduleSettingsBtn` and the legend); delete line 523 `<script src="/assets/js/affiliate-schedule.js"></script>` and the `<!-- Schedule management -->` comment above it. Then `grep -n "schedule" public/affiliate-dashboard-embed.html` and remove any leftover schedule-modal markup whose element ids appear **only** in the deleted `affiliate-schedule.js` (weekly-template / block-date / settings modals if present below the tab block).

- [ ] i18n: remove `affiliate.dashboard.tabs.schedule` and the whole `affiliate.dashboard.schedule` object from all four locale files (`grep -n '"schedule"' public/locales/*/common.json`; en hits at ~517 and ~520).

- [ ] Grep for dangling references — expected **0** hits:
  `grep -rn "affiliateSchedule\|affiliate-schedule\|availabilitySchedule" server/ server.js public/assets/js/ public/affiliate-dashboard-embed.html --include="*.js" --include="*.html" | grep -v "models/Affiliate.js"`
  (`models/Affiliate.js` still defines `availabilitySchedule` — removed in Task 9. `server/controllers/orderController.js` also still references it in `createOrder` — deleted in Task 6; if the grep shows that hit, it is expected until Task 6 lands.)

- [ ] Full suite: `npm test` — green.

- [ ] Commit:
  `git add -A && git commit -m "refactor(schedule): delete affiliate availability scheduling (routes, controller, dashboard tab, tests)"`

## Task 6 — Delete customer order creation, Pickup Now, and check-active (backend)

Order creation moves to operator intake in PR 7. Delete `createOrder` (customer path), `createImmediateOrder`, `checkImmediateAvailability`, `checkActiveOrders`, their routes/validators, and the `orderImmediatePickupHours` service. `orderController`'s other exports (`getOrderDetails`, `updateOrderStatus`, `cancelOrder`, `exportOrders`, `searchOrders`, `getOrderStatistics`, `bulkUpdateOrderStatus`, `bulkCancelOrders`, `updatePaymentStatus`, `confirmPayment`, `verifyPaymentManually`) stay.

**Files:**
- Modify: `tests/integration/pr2RemovedRoutes.test.js`, `tests/unit/pr2Removals.test.js`
- Modify: `server/controllers/orderController.js` (delete ~27–242 and ~1043–1296 + line 18 import)
- Modify: `server/routes/orderRoutes.js` (delete lines 10–57)
- Delete: `server/services/orderImmediatePickupHours.js`
- Delete: `tests/integration/immediate-pickup.test.js`, `tests/integration/orderScheduleValidation.test.js`, `tests/frontend/schedulePickupAddOns.test.js`
- Modify: `tests/integration/order.test.js`, `tests/integration/orderAddOns.test.js`, `tests/integration/wdfCreditIntegration.test.js`, `tests/integration/wdfCreditSimple.test.js`, `tests/unit/orderControllerAdditional.test.js`

**Steps:**

- [ ] Write the failing tests. Append to `tests/integration/pr2RemovedRoutes.test.js` (GET routes use per-route `authenticate`, so anonymous = 401 before / 404 after; avoid POST probes here — `/api/v1/orders` is in the CSRF `CRITICAL_ENDPOINTS` list and would 403 on CSRF before routing):

```javascript
  it('GET /api/v1/orders/check-active is gone', async () => {
    const res = await request(app).get('/api/v1/orders/check-active');
    expect(res.status).toBe(404);
  });

  it('GET /api/v1/orders/immediate/availability is gone', async () => {
    const res = await request(app).get('/api/v1/orders/immediate/availability');
    expect(res.status).toBe(404);
  });
```

  And append to `tests/unit/pr2Removals.test.js`:

```javascript
  it('orderController no longer exports the customer-creation / Pickup Now handlers', () => {
    const orderController = require('../../server/controllers/orderController');
    expect(orderController.createOrder).toBeUndefined();
    expect(orderController.createImmediateOrder).toBeUndefined();
    expect(orderController.checkImmediateAvailability).toBeUndefined();
    expect(orderController.checkActiveOrders).toBeUndefined();
  });

  it('orderImmediatePickupHours service is deleted', () => {
    expect(() => require('../../server/services/orderImmediatePickupHours')).toThrow();
  });
```

- [ ] Run both files — expected failures: 401s (routes exist), handlers defined, service resolves.
  `npm test -- tests/integration/pr2RemovedRoutes.test.js tests/unit/pr2Removals.test.js`

- [ ] Implement. In `server/routes/orderRoutes.js` delete lines 10–57 — the four route blocks for `GET /check-active`, `GET /immediate/availability`, `POST /immediate` (with its validator array), and `POST /` (with its validator array). The first remaining route must be `GET /export` (line 64's block).

- [ ] In `server/controllers/orderController.js` delete:
  - `exports.checkActiveOrders` (lines ~24–57, from `/** Check if customer has active orders */`),
  - `exports.createOrder` (lines ~59–242, from `/** Create a new order */` through `}, 'Pickup scheduled successfully!', 201);` + closing `});`),
  - the entire Immediate-Pickup region (lines ~1043–1296): the banner comment, the `require('../services/orderImmediatePickupHours')` destructure, `exports._getCurrentCDTTime`, `exports.checkImmediateAvailability`, `exports.createImmediateOrder`. Keep the trailing `module.exports = exports;`.
  - line 18 `const { calculateDeliveryFee } = require('../services/orderPricingService');` — its only call sites were lines 169 and 1206, both deleted. Verify: `grep -n calculateDeliveryFee server/controllers/orderController.js` → 0 hits.

- [ ] Delete the service: `git rm server/services/orderImmediatePickupHours.js`

- [ ] Run — expect pass: `npm test -- tests/integration/pr2RemovedRoutes.test.js tests/unit/pr2Removals.test.js`

- [ ] Test surgery — delete suites coupled to removed behavior:
  `git rm tests/integration/immediate-pickup.test.js tests/integration/orderScheduleValidation.test.js tests/frontend/schedulePickupAddOns.test.js`

- [ ] Test surgery — `tests/unit/orderControllerAdditional.test.js`: delete `describe('checkActiveOrders', …)` (line 51 through its closing brace, before `describe('createOrder error handling'` at 138) and `describe('createOrder error handling', …)` (line 138 through its closing brace, before `describe('exportOrders'` at 159). The remaining describes (`exportOrders`, `updateOrderStatus edge cases`, `cancelOrder method`, `updatePaymentStatus`, `bulkUpdateOrderStatus`) stay.

- [ ] Test surgery — `tests/integration/order.test.js`:
  - Delete `describe('POST /api/v1/orders', …)` (lines 97–240).
  - Convert the four remaining `.post('/api/v1/orders')` call sites (lines ~1076, ~1118, ~1188, ~1232 — all inside `describe('Commission Calculation Tests')`) to direct model creation. The commission math lives in the Order pre-save, so it still runs on `.save()`. Replacement pattern for each (carry over the exact payload fields the call sent):

    ```javascript
      // Order creation API removed in PR 2 (orders are created at operator
      // intake from PR 7); create directly — pre-save still computes pricing.
      const order = new Order({
        customerId: 'CUST123',
        affiliateId: 'AFF123',
        pickupDate: new Date('2025-05-26'),
        pickupTime: 'morning',
        estimatedWeight: 30,
        numberOfBags: 2,
        feeBreakdown: { numberOfBags: 2, minimumFee: 25, perBagFee: 5, totalFee: 25, minimumApplied: true },
        status: 'pending',
        paymentStatus: 'pending'
      });
      await order.save();
    ```

    Note the controller used to spread `calculateDeliveryFee` into `feeBreakdown` — the pre-save reads `feeBreakdown.totalFee`, it does not compute it, so each converted site must set `feeBreakdown` explicitly to match what the test's affiliate fees imply (for the "high delivery fee" case at ~1232: `minimumFee: 50, perBagFee: 10`, `totalFee: Math.max(50, bags * 10)`). Re-derive the expected commission assertions only if a converted fixture changes the fee inputs — keep the existing `toBeCloseTo` expectations as the source of truth and make the fixture satisfy them.

- [ ] Test surgery — `tests/integration/orderAddOns.test.js`: delete `describe('POST /api/orders - Create Order with Add-ons', …)` (lines 94–264) and `describe('Order with Add-ons and WDF Credit', …)` (line 320 to end of describe — credit application at creation is removed behavior; it returns at intake in PR 7). Keep `describe('GET /api/orders/:orderId - Retrieve Order with Add-ons', …)` (265–319), converting its fixture creation to a direct `new Order({ …, addOns: { premiumDetergent: true, … }, feeBreakdown: {…} }).save()` using the same pattern as above if it currently POSTs.

- [ ] Test surgery — `tests/integration/wdfCreditIntegration.test.js`: the end-to-end describes assert *application at creation* (removed) plus *generation at weighing* (kept until PR 4). Delete the `it`s that assert credit application/reset on order creation (`create order → … → apply to next order` at 151, the API-creation parts of 240); convert generation-at-weighing assertions to fixtures created via `Order.create`. If after surgery the file only restates what `tests/unit/wdfCredit.test.js` and `tests/integration/wdfCreditSimple.test.js` already cover, delete the whole file with a note in the commit body.

- [ ] Test surgery — `tests/integration/wdfCreditSimple.test.js`: delete `it('should apply WDF credit when creating new order', …)` (line 101). Convert its single `.post('/api/v1/orders')` fixture (if shared by other `it`s) to `Order.create` per the pattern above. Keep the dashboard/details/calculation cases.

- [ ] Full suite: `npm test` — green. Triage any straggler the greps below reveal:
  `grep -rn "checkActiveOrders\|createImmediateOrder\|checkImmediateAvailability\|orderImmediatePickupHours\|_getCurrentCDTTime" server/ tests/ --include="*.js"` → expected **0** hits.
  `grep -rn "orders/immediate\|check-active" server/ tests/ --include="*.js"` → expected **0** hits (frontend hits remain until Task 7).

- [ ] Commit:
  `git add -A && git commit -m "refactor(orders): delete customer order creation, Pickup Now, and check-active (moves to operator intake in PR7)"`

---

## Task 7 — Delete the schedule-pickup page and the customer-dashboard Pickup Now UI

**Files:**
- Modify: `tests/integration/pr2RemovedRoutes.test.js`
- Delete: `public/schedule-pickup-embed.html`, `public/assets/js/schedule-pickup-embed.js`, `public/assets/js/schedule-pickup-v2.js.deprecated`
- Modify: `public/assets/js/embed-app-v2.js` (EMBED_PAGES line 61, pageScripts line 604, legacy mapping lines 93–97)
- Modify: `public/assets/js/customer-dashboard.js` (schedulePickupBtn block 82–106, availability call 138–139, Pickup Now region ~676–995, window exports at EOF)
- Modify: `public/customer-dashboard-embed.html` (pickupNowContainer block from line 68, schedulePickupBtn anchor at ~75, pickupNowModal block from line 97)
- Modify: `public/locales/{en,es,pt,de}/common.json` (orphaned pickup keys)

**Steps:**

- [ ] Write the failing test. Append to `tests/integration/pr2RemovedRoutes.test.js`:

```javascript
  it('schedule-pickup-embed.html is gone', async () => {
    const res = await request(app).get('/schedule-pickup-embed.html');
    expect(res.status).toBe(404);
  });
```

- [ ] Run — expected failure: received `200` (static file still served).

- [ ] Implement. Delete the page + scripts:
  `git rm public/schedule-pickup-embed.html public/assets/js/schedule-pickup-embed.js public/assets/js/schedule-pickup-v2.js.deprecated`

- [ ] In `public/assets/js/embed-app-v2.js`:
  - Delete EMBED_PAGES line 61: `    '/schedule-pickup': '/schedule-pickup-embed.html',`
  - Delete pageScripts line 604: `        '/schedule-pickup': ['/assets/js/i18n.js', '/assets/js/language-switcher.js', '/assets/js/csrf-utils.js', '/assets/js/modal-utils.js', '/assets/js/swirl-spinner.js', '/assets/js/api-client.js', '/assets/js/schedule-pickup-embed.js'],`
  - Rewrite the legacy email-link mapping (lines 92–99). Replace:

    ```javascript
        if (loginType === 'customer') {
            // Check if pickup parameter is also present
            if (params.get('pickup') === 'true') {
                route = '/schedule-pickup';
                console.log('Mapped login=customer&pickup=true to /schedule-pickup');
            } else {
                route = '/customer-login';
            }
        } else if (loginType === 'affiliate') {
    ```

    with:

    ```javascript
        if (loginType === 'customer') {
            route = '/customer-login';
        } else if (loginType === 'affiliate') {
    ```

- [ ] In `public/assets/js/customer-dashboard.js`:
  - Delete the `schedulePickupBtn` wiring (lines 82–106, from `// Set schedule pickup link` through the closing `}` of the `if (schedulePickupBtn)` block).
  - Delete lines 138–139: `    // Check immediate pickup availability` / `    await checkImmediatePickupAvailability();`
  - Delete the whole Pickup Now region: from the banner at ~676 (`// ============================================================================` / `// Immediate Pickup ("Pickup Now!") Feature`) through the end of `handlePickupNowSuccess` (~995, the function ending with the `pickupNowContainer.classList.add('hidden');` block) — functions `checkImmediatePickupAvailability`, `setupPickupNowButton`, `openPickupNowModal`, `setupPickupNowModalHandlers`, `closePickupNowModal`, `calculateEstimatedPickup`, `submitImmediatePickup`, `handlePickupNowSuccess`. (`checkAndShowDeleteSection` and below stay.)
  - Delete the three window exports near EOF:

    ```javascript
    window.checkImmediatePickupAvailability = checkImmediatePickupAvailability;
    window.openPickupNowModal = openPickupNowModal;
    window.closePickupNowModal = closePickupNowModal;
    ```

- [ ] In `public/customer-dashboard-embed.html` delete:
  - the `<div id="pickupNowContainer" class="mb-4 hidden">…</div>` block (from line 68),
  - the `<a href="#" id="schedulePickupBtn" …>…</a>` quick-action (line 75's block),
  - the entire `<div id="pickupNowModal" …>…</div>` modal (from line 97 through its closing tags — contains `pickupNowForm`, `immediatePickupBags`, `immediatePickupInstructions`, `immediatePickupAcknowledge`, `immediatePickupError`, `closePickupNowModal`, `cancelPickupNowBtn`, `submitPickupNowBtn`, `firstOrderNote`, `estimatedPickupTime`, `pickupDeadlineDisplay`).

- [ ] i18n: remove now-orphaned keys from all four locale files — any key matching `schedulePickup`/`pickupNow`/`immediatePickup` with no remaining `data-i18n`/translate reference. Find candidates: `grep -n "schedulePickup\|pickupNow\|immediatePickup" public/locales/en/common.json`, then for each hit confirm orphanhood with `grep -rn "<key-path>" public/ --include="*.html" --include="*.js"` before deleting from en/es/pt/de.

- [ ] Grep — expected **0** hits:
  `grep -rn "schedule-pickup\|schedulePickup\|pickupNow\|PickupNow\|immediatePickup" public/assets/js/ public/customer-dashboard-embed.html public/embed-landing.html --include="*.js" --include="*.html"`

- [ ] Run — expect pass: `npm test -- tests/integration/pr2RemovedRoutes.test.js`, then full suite `npm test` — green.

- [ ] Commit:
  `git add -A && git commit -m "refactor(frontend): delete schedule-pickup page and customer-dashboard Pickup Now UI"`

---

## Task 8 — Delete the identity-availability service and its endpoints

`identityAvailabilityService` powers the public `POST /api/v1/auth/check-username` and `POST /api/v1/auth/check-email` pre-registration probes (a cross-role account-enumeration surface). The spec deletes it; duplicate email/username errors still surface at submit time from the registration endpoints themselves.

**Files:**
- Modify: `tests/integration/pr2RemovedRoutes.test.js`, `tests/unit/pr2Removals.test.js`
- Delete: `server/services/identityAvailabilityService.js`
- Modify: `server/controllers/authController.js` (import line 18, handlers ~1674–1712)
- Modify: `server/routes/authRoutes.js` (route blocks ~185–212)
- Modify: `public/assets/js/customer-register.js` (validateUsername 112–144, validateEmail 147–175, blur listeners 706 + 720)
- Modify: `public/assets/js/affiliate-register-init.js` (availability fetches inside validateEmail ~989–1020, validateUsername ~1022–1065, blur listeners 1070 + 1094)

**Steps:**

- [ ] Write the failing tests. Append to `tests/integration/pr2RemovedRoutes.test.js` (these endpoints are public — clean 404 probes):

```javascript
  it('POST /api/v1/auth/check-username is gone', async () => {
    const res = await request(app)
      .post('/api/v1/auth/check-username')
      .send({ username: 'whoever' });
    expect(res.status).toBe(404);
  });

  it('POST /api/v1/auth/check-email is gone', async () => {
    const res = await request(app)
      .post('/api/v1/auth/check-email')
      .send({ email: 'who@ever.com' });
    expect(res.status).toBe(404);
  });
```

  Append to `tests/unit/pr2Removals.test.js`:

```javascript
  it('identityAvailabilityService is deleted', () => {
    expect(() => require('../../server/services/identityAvailabilityService')).toThrow();
  });
```

- [ ] Run — expected failures: 200s from the live endpoints; the service resolves.

- [ ] Implement. In `server/routes/authRoutes.js` delete both route blocks (lines ~185–212): the `router.post('/check-username', …)` block (with its validator array and `validate`) and the `router.post('/check-email', …)` block.

- [ ] In `server/controllers/authController.js` delete line 18 `const identityAvailabilityService = require('../services/identityAvailabilityService');` and both exports `exports.checkUsername` (~1674–1692) and `exports.checkEmail` (~1695–1712). Keep the trailing `exports._cryptoWrapper` and `module.exports = exports;`.

- [ ] Delete the service: `git rm server/services/identityAvailabilityService.js`

- [ ] Frontend. In `public/assets/js/customer-register.js`: delete `async function validateUsername() {…}` (112–144) and `async function validateEmail() {…}` (147–175), plus their listeners at 706 (`usernameInput.addEventListener('blur', validateUsername);`) and 720 (`emailInput.addEventListener('blur', validateEmail);`) — remove the whole listener statements (and their enclosing `if` wrappers if they become empty).

- [ ] In `public/assets/js/affiliate-register-init.js`: in `validateEmail` (starting ~965) keep the format-validation part (the `FormValidation.isValidEmail` branch) and delete the availability block (`// Check email availability` try/catch with the `csrfFetch('/api/v1/auth/check-email', …)` call, ~989–1020). Delete `async function validateUsername() {…}` entirely (~1022–1065 — it only does the availability check) and its listener at 1094 (`usernameField.addEventListener('blur', validateUsername);`). Keep the email blur listener at 1070 (format check still useful).

- [ ] Grep — expected **0** hits:
  `grep -rn "identityAvailability\|check-username\|check-email" server/ public/assets/js/ --include="*.js"`
  (`forgot-password-embed.html` contains an unrelated `forgotPassword.checkEmail` i18n key — not a hit under this grep; leave it.)

- [ ] Run — expect pass: `npm test -- tests/integration/pr2RemovedRoutes.test.js tests/unit/pr2Removals.test.js tests/integration/auth.test.js`, then full suite `npm test` — green.

- [ ] Commit:
  `git add -A && git commit -m "refactor(auth): delete identity-availability service and check-username/check-email endpoints"`

## Task 9 — Affiliate model: drop `availabilitySchedule` + `allowImmediatePickup` (+ schedule methods and index)

All runtime consumers are already gone (Tasks 5–6). Now the schema.

**Files:**
- Create: `tests/unit/pr2ModelFieldRemovals.test.js`
- Modify: `server/models/Affiliate.js`
- Modify: `server/controllers/affiliateController.js` (updatableFields list, ~line 321)
- Modify: `tests/testUtils.js`, `tests/helpers/v2TestHelpers.js` (factory scrub, if they set these fields)

**Steps:**

- [ ] Write the failing test. Create `tests/unit/pr2ModelFieldRemovals.test.js`:

```javascript
// PR 2 — spec §4.5/§4.6 field removals, pinned at the schema level.
const Affiliate = require('../../server/models/Affiliate');

describe('Affiliate schema — scheduling / Pickup Now fields removed', () => {
  it('availabilitySchedule paths are gone', () => {
    expect(Affiliate.schema.path('availabilitySchedule.weeklyTemplate.monday.enabled')).toBeUndefined();
    expect(Affiliate.schema.path('availabilitySchedule.scheduleSettings.advanceBookingDays')).toBeUndefined();
  });

  it('allowImmediatePickup is gone', () => {
    expect(Affiliate.schema.path('allowImmediatePickup')).toBeUndefined();
  });

  it('schedule instance methods are gone', () => {
    expect(Affiliate.schema.methods.isAvailable).toBeUndefined();
    expect(Affiliate.schema.methods.getAvailableTimeSlots).toBeUndefined();
    expect(Affiliate.schema.methods.getAvailableDates).toBeUndefined();
    expect(Affiliate.schema.methods.validateScheduleChange).toBeUndefined();
    expect(Affiliate.schema.methods.getDayOfWeekKey).toBeUndefined();
  });
});
```

- [ ] Run — `npm test -- tests/unit/pr2ModelFieldRemovals.test.js` — expected failure: all paths/methods defined.

- [ ] Implement in `server/models/Affiliate.js`:
  - Delete the whole `availabilitySchedule: { … }` subdocument (lines ~181–279, from `// Availability schedule for pickup management` through the closing `},` of `scheduleSettings`).
  - Delete `allowImmediatePickup` (lines ~280–284):

    ```javascript
      // Immediate Pickup ("Pickup Now!") feature control
      allowImmediatePickup: {
        type: Boolean,
        default: true
      }
    ```

    and fix the trailing comma on the now-last schema field.
  - Delete the five schedule methods (lines ~342–459): `getDayOfWeekKey`, `isAvailable`, `getAvailableTimeSlots`, `getAvailableDates`, `validateScheduleChange` (the last one also drops the file's only inline `require('./Order')`).
  - Delete the index (line ~462): `affiliateSchema.index({ 'availabilitySchedule.dateExceptions.date': 1 });`

- [ ] In `server/controllers/affiliateController.js` remove `'allowImmediatePickup'` from the `updatableFields` array (currently the lone entry on line 321; leave the service* entries on line 319 for Task 10):

```javascript
    const updatableFields = [
      'firstName', 'lastName', 'phone', 'businessName',
      'address', 'city', 'state', 'zipCode', 'serviceArea', 'serviceLatitude', 'serviceLongitude', 'serviceRadius',
      'minimumDeliveryFee', 'perBagDeliveryFee', 'paymentMethod',
      'allowImmediatePickup'
    ];
```

  becomes

```javascript
    const updatableFields = [
      'firstName', 'lastName', 'phone', 'businessName',
      'address', 'city', 'state', 'zipCode', 'serviceArea', 'serviceLatitude', 'serviceLongitude', 'serviceRadius',
      'minimumDeliveryFee', 'perBagDeliveryFee', 'paymentMethod'
    ];
```

- [ ] Factory scrub: `grep -n "availabilitySchedule\|allowImmediatePickup" tests/testUtils.js tests/helpers/v2TestHelpers.js` — delete any field assignments found (Mongoose strict mode would silently drop them, but dead fixture data lies to readers).

- [ ] Run — expect pass: `npm test -- tests/unit/pr2ModelFieldRemovals.test.js`, then full suite `npm test`. Mongoose strict mode silently ignores unknown paths, so remaining factories that still pass these fields won't throw — but fix any test that *asserts* on them (locate with `grep -rn "availabilitySchedule\|allowImmediatePickup" tests/`; after the Task 5/6 deletions the expected hits are none).

- [ ] Grep — expected **0** hits: `grep -rn "availabilitySchedule\|allowImmediatePickup" server/ tests/ public/ --include="*.js"`

- [ ] Commit:
  `git add -A && git commit -m "refactor(affiliate-model): drop availabilitySchedule, allowImmediatePickup, schedule methods and index"`

---

## Task 10 — Affiliate model: drop service-area fields and scrub every backend consumer

Spec §4.6 / settled decision #13-8: service area is no longer enforced anywhere. Drop `serviceLocation` (+ 2dsphere index + pre-save sync), `serviceLatitude`, `serviceLongitude`, `serviceRadius`. Note: `server/middleware/locationValidation.js` contains **no** geocoding or radius checks (verified — it is static city/zip/state *address* validation via `serviceAreaService`); it and the `/api/v1/service-area/*` autocomplete routes are address-form helpers and stay. The only Nominatim radius check (`addressValidationService.isWithinServiceArea`) is consumed solely by the optional `POST /api/v1/service-area/validate` helper and is untouched here; the *claim path* never calls it (PR 6 builds claim with no geocoding, per spec §6.3).

**Files:**
- Modify: `tests/unit/pr2ModelFieldRemovals.test.js`, `tests/integration/affiliateRegistrationOpen.test.js`
- Modify: `server/models/Affiliate.js`
- Modify: `server/routes/affiliateRoutes.js` (validators, lines 24–26)
- Modify: `server/routes/socialAuthRoutes.js` (validators, lines 165–167)
- Modify: `server/controllers/affiliateController.js` (register ~111–113 + ~180–182, profile ~262–264, updatableFields ~319, public info ~1032–1054 and ~1071–1096)
- Modify: `server/services/socialAuthAffiliateService.js` (lines 103–105)
- Modify: `server/services/adminDashboardService.js` (lines 388–390, 417, 509–512)
- Modify: `server/routes/testRoutes.js` (seed fields ~125–129)
- Modify: `tests/testUtils.js`, `tests/helpers/v2TestHelpers.js`, `tests/unit/models.test.js` (line ~61), plus any test asserting the removed fields

**Steps:**

- [ ] Write the failing tests. Append to `tests/unit/pr2ModelFieldRemovals.test.js`:

```javascript
describe('Affiliate schema — service-area fields removed', () => {
  it('service-area paths are gone', () => {
    expect(Affiliate.schema.path('serviceLocation.coordinates')).toBeUndefined();
    expect(Affiliate.schema.path('serviceLatitude')).toBeUndefined();
    expect(Affiliate.schema.path('serviceLongitude')).toBeUndefined();
    expect(Affiliate.schema.path('serviceRadius')).toBeUndefined();
  });

  it('the 2dsphere index is gone', () => {
    const geoIndex = Affiliate.schema.indexes().find(([fields]) => fields.serviceLocation);
    expect(geoIndex).toBeUndefined();
  });
});
```

  And update `tests/integration/affiliateRegistrationOpen.test.js`: **delete** the three lines

```javascript
        serviceLatitude: 30.2672,
        serviceLongitude: -97.7431,
        serviceRadius: 10,
```

  (and the `// NOTE: service* fields still required…` comment). Registration must now succeed without them.

- [ ] Run — expected failures: schema paths defined; registration without service fields 400s on the route validators.
  `npm test -- tests/unit/pr2ModelFieldRemovals.test.js tests/integration/affiliateRegistrationOpen.test.js`

- [ ] Implement in `server/models/Affiliate.js`:
  - Delete `serviceLocation` / `serviceLatitude` / `serviceLongitude` / `serviceRadius` (lines ~24–51, from `// Location fields for map-based service area` through the `serviceRadius` line).
  - Delete the index (line ~323): `affiliateSchema.index({ serviceLocation: '2dsphere' });` and its comment.
  - Delete the pre-save sync (lines ~330–340):

    ```javascript
    // Update serviceLocation when lat/lng changes
    affiliateSchema.pre('save', function(next) {
      // Update serviceLocation from lat/lng if they exist
      if (this.serviceLatitude && this.serviceLongitude && (this.isModified('serviceLatitude') || this.isModified('serviceLongitude'))) {
        this.serviceLocation = {
          type: 'Point',
          coordinates: [this.serviceLongitude, this.serviceLatitude]
        };
      }
      next();
    });
    ```

- [ ] Route validators. In `server/routes/affiliateRoutes.js` delete (lines 24–26):

```javascript
  body('serviceLatitude').notEmpty().isNumeric().withMessage('Service latitude is required'),
  body('serviceLongitude').notEmpty().isNumeric().withMessage('Service longitude is required'),
  body('serviceRadius').notEmpty().isNumeric().isInt({ min: 1, max: 50 }).withMessage('Service radius must be between 1 and 50 miles'),
```

  In `server/routes/socialAuthRoutes.js` delete the identical three validator lines (165–167).

- [ ] `server/controllers/affiliateController.js`:
  - `registerAffiliate`: remove `serviceLatitude,` `serviceLongitude,` `serviceRadius,` from the `req.body` destructure (~111–113) and from the `new Affiliate({ … })` literal (~180–182).
  - `getAffiliateProfile` response (~262–264): delete `serviceLatitude: affiliate.serviceLatitude,`, `serviceLongitude: affiliate.serviceLongitude,`, `serviceRadius: affiliate.serviceRadius,`.
  - `updateAffiliateProfile` `updatableFields` (~319): remove `'serviceArea', 'serviceLatitude', 'serviceLongitude', 'serviceRadius'` so the line reads `'address', 'city', 'state', 'zipCode',`.
  - `getPublicAffiliateInfo` (~1032–1054): in the `.select(...)` drop `serviceLatitude serviceLongitude serviceRadius`; in the response drop the three `service*` lines.
  - `getPublicAffiliateInfoById` (~1071–1096): same `.select` scrub; in the response drop `serviceRadius: affiliate.serviceRadius` — **keep** `serviceArea: \`${affiliate.city}, ${affiliate.state}\`` (it's a display label built from city/state, consumed by the customer success page; not a service-area field).

- [ ] `server/services/socialAuthAffiliateService.js` (~103–105): delete `serviceLatitude: rest.serviceLatitude,`, `serviceLongitude: rest.serviceLongitude,`, `serviceRadius: rest.serviceRadius,` from the `new Affiliate({ … })` literal.

- [ ] `server/services/adminDashboardService.js` (the spec's "verify no other consumer (e.g. an admin map view)" — this IS that consumer; enforcement is gone, so the projections go too):
  - `$project` block (~388–390): delete `serviceLatitude: 1,`, `serviceLongitude: 1,`, `serviceRadius: 1,`.
  - geographic aggregation (~417): delete `avgServiceRadius: { $avg: '$serviceRadius' }` (and the dangling comma).
  - affiliate report (~509–512): delete the whole `serviceLocation: { latitude: …, longitude: …, radius: … },` object.
  - Then check the admin-dashboard frontend for renderers of those response keys: `grep -n "avgServiceRadius\|serviceLocation" public/assets/js/administrator-dashboard-init.js` — delete any table column/row rendering them.

- [ ] `server/routes/testRoutes.js` (~125–129): delete the `serviceRadius: 5,` / `serviceLatitude: 30.2672,` / `serviceLongitude: -97.7431,` seed lines.

- [ ] Test surgery:
  - `tests/unit/models.test.js` line ~61: delete `expect(error.errors.serviceLatitude).toBeDefined();` (the field no longer exists, so it can't be a required-validation error; if the surrounding `it` only asserts service-field requiredness, delete the `it`).
  - `tests/testUtils.js` + `tests/helpers/v2TestHelpers.js`: delete `serviceLatitude`/`serviceLongitude`/`serviceRadius`/`serviceArea` fixture fields.
  - Run the full suite and fix any remaining test that *asserts* the removed fields (creation-payload usages are silently ignored by strict mode, but scrub the ones the grep finds):
    `grep -rln "serviceLatitude\|serviceLongitude\|serviceRadius" tests/` — known candidates from planning: `tests/integration/accountLockout.test.js`, `auth.test.js`, `affiliate.test.js`, `affiliateCustomerFiltering.test.js`, `customer.test.js`, `facebookDataDeletion.test.js`, `quickbooks.test.js`, `order.test.js`, `wdfCredit*`, `tests/unit/socialAuthRoutes(.full)?.test.js`, `v2PaymentModels.test.js`, `paymentEmailScanner.test.js`, `paymentVerificationJob.test.js`. For each: delete fixture fields; update any response-shape assertion that lists `service*` keys (notably `tests/unit/socialAuthRoutes*.test.js`, which asserts the now-deleted validators — delete those `it`s).

- [ ] Run — expect pass: `npm test -- tests/unit/pr2ModelFieldRemovals.test.js tests/integration/affiliateRegistrationOpen.test.js`, then full suite `npm test` — green.

- [ ] Grep — expected **0** hits in server code:
  `grep -rn "serviceLatitude\|serviceLongitude\|serviceRadius\|serviceLocation\|2dsphere" server/ server.js --include="*.js"`
  (Frontend hits in `affiliate-register-init.js` / `affiliate-dashboard-init.js` / `service-area-component.js` remain until Task 11. `SERVICE_RADIUS_MILES` env read in `serviceAreaRoutes.js` is a different identifier and is out of scope.)

- [ ] Commit:
  `git add -A && git commit -m "refactor(affiliate-model): drop serviceLocation/serviceLatitude/serviceLongitude/serviceRadius and scrub all backend consumers (service area no longer enforced)"`

---

## Task 11 — Frontend: remove the affiliate-register Leaflet map step and dashboard service-area editor

Pure frontend deletion (no Jest coverage of these pages); verification is grep-zero + page-load smoke.

**Files:**
- Modify: `public/affiliate-register-embed.html` (leaflet CSS line 11, `#serviceAreaSection` block from line 218, leaflet script line 371)
- Modify: `public/assets/js/affiliate-register-init.js` (capture sites 273–277 and 1319–1325; map machinery ~1847–2300; section-navigation branches at 2292, 2509–2545, 2606–2610, 2781–2845)
- Modify: `public/affiliate-dashboard-embed.html` (leaflet CSS line 11, settings service-area block ~390, leaflet script line 514)
- Modify: `public/assets/js/affiliate-dashboard-init.js` (lines ~544–545, ~575–583, ~1095, ~1132–1143, ~1267–1272)
- Modify: `public/assets/js/embed-app-v2.js` (pageScripts: drop `service-area-component.js` from `/affiliate-register` line 595; drop the leaflet CDN URL + `service-area-component.js` from `/affiliate-dashboard` line 596)
- Delete: `public/assets/js/service-area-component.js`
- Modify: `public/locales/{en,es,pt,de}/common.json` (`affiliate.register.serviceArea*` keys, en lines ~347–360)

**Steps:**

- [ ] `public/affiliate-register-embed.html`: delete the leaflet stylesheet (line 11), the whole `<div id="serviceAreaSection" class="form-section-hidden">…</div>` block (from line 218 — contains `registrationServiceAreaComponent` and `serviceAreaNavigation` with its back/next buttons), and the leaflet script tag (line 371).

- [ ] `public/assets/js/affiliate-register-init.js` — delete in this order, re-running the locator grep after each pass (`grep -n "serviceArea\|ServiceArea\|serviceLat\|serviceLng\|serviceRadius\|Leaflet\|leaflet\|L\.map\|registrationServiceAreaComponent" public/assets/js/affiliate-register-init.js`):
  1. The missing-fields check (lines 272–277):

     ```javascript
           // Check service area separately (stored in hidden fields with component-generated IDs)
           const serviceLatitude = document.getElementById('registrationServiceAreaComponent-latitude');
           const serviceLongitude = document.getElementById('registrationServiceAreaComponent-longitude');
           if (!serviceLatitude?.value || !serviceLongitude?.value) {
             missingFields.push('Service Area (Please click on the map to set your service location)');
           }
     ```

  2. The submit-payload capture (lines ~1318–1325):

     ```javascript
               // Handle service area fields with component-generated IDs
               const serviceLatField = document.getElementById('registrationServiceAreaComponent-latitude');
               const serviceLngField = document.getElementById('registrationServiceAreaComponent-longitude');
               const serviceRadiusField = document.getElementById('registrationServiceAreaComponent-radius');

               if (serviceLatField) affiliateData['serviceLatitude'] = serviceLatField.value || '';
               if (serviceLngField) affiliateData['serviceLongitude'] = serviceLngField.value || '';
               if (serviceRadiusField) affiliateData['serviceRadius'] = serviceRadiusField.value || '';
     ```

  3. The entire map-machinery region (~1847–2300): `serviceAreaMap` init (`L.map('serviceAreaMap')` at ~1867), tile layer, marker/circle drawing, the Nominatim reverse-geocode handler (~2109), `waitForLeafletAndInitialize_OLD` and its listeners, and the dynamic-Leaflet loader (~2255–2280).
  4. The step-navigation branches that show/hide `serviceAreaSection` (~2292, ~2509–2545, ~2606–2610, ~2781–2845): rewire each so the flow that previously went *address → service area → payment* goes *address → payment* directly — i.e. where a branch does `serviceAreaSection.classList.remove('form-section-hidden')`, replace it with the statements from the *next* step's branch (showing the payment section), and delete the now-unreachable service-area back-button handlers.
  5. Re-run the locator grep → expected **0** hits.

- [ ] `public/affiliate-dashboard-embed.html`: delete the leaflet stylesheet (line 11), the settings-tab service-area block at ~388–392 (the `<label … data-i18n="affiliate.register.serviceArea">Service Area</label>` and its `settingsServiceAreaComponent` container), and the leaflet script (line 514).

- [ ] `public/assets/js/affiliate-dashboard-init.js`: delete the serviceArea render lines (~544–545), the map bootstrap blocks (~575–583 and ~1132–1143), the `serviceArea: data.serviceArea,` carry (~1095), and the settings-save capture (~1267–1272: the `window.ServiceAreaComponent.getData('settingsServiceAreaComponent')` block). Locator: `grep -n "serviceArea\|ServiceArea\|serviceLatitude\|serviceRadius" public/assets/js/affiliate-dashboard-init.js` → expected **0** hits afterwards.

- [ ] `public/assets/js/embed-app-v2.js`: in the `/affiliate-register` pageScripts array (line 595) remove `'/assets/js/service-area-component.js',`; in the `/affiliate-dashboard` array (line 596) remove `'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js',` and `'/assets/js/service-area-component.js',`. Keep `address-validation-component.js` and `service-area-autocomplete.js` (address-form helpers — still used).

- [ ] Delete the component once nothing references it:
  `grep -rln "service-area-component" public/` → must list nothing but the file itself, then `git rm public/assets/js/service-area-component.js`.

- [ ] i18n: in all four locale files delete the `affiliate.register` map-step keys (en lines ~347–360): `serviceArea`, `serviceAreaInstructions`, `serviceAreaStep1`, `serviceAreaStep2`, `serviceAreaStep3`, `serviceAreaDetails` (and any sibling `serviceArea*` keys revealed by `grep -n "serviceArea" public/locales/en/common.json` that no longer have a `data-i18n` consumer — confirm each with `grep -rn "<key>" public/ --include="*.html" --include="*.js"`).

- [ ] Smoke check (manual, no Jest coverage here): `npm start` locally, load `http://localhost:3000/embed-app-v2.html?route=/affiliate-register` and `?route=/affiliate-dashboard` — no console errors, register flow steps from address straight to payment, dashboard settings tab renders without the map. Stop the server.

- [ ] Full suite still green: `npm test`

- [ ] Commit:
  `git add -A && git commit -m "refactor(frontend): remove affiliate service-area map step and dashboard editor (Leaflet + service-area-component)"`

## Task 12 — Customer model: drop `numberOfBags` (V1 bag-purchase artifact) + the register-page bag selector

Spec §4.5 removes `registrationVersion`, `bagCredit`, `bagCreditApplied`, `initialBagsRequested`, `numberOfBags`. **Verified at planning time: only `numberOfBags` exists on the current Customer schema** (line 73) — the other four were already removed in an earlier cleanup. The test below pins all five as absent. `Order.numberOfBags` is a *different field* and stays until PR 4 — do not touch `order.numberOfBags` reads.

**Files:**
- Modify: `tests/unit/pr2ModelFieldRemovals.test.js`
- Modify: `server/models/Customer.js` (line 72–73)
- Modify: `server/services/customerRegistrationService.js` (destructure line ~62, cap block ~114–115, field ~134)
- Modify: `server/controllers/customerController.js` (lines ~51, ~285, ~561 — customer.* reads only)
- Modify: `public/customer-register-embed.html` (hidden inputs lines 32–34 area, bag-selector block 190–212)
- Modify: `public/assets/js/customer-register.js` (selectBags/setupBagSelection 177–201, call site 846, payload lines 243–245)
- Modify: `public/assets/js/customer-register-navigation.js` (lines ~278–283)
- Modify: `public/locales/{en,es,pt,de}/common.json` (bag-selection keys)

**Steps:**

- [ ] Write the failing test. Append to `tests/unit/pr2ModelFieldRemovals.test.js`:

```javascript
const Customer = require('../../server/models/Customer');

describe('Customer schema — V1 bag-purchase fields removed', () => {
  it.each(['numberOfBags', 'registrationVersion', 'bagCredit', 'bagCreditApplied', 'initialBagsRequested'])(
    '%s is gone', (field) => {
      expect(Customer.schema.path(field)).toBeUndefined();
    }
  );
});
```

- [ ] Run — expected failure: exactly one case (`numberOfBags`) fails; the other four already pass (they document the invariant).

- [ ] Implement. In `server/models/Customer.js` delete lines 72–73:

```javascript
  // Bag information
  numberOfBags: { type: Number, default: 1 },
```

- [ ] In `server/services/customerRegistrationService.js`:
  - remove `numberOfBags,` from the payload destructure (~line 62),
  - delete the cap block (~114–115):

    ```javascript
      // Cap requested bags at the free-initial-bags setting.
      const freeInitialBags = await SystemConfig.getValue('free_initial_bags', 2);
      const initialBagsRequested = Math.min(numberOfBags || 1, freeInitialBags);
    ```

  - delete `numberOfBags: initialBagsRequested,` from the `new Customer({ … })` literal (~134).
  (Per spec §7 Config: "there is no 'free initial bags' key" — this was its only reader; PR 3 owns the SystemConfig seed list, nothing to do there from here.)

- [ ] In `server/controllers/customerController.js` delete the three **customer**-sourced reads:
  - ~line 51: `          numberOfBags: customer.numberOfBags` (fix the preceding comma),
  - ~line 285: `        numberOfBags: customer.numberOfBags,`,
  - ~line 561: `      numberOfBags: customer.numberOfBags || 1` (fix the preceding comma).
  **Keep** the `order.numberOfBags` reads at ~212–213 and ~311 (`numberOfBags: order.numberOfBags,` / `bagsSummary: …` / `bags: order.numberOfBags`) — Order field, PR 4's concern.

- [ ] Frontend. In `public/customer-register-embed.html`:
  - delete the hidden inputs `<input type="hidden" id="registrationVersion" name="registrationVersion" value="v2">` (line 34) and `<input type="hidden" id="numberOfBags" name="numberOfBags" value="1">` (line 211),
  - delete the "Free Bag Selection" sub-block inside `#serviceSummarySection` (lines ~192–212: the `<h3 data-i18n="customer.register.v2.selectBags">…` heading, its description `<p>`, and the whole `<div class="bag-selector">…</div>`). Keep the "How It Works" card and the section itself (the step navigation depends on the section existing).

- [ ] In `public/assets/js/customer-register.js`: delete `function selectBags(num) {…}` and `function setupBagSelection() {…}` (lines 177–201), the `setupBagSelection();` call at ~846, and the payload lines at ~243–245:

```javascript
            data.registrationVersion = 'v2';
            ...
            data.initialBagsRequested = parseInt(data.numberOfBags || '1');
```

  (delete both statements and any `data.numberOfBags` reference between them).

- [ ] In `public/assets/js/customer-register-navigation.js` delete the step-validation block at ~278–283 that requires `numberOfBags` (`const numberOfBags = document.getElementById('numberOfBags'); if (!numberOfBags || !numberOfBags.value) { … }`).

- [ ] i18n: delete from all four locale files the bag-selection keys (en lines ~758–763): `customer.register.v2.selectBags`, `selectBagsDescription`, `oneBag`, `oneBagDesc`, `twoBags`, `twoBagsDesc`. (The unrelated `…"selectBags": "Select number of bags"` at en ~703 belongs to another namespace — check its consumer with `grep -rn` before touching; if its consumer was the schedule-pickup page deleted in Task 7, delete it too, in all four files.)

- [ ] Run — expect pass: `npm test -- tests/unit/pr2ModelFieldRemovals.test.js`, then full suite `npm test`. Fix any test asserting `customer.numberOfBags` or sending it with assertions (locate: `grep -rn "numberOfBags" tests/ | grep -iv order` — creation-payload usages without assertions are inert).

- [ ] Grep — expected hits ONLY on Order usages:
  `grep -rn "numberOfBags\|initialBagsRequested\|registrationVersion\|bagCredit" server/ public/assets/js/customer-register.js public/assets/js/customer-register-navigation.js public/customer-register-embed.html --include="*.js" --include="*.html" | grep -v "models/Order.js" | grep -v "order.numberOfBags" | grep -v "orderController" | grep -v "operator"` → expected **0** hits.

- [ ] Commit:
  `git add -A && git commit -m "refactor(customer-model): drop numberOfBags and the register-page bag selector (V1 bag-purchase artifact)"`

---

## Task 13 — Remove the `paymentConfirmed` rate-limit bypass and the `?affid` referral binding

Two small, related closures of the V1 funnel. Pure deletions (rate limiting is disabled under `NODE_ENV=test`, so there is no honest failing test to write for the bypass; the grep + suite is the verification).

**Files:**
- Modify: `server/routes/customerRoutes.js` (lines 14–24, 55)
- Modify: `server/services/customerRegistrationService.js` (`paymentConfirmed` destructure + log)
- Modify: `public/assets/js/customer-register.js` (loadAffiliateInfo 371–401, call site 850, OAuth URL 460–461)
- Modify: test payloads sending `paymentConfirmed` (`tests/integration/customer.test.js`, `tests/integration/v2-payment-flow.test.js`, `tests/integration/v2-complete-payment-flow.test.js`, `tests/unit/v2ControllerLogic.test.js`, `tests/unit/v2-payment-core.test.js`)

**Steps:**

- [ ] In `server/routes/customerRoutes.js` delete the bypass (lines 14–24):

```javascript
// Conditional rate limiter that skips rate limiting for post-payment registrations
const conditionalRegistrationLimiter = (req, res, next) => {
  // Skip rate limiting if this is a post-payment registration
  if (req.body.paymentConfirmed === true) {
    logger.info('Skipping rate limit for post-payment registration');
    return next();
  }
  
  // Otherwise apply the normal rate limiter
  return registrationLimiter(req, res, next);
};
```

  and on line 55 change `router.post('/register', conditionalRegistrationLimiter, [` to `router.post('/register', registrationLimiter, [`. If `logger` is now unused in the file, remove its import (check: `grep -n logger server/routes/customerRoutes.js`).

- [ ] In `server/services/customerRegistrationService.js` delete `paymentConfirmed,` from the payload destructure and the block:

```javascript
  if (paymentConfirmed) {
    logger.info(`Post-payment registration for email: ${email}, affiliate: ${affiliateId}`);
  }
```

- [ ] Scrub test payloads: `grep -rn "paymentConfirmed" tests/` and delete the field from every request body / fixture (it changed nothing under test since limiters are disabled; assertions never referenced it — if one does, delete that assertion too).

- [ ] Grep — expected **0** hits: `grep -rn "paymentConfirmed\|conditionalRegistration" server/ public/ tests/ --include="*.js"`

- [ ] In `public/assets/js/customer-register.js` close the `?affid` funnel:
  - delete `function loadAffiliateInfo() {…}` (lines 371–401 — the `urlParams.get('affid') || urlParams.get('affiliate') || urlParams.get('affiliateId')` binding and the `/api/v1/affiliates/public/` intro fetch),
  - delete its call site at ~850 (`loadAffiliateInfo();`),
  - in `handleSocialAuth` (~460–461) replace:

    ```javascript
        // Include affiliate ID in OAuth URL if present
        const affiliateId = document.getElementById('affiliateId')?.value || '';
        const oauthUrl = `${baseUrl}/api/v1/auth/customer/${provider}?popup=true&state=${sessionId}&affiliateId=${affiliateId}&version=v2&t=${Date.now()}`;
    ```

    with:

    ```javascript
        const oauthUrl = `${baseUrl}/api/v1/auth/customer/${provider}?popup=true&state=${sessionId}&version=v2&t=${Date.now()}`;
    ```

  The hidden `<input type="hidden" id="affiliateId">` in the HTML stays (always empty now): the server-side `body('affiliateId').notEmpty()` validator still guards `POST /api/v1/customers/register`, so **self-serve registration is intentionally closed** until PR 6's QR-claim page replaces this funnel (spec §6.3 deprecation note). State this in the commit body.

- [ ] Grep — expected **0** hits: `grep -rn "affid" public/assets/js/ --include="*.js"`

- [ ] Full suite: `npm test` — green.

- [ ] Commit:
  `git add -A && git commit -m "refactor(customer): remove paymentConfirmed rate-limit bypass and ?affid referral binding

The ?affid self-serve funnel is closed (server still requires affiliateId,
which no client path now supplies). PR 6 replaces it with the bag QR claim."`

---

## Task 14 — Final sweep: mandatory greps, lint, circular-dependency check, full suite

**Files:** none expected (fix-ups only if a grep hits).

**Steps:**

- [ ] Run the **mandatory grep target list** — every command must return **0** hits (exceptions noted inline):

```bash
# Beta program — fully gone
grep -rn "BetaRequest\|betaRequest\|beta-request\|sendBeta" server/ server.js public/ tests/ --include="*.js" --include="*.html" --include="*.json"

# Scheduling / Pickup Now — writers gone (Order model fields remain until PR 4)
grep -rn "affiliateSchedule\|availabilitySchedule\|allowImmediatePickup" server/ server.js public/ tests/ --include="*.js"
grep -rn "orderImmediatePickupHours\|createImmediateOrder\|checkImmediateAvailability\|checkActiveOrders" server/ public/ tests/ --include="*.js"
grep -rn "schedule-pickup\|schedulePickup\|pickupNow\|immediatePickup" server/ public/ tests/ --include="*.js" --include="*.html"
grep -rn "isImmediatePickup\|pickupDeadline\|immediatePickupRequestedAt" server/ --include="*.js" | grep -v "server/models/Order.js"   # Order schema keeps them until PR 4

# Identity availability — gone
grep -rn "identityAvailability\|check-username\|check-email" server/ public/assets/js/ --include="*.js"

# Service area enforcement — gone (SERVICE_RADIUS_MILES env in serviceAreaRoutes is a kept, unrelated identifier)
grep -rn "serviceLatitude\|serviceLongitude\|serviceRadius\|2dsphere" server/ server.js public/ tests/ --include="*.js" --include="*.html"
grep -rn "serviceLocation" server/ --include="*.js"

# Customer V1 bag-purchase artifacts — gone (Order.numberOfBags excepted until PR 4)
grep -rn "numberOfBags\|initialBagsRequested\|bagCredit\b" server/models/Customer.js server/services/customerRegistrationService.js server/controllers/customerController.js public/assets/js/customer-register.js public/assets/js/customer-register-navigation.js | grep -v "order.numberOfBags"

# Funnel closures
grep -rn "paymentConfirmed\|conditionalRegistration" server/ public/ tests/ --include="*.js"
grep -rn "affid" public/assets/js/ --include="*.js"
```

- [ ] Lint the server tree (console.* is ESLint-blocked; deletions can orphan imports): `npx eslint server/ server.js` — 0 errors.

- [ ] Circular-dependency gate (house rule): `npx madge --circular server/` — "No circular dependency found!".

- [ ] Locale parity spot-check — every key removed from `en` must be removed from all four files: for each of `betaRequests`, `affiliate.dashboard.schedule`, `serviceAreaStep1`, `selectBags`, run `grep -c "<key>" public/locales/en/common.json public/locales/es/common.json public/locales/pt/common.json public/locales/de/common.json` and confirm identical (zero) counts.

- [ ] Full suite, no forceExit: `npm test` — green, exits cleanly.

- [ ] If any fix-ups were needed, commit them:
  `git add -A && git commit -m "chore(pr2): final sweep — orphaned references, lint, locale parity"`

---

## Verification

**Full-suite command:** `npm test` (Jest must exit cleanly without `--forceExit`; MongoMemoryServer teardown intact).

**Quality gates:**
- `npx eslint server/ server.js` → 0 errors
- `npx madge --circular server/` → no cycles
- All Task 14 greps → 0 hits (with the two documented Order-model exceptions, removed by PR 4)

**Manual smoke checks** (local `npm start`, then in a browser):
1. `?route=/affiliate-register` — no Leaflet/map step; flow goes account → personal → address → payment; submitting without any beta invitation succeeds (201) — registration is open until PR 5.
2. `?route=/affiliate-dashboard` — no Schedule tab; settings tab renders without a map; no console 404s for `affiliate-schedule.js` / `leaflet` / `service-area-component.js`.
3. `?route=/customer-dashboard` — no "Pickup Now" button, no "Schedule Pickup" quick action; orders list and profile still render.
4. `?route=/landing` — CTA reads "Become an Affiliate" (and the es/pt/de translations via the language switcher) and navigates to `/affiliate-register`; no beta modal, no console error for `beta-request-modal.js`.
5. `/schedule-pickup-embed.html` → 404; `?route=/schedule-pickup` falls through to the SPA's unknown-route handling.
6. `?route=/customer-register` — page loads; no affiliate intro from `?affid=AFF-…` (param ignored); no username/email "availability" hints on blur.

**PR description text:**

> ## PR 2 — Remove scheduling, Pickup Now, BetaRequest, ?affid, service area
>
> Second PR of the invite/bag/intake redesign (spec: `docs/superpowers/specs/2026-06-08-invite-bag-workflow-redesign-design.md` §7, §12 PR 2, §4.5/§4.6). Pure removal — no new product behavior.
>
> **Deleted**
> - Customer order creation (`POST /api/v1/orders`), "Pickup Now" (`/api/v1/orders/immediate*`), `GET /api/v1/orders/check-active`, and `orderImmediatePickupHours` — orders are created at operator intake from PR 7.
> - Affiliate availability scheduling: `affiliateScheduleController`/`affiliateScheduleRoutes`, the dashboard Schedule tab, `Affiliate.availabilitySchedule` (+ methods/index) and `allowImmediatePickup`.
> - BetaRequest onboarding: model, public + admin endpoints, `betaRequestService`, the email dispatchers, the landing beta modal, and the admin dashboard subtab. **Affiliate registration is temporarily open** until PR 5's invite gate. `sendAdminNotification` / `sendMarketingEmail` were relocated (with two latent require-path bugs fixed) — the V2 payment scanner and marketing console are unaffected.
> - The `schedule-pickup` page (+ EMBED_PAGES/pageScripts/legacy `pickup=true` mapping) and the customer-dashboard Pickup Now UI.
> - Identity-availability probes (`/api/v1/auth/check-username|check-email`) and their service + frontend hints.
> - Service-area enforcement: `Affiliate.serviceLocation/serviceLatitude/serviceLongitude/serviceRadius` (+ 2dsphere index), the registration map step (Leaflet + `service-area-component.js`), route validators, and all backend projections (admin map view included). Address-form helpers (`serviceAreaService` autocomplete, `locationValidation` address checks) are intentionally kept.
> - `Customer.numberOfBags` (+ register-page bag selector); `registrationVersion`/`bagCredit`/`bagCreditApplied`/`initialBagsRequested` pinned absent by test.
> - The `paymentConfirmed` rate-limit bypass and the `?affid` referral binding — the self-serve customer funnel is closed until PR 6's QR claim replaces it.
>
> **Untouched by design:** `Order` schema scheduling/Pickup-Now fields (PR 4 removes them with the enum redesign); `/api/v1/customers/register` route (PR 6 replaces it with the claim flow).
>
> Every deletion is paired with its test deletions/conversions; suite green at every commit, no `--forceExit`. Removal regressions live in `tests/integration/pr2RemovedRoutes.test.js`, `tests/unit/pr2Removals.test.js`, `tests/unit/pr2ModelFieldRemovals.test.js`, `tests/unit/emailDispatcherRelocation.test.js`, `tests/integration/affiliateRegistrationOpen.test.js`.
>
> 🤖 Generated with [Claude Code](https://claude.com/claude-code)
