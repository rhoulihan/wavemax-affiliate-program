# PR 10 — W-9 Upload, Encrypted DRBD File Store, Admin Review — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the entire (greenfield) W-9 surface: multipart upload (at invited registration and post-registration), AES-256-GCM encrypted file storage under `W9_STORAGE_PATH`, affiliate status view, and admin review (pending list, audited encrypted download, verify→`on_file` with payment unlock, reject→re-upload loop), with 4-language status emails and audit events.

**Architecture:** Binary encryption helpers (`encryptBuffer`/`decryptBuffer`) go into `server/utils/encryption.js`; `server/services/secureFileStore.js` wraps the DRBD-replicated filesystem with self-framed encrypted files (`[iv(16)|authTag(16)|ciphertext]`, storageKey `aff/<affiliateId>/<uuid>.enc`); `server/modules/onboarding/w9Controller.js` + `server/routes/w9Routes.js` (mounted at `/api/v1/w9`) and one route added to `affiliateRoutes.js` expose the API per spec §5; `affiliatePaymentLockService.unlockPayments` (existing) is the only reused business service.

**Tech Stack:** Node/Express 4, Mongoose 8, **multer (new dep, memoryStorage)**, Jest 29 + Supertest, MongoMemoryServer fallback, Winston, csrf-csrf (already global via `conditionalCsrf`).

**Authoritative spec:** `docs/superpowers/specs/2026-06-08-invite-bag-workflow-redesign-design.md` — §4.3 (W-9 storage + Affiliate fields), §5 (API table, "Affiliate registration + W-9" block), §6.2 (subsystem design), §8 (`w9_max_upload_mb`, `w9_threshold_usd`), §9 (security/audit), §10 (i18n), §11 (testing), §13 #7 (settled: DRBD file store, NOT GridFS, no `W9Document` model).

**Assumed starting state (PRs 1–9 of the §12 sequence merged):**
- PR 2 removed BetaRequest and the `serviceLatitude`/`serviceLongitude`/`serviceRadius`/`availabilitySchedule` fields from `Affiliate` — test factories below create affiliates WITHOUT service-area fields. *If affiliate creation in tests fails with "serviceLatitude is required", PR 2 is not actually merged — STOP and verify branch state before proceeding.*
- PR 3 seeded `w9_max_upload_mb` (default 10, min 1, max 25) and `w9_threshold_usd` (default 600; legacy alias `w9_earnings_threshold` kept seeded) in `SystemConfig.initializeDefaults()`. The upload middleware reads `SystemConfig.getValue('w9_max_upload_mb', 10)` with a defensive default, so it works either way. **`w9_threshold_usd` gets its first and only consumer in this PR — Task 12's `w9ThresholdService` (the spec §6.2 `not_required → required` trigger + payment lock), completing PR 3's explicit handoff.**
- PR 5 created `server/modules/onboarding/` (`AffiliateInvite.js`, `inviteService.js`, `inviteController.js`), reworked `registerAffiliate` to be invite-bound (reads `inviteToken`, forces `email` from the invite, consumes atomically after save), created `server/services/email/dispatcher/onboarding.js` (invite email), and added the top-level `affiliateRegister` object (with `invite.*` keys) to all four `public/locales/*/common.json`.
- **Greenfield verified against the current tree (2026-06-09):** there is NO `server/routes/w9Routes.js`, NO W-9 controller, NO `/w9` mount in `server.js`, and `multer` is NOT in `package.json`. The only existing W-9 code is: `Affiliate` model fields (`w9Status` enum `['not_required','required','on_file','rejected']`, `w9OnFileAt`, `taxIdLast4`, the `paymentProcessingLocked` block at `server/models/Affiliate.js:157-172`), `server/services/affiliatePaymentLockService.js` (reused as-is), a W9-path debug log in `server/middleware/auth.js:87-94` (harmless, leave it), and admin list projections in `administratorController`/`adminDashboardService` (untouched).
- Verified existing interfaces this plan calls (read 2026-06-09, do not re-derive):
  - `affiliatePaymentLockService.unlockPayments({ affiliateId, notes, w9Received = true, adminId })` — **throws `PaymentLockError('notes_required')` if `notes` falsy**; when `paymentLockReason === 'w9_required' && w9Received` it also sets `w9Status='on_file'` + `w9OnFileAt` itself (idempotent with our verify).
  - `ControllerHelpers.asyncWrapper(fn)` / `.sendSuccess(res, data, message, statusCode)` / `.sendError(res, message, statusCode, errors)` (`server/utils/controllerHelpers.js:41,55,70`).
  - `checkAdminPermission(['manage_affiliates'])` (`server/middleware/rbac.js:150`) — requires `req.user.role === 'administrator'` AND an active `Administrator` whose `permissions` include the key (or `'all'`).
  - `fileUploadLimiter` exists (`server/middleware/rateLimiting.js:246` — 20/hour, keyed by user id or IP).
  - `logAuditEvent(eventType, details, req)` + `AuditEvents` (`server/utils/auditLogger.js:39,100`).
  - Email plumbing: `loadTemplate(name, language)` (falls back `templates/emails/{lang}/x.html` → `templates/emails/x.html`), `fillTemplate(template, data)` replaces `[PLACEHOLDER]` tokens (`server/services/email/template-manager.js`), `sendEmail(to, subject, html)` (`server/services/email/transport.js` — **attachments are blocked upstream**, which is exactly why the W-9 is an in-app upload).
  - CSRF: `app.use(conditionalCsrf)` is global (`server.js:865`); any POST not on an allowlist is enforced by default. `/api/v1/affiliates/register` is in `REGISTRATION_ENDPOINTS` (exempt). Tests fetch tokens with `const { getCsrfToken } = require('../helpers/csrfHelper')` and `getCsrfToken(app, agent)` (note: the helper file is `csrfHelper.js`, two args).
  - Tests: `jest.config.js` → `setupFilesAfterEnv: tests/setup.js`, which sets `ENCRYPTION_KEY` (64-hex), connects Mongo (memory-server fallback), wipes collections after each test, and runs `SystemConfig.initializeDefaults()` before each test.

**Conventions for every task below:** red → green → commit. Run the named test file first and confirm it fails *for the stated reason* before implementing. Full-suite (`npm test`) must be green at the end of every task. No `console.*` in `server/` (ESLint-blocked) — Winston `logger` only. Do NOT push.

---

## Task 1 — Add the `multer` dependency + record greenfield verification

**Files:** Modify `package.json`, `package-lock.json` (via npm).

- [ ] Re-verify greenfield (expect NO output from each):
  ```bash
  ls server/routes | grep -i w9
  ls server/controllers server/modules/onboarding 2>/dev/null | grep -i w9
  grep -n "w9Routes\|'/w9'" server.js
  grep -n '"multer"' package.json
  ```
  Expected: all four commands print nothing (exit non-zero is fine). If any prints a hit, STOP — the starting-state assumption is wrong; reconcile before continuing.
- [ ] Install multer (memoryStorage only — nothing is ever written unencrypted to disk):
  ```bash
  npm install multer@^2.0.1
  ```
  Expected: `package.json` gains `"multer": "^2.0.1"` under `dependencies`; lockfile updated. (multer 2.x is the maintained line with the 1.x CVEs patched; API used below — `memoryStorage`, `.single()`, `fileFilter`, `limits.fileSize` — is identical in 1.x/2.x.)
- [ ] Sanity-run the suite to baseline green: `npm test` → all suites pass (same pass/fail state as before this task).
- [ ] Commit:
  ```bash
  git add package.json package-lock.json
  git commit -m "chore(w9): add multer dependency for W-9 multipart uploads (PR10)"
  ```

---

## Task 2 — `encryptBuffer` / `decryptBuffer` in `server/utils/encryption.js` (TDD)

Binary AES-256-GCM helpers exactly per spec §4.3 (the existing `encrypt`/`decrypt` are string-only via `cipher.update(text,'utf8',…)`).

**Files:** Create `tests/unit/encryptionBuffer.test.js`; Modify `server/utils/encryption.js` (insert before the final `module.exports = exports;`, currently line 187).

- [ ] Write the failing test — create `tests/unit/encryptionBuffer.test.js`:
  ```javascript
  // encryptBuffer/decryptBuffer — binary AES-256-GCM helpers (spec §4.3).
  // ENCRYPTION_KEY (64-hex) is set by tests/setup.js.
  const crypto = require('crypto');
  const encryptionUtil = require('../../server/utils/encryption');

  describe('encryptBuffer / decryptBuffer (AES-256-GCM, binary)', () => {
    it('round-trips arbitrary binary bytes exactly', () => {
      const plaintext = crypto.randomBytes(1024);
      const { iv, authTag, data } = encryptionUtil.encryptBuffer(plaintext);
      expect(Buffer.isBuffer(iv)).toBe(true);
      expect(iv.length).toBe(16);
      expect(Buffer.isBuffer(authTag)).toBe(true);
      expect(authTag.length).toBe(16);
      expect(Buffer.isBuffer(data)).toBe(true);
      expect(data.equals(plaintext)).toBe(false); // ciphertext != plaintext
      const decrypted = encryptionUtil.decryptBuffer({ iv, authTag, data });
      expect(decrypted.equals(plaintext)).toBe(true);
    });

    it('uses a fresh random IV per call (same input -> different ciphertext)', () => {
      const plaintext = Buffer.from('same input bytes');
      const a = encryptionUtil.encryptBuffer(plaintext);
      const b = encryptionUtil.encryptBuffer(plaintext);
      expect(a.iv.equals(b.iv)).toBe(false);
      expect(a.data.equals(b.data)).toBe(false);
    });

    it('throws on a tampered authTag', () => {
      const { iv, authTag, data } = encryptionUtil.encryptBuffer(Buffer.from('tamper the tag'));
      const tampered = Buffer.from(authTag);
      tampered[0] ^= 0xff;
      expect(() => encryptionUtil.decryptBuffer({ iv, authTag: tampered, data })).toThrow();
    });

    it('throws on tampered ciphertext', () => {
      const { iv, authTag, data } = encryptionUtil.encryptBuffer(Buffer.from('tamper the body'));
      const corrupted = Buffer.from(data);
      corrupted[0] ^= 0xff;
      expect(() => encryptionUtil.decryptBuffer({ iv, authTag, data: corrupted })).toThrow();
    });
  });
  ```
- [ ] Run it — expect failure for the right reason:
  ```bash
  npm test -- tests/unit/encryptionBuffer.test.js
  ```
  Expected: `TypeError: encryptionUtil.encryptBuffer is not a function` (4 failures).
- [ ] Implement — in `server/utils/encryption.js`, insert this block between the existing `decryptField` function (ends line 185) and `module.exports = exports;` (line 187). This is the spec §4.3 snippet verbatim, adapted only to the file's `exports.` style (`crypto` is already required at the top of the file):
  ```javascript
  /**
   * Encrypt a binary Buffer with AES-256-GCM (spec §4.3 — W-9 file storage).
   * Returns raw Buffers (not hex) — the secureFileStore frames them on disk.
   * @param {Buffer} buf - Plaintext bytes
   * @returns {{iv: Buffer, authTag: Buffer, data: Buffer}}
   */
  exports.encryptBuffer = (buf) => {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(process.env.ENCRYPTION_KEY, 'hex'), iv);
    const data = Buffer.concat([cipher.update(buf), cipher.final()]);
    return { iv, authTag: cipher.getAuthTag(), data };
  };

  /**
   * Decrypt a binary Buffer encrypted by encryptBuffer. Throws on a bad
   * authTag (GCM integrity failure) — callers treat that as tampering.
   * @param {{iv: Buffer, authTag: Buffer, data: Buffer}} parts
   * @returns {Buffer} Plaintext bytes
   */
  exports.decryptBuffer = ({ iv, authTag, data }) => {
    const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(process.env.ENCRYPTION_KEY, 'hex'), iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(data), decipher.final()]);
  };
  ```
- [ ] Run again — expect 4 passing:
  ```bash
  npm test -- tests/unit/encryptionBuffer.test.js
  ```
- [ ] Commit:
  ```bash
  git add server/utils/encryption.js tests/unit/encryptionBuffer.test.js
  git commit -m "feat(crypto): add encryptBuffer/decryptBuffer AES-256-GCM binary helpers (PR10)"
  ```

---

## Task 3 — `server/services/secureFileStore.js` (TDD)

Self-framed encrypted file store per spec §4.3 / §13 #7: `[iv(16) | authTag(16) | ciphertext]` at `${W9_STORAGE_PATH}/aff/<affiliateId>/<uuid>.enc`, file mode `0600`, dirs `0700`. `W9_STORAGE_PATH` is read from env **at call time** (tests point it at a tmp dir). The canonical interface is `storeEncrypted(buffer, opts)` / `readDecrypted(storageKey)`; `affiliateId` rides in `opts` because the storageKey layout needs it, and `readDecrypted` takes an optional `{ expectedSha256 }` because the expected hash lives on `Affiliate.w9Document`.

**Files:** Create `tests/unit/secureFileStore.test.js`, `server/services/secureFileStore.js`.

- [ ] Write the failing test — create `tests/unit/secureFileStore.test.js`:
  ```javascript
  // secureFileStore — encrypted W-9 file store (spec §4.3, §13 #7).
  // NOTE: do NOT assert on-disk permission bits — this repo runs under WSL
  // drvfs (/mnt/c) where chmod is not faithfully represented. We assert the
  // frame layout and that bytes at rest are not plaintext instead.
  const fs = require('fs');
  const os = require('os');
  const path = require('path');
  const crypto = require('crypto');

  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'w9-store-'));
  process.env.W9_STORAGE_PATH = tmpRoot;
  const secureFileStore = require('../../server/services/secureFileStore');

  afterAll(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  describe('secureFileStore', () => {
    it('stores a self-framed encrypted file and returns { storageKey, sha256 }', async () => {
      const plaintext = Buffer.from('%PDF-1.4 fake w9 pdf bytes for the round-trip test');
      const { storageKey, sha256 } = await secureFileStore.storeEncrypted(plaintext, {
        affiliateId: 'AFF-test-1', contentType: 'application/pdf', filename: 'w9.pdf'
      });

      expect(storageKey).toMatch(/^aff\/AFF-test-1\/[0-9a-f-]{36}\.enc$/);
      expect(sha256).toBe(crypto.createHash('sha256').update(plaintext).digest('hex'));

      const onDisk = fs.readFileSync(path.join(tmpRoot, storageKey));
      expect(onDisk.length).toBe(32 + plaintext.length);        // [iv(16)|authTag(16)|ciphertext]
      expect(onDisk.includes(plaintext)).toBe(false);           // at-rest bytes are NOT plaintext
      expect(onDisk.subarray(32).equals(plaintext)).toBe(false);
    });

    it('readDecrypted returns the exact plaintext and verifies sha256', async () => {
      const plaintext = crypto.randomBytes(2048);
      const { storageKey, sha256 } = await secureFileStore.storeEncrypted(plaintext, {
        affiliateId: 'AFF-test-2', contentType: 'image/png', filename: 'w9.png'
      });
      const out = await secureFileStore.readDecrypted(storageKey, { expectedSha256: sha256 });
      expect(out.equals(plaintext)).toBe(true);
    });

    it('throws when the stored authTag is tampered', async () => {
      const { storageKey } = await secureFileStore.storeEncrypted(Buffer.from('tamper the frame'), {
        affiliateId: 'AFF-test-3', contentType: 'application/pdf', filename: 'w9.pdf'
      });
      const abs = path.join(tmpRoot, storageKey);
      const framed = fs.readFileSync(abs);
      framed[20] ^= 0xff; // a byte inside the authTag region [16..32)
      fs.writeFileSync(abs, framed);
      await expect(secureFileStore.readDecrypted(storageKey)).rejects.toThrow();
    });

    it('throws on sha256 mismatch even when decryption succeeds', async () => {
      const { storageKey } = await secureFileStore.storeEncrypted(Buffer.from('sha mismatch case'), {
        affiliateId: 'AFF-test-4', contentType: 'application/pdf', filename: 'w9.pdf'
      });
      await expect(
        secureFileStore.readDecrypted(storageKey, { expectedSha256: 'deadbeef'.repeat(8) })
      ).rejects.toThrow(/sha256/i);
    });

    it('rejects path-traversal storage keys', async () => {
      await expect(secureFileStore.readDecrypted('../../etc/passwd')).rejects.toThrow(/invalid storage key/i);
    });

    it('deleteFile removes the file and is idempotent', async () => {
      const { storageKey } = await secureFileStore.storeEncrypted(Buffer.from('delete me'), {
        affiliateId: 'AFF-test-5', contentType: 'application/pdf', filename: 'w9.pdf'
      });
      await expect(secureFileStore.deleteFile(storageKey)).resolves.toBe(true);
      await expect(secureFileStore.deleteFile(storageKey)).resolves.toBe(false);
    });
  });
  ```
- [ ] Run it — expect failure: `Cannot find module '../../server/services/secureFileStore'`:
  ```bash
  npm test -- tests/unit/secureFileStore.test.js
  ```
- [ ] Implement — create `server/services/secureFileStore.js`:
  ```javascript
  // Encrypted W-9 file store (spec §4.3; settled decision §13 #7).
  //
  // Bytes are AES-256-GCM encrypted and written as SELF-FRAMED files —
  // [iv(16) | authTag(16) | ciphertext] — under W9_STORAGE_PATH
  // (a DRBD-replicated, single-primary volume in production; a tmp dir in
  // tests). storageKey layout: aff/<affiliateId>/<uuid>.enc. The env var is
  // the ONLY storage detail outside this module — swapping DRBD for another
  // replicated FS later touches nothing else.
  //
  // NOT GridFS and never the DB (Oracle ADB Mongo-API GridFS support is
  // uncertain — spec §13 #7). File mode 0600, dirs 0700.

  const fs = require('fs').promises;
  const path = require('path');
  const crypto = require('crypto');
  const { v4: uuidv4 } = require('uuid');
  const { encryptBuffer, decryptBuffer } = require('../utils/encryption');
  const logger = require('../utils/logger');

  const FRAME_HEADER_BYTES = 32; // iv(16) + authTag(16)

  function storageRoot() {
    const root = process.env.W9_STORAGE_PATH;
    if (!root) throw new Error('W9_STORAGE_PATH is not configured');
    return path.resolve(root);
  }

  /** Resolve a storageKey to an absolute path, refusing path traversal. */
  function resolvePath(storageKey) {
    const root = storageRoot();
    const abs = path.resolve(root, storageKey);
    if (abs !== root && !abs.startsWith(root + path.sep)) {
      throw new Error('Invalid storage key');
    }
    return abs;
  }

  /**
   * Encrypt and persist a document buffer.
   * @param {Buffer} buffer plaintext bytes
   * @param {{affiliateId: string, contentType: string, filename: string}} meta
   * @returns {Promise<{storageKey: string, sha256: string}>}
   *   sha256 is the integrity hash of the PLAINTEXT bytes (stored on
   *   Affiliate.w9Document and re-checked on every read).
   */
  async function storeEncrypted(buffer, { affiliateId, contentType, filename }) {
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
      throw new Error('storeEncrypted requires a non-empty Buffer');
    }
    if (!affiliateId) throw new Error('storeEncrypted requires an affiliateId');

    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
    const { iv, authTag, data } = encryptBuffer(buffer);
    const framed = Buffer.concat([iv, authTag, data]);

    const storageKey = path.posix.join('aff', affiliateId, `${uuidv4()}.enc`);
    const abs = resolvePath(storageKey);
    await fs.mkdir(path.dirname(abs), { recursive: true, mode: 0o700 });
    await fs.writeFile(abs, framed, { mode: 0o600 });

    logger.info('W-9 document stored encrypted', {
      storageKey, sizeBytes: buffer.length, contentType, filename
    });
    return { storageKey, sha256 };
  }

  /**
   * Read and decrypt a stored document. The GCM authTag is verified by
   * decryptBuffer (throws on tampering); when expectedSha256 is supplied the
   * plaintext hash is re-checked too.
   * @param {string} storageKey
   * @param {{expectedSha256?: string}} [opts]
   * @returns {Promise<Buffer>} plaintext bytes
   */
  async function readDecrypted(storageKey, { expectedSha256 } = {}) {
    const abs = resolvePath(storageKey);
    const framed = await fs.readFile(abs);
    if (framed.length <= FRAME_HEADER_BYTES) {
      throw new Error('Stored W-9 file is malformed');
    }
    const iv = framed.subarray(0, 16);
    const authTag = framed.subarray(16, 32);
    const data = framed.subarray(32);
    const plaintext = decryptBuffer({ iv, authTag, data });
    if (expectedSha256) {
      const actual = crypto.createHash('sha256').update(plaintext).digest('hex');
      if (actual !== expectedSha256) {
        throw new Error('W-9 integrity check failed (sha256 mismatch)');
      }
    }
    return plaintext;
  }

  /**
   * Delete a stored document (re-upload cleanup — spec §6.2 "no orphan files").
   * @returns {Promise<boolean>} true if a file was removed, false if absent.
   */
  async function deleteFile(storageKey) {
    const abs = resolvePath(storageKey);
    try {
      await fs.unlink(abs);
      return true;
    } catch (err) {
      if (err.code === 'ENOENT') return false;
      throw err;
    }
  }

  module.exports = { storeEncrypted, readDecrypted, deleteFile };
  ```
- [ ] Run again — expect 6 passing:
  ```bash
  npm test -- tests/unit/secureFileStore.test.js
  ```
- [ ] Commit:
  ```bash
  git add server/services/secureFileStore.js tests/unit/secureFileStore.test.js
  git commit -m "feat(w9): secureFileStore — self-framed AES-256-GCM files under W9_STORAGE_PATH (PR10)"
  ```

---

## Task 4 — Affiliate model: `pending_review` status + `w9Document` metadata (TDD)

**Files:** Create `tests/unit/models/affiliateW9.test.js`; Modify `server/models/Affiliate.js` (the W-9 block — currently lines 157–164; line numbers may have shifted slightly after PRs 2/9, anchor on the quoted text).

- [ ] Write the failing test — create `tests/unit/models/affiliateW9.test.js`:
  ```javascript
  // Affiliate W-9 fields (spec §4.3): pending_review status + w9Document
  // metadata subdocument. Bytes never live in the DB — only metadata here.
  const Affiliate = require('../../../server/models/Affiliate');

  // Post-PR-2 field set: no serviceLatitude/serviceLongitude/serviceRadius.
  function baseAffiliate(overrides = {}) {
    const n = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
    return new Affiliate({
      firstName: 'Wanda', lastName: 'Nine',
      email: `w9-${n}@test.com`, phone: '512-555-0100',
      address: '123 Main St', city: 'Austin', state: 'TX', zipCode: '78701',
      username: `w9user${n}`, passwordSalt: 'salt', passwordHash: 'hash',
      paymentMethod: 'check',
      ...overrides
    });
  }

  describe('Affiliate W-9 fields', () => {
    it('accepts the pending_review status', async () => {
      const aff = baseAffiliate({ w9Status: 'pending_review' });
      await aff.save();
      const found = await Affiliate.findOne({ affiliateId: aff.affiliateId });
      expect(found.w9Status).toBe('pending_review');
    });

    it('persists the w9Document metadata subdocument and review-trail fields', async () => {
      const submittedAt = new Date();
      const aff = baseAffiliate({
        w9Status: 'pending_review',
        w9SubmittedAt: submittedAt,
        w9Document: {
          storageKey: 'aff/AFF-x/123e4567-e89b-12d3-a456-426614174000.enc',
          filename: 'w9.pdf', contentType: 'application/pdf',
          sizeBytes: 12345, sha256: 'ab'.repeat(32), submittedAt
        }
      });
      await aff.save();
      const found = await Affiliate.findOne({ affiliateId: aff.affiliateId });
      expect(found.w9Document.storageKey).toBe('aff/AFF-x/123e4567-e89b-12d3-a456-426614174000.enc');
      expect(found.w9Document.contentType).toBe('application/pdf');
      expect(found.w9Document.sizeBytes).toBe(12345);
      expect(found.w9Document.sha256).toBe('ab'.repeat(32));
      expect(found.w9SubmittedAt).toBeInstanceOf(Date);
    });

    it('rejects disallowed w9Document content types (SVG)', async () => {
      const aff = baseAffiliate({
        w9Document: { storageKey: 'aff/x/y.enc', contentType: 'image/svg+xml' }
      });
      await expect(aff.save()).rejects.toThrow(/image\/svg\+xml|validation/i);
    });
  });
  ```
- [ ] Run it — expect failures: test 1 rejects with `ValidationError: ... \`pending_review\` is not a valid enum value`, test 2 drops the unknown `w9Document` path (strict mode) so `found.w9Document.storageKey` TypeErrors/undefined, test 3 saves successfully (no enum yet) so the `rejects` assertion fails:
  ```bash
  npm test -- tests/unit/models/affiliateW9.test.js
  ```
- [ ] Implement — in `server/models/Affiliate.js`, replace this exact existing block:
  ```javascript
    // W-9 tax info (collected out-of-band; admin sets status here)
    w9Status: {
      type: String,
      enum: ['not_required', 'required', 'on_file', 'rejected'],
      default: 'not_required'
    },
    w9OnFileAt: Date,
    taxIdLast4: String,                  // last 4 digits, for admin display only
  ```
  with:
  ```javascript
    // W-9 tax info (in-app encrypted upload + admin review — spec §4.3)
    w9Status: {
      type: String,
      enum: ['not_required', 'required', 'pending_review', 'on_file', 'rejected'],
      default: 'not_required'
    },
    w9OnFileAt: Date,
    taxIdLast4: String,                  // last 4 digits, for admin display only
    // Encrypted W-9 document metadata — the bytes live in secureFileStore
    // under W9_STORAGE_PATH, never in the DB (spec §13 #7).
    w9Document: {
      storageKey: String,                // e.g. aff/<affiliateId>/<uuid>.enc
      filename: String,                  // sanitized original filename
      contentType: { type: String, enum: ['application/pdf', 'image/jpeg', 'image/png'] },
      sizeBytes: Number,
      sha256: String,                    // integrity hash of the plaintext bytes
      submittedAt: Date
    },
    w9SubmittedAt: Date,
    w9VerifiedAt: Date,
    w9VerifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Administrator' },
    w9RejectedAt: Date,
    w9RejectedReason: String,
  ```
- [ ] Run again — expect 3 passing:
  ```bash
  npm test -- tests/unit/models/affiliateW9.test.js
  ```
- [ ] Commit:
  ```bash
  git add server/models/Affiliate.js tests/unit/models/affiliateW9.test.js
  git commit -m "feat(affiliate): w9Document metadata + pending_review status (PR10)"
  ```

---

## Task 5 — `server/middleware/uploadW9.js` multer middleware (TDD)

memoryStorage, single field `w9`, fileFilter `pdf/jpeg/png` ONLY (SVG explicitly rejected — script-bearing), `limits.fileSize` from `SystemConfig.getValue('w9_max_upload_mb', 10)`. Built per-request because `getValue` is async; multer passes non-multipart requests straight through, so the same route still accepts JSON bodies.

**Files:** Create `tests/unit/uploadW9.middleware.test.js`, `server/middleware/uploadW9.js`.

- [ ] Write the failing test — create `tests/unit/uploadW9.middleware.test.js`:
  ```javascript
  // uploadW9 multer middleware (spec §6.2): field 'w9', memoryStorage,
  // pdf/jpeg/png only, size cap from SystemConfig w9_max_upload_mb.
  const express = require('express');
  const request = require('supertest');
  const SystemConfig = require('../../server/models/SystemConfig');
  const uploadW9 = require('../../server/middleware/uploadW9');

  function makeApp() {
    const app = express();
    app.post('/upload', uploadW9, (req, res) => {
      res.status(200).json({
        success: true,
        received: !!req.file,
        mimetype: req.file ? req.file.mimetype : null,
        size: req.file ? req.file.size : null
      });
    });
    return app;
  }

  describe('uploadW9 middleware', () => {
    it.each([
      ['application/pdf', '%PDF-1.4 test'],
      ['image/jpeg', '\xff\xd8\xff fakejpeg'],
      ['image/png', '\x89PNG fakepng']
    ])('accepts %s and exposes req.file from memoryStorage', async (contentType, body) => {
      const res = await request(makeApp())
        .post('/upload')
        .attach('w9', Buffer.from(body, 'binary'), { filename: 'w9.bin', contentType });
      expect(res.status).toBe(200);
      expect(res.body.received).toBe(true);
      expect(res.body.mimetype).toBe(contentType);
    });

    it('rejects SVG with 400 W9_INVALID_FILE_TYPE', async () => {
      const res = await request(makeApp())
        .post('/upload')
        .attach('w9', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'),
          { filename: 'w9.svg', contentType: 'image/svg+xml' });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('W9_INVALID_FILE_TYPE');
    });

    it('rejects an oversized file with 400 W9_FILE_TOO_LARGE (cap from w9_max_upload_mb)', async () => {
      await SystemConfig.findOneAndUpdate(
        { key: 'w9_max_upload_mb' },
        {
          $set: { value: 1, defaultValue: 1 },
          $setOnInsert: {
            description: 'W-9 upload size cap (MB)', category: 'payment',
            dataType: 'number', validation: { min: 1, max: 25 }
          }
        },
        { upsert: true }
      );
      const big = Buffer.alloc(Math.floor(1.5 * 1024 * 1024), 0x41);
      const res = await request(makeApp())
        .post('/upload')
        .attach('w9', big, { filename: 'big.pdf', contentType: 'application/pdf' });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('W9_FILE_TOO_LARGE');
    });

    it('passes non-multipart requests through untouched (JSON registration path)', async () => {
      const res = await request(makeApp()).post('/upload').send();
      expect(res.status).toBe(200);
      expect(res.body.received).toBe(false);
    });
  });
  ```
- [ ] Run it — expect failure: `Cannot find module '../../server/middleware/uploadW9'`:
  ```bash
  npm test -- tests/unit/uploadW9.middleware.test.js
  ```
- [ ] Implement — create `server/middleware/uploadW9.js`:
  ```javascript
  // W-9 multipart upload middleware (spec §6.2).
  //
  // multer + memoryStorage: the bytes only ever live in process memory until
  // secureFileStore encrypts them — nothing unencrypted touches disk.
  // Single field 'w9'; pdf/jpeg/png ONLY (SVG is script-bearing — rejected);
  // size cap from SystemConfig w9_max_upload_mb (built per-request because
  // getValue is async). Non-multipart requests pass through untouched, so
  // the invited-registration route still accepts plain JSON bodies.

  const multer = require('multer');
  const SystemConfig = require('../models/SystemConfig');
  const logger = require('../utils/logger');

  const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

  function fileFilter(req, file, cb) {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) return cb(null, true);
    const err = new Error('invalid_file_type');
    err.code = 'INVALID_FILE_TYPE';
    cb(err);
  }

  module.exports = function uploadW9(req, res, next) {
    SystemConfig.getValue('w9_max_upload_mb', 10)
      .then((maxMb) => {
        const upload = multer({
          storage: multer.memoryStorage(),
          limits: { fileSize: maxMb * 1024 * 1024, files: 1 },
          fileFilter
        }).single('w9');

        upload(req, res, (err) => {
          if (!err) return next();
          if (err.code === 'LIMIT_FILE_SIZE') {
            logger.warn('W-9 upload rejected: too large', { maxMb, path: req.path });
            return res.status(400).json({
              success: false,
              code: 'W9_FILE_TOO_LARGE',
              message: `W-9 file exceeds the ${maxMb} MB limit`
            });
          }
          if (err.code === 'INVALID_FILE_TYPE') {
            logger.warn('W-9 upload rejected: disallowed type', { path: req.path });
            return res.status(400).json({
              success: false,
              code: 'W9_INVALID_FILE_TYPE',
              message: 'Only PDF, JPEG, or PNG files are accepted'
            });
          }
          next(err);
        });
      })
      .catch(next);
  };
  ```
- [ ] Run again — expect 6 passing (3 accepts via `it.each` + 3 others):
  ```bash
  npm test -- tests/unit/uploadW9.middleware.test.js
  ```
- [ ] Commit:
  ```bash
  git add server/middleware/uploadW9.js tests/unit/uploadW9.middleware.test.js
  git commit -m "feat(w9): uploadW9 multer middleware — pdf/jpeg/png, cap from w9_max_upload_mb (PR10)"
  ```

---

## Task 6 — Audit events + W-9 status email (template + dispatcher, 4 languages) (TDD)

Adds `W9_UPLOADED / W9_VERIFIED / W9_REJECTED / W9_DOCUMENT_ACCESSED` to `AuditEvents` (spec §9) and `sendAffiliateW9StatusEmail(affiliate, status, { reason })` covering `received | verified | rejected` in en/es/pt/de (spec §10 `affiliate-w9-status`). House email pattern (verified in `dispatcher/affiliate.js`): one root template with `[PLACEHOLDER]` tokens + a translations table inside the dispatcher; `loadTemplate` handles the `{lang}/` fallback.

**Files:** Create `tests/unit/emailW9Status.test.js`, `server/templates/emails/affiliate-w9-status.html`; Modify `server/utils/auditLogger.js` (the `AuditEvents` object, lines 39–92 pre-PR; earlier PRs appended INVITE_*/BAG_* constants — anchor on the closing brace), `server/services/email/dispatcher/onboarding.js` (created by PR 5 — append; if it does not exist, create it with exactly the shown content plus the standard requires, and register `...onboarding` in `server/services/email/dispatcher/index.js`).

- [ ] Write the failing test — create `tests/unit/emailW9Status.test.js`:
  ```javascript
  // sendAffiliateW9StatusEmail — received/verified/rejected in 4 languages
  // (spec §10 'affiliate-w9-status'). Transport mocked BEFORE require.
  jest.mock('../../server/services/email/transport', () => ({
    sendEmail: jest.fn().mockResolvedValue(true)
  }));

  const { sendEmail } = require('../../server/services/email/transport');
  const onboarding = require('../../server/services/email/dispatcher/onboarding');

  const affiliate = (lang) => ({
    firstName: 'Ana', email: 'ana@test.com', affiliateId: 'AFF-test', languagePreference: lang
  });

  describe('sendAffiliateW9StatusEmail', () => {
    beforeEach(() => sendEmail.mockClear());

    it('sends the received notice to the affiliate address', async () => {
      await onboarding.sendAffiliateW9StatusEmail(affiliate('en'), 'received');
      expect(sendEmail).toHaveBeenCalledTimes(1);
      const [to, subject, html] = sendEmail.mock.calls[0];
      expect(to).toBe('ana@test.com');
      expect(subject).toMatch(/W-9/);
      expect(html).toContain('Ana');
    });

    it('includes the rejection reason for rejected', async () => {
      await onboarding.sendAffiliateW9StatusEmail(affiliate('en'), 'rejected', { reason: 'Signature missing' });
      const [, , html] = sendEmail.mock.calls[0];
      expect(html).toContain('Signature missing');
    });

    it('HTML-escapes the rejection reason', async () => {
      await onboarding.sendAffiliateW9StatusEmail(affiliate('en'), 'rejected', { reason: '<script>x</script>' });
      const [, , html] = sendEmail.mock.calls[0];
      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
    });

    it('sends all three statuses in all four languages without throwing', async () => {
      for (const lang of ['en', 'es', 'pt', 'de']) {
        for (const status of ['received', 'verified', 'rejected']) {
          await onboarding.sendAffiliateW9StatusEmail(affiliate(lang), status, { reason: 'x' });
        }
      }
      expect(sendEmail).toHaveBeenCalledTimes(12);
      // Each language must produce its own subject for 'verified' (no en-only copy)
      const verifiedSubjects = sendEmail.mock.calls
        .filter((c, i) => i % 3 === 1)  // received, VERIFIED, rejected per language
        .map((c) => c[1]);
      expect(new Set(verifiedSubjects).size).toBe(4);
    });

    it('exposes the new audit event constants', () => {
      const { AuditEvents } = require('../../server/utils/auditLogger');
      expect(AuditEvents.W9_UPLOADED).toBe('W9_UPLOADED');
      expect(AuditEvents.W9_VERIFIED).toBe('W9_VERIFIED');
      expect(AuditEvents.W9_REJECTED).toBe('W9_REJECTED');
      expect(AuditEvents.W9_DOCUMENT_ACCESSED).toBe('W9_DOCUMENT_ACCESSED');
    });
  });
  ```
- [ ] Run it — expect failure: `onboarding.sendAffiliateW9StatusEmail is not a function` (and the AuditEvents expectations fail with `undefined`):
  ```bash
  npm test -- tests/unit/emailW9Status.test.js
  ```
- [ ] Implement (a) — in `server/utils/auditLogger.js`, append inside the `AuditEvents` object, immediately before its closing `};` (after the last existing constant — `PREVIEW_REVOKED: 'PREVIEW_REVOKED'` on current main, or whatever PRs 5–9 appended; add a trailing comma to the previous last entry):
  ```javascript
    // W-9 compliance (redesign PR 10 — spec §9)
    W9_UPLOADED: 'W9_UPLOADED',
    W9_VERIFIED: 'W9_VERIFIED',
    W9_REJECTED: 'W9_REJECTED',
    W9_DOCUMENT_ACCESSED: 'W9_DOCUMENT_ACCESSED'
  ```
- [ ] Implement (b) — create `server/templates/emails/affiliate-w9-status.html` (root-level default; `loadTemplate` falls back here for every language; per-language copy is injected by the dispatcher translations, matching the house pattern in `dispatcher/affiliate.js`):
  ```html
  <!DOCTYPE html>
  <html>
  <head><meta charset="utf-8"><title>[EMAIL_TITLE]</title></head>
  <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333333; margin: 0;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #1e3a8a; color: #ffffff; padding: 20px; text-align: center;">
        <h1 style="margin: 0; font-size: 22px;">[EMAIL_HEADER]</h1>
      </div>
      <div style="padding: 20px;">
        <p>[GREETING]</p>
        <p>[BODY_MESSAGE]</p>
        [REASON_BLOCK]
        <p>[NEXT_STEPS]</p>
      </div>
      <div style="background-color: #f5f5f5; padding: 10px; text-align: center; font-size: 12px;">
        &copy; [CURRENT_YEAR] CRHS Enterprises, LLC. [FOOTER_RIGHTS]
      </div>
    </div>
  </body>
  </html>
  ```
- [ ] Implement (c) — append to `server/services/email/dispatcher/onboarding.js`. The file was created by PR 5 and already requires `loadTemplate`/`fillTemplate`/`sendEmail`/`logger`; if any of those requires are missing, add them in the PR-5 style (`const { loadTemplate, fillTemplate } = require('../template-manager'); const { sendEmail } = require('../transport'); const logger = require('../../../utils/logger');`). If the file does not exist at all (PR 5 drift), create it with those requires, the code below, and `module.exports = exports;`, then add `const onboarding = require('./onboarding');` + `...onboarding,` to `server/services/email/dispatcher/index.js` next to the existing spreads. Append:
  ```javascript
  // ---------------------------------------------------------------------------
  // W-9 status notifications (redesign PR 10 — spec §10 'affiliate-w9-status')
  // ---------------------------------------------------------------------------

  const escapeHtml = (s) => String(s).replace(/[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const W9_STATUS_TRANSLATIONS = {
    en: {
      greeting: 'Hi', reasonLabel: 'Reason:', footerRights: 'All rights reserved.',
      received: {
        subject: 'W-9 received — pending review',
        heading: 'We received your W-9',
        body: 'Thanks — your W-9 has been uploaded and is stored encrypted. Our team will review it shortly.',
        nextSteps: 'No action is needed right now. We will email you once the review is complete.'
      },
      verified: {
        subject: 'W-9 verified — you are all set',
        heading: 'Your W-9 is on file',
        body: 'Your W-9 has been reviewed and verified. It is now on file with WaveMAX.',
        nextSteps: 'If commission payouts were on hold for the W-9 requirement, they are now re-enabled.'
      },
      rejected: {
        subject: 'W-9 rejected — action required',
        heading: 'Your W-9 needs another look',
        body: 'Unfortunately we could not accept the W-9 you submitted.',
        nextSteps: 'Please upload a corrected W-9 from your affiliate dashboard. PDF, JPG, or PNG are accepted.'
      }
    },
    es: {
      greeting: 'Hola', reasonLabel: 'Motivo:', footerRights: 'Todos los derechos reservados.',
      received: {
        subject: 'W-9 recibido — pendiente de revisión',
        heading: 'Recibimos su W-9',
        body: 'Gracias — su W-9 fue cargado y se almacena cifrado. Nuestro equipo lo revisará en breve.',
        nextSteps: 'No necesita hacer nada por ahora. Le enviaremos un correo cuando la revisión termine.'
      },
      verified: {
        subject: 'W-9 verificado — todo listo',
        heading: 'Su W-9 está archivado',
        body: 'Su W-9 fue revisado y verificado. Ya está archivado en WaveMAX.',
        nextSteps: 'Si los pagos de comisiones estaban en pausa por el requisito del W-9, ya están reactivados.'
      },
      rejected: {
        subject: 'W-9 rechazado — acción requerida',
        heading: 'Su W-9 necesita corrección',
        body: 'Lamentablemente no pudimos aceptar el W-9 que envió.',
        nextSteps: 'Por favor cargue un W-9 corregido desde su panel de afiliado. Se aceptan PDF, JPG o PNG.'
      }
    },
    pt: {
      greeting: 'Olá', reasonLabel: 'Motivo:', footerRights: 'Todos os direitos reservados.',
      received: {
        subject: 'W-9 recebido — aguardando revisão',
        heading: 'Recebemos seu W-9',
        body: 'Obrigado — seu W-9 foi enviado e está armazenado criptografado. Nossa equipe o revisará em breve.',
        nextSteps: 'Nenhuma ação é necessária agora. Enviaremos um e-mail quando a revisão for concluída.'
      },
      verified: {
        subject: 'W-9 verificado — tudo certo',
        heading: 'Seu W-9 está arquivado',
        body: 'Seu W-9 foi revisado e verificado. Agora está arquivado na WaveMAX.',
        nextSteps: 'Se os pagamentos de comissão estavam suspensos pela exigência do W-9, eles foram reativados.'
      },
      rejected: {
        subject: 'W-9 rejeitado — ação necessária',
        heading: 'Seu W-9 precisa de correção',
        body: 'Infelizmente não pudemos aceitar o W-9 que você enviou.',
        nextSteps: 'Envie um W-9 corrigido pelo seu painel de afiliado. PDF, JPG ou PNG são aceitos.'
      }
    },
    de: {
      greeting: 'Hallo', reasonLabel: 'Grund:', footerRights: 'Alle Rechte vorbehalten.',
      received: {
        subject: 'W-9 erhalten — Prüfung ausstehend',
        heading: 'Wir haben Ihr W-9 erhalten',
        body: 'Danke — Ihr W-9 wurde hochgeladen und verschlüsselt gespeichert. Unser Team prüft es in Kürze.',
        nextSteps: 'Derzeit ist nichts zu tun. Wir benachrichtigen Sie per E-Mail, sobald die Prüfung abgeschlossen ist.'
      },
      verified: {
        subject: 'W-9 verifiziert — alles erledigt',
        heading: 'Ihr W-9 ist hinterlegt',
        body: 'Ihr W-9 wurde geprüft und verifiziert. Es ist jetzt bei WaveMAX hinterlegt.',
        nextSteps: 'Falls Provisionsauszahlungen wegen der W-9-Anforderung pausiert waren, sind sie jetzt wieder aktiviert.'
      },
      rejected: {
        subject: 'W-9 abgelehnt — Handlung erforderlich',
        heading: 'Ihr W-9 muss korrigiert werden',
        body: 'Leider konnten wir das eingereichte W-9 nicht akzeptieren.',
        nextSteps: 'Bitte laden Sie ein korrigiertes W-9 über Ihr Affiliate-Dashboard hoch. PDF, JPG oder PNG werden akzeptiert.'
      }
    }
  };

  /**
   * Send a W-9 lifecycle notification to an affiliate.
   * @param {Object} affiliate - needs firstName, email, languagePreference
   * @param {'received'|'verified'|'rejected'} status
   * @param {{reason?: string}} [opts] - rejection reason (rejected only)
   * Side effects: one outbound email; errors are logged, never thrown
   * (email failure must not fail the upload/review mutation).
   */
  exports.sendAffiliateW9StatusEmail = async (affiliate, status, { reason } = {}) => {
    try {
      const language = affiliate.languagePreference || 'en';
      const template = await loadTemplate('affiliate-w9-status', language);
      const t = W9_STATUS_TRANSLATIONS[language] || W9_STATUS_TRANSLATIONS.en;
      const s = t[status] || t.received;

      const reasonBlock = (status === 'rejected' && reason)
        ? `<p style="background:#fef2f2;border-left:4px solid #C74634;padding:12px;">`
          + `<strong>${t.reasonLabel}</strong> ${escapeHtml(reason)}</p>`
        : '';

      const html = fillTemplate(template, {
        EMAIL_TITLE: s.subject,
        EMAIL_HEADER: s.heading,
        GREETING: `${t.greeting} ${affiliate.firstName},`,
        BODY_MESSAGE: s.body,
        REASON_BLOCK: reasonBlock,
        NEXT_STEPS: s.nextSteps,
        FOOTER_RIGHTS: t.footerRights,
        CURRENT_YEAR: new Date().getFullYear()
      });

      await sendEmail(affiliate.email, s.subject, html);
    } catch (error) {
      logger.error('Error sending W-9 status email:', error);
    }
  };
  ```
- [ ] Run again — expect 5 passing:
  ```bash
  npm test -- tests/unit/emailW9Status.test.js
  ```
- [ ] Commit:
  ```bash
  git add server/utils/auditLogger.js server/templates/emails/affiliate-w9-status.html server/services/email/dispatcher/onboarding.js server/services/email/dispatcher/index.js tests/unit/emailW9Status.test.js
  git commit -m "feat(w9): W9 audit events + affiliate-w9-status email in en/es/pt/de (PR10)"
  ```
  (Drop `index.js` from the `git add` if it needed no change.)

---

## Task 7 — `w9Controller` + routes + mounts: the upload endpoint (TDD, integration)

Builds the controller skeleton with `uploadW9` (POST `/api/v1/affiliates/:affiliateId/w9` — self affiliate OR administrator, multipart, `fileUploadLimiter`, CSRF-enforced), creates `server/routes/w9Routes.js` + the `/api/v1/w9` mount (handlers for Tasks 8–9 are stubbed in the same controller file now so the routes file is written once), and registers the W-9 mutations in `CSRF_CONFIG.CRITICAL_ENDPOINTS` (spec: critical endpoints are *always* CSRF-protected — the default already enforces them, this makes it explicit and rollout-proof).

> RBAC note: the spec §5 API table and the PR-10 scope say **"self affiliate OR administrator"** for upload; the §9 matrix shows admin ❌ for upload. The API table + scope win (admins need re-upload-on-behalf for at-the-store paper handling); the discrepancy is recorded here deliberately.

**Files:** Create `tests/integration/w9Upload.test.js`, `server/modules/onboarding/w9Controller.js`, `server/routes/w9Routes.js`; Modify `server/routes/affiliateRoutes.js` (append route before `module.exports = router;`), `server.js` (one mount line), `server/config/csrf-config.js` (CRITICAL_ENDPOINTS).

- [ ] Write the failing test — create `tests/integration/w9Upload.test.js`:
  ```javascript
  // POST /api/v1/affiliates/:affiliateId/w9 — encrypted W-9 upload (spec §5/§6.2).
  const fs = require('fs');
  const os = require('os');
  const path = require('path');
  const crypto = require('crypto');
  const jwt = require('jsonwebtoken');
  const request = require('supertest');

  // Tmp storage root BEFORE the app loads anything.
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'w9-upload-'));
  process.env.W9_STORAGE_PATH = tmpRoot;

  // Mock the status emails BEFORE the controller is required by the app.
  jest.mock('../../server/services/email/dispatcher/onboarding', () => ({
    ...jest.requireActual('../../server/services/email/dispatcher/onboarding'),
    sendAffiliateW9StatusEmail: jest.fn().mockResolvedValue(undefined)
  }));

  const app = require('../../server');
  const Affiliate = require('../../server/models/Affiliate');
  const Administrator = require('../../server/models/Administrator');
  const onboardingEmails = require('../../server/services/email/dispatcher/onboarding');
  const { getCsrfToken } = require('../helpers/csrfHelper');

  afterAll(() => fs.rmSync(tmpRoot, { recursive: true, force: true }));

  const PDF = Buffer.from('%PDF-1.4 integration-test w9 plaintext payload');

  function affiliateToken(aff) {
    return jwt.sign({ id: aff._id.toString(), role: 'affiliate', affiliateId: aff.affiliateId },
      process.env.JWT_SECRET, { expiresIn: '1h' });
  }
  function adminToken(admin) {
    return jwt.sign({ id: admin._id.toString(), role: 'administrator' },
      process.env.JWT_SECRET, { expiresIn: '1h' });
  }
  async function createAffiliate(overrides = {}) {
    const n = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
    return Affiliate.create({
      firstName: 'Aff', lastName: 'One', email: `aff${n}@test.com`, phone: '512-555-0100',
      address: '1 Congress Ave', city: 'Austin', state: 'TX', zipCode: '78701',
      username: `affu${n}`, passwordSalt: 's', passwordHash: 'h', paymentMethod: 'check',
      ...overrides
    });
  }
  async function createAdmin(permissions = ['manage_affiliates']) {
    const n = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
    return Administrator.create({
      firstName: 'Ad', lastName: 'Min', email: `adm${n}@test.com`,
      passwordSalt: 's', passwordHash: 'h', permissions
    });
  }

  describe('POST /api/v1/affiliates/:affiliateId/w9', () => {
    let agent, csrfToken;
    beforeEach(async () => {
      onboardingEmails.sendAffiliateW9StatusEmail.mockClear();
      agent = request.agent(app);
      csrfToken = await getCsrfToken(app, agent);
    });

    it('lets the affiliate upload their own W-9 -> 201 pending_review, encrypted at rest, received email', async () => {
      const aff = await createAffiliate();
      const res = await agent
        .post(`/api/v1/affiliates/${aff.affiliateId}/w9`)
        .set('Authorization', `Bearer ${affiliateToken(aff)}`)
        .set('x-csrf-token', csrfToken)
        .attach('w9', PDF, { filename: 'my w9 (final).pdf', contentType: 'application/pdf' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.w9Status).toBe('pending_review');

      const saved = await Affiliate.findOne({ affiliateId: aff.affiliateId });
      expect(saved.w9Status).toBe('pending_review');
      expect(saved.w9SubmittedAt).toBeInstanceOf(Date);
      expect(saved.w9Document.storageKey).toMatch(new RegExp(`^aff/${aff.affiliateId}/`));
      expect(saved.w9Document.contentType).toBe('application/pdf');
      expect(saved.w9Document.sha256)
        .toBe(crypto.createHash('sha256').update(PDF).digest('hex'));

      const onDisk = fs.readFileSync(path.join(tmpRoot, saved.w9Document.storageKey));
      expect(onDisk.includes(PDF)).toBe(false); // never plaintext at rest

      expect(onboardingEmails.sendAffiliateW9StatusEmail).toHaveBeenCalledWith(
        expect.objectContaining({ affiliateId: aff.affiliateId }), 'received');
    });

    it("rejects another affiliate's upload with 403", async () => {
      const owner = await createAffiliate();
      const intruder = await createAffiliate();
      const res = await agent
        .post(`/api/v1/affiliates/${owner.affiliateId}/w9`)
        .set('Authorization', `Bearer ${affiliateToken(intruder)}`)
        .set('x-csrf-token', csrfToken)
        .attach('w9', PDF, { filename: 'w9.pdf', contentType: 'application/pdf' });
      expect(res.status).toBe(403);
    });

    it('lets an administrator upload on behalf of an affiliate', async () => {
      const aff = await createAffiliate();
      const admin = await createAdmin();
      const res = await agent
        .post(`/api/v1/affiliates/${aff.affiliateId}/w9`)
        .set('Authorization', `Bearer ${adminToken(admin)}`)
        .set('x-csrf-token', csrfToken)
        .attach('w9', PDF, { filename: 'w9.pdf', contentType: 'application/pdf' });
      expect(res.status).toBe(201);
    });

    it('400s when no file is attached', async () => {
      const aff = await createAffiliate();
      const res = await agent
        .post(`/api/v1/affiliates/${aff.affiliateId}/w9`)
        .set('Authorization', `Bearer ${affiliateToken(aff)}`)
        .set('x-csrf-token', csrfToken)
        .send({});
      expect(res.status).toBe(400);
    });

    it('re-upload deletes the prior encrypted file (no orphans)', async () => {
      const aff = await createAffiliate();
      const token = affiliateToken(aff);

      await agent.post(`/api/v1/affiliates/${aff.affiliateId}/w9`)
        .set('Authorization', `Bearer ${token}`).set('x-csrf-token', csrfToken)
        .attach('w9', PDF, { filename: 'w9-v1.pdf', contentType: 'application/pdf' });
      const first = (await Affiliate.findOne({ affiliateId: aff.affiliateId })).w9Document.storageKey;
      expect(fs.existsSync(path.join(tmpRoot, first))).toBe(true);

      await agent.post(`/api/v1/affiliates/${aff.affiliateId}/w9`)
        .set('Authorization', `Bearer ${token}`).set('x-csrf-token', csrfToken)
        .attach('w9', Buffer.concat([PDF, Buffer.from(' v2')]), { filename: 'w9-v2.pdf', contentType: 'application/pdf' });
      const second = (await Affiliate.findOne({ affiliateId: aff.affiliateId })).w9Document.storageKey;

      expect(second).not.toBe(first);
      expect(fs.existsSync(path.join(tmpRoot, first))).toBe(false);   // old file gone
      expect(fs.existsSync(path.join(tmpRoot, second))).toBe(true);
    });

    it('403s without a CSRF token (critical endpoint)', async () => {
      const aff = await createAffiliate();
      const res = await request(app)   // plain request: no csrf cookie/header
        .post(`/api/v1/affiliates/${aff.affiliateId}/w9`)
        .set('Authorization', `Bearer ${affiliateToken(aff)}`)
        .attach('w9', PDF, { filename: 'w9.pdf', contentType: 'application/pdf' });
      expect(res.status).toBe(403);
    });
  });
  ```
- [ ] Run it — expect failure for the right reason: every request 404s (`Cannot POST /api/v1/affiliates/AFF-.../w9`) because the route does not exist yet (the CSRF test "passes" by accident is acceptable; the rest must fail on 404):
  ```bash
  npm test -- tests/integration/w9Upload.test.js
  ```
- [ ] Implement (a) — create `server/modules/onboarding/w9Controller.js` (full file; the admin handlers used by Tasks 8–9 are included now so `w9Routes.js` is written once — their tests come next):
  ```javascript
  // W-9 upload / status / admin review controller (redesign PR 10 — GREENFIELD).
  // Spec: docs/superpowers/specs/2026-06-08-invite-bag-workflow-redesign-design.md
  // §4.3 (storage + fields), §5 (API), §6.2 (subsystem), §9 (audit/RBAC).
  //
  // Bytes flow: multer memoryStorage (middleware/uploadW9.js) -> req.file.buffer
  // -> secureFileStore.storeEncrypted (AES-256-GCM self-framed file under
  // W9_STORAGE_PATH) -> only metadata persisted on Affiliate.w9Document.

  const path = require('path');
  const Affiliate = require('../../models/Affiliate');
  const secureFileStore = require('../../services/secureFileStore');
  const affiliatePaymentLockService = require('../../services/affiliatePaymentLockService');
  const onboardingEmails = require('../../services/email/dispatcher/onboarding');
  const ControllerHelpers = require('../../utils/controllerHelpers');
  const { logAuditEvent, AuditEvents } = require('../../utils/auditLogger');
  const logger = require('../../utils/logger');

  /** Strip directories + dangerous chars from a client filename. */
  function sanitizeFilename(name) {
    return path.basename(String(name || 'w9')).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
  }

  async function sendStatusEmailBestEffort(affiliate, status, opts) {
    try {
      await onboardingEmails.sendAffiliateW9StatusEmail(affiliate, status, opts);
    } catch (emailError) {
      logger.warn('W-9 status email failed (continuing)', {
        affiliateId: affiliate.affiliateId, status, error: emailError.message
      });
    }
  }

  /**
   * POST /api/v1/affiliates/:affiliateId/w9 — self affiliate OR administrator.
   * Multipart field 'w9' (middleware/uploadW9.js). Re-upload deletes the prior
   * encrypted file (spec §6.2 — no orphan files). 201 -> pending_review.
   */
  exports.uploadW9 = ControllerHelpers.asyncWrapper(async (req, res) => {
    const { affiliateId } = req.params;

    const isSelf = req.user.role === 'affiliate' && req.user.affiliateId === affiliateId;
    const isAdmin = req.user.role === 'administrator' || req.user.role === 'admin';
    if (!isSelf && !isAdmin) {
      return ControllerHelpers.sendError(res, 'Unauthorized', 403);
    }

    if (!req.file || !req.file.buffer) {
      return ControllerHelpers.sendError(res, 'A W-9 file is required (multipart field "w9")', 400);
    }

    const affiliate = await Affiliate.findOne({ affiliateId });
    if (!affiliate) return ControllerHelpers.sendError(res, 'Affiliate not found', 404);

    // Re-upload cleanup: remove the previous encrypted file before replacing.
    if (affiliate.w9Document && affiliate.w9Document.storageKey) {
      try {
        await secureFileStore.deleteFile(affiliate.w9Document.storageKey);
      } catch (cleanupError) {
        logger.warn('Failed to delete prior W-9 file (continuing)', {
          affiliateId, storageKey: affiliate.w9Document.storageKey, error: cleanupError.message
        });
      }
    }

    const { storageKey, sha256 } = await secureFileStore.storeEncrypted(req.file.buffer, {
      affiliateId,
      contentType: req.file.mimetype,
      filename: req.file.originalname
    });

    const now = new Date();
    affiliate.w9Document = {
      storageKey,
      filename: sanitizeFilename(req.file.originalname),
      contentType: req.file.mimetype,
      sizeBytes: req.file.size,
      sha256,
      submittedAt: now
    };
    affiliate.w9Status = 'pending_review';
    affiliate.w9SubmittedAt = now;
    await affiliate.save();

    logAuditEvent(AuditEvents.W9_UPLOADED, {
      affiliateId, storageKey, sizeBytes: req.file.size, contentType: req.file.mimetype
    }, req);

    await sendStatusEmailBestEffort(affiliate, 'received');

    return ControllerHelpers.sendSuccess(res, {
      w9Status: affiliate.w9Status,
      submittedAt: affiliate.w9SubmittedAt
    }, 'W-9 uploaded and pending review', 201);
  });

  /** GET /api/v1/w9/status — affiliate (self). */
  exports.getW9Status = ControllerHelpers.asyncWrapper(async (req, res) => {
    const affiliate = await Affiliate.findOne({ affiliateId: req.user.affiliateId })
      .select('w9Status w9SubmittedAt w9RejectedReason');
    if (!affiliate) return ControllerHelpers.sendError(res, 'Affiliate not found', 404);
    return ControllerHelpers.sendSuccess(res, {
      w9Status: affiliate.w9Status,
      submittedAt: affiliate.w9SubmittedAt || null,
      rejectedReason: affiliate.w9Status === 'rejected' ? (affiliate.w9RejectedReason || null) : null
    }, 'W-9 status');
  });

  /** GET /api/v1/w9/admin/pending — administrator + manage_affiliates. */
  exports.getPendingW9s = ControllerHelpers.asyncWrapper(async (req, res) => {
    const affiliates = await Affiliate.find({ w9Status: 'pending_review' })
      .select('affiliateId firstName lastName businessName email w9SubmittedAt '
            + 'w9Document.filename w9Document.contentType w9Document.sizeBytes')
      .sort('w9SubmittedAt');
    return ControllerHelpers.sendSuccess(res, { affiliates }, 'Pending W-9 reviews');
  });

  /**
   * GET /api/v1/w9/admin/:affiliateId/document — administrator + manage_affiliates.
   * Streams DECRYPTED bytes: Content-Disposition attachment + nosniff, never
   * inlined, audit-logged on EVERY read (spec §9). Decrypt/integrity failure
   * -> 500 + SUSPICIOUS_ACTIVITY audit.
   */
  exports.downloadW9 = ControllerHelpers.asyncWrapper(async (req, res) => {
    const { affiliateId } = req.params;
    const affiliate = await Affiliate.findOne({ affiliateId });
    if (!affiliate || !affiliate.w9Document || !affiliate.w9Document.storageKey) {
      return ControllerHelpers.sendError(res, 'No W-9 document on file', 404);
    }

    let plaintext;
    try {
      plaintext = await secureFileStore.readDecrypted(affiliate.w9Document.storageKey, {
        expectedSha256: affiliate.w9Document.sha256
      });
    } catch (err) {
      logAuditEvent(AuditEvents.SUSPICIOUS_ACTIVITY, {
        activityType: 'W9_DECRYPT_FAILED',
        affiliateId,
        storageKey: affiliate.w9Document.storageKey
      }, req);
      logger.error('W-9 decrypt/integrity failure', { affiliateId, error: err.message });
      return ControllerHelpers.sendError(res, 'Unable to read W-9 document', 500);
    }

    logAuditEvent(AuditEvents.W9_DOCUMENT_ACCESSED, {
      affiliateId, storageKey: affiliate.w9Document.storageKey
    }, req);

    res.setHeader('Content-Type', affiliate.w9Document.contentType || 'application/octet-stream');
    res.setHeader('Content-Disposition',
      `attachment; filename="${affiliate.w9Document.filename || 'w9'}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');
    return res.send(plaintext);
  });

  /**
   * POST /api/v1/w9/admin/:affiliateId/verify — administrator + manage_affiliates.
   * pending_review -> on_file; unlocks payments when locked for 'w9_required'
   * via the EXISTING affiliatePaymentLockService.unlockPayments (which itself
   * re-asserts w9Status='on_file' for the w9_required case — idempotent).
   */
  exports.verifyW9 = ControllerHelpers.asyncWrapper(async (req, res) => {
    const { affiliateId } = req.params;
    const affiliate = await Affiliate.findOne({ affiliateId });
    if (!affiliate) return ControllerHelpers.sendError(res, 'Affiliate not found', 404);
    if (affiliate.w9Status !== 'pending_review') {
      return ControllerHelpers.sendError(res,
        `W-9 is not pending review (current status: ${affiliate.w9Status})`, 409);
    }

    const now = new Date();
    affiliate.w9Status = 'on_file';
    affiliate.w9OnFileAt = now;
    affiliate.w9VerifiedAt = now;
    affiliate.w9VerifiedBy = req.user.id;
    await affiliate.save();

    let paymentsUnlocked = false;
    if (affiliate.paymentProcessingLocked && affiliate.paymentLockReason === 'w9_required') {
      await affiliatePaymentLockService.unlockPayments({
        affiliateId,
        notes: 'W-9 verified via in-app admin review (PR10 W-9 surface)',
        w9Received: true,
        adminId: req.user.id
      });
      paymentsUnlocked = true;
    }

    logAuditEvent(AuditEvents.W9_VERIFIED, { affiliateId, paymentsUnlocked }, req);
    await sendStatusEmailBestEffort(affiliate, 'verified');

    return ControllerHelpers.sendSuccess(res,
      { w9Status: 'on_file', paymentsUnlocked }, 'W-9 verified');
  });

  /**
   * POST /api/v1/w9/admin/:affiliateId/reject — administrator + manage_affiliates.
   * Requires body.reason. The encrypted file is NOT deleted here — it is
   * replaced (and the old one deleted) on the affiliate's re-upload.
   */
  exports.rejectW9 = ControllerHelpers.asyncWrapper(async (req, res) => {
    const { affiliateId } = req.params;
    const reason = ((req.body && req.body.reason) || '').trim();
    if (!reason) return ControllerHelpers.sendError(res, 'A rejection reason is required', 400);

    const affiliate = await Affiliate.findOne({ affiliateId });
    if (!affiliate) return ControllerHelpers.sendError(res, 'Affiliate not found', 404);
    if (affiliate.w9Status !== 'pending_review') {
      return ControllerHelpers.sendError(res,
        `W-9 is not pending review (current status: ${affiliate.w9Status})`, 409);
    }

    affiliate.w9Status = 'rejected';
    affiliate.w9RejectedAt = new Date();
    affiliate.w9RejectedReason = reason;
    await affiliate.save();

    logAuditEvent(AuditEvents.W9_REJECTED, { affiliateId, reason }, req);
    await sendStatusEmailBestEffort(affiliate, 'rejected', { reason });

    return ControllerHelpers.sendSuccess(res, { w9Status: 'rejected' }, 'W-9 rejected');
  });
  ```
- [ ] Implement (b) — create `server/routes/w9Routes.js`:
  ```javascript
  // W-9 routes (redesign PR 10 — GREENFIELD). Mounted at /api/v1/w9.
  // The upload route lives in affiliateRoutes.js (path is /affiliates/:id/w9).
  const express = require('express');
  const router = express.Router();
  const w9Controller = require('../modules/onboarding/w9Controller');
  const { authenticate, authorize } = require('../middleware/auth');
  const { checkAdminPermission } = require('../middleware/rbac');

  // Affiliate self-service
  router.get('/status', authenticate, authorize('affiliate'), w9Controller.getW9Status);

  // Admin review surface — single permission key for the whole
  // admin-manages-affiliates workflow: manage_affiliates (spec §6.1 rationale).
  router.get('/admin/pending', authenticate,
    checkAdminPermission(['manage_affiliates']), w9Controller.getPendingW9s);
  router.get('/admin/:affiliateId/document', authenticate,
    checkAdminPermission(['manage_affiliates']), w9Controller.downloadW9);
  router.post('/admin/:affiliateId/verify', authenticate,
    checkAdminPermission(['manage_affiliates']), w9Controller.verifyW9);
  router.post('/admin/:affiliateId/reject', authenticate,
    checkAdminPermission(['manage_affiliates']), w9Controller.rejectW9);

  module.exports = router;
  ```
- [ ] Implement (c) — in `server/routes/affiliateRoutes.js`, add the requires near the top (after the existing `require` block):
  ```javascript
  const uploadW9 = require('../middleware/uploadW9');
  const { fileUploadLimiter } = require('../middleware/rateLimiting');
  const w9Controller = require('../modules/onboarding/w9Controller');
  ```
  (If `fileUploadLimiter` is already destructured from `rateLimiting` in this file post-PR-9, extend that destructuring instead of adding a duplicate require.) Then add the route immediately before the final `module.exports = router;`:
  ```javascript
  /**
   * @route   POST /api/v1/affiliates/:affiliateId/w9
   * @desc    Upload (or re-upload) an encrypted W-9 — self affiliate or administrator
   * @access  Private (CSRF-enforced; multipart field 'w9'; fileUploadLimiter)
   */
  router.post('/:affiliateId/w9', fileUploadLimiter, authenticate, uploadW9, w9Controller.uploadW9);
  ```
- [ ] Implement (d) — in `server.js`, add the mount directly after the existing line `apiV1Router.use('/quickbooks', quickbooksRoutes);  // QuickBooks export functionality` (line 963 on current main; the Paygistix mount that followed it was deleted in PR 1):
  ```javascript
  apiV1Router.use('/w9', require('./server/routes/w9Routes'));  // W-9 upload/review (PR10)
  ```
- [ ] Implement (e) — in `server/config/csrf-config.js`, inside `CRITICAL_ENDPOINTS` (currently lines 150–180), append after the `'/api/v1/operators/shift/status'` entry (add a comma to it):
  ```javascript
      // W-9 surface — critical, ALWAYS CSRF (redesign PR 10, spec §9)
      '/api/v1/affiliates/:affiliateId/w9',
      '/api/v1/w9/admin/:affiliateId/verify',
      '/api/v1/w9/admin/:affiliateId/reject'
  ```
- [ ] Run again — expect all 6 tests passing:
  ```bash
  npm test -- tests/integration/w9Upload.test.js
  ```
- [ ] Lint the new server files (no console.*, style): `npx eslint server/modules/onboarding/w9Controller.js server/routes/w9Routes.js server/middleware/uploadW9.js` → no errors.
- [ ] Commit:
  ```bash
  git add server/modules/onboarding/w9Controller.js server/routes/w9Routes.js server/routes/affiliateRoutes.js server.js server/config/csrf-config.js tests/integration/w9Upload.test.js
  git commit -m "feat(w9): upload endpoint + /api/v1/w9 routes, CSRF-critical, audited (PR10)"
  ```

---

## Task 8 — Self status, admin pending list, audited encrypted download (TDD, integration)

Handlers already exist (Task 7); this task proves them: `GET /api/v1/w9/status` (self), `GET /api/v1/w9/admin/pending`, `GET /api/v1/w9/admin/:affiliateId/document` (attachment + nosniff + audit EVERY read), full RBAC denials.

**Files:** Create `tests/integration/w9Admin.test.js`. (Code changes only if a test exposes a defect.)

- [ ] Write the test — create `tests/integration/w9Admin.test.js`:
  ```javascript
  // W-9 status / admin pending / audited document download (spec §5, §9).
  const fs = require('fs');
  const os = require('os');
  const path = require('path');
  const jwt = require('jsonwebtoken');
  const request = require('supertest');

  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'w9-admin-'));
  process.env.W9_STORAGE_PATH = tmpRoot;

  // Wrap logAuditEvent so we can assert the W9_DOCUMENT_ACCESSED audit fires.
  jest.mock('../../server/utils/auditLogger', () => {
    const actual = jest.requireActual('../../server/utils/auditLogger');
    return { ...actual, logAuditEvent: jest.fn(actual.logAuditEvent) };
  });

  const app = require('../../server');
  const Affiliate = require('../../server/models/Affiliate');
  const Administrator = require('../../server/models/Administrator');
  const secureFileStore = require('../../server/services/secureFileStore');
  const { logAuditEvent, AuditEvents } = require('../../server/utils/auditLogger');

  afterAll(() => fs.rmSync(tmpRoot, { recursive: true, force: true }));

  const PDF = Buffer.from('%PDF-1.4 admin-download plaintext payload');

  function tokenFor(user, role, extra = {}) {
    return jwt.sign({ id: user._id.toString(), role, ...extra },
      process.env.JWT_SECRET, { expiresIn: '1h' });
  }
  async function createAffiliate(overrides = {}) {
    const n = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
    return Affiliate.create({
      firstName: 'Aff', lastName: 'One', email: `aff${n}@test.com`, phone: '512-555-0100',
      address: '1 Congress Ave', city: 'Austin', state: 'TX', zipCode: '78701',
      username: `affu${n}`, passwordSalt: 's', passwordHash: 'h', paymentMethod: 'check',
      ...overrides
    });
  }
  async function createAdmin(permissions = ['manage_affiliates']) {
    const n = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
    return Administrator.create({
      firstName: 'Ad', lastName: 'Min', email: `adm${n}@test.com`,
      passwordSalt: 's', passwordHash: 'h', permissions
    });
  }
  /** Seed an affiliate with a real encrypted W-9 on disk (bypasses HTTP). */
  async function seedPendingW9(affiliate) {
    const { storageKey, sha256 } = await secureFileStore.storeEncrypted(PDF, {
      affiliateId: affiliate.affiliateId, contentType: 'application/pdf', filename: 'w9.pdf'
    });
    affiliate.w9Document = {
      storageKey, filename: 'w9.pdf', contentType: 'application/pdf',
      sizeBytes: PDF.length, sha256, submittedAt: new Date()
    };
    affiliate.w9Status = 'pending_review';
    affiliate.w9SubmittedAt = new Date();
    await affiliate.save();
    return affiliate;
  }

  describe('GET /api/v1/w9/status', () => {
    it('returns the caller-affiliate status', async () => {
      const aff = await seedPendingW9(await createAffiliate());
      const res = await request(app)
        .get('/api/v1/w9/status')
        .set('Authorization', `Bearer ${tokenFor(aff, 'affiliate', { affiliateId: aff.affiliateId })}`);
      expect(res.status).toBe(200);
      expect(res.body.w9Status).toBe('pending_review');
      expect(res.body.submittedAt).toBeTruthy();
    });

    it('403s for an administrator (affiliate-only endpoint)', async () => {
      const admin = await createAdmin();
      const res = await request(app)
        .get('/api/v1/w9/status')
        .set('Authorization', `Bearer ${tokenFor(admin, 'administrator')}`);
      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/v1/w9/admin/pending', () => {
    it('lists only pending_review affiliates, oldest first', async () => {
      const pending = await seedPendingW9(await createAffiliate());
      await createAffiliate({ w9Status: 'on_file' });
      await createAffiliate(); // not_required
      const admin = await createAdmin();

      const res = await request(app)
        .get('/api/v1/w9/admin/pending')
        .set('Authorization', `Bearer ${tokenFor(admin, 'administrator')}`);
      expect(res.status).toBe(200);
      expect(res.body.affiliates).toHaveLength(1);
      expect(res.body.affiliates[0].affiliateId).toBe(pending.affiliateId);
      expect(res.body.affiliates[0].w9Document.filename).toBe('w9.pdf');
    });

    it('403s for an affiliate token', async () => {
      const aff = await createAffiliate();
      const res = await request(app)
        .get('/api/v1/w9/admin/pending')
        .set('Authorization', `Bearer ${tokenFor(aff, 'affiliate', { affiliateId: aff.affiliateId })}`);
      expect(res.status).toBe(403);
    });

    it('403s for an administrator WITHOUT manage_affiliates', async () => {
      const admin = await createAdmin(['view_analytics']);
      const res = await request(app)
        .get('/api/v1/w9/admin/pending')
        .set('Authorization', `Bearer ${tokenFor(admin, 'administrator')}`);
      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/v1/w9/admin/:affiliateId/document', () => {
    it('streams the decrypted bytes with attachment + nosniff and audits the read', async () => {
      const aff = await seedPendingW9(await createAffiliate());
      const admin = await createAdmin();
      logAuditEvent.mockClear();

      const res = await request(app)
        .get(`/api/v1/w9/admin/${aff.affiliateId}/document`)
        .set('Authorization', `Bearer ${tokenFor(admin, 'administrator')}`)
        .buffer(true)
        .parse((res2, cb) => {
          const chunks = [];
          res2.on('data', (c) => chunks.push(c));
          res2.on('end', () => cb(null, Buffer.concat(chunks)));
        });

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/application\/pdf/);
      expect(res.headers['content-disposition']).toMatch(/^attachment/);
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(Buffer.compare(res.body, PDF)).toBe(0);   // exact plaintext round-trip

      expect(logAuditEvent).toHaveBeenCalledWith(
        AuditEvents.W9_DOCUMENT_ACCESSED,
        expect.objectContaining({ affiliateId: aff.affiliateId }),
        expect.anything()
      );
    });

    it('404s when the affiliate has no document on file', async () => {
      const aff = await createAffiliate();
      const admin = await createAdmin();
      const res = await request(app)
        .get(`/api/v1/w9/admin/${aff.affiliateId}/document`)
        .set('Authorization', `Bearer ${tokenFor(admin, 'administrator')}`);
      expect(res.status).toBe(404);
    });

    it('500s + SUSPICIOUS_ACTIVITY audit on a tampered file', async () => {
      const aff = await seedPendingW9(await createAffiliate());
      const admin = await createAdmin();
      const abs = path.join(tmpRoot, aff.w9Document.storageKey);
      const framed = fs.readFileSync(abs);
      framed[20] ^= 0xff; // corrupt the authTag
      fs.writeFileSync(abs, framed);
      logAuditEvent.mockClear();

      const res = await request(app)
        .get(`/api/v1/w9/admin/${aff.affiliateId}/document`)
        .set('Authorization', `Bearer ${tokenFor(admin, 'administrator')}`);
      expect(res.status).toBe(500);
      expect(logAuditEvent).toHaveBeenCalledWith(
        AuditEvents.SUSPICIOUS_ACTIVITY,
        expect.objectContaining({ activityType: 'W9_DECRYPT_FAILED' }),
        expect.anything()
      );
    });
  });
  ```
- [ ] Run it — these handlers were implemented in Task 7, so expect ALL passing on the first run. If anything fails, fix the controller (not the test) — the test encodes the spec. Common trap: if the audit assertion fails because the controller captured `logAuditEvent` before the mock, make sure the test's `jest.mock` stays ABOVE the `require('../../server')` line.
  ```bash
  npm test -- tests/integration/w9Admin.test.js
  ```
- [ ] Commit:
  ```bash
  git add tests/integration/w9Admin.test.js
  git commit -m "test(w9): status, admin pending, audited encrypted download + RBAC denials (PR10)"
  ```

---

## Task 9 — Admin verify / reject + payment-lock integration (TDD, integration)

Proves the full review loop: verify → `on_file` (+ `unlockPayments` when locked for `w9_required`), reject (+ reason, email) → re-upload → `pending_review` again. This is the spec §11 "full upload→pending→verify→unlock integration" test.

**Files:** Create `tests/integration/w9Review.test.js`. (Handlers exist from Task 7 — fix the controller only if a test exposes a defect.)

- [ ] Write the test — create `tests/integration/w9Review.test.js`:
  ```javascript
  // W-9 admin verify/reject + affiliatePaymentLockService integration
  // (spec §6.2 W-9 lifecycle + §11). unlockPayments was READ before writing
  // this: it throws without notes, and itself sets w9Status='on_file' when
  // paymentLockReason === 'w9_required' && w9Received.
  const fs = require('fs');
  const os = require('os');
  const path = require('path');
  const jwt = require('jsonwebtoken');
  const request = require('supertest');

  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'w9-review-'));
  process.env.W9_STORAGE_PATH = tmpRoot;

  jest.mock('../../server/services/email/dispatcher/onboarding', () => ({
    ...jest.requireActual('../../server/services/email/dispatcher/onboarding'),
    sendAffiliateW9StatusEmail: jest.fn().mockResolvedValue(undefined)
  }));

  const app = require('../../server');
  const Affiliate = require('../../server/models/Affiliate');
  const Administrator = require('../../server/models/Administrator');
  const secureFileStore = require('../../server/services/secureFileStore');
  const onboardingEmails = require('../../server/services/email/dispatcher/onboarding');
  const { getCsrfToken } = require('../helpers/csrfHelper');

  afterAll(() => fs.rmSync(tmpRoot, { recursive: true, force: true }));

  const PDF = Buffer.from('%PDF-1.4 review-loop plaintext payload');

  function tokenFor(user, role, extra = {}) {
    return jwt.sign({ id: user._id.toString(), role, ...extra },
      process.env.JWT_SECRET, { expiresIn: '1h' });
  }
  async function createAffiliate(overrides = {}) {
    const n = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
    return Affiliate.create({
      firstName: 'Aff', lastName: 'One', email: `aff${n}@test.com`, phone: '512-555-0100',
      address: '1 Congress Ave', city: 'Austin', state: 'TX', zipCode: '78701',
      username: `affu${n}`, passwordSalt: 's', passwordHash: 'h', paymentMethod: 'check',
      ...overrides
    });
  }
  async function createAdmin(permissions = ['manage_affiliates']) {
    const n = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
    return Administrator.create({
      firstName: 'Ad', lastName: 'Min', email: `adm${n}@test.com`,
      passwordSalt: 's', passwordHash: 'h', permissions
    });
  }
  async function seedPendingW9(affiliate) {
    const { storageKey, sha256 } = await secureFileStore.storeEncrypted(PDF, {
      affiliateId: affiliate.affiliateId, contentType: 'application/pdf', filename: 'w9.pdf'
    });
    affiliate.w9Document = {
      storageKey, filename: 'w9.pdf', contentType: 'application/pdf',
      sizeBytes: PDF.length, sha256, submittedAt: new Date()
    };
    affiliate.w9Status = 'pending_review';
    affiliate.w9SubmittedAt = new Date();
    await affiliate.save();
    return affiliate;
  }

  describe('W-9 admin review loop', () => {
    let agent, csrfToken, admin, adminAuth;
    beforeEach(async () => {
      onboardingEmails.sendAffiliateW9StatusEmail.mockClear();
      agent = request.agent(app);
      csrfToken = await getCsrfToken(app, agent);
      admin = await createAdmin();
      adminAuth = `Bearer ${tokenFor(admin, 'administrator')}`;
    });

    it('verify: pending_review -> on_file + unlockPayments when locked for w9_required', async () => {
      const aff = await seedPendingW9(await createAffiliate({
        paymentProcessingLocked: true,
        paymentLockedAt: new Date(),
        paymentLockReason: 'w9_required'
      }));

      const res = await agent
        .post(`/api/v1/w9/admin/${aff.affiliateId}/verify`)
        .set('Authorization', adminAuth)
        .set('x-csrf-token', csrfToken)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.w9Status).toBe('on_file');
      expect(res.body.paymentsUnlocked).toBe(true);

      const saved = await Affiliate.findOne({ affiliateId: aff.affiliateId });
      expect(saved.w9Status).toBe('on_file');
      expect(saved.w9OnFileAt).toBeInstanceOf(Date);
      expect(saved.w9VerifiedAt).toBeInstanceOf(Date);
      expect(saved.w9VerifiedBy.toString()).toBe(admin._id.toString());
      expect(saved.paymentProcessingLocked).toBe(false);       // ← the unlock
      expect(saved.paymentUnlockedAt).toBeInstanceOf(Date);
      expect(saved.paymentUnlockedBy.toString()).toBe(admin._id.toString());

      expect(onboardingEmails.sendAffiliateW9StatusEmail)
        .toHaveBeenCalledWith(expect.objectContaining({ affiliateId: aff.affiliateId }), 'verified');
    });

    it('verify: does NOT touch the lock when locked for a non-W9 reason', async () => {
      const aff = await seedPendingW9(await createAffiliate({
        paymentProcessingLocked: true, paymentLockReason: 'compliance_review'
      }));
      const res = await agent
        .post(`/api/v1/w9/admin/${aff.affiliateId}/verify`)
        .set('Authorization', adminAuth).set('x-csrf-token', csrfToken).send({});
      expect(res.status).toBe(200);
      expect(res.body.paymentsUnlocked).toBe(false);
      const saved = await Affiliate.findOne({ affiliateId: aff.affiliateId });
      expect(saved.paymentProcessingLocked).toBe(true);        // untouched
      expect(saved.w9Status).toBe('on_file');
    });

    it('verify on a non-pending W-9 -> 409', async () => {
      const aff = await createAffiliate({ w9Status: 'on_file' });
      const res = await agent
        .post(`/api/v1/w9/admin/${aff.affiliateId}/verify`)
        .set('Authorization', adminAuth).set('x-csrf-token', csrfToken).send({});
      expect(res.status).toBe(409);
    });

    it('verify without a CSRF token -> 403 (critical endpoint)', async () => {
      const aff = await seedPendingW9(await createAffiliate());
      const res = await request(app)
        .post(`/api/v1/w9/admin/${aff.affiliateId}/verify`)
        .set('Authorization', adminAuth).send({});
      expect(res.status).toBe(403);
    });

    it('reject requires a reason -> 400 without one', async () => {
      const aff = await seedPendingW9(await createAffiliate());
      const res = await agent
        .post(`/api/v1/w9/admin/${aff.affiliateId}/reject`)
        .set('Authorization', adminAuth).set('x-csrf-token', csrfToken).send({});
      expect(res.status).toBe(400);
    });

    it('reject -> rejected + reason + email; re-upload returns to pending_review', async () => {
      const aff = await seedPendingW9(await createAffiliate());

      const rej = await agent
        .post(`/api/v1/w9/admin/${aff.affiliateId}/reject`)
        .set('Authorization', adminAuth).set('x-csrf-token', csrfToken)
        .send({ reason: 'Signature missing on line 6' });
      expect(rej.status).toBe(200);

      let saved = await Affiliate.findOne({ affiliateId: aff.affiliateId });
      expect(saved.w9Status).toBe('rejected');
      expect(saved.w9RejectedReason).toBe('Signature missing on line 6');
      expect(saved.w9RejectedAt).toBeInstanceOf(Date);
      expect(onboardingEmails.sendAffiliateW9StatusEmail).toHaveBeenCalledWith(
        expect.objectContaining({ affiliateId: aff.affiliateId }),
        'rejected', { reason: 'Signature missing on line 6' });

      // Re-upload loop: rejected -> pending_review, old file replaced
      const oldKey = saved.w9Document.storageKey;
      const up = await agent
        .post(`/api/v1/affiliates/${aff.affiliateId}/w9`)
        .set('Authorization', `Bearer ${tokenFor(aff, 'affiliate', { affiliateId: aff.affiliateId })}`)
        .set('x-csrf-token', csrfToken)
        .attach('w9', Buffer.concat([PDF, Buffer.from(' corrected')]),
          { filename: 'w9-corrected.pdf', contentType: 'application/pdf' });
      expect(up.status).toBe(201);

      saved = await Affiliate.findOne({ affiliateId: aff.affiliateId });
      expect(saved.w9Status).toBe('pending_review');
      expect(saved.w9Document.storageKey).not.toBe(oldKey);
      expect(fs.existsSync(path.join(tmpRoot, oldKey))).toBe(false); // no orphan
    });

    it('verify/reject 403 for an affiliate token and for an admin without manage_affiliates', async () => {
      const aff = await seedPendingW9(await createAffiliate());
      const weakAdmin = await createAdmin(['view_analytics']);

      for (const [auth, name] of [
        [`Bearer ${tokenFor(aff, 'affiliate', { affiliateId: aff.affiliateId })}`, 'affiliate'],
        [`Bearer ${tokenFor(weakAdmin, 'administrator')}`, 'weak admin']
      ]) {
        const v = await agent.post(`/api/v1/w9/admin/${aff.affiliateId}/verify`)
          .set('Authorization', auth).set('x-csrf-token', csrfToken).send({});
        expect(v.status).toBe(403);
        const r = await agent.post(`/api/v1/w9/admin/${aff.affiliateId}/reject`)
          .set('Authorization', auth).set('x-csrf-token', csrfToken).send({ reason: 'x' });
        expect(r.status).toBe(403);
      }
    });
  });
  ```
- [ ] Run it — handlers exist from Task 7, so expect ALL passing on the first run; if a failure appears, fix the controller against the spec (the most likely defect: `unlockPayments` called before the affiliate `save()` causing a stale overwrite — the Task 7 implementation saves first, then unlocks, exactly to avoid that):
  ```bash
  npm test -- tests/integration/w9Review.test.js
  ```
- [ ] Commit:
  ```bash
  git add tests/integration/w9Review.test.js
  git commit -m "test(w9): verify/reject review loop + payment-lock unlock integration (PR10)"
  ```

---

## Task 10 — Optional multipart W-9 at invited registration (TDD, integration)

`POST /api/v1/affiliates/register` (invite-bound since PR 5, CSRF-exempt registration endpoint) gains the optional multipart field `w9`: when present, store encrypted and set `w9Status='pending_review'` **before** the affiliate save (spec §6.2 `registerAffiliate` rework, W-9 half).

**Files:** Create `tests/integration/affiliateRegisterW9.test.js`; Modify `server/routes/affiliateRoutes.js` (register route), `server/controllers/affiliateController.js` (`registerAffiliate` + requires).

- [ ] Write the failing test — create `tests/integration/affiliateRegisterW9.test.js`:
  ```javascript
  // Invited registration with an optional multipart W-9 (spec §6.2).
  // ASSUMES PR 5: AffiliateInvite at server/modules/onboarding/AffiliateInvite.js
  // (statics: hashToken(raw) = sha256 hex), registration requires inviteToken,
  // and email is forced from the invite.
  const fs = require('fs');
  const os = require('os');
  const path = require('path');
  const jwt = require('jsonwebtoken');
  const request = require('supertest');
  const { v4: uuidv4 } = require('uuid');

  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'w9-register-'));
  process.env.W9_STORAGE_PATH = tmpRoot;

  const app = require('../../server');
  const Affiliate = require('../../server/models/Affiliate');
  const Administrator = require('../../server/models/Administrator');
  const AffiliateInvite = require('../../server/modules/onboarding/AffiliateInvite');
  const encryptionUtil = require('../../server/utils/encryption');

  afterAll(() => fs.rmSync(tmpRoot, { recursive: true, force: true }));

  const PDF = Buffer.from('%PDF-1.4 registration w9 plaintext payload');

  async function mintInvite(email) {
    const admin = await Administrator.create({
      firstName: 'Ad', lastName: 'Min', email: `adm${Date.now()}${Math.random()}@test.com`,
      passwordSalt: 's', passwordHash: 'h', permissions: ['manage_affiliates']
    });
    const rawToken = encryptionUtil.generateToken(32);            // 64 hex (canon)
    await AffiliateInvite.create({
      inviteId: 'INV-' + uuidv4(),
      tokenHash: AffiliateInvite.hashToken(rawToken),
      email,
      status: 'pending',
      expiresAt: new Date(Date.now() + 72 * 3600 * 1000),
      createdBy: admin._id
    });
    return rawToken;
  }

  /** Multipart-friendly field map for the invited-registration form. */
  function registrationFields(inviteToken, n) {
    return {
      inviteToken,
      firstName: 'Reg', lastName: 'Ister', phone: '512-555-0100',
      businessName: 'Reg LLC', address: '1 Congress Ave', city: 'Austin',
      state: 'TX', zipCode: '78701',
      username: `regu${n}`, password: 'StrongP@ssw0rd!2026',
      paymentMethod: 'check', languagePreference: 'en'
    };
  }

  describe('POST /api/v1/affiliates/register with multipart W-9', () => {
    it('registers and stores the W-9 -> w9Status pending_review', async () => {
      const n = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
      const email = `invitee${n}@test.com`;
      const inviteToken = await mintInvite(email);

      let req = request(app).post('/api/v1/affiliates/register');
      for (const [k, v] of Object.entries(registrationFields(inviteToken, n))) {
        req = req.field(k, v);
      }
      const res = await req.attach('w9', PDF, { filename: 'w9.pdf', contentType: 'application/pdf' });

      expect(res.status).toBe(201);
      const saved = await Affiliate.findOne({ email });
      expect(saved).toBeTruthy();
      expect(saved.w9Status).toBe('pending_review');
      expect(saved.w9SubmittedAt).toBeInstanceOf(Date);
      expect(saved.w9Document.storageKey).toMatch(new RegExp(`^aff/${saved.affiliateId}/`));

      const onDisk = fs.readFileSync(path.join(tmpRoot, saved.w9Document.storageKey));
      expect(onDisk.includes(PDF)).toBe(false);   // encrypted at rest
    });

    it('still registers WITHOUT a W-9 -> w9Status stays not_required (JSON body)', async () => {
      const n = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
      const email = `invitee${n}@test.com`;
      const inviteToken = await mintInvite(email);

      const res = await request(app)
        .post('/api/v1/affiliates/register')
        .send(registrationFields(inviteToken, n));

      expect(res.status).toBe(201);
      const saved = await Affiliate.findOne({ email });
      expect(saved.w9Status).toBe('not_required');
      expect(saved.w9Document ? saved.w9Document.storageKey : undefined).toBeUndefined();
    });

    it('rejects an SVG W-9 at registration with 400', async () => {
      const n = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
      const inviteToken = await mintInvite(`invitee${n}@test.com`);

      let req = request(app).post('/api/v1/affiliates/register');
      for (const [k, v] of Object.entries(registrationFields(inviteToken, n))) {
        req = req.field(k, v);
      }
      const res = await req.attach('w9', Buffer.from('<svg/>'),
        { filename: 'w9.svg', contentType: 'image/svg+xml' });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('W9_INVALID_FILE_TYPE');
      // No affiliate may be created off a rejected multipart parse
      expect(await Affiliate.findOne({ username: `regu${n}` })).toBeNull();
    });
  });
  ```
- [ ] Run it — expect failure for the right reason: test 1 fails because the multipart form-fields never reach the validators (no multer on the route → `req.body` empty → 400 validation errors), test 3 fails because the SVG is not rejected with `W9_INVALID_FILE_TYPE`. Test 2 (JSON) should already pass (PR 5 behavior).
  ```bash
  npm test -- tests/integration/affiliateRegisterW9.test.js
  ```
- [ ] Implement (a) — `server/routes/affiliateRoutes.js`: in the `router.post('/register', ...)` call, insert `uploadW9` immediately after `registrationLimiter` (multer must parse the multipart body BEFORE the express-validator `body()` checks; non-multipart JSON passes through untouched — proven in Task 5):
  ```javascript
  router.post('/register', registrationLimiter, uploadW9, [
  ```
  (Only the middleware list changes; the PR-5 validator array and handler stay as they are.)
- [ ] Implement (b) — `server/controllers/affiliateController.js`:
  1. Add to the require block at the top of the file (alongside the existing `encryptionUtil`/`emailService` requires):
     ```javascript
     const secureFileStore = require('../services/secureFileStore');
     const { logAuditEvent, AuditEvents } = require('../utils/auditLogger');
     ```
     (If PR 5 already imports `logAuditEvent`/`AuditEvents` here, skip that line.)
  2. Inside `registerAffiliate`, insert this block **after the `new Affiliate({...})` construction and BEFORE `await newAffiliate.save()`** (the post-PR-5 flow is: validate invite → build `newAffiliate` → save → consume invite; `affiliateId` is set at construction by the schema default `'AFF-' + uuidv4()`, so it is available pre-save):
     ```javascript
     // Optional W-9 uploaded with the invited registration (multipart field 'w9').
     // Stored encrypted BEFORE save so a storage failure aborts registration
     // cleanly (no affiliate row pointing at a missing file). Spec §6.2.
     if (req.file && req.file.buffer) {
       const { storageKey, sha256 } = await secureFileStore.storeEncrypted(req.file.buffer, {
         affiliateId: newAffiliate.affiliateId,
         contentType: req.file.mimetype,
         filename: req.file.originalname
       });
       const w9Now = new Date();
       newAffiliate.w9Document = {
         storageKey,
         filename: require('path').basename(String(req.file.originalname || 'w9'))
           .replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120),
         contentType: req.file.mimetype,
         sizeBytes: req.file.size,
         sha256,
         submittedAt: w9Now
       };
       newAffiliate.w9Status = 'pending_review';
       newAffiliate.w9SubmittedAt = w9Now;
       logAuditEvent(AuditEvents.W9_UPLOADED, {
         affiliateId: newAffiliate.affiliateId, storageKey, context: 'invited_registration'
       }, req);
     }
     ```
     (Inline `require('path')` keeps this a one-block insertion; if you prefer, hoist `const path = require('path');` to the top — either satisfies lint.)
- [ ] Run again — expect 3 passing:
  ```bash
  npm test -- tests/integration/affiliateRegisterW9.test.js
  ```
- [ ] Regression: the PR-5 invite registration suite must still pass (multer pass-through must not break the JSON path):
  ```bash
  npm test -- tests/integration/affiliateInvites.test.js
  ```
  (If PR 5 named its suite differently, run the file that covers `/api/v1/affiliates/register`.)
- [ ] Commit:
  ```bash
  git add server/routes/affiliateRoutes.js server/controllers/affiliateController.js tests/integration/affiliateRegisterW9.test.js
  git commit -m "feat(affiliate): optional encrypted W-9 upload at invited registration (PR10)"
  ```

---

## Task 11 — `affiliateRegister.w9.*` i18n keys in all four languages (TDD)

Spec §10 client keys for the registration upload UI (the form wiring itself ships with the PR 11 frontend pass; the keys ship NOW so copy and code never split): `uploadLabel`, `fileTypeHint`, `tooLarge`, `wrongType`, `optionalNote`.

**Files:** Create `tests/unit/i18nW9Keys.test.js`; Modify `public/locales/en/common.json`, `public/locales/es/common.json`, `public/locales/pt/common.json`, `public/locales/de/common.json`.

- [ ] Write the failing test — create `tests/unit/i18nW9Keys.test.js`:
  ```javascript
  // affiliateRegister.w9.* must ship in en/es/pt/de in the SAME commit (house rule).
  const fs = require('fs');
  const path = require('path');

  describe('affiliateRegister.w9 i18n keys', () => {
    const langs = ['en', 'es', 'pt', 'de'];
    const required = ['uploadLabel', 'fileTypeHint', 'tooLarge', 'wrongType', 'optionalNote'];

    it.each(langs)('%s/common.json ships every affiliateRegister.w9 key', (lang) => {
      const file = path.join(__dirname, `../../public/locales/${lang}/common.json`);
      const json = JSON.parse(fs.readFileSync(file, 'utf8'));
      const w9 = json.affiliateRegister && json.affiliateRegister.w9;
      expect(w9).toBeDefined();
      for (const key of required) {
        expect(typeof w9[key]).toBe('string');
        expect(w9[key].length).toBeGreaterThan(0);
      }
    });

    it('non-English copy is actually translated (not an en duplicate)', () => {
      const read = (lang) => JSON.parse(fs.readFileSync(
        path.join(__dirname, `../../public/locales/${lang}/common.json`), 'utf8'))
        .affiliateRegister.w9;
      const en = read('en');
      for (const lang of ['es', 'pt', 'de']) {
        expect(read(lang).uploadLabel).not.toBe(en.uploadLabel);
      }
    });
  });
  ```
- [ ] Run it — expect failure: `w9` is `undefined` in all four files:
  ```bash
  npm test -- tests/unit/i18nW9Keys.test.js
  ```
- [ ] Implement — in each `public/locales/{lang}/common.json`, locate the top-level `"affiliateRegister"` object (added by PR 5 with the `invite.*` keys) and add a `"w9"` sibling of `"invite"`. If `affiliateRegister` is missing in a file (PR 5 drift), add it as a new top-level key immediately after the opening `{` of the document, containing only `"w9"`. Validate each file with `node -e "JSON.parse(require('fs').readFileSync('public/locales/en/common.json'))"` (repeat per lang) after editing.

  `en`:
  ```json
  "w9": {
    "uploadLabel": "Upload your completed W-9",
    "fileTypeHint": "PDF, JPG, or PNG, max {{max}} MB",
    "tooLarge": "That file is too large. The maximum size is {{max}} MB.",
    "wrongType": "Only PDF, JPG, or PNG files are accepted.",
    "optionalNote": "You can also upload your W-9 later, but commission payouts pause at $600 in annual earnings until it is on file."
  }
  ```
  `es`:
  ```json
  "w9": {
    "uploadLabel": "Cargue su formulario W-9 completado",
    "fileTypeHint": "PDF, JPG o PNG, máximo {{max}} MB",
    "tooLarge": "El archivo es demasiado grande. El tamaño máximo es {{max}} MB.",
    "wrongType": "Solo se aceptan archivos PDF, JPG o PNG.",
    "optionalNote": "También puede cargar su W-9 más tarde, pero los pagos de comisiones se pausan al alcanzar $600 de ganancias anuales hasta que esté archivado."
  }
  ```
  `pt`:
  ```json
  "w9": {
    "uploadLabel": "Envie seu formulário W-9 preenchido",
    "fileTypeHint": "PDF, JPG ou PNG, máximo de {{max}} MB",
    "tooLarge": "O arquivo é muito grande. O tamanho máximo é {{max}} MB.",
    "wrongType": "Apenas arquivos PDF, JPG ou PNG são aceitos.",
    "optionalNote": "Você também pode enviar seu W-9 mais tarde, mas os pagamentos de comissão são pausados ao atingir $600 de ganhos anuais até que ele esteja arquivado."
  }
  ```
  `de`:
  ```json
  "w9": {
    "uploadLabel": "Laden Sie Ihr ausgefülltes W-9 hoch",
    "fileTypeHint": "PDF, JPG oder PNG, max. {{max}} MB",
    "tooLarge": "Die Datei ist zu groß. Die maximale Größe beträgt {{max}} MB.",
    "wrongType": "Es werden nur PDF-, JPG- oder PNG-Dateien akzeptiert.",
    "optionalNote": "Sie können Ihr W-9 auch später hochladen, aber Provisionsauszahlungen pausieren ab 600 $ Jahreseinnahmen, bis es hinterlegt ist."
  }
  ```
- [ ] Run again — expect 5 passing:
  ```bash
  npm test -- tests/unit/i18nW9Keys.test.js
  ```
- [ ] Commit:
  ```bash
  git add public/locales/en/common.json public/locales/es/common.json public/locales/pt/common.json public/locales/de/common.json tests/unit/i18nW9Keys.test.js
  git commit -m "feat(i18n): affiliateRegister.w9 keys in en/es/pt/de (PR10)"
  ```

---

## Task 12 — `w9ThresholdService`: YTD earnings trigger `not_required` → `required` + payment lock (TDD)

Spec §6.2 lifecycle, first arrow: `not_required ──(YTD earnings cross w9_threshold_usd)──► required`, and the §8 key description: "YTD earnings that trigger the W-9 payment lock (Decision #6)". PR 3 seeded the key and explicitly handed the consumer to this PR ("PR 10, whose threshold-lock logic must read `w9_threshold_usd` with `w9_earnings_threshold` as the DB fallback") — **no other plan implements it**. The trigger fires on the commission-realization path: whenever an order's commission is realized (delivered), re-check the affiliate's YTD realized commission and, on crossing, set `w9Status='required'` and apply the `affiliatePaymentLockService` lock with `reason:'w9_required'` (the exact reason string `unlockPayments` keys its `wasLockedForW9` behavior on). Best-effort: the check must NEVER block or fail a delivery.

**Files:**
- Create: `server/modules/onboarding/w9ThresholdService.js`
- Create: `tests/integration/w9Threshold.test.js`
- Modify: `server/utils/auditLogger.js` (add `AuditEvents.W9_REQUIRED_THRESHOLD` next to the Task 6 W9 events)
- Modify: every commission-realization call site (located by grep below — expected: `server/services/affiliateDeliveryService.js` `confirmDelivery`, the PR 9 re-intake auto-deliver path, and `server/controllers/orderController.js` `updateOrderStatus`'s delivered branch)

**Steps:**

- [ ] Write the failing test `tests/integration/w9Threshold.test.js`:

```javascript
// Spec §6.2 W-9 lifecycle, first transition + spec §8 w9_threshold_usd.
// Real models + SystemConfig (initializeDefaults in tests/setup.js).
jest.setTimeout(90000);

const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
require('../../server'); // registers models/config
const Order = require('../../server/models/Order');
const Affiliate = require('../../server/models/Affiliate');
const SystemConfig = require('../../server/models/SystemConfig');
const { applyW9ThresholdCheck } = require('../../server/modules/onboarding/w9ThresholdService');

async function createAffiliate(overrides = {}) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync('testpass123', salt, 1000, 64, 'sha512').toString('hex');
  return Affiliate.create({
    firstName: 'Thresh', lastName: 'Old', email: `thresh-${Date.now()}-${Math.random()}@test.com`,
    phone: '555-0001', address: '1 Test St', city: 'Austin', state: 'TX', zipCode: '78753',
    username: `thresh${Date.now()}${Math.floor(Math.random() * 1e4)}`,
    passwordHash: hash, passwordSalt: salt, paymentMethod: 'check',
    ...overrides
  });
}

// Commission = actualWeight * baseRate * 0.1 + feeBreakdown.totalFee (Order
// pre-save). Control the magnitude via totalFee; mark realized explicitly.
async function realizedOrder(affiliate, totalFee) {
  const token = crypto.randomBytes(16).toString('hex');
  return Order.create({
    customerId: 'CUST-' + uuidv4(),
    affiliateId: affiliate.affiliateId,
    bagId: 'BAG-' + uuidv4(),
    bagToken: token,
    bags: [{ bagToken: token, bagNumber: 1 }],
    actualWeight: 10,
    status: 'delivered',
    paymentStatus: 'verified',
    commissionRealized: true,
    commissionRealizedAt: new Date(),
    feeBreakdown: { minimumFee: 10, perBagFee: 2, totalFee, minimumApplied: false }
  });
}

describe('w9ThresholdService.applyW9ThresholdCheck', () => {
  afterEach(async () => {
    await Order.deleteMany({});
    await Affiliate.deleteMany({});
    await SystemConfig.initializeDefaults(); // restore any rows the alias test removed
  });

  it('crossing the threshold flips not_required -> required and locks payments (reason w9_required)', async () => {
    const affiliate = await createAffiliate(); // w9Status defaults to not_required
    await realizedOrder(affiliate, 700);       // commission ≈ 701.25 > 600 default

    const result = await applyW9ThresholdCheck(affiliate.affiliateId);
    expect(result.triggered).toBe(true);

    const saved = await Affiliate.findOne({ affiliateId: affiliate.affiliateId });
    expect(saved.w9Status).toBe('required');
    expect(saved.paymentProcessingLocked).toBe(true);
    expect(saved.paymentLockReason).toBe('w9_required');
  });

  it('below the threshold: no flip, no lock', async () => {
    const affiliate = await createAffiliate();
    await realizedOrder(affiliate, 100); // ≈ 101.25 < 600

    const result = await applyW9ThresholdCheck(affiliate.affiliateId);
    expect(result.triggered).toBe(false);

    const saved = await Affiliate.findOne({ affiliateId: affiliate.affiliateId });
    expect(saved.w9Status).toBe('not_required');
    expect(saved.paymentProcessingLocked).toBe(false);
  });

  it('only counts REALIZED commission for the current year', async () => {
    const affiliate = await createAffiliate();
    const o = await realizedOrder(affiliate, 700);
    o.commissionRealizedAt = new Date(Date.UTC(new Date().getUTCFullYear() - 1, 11, 31));
    await o.save();

    const result = await applyW9ThresholdCheck(affiliate.affiliateId);
    expect(result.triggered).toBe(false);
  });

  it.each(['required', 'pending_review', 'on_file', 'rejected'])(
    'is a no-op when w9Status is already %s (idempotent, never double-locks)',
    async (w9Status) => {
      const affiliate = await createAffiliate({ w9Status });
      await realizedOrder(affiliate, 700);

      const result = await applyW9ThresholdCheck(affiliate.affiliateId);
      expect(result.triggered).toBe(false);

      const saved = await Affiliate.findOne({ affiliateId: affiliate.affiliateId });
      expect(saved.w9Status).toBe(w9Status);
      expect(saved.paymentProcessingLocked).toBe(false); // lock untouched
    }
  );

  it('falls back to the legacy w9_earnings_threshold key when w9_threshold_usd is absent (PR 3 handoff)', async () => {
    await SystemConfig.deleteOne({ key: 'w9_threshold_usd' });
    await SystemConfig.updateOne({ key: 'w9_earnings_threshold' }, { $set: { value: 50 } });

    const affiliate = await createAffiliate();
    await realizedOrder(affiliate, 100); // ≈ 101.25 > 50 legacy threshold

    const result = await applyW9ThresholdCheck(affiliate.affiliateId);
    expect(result.triggered).toBe(true);
    expect((await Affiliate.findOne({ affiliateId: affiliate.affiliateId })).w9Status).toBe('required');
  });

  it('never throws — a DB error is swallowed and reported as untriggered (delivery must not block)', async () => {
    const result = await applyW9ThresholdCheck('AFF-does-not-exist');
    expect(result.triggered).toBe(false);
  });
});
```

- [ ] Run it: `npm test -- tests/integration/w9Threshold.test.js` — expect FAIL: `Cannot find module '../../server/modules/onboarding/w9ThresholdService'`.

- [ ] Implement `server/modules/onboarding/w9ThresholdService.js`:

```javascript
// W-9 threshold trigger (spec §6.2 lifecycle, first arrow; spec §8 Decision #6).
// not_required --(YTD realized commission crosses w9_threshold_usd)--> required
// + payment lock. Called best-effort from every commission-realization site;
// NEVER throws into a delivery path.

const Order = require('../../models/Order');
const Affiliate = require('../../models/Affiliate');
const SystemConfig = require('../../models/SystemConfig');
const affiliatePaymentLockService = require('../../services/affiliatePaymentLockService');
const { logAuditEvent, AuditEvents } = require('../../utils/auditLogger');
const logger = require('../../utils/logger');

async function ytdRealizedCommission(affiliateId) {
  const startOfYear = new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1));
  const [row] = await Order.aggregate([
    { $match: { affiliateId, commissionRealized: true, commissionRealizedAt: { $gte: startOfYear } } },
    { $group: { _id: null, total: { $sum: '$affiliateCommission' } } }
  ]);
  return row ? row.total : 0;
}

/**
 * Re-check one affiliate against the W-9 earnings threshold.
 * Reads w9_threshold_usd with w9_earnings_threshold as the DB fallback
 * (PR 3 handoff — legacy alias). Only acts on w9Status === 'not_required'.
 * @returns {Promise<{triggered: boolean, ytd?: number, threshold?: number}>}
 */
async function applyW9ThresholdCheck(affiliateId, { req = null } = {}) {
  try {
    const affiliate = await Affiliate.findOne({ affiliateId })
      .select('affiliateId w9Status paymentProcessingLocked');
    if (!affiliate || affiliate.w9Status !== 'not_required') return { triggered: false };

    const threshold = await SystemConfig.getValue(
      'w9_threshold_usd',
      await SystemConfig.getValue('w9_earnings_threshold', 600)
    );
    const ytd = await ytdRealizedCommission(affiliateId);
    if (ytd < threshold) return { triggered: false, ytd, threshold };

    affiliate.w9Status = 'required';
    await affiliate.save();
    await affiliatePaymentLockService.lockPayments({
      affiliateId,
      reason: 'w9_required',
      notes: `Auto-locked: YTD realized commission $${ytd.toFixed(2)} crossed the W-9 threshold $${Number(threshold).toFixed(2)}`
    });
    logAuditEvent(AuditEvents.W9_REQUIRED_THRESHOLD, { affiliateId, ytd, threshold }, req);
    logger.info('W-9 threshold crossed — w9Status=required, payments locked', { affiliateId, ytd, threshold });
    return { triggered: true, ytd, threshold };
  } catch (error) {
    // Best-effort by contract: a compliance check must never block a delivery.
    logger.error('w9ThresholdService failed (non-blocking)', { affiliateId, error: error.message });
    return { triggered: false, error: error.message };
  }
}

module.exports = { applyW9ThresholdCheck, ytdRealizedCommission };
```

  Add the audit constant in `server/utils/auditLogger.js`, next to the Task 6 W-9 events:

```javascript
  W9_REQUIRED_THRESHOLD: 'W9_REQUIRED_THRESHOLD',
```

  (If `logAuditEvent` requires a non-null `req`, follow the codebase's existing null-req pattern — `grep -n "req" server/utils/auditLogger.js | head` — and adapt; some call sites pass a stub `{ ip: 'system' }`.)

- [ ] Run again: `npm test -- tests/integration/w9Threshold.test.js` — expect PASS (9 tests).

- [ ] **Wire the commission-realization call sites.** Locate every site that realizes commission:

```bash
grep -rn "commissionRealized" server/ --include='*.js' | grep -v node_modules
```

  Expected sites (post-PR 9): (a) `server/services/affiliateDeliveryService.js` `confirmDelivery` — after the `await order.save()` that stamps `commissionRealized`, inside the existing best-effort notifications `try` block, add `await applyW9ThresholdCheck(order.affiliateId);`; (b) the PR 9 re-intake auto-deliver path (the service that closes the prior `picked_up` order) — same pattern after its save; (c) `server/controllers/orderController.js` `updateOrderStatus` — in the delivered branch (admin manual_confirm override), after the save, `applyW9ThresholdCheck(order.affiliateId).catch(() => {})` or inside the existing post-save try. Do NOT hook the Order model pre-save (no service calls from model middleware). Hoist `const { applyW9ThresholdCheck } = require(...)` to each file's imports (adjust relative paths).

- [ ] Add the end-to-end wiring test — append to `tests/integration/w9Threshold.test.js` (reuse the admin agent + CSRF pattern from `tests/integration/payment-ready-gate.test.js`; `/api/v1/orders/:orderId/status` is a CSRF CRITICAL endpoint — agent + `x-csrf-token` required):

```javascript
describe('threshold trigger fires through the admin delivered override', () => {
  it('PUT picked_up -> delivered realizes commission and locks the over-threshold affiliate', async () => {
    // build: affiliate (not_required) + a picked_up, paid order whose
    // commission crosses the default $600 threshold; admin PUT -> delivered.
    // assert: order delivered; affiliate w9Status 'required',
    // paymentProcessingLocked true, paymentLockReason 'w9_required'.
  });
});
```

  Implement the body with the same fixtures as above (`realizedOrder` variant created at `status:'picked_up'`, `commissionRealized:false`, `totalFee:700`) plus the admin login/CSRF boilerplate; the assertion set is the comment block. Run: `npm test -- tests/integration/w9Threshold.test.js` — expect PASS (10 tests).

- [ ] Re-run the touched delivery suites for no-regression: `npm test -- tests/integration/confirmDelivery.test.js tests/integration/operatorReintake.test.js` (exact PR 9 file names — `ls tests/integration | grep -i "deliver\|reintake"`).
- [ ] Lint: `npx eslint server/modules/onboarding/w9ThresholdService.js server/services/affiliateDeliveryService.js server/controllers/orderController.js` — clean.
- [ ] Commit:

```bash
git add server/modules/onboarding/w9ThresholdService.js server/utils/auditLogger.js server/services/affiliateDeliveryService.js server/controllers/orderController.js tests/integration/w9Threshold.test.js
git commit -m "feat(w9): YTD earnings threshold trigger — not_required -> required + w9_required payment lock (spec §6.2/§8)"
```

  (Include the re-intake service file in the `git add` under its actual PR 9 name.)

---

## Verification

- [ ] **Full suite green:**
  ```bash
  npm test
  ```
  Every suite passes; zero new skips. Also run the four W-9 files standalone to rule out inter-suite state leaks:
  ```bash
  npm test -- tests/unit/encryptionBuffer.test.js tests/unit/secureFileStore.test.js tests/unit/models/affiliateW9.test.js tests/unit/uploadW9.middleware.test.js
  npm test -- tests/unit/emailW9Status.test.js tests/unit/i18nW9Keys.test.js
  npm test -- tests/integration/w9Upload.test.js tests/integration/w9Admin.test.js tests/integration/w9Review.test.js tests/integration/affiliateRegisterW9.test.js
  npm test -- tests/integration/w9Threshold.test.js
  ```
- [ ] **Lint:** `npx eslint server/` → no new errors (no `console.*` anywhere in the new files).
- [ ] **No cycles:** `npx madge --circular server/` → zero cycles (the new modules only import downward: controller → services/models/utils).
- [ ] **Manual smoke (local, optional but recommended):**
  ```bash
  W9_STORAGE_PATH=/tmp/w9-smoke PORT=3010 node server.js &
  # mint a CSRF cookie+token pair, login an affiliate, then:
  curl -s -X POST http://localhost:3010/api/v1/affiliates/<AFF-id>/w9 \
    -H "Authorization: Bearer <jwt>" -H "x-csrf-token: <token>" -b "<csrf-cookie>" \
    -F "w9=@/path/to/sample.pdf;type=application/pdf" | jq .
  ls -la /tmp/w9-smoke/aff/<AFF-id>/   # one .enc file; `file` shows data, not PDF
  ```
- [ ] **Config follow-ups (NOT in this PR's commits without explicit confirmation — project rule: production-config edits confirm first):**
  - Add `W9_STORAGE_PATH=/var/lib/wavemax/w9` to `.env.example` — **ask Rick before touching `.env.example`**.
  - Deploy checklist (spec §12): DRBD volume single-primary on the leader box, dir mode `0700`, `/api/v1/w9/*` + the multipart register route pinned to that box (nginx upstream / CF rule), secondary-promotion failover tested.
- [ ] Tick the `PR 10` checkbox in spec §12 (`docs/superpowers/specs/2026-06-08-invite-bag-workflow-redesign-design.md`) in the final commit of the branch.

**PR description text:**

> ## PR 10 — W-9 upload, encrypted file store, admin review
>
> Builds the entire W-9 surface (greenfield — no prior `w9Routes`/`w9Controller` existed) per the redesign spec §4.3/§5/§6.2/§13 #7:
>
> - **Binary crypto:** `encryptBuffer`/`decryptBuffer` (AES-256-GCM) added to `server/utils/encryption.js`.
> - **`secureFileStore`:** self-framed encrypted files `[iv(16)|authTag(16)|ciphertext]` under `W9_STORAGE_PATH` (DRBD-replicated volume in prod), storageKey `aff/<affiliateId>/<uuid>.enc`, file 0600 / dirs 0700, plaintext-sha256 integrity check, path-traversal guard, re-upload cleanup. **Not GridFS, never in the DB** (settled §13 #7).
> - **Affiliate model:** `w9Status` + `pending_review`, `w9Document{storageKey,filename,contentType,sizeBytes,sha256,submittedAt}`, `w9SubmittedAt/VerifiedAt/VerifiedBy/RejectedAt/RejectedReason`.
> - **API:** `POST /api/v1/affiliates/:affiliateId/w9` (self/admin, multer memoryStorage, pdf/jpeg/png only — SVG rejected, cap from `w9_max_upload_mb`, `fileUploadLimiter`, CSRF-critical); `GET /api/v1/w9/status`; `GET /api/v1/w9/admin/pending`; `GET /api/v1/w9/admin/:affiliateId/document` (attachment + nosniff, **audited on every read**); `POST .../verify` (→ `on_file`, unlocks payments locked for `w9_required` via the existing `affiliatePaymentLockService`); `POST .../reject` (+ reason, re-upload loop). RBAC: `manage_affiliates` everywhere admin-side.
> - **Registration:** `/api/v1/affiliates/register` accepts an optional multipart `w9` → `pending_review` at creation; JSON registrations unaffected.
> - **Emails:** `affiliate-w9-status` (received/verified/rejected) in en/es/pt/de; **audit:** `W9_UPLOADED/W9_VERIFIED/W9_REJECTED/W9_DOCUMENT_ACCESSED` (+ `SUSPICIOUS_ACTIVITY` on decrypt failure).
> - **i18n:** `affiliateRegister.w9.*` keys in all four languages.
> - **Threshold trigger (spec §6.2/§8):** `w9ThresholdService.applyW9ThresholdCheck` — when YTD realized commission crosses `w9_threshold_usd` (legacy alias `w9_earnings_threshold` as DB fallback) and `w9Status==='not_required'`, flip to `required` + `affiliatePaymentLockService.lockPayments(reason:'w9_required')`; wired best-effort into every commission-realization site (confirm-delivery, re-intake auto-deliver, admin delivered override).
> - **New dep:** `multer@^2`.
>
> Tests: encrypt round-trip + tamper, file-store on-disk ≠ plaintext, model enum, middleware filters, upload/RBAC/CSRF, audited download, verify→unlock, reject→re-upload, registration multipart, i18n parity, threshold trigger (cross/below/YTD-scope/idempotent/legacy-alias/never-throws + admin-override wiring). Suite green.
>
> Deploy notes: requires `W9_STORAGE_PATH` env on the leader box (DRBD primary) and W-9 route pinning — see spec §12 deploy checklist.
>
> 🤖 Generated with [Claude Code](https://claude.com/claude-code)



