# PR 1 — Remove V1 Paygistix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Delete the entire V1 Paygistix payment stack (controller, services, config, models, routes, frontend assets, dead tests) and scrub every live reference — `server.js` mounts, CSP origins, CSRF exemptions, health/monitoring probes — while leaving the V2 payment stack (`paymentLinkService`, `paymentEmailScanner`, `imapEmailScanner`, `paymentVerificationJob`) completely untouched.

**Architecture:** This is a pure-removal PR, executed top-down so the suite stays green at every commit: first unmount routes in `server.js` (nothing reachable), then remove the customer-facing payment endpoints, then delete the now-unreferenced service/route/config files, then the models, then scrub secondary references, then delete the orphaned frontend surface. A single growing regression test file (`tests/integration/v1PaymentRemoval.test.js`) pins each removal (spec §11 "Removal regressions"). Deletions are paired with their test deletions in the same commit.

**Tech Stack:** Node/Express, Jest + Supertest (MongoMemoryServer via `tests/setup.js`), Mongoose.

**Assumed starting state:** Current `main` as-is — PR 1 is the first PR of the sequence (spec §12) and depends on nothing. Authoritative spec: `docs/superpowers/specs/2026-06-08-invite-bag-workflow-redesign-design.md` §7 (removal plan), §11 (removal regressions), §12 (PR 1 row).

**Explicitly OUT of scope (later PRs):**
- `Order.refund*` block, `paymentStatus` enum, `Customer.registrationVersion/bagCredit/...` field removals → PR 2/PR 4 (the Paygistix *comments* at `server/models/Customer.js:70` and `server/models/Order.js:104` stay for now; they go with the fields).
- `laundry_bag_fee` / `payment_check_*` SystemConfig keys → PR 3.
- BetaRequest / scheduling / `?affid` / `paymentConfirmed` rate-limit bypass (`server/routes/customerRoutes.js:14-18`) → PR 2.
- Doc files mentioning Paygistix (`.claude/CLAUDE.md`, `docs/**`) — docs references can stay.
- `public/payment-confirmation-embed.html` — V2 page (Venmo/PayPal/CashApp method cards, no Paygistix reference). **Keep.**

**Verified reference inventory (grep-driven, 2026-06-09):** the only V1 consumers are: `server.js` (lines 31, 157-164, 374, 411, 914-920, 936, 956, 965-966), `server/controllers/customerController.js` (lines 572-619), `server/routes/customerRoutes.js` (lines 160-178), `server/config/csrf-config.js` (line 146), `server/services/systemHealthService.js` (lines 28, 82-96, 103), `server/monitoring/connectivity-monitor.js` (lines 32-37), the frontend assets in Task 6, and the test files listed per task. The V2 stack (`server/services/paymentLinkService.js`, `paymentEmailScanner.js`, `imapEmailScanner.js`, `server/jobs/paymentVerificationJob.js`, `scheduler.js`) imports **none** of the deleted modules — verified; do not touch those files.

---

## Task 1: Unmount V1 payment routes from `server.js` + CSP scrub

**Files:**
- Create: `tests/integration/v1PaymentRemoval.test.js`
- Modify: `server.js` (lines 31, 157-164, 374, 411, 914-920, 936, 956, 965-966)
- Delete: `tests/integration/payment.test.js` (330 lines; exercises the now-unmounted `/api/v1/payments/*` endpoints through the app — fails the moment the mount is removed, so it dies in this commit)

### Steps

- [ ] Write the failing regression test. Create `tests/integration/v1PaymentRemoval.test.js` with exactly:

```javascript
// V1 Paygistix removal regression tests (PR 1 of the invite/bag/workflow redesign).
// Spec: docs/superpowers/specs/2026-06-08-invite-bag-workflow-redesign-design.md §7, §11, §12.
// Pins the removal: the V1 payment surface must be gone (404) and server.js must
// no longer whitelist the Paygistix gateway origin in CSP. This file grows by one
// describe block per task of the PR-1 plan.
const fs = require('fs');
const path = require('path');
const request = require('supertest');
const app = require('../../server');
const { getCsrfToken, createAgent } = require('../helpers/csrfHelper');

describe('V1 Paygistix removal', () => {
  // POST probes MUST carry a CSRF token. conditionalCsrf is mounted globally
  // and default-enforces unlisted mutation paths even under NODE_ENV=test, so
  // a tokenless POST returns 403 before routing and never reaches the 404
  // handler. Sending the token also keeps the create-token probe green after
  // Task 5 removes its REGISTRATION_ENDPOINTS exemption (tokenless, it would
  // flip 404 -> 403 at that commit).
  let agent;
  let csrfToken;

  beforeAll(async () => {
    agent = createAgent(app);
    csrfToken = await getCsrfToken(app, agent);
  });

  describe('unmounted V1 payment routes return 404', () => {
    it('GET /api/v1/payments/config -> 404', async () => {
      const res = await request(app).get('/api/v1/payments/config');
      expect(res.status).toBe(404);
    });

    it('POST /api/v1/payments/create-token -> 404', async () => {
      const res = await agent
        .post('/api/v1/payments/create-token')
        .set('x-csrf-token', csrfToken)
        .send({});
      expect(res.status).toBe(404);
    });

    it('GET /api/v1/payments/check-status/:token -> 404', async () => {
      const res = await request(app).get('/api/v1/payments/check-status/sometoken');
      expect(res.status).toBe(404);
    });

    it('GET /api/v1/payments/pool-stats -> 404', async () => {
      const res = await request(app).get('/api/v1/payments/pool-stats');
      expect(res.status).toBe(404);
    });

    it('GET /api/v1/payment_callback -> 404 (Paygistix callback unmounted)', async () => {
      const res = await request(app).get('/api/v1/payment_callback');
      expect(res.status).toBe(404);
    });
  });

  describe('CSP / server.js scrub', () => {
    it('server.js no longer references the Paygistix gateway origin', () => {
      const src = fs.readFileSync(path.join(__dirname, '../../server.js'), 'utf8');
      expect(src).not.toMatch(/safepay\.paymentlogistics\.net/);
      expect(src).not.toMatch(/callbackPoolManager/);
      expect(src).not.toMatch(/paymentRoutes/);
      expect(src).not.toMatch(/payment_callback/);
      expect(src).not.toMatch(/ENABLE_TEST_PAYMENT_FORM/);
    });

    it('live CSP header carries no Paygistix origin', async () => {
      const res = await request(app).get('/api/v1/environment');
      const csp = res.headers['content-security-policy'] || '';
      expect(csp).not.toMatch(/safepay\.paymentlogistics\.net/);
    });
  });
});
```

- [ ] Run it and confirm it fails for the right reason (routes still mounted → 200/302/400 instead of 404; `server.js` still matches the scrubbed strings):

```bash
npm test -- tests/integration/v1PaymentRemoval.test.js
```

Expected failures: `GET /api/v1/payments/config` returns **200**, `payment_callback` returns **302** (redirect to `/payment-error`), and the source-scan test fails on `safepay.paymentlogistics.net`.

- [ ] Edit `server.js` — six removals, one trim. Quote-exact current code shown for each.

  1. Delete line 31:
  ```javascript
  const paymentRoutes = require('./server/routes/paymentRoutes');
  ```

  2. Delete the callback-pool init block (lines 157-164, inside the mongoose-connect `.then()`):
  ```javascript
        // Initialize Paygistix callback pool
        try {
          const callbackPoolManager = require('./server/services/callbackPoolManager');
          await callbackPoolManager.initializePool();
          logger.info('Paygistix callback pool initialized');
        } catch (error) {
          logger.error('Error initializing callback pool:', { error: error.message });
        }
  ```

  3. Delete line 374 from the CSP `script-src` array (between `'https://cdn.jsdelivr.net',` and `'https://code.jquery.com',`):
  ```javascript
        'https://safepay.paymentlogistics.net',
  ```

  4. Line 411 — trim `form-action` to self only:
  ```javascript
      'form-action': ["'self'", 'https://safepay.paymentlogistics.net'],
  ```
  becomes
  ```javascript
      'form-action': ["'self'"],
  ```

  5. Delete the test-payment-form route (lines 914-920):
  ```javascript
  // Test payment form - only available when explicitly enabled
  if (process.env.ENABLE_TEST_PAYMENT_FORM === 'true') {
    app.get('/test-payment', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'test-payment-form.html'));
    });
    logger.info('Test payment form enabled and available at /test-payment');
  }
  ```

  6. In the `/environment` endpoint (line 930-938), drop the flag — change
  ```javascript
      enableDeleteDataFeature: process.env.ENABLE_DELETE_DATA_FEATURE === 'true',
      enableTestPaymentForm: process.env.ENABLE_TEST_PAYMENT_FORM === 'true'
  ```
  to
  ```javascript
      enableDeleteDataFeature: process.env.ENABLE_DELETE_DATA_FEATURE === 'true'
  ```
  (There is a second, older `/environment` definition near line 969 that has no payment key — leave it.)

  7. Delete the two mounts (line 956 and lines 965-966):
  ```javascript
  apiV1Router.use('/payments', paymentRoutes);
  ```
  ```javascript
  // Paygistix callback route (directly under /api/v1 for the callback)
  apiV1Router.use('/payment_callback', require('./server/routes/generalPaymentCallback'));
  ```

- [ ] Delete the dead integration test (its endpoints now 404):

```bash
git rm tests/integration/payment.test.js
```

- [ ] Run the regression test — expect **pass**:

```bash
npm test -- tests/integration/v1PaymentRemoval.test.js
```

- [ ] Run the full suite — expect green (the only suite that exercised `/api/v1/payments/*` through the app was `tests/integration/payment.test.js`, deleted above; the route/controller *unit* tests require the modules directly and still pass — they die with the modules in Task 3):

```bash
npm test
```

- [ ] Commit:

```bash
git add server.js tests/integration/v1PaymentRemoval.test.js tests/integration/payment.test.js
git commit -m "refactor(payments): unmount V1 Paygistix routes and scrub CSP in server.js

PR 1 of the invite/bag/workflow redesign (spec §7/§12). Removes the
/api/v1/payments and /api/v1/payment_callback mounts, the callback-pool
startup init, the /test-payment dev route, and the
safepay.paymentlogistics.net origin from CSP script-src and form-action.
Adds the removal regression suite; deletes the integration test that
exercised the unmounted endpoints."
```

---

## Task 2: Remove the V1 customer payment endpoints (controller + routes)

The `initiateV2Payment`/`getV2PaymentStatus` pair is Paygistix under the hood (it delegates to `customerPaymentService`, which builds Paygistix hosted-form line items and calls `paymentController`). No other test or module references these exports (verified: `grep -rn "initiateV2Payment\|getV2PaymentStatus" tests/` → no hits).

**Files:**
- Modify: `tests/integration/v1PaymentRemoval.test.js` (append describe block)
- Modify: `server/routes/customerRoutes.js` (lines 154-178)
- Modify: `server/controllers/customerController.js` (lines 572-619)

### Steps

- [ ] Append this describe block inside the top-level `describe('V1 Paygistix removal', ...)` of `tests/integration/v1PaymentRemoval.test.js`:

```javascript
  describe('V1 customer payment endpoints are gone', () => {
    it('POST /api/v1/customers/initiate-payment -> 404', async () => {
      // /api/v1/customers/initiate-payment is on NO csrf-config exemption list,
      // so the global conditionalCsrf default-enforces it: a tokenless POST
      // would 403 before AND after the route removal (the probe could never
      // pass). The agent + x-csrf-token (from the file-level beforeAll) lets
      // the request reach routing, so removal genuinely yields 404.
      const res = await agent
        .post('/api/v1/customers/initiate-payment')
        .set('x-csrf-token', csrfToken)
        .send({ orderId: 'ORD-x' });
      expect(res.status).toBe(404);
    });

    it('GET /api/v1/customers/payment-status/:orderId -> 404', async () => {
      const res = await request(app).get('/api/v1/customers/payment-status/ORD-x');
      expect(res.status).toBe(404);
    });
  });
```

- [ ] Run it — expect the two new tests to fail with **401** (the routes still exist; the CSRF token gets the request past `conditionalCsrf`, then `authenticate` rejects the bearer-less request before 404 can happen). A **403** here means the CSRF wiring is wrong (agent/`x-csrf-token` missing) — fix the test, that is not a valid red:

```bash
npm test -- tests/integration/v1PaymentRemoval.test.js
```

- [ ] Edit `server/routes/customerRoutes.js` — delete the final two route registrations (current file tail, lines 154-178):

```javascript
/**
 * @route   POST /api/customers/initiate-payment
 * @desc    Initiate post-weigh payment for an order
 * @access  Customer only
 */
router.post('/initiate-payment',
  authenticate,
  checkRole(['customer']),
  customerController.initiateV2Payment);

/**
 * @route   GET /api/customers/payment-status/:orderId
 * @desc    Check post-weigh payment status for an order
 * @access  Customer only
 */
router.get('/payment-status/:orderId',
  authenticate,
  checkRole(['customer']),
  customerController.getV2PaymentStatus);

module.exports = router;
```

becomes

```javascript
module.exports = router;
```

- [ ] Edit `server/controllers/customerController.js` — delete the whole payment section (lines 572-619), i.e. everything from the section banner through the tombstone comment, keeping the final `module.exports = exports;`:

```javascript
// ============================================================================
// Post-weigh payment endpoints
// (implementation lives in server/services/customerPaymentService.js)
// ============================================================================

const customerPaymentService = require('../services/customerPaymentService');

/**
 * POST /api/v1/customers/initiate-payment
 */
exports.initiateV2Payment = ControllerHelpers.asyncWrapper(async (req, res) => {
  try {
    await customerPaymentService.initiatePayment({
      customerObjectId: req.user.id,
      orderId: req.body.orderId,
      realRes: res
    });
  } catch (err) {
    if (err.isPaymentError) {
      return ControllerHelpers.sendError(res, err.message, err.status || 400);
    }
    throw err;
  }
});

/**
 * GET /api/v1/customers/payment-status/:orderId
 */
exports.getV2PaymentStatus = ControllerHelpers.asyncWrapper(async (req, res) => {
  try {
    const status = await customerPaymentService.getPaymentStatus({
      orderId: req.params.orderId,
      customerId: req.user.id
    });
    res.json({ success: true, ...status });
  } catch (err) {
    if (err.isPaymentError) {
      return ControllerHelpers.sendError(res, err.message, err.status || 400);
    }
    throw err;
  }
});

// ---------------------------------------------------------------------------
// Old inline implementation — now lives in customerPaymentService.
// The rest of this section used to contain buildPaygistixLineItems,
// buildLineItemsFromOrder, and the 200+ lines of initiate/status logic.
// ---------------------------------------------------------------------------

module.exports = exports;
```

becomes

```javascript
module.exports = exports;
```

- [ ] Run the regression test — expect pass; then the full suite — expect green:

```bash
npm test -- tests/integration/v1PaymentRemoval.test.js
npm test
```

- [ ] Commit:

```bash
git add server/routes/customerRoutes.js server/controllers/customerController.js tests/integration/v1PaymentRemoval.test.js
git commit -m "refactor(payments): remove V1 customer initiate-payment/payment-status endpoints

The pair delegated to customerPaymentService (Paygistix hosted-form line
items). Last live reference to customerPaymentService; its file is deleted
next, with the rest of the V1 stack."
```

---

## Task 3: Delete the V1 payment controllers, services, routes, and config — with their tests

Nothing requires these modules anymore (Tasks 1-2 removed every live `require`); `paymentCallbackRoute.js` was already unmounted dead code. The unit tests that require them directly are deleted in the same commit.

**Files:**
- Modify: `tests/integration/v1PaymentRemoval.test.js` (append describe block)
- Delete:
  - `server/controllers/paymentController.js`
  - `server/services/callbackPoolManager.js`
  - `server/services/paygistix/` (whole dir — contains only `index.js`)
  - `server/services/customerPaymentService.js`
  - `server/services/orderPaymentService.js`
  - `server/config/paygistix.config.js`
  - `server/config/paygistix-forms.json`
  - `server/config/paygistix-forms.README.md`
  - `server/routes/paymentRoutes.js`
  - `server/routes/paymentCallbackRoute.js`
  - `server/routes/generalPaymentCallback.js`
  - `tests/unit/paymentController.test.js`
  - `tests/unit/paymentRoutes.test.js`
  - `tests/unit/paymentRoutes.full.test.js`
  - `tests/unit/paymentRoutes.isolated.test.js`
  - `tests/unit/paymentCallbackRoute.test.js`
  - `tests/unit/generalPaymentCallback.test.js`
  - `tests/unit/paygistixConfig.test.js`
  - `tests/unit/paygistixService.test.js`
  - `tests/unit/callbackPoolManager.test.js`
  - `tests/debug/test-routes-minimal.js` (debug helper requiring `paymentRoutes`; not matched by jest `testMatch` but would break if ever run)

### Steps

- [ ] Append this describe block inside `describe('V1 Paygistix removal', ...)`:

```javascript
  describe('V1 payment modules are deleted', () => {
    it.each([
      '../../server/controllers/paymentController',
      '../../server/services/callbackPoolManager',
      '../../server/services/customerPaymentService',
      '../../server/services/orderPaymentService',
      '../../server/services/paygistix',
      '../../server/config/paygistix.config',
      '../../server/routes/paymentRoutes',
      '../../server/routes/paymentCallbackRoute',
      '../../server/routes/generalPaymentCallback'
    ])('require(%s) throws MODULE_NOT_FOUND', (mod) => {
      expect(() => require(mod)).toThrow(/Cannot find module/);
    });
  });
```

- [ ] Run it — expect the nine new tests to fail (modules still resolve):

```bash
npm test -- tests/integration/v1PaymentRemoval.test.js
```

- [ ] Delete the files (deletions are pre-approved per project rules):

```bash
git rm server/controllers/paymentController.js \
       server/services/callbackPoolManager.js \
       server/services/customerPaymentService.js \
       server/services/orderPaymentService.js \
       server/config/paygistix.config.js \
       server/config/paygistix-forms.json \
       server/config/paygistix-forms.README.md \
       server/routes/paymentRoutes.js \
       server/routes/paymentCallbackRoute.js \
       server/routes/generalPaymentCallback.js
git rm -r server/services/paygistix
git rm tests/unit/paymentController.test.js \
       tests/unit/paymentRoutes.test.js \
       tests/unit/paymentRoutes.full.test.js \
       tests/unit/paymentRoutes.isolated.test.js \
       tests/unit/paymentCallbackRoute.test.js \
       tests/unit/generalPaymentCallback.test.js \
       tests/unit/paygistixConfig.test.js \
       tests/unit/paygistixService.test.js \
       tests/unit/callbackPoolManager.test.js \
       tests/debug/test-routes-minimal.js
```

- [ ] Grep for dangling references to the deleted modules:

```bash
grep -rn "paymentController\|callbackPoolManager\|customerPaymentService\|orderPaymentService\|paygistix\.config\|paygistix-forms\|services/paygistix\|routes/paymentRoutes\|paymentCallbackRoute\|generalPaymentCallback" \
  server.js server/ tests/ scripts/ --include="*.js" --include="*.json"
```

Expected remaining hits (all handled in later tasks, none load-bearing):
  - `server/services/systemHealthService.js` — `paygistix-forms.json` block (Task 5; its `require` sits in a try/catch, so the missing file degrades gracefully, it cannot crash).
  - Nothing else. If anything else appears, stop and fix before committing.

- [ ] Run the regression test (expect pass) and the full suite (expect green):

```bash
npm test -- tests/integration/v1PaymentRemoval.test.js
npm test
```

- [ ] Commit:

```bash
git add -A
git commit -m "refactor(payments): delete V1 Paygistix controllers, services, routes, config

Removes paymentController, callbackPoolManager, paygistix/,
customerPaymentService, orderPaymentService, paygistix.config,
paygistix-forms.json(+README), paymentRoutes, paymentCallbackRoute,
generalPaymentCallback, and their unit tests. All live requires were
removed in the two prior commits; suite stays green."
```

---

## Task 4: Delete the V1 payment models — with their tests, trimming shared tests

`Payment`, `PaymentToken`, `CallbackPool` have no remaining importers in `server/` (verified after Task 3). Three test files exist solely for them; three shared test files reference `Payment` and need surgical trims in the same commit.

**Files:**
- Modify: `tests/integration/v1PaymentRemoval.test.js` (append describe block)
- Delete: `server/models/Payment.js`, `server/models/PaymentToken.js`, `server/models/CallbackPool.js`, `tests/unit/payment.test.js`, `tests/unit/paymentModel.test.js`, `tests/unit/callbackPool.test.js`
- Modify: `tests/unit/modelMethods.test.js` (line 4 require + `describe('Payment Model', ...)` lines 162-234)
- Modify: `tests/unit/modelsAdditional.test.js` (line 3 require + `describe('Payment Model - Helper Methods', ...)` lines 99-156 + the Payment enum test inside `describe('Edge Cases and Error Handling', ...)`)
- Modify: `tests/unit/simpleRouteHandlers.test.js` (line 13 `jest.mock`)

### Steps

- [ ] Append this describe block inside `describe('V1 Paygistix removal', ...)`:

```javascript
  describe('V1 payment models are deleted', () => {
    it.each([
      '../../server/models/Payment',
      '../../server/models/PaymentToken',
      '../../server/models/CallbackPool'
    ])('require(%s) throws MODULE_NOT_FOUND', (mod) => {
      expect(() => require(mod)).toThrow(/Cannot find module/);
    });
  });
```

- [ ] Run it — expect the three new tests to fail (models still resolve):

```bash
npm test -- tests/integration/v1PaymentRemoval.test.js
```

- [ ] Delete the models and their dedicated test files:

```bash
git rm server/models/Payment.js server/models/PaymentToken.js server/models/CallbackPool.js
git rm tests/unit/payment.test.js tests/unit/paymentModel.test.js tests/unit/callbackPool.test.js
```

- [ ] Trim `tests/unit/modelMethods.test.js`. Delete the `describe('Payment Model', ...)` block FIRST (it spans lines 162-233, plus the blank line 234 that separates it from `describe('DataDeletionRequest Model', ...)` at line 235), THEN the now-unused require on line 4 — this order keeps the quoted line numbers valid:

```bash
sed -i '162,234d' tests/unit/modelMethods.test.js
sed -i '4d' tests/unit/modelMethods.test.js
```

Verify the trim landed correctly — line 4 of the result must be `const DataDeletionRequest = ...` and the file must contain no `Payment`:

```bash
sed -n '1,8p' tests/unit/modelMethods.test.js
grep -n "Payment\|paygistix" tests/unit/modelMethods.test.js   # expect: no output
```

- [ ] Trim `tests/unit/modelsAdditional.test.js`. Three edits:

  1. Delete the `describe('Payment Model - Helper Methods', ...)` block (lines 99-156, including the trailing blank line before `describe('Edge Cases and Error Handling', ...)` at line 157):

  ```bash
  sed -i '99,156d' tests/unit/modelsAdditional.test.js
  ```

  2. Inside the remaining `describe('Edge Cases and Error Handling', ...)`, delete the Payment enum test using an exact-match edit (Edit tool, old_string → empty). The test reads:

  ```javascript
    it('should handle invalid enum values', () => {
      const payment = new Payment({
        paymentId: 'PAY001',
        customerId: 'CUST001',
        orderId: 'ORD001',
        paygistixId: 'PG001',
        paymentMethodId: 'PM001',
        amount: 100,
        status: 'invalid_status' // Invalid enum value
      });

      const errors = payment.validateSync();
      expect(errors).toBeDefined();
      expect(errors.errors).toHaveProperty('status');
      expect(errors.errors.status.message).toContain('is not a valid enum value');
    });
  ```

  (Also remove the blank line + `it(` opener cleanly so the `describe` keeps valid syntax — the preceding `it('should handle missing required fields gracefully', ...)` stays.)

  3. Delete line 3:

  ```javascript
  const Payment = require('../../server/models/Payment');
  ```

  Verify:

  ```bash
  grep -n "Payment\|paygistix" tests/unit/modelsAdditional.test.js   # expect: no output
  npx jest tests/unit/modelsAdditional.test.js --listTests           # sanity: file still collected
  ```

- [ ] Trim `tests/unit/simpleRouteHandlers.test.js` — delete line 13:

```javascript
jest.mock('../../server/models/Payment');
```

(`jest.mock` of a missing module throws at collection time, so this line must die in this commit.)

- [ ] Run the touched suites, then the full suite — expect green:

```bash
npm test -- tests/integration/v1PaymentRemoval.test.js tests/unit/modelMethods.test.js tests/unit/modelsAdditional.test.js tests/unit/simpleRouteHandlers.test.js
npm test
```

- [ ] Commit:

```bash
git add -A
git commit -m "refactor(payments): delete Payment, PaymentToken, CallbackPool models

Spec §4.7. Removes the three V1 models, their dedicated test files, and
the Payment references in modelMethods/modelsAdditional/simpleRouteHandlers
shared tests."
```

---

## Task 5: Scrub the remaining server-side references (CSRF exemption, health service, connectivity monitor)

**Files:**
- Modify: `tests/integration/v1PaymentRemoval.test.js` (append describe block)
- Modify: `server/config/csrf-config.js` (line ~146)
- Modify: `server/services/systemHealthService.js` (lines 28, 82-96, 103)
- Modify: `server/monitoring/connectivity-monitor.js` (lines 32-37)

### Steps

- [ ] Append this describe block inside `describe('V1 Paygistix removal', ...)`:

```javascript
  describe('secondary reference scrub', () => {
    it('CSRF registration exemptions no longer include the Paygistix token endpoint', () => {
      const { CSRF_CONFIG } = require('../../server/config/csrf-config');
      expect(CSRF_CONFIG.REGISTRATION_ENDPOINTS).not.toContain('/api/v1/payments/create-token');
    });

    it('systemHealthService no longer reads paygistix-forms.json', () => {
      const src = fs.readFileSync(
        path.join(__dirname, '../../server/services/systemHealthService.js'), 'utf8');
      expect(src).not.toMatch(/paygistix/i);
      expect(src).not.toMatch(/ENABLE_TEST_PAYMENT_FORM/);
    });

    it('connectivity monitor no longer probes the Paygistix gateway', () => {
      const src = fs.readFileSync(
        path.join(__dirname, '../../server/monitoring/connectivity-monitor.js'), 'utf8');
      expect(src).not.toMatch(/Paygistix|safepay/);
    });
  });
```

- [ ] Run it — expect the three new tests to fail (references still present):

```bash
npm test -- tests/integration/v1PaymentRemoval.test.js
```

- [ ] Edit `server/config/csrf-config.js` — in `REGISTRATION_ENDPOINTS`, change

```javascript
    '/api/v1/auth/social/register',
    '/api/v1/auth/customer/social/register',
    // Payment token creation for registration (part of registration flow)
    // Excluded from CSRF due to cross-origin iframe limitations where sessions
    // may not be properly established. Protected by rate limiting and validation.
    '/api/v1/payments/create-token'
  ],
```

to

```javascript
    '/api/v1/auth/social/register',
    '/api/v1/auth/customer/social/register'
  ],
```

  > **CSRF interaction check (deliberate):** removing this exemption flips `/api/v1/payments/create-token` from CSRF-exempt to default-enforced. The Task 1 probe survives this **only because it sends `x-csrf-token` via the shared agent** (see the file-level `beforeAll`) — a tokenless probe would flip from 404 to 403 at this commit and break the suite's green-at-every-commit contract. The regression-test run below re-exercises the Task 1 create-token probe under the new config; if it 403s, the agent/token wiring regressed — fix it in this same commit.

- [ ] Edit `server/services/systemHealthService.js` — three changes:

  1. Line 28, in `ALLOWED_ENV_VARS`, change
  ```javascript
    'SHOW_DOCS', 'ENABLE_TEST_PAYMENT_FORM', 'ENABLE_DELETE_DATA_FEATURE',
  ```
  to
  ```javascript
    'SHOW_DOCS', 'ENABLE_DELETE_DATA_FEATURE',
  ```

  2. Delete the whole Paygistix JSON block (lines 82-96):
  ```javascript
    let paygistixConfig = {};
    try {
      const paygistixForms = require('../config/paygistix-forms.json');
      paygistixConfig = {
        'PAYGISTIX_MERCHANT_ID (from JSON)': paygistixForms.merchantId || 'Not configured',
        'PAYGISTIX_FORM_ID (from JSON)': paygistixForms.form?.formId || 'Not configured',
        'PAYGISTIX_FORM_HASH (from JSON)': superAdmin
          ? (paygistixForms.form?.formHash || 'Not configured')
          : '••••••••',
        'PAYGISTIX_CONFIG_SOURCE': 'paygistix-forms.json'
      };
    } catch (error) {
      paygistixConfig = { 'PAYGISTIX_CONFIG_ERROR': 'Failed to load paygistix-forms.json' };
    }
  ```

  3. In the return statement (line 103), change
  ```javascript
      variables: { ...variables, ...paygistixConfig },
  ```
  to
  ```javascript
      variables,
  ```

- [ ] Edit `server/monitoring/connectivity-monitor.js` — delete the gateway probe entry (lines 32-37) from the `SERVICES` array:

```javascript
  {
    name: 'Paygistix Payment Gateway',
    type: 'https',
    url: 'https://safepay.paymentlogistics.net',
    critical: true,
  },
```

- [ ] Run the regression test (expect pass), then the full suite (expect green — no existing test asserts on the Paygistix env grouping or the monitor entry; verified):

```bash
npm test -- tests/integration/v1PaymentRemoval.test.js
npm test
```

- [ ] Commit:

```bash
git add server/config/csrf-config.js server/services/systemHealthService.js server/monitoring/connectivity-monitor.js tests/integration/v1PaymentRemoval.test.js
git commit -m "refactor(payments): scrub Paygistix from csrf exemptions, health service, connectivity monitor"
```

---

## Task 6: Delete the Paygistix frontend surface

All of these are V1 Paygistix client assets, verified by tracing loaders: the popup credit-card modal (`v2-payment-modal*.js` — "V2" in name only; it submits the Paygistix hosted form to `formActionUrl` and polls `/api/v1/payments/check-status`), the callback handler page the gateway redirected to, the `/payment-success` / `/payment-error` return pages (their ONLY navigator is `payment-callback-handler.js`), the test-form simulator and its three helper scripts (loaded only by `test-payment-form.html`), and the orphaned CSS. `customer-dashboard.js` does not reference `V2PaymentModal` (verified by grep) — removing the script from its pageScripts list is safe.

**Files:**
- Modify: `tests/integration/v1PaymentRemoval.test.js` (append describe block)
- Modify: `public/assets/js/embed-app-v2.js` (lines 47-48, 590-591, 606)
- Modify: `public/assets/js/administrator-dashboard-init.js` (lines 2463, 2466)
- Delete:
  - `public/payment-callback-handler.html`, `public/assets/js/payment-callback-handler.js`
  - `public/payment-success.html`, `public/payment-error.html`
  - `public/payment-success-embed.html`, `public/payment-error-embed.html`
  - `public/assets/js/payment-success.js`, `public/assets/js/payment-error.js`
  - `public/test-payment-form.html`, `public/assets/js/test-payment-form.js`, `public/test-v2-payment.html`
  - `public/assets/js/payment-redirect.js` (auto-submits `#paygistixForm`; no HTML loads it)
  - `public/assets/js/v2-payment-modal.js`, `public/assets/js/v2-payment-modal-fixed.js`
  - `public/assets/js/payment-form.js`, `public/assets/js/payment-service.js`, `public/assets/js/payment-validation.js` (loaded only by `test-payment-form.html`)
  - `public/assets/css/paygistix-payment-form.css`, `public/assets/css/payment-success.css`, `public/assets/css/payment-error.css`, `public/assets/css/payment-redirect.css`, `public/assets/css/payment-styles.css`, `public/assets/css/test-payment-form.css`
- **Keep:** `public/payment-confirmation-embed.html` (V2 page — no Paygistix reference).

### Steps

- [ ] Append this describe block inside `describe('V1 Paygistix removal', ...)`:

```javascript
  describe('frontend Paygistix surface is gone', () => {
    it('embed-app-v2.js no longer maps the Paygistix return pages or modal', () => {
      const src = fs.readFileSync(
        path.join(__dirname, '../../public/assets/js/embed-app-v2.js'), 'utf8');
      expect(src).not.toMatch(/payment-success|payment-error|v2-payment-modal/);
    });

    it('Paygistix client assets are deleted from public/', () => {
      const gone = [
        'public/payment-callback-handler.html',
        'public/payment-success-embed.html',
        'public/payment-error-embed.html',
        'public/test-payment-form.html',
        'public/assets/js/v2-payment-modal.js',
        'public/assets/js/payment-callback-handler.js',
        'public/assets/css/paygistix-payment-form.css'
      ];
      for (const rel of gone) {
        expect(fs.existsSync(path.join(__dirname, '../../', rel))).toBe(false);
      }
    });
  });
```

- [ ] Run it — expect both new tests to fail (maps and files still present):

```bash
npm test -- tests/integration/v1PaymentRemoval.test.js
```

- [ ] Delete the files:

```bash
git rm public/payment-callback-handler.html \
       public/payment-success.html public/payment-error.html \
       public/payment-success-embed.html public/payment-error-embed.html \
       public/test-payment-form.html public/test-v2-payment.html \
       public/assets/js/payment-callback-handler.js \
       public/assets/js/payment-success.js public/assets/js/payment-error.js \
       public/assets/js/test-payment-form.js public/assets/js/payment-redirect.js \
       public/assets/js/v2-payment-modal.js public/assets/js/v2-payment-modal-fixed.js \
       public/assets/js/payment-form.js public/assets/js/payment-service.js \
       public/assets/js/payment-validation.js \
       public/assets/css/paygistix-payment-form.css public/assets/css/payment-success.css \
       public/assets/css/payment-error.css public/assets/css/payment-redirect.css \
       public/assets/css/payment-styles.css public/assets/css/test-payment-form.css
```

- [ ] Edit `public/assets/js/embed-app-v2.js` — three removals (both maps must be touched together — house rule):

  1. In `EMBED_PAGES` (lines 47-48), delete:
  ```javascript
      '/payment-success': '/payment-success-embed.html',
      '/payment-error': '/payment-error-embed.html',
  ```

  2. In `pageScripts` (lines 590-591), delete:
  ```javascript
          '/payment-success': ['/assets/js/payment-success.js'],
          '/payment-error': ['/assets/js/payment-error.js'],
  ```

  3. In the `'/customer-dashboard'` pageScripts entry (line 606), remove the modal script — change
  ```javascript
  '/assets/js/service-area-autocomplete.js', '/assets/js/v2-payment-modal.js', '/assets/js/customer-dashboard.js?v=20250108-5'
  ```
  to
  ```javascript
  '/assets/js/service-area-autocomplete.js', '/assets/js/customer-dashboard.js?v=20250108-5'
  ```

- [ ] Edit `public/assets/js/administrator-dashboard-init.js` — two removals in the env-var category map:

  1. Delete line 2463:
  ```javascript
        'Payment - Paygistix': ['PAYGISTIX_MERCHANT_ID', 'PAYGISTIX_FORM_ID', 'PAYGISTIX_FORM_HASH', 'PAYGISTIX_FORM_ACTION_URL', 'PAYGISTIX_RETURN_URL', 'PAYGISTIX_ENVIRONMENT'],
  ```

  2. Line 2466 — change
  ```javascript
        'Features': ['SHOW_DOCS', 'ENABLE_TEST_PAYMENT_FORM', 'ENABLE_DELETE_DATA_FEATURE', 'CSRF_PHASE', 'RELAX_RATE_LIMITING'],
  ```
  to
  ```javascript
        'Features': ['SHOW_DOCS', 'ENABLE_DELETE_DATA_FEATURE', 'CSRF_PHASE', 'RELAX_RATE_LIMITING'],
  ```

- [ ] Grep for dangling frontend references:

```bash
grep -rn "paygistix\|Paygistix\|safepay\|payment-callback-handler\|v2-payment-modal\|payment-redirect\|test-payment-form\|payment-success\|payment-error" \
  public/ --include="*.html" --include="*.js" --include="*.css" | grep -v node_modules
```

Expected: **no output**. If `payment-confirmation-embed.html` shows up, that's a false positive on a different word — it contains none of these strings (verified).

- [ ] Run the regression test (expect pass) and the full suite (expect green — frontend assets have no jest coverage):

```bash
npm test -- tests/integration/v1PaymentRemoval.test.js
npm test
```

- [ ] Commit:

```bash
git add -A
git commit -m "refactor(payments): delete Paygistix frontend assets and page-map entries

Removes the hosted-form popup modal (v2-payment-modal*), the gateway
callback handler page, the /payment-success and /payment-error return
pages (only navigator was the callback handler), the test-form simulator
and helper scripts, orphaned CSS, and the EMBED_PAGES/pageScripts
entries. Keeps payment-confirmation-embed.html (V2)."
```

---

## Task 7: Drop `PAYGISTIX_*` from `.env.example` — **CONFIRM FIRST**

> **STOP: project rule — production config edits (`.env.example`) require explicit confirmation from Rick before editing.** Ask before executing this task. If not approved, skip it and note the deferral in the PR description; everything else in this PR stands alone.

**Files:**
- Modify: `.env.example` (lines 8, 114-126)

### Steps

- [ ] Get explicit confirmation to edit `.env.example`.
- [ ] Delete line 8:

```bash
ENABLE_TEST_PAYMENT_FORM=false
```

- [ ] Delete the Paygistix block (lines 114-126 — the comment header, the security note, and the six vars):

```bash
# Paygistix Configuration (V1 — scheduled for removal in refactor Phase 2)
# SECURITY NOTE: Previously real credentials lived in this file and were
# committed to a public repo. Treat as compromised until the operations
# team has rotated them with Paygistix support, OR Phase 2 deletes V1
# payment code entirely. Do NOT paste live credentials into this template
# again — keep production values in `.env` (gitignored) only.
PAYGISTIX_MERCHANT_ID=your_paygistix_merchant_id
PAYGISTIX_FORM_ID=your_paygistix_form_id
PAYGISTIX_FORM_HASH=your_paygistix_form_hash
PAYGISTIX_FORM_ACTION_URL=https://safepay.paymentlogistics.net/transaction.asp
PAYGISTIX_RETURN_URL=https://your-domain.example/api/v1/payment_callback
PAYGISTIX_ENVIRONMENT=production
```

(Keep the blank line so `# Service Area Configuration` stays separated.)

- [ ] Verify and run the suite:

```bash
grep -n "PAYGISTIX\|ENABLE_TEST_PAYMENT_FORM" .env.example   # expect: no output
npm test
```

- [ ] Commit:

```bash
git add .env.example
git commit -m "chore(env): drop PAYGISTIX_* and ENABLE_TEST_PAYMENT_FORM from .env.example

V1 Paygistix is deleted; the env template no longer advertises its
credentials. (Rotation note obsolete — the integration is gone.)"
```

---

## Verification

- [ ] Full suite green:

```bash
npm test
```

- [ ] No circular deps introduced (project gate):

```bash
npx madge --circular server/
```

Expected: `No circular dependency found!` (or no *new* cycles vs. main).

- [ ] Lint clean on touched files:

```bash
npx eslint server.js server/config/csrf-config.js server/services/systemHealthService.js server/monitoring/connectivity-monitor.js server/controllers/customerController.js server/routes/customerRoutes.js
```

- [ ] Final repo-wide sweep — the ONLY acceptable remaining matches are docs (`docs/**`, `.claude/CLAUDE.md`, `CLAUDE.md`, `tasks/**`), the field-level comments at `server/models/Customer.js:70` / `server/models/Order.js:104` (those fields are removed in PR 2/PR 4), and `scripts/admin/rotate-credentials.sh` (ops note):

```bash
grep -rn "paygistix\|Paygistix\|PAYGISTIX\|safepay" --include="*.js" --include="*.json" --include="*.html" --include="*.css" \
  server.js server/ public/ tests/ scripts/ | grep -v node_modules
```

- [ ] Manual smoke (no DB needed — module-load check proves no dangling requires at boot):

```bash
node -e "process.env.NODE_ENV='test'; require('./server.js'); console.log('server module loads clean');"
```

- [ ] Verify V2 stack untouched:

```bash
git diff main --stat -- server/services/paymentLinkService.js server/services/paymentEmailScanner.js server/services/imapEmailScanner.js server/jobs/paymentVerificationJob.js server/jobs/scheduler.js
```

Expected: no output (zero diff).

### PR description

```
## PR 1 — Remove V1 Paygistix

First PR of the invite/bag/workflow redesign
(docs/superpowers/specs/2026-06-08-invite-bag-workflow-redesign-design.md §7, §12).

Deletes the V1 Paygistix payment stack end to end:

- **Routes/mounts:** /api/v1/payments, /api/v1/payment_callback, /test-payment
  unmounted; paymentRoutes, paymentCallbackRoute (already-dead),
  generalPaymentCallback deleted.
- **Controller/services:** paymentController, callbackPoolManager, paygistix/,
  customerPaymentService, orderPaymentService deleted; the
  initiate-payment / payment-status customer endpoints (Paygistix hosted-form
  under the hood) removed from customerController/customerRoutes.
- **Models:** Payment, PaymentToken, CallbackPool deleted (spec §4.7).
- **Config:** paygistix.config.js, paygistix-forms.json(+README) deleted;
  safepay.paymentlogistics.net removed from CSP script-src and form-action;
  /api/v1/payments/create-token CSRF exemption removed; health-service and
  connectivity-monitor probes scrubbed.
- **Frontend:** Paygistix popup modal (v2-payment-modal*), callback-handler
  page, /payment-success + /payment-error return pages, test-form simulator,
  and orphaned CSS deleted; EMBED_PAGES/pageScripts entries removed.
- **Tests:** all V1 payment test files deleted with their subjects; shared
  model tests trimmed; new removal-regression suite
  (tests/integration/v1PaymentRemoval.test.js) pins 404s on every removed
  endpoint, MODULE_NOT_FOUND on every deleted module, and the CSP scrub.

**Not touched (later PRs):** V2 payment stack (paymentLinkService,
paymentEmailScanner, imapEmailScanner, paymentVerificationJob) — zero diff;
Order/Customer field removals (PR 2/PR 4); SystemConfig key retirement (PR 3).

Suite green at every commit; no --forceExit changes; no new madge cycles.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```
