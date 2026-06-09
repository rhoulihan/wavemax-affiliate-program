# PR 9 — State-Driven Advance/Scan-Out, Role Codes, Door Delivery & Re-Intake Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the second half of the order lifecycle — operator scan-2/scan-3 via a state-driven `advance` engine (kiosk JWT + overloaded bag URL with operator code), door delivery confirmation via customer PIN / affiliate code with commission realized at `delivered` only, and re-intake of a `picked_up` bag — all authorized by three new hashed role codes.

**Architecture:** Three role codes (customer `deliveryPinHash` PBKDF2, affiliate `affiliateDeliveryCodeHash` PBKDF2, operator `scanCodeHmac` HMAC-unique-indexed) gate the public bag-URL mutations; the kiosk keeps operator JWT. One new service `server/modules/orders/orderAdvanceService.js` owns `in_progress→processed` (ready gate runs after) and `ready_for_pickup→picked_up` (rotates + emails the customer PIN); a new `server/services/affiliateDeliveryService.js` owns `picked_up→delivered` (code-verified against the order's own customer/affiliate, constant-time, lockout-protected); `orderIntakeService`'s re-intake branch auto-delivers a `picked_up` order (`method:'reintake'`) before opening a new one. The customer claim resolver gains `{ status, awaitingDelivery, nextAction }` (reusing PR 7's `openOrderContext` helper, already live on the bags resolver) so the claim page can branch claim / deliver / status / re-intake.

**Tech Stack:** Node/Express, Mongoose, Jest + Supertest (MongoMemoryServer fallback), express-rate-limit 7.1.4 + in-house `rateLimitMongoStore` (reused for the per-bag/IP attempt lockout), existing email dispatcher (`loadTemplate`/`fillTemplate`, `[PLACEHOLDER]` tokens), Winston logger, `logAuditEvent`.

**Assumed starting state (PRs 1–8 merged):**

- **PR 1/2:** V1 Paygistix, scheduling, Pickup Now, BetaRequest removed. (`affiliateController.submitBetaRequest`/`BetaRequest` import gone; `operatorRoutes` no longer trusts `pickupDate`.)
- **PR 3:** SystemConfig seeds `delivery_code_max_attempts` (5), `operator_scan_code_max_attempts` (5), `operator_scan_code_length` (8), `customer_delivery_pin_length` (6), `affiliate_delivery_code_length` (6), `store_pickup_address`, payment keys.
- **PR 4:** `Order` has the new enum `['in_progress','processed','ready_for_pickup','picked_up','delivered','cancelled']`, top-level `bagId`/`bagToken`, one-element `bags[]` using **`bagToken`** (never `bagId` inside `bags[]`) with sub-status enum `['intake','processed','picked_up','delivered']` and `scannedAt`/`scannedBy` keyed by those stages, `intake{...}` snapshot, `proofOfDelivery{...}`, `commissionRealized`/`commissionRealizedAt`, `paymentEscalated`/`holdNoticeSentAt`/`heldAtStore`, `readyForPickupAt`/`pickedUpAt`/`deliveredAt`. Pre-save stamps lifecycle timestamps set-once (NOT `readyForPickupAt`). `server/modules/orders/orderStateMachine.js` exports `TRANSITIONS`, `canTransition(from,to)`, `applyTransition(order,to)`, `maybeReadyForPickup(order,ctx)` (thin delegate). `server/services/orderReadyGateService.js` exports `applyReadyGate(order, { trigger })` — idempotent, sole writer of `readyForPickupAt`, toggles `heldAtStore`, sends `sendOrderReadyNotification`.
- **PR 5:** `server/modules/onboarding/AffiliateInvite.js` (statics `hashToken(raw)` = sha256 hex, `consume(rawToken,{affiliateId})`), `inviteService`, and the invite-bound `affiliateController.registerAffiliate` (consumes `req.body.inviteToken`, forces email from invite).
- **PR 6:** `server/modules/bags/Bag.js` (`bagId` `'BAG-'+uuidv4`, raw `token` 32-hex, `tokenHash` HMAC-SHA256 keyed `ENCRYPTION_KEY` UNIQUE — statics `hashToken(raw)`, `claim(token, customerId)` claimable only from `'issued'`), `server/modules/bags/bagService.js` (`mintBatch`, `issueBatch`, `resolveByToken`, `claim`, `linkToOrderAtIntake`, `getInventory`), `server/routes/bagRoutes.js` mounted at `/api/v1/bags`, `server/services/bagClaimService.js` (`resolveClaimToken(bagToken)` → `{state:'claimable'|'claimed'|'invalid', bag, affiliate, order?}`, `claimForCustomer(bag, customerId)`), the reworked `customerRegistrationService.registerCustomer` (bag-derived `affiliateId`, compensating delete on race loss), `public/claim-embed.html` + `public/assets/js/claim.js`, `/claim` registered in `EMBED_PAGES` + `pageScripts` + `excludedRoutes`.
- **PR 7:** `server/modules/orders/orderIntakeService.js` `createOrderFromBag({ bagToken, weight, addOns, freshAddOnsFormPlaced, operatorId, req })` per spec §6.4 (rejects non-active bag `409 bag_not_active`, open at-store order `409 order_already_open`, sets `feeBreakdown` before save, generates payment links once, sends `sendV2PaymentRequest`); kiosk `POST /api/v1/operators/intake`; `operatorBagWorkflowService.parseCustomerQr` deleted. **Also from PR 7:** `server/modules/orders/openOrderContext.js` (`getOpenOrderContext(bagId)` → `{ order:{status,awaitingDelivery,nextAction}|null, nextAction }`) already wired into `bagService.resolveByToken`/`bagController.resolveBag` (PR 7 Task 8b) — this PR's Task 11 only extends the CLAIM resolver with it; and `exports.sendCustomerDeliveredEmail(customer, order)` in `dispatcher/customer.js` (best-effort, never throws, uppercase-token root template `customer-order-delivered.html`) — this PR's Task 5 EXTENDS it in place, never re-creates it.
- **PR 8:** `paymentVerificationJob` retuned (60-min cadence / cap 8 / `sendV2ComeToStoreNotice` / `paymentEscalated`), both verify paths call `applyReadyGate`.

Where a step modifies a PR 5–8 file that is not in the pre-PR-1 tree, the plan quotes the spec-canonical interface and marks the insertion point descriptively — locate it with the given `grep` before editing. Everything else quotes the real current code.

**Conventions used by every task below:**

- Test commands: `npm test -- tests/path/file.test.js`. Integration tests use `const app = require('../../server');`, `const { getCsrfToken, createAgent } = require('../helpers/csrfHelper');` (signature `getCsrfToken(app, agent)`), and send the token as `.set('x-csrf-token', csrfToken)`.
- `tests/setup.js` already runs `SystemConfig.initializeDefaults()` per test and sets `ENCRYPTION_KEY`.
- Money assertions: `toBeCloseTo(x, 2)`. Mock email with `jest.mock('../../server/utils/emailService')` BEFORE requiring app/services.
- Controllers: `ControllerHelpers.asyncWrapper` + `sendSuccess(res, data, message, status)` / `sendError(res, message, status, errors)` (error body `{ success:false, message, errors }`).
- Never log raw bag tokens or codes.

---

## Task 1 — Role-code utility + new audit-event constants

**Files:**
- Create: `tests/unit/roleCodes.test.js`
- Create: `server/utils/roleCodes.js`
- Modify: `server/utils/auditLogger.js` (AuditEvents object, after `ORDER_STATUS_CHANGED: 'ORDER_STATUS_CHANGED',` at line 75)

- [ ] **1.1 Write the failing test** — `tests/unit/roleCodes.test.js`:

```javascript
const roleCodes = require('../../server/utils/roleCodes');

describe('roleCodes utility', () => {
  test('generateCode returns unambiguous alphanumeric of requested length', () => {
    for (const len of [6, 8, 10]) {
      const code = roleCodes.generateCode(len);
      expect(code).toHaveLength(len);
      // No ambiguous chars: I, L, O, 0, 1
      expect(code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]+$/);
    }
  });

  test('generateCode is random (no duplicates across 50 draws)', () => {
    const seen = new Set();
    for (let i = 0; i < 50; i++) seen.add(roleCodes.generateCode(8));
    expect(seen.size).toBe(50);
  });

  test('hashCode/verifyCode round-trip, case- and whitespace-insensitive input', () => {
    const code = roleCodes.generateCode(6);
    const stored = roleCodes.hashCode(code);
    expect(stored).not.toContain(code);
    expect(stored).toMatch(/^[a-f0-9]+:[a-f0-9]+$/); // hash:salt
    expect(roleCodes.verifyCode(code, stored)).toBe(true);
    expect(roleCodes.verifyCode(`  ${code.toLowerCase()} `, stored)).toBe(true);
    expect(roleCodes.verifyCode('WRONG9', stored)).toBe(false);
    expect(roleCodes.verifyCode(code, null)).toBe(false);
    expect(roleCodes.verifyCode(code, 'garbage-no-colon')).toBe(false);
  });

  test('hmacCode is deterministic, keyed, and normalizes input', () => {
    const a = roleCodes.hmacCode('ABC234');
    expect(a).toMatch(/^[a-f0-9]{64}$/);
    expect(roleCodes.hmacCode('abc234 ')).toBe(a);
    expect(roleCodes.hmacCode('ABC235')).not.toBe(a);
  });

  test('new audit event constants exist', () => {
    const { AuditEvents } = require('../../server/utils/auditLogger');
    for (const ev of ['OPERATOR_SCAN', 'ORDER_REINTAKE', 'DELIVERY_CONFIRMED',
      'DELIVERY_CODE_FAILED', 'OPERATOR_CODE_FAILED', 'DELIVERY_CODE_RESET',
      'CUSTOMER_PIN_RESET', 'OPERATOR_SCAN_CODE_RESET']) {
      expect(AuditEvents[ev]).toBe(ev);
    }
  });
});
```

- [ ] **1.2 Run it** — `npm test -- tests/unit/roleCodes.test.js` → expect FAIL: `Cannot find module '../../server/utils/roleCodes'`.

- [ ] **1.3 Implement** — Create `server/utils/roleCodes.js`:

```javascript
// Role-code utilities — short human-entered secrets for the overloaded bag URL.
//
// Three codes use this module (spec §4.5/4.6/4.8, §6.6):
//   - Customer delivery PIN   -> hashCode/verifyCode (PBKDF2, stored "hash:salt")
//   - Affiliate delivery code -> hashCode/verifyCode (PBKDF2, stored "hash:salt")
//   - Operator scan code      -> hmacCode (HMAC-SHA256 keyed by ENCRYPTION_KEY,
//                                unique-indexed for O(1) identify-and-verify)
//
// None of these is an account password. Codes are normalized (trim + upper)
// before hashing so phone keyboards can't cause false mismatches.

const crypto = require('crypto');
const { hashPassword, verifyPassword } = require('./encryption');

// Unambiguous alphabet: A-Z minus I/L/O, digits minus 0/1 (31 chars).
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function normalizeCode(code) {
  return String(code || '').trim().toUpperCase();
}

/**
 * Generate an unambiguous alphanumeric code.
 * @param {number} length - code length (from SystemConfig, e.g. 6 or 8)
 * @returns {string}
 */
function generateCode(length) {
  let out = '';
  for (let i = 0; i < length; i++) {
    out += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)]; // unbiased
  }
  return out;
}

/**
 * PBKDF2-hash a code for at-rest storage. Returns "hash:salt" (single field).
 */
function hashCode(code) {
  const { salt, hash } = hashPassword(normalizeCode(code));
  return `${hash}:${salt}`;
}

/**
 * Constant-time verify of a code against a stored "hash:salt" value.
 */
function verifyCode(code, stored) {
  if (!stored || typeof stored !== 'string' || !stored.includes(':')) return false;
  const [hash, salt] = stored.split(':');
  if (!hash || !salt) return false;
  try {
    return verifyPassword(normalizeCode(code), salt, hash);
  } catch (_e) {
    return false;
  }
}

/**
 * HMAC-SHA256 of a code keyed by ENCRYPTION_KEY (hex) — the operator
 * scan-code lookup key (Operator.scanCodeHmac, unique-indexed).
 */
function hmacCode(code) {
  return crypto
    .createHmac('sha256', Buffer.from(process.env.ENCRYPTION_KEY, 'hex'))
    .update(normalizeCode(code))
    .digest('hex');
}

module.exports = { generateCode, hashCode, verifyCode, hmacCode, normalizeCode, CODE_ALPHABET };
```

- [ ] **1.4 Add audit constants** — In `server/utils/auditLogger.js`, the AuditEvents object currently reads (lines 73–75):

```javascript
  ORDER_CREATED: 'ORDER_CREATED',
  ORDER_CANCELLED: 'ORDER_CANCELLED',
  ORDER_STATUS_CHANGED: 'ORDER_STATUS_CHANGED',
```

Insert immediately after the `ORDER_STATUS_CHANGED` line:

```javascript
  // Bag-workflow scan / delivery / role-code events (PR 9)
  OPERATOR_SCAN: 'OPERATOR_SCAN',
  ORDER_REINTAKE: 'ORDER_REINTAKE',
  DELIVERY_CONFIRMED: 'DELIVERY_CONFIRMED',
  DELIVERY_CODE_FAILED: 'DELIVERY_CODE_FAILED',
  OPERATOR_CODE_FAILED: 'OPERATOR_CODE_FAILED',
  DELIVERY_CODE_RESET: 'DELIVERY_CODE_RESET',
  CUSTOMER_PIN_RESET: 'CUSTOMER_PIN_RESET',
  OPERATOR_SCAN_CODE_RESET: 'OPERATOR_SCAN_CODE_RESET',
```

- [ ] **1.5 Run again** — `npm test -- tests/unit/roleCodes.test.js` → expect PASS (all 5 tests).
- [ ] **1.6 Commit:**

```bash
git add server/utils/roleCodes.js server/utils/auditLogger.js tests/unit/roleCodes.test.js
git commit -m "feat(codes): role-code utility (generate/hash/verify/hmac) + scan/delivery audit events"
```

---

## Task 2 — Customer delivery PIN: schema, generation at claim, status/reset endpoints

**Files:**
- Create: `tests/integration/customerDeliveryPin.test.js`
- Modify: `server/models/Customer.js` (after `lockUntil: Date,` at line 86)
- Modify: `server/services/bagClaimService.js` (PR 6 file — `claimForCustomer`)
- Modify: `server/controllers/customerController.js` (new exports at end of file)
- Modify: `server/routes/customerRoutes.js` (new routes)

- [ ] **2.1 Write the failing test** — `tests/integration/customerDeliveryPin.test.js`:

```javascript
jest.mock('../../server/utils/emailService');

const request = require('supertest');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const app = require('../../server');
const Customer = require('../../server/models/Customer');
const Bag = require('../../server/modules/bags/Bag');
const bagClaimService = require('../../server/services/bagClaimService');
const encryptionUtil = require('../../server/utils/encryption');
const roleCodes = require('../../server/utils/roleCodes');
const { getCsrfToken, createAgent } = require('../helpers/csrfHelper');

jest.setTimeout(60000);

async function createCustomer(overrides = {}) {
  const { salt, hash } = encryptionUtil.hashPassword('TestPassword417!');
  return Customer.create({
    affiliateId: 'AFF-pin-test',
    firstName: 'Pin', lastName: 'Holder',
    email: `pin${Date.now()}${Math.random().toString(36).slice(2, 6)}@example.com`,
    phone: '5125551234', address: '1 Main St', city: 'Austin', state: 'TX', zipCode: '78701',
    username: `pinuser${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
    passwordSalt: salt, passwordHash: hash,
    ...overrides
  });
}

function customerToken(customer) {
  return jwt.sign(
    { id: customer._id.toString(), customerId: customer.customerId, role: 'customer' },
    process.env.JWT_SECRET, { expiresIn: '1h' }
  );
}

describe('Customer delivery PIN', () => {
  test('claimForCustomer generates a PIN (hash + setAt) on the claiming customer', async () => {
    const token = encryptionUtil.generateToken(16);
    const bag = await Bag.create({
      token, tokenHash: Bag.hashToken(token),
      affiliateId: 'AFF-pin-test', status: 'issued', batchId: 'BATCH-pin-test'
    });
    const customer = await createCustomer();
    await bagClaimService.claimForCustomer(bag, customer.customerId);

    const reloaded = await Customer.findOne({ customerId: customer.customerId })
      .select('+deliveryPinHash');
    expect(reloaded.deliveryPinHash).toMatch(/^[a-f0-9]+:[a-f0-9]+$/);
    expect(reloaded.deliveryPinSetAt).toBeInstanceOf(Date);
  });

  test('GET /delivery-pin returns status for self, 403 for another customer', async () => {
    const customer = await createCustomer({
      deliveryPinHash: roleCodes.hashCode('ABC234'), deliveryPinSetAt: new Date()
    });
    const other = await createCustomer();

    const ok = await request(app)
      .get(`/api/v1/customers/${customer.customerId}/delivery-pin`)
      .set('Authorization', `Bearer ${customerToken(customer)}`);
    expect(ok.status).toBe(200);
    expect(ok.body.deliveryPinSet).toBe(true);
    expect(ok.body.deliveryPinSetAt).toBeTruthy();
    expect(JSON.stringify(ok.body)).not.toContain('ABC234');

    const forbidden = await request(app)
      .get(`/api/v1/customers/${customer.customerId}/delivery-pin`)
      .set('Authorization', `Bearer ${customerToken(other)}`);
    expect(forbidden.status).toBe(403);
  });

  test('POST /delivery-pin/reset (self, CSRF) returns a new PIN once and invalidates the old one', async () => {
    const customer = await createCustomer({
      deliveryPinHash: roleCodes.hashCode('OLDPIN'), deliveryPinSetAt: new Date(Date.now() - 1000)
    });
    const agent = createAgent(app);
    const csrfToken = await getCsrfToken(app, agent);

    const res = await agent
      .post(`/api/v1/customers/${customer.customerId}/delivery-pin/reset`)
      .set('Authorization', `Bearer ${customerToken(customer)}`)
      .set('x-csrf-token', csrfToken)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.deliveryPin).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);

    const reloaded = await Customer.findOne({ customerId: customer.customerId })
      .select('+deliveryPinHash');
    expect(roleCodes.verifyCode(res.body.deliveryPin, reloaded.deliveryPinHash)).toBe(true);
    expect(roleCodes.verifyCode('OLDPIN', reloaded.deliveryPinHash)).toBe(false);
  });

  test('reset without CSRF token is rejected', async () => {
    const customer = await createCustomer();
    const res = await request(app)
      .post(`/api/v1/customers/${customer.customerId}/delivery-pin/reset`)
      .set('Authorization', `Bearer ${customerToken(customer)}`)
      .send({});
    expect(res.status).toBe(403);
  });
});
```

- [ ] **2.2 Run it** — `npm test -- tests/integration/customerDeliveryPin.test.js` → expect FAIL: first test fails because `deliveryPinHash` is undefined after claim (schema field + hook missing); the GET/POST tests fail with 404 (routes missing).

- [ ] **2.3 Schema fields** — In `server/models/Customer.js` insert after `lockUntil: Date,` (line 86):

```javascript
  // Delivery PIN — short code the customer enters at the door to confirm
  // receipt (spec §4.5/§6.6). Verified only against THIS order's customer.
  // Stored as "pbkdf2hash:salt" via utils/roleCodes.hashCode; rotated at each
  // operator scan-out so the plaintext can ride in the "on the way" email
  // while only a hash exists at rest. NOT a login credential.
  deliveryPinHash: { type: String, select: false },
  deliveryPinSetAt: Date,
```

- [ ] **2.4 Generate at claim** — In `server/services/bagClaimService.js` (PR 6 file; locate with `grep -n "claimForCustomer" server/services/bagClaimService.js`), inside `claimForCustomer(bag, customerId)` **immediately after the successful `Bag.claim(...)` call** (the non-null return / before the function returns the claimed bag), insert:

```javascript
  // PR 9: every claim provisions the customer's delivery PIN (spec §4.5).
  // Covers both the traditional and OAuth claim paths in one hook point.
  const SystemConfig = require('../models/SystemConfig');
  const roleCodes = require('../utils/roleCodes');
  const Customer = require('../models/Customer');
  const pinLength = await SystemConfig.getValue('customer_delivery_pin_length', 6);
  const deliveryPin = roleCodes.generateCode(pinLength);
  await Customer.updateOne(
    { customerId },
    { $set: { deliveryPinHash: roleCodes.hashCode(deliveryPin), deliveryPinSetAt: new Date() } }
  );
```

(If the file already imports `SystemConfig`/`Customer` at the top, use those imports instead of inline requires — move the `roleCodes` require to the top with the others.)

- [ ] **2.5 Controller** — Append to `server/controllers/customerController.js` (it already imports `Customer`, `ControllerHelpers`; add at top if missing: `const SystemConfig = require('../models/SystemConfig');`, `const roleCodes = require('../utils/roleCodes');`, `const { logAuditEvent, AuditEvents } = require('../utils/auditLogger');`):

```javascript
/**
 * GET /api/v1/customers/:customerId/delivery-pin — PIN status (self only).
 * Plaintext is never returned here; it is shown once, only on reset (§5).
 */
exports.getDeliveryPinStatus = ControllerHelpers.asyncWrapper(async (req, res) => {
  const { customerId } = req.params;
  if (req.user.role === 'customer' && req.user.customerId !== customerId) {
    return ControllerHelpers.sendError(res, 'Unauthorized', 403);
  }
  const customer = await Customer.findOne({ customerId }).select('+deliveryPinHash');
  if (!customer) return ControllerHelpers.sendError(res, 'Customer not found', 404);
  ControllerHelpers.sendSuccess(res, {
    deliveryPinSet: !!customer.deliveryPinHash,
    deliveryPinSetAt: customer.deliveryPinSetAt || null
  }, 'Delivery PIN status');
});

/**
 * POST /api/v1/customers/:customerId/delivery-pin/reset — regenerate (self, CSRF).
 * Returns the new plaintext PIN exactly once.
 */
exports.resetDeliveryPin = ControllerHelpers.asyncWrapper(async (req, res) => {
  const { customerId } = req.params;
  if (req.user.role === 'customer' && req.user.customerId !== customerId) {
    return ControllerHelpers.sendError(res, 'Unauthorized', 403);
  }
  const customer = await Customer.findOne({ customerId });
  if (!customer) return ControllerHelpers.sendError(res, 'Customer not found', 404);

  const pinLength = await SystemConfig.getValue('customer_delivery_pin_length', 6);
  const deliveryPin = roleCodes.generateCode(pinLength);
  customer.deliveryPinHash = roleCodes.hashCode(deliveryPin);
  customer.deliveryPinSetAt = new Date();
  await customer.save();

  logAuditEvent(AuditEvents.CUSTOMER_PIN_RESET, { customerId, userId: req.user.id }, req);
  ControllerHelpers.sendSuccess(res, {
    deliveryPin,
    deliveryPinSetAt: customer.deliveryPinSetAt
  }, 'Delivery PIN reset');
});
```

- [ ] **2.6 Routes** — In `server/routes/customerRoutes.js`, after the `router.get('/:customerId/dashboard', ...)` line (line 130 in the pre-PR tree; adjust to wherever the authenticated `:customerId` GET block sits), add (the file already imports `authenticate` and `authorize`; add `const { sensitiveOperationLimiter } = require('../middleware/rateLimiting');` at the top if absent):

```javascript
// Delivery PIN (PR 9) — status is self-readable; reset regenerates and
// returns the plaintext exactly once. CSRF enforced by default on the POST.
router.get('/:customerId/delivery-pin', authenticate, authorize(['customer', 'administrator', 'admin']), customerController.getDeliveryPinStatus);
router.post('/:customerId/delivery-pin/reset', authenticate, authorize(['customer']), sensitiveOperationLimiter, customerController.resetDeliveryPin);
```

- [ ] **2.7 Run again** — `npm test -- tests/integration/customerDeliveryPin.test.js` → expect PASS (4 tests).
- [ ] **2.8 Commit:**

```bash
git add server/models/Customer.js server/services/bagClaimService.js server/controllers/customerController.js server/routes/customerRoutes.js tests/integration/customerDeliveryPin.test.js
git commit -m "feat(codes): customer delivery PIN — generated at claim, self status/reset endpoints"
```

---

## Task 3 — Affiliate delivery code: schema, generation at invited registration, status/reset endpoints

**Files:**
- Create: `tests/integration/affiliateDeliveryCode.test.js`
- Modify: `server/models/Affiliate.js` (after `perBagDeliveryFee` block, line 66)
- Modify: `server/controllers/affiliateController.js` (`registerAffiliate` + new exports)
- Modify: `server/routes/affiliateRoutes.js` (new routes)

- [ ] **3.1 Write the failing test** — `tests/integration/affiliateDeliveryCode.test.js`:

```javascript
jest.mock('../../server/utils/emailService');

const request = require('supertest');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const app = require('../../server');
const Affiliate = require('../../server/models/Affiliate');
const AffiliateInvite = require('../../server/modules/onboarding/AffiliateInvite');
const encryptionUtil = require('../../server/utils/encryption');
const roleCodes = require('../../server/utils/roleCodes');
const { getCsrfToken, createAgent } = require('../helpers/csrfHelper');

jest.setTimeout(60000);

async function createAffiliate(overrides = {}) {
  const { salt, hash } = encryptionUtil.hashPassword('TestPassword417!');
  return Affiliate.create({
    firstName: 'Del', lastName: 'Iverer',
    email: `aff${Date.now()}${Math.random().toString(36).slice(2, 6)}@example.com`,
    phone: '5125551234', businessName: 'Del Iverer LLC',
    address: '2 Main St', city: 'Austin', state: 'TX', zipCode: '78701',
    serviceLatitude: 30.27, serviceLongitude: -97.74, // ignored if PR 2 removed them
    username: `affuser${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
    passwordSalt: salt, passwordHash: hash, paymentMethod: 'check',
    ...overrides
  });
}

function affiliateToken(affiliate) {
  return jwt.sign(
    { id: affiliate._id.toString(), affiliateId: affiliate.affiliateId, role: 'affiliate' },
    process.env.JWT_SECRET, { expiresIn: '1h' }
  );
}

describe('Affiliate delivery code', () => {
  test('invited registration provisions the code and returns it once', async () => {
    const rawInvite = encryptionUtil.generateToken(32);
    await AffiliateInvite.create({
      inviteId: `INV-test-${Date.now()}`,
      tokenHash: AffiliateInvite.hashToken(rawInvite),
      email: 'invited.affiliate@example.com',
      status: 'pending',
      expiresAt: new Date(Date.now() + 3600 * 1000),
      createdBy: new mongoose.Types.ObjectId()
    });

    const res = await request(app)
      .post('/api/v1/affiliates/register')
      .send({
        inviteToken: rawInvite,
        firstName: 'Invited', lastName: 'Affiliate',
        email: 'tampered@example.com', // ignored — invite email wins (PR 5)
        phone: '5125550000', businessName: 'Invited LLC',
        address: '3 Main St', city: 'Austin', state: 'TX', zipCode: '78701',
        serviceLatitude: 30.27, serviceLongitude: -97.74,
        username: `invited${Date.now()}`,
        password: 'StrongPassword417!',
        paymentMethod: 'check',
        languagePreference: 'en'
      });

    expect(res.status).toBe(201);
    expect(res.body.deliveryCode).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);

    const saved = await Affiliate.findOne({ email: 'invited.affiliate@example.com' })
      .select('+affiliateDeliveryCodeHash');
    expect(saved).toBeTruthy();
    expect(roleCodes.verifyCode(res.body.deliveryCode, saved.affiliateDeliveryCodeHash)).toBe(true);
    expect(saved.affiliateDeliveryCodeSetAt).toBeInstanceOf(Date);
  });

  test('GET /delivery-code returns status for self, 403 for another affiliate', async () => {
    const affiliate = await createAffiliate({
      affiliateDeliveryCodeHash: roleCodes.hashCode('CODE99'),
      affiliateDeliveryCodeSetAt: new Date()
    });
    const other = await createAffiliate();

    const ok = await request(app)
      .get(`/api/v1/affiliates/${affiliate.affiliateId}/delivery-code`)
      .set('Authorization', `Bearer ${affiliateToken(affiliate)}`);
    expect(ok.status).toBe(200);
    expect(ok.body.deliveryCodeSet).toBe(true);
    expect(JSON.stringify(ok.body)).not.toContain('CODE99');

    const forbidden = await request(app)
      .get(`/api/v1/affiliates/${affiliate.affiliateId}/delivery-code`)
      .set('Authorization', `Bearer ${affiliateToken(other)}`);
    expect(forbidden.status).toBe(403);
  });

  test('POST /delivery-code/reset regenerates, returns plaintext once, kills the old code', async () => {
    const affiliate = await createAffiliate({
      affiliateDeliveryCodeHash: roleCodes.hashCode('OLDCDE'),
      affiliateDeliveryCodeSetAt: new Date(Date.now() - 1000)
    });
    const agent = createAgent(app);
    const csrfToken = await getCsrfToken(app, agent);

    const res = await agent
      .post(`/api/v1/affiliates/${affiliate.affiliateId}/delivery-code/reset`)
      .set('Authorization', `Bearer ${affiliateToken(affiliate)}`)
      .set('x-csrf-token', csrfToken)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.deliveryCode).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);

    const reloaded = await Affiliate.findOne({ affiliateId: affiliate.affiliateId })
      .select('+affiliateDeliveryCodeHash');
    expect(roleCodes.verifyCode(res.body.deliveryCode, reloaded.affiliateDeliveryCodeHash)).toBe(true);
    expect(roleCodes.verifyCode('OLDCDE', reloaded.affiliateDeliveryCodeHash)).toBe(false);
  });
});
```

- [ ] **3.2 Run it** — `npm test -- tests/integration/affiliateDeliveryCode.test.js` → expect FAIL: register response has no `deliveryCode`; GET/POST routes 404.

- [ ] **3.3 Schema fields** — In `server/models/Affiliate.js` insert after the `perBagDeliveryFee` block (after line 66):

```javascript
  // Vendor (affiliate) delivery code — short secret used to confirm door
  // deliveries on the overloaded claim URL (spec §4.6/§6.6). Verified only
  // against THIS order's affiliate. "pbkdf2hash:salt" via utils/roleCodes.
  // NOT the login password.
  affiliateDeliveryCodeHash: { type: String, select: false },
  affiliateDeliveryCodeSetAt: Date,
```

- [ ] **3.4 Generate at invited registration** — In `server/controllers/affiliateController.js` `registerAffiliate` (PR 5 reworked version; locate the construction with `grep -n "new Affiliate(" server/controllers/affiliateController.js`). **After the `new Affiliate({...})` construction and before `await newAffiliate.save()`**, insert (add `const roleCodes = require('../utils/roleCodes');` and `const SystemConfig = require('../models/SystemConfig');` to the top imports if absent):

```javascript
    // PR 9: provision the vendor delivery code at invited registration (§4.6).
    const deliveryCodeLength = await SystemConfig.getValue('affiliate_delivery_code_length', 6);
    const deliveryCode = roleCodes.generateCode(deliveryCodeLength);
    newAffiliate.affiliateDeliveryCodeHash = roleCodes.hashCode(deliveryCode);
    newAffiliate.affiliateDeliveryCodeSetAt = new Date();
```

Then add `deliveryCode` to the 201 success payload (locate the success response with `grep -n "sendSuccess\|status(201)" server/controllers/affiliateController.js`; add `deliveryCode,` alongside `affiliateId` in the response data object) with the comment `// shown exactly once`.

- [ ] **3.5 Controller status/reset** — Append to `server/controllers/affiliateController.js`:

```javascript
function canManageAffiliateCode(req, affiliateId) {
  if (req.user.role === 'administrator' || req.user.role === 'admin') return true;
  return req.user.role === 'affiliate' && req.user.affiliateId === affiliateId;
}

/**
 * GET /api/v1/affiliates/:affiliateId/delivery-code — status (self/admin).
 */
exports.getDeliveryCodeStatus = ControllerHelpers.asyncWrapper(async (req, res) => {
  const { affiliateId } = req.params;
  if (!canManageAffiliateCode(req, affiliateId)) {
    return ControllerHelpers.sendError(res, 'Unauthorized', 403);
  }
  const affiliate = await Affiliate.findOne({ affiliateId }).select('+affiliateDeliveryCodeHash');
  if (!affiliate) return ControllerHelpers.sendError(res, 'Affiliate not found', 404);
  ControllerHelpers.sendSuccess(res, {
    deliveryCodeSet: !!affiliate.affiliateDeliveryCodeHash,
    deliveryCodeSetAt: affiliate.affiliateDeliveryCodeSetAt || null
  }, 'Delivery code status');
});

/**
 * POST /api/v1/affiliates/:affiliateId/delivery-code/reset — regenerate
 * (self/admin, CSRF). Returns the new plaintext code exactly once.
 */
exports.resetDeliveryCode = ControllerHelpers.asyncWrapper(async (req, res) => {
  const { affiliateId } = req.params;
  if (!canManageAffiliateCode(req, affiliateId)) {
    return ControllerHelpers.sendError(res, 'Unauthorized', 403);
  }
  const affiliate = await Affiliate.findOne({ affiliateId });
  if (!affiliate) return ControllerHelpers.sendError(res, 'Affiliate not found', 404);

  const SystemConfig = require('../models/SystemConfig');
  const roleCodes = require('../utils/roleCodes');
  const codeLength = await SystemConfig.getValue('affiliate_delivery_code_length', 6);
  const deliveryCode = roleCodes.generateCode(codeLength);
  affiliate.affiliateDeliveryCodeHash = roleCodes.hashCode(deliveryCode);
  affiliate.affiliateDeliveryCodeSetAt = new Date();
  await affiliate.save();

  const { logAuditEvent, AuditEvents } = require('../utils/auditLogger');
  logAuditEvent(AuditEvents.DELIVERY_CODE_RESET, { affiliateId, userId: req.user.id }, req);
  ControllerHelpers.sendSuccess(res, {
    deliveryCode,
    deliveryCodeSetAt: affiliate.affiliateDeliveryCodeSetAt
  }, 'Delivery code reset');
});
```

(If the file already has top-level requires for `SystemConfig`/`roleCodes`/`auditLogger` after Task 3.4, use them and drop the inline requires.)

- [ ] **3.6 Routes** — In `server/routes/affiliateRoutes.js`, after the `router.get('/:affiliateId/dashboard', ...)` line (line 116 pre-PR), add (add `const { sensitiveOperationLimiter } = require('../middleware/rateLimiting');` to the top if absent):

```javascript
// Vendor delivery code (PR 9) — self/admin status + reset (reset returns
// the plaintext exactly once; CSRF enforced by default on the POST).
router.get('/:affiliateId/delivery-code', authenticate, affiliateController.getDeliveryCodeStatus);
router.post('/:affiliateId/delivery-code/reset', authenticate, sensitiveOperationLimiter, affiliateController.resetDeliveryCode);
```

- [ ] **3.7 Run again** — `npm test -- tests/integration/affiliateDeliveryCode.test.js` → expect PASS (3 tests).
- [ ] **3.8 Commit:**

```bash
git add server/models/Affiliate.js server/controllers/affiliateController.js server/routes/affiliateRoutes.js tests/integration/affiliateDeliveryCode.test.js
git commit -m "feat(codes): affiliate delivery code — provisioned at invited registration, status/reset endpoints"
```

---

## Task 4 — Operator scan code: schema, generation at creation, admin reset (repurpose `reset-pin`)

**Files:**
- Create: `tests/integration/operatorScanCode.test.js`
- Modify: `server/models/Operator.js` (after `lockUntil: Date,` line 96)
- Modify: `server/services/operatorAdminService.js` (`createOperator` line 32; replace `resetOperatorPin` line 334)
- Modify: `server/controllers/administratorController.js` (replace `resetOperatorPin` export, line 635)
- Modify: `server/routes/operatorRoutes.js` (line 49)
- Modify: `server/config/csrf-config.js` (stale CRITICAL entry, line 172)
- Modify: `public/assets/js/administrator-dashboard-init.js` (reset-pin fetch line 3032, button handler line 3073, button label line 635)
- Modify: `public/locales/{en,es,pt,de}/common.json` (admin scan-code keys)
- Modify: `tests/integration/operator.test.js` (the `POST /api/v1/operators/:id/reset-pin` describe at line 750), `tests/unit/csrfConfig.test.js` (line 294)

- [ ] **4.1 Write the failing test** — `tests/integration/operatorScanCode.test.js`:

```javascript
jest.mock('../../server/utils/emailService');

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../server');
const Operator = require('../../server/models/Operator');
const Administrator = require('../../server/models/Administrator');
const encryptionUtil = require('../../server/utils/encryption');
const roleCodes = require('../../server/utils/roleCodes');
const { getCsrfToken, createAgent } = require('../helpers/csrfHelper');

jest.setTimeout(60000);

describe('Operator scan code', () => {
  let adminAgent, adminCsrf, adminToken, admin;

  beforeEach(async () => {
    const { salt, hash } = encryptionUtil.hashPassword('CompletelyUniquePassword417!');
    admin = await Administrator.create({
      adminId: `ADM${Date.now()}`, firstName: 'Ops', lastName: 'Admin',
      email: `opsadmin${Date.now()}@wavemax.com`,
      passwordSalt: salt, passwordHash: hash, permissions: ['all']
    });
    adminAgent = createAgent(app);
    const login = await adminAgent
      .post('/api/v1/auth/administrator/login')
      .send({ email: admin.email, password: 'CompletelyUniquePassword417!' });
    adminToken = login.body.token;
    adminCsrf = await getCsrfToken(app, adminAgent);
  });

  test('createOperator provisions scanCodeHmac and returns scanCode once', async () => {
    const res = await adminAgent
      .post('/api/v1/operators')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-csrf-token', adminCsrf)
      .send({
        firstName: 'Scan', lastName: 'Op',
        email: `scanop${Date.now()}@wavemax.com`,
        username: `scanop${Date.now()}`,
        password: 'StrongOperatorPass417!'
      });
    expect(res.status).toBe(201);
    expect(res.body.scanCode).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/);

    const op = await Operator.findOne({ email: res.body.operator.email });
    expect(op.scanCodeHmac).toBe(roleCodes.hmacCode(res.body.scanCode));
    expect(op.scanCodeSetAt).toBeInstanceOf(Date);
  });

  test('POST /api/v1/operators/:operatorId/scan-code/reset regenerates (admin, CSRF)', async () => {
    const operator = await Operator.create({
      firstName: 'Reset', lastName: 'Op',
      email: `resetop${Date.now()}@wavemax.com`, username: `resetop${Date.now()}`,
      password: 'StrongOperatorPass417!', createdBy: admin._id,
      scanCodeHmac: roleCodes.hmacCode('OLDCODE9'), scanCodeSetAt: new Date(Date.now() - 1000)
    });

    const res = await adminAgent
      .post(`/api/v1/operators/${operator._id}/scan-code/reset`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-csrf-token', adminCsrf)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.scanCode).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/);

    const reloaded = await Operator.findById(operator._id);
    expect(reloaded.scanCodeHmac).toBe(roleCodes.hmacCode(res.body.scanCode));
    expect(reloaded.scanCodeHmac).not.toBe(roleCodes.hmacCode('OLDCODE9'));
  });

  test('old reset-pin route is gone; scan-code reset rejects non-admin', async () => {
    const operator = await Operator.create({
      firstName: 'Rbac', lastName: 'Op',
      email: `rbacop${Date.now()}@wavemax.com`, username: `rbacop${Date.now()}`,
      password: 'StrongOperatorPass417!', createdBy: admin._id
    });

    const gone = await adminAgent
      .post(`/api/v1/operators/${operator._id}/reset-pin`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-csrf-token', adminCsrf)
      .send({ newPassword: 'whatever417!' });
    expect(gone.status).toBe(404);

    const jwt = require('jsonwebtoken');
    const opToken = jwt.sign(
      { id: operator._id.toString(), role: 'operator' },
      process.env.JWT_SECRET, { expiresIn: '1h' }
    );
    const opAgent = createAgent(app);
    const opCsrf = await getCsrfToken(app, opAgent);
    const forbidden = await opAgent
      .post(`/api/v1/operators/${operator._id}/scan-code/reset`)
      .set('Authorization', `Bearer ${opToken}`)
      .set('x-csrf-token', opCsrf)
      .send({});
    expect(forbidden.status).toBe(403);
  });
});
```

- [ ] **4.2 Run it** — `npm test -- tests/integration/operatorScanCode.test.js` → expect FAIL: `res.body.scanCode` undefined on create; `/scan-code/reset` 404; `/reset-pin` still 200.

- [ ] **4.3 Schema fields** — In `server/models/Operator.js` insert after `lockUntil: Date,` (line 96):

```javascript
  // Operator scan code — powers the ad-hoc operator path on the overloaded
  // bag URL (spec §4.8). HMAC-SHA256(code, ENCRYPTION_KEY), unique-indexed
  // for O(1) identify-and-verify. The kiosk authenticates by JWT instead.
  // sparse: legacy/test operators without a code don't collide on null.
  scanCodeHmac: { type: String, unique: true, sparse: true },
  scanCodeSetAt: Date,
```

- [ ] **4.4 Generate at creation** — In `server/services/operatorAdminService.js`, `createOperator` currently builds and saves (lines 46–58):

```javascript
  const operator = new Operator({
    firstName,
    lastName,
    email: email.toLowerCase(),
    username: username.toLowerCase(),
    password,
    shiftStart,
    shiftEnd,
    createdBy: adminId
  });

  await operator.save();
  await emailService.sendOperatorWelcomeEmail(operator, password);
```

Replace the `await operator.save();` line with:

```javascript
  // PR 9: provision the operator scan code (shown once in the create response).
  const SystemConfig = require('../models/SystemConfig');
  const roleCodes = require('../utils/roleCodes');
  const scanCodeLength = await SystemConfig.getValue('operator_scan_code_length', 8);
  let scanCode;
  for (let attempt = 0; attempt < 3; attempt++) {
    scanCode = roleCodes.generateCode(scanCodeLength);
    operator.scanCodeHmac = roleCodes.hmacCode(scanCode);
    operator.scanCodeSetAt = new Date();
    try {
      await operator.save();
      break;
    } catch (err) {
      // E11000 on scanCodeHmac = astronomically rare collision -> regenerate.
      if (err.code === 11000 && err.message.includes('scanCodeHmac') && attempt < 2) continue;
      throw err;
    }
  }
```

and change the function's final `return fieldFilter(operator.toObject(), 'administrator');` (line 69) to:

```javascript
  return { ...fieldFilter(operator.toObject(), 'administrator'), scanCode };
```

Then in `server/controllers/administratorController.js` `createOperator` (locate with `grep -n "exports.createOperator" server/controllers/administratorController.js`, line 238), split the code out of the operator payload in the success response:

```javascript
    const { scanCode, ...operator } = await operatorAdminService.createOperator({
      payload: req.body, adminId: req.user.id, req
    });
    res.status(201).json({ success: true, message: 'Operator created successfully', operator, scanCode });
```

(adapt the surrounding variable names to the existing function body — only the destructure + response shape change).

- [ ] **4.5 Replace resetOperatorPin (service)** — In `server/services/operatorAdminService.js`, replace the whole `resetOperatorPin` function (lines 334–352, currently `async function resetOperatorPin({ id, newPassword, adminId }) { ... }`) with:

```javascript
async function resetOperatorScanCode({ id, adminId, req }) {
  const operator = await Operator.findById(id);
  if (!operator) throw new OperatorAdminError('not_found', 'Operator not found', 404);

  const SystemConfig = require('../models/SystemConfig');
  const roleCodes = require('../utils/roleCodes');
  const scanCodeLength = await SystemConfig.getValue('operator_scan_code_length', 8);
  const scanCode = roleCodes.generateCode(scanCodeLength);
  operator.scanCodeHmac = roleCodes.hmacCode(scanCode);
  operator.scanCodeSetAt = new Date();
  await operator.save();

  logAuditEvent(AuditEvents.OPERATOR_SCAN_CODE_RESET, {
    userId: adminId, userType: 'administrator',
    operatorId: operator.operatorId
  }, req);

  return { scanCode, scanCodeSetAt: operator.scanCodeSetAt };
}
```

and in the `module.exports` block (line 385) replace `resetOperatorPin,` with `resetOperatorScanCode,`.

- [ ] **4.6 Controller + route** — In `server/controllers/administratorController.js`, replace the `exports.resetOperatorPin` function (lines 635–653) with:

```javascript
/**
 * Reset operator scan code (admin). Returns the new code exactly once.
 */
exports.resetOperatorScanCode = async (req, res) => {
  try {
    const result = await operatorAdminService.resetOperatorScanCode({
      id: req.params.operatorId,
      adminId: req.user.id,
      req
    });
    res.json({ success: true, message: 'Scan code reset successfully', ...result });
  } catch (err) {
    if (err.isOperatorAdminError) {
      return res.status(err.status).json({ success: false, message: err.message });
    }
    logger.error('Error resetting operator scan code:', err);
    res.status(500).json({
      success: false,
      message: 'An error occurred while resetting the scan code'
    });
  }
};
```

In `server/routes/operatorRoutes.js` replace line 49:

```javascript
router.post('/:id/reset-pin', checkRole(['administrator']), checkAdminPermission(['operators.update']), administratorController.resetOperatorPin);
```

with:

```javascript
router.post('/:operatorId/scan-code/reset', checkRole(['administrator']), checkAdminPermission(['operators.update']), administratorController.resetOperatorScanCode);
```

- [ ] **4.7 CSRF config + admin dashboard + i18n** —
  - `server/config/csrf-config.js` line 172: replace `'/api/v1/administrators/operators/:operatorId/reset-pin',` with `'/api/v1/operators/:operatorId/scan-code/reset',`.
  - `public/assets/js/administrator-dashboard-init.js`: at line 3032 replace the fetch URL `` `/api/v1/administrators/operators/${operatorId}/reset-pin` `` with `` `/api/v1/operators/${operatorId}/scan-code/reset` ``; in the success branch (line 3038) replace the alert with:

```javascript
        const data = await response.json();
        alert(`${t('admin.operators.scanCode.shownOnceNote', 'New scan code (shown only once):')} ${data.scanCode}`);
```

  - Same file line 635: change the button label to `${t('admin.operators.scanCode.reset')}` (keep the `reset-pin-btn` class + click wiring at line 3073 as-is — only the label and URL change).
  - Add to `public/locales/en/common.json` under the existing top-level `admin` object (create `"operators"` inside it if absent):

```json
"operators": {
  "scanCode": {
    "reset": "Reset scan code",
    "shownOnceNote": "New scan code (shown only once):"
  }
}
```

  Same shape in the other three files — es: `"reset": "Restablecer código de escaneo"`, `"shownOnceNote": "Nuevo código de escaneo (se muestra solo una vez):"` · pt: `"reset": "Redefinir código de escaneamento"`, `"shownOnceNote": "Novo código de escaneamento (exibido apenas uma vez):"` · de: `"reset": "Scan-Code zurücksetzen"`, `"shownOnceNote": "Neuer Scan-Code (wird nur einmal angezeigt):"`.

- [ ] **4.8 Fix coupled tests** — `grep -rn "reset-pin\|resetOperatorPin" tests/ server/ public/` and update every hit:
  - `tests/integration/operator.test.js:750` — rewrite the `describe('POST /api/v1/operators/:id/reset-pin', ...)` block to hit `/api/v1/operators/${targetOperator._id}/scan-code/reset` with an empty body and assert `res.body.scanCode` matches `/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/` (drop the `newPassword` assertions — the scan code is not the password).
  - `tests/unit/csrfConfig.test.js:294` — update the path to `'/api/v1/operators/op-456/scan-code/reset'`.
- [ ] **4.9 Run** — `npm test -- tests/integration/operatorScanCode.test.js tests/integration/operator.test.js tests/unit/csrfConfig.test.js` → expect PASS.
- [ ] **4.10 Commit:**

```bash
git add server/models/Operator.js server/services/operatorAdminService.js server/controllers/administratorController.js server/routes/operatorRoutes.js server/config/csrf-config.js public/assets/js/administrator-dashboard-init.js public/locales tests/integration/operatorScanCode.test.js tests/integration/operator.test.js tests/unit/csrfConfig.test.js
git commit -m "feat(codes): operator scan code (HMAC, unique) at creation + admin scan-code/reset replaces reset-pin"
```

---

## Task 5 — Email dispatchers + templates: "on the way" (with PIN) new; "delivered" EXTENDS PR 7's dispatcher (4 langs)

> **Collision guard (do not skip):** PR 7 Task 1 already shipped `exports.sendCustomerDeliveredEmail` in `server/services/email/dispatcher/customer.js` (signature `(customer, order)`, best-effort: returns `false` on transport failure, never throws), the root template `server/templates/emails/customer-order-delivered.html` (uppercase `[EMAIL_TITLE]`-style tokens + per-language translation maps in the dispatcher), and the pinned suite `tests/unit/emailCustomerDelivered.test.js`. **Do NOT create a second `sendCustomerDeliveredEmail` in ops.js** — the dispatcher index spreads every file, so a duplicate export silently shadows one of the two (order-dependent) and breaks whichever suite loses. This task MODIFIES PR 7's dispatcher in place: add the optional third `{ affiliateName }` param, keep the best-effort never-throw contract and PR 7's subjects, and add `{es,pt,de}` template copies that carry the EXISTING root template's uppercase token set. Only `sendOrderOnTheWayEmail` is new (in ops.js).

**Files:**
- Create: `tests/unit/deliveryEmails.test.js`
- Create: `server/templates/emails/customer-on-the-way.html` (root = EN fallback) + `server/templates/emails/{es,pt,de}/customer-on-the-way.html`
- Modify: `server/templates/emails/customer-order-delivered.html` (PR 7's root — add the delivered-by row only) + Create: `server/templates/emails/{es,pt,de}/customer-order-delivered.html` (token shells, same uppercase token set as the root)
- Modify: `server/services/email/dispatcher/customer.js` (extend PR 7's `sendCustomerDeliveredEmail` — third param + AFFILIATE_NAME)
- Modify: `server/services/email/dispatcher/ops.js` (append ONE dispatcher — `sendOrderOnTheWayEmail` — before `module.exports = exports;` at line 157)

- [ ] **5.1 Write the failing test** — `tests/unit/deliveryEmails.test.js`:

```javascript
jest.mock('../../server/services/email/transport', () => ({
  sendEmail: jest.fn().mockResolvedValue(true)
}));

const { sendEmail } = require('../../server/services/email/transport');
const ops = require('../../server/services/email/dispatcher/ops');
// "delivered" lives in PR 7's customer dispatcher — this PR EXTENDS it, never
// re-creates it in ops.js (the dispatcher index spread would shadow one copy).
const customerDispatcher = require('../../server/services/email/dispatcher/customer');

const order = { orderId: 'ORD-test-1', actualWeight: 15 };

describe('PR 9 delivery emails', () => {
  beforeEach(() => sendEmail.mockClear());

  test.each(['en', 'es', 'pt', 'de'])(
    'sendOrderOnTheWayEmail (%s) includes the delivery PIN and order id',
    async (lang) => {
      const customer = {
        firstName: 'Pat', lastName: 'Doe',
        email: 'pat@example.com', languagePreference: lang
      };
      await ops.sendOrderOnTheWayEmail(customer, order, {
        deliveryPin: 'ABC234', affiliateName: 'Austin Wash Co'
      });
      expect(sendEmail).toHaveBeenCalledTimes(1);
      const [to, subject, html] = sendEmail.mock.calls[0];
      expect(to).toBe('pat@example.com');
      expect(subject).toContain('ORD-test-1');
      expect(html).toContain('ABC234');
      expect(html).toContain('Austin Wash Co');
      expect(html).not.toContain('[delivery_pin]'); // placeholder filled
    }
  );

  // Extended PR 7 dispatcher: subjects stay PR 7's per-language EMAIL_TITLEs
  // (pinned by tests/unit/emailCustomerDelivered.test.js) — they do NOT
  // contain the order id; the order id renders in the body.
  test.each([
    ['en', 'delivered'],
    ['es', 'entregada'],
    ['pt', 'entregue'],
    ['de', 'geliefert']
  ])(
    'sendCustomerDeliveredEmail (%s) renders order id and affiliate name',
    async (lang, subjectFragment) => {
      const customer = {
        firstName: 'Pat', lastName: 'Doe',
        email: 'pat@example.com', languagePreference: lang
      };
      await customerDispatcher.sendCustomerDeliveredEmail(customer, order, { affiliateName: 'Austin Wash Co' });
      expect(sendEmail).toHaveBeenCalledTimes(1);
      const [to, subject, html] = sendEmail.mock.calls[0];
      expect(to).toBe('pat@example.com');
      expect(subject.toLowerCase()).toContain(subjectFragment);
      expect(html).toContain('ORD-test-1');
      expect(html).toContain('Austin Wash Co');
      expect(html).not.toMatch(/\[[A-Z_]+\]/); // uppercase token convention, all filled
    }
  );

  test('sendCustomerDeliveredEmail keeps PR 7 contract: two-arg call fills the delivered-by row with the fallback', async () => {
    const customer = { firstName: 'Pat', lastName: 'Doe', email: 'pat@example.com', languagePreference: 'en' };
    await customerDispatcher.sendCustomerDeliveredEmail(customer, order);
    const [, , html] = sendEmail.mock.calls[0];
    expect(html).toContain('Your delivery provider'); // AFFILIATE_NAME fallback
    expect(html).not.toMatch(/\[[A-Z_]+\]/);
  });
});
```

- [ ] **5.2 Run it** — `npm test -- tests/unit/deliveryEmails.test.js` → expect FAIL: the on-the-way half with `ops.sendOrderOnTheWayEmail is not a function`; the delivered half on `expect(html).toContain('Austin Wash Co')` (PR 7's dispatcher ignores the not-yet-added third argument).

- [ ] **5.3 New dispatcher (on-the-way only)** — In `server/services/email/dispatcher/ops.js`, insert before the final `module.exports = exports;` (line 157):

```javascript
// ---------------------------------------------------------------------------
// PR 9 — overloaded-bag-URL lifecycle emails
// Templates use the [PLACEHOLDER] token convention (template-manager
// fillTemplate). loadTemplate resolves templates/emails/{lang}/<name>.html
// with the root file as the English fallback.
// ---------------------------------------------------------------------------

const ON_THE_WAY_SUBJECTS = {
  en: (orderId) => `Your laundry is on the way — Order ${orderId}`,
  es: (orderId) => `Tu ropa está en camino — Pedido ${orderId}`,
  pt: (orderId) => `Sua roupa está a caminho — Pedido ${orderId}`,
  de: (orderId) => `Ihre Wäsche ist unterwegs — Bestellung ${orderId}`
};

/**
 * "On the way" — sent at operator scan-OUT (ready_for_pickup -> picked_up).
 * Includes the customer's (freshly rotated) delivery PIN so they can confirm
 * receipt at the door (spec §6.4/§6.6).
 */
exports.sendOrderOnTheWayEmail = async (customer, order, { deliveryPin, affiliateName } = {}) => {
  const language = customer.languagePreference || 'en';
  const template = await loadTemplate('customer-on-the-way', language);
  const html = fillTemplate(template, {
    customer_name: `${customer.firstName} ${customer.lastName}`,
    order_id: order.orderId,
    affiliate_name: affiliateName || 'Your delivery provider',
    delivery_pin: deliveryPin || '',
    total_weight: order.actualWeight != null ? String(order.actualWeight) : ''
  });
  const subjectFor = ON_THE_WAY_SUBJECTS[language] || ON_THE_WAY_SUBJECTS.en;
  return sendEmail(customer.email, subjectFor(order.orderId), html);
};

```

(`loadTemplate`, `fillTemplate`, and `sendEmail` are already imported at the top of ops.js — lines 4–5. The dispatcher index spreads `...ops`, so the function is automatically reachable via `require('../utils/emailService')`. **Do not add a delivered dispatcher here** — see the collision guard at the top of this task.)

- [ ] **5.3b Extend PR 7's delivered dispatcher** — In `server/services/email/dispatcher/customer.js`, modify `exports.sendCustomerDeliveredEmail` (shipped by PR 7 Task 1, end of file). Three surgical edits — keep everything else (subjects = `t.EMAIL_TITLE`, best-effort try/catch returning `false`, logger lines) exactly as PR 7 wrote it:

  1. Signature gains the optional third param:
  ```javascript
  exports.sendCustomerDeliveredEmail = async (customer, order, { affiliateName } = {}) => {
  ```
  2. Each language map gains two keys (insert after `DELIVERED_AT_LABEL` in each):
  - en: `DELIVERED_BY_LABEL: 'Delivered by'`, `AFFILIATE_NAME_FALLBACK: 'Your delivery provider'`
  - es: `DELIVERED_BY_LABEL: 'Entregado por'`, `AFFILIATE_NAME_FALLBACK: 'Su proveedor de entrega'`
  - pt: `DELIVERED_BY_LABEL: 'Entregue por'`, `AFFILIATE_NAME_FALLBACK: 'Seu provedor de entrega'`
  - de: `DELIVERED_BY_LABEL: 'Geliefert von'`, `AFFILIATE_NAME_FALLBACK: 'Ihr Lieferpartner'`
  3. The `fillTemplate` data object gains one entry (after `DELIVERED_AT`):
  ```javascript
        AFFILIATE_NAME: affiliateName || t.AFFILIATE_NAME_FALLBACK,
  ```
  (`AFFILIATE_NAME_FALLBACK` is map-internal — it is not a template token, so it never reaches `fillTemplate` unmatched.)

  This keeps PR 7's pinned suite `tests/unit/emailCustomerDelivered.test.js` green untouched: its two-arg calls fill `[AFFILIATE_NAME]` with the fallback, the subjects are unchanged, and the never-throw contract stands (PR 9's confirm-delivery call sites treat the email as best-effort either way).

- [ ] **5.4 Templates** — Create `server/templates/emails/customer-on-the-way.html` (root English fallback):

```html
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; margin: 0; padding: 0;">
  <div style="max-width: 600px; margin: 0 auto;">
    <div style="background-color: #3498db; color: #ffffff; padding: 20px; text-align: center;">
      <h2 style="margin: 0;">Your laundry is on the way!</h2>
    </div>
    <div style="padding: 20px; background-color: #f8f9fa;">
      <p>Hello [customer_name],</p>
      <p>[affiliate_name] has picked up order <strong>[order_id]</strong> ([total_weight] lbs) and is on the way to you.</p>
      <div style="background-color: #ffffff; border: 2px solid #3498db; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">
        <p style="margin: 0 0 8px;">Your delivery PIN:</p>
        <p style="font-size: 28px; letter-spacing: 4px; font-weight: bold; margin: 0;">[delivery_pin]</p>
      </div>
      <p>When your laundry arrives, scan the QR code on the bag with your phone camera and enter this PIN to confirm you received it.</p>
      <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
      <p style="color: #666; font-size: 12px; text-align: center;">This is an automated notification from WaveMAX Laundry Services.</p>
    </div>
  </div>
</body>
</html>
```

Create `server/templates/emails/es/customer-on-the-way.html` — same markup with: heading `¡Tu ropa está en camino!`; `<p>Hola [customer_name],</p>`; `<p>[affiliate_name] recogió el pedido <strong>[order_id]</strong> ([total_weight] lbs) y está en camino hacia ti.</p>`; PIN label `Tu PIN de entrega:`; instructions `Cuando llegue tu ropa, escanea el código QR de la bolsa con la cámara de tu teléfono e introduce este PIN para confirmar que la recibiste.`; footer `Esta es una notificación automática de WaveMAX Laundry Services.`

Create `server/templates/emails/pt/customer-on-the-way.html` — heading `Sua roupa está a caminho!`; `<p>Olá [customer_name],</p>`; `<p>[affiliate_name] retirou o pedido <strong>[order_id]</strong> ([total_weight] lbs) e está a caminho até você.</p>`; PIN label `Seu PIN de entrega:`; instructions `Quando sua roupa chegar, escaneie o código QR da bolsa com a câmera do seu celular e digite este PIN para confirmar o recebimento.`; footer `Esta é uma notificação automática da WaveMAX Laundry Services.`

Create `server/templates/emails/de/customer-on-the-way.html` — heading `Ihre Wäsche ist unterwegs!`; `<p>Hallo [customer_name],</p>`; `<p>[affiliate_name] hat Bestellung <strong>[order_id]</strong> ([total_weight] lbs) abgeholt und ist auf dem Weg zu Ihnen.</p>`; PIN label `Ihre Liefer-PIN:`; instructions `Wenn Ihre Wäsche ankommt, scannen Sie den QR-Code auf der Tasche mit Ihrer Handykamera und geben Sie diese PIN ein, um den Empfang zu bestätigen.`; footer `Dies ist eine automatische Benachrichtigung von WaveMAX Laundry Services.`

**Modify** PR 7's existing `server/templates/emails/customer-order-delivered.html` — do NOT recreate it (it ships uppercase tokens `[EMAIL_TITLE]`, `[EMAIL_HEADER]`, `[GREETING]`, `[DELIVERED_MESSAGE]`, `[ORDER_ID_LABEL]`/`[ORDER_ID]`, `[DELIVERED_AT_LABEL]`/`[DELIVERED_AT]`, `[THANKS_MESSAGE]`, `[CLOSING_MESSAGE]`, `[CURRENT_YEAR]`, `[FOOTER_RIGHTS]`, `[FOOTER_AUTOMATED_MESSAGE]`; translations live in the dispatcher map, not in per-language files). Single edit: add one detail row inside the `delivery-details` div, after the `[DELIVERED_AT_LABEL]` row:

```html
                <div class="detail-row">
                    <span class="detail-label">[DELIVERED_BY_LABEL]:</span> [AFFILIATE_NAME]
                </div>
```

Then create `server/templates/emails/{es,pt,de}/customer-order-delivered.html` as **token shells**: each file is a byte-identical copy of the modified root (same uppercase token set — the dispatcher's translation maps carry the language content, so the markup is shared). These copies exist so PR 11's parity checker (`REQUIRED_EMAIL_TEMPLATES` includes `customer-order-delivered`; token-set equality per language) passes:

```bash
for lang in es pt de; do
  cp server/templates/emails/customer-order-delivered.html "server/templates/emails/$lang/customer-order-delivered.html"
done
```

- [ ] **5.5 Run again** — `npm test -- tests/unit/deliveryEmails.test.js tests/unit/emailCustomerDelivered.test.js` → expect PASS (deliveryEmails: 9 tests; PR 7's pinned emailCustomerDelivered suite must stay green — if it fails, the customer.js edit broke the two-arg/best-effort contract).
- [ ] **5.6 Commit:**

```bash
git add server/services/email/dispatcher/ops.js server/services/email/dispatcher/customer.js server/templates/emails tests/unit/deliveryEmails.test.js
git commit -m "feat(email): on-the-way dispatcher (with delivery PIN); extend PR 7 delivered dispatcher with affiliateName; 4-language templates"
```

---

## Task 6 — `orderAdvanceService`: state-driven advance + PIN rotation at scan-out

**Files:**
- Create: `tests/integration/operatorScanOut.test.js`
- Create: `server/modules/bags/extractBagToken.js` (skip if PR 7 already created it — `ls server/modules/bags/`)
- Create: `server/modules/orders/orderAdvanceService.js`

**Shared test fixture note:** the fixture helper below is reused (copy-pasted) by Tasks 8–11's test files. It builds the full affiliate→customer→bag→order chain against the PR 4/6 schemas.

- [ ] **6.1 Write the failing test** — `tests/integration/operatorScanOut.test.js`:

```javascript
jest.mock('../../server/utils/emailService');

const mongoose = require('mongoose');
const app = require('../../server'); // ensures models/config registered
const emailService = require('../../server/utils/emailService');
const Order = require('../../server/models/Order');
const Customer = require('../../server/models/Customer');
const Affiliate = require('../../server/models/Affiliate');
const Operator = require('../../server/models/Operator');
const Bag = require('../../server/modules/bags/Bag');
const encryptionUtil = require('../../server/utils/encryption');
const roleCodes = require('../../server/utils/roleCodes');
const orderAdvanceService = require('../../server/modules/orders/orderAdvanceService');

jest.setTimeout(60000);

// ---- shared fixture (reused by Tasks 8-11 test files) ----------------------
async function createWorld({ orderStatus, paymentStatus = 'pending' } = {}) {
  const uniq = `${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
  const { salt, hash } = encryptionUtil.hashPassword('FixturePassword417!');

  const affiliate = await Affiliate.create({
    firstName: 'Fix', lastName: 'Affiliate', email: `fixaff${uniq}@example.com`,
    phone: '5125551111', businessName: 'Fixture Wash Co',
    address: '1 Fixture St', city: 'Austin', state: 'TX', zipCode: '78701',
    serviceLatitude: 30.27, serviceLongitude: -97.74, // dropped silently if removed
    username: `fixaff${uniq}`, passwordSalt: salt, passwordHash: hash,
    paymentMethod: 'check',
    affiliateDeliveryCodeHash: roleCodes.hashCode('VENDOR'),
    affiliateDeliveryCodeSetAt: new Date()
  });

  const customer = await Customer.create({
    affiliateId: affiliate.affiliateId,
    firstName: 'Fix', lastName: 'Customer', email: `fixcust${uniq}@example.com`,
    phone: '5125552222', address: '2 Fixture St', city: 'Austin', state: 'TX', zipCode: '78702',
    username: `fixcust${uniq}`, passwordSalt: salt, passwordHash: hash,
    deliveryPinHash: roleCodes.hashCode('PINPIN'), deliveryPinSetAt: new Date()
  });

  const operator = await Operator.create({
    firstName: 'Fix', lastName: 'Operator', email: `fixop${uniq}@example.com`,
    username: `fixop${uniq}`, password: 'StrongOperatorPass417!',
    createdBy: new mongoose.Types.ObjectId(),
    scanCodeHmac: roleCodes.hmacCode('OPCODE99'), scanCodeSetAt: new Date()
  });

  const token = encryptionUtil.generateToken(16);
  const bag = await Bag.create({
    token, tokenHash: Bag.hashToken(token),
    affiliateId: affiliate.affiliateId, customerId: customer.customerId,
    status: 'active', batchId: `BATCH-${uniq}`, claimedAt: new Date()
  });

  let order = null;
  if (orderStatus) {
    order = await Order.create({
      customerId: customer.customerId,
      affiliateId: affiliate.affiliateId,
      bagId: bag.bagId,
      bagToken: bag.token,
      status: orderStatus,
      paymentStatus,
      actualWeight: 15,
      feeBreakdown: { numberOfBags: 1, minimumFee: 25, perBagFee: 5, totalFee: 25, minimumApplied: true },
      bags: [{
        bagToken: bag.token, bagNumber: 1, status: 'intake',
        scannedAt: { intake: new Date() }, scannedBy: { intake: operator._id }
      }],
      intake: { weight: 15, weighedAt: new Date(), weighedBy: operator._id }
    });
  }

  return { affiliate, customer, operator, bag, order, bagToken: token };
}
// ---------------------------------------------------------------------------

describe('orderAdvanceService.advance', () => {
  beforeEach(() => jest.clearAllMocks());

  test('in_progress -> processed, stamps intake + bag sub-status, runs the ready gate (held when unpaid)', async () => {
    const { bagToken, operator, order } = await createWorld({
      orderStatus: 'in_progress', paymentStatus: 'awaiting'
    });
    const result = await orderAdvanceService.advance({ bagToken, operatorId: operator._id });
    expect(result.action).toBe('processed');

    const reloaded = await Order.findOne({ orderId: order.orderId });
    expect(reloaded.status).toBe('processed');         // unpaid -> gate holds
    expect(reloaded.heldAtStore).toBe(true);
    expect(reloaded.intake.processedAt).toBeInstanceOf(Date);
    expect(reloaded.intake.processedBy.toString()).toBe(operator._id.toString());
    expect(reloaded.bags[0].status).toBe('processed');
    expect(reloaded.bags[0].scannedBy.processed.toString()).toBe(operator._id.toString());
  });

  test('in_progress + already-verified payment promotes straight to ready_for_pickup (Path B)', async () => {
    const { bagToken, operator, order } = await createWorld({
      orderStatus: 'in_progress', paymentStatus: 'verified'
    });
    const result = await orderAdvanceService.advance({ bagToken, operatorId: operator._id });
    expect(result.action).toBe('ready_for_pickup');

    const reloaded = await Order.findOne({ orderId: order.orderId });
    expect(reloaded.status).toBe('ready_for_pickup');
    expect(reloaded.readyForPickupAt).toBeInstanceOf(Date);
    expect(reloaded.heldAtStore).toBe(false);
  });

  test('processed + unpaid -> 409 awaiting_payment (held; no workflow email)', async () => {
    const { bagToken, operator } = await createWorld({
      orderStatus: 'processed', paymentStatus: 'awaiting'
    });
    await expect(orderAdvanceService.advance({ bagToken, operatorId: operator._id }))
      .rejects.toMatchObject({ code: 'awaiting_payment', status: 409 });
    expect(emailService.sendOrderOnTheWayEmail).not.toHaveBeenCalled();
  });

  test('ready_for_pickup -> picked_up: stamps, rotates PIN, sends on-the-way email with the NEW pin, no commission', async () => {
    const { bagToken, operator, order, customer } = await createWorld({
      orderStatus: 'ready_for_pickup', paymentStatus: 'verified'
    });
    const before = await Customer.findOne({ customerId: customer.customerId })
      .select('+deliveryPinHash');

    const result = await orderAdvanceService.advance({ bagToken, operatorId: operator._id });
    expect(result.action).toBe('picked_up');

    const reloaded = await Order.findOne({ orderId: order.orderId });
    expect(reloaded.status).toBe('picked_up');
    expect(reloaded.pickedUpAt).toBeInstanceOf(Date);
    expect(reloaded.intake.pickedUpBy.toString()).toBe(operator._id.toString());
    expect(reloaded.bags[0].status).toBe('picked_up');
    expect(reloaded.commissionRealized).toBeFalsy();   // commission ONLY at delivered

    const after = await Customer.findOne({ customerId: customer.customerId })
      .select('+deliveryPinHash');
    expect(after.deliveryPinHash).not.toBe(before.deliveryPinHash); // rotated

    expect(emailService.sendOrderOnTheWayEmail).toHaveBeenCalledTimes(1);
    const [, , opts] = emailService.sendOrderOnTheWayEmail.mock.calls[0];
    expect(roleCodes.verifyCode(opts.deliveryPin, after.deliveryPinHash)).toBe(true);
  });

  test('picked_up -> 409 (deliver or re-intake, not advance); unknown bag -> 404; no open order -> 409', async () => {
    const w1 = await createWorld({ orderStatus: 'picked_up', paymentStatus: 'verified' });
    await expect(orderAdvanceService.advance({ bagToken: w1.bagToken, operatorId: w1.operator._id }))
      .rejects.toMatchObject({ code: 'awaiting_delivery_confirmation', status: 409 });

    await expect(orderAdvanceService.advance({
      bagToken: encryptionUtil.generateToken(16), operatorId: w1.operator._id
    })).rejects.toMatchObject({ code: 'invalid_bag', status: 404 });

    const w2 = await createWorld({}); // active bag, no order
    await expect(orderAdvanceService.advance({ bagToken: w2.bagToken, operatorId: w2.operator._id }))
      .rejects.toMatchObject({ code: 'no_open_order', status: 409 });
  });
});
```

- [ ] **6.2 Run it** — `npm test -- tests/integration/operatorScanOut.test.js` → expect FAIL: `Cannot find module '../../server/modules/orders/orderAdvanceService'`.

- [ ] **6.3 Token extractor** — Create `server/modules/bags/extractBagToken.js` **only if PR 7 didn't already** (`grep -rn "extractBagToken" server/` first; if it exists, reuse it):

```javascript
// Accepts a raw 32-hex bag token OR the full printed claim URL
// (https://.../embed-app-v2.html?route=/claim&bag=<token>) and returns the
// normalized token, or null. Kiosk scanners deliver the full URL; the
// overloaded bag page already has the bare token.
const TOKEN_RE = /^[a-f0-9]{32}$/i;

module.exports = function extractBagToken(input) {
  if (!input) return null;
  const raw = String(input).trim();
  if (TOKEN_RE.test(raw)) return raw.toLowerCase();
  try {
    const url = new URL(raw);
    const fromQuery = url.searchParams.get('bag');
    if (fromQuery && TOKEN_RE.test(fromQuery)) return fromQuery.toLowerCase();
  } catch (_e) { /* not a URL */ }
  return null;
};
```

- [ ] **6.4 Implement the service** — Create `server/modules/orders/orderAdvanceService.js`:

```javascript
// State-driven one-step order advance — the "scan it again" engine (spec §6.4).
//
//   in_progress      -> processed   (stamp scan-2; then run the ready gate)
//   processed        -> 409 awaiting_payment when unpaid (held); the gate is
//                       re-run defensively first (idempotent heal)
//   ready_for_pickup -> picked_up   (operator scan-OUT: stamp scan-3, rotate +
//                       email the customer delivery PIN; NO commission here)
//   picked_up        -> 409 (deliver or re-intake — not this service)
//
// Shared by the kiosk (operator JWT) and the overloaded bag URL (operator
// scan code). `operatorId` is the resolved Operator _id either way.

const Bag = require('../bags/Bag');
const Order = require('../../models/Order');
const Customer = require('../../models/Customer');
const Affiliate = require('../../models/Affiliate');
const SystemConfig = require('../../models/SystemConfig');
const { applyTransition } = require('./orderStateMachine');
const orderReadyGateService = require('../../services/orderReadyGateService');
const emailService = require('../../utils/emailService');
const roleCodes = require('../../utils/roleCodes');
const { logAuditEvent, AuditEvents } = require('../../utils/auditLogger');
const logger = require('../../utils/logger');

const OPEN_STATUSES = ['in_progress', 'processed', 'ready_for_pickup', 'picked_up'];

class AdvanceError extends Error {
  constructor(code, message, status = 409) {
    super(message);
    this.code = code;
    this.status = status;
    this.isAdvanceError = true;
  }
}

/**
 * Advance the bag's open order one lifecycle step.
 * @param {object} args
 * @param {string} args.bagToken  - raw 32-hex bag token
 * @param {*}      args.operatorId - Operator _id (JWT id or code-resolved)
 * @param {object} [args.req]     - Express request (audit context)
 * @returns {Promise<{order: object, action: string}>}
 * @throws {AdvanceError}
 */
async function advance({ bagToken, operatorId, req }) {
  const bag = await Bag.findOne({ tokenHash: Bag.hashToken(bagToken) });
  if (!bag) throw new AdvanceError('invalid_bag', 'Bag not found', 404);

  const order = await Order.findOne({ bagId: bag.bagId, status: { $in: OPEN_STATUSES } });
  if (!order) throw new AdvanceError('no_open_order', 'No open order for this bag', 409);

  const now = new Date();

  if (order.status === 'in_progress') {
    applyTransition(order, 'processed');
    order.intake.processedAt = now;
    order.intake.processedBy = operatorId;
    if (order.bags[0]) {
      order.bags[0].status = 'processed';
      order.bags[0].scannedAt.processed = now;
      order.bags[0].scannedBy.processed = operatorId;
    }
    await order.save();
    // Gate: promotes to ready_for_pickup iff paid; else marks heldAtStore.
    await orderReadyGateService.applyReadyGate(order, { trigger: 'processed' });
    logAuditEvent(AuditEvents.OPERATOR_SCAN, {
      action: 'advance_processed', orderId: order.orderId, bagId: bag.bagId, operatorId
    }, req);
    return { order, action: order.status === 'ready_for_pickup' ? 'ready_for_pickup' : 'processed' };
  }

  if (order.status === 'processed') {
    // Defensive idempotent heal — if payment verified since the last scan,
    // the gate promotes; otherwise the order is held and the scan is a no-op.
    await orderReadyGateService.applyReadyGate(order, { trigger: 'advance_rescan' });
    if (order.status !== 'ready_for_pickup') {
      throw new AdvanceError('awaiting_payment', 'Order is processed but unpaid — held at store', 409);
    }
    logAuditEvent(AuditEvents.OPERATOR_SCAN, {
      action: 'advance_gate_heal', orderId: order.orderId, bagId: bag.bagId, operatorId
    }, req);
    return { order, action: 'ready_for_pickup' };
  }

  if (order.status === 'ready_for_pickup') {
    if (order.paymentStatus !== 'verified') {
      // Defensive — the gate is the only path here and it requires verified.
      throw new AdvanceError('awaiting_payment', 'Payment not verified', 409);
    }
    applyTransition(order, 'picked_up');
    order.intake.pickedUpAt = now;
    order.intake.pickedUpBy = operatorId;
    if (order.bags[0]) {
      order.bags[0].status = 'picked_up';
      order.bags[0].scannedAt.picked_up = now;
      order.bags[0].scannedBy.picked_up = operatorId;
    }
    await order.save();

    // Rotate the delivery PIN: only a PBKDF2 hash exists at rest, so a fresh
    // PIN is minted per scan-out and the plaintext rides in the email the
    // customer needs at the door (spec §6.4/§6.6 + §4.5 hash-only storage).
    const customer = await Customer.findOne({ customerId: order.customerId });
    let deliveryPin = null;
    if (customer) {
      const pinLength = await SystemConfig.getValue('customer_delivery_pin_length', 6);
      deliveryPin = roleCodes.generateCode(pinLength);
      customer.deliveryPinHash = roleCodes.hashCode(deliveryPin);
      customer.deliveryPinSetAt = now;
      await customer.save();
    }

    try {
      if (customer && customer.email) {
        const affiliate = order.affiliateId
          ? await Affiliate.findOne({ affiliateId: order.affiliateId })
          : null;
        await emailService.sendOrderOnTheWayEmail(customer, order, {
          deliveryPin,
          affiliateName: affiliate
            ? (affiliate.businessName || `${affiliate.firstName} ${affiliate.lastName}`)
            : null
        });
      }
    } catch (emailError) {
      logger.error(`On-the-way email failed for order ${order.orderId} (non-blocking):`, emailError);
    }

    logAuditEvent(AuditEvents.OPERATOR_SCAN, {
      action: 'scan_out', orderId: order.orderId, bagId: bag.bagId, operatorId
    }, req);
    return { order, action: 'picked_up' };
  }

  // picked_up — the door confirm (delivery code) or re-intake (operator code
  // on the intake endpoint) owns this state.
  throw new AdvanceError('awaiting_delivery_confirmation',
    'Bag is out for delivery — confirm delivery or re-intake it', 409);
}

module.exports = { advance, AdvanceError, OPEN_STATUSES };
```

- [ ] **6.5 Run again** — `npm test -- tests/integration/operatorScanOut.test.js` → expect PASS (5 tests). If the `intake.processedBy` assertion fails because PR 4 named the sub-document differently, STOP — re-read `server/models/Order.js` and reconcile the service to the canonical field names (`intake.*`, `bags[].bagToken`, sub-status enum `['intake','processed','picked_up','delivered']`) — the spec, not this plan, wins.
- [ ] **6.6 Commit:**

```bash
git add server/modules/orders/orderAdvanceService.js server/modules/bags/extractBagToken.js tests/integration/operatorScanOut.test.js
git commit -m "feat(orders): state-driven orderAdvanceService — scan-2/scan-3 with ready gate + PIN rotation at scan-out"
```

---

## Task 7 — Kiosk `POST /api/v1/operators/advance`; re-point `scanProcessed`; delete legacy pickup paths

**Files:**
- Create: `tests/integration/kioskAdvance.test.js`
- Modify: `server/controllers/operatorController.js` (add `advance`; replace `scanProcessed` body at line 272; delete `markOrderReady` lines 300–316, `completePickup` lines 318–344, `confirmPickup` lines 346–363)
- Modify: `server/routes/operatorRoutes.js` (lines 78–82)
- Modify/Delete: `server/services/operatorPickupService.js` (delete `markOrderReady`/`completePickup`/`confirmPickup`; delete the whole file if nothing else is referenced)
- Modify: `server/services/operatorBagWorkflowService.js` (delete `scanProcessed` + the `pickupService` require if unused)

- [ ] **7.1 Write the failing test** — `tests/integration/kioskAdvance.test.js` (reuse the `createWorld` fixture from Task 6.1 verbatim — copy it into this file):

```javascript
jest.mock('../../server/utils/emailService');

const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const app = require('../../server');
const Order = require('../../server/models/Order');
const Customer = require('../../server/models/Customer');
const Affiliate = require('../../server/models/Affiliate');
const Operator = require('../../server/models/Operator');
const Bag = require('../../server/modules/bags/Bag');
const encryptionUtil = require('../../server/utils/encryption');
const roleCodes = require('../../server/utils/roleCodes');
const { getCsrfToken, createAgent } = require('../helpers/csrfHelper');

jest.setTimeout(60000);

/* >>> paste the createWorld fixture from tests/integration/operatorScanOut.test.js here <<< */

function operatorToken(operator) {
  return jwt.sign({ id: operator._id.toString(), role: 'operator' },
    process.env.JWT_SECRET, { expiresIn: '1h' });
}

describe('Kiosk advance endpoint', () => {
  test('POST /api/v1/operators/advance (JWT + CSRF) advances in_progress -> processed', async () => {
    const { bagToken, operator } = await createWorld({
      orderStatus: 'in_progress', paymentStatus: 'awaiting'
    });
    const agent = createAgent(app);
    const csrfToken = await getCsrfToken(app, agent);

    const res = await agent
      .post('/api/v1/operators/advance')
      .set('Authorization', `Bearer ${operatorToken(operator)}`)
      .set('x-csrf-token', csrfToken)
      .send({ bagToken });
    expect(res.status).toBe(200);
    expect(res.body.action).toBe('processed');
  });

  test('legacy /scan-processed delegates to advance (accepts the printed claim URL as qrCode)', async () => {
    const { bagToken, operator } = await createWorld({
      orderStatus: 'in_progress', paymentStatus: 'awaiting'
    });
    const agent = createAgent(app);
    const csrfToken = await getCsrfToken(app, agent);

    const res = await agent
      .post('/api/v1/operators/scan-processed')
      .set('Authorization', `Bearer ${operatorToken(operator)}`)
      .set('x-csrf-token', csrfToken)
      .send({ qrCode: `https://wavemax.promo/embed-app-v2.html?route=/claim&bag=${bagToken}` });
    expect(res.status).toBe(200);
    expect(res.body.action).toBe('processed');
  });

  test('advance on held (processed+unpaid) order returns 409 awaiting_payment', async () => {
    const { bagToken, operator } = await createWorld({
      orderStatus: 'processed', paymentStatus: 'awaiting'
    });
    const agent = createAgent(app);
    const csrfToken = await getCsrfToken(app, agent);

    const res = await agent
      .post('/api/v1/operators/advance')
      .set('Authorization', `Bearer ${operatorToken(operator)}`)
      .set('x-csrf-token', csrfToken)
      .send({ bagToken });
    expect(res.status).toBe(409);
    expect(res.body.errors.code).toBe('awaiting_payment');
  });

  test('advance requires the operator role', async () => {
    const { bagToken, customer } = await createWorld({ orderStatus: 'in_progress' });
    const agent = createAgent(app);
    const csrfToken = await getCsrfToken(app, agent);
    const customerJwt = jwt.sign(
      { id: customer._id.toString(), customerId: customer.customerId, role: 'customer' },
      process.env.JWT_SECRET, { expiresIn: '1h' });

    const res = await agent
      .post('/api/v1/operators/advance')
      .set('Authorization', `Bearer ${customerJwt}`)
      .set('x-csrf-token', csrfToken)
      .send({ bagToken });
    expect(res.status).toBe(403);
  });

  test('legacy pickup endpoints are gone (404)', async () => {
    const { operator } = await createWorld({});
    const agent = createAgent(app);
    const csrfToken = await getCsrfToken(app, agent);
    const auth = { Authorization: `Bearer ${operatorToken(operator)}` };

    for (const [method, path] of [
      ['post', '/api/v1/operators/complete-pickup'],
      ['post', '/api/v1/operators/confirm-pickup'],
      ['post', '/api/v1/operators/orders/ORD-x/ready']
    ]) {
      const res = await agent[method](path).set(auth).set('x-csrf-token', csrfToken).send({});
      expect(res.status).toBe(404);
    }
  });
});
```

- [ ] **7.2 Run it** — `npm test -- tests/integration/kioskAdvance.test.js` → expect FAIL: `/api/v1/operators/advance` 404; legacy endpoints respond non-404.

- [ ] **7.3 Controller** — In `server/controllers/operatorController.js`:
  - Add to the requires block (after line 10): `const orderAdvanceService = require('../modules/orders/orderAdvanceService');` and `const extractBagToken = require('../modules/bags/extractBagToken');`. Remove `const pickupService = require('../services/operatorPickupService');` (line 9) once 7.5 empties it.
  - Add the kiosk advance handler:

```javascript
// State-driven kiosk advance (PR 9): in_progress -> processed (gate runs),
// ready_for_pickup -> picked_up (scan-OUT). Replaces scanProcessed /
// completePickup. Accepts a raw bag token or the printed claim URL.
exports.advance = ControllerHelpers.asyncWrapper(async (req, res) => {
  const bagToken = extractBagToken(req.body.bagToken || req.body.qrCode);
  if (!bagToken) return ControllerHelpers.sendError(res, 'A valid bag token is required', 400);
  try {
    const result = await orderAdvanceService.advance({ bagToken, operatorId: req.user.id, req });
    ControllerHelpers.sendSuccess(res, { action: result.action, order: result.order },
      `Order advanced to ${result.action}`);
  } catch (err) {
    if (err.isAdvanceError) {
      return ControllerHelpers.sendError(res, err.message, err.status, { code: err.code });
    }
    throw err;
  }
});
```

  - Replace the whole `exports.scanProcessed` function (lines 272–297, currently delegating to `bagWorkflowService.scanProcessed`) with:

```javascript
// Legacy kiosk endpoint — now a thin delegate onto the state-driven advance
// engine (PR 9). Kept so already-deployed kiosk clients keep working.
exports.scanProcessed = exports.advance;
```

  (Define it AFTER `exports.advance`.)
  - Delete `exports.markOrderReady` (lines 300–316), `exports.completePickup` (lines 318–344), and `exports.confirmPickup` (lines 346–363).

- [ ] **7.4 Routes** — In `server/routes/operatorRoutes.js`, the scanner block currently reads (lines 78–82):

```javascript
router.post('/scan-processed', operatorController.scanProcessed); // New endpoint for scanning processed bags
router.post('/complete-pickup', operatorController.completePickup); // New endpoint for completing pickup with bag verification
router.post('/orders/:orderId/process-bag', operatorController.markBagProcessed); // Legacy endpoint
router.post('/orders/:orderId/ready', operatorController.markOrderReady); // Deprecated
router.post('/confirm-pickup', operatorController.confirmPickup); // Legacy endpoint
```

Replace with:

```javascript
router.post('/advance', operatorController.advance); // PR 9 — state-driven scan-2/scan-3
router.post('/scan-processed', operatorController.scanProcessed); // legacy delegate -> advance
router.post('/orders/:orderId/process-bag', operatorController.markBagProcessed); // Legacy endpoint
```

(If PR 7 already removed/renamed any of these lines, delete whichever of `complete-pickup`, `orders/:orderId/ready`, `confirm-pickup` still exist and add the `advance` route.)

- [ ] **7.5 Service deletions** — In `server/services/operatorPickupService.js` delete `markOrderReady` (lines 63–105), `completePickup` (lines 107–177), and `confirmPickup` (lines 179–226), and remove them from `module.exports` (lines 228–234). Then check what's left:
  - `grep -rn "operatorPickupService" server/ tests/` and `grep -rn "sendPaymentReminder" server/`
  - If the only remaining consumer was the deleted code (PR 8 moved reminder ownership into `paymentVerificationJob`), **delete the whole file** plus its require in `server/services/operatorBagWorkflowService.js` (line 16, `const pickupService = require('./operatorPickupService');`) and in `server/controllers/operatorController.js` (line 9).
  - If `sendPaymentReminder` is still imported anywhere, keep the file with only `sendPaymentReminder` + `PickupError` exported and add a `// TODO(PR-cleanup)`-free header comment noting it is reminder-only now.
  - In `server/services/operatorBagWorkflowService.js` delete the `scanProcessed` function (line 407 in the pre-PR tree) and its `module.exports` entry — the kiosk route now hits `operatorController.advance` directly.
- [ ] **7.6 Clean up coupled tests** — `grep -rln "completePickup\|markOrderReady\|confirmPickup\|scanProcessed" tests/` → for each hit: if the test targets deleted behavior (multi-bag pickup verification, `bagsPickedUp` counters, direct `pickupService` unit tests), delete the test file/blocks; if it asserts route behavior that now delegates (e.g. scan-processed), update expectations to the advance response shape (`body.action`). Deletions of tests are paired with this commit so the suite stays green.
- [ ] **7.7 Run** — `npm test -- tests/integration/kioskAdvance.test.js tests/integration/operatorScanOut.test.js` then `npm test` (full suite) → expect PASS, no `--forceExit`, no dangling-handle warnings.
- [ ] **7.8 Commit:**

```bash
git add -A server/controllers/operatorController.js server/routes/operatorRoutes.js server/services/operatorPickupService.js server/services/operatorBagWorkflowService.js tests/
git commit -m "feat(kiosk): POST /operators/advance replaces scanProcessed/completePickup; legacy pickup paths deleted"
```

---

## Task 8 — Per-bag/IP attempt lockout + public operator-code endpoints (`/bags/:bagToken/intake|advance`)

**Files:**
- Create: `tests/integration/bagActionOperatorCode.test.js`
- Create: `server/services/codeAttemptLockout.js`
- Create: `server/controllers/bagActionController.js`
- Create: `server/routes/bagActionRoutes.js`
- Modify: `server/config/csrf-config.js` (PUBLIC_ENDPOINTS, after the `/api/concierge` entry at line 92)
- Modify: `server.js` (apiV1Router mounts — next to the PR 6 `/bags` mount)

- [ ] **8.1 Write the failing test** — `tests/integration/bagActionOperatorCode.test.js` (paste the `createWorld` fixture from Task 6.1):

```javascript
jest.mock('../../server/utils/emailService');

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../server');
const Order = require('../../server/models/Order');
const Customer = require('../../server/models/Customer');
const Affiliate = require('../../server/models/Affiliate');
const Operator = require('../../server/models/Operator');
const Bag = require('../../server/modules/bags/Bag');
const encryptionUtil = require('../../server/utils/encryption');
const roleCodes = require('../../server/utils/roleCodes');

jest.setTimeout(60000);

/* >>> paste the createWorld fixture from tests/integration/operatorScanOut.test.js here <<< */

describe('Public bag-URL operator-code endpoints', () => {
  test('POST /api/v1/bags/:bagToken/intake with a valid operator code creates the order (no CSRF, no JWT)', async () => {
    const { bagToken, operator } = await createWorld({}); // active bag, no order
    const res = await request(app)
      .post(`/api/v1/bags/${bagToken}/intake`)
      .send({
        operatorCode: 'OPCODE99',
        weight: 18.5,
        addOns: { premiumDetergent: true, fabricSoftener: false, stainRemover: false },
        freshAddOnsFormPlaced: true
      });
    expect(res.status).toBe(201);

    const order = await Order.findOne({ bagToken });
    expect(order).toBeTruthy();
    expect(order.status).toBe('in_progress');
    expect(order.actualWeight).toBeCloseTo(18.5, 2);
    // The operator was resolved from the code and recorded as the scanner.
    expect(order.intake.weighedBy.toString()).toBe(operator._id.toString());
  });

  test('POST /api/v1/bags/:bagToken/advance with a valid operator code advances the order', async () => {
    const { bagToken } = await createWorld({ orderStatus: 'in_progress', paymentStatus: 'awaiting' });
    const res = await request(app)
      .post(`/api/v1/bags/${bagToken}/advance`)
      .send({ operatorCode: 'OPCODE99' });
    expect(res.status).toBe(200);
    expect(res.body.action).toBe('processed');
  });

  test('wrong operator code -> generic 401; lockout after operator_scan_code_max_attempts failures', async () => {
    const { bagToken } = await createWorld({ orderStatus: 'in_progress' });

    for (let i = 0; i < 5; i++) { // default operator_scan_code_max_attempts = 5
      const res = await request(app)
        .post(`/api/v1/bags/${bagToken}/advance`)
        .send({ operatorCode: 'WRONGC99' });
      expect(res.status).toBe(401);
      expect(res.body.message).not.toMatch(/operator/i); // no role oracle on a bad guess
    }

    // 6th attempt: locked out even with the CORRECT code.
    const locked = await request(app)
      .post(`/api/v1/bags/${bagToken}/advance`)
      .send({ operatorCode: 'OPCODE99' });
    expect(locked.status).toBe(429);
  });

  test('a successful code clears the failure counter', async () => {
    const { bagToken } = await createWorld({ orderStatus: 'in_progress', paymentStatus: 'awaiting' });
    for (let i = 0; i < 3; i++) {
      await request(app).post(`/api/v1/bags/${bagToken}/advance`).send({ operatorCode: 'NOPE9999' });
    }
    const ok = await request(app)
      .post(`/api/v1/bags/${bagToken}/advance`)
      .send({ operatorCode: 'OPCODE99' });
    expect(ok.status).toBe(200);
  });

  test('open at-store order -> 409 on intake (advance it instead)', async () => {
    const { bagToken } = await createWorld({ orderStatus: 'in_progress' });
    const res = await request(app)
      .post(`/api/v1/bags/${bagToken}/intake`)
      .send({ operatorCode: 'OPCODE99', weight: 10, addOns: {}, freshAddOnsFormPlaced: true });
    expect(res.status).toBe(409);
  });
});
```

- [ ] **8.2 Run it** — `npm test -- tests/integration/bagActionOperatorCode.test.js` → expect FAIL: all routes 404 (router not mounted).

- [ ] **8.3 Lockout service** — Create `server/services/codeAttemptLockout.js`:

```javascript
// Per-bag/IP failed-code attempt lockout (spec §6.6/§9).
//
// Reuses the in-house Mongo-backed rate-limit store (the same infrastructure
// the express limiters use — server/middleware/rateLimitMongoStore.js) so the
// counter is shared across PM2 cluster workers and TTL-purged by Mongo.
// Unlike the express limiters this is NOT skipped in tests: lockout is a
// security behavior under test, and it counts FAILURES (a request limiter
// counts requests).
//
// Key shape: "<scope>:<sha256(bagToken)[0..16]>:<ip>" — the raw token never
// touches the store.

const crypto = require('crypto');
const mongoose = require('mongoose');
const MongoRateLimitStore = require('../middleware/rateLimitMongoStore');

const WINDOW_MS = 15 * 60 * 1000;
const STORE_NAME = 'bag_codes';

let store = null;
function getStore() {
  if (!store) {
    store = new MongoRateLimitStore({ windowMs: WINDOW_MS, name: STORE_NAME });
    store.init({ windowMs: WINDOW_MS }).catch(() => { /* TTL index best-effort */ });
  }
  return store;
}

function attemptKey({ scope, bagToken, ip }) {
  const tokenDigest = crypto.createHash('sha256')
    .update(String(bagToken || '')).digest('hex').slice(0, 16);
  return `${scope}:${tokenDigest}:${ip || 'no-ip'}`;
}

/** Record a failed attempt; returns the running failure count. */
async function registerFailure(key) {
  const { totalHits } = await getStore().increment(key);
  return totalHits;
}

/** True when the key has >= maxAttempts unexpired failures. */
async function isLockedOut(key, maxAttempts) {
  const doc = await mongoose.connection
    .collection(`ratelimit_${STORE_NAME}`)
    .findOne({ _id: key });
  if (!doc) return false;
  if (doc._expiresAt && doc._expiresAt < new Date()) return false;
  return doc.hits >= maxAttempts;
}

/** Wipe the counter (on a successful code entry). */
async function clearFailures(key) {
  return getStore().resetKey(key);
}

module.exports = { attemptKey, registerFailure, isLockedOut, clearFailures, WINDOW_MS };
```

- [ ] **8.4 Controller** — Create `server/controllers/bagActionController.js`:

```javascript
// Public bag-URL actions (spec §5/§6.4/§6.6) — the phone/ad-hoc path.
// No JWT: every mutation is authorized by a role code. Operator codes are
// resolved globally by HMAC (identify-and-verify); delivery codes are
// verified by affiliateDeliveryService against the order's own parties.

const Operator = require('../models/Operator');
const SystemConfig = require('../models/SystemConfig');
const ControllerHelpers = require('../utils/controllerHelpers');
const orderIntakeService = require('../modules/orders/orderIntakeService');
const orderAdvanceService = require('../modules/orders/orderAdvanceService');
const affiliateDeliveryService = require('../services/affiliateDeliveryService');
const codeAttemptLockout = require('../services/codeAttemptLockout');
const roleCodes = require('../utils/roleCodes');
const { logAuditEvent, AuditEvents } = require('../utils/auditLogger');

class BagActionError extends Error {
  constructor(code, message, status) {
    super(message);
    this.code = code;
    this.status = status;
    this.isBagActionError = true;
  }
}

function sendTypedError(res, err) {
  // Our own typed errors + the typed errors thrown by the intake/advance/
  // delivery services (all carry .code + .status). Generic messages only —
  // no token echo, no role oracle.
  const status = err.status || err.statusCode;
  if (status && status < 500) {
    return ControllerHelpers.sendError(res, err.message, status, { code: err.code || 'error' });
  }
  throw err; // unexpected -> error middleware
}

async function resolveOperatorByCode({ operatorCode, bagToken, req }) {
  const key = codeAttemptLockout.attemptKey({ scope: 'op', bagToken, ip: req.ip });
  const maxAttempts = await SystemConfig.getValue('operator_scan_code_max_attempts', 5);
  if (await codeAttemptLockout.isLockedOut(key, maxAttempts)) {
    throw new BagActionError('locked_out', 'Too many attempts — please try again later', 429);
  }
  const operator = operatorCode
    ? await Operator.findOne({ scanCodeHmac: roleCodes.hmacCode(operatorCode), isActive: true })
    : null;
  if (!operator) {
    await codeAttemptLockout.registerFailure(key);
    logAuditEvent(AuditEvents.OPERATOR_CODE_FAILED, { ip: req.ip, path: req.path }, req);
    throw new BagActionError('invalid_code', 'Invalid code', 401);
  }
  await codeAttemptLockout.clearFailures(key);
  return operator;
}

/**
 * POST /api/v1/bags/:bagToken/intake  { operatorCode, weight, addOns, freshAddOnsFormPlaced }
 */
exports.intakeWithCode = ControllerHelpers.asyncWrapper(async (req, res) => {
  try {
    const operator = await resolveOperatorByCode({
      operatorCode: req.body.operatorCode, bagToken: req.params.bagToken, req
    });
    const result = await orderIntakeService.createOrderFromBag({
      bagToken: req.params.bagToken,
      weight: req.body.weight,
      addOns: req.body.addOns,
      freshAddOnsFormPlaced: req.body.freshAddOnsFormPlaced,
      operatorId: operator._id,
      req
    });
    logAuditEvent(AuditEvents.OPERATOR_SCAN, {
      action: 'bag_url_intake', operatorId: operator.operatorId,
      orderId: result.order ? result.order.orderId : result.orderId
    }, req);
    return ControllerHelpers.sendSuccess(res, result, 'Order created', 201);
  } catch (err) {
    return sendTypedError(res, err);
  }
});

/**
 * POST /api/v1/bags/:bagToken/advance  { operatorCode }
 */
exports.advanceWithCode = ControllerHelpers.asyncWrapper(async (req, res) => {
  try {
    const operator = await resolveOperatorByCode({
      operatorCode: req.body.operatorCode, bagToken: req.params.bagToken, req
    });
    const result = await orderAdvanceService.advance({
      bagToken: req.params.bagToken, operatorId: operator._id, req
    });
    return ControllerHelpers.sendSuccess(res,
      { action: result.action, order: result.order }, `Order advanced to ${result.action}`);
  } catch (err) {
    return sendTypedError(res, err);
  }
});

/**
 * POST /api/v1/bags/:bagToken/confirm-delivery  { code, geo? }   (Task 9)
 */
exports.confirmDelivery = ControllerHelpers.asyncWrapper(async (req, res) => {
  try {
    const result = await affiliateDeliveryService.confirmDelivery({
      bagToken: req.params.bagToken,
      code: req.body.code,
      geo: req.body.geo,
      req
    });
    return ControllerHelpers.sendSuccess(res, {
      orderId: result.order.orderId,
      status: result.order.status,
      proofOfDelivery: {
        method: result.order.proofOfDelivery.method,
        confirmedByRole: result.order.proofOfDelivery.confirmedByRole,
        confirmedAt: result.order.proofOfDelivery.confirmedAt
      }
    }, 'Delivery confirmed');
  } catch (err) {
    return sendTypedError(res, err);
  }
});
```

(Until Task 9 lands, create `server/services/affiliateDeliveryService.js` as a stub exporting `confirmDelivery: async () => { const e = new Error('Not implemented'); e.status = 501; e.code = 'not_implemented'; throw e; }` so the require resolves; Task 9 replaces it.)

- [ ] **8.5 Routes + mounts + CSRF** — Create `server/routes/bagActionRoutes.js`:

```javascript
// Public bag-URL mutations (PR 9). CSRF-exempt (no ambient credential —
// authorized by role codes), but stacked behind a tight per-IP limiter and
// the per-bag/IP failed-attempt lockout enforced in the controller.
const express = require('express');
const router = express.Router();
const bagActionController = require('../controllers/bagActionController');
const { createCustomLimiter } = require('../middleware/rateLimiting');

const bagActionLimiter = createCustomLimiter({
  windowMs: 15 * 60 * 1000,
  max: 30,
  name: 'bag_actions',
  keyGenerator: (req) => req.ip,
  skip: () => process.env.NODE_ENV === 'test' // lockout still enforced in tests
});

router.post('/:bagToken/intake', bagActionLimiter, bagActionController.intakeWithCode);
router.post('/:bagToken/advance', bagActionLimiter, bagActionController.advanceWithCode);
router.post('/:bagToken/confirm-delivery', bagActionLimiter, bagActionController.confirmDelivery);

module.exports = router;
```

In `server.js`, locate the PR 6 bags mount (`grep -n "'/bags'" server.js`) and add directly below it (or, if absent, next to `apiV1Router.use('/orders', orderRoutes);`):

```javascript
apiV1Router.use('/bags', require('./server/routes/bagActionRoutes'));  // PR 9 — public code-gated bag actions
```

In `server/config/csrf-config.js`, add to `PUBLIC_ENDPOINTS` after the `'/api/concierge',` entry (line 92):

```javascript
    // Overloaded bag-URL actions (PR 9) — public, gated by role codes +
    // tight rate limit + per-bag/IP attempt lockout instead of CSRF (the
    // phone's native camera opens the page with no session/cookie).
    '/api/v1/bags/:bagToken/intake',
    '/api/v1/bags/:bagToken/advance',
    '/api/v1/bags/:bagToken/confirm-delivery',
```

- [ ] **8.6 Run again** — `npm test -- tests/integration/bagActionOperatorCode.test.js` → expect PASS (5 tests). The intake assertions exercise PR 7's `createOrderFromBag` — if `order.intake.weighedBy` is unset, reconcile with the PR 7 implementation (the canon says intake mirrors `bags[0].scannedBy.intake`; assert whichever field PR 7 stamps, but the operator identity MUST be recorded).
- [ ] **8.7 Commit:**

```bash
git add server/services/codeAttemptLockout.js server/controllers/bagActionController.js server/routes/bagActionRoutes.js server/services/affiliateDeliveryService.js server/config/csrf-config.js server.js tests/integration/bagActionOperatorCode.test.js
git commit -m "feat(bags): public code-gated intake/advance on the bag URL with per-bag/IP attempt lockout"
```

---

## Task 9 — `affiliateDeliveryService.confirmDelivery` + public confirm-delivery endpoint

**Files:**
- Create: `tests/integration/confirmDelivery.test.js`
- Replace: `server/services/affiliateDeliveryService.js` (the Task 8 stub)

- [ ] **9.1 Write the failing test** — `tests/integration/confirmDelivery.test.js` (paste the `createWorld` fixture from Task 6.1; note it provisions customer PIN `PINPIN`, vendor code `VENDOR`, operator code `OPCODE99`):

```javascript
jest.mock('../../server/utils/emailService');

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../server');
const emailService = require('../../server/utils/emailService');
const Order = require('../../server/models/Order');
const Customer = require('../../server/models/Customer');
const Affiliate = require('../../server/models/Affiliate');
const Operator = require('../../server/models/Operator');
const Bag = require('../../server/modules/bags/Bag');
const encryptionUtil = require('../../server/utils/encryption');
const roleCodes = require('../../server/utils/roleCodes');

jest.setTimeout(60000);

/* >>> paste the createWorld fixture from tests/integration/operatorScanOut.test.js here <<< */

const confirm = (bagToken, body) =>
  request(app).post(`/api/v1/bags/${bagToken}/confirm-delivery`).send(body);

describe('POST /api/v1/bags/:bagToken/confirm-delivery', () => {
  beforeEach(() => jest.clearAllMocks());

  test('vendor (affiliate) code on a picked_up order -> delivered, commission realized, both emails', async () => {
    const { bagToken, order, affiliate } = await createWorld({
      orderStatus: 'picked_up', paymentStatus: 'verified'
    });
    const res = await confirm(bagToken, { code: 'VENDOR' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('delivered');
    expect(res.body.proofOfDelivery.method).toBe('affiliate_code');
    expect(res.body.proofOfDelivery.confirmedByRole).toBe('affiliate');

    const reloaded = await Order.findOne({ orderId: order.orderId });
    expect(reloaded.status).toBe('delivered');
    expect(reloaded.deliveredAt).toBeInstanceOf(Date);
    expect(reloaded.bags[0].status).toBe('delivered');
    expect(reloaded.commissionRealized).toBe(true);
    expect(reloaded.commissionRealizedAt).toBeInstanceOf(Date);
    expect(reloaded.proofOfDelivery.confirmedById).toBe(affiliate.affiliateId);

    expect(emailService.sendCustomerDeliveredEmail).toHaveBeenCalledTimes(1);
    expect(emailService.sendAffiliateCommissionEmail).toHaveBeenCalledTimes(1);
  });

  test('customer PIN -> delivered with confirmedByRole customer; optional geo persists [lng,lat]', async () => {
    const { bagToken, order, customer } = await createWorld({
      orderStatus: 'picked_up', paymentStatus: 'verified'
    });
    const res = await confirm(bagToken, { code: 'PINPIN', geo: { lat: 30.2672, lng: -97.7431 } });
    expect(res.status).toBe(200);
    expect(res.body.proofOfDelivery.method).toBe('customer_pin');
    expect(res.body.proofOfDelivery.confirmedByRole).toBe('customer');

    const reloaded = await Order.findOne({ orderId: order.orderId });
    expect(reloaded.proofOfDelivery.confirmedById).toBe(customer.customerId);
    expect(reloaded.proofOfDelivery.geo.type).toBe('Point');
    expect(reloaded.proofOfDelivery.geo.coordinates[0]).toBeCloseTo(-97.7431, 4); // lng first
    expect(reloaded.proofOfDelivery.geo.coordinates[1]).toBeCloseTo(30.2672, 4);
  });

  test('operator code -> 401 with errors.code operator_code (re-intake hint, not a delivery)', async () => {
    const { bagToken } = await createWorld({ orderStatus: 'picked_up', paymentStatus: 'verified' });
    const res = await confirm(bagToken, { code: 'OPCODE99' });
    expect(res.status).toBe(401);
    expect(res.body.errors.code).toBe('operator_code');

    const order = await Order.findOne({ bagToken });
    expect(order.status).toBe('picked_up'); // untouched
  });

  test("ANOTHER affiliate's valid code -> generic 401 (verified against this order's parties only)", async () => {
    const { bagToken } = await createWorld({ orderStatus: 'picked_up', paymentStatus: 'verified' });
    await createWorld({}); // a second affiliate also using code VENDOR? No — make one with a distinct code:
    const otherWorld = await createWorld({});
    await Affiliate.updateOne(
      { affiliateId: otherWorld.affiliate.affiliateId },
      { $set: { affiliateDeliveryCodeHash: roleCodes.hashCode('OTHERV') } }
    );
    const res = await confirm(bagToken, { code: 'OTHERV' });
    expect(res.status).toBe(401);
    expect(res.body.errors.code).toBe('invalid_code'); // same generic error as a wrong guess
  });

  test('non-picked_up order -> 409 not_picked_up', async () => {
    const { bagToken } = await createWorld({ orderStatus: 'processed', paymentStatus: 'verified' });
    const res = await confirm(bagToken, { code: 'VENDOR' });
    expect(res.status).toBe(409);
    expect(res.body.errors.code).toBe('not_picked_up');
  });

  test('double-confirm -> 409; commission realized exactly once', async () => {
    const { bagToken, order } = await createWorld({ orderStatus: 'picked_up', paymentStatus: 'verified' });
    const first = await confirm(bagToken, { code: 'VENDOR' });
    expect(first.status).toBe(200);
    const stamped = (await Order.findOne({ orderId: order.orderId })).commissionRealizedAt;

    const second = await confirm(bagToken, { code: 'VENDOR' });
    expect(second.status).toBe(409);

    const reloaded = await Order.findOne({ orderId: order.orderId });
    expect(reloaded.commissionRealizedAt.getTime()).toBe(stamped.getTime()); // unchanged
    expect(emailService.sendAffiliateCommissionEmail).toHaveBeenCalledTimes(1);
  });

  test('wrong code -> 401 and lockout after delivery_code_max_attempts; success still blocked while locked', async () => {
    const { bagToken } = await createWorld({ orderStatus: 'picked_up', paymentStatus: 'verified' });
    for (let i = 0; i < 5; i++) { // default delivery_code_max_attempts = 5
      const res = await confirm(bagToken, { code: 'NOPE99' });
      expect(res.status).toBe(401);
    }
    const locked = await confirm(bagToken, { code: 'VENDOR' });
    expect(locked.status).toBe(429);
  });

  test('delivery still succeeds when the customer email throws', async () => {
    const { bagToken } = await createWorld({ orderStatus: 'picked_up', paymentStatus: 'verified' });
    emailService.sendCustomerDeliveredEmail.mockRejectedValueOnce(new Error('SMTP down'));
    const res = await confirm(bagToken, { code: 'VENDOR' });
    expect(res.status).toBe(200);
    const order = await Order.findOne({ bagToken });
    expect(order.status).toBe('delivered');
  });
});
```

- [ ] **9.2 Run it** — `npm test -- tests/integration/confirmDelivery.test.js` → expect FAIL: every call returns 501 `not_implemented` (Task 8 stub).

- [ ] **9.3 Implement** — Replace `server/services/affiliateDeliveryService.js` with:

```javascript
// Door delivery confirmation on the overloaded bag URL (spec §6.6).
//
// The submitted code is verified ONLY against this order's customer
// (deliveryPinHash) and affiliate (affiliateDeliveryCodeHash) — constant-time,
// both verifications always run, no global lookup, no role oracle. Operator
// codes are identified (global HMAC lookup) and rejected with a distinct 401
// so the page can branch to the re-intake prompt instead.
//
// Success: picked_up -> delivered, proofOfDelivery stamped, commission
// realized exactly once, customer "delivered" + affiliate commission emails
// (best-effort). Public endpoint -> per-bag/IP attempt lockout.

const Bag = require('../modules/bags/Bag');
const Order = require('../models/Order');
const Customer = require('../models/Customer');
const Affiliate = require('../models/Affiliate');
const Operator = require('../models/Operator');
const SystemConfig = require('../models/SystemConfig');
const { applyTransition } = require('../modules/orders/orderStateMachine');
const { OPEN_STATUSES } = require('../modules/orders/orderAdvanceService');
const codeAttemptLockout = require('./codeAttemptLockout');
const roleCodes = require('../utils/roleCodes');
const emailService = require('../utils/emailService');
const { logAuditEvent, AuditEvents } = require('../utils/auditLogger');
const logger = require('../utils/logger');

class DeliveryError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
    this.isDeliveryError = true;
  }
}

function toGeoPoint(geo) {
  if (!geo) return undefined;
  const lat = Number(geo.lat);
  const lng = Number(geo.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return undefined;
  return { type: 'Point', coordinates: [lng, lat] }; // GeoJSON: [lng, lat]
}

async function confirmDelivery({ bagToken, code, geo, req }) {
  const bag = await Bag.findOne({ tokenHash: Bag.hashToken(bagToken) });
  if (!bag) throw new DeliveryError('invalid_bag', 'Bag not found', 404);

  const order = await Order.findOne({ bagId: bag.bagId, status: { $in: OPEN_STATUSES } });
  if (!order || order.status !== 'picked_up') {
    throw new DeliveryError('not_picked_up', 'This order is not out for delivery', 409);
  }

  const key = codeAttemptLockout.attemptKey({ scope: 'deliver', bagToken, ip: req && req.ip });
  const maxAttempts = await SystemConfig.getValue('delivery_code_max_attempts', 5);
  if (await codeAttemptLockout.isLockedOut(key, maxAttempts)) {
    throw new DeliveryError('locked_out', 'Too many attempts — please try again later', 429);
  }

  // Operator code? Back-at-the-store, not a delivery (§6.6). Distinct 401 so
  // the page can offer re-intake; does NOT count toward the delivery lockout
  // (it identified a real operator — it isn't a guess).
  const operator = code
    ? await Operator.findOne({ scanCodeHmac: roleCodes.hmacCode(code), isActive: true })
    : null;
  if (operator) {
    logAuditEvent(AuditEvents.DELIVERY_CODE_FAILED, {
      reason: 'operator_code', orderId: order.orderId
    }, req);
    throw new DeliveryError('operator_code',
      'Operator codes cannot confirm deliveries — re-intake the bag instead', 401);
  }

  // Verify against THIS order's parties only. Run BOTH verifications every
  // time (constant work; no oracle distinguishing customer vs affiliate).
  const customer = await Customer.findOne({ customerId: order.customerId })
    .select('+deliveryPinHash');
  const affiliate = await Affiliate.findOne({ affiliateId: order.affiliateId })
    .select('+affiliateDeliveryCodeHash');
  const customerMatch = roleCodes.verifyCode(code, customer && customer.deliveryPinHash);
  const affiliateMatch = roleCodes.verifyCode(code, affiliate && affiliate.affiliateDeliveryCodeHash);

  if (!customerMatch && !affiliateMatch) {
    const attempts = await codeAttemptLockout.registerFailure(key);
    logAuditEvent(AuditEvents.DELIVERY_CODE_FAILED, {
      orderId: order.orderId, attempts
    }, req);
    throw new DeliveryError('invalid_code', 'Invalid code', 401);
  }
  await codeAttemptLockout.clearFailures(key);

  const now = new Date();
  applyTransition(order, 'delivered');
  order.intake.deliveredAt = now;
  order.intake.deliveredBy = order.affiliateId; // the affiliate is at the door either way
  if (order.bags[0]) {
    order.bags[0].status = 'delivered';
    order.bags[0].scannedAt.delivered = now;
    order.bags[0].scannedBy.delivered = order.affiliateId;
  }
  order.proofOfDelivery = {
    method: customerMatch ? 'customer_pin' : 'affiliate_code',
    confirmedByRole: customerMatch ? 'customer' : 'affiliate',
    confirmedById: customerMatch ? order.customerId : order.affiliateId,
    confirmedAt: now,
    ...(toGeoPoint(geo) ? { geo: toGeoPoint(geo) } : {})
  };
  // Commission is realized at delivered ONLY (spec §6.4/§6.6) — set-once;
  // the Order pre-save set-once stamping makes a re-save a no-op.
  if (!order.commissionRealized) {
    order.commissionRealized = true;
    order.commissionRealizedAt = now;
  }
  await order.save();

  // Notifications are best-effort — never block a confirmed delivery.
  try {
    const affiliateName = affiliate
      ? (affiliate.businessName || `${affiliate.firstName} ${affiliate.lastName}`)
      : null;
    if (customer && customer.email) {
      await emailService.sendCustomerDeliveredEmail(customer, order, { affiliateName });
    }
    if (affiliate && affiliate.email) {
      await emailService.sendAffiliateCommissionEmail(affiliate, order, customer);
    }
  } catch (emailError) {
    logger.error(`Delivery emails failed for order ${order.orderId} (non-blocking):`, emailError);
  }

  logAuditEvent(AuditEvents.DELIVERY_CONFIRMED, {
    orderId: order.orderId,
    method: order.proofOfDelivery.method,
    confirmedByRole: order.proofOfDelivery.confirmedByRole
  }, req);

  return { order };
}

module.exports = { confirmDelivery, DeliveryError };
```

- [ ] **9.4 Run again** — `npm test -- tests/integration/confirmDelivery.test.js` → expect PASS (8 tests).
- [ ] **9.5 Commit:**

```bash
git add server/services/affiliateDeliveryService.js tests/integration/confirmDelivery.test.js
git commit -m "feat(delivery): confirm-delivery via customer PIN / vendor code — delivered + commission at door"
```

---

## Task 9b — Admin `manual_confirm` override stamps `proofOfDelivery` (spec §6.6 edge case + §11 test)

Spec §6.6 edge cases: "admin override → `manual_confirm` via the status PUT"; §11 lists "admin manual_confirm override" among the confirm-delivery tests. PR 4's `updateOrderStatus` already permits an admin `picked_up → delivered` transition (the shared map) and the Order pre-save realizes commission — but nothing stamps `proofOfDelivery`, so admin-overridden deliveries would land with commission realized and an EMPTY `proofOfDelivery`. This task closes that: when an admin transitions an order to `delivered` and `proofOfDelivery.method` is unset, stamp `{ method:'manual_confirm', confirmedByRole:'admin', confirmedById, confirmedAt }` (the `manual_confirm` enum value exists in PR 4's schema, until now write-orphaned).

**Files:**
- Create: `tests/integration/adminManualConfirm.test.js`
- Modify: `server/controllers/orderController.js` (`updateOrderStatus` — delivered branch)

- [ ] **9b.1 Write the failing test** — `tests/integration/adminManualConfirm.test.js` (paste the `createWorld` fixture from Task 6.1; `/api/v1/orders/:orderId/status` is a CSRF CRITICAL endpoint — agent + `x-csrf-token` + admin bearer, same pattern as `tests/integration/readyForPickupGate.test.js`):

```javascript
jest.mock('../../server/utils/emailService');

const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const app = require('../../server');
const Order = require('../../server/models/Order');
const Customer = require('../../server/models/Customer');
const Affiliate = require('../../server/models/Affiliate');
const Operator = require('../../server/models/Operator');
const Bag = require('../../server/modules/bags/Bag');
const encryptionUtil = require('../../server/utils/encryption');
const roleCodes = require('../../server/utils/roleCodes');
const { getCsrfToken, createAgent } = require('../helpers/csrfHelper');

jest.setTimeout(60000);

/* >>> paste the createWorld fixture from tests/integration/operatorScanOut.test.js here <<< */

describe('admin manual_confirm override (spec §6.6 / §11)', () => {
  let agent;
  let csrfToken;
  let adminToken;

  beforeEach(async () => {
    agent = createAgent(app);
    csrfToken = await getCsrfToken(app, agent);
    adminToken = jwt.sign(
      { id: new mongoose.Types.ObjectId().toString(), role: 'admin' },
      process.env.JWT_SECRET || 'test-secret'
    );
  });

  test('admin PUT picked_up -> delivered stamps proofOfDelivery manual_confirm + realizes commission', async () => {
    const { order } = await createWorld({ orderStatus: 'picked_up', paymentStatus: 'verified' });

    const res = await agent
      .put(`/api/v1/orders/${order.orderId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-csrf-token', csrfToken)
      .send({ status: 'delivered' });
    expect(res.status).toBe(200);

    const reloaded = await Order.findOne({ orderId: order.orderId });
    expect(reloaded.status).toBe('delivered');
    expect(reloaded.proofOfDelivery.method).toBe('manual_confirm');
    expect(reloaded.proofOfDelivery.confirmedByRole).toBe('admin');
    expect(reloaded.proofOfDelivery.confirmedById).toBeTruthy();
    expect(reloaded.proofOfDelivery.confirmedAt).toBeInstanceOf(Date);
    expect(reloaded.commissionRealized).toBe(true);
    expect(reloaded.commissionRealizedAt).toBeInstanceOf(Date);
  });

  test('does not overwrite an existing proofOfDelivery method', async () => {
    // Defensive: if a delivered-bound save already carries a proof (e.g. a
    // service set affiliate_code in the same request), the stamp must not
    // clobber it. Simulate by pre-setting proofOfDelivery on a picked_up
    // order before the admin PUT.
    const { order } = await createWorld({ orderStatus: 'picked_up', paymentStatus: 'verified' });
    order.proofOfDelivery = {
      method: 'affiliate_code', confirmedByRole: 'affiliate',
      confirmedById: order.affiliateId, confirmedAt: new Date()
    };
    await order.save();

    const res = await agent
      .put(`/api/v1/orders/${order.orderId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-csrf-token', csrfToken)
      .send({ status: 'delivered' });
    expect(res.status).toBe(200);

    const reloaded = await Order.findOne({ orderId: order.orderId });
    expect(reloaded.proofOfDelivery.method).toBe('affiliate_code'); // untouched
  });
});
```

- [ ] **9b.2 Run it** — `npm test -- tests/integration/adminManualConfirm.test.js` → expect FAIL: first test's `reloaded.proofOfDelivery.method` is `undefined` (nothing stamps it).

- [ ] **9b.3 Implement** — in `server/controllers/orderController.js` `updateOrderStatus`, in the post-PR 4 body (shared `applyTransition` + gate), immediately before the `await order.save()` that persists the transition, add:

```javascript
    // Spec §6.6: admin override to delivered = manual_confirm proof.
    // Only when no proof exists — never clobber a code/PIN-confirmed proof.
    if (status === 'delivered'
        && ['admin', 'administrator'].includes(req.user.role)
        && !(order.proofOfDelivery && order.proofOfDelivery.method)) {
      order.proofOfDelivery = {
        method: 'manual_confirm',
        confirmedByRole: 'admin',
        confirmedById: String(req.user.id),
        confirmedAt: new Date()
      };
    }
```

  (Verify the transition map even lets non-admin roles PUT to `delivered` — `grep -n "delivered" server/controllers/orderController.js server/modules/orders/orderStateMachine.js`. If role-scoping already restricts delivered-PUTs to admins, the role check above is belt-and-braces; keep it.)

- [ ] **9b.4 Run again** — `npm test -- tests/integration/adminManualConfirm.test.js` → expect PASS (2 tests). Re-run the PR 4 gate suite for no-regression: `npm test -- tests/integration/readyForPickupGate.test.js`.
- [ ] **9b.5 Commit:**

```bash
git add server/controllers/orderController.js tests/integration/adminManualConfirm.test.js
git commit -m "feat(orders): admin delivered override stamps proofOfDelivery manual_confirm (spec §6.6)"
```

---

## Task 10 — Re-intake: operator code on a `picked_up` bag auto-delivers the prior order

**Files:**
- Create: `tests/integration/reintake.test.js`
- Modify: `server/modules/orders/orderIntakeService.js` (PR 7 file — the open-order guard inside `createOrderFromBag`)

PR 7 built `createOrderFromBag` to spec §6.4, whose step 1 already includes the re-intake rule. This task **proves** the full behavior (auto-deliver with `method:'reintake'`, commission exactly once, `ORDER_REINTAKE` audit, delivered + commission emails, new order created) and completes whatever part PR 7 left out.

- [ ] **10.1 Write the failing test** — `tests/integration/reintake.test.js` (paste the `createWorld` fixture from Task 6.1):

```javascript
jest.mock('../../server/utils/emailService');

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../server');
const emailService = require('../../server/utils/emailService');
const Order = require('../../server/models/Order');
const Customer = require('../../server/models/Customer');
const Affiliate = require('../../server/models/Affiliate');
const Operator = require('../../server/models/Operator');
const Bag = require('../../server/modules/bags/Bag');
const encryptionUtil = require('../../server/utils/encryption');
const roleCodes = require('../../server/utils/roleCodes');

jest.setTimeout(60000);

/* >>> paste the createWorld fixture from tests/integration/operatorScanOut.test.js here <<< */

describe('Re-intake of a picked_up bag (operator code on the bag URL)', () => {
  beforeEach(() => jest.clearAllMocks());

  test('auto-delivers the prior order (method reintake, commission once) and opens a new in_progress order', async () => {
    const { bagToken, bag, order: prior, operator } = await createWorld({
      orderStatus: 'picked_up', paymentStatus: 'verified'
    });

    const res = await request(app)
      .post(`/api/v1/bags/${bagToken}/intake`)
      .send({
        operatorCode: 'OPCODE99', weight: 12,
        addOns: { premiumDetergent: false, fabricSoftener: false, stainRemover: false },
        freshAddOnsFormPlaced: true
      });
    expect(res.status).toBe(201);

    const closed = await Order.findOne({ orderId: prior.orderId });
    expect(closed.status).toBe('delivered');
    expect(closed.proofOfDelivery.method).toBe('reintake');
    expect(closed.proofOfDelivery.confirmedByRole).toBe('operator');
    expect(closed.commissionRealized).toBe(true);
    expect(closed.commissionRealizedAt).toBeInstanceOf(Date);

    const orders = await Order.find({ bagId: bag.bagId }).sort({ createdAt: 1 });
    expect(orders).toHaveLength(2);
    expect(orders[1].status).toBe('in_progress');
    expect(orders[1].actualWeight).toBeCloseTo(12, 2);
    expect(orders[1].orderId).not.toBe(prior.orderId);

    // Prior order's close-out notifications fired exactly once.
    expect(emailService.sendCustomerDeliveredEmail).toHaveBeenCalledTimes(1);
    expect(emailService.sendAffiliateCommissionEmail).toHaveBeenCalledTimes(1);
  });

  test('double re-intake scan cannot double-close or double-realize commission', async () => {
    const { bagToken, order: prior } = await createWorld({
      orderStatus: 'picked_up', paymentStatus: 'verified'
    });
    const body = { operatorCode: 'OPCODE99', weight: 12, addOns: {}, freshAddOnsFormPlaced: true };

    const first = await request(app).post(`/api/v1/bags/${bagToken}/intake`).send(body);
    expect(first.status).toBe(201);
    const stamped = (await Order.findOne({ orderId: prior.orderId })).commissionRealizedAt;

    // Second scan: an in_progress order is now open at the store -> 409.
    const second = await request(app).post(`/api/v1/bags/${bagToken}/intake`).send(body);
    expect(second.status).toBe(409);

    const closed = await Order.findOne({ orderId: prior.orderId });
    expect(closed.commissionRealizedAt.getTime()).toBe(stamped.getTime());
    expect(emailService.sendAffiliateCommissionEmail).toHaveBeenCalledTimes(1);
  });

  test('customer/vendor code on the intake endpoint cannot trigger re-intake (401)', async () => {
    const { bagToken, order: prior } = await createWorld({
      orderStatus: 'picked_up', paymentStatus: 'verified'
    });
    const res = await request(app)
      .post(`/api/v1/bags/${bagToken}/intake`)
      .send({ operatorCode: 'VENDOR', weight: 12, addOns: {}, freshAddOnsFormPlaced: true });
    expect(res.status).toBe(401);
    expect((await Order.findOne({ orderId: prior.orderId })).status).toBe('picked_up');
  });
});
```

- [ ] **10.2 Run it** — `npm test -- tests/integration/reintake.test.js` → if PR 7 fully implemented the branch, only the email/audit assertions may fail; if it implemented none of it, the first test fails with a 409 from the open-order guard. Either failure is "for the right reason."

- [ ] **10.3 Implement/complete the branch** — In `server/modules/orders/orderIntakeService.js`, locate the open-order guard (`grep -n "order_already_open\|picked_up" server/modules/orders/orderIntakeService.js`). The final shape of the guard must be exactly this (reconcile the PR 7 code to it; reuse the file's existing imports — add `applyTransition`, `emailService`, `logAuditEvent`/`AuditEvents`, `logger` if missing):

```javascript
  const openOrder = await Order.findOne({
    bagId: bag.bagId,
    status: { $in: ['in_progress', 'processed', 'ready_for_pickup', 'picked_up'] }
  });
  if (openOrder) {
    if (openOrder.status !== 'picked_up') {
      // Still at the store — advance it, don't re-intake (spec §6.4 step 1).
      throw new IntakeError('order_already_open', 'An order is already open for this bag', 409);
    }
    // RE-INTAKE (Rick's rule): the bag is physically back at the store, so the
    // prior order was delivered but never confirmed. Auto-deliver it exactly
    // once, then fall through to create the new order.
    const now = new Date();
    applyTransition(openOrder, 'delivered');
    openOrder.intake.deliveredAt = now;
    openOrder.intake.deliveredBy = openOrder.affiliateId;
    if (openOrder.bags[0]) {
      openOrder.bags[0].status = 'delivered';
      openOrder.bags[0].scannedAt.delivered = now;
      openOrder.bags[0].scannedBy.delivered = openOrder.affiliateId;
    }
    openOrder.proofOfDelivery = {
      method: 'reintake',
      confirmedByRole: 'operator',
      confirmedById: String(operatorId),
      confirmedAt: now
    };
    if (!openOrder.commissionRealized) {
      openOrder.commissionRealized = true;          // commission at delivered ONLY,
      openOrder.commissionRealizedAt = now;          // including the re-intake path
    }
    await openOrder.save();

    try {
      const priorCustomer = await Customer.findOne({ customerId: openOrder.customerId });
      const priorAffiliate = await Affiliate.findOne({ affiliateId: openOrder.affiliateId });
      const affiliateName = priorAffiliate
        ? (priorAffiliate.businessName || `${priorAffiliate.firstName} ${priorAffiliate.lastName}`)
        : null;
      if (priorCustomer && priorCustomer.email) {
        await emailService.sendCustomerDeliveredEmail(priorCustomer, openOrder, { affiliateName });
      }
      if (priorAffiliate && priorAffiliate.email) {
        await emailService.sendAffiliateCommissionEmail(priorAffiliate, openOrder, priorCustomer);
      }
    } catch (emailError) {
      logger.error(`Re-intake close-out emails failed for ${openOrder.orderId} (non-blocking):`, emailError);
    }

    logAuditEvent(AuditEvents.ORDER_REINTAKE, {
      priorOrderId: openOrder.orderId, bagId: bag.bagId, operatorId
    }, req);
  }
```

(`IntakeError` is whatever typed error class PR 7 defined in this file — keep its name. If PR 7 used a different variable than `bag` for the resolved bag, adapt. Do NOT change the function's signature or return shape.)

- [ ] **10.4 Run again** — `npm test -- tests/integration/reintake.test.js tests/integration/confirmDelivery.test.js` → expect PASS (re-intake AND the delivery suite — proves no double-commission regression).
- [ ] **10.5 Commit:**

```bash
git add server/modules/orders/orderIntakeService.js tests/integration/reintake.test.js
git commit -m "feat(orders): re-intake auto-delivers the prior picked_up order (method reintake, commission once)"
```

---

## Task 11 — Claim resolver returns `{ status, awaitingDelivery, nextAction }` (parity with the PR 7 bags resolver)

> **PR 7 already shipped half of this** (Task 8b there): `server/modules/orders/openOrderContext.js` exists, `bagService.resolveByToken` + `bagController.resolveBag` already attach `nextAction`/`order` to the claimed branch, and `tests/integration/bagResolveContext.test.js` already pins the `/api/v1/bags/resolve/:token` side. This task REUSES that helper for the customer claim resolver and REPLACES the test file with the both-resolvers version below (PR 9 fixture). Verify first: `ls server/modules/orders/openOrderContext.js && grep -n "getOpenOrderContext" server/modules/bags/bagService.js` — if missing, PR 7 deviated; execute PR 7 Task 8b's server-side steps before continuing.

**Files:**
- Modify (replace): `tests/integration/bagResolveContext.test.js` (PR 7 file — extend to cover both resolvers)
- Modify: `server/services/bagClaimService.js` (PR 6 file — `resolveClaimToken` claimed branch)

- [ ] **11.1 Write the failing test** — replace the body of `tests/integration/bagResolveContext.test.js` with (paste the `createWorld` fixture from Task 6.1):

```javascript
jest.mock('../../server/utils/emailService');

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../server');
const Order = require('../../server/models/Order');
const Customer = require('../../server/models/Customer');
const Affiliate = require('../../server/models/Affiliate');
const Operator = require('../../server/models/Operator');
const Bag = require('../../server/modules/bags/Bag');
const encryptionUtil = require('../../server/utils/encryption');
const roleCodes = require('../../server/utils/roleCodes');

jest.setTimeout(60000);

/* >>> paste the createWorld fixture from tests/integration/operatorScanOut.test.js here <<< */

describe('Resolve endpoints expose order context (PR 9)', () => {
  test.each([
    ['in_progress', false, 'advance'],
    ['processed', false, 'advance'],
    ['ready_for_pickup', false, 'advance'],
    ['picked_up', true, 'deliver-or-reintake']
  ])('claimed bag with a %s order -> awaitingDelivery=%s, nextAction=%s', async (status, awaiting, nextAction) => {
    const { bagToken } = await createWorld({ orderStatus: status, paymentStatus: 'verified' });

    const resolve = await request(app).get(`/api/v1/bags/resolve/${bagToken}`);
    expect(resolve.status).toBe(200);
    expect(resolve.body.order.status).toBe(status);
    expect(resolve.body.order.awaitingDelivery).toBe(awaiting);
    expect(resolve.body.order.nextAction).toBe(nextAction);

    const claim = await request(app).get(`/api/v1/customers/claim/${bagToken}`);
    expect(claim.status).toBe(200);
    expect(claim.body.state).toBe('claimed');
    expect(claim.body.order.status).toBe(status);
    expect(claim.body.order.awaitingDelivery).toBe(awaiting);
    expect(claim.body.order.nextAction).toBe(nextAction);
  });

  test('claimed bag with NO open order -> nextAction intake, no order object', async () => {
    const { bagToken } = await createWorld({});
    const resolve = await request(app).get(`/api/v1/bags/resolve/${bagToken}`);
    expect(resolve.status).toBe(200);
    expect(resolve.body.nextAction).toBe('intake');
    expect(resolve.body.order).toBeFalsy();
  });

  test('no customer PII leaks through either resolver', async () => {
    const { bagToken, customer } = await createWorld({
      orderStatus: 'picked_up', paymentStatus: 'verified'
    });
    for (const path of [`/api/v1/bags/resolve/${bagToken}`, `/api/v1/customers/claim/${bagToken}`]) {
      const res = await request(app).get(path);
      const body = JSON.stringify(res.body);
      expect(body).not.toContain(customer.email);
      expect(body).not.toContain(customer.lastName);
      expect(body).not.toContain(customer.phone);
    }
  });
});
```

- [ ] **11.2 Run it** — `npm test -- tests/integration/bagResolveContext.test.js` → expect FAIL on the **claim**-endpoint assertions only (`claim.body.order` undefined — `bagClaimService` doesn't attach order context yet); the `/api/v1/bags/resolve/` assertions already pass (PR 7 Task 8b shipped that side).

- [ ] **11.3 Wire the claim resolver** — `server/services/bagClaimService.js` — in `resolveClaimToken`, the claimed branch (`state: 'claimed'`) gains the same fields the bags resolver already returns (helper from PR 7 — `server/modules/orders/openOrderContext.js`):

```javascript
    const { getOpenOrderContext } = require('../modules/orders/openOrderContext');
    const ctx = await getOpenOrderContext(bag.bagId);
    return {
      state: 'claimed',
      bag,
      nextAction: ctx.nextAction,
      ...(ctx.order ? { order: ctx.order } : {})
    };
```

  (Hoist the require to the top imports; keep whatever fields PR 6 already returns on this branch — add, don't remove. Verify `customerController.resolveClaim` forwards `order`/`nextAction` to the response: `grep -n "resolveClaim" server/controllers/customerController.js`.)
- [ ] **11.4 Run again** — `npm test -- tests/integration/bagResolveContext.test.js` → expect PASS (6 tests). Also re-run the PR 6/7 claim+bag suites to prove no regression: `npm test -- tests/integration/customerClaim.test.js tests/integration/bags.test.js` (exact file names per the merged tree — `ls tests/integration | grep -i "claim\|bag"`).
- [ ] **11.5 Commit:**

```bash
git add server/services/bagClaimService.js tests/integration/bagResolveContext.test.js
git commit -m "feat(bags): claim resolver returns open-order context (parity with PR 7 bags resolver)"
```

---

## Task 12 — Claim page: deliver panel, re-intake prompt, status branch (+ i18n, 4 langs)

**Files:**
- Create: `tests/unit/i18nClaimDeliverKeys.test.js`
- Modify: `public/claim-embed.html` (PR 6 file — add three panels)
- Modify: `public/assets/js/claim.js` (PR 6 file — branch logic + handlers)
- Modify: `public/locales/{en,es,pt,de}/common.json` (claim.deliver.* / claim.reintake.* / claim.scan.operatorCodeLabel / claim.status.*)

- [ ] **12.1 Write the failing test** — `tests/unit/i18nClaimDeliverKeys.test.js`:

```javascript
const path = require('path');

const LANGS = ['en', 'es', 'pt', 'de'];
const KEYS = [
  'claim.deliver.title', 'claim.deliver.codeLabel', 'claim.deliver.codePlaceholder',
  'claim.deliver.geoOptIn', 'claim.deliver.rememberCode', 'claim.deliver.confirm',
  'claim.deliver.success', 'claim.deliver.badCode', 'claim.deliver.lockedOut',
  'claim.reintake.prompt', 'claim.reintake.confirm',
  'claim.scan.operatorCodeLabel',
  'claim.status.in_progress', 'claim.status.processed', 'claim.status.ready_for_pickup',
  'claim.status.picked_up', 'claim.status.delivered', 'claim.status.loginCta'
];

function dig(obj, dotted) {
  return dotted.split('.').reduce((o, k) => (o ? o[k] : undefined), obj);
}

describe('claim deliver/status/reintake i18n parity', () => {
  for (const lang of LANGS) {
    describe(lang, () => {
      const json = require(path.join(__dirname, `../../public/locales/${lang}/common.json`));
      for (const key of KEYS) {
        test(`has ${key}`, () => {
          expect(typeof dig(json, key)).toBe('string');
          expect(dig(json, key).length).toBeGreaterThan(0);
        });
      }
    });
  }
});
```

- [ ] **12.2 Run it** — `npm test -- tests/unit/i18nClaimDeliverKeys.test.js` → expect FAIL: keys undefined in all four files.

- [ ] **12.3 Locales** — Merge into the existing top-level `"claim"` object of each `public/locales/{lang}/common.json` (PR 6 created `claim.*`; ADD these siblings, do not remove existing keys).

`en`:

```json
"deliver": {
  "title": "Confirm delivery",
  "codeLabel": "Delivery code or PIN",
  "codePlaceholder": "Enter your code",
  "geoOptIn": "Attach my location to this confirmation",
  "rememberCode": "Remember my code on this device",
  "confirm": "Confirm delivery",
  "success": "Delivery confirmed — thank you!",
  "badCode": "That code didn't match. Please try again.",
  "lockedOut": "Too many attempts. Please try again later."
},
"reintake": {
  "prompt": "Mark delivered & start a new order?",
  "confirm": "Yes — start a new order"
},
"scan": { "operatorCodeLabel": "Operator code" },
"status": {
  "in_progress": "Your laundry is being processed",
  "processed": "Your laundry is washed and waiting at the store",
  "ready_for_pickup": "Your laundry is ready — your delivery provider will collect it soon",
  "picked_up": "Your laundry is on the way",
  "delivered": "Your laundry was delivered",
  "loginCta": "Log in to see your order"
}
```

`es`:

```json
"deliver": {
  "title": "Confirmar entrega",
  "codeLabel": "Código de entrega o PIN",
  "codePlaceholder": "Introduce tu código",
  "geoOptIn": "Adjuntar mi ubicación a esta confirmación",
  "rememberCode": "Recordar mi código en este dispositivo",
  "confirm": "Confirmar entrega",
  "success": "Entrega confirmada — ¡gracias!",
  "badCode": "El código no coincide. Inténtalo de nuevo.",
  "lockedOut": "Demasiados intentos. Inténtalo más tarde."
},
"reintake": {
  "prompt": "¿Marcar como entregado y comenzar un nuevo pedido?",
  "confirm": "Sí — comenzar un nuevo pedido"
},
"scan": { "operatorCodeLabel": "Código de operador" },
"status": {
  "in_progress": "Tu ropa se está procesando",
  "processed": "Tu ropa está lavada y esperando en la tienda",
  "ready_for_pickup": "Tu ropa está lista — tu repartidor la recogerá pronto",
  "picked_up": "Tu ropa está en camino",
  "delivered": "Tu ropa fue entregada",
  "loginCta": "Inicia sesión para ver tu pedido"
}
```

`pt`:

```json
"deliver": {
  "title": "Confirmar entrega",
  "codeLabel": "Código de entrega ou PIN",
  "codePlaceholder": "Digite seu código",
  "geoOptIn": "Anexar minha localização a esta confirmação",
  "rememberCode": "Lembrar meu código neste dispositivo",
  "confirm": "Confirmar entrega",
  "success": "Entrega confirmada — obrigado!",
  "badCode": "O código não confere. Tente novamente.",
  "lockedOut": "Muitas tentativas. Tente novamente mais tarde."
},
"reintake": {
  "prompt": "Marcar como entregue e iniciar um novo pedido?",
  "confirm": "Sim — iniciar um novo pedido"
},
"scan": { "operatorCodeLabel": "Código do operador" },
"status": {
  "in_progress": "Sua roupa está sendo processada",
  "processed": "Sua roupa está lavada e aguardando na loja",
  "ready_for_pickup": "Sua roupa está pronta — seu entregador irá retirá-la em breve",
  "picked_up": "Sua roupa está a caminho",
  "delivered": "Sua roupa foi entregue",
  "loginCta": "Faça login para ver seu pedido"
}
```

`de`:

```json
"deliver": {
  "title": "Zustellung bestätigen",
  "codeLabel": "Liefercode oder PIN",
  "codePlaceholder": "Code eingeben",
  "geoOptIn": "Meinen Standort an diese Bestätigung anhängen",
  "rememberCode": "Code auf diesem Gerät merken",
  "confirm": "Zustellung bestätigen",
  "success": "Zustellung bestätigt — vielen Dank!",
  "badCode": "Der Code stimmt nicht. Bitte erneut versuchen.",
  "lockedOut": "Zu viele Versuche. Bitte später erneut versuchen."
},
"reintake": {
  "prompt": "Als zugestellt markieren und neuen Auftrag starten?",
  "confirm": "Ja — neuen Auftrag starten"
},
"scan": { "operatorCodeLabel": "Bediener-Code" },
"status": {
  "in_progress": "Ihre Wäsche wird bearbeitet",
  "processed": "Ihre Wäsche ist gewaschen und wartet im Geschäft",
  "ready_for_pickup": "Ihre Wäsche ist fertig — Ihr Lieferpartner holt sie bald ab",
  "picked_up": "Ihre Wäsche ist unterwegs",
  "delivered": "Ihre Wäsche wurde zugestellt",
  "loginCta": "Melden Sie sich an, um Ihre Bestellung zu sehen"
}
```

- [ ] **12.4 Panels (HTML)** — In `public/claim-embed.html`, inside the main content container (after PR 6's claim/registration section — locate with `grep -n "claim" public/claim-embed.html | head`), append. **CSP rules: no inline style/script attributes; classes only** (add the few layout classes to the page's existing external stylesheet if they don't exist):

```html
<!-- PR 9: deliver / re-intake / status branches of the overloaded bag URL -->
<section id="claim-deliver-panel" class="claim-panel" hidden>
  <h1 data-i18n="claim.deliver.title">Confirm delivery</h1>
  <label for="deliver-code" data-i18n="claim.deliver.codeLabel">Delivery code or PIN</label>
  <input id="deliver-code" type="text" autocomplete="one-time-code" autocapitalize="characters"
         maxlength="12" data-i18n-placeholder="claim.deliver.codePlaceholder">
  <label class="claim-checkbox">
    <input id="deliver-geo-optin" type="checkbox">
    <span data-i18n="claim.deliver.geoOptIn">Attach my location to this confirmation</span>
  </label>
  <label class="claim-checkbox">
    <input id="deliver-remember-code" type="checkbox">
    <span data-i18n="claim.deliver.rememberCode">Remember my code on this device</span>
  </label>
  <button id="deliver-submit" type="button" class="btn btn-primary" data-i18n="claim.deliver.confirm">Confirm delivery</button>
  <p id="deliver-error" class="claim-error" hidden></p>
  <p id="deliver-success" class="claim-success" hidden data-i18n="claim.deliver.success">Delivery confirmed — thank you!</p>
</section>

<section id="claim-reintake-panel" class="claim-panel" hidden>
  <h1 data-i18n="claim.reintake.prompt">Mark delivered &amp; start a new order?</h1>
  <label for="reintake-weight" data-i18n="operator.intake.weightLabel">Weight (lbs)</label>
  <input id="reintake-weight" type="number" min="1" step="0.1" inputmode="decimal">
  <label class="claim-checkbox"><input id="reintake-addon-detergent" type="checkbox"><span data-i18n="operator.intake.addOns.premiumDetergent">Premium detergent</span></label>
  <label class="claim-checkbox"><input id="reintake-addon-softener" type="checkbox"><span data-i18n="operator.intake.addOns.fabricSoftener">Fabric softener</span></label>
  <label class="claim-checkbox"><input id="reintake-addon-stain" type="checkbox"><span data-i18n="operator.intake.addOns.stainRemover">Stain remover</span></label>
  <label class="claim-checkbox"><input id="reintake-fresh-form" type="checkbox"><span data-i18n="operator.intake.freshFormAck">Fresh add-ons form placed in pocket</span></label>
  <button id="reintake-confirm" type="button" class="btn btn-primary" data-i18n="claim.reintake.confirm">Yes — start a new order</button>
  <p id="reintake-error" class="claim-error" hidden></p>
</section>

<section id="claim-status-panel" class="claim-panel" hidden>
  <h1 id="claim-status-heading"></h1>
  <a id="claim-status-login" href="/embed-app-v2.html?route=/customer-login" data-i18n="claim.status.loginCta">Log in to see your order</a>
</section>
```

(The `operator.intake.*` keys exist from PR 7's kiosk work — verify with `grep -n '"intake"' public/locales/en/common.json`; if PR 7 didn't add them, add `operator.intake.weightLabel`, `operator.intake.addOns.{premiumDetergent,fabricSoftener,stainRemover}`, `operator.intake.freshFormAck` to all four locale files in this same commit, English values as shown above, translations following the §10 inventory.)

- [ ] **12.5 Branch logic (JS)** — In `public/assets/js/claim.js`, PR 6 handles the resolve response (`GET /api/v1/customers/claim/:bagToken`) with a `state === 'claimed'` branch. Replace that branch's body so it dispatches on the Task 11 context, and append the following functions at module scope (reuse the file's existing `bagToken` variable and translate helper if present; otherwise these are self-contained):

```javascript
// ---- PR 9: deliver / status / re-intake branches ---------------------------

function t9(key, fallback) {
  if (window.i18n && typeof window.i18n.translate === 'function') {
    const v = window.i18n.translate(key);
    if (v && v !== key) return v;
  }
  return fallback;
}

function showPanel(id) {
  ['claim-deliver-panel', 'claim-reintake-panel', 'claim-status-panel'].forEach((p) => {
    const el = document.getElementById(p);
    if (el) el.hidden = (p !== id);
  });
}

// Call this from the resolve handler's `state === 'claimed'` branch:
function dispatchClaimedState(data) {
  if (data.order && data.order.awaitingDelivery) {
    showPanel('claim-deliver-panel');
    const remembered = localStorage.getItem('wavemax_role_code');
    if (remembered) {
      document.getElementById('deliver-code').value = remembered;
      document.getElementById('deliver-remember-code').checked = true;
    }
  } else if (data.order) {
    showStatusPanel(data.order.status);
  } else {
    showStatusPanel(null); // claimed, nothing open — status/login affordance
  }
}

function showStatusPanel(status) {
  showPanel('claim-status-panel');
  const heading = document.getElementById('claim-status-heading');
  heading.textContent = status
    ? t9(`claim.status.${status}`, status.replace(/_/g, ' '))
    : t9('claim.alreadyClaimedTitle', 'This bag is registered'); // PR 6 key
}

function getGeoOptIn() {
  return new Promise((resolve) => {
    if (!document.getElementById('deliver-geo-optin').checked) return resolve(undefined);
    if (!navigator.geolocation) return resolve(undefined);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(undefined),
      { timeout: 5000, maximumAge: 60000 }
    );
  });
}

async function submitDeliveryCode() {
  const codeInput = document.getElementById('deliver-code');
  const errorEl = document.getElementById('deliver-error');
  const successEl = document.getElementById('deliver-success');
  errorEl.hidden = true;
  const code = codeInput.value.trim();
  if (!code) return;

  const geo = await getGeoOptIn();
  const res = await fetch(`/api/v1/bags/${encodeURIComponent(bagToken)}/confirm-delivery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(geo ? { code, geo } : { code })
  });
  const data = await res.json().catch(() => ({}));

  if (res.ok) {
    if (document.getElementById('deliver-remember-code').checked) {
      localStorage.setItem('wavemax_role_code', code); // explicit opt-in (§6.6)
    } else {
      localStorage.removeItem('wavemax_role_code');
    }
    successEl.hidden = false;
    document.getElementById('deliver-submit').disabled = true;
    return;
  }
  if (res.status === 401 && data.errors && data.errors.code === 'operator_code') {
    // Operator code on a picked_up bag = back at the store -> explicit
    // confirm before closing the order (§6.6 re-intake prompt).
    window.__pendingOperatorCode = code;
    showPanel('claim-reintake-panel');
    return;
  }
  errorEl.textContent = res.status === 429
    ? t9('claim.deliver.lockedOut', 'Too many attempts. Please try again later.')
    : t9('claim.deliver.badCode', "That code didn't match. Please try again.");
  errorEl.hidden = false;
}

async function submitReintake() {
  const errorEl = document.getElementById('reintake-error');
  errorEl.hidden = true;
  const weight = parseFloat(document.getElementById('reintake-weight').value);
  if (!Number.isFinite(weight) || weight <= 0) {
    errorEl.textContent = t9('operator.intake.weightLabel', 'Weight (lbs)');
    errorEl.hidden = false;
    return;
  }
  const res = await fetch(`/api/v1/bags/${encodeURIComponent(bagToken)}/intake`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      operatorCode: window.__pendingOperatorCode,
      weight,
      addOns: {
        premiumDetergent: document.getElementById('reintake-addon-detergent').checked,
        fabricSoftener: document.getElementById('reintake-addon-softener').checked,
        stainRemover: document.getElementById('reintake-addon-stain').checked
      },
      freshAddOnsFormPlaced: document.getElementById('reintake-fresh-form').checked
    })
  });
  if (res.ok) {
    showStatusPanel('in_progress'); // new order opened
    return;
  }
  errorEl.textContent = res.status === 429
    ? t9('claim.deliver.lockedOut', 'Too many attempts. Please try again later.')
    : t9('claim.deliver.badCode', "That code didn't match. Please try again.");
  errorEl.hidden = false;
}

// Wire handlers once the panels exist (CSP: addEventListener only, no inline).
document.getElementById('deliver-submit').addEventListener('click', submitDeliveryCode);
document.getElementById('reintake-confirm').addEventListener('click', submitReintake);
```

Wire-in instruction: in the PR 6 resolve handler, where `state === 'claimed'` currently routes to login/status, call `dispatchClaimedState(data)` instead (keep the PR 6 login affordance inside `showStatusPanel`'s panel — the `claim-status-login` link). The page's H1 already varies by state per PR 6; the three new panels carry their own headings.

- [ ] **12.6 Run + manual render check** — `npm test -- tests/unit/i18nClaimDeliverKeys.test.js` → expect PASS (72 key checks). Then CSP sanity: `grep -n "style=\|onclick=\|onsubmit=" public/claim-embed.html` must return ZERO hits inside the three new panels (strict nonce CSP).
- [ ] **12.7 Commit:**

```bash
git add public/claim-embed.html public/assets/js/claim.js public/locales tests/unit/i18nClaimDeliverKeys.test.js
git commit -m "feat(claim): deliver panel + re-intake prompt + status branch on the bag URL (en/es/pt/de)"
```

---

## Task 13 — Dashboard role-code panels (affiliate code + customer PIN) + i18n

**Files:**
- Create: `tests/unit/i18nDashboardCodeKeys.test.js`
- Modify: `public/affiliate-dashboard-embed.html` + `public/assets/js/affiliate-dashboard-init.js`
- Modify: `public/customer-dashboard-embed.html` + `public/assets/js/customer-dashboard.js`
- Modify: `public/locales/{en,es,pt,de}/common.json`

- [ ] **13.1 Write the failing test** — `tests/unit/i18nDashboardCodeKeys.test.js`:

```javascript
const path = require('path');

const LANGS = ['en', 'es', 'pt', 'de'];
const KEYS = [
  'affiliateDashboard.deliveryCode.title', 'affiliateDashboard.deliveryCode.current',
  'affiliateDashboard.deliveryCode.reset', 'affiliateDashboard.deliveryCode.resetConfirm',
  'affiliateDashboard.deliveryCode.shownOnceNote', 'affiliateDashboard.deliverHelp',
  'customerDashboard.deliveryPin.title', 'customerDashboard.deliveryPin.current',
  'customerDashboard.deliveryPin.reset', 'customerDashboard.deliveryPin.shownOnceNote'
];

function dig(obj, dotted) {
  return dotted.split('.').reduce((o, k) => (o ? o[k] : undefined), obj);
}

describe('dashboard role-code i18n parity', () => {
  for (const lang of LANGS) {
    describe(lang, () => {
      const json = require(path.join(__dirname, `../../public/locales/${lang}/common.json`));
      for (const key of KEYS) {
        test(`has ${key}`, () => {
          expect(typeof dig(json, key)).toBe('string');
        });
      }
    });
  }
});
```

- [ ] **13.2 Run it** — `npm test -- tests/unit/i18nDashboardCodeKeys.test.js` → expect FAIL (keys missing).

- [ ] **13.3 Locales** — Add top-level objects (or merge into existing `affiliateDashboard`/`customerDashboard` objects — check with `grep -n '"affiliateDashboard"\|"customerDashboard"' public/locales/en/common.json`):

`en`:

```json
"affiliateDashboard": {
  "deliveryCode": {
    "title": "Delivery code",
    "current": "Your delivery code is set",
    "reset": "Reset delivery code",
    "resetConfirm": "Reset your delivery code? The old code stops working immediately.",
    "shownOnceNote": "Your new code is shown only once — store it somewhere safe:"
  },
  "deliverHelp": "To deliver or check a bag, scan the bag's QR code with your phone camera."
},
"customerDashboard": {
  "deliveryPin": {
    "title": "Delivery PIN",
    "current": "Your delivery PIN is set",
    "reset": "Reset delivery PIN",
    "shownOnceNote": "Your new PIN is shown only once. It is also included in each \"on the way\" email:"
  }
}
```

`es`: title `Código de entrega` / `PIN de entrega`; current `Tu código de entrega está configurado` / `Tu PIN de entrega está configurado`; reset `Restablecer código de entrega` / `Restablecer PIN de entrega`; resetConfirm `¿Restablecer tu código de entrega? El código anterior deja de funcionar de inmediato.`; shownOnceNote `Tu nuevo código se muestra solo una vez — guárdalo en un lugar seguro:` / `Tu nuevo PIN se muestra solo una vez. También se incluye en cada correo "en camino":`; deliverHelp `Para entregar o consultar una bolsa, escanea el código QR de la bolsa con la cámara de tu teléfono.`

`pt`: `Código de entrega` / `PIN de entrega`; `Seu código de entrega está configurado` / `Seu PIN de entrega está configurado`; `Redefinir código de entrega` / `Redefinir PIN de entrega`; `Redefinir seu código de entrega? O código antigo para de funcionar imediatamente.`; `Seu novo código é exibido apenas uma vez — guarde-o em local seguro:` / `Seu novo PIN é exibido apenas uma vez. Ele também é incluído em cada e-mail "a caminho":`; `Para entregar ou verificar uma bolsa, escaneie o código QR da bolsa com a câmera do seu celular.`

`de`: `Liefercode` / `Liefer-PIN`; `Ihr Liefercode ist eingerichtet` / `Ihre Liefer-PIN ist eingerichtet`; `Liefercode zurücksetzen` / `Liefer-PIN zurücksetzen`; `Liefercode zurücksetzen? Der alte Code funktioniert sofort nicht mehr.`; `Ihr neuer Code wird nur einmal angezeigt — bewahren Sie ihn sicher auf:` / `Ihre neue PIN wird nur einmal angezeigt. Sie ist außerdem in jeder "unterwegs"-E-Mail enthalten:`; `Um eine Tasche zuzustellen oder zu prüfen, scannen Sie den QR-Code der Tasche mit Ihrer Handykamera.`

- [ ] **13.4 Affiliate dashboard** — In `public/affiliate-dashboard-embed.html`, locate the settings/profile section (`grep -n "settings\|Settings" public/affiliate-dashboard-embed.html | head`) and append the card inside it:

```html
<!-- PR 9: vendor delivery code -->
<div class="dashboard-card" id="delivery-code-card">
  <h3 data-i18n="affiliateDashboard.deliveryCode.title">Delivery code</h3>
  <p id="delivery-code-status" data-i18n="affiliateDashboard.deliveryCode.current">Your delivery code is set</p>
  <p data-i18n="affiliateDashboard.deliverHelp">To deliver or check a bag, scan the bag's QR code with your phone camera.</p>
  <button id="delivery-code-reset-btn" type="button" class="btn btn-secondary" data-i18n="affiliateDashboard.deliveryCode.reset">Reset delivery code</button>
  <p id="delivery-code-result" hidden></p>
</div>
```

In `public/assets/js/affiliate-dashboard-init.js`, append (the file already has the authenticated-fetch + CSRF helper used by its other mutations and a translate helper `t` — locate with `grep -n "csrf\|function t(" public/assets/js/affiliate-dashboard-init.js | head` and reuse them; the snippet shows the shape with `authenticatedFetch` standing in for that helper):

```javascript
// ---- PR 9: vendor delivery code card ---------------------------------------
async function initDeliveryCodeCard(affiliateId) {
  const btn = document.getElementById('delivery-code-reset-btn');
  if (!btn) return;

  const status = await authenticatedFetch(`/api/v1/affiliates/${affiliateId}/delivery-code`);
  if (status.ok) {
    const data = await status.json();
    if (!data.deliveryCodeSet) {
      document.getElementById('delivery-code-status').textContent = '';
    }
  }

  btn.addEventListener('click', async () => {
    if (!window.confirm(t('affiliateDashboard.deliveryCode.resetConfirm'))) return;
    const res = await authenticatedFetch(`/api/v1/affiliates/${affiliateId}/delivery-code/reset`, {
      method: 'POST', body: JSON.stringify({})
    });
    if (res.ok) {
      const data = await res.json();
      const out = document.getElementById('delivery-code-result');
      out.textContent = `${t('affiliateDashboard.deliveryCode.shownOnceNote')} ${data.deliveryCode}`;
      out.hidden = false;
    }
  });
}
```

and call `initDeliveryCodeCard(affiliateId)` from the dashboard's init sequence (where the other cards initialize — `grep -n "init" public/assets/js/affiliate-dashboard-init.js | head`).

- [ ] **13.5 Customer dashboard** — Same pattern: in `public/customer-dashboard-embed.html` add inside the profile/settings section:

```html
<!-- PR 9: delivery PIN -->
<div class="dashboard-card" id="delivery-pin-card">
  <h3 data-i18n="customerDashboard.deliveryPin.title">Delivery PIN</h3>
  <p id="delivery-pin-status" data-i18n="customerDashboard.deliveryPin.current">Your delivery PIN is set</p>
  <button id="delivery-pin-reset-btn" type="button" class="btn btn-secondary" data-i18n="customerDashboard.deliveryPin.reset">Reset delivery PIN</button>
  <p id="delivery-pin-result" hidden></p>
</div>
```

and in `public/assets/js/customer-dashboard.js` append + wire into its init (reuse its fetch/CSRF/translate helpers):

```javascript
// ---- PR 9: delivery PIN card -----------------------------------------------
async function initDeliveryPinCard(customerId) {
  const btn = document.getElementById('delivery-pin-reset-btn');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    const res = await authenticatedFetch(`/api/v1/customers/${customerId}/delivery-pin/reset`, {
      method: 'POST', body: JSON.stringify({})
    });
    if (res.ok) {
      const data = await res.json();
      const out = document.getElementById('delivery-pin-result');
      out.textContent = `${t('customerDashboard.deliveryPin.shownOnceNote')} ${data.deliveryPin}`;
      out.hidden = false;
    }
  });
}
```

- [ ] **13.6 Run + CSP check** — `npm test -- tests/unit/i18nDashboardCodeKeys.test.js` → expect PASS (40 checks). `grep -n "onclick=\|style=" public/affiliate-dashboard-embed.html public/customer-dashboard-embed.html` → no new hits from the added cards.
- [ ] **13.7 Commit:**

```bash
git add public/affiliate-dashboard-embed.html public/assets/js/affiliate-dashboard-init.js public/customer-dashboard-embed.html public/assets/js/customer-dashboard.js public/locales tests/unit/i18nDashboardCodeKeys.test.js
git commit -m "feat(dashboards): delivery-code and delivery-PIN cards with reset (shown once) + 4-language copy"
```

---

## Verification

- [ ] **Full suite, clean exit:** `npm test` — green, no `--forceExit`, no open-handle warnings. Then `npm test -- tests/integration/operatorScanOut.test.js tests/integration/kioskAdvance.test.js tests/integration/bagActionOperatorCode.test.js tests/integration/confirmDelivery.test.js tests/integration/adminManualConfirm.test.js tests/integration/reintake.test.js tests/integration/bagResolveContext.test.js` one more time in isolation.
- [ ] **No cycles:** `npx madge --circular server/` → zero cycles (watch the `orderAdvanceService` ↔ `affiliateDeliveryService` import of `OPEN_STATUSES` — it is one-directional by design).
- [ ] **Lint:** `npx eslint server/ --quiet` → no `console.*` in server code, no unused requires left from the Task 7 deletions.
- [ ] **Dangling references:** `grep -rn "completePickup\|markOrderReady\|confirmPickup\|resetOperatorPin\|reset-pin" server/ public/ tests/` → zero hits (except this plan file / docs).
- [ ] **Raw-secret hygiene:** `grep -rn "bagToken" server/ | grep -i "logger\|logAuditEvent" | grep -v "bagTokenDigest\|bagId"` → no raw token reaches a log or audit call.
- [ ] **Manual smoke (dev server, `npm run dev` or `node server.js` with a local Mongo):**
  1. Admin: create an operator → note the one-time `scanCode`. Mint + issue a bag (PR 6 admin flow), claim it as a customer (note: PIN provisioned silently).
  2. `POST /api/v1/bags/<token>/intake` with `{operatorCode, weight: 15, addOns: {}, freshAddOnsFormPlaced: true}` → 201; payment-request email logged (console transport).
  3. `POST /api/v1/bags/<token>/advance` (operator code) → `processed`, `heldAtStore: true` while unpaid. Manually verify payment (admin `verify-payment`, PR 8) → order becomes `ready_for_pickup`.
  4. `POST /api/v1/bags/<token>/advance` again → `picked_up`; console shows the on-the-way email with a 6-char PIN.
  5. Open `/embed-app-v2.html?route=/claim&bag=<token>` → deliver panel; enter the PIN → delivered; affiliate commission email logged; re-scan → status panel "delivered".
  6. Re-intake: with a new intake on the same bag while a fresh order is `picked_up`, enter the operator code on the claim page → confirm prompt → new order created, prior auto-delivered.
- [ ] **PR description:**

```text
PR 9 — advance/scan-out + role codes + delivery + re-intake on the bag URL

Implements spec §6.6 + §4.5/4.6/4.8 + §12-PR9 of the invite/bag/workflow redesign:

- Three role codes: customer delivery PIN (PBKDF2, provisioned at claim, rotated +
  emailed at scan-out), affiliate delivery code (PBKDF2, provisioned at invited
  registration), operator scan code (HMAC, unique-indexed, provisioned at operator
  creation; admin scan-code/reset replaces reset-pin). Status + reset endpoints with
  RBAC, CSRF, sensitive-op rate limits, and audit events.
- server/modules/orders/orderAdvanceService.js — state-driven scan engine:
  in_progress→processed (ready gate), ready_for_pickup→picked_up (PIN rotation +
  "on the way" email, no commission). Kiosk POST /api/v1/operators/advance replaces
  scanProcessed/completePickup; markOrderReady/confirmPickup deleted.
- Public bag-URL endpoints POST /api/v1/bags/:bagToken/{intake,advance,confirm-delivery}
  — operator-code resolved via scanCodeHmac; per-bag/IP failed-attempt lockout backed
  by the shared Mongo rate-limit store; CSRF-exempt (code-gated), tight limiter.
- affiliateDeliveryService.confirmDelivery — verifies the code against the order's OWN
  customer/affiliate (constant-time, both always run, no oracle); operator codes get a
  distinct 401 driving the page's re-intake prompt; delivered + proofOfDelivery
  {method, confirmedByRole/ById, optional geo [lng,lat]}; commission realized at
  delivered ONLY; delivered + commission emails best-effort.
- Re-intake: operator code on a picked_up bag auto-delivers the prior order
  (method 'reintake', commission exactly once, ORDER_REINTAKE audit) and opens a new one.
- Admin delivered override stamps proofOfDelivery {method:'manual_confirm',
  confirmedByRole:'admin'} on the status PUT (spec §6.6 edge case).
- Claim resolver now returns { status, awaitingDelivery, nextAction } (PII-free),
  reaching parity with PR 7's bags resolver via the shared openOrderContext helper;
  claim page gains deliver / re-intake / status branches; dashboards gain code cards.
- i18n: all new client copy in en/es/pt/de; new on-the-way email template (4 langs);
  PR 7's delivered dispatcher extended in place (affiliateName) — no duplicate export.

Tests: 9 new test files covering scan-out, kiosk advance, code lockouts, no-oracle 401s,
double-confirm/no-double-commission, re-intake idempotency, resolve context, i18n parity.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```
