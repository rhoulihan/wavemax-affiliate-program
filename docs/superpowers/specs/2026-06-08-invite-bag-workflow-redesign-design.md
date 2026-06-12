# Invite-Only Onboarding + Durable Bags + Order-at-Intake Workflow Redesign — Design

**Status:** Final — review findings applied; ready for build — 2026-06-08
**Owner:** Lead architect (assembled from 7 section drafts; reconciled against the codebase per review)
**Scope:** Clean-slate redeploy. Production data is **not** preserved, so no data migration is required — code is replaced rather than migrated. V1 Paygistix is deleted, not retired.

---

## 1. Summary

This redesign inverts three core assumptions of the current WaveMAX affiliate platform. First, affiliate onboarding moves from a public beta-request gate to **admin-minted, single-use, expiring invite links**, with the affiliate uploading a completed **W-9 file** (encrypted at rest) during invited registration. Second, the customer↔affiliate relationship is established by **scanning a durable, reusable bag's QR code** — a standalone `Bag` entity whose opaque token is printed once and lives forever — replacing the affiliate-referral URL. Third, **orders are created at store intake** by the operator (scan + weigh + enter add-ons), not by the customer scheduling a pickup; there is no scheduling and no "Pickup Now." The order lifecycle becomes `in_progress → processed → ready_for_pickup → picked_up → delivered`, where `ready_for_pickup` is **gated on both processing-complete AND payment-verified**, a processed-but-unpaid bag is **held at the store**, payment reminders fire hourly up to 8 attempts before a "come to the store" notice (no auto-cancel), the operator scans the bag **out** of the store, and the affiliate scans the bag **at the customer's door** to confirm delivery. The working V2 payment stack (links/QR, IMAP scanner, verification job), the operator 3-stage scanner, and the email dispatcher are reused and re-pointed; V1 Paygistix, schedule-pickup, Pickup Now, and BetaRequest are removed.

---

## 2. Goals & Non-Goals

### Goals

- **Invite-only affiliates.** Replace the `BetaRequest` boolean gate with admin-minted, single-use, expiring, tokenized invite links delivered by email.
- **W-9 on file.** Affiliate uploads a completed W-9 (PDF/JPEG/PNG) during invited registration; stored AES-256-GCM encrypted in shared storage; admin reviews/verifies; integrates with the existing `affiliatePaymentLockService` payment lock.
- **Durable reusable bags.** A standalone `Bag` entity: one QR printed once per physical bag, lives forever. Admin mints per-affiliate batches → printable label sheet (QR + affiliate name). Lifecycle `minted → issued → active → retired`.
- **One bag = one order.** Each store intake of a bag spawns exactly one order.
- **No customer scheduling.** The order is created at store intake when the operator scans + weighs the bag. Remove schedule-pickup and "Pickup Now."
- **QR-driven customer claim.** Scanning an unclaimed bag QR → registration form pre-bound to that bag + its affiliate; on submit the bag becomes `active` and links customer↔affiliate. Scanning a claimed bag → that customer's login/status.
- **Operator intake creates the order.** Scan bag → weigh → enter add-ons (from the paper form) → acknowledge a fresh add-ons form placed in the pocket → create order (`in_progress`) → email payment notice to customer.
- **Gated readiness.** `ready_for_pickup` only when **processed AND payment verified**. A processed-but-unpaid bag stays at the store.
- **Hourly reminders, capped.** Payment reminder every 60 minutes, max 8 attempts (~8h); then a "come to the store to retrieve your laundry" notice, reminders stop, order stays held + payment flagged escalated (never auto-cancelled/failed).
- **Split scan roles.** Operator scans the finished bag **out** of the store (→ `picked_up`). Affiliate scans the bag's QR at the customer's **door** and confirms (→ `delivered`). Build the new affiliate delivery-scan surface (affiliates have no scanner today).
- **Reuse the working V2 stack.** `paymentLinkService`, `paymentEmailScanner`/`imapEmailScanner`, `paymentVerificationJob` (retuned), the operator 3-stage scanner (re-pointed), and the email dispatcher/template system.
- **Quality bar maintained.** All four languages for new copy; strict nonce-based CSP; RBAC on every new endpoint; Lighthouse target on new public pages.

### Non-Goals

- **No data migration.** Clean-slate redeploy; existing production data is discarded.
- **Bag reassign / retire automation.** Schema hooks are reserved (`reassignmentHistory`, `retiredAt/By/Reason`) but no admin reassign/retire logic is built this phase.
- **More than one bag per customer.** Launch is **one bag per customer**; a returning customer who scans a new bag gets `duplicate_email`. Multi-bag-per-account linking is out of scope for now.
- **Photo proof-of-delivery.** `proofOfDelivery.photoKey` hook is reserved; optional geo ships, photo capture is deferred.
- **Hard PDF generation for label sheets.** Print-styled HTML (browser "Save as PDF") ships; a headless PDF renderer is a future hook.
- **Public self-serve customer registration.** The `?affid` referral funnel is removed. The QR claim is the only customer-onboarding path at launch. An admin-only manual-create endpoint (`POST /api/v1/administrators/customers`) for at-the-door / lost-QR recovery is a **scope addition beyond the 14 agreed decisions** — Future, pending product sign-off, not in the API table (§13).

---

## 3. End-to-End Workflow Narrative

```
Admin mints invite (single-use, expiring) ──► email link to prospective affiliate
   └─► Affiliate opens invite link ──► registration form (email locked, prefill)
         └─► uploads completed W-9 (PDF/JPG/PNG) ──► stored encrypted, w9Status=pending_review
               └─► invite consumed atomically (single-use) ──► Affiliate created
   └─► Admin reviews W-9 ──► verify (w9Status=on_file) | reject (re-upload loop)

Admin mints a per-affiliate BATCH of durable bags ──► printable label sheet (QR + affiliate name)
   └─► Admin marks batch ISSUED to affiliate ──► bags handed to the affiliate (status: issued)

Customer scans an UNCLAIMED bag QR (phone camera, no app)
   └─► /claim?bag=<token> ──► resolve token ──► registration form pre-bound to bag + affiliate
         └─► submit ──► create Customer (affiliateId derived server-side from the bag)
               └─► atomic claim ──► bag status: issued → active, customerId+affiliateId linked
   (scanning an ALREADY-CLAIMED bag ──► route that customer to login / status)

Affiliate handles pickup/delivery (their own route/scheduling) ──► collects whatever full bags are out (no in-app scheduling, no service-area check)
   └─► drops bags at the store

Operator INTAKE: scan bag ──► weigh ──► enter add-ons (paper form) ──► ack fresh form in pocket
   └─► CREATE exactly ONE order (status: in_progress) ──► compute pricing
         └─► generate payment links/QR ONCE ──► paymentStatus=awaiting ──► email payment request

Payment: IMAP scanner detects payment ──► paymentStatus=verified
   └─► reminders every 60 min, max 8 ──► then "come to store" notice once, paymentEscalated, held
WDF processing: operator scans bag processed ──► status: processed (held if unpaid)

GATE: ready_for_pickup  IFF  (status would be processed)  AND  (paymentStatus === verified)
   └─► notify affiliate "collect from store"

Operator scans the finished bag OUT of the store ──► status: picked_up ──► "on the way" email to customer
Affiliate scans the bag QR at the customer's DOOR (native camera → claim URL) + enters delivery code ──► status: delivered
   └─► realize affiliate commission, apply WDF credit/debit, email delivery confirmation
```

### Bag Lifecycle (durable, lives across many orders)

```
              admin mints batch          admin issues batch         customer claims via QR
  (nonexistent) ──────────────► minted ───────────────────► issued ──────────────────────► active
                                   │                            │                              │
                                   │  (FUTURE: admin retire)    │  (claimable while issued)    │ (stays active across
                                   ▼                            ▼                              ▼  every order forever)
                                retired ◄───────────────────────────────── (FUTURE) admin reassign ──► active(new customer)

  NOTE: the durable Bag NEVER changes status during the order lifecycle. Once 'active' it stays 'active'.
        The Order tracks the wash; the Bag persists. minted/retired are non-claimable; issued/active resolve.
```

### Order Lifecycle (created at intake, one per bag-intake)

```
  (operator scan + weigh + add-ons + ack form)
        │
        ▼
   in_progress ──(operator scans bag processed; WDF done)──► processed
        │                                                       │
        │                                            ┌──────────┴───────────────┐
        │                                            │  GATE: processed AND      │
        │                                            │  paymentStatus==verified  │
        │                                            └──────────┬───────────────┘
        │                                                       ▼
        │                                                ready_for_pickup ──(operator scans bag OUT)──► picked_up
        │                                                                                                  │
        │                                                                              (affiliate scans at door + confirm)
        │                                                                                                  ▼
        │                                                                                              delivered
        │                                                                                       (realize commission,
        │                                                                                        apply WDF credit)
        └──(admin/operator cancel)──► cancelled        (cancel allowed ONLY from in_progress or processed;
                                                        on cancel the bag returns to 'active' — reusable, not consumed)

  Held-at-store: a 'processed' + unpaid order has heldAtStore=true and is NEVER ready_for_pickup.
                 The affiliate is not told to collect. Only payment verification moves it forward.

  Re-intake: scanning a 'picked_up' bag with an OPERATOR code (it's back at the store) auto-marks the
             prior order 'delivered' and opens a NEW order. A VENDOR or CUSTOMER code instead confirms delivery.
```

Two entry paths into `ready_for_pickup` — whichever event happens second flips the gate, via one shared idempotent helper:
- **Path A (processed-then-paid):** operator `scanProcessed` sets `processed`; if unpaid, held + reminders; when payment later verifies, the gate promotes.
- **Path B (paid-then-processed):** payment verifies first (scanner or admin manual verify) while `in_progress`/`processed`; when the last bag is processed, the gate promotes directly.

---

## 4. Data Model Changes

### 4.1 New: `Bag` — `server/modules/bags/Bag.js`

The QR encodes an **opaque random token** (not a customer ID, not a sequential number). The Bag record holds the customer/affiliate/order links; the QR carries no PII.

```javascript
const bagSchema = new mongoose.Schema({
  bagId:   { type: String, default: () => 'BAG-' + uuidv4(), unique: true, index: true }, // internal stable id (== Order.bagId)
  token:   { type: String, required: true },                            // raw opaque QR payload — stored only to regen label QR; NOT a query key, NOT unique-indexed
  tokenHash: { type: String, required: true, unique: true, index: true }, // HMAC-SHA256(token) — the canonical lookup + uniqueness key (== Order.bagToken resolves via this)
  affiliateId: { type: String, required: true, ref: 'Affiliate', index: true }, // set at mint
  customerId:  { type: String, default: null, ref: 'Customer', index: true },    // null until claimed
  status:  { type: String, enum: ['minted','issued','active','retired'], default: 'minted', index: true },
  // Issuance / batch metadata
  batchId:  { type: String, index: true },          // groups one mint run -> one label sheet
  mintedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Administrator' },
  mintedAt: { type: Date, default: Date.now },
  issuedAt:  Date,                                   // status -> issued
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
  orderCount:  { type: Number, default: 0 },         // incremented at each store intake
  lastIntakeAt: Date
}, { timestamps: true });

bagSchema.index({ affiliateId: 1, status: 1 });      // admin issue, affiliate inventory
bagSchema.index({ customerId: 1, status: 1 });        // "find this customer's active bag(s)"

bagSchema.statics.hashToken = (raw) =>
  require('crypto').createHmac('sha256', Buffer.from(process.env.ENCRYPTION_KEY, 'hex')).update(raw).digest('hex');

// Atomic, lost-update-safe claim. Queries by tokenHash (the canonical key).
// Claimable ONLY from 'issued' (issuing is the admin act that authorizes claiming) —
// keeps this static consistent with resolveByToken/resolveClaimToken (minted -> 'invalid').
// Returns the updated doc, or null if it lost the race or the bag is not yet issued.
bagSchema.statics.claim = function (token, customerId) {
  return this.findOneAndUpdate(
    { tokenHash: this.hashToken(token), status: 'issued', customerId: null },
    { $set: { customerId, status: 'active', claimedAt: new Date() } },
    { new: true }
  );
};
```

**Token canon:** `token = encryptionUtil.generateToken(16)` → 16 random bytes = 32 lowercase hex chars = 128 bits of entropy (URL-safe, QR-friendly, low-density for reliable phone scans). The token is the **single universal key** used identically by customer claim, operator intake/advance, and delivery confirmation, carried everywhere by the `:bagToken`/`:token` route param.

**One identifier per role (canonical — stated once, holds everywhere):**
- `Bag.bagId` (`BAG-uuid`) = the internal stable business id. The **top-level `Order.bagId`** denormalizes exactly this value. Joins use it (`Bag.findOne({ bagId })`).
- `Bag.token` (32 hex) = the opaque QR payload / lookup key. The **`Order.bagToken` field and the `Order.bags[].bagToken` sub-doc field** denormalize exactly this value; every scan (claim/intake/delivery) resolves by it.
- These two never share a field name. The `bags[]` sub-document deliberately uses `bagToken` (not `bagId`) so a scanner that iterates `bags[]` and a join that reads `Order.bagId` can never cross-wire a uuid and a token.

**At-rest hardening (settled — see §13 #1, now closed):** the resolve/claim/intake/delivery lookups query **`tokenHash` exclusively**, where `tokenHash = HMAC-SHA256(token)` keyed by `ENCRYPTION_KEY`. The **`unique` index lives on `tokenHash`**, not on the raw `token`; the raw `token` is stored (non-unique) solely to regenerate label QR images and is never a query key. This gives defense against a DB/backup read yielding live, scannable QR values; 128-bit entropy already defeats online guessing. The `unique`/`index` flags on the raw `token` field in the schema above are therefore dropped in favor of `tokenHash: { unique: true, index: true }`.

**Field-type rationale:** string business IDs with `{PREFIX}-uuid` (`bagId`) match `Order.orderId`/`Affiliate.affiliateId`/`Customer.customerId`. `affiliateId`/`customerId` are `String` refs (not ObjectId) to match how `Order.affiliateId`/`Order.customerId` already store them — joins are by string match (`Affiliate.findOne({ affiliateId })`), never `populate`.

### 4.2 New: `AffiliateInvite` — `server/modules/onboarding/AffiliateInvite.js`

The invite token is **opaque and never stored in plaintext** — only a SHA-256 hash is persisted. The raw token exists only in the emailed link.

```javascript
const affiliateInviteSchema = new mongoose.Schema({
  inviteId:  { type: String, unique: true, index: true },     // "INV-uuid"
  tokenHash: { type: String, required: true, index: true },   // sha256(rawToken), hex
  email:     { type: String, required: true, lowercase: true, trim: true, index: true },
  prefill: { firstName: String, lastName: String, businessName: String, phone: String }, // read-only hints
  status:    { type: String, enum: ['pending','accepted','expired','revoked'], default: 'pending', index: true },
  expiresAt: { type: Date, required: true, index: true },      // now + invite_token_ttl_hours
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Administrator', required: true },
  acceptedAt: Date,
  acceptedAffiliateId: String,                                 // the AFF-… created on accept
  revokedAt: Date,
  revokedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Administrator' },
  sentAt:    Date,
  resendCount: { type: Number, default: 0 }
}, { timestamps: true });

affiliateInviteSchema.statics.hashToken = (raw) =>
  require('crypto').createHash('sha256').update(raw).digest('hex');

// Atomic single-use consume: only flips a pending, unexpired invite to accepted.
affiliateInviteSchema.statics.consume = function (rawToken, { affiliateId }) {
  return this.findOneAndUpdate(
    { tokenHash: this.hashToken(rawToken), status: 'pending', expiresAt: { $gt: new Date() } },
    { $set: { status: 'accepted', acceptedAt: new Date(), acceptedAffiliateId: affiliateId } },
    { new: true }
  );
};
```

Raw token = `encryptionUtil.generateToken(32)` (64 hex chars, CSPRNG). TTL is config-driven (`invite_token_ttl_hours`, default 72).

### 4.3 W-9 Document Storage

W-9 binary storage uses **AES-256-GCM-encrypted files on a DRBD-replicated local filesystem** (path from the `W9_STORAGE_PATH` env var), **not** GridFS. Rationale: the backend is Oracle ADB's *Database API for MongoDB* — a MongoDB-compatible subset over SODA — which very likely does **not** support GridFS (`fs.files`/`fs.chunks` semantics + the admin/index behaviors it needs), so we do not bet the W-9 feature on it and we keep the binary bytes off ADB entirely. DRBD replicates the W-9 volume block-for-block between oci1 and oci2. The volume is **single-primary**, mounted on the leader box (the same box that runs `RUN_BACKGROUND_JOBS`); on failover the secondary is promoted. Because the web tier is active-active and CF round-robins to either box, the W-9 routes (`/api/v1/w9/*` and the multipart W-9 field on `/api/v1/affiliates/register`) are **pinned to the primary box** (nginx upstream / CF rule) so every read and write hits the box that has the volume mounted. W-9 traffic is low-volume (upload once, admin download occasionally), so pinning costs nothing operationally.

The store is wrapped by **`server/services/secureFileStore.js`**: `storeEncrypted(buffer, { contentType, filename })` → `encryptBuffer`, then writes a **self-framed encrypted file** (`[iv(16) | authTag(16) | ciphertext]`) to `${W9_STORAGE_PATH}/<storageKey>` (storageKey = `aff/<affiliateId>/<uuid>.enc`; file mode `0600`, dirs `0700`), returns `{ storageKey, sha256 }`. `readDecrypted(storageKey)` → reads the file, splits the frame, `decryptBuffer`, verifies authTag + `sha256`, returns a Buffer. The path is the only storage detail outside the abstraction; swapping DRBD for another shared/replicated FS later touches only `W9_STORAGE_PATH`.

Binary encryption helpers added to `server/utils/encryption.js` (the existing `encryptField`/`encrypt` are string-only via `cipher.update(text,'utf8',…)`):

```javascript
exports.encryptBuffer = (buf) => {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(process.env.ENCRYPTION_KEY, 'hex'), iv);
  const data = Buffer.concat([cipher.update(buf), cipher.final()]);
  return { iv, authTag: cipher.getAuthTag(), data };
};
exports.decryptBuffer = ({ iv, authTag, data }) => {
  const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(process.env.ENCRYPTION_KEY, 'hex'), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(data), decipher.final()]);
};
```

W-9 linkage fields added to `Affiliate` (the `w9Status` enum is extended with `pending_review`):

```javascript
w9Status: { type: String,
  enum: ['not_required','required','pending_review','on_file','rejected'], default: 'not_required' }, // + pending_review
w9OnFileAt: Date,        // (exists) set when admin verifies
taxIdLast4: String,      // (exists) admin display only; full TIN lives only inside the encrypted file
w9Document: {
  storageKey:  { type: String },                          // path under W9_STORAGE_PATH (DRBD-replicated), e.g. aff/<affiliateId>/<uuid>.enc
  filename:    String,                                     // sanitized original filename
  contentType: { type: String, enum: ['application/pdf','image/jpeg','image/png'] },
  sizeBytes:   Number,
  sha256:      String,                                     // integrity check of plaintext bytes
  submittedAt: Date
},
w9SubmittedAt: Date,
w9VerifiedAt:  Date,
w9VerifiedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'Administrator' },
w9RejectedAt:  Date,
w9RejectedReason: String
```

`paymentProcessingLocked` / `paymentLockReason` stay exactly as-is — they remain the payment gate, already wired into `affiliatePaymentLockService`.

> **Terminology note:** earlier exploratory drafts referenced GridFS and/or a separate `W9Document` collection. The settled design is the **DRBD-replicated encrypted file store + the `Affiliate.w9Document` subdocument** above (`storageKey` is the file path under `W9_STORAGE_PATH`). There is no GridFS bucket and no standalone `W9Document` model. (See §13 #7.)

### 4.4 `Order` — `server/models/Order.js`

**Status enum** (replaces `pending/processing/processed/complete/cancelled`):

```javascript
status: {
  type: String,
  enum: ['in_progress','processed','ready_for_pickup','picked_up','delivered','cancelled'],
  default: 'in_progress'
}
```

**Payment status** keeps its existing enum **plus** a non-terminal `escalated` flag pair. Escalation (Decision #10) must NOT collapse into `failed` (which implies auto-cancel). The order keeps `paymentStatus='awaiting'` and sets a separate `paymentEscalated` boolean so a late payment still verifies:

```javascript
paymentStatus: { type: String, enum: ['pending','awaiting','confirming','verified','failed'], default: 'pending' },
// REUSED AS-IS (already on the Order model — do NOT re-add; no migration diff):
//   paymentReminderCount  (Order.js:165) — authoritative reminder counter
//   paymentLastReminderAt (Order.js:169) — authoritative reminder timestamp
//   paymentCheckAttempts  (Order.js:159) — IMAP detection counter (decoupled in §6.5)
//   paymentRequestedAt    (Order.js:145) — first request time (reminder clock base)
// GENUINELY NEW fields (the only schema additions on the payment path):
paymentEscalated:      { type: Boolean, default: false }, // NEW — set true after the 8th reminder
holdNoticeSentAt:      { type: Date },                    // NEW — "come to store" notice sent once
heldAtStore:           { type: Boolean, default: false }  // NEW — processed but unpaid -> physically held
```

> **Resolved contradiction:** one draft proposed adding `'escalated'` to the `paymentStatus` enum; another kept the enum unchanged and added a `paymentEscalated` boolean. The settled choice is the **boolean `paymentEscalated`** (plus `heldAtStore`, `holdNoticeSentAt`) and the enum stays `pending/awaiting/confirming/verified/failed`. Rationale: a verified-after-escalation payment must still flow through `awaiting → verified`; an `escalated` enum value would strand it. Because the boolean leaves `paymentStatus='awaiting'` untouched, the scanner still matches an escalated order **once the §6.5 query retune lands** — see the next note on `confirming`.
>
> **Required change, not current behavior:** today the IMAP scanner (`paymentEmailScanner.js:283,471`) and the cron (`paymentVerificationJob.js:105`) query the **exact** `paymentStatus: 'awaiting'` — so a customer-self-reported `confirming` order is **never** auto-verified right now. §6.5 widens both queries to `paymentStatus: { $in: ['awaiting','confirming'] }`. After that retune (and only after) an escalated-but-`awaiting` order and a `confirming` order both still verify. This is a task to do (§6.5), not an existing guarantee.

**One bag = one order: replace the embedded `bags[]` array with a single durable-bag reference + a per-order intake snapshot.** The current `bags[]` array, `numberOfBags`, `bagsWeighed/bagsProcessed/bagsPickedUp` counters, and "fires only when the LAST bag is weighed" logic all exist for N bags per order — dead weight under 1:1. The durable Bag is the source of truth for the physical object's identity and lifecycle; the Order needs only a pointer to which bag this intake was, plus the per-intake (order-specific) scan/stage stamps. Those stamps must **not** live on the durable Bag — they reset every order.

```javascript
// Durable bag reference (one bag = one order). See §4.1 "one identifier per role":
bagId:    { type: String, required: true, ref: 'Bag', index: true },   // == Bag.bagId (BAG-uuid); the JOIN key
bagToken: { type: String, index: true },                               // == Bag.token (32 hex); denormalized SCAN/lookup key (resolves via Bag.tokenHash)

// Per-order intake snapshot (resets every order; lives here, NOT on the durable Bag)
intake: {
  weight:        { type: Number, default: 0 },
  weighedAt:     Date,
  weighedBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'Operator' },
  processedAt:   Date,
  processedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'Operator' },
  pickedUpAt:    Date,                                                  // operator scans bag OUT of store
  pickedUpBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'Operator' },
  deliveredAt:   Date,                                                 // affiliate scans at customer door
  deliveredBy:   { type: String, ref: 'Affiliate' },                   // affiliateId string
  addOnFormPlaced:   { type: Boolean, default: false },                // operator ack: fresh form in pocket
  addOnFormPlacedAt: Date
}
```

The embedded single-bag sub-document (kept as a one-element array so the 3-stage scanner can iterate) uses the lifecycle-aligned stages. **One identifier per role (see the §4.1 terminology note): this sub-doc's reference field is named `bagToken` — never `bagId` — and carries the opaque 32-hex `Bag.token`, because the scanner iterates `bags[]` and resolves by token. The `BAG-uuid` business id is carried only by the top-level `Order.bagId`. The two never collide.**

```javascript
bags: [{
  bagToken:  { type: String, required: true, index: true },   // == durable Bag.token (32 hex, denormalized for scanner iteration)
  bagNumber: { type: Number, required: true },                // always 1 (one bag = one order)
  status:    { type: String, enum: ['intake','processed','picked_up','delivered'], default: 'intake' },
  weight:    { type: Number, default: 0 },
  scannedAt: { intake: Date, processed: Date, picked_up: Date, delivered: Date },
  scannedBy: {
    intake:    { type: mongoose.Schema.Types.ObjectId, ref: 'Operator' },
    processed: { type: mongoose.Schema.Types.ObjectId, ref: 'Operator' },
    picked_up: { type: mongoose.Schema.Types.ObjectId, ref: 'Operator' },
    delivered: { type: String, ref: 'Affiliate' }              // affiliate door-scan
  }
}]
```

**Top-level lifecycle timestamps and intake/commission fields:**

```javascript
intakeAt:          Date,   // == createdAt for the new flow; explicit for clarity
processedAt:       Date,
readyForPickupAt:  Date,   // NEW — gate stamp; SOLE writer = orderReadyGateService.applyReadyGate (never pre-save, never a direct PUT)
pickedUpAt:        Date,   // NEW — operator scan-OUT
deliveredAt:       Date,   // RENAME of completedAt
cancelledAt:       Date,

// Add-ons entered at intake from the paper form (operator types them in)
addOns: { premiumDetergent: Boolean, fabricSoftener: Boolean, stainRemover: Boolean }, // unchanged shape
addOnsEnteredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Operator' },
addOnsEnteredAt: Date,
freshAddOnsFormPlaced: { type: Boolean, default: false },          // operator ack a fresh form is in the pocket
freshAddOnsFormAckBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'Operator' },
freshAddOnsFormAckAt:  Date,

// Commission realization (realized at 'delivered', not 'picked_up')
commissionRealized:   { type: Boolean, default: false },
commissionRealizedAt: Date,

// Proof of delivery
proofOfDelivery: {
  method:          { type: String, enum: ['customer_pin','affiliate_code','reintake','manual_confirm'] },
  confirmedByRole: { type: String, enum: ['customer','affiliate','operator','admin'] }, // who confirmed
  confirmedById:   { type: String },                              // customerId / affiliateId / operatorId
  confirmedAt:     Date,
  geo:  { type: { type: String, enum: ['Point'] }, coordinates: { type: [Number] } }, // [lng, lat], optional
  photoKey:        String,                                        // FUTURE hook — not built now
  note:            { type: String, maxlength: 500 }
}
// method: customer_pin / affiliate_code = door confirm; reintake = auto-delivered because the bag came
// back to the store for a new order (confirmedByRole='operator'); manual_confirm = admin override.
```

**Removed Order fields:** `numberOfBags`, `bagsWeighed`, `bagsProcessed`, `bagsPickedUp`, legacy `bagWeights[]`, the multi-bag `bags[]` machinery (collapsed to one entry); `pickupDate`, `pickupTime`, `specialPickupInstructions` (scheduling); `isImmediatePickup`, `pickupDeadline`, `immediatePickupRequestedAt` (Pickup Now); the `refund*` block (Paygistix-only). **`estimatedWeight` is REMOVED** (not "optional") — there is no customer estimate in the new flow; the order is born at intake with `actualWeight`. Because the current pre-save references `estimatedWeight` in three branches (`actualWeight||estimatedWeight` at `Order.js:211`; `estimatedWeight*baseRate` at `:219`; `weightDifference` at `:102`), removing the field **requires** rewriting those branches in the same change — otherwise `estimatedWeight*baseRate` evaluates to `NaN` and poisons `estimatedTotal`. The rewrite (below) deletes the estimated-total and weight-difference branches entirely and bases pricing and add-on weight on `actualWeight` only.

**Pre-save engine (rewrite):** keep the pricing/commission computation (WDF rate from `SystemConfig`, delivery fee read from `feeBreakdown.totalFee`, add-ons at 10%/each, `actualTotal`, `paymentAmount`, `affiliateCommission`). **Delete the estimated-total branch (`Order.js:219`) and the estimate-vs-actual `weightDifference` (`:102`)/WDF-credit-from-variance generation outright** — no estimate exists; set `wdfCreditGenerated=0` for the no-estimate flow. Base WDF amount and add-on weight on **`actualWeight` only** (drop the `actualWeight||estimatedWeight` fallback at `:211`). Carry-in `wdfCreditApplied` is still applied at intake. **The pre-save does NOT stamp `readyForPickupAt`** — that timestamp has a single owner, `orderReadyGateService.applyReadyGate` (§6.5), to avoid three writers drifting. The pre-save `switch` stamps the other lifecycle timestamps (`processedAt`, `pickedUpAt`, `deliveredAt` + `commissionRealizedAt`, `cancelledAt`), set-once each. **Add-ons and `feeBreakdown` must be set before the first `.save()`** (§6.4 step 4) so the add-on pricing branch runs against `actualWeight` and `totalFee` is non-zero.

### 4.5 `Customer` — `server/models/Customer.js`

- **Add a delivery PIN.** `deliveryPinHash` (PBKDF2-salted) + `deliveryPinSetAt` — a short per-customer code to confirm receipt at the door (§6.6). Auto-generated at claim, shown on the customer dashboard, and included in the "on the way" email; verified directly against *this* order's customer (no global lookup).
- `affiliateId` stays `{ type: String, required: true, ref: 'Affiliate' }` but is now **derived from the bag**, never from client input.
- **Remove** V1 bag-purchase artifacts: `registrationVersion`, `bagCredit`, `bagCreditApplied`, `initialBagsRequested`, `numberOfBags`.

### 4.6 `Affiliate` — `server/models/Affiliate.js`

- W-9 fields per §4.3.
- **Remove** `availabilitySchedule` — the fixed-route model has no per-affiliate availability windows.
- Keep `minimumDeliveryFee`/`perBagDeliveryFee`, encrypted `paypalEmail`/`venmoHandle`, and the `paymentProcessingLocked` block.
- **Drop service-area enforcement.** Service area is no longer a concern — the affiliate owns pickup/delivery logistics (their own scheduling/route), and customers are bound to an affiliate by the bag, not by location matching. Stop using `serviceLocation`/`serviceRadius` for any validation and remove them (the affiliate-registration map step + geocoding go with them — see §7). Verify no other consumer (e.g. an admin map view) before deleting the fields; enforcement stops immediately regardless.
- **Add an affiliate delivery code.** `affiliateDeliveryCodeHash` (PBKDF2-hashed, like the account password) + `affiliateDeliveryCodeSetAt` — a short per-affiliate secret used to confirm door deliveries on the overloaded claim URL (§6.6). Auto-generated at invited registration, shown on the affiliate dashboard, resettable. **Not** the login password.

### 4.7 Removed Models

`BetaRequest`, `Payment`, `PaymentToken`, `CallbackPool` — deleted.

### 4.8 `Operator` — `server/models/Operator.js`

- **Add a scan code.** `scanCodeHmac` (`HMAC-SHA256(code, ENCRYPTION_KEY)`, **unique-indexed** for O(1) identify-and-verify) + `scanCodeSetAt`. Used for the **ad-hoc operator path on the overloaded bag URL** (intake / advance / re-intake from a phone) — the in-store **kiosk authenticates by operator JWT** instead and does not need the code. The HMAC lookup resolves *which* operator scanned (recorded as `intake.*By` / `scannedBy`). Auto-generated at operator creation; admin-resettable via the (now aptly named) `reset-pin` → `scan-code/reset` endpoint. Unambiguous alphanumeric, `operator_scan_code_length` (default 8); rate-limit + lockout per IP/bag.

---

## 5. API Surface

All new endpoints follow house conventions: `asyncWrapper` + `ControllerHelpers.sendSuccess/sendError`; `authenticate` then `checkRole`/`authorize`/`checkAdminPermission`; CSRF on mutations except registration/claim (CAPTCHA + rate-limit gated). The unified bag **token** is the opaque QR payload used identically across claim, intake, and delivery.

| Method | Path | Auth / RBAC | Purpose |
|:---|:---|:---|:---|
| **Bags** | | | |
| POST | `/api/v1/bags/mint` | administrator + `manage_affiliates` (CSRF) | Mint a per-affiliate batch → `{ batchId, count, bags:[{bagId, token, status}] }` |
| GET | `/api/v1/bags/batch/:batchId/labels` | administrator + `manage_affiliates` | Printable label sheet (`text/html`): QR imgs + affiliate name |
| POST | `/api/v1/bags/batch/:batchId/issue` | administrator + `manage_affiliates` (CSRF) | Mark batch `minted → issued` to affiliate |
| GET | `/api/v1/bags/resolve/:token` | public (rate-limited) | Canonical scan-context resolver driving the overloaded page → `{ outcome:'unclaimed'|'claimed', affiliate:{name}, order?:{ status, awaitingDelivery, nextAction } }` (`nextAction` ∈ claim / intake / advance / deliver-or-reintake); no customer PII |
| GET | `/api/v1/bags` | affiliate (own) / administrator | Bag inventory `?affiliateId=&status=` (paginated) |
| **Invites** | | | |
| POST | `/api/v1/administrators/affiliate-invites` | administrator + `manage_affiliates` (CSRF) | Mint single-use invite → emailed link |
| GET | `/api/v1/administrators/affiliate-invites` | administrator + `manage_affiliates` | List invites `?status=` |
| POST | `/api/v1/administrators/affiliate-invites/:inviteId/resend` | administrator + `manage_affiliates` (CSRF) | Re-mint token, bump `resendCount`/`sentAt` |
| POST | `/api/v1/administrators/affiliate-invites/:inviteId/revoke` | administrator + `manage_affiliates` (CSRF) | `status → revoked` |
| GET | `/api/v1/affiliate-invites/:token/validate` | public (rate-limited) | Form prefill: `{ valid, email, prefill }` or `410 { reason }` |
| **Affiliate registration + W-9** *(the entire `/api/v1/w9/*` surface, `w9Routes.js`, and `w9Controller` are **NEW / greenfield** — see note below)* | | | |
| POST | `/api/v1/affiliates/register` | public (invite-token + CAPTCHA gated); multipart for W-9 | Invite-bound registration; ignores client `email`/`affiliateId` |
| POST | `/api/v1/affiliates/:affiliateId/w9` | self affiliate OR administrator (CSRF); multipart `w9` | Post-registration W-9 upload (top-up / re-upload) |
| GET | `/api/v1/w9/status` | affiliate (self) | `{ w9Status, submittedAt }` |
| GET | `/api/v1/w9/admin/pending` | administrator + `manage_affiliates` | List `pending_review` affiliates |
| GET | `/api/v1/w9/admin/:affiliateId/document` | administrator + `manage_affiliates` | Stream decrypted bytes (`attachment`, `nosniff`, audit-logged) |
| POST | `/api/v1/w9/admin/:affiliateId/verify` | administrator + `manage_affiliates` (CSRF) | `w9Status → on_file`; unlock payments if locked for `w9_required` |
| POST | `/api/v1/w9/admin/:affiliateId/reject` | administrator + `manage_affiliates` (CSRF) | `w9Status → rejected` + reason |
| POST | `/api/v1/administrators/affiliates/:affiliateId/unlock-payments` | administrator (CSRF) | Reuse `affiliatePaymentLockService.unlockPayments` |
| **Customer claim + registration** | | | |
| GET | `/api/v1/customers/claim/:bagToken` | public (rate-limited) | Resolve token → `{ state:'claimable'|'claimed'|'invalid', affiliate?, order?:{ status, awaitingDelivery } }` (no customer PII) |
| POST | `/api/v1/customers/claim/:bagToken/register` | public (registration limiter + CAPTCHA) | Create customer (affiliate from bag) + atomic claim |
| GET | `/api/v1/auth/customer/{google\|facebook}?bag=<token>` | public | OAuth claim entry (threads bag token where `affiliateId` used to ride) |
| POST | `/api/v1/auth/customer/social/register` | public (signed state) | OAuth claim completion; validator requires `bagToken` (not `affiliateId`) |
| **Order intake + lifecycle** — *kiosk (operator JWT) and the overloaded bag URL (codes) both hit the same shared state-driven services* | | | |
| POST | `/api/v1/operators/intake` | operator JWT (kiosk, CSRF) | Scan + weigh + add-ons + ack → CREATE one order (`in_progress`), email payment request; if the bag's open order is `picked_up`, auto-deliver it first (re-intake) |
| POST | `/api/v1/operators/advance` | operator JWT (kiosk, CSRF) | State-driven advance: `in_progress`→`processed` (run ready gate), or `ready_for_pickup`→`picked_up` (requires paid; "on the way" email). Rejects `processed`+unpaid (held) |
| POST | `/api/v1/bags/:bagToken/intake` | public + **operator code** (rate-limited + lockout); body `{ operatorCode, weight, addOns, freshAddOnsFormPlaced }` | Overloaded-URL intake (phone); same as kiosk intake incl. re-intake auto-deliver of a `picked_up` order |
| POST | `/api/v1/bags/:bagToken/advance` | public + **operator code** (rate-limited + lockout); body `{ operatorCode }` | Overloaded-URL state-driven advance (phone), same semantics as kiosk advance |
| POST | `/api/v1/bags/:bagToken/confirm-delivery` | public (rate-limited + lockout); body `{ code, geo? }` = **customer PIN or vendor/affiliate code** | Door delivery confirm on a `picked_up` order → `delivered` + realize commission. **Operator codes are NOT accepted here** — an operator code on a `picked_up` bag means "back at the store" → intake (re-intake) instead |
| GET | `/api/v1/affiliates/:affiliateId/delivery-code` | affiliate (self) / administrator | View vendor delivery-code status (shown once, only on reset) |
| POST | `/api/v1/affiliates/:affiliateId/delivery-code/reset` | affiliate (self) / administrator (CSRF) | Regenerate the vendor (affiliate) delivery code |
| GET | `/api/v1/customers/:customerId/delivery-pin` | customer (self) | View customer delivery-PIN status (shown once, only on reset) |
| POST | `/api/v1/customers/:customerId/delivery-pin/reset` | customer (self, CSRF) | Regenerate the customer delivery PIN |
| POST | `/api/v1/operators/:operatorId/scan-code/reset` | administrator (CSRF) | Regenerate an operator scan code (repurposed `reset-pin`) |
| PUT | `/api/v1/orders/:orderId/status` | role-scoped (CSRF) | Status transition validated against the shared `TRANSITIONS` map |
| PUT | `/api/v1/orders/:orderId/verify-payment` | admin / administrator (CSRF) | Manual payment verify → run ready gate |
| POST | `/api/v1/orders/confirm-payment` | public | Customer "I already paid" → trigger a scan |
| POST | `/api/v1/orders/:orderId/resend-payment-request` | admin / administrator (CSRF) | Re-send stored-link request; reset reminder clock |
| GET | `/api/v1/orders/held` | admin / administrator / operator | List `{ status:'processed', heldAtStore:true }` (held view) |
| **Removed (return 404 / unmounted)** | | | |
| POST | `/api/v1/orders` (customer create) | — | Order creation moves to operator intake |
| POST | `/api/orders/immediate`, GET `/api/orders/immediate/availability` | — | Pickup Now removed |
| GET | `/api/orders/check-active` | — | Customer-scheduling helper removed |
| POST | `/api/v1/customers/register` (V1) | — | Replaced by claim |
| ALL | `/api/payments/*`, payment callback routes | — | V1 Paygistix removed |
| ALL | `/api/v1/affiliates/beta-request`, admin beta-request routes | — | Replaced by invite-only |
| ALL | schedule-pickup, affiliate-schedule routes | — | Scheduling removed |

---

## 6. Subsystem Designs

### 6.1 Durable Bags (mint, label, resolve)

**Module:** `server/modules/bags/` — `Bag.js`, `bagService.js`, `bagController.js`, `labelSheetService.js`; route `server/routes/bagRoutes.js` mounted at `/api/v1/bags`. Admin minting reuses the **`manage_affiliates`** permission — the single key used for every admin affiliate/bag/invite/W-9 management action in this spec. (Rationale: `manage_affiliates` is the key actually wired into routes **and** the only affiliate-management key in the default-granted set — `Administrator.js:129 = ['system_config','operator_management','view_analytics','manage_affiliates']`. The alternative `affiliates.manage` exists in the permission enum but is **not** granted by default, so using it would 403 an admin who can mint invites the moment they try to mint bags. Standardizing on `manage_affiliates` keeps the whole admin-manages-affiliates workflow consistent with no seed/migration change.)

**`bagService.js` public API:**

```javascript
async function mintBatch({ affiliateId, quantity, adminId })   // -> { batchId, bags[] }
async function issueBatch({ batchId, adminId })                // status minted -> issued
async function resolveByToken(token)                           // -> { bag, outcome } or null
async function claim({ token, customerId })                    // atomic; status issued -> active (issued-only; minted is not claimable)
async function linkToOrderAtIntake({ token, operatorId })      // resolve active bag -> {bag, customerId, affiliateId}; ++orderCount/lastIntakeAt
async function getInventory({ affiliateId, status, page })     // affiliate/admin listing
// FUTURE (note hook, do not implement): reassign({token, toCustomerId, adminId}), retire({token, adminId, reason})
```

`mintBatch` generates `quantity` tokens, one `batchId` (`'BATCH-' + uuidv4()`), `insertMany` of `minted` bags (`{ ordered:false }` + retry on the rare `E11000`). `claim` uses the guarded `findOneAndUpdate` static. `linkToOrderAtIntake` replaces `parseCustomerQr` + `findCustomerFlexible` in the operator flow.

**`resolveByToken` response is deliberately minimal:** for `unclaimed` it returns only the affiliate display name (so the form shows "Registering with WaveMAX Austin") and **never** returns `customerId`/PII; for `claimed` it returns `{ outcome:'claimed', customerId }` only to drive login routing; for not-found/retired it returns a single generic error (anti-enumeration). The `/resolve/:token` endpoint is rate-limited by `apiLimiter`.

**Label sheet (`labelSheetService.js`):** server-rendered print-optimized HTML returned by `GET /api/v1/bags/batch/:batchId/labels` as `text/html`. Each cell = one bag: a `data:image/png` QR (via the `qrcode` package, `width:256, margin:2, errorCorrectionLevel:'M'`) plus the affiliate `businessName` and a short human-readable `bagId` suffix (last 6 chars, staff reference — not the secret token). **No PDF dependency** — a `@media print` grid with `@page` margins and `page-break-inside: avoid` prints cleanly via the browser. **CSP-clean:** links one external stylesheet (`/assets/css/bag-labels.css`), zero inline script/style, QR as data-URI `<img>` (`img-src 'self' data:` already allowed).

**The QR payload on the printed label is the full claim URL** so a phone camera works with no app:
`https://wavemax.promo/embed-app-v2.html?route=/claim&bag=<token>`

**Edge cases:** double-claim race (atomic `findOneAndUpdate`, loser gets `null` → `409 bag_already_claimed`); rescan-during-intake idempotency (`linkToOrderAtIntake` returns the existing non-terminal order instead of spawning a second); lost token → generic `404 invalid_bag`; mint quantity bounded `1 ≤ n ≤ bag_mint_max_batch`; **one active bag per customer (launch invariant)** — naturally enforced because each claim creates one customer (unique email) per bag; intake resolves by token, not by customer.

### 6.2 Affiliate Invites + W-9 Upload

**Module:** `server/modules/onboarding/` — `AffiliateInvite.js`, `inviteService.js`, `inviteController.js`, `w9Controller.js`; plus `server/services/secureFileStore.js`, `server/middleware/uploadW9.js`, `server/routes/w9Routes.js`, `server/services/email/dispatcher/onboarding.js`. **Add `multer`** to `package.json` (confirmed not installed) — `memoryStorage`, single field `w9`, `fileFilter` on mimetype, `limits.fileSize` from `w9_max_upload_mb`.

> **Greenfield — the entire W-9 surface is NEW, not reused.** There is no `server/routes/w9Routes.js`, no `/api/v1/w9` mount in `server.js`, and no W-9 controller in the tree today (the `.claude` handbook describes a DocuSign W-9 surface that was never built). `w9Routes.js`, `w9Controller`, the `/api/v1/w9/*` endpoints, and the multipart W-9 field on `/api/v1/affiliates/register` are all built from scratch in this phase (PR 10) — there is nothing to "reuse" or "scrub" for W-9. The only reuse on this path is `affiliatePaymentLockService` (existing) and the encryption primitives. This raises PR 10's effort estimate accordingly.

**`inviteService.js`:** `createInvite({ email, prefill, ttlHours, adminId })` (generate raw token, store hash, build `?route=/affiliate-register&invite=<raw>`, dispatch email), `validateInvite(rawToken)`, `consumeInvite(rawToken, affiliateId)` (wraps `AffiliateInvite.consume`), `resendInvite`, `revokeInvite`. Throws a typed `InviteError`.

**Email constraint (load-bearing):** `server/services/email/transport.js` blocks attachments (upstream mail policy). The invite is therefore a **link, not an attachment**, and the W-9 is an **in-app upload**, never an emailed file.

**`registerAffiliate` rework (`server/controllers/affiliateController.js`):** delete the BetaRequest gate; read `inviteToken` → `inviteService.validateInvite` → force `email = invite.email` (ignore client-sent email) → after `newAffiliate.save()`, call `inviteService.consumeInvite(inviteToken, newAffiliate.affiliateId)`; if `consume` returns `null` (lost race / already used), **roll back** the just-created affiliate and return `409`. If a W-9 buffer is present on the multipart request, `secureFileStore.storeEncrypted` → set `w9Document` + `w9Status:'pending_review'` before save. Remove `submitBetaRequest`, the `BetaRequest` import, and the inline `require`.

**W-9 review:** `w9Controller` provides `uploadW9`, `getPendingW9s`, `downloadW9`, `verifyW9`, `rejectW9`. `verifyW9` sets `w9Status:'on_file'`, `w9OnFileAt`, and calls `affiliatePaymentLockService.unlockPayments` when the affiliate was locked for `w9_required` (the service already flips `w9Status → on_file` when `wasLockedForW9 && w9Received`). The document-download response sets `Content-Disposition: attachment` + `X-Content-Type-Options: nosniff`, never inlines, and is **audit-logged on every read**.

**W-9 lifecycle:**
```
not_required ──(YTD earnings cross w9_threshold_usd)──► required
required / not_required ──(affiliate uploads file)──► pending_review
pending_review ──(admin verify)──► on_file  (+ unlock payments if locked w9_required)
pending_review ──(admin reject)──► rejected ──(affiliate re-uploads)──► pending_review
```

**Edge cases:** double-submit / replay of one invite (atomic `consume`, loser 409 + rollback); client tampers email (ignored — taken from invite); expired-but-pending (lazy `validate` returns `reason:'expired'`); resend only on `pending`; W-9 wrong type/oversized rejected by multer (`pdf/jpeg/png` only — SVG disallowed); decryption/authTag failure on download → 500 + audit `SUSPICIOUS_ACTIVITY`; re-upload after rejection deletes the prior encrypted file (no orphan files); invite email send failure leaves the row resendable (registration not blocked); affiliate never uploads → `w9Status` stays `not_required` until earnings cross threshold.

### 6.3 QR-Driven Customer Claim + Registration

**New service:** `server/services/bagClaimService.js` — `resolveClaimToken(bagToken)` → `{ state:'claimable'|'claimed'|'invalid', bag, affiliate, order? }` (maps `issued`→`claimable`, `active`→`claimed`, else→`invalid`; on `claimable` loads the affiliate via the public projection from `getPublicAffiliateInfo`; on `claimed` also returns the open order's `{ status, awaitingDelivery }` — `awaitingDelivery` is `true` iff that order is `picked_up` — **with no customer PII**, so the overloaded page can branch to delivery-confirm vs status, see §6.6); `claimForCustomer(bag, customerId)` → calls `Bag.claim`, throws `ClaimError('bag_already_claimed', 409)` on race loss.

> **Terminology note:** the claim path uses the same opaque bag **token** as everything else (`Bag.token`, the `:bagToken` route param carries it). Earlier drafts referred to a `claimToken` field with a base64url `crypto.randomBytes(24)` value; the **settled canon is `Bag.token` = `encryptionUtil.generateToken(16)` (32 hex chars, 128 bits)** used identically by claim, intake, and delivery. The "claimable while issued, claimed while active" routing is unchanged.

**`customerRegistrationService.registerCustomer` rework:** accept `bagToken`, **stop trusting payload `affiliateId`**, resolve via `bagClaimService.resolveClaimToken` (replacing the `Affiliate.findOne({ affiliateId })` lookup). If `state !== 'claimable'` throw `RegistrationError('bag_not_claimable', 409)`. Use `affiliate.affiliateId` (from the bag) when constructing the customer. **Order of operations for the race:** save the customer, then `claimForCustomer`; on race loss, **roll back** the customer (`Customer.deleteOne`) and rethrow `RegistrationError('bag_already_claimed', 409)`. (Prefer the compensating delete over a Mongo transaction for standalone-mongod portability; if a replica set is guaranteed, `session.withTransaction` is the future hook.)

**Controllers:** `customerController.resolveClaim` (state-discriminated response), `customerController.claimRegister` (injects `req.params.bagToken` into the body, delegates to the service, extends the `isRegistrationError` mapping to also catch `ClaimError`). OAuth: `completeSocialCustomerRegistration` reads `bagToken` instead of `affiliateId`; update the `socialAuthRoutes.js` validator.

**Frontend:** `public/claim-embed.html` + `public/assets/js/claim.js` — a small **state machine** (claim | deliver | status), since the same QR/URL is scanned by both customers and affiliates (§6.6). Register `/claim` in **both** `EMBED_PAGES` and `pageScripts` (PITFALLS #3) and in `excludedRoutes` (so a bare `/claim` without `?bag=` isn't persisted). `claim.js` reads `?bag=` via `new URLSearchParams(window.location.search).get('bag')`. Affiliate name rendered via `textContent` (never `innerHTML`). Mobile-first single-column card; H1 varies by state ("Claim your bag" / "Confirm delivery" / the order status); OAuth buttons above the fold in the claim state; full-card error/login-redirect states. **No in-app camera** — the phone's native camera opens this URL.

**Global access-gate clearance (load-bearing — the new public surfaces must survive `server.js`'s pre-route middleware: `accessGate`, `comingSoon`, `locationQuarantine`, `franchisePreview`).** The customer QR lands on `embed-app-v2.html?route=/claim&bag=<token>`, so `req.path` is `/embed-app-v2.html` (already allowlisted in `quarantineConfig.js`: `/^\/embed-app(-v2)?\.html$/`), `claim-embed.html` matches `/^\/[a-z0-9-]+-embed\.html$/`, and all `/api/v1/customers/claim/*` + `/api/v1/bags/resolve/*` calls match `/^\/api\//` — so **the existing allowlist already covers the claim path and API by pattern.** Two confirmations are still required before launch: (1) verify `comingSoon` is host-scoped so it doesn't intercept the production claim host, and (2) if any new public surface is ever served at a bare top-level path (not `*-embed.html`, not under `/api/`), add an anchored entry to `quarantineConfig.js` `ALLOWLIST`. Capture both as deploy-checklist items (§12).

**Flow:**
```
scan QR (native phone camera) → /claim?bag=<token> → GET /api/v1/customers/claim/:bagToken
  ├─ 'claimable' → registration form, affiliate name shown, affiliateId LOCKED (not a form field)
  │     submit (traditional) → POST /claim/:bagToken/register
  │     submit (OAuth)       → /auth/customer/{google|facebook}?bag=<token> → social/register
  │       service: create customer (affiliate from bag) → Bag.claim(customerId) atomic
  │         won  → bag active, JWT, welcome emails → /customer-dashboard
  │         lost → rollback customer → 409 {state:'claimed'} → "already claimed, please log in"
  ├─ 'claimed' + order.awaitingDelivery (order is picked_up) → code panel (+ optional geo)
  │     customer PIN / vendor code → POST /api/v1/bags/:bagToken/confirm-delivery {code, geo?} → delivered + commission
  │     operator code → prompt "mark delivered & start new order?" → POST /api/v1/bags/:bagToken/intake → re-intake (§6.6)
  ├─ 'claimed' + not out for delivery → show order status + customer-login link (no code field)
  └─ 'invalid' → friendly error
```

**Edge cases:** simultaneous claim (atomic, one wins); double-submit retry (duplicate email/username caught before claim — no orphan); returning user scans a new bag → `duplicate_email` (**one bag per customer for now** — multi-bag linking out of scope; show a "log in" affordance); rescan of own claimed bag → login/status; minted/retired token → `invalid` (don't leak which); **no service-area / geocoding check** (the affiliate owns logistics); OAuth abandon → bag stays `issued`, re-scannable.

**Deprecation:** remove the public `?affid` self-serve registration entirely (it reintroduces the affiliateId-trust hole). An authenticated admin endpoint that keeps `registerCustomer` callable with an explicit `affiliateId` (`POST /api/v1/administrators/customers`, RBAC administrator) for at-the-door account creation / lost-QR recovery is a **net-new scope addition beyond the 14 agreed decisions** — it is **deliberately not in the §5 API table** and is listed under Non-Goals/Future (§2) and §13. It requires explicit product sign-off before it appears in any PR; do not build it as part of the launch phases.

### 6.4 Order Lifecycle + Operator Intake

**New module `server/modules/orders/`:**

- **`orderStateMachine.js`** — single source of truth, killing the three duplicate transition maps:

  ```javascript
  const TRANSITIONS = {
    in_progress:      ['processed', 'cancelled'],
    processed:        ['ready_for_pickup', 'cancelled'],
    ready_for_pickup: ['picked_up'],
    picked_up:        ['delivered'],
    delivered:        [],
    cancelled:        []
  };
  function canTransition(from, to) { /* ... */ }
  function applyTransition(order, to) { /* validate + stamp the matching timestamp */ }
  // maybeReadyForPickup DELEGATES to the canonical gate (§13 #3 settled — one implementation, no drift).
  // It exists only as the state-machine-facing name; orderReadyGateService.applyReadyGate owns the logic,
  // stamps readyForPickupAt (sole writer), toggles heldAtStore, saves, and reuses sendOrderReadyNotification.
  function maybeReadyForPickup(order, ctx) {            // the GATE (thin delegate)
    return require('../../services/orderReadyGateService').applyReadyGate(order, ctx);
  }
  ```

  The gate is idempotent (no-op if already `ready_for_pickup`) and is the **only** path into `ready_for_pickup`. A direct client `PUT status=ready_for_pickup` is rejected. **`applyReadyGate` is the canonical implementation; `maybeReadyForPickup` delegates to it; the gate is the sole writer of `readyForPickupAt` (not the pre-save switch, not a direct PUT).**

- **`orderIntakeService.js`** — `createOrderFromBag({ bagToken, weight, addOns, freshAddOnsFormPlaced, operatorId, req })` (`operatorId` comes from the kiosk JWT **or** is resolved from an operator code on the overloaded URL):
  1. `bagService.linkToOrderAtIntake({ token })`. Reject if not `active` (`409 bag_not_active`). If an open order already exists for the bag: **if it is `picked_up`** (out for delivery, never confirmed) → **auto-deliver it first** (`status='delivered'`, `proofOfDelivery{method:'reintake', confirmedByRole:'operator', confirmedById:operatorId}`, realize commission, "delivered" email) — Rick's re-intake rule — then create the new order; **otherwise** (open order still at the store: `in_progress`/`processed`/`ready_for_pickup`) → `409 order_already_open` (advance it, don't re-intake).
  2. Load customer (`bag.customerId`) and affiliate (`bag.affiliateId`).
  3. Compute delivery fee via `orderPricingService.calculateDeliveryFee(1, affiliate)`.
  4. Build the order, setting **every pricing input before the first `.save()`** (the pre-save reads, it does not compute, the delivery fee):
     - identifiers: top-level `bagId:bag.bagId` (the BAG-uuid join key) **and** `bagToken:bag.token` (the 32-hex scan key);
     - `status:'in_progress'`, `actualWeight:weight`;
     - operator-entered `addOns` (+ `addOnsEnteredBy/At`) — **set before save** so the add-on pricing branch runs against `actualWeight`;
     - `freshAddOnsFormPlaced` (+ `freshAddOnsFormAckBy/At`);
     - one `bags[]` entry `{ bagToken: bag.token, bagNumber:1, status:'intake', scannedAt:{intake:now}, scannedBy:{intake:operatorId} }`, mirror `intake.*`;
     - **`order.feeBreakdown`** — spread the step-3 `calculateDeliveryFee` result into `order.feeBreakdown` (matching today's `createOrder` at `orderController.js:187-191`) **before save**. The Order pre-save computes `actualTotal`/`paymentAmount`/`affiliateCommission` from `this.feeBreakdown?.totalFee || 0` (`Order.js:227,238`) — it does **not** derive the delivery fee itself. **Omitting this silently sets `totalFee=0`, zeroing commission and the emailed payment amount.**
  5. `await order.save()` → pre-save computes `actualTotal`, `paymentAmount`, `affiliateCommission` from the populated `feeBreakdown`.
  6. **Generate payment links/QR ONCE** via `paymentLinkService.generatePaymentLinks` (the scanner-compatible one, preferred over the ad-hoc `generatePaymentURLs`), set `paymentStatus='awaiting'`, `paymentRequestedAt`.
  7. `emailService.sendV2PaymentRequest(...)`. Audit `ORDER_STATUS_CHANGED` action `order_created_at_intake`.

- **`orderAdvanceService.js`** — `advance({ bagToken|order, operatorId })`: state-driven one-step advance — `in_progress` → `processed` (then `applyReadyGate`), or `ready_for_pickup` → `picked_up` (stamp `pickedUpAt`/`pickedUpBy`, bag sub-status `picked_up`, "on the way" customer email **including the customer's delivery PIN**; **no** commission yet). `processed`+unpaid → `409 awaiting_payment` (held). Any other state → `409`. This is the "scan it again" engine for both scan-2 (processed) and scan-3 (picked_up).
- **Two actor-auth front doors, one set of services** (Decision: *keep kiosk, overload the rest*): the **kiosk** (`POST /api/v1/operators/intake|advance`, operator **JWT**, no per-scan code) and the **overloaded bag URL** (`POST /api/v1/bags/:bagToken/intake|advance`, **operator code** resolved via `Operator.scanCodeHmac`) both call `orderIntakeService`/`orderAdvanceService`. The kiosk stays for high-volume store scanning; the bag URL is the phone/ad-hoc path. On the kiosk a `picked_up` bag scan is unambiguously a re-intake (operator context); on the bag URL the **code type** disambiguates (operator → re-intake; customer/vendor → deliver, §6.6).

**Service re-points:**
- `operatorBagWorkflowService` (the kiosk service): `parseCustomerQr` deleted; `scanCustomer`/`weighBags` delegate to `orderIntakeService.createOrderFromBag`; `scanProcessed` and the pickup scan delegate to `orderAdvanceService.advance` — **no longer** sends reminders (the job owns them) or notifies the affiliate directly (the gate does). Active-order status filters change to the new enum.
- `operatorPickupService.completePickup` → folded into `orderAdvanceService.advance` (the `ready_for_pickup`→`picked_up` step). `markOrderReady`/`confirmPickup` deleted (legacy).
- `orderController`: `updateOrderStatus` swaps to the shared `TRANSITIONS` and removes the inline payment-trigger block; `verifyPaymentManually` calls `applyReadyGate` after verify; `cancelOrder` allows cancel from `in_progress` OR `processed` and releases the bag back to `active`. `createOrder`, `createImmediateOrder`, `checkImmediateAvailability`, `checkActiveOrders` deleted.

**Pricing / commission:** add-ons entered at intake feed pricing; estimated-total path dropped; **commission realization moves from pickup → `delivered`** (set `commissionRealized=true`, `commissionRealizedAt`, send `sendAffiliateCommissionEmail` at the affiliate door scan).

### 6.5 Payment + Reminders (60-min cadence, max 8, come-to-store, ready gate)

Retune the working V2 stack; centralize the gate. **Links are generated exactly once at intake** (§6.4); the job is the **single owner of the reminder cadence**; the processed transition only does the gate check + affiliate notify.

**New shared helper `server/services/orderReadyGateService.js`** — `applyReadyGate(order, { trigger })` is the single, **canonical** definition of "ready" (settled, §13 #3): if `processed && paymentStatus==='verified'` → `ready_for_pickup`, **stamp `readyForPickupAt` (this gate is the sole writer of that timestamp — see §4.4)**, `heldAtStore=false`, save, then **reuse the existing `sendOrderReadyNotification` dispatcher** (Notification A — no new dispatcher/template); else if `processed && !verified` → `heldAtStore=true`, save (held); else no-op. Idempotent (no-op if already `ready_for_pickup`). `orderStateMachine.maybeReadyForPickup` **delegates to `applyReadyGate`** (it is the same gate concern; one canonical implementation, no drift). Called from the processed transition and from **both** verify paths.

**`paymentVerificationJob` rewrite:**
- Decouple counters: `paymentCheckAttempts` = **detection** counter (IMAP scans, ~2 min); `paymentReminderCount` = **reminder** counter (hourly, cap 8).
- `shouldSendReminder(order)` becomes time-based: `false` if `paymentEscalated`; `false` if `paymentReminderCount >= 8`; else send if `(now - (paymentLastReminderAt || paymentRequestedAt)) >= payment_reminder_interval_minutes`.
- `maybeSendReminderOrHold(order)`: if due → `sendPaymentReminder` (reuse **stored** `paymentLinks`/`paymentQRCodes`, do **not** regenerate) + `paymentReminderCount++` + `paymentLastReminderAt=now`. When count reaches 8 and `!paymentEscalated` → `sendHoldNotice` once (`sendV2ComeToStoreNotice`), `paymentEscalated=true`, `holdNoticeSentAt=now`, `heldAtStore=true`. **Never** sets `failed`.
- `checkPendingPayments` query: `{ paymentStatus: { $in: ['awaiting','confirming'] }, status: { $in: ['in_progress','processed'] }, paymentEscalated: { $ne: true } }`. The escalation filter is on the **reminder** path only — `scanForPayments` keeps scanning the inbox so a post-escalation payment still verifies.
- On successful verify → `applyReadyGate` (Path B). `escalateToAdmin` repurposed as the admin-visibility hook fired alongside the hold notice (no longer implies failure).

**Verify paths both run the gate:** `paymentEmailScanner.verifyAndUpdateOrder` (keep under/over/duplicate handling) and `orderController.verifyPaymentManually` both call `applyReadyGate` after setting `verified`. **Widen the exact-match `paymentStatus: 'awaiting'` queries to `{ $in: ['awaiting','confirming'] }`** in all three lookups that gate auto-verification (`paymentEmailScanner.js:283` and `:471`, `paymentVerificationJob.js:105`) so a self-reported (`confirming`) order still gets auto-verified — this is a required change, not current behavior (§4.4). `confirmPayment` no longer calls `escalateToAdmin`. **Regression test:** a `confirming` order with a matching inbound payment is auto-verified by the cron/scanner and promoted through the gate.

**Dispatcher:** add `sendV2ComeToStoreNotice({ customer, order })` (mirror `sendV2PaymentReminder`, template `v2/come-to-store.html`). Fix `sendV2PaymentReminder`'s stale `maxReminders: 3` and `paymentDeadlineHours: 24` — source `maxReminders` from SystemConfig (8) and drop the 24h-deadline framing (the deadline is "after 8 nudges, come to the store").

**Edge cases:** payment during processing (gate no-op until processed); payment after the 8th reminder (scanner still verifies, gate promotes, no "too late" state); over/underpayment (already handled — underpaid stays in cadence); duplicate after verified (admin notice, idempotent gate); manual-verify races scanner (guarded update / re-read); reminder vs scan clock skew (time-based, never over-sends); hold-notice double-send guarded by `holdNoticeSentAt`; cancelled excluded from cron + gate.

### 6.6 Delivery & Re-Intake via the Overloaded Bag URL

**No separate affiliate scanner is built.** Customers, affiliates, and ad-hoc operators all scan the bag with their phone's **native camera**, which opens the **same** `/claim?bag=<token>` URL printed on the label. The page is a state machine (claim | deliver | status | re-intake, §6.3); each mutation is authorized by a **role code**, not a JWT. This deletes the entire in-app camera stack an affiliate scanner would have needed: no `affiliate-scan-embed.html`, no `navigator.mediaDevices.getUserMedia`, no client-side QR **decoder** dependency (`jsQR`/`html5-qrcode`), no `camera=(self)` Permissions-Policy change, no `worker-src` CSP change, no `session-manager` `PROTECTED_ROUTES.affiliate` entry. (The in-store **kiosk** keeps its own JWT path for high-volume scan-out via `orderAdvanceService` — §6.4.)

- **Operator scan-OUT → `picked_up`** is the `ready_for_pickup → picked_up` step of `orderAdvanceService.advance` (§6.4), reached from the kiosk (operator JWT) or the bag URL (`POST /api/v1/bags/:bagToken/advance` + operator code). Requires `ready_for_pickup` (rejects held/unpaid → `409 awaiting_payment`); stamps `pickedUpAt`/`pickedUpBy`, bag sub-status `picked_up`, sends the "on the way" customer email (which **includes the customer's delivery PIN** so they can confirm receipt at the door); does **not** realize commission.

- **At a `picked_up` bag, the `code` type decides the action** (Rick's disambiguation). The page shows one "enter your code" panel (+ optional "use my location"); the submitted code routes server-side:
  - **vendor (affiliate) code** → `confirm-delivery` → `delivered`, `method='affiliate_code'`, `confirmedByRole='affiliate'`.
  - **customer PIN** → `confirm-delivery` → `delivered`, `method='customer_pin'`, `confirmedByRole='customer'` (customer self-confirms receipt).
  - **operator code** → **NOT a delivery** — the bag is back at the store, so the page prompts *"mark this order delivered and start a new order?"*; on an explicit confirm tap → `POST /api/v1/bags/:bagToken/intake` (re-intake): the prior `picked_up` order is auto-`delivered` (`method='reintake'`, commission realized) and a fresh order is created (§6.4).

- **`confirmDelivery`** (`server/services/affiliateDeliveryService.js` + a **public** `bagDeliveryController`, no JWT): resolve bag → open order; guard `status === 'picked_up'` (else `409 not_picked_up`); the submitted `code` is verified **only** against *this order's* customer `deliveryPinHash` and affiliate `affiliateDeliveryCodeHash` (constant-time, no global lookup, no oracle); an operator code here is rejected (`401`) — operators use intake/re-intake. On success: `delivered`, `deliveredBy = confirming actor`, `proofOfDelivery { method, confirmedByRole, confirmedById, confirmedAt, geo? }`, bag sub-status `delivered`. Pre-save stamps `deliveredAt` + `commissionRealizedAt` (set-once, idempotent → no double commission). Sends the customer "delivered" email + `sendAffiliateCommissionEmail` (best-effort). Wrong code → `401` + per-bag/IP attempt counter, lockout after `delivery_code_max_attempts`.

**Role codes (three; all hashed, rate-limited, lockout — none is the account password):**
- **Vendor / affiliate code** — `Affiliate.affiliateDeliveryCodeHash` (PBKDF2). Per-affiliate; auto-generated at invited registration; dashboard-resettable; 6-char unambiguous alphanumeric.
- **Customer PIN** — `Customer.deliveryPinHash` (PBKDF2). Per-customer; auto-generated at claim; shown on the customer dashboard **and in the "on the way" email**; 6-char.
- **Operator scan code** — `Operator.scanCodeHmac` (HMAC, unique-indexed for identify-and-verify); 8-char; admin-resettable (§4.8). Powers the ad-hoc operator path (intake/advance/re-intake) on the bag URL; the kiosk uses JWT.

Delivery codes are verified against the *order's own* customer/affiliate (no global lookup, narrow blast radius); only the operator code needs a global HMAC lookup (to identify the operator). **Optional UX:** the page may remember a code on the device (`localStorage`, explicit opt-in) so a vendor on a route or an operator at a station enters it once, not per bag.

Add a **"Deliver / check a bag"** affordance on the affiliate dashboard that instructs "scan the bag's QR with your phone camera" — there is no in-app scanner to launch.

**Notifications:**
- **Notification A — affiliate "order ready, collect from store" on `ready_for_pickup`. REUSE the existing dispatcher**, do not build a new one. Both `sendOrderReadyNotification` (`server/services/email/dispatcher/ops.js:73`) and `sendV2PickupReadyNotification` (`.../payment.js:308`) already exist; the ready gate (§6.5 `orderReadyGateService.applyReadyGate`) calls `sendOrderReadyNotification`. If the existing copy doesn't fit the new "collect from store" flow, **retune the existing template** rather than adding a parallel `affiliate-order-ready.html`. There is no new `sendAffiliateOrderReadyEmail` dispatcher and no new `affiliate-order-ready.html` template. (This is the single source of truth; §6.5 and §10 name the same function.)
- **Notification B — customer "your laundry was delivered" on `delivered`** — genuinely new: dispatcher `sendCustomerDeliveredEmail`, template `customer-order-delivered.html` (no existing equivalent).
- Commission email (`sendAffiliateCommissionEmail`, existing) moves from pickup to delivery — realized at `delivered`, including the re-intake auto-deliver (`method='reintake'`).

**Edge cases:** wrong code → `401` + per-bag/IP lockout; a code matching neither the order's customer nor its affiliate → the same generic `401` (no oracle); confirm on a non-`picked_up` order → `409 not_picked_up`; double-confirm → `409`/idempotent (no second commission); **re-intake of a `picked_up` bag** auto-delivers the prior order exactly once (commission once), then opens the new one — guarded so a double scan can't double-close; the re-intake prompt requires an explicit confirm tap so an operator scanning a bag still genuinely out for delivery can't silently close it; advance to `picked_up` on a held/unpaid order → `409 awaiting_payment`; concurrent advance/confirm + payment flip → guarded `findOneAndUpdate`; offline at the door → retry when back online (server timestamps canonical, replays idempotent); admin override → `manual_confirm` via the status PUT.

---

## 7. Removal / Cleanup Plan

**Delete files:**
- V1 Paygistix: `server/controllers/paymentController.js`; `server/services/callbackPoolManager.js`, `server/services/paygistix/index.js`, `server/services/customerPaymentService.js`, `server/services/orderPaymentService.js`; `server/config/paygistix.config.js`, `paygistix-forms.json`, `paygistix-forms.README.md`; `server/models/Payment.js`, `server/models/PaymentToken.js`, `server/models/CallbackPool.js`; `server/routes/paymentRoutes.js`, `paymentCallbackRoute.js`, `generalPaymentCallback.js`.
- Scheduling / Pickup Now: `server/controllers/affiliateScheduleController.js`, `server/routes/affiliateScheduleRoutes.js`, `server/services/orderImmediatePickupHours.js`, `server/services/identityAvailabilityService.js`, `public/schedule-pickup-embed.html`.
- Beta: `server/models/BetaRequest.js`, `server/services/email/dispatcher/beta.js`, beta templates under `server/templates/emails/{lang}/`.

**Scrub references:**
- `server.js`: remove Paygistix `app.use` mounts; remove `https://safepay.paymentlogistics.net` from CSP `script-src` and `form-action` (it is no longer in `frame-src`). **Leave the global `Permissions-Policy` header (`server.js:242-243`) as-is — `camera=()` stays for every page.** Delivery uses the phone's native camera (which opens the claim URL), so there is **no in-app `getUserMedia`**, no `camera=(self)` exception, and no `worker-src` CSP change.
- `affiliateController.registerAffiliate`: delete the BetaRequest gate; remove `submitBetaRequest`, `BetaRequest` import, inline `require`.
- `administratorController`: remove `getBetaRequests`, `sendBetaWelcomeEmail`, `sendBetaReminderEmail`, `checkAffiliateExists`.
- `orderController`: delete `createOrder` (customer path), `createImmediateOrder`, `checkImmediateAvailability`, `checkActiveOrders`, the immediate-pickup-hours require.
- Routes: remove the order create/immediate/check-active routes, beta-request routes (affiliate + admin), V1 customer register, schedule-pickup, affiliate-schedule.
- Models: drop `Affiliate.availabilitySchedule`; drop `Customer.registrationVersion/bagCredit/bagCreditApplied/initialBagsRequested/numberOfBags`; drop the Order V1/scheduling/Pickup-Now/refund fields and the multi-bag machinery.
- **Service area (no longer enforced):** drop `Affiliate.serviceLocation`/`serviceRadius`; remove the affiliate-register service-area map step (Leaflet) + `serviceLatitude/Longitude/Radius` capture; remove `locationValidation` geocoding / service-radius checks from affiliate registration **and** from the customer claim path (Nominatim is no longer called for service-area matching).
- Frontend: remove `/schedule-pickup` from `EMBED_PAGES`/`pageScripts`, "Pickup Now" UI/availability widgets, the `?affid` referral binding and hidden `affiliateId` plumbing in `customer-register.js`, and the `paymentConfirmed` rate-limit bypass.
- `operatorBagWorkflowService.parseCustomerQr`; client QR string parsing in `operator-scan-init.js`.

**Config:** delete `laundry_bag_fee` (customer bag-purchase artifact — bags are now infrastructure, not a line item); there is no "free initial bags" key.

**Removal hygiene:** each PR pairs deletions with their test deletions so `npm test` stays green at every merge (no `--forceExit`). Optionally return `410 Gone` for one transitional commit before deleting a removed route.

---

## 8. SystemConfig Keys

Added to / retuned in `SystemConfig.initializeDefaults()`. All payment keys `category:'payment'`, `isPublic:false` unless noted.

| Key | Default | Range / Values | Purpose |
|:---|:---|:---|:---|
| `payment_scan_interval_ms` | `120000` (2 min) | min 60000, max 600000 | IMAP **detection** scan cadence (decoupled from reminders) |
| `payment_reminder_interval_minutes` | `60` | min 15, max 240 | Minutes between reminders (Decision #10) |
| `payment_reminder_max_attempts` | `8` | min 1, max 24 | Max reminders before the hold notice |
| `payment_hold_notice_enabled` | `true` | boolean | Master switch for the "come to store" notice |
| `admin_notification_email` | `admin@wavemax.promo` | — | Escalation / admin notices |
| `invite_token_ttl_hours` | `72` | min 1, max 336 | Single-use affiliate invite TTL |
| `w9_max_upload_mb` | `10` | min 1, max 25 | W-9 upload size cap |
| `w9_threshold_usd` (a.k.a. `w9_earnings_threshold`) | `600` | 0–10000 | YTD earnings that trigger the W-9 payment lock (Decision #6) |
| `bag_mint_max_batch` | `200` | min 1, max 500 | Cap per mint request (bounds label sheet + `insertMany`) |
| `bag_token_bytes` | `16` | min 12, max 32 | Bag token entropy (16 bytes = 128 bits) |
| `bag_label_columns` | `3` | min 1, max 6 | Label sheet layout |
| `bag_label_qr_size_px` | `300` | min 150, max 600 | Label QR size (matches existing 300×300 convention) |
| `store_pickup_address` | (store addr) | — (`isPublic:true`) | Shown in the "come to store" notice |
| `delivery_code_max_attempts` | `5` | min 3, max 10 | Wrong customer-PIN / vendor-code tries before per-bag/IP lockout |
| `operator_scan_code_max_attempts` | `5` | min 3, max 10 | Wrong operator-code tries before lockout (bag-URL operator path) |
| `operator_scan_code_length` | `8` | min 6, max 12 | Operator scan-code length |
| `customer_delivery_pin_length` | `6` | min 4, max 10 | Customer delivery-PIN length |
| `affiliate_delivery_code_length` | `6` | min 4, max 10 | Vendor (affiliate) delivery-code length |
| `wdf_base_rate_per_pound` (exists) | `1.25` | 0.50–10.00 | WDF rate (`isPublic:true`) |
| `delivery_minimum_fee` / `delivery_per_bag_fee` (exist) | `10.00` / `2.00` | — | Delivery fee inputs (per-affiliate overrides apply) |
| `venmo_handle` / `paypal_handle` / `cashapp_handle` (exist) | — | — | Payment handles used by `paymentLinkService` |

**Retire:** `payment_check_interval` and `payment_check_max_attempts` (superseded by `payment_scan_interval_ms` + `payment_reminder_*`). Read the old names as fallbacks for one cleanup commit, then delete. **Delete:** `laundry_bag_fee`.

> **Reconciliation:** drafts cited both `bag_mint_max_batch` (default 200) and `bag_mint_batch_max` (default 100). Settled: **`bag_mint_max_batch`, default 200, max 500.** Drafts cited `w9_threshold_usd` and `w9_earnings_threshold`; settled key name is **`w9_threshold_usd`** (default 600), with `w9_earnings_threshold` accepted as the legacy alias the lock service already reads.

---

## 9. Security & RBAC

### Cross-cutting security

- **Opaque, non-enumerable tokens.** Bag token = `encryptionUtil.generateToken(16)` (128 bits, lowercase hex); invite raw token = `generateToken(32)` stored only as SHA-256. Never sequential, never derived from a business ID, never PII-in-QR. **Bag at-rest hardening: the `unique` index and all lookups are on `tokenHash` (HMAC-SHA256 keyed by `ENCRYPTION_KEY`); the raw `token` is stored non-unique solely to regenerate label QR images** (settled, §4.1 / §13 #1). Invite token compared by hash, constant-time.
- **Anti-enumeration.** Bag `/resolve`, invite `/validate`, and intake return a single generic error for not-found/retired/malformed — no validity oracle. `/resolve` returns affiliate name only for `unclaimed`, `customerId` only for `claimed` (to route login), never customer names. Token-lookup endpoints get a tight rate limiter on top of `apiLimiter`.
- **W-9 at rest.** AES-256-GCM (`encryptBuffer`) to a **self-framed encrypted file** on the DRBD-replicated `W9_STORAGE_PATH` (mode `0600`, dirs `0700`); per-file IV + authTag; SHA-256 plaintext integrity. **Not GridFS** (ADB Mongo API support is uncertain) and never in the DB. No raw TIN stored (only `taxIdLast4`, admin-entered). Single-primary volume on the leader box, W-9 routes pinned there, secondary promoted on failover. Download admin-only, `attachment` + `nosniff`, never inlined, **audit-logged every access**.
- **Server-trust on relationships.** Customer `affiliateId` derived from the bag; intake `customerId`/`affiliateId` derived from the resolved bag — never from client input. This closes the `?affid` trust hole and the old `createOrder` client-supplied-ids gap.
- **Role codes (delivery + ad-hoc operator auth).** Three hashed secrets gate the **public** bag-URL mutations in lieu of a JWT: customer `deliveryPinHash` (PBKDF2) and affiliate `affiliateDeliveryCodeHash` (PBKDF2) — both verified **against the order's own** customer/affiliate (constant-time, no global lookup, no oracle) — and operator `scanCodeHmac` (HMAC, unique-indexed; global lookup only to identify the operator). Per-bag/IP attempt counters + lockout (`delivery_code_max_attempts` / `operator_scan_code_max_attempts`). Low blast radius — a delivery code only flips an already-`picked_up` order to `delivered`; an operator code only creates/advances orders that already require a valid 128-bit bag token + the physical bag. All resettable. The in-store **kiosk** authenticates by operator JWT (not codes).
- **CSRF** on every mutation per `csrf-config.js`; registration/claim/confirm-delivery are CSRF-exempt but CAPTCHA / affiliate-code / rate-limit gated as applicable. **Strict nonce-based CSP** on all new pages (no inline script/style; `script.nonce = window.CSP_NONCE`; QR via `data:` `<img>`). **No in-app camera** (native camera only), so no `getUserMedia` / Permissions-Policy / `worker-src` changes.
- **Rate-limiting:** `registrationLimiter` on claim-register and invited registration; `sensitiveOperationLimiter` on invite-mint, bag-mint, and code resets (delivery-code / customer-PIN / operator-scan-code); a **tight limiter + per-bag/IP attempt lockout** on `confirm-delivery` and the bag-URL `intake`/`advance` (operator-code) endpoints; `fileUploadLimiter` on W-9 upload; `apiLimiter` (+ tight limiter) on token resolve/validate; `passwordResetLimiter` unchanged.
- **Audit events** (`auditLogger`): `INVITE_MINTED/CONSUMED/REVOKED`, `BAG_MINTED/ISSUED/CLAIMED` (+ future `BAG_REASSIGNED/RETIRED`), `W9_UPLOADED/VERIFIED/REJECTED/DOCUMENT_ACCESSED`, `PAYMENT_MANUAL_VERIFY`, `PAYMENT_ESCALATED`, `OPERATOR_SCAN` (intake/advance via code or JWT), `ORDER_REINTAKE` (auto-deliver + new), `DELIVERY_CONFIRMED`, `DELIVERY_CODE_FAILED`/`OPERATOR_CODE_FAILED` (failed-code attempt), `DELIVERY_CODE_RESET`/`CUSTOMER_PIN_RESET`/`OPERATOR_SCAN_CODE_RESET`, and `ORDER_STATUS_CHANGED` on every transition (actor role+id + bag token). Winston only; never log raw tokens, codes, or decrypted bytes.

### RBAC matrix

| Endpoint / action | admin / administrator | affiliate | customer | operator |
|:---|:---:|:---:|:---:|:---:|
| Mint / list / resend / revoke invite | ✅ | ❌ | ❌ | ❌ |
| Validate invite / invited register | public (token + CAPTCHA) | — | — | — |
| Mint bag batch / label sheet / issue batch | ✅ (`manage_affiliates`) | ❌ | ❌ | ❌ |
| Resolve bag token (`/resolve`, `/claim`) | — | — | public (rate-limited) | — |
| Claim register | — | — | public (token + CAPTCHA) | — |
| Bag inventory | ✅ | ✅ (own) | ❌ | ❌ |
| W-9 upload | ❌ | ✅ (self) | ❌ | ❌ |
| W-9 status | ✅ | ✅ (self) | ❌ | ❌ |
| W-9 download | ✅ | ❌ | ❌ | ❌ |
| W-9 verify / reject | ✅ | ❌ | ❌ | ❌ |
| Unlock payments | ✅ | ❌ | ❌ | ❌ |
| Kiosk intake / advance (create→processed→picked_up) | ❌ | ❌ | ❌ | ✅ (JWT) |
| Bag-URL intake / advance / re-intake | — | — | — | public + operator code |
| Confirm delivery (`delivered`) | ✅ (override) | public + vendor code | public + customer PIN | (via re-intake only) |
| View / reset affiliate (vendor) delivery code | ✅ | ✅ (self) | ❌ | ❌ |
| View / reset customer delivery PIN | ✅ | ❌ | ✅ (self) | ❌ |
| Reset operator scan code | ✅ | ❌ | ❌ | ❌ |
| Manual payment verify | ✅ | ❌ | ❌ | ❌ |
| Held-orders view | ✅ | (own, scoped) | ❌ | ✅ |
| Resend payment request | ✅ | ❌ | ❌ | ❌ |

---

## 10. i18n Inventory

All new user-facing copy ships in en / es / pt / de (`public/locales/{lang}/common.json`) **in the same commit** as the code. Email templates ship in `server/templates/emails/{en,es,pt,de}/` (and `/v2/` variants where the dispatcher resolves them).

**Client UI keys:**
- **Bag claim:** `claim.title`, `claim.subtitle` ("You're signing up with {{affiliateName}}…"), `claim.cta`, `claim.ctaOAuthGoogle`, `claim.ctaOAuthFacebook`, `claim.alreadyClaimedTitle/Body/Cta`, `claim.invalidTitle/Body`, `claim.raceLost`, `claim.resolving`.
- **Bag labels:** `bag.label.affiliateHeading`, `bag.label.bagRef`, `bag.label.printInstructions`.
- **Admin bags:** `admin.bags.mint.title/affiliate/quantity/submit/success`, `admin.bags.issue.confirm`, `admin.bags.inventory.status.{minted|issued|active|retired}`.
- **Affiliate bags:** `affiliate.bags.inventory.title`, `affiliate.bags.inventory.empty`.
- **Affiliate register (invite + W-9):** `affiliateRegister.invite.invalidOrExpired`, `affiliateRegister.invite.emailLocked`, `affiliateRegister.w9.uploadLabel`, `affiliateRegister.w9.fileTypeHint` ("PDF, JPG, or PNG, max {{max}} MB"), `affiliateRegister.w9.tooLarge`, `affiliateRegister.w9.wrongType`, `affiliateRegister.w9.optionalNote`.
- **Admin invites / W-9:** `admin.invites.*` (mint/list/resend/revoke), `admin.w9.*` (pending/verify/reject/download).
- **Operator intake:** `operator.intake.weightLabel`, `operator.intake.addOns.{premiumDetergent|fabricSoftener|stainRemover}`, `operator.intake.freshFormAck`, `operator.intake.created`, `operator.intake.error.{bagNotActive|orderAlreadyOpen|bagNotFound}`.
- **Bag page — deliver / status / re-intake (overloaded URL):** `claim.deliver.title`, `claim.deliver.codeLabel`, `claim.deliver.codePlaceholder`, `claim.deliver.geoOptIn`, `claim.deliver.rememberCode`, `claim.deliver.confirm`, `claim.deliver.success`, `claim.deliver.badCode`, `claim.deliver.lockedOut`; `claim.reintake.prompt` ("Mark delivered & start a new order?"), `claim.reintake.confirm`; `claim.scan.operatorCodeLabel` (operator-code field for the bag-URL intake/advance path — operator intake reuses the `operator.intake.*` keys below); `claim.status.{in_progress|processed|ready_for_pickup|picked_up|delivered}` (customer-facing status) + `claim.status.loginCta`.
- **Dashboards — role codes:** `affiliateDashboard.deliveryCode.{title|current|reset|resetConfirm|shownOnceNote}`, `affiliateDashboard.deliverHelp` ("scan the bag's QR with your phone camera"); `customerDashboard.deliveryPin.{title|current|reset|shownOnceNote}`; admin `admin.operators.scanCode.{reset|shownOnceNote}`. The "on the way" email adds `email.onTheWay.deliveryPinNote` (gives the customer their PIN for door confirmation).
- **Order status display:** `order.status.{in_progress|processed|ready_for_pickup|picked_up|delivered|cancelled}`.

**Email templates / keys (4 langs each):**
- `affiliate-invite` (`invite.subject/greeting/body/cta/expiresNotice` + placeholders `invite_url`, `expires_at`).
- `affiliate-w9-status` (received / verified / rejected + reason).
- `v2/payment-request` (existing), `v2/payment-reminder` (retuned — drop 24h-deadline framing), `v2/come-to-store` (escalation; `payment.holdNotice.{subject|heading|body|amountDue|orderNumber|storeContact|cta}`).
- **Notification A reuses the existing `sendOrderReadyNotification` template** — no new `affiliate-order-ready` template. If the existing copy needs to say "collect from store," retune the existing template's keys in place (all 4 langs) rather than adding parallel keys.
- `customer-order-delivered` (Notification B, new: `email.customerDelivered.{subject|heading|body|deliveredAt|thanks}`).
- `order.onTheWay.{subject|body}` (operator scan-out → picked_up).

---

## 11. Testing Strategy

Strict TDD — write the failing test first, confirm it fails for the right reason. MongoMemoryServer (`tests/setup.js`), `SystemConfig.initializeDefaults()` in setup, CSRF via `getCsrfToken(agent)`, money via `toBeCloseTo(x, 2)`, external services `jest.mock` before require. Tests run clean without `--forceExit`. Load-bearing safety tests: claim race, one-bag-one-order idempotency, anti-enumeration, server-trust-on-affiliate, single-use invite consume, the ready gate from both paths, and the reminder cap/escalation.

**Bags (`tests/unit/bags/bagService.test.js`, `tests/unit/models/Bag.test.js`, `tests/integration/bags.test.js`):** token entropy/uniqueness; `mintBatch` status/batch/affiliate/quantity bounds; `issueBatch` flips only that batch; `resolveByToken` outcomes (unclaimed/claimed/null); atomic `claim` (concurrent → one non-null); `linkToOrderAtIntake` returns ids + increments counters, throws on unclaimed, idempotent on rescan; unique-token `E11000`; status-enum guard; mint RBAC (403 without role / permission); labels `text/html` with affiliate name + QR imgs + no inline `<script>`; resolve unclaimed (no PII) / claimed (customerId only) / unknown (generic 404); inventory scoping.

**Invites + W-9 (`tests/unit/affiliateInvite.test.js`, `tests/integration/affiliateInvites.test.js`, `tests/unit/secureFileStore.test.js`, `tests/integration/w9Upload.test.js`, `tests/integration/w9Admin.test.js`):** `hashToken` deterministic ≠ raw; `consume` single-use + expiry + concurrent race; mint RBAC/CSRF/409-duplicate; validate valid/expired/unknown (no enumeration); resend re-mints; revoke; register requires `inviteToken` (proves the gate is gone); valid invite → 201 + accepted; reused invite → 409 no second affiliate; client email ignored; `encryptBuffer`↔`decryptBuffer` round-trip + corrupted authTag throws; `secureFileStore` round-trip writes a self-framed ciphertext file to disk (assert on-disk bytes ≠ plaintext) and reads back the exact plaintext, tampered authTag/`sha256` throws, `storageKey` path layout correct; multipart register PDF → `pending_review`; disallowed type / oversize → 400; upload self vs other affiliate; admin pending list; document download decrypts + audits; verify → `on_file` + unlocks payments; reject + re-upload loop; verify/reject CSRF.

**Customer claim (`tests/unit/bagClaimService.test.js`, `tests/integration/customerClaim.test.js`):** resolve states; `claimForCustomer` flips + race-loss throws; registration derives affiliate from bag (ignores payload `affiliateId`); rollback on race loss (no orphan); resolve responses (no PII / generic 404 / no customerId on claimed); concurrent double-claim → exactly one 201 + one customer; duplicate-email keeps bag `issued`; OAuth claim with `bagToken`; rate-limit; resolve on a `claimed` bag returns `order.{status, awaitingDelivery}` with **no customer PII** and `awaitingDelivery` true only when the order is `picked_up`; `/claim` in both maps + `excludedRoutes`; i18n parity.

**Order + intake (`tests/unit/orderStateMachine.test.js`, `tests/unit/order.model.test.js`, `tests/integration/operatorIntake.test.js`, `tests/integration/readyForPickupGate.test.js`, `tests/integration/operatorScanOut.test.js`, `tests/integration/confirmDelivery.test.js`, `tests/unit/affiliateDeliveryService.test.js`):** transition allows/rejects (incl. cancel only from in_progress/processed); `applyTransition`/pre-save timestamp stamping (set-once); `maybeReadyForPickup`/`applyReadyGate` flips only when processed+verified, idempotent; default `in_progress`, old enum values rejected; pre-save pricing from `actualWeight` + operator-entered add-ons; **intake populates `feeBreakdown` before save and the saved order has non-zero `feeBreakdown.totalFee`, `affiliateCommission`, and `paymentAmount`** (guards the silent-zero regression); intake creates exactly one order, derives ids from bag, fires payment request, records ack; rejects non-active / open-order / missing weight; RBAC + CSRF; gate via both paths (processed-then-paid, paid-then-processed); scan-out on ready → picked_up + "on the way" + no commission; scan-out on held → 409; confirm-delivery with the correct affiliate code on a picked_up order → delivered + commission realized + emails; wrong code → 401 + attempt counter + lockout after the cap; a different affiliate's code → 401 (no oracle); confirm on a non-picked_up order → 409; double-confirm → 409 (no second commission); delivery-code reset regenerates + invalidates the old code; optional geo persists `[lng,lat]`; admin `manual_confirm` override; delivery succeeds when customer email throws; **confirm-delivery via customer PIN** → delivered (`confirmedByRole='customer'`); **operator code at confirm-delivery → 401** (operators use re-intake); **re-intake**: scanning a `picked_up` bag with an operator code auto-delivers the prior order (`method='reintake'`, commission once) + creates a new `in_progress` order; **intake via bag-URL operator code** resolves the operator (records `scannedBy`) and returns `409` on an at-store open order; **advance** is state-driven (`in_progress`→processed→gate; `ready_for_pickup`→picked_up requires paid else `409 awaiting_payment`); **kiosk JWT** intake/advance hit the same services; operator-code + customer-PIN lockout after the cap; customer-PIN / operator-scan-code resets.

**Payment job (`tests/unit/paymentVerificationJob.test.js`, `tests/unit/orderReadyGateService.test.js`, `tests/integration/payment-ready-gate.test.js`, `tests/unit/email-come-to-store.test.js`):** `shouldSendReminder` time-based boundaries / cap / escalation flag; `maybeSendReminderOrHold` increments + hold notice once + stays `awaiting` (not failed); escalated orders skip reminder/hold on subsequent runs; reminders reuse stored links (assert `generatePaymentLinks` not called); cron query inclusion/exclusion; **regression: a `confirming` order with a matching inbound payment is auto-verified by the cron/scanner (proves the `{ $in: ['awaiting','confirming'] }` widening) and promoted through the gate**; scanner verify on processed → ready; admin verify → ready; scanProcessed on verified → ready; scanProcessed on unpaid → held + no workflow-service reminder; payment after escalation still verifies (escalated-but-`awaiting` order still matched by the scanner); `confirmPayment` no longer escalates; underpayment stays awaiting; duplicate on ready no re-notify; come-to-store template resolves all 4 langs.

**Removal regressions:** `paymentRoutes`/immediate/check-active/V1-register/schedule-pickup return 404; `require('../models/Payment')` throws; `cancelOrder` from in_progress/processed succeeds, from ready fails, releases bag to `active`.

**SystemConfig (`tests/unit/systemConfig.test.js`):** `initializeDefaults` seeds the new keys; `getValue` returns defaults; range validation on `setValue`.

**RBAC + audit:** every new endpoint asserts 403 for each disallowed role and 200/201 for the allowed role; `logAuditEvent` called with the new constants for invite-mint, bag-mint/claim, W-9 verify/download, payment manual-verify, escalation.

---

## 12. Phased Build Sequence

One concern per PR, ≤500-line diffs, tests green at every merge (deletions paired with their test deletions; no `--forceExit`). Move-then-delete where practical.

| PR | Concern | Depends on |
|:---:|:---|:---|
| 1 | Remove V1 Paygistix (models/controllers/routes/services/config + `server.js` mounts + CSP scrub + dead tests) | — |
| 2 | Remove scheduling + Pickup Now + BetaRequest (+ `availabilitySchedule`, beta gate/dispatcher/templates, `?affid`, `paymentConfirmed` bypass) | — |
| 3 | SystemConfig additions/retunes (new keys, retire `payment_check_*`, delete `laundry_bag_fee`) | — |
| 4 | Order status enum redesign + `orderStateMachine` (TRANSITIONS, `applyTransition`, `maybeReadyForPickup`/`applyReadyGate` gate helper) | PR 2 |
| 5 | `AffiliateInvite` + invite mint/validate/consume + `registerAffiliate` rework | PR 2 |
| 6 | `Bag` model + mint/issue/label + `bagService` + claim flow + claim page | PR 5 |
| 7 | Operator intake rework (`orderIntakeService`, `weighBags`/`scanProcessed` re-point, order-at-intake) | PR 4, PR 6 |
| 8 | Payment job retune + escalation (`shouldSendReminder` 60/8, `come-to-store`, `applyReadyGate` wiring) | PR 3, PR 4 |
| 9 | State-driven `advance`/scan-out + delivery + re-intake via the overloaded bag URL (customer PIN / vendor code / operator code) + kiosk re-point | PR 4, PR 6, PR 7 |
| 10 | W-9 upload / encrypted DRBD-file storage / admin review (+ `multer`, `secureFileStore`, `encryptBuffer`/`decryptBuffer`) | PR 5 (parallel to 6–9) |
| 11 | i18n completion + Lighthouse pass on new public pages (claim) | all |

**Checklist (mark done as you go):**

- [x] PR 1 — V1 Paygistix removed; CSP scrubbed; suite green
- [x] PR 2 — scheduling / Pickup Now / BetaRequest / `?affid` removed
- [x] PR 3 — SystemConfig keys seeded; legacy keys retired; `laundry_bag_fee` deleted
- [x] PR 4 — order enum + `orderStateMachine` + gate helper; transition tests pass
- [x] PR 5 — `AffiliateInvite` + invite flow + invite-bound registration
- [x] PR 6 — `Bag` + mint/issue/label + claim flow + `/claim` page (both maps + `excludedRoutes`)
- [x] PR 7 — operator intake creates the order (one bag = one order, idempotent)
- [x] PR 8 — payment retune (60/8, come-to-store, held-at-store, escalated not failed)
- [x] PR 9 — advance/scan-out + delivery (customer PIN / vendor code) + re-intake (operator code) on the bag URL; kiosk re-pointed; three role codes wired
- [x] PR 10 — W-9 upload/encrypted-storage/review + `multer` + payment-lock integration
- [x] PR 11 — all 4 languages shipped; new pages measured mobile + desktop (claim: desktop 99/100/100/100, mobile 96/100/100/100, median-of-3 local)

**Deploy / launch checklist (verify on the production host, not just in tests):**

- [ ] **Access-gate clearance for the new public surfaces.** Confirm the claim QR (`/embed-app-v2.html?route=/claim`), `claim-embed.html`, and the `/api/v1/customers/claim/*`, `/api/v1/bags/resolve/*`, `/api/v1/bags/*/confirm-delivery` endpoints all pass `locationQuarantine` (covered by the existing `embed-app(-v2).html`, `*-embed.html`, and `/api/` allowlist patterns in `server/config/quarantineConfig.js`). If any new public surface is served at a bare top-level path, add an anchored `ALLOWLIST` entry.
- [ ] **`comingSoon` host scoping** does not intercept the production claim host.
- [ ] **`RUN_BACKGROUND_JOBS='true'` on exactly one (leader) box** so the retuned `paymentVerificationJob` reminder cron runs once (existing `scheduler.js` gate — nothing to build, just verify the env).
- [ ] **Role codes provisioned & resettable:** affiliate delivery code (registration / dashboard), customer delivery PIN (claim / dashboard), operator scan code (operator creation / admin); no in-app camera (native camera opens the bag URL), so the global `Permissions-Policy` stays `camera=()`.
- [ ] **DRBD W-9 volume** single-primary on the leader box with `W9_STORAGE_PATH` mounted (`0700`); **W-9 routes pinned** to that box (nginx upstream / CF rule); secondary-promotion failover tested.
- [ ] **`confirm-delivery` rate-limit + per-bag/IP lockout** active; no in-app camera / decoder / `worker-src` change is needed.

**Cross-phase notes (already settled — listed for implementer awareness, not as open risks):**
- **Dual-AZ background-job duplication — mitigated, no action.** The retuned `paymentVerificationJob` runs only on the leader box via the existing `RUN_BACKGROUND_JOBS` gate (`scheduler.js`). Nothing new to build.
- **Shared W-9 storage — settled (§13 #7).** AES-256-GCM files on a DRBD-replicated `W9_STORAGE_PATH`, single-primary on the leader box, W-9 routes pinned there; see §4.3. Confirm the directory exists (`0700`) on first write (PR 10).
- **Single canonical ready-gate function — settled (§13 #3).** `orderReadyGateService.applyReadyGate` is canonical; `orderStateMachine.maybeReadyForPickup` delegates; the gate is the sole writer of `readyForPickupAt`. Implement the canonical helper in PR 4 and wire all callers in PR 4/PR 8.

---

## 13. Decisions & Open Questions

All implementation and product questions are **settled** below so the team can build without blocking.

### Settled decisions (build to these)

1. **Bag token at-rest hardening — SETTLED: `tokenHash` lookup.** The `unique` index and every resolve/claim/intake/delivery lookup are on `tokenHash = HMAC-SHA256(token)` (keyed by `ENCRYPTION_KEY`). The raw `token` is stored non-unique solely to regenerate label QR images and is never a query key. 128-bit entropy defeats online guessing; the HMAC adds defense against a DB/backup read yielding live, scannable QR values. (See §4.1.)
2. **Background-job ownership across dual-AZ — SETTLED: reuse `RUN_BACKGROUND_JOBS`.** The existing single-leader gate (`server/jobs/scheduler.js:29`, documented for HA in `server.js:138-144` / `docs/ops/HA-PHASE1-WEB.md`) runs all cron jobs on exactly one (leader) box. The retuned `paymentVerificationJob` inherits it — no new de-dup, no DB-level reminder locking, no extra phase. (Deploy checklist verifies the env is set on one box.)
3. **Single ready-gate function — SETTLED: `applyReadyGate` canonical.** `orderReadyGateService.applyReadyGate` is the one implementation (held-at-store branch + affiliate notify via the reused `sendOrderReadyNotification` + sole writer of `readyForPickupAt`); `orderStateMachine.maybeReadyForPickup` is a thin delegate. The pre-save switch does **not** stamp `readyForPickupAt`. (See §4.4, §6.4, §6.5.)
4. **Transactions vs compensating delete — SETTLED: compensating delete (assume standalone mongod).** The customer-create-then-claim and affiliate-create-then-consume races use a compensating delete (`Customer.deleteOne` / affiliate rollback) so the design is correct on a **standalone mongod** without requiring a replica set. The clean-slate redeploy is **not** assumed to guarantee a replica set; Mongo multi-doc transactions (`session.withTransaction`) require one, so they are a documented **future hook** to switch to only if/when a replica set is confirmed. Tests target the compensating-delete semantics (no orphan on race loss). *(If ops later confirms the target is a replica set, this becomes a one-line swap — but do not block the build on it.)*
5. **Optional geo proof-of-delivery — SETTLED: ship optional geo, defer photo.** Optional lat/lng capture on the affiliate door scan (`proofOfDelivery.geo`, `[lng,lat]`); `proofOfDelivery.photoKey` stays a reserved hook, not built. (See §4.4, §6.6.)
6. **`store_pickup_address` source — SETTLED: single global SystemConfig key.** One global `store_pickup_address` (`isPublic:true`) for launch (one Austin store), consumed by the come-to-store notice. Per-affiliate addressing is a future hook if the network grows beyond one facility. (See §8.)
7. **W-9 file storage — SETTLED: AES-256-GCM files on a DRBD-replicated local FS, single-primary + pinned routes.** Bytes are encrypted to self-framed files under `W9_STORAGE_PATH`, **not** GridFS (Oracle ADB's Mongo API very likely doesn't support it) and never in the DB. DRBD replicates the volume between oci1/oci2; it is single-primary on the leader box, and the `/api/v1/w9/*` + W-9 upload routes are pinned to that box (secondary promotes on failover). (See §4.3, §9, §12.)
8. **Service area — SETTLED: not enforced.** The affiliate owns pickup/delivery logistics (their own route/scheduling) and customers are bound to an affiliate by the bag, so there is no geocoding / service-radius check at claim or registration. `Affiliate.serviceLocation`/`serviceRadius` and the affiliate-register map step are removed. (See §4.6, §6.3, §7.)
9. **One bag per customer — SETTLED (launch).** Each customer claims exactly one durable bag (naturally enforced by the unique email at claim). A returning customer scanning a new bag gets `duplicate_email` with a "log in" affordance; multi-bag-per-account linking is out of scope for now. (See §2, §6.1, §6.3.)
10. **Delivery confirmation — SETTLED: overloaded bag URL + role codes (no separate scanner, no in-app camera).** Scanning the bag with the phone's native camera opens `/claim?bag=<token>`; for a `picked_up` order the page shows a code panel and the public `POST /api/v1/bags/:bagToken/confirm-delivery` accepts the **customer PIN** (`deliveryPinHash`) or the **vendor/affiliate code** (`affiliateDeliveryCodeHash`), verified against the order's own customer/affiliate (constant-time, rate-limited, lockout). Deletes the affiliate-scanner page, `getUserMedia`, the `jsQR`/`html5-qrcode` decoder dependency, the `camera=(self)` Permissions-Policy exception, and the `worker-src` CSP change. (See §4.4–4.6, §6.3, §6.6, §9.)
11. **Order processing overloaded too; kiosk kept — SETTLED.** The full operator lifecycle (intake → advance→`processed` → advance→`picked_up`) also runs through the bag URL with an **operator scan code** (`Operator.scanCodeHmac`), AND the in-store **kiosk is kept** (operator JWT) for high-volume scanning — both call the shared `orderIntakeService`/`orderAdvanceService`. **Re-intake by code type:** an **operator code** on a `picked_up` bag means "back at the store" → auto-deliver the prior order (`method='reintake'`, commission once) + open a new one; a **vendor/customer code** confirms a door delivery. (See §4.8, §5, §6.4, §6.6.)

### Open product questions

**None remaining** — every prior open question (service-area enforcement, multi-bag-per-customer) is now resolved; see settled #7–#9.

### Scope additions beyond the 14 agreed decisions (require product sign-off before any PR)

- **Admin-only manual customer create (`POST /api/v1/administrators/customers`)** for at-the-door / lost-QR account creation is **net-new scope** not among the 14 decisions. It is listed in Non-Goals/Future, **not** in the §5 API table, and must get explicit product sign-off before it appears in any PR.
- **Existing-customer-multi-bag linking** is Future, not launch scope (one bag per customer for now — settled #9).
