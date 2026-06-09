# PR 6 — Bag Model, Mint/Issue/Labels, Customer Claim Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce the durable `Bag` entity (mint → issue → active lifecycle, HMAC tokenHash lookups), admin mint/issue/label endpoints, and the QR-driven customer claim flow that replaces affiliate-referral customer registration.

**Architecture:** New domain module `server/modules/bags/` (model + service + label renderer + controller) mounted at `/api/v1/bags`; a thin `bagClaimService` adapts bag resolution for the customer-claim path; `customerRegistrationService.registerCustomer` is reworked to derive the affiliate from the bag (save-customer-then-claim with a compensating delete on race loss). The frontend ships a new `/claim` page (state-machine skeleton: resolving | claimable | claimed | invalid) registered in the embed-app router.

**Tech Stack:** Node/Express, Mongoose, `qrcode` (already in package.json `^1.5.4`), Jest + Supertest + MongoMemoryServer, vanilla JS frontend under strict nonce CSP.

**Assumed starting state (PRs 1–5 merged):**
- **PR 1:** V1 Paygistix deleted (no `paymentRoutes` mount in `server.js`).
- **PR 2:** scheduling / Pickup Now / BetaRequest / `?affid` plumbing / `paymentConfirmed` rate-limit bypass removed; Customer V1 fields (`registrationVersion`, `bagCredit`, `bagCreditApplied`, `initialBagsRequested`, `numberOfBags`) removed. Some code quoted below from current `main` may already be partially gone — every Modify step says what to do if the quoted block is absent.
- **PR 3:** `SystemConfig.initializeDefaults()` seeds `bag_mint_max_batch` (200), `bag_token_bytes` (16), `bag_label_columns` (3), `bag_label_qr_size_px` (300). All reads below use `SystemConfig.getValue(key, default)` with the same defaults, so they work even if a key is missing.
- **PR 4:** `Order.status` enum is `['in_progress','processed','ready_for_pickup','picked_up','delivered','cancelled']`; `server/modules/orders/orderStateMachine.js` exists. **`Order` does NOT yet have `bagId`/`bagToken` fields** — those land in PR 7. Therefore in this PR, any "claimed bag → order context" response field is designed in shape but populated as `null`.
- **PR 5:** `server/modules/onboarding/` exists (`AffiliateInvite`, `inviteService`); admin affiliate management uses the **`manage_affiliates`** permission key (NOT `affiliates.manage`).
- Verified current-repo facts this plan relies on: `qrcode@^1.5.4` installed; `encryptionUtil.generateToken(length)` returns hex of `length` bytes (`server/utils/encryption.js:139-141`); CSRF helper is `tests/helpers/csrfHelper.js` exporting `getCsrfToken(app, agent)`; admin default permissions include `manage_affiliates` (`server/models/Administrator.js:129`); `checkAdminPermission` is in `server/middleware/rbac.js:150`; jest config has `resetMocks: true` (set mock implementations in `beforeEach`); `tests/setup.js` sets `ENCRYPTION_KEY` and `BASE_URL=https://wavemax.promo` and runs `SystemConfig.initializeDefaults()`.

**Contract handed to later PRs (do not change):**
- PR 7 consumes `bagService.linkToOrderAtIntake({ token, operatorId })` → `{ bag, customerId, affiliateId }`, throws `BagError('bag_not_active', 409)`. **PR 7's open-order check must treat `status: { $nin: ['delivered','cancelled'] }` as "open"** — a cancelled order does not block re-intake. The bag itself stays `active` on cancel (it is claimed regardless); nothing in `cancelOrder` touches Bag.
- PR 7/9 populate the `order` portion of the resolve/claim responses: `order: { status, awaitingDelivery, nextAction }`. This PR returns `order: null` in that slot.

---

## Task 1 — `Bag` model + audit event constants

**Files:**
- Create: `server/modules/bags/Bag.js`
- Modify: `server/utils/auditLogger.js` (add `BAG_MINTED`, `BAG_ISSUED`, `BAG_CLAIMED` to `AuditEvents`)
- Create: `tests/unit/models/Bag.test.js`

### Steps

- [ ] **Write the failing test** — create `tests/unit/models/Bag.test.js`:

```javascript
// Bag model — durable bag entity (spec §4.1)
const crypto = require('crypto');
const Bag = require('../../../server/modules/bags/Bag');

describe('Bag model', () => {
  beforeEach(async () => {
    await Bag.deleteMany({});
  });

  function bagDoc(overrides = {}) {
    const token = crypto.randomBytes(16).toString('hex');
    return {
      token,
      tokenHash: Bag.hashToken(token),
      affiliateId: 'AFF-test-affiliate',
      ...overrides
    };
  }

  it('generates a BAG- prefixed bagId and sane defaults', async () => {
    const bag = await Bag.create(bagDoc());
    expect(bag.bagId).toMatch(/^BAG-[0-9a-f-]{36}$/);
    expect(bag.status).toBe('minted');
    expect(bag.customerId).toBeNull();
    expect(bag.orderCount).toBe(0);
    expect(bag.mintedAt).toBeInstanceOf(Date);
  });

  it('hashToken is a deterministic HMAC-SHA256 keyed by ENCRYPTION_KEY', () => {
    const raw = 'a'.repeat(32);
    const expected = crypto
      .createHmac('sha256', Buffer.from(process.env.ENCRYPTION_KEY, 'hex'))
      .update(raw)
      .digest('hex');
    expect(Bag.hashToken(raw)).toBe(expected);
    expect(Bag.hashToken(raw)).toBe(Bag.hashToken(raw));
    expect(Bag.hashToken(raw)).not.toBe(raw);
    expect(Bag.hashToken(raw)).toHaveLength(64);
  });

  it('enforces tokenHash uniqueness (E11000)', async () => {
    await Bag.init(); // ensure unique index is built before asserting
    const doc = bagDoc();
    await Bag.create(doc);
    await expect(
      Bag.create({ ...doc, token: doc.token }) // same tokenHash
    ).rejects.toMatchObject({ code: 11000 });
  });

  it('rejects an unknown status', async () => {
    const bag = new Bag(bagDoc({ status: 'weird' }));
    await expect(bag.validate()).rejects.toThrow(/weird/);
  });

  describe('claim static', () => {
    it('does NOT claim a minted bag (issued-only)', async () => {
      const doc = bagDoc();
      await Bag.create(doc); // status: minted
      const result = await Bag.claim(doc.token, 'CUST-1');
      expect(result).toBeNull();
    });

    it('claims an issued bag: issued -> active, links customer, stamps claimedAt', async () => {
      const doc = bagDoc({ status: 'issued' });
      await Bag.create(doc);
      const claimed = await Bag.claim(doc.token, 'CUST-1');
      expect(claimed).not.toBeNull();
      expect(claimed.status).toBe('active');
      expect(claimed.customerId).toBe('CUST-1');
      expect(claimed.claimedAt).toBeInstanceOf(Date);
    });

    it('a second claim loses (returns null)', async () => {
      const doc = bagDoc({ status: 'issued' });
      await Bag.create(doc);
      await Bag.claim(doc.token, 'CUST-1');
      const second = await Bag.claim(doc.token, 'CUST-2');
      expect(second).toBeNull();
    });

    it('concurrent claims: exactly one winner', async () => {
      const doc = bagDoc({ status: 'issued' });
      await Bag.create(doc);
      const [a, b] = await Promise.all([
        Bag.claim(doc.token, 'CUST-A'),
        Bag.claim(doc.token, 'CUST-B')
      ]);
      const winners = [a, b].filter(Boolean);
      expect(winners).toHaveLength(1);
      const fresh = await Bag.findOne({ tokenHash: Bag.hashToken(doc.token) });
      expect(['CUST-A', 'CUST-B']).toContain(fresh.customerId);
    });
  });
});
```

- [ ] Run it — expect failure for the right reason (module does not exist):

```bash
npm test -- tests/unit/models/Bag.test.js
# EXPECTED: "Cannot find module '../../../server/modules/bags/Bag'"
```

- [ ] **Implement** — create `server/modules/bags/Bag.js` (spec §4.1 verbatim, with the settled `tokenHash` unique index):

```javascript
// Durable Bag — spec §4.1.
//
// The QR encodes an opaque random token (no PII, no sequential ids). The
// canonical lookup + uniqueness key is tokenHash = HMAC-SHA256(token) keyed
// by ENCRYPTION_KEY; the raw token is stored ONLY to regenerate label QR
// images and is never a query key (at-rest hardening, spec §13 #1).
//
// The durable Bag never changes status during the order lifecycle: once
// 'active' it stays 'active' across every order forever. The Order tracks
// the wash; the Bag persists.

const crypto = require('crypto');
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const bagSchema = new mongoose.Schema({
  bagId: { type: String, default: () => 'BAG-' + uuidv4(), unique: true, index: true }, // internal stable id (== Order.bagId)
  token: { type: String, required: true },                                  // raw opaque QR payload — label regen only, NOT a query key
  tokenHash: { type: String, required: true, unique: true, index: true },   // HMAC-SHA256(token) — canonical lookup + uniqueness key
  affiliateId: { type: String, required: true, ref: 'Affiliate', index: true }, // set at mint
  customerId: { type: String, default: null, ref: 'Customer', index: true },    // null until claimed
  status: { type: String, enum: ['minted', 'issued', 'active', 'retired'], default: 'minted', index: true },
  // Issuance / batch metadata
  batchId: { type: String, index: true },           // groups one mint run -> one label sheet
  mintedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Administrator' },
  mintedAt: { type: Date, default: Date.now },
  issuedAt: Date,                                    // status -> issued
  claimedAt: Date,                                   // status -> active
  // FUTURE hooks — schema present, no logic built this phase:
  retiredAt: Date,
  retiredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Administrator' },
  retiredReason: String,
  reassignmentHistory: [{
    fromCustomerId: String, toCustomerId: String, at: Date,
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'Administrator' }, reason: String
  }],
  // Lifetime counters (analytics; not load-bearing)
  orderCount: { type: Number, default: 0 },          // incremented at each store intake
  lastIntakeAt: Date
}, { timestamps: true });

bagSchema.index({ affiliateId: 1, status: 1 });      // admin issue, affiliate inventory
bagSchema.index({ customerId: 1, status: 1 });       // "find this customer's active bag(s)"

bagSchema.statics.hashToken = (raw) =>
  crypto.createHmac('sha256', Buffer.from(process.env.ENCRYPTION_KEY, 'hex')).update(raw).digest('hex');

// Atomic, lost-update-safe claim. Queries by tokenHash (the canonical key).
// Claimable ONLY from 'issued' (issuing is the admin act that authorizes
// claiming) — consistent with resolveByToken/resolveClaimToken (minted ->
// 'invalid'). Returns the updated doc, or null if it lost the race or the
// bag is not yet issued.
bagSchema.statics.claim = function (token, customerId) {
  return this.findOneAndUpdate(
    { tokenHash: this.hashToken(token), status: 'issued', customerId: null },
    { $set: { customerId, status: 'active', claimedAt: new Date() } },
    { new: true }
  );
};

module.exports = mongoose.model('Bag', bagSchema);
```

- [ ] Run again — expect pass:

```bash
npm test -- tests/unit/models/Bag.test.js
# EXPECTED: all 8 tests pass
```

- [ ] **Add the audit constants.** In `server/utils/auditLogger.js`, the `AuditEvents` object currently ends its order section like this (lines ~72-76):

```javascript
  // Order events
  ORDER_CREATED: 'ORDER_CREATED',
  ORDER_CANCELLED: 'ORDER_CANCELLED',
  ORDER_STATUS_CHANGED: 'ORDER_STATUS_CHANGED',
```

Insert a bag section immediately after the order events block:

```javascript
  // Bag lifecycle events (durable bags — spec §9)
  BAG_MINTED: 'BAG_MINTED',
  BAG_ISSUED: 'BAG_ISSUED',
  BAG_CLAIMED: 'BAG_CLAIMED',
```

- [ ] Run the existing audit logger tests to confirm nothing broke:

```bash
npm test -- tests/unit/auditLogger.test.js
# EXPECTED: pass (if the file doesn't exist, run: npm test -- tests/unit/models/Bag.test.js again — green)
```

- [ ] **Commit:**

```bash
git add server/modules/bags/Bag.js server/utils/auditLogger.js tests/unit/models/Bag.test.js
git commit -m "feat(bags): add durable Bag model with HMAC tokenHash lookup and issued-only claim static"
```

---

## Task 2 — `bagService.mintBatch` / `issueBatch`

**Files:**
- Create: `server/modules/bags/bagService.js`
- Create: `tests/unit/bags/bagService.test.js`

### Steps

- [ ] **Write the failing test** — create `tests/unit/bags/bagService.test.js`:

```javascript
// bagService — mint/issue (spec §6.1)
jest.mock('../../../server/utils/auditLogger', () => {
  const actual = jest.requireActual('../../../server/utils/auditLogger');
  return { ...actual, logAuditEvent: jest.fn() };
});

const crypto = require('crypto');
const Bag = require('../../../server/modules/bags/Bag');
const Affiliate = require('../../../server/models/Affiliate');
const encryptionUtil = require('../../../server/utils/encryption');
const { logAuditEvent, AuditEvents } = require('../../../server/utils/auditLogger');
const bagService = require('../../../server/modules/bags/bagService');
const { hashPassword } = require('../../../server/utils/encryption');

async function createAffiliate(suffix = '1') {
  const { salt, hash } = hashPassword('TestAffiliatePass123!');
  // Extra fields are harmless if a prior PR already removed them from the
  // schema (mongoose strict mode strips unknown paths silently).
  const affiliate = new Affiliate({
    firstName: 'Test', lastName: 'Affiliate',
    email: `bagsvc-aff-${suffix}@example.com`,
    username: `bagsvcaff${suffix}`,
    passwordHash: hash, passwordSalt: salt,
    phone: '+15125550100', address: '123 Test St', city: 'Austin',
    state: 'TX', zipCode: '78701', businessName: `Bag Service Co ${suffix}`,
    serviceArea: 'Downtown', serviceLatitude: 30.2672, serviceLongitude: -97.7431,
    serviceRadius: 10, minimumDeliveryFee: 25, perBagDeliveryFee: 5,
    paymentMethod: 'check'
  });
  await affiliate.save();
  return affiliate;
}

describe('bagService mint/issue', () => {
  let affiliate;

  beforeEach(async () => {
    await Bag.deleteMany({});
    await Affiliate.deleteMany({});
    affiliate = await createAffiliate();
  });

  describe('mintBatch', () => {
    it('mints N minted bags under one BATCH- id with 32-hex tokens', async () => {
      const { batchId, bags } = await bagService.mintBatch({
        affiliateId: affiliate.affiliateId, quantity: 5, adminId: affiliate._id
      });
      expect(batchId).toMatch(/^BATCH-[0-9a-f-]{36}$/);
      expect(bags).toHaveLength(5);
      for (const bag of bags) {
        expect(bag.status).toBe('minted');
        expect(bag.affiliateId).toBe(affiliate.affiliateId);
        expect(bag.batchId).toBe(batchId);
        expect(bag.token).toMatch(/^[0-9a-f]{32}$/);
        expect(bag.tokenHash).toBe(Bag.hashToken(bag.token));
      }
      const distinctHashes = new Set(bags.map((b) => b.tokenHash));
      expect(distinctHashes.size).toBe(5);
      expect(logAuditEvent).toHaveBeenCalledWith(
        AuditEvents.BAG_MINTED,
        expect.objectContaining({ batchId, count: 5, affiliateId: affiliate.affiliateId }),
        null
      );
    });

    it('rejects quantity below 1 and above bag_mint_max_batch', async () => {
      await expect(bagService.mintBatch({
        affiliateId: affiliate.affiliateId, quantity: 0, adminId: affiliate._id
      })).rejects.toMatchObject({ isBagError: true, code: 'invalid_quantity', status: 400 });
      await expect(bagService.mintBatch({
        affiliateId: affiliate.affiliateId, quantity: 201, adminId: affiliate._id
      })).rejects.toMatchObject({ isBagError: true, code: 'invalid_quantity', status: 400 });
    });

    it('rejects an unknown affiliate', async () => {
      await expect(bagService.mintBatch({
        affiliateId: 'AFF-does-not-exist', quantity: 1, adminId: affiliate._id
      })).rejects.toMatchObject({ isBagError: true, code: 'invalid_affiliate', status: 404 });
    });

    it('retries token collisions (E11000) and still mints the full batch', async () => {
      await Bag.init();
      const real = encryptionUtil.generateToken;
      const dup = 'a'.repeat(32);
      jest.spyOn(encryptionUtil, 'generateToken')
        .mockImplementation((n) => real(n))
        .mockReturnValueOnce(dup)
        .mockReturnValueOnce(dup); // two bags in the same batch collide
      const { batchId, bags } = await bagService.mintBatch({
        affiliateId: affiliate.affiliateId, quantity: 2, adminId: affiliate._id
      });
      expect(bags).toHaveLength(2);
      const hashes = new Set(bags.map((b) => b.tokenHash));
      expect(hashes.size).toBe(2);
      const stored = await Bag.find({ batchId });
      expect(stored).toHaveLength(2);
    });
  });

  describe('issueBatch', () => {
    it('flips minted -> issued for exactly that batch', async () => {
      const a = await bagService.mintBatch({ affiliateId: affiliate.affiliateId, quantity: 3, adminId: affiliate._id });
      const b = await bagService.mintBatch({ affiliateId: affiliate.affiliateId, quantity: 2, adminId: affiliate._id });

      const result = await bagService.issueBatch({ batchId: a.batchId, adminId: affiliate._id });
      expect(result).toMatchObject({ batchId: a.batchId, issued: 3 });

      const issued = await Bag.find({ batchId: a.batchId });
      expect(issued.every((bag) => bag.status === 'issued' && bag.issuedAt instanceof Date)).toBe(true);
      const untouched = await Bag.find({ batchId: b.batchId });
      expect(untouched.every((bag) => bag.status === 'minted')).toBe(true);

      expect(logAuditEvent).toHaveBeenCalledWith(
        AuditEvents.BAG_ISSUED,
        expect.objectContaining({ batchId: a.batchId, issued: 3 }),
        null
      );
    });

    it('404s an unknown batch', async () => {
      await expect(bagService.issueBatch({ batchId: 'BATCH-nope', adminId: affiliate._id }))
        .rejects.toMatchObject({ isBagError: true, code: 'batch_not_found', status: 404 });
    });
  });
});
```

- [ ] Run it — expect failure for the right reason:

```bash
npm test -- tests/unit/bags/bagService.test.js
# EXPECTED: "Cannot find module '../../../server/modules/bags/bagService'"
```

- [ ] **Implement** — create `server/modules/bags/bagService.js`:

```javascript
// Bag service — mint, issue, resolve, claim, intake-link, inventory (spec §6.1).
//
// Typed error mirrors the InviteError / ClaimError pattern: callers branch on
// `code`, controllers map `status` to HTTP.

const { v4: uuidv4 } = require('uuid');
const Bag = require('./Bag');
const Affiliate = require('../../models/Affiliate');
const SystemConfig = require('../../models/SystemConfig');
const encryptionUtil = require('../../utils/encryption');
const { logAuditEvent, AuditEvents } = require('../../utils/auditLogger');
const logger = require('../../utils/logger');

class BagError extends Error {
  constructor(code, status, message) {
    super(message || code);
    this.code = code;
    this.status = status;
    this.isBagError = true;
  }
}

function buildBagDoc({ affiliateId, batchId, adminId, tokenBytes }) {
  const token = encryptionUtil.generateToken(tokenBytes);
  return {
    token,
    tokenHash: Bag.hashToken(token),
    affiliateId,
    batchId,
    mintedBy: adminId,
    status: 'minted'
  };
}

/**
 * Mint a per-affiliate batch of durable bags.
 * Bounded by SystemConfig bag_mint_max_batch. insertMany { ordered:false }
 * with a single regenerate-and-retry pass on the (rare) E11000 token
 * collision. Returns { batchId, bags } — the ONLY place raw tokens leave the
 * service (the mint response feeds the label-print pipeline).
 */
async function mintBatch({ affiliateId, quantity, adminId, req = null }) {
  const maxBatch = await SystemConfig.getValue('bag_mint_max_batch', 200);
  const qty = parseInt(quantity, 10);
  if (!Number.isInteger(qty) || qty < 1 || qty > maxBatch) {
    throw new BagError('invalid_quantity', 400, `Quantity must be between 1 and ${maxBatch}`);
  }

  const affiliate = await Affiliate.findOne({ affiliateId });
  if (!affiliate) {
    throw new BagError('invalid_affiliate', 404, 'Affiliate not found');
  }

  const tokenBytes = await SystemConfig.getValue('bag_token_bytes', 16);
  const batchId = 'BATCH-' + uuidv4();
  const docs = Array.from({ length: qty }, () =>
    buildBagDoc({ affiliateId, batchId, adminId, tokenBytes }));

  try {
    await Bag.insertMany(docs, { ordered: false });
  } catch (err) {
    const writeErrors = err.writeErrors || [];
    const isDup = err.code === 11000 || writeErrors.some((e) => e.code === 11000);
    if (!isDup) throw err;
    // Regenerate the collided docs once and retry; non-colliding docs were
    // already inserted because { ordered: false }.
    const failedIdx = writeErrors.length > 0
      ? writeErrors.map((e) => e.index)
      : [...docs.keys()];
    const alreadyInserted = await Bag.countDocuments({ batchId });
    const retryDocs = failedIdx
      .slice(0, qty - alreadyInserted)
      .map(() => buildBagDoc({ affiliateId, batchId, adminId, tokenBytes }));
    if (retryDocs.length > 0) {
      await Bag.insertMany(retryDocs, { ordered: false });
    }
    logger.warn('Bag mint hit token collision; regenerated', { batchId, retried: retryDocs.length });
  }

  const bags = await Bag.find({ batchId }).sort({ bagId: 1 });
  logAuditEvent(AuditEvents.BAG_MINTED, {
    batchId, count: bags.length, affiliateId, adminId: String(adminId)
  }, req);
  return { batchId, bags };
}

/** Mark a whole minted batch as issued (handed to the affiliate). */
async function issueBatch({ batchId, adminId, req = null }) {
  const result = await Bag.updateMany(
    { batchId, status: 'minted' },
    { $set: { status: 'issued', issuedAt: new Date() } }
  );
  if (result.modifiedCount === 0) {
    throw new BagError('batch_not_found', 404, 'No mintable bags found for that batch');
  }
  logAuditEvent(AuditEvents.BAG_ISSUED, {
    batchId, issued: result.modifiedCount, adminId: String(adminId)
  }, req);
  return { batchId, issued: result.modifiedCount };
}

module.exports = {
  BagError,
  mintBatch,
  issueBatch
};
```

- [ ] Run again — expect pass:

```bash
npm test -- tests/unit/bags/bagService.test.js
# EXPECTED: all 6 tests pass
```

- [ ] **Commit:**

```bash
git add server/modules/bags/bagService.js tests/unit/bags/bagService.test.js
git commit -m "feat(bags): bagService.mintBatch with batch bound + E11000 retry, issueBatch with audit"
```

---

## Task 3 — `bagService.resolveByToken` / `claim` / `linkToOrderAtIntake` / `getInventory`

**Files:**
- Modify: `server/modules/bags/bagService.js`
- Modify: `tests/unit/bags/bagService.test.js`

### Steps

- [ ] **Write the failing tests** — append this describe block to `tests/unit/bags/bagService.test.js` (inside the top-level `describe('bagService mint/issue', ...)` is fine, or as a sibling — make it a sibling, reusing the `createAffiliate` helper and a fresh `beforeEach`):

```javascript
describe('bagService resolve/claim/link/inventory', () => {
  let affiliate;
  let token;
  let batchId;

  beforeEach(async () => {
    await Bag.deleteMany({});
    await Affiliate.deleteMany({});
    affiliate = await createAffiliate('2');
    const minted = await bagService.mintBatch({
      affiliateId: affiliate.affiliateId, quantity: 2, adminId: affiliate._id
    });
    batchId = minted.batchId;
    token = minted.bags[0].token;
  });

  describe('resolveByToken', () => {
    it('returns null for an unknown token (anti-enumeration)', async () => {
      expect(await bagService.resolveByToken('f'.repeat(32))).toBeNull();
      expect(await bagService.resolveByToken('')).toBeNull();
      expect(await bagService.resolveByToken(null)).toBeNull();
    });

    it('returns null for a minted (not yet issued) bag', async () => {
      expect(await bagService.resolveByToken(token)).toBeNull();
    });

    it('returns outcome unclaimed for an issued bag', async () => {
      await bagService.issueBatch({ batchId, adminId: affiliate._id });
      const result = await bagService.resolveByToken(token);
      expect(result.outcome).toBe('unclaimed');
      expect(result.bag.affiliateId).toBe(affiliate.affiliateId);
    });

    it('returns outcome claimed for an active bag', async () => {
      await bagService.issueBatch({ batchId, adminId: affiliate._id });
      await bagService.claim({ token, customerId: 'CUST-1' });
      const result = await bagService.resolveByToken(token);
      expect(result.outcome).toBe('claimed');
      expect(result.bag.customerId).toBe('CUST-1');
    });
  });

  describe('claim', () => {
    it('claims an issued bag and audits BAG_CLAIMED', async () => {
      await bagService.issueBatch({ batchId, adminId: affiliate._id });
      const claimed = await bagService.claim({ token, customerId: 'CUST-1' });
      expect(claimed.status).toBe('active');
      expect(logAuditEvent).toHaveBeenCalledWith(
        AuditEvents.BAG_CLAIMED,
        expect.objectContaining({ bagId: claimed.bagId, customerId: 'CUST-1' }),
        null
      );
    });

    it('returns null on race loss / non-issued bag (no audit)', async () => {
      expect(await bagService.claim({ token, customerId: 'CUST-1' })).toBeNull(); // still minted
    });
  });

  describe('linkToOrderAtIntake', () => {
    it('resolves an active bag, returns ids, increments counters', async () => {
      await bagService.issueBatch({ batchId, adminId: affiliate._id });
      await bagService.claim({ token, customerId: 'CUST-1' });
      const result = await bagService.linkToOrderAtIntake({ token, operatorId: 'op-1' });
      expect(result.customerId).toBe('CUST-1');
      expect(result.affiliateId).toBe(affiliate.affiliateId);
      expect(result.bag.orderCount).toBe(1);
      expect(result.bag.lastIntakeAt).toBeInstanceOf(Date);
      const again = await bagService.linkToOrderAtIntake({ token, operatorId: 'op-1' });
      expect(again.bag.orderCount).toBe(2);
    });

    it('throws bag_not_active 409 for issued (unclaimed) and unknown bags', async () => {
      await bagService.issueBatch({ batchId, adminId: affiliate._id });
      await expect(bagService.linkToOrderAtIntake({ token, operatorId: 'op-1' }))
        .rejects.toMatchObject({ isBagError: true, code: 'bag_not_active', status: 409 });
      await expect(bagService.linkToOrderAtIntake({ token: 'f'.repeat(32), operatorId: 'op-1' }))
        .rejects.toMatchObject({ isBagError: true, code: 'bag_not_active', status: 409 });
    });
  });

  describe('getInventory', () => {
    it('filters by affiliate + status, paginates, and never leaks tokens', async () => {
      await bagService.issueBatch({ batchId, adminId: affiliate._id });
      const other = await createAffiliate('3');
      await bagService.mintBatch({ affiliateId: other.affiliateId, quantity: 1, adminId: other._id });

      const page = await bagService.getInventory({ affiliateId: affiliate.affiliateId, status: 'issued', page: 1 });
      expect(page.bags).toHaveLength(2);
      expect(page.pagination).toMatchObject({ total: 2, page: 1, totalPages: 1 });
      for (const bag of page.bags) {
        expect(bag.token).toBeUndefined();
        expect(bag.tokenHash).toBeUndefined();
      }

      const all = await bagService.getInventory({});
      expect(all.pagination.total).toBe(3);
    });
  });
});
```

- [ ] Run it — expect failures for the right reason:

```bash
npm test -- tests/unit/bags/bagService.test.js
# EXPECTED: new tests fail with "bagService.resolveByToken is not a function" (etc.);
# the Task-2 tests still pass.
```

- [ ] **Implement** — add to `server/modules/bags/bagService.js` (above `module.exports`), and extend the exports:

```javascript
/**
 * Canonical scan resolver. Anti-enumeration: minted, retired, and unknown
 * tokens all resolve to null — callers return one generic error for all
 * three (spec §9). Returns { bag, outcome } where outcome is
 * 'unclaimed' (issued) or 'claimed' (active).
 */
async function resolveByToken(token) {
  if (!token || typeof token !== 'string') return null;
  const bag = await Bag.findOne({ tokenHash: Bag.hashToken(token) });
  if (!bag) return null;
  if (bag.status === 'issued') return { bag, outcome: 'unclaimed' };
  if (bag.status === 'active') return { bag, outcome: 'claimed' };
  return null; // minted / retired — non-resolvable
}

/**
 * Atomic claim (issued -> active). Returns the updated bag or null on race
 * loss / non-issued status. Audit fires only on success.
 */
async function claim({ token, customerId, req = null }) {
  const claimed = await Bag.claim(token, customerId);
  if (claimed) {
    logAuditEvent(AuditEvents.BAG_CLAIMED, {
      bagId: claimed.bagId, customerId, affiliateId: claimed.affiliateId
    }, req);
  }
  return claimed;
}

/**
 * Operator intake resolution (consumed by PR 7's orderIntakeService).
 * Resolves an ACTIVE bag by token, atomically increments the lifetime
 * intake counters, and returns the denormalized link ids.
 *
 * NOTE for PR 7: the open-order check lives in createOrderFromBag, and MUST
 * count only status NOT IN ['delivered','cancelled'] as open — a cancelled
 * order never blocks re-intake (the bag itself stays 'active' on cancel).
 */
async function linkToOrderAtIntake({ token, operatorId }) {
  if (!token || typeof token !== 'string') {
    throw new BagError('bag_not_active', 409, 'Bag is not active');
  }
  const bag = await Bag.findOneAndUpdate(
    { tokenHash: Bag.hashToken(token), status: 'active' },
    { $inc: { orderCount: 1 }, $set: { lastIntakeAt: new Date() } },
    { new: true }
  );
  if (!bag) {
    throw new BagError('bag_not_active', 409, 'Bag is not active');
  }
  logger.info('Bag linked at intake', { bagId: bag.bagId, operatorId: String(operatorId) });
  return { bag, customerId: bag.customerId, affiliateId: bag.affiliateId };
}

/**
 * Paginated inventory listing for admin / affiliate dashboards.
 * Never returns token or tokenHash — the raw token leaves the service only
 * in the mint response (label printing).
 */
async function getInventory({ affiliateId, status, page = 1, limit = 50 } = {}) {
  const filter = {};
  if (affiliateId) filter.affiliateId = affiliateId;
  if (status) filter.status = status;
  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const pageSize = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
  const [bags, total] = await Promise.all([
    Bag.find(filter)
      .select('-token -tokenHash')
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * pageSize)
      .limit(pageSize),
    Bag.countDocuments(filter)
  ]);
  return {
    bags,
    pagination: { total, page: pageNum, totalPages: Math.max(Math.ceil(total / pageSize), 1) }
  };
}

// FUTURE (spec §6.1 — hooks only, do NOT implement this phase):
//   reassign({ token, toCustomerId, adminId }), retire({ token, adminId, reason })
```

And replace the exports block with:

```javascript
module.exports = {
  BagError,
  mintBatch,
  issueBatch,
  resolveByToken,
  claim,
  linkToOrderAtIntake,
  getInventory
};
```

- [ ] Run again — expect pass:

```bash
npm test -- tests/unit/bags/bagService.test.js
# EXPECTED: all tests pass (Task 2 + Task 3 blocks)
```

- [ ] **Commit:**

```bash
git add server/modules/bags/bagService.js tests/unit/bags/bagService.test.js
git commit -m "feat(bags): resolveByToken/claim/linkToOrderAtIntake/getInventory with anti-enumeration semantics"
```

---

## Task 4 — `labelSheetService` + `public/assets/css/bag-labels.css`

**Files:**
- Create: `server/modules/bags/labelSheetService.js`
- Create: `public/assets/css/bag-labels.css`
- Create: `tests/unit/bags/labelSheetService.test.js`

### Steps

- [ ] **Write the failing test** — create `tests/unit/bags/labelSheetService.test.js`:

```javascript
// labelSheetService — print-HTML label grid (spec §6.1)
jest.mock('qrcode'); // mock BEFORE require

const QRCode = require('qrcode');
const Bag = require('../../../server/modules/bags/Bag');
const Affiliate = require('../../../server/models/Affiliate');
const bagService = require('../../../server/modules/bags/bagService');
const labelSheetService = require('../../../server/modules/bags/labelSheetService');
const { hashPassword } = require('../../../server/utils/encryption');

async function createAffiliate(businessName) {
  const { salt, hash } = hashPassword('TestAffiliatePass123!');
  const affiliate = new Affiliate({
    firstName: 'Test', lastName: 'Affiliate',
    email: `labels-${Date.now()}@example.com`, username: `labels${Date.now()}`,
    passwordHash: hash, passwordSalt: salt,
    phone: '+15125550100', address: '123 Test St', city: 'Austin',
    state: 'TX', zipCode: '78701', businessName,
    serviceArea: 'Downtown', serviceLatitude: 30.2672, serviceLongitude: -97.7431,
    serviceRadius: 10, minimumDeliveryFee: 25, perBagDeliveryFee: 5,
    paymentMethod: 'check'
  });
  await affiliate.save();
  return affiliate;
}

describe('labelSheetService', () => {
  beforeEach(async () => {
    await Bag.deleteMany({});
    await Affiliate.deleteMany({});
    // jest.config resetMocks:true — re-arm the mock every test
    QRCode.toDataURL.mockResolvedValue('data:image/png;base64,TESTQR');
  });

  it('renders one cell per bag: QR data-URI, affiliate name, BAG- ref suffix', async () => {
    const affiliate = await createAffiliate('Austin Wash Co');
    const { batchId, bags } = await bagService.mintBatch({
      affiliateId: affiliate.affiliateId, quantity: 3, adminId: affiliate._id
    });

    const html = await labelSheetService.renderLabelSheet(batchId);

    expect(html).toContain('<!DOCTYPE html>');
    expect((html.match(/data:image\/png;base64,TESTQR/g) || [])).toHaveLength(3);
    expect(html).toContain('Austin Wash Co');
    for (const bag of bags) {
      expect(html).toContain(bag.bagId.slice(-6));   // staff ref, not the secret
      expect(html).not.toContain(bag.token);          // raw token NEVER in markup
      expect(QRCode.toDataURL).toHaveBeenCalledWith(
        `https://wavemax.promo/embed-app-v2.html?route=/claim&bag=${bag.token}`,
        { width: 300, margin: 2, errorCorrectionLevel: 'M' }
      );
    }
  });

  it('is CSP-clean: external stylesheet, zero inline script/style', async () => {
    const affiliate = await createAffiliate('CSP Clean Co');
    const { batchId } = await bagService.mintBatch({
      affiliateId: affiliate.affiliateId, quantity: 1, adminId: affiliate._id
    });
    const html = await labelSheetService.renderLabelSheet(batchId);
    expect(html).toContain('href="/assets/css/bag-labels.css"');
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/ style="/i);
    expect(html).not.toMatch(/<style/i);
  });

  it('HTML-escapes the affiliate name', async () => {
    const affiliate = await createAffiliate('<script>alert(1)</script>');
    const { batchId } = await bagService.mintBatch({
      affiliateId: affiliate.affiliateId, quantity: 1, adminId: affiliate._id
    });
    const html = await labelSheetService.renderLabelSheet(batchId);
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('returns null for an unknown batch', async () => {
    expect(await labelSheetService.renderLabelSheet('BATCH-nope')).toBeNull();
  });
});
```

- [ ] Run it — expect failure for the right reason:

```bash
npm test -- tests/unit/bags/labelSheetService.test.js
# EXPECTED: "Cannot find module '../../../server/modules/bags/labelSheetService'"
```

- [ ] **Implement** — create `server/modules/bags/labelSheetService.js`:

```javascript
// Label sheet renderer — print-optimized HTML (spec §6.1).
//
// No PDF dependency: a @media print grid (external stylesheet) that prints
// cleanly via the browser's "Save as PDF". CSP-clean: zero inline
// script/style; QR as data-URI <img> (img-src 'self' data: already allowed).
// The QR payload is the full claim URL so a phone camera works with no app.

const QRCode = require('qrcode');
const Bag = require('./Bag');
const Affiliate = require('../../models/Affiliate');
const SystemConfig = require('../../models/SystemConfig');

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Render the printable label sheet for one mint batch.
 * Returns an HTML string, or null when the batch has no bags.
 * Layout knobs come from SystemConfig: bag_label_columns (grid),
 * bag_label_qr_size_px (QR width). Cells use a .cols-N class — the
 * grid-template definition lives in /assets/css/bag-labels.css, never inline.
 */
async function renderLabelSheet(batchId) {
  const bags = await Bag.find({ batchId }).sort({ bagId: 1 });
  if (bags.length === 0) return null;

  const affiliate = await Affiliate.findOne({ affiliateId: bags[0].affiliateId })
    .select('businessName firstName lastName');
  const affiliateName = affiliate
    ? (affiliate.businessName || `${affiliate.firstName} ${affiliate.lastName}`)
    : bags[0].affiliateId;

  const qrSize = await SystemConfig.getValue('bag_label_qr_size_px', 300);
  const columnsRaw = await SystemConfig.getValue('bag_label_columns', 3);
  const columns = Math.min(Math.max(parseInt(columnsRaw, 10) || 3, 1), 6);
  const baseUrl = process.env.BASE_URL || 'https://wavemax.promo';

  const cells = await Promise.all(bags.map(async (bag) => {
    const claimUrl = `${baseUrl}/embed-app-v2.html?route=/claim&bag=${bag.token}`;
    const qrDataUri = await QRCode.toDataURL(claimUrl, {
      width: qrSize,
      margin: 2,
      errorCorrectionLevel: 'M'
    });
    return `      <div class="label-cell">
        <p class="label-affiliate">${escapeHtml(affiliateName)}</p>
        <img class="label-qr" src="${qrDataUri}" alt="Bag claim QR code">
        <p class="label-ref">Bag ref: ${escapeHtml(bag.bagId.slice(-6))}</p>
      </div>`;
  }));

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>WaveMAX Bag Labels — ${escapeHtml(batchId)}</title>
  <link rel="stylesheet" href="/assets/css/bag-labels.css">
</head>
<body>
  <header class="sheet-header">
    <h1>WaveMAX Laundry Pickup &amp; Delivery — Bag Labels</h1>
    <p class="print-instructions">Print this sheet, cut along the lines, and attach one label to each bag.</p>
    <p class="sheet-meta">${escapeHtml(affiliateName)} &middot; ${escapeHtml(batchId)} &middot; ${bags.length} labels</p>
  </header>
  <main class="label-grid cols-${columns}">
${cells.join('\n')}
  </main>
</body>
</html>`;
}

module.exports = { renderLabelSheet };
```

- [ ] **Create the stylesheet** — `public/assets/css/bag-labels.css`:

```css
/* Bag label sheet — print-optimized grid (spec §6.1). No inline styles. */
* { box-sizing: border-box; }

body {
  margin: 0;
  padding: 16px;
  font-family: 'Segoe UI', Arial, sans-serif;
  color: #1e3a5f;
  background: #ffffff;
}

.sheet-header { text-align: center; margin-bottom: 16px; }
.sheet-header h1 { font-size: 18px; margin: 0 0 4px; }
.print-instructions { font-size: 13px; color: #475569; margin: 0 0 4px; }
.sheet-meta { font-size: 12px; color: #64748b; margin: 0; }

.label-grid { display: grid; gap: 12px; }
.cols-1 { grid-template-columns: repeat(1, 1fr); }
.cols-2 { grid-template-columns: repeat(2, 1fr); }
.cols-3 { grid-template-columns: repeat(3, 1fr); }
.cols-4 { grid-template-columns: repeat(4, 1fr); }
.cols-5 { grid-template-columns: repeat(5, 1fr); }
.cols-6 { grid-template-columns: repeat(6, 1fr); }

.label-cell {
  border: 1px dashed #94a3b8;
  border-radius: 6px;
  padding: 10px;
  text-align: center;
  page-break-inside: avoid;
  break-inside: avoid;
}

.label-affiliate { font-size: 14px; font-weight: 700; margin: 0 0 6px; word-break: break-word; }
.label-qr { width: 100%; max-width: 220px; height: auto; }
.label-ref { font-size: 11px; color: #475569; letter-spacing: 1px; margin: 6px 0 0; }

@media print {
  @page { margin: 12mm; }
  body { padding: 0; }
  .sheet-header h1 { font-size: 14px; }
}
```

- [ ] Run again — expect pass:

```bash
npm test -- tests/unit/bags/labelSheetService.test.js
# EXPECTED: all 4 tests pass
```

- [ ] **Commit:**

```bash
git add server/modules/bags/labelSheetService.js public/assets/css/bag-labels.css tests/unit/bags/labelSheetService.test.js
git commit -m "feat(bags): CSP-clean printable label sheet with claim-URL QR payloads"
```

---

## Task 5 — `bagController` + `bagRoutes` + `server.js` mount + CSRF config

**Files:**
- Create: `server/modules/bags/bagController.js`
- Create: `server/routes/bagRoutes.js`
- Modify: `server.js` (mount `/api/v1/bags` on `apiV1Router`)
- Modify: `server/config/csrf-config.js` (add mint/issue to `CRITICAL_ENDPOINTS`)
- Create: `tests/integration/bags.test.js`

### Steps

- [ ] **Write the failing test** — create `tests/integration/bags.test.js`:

```javascript
// /api/v1/bags — mint / labels / issue / resolve / inventory (spec §5, §6.1, §9)
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../server');
const Administrator = require('../../server/models/Administrator');
const Affiliate = require('../../server/models/Affiliate');
const Bag = require('../../server/modules/bags/Bag');
const bagService = require('../../server/modules/bags/bagService');
const { getCsrfToken } = require('../helpers/csrfHelper');
const { hashPassword } = require('../../server/utils/encryption');

describe('Bag endpoints', () => {
  let agent, csrfToken;
  let admin, adminToken, weakAdmin, weakAdminToken;
  let affiliate, affiliateToken;

  beforeEach(async () => {
    await Administrator.deleteMany({});
    await Affiliate.deleteMany({});
    await Bag.deleteMany({});

    admin = await Administrator.create({
      administratorId: 'ADM-bags-1', firstName: 'Bag', lastName: 'Admin',
      email: 'bagadmin@test.com', username: 'bagadmin',
      passwordSalt: 'salt', passwordHash: 'hash',
      permissions: ['manage_affiliates']
    });
    weakAdmin = await Administrator.create({
      administratorId: 'ADM-bags-2', firstName: 'No', lastName: 'Perm',
      email: 'nopermadmin@test.com', username: 'nopermadmin',
      passwordSalt: 'salt', passwordHash: 'hash',
      permissions: ['view_analytics']
    });
    adminToken = jwt.sign({ id: admin._id, role: 'administrator' }, process.env.JWT_SECRET);
    weakAdminToken = jwt.sign({ id: weakAdmin._id, role: 'administrator' }, process.env.JWT_SECRET);

    const { salt, hash } = hashPassword('TestAffiliatePass123!');
    affiliate = new Affiliate({
      firstName: 'Bag', lastName: 'Owner', email: 'bagowner@test.com',
      username: 'bagowner', passwordHash: hash, passwordSalt: salt,
      phone: '+15125550100', address: '1 Main', city: 'Austin', state: 'TX',
      zipCode: '78701', businessName: 'Bag Owner Wash',
      serviceArea: 'Downtown', serviceLatitude: 30.2672, serviceLongitude: -97.7431,
      serviceRadius: 10, minimumDeliveryFee: 25, perBagDeliveryFee: 5,
      paymentMethod: 'check'
    });
    await affiliate.save();
    affiliateToken = jwt.sign(
      { id: affiliate._id, affiliateId: affiliate.affiliateId, role: 'affiliate' },
      process.env.JWT_SECRET
    );

    agent = request.agent(app);
    csrfToken = await getCsrfToken(app, agent);
  });

  describe('POST /api/v1/bags/mint', () => {
    it('mints a batch for an admin with manage_affiliates (CSRF required)', async () => {
      const res = await agent
        .post('/api/v1/bags/mint')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-csrf-token', csrfToken)
        .send({ affiliateId: affiliate.affiliateId, quantity: 3 });
      expect(res.status).toBe(201);
      expect(res.body.batchId).toMatch(/^BATCH-/);
      expect(res.body.count).toBe(3);
      expect(res.body.bags).toHaveLength(3);
      // raw token returned ONCE at mint (feeds label printing)
      expect(res.body.bags[0].token).toMatch(/^[0-9a-f]{32}$/);
      expect(res.body.bags[0].bagId).toMatch(/^BAG-/);
      expect(res.body.bags[0].status).toBe('minted');
    });

    it('rejects without CSRF token', async () => {
      const res = await agent
        .post('/api/v1/bags/mint')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ affiliateId: affiliate.affiliateId, quantity: 1 });
      expect(res.status).toBe(403);
    });

    it('403s an admin without manage_affiliates', async () => {
      const res = await agent
        .post('/api/v1/bags/mint')
        .set('Authorization', `Bearer ${weakAdminToken}`)
        .set('x-csrf-token', csrfToken)
        .send({ affiliateId: affiliate.affiliateId, quantity: 1 });
      expect(res.status).toBe(403);
    });

    it('403s an affiliate', async () => {
      const res = await agent
        .post('/api/v1/bags/mint')
        .set('Authorization', `Bearer ${affiliateToken}`)
        .set('x-csrf-token', csrfToken)
        .send({ affiliateId: affiliate.affiliateId, quantity: 1 });
      expect(res.status).toBe(403);
    });

    it('400s an out-of-bounds quantity and 404s an unknown affiliate', async () => {
      const tooMany = await agent
        .post('/api/v1/bags/mint')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-csrf-token', csrfToken)
        .send({ affiliateId: affiliate.affiliateId, quantity: 9999 });
      expect(tooMany.status).toBe(400);
      const noAff = await agent
        .post('/api/v1/bags/mint')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-csrf-token', csrfToken)
        .send({ affiliateId: 'AFF-nope', quantity: 1 });
      expect(noAff.status).toBe(404);
    });
  });

  describe('GET /api/v1/bags/batch/:batchId/labels', () => {
    it('returns text/html with QR imgs for the admin, 404 for unknown batch', async () => {
      const { batchId } = await bagService.mintBatch({
        affiliateId: affiliate.affiliateId, quantity: 2, adminId: admin._id
      });
      const res = await agent
        .get(`/api/v1/bags/batch/${batchId}/labels`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/html/);
      expect(res.text).toContain('data:image/png');
      expect(res.text).toContain('Bag Owner Wash');
      expect(res.text).not.toMatch(/<script/i);

      const missing = await agent
        .get('/api/v1/bags/batch/BATCH-nope/labels')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(missing.status).toBe(404);
    });

    it('403s a non-admin', async () => {
      const res = await agent
        .get('/api/v1/bags/batch/BATCH-x/labels')
        .set('Authorization', `Bearer ${affiliateToken}`);
      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/v1/bags/batch/:batchId/issue', () => {
    it('issues the batch (admin + CSRF)', async () => {
      const { batchId } = await bagService.mintBatch({
        affiliateId: affiliate.affiliateId, quantity: 2, adminId: admin._id
      });
      const res = await agent
        .post(`/api/v1/bags/batch/${batchId}/issue`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-csrf-token', csrfToken)
        .send({});
      expect(res.status).toBe(200);
      expect(res.body.issued).toBe(2);
      const bags = await Bag.find({ batchId });
      expect(bags.every((b) => b.status === 'issued')).toBe(true);
    });
  });

  describe('GET /api/v1/bags/resolve/:token (public)', () => {
    let token, batchId;

    beforeEach(async () => {
      const minted = await bagService.mintBatch({
        affiliateId: affiliate.affiliateId, quantity: 1, adminId: admin._id
      });
      batchId = minted.batchId;
      token = minted.bags[0].token;
    });

    it('404s generically for unknown AND minted tokens (anti-enumeration)', async () => {
      const unknown = await agent.get(`/api/v1/bags/resolve/${'f'.repeat(32)}`);
      const minted = await agent.get(`/api/v1/bags/resolve/${token}`);
      expect(unknown.status).toBe(404);
      expect(minted.status).toBe(404);
      expect(unknown.body.message).toBe(minted.body.message); // same generic error
    });

    it('returns outcome unclaimed + affiliate name only (no PII) for an issued bag', async () => {
      await bagService.issueBatch({ batchId, adminId: admin._id });
      const res = await agent.get(`/api/v1/bags/resolve/${token}`);
      expect(res.status).toBe(200);
      expect(res.body.outcome).toBe('unclaimed');
      expect(res.body.affiliate).toEqual({ name: 'Bag Owner Wash' });
      expect(res.body.order).toBeNull();
      expect(JSON.stringify(res.body)).not.toContain(affiliate.email);
    });

    it('returns outcome claimed + customerId only for an active bag', async () => {
      await bagService.issueBatch({ batchId, adminId: admin._id });
      await bagService.claim({ token, customerId: 'CUST-claimed-1' });
      const res = await agent.get(`/api/v1/bags/resolve/${token}`);
      expect(res.status).toBe(200);
      expect(res.body.outcome).toBe('claimed');
      expect(res.body.customerId).toBe('CUST-claimed-1');
      expect(res.body.order).toBeNull(); // populated by PR 7/9
      expect(res.body.affiliate).toBeUndefined();
    });
  });

  describe('GET /api/v1/bags (inventory)', () => {
    beforeEach(async () => {
      await bagService.mintBatch({ affiliateId: affiliate.affiliateId, quantity: 2, adminId: admin._id });
    });

    it('scopes an affiliate to their own bags even if they ask for another id', async () => {
      const res = await agent
        .get('/api/v1/bags?affiliateId=AFF-someone-else')
        .set('Authorization', `Bearer ${affiliateToken}`);
      expect(res.status).toBe(200);
      expect(res.body.bags).toHaveLength(2);
      expect(res.body.bags.every((b) => b.affiliateId === affiliate.affiliateId)).toBe(true);
      expect(res.body.bags.every((b) => b.token === undefined && b.tokenHash === undefined)).toBe(true);
    });

    it('lets an admin filter freely; 403s a customer token; 401s anonymous', async () => {
      const adminRes = await agent
        .get(`/api/v1/bags?affiliateId=${affiliate.affiliateId}&status=minted`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(adminRes.status).toBe(200);
      expect(adminRes.body.pagination.total).toBe(2);

      const customerToken = jwt.sign(
        { id: admin._id, customerId: 'CUST-x', role: 'customer' }, process.env.JWT_SECRET
      );
      const customerRes = await agent
        .get('/api/v1/bags')
        .set('Authorization', `Bearer ${customerToken}`);
      expect(customerRes.status).toBe(403);

      const anonRes = await agent.get('/api/v1/bags');
      expect(anonRes.status).toBe(401);
    });
  });
});
```

- [ ] Run it — expect failure for the right reason:

```bash
npm test -- tests/integration/bags.test.js
# EXPECTED: every request returns 404 (route not mounted yet) /
# "Cannot find module" if the controller require is missing.
```

- [ ] **Implement the controller** — create `server/modules/bags/bagController.js`:

```javascript
// Bag HTTP layer — thin wrappers over bagService / labelSheetService.

const ControllerHelpers = require('../../utils/controllerHelpers');
const bagService = require('./bagService');
const labelSheetService = require('./labelSheetService');
const Affiliate = require('../../models/Affiliate');

const { asyncWrapper, sendSuccess, sendError } = ControllerHelpers;

function mapBagError(res, err) {
  if (err.isBagError) return sendError(res, err.message, err.status);
  throw err;
}

/** POST /api/v1/bags/mint — admin + manage_affiliates + CSRF */
exports.mintBags = asyncWrapper(async (req, res) => {
  const { affiliateId, quantity } = req.body;
  try {
    const { batchId, bags } = await bagService.mintBatch({
      affiliateId, quantity, adminId: req.user.id, req
    });
    return sendSuccess(res, {
      batchId,
      count: bags.length,
      // Raw tokens returned exactly once — the mint response feeds printing.
      bags: bags.map((b) => ({ bagId: b.bagId, token: b.token, status: b.status }))
    }, 'Bag batch minted', 201);
  } catch (err) {
    return mapBagError(res, err);
  }
});

/** GET /api/v1/bags/batch/:batchId/labels — admin + manage_affiliates */
exports.getBatchLabels = asyncWrapper(async (req, res) => {
  const html = await labelSheetService.renderLabelSheet(req.params.batchId);
  if (!html) return sendError(res, 'Batch not found', 404);
  res.type('text/html').send(html);
});

/** POST /api/v1/bags/batch/:batchId/issue — admin + manage_affiliates + CSRF */
exports.issueBatch = asyncWrapper(async (req, res) => {
  try {
    const result = await bagService.issueBatch({
      batchId: req.params.batchId, adminId: req.user.id, req
    });
    return sendSuccess(res, result, 'Batch issued');
  } catch (err) {
    return mapBagError(res, err);
  }
});

/**
 * GET /api/v1/bags/resolve/:token — PUBLIC (rate-limited).
 * Canonical scan-context resolver (spec §5). Anti-enumeration: unknown,
 * minted, and retired tokens share one generic 404. Never returns customer
 * PII; `customerId` only on 'claimed' to drive login routing. The `order`
 * slot is the designed shape populated by PR 7/9 — null until then.
 */
exports.resolveBag = asyncWrapper(async (req, res) => {
  const resolved = await bagService.resolveByToken(req.params.token);
  if (!resolved) return sendError(res, 'invalid_bag', 404);
  const { bag, outcome } = resolved;
  if (outcome === 'unclaimed') {
    const affiliate = await Affiliate.findOne({ affiliateId: bag.affiliateId })
      .select('businessName firstName lastName');
    const name = affiliate
      ? (affiliate.businessName || `${affiliate.firstName} ${affiliate.lastName}`)
      : null;
    return sendSuccess(res, { outcome, affiliate: { name }, order: null });
  }
  // claimed
  return sendSuccess(res, { outcome, customerId: bag.customerId, order: null });
});

/** GET /api/v1/bags — affiliate (own) / administrator */
exports.getInventory = asyncWrapper(async (req, res) => {
  const { status, page, limit } = req.query;
  let affiliateId = req.query.affiliateId;
  if (req.user.role === 'affiliate') {
    affiliateId = req.user.affiliateId; // own bags only, ignore the query param
  } else if (req.user.role !== 'administrator') {
    return sendError(res, 'Access denied', 403);
  }
  const result = await bagService.getInventory({ affiliateId, status, page, limit });
  return sendSuccess(res, result);
});
```

- [ ] **Implement the routes** — create `server/routes/bagRoutes.js`:

```javascript
// Bag routes — mounted at /api/v1/bags (spec §5).

const express = require('express');
const router = express.Router();
const bagController = require('../modules/bags/bagController');
const { authenticate } = require('../middleware/auth');
const { checkAdminPermission } = require('../middleware/rbac');
const { sensitiveOperationLimiter, createCustomLimiter } = require('../middleware/rateLimiting');

// Tight limiter on top of the global apiLimiter for the public token
// resolver (anti-enumeration, spec §9).
const bagResolveLimiter = createCustomLimiter({
  windowMs: 15 * 60 * 1000,
  max: 60,
  name: 'bag-resolve',
  skip: () => process.env.NODE_ENV === 'test'
});

/**
 * @route   POST /api/v1/bags/mint
 * @access  administrator + manage_affiliates (CSRF enforced via csrf-config)
 */
router.post('/mint',
  authenticate,
  checkAdminPermission('manage_affiliates'),
  sensitiveOperationLimiter,
  bagController.mintBags);

/**
 * @route   GET /api/v1/bags/batch/:batchId/labels
 * @access  administrator + manage_affiliates
 */
router.get('/batch/:batchId/labels',
  authenticate,
  checkAdminPermission('manage_affiliates'),
  bagController.getBatchLabels);

/**
 * @route   POST /api/v1/bags/batch/:batchId/issue
 * @access  administrator + manage_affiliates (CSRF enforced via csrf-config)
 */
router.post('/batch/:batchId/issue',
  authenticate,
  checkAdminPermission('manage_affiliates'),
  bagController.issueBatch);

/**
 * @route   GET /api/v1/bags/resolve/:token
 * @access  public (rate-limited) — canonical scan-context resolver
 */
router.get('/resolve/:token', bagResolveLimiter, bagController.resolveBag);

/**
 * @route   GET /api/v1/bags
 * @access  affiliate (own) / administrator — inventory listing
 */
router.get('/', authenticate, bagController.getInventory);

module.exports = router;
```

- [ ] **Mount in `server.js`.** Find the v1 mounts block (currently around line 941; PR 1/2 may have shifted line numbers — anchor on the `customers` mount line, which survives all prior PRs):

```javascript
apiV1Router.use('/customers', customerRoutes);
```

Add immediately after it:

```javascript
apiV1Router.use('/bags', require('./server/routes/bagRoutes'));  // Durable bags: mint/issue/labels/resolve/inventory
```

- [ ] **CSRF config.** In `server/config/csrf-config.js`, `CRITICAL_ENDPOINTS` currently ends with (lines ~178-182):

```javascript
    // Operator critical actions
    '/api/v1/operators/orders/:orderId/claim',
    '/api/v1/operators/orders/:orderId/status',
    '/api/v1/operators/orders/:orderId/quality-check',
    '/api/v1/operators/shift/status'
  ],
```

Add a bag-admin block before the closing `],`:

```javascript
    // Operator critical actions
    '/api/v1/operators/orders/:orderId/claim',
    '/api/v1/operators/orders/:orderId/status',
    '/api/v1/operators/orders/:orderId/quality-check',
    '/api/v1/operators/shift/status',

    // Bag admin mutations (mint/issue — spec §5)
    '/api/v1/bags/mint',
    '/api/v1/bags/batch/:batchId/issue'
  ],
```

(These would be CSRF-enforced anyway by the default-deny fallthrough in `shouldEnforceCsrf`, but the explicit entries pin the contract and keep `tests/unit/csrfConfig.test.js`-style assertions possible.)

- [ ] Run the integration tests — expect pass:

```bash
npm test -- tests/integration/bags.test.js
# EXPECTED: all tests pass
```

- [ ] Quick regression of the suite areas touched (server.js + csrf-config):

```bash
npm test -- tests/unit/csrfConfig.test.js tests/integration/securityHeaders.test.js
# EXPECTED: pass
```

- [ ] **Commit:**

```bash
git add server/modules/bags/bagController.js server/routes/bagRoutes.js server.js server/config/csrf-config.js tests/integration/bags.test.js
git commit -m "feat(bags): mount /api/v1/bags — mint/labels/issue (manage_affiliates+CSRF), public resolve, scoped inventory"
```

---

## Task 6 — `bagClaimService`

**Files:**
- Create: `server/services/bagClaimService.js`
- Create: `tests/unit/bagClaimService.test.js`

### Steps

- [ ] **Write the failing test** — create `tests/unit/bagClaimService.test.js`:

```javascript
// bagClaimService — claim-path adapter over bagService (spec §6.3)
const Bag = require('../../server/modules/bags/Bag');
const Affiliate = require('../../server/models/Affiliate');
const bagService = require('../../server/modules/bags/bagService');
const bagClaimService = require('../../server/services/bagClaimService');
const { hashPassword } = require('../../server/utils/encryption');

async function createAffiliate() {
  const { salt, hash } = hashPassword('TestAffiliatePass123!');
  const affiliate = new Affiliate({
    firstName: 'Claim', lastName: 'Affiliate',
    email: `claimsvc-${Date.now()}@example.com`, username: `claimsvc${Date.now()}`,
    passwordHash: hash, passwordSalt: salt,
    phone: '+15125550100', address: '1 Main', city: 'Austin', state: 'TX',
    zipCode: '78701', businessName: 'Claim Wash Co',
    serviceArea: 'Downtown', serviceLatitude: 30.2672, serviceLongitude: -97.7431,
    serviceRadius: 10, minimumDeliveryFee: 25, perBagDeliveryFee: 5,
    paymentMethod: 'check'
  });
  await affiliate.save();
  return affiliate;
}

describe('bagClaimService', () => {
  let affiliate, token, batchId;

  beforeEach(async () => {
    await Bag.deleteMany({});
    await Affiliate.deleteMany({});
    affiliate = await createAffiliate();
    const minted = await bagService.mintBatch({
      affiliateId: affiliate.affiliateId, quantity: 1, adminId: affiliate._id
    });
    batchId = minted.batchId;
    token = minted.bags[0].token;
  });

  describe('resolveClaimToken', () => {
    it("maps unknown and minted tokens to { state: 'invalid' } (no oracle)", async () => {
      expect(await bagClaimService.resolveClaimToken('f'.repeat(32))).toEqual({ state: 'invalid' });
      expect(await bagClaimService.resolveClaimToken(token)).toEqual({ state: 'invalid' });
    });

    it("maps issued to 'claimable' with the affiliate public projection", async () => {
      await bagService.issueBatch({ batchId, adminId: affiliate._id });
      const result = await bagClaimService.resolveClaimToken(token);
      expect(result.state).toBe('claimable');
      expect(result.bag.affiliateId).toBe(affiliate.affiliateId);
      expect(result.affiliate.businessName).toBe('Claim Wash Co');
      // public projection only — no credentials / contact internals
      expect(result.affiliate.passwordHash).toBeUndefined();
      expect(result.affiliate.email).toBeUndefined();
    });

    it("maps active to 'claimed' with a null order slot (populated by PR 9)", async () => {
      await bagService.issueBatch({ batchId, adminId: affiliate._id });
      await bagService.claim({ token, customerId: 'CUST-1' });
      const result = await bagClaimService.resolveClaimToken(token);
      expect(result.state).toBe('claimed');
      expect(result.order).toBeNull();
      // no customer PII on the claim-path response
      expect(result.customer).toBeUndefined();
    });
  });

  describe('claimForCustomer', () => {
    it('claims and returns the active bag', async () => {
      await bagService.issueBatch({ batchId, adminId: affiliate._id });
      const { bag } = await bagClaimService.resolveClaimToken(token);
      const claimed = await bagClaimService.claimForCustomer(bag, 'CUST-1');
      expect(claimed.status).toBe('active');
      expect(claimed.customerId).toBe('CUST-1');
    });

    it("throws ClaimError('bag_already_claimed', 409) on race loss", async () => {
      await bagService.issueBatch({ batchId, adminId: affiliate._id });
      const { bag } = await bagClaimService.resolveClaimToken(token);
      await bagClaimService.claimForCustomer(bag, 'CUST-1');
      await expect(bagClaimService.claimForCustomer(bag, 'CUST-2'))
        .rejects.toMatchObject({ isClaimError: true, code: 'bag_already_claimed', status: 409 });
    });
  });
});
```

- [ ] Run it — expect failure for the right reason:

```bash
npm test -- tests/unit/bagClaimService.test.js
# EXPECTED: "Cannot find module '../../server/services/bagClaimService'"
```

- [ ] **Implement** — create `server/services/bagClaimService.js`:

```javascript
// Bag claim service — adapts bagService for the customer claim path
// (spec §6.3). States: 'claimable' (issued) | 'claimed' (active) |
// 'invalid' (minted/retired/unknown — one generic state, no oracle).

const Affiliate = require('../models/Affiliate');
const bagService = require('../modules/bags/bagService');

class ClaimError extends Error {
  constructor(code, status, message) {
    super(message || code);
    this.code = code;
    this.status = status;
    this.isClaimError = true;
  }
}

/**
 * Resolve a scanned bag token into a claim-page state.
 * - 'claimable': includes the affiliate public projection (same fields as
 *   affiliateController.getPublicAffiliateInfo) so the form can show
 *   "Registering with <name>".
 * - 'claimed': includes the open order's { status, awaitingDelivery } with
 *   NO customer PII. Order.bagId does not exist until PR 7, so the slot is
 *   designed now and returned as null; PR 9 populates it.
 */
async function resolveClaimToken(bagToken) {
  const resolved = await bagService.resolveByToken(bagToken);
  if (!resolved) return { state: 'invalid' };
  const { bag, outcome } = resolved;

  if (outcome === 'unclaimed') {
    const affiliate = await Affiliate.findOne({ affiliateId: bag.affiliateId })
      .select('affiliateId firstName lastName businessName minimumDeliveryFee perBagDeliveryFee city state');
    if (!affiliate) return { state: 'invalid' }; // orphaned bag — treat as invalid
    return { state: 'claimable', bag, affiliate };
  }

  // outcome === 'claimed' — order context arrives with PR 7/9:
  // order: { status, awaitingDelivery } (awaitingDelivery true iff picked_up)
  return { state: 'claimed', bag, order: null };
}

/**
 * Atomic claim for a freshly created customer. Throws
 * ClaimError('bag_already_claimed', 409) on race loss so the caller can run
 * its compensating delete.
 */
async function claimForCustomer(bag, customerId, req = null) {
  const claimed = await bagService.claim({ token: bag.token, customerId, req });
  if (!claimed) {
    throw new ClaimError('bag_already_claimed', 409, 'This bag has already been claimed');
  }
  return claimed;
}

module.exports = {
  ClaimError,
  resolveClaimToken,
  claimForCustomer
};
```

- [ ] Run again — expect pass:

```bash
npm test -- tests/unit/bagClaimService.test.js
# EXPECTED: all 5 tests pass
```

- [ ] **Commit:**

```bash
git add server/services/bagClaimService.js tests/unit/bagClaimService.test.js
git commit -m "feat(claim): bagClaimService — state-discriminated resolve + atomic claimForCustomer"
```

---

## Task 7 — Claim registration backend (service rework + endpoints + route swap)

> Tasks 7 and 8 form one logical unit: this task changes `registerCustomer`'s contract (bagToken in, affiliate derived from bag) and removes the legacy `POST /api/v1/customers/register` route; Task 8 migrates the legacy tests that exercised it. Do not pause between them — the FULL suite is only green again at the end of Task 8. The new claim tests written here run green at the end of this task.

**Files:**
- Modify: `server/services/customerRegistrationService.js`
- Modify: `server/controllers/customerController.js` (replace `registerCustomer` handler with `resolveClaim` + `claimRegister`)
- Modify: `server/routes/customerRoutes.js` (remove legacy register route; add claim routes)
- Modify: `server/config/csrf-config.js` (`REGISTRATION_ENDPOINTS`: claim path replaces the register path)
- Create: `tests/integration/customerClaim.test.js`

### Steps

- [ ] **Write the failing test** — create `tests/integration/customerClaim.test.js`:

```javascript
// Customer claim flow — resolve + register (spec §6.3)
jest.mock('../../server/utils/emailService', () => ({
  sendCustomerWelcomeEmail: jest.fn().mockResolvedValue(true),
  sendAffiliateNewCustomerEmail: jest.fn().mockResolvedValue(true)
}));

const request = require('supertest');
const app = require('../../server');
const Affiliate = require('../../server/models/Affiliate');
const Customer = require('../../server/models/Customer');
const Bag = require('../../server/modules/bags/Bag');
const bagService = require('../../server/modules/bags/bagService');
const { hashPassword } = require('../../server/utils/encryption');
const { getCsrfToken, createAgent } = require('../helpers/csrfHelper');

async function createAffiliate() {
  const { salt, hash } = hashPassword('TestAffiliatePass123!');
  const affiliate = new Affiliate({
    firstName: 'Claim', lastName: 'Flow',
    email: `claimflow-${Date.now()}@example.com`, username: `claimflow${Date.now()}`,
    passwordHash: hash, passwordSalt: salt,
    phone: '+15125550100', address: '1 Main', city: 'Austin', state: 'TX',
    zipCode: '78701', businessName: 'Claim Flow Wash',
    serviceArea: 'Downtown', serviceLatitude: 30.2672, serviceLongitude: -97.7431,
    serviceRadius: 10, minimumDeliveryFee: 25, perBagDeliveryFee: 5,
    paymentMethod: 'check'
  });
  await affiliate.save();
  return affiliate;
}

async function issuedBag(affiliate) {
  const { batchId, bags } = await bagService.mintBatch({
    affiliateId: affiliate.affiliateId, quantity: 1, adminId: affiliate._id
  });
  await bagService.issueBatch({ batchId, adminId: affiliate._id });
  return bags[0].token;
}

function registrationBody(overrides = {}) {
  return {
    firstName: 'New', lastName: 'Customer',
    email: 'newcustomer@example.com', phone: '512-555-0101',
    address: '456 Customer St', city: 'Austin', state: 'TX', zipCode: '78702',
    username: 'newclaimcustomer', password: 'SecurePassw0rd!',
    ...overrides
  };
}

describe('Customer claim', () => {
  let affiliate;

  beforeEach(async () => {
    await Affiliate.deleteMany({});
    await Customer.deleteMany({});
    await Bag.deleteMany({});
    affiliate = await createAffiliate();
  });

  describe('GET /api/v1/customers/claim/:bagToken', () => {
    it("returns 'claimable' + affiliate display data (no PII) for an issued bag", async () => {
      const token = await issuedBag(affiliate);
      const res = await request(app).get(`/api/v1/customers/claim/${token}`);
      expect(res.status).toBe(200);
      expect(res.body.state).toBe('claimable');
      expect(res.body.affiliate.businessName).toBe('Claim Flow Wash');
      expect(JSON.stringify(res.body)).not.toContain(affiliate.email);
    });

    it("returns 'claimed' with a null order slot and NO customer PII", async () => {
      const token = await issuedBag(affiliate);
      await bagService.claim({ token, customerId: 'CUST-existing' });
      const res = await request(app).get(`/api/v1/customers/claim/${token}`);
      expect(res.status).toBe(200);
      expect(res.body.state).toBe('claimed');
      expect(res.body.order).toBeNull();
      expect(JSON.stringify(res.body)).not.toContain('CUST-existing');
    });

    it("returns 'invalid' for unknown and minted tokens with identical bodies", async () => {
      const { bags } = await bagService.mintBatch({
        affiliateId: affiliate.affiliateId, quantity: 1, adminId: affiliate._id
      });
      const minted = await request(app).get(`/api/v1/customers/claim/${bags[0].token}`);
      const unknown = await request(app).get(`/api/v1/customers/claim/${'f'.repeat(32)}`);
      expect(minted.status).toBe(200);
      expect(minted.body).toEqual(unknown.body);
      expect(minted.body.state).toBe('invalid');
    });
  });

  describe('POST /api/v1/customers/claim/:bagToken/register', () => {
    it('creates the customer, derives the affiliate from the bag, activates the bag', async () => {
      const token = await issuedBag(affiliate);
      const res = await request(app)
        .post(`/api/v1/customers/claim/${token}/register`)
        .send(registrationBody());
      expect(res.status).toBe(201);
      expect(res.body.customerId).toMatch(/^CUST-/);
      expect(res.body.customerData.affiliateId).toBe(affiliate.affiliateId);

      const customer = await Customer.findOne({ customerId: res.body.customerId });
      expect(customer.affiliateId).toBe(affiliate.affiliateId);
      const bag = await Bag.findOne({ tokenHash: Bag.hashToken(token) });
      expect(bag.status).toBe('active');
      expect(bag.customerId).toBe(res.body.customerId);
    });

    it('ignores a client-supplied affiliateId (server-trust)', async () => {
      const token = await issuedBag(affiliate);
      const res = await request(app)
        .post(`/api/v1/customers/claim/${token}/register`)
        .send(registrationBody({ affiliateId: 'AFF-attacker' }));
      expect(res.status).toBe(201);
      const customer = await Customer.findOne({ customerId: res.body.customerId });
      expect(customer.affiliateId).toBe(affiliate.affiliateId);
    });

    it('409s a non-claimable bag (minted) and an unknown token', async () => {
      const { bags } = await bagService.mintBatch({
        affiliateId: affiliate.affiliateId, quantity: 1, adminId: affiliate._id
      });
      const minted = await request(app)
        .post(`/api/v1/customers/claim/${bags[0].token}/register`)
        .send(registrationBody());
      expect(minted.status).toBe(409);
      const unknown = await request(app)
        .post(`/api/v1/customers/claim/${'f'.repeat(32)}/register`)
        .send(registrationBody());
      expect(unknown.status).toBe(409);
      expect(await Customer.countDocuments({})).toBe(0);
    });

    it('duplicate email fails BEFORE the claim — bag stays issued, no orphan', async () => {
      const token = await issuedBag(affiliate);
      await request(app)
        .post(`/api/v1/customers/claim/${token}/register`)
        .send(registrationBody());
      const token2 = await issuedBag(affiliate);
      const res = await request(app)
        .post(`/api/v1/customers/claim/${token2}/register`)
        .send(registrationBody({ username: 'differentusername' })); // same email
      expect(res.status).toBe(400);
      const bag2 = await Bag.findOne({ tokenHash: Bag.hashToken(token2) });
      expect(bag2.status).toBe('issued');
      expect(await Customer.countDocuments({})).toBe(1);
    });

    it('concurrent double-claim: exactly one 201, one 409, no orphan customer', async () => {
      const token = await issuedBag(affiliate);
      const [a, b] = await Promise.all([
        request(app).post(`/api/v1/customers/claim/${token}/register`)
          .send(registrationBody({ email: 'racer-a@example.com', username: 'racera' })),
        request(app).post(`/api/v1/customers/claim/${token}/register`)
          .send(registrationBody({ email: 'racer-b@example.com', username: 'racerb' }))
      ]);
      const statuses = [a.status, b.status].sort();
      expect(statuses).toEqual([201, 409]);
      // compensating delete: the loser's customer must NOT exist
      expect(await Customer.countDocuments({})).toBe(1);
      const bag = await Bag.findOne({ tokenHash: Bag.hashToken(token) });
      const winner = a.status === 201 ? a : b;
      expect(bag.customerId).toBe(winner.body.customerId);
    });

    it('the legacy public registration route is gone', async () => {
      // This task ALSO removes '/api/v1/customers/register' from the CSRF
      // REGISTRATION_ENDPOINTS exemption — a tokenless POST would then 403 on
      // conditionalCsrf's default-enforce branch before routing and never
      // reach the 404 handler. Send a CSRF token so removal genuinely 404s.
      const agent = createAgent(app);
      const csrfToken = await getCsrfToken(app, agent);
      const res = await agent
        .post('/api/v1/customers/register')
        .set('x-csrf-token', csrfToken)
        .send(registrationBody({ affiliateId: affiliate.affiliateId }));
      expect(res.status).toBe(404);
    });
  });
});
```

- [ ] Run it — expect failure for the right reason:

```bash
npm test -- tests/integration/customerClaim.test.js
# EXPECTED: 404s on /api/v1/customers/claim/* (routes don't exist yet)
# and the legacy-route test fails (route still mounted).
```

- [ ] **Rework the service.** In `server/services/customerRegistrationService.js`, replace the entire `registerCustomer` function (currently lines 41-163; PR 2 may have already trimmed `paymentConfirmed`/`numberOfBags` — replace whatever is there wholesale) **and** update the requires. Final file:

```javascript
// Customer registration service
//
// Claim-based registration (spec §6.3): the customer registers by scanning a
// durable bag's QR. The affiliate is derived server-side from the bag —
// never from client input. Order of operations for the claim race: save the
// customer, then claim; on race loss, compensating delete (no Mongo
// transaction — standalone-mongod portable, spec §13 #4).

const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const Customer = require('../models/Customer');
const bagClaimService = require('./bagClaimService');
const encryptionUtil = require('../utils/encryption');
const emailService = require('../utils/emailService');
const Formatters = require('../utils/formatters');
const logger = require('../utils/logger');

/**
 * Error type used to communicate expected failures (duplicate email, bag not
 * claimable, etc.) back to the HTTP layer. The controller maps these to JSON
 * error responses; unexpected failures bubble up normally.
 */
class RegistrationError extends Error {
  constructor(code, message, extras = {}) {
    super(message);
    this.code = code;        // 'bag_not_claimable' | 'bag_already_claimed' | 'duplicate_email_and_username' | 'duplicate_email' | 'duplicate_username'
    this.status = extras.status || 400;
    this.extras = extras;
    this.isRegistrationError = true;
  }
}

/**
 * Register a new customer against a scanned bag token.
 * Returns `{ customer, affiliate, bag, token }` on success, or throws a
 * RegistrationError on expected failure cases.
 */
async function registerCustomer(payload) {
  const {
    bagToken,
    firstName,
    lastName,
    email,
    phone,
    address,
    city,
    state,
    zipCode,
    specialInstructions,
    affiliateSpecialInstructions,
    username,
    password,
    languagePreference,
    socialToken,
    socialProvider
  } = payload;

  // Server-trust: the affiliate comes from the bag, never the payload.
  const resolved = await bagClaimService.resolveClaimToken(bagToken);
  if (resolved.state !== 'claimable') {
    throw new RegistrationError('bag_not_claimable', 'This bag cannot be claimed', {
      status: 409, state: resolved.state
    });
  }
  const { bag, affiliate } = resolved;

  const [existingEmail, existingUsername] = await Promise.all([
    Customer.findOne({ email }),
    Customer.findOne({ username })
  ]);

  if (existingEmail && existingUsername) {
    throw new RegistrationError(
      'duplicate_email_and_username',
      'Both email and username are already in use',
      { errors: { email: 'Email already registered', username: 'Username already taken' } }
    );
  }
  if (existingEmail) {
    throw new RegistrationError('duplicate_email', 'Email already registered', { field: 'email' });
  }
  if (existingUsername) {
    throw new RegistrationError('duplicate_username', 'Username already taken', { field: 'username' });
  }

  // OAuth vs traditional — OAuth skips password, auto-generates a username if absent.
  let finalUsername = username;
  let passwordSalt = null;
  let passwordHash = null;

  if (socialToken) {
    if (!username) {
      finalUsername = email.split('@')[0] + '_' + Date.now().toString(36);
    }
    logger.info(`OAuth claim registration for email: ${email}, generated username: ${finalUsername}`);
  } else {
    const { salt, hash } = encryptionUtil.hashPassword(password);
    passwordSalt = salt;
    passwordHash = hash;
  }

  const newCustomer = new Customer({
    customerId: `CUST-${uuidv4()}`,
    affiliateId: affiliate.affiliateId,   // derived from the bag
    firstName: Formatters.name(firstName),
    lastName: Formatters.name(lastName),
    email: email.toLowerCase(),
    phone: Formatters.phone(phone, 'us'),
    address,
    city,
    state: state.toUpperCase(),
    zipCode,
    specialInstructions,
    affiliateSpecialInstructions,
    username: finalUsername,
    passwordSalt,
    passwordHash,
    languagePreference: languagePreference || 'en',
    registrationMethod: socialToken ? (socialProvider || 'social') : 'traditional'
  });

  await newCustomer.save();

  // Save-then-claim with a compensating delete on race loss (spec §13 #4).
  let claimedBag;
  try {
    claimedBag = await bagClaimService.claimForCustomer(bag, newCustomer.customerId);
  } catch (err) {
    await Customer.deleteOne({ _id: newCustomer._id });
    if (err.isClaimError) {
      throw new RegistrationError('bag_already_claimed', 'This bag has already been claimed', { status: 409 });
    }
    throw err;
  }

  const token = jwt.sign(
    { id: newCustomer._id, customerId: newCustomer.customerId, role: 'customer' },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );

  // Emails are best-effort — never fail registration on SMTP hiccup.
  await sendWelcomeEmails(newCustomer, affiliate);

  return { customer: newCustomer, affiliate, bag: claimedBag, token };
}

async function sendWelcomeEmails(customer, affiliate) {
  try {
    await emailService.sendCustomerWelcomeEmail(customer, affiliate, { numberOfBags: 0, totalCredit: 0, bagFee: 0 });
  } catch (emailError) {
    logger.error('Failed to send welcome email:', emailError);
  }
  try {
    await emailService.sendAffiliateNewCustomerEmail(affiliate, customer, { numberOfBags: 0, totalCredit: 0, bagFee: 0 });
  } catch (emailError) {
    logger.error('Failed to send affiliate notification:', emailError);
  }
}

module.exports = {
  registerCustomer,
  RegistrationError
};
```

Notes: the V1 card-capture block (`savePaymentInfo`/`cardNumber`/`encryptedPaymentInfo`), `numberOfBags`/`free_initial_bags`, `Affiliate`/`SystemConfig` requires, and the `paymentConfirmed` log all go away — the claim form never sends them. If PR 1/2 already removed some of those lines, the wholesale replacement above is still correct.

- [ ] **Rework the controller.** In `server/controllers/customerController.js`, replace the existing `exports.registerCustomer = ControllerHelpers.asyncWrapper(async (req, res) => { ... });` block (starts at line 27 on current main, ends at the matching `});` around line 74 — it contains the `customerRegistrationService.registerCustomer(req.body)` call and the `affiliateData` response with `serviceArea`) with:

```javascript
/**
 * Resolve a scanned bag token into a claim-page state.
 * Public; anti-enumeration — minted/retired/unknown all map to 'invalid'.
 * @route GET /api/v1/customers/claim/:bagToken
 */
exports.resolveClaim = ControllerHelpers.asyncWrapper(async (req, res) => {
  const resolved = await bagClaimService.resolveClaimToken(req.params.bagToken);
  if (resolved.state === 'claimable') {
    const { affiliate } = resolved;
    return ControllerHelpers.sendSuccess(res, {
      state: 'claimable',
      affiliate: {
        businessName: affiliate.businessName,
        firstName: affiliate.firstName,
        lastName: affiliate.lastName,
        city: affiliate.city,
        state: affiliate.state
      }
    });
  }
  if (resolved.state === 'claimed') {
    // order slot populated by PR 9 ({ status, awaitingDelivery }); no customer PII
    return ControllerHelpers.sendSuccess(res, { state: 'claimed', order: resolved.order });
  }
  return ControllerHelpers.sendSuccess(res, { state: 'invalid' });
});

/**
 * Claim-bound customer registration — the affiliate is derived from the bag.
 * @route POST /api/v1/customers/claim/:bagToken/register
 */
exports.claimRegister = ControllerHelpers.asyncWrapper(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return ControllerHelpers.sendError(res, 'Validation failed', 400, errors.array());
  }

  try {
    const { customer, affiliate, bag, token } = await customerRegistrationService.registerCustomer({
      ...req.body,
      bagToken: req.params.bagToken
    });

    return ControllerHelpers.sendSuccess(
      res,
      {
        customerId: customer.customerId,
        token,
        bag: { bagId: bag.bagId },
        customerData: {
          firstName: customer.firstName,
          lastName: customer.lastName,
          email: customer.email,
          phone: customer.phone,
          address: customer.address,
          city: customer.city,
          state: customer.state,
          zipCode: customer.zipCode,
          affiliateId: customer.affiliateId
        },
        affiliateData: {
          businessName: affiliate.businessName,
          firstName: affiliate.firstName,
          lastName: affiliate.lastName
        }
      },
      'Customer registration successful',
      201
    );
  } catch (err) {
    if (err.isRegistrationError) {
      // Match the old response shape so frontends and tests keep working.
      const body = { success: false, message: err.message, ...err.extras };
      return res.status(err.status || 400).json(body);
    }
    throw err;
  }
});
```

Then add the service require next to the existing `customerRegistrationService` require at the top of the file:

```javascript
const bagClaimService = require('../services/bagClaimService');
```

(`ClaimError` never reaches the controller — the service converts it to a `RegistrationError`, so the existing `isRegistrationError` mapping covers it.)

- [ ] **Rework the routes.** In `server/routes/customerRoutes.js`:

1. Delete the legacy register route block (currently lines 50-76 — the `router.post('/register', conditionalRegistrationLimiter, [...])` block; if PR 2 already replaced `conditionalRegistrationLimiter` with plain `registrationLimiter`, delete that variant). Also delete the `conditionalRegistrationLimiter` helper (lines 14-24) if still present, and the now-unused `registrationAddressValidation` import name from the `locationValidation` destructure on line 12 (keep `profileAddressValidation` and `handleValidationErrors` — they're still used by the profile route).
2. Add the claim routes in its place:

```javascript
/**
 * @route   GET /api/v1/customers/claim/:bagToken
 * @desc    Resolve a scanned bag token (claimable | claimed | invalid)
 * @access  Public (rate-limited globally; anti-enumeration)
 */
router.get('/claim/:bagToken', customerController.resolveClaim);

/**
 * @route   POST /api/v1/customers/claim/:bagToken/register
 * @desc    Register a new customer against an issued bag (affiliate derived from the bag)
 * @access  Public (registrationLimiter; CSRF-exempt registration class)
 */
router.post('/claim/:bagToken/register', registrationLimiter, [
  body('firstName').notEmpty().withMessage('First name is required'),
  body('lastName').notEmpty().withMessage('Last name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('phone').notEmpty().withMessage('Phone number is required'),
  body('address').notEmpty().withMessage('Address is required'),
  body('city').notEmpty().withMessage('City is required'),
  body('state').notEmpty().withMessage('State is required'),
  body('zipCode').notEmpty().withMessage('ZIP code is required'),
  // Only require username/password if NOT using OAuth (no socialToken)
  body('username').custom((value, { req }) => {
    if (!req.body.socialToken && !value) {
      throw new Error('Username is required');
    }
    return true;
  }),
  body('password').custom((value, { req }) => {
    if (!req.body.socialToken) {
      return customPasswordValidator()(value, { req });
    }
    return true;
  })
], handleValidationErrors, customerController.claimRegister);
```

Note: NO `registrationAddressValidation` here — the claim path performs no geocoding / service-area check (spec §7, settled #8). Plain `notEmpty` validators only.

- [ ] **CSRF config.** In `server/config/csrf-config.js` `REGISTRATION_ENDPOINTS` (lines ~135-147), replace the two customer-register entries:

```javascript
    '/api/customers/register',
```
and
```javascript
    '/api/v1/customers/register',
```

with one claim entry (keep the affiliate entries and `'/api/v1/auth/customer/social/register'` as-is):

```javascript
    '/api/v1/customers/claim/:bagToken/register',
```

  > Removing the register exemptions flips `/api/v1/customers/register` to CSRF default-enforce. The "legacy route is gone" probe above still reaches the 404 handler **only because it sends `x-csrf-token`** — a tokenless probe would 403 here, not 404.

- [ ] Run the new claim tests — expect pass:

```bash
npm test -- tests/integration/customerClaim.test.js
# EXPECTED: all 10 tests pass
```

- [ ] **Commit:**

```bash
git add server/services/customerRegistrationService.js server/controllers/customerController.js server/routes/customerRoutes.js server/config/csrf-config.js tests/integration/customerClaim.test.js
git commit -m "feat(claim): bag-bound customer registration — affiliate derived from bag, compensating delete on claim race; retire legacy register route"
```

---

## Task 8 — Migrate legacy tests off `POST /api/v1/customers/register`

The legacy route is gone; four test files (current main; PR 1/2 may already have pruned some) still exercise it. Migrate them so the FULL suite is green.

**Files:**
- Modify: `tests/integration/customer.test.js`
- Modify: `tests/integration/passwordValidation.test.js`
- Modify: `tests/integration/v2-payment-flow.test.js`
- Modify: `tests/integration/v2-complete-payment-flow.test.js`
- Modify: `tests/unit/csrfConfig.test.js`

### Steps

- [ ] Find every remaining reference:

```bash
grep -rn "customers/register" tests/ server/ public/ --include='*.js' --include='*.json'
# Work through every hit below; when done, this grep must return ZERO hits
# outside of comments/docs.
```

- [ ] **`tests/integration/customer.test.js`** — the `describe('POST /api/v1/customers/register', ...)` block (starts ~line 92) and the `describe('POST /api/v1/customers/register with paymentConfirmed', ...)` block (~line 688; PR 2 may already have deleted this one). Registration behavior is now covered by `tests/integration/customerClaim.test.js`, so **delete both describes outright**. If any later test in the file registered a customer through the route to obtain a fixture, replace that setup with direct model creation:

```javascript
const customer = await Customer.create({
  customerId: 'CUST-fixture-1',
  affiliateId: affiliate.affiliateId,
  firstName: 'Fixture', lastName: 'Customer',
  email: 'fixture@example.com', phone: '512-555-0102',
  address: '1 Fixture St', city: 'Austin', state: 'TX', zipCode: '78701',
  username: 'fixturecustomer',
  passwordSalt: 'salt', passwordHash: 'hash'
});
```

- [ ] **`tests/integration/passwordValidation.test.js`** — two posts to `/api/v1/customers/register` (lines ~325 and ~382). These tests exercise the password validator, which now lives on the claim route. In the customer-registration describe's `beforeEach` (or inline before each post), mint+issue a bag and re-point the URL:

```javascript
const bagService = require('../../server/modules/bags/bagService'); // top of file

// in the test, after creating testAffiliate:
const { batchId, bags } = await bagService.mintBatch({
  affiliateId: testAffiliate.affiliateId, quantity: 1, adminId: testAffiliate._id
});
await bagService.issueBatch({ batchId, adminId: testAffiliate._id });

const response = await agent
  .post(`/api/v1/customers/claim/${bags[0].token}/register`)
  .set('x-csrf-token', csrfToken)
  .send(customerData); // DELETE the affiliateId field from customerData — derived from the bag now
```

Keep the existing assertions (400 + password error for weak; 201 for strong) unchanged. Each test needs its own issued bag (a bag claims once).

- [ ] **`tests/integration/v2-payment-flow.test.js`** (posts at lines ~90, ~622, ~661) and **`tests/integration/v2-complete-payment-flow.test.js`** (line ~102) — these use registration only as fixture setup for payment tests. Replace each `await request(app).post('/api/customers/register').send({...})` setup block with direct model creation (pattern above, unique emails/usernames per test), assigning the created doc to whatever variable the test reads (`customerId = customer.customerId;` etc.). Do NOT change the payment assertions.

- [ ] **`tests/unit/csrfConfig.test.js`** — two touchpoints:
  - line ~86: `expect(CSRF_CONFIG.REGISTRATION_ENDPOINTS).toContain('/api/customers/register');` → change to `expect(CSRF_CONFIG.REGISTRATION_ENDPOINTS).toContain('/api/v1/customers/claim/:bagToken/register');`
  - line ~178: `req.path = '/api/v1/customers/register';` → change to `req.path = '/api/v1/customers/claim/abc123/register';` (the assertion that CSRF is NOT enforced stays the same).

- [ ] Check for direct references to the removed controller export:

```bash
grep -rn "customerController.registerCustomer\|registerCustomer" tests/ server/ --include='*.js' | grep -v customerRegistrationService | grep -v claimRegister
# Fix any hit: unit tests of the old controller method should be deleted
# (behavior now covered by customerClaim.test.js); service-level callers
# were reworked in Task 7.
```

- [ ] Run the affected files, then the FULL suite:

```bash
npm test -- tests/integration/customer.test.js tests/integration/passwordValidation.test.js tests/integration/v2-payment-flow.test.js tests/integration/v2-complete-payment-flow.test.js tests/unit/csrfConfig.test.js
# EXPECTED: pass
npm test
# EXPECTED: full suite green
```

- [ ] **Commit:**

```bash
git add tests/integration/customer.test.js tests/integration/passwordValidation.test.js tests/integration/v2-payment-flow.test.js tests/integration/v2-complete-payment-flow.test.js tests/unit/csrfConfig.test.js
git commit -m "test(claim): migrate legacy customer-register tests to the bag-claim flow / direct fixtures"
```

---

## Task 9 — OAuth claim threading (`bagToken` replaces `affiliateId` on the customer social path)

How the current flow threads the affiliate (verified on main): the client opens `GET /api/v1/auth/customer/{google|facebook}?popup=true&state=<sessionId>&affiliateId=<id>` (the entry route reads only `state` — the extra param just rides along, `socialAuthRoutes.js:180-197`); after the popup completes, the client POSTs the registration body to `POST /api/v1/auth/customer/social/register`, whose validator requires `body('affiliateId')` (`socialAuthRoutes.js:284`) and whose service does `Affiliate.findOne({ affiliateId })` (`socialAuthCustomerService.js:72-75`). The bag token therefore needs exactly two server changes: the validator and the service. The entry URL needs no server change — the claim page passes `&bag=<token>` instead of `&affiliateId=`.

**Files:**
- Modify: `server/services/socialAuthCustomerService.js`
- Modify: `server/routes/socialAuthRoutes.js` (validator, line ~284)
- Modify: `tests/unit/socialAuthRoutes.test.js` (mock-app parity, lines ~140-145, ~486, ~501, ~518)
- Modify: `tests/integration/customerClaim.test.js` (add the social-register describe)

### Steps

- [ ] **Write the failing test** — append to `tests/integration/customerClaim.test.js` (sibling describe inside the top-level `describe('Customer claim', ...)`):

```javascript
  describe('POST /api/v1/auth/customer/social/register (bag-bound)', () => {
    it('400s without a bagToken (validator swapped from affiliateId)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/customer/social/register')
        .send({
          socialToken: 'whatever',
          phone: '512-555-0103', address: '1 Oauth St', city: 'Austin',
          state: 'TX', zipCode: '78701', serviceFrequency: 'weekly'
        });
      expect(res.status).toBe(400);
      expect(res.body.errors.some((e) => e.msg === 'Bag token is required')).toBe(true);
      expect(res.body.errors.some((e) => e.msg === 'Affiliate ID is required')).toBe(false);
    });

    it('409s a non-claimable bag before any customer is created', async () => {
      const { bags } = await bagService.mintBatch({
        affiliateId: affiliate.affiliateId, quantity: 1, adminId: affiliate._id
      }); // minted, NOT issued
      const res = await request(app)
        .post('/api/v1/auth/customer/social/register')
        .send({
          socialToken: 'not-a-real-token',
          bagToken: bags[0].token,
          phone: '512-555-0103', address: '1 Oauth St', city: 'Austin',
          state: 'TX', zipCode: '78701', serviceFrequency: 'weekly'
        });
      // invalid socialToken short-circuits at 400/401 OR bag check at 409 —
      // assert the legacy invalid_affiliate message is gone either way:
      expect([400, 401, 409]).toContain(res.status);
      expect(res.body.message || '').not.toMatch(/Invalid affiliate ID/);
      expect(await Customer.countDocuments({})).toBe(0);
    });
  });
```

- [ ] Run it — expect failure for the right reason:

```bash
npm test -- tests/integration/customerClaim.test.js
# EXPECTED: first new test fails — the validator still answers
# "Affiliate ID is required".
```

- [ ] **Swap the validator.** In `server/routes/socialAuthRoutes.js`, the customer social-register validator (line ~284):

```javascript
  body('affiliateId').notEmpty().withMessage('Affiliate ID is required'),
```

becomes:

```javascript
  body('bagToken').notEmpty().withMessage('Bag token is required'),
```

- [ ] **Rework the service.** In `server/services/socialAuthCustomerService.js`:

1. Destructure swap (line 42):

```javascript
  const { socialToken, affiliateId, ...rest } = payload;
```
→
```javascript
  const { socialToken, bagToken, ...rest } = payload;
```

2. Replace the affiliate lookup (lines 72-75):

```javascript
  const affiliate = await Affiliate.findOne({ affiliateId });
  if (!affiliate) {
    throw new SocialAuthCustomerError('invalid_affiliate', 'Invalid affiliate ID');
  }
```
→
```javascript
  // Server-trust: the affiliate comes from the bag, never the payload (spec §6.3).
  const resolved = await bagClaimService.resolveClaimToken(bagToken);
  if (resolved.state !== 'claimable') {
    throw new SocialAuthCustomerError('bag_not_claimable', 'This bag cannot be claimed', 409);
  }
  const { bag, affiliate } = resolved;
```

3. In the `new Customer({...})` literal (line ~80), change `affiliateId,` to `affiliateId: affiliate.affiliateId,`.

4. After `await customer.save();` (line 109), insert the save-then-claim with compensating delete, mirroring `customerRegistrationService`:

```javascript
  await customer.save();

  // Save-then-claim with a compensating delete on race loss (spec §13 #4).
  try {
    await bagClaimService.claimForCustomer(bag, customer.customerId);
  } catch (claimErr) {
    await Customer.deleteOne({ _id: customer._id });
    if (claimErr.isClaimError) {
      throw new SocialAuthCustomerError('bag_already_claimed', 'This bag has already been claimed', 409);
    }
    throw claimErr;
  }
```

5. Replace the now-unused `Affiliate` require (line 10) with the claim service:

```javascript
const Affiliate = require('../models/Affiliate');
```
→
```javascript
const bagClaimService = require('./bagClaimService');
```

(Verify with `grep -n "Affiliate" server/services/socialAuthCustomerService.js` that no other use remains; if one does, keep both requires.)

- [ ] **Mock-app parity.** `tests/unit/socialAuthRoutes.test.js` stubs its own express app duplicating the validator (line ~140: `const requiredFields = ['socialToken', 'affiliateId', 'phone', ...]`, line ~145: the `'Affiliate ID'` label, and the request bodies at lines ~486, ~501-assertions, ~518). Update for parity: `'affiliateId'` → `'bagToken'` in the `requiredFields` array; the label branch `field === 'affiliateId' ? 'Affiliate ID'` → `field === 'bagToken' ? 'Bag token'`; request bodies `affiliateId: 'AFF123'` → `bagToken: 'a'.repeat(32)`; the assertion `err.msg === 'Affiliate ID is required'` → `err.msg === 'Bag token is required'`.

- [ ] Run — expect pass:

```bash
npm test -- tests/integration/customerClaim.test.js tests/unit/socialAuthRoutes.test.js tests/integration/socialAuth.test.js
# EXPECTED: pass
```

- [ ] **Commit:**

```bash
git add server/services/socialAuthCustomerService.js server/routes/socialAuthRoutes.js tests/unit/socialAuthRoutes.test.js tests/integration/customerClaim.test.js
git commit -m "feat(claim): thread bagToken through customer OAuth registration (replaces affiliateId)"
```

---

## Task 10 — Frontend `/claim` page + router wiring + i18n (4 langs)

**Files:**
- Create: `public/claim-embed.html`
- Create: `public/assets/js/claim.js`
- Create: `public/assets/css/claim.css`
- Modify: `public/assets/js/embed-app-v2.js` (`EMBED_PAGES` ~line 40, `excludedRoutes` ~line 494, `pageScripts` ~line 585)
- Modify: `public/locales/en/common.json`, `public/locales/es/common.json`, `public/locales/pt/common.json`, `public/locales/de/common.json`
- Create: `tests/unit/claimPageWiring.test.js`

### Steps

- [ ] **Write the failing wiring test** — create `tests/unit/claimPageWiring.test.js` (static-analysis guard for PITFALLS #3 — a page registered in only one map breaks via the other access path):

```javascript
// /claim page wiring — both router maps + excludedRoutes + i18n parity
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const routerSrc = fs.readFileSync(path.join(ROOT, 'public/assets/js/embed-app-v2.js'), 'utf8');

describe('/claim page wiring', () => {
  it('is registered in EMBED_PAGES', () => {
    expect(routerSrc).toMatch(/'\/claim':\s*'\/claim-embed\.html'/);
  });

  it('is registered in pageScripts with claim.js last', () => {
    const m = routerSrc.match(/'\/claim':\s*\[([^\]]+)\]/);
    expect(m).not.toBeNull();
    expect(m[1]).toContain('/assets/js/claim.js');
  });

  it('is in excludedRoutes (requires a ?bag= parameter, never persisted)', () => {
    const m = routerSrc.match(/const excludedRoutes = \[([\s\S]*?)\]/);
    expect(m).not.toBeNull();
    expect(m[1]).toContain("'/claim'");
  });

  it('claim-embed.html exists, is CSP-clean, and references claim assets', () => {
    const html = fs.readFileSync(path.join(ROOT, 'public/claim-embed.html'), 'utf8');
    expect(html).toContain('/assets/css/claim.css');
    expect(html).not.toMatch(/ style="/i);
    expect(html).not.toMatch(/onclick=/i);
    expect(html).toContain('data-i18n="claim.title"');
  });

  it('ships claim.* and bag.label.* keys in all four languages', () => {
    const langs = ['en', 'es', 'pt', 'de'];
    const required = [
      'title', 'subtitle', 'resolving', 'cta', 'ctaOAuthGoogle', 'ctaOAuthFacebook',
      'alreadyClaimedTitle', 'alreadyClaimedBody', 'alreadyClaimedCta',
      'invalidTitle', 'invalidBody', 'raceLost'
    ];
    for (const lang of langs) {
      const dict = JSON.parse(fs.readFileSync(
        path.join(ROOT, `public/locales/${lang}/common.json`), 'utf8'));
      for (const key of required) {
        expect(`${lang}:claim.${key}=${dict.claim && dict.claim[key]}`)
          .toMatch(new RegExp(`^${lang}:claim\\.${key}=.+`)); // present + non-empty
      }
      for (const key of ['affiliateHeading', 'bagRef', 'printInstructions']) {
        expect(`${lang}:bag.label.${key}=${dict.bag && dict.bag.label && dict.bag.label[key]}`)
          .toMatch(new RegExp(`^${lang}:bag\\.label\\.${key}=.+`));
      }
    }
  });
});
```

- [ ] Run it — expect failure for the right reason:

```bash
npm test -- tests/unit/claimPageWiring.test.js
# EXPECTED: all 5 tests fail — '/claim' not in any map, files missing, keys missing.
```

- [ ] **Create `public/claim-embed.html`** (strict CSP: zero inline script/style; state sections toggled by `claim.js` via the `hidden` attribute):

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WaveMAX Laundry - Claim Your Bag</title>

    <!-- External Stylesheets -->
    <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2/dist/tailwind.min.css" rel="stylesheet">
    <link rel="stylesheet" href="/assets/css/language-switcher.css">
    <link href="/assets/css/theme.css" rel="stylesheet">
    <link href="/assets/css/claim.css" rel="stylesheet">
</head>
<body class="bg-white font-sans">
    <div id="language-switcher-container" class="language-switcher-container"></div>

    <div class="embed-container">
        <div class="max-w-md mx-auto bg-white rounded-lg shadow-md overflow-hidden">

            <!-- STATE: resolving -->
            <section id="claim-state-resolving" class="p-6 text-center">
                <p class="text-gray-600" data-i18n="claim.resolving">Checking your bag...</p>
            </section>

            <!-- STATE: claimable (registration form) -->
            <section id="claim-state-claimable" hidden>
                <div class="wavemax-blue text-white p-6">
                    <h1 class="text-2xl font-bold" data-i18n="claim.title">Claim your laundry bag</h1>
                    <p class="mt-2">
                        <span data-i18n="claim.subtitle">You're signing up with</span>
                        <strong id="claim-affiliate-name"></strong>
                    </p>
                </div>
                <div class="p-6">
                    <div class="grid grid-cols-2 gap-3 mb-6">
                        <button type="button" id="claimOAuthGoogle" class="claim-oauth-btn" data-i18n="claim.ctaOAuthGoogle">Sign up with Google</button>
                        <button type="button" id="claimOAuthFacebook" class="claim-oauth-btn" data-i18n="claim.ctaOAuthFacebook">Sign up with Facebook</button>
                    </div>
                    <form id="claimRegistrationForm" novalidate>
                        <div class="grid grid-cols-2 gap-3">
                            <input type="text" id="firstName" name="firstName" required class="claim-input" data-i18n-placeholder="common.labels.firstName" placeholder="First Name">
                            <input type="text" id="lastName" name="lastName" required class="claim-input" data-i18n-placeholder="common.labels.lastName" placeholder="Last Name">
                        </div>
                        <input type="email" id="email" name="email" required class="claim-input" data-i18n-placeholder="common.labels.email" placeholder="Email">
                        <input type="tel" id="phone" name="phone" required class="claim-input" data-i18n-placeholder="common.labels.phoneNumber" placeholder="Phone Number">
                        <input type="text" id="address" name="address" required class="claim-input" data-i18n-placeholder="common.labels.address" placeholder="Address">
                        <div class="grid grid-cols-3 gap-3">
                            <input type="text" id="city" name="city" required class="claim-input" data-i18n-placeholder="common.labels.city" placeholder="City">
                            <input type="text" id="state" name="state" required maxlength="2" class="claim-input" data-i18n-placeholder="common.labels.state" placeholder="State">
                            <input type="text" id="zipCode" name="zipCode" required class="claim-input" data-i18n-placeholder="common.labels.zipCode" placeholder="Zip Code">
                        </div>
                        <div id="claim-credentials">
                            <input type="text" id="username" name="username" required autocomplete="username" class="claim-input" data-i18n-placeholder="common.labels.username" placeholder="Username">
                            <input type="password" id="password" name="password" required autocomplete="new-password" class="claim-input" data-i18n-placeholder="common.labels.password" placeholder="Password">
                        </div>
                        <p id="claim-form-error" class="claim-error" hidden></p>
                        <button type="submit" id="claimSubmit" class="claim-submit" data-i18n="claim.cta">Create my account</button>
                    </form>
                </div>
            </section>

            <!-- STATE: claimed (already linked to an account) -->
            <section id="claim-state-claimed" class="p-6 text-center" hidden>
                <h1 class="text-2xl font-bold mb-2" data-i18n="claim.alreadyClaimedTitle">This bag is already claimed</h1>
                <p class="text-gray-600 mb-4" data-i18n="claim.alreadyClaimedBody">This bag is linked to an existing account. Log in to see your order status.</p>
                <!-- PR 9 adds the deliver / re-intake panels into this section -->
                <a id="claim-login-link" href="/embed-app-v2.html?route=/customer-login" class="claim-submit inline-block" data-i18n="claim.alreadyClaimedCta">Log in</a>
            </section>

            <!-- STATE: invalid -->
            <section id="claim-state-invalid" class="p-6 text-center" hidden>
                <h1 class="text-2xl font-bold mb-2" data-i18n="claim.invalidTitle">Bag not recognized</h1>
                <p class="text-gray-600" data-i18n="claim.invalidBody">We couldn't recognize this bag. Please contact your laundry service provider.</p>
            </section>

        </div>
    </div>
</body>
</html>
```

- [ ] **Create `public/assets/css/claim.css`:**

```css
/* /claim page — strict CSP, no inline styles. */
.claim-input {
  width: 100%;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  padding: 10px 12px;
  margin-bottom: 12px;
  font-size: 15px;
}
.claim-input:focus { outline: 2px solid #2563eb; outline-offset: 1px; }

.claim-oauth-btn {
  border: 1px solid #d1d5db;
  border-radius: 6px;
  padding: 10px 8px;
  font-size: 14px;
  background: #f9fafb;
  cursor: pointer;
}
.claim-oauth-btn:hover { background: #f3f4f6; }

.claim-submit {
  width: 100%;
  background: #1e3a5f;
  color: #ffffff;
  border: none;
  border-radius: 6px;
  padding: 12px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  text-align: center;
  text-decoration: none;
}
.claim-submit:hover { background: #16304f; }
.claim-submit[disabled] { opacity: 0.6; cursor: not-allowed; }

.claim-error {
  color: #b91c1c;
  font-size: 14px;
  margin: 0 0 12px;
}
```

- [ ] **Create `public/assets/js/claim.js`** — the state-machine skeleton. PR 9 extends the `switch` in `renderState` with `deliver` / `reintake` branches; keep that switch the single dispatch point:

```javascript
// /claim — bag claim page (spec §6.3).
// State machine: resolving | claimable | claimed | invalid.
// PR 9 adds 'deliver' and 'reintake' branches to renderState's switch —
// do not dispatch state anywhere else.
(function () {
  'use strict';

  var bagToken = new URLSearchParams(window.location.search).get('bag');
  var oauth = { socialToken: null, provider: null };

  var SECTIONS = ['resolving', 'claimable', 'claimed', 'invalid'];

  function show(state) {
    SECTIONS.forEach(function (name) {
      var el = document.getElementById('claim-state-' + name);
      if (el) el.hidden = (name !== state);
    });
  }

  function renderState(state, data) {
    switch (state) {
      case 'claimable': {
        var affiliate = (data && data.affiliate) || {};
        var name = affiliate.businessName ||
          ((affiliate.firstName || '') + ' ' + (affiliate.lastName || '')).trim() || 'WaveMAX';
        // textContent — never innerHTML (XSS)
        document.getElementById('claim-affiliate-name').textContent = name;
        show('claimable');
        break;
      }
      case 'claimed':
        // PR 9: branch on data.order.awaitingDelivery -> 'deliver' panel here.
        show('claimed');
        break;
      case 'invalid':
      default:
        show('invalid');
        break;
    }
  }

  function showFormError(message) {
    var el = document.getElementById('claim-form-error');
    el.textContent = message;
    el.hidden = false;
  }

  function resolveBag() {
    if (!bagToken) { renderState('invalid'); return; }
    fetch('/api/v1/customers/claim/' + encodeURIComponent(bagToken))
      .then(function (res) { return res.json(); })
      .then(function (body) { renderState(body.state, body); })
      .catch(function () { renderState('invalid'); });
  }

  function submitRegistration(event) {
    event.preventDefault();
    var form = document.getElementById('claimRegistrationForm');
    var submit = document.getElementById('claimSubmit');
    submit.disabled = true;

    var payload = {
      firstName: form.firstName.value.trim(),
      lastName: form.lastName.value.trim(),
      email: form.email.value.trim(),
      phone: form.phone.value.trim(),
      address: form.address.value.trim(),
      city: form.city.value.trim(),
      state: form.state.value.trim(),
      zipCode: form.zipCode.value.trim(),
      languagePreference: localStorage.getItem('selectedLanguage') || 'en'
    };
    if (oauth.socialToken) {
      payload.socialToken = oauth.socialToken;
      payload.socialProvider = oauth.provider;
    } else {
      payload.username = form.username.value.trim();
      payload.password = form.password.value;
    }

    fetch('/api/v1/customers/claim/' + encodeURIComponent(bagToken) + '/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(function (res) { return res.json().then(function (body) { return { status: res.status, body: body }; }); })
      .then(function (result) {
        if (result.status === 201) {
          localStorage.setItem('customerToken', result.body.token);
          localStorage.setItem('currentCustomer', JSON.stringify(result.body.customerData));
          window.location.href = '/embed-app-v2.html?route=/customer-dashboard';
          return;
        }
        submit.disabled = false;
        if (result.status === 409) {
          var raceMsg = (window.i18n && window.i18n.translate('claim.raceLost')) ||
            'Someone just claimed this bag. If that was you on another device, please log in.';
          showFormError(raceMsg);
          return;
        }
        var msg = result.body.message || 'Registration failed';
        if (result.body.errors && result.body.errors.length) {
          msg = result.body.errors.map(function (e) { return e.msg; }).join(' ');
        }
        showFormError(msg);
      })
      .catch(function () {
        submit.disabled = false;
        showFormError('Network error — please try again.');
      });
  }

  function startOAuth(provider) {
    var sessionId = 'oauth_claim_' + Date.now() + '_' + Math.random().toString(36).substring(2);
    var url = '/api/v1/auth/customer/' + provider +
      '?popup=true&state=' + sessionId + '&bag=' + encodeURIComponent(bagToken) + '&t=' + Date.now();
    var popup = window.open(url, 'claimSocialAuth', 'width=500,height=600,scrollbars=yes,resizable=yes');
    if (!popup || popup.closed) {
      showFormError('Popup was blocked. Please allow popups and try again.');
      return;
    }
    var polls = 0;
    var timer = setInterval(function () {
      polls++;
      if (polls > 20) { clearInterval(timer); return; }
      fetch('/api/v1/auth/oauth/result/' + sessionId)
        .then(function (res) { return res.json(); })
        .then(function (result) {
          if (!result.completed) return;
          clearInterval(timer);
          try { if (popup && !popup.closed) popup.close(); } catch (e) { /* noop */ }
          if (!result.success) { showFormError(result.message || 'Authentication failed.'); return; }
          var data = result.data || {};
          oauth.socialToken = data.socialToken;
          oauth.provider = provider;
          if (data.email) { document.getElementById('email').value = data.email; }
          if (data.firstName) { document.getElementById('firstName').value = data.firstName; }
          if (data.lastName) { document.getElementById('lastName').value = data.lastName; }
          // OAuth authenticates — hide username/password
          document.getElementById('claim-credentials').hidden = true;
          document.getElementById('username').removeAttribute('required');
          document.getElementById('password').removeAttribute('required');
        })
        .catch(function () { /* keep polling */ });
    }, 3000);
  }

  function init() {
    document.getElementById('claimRegistrationForm')
      .addEventListener('submit', submitRegistration);
    document.getElementById('claimOAuthGoogle')
      .addEventListener('click', function () { startOAuth('google'); });
    document.getElementById('claimOAuthFacebook')
      .addEventListener('click', function () { startOAuth('facebook'); });
    var login = document.getElementById('claim-login-link');
    if (login) login.href = '/embed-app-v2.html?route=/customer-login';
    resolveBag();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
```

- [ ] **Register the route in `public/assets/js/embed-app-v2.js`** — three places (PITFALLS #3):

1. `EMBED_PAGES` (~line 40): after the line `'/customer-register': '/customer-register-embed.html',` add:

```javascript
    '/claim': '/claim-embed.html',
```

2. `excludedRoutes` (~line 494): after `'/customer-register',  // Entry point that may have affiliate ID` add:

```javascript
            '/claim',              // Requires a ?bag= token parameter
```

3. `pageScripts` (~line 585): after the `'/customer-register': [...]` entry add:

```javascript
        '/claim': ['/assets/js/i18n.js', '/assets/js/language-switcher.js', '/assets/js/claim.js'],
```

- [ ] **Add the i18n keys.** In each of the four `public/locales/{lang}/common.json` files, add two new **top-level** objects (sibling of `"common"` — e.g. insert immediately after the opening `{`). Validate JSON after editing (`python3 -m json.tool < public/locales/en/common.json > /dev/null`).

`public/locales/en/common.json`:

```json
  "claim": {
    "title": "Claim your laundry bag",
    "subtitle": "You're signing up with",
    "resolving": "Checking your bag...",
    "cta": "Create my account",
    "ctaOAuthGoogle": "Sign up with Google",
    "ctaOAuthFacebook": "Sign up with Facebook",
    "alreadyClaimedTitle": "This bag is already claimed",
    "alreadyClaimedBody": "This bag is linked to an existing account. Log in to see your order status.",
    "alreadyClaimedCta": "Log in",
    "invalidTitle": "Bag not recognized",
    "invalidBody": "We couldn't recognize this bag. Please contact your laundry service provider.",
    "raceLost": "Someone just claimed this bag. If that was you on another device, please log in."
  },
  "bag": {
    "label": {
      "affiliateHeading": "WaveMAX Laundry Pickup & Delivery",
      "bagRef": "Bag ref",
      "printInstructions": "Print this sheet, cut along the lines, and attach one label to each bag."
    }
  },
```

`public/locales/es/common.json`:

```json
  "claim": {
    "title": "Reclama tu bolsa de lavandería",
    "subtitle": "Te estás registrando con",
    "resolving": "Verificando tu bolsa...",
    "cta": "Crear mi cuenta",
    "ctaOAuthGoogle": "Registrarse con Google",
    "ctaOAuthFacebook": "Registrarse con Facebook",
    "alreadyClaimedTitle": "Esta bolsa ya está reclamada",
    "alreadyClaimedBody": "Esta bolsa está vinculada a una cuenta existente. Inicia sesión para ver el estado de tu pedido.",
    "alreadyClaimedCta": "Iniciar sesión",
    "invalidTitle": "Bolsa no reconocida",
    "invalidBody": "No pudimos reconocer esta bolsa. Comunícate con tu proveedor de servicio de lavandería.",
    "raceLost": "Alguien acaba de reclamar esta bolsa. Si fuiste tú en otro dispositivo, inicia sesión."
  },
  "bag": {
    "label": {
      "affiliateHeading": "WaveMAX Lavandería: Recogida y Entrega",
      "bagRef": "Ref. de bolsa",
      "printInstructions": "Imprime esta hoja, recorta por las líneas y coloca una etiqueta en cada bolsa."
    }
  },
```

`public/locales/pt/common.json`:

```json
  "claim": {
    "title": "Resgate sua sacola de lavanderia",
    "subtitle": "Você está se cadastrando com",
    "resolving": "Verificando sua sacola...",
    "cta": "Criar minha conta",
    "ctaOAuthGoogle": "Cadastrar com Google",
    "ctaOAuthFacebook": "Cadastrar com Facebook",
    "alreadyClaimedTitle": "Esta sacola já foi resgatada",
    "alreadyClaimedBody": "Esta sacola está vinculada a uma conta existente. Faça login para ver o status do seu pedido.",
    "alreadyClaimedCta": "Entrar",
    "invalidTitle": "Sacola não reconhecida",
    "invalidBody": "Não foi possível reconhecer esta sacola. Entre em contato com seu provedor de serviço de lavanderia.",
    "raceLost": "Alguém acabou de resgatar esta sacola. Se foi você em outro dispositivo, faça login."
  },
  "bag": {
    "label": {
      "affiliateHeading": "WaveMAX Lavanderia: Coleta e Entrega",
      "bagRef": "Ref. da sacola",
      "printInstructions": "Imprima esta folha, recorte pelas linhas e fixe uma etiqueta em cada sacola."
    }
  },
```

`public/locales/de/common.json`:

```json
  "claim": {
    "title": "Wäschebeutel registrieren",
    "subtitle": "Sie registrieren sich bei",
    "resolving": "Beutel wird überprüft...",
    "cta": "Konto erstellen",
    "ctaOAuthGoogle": "Mit Google registrieren",
    "ctaOAuthFacebook": "Mit Facebook registrieren",
    "alreadyClaimedTitle": "Dieser Beutel ist bereits registriert",
    "alreadyClaimedBody": "Dieser Beutel ist mit einem bestehenden Konto verknüpft. Melden Sie sich an, um Ihren Bestellstatus zu sehen.",
    "alreadyClaimedCta": "Anmelden",
    "invalidTitle": "Beutel nicht erkannt",
    "invalidBody": "Wir konnten diesen Beutel nicht erkennen. Bitte wenden Sie sich an Ihren Wäscheservice-Anbieter.",
    "raceLost": "Jemand hat diesen Beutel gerade registriert. Falls Sie das auf einem anderen Gerät waren, melden Sie sich bitte an."
  },
  "bag": {
    "label": {
      "affiliateHeading": "WaveMAX Wäscherei: Abholung & Lieferung",
      "bagRef": "Beutel-Ref.",
      "printInstructions": "Drucken Sie dieses Blatt, schneiden Sie entlang der Linien und bringen Sie an jedem Beutel ein Etikett an."
    }
  },
```

- [ ] Run the wiring test — expect pass:

```bash
npm test -- tests/unit/claimPageWiring.test.js
# EXPECTED: all 5 tests pass
```

- [ ] **Commit:**

```bash
git add public/claim-embed.html public/assets/js/claim.js public/assets/css/claim.css public/assets/js/embed-app-v2.js public/locales/en/common.json public/locales/es/common.json public/locales/pt/common.json public/locales/de/common.json tests/unit/claimPageWiring.test.js
git commit -m "feat(claim): /claim page state-machine skeleton (resolving|claimable|claimed|invalid) + router wiring + en/es/pt/de copy"
```

---

## Verification

- [ ] **Full suite green:**

```bash
npm test
# EXPECTED: 0 failures. New files passing: tests/unit/models/Bag.test.js,
# tests/unit/bags/bagService.test.js, tests/unit/bags/labelSheetService.test.js,
# tests/integration/bags.test.js, tests/unit/bagClaimService.test.js,
# tests/integration/customerClaim.test.js, tests/unit/claimPageWiring.test.js.
```

- [ ] **Lint + cycles:**

```bash
npx eslint server/modules/bags server/services/bagClaimService.js server/routes/bagRoutes.js public/assets/js/claim.js
# EXPECTED: clean (no console.* in server/)
npx madge --circular server/
# EXPECTED: "No circular dependency found!"
```

- [ ] **Dangling-reference sweep:**

```bash
grep -rn "customers/register" server/ public/ tests/ --include='*.js' | grep -v "claim"
# EXPECTED: zero hits (comments/docs excepted)
grep -rn "affiliateId.*social/register\|social/register.*affiliateId" server/routes/
# EXPECTED: zero hits
```

- [ ] **Manual smoke (dev server `npm run dev`, then):**

```bash
# 1. Mint (admin JWT + CSRF via your REST client): POST /api/v1/bags/mint
#    { "affiliateId": "<AFF-id>", "quantity": 2 }  -> 201 with 2 raw tokens
# 2. Open /api/v1/bags/batch/<batchId>/labels in a browser as the admin —
#    grid of QR labels renders; print preview paginates without splitting cells.
# 3. POST /api/v1/bags/batch/<batchId>/issue -> 200 { issued: 2 }
# 4. curl -s http://localhost:3000/api/v1/bags/resolve/<token>  -> outcome 'unclaimed' + affiliate name
# 5. Open http://localhost:3000/embed-app-v2.html?route=/claim&bag=<token> —
#    form shows the affiliate name; register; lands on customer dashboard.
# 6. Re-open the same URL -> "already claimed" state with login CTA.
# 7. curl an unknown token on both resolve endpoints -> generic invalid (no oracle).
```

- [ ] **Do NOT push** — hand the branch back for review.

### PR description

```
PR 6/11 — Bag model, mint/issue/labels, customer claim

Implements spec §4.1 + §6.1 + §6.3 (docs/superpowers/specs/2026-06-08-invite-bag-workflow-redesign-design.md):

- Durable `Bag` entity (server/modules/bags/Bag.js): opaque 32-hex token,
  HMAC-SHA256 tokenHash as the unique lookup key, lifecycle
  minted -> issued -> active (claim is issued-only, atomic).
- bagService: mintBatch (bag_mint_max_batch bound, insertMany ordered:false
  + E11000 regenerate-retry), issueBatch, resolveByToken (anti-enumeration),
  claim, linkToOrderAtIntake (PR 7 contract), getInventory (no token leakage).
- Printable label sheets (text/html, @media print grid, QR = full claim URL,
  CSP-clean, external stylesheet) at GET /api/v1/bags/batch/:batchId/labels.
- /api/v1/bags routes: mint/labels/issue (administrator + manage_affiliates,
  CSRF), public rate-limited resolve, role-scoped inventory.
- Customer claim flow: GET/POST /api/v1/customers/claim/:bagToken[/register];
  registerCustomer reworked to derive the affiliate from the bag
  (server-trust), save-then-claim with compensating Customer.deleteOne on
  race loss. Legacy POST /api/v1/customers/register removed.
- OAuth customer registration threads bagToken (validator + service swap).
- /claim page (state machine: resolving|claimable|claimed|invalid — PR 9
  extends with deliver/re-intake), registered in EMBED_PAGES + pageScripts +
  excludedRoutes; en/es/pt/de copy in the same change.
- Audit: BAG_MINTED / BAG_ISSUED / BAG_CLAIMED.

Contract notes for PR 7/9: linkToOrderAtIntake returns {bag, customerId,
affiliateId} and throws BagError('bag_not_active',409); open-order checks
must exclude ['delivered','cancelled'] (cancel never blocks re-intake; the
bag stays 'active' on cancel). resolve/claim responses carry a designed
`order` slot returned as null until PR 7/9 populate it.

Tests: model/service/claim-service unit suites, bags + customerClaim
integration suites (RBAC matrix, CSRF, anti-enumeration, claim race,
compensating delete), page-wiring/i18n-parity static guard. Full suite green.
```



