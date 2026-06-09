# PR 3 — SystemConfig Key Additions/Retirements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Seed the 17 new SystemConfig keys from spec §8 into `initializeDefaults()`, delete the retired `laundry_bag_fee` key (scrubbing its consumers), and retire `payment_check_interval` behind a `payment_scan_interval_ms`-first fallback read — leaving the legacy `w9_earnings_threshold` seeded as the accepted alias of the new canonical `w9_threshold_usd`.

**Architecture:** All runtime business values live in the `SystemConfig` Mongoose model (`server/models/SystemConfig.js`); `initializeDefaults()` upserts a `defaultConfigs` array with `$setOnInsert` (never overwrites existing values), and consumers read via `await SystemConfig.getValue(key, default)`. This PR is pure configuration plumbing: it adds the keys later PRs (4–10) consume, removes a dead V1 key, and does the one-commit "read old name as fallback" step the spec prescribes for the retired payment-cadence keys.

**Tech Stack:** Node/Express, Mongoose, Jest + MongoMemoryServer (`tests/setup.js` runs `SystemConfig.initializeDefaults()` in a global `beforeEach` and wipes all collections in a global `afterEach`).

**Assumed starting state:** PRs 1–2 of the redesign sequence are merged (V1 Paygistix deleted; scheduling / Pickup Now / BetaRequest / `?affid` removed). Verified facts about current `main` that still hold unless PR 1/2 touched them:

- `server/models/SystemConfig.js` `initializeDefaults()` seeds 13 keys including `laundry_bag_fee` (lines 245–254) and `w9_earnings_threshold` (lines 275–284). **None** of the 17 new §8 keys exist anywhere in the repo (verified by grep).
- `payment_check_interval` / `payment_check_max_attempts` are **not** seeded in `initializeDefaults()` — they are read only in `server/jobs/paymentVerificationJob.js:28,30` (with hardcoded fallbacks 300000 / 48) and set by `scripts/ops/update-payment-interval.js:25`.
- **`affiliatePaymentLockService` reads NO SystemConfig key today** (verified: zero `SystemConfig`/`getValue` references in `server/services/affiliatePaymentLockService.js` — the lock/unlock flow is admin-manual). The seeded `w9_earnings_threshold` key is currently unconsumed by server code. Therefore "keep the legacy alias" means: keep the `w9_earnings_threshold` seed row as-is, add `w9_threshold_usd` alongside it, and hand off to **PR 10**, whose threshold-lock logic must read `w9_threshold_usd` with `w9_earnings_threshold` as the DB fallback.
- `laundry_bag_fee` consumers (verified by grep): the seed itself, `tests/integration/v2-complete-payment-flow.test.js:55`, `public/assets/js/customer-success.js:158`, `public/assets/js/customer-success-embed.js:168`. The two `customer-success` files are V1 debris — **PR 1/2 may already have deleted them; every scrub step below is grep-guarded so it is safe either way.**
- `tests/unit/paymentVerificationJob.test.js:110` asserts `checkInterval` === 5 (from the legacy key); `tests/unit/systemConfig.test.js` has an `initializeDefaults` describe block (lines 653–704) this plan extends.
- `tests/setup.js` global hooks: `beforeEach` runs `initializeDefaults()` (line 159–167), `afterEach` wipes **every** collection. Consequence used below: keys created in a test file's `beforeAll` survive only until the end of the first test in that file.

**PR 8 handoff (read this, do not "fix" it here):** `paymentVerificationJob.maxAttempts` keeps reading the retired `payment_check_max_attempts` (the IMAP **detection** cap, 48) in this PR. Do **not** point it at `payment_reminder_max_attempts` (8) — that key is the **reminder** cap with different semantics; swapping it here would stop payment detection after ~8 scans. PR 8 rewrites the job, decouples the two counters, and deletes the legacy fallback reads added in Task 3.

---

## Task 1: Seed the 17 new spec-§8 keys in `initializeDefaults()`

**Files:**
- Modify: `tests/unit/systemConfig.test.js` (extend the `initializeDefaults` describe block, currently lines 653–704)
- Modify: `server/models/SystemConfig.js` (insert into the `defaultConfigs` array after the `w9_earnings_threshold` entry, before the `// System settings` comment at line 285)

Category assignments (the schema enum is `['operator','operations','processing','notification','payment','system','affiliate','customer','quality','performance']` — SystemConfig.js:20): the four `payment_*` keys and `w9_threshold_usd` → `payment` (per §8: "All payment keys `category:'payment'`, `isPublic:false` unless noted"; matches the existing `w9_earnings_threshold` row); `invite_token_ttl_hours`, `w9_max_upload_mb`, `affiliate_delivery_code_length` → `affiliate`; the four `bag_*` keys → `operations`; `store_pickup_address` (the only `isPublic:true` key, per §8) and the shared `delivery_code_max_attempts` → `system`; `operator_scan_code_*` → `operator`; `customer_delivery_pin_length` → `customer`.

`store_pickup_address` default is the real store: `825 E Rundberg Ln F1, Austin, TX 78753` (sourced from `server/config/domainSeoOverrides.js:74`).

**Note:** `admin_notification_email` appears in the §8 table but is **deliberately not seeded here** — it is not in the PR 3 canon key list; its two readers (`paymentVerificationJob.js:345`, and `dispatcher/beta.js` which PR 2 deleted) already carry inline fallbacks, so behavior is unchanged. If the team wants it seeded, that is a one-line follow-up, not this PR.

**Steps:**

- [ ] Write the failing tests. In `tests/unit/systemConfig.test.js`, find the end of the `initializeDefaults` describe block — the existing `it('should add missing configurations', …)` closes at lines 688–704:

  ```javascript
      it('should add missing configurations', async () => {
        // Create one config
        await SystemConfig.create({
          key: 'max_operators_per_shift',
          value: 20,
          category: 'operator',
          dataType: 'number'
        });

        await SystemConfig.initializeDefaults();

        // Should have added other defaults
        const maintenanceMode = await SystemConfig.findOne({ key: 'maintenance_mode' });
        expect(maintenanceMode).toBeDefined();
        expect(maintenanceMode.value).toBe(false);
      });
  ```

  Immediately **after** that `});` (still inside `describe('initializeDefaults', …)`), add:

  ```javascript
      it('should seed every redesign key per spec §8 (PR 3)', async () => {
        await SystemConfig.initializeDefaults();

        const expected = [
          { key: 'payment_scan_interval_ms', value: 120000, category: 'payment', dataType: 'number', isPublic: false, min: 60000, max: 600000 },
          { key: 'payment_reminder_interval_minutes', value: 60, category: 'payment', dataType: 'number', isPublic: false, min: 15, max: 240 },
          { key: 'payment_reminder_max_attempts', value: 8, category: 'payment', dataType: 'number', isPublic: false, min: 1, max: 24 },
          { key: 'payment_hold_notice_enabled', value: true, category: 'payment', dataType: 'boolean', isPublic: false },
          { key: 'invite_token_ttl_hours', value: 72, category: 'affiliate', dataType: 'number', isPublic: false, min: 1, max: 336 },
          { key: 'w9_max_upload_mb', value: 10, category: 'affiliate', dataType: 'number', isPublic: false, min: 1, max: 25 },
          { key: 'w9_threshold_usd', value: 600, category: 'payment', dataType: 'number', isPublic: false, min: 0, max: 10000 },
          { key: 'bag_mint_max_batch', value: 200, category: 'operations', dataType: 'number', isPublic: false, min: 1, max: 500 },
          { key: 'bag_token_bytes', value: 16, category: 'operations', dataType: 'number', isPublic: false, min: 12, max: 32 },
          { key: 'bag_label_columns', value: 3, category: 'operations', dataType: 'number', isPublic: false, min: 1, max: 6 },
          { key: 'bag_label_qr_size_px', value: 300, category: 'operations', dataType: 'number', isPublic: false, min: 150, max: 600 },
          { key: 'store_pickup_address', value: '825 E Rundberg Ln F1, Austin, TX 78753', category: 'system', dataType: 'string', isPublic: true },
          { key: 'delivery_code_max_attempts', value: 5, category: 'system', dataType: 'number', isPublic: false, min: 3, max: 10 },
          { key: 'operator_scan_code_max_attempts', value: 5, category: 'operator', dataType: 'number', isPublic: false, min: 3, max: 10 },
          { key: 'operator_scan_code_length', value: 8, category: 'operator', dataType: 'number', isPublic: false, min: 6, max: 12 },
          { key: 'customer_delivery_pin_length', value: 6, category: 'customer', dataType: 'number', isPublic: false, min: 4, max: 10 },
          { key: 'affiliate_delivery_code_length', value: 6, category: 'affiliate', dataType: 'number', isPublic: false, min: 4, max: 10 }
        ];

        for (const spec of expected) {
          const config = await SystemConfig.findOne({ key: spec.key });
          // Compare as one object so a failure names the offending key.
          expect({
            key: spec.key,
            value: config?.value,
            defaultValue: config?.defaultValue,
            category: config?.category,
            dataType: config?.dataType,
            isPublic: config?.isPublic ?? false,
            min: config?.validation?.min,
            max: config?.validation?.max
          }).toEqual({
            key: spec.key,
            value: spec.value,
            defaultValue: spec.value,
            category: spec.category,
            dataType: spec.dataType,
            isPublic: spec.isPublic,
            min: spec.min,
            max: spec.max
          });
        }
      });

      it('should enforce spec §8 ranges on the new keys via setValue', async () => {
        await SystemConfig.initializeDefaults();

        await expect(SystemConfig.setValue('payment_reminder_max_attempts', 25))
          .rejects.toThrow('Value must be at most 24');
        await expect(SystemConfig.setValue('payment_scan_interval_ms', 59999))
          .rejects.toThrow('Value must be at least 60000');

        const updated = await SystemConfig.setValue('invite_token_ttl_hours', 24);
        expect(updated.value).toBe(24);
      });

      it('should keep w9_earnings_threshold seeded as the legacy alias of w9_threshold_usd', async () => {
        await SystemConfig.initializeDefaults();

        const legacy = await SystemConfig.findOne({ key: 'w9_earnings_threshold' });
        const canonical = await SystemConfig.findOne({ key: 'w9_threshold_usd' });

        expect(legacy).not.toBeNull();
        expect(legacy.value).toBeCloseTo(600, 2);
        expect(legacy.category).toBe('payment');
        expect(canonical).not.toBeNull();
        expect(canonical.value).toBeCloseTo(600, 2);
      });
  ```

  (Notes: `toEqual` ignores `undefined`-valued properties, so the boolean/string keys with no `min`/`max` compare cleanly. Jest's failure diff includes `key`, so a wrong/missing seed is immediately attributable. Money-ish values use `toBeCloseTo(x, 2)` per house rules.)

- [ ] Run the new tests and confirm they fail for the right reason:

  ```bash
  npm test -- tests/unit/systemConfig.test.js -t "spec §8"
  ```

  Expected: `should seed every redesign key per spec §8 (PR 3)` fails on the **first** table entry with a diff showing `value: undefined, category: undefined …` for `key: 'payment_scan_interval_ms'` (the key doesn't exist). `should enforce spec §8 ranges` fails with `Configuration key not found: payment_reminder_max_attempts`. `legacy alias` fails with `expect(canonical).not.toBeNull()` (only the legacy row exists). The pre-existing `legacy.value` assertions pass — `w9_earnings_threshold` is already seeded.

- [ ] Implement: in `server/models/SystemConfig.js`, inside the `defaultConfigs` array, find the existing block (lines 275–285):

  ```javascript
    {
      key: 'w9_earnings_threshold',
      value: 600.00,
      defaultValue: 600.00,
      description: 'YTD earnings (USD) at which an affiliate must have a W-9 on file before further commission payouts',
      category: 'payment',
      dataType: 'number',
      validation: { min: 0.00, max: 10000.00 },
      isPublic: false
    },
    // System settings
  ```

  and replace it with the same `w9_earnings_threshold` entry followed by the 17 new entries (i.e. insert between the closing `},` and `// System settings`):

  ```javascript
    {
      key: 'w9_earnings_threshold',
      value: 600.00,
      defaultValue: 600.00,
      description: 'YTD earnings (USD) at which an affiliate must have a W-9 on file before further commission payouts',
      category: 'payment',
      dataType: 'number',
      validation: { min: 0.00, max: 10000.00 },
      isPublic: false
    },
    {
      key: 'w9_threshold_usd',
      value: 600,
      defaultValue: 600,
      description: 'YTD earnings (USD) that trigger the W-9 payment lock (canonical name; w9_earnings_threshold is the legacy alias)',
      category: 'payment',
      dataType: 'number',
      validation: { min: 0, max: 10000 }
    },

    // Payment cadence (redesign spec §8) — IMAP detection decoupled from reminders
    {
      key: 'payment_scan_interval_ms',
      value: 120000,
      defaultValue: 120000,
      description: 'IMAP payment-detection scan cadence in milliseconds',
      category: 'payment',
      dataType: 'number',
      validation: { min: 60000, max: 600000 }
    },
    {
      key: 'payment_reminder_interval_minutes',
      value: 60,
      defaultValue: 60,
      description: 'Minutes between payment reminder emails',
      category: 'payment',
      dataType: 'number',
      validation: { min: 15, max: 240 }
    },
    {
      key: 'payment_reminder_max_attempts',
      value: 8,
      defaultValue: 8,
      description: 'Maximum payment reminders before the come-to-store hold notice',
      category: 'payment',
      dataType: 'number',
      validation: { min: 1, max: 24 }
    },
    {
      key: 'payment_hold_notice_enabled',
      value: true,
      defaultValue: true,
      description: 'Master switch for the "come to the store" hold notice',
      category: 'payment',
      dataType: 'boolean'
    },

    // Affiliate onboarding (redesign spec §8)
    {
      key: 'invite_token_ttl_hours',
      value: 72,
      defaultValue: 72,
      description: 'Single-use affiliate invite link TTL in hours',
      category: 'affiliate',
      dataType: 'number',
      validation: { min: 1, max: 336 }
    },
    {
      key: 'w9_max_upload_mb',
      value: 10,
      defaultValue: 10,
      description: 'Maximum W-9 upload size in megabytes',
      category: 'affiliate',
      dataType: 'number',
      validation: { min: 1, max: 25 }
    },

    // Durable bags (redesign spec §8)
    {
      key: 'bag_mint_max_batch',
      value: 200,
      defaultValue: 200,
      description: 'Maximum bags per admin mint request (bounds label sheet and insertMany)',
      category: 'operations',
      dataType: 'number',
      validation: { min: 1, max: 500 }
    },
    {
      key: 'bag_token_bytes',
      value: 16,
      defaultValue: 16,
      description: 'Bag QR token entropy in bytes (16 bytes = 128 bits = 32 hex chars)',
      category: 'operations',
      dataType: 'number',
      validation: { min: 12, max: 32 }
    },
    {
      key: 'bag_label_columns',
      value: 3,
      defaultValue: 3,
      description: 'Columns on the printable bag label sheet',
      category: 'operations',
      dataType: 'number',
      validation: { min: 1, max: 6 }
    },
    {
      key: 'bag_label_qr_size_px',
      value: 300,
      defaultValue: 300,
      description: 'QR image size in pixels on bag labels',
      category: 'operations',
      dataType: 'number',
      validation: { min: 150, max: 600 }
    },

    // Store + role codes (redesign spec §8)
    {
      key: 'store_pickup_address',
      value: '825 E Rundberg Ln F1, Austin, TX 78753',
      defaultValue: '825 E Rundberg Ln F1, Austin, TX 78753',
      description: 'Store address shown in the come-to-store hold notice',
      category: 'system',
      dataType: 'string',
      isPublic: true
    },
    {
      key: 'delivery_code_max_attempts',
      value: 5,
      defaultValue: 5,
      description: 'Wrong customer-PIN / vendor-code tries before per-bag/IP lockout',
      category: 'system',
      dataType: 'number',
      validation: { min: 3, max: 10 }
    },
    {
      key: 'operator_scan_code_max_attempts',
      value: 5,
      defaultValue: 5,
      description: 'Wrong operator-code tries before lockout on the bag-URL operator path',
      category: 'operator',
      dataType: 'number',
      validation: { min: 3, max: 10 }
    },
    {
      key: 'operator_scan_code_length',
      value: 8,
      defaultValue: 8,
      description: 'Operator scan-code length (unambiguous alphanumeric)',
      category: 'operator',
      dataType: 'number',
      validation: { min: 6, max: 12 }
    },
    {
      key: 'customer_delivery_pin_length',
      value: 6,
      defaultValue: 6,
      description: 'Customer delivery-PIN length',
      category: 'customer',
      dataType: 'number',
      validation: { min: 4, max: 10 }
    },
    {
      key: 'affiliate_delivery_code_length',
      value: 6,
      defaultValue: 6,
      description: 'Vendor (affiliate) delivery-code length',
      category: 'affiliate',
      dataType: 'number',
      validation: { min: 4, max: 10 }
    },
    // System settings
  ```

- [ ] Run the tests again and confirm green:

  ```bash
  npm test -- tests/unit/systemConfig.test.js
  ```

  Expected: the whole file passes (the 3 new tests plus all pre-existing ones — `initializeDefaults` uses `$setOnInsert`, so the "should not overwrite existing configurations" test is unaffected).

- [ ] Commit:

  ```bash
  git add server/models/SystemConfig.js tests/unit/systemConfig.test.js
  git commit -m "feat(config): seed redesign SystemConfig keys per spec §8

17 new keys for invites, bags, role codes, W-9 and the retuned payment
cadence (payment_scan_interval_ms 2min detection, 60min/8x reminders).
w9_threshold_usd added as the canonical name; w9_earnings_threshold kept
seeded as the accepted legacy alias (PR 10 reads canonical-with-fallback)."
  ```

---

## Task 2: Delete `laundry_bag_fee` and scrub its consumers

Spec §7/§8: `laundry_bag_fee` is a V1 customer-bag-purchase artifact — bags are now infrastructure, not a line item. Also pin down (as guards, not behavior changes) that the two retired payment keys are not seeded.

**Files:**
- Modify: `tests/unit/systemConfig.test.js` (one more test in the same `initializeDefaults` describe block)
- Modify: `server/models/SystemConfig.js` (delete the `laundry_bag_fee` seed entry, lines 245–254 of the pre-Task-1 file)
- Modify: `tests/integration/v2-complete-payment-flow.test.js` (line 55 — remove the manual seed)
- Modify (grep-guarded — skip any file PR 1/2 already deleted): `public/assets/js/customer-success.js` (lines 154–168), `public/assets/js/customer-success-embed.js` (lines 161–179)

**Steps:**

- [ ] Write the failing test. In `tests/unit/systemConfig.test.js`, directly after the `should keep w9_earnings_threshold seeded…` test added in Task 1 (same describe block), add:

  ```javascript
      it('should not seed retired keys (laundry_bag_fee, payment_check_*)', async () => {
        await SystemConfig.initializeDefaults();

        // Deleted in PR 3 — V1 bag-purchase artifact (spec §7/§8)
        expect(await SystemConfig.findOne({ key: 'laundry_bag_fee' })).toBeNull();
        // Never seeded; retired in favor of payment_scan_interval_ms +
        // payment_reminder_* (guards against accidental re-introduction)
        expect(await SystemConfig.findOne({ key: 'payment_check_interval' })).toBeNull();
        expect(await SystemConfig.findOne({ key: 'payment_check_max_attempts' })).toBeNull();
      });
  ```

- [ ] Run it and confirm it fails for the right reason:

  ```bash
  npm test -- tests/unit/systemConfig.test.js -t "retired keys"
  ```

  Expected: fails on the **first** assertion (`laundry_bag_fee` is currently seeded, so `findOne` returns a document, not null). The two `payment_check_*` assertions would pass — they were never in `initializeDefaults()`; they are regression guards.

- [ ] Implement: in `server/models/SystemConfig.js`, delete this entire entry from `defaultConfigs` (it sits between `wdf_base_rate_per_pound` and `delivery_minimum_fee`):

  ```javascript
    {
      key: 'laundry_bag_fee',
      value: 10.00,
      defaultValue: 10.00,
      description: 'Fee per laundry bag for new customers',
      category: 'payment',
      dataType: 'number',
      validation: { min: 0.00, max: 50.00 },
      isPublic: true
    },
  ```

- [ ] Run the test again — expected pass:

  ```bash
  npm test -- tests/unit/systemConfig.test.js -t "retired keys"
  ```

- [ ] Scrub consumer 1 — `tests/integration/v2-complete-payment-flow.test.js`. In the `beforeAll` `SystemConfig.create([...])` array (lines 49–57), delete the single line:

  ```javascript
      { key: 'laundry_bag_fee', value: 10.00, dataType: 'number', category: 'payment' },
  ```

  (Verified: line 55 is this file's only `laundry_bag_fee` reference — nothing in the file asserts on it.)

- [ ] Scrub consumer 2 — `public/assets/js/customer-success.js` (**skip if PR 1/2 deleted the file**; check with `ls public/assets/js/customer-success.js`). Delete the bag-fee fetch block (lines 154–168) — the function's remaining bag-count display stays:

  ```javascript
  // Fetch bag fee from system config to calculate credit
  fetch('/api/v1/system/config/public')
    .then(response => response.json())
    .then(configs => {
      const bagFeeConfig = configs.find(c => c.key === 'laundry_bag_fee');
      if (bagFeeConfig && bagFeeConfig.currentValue) {
        const bagFee = bagFeeConfig.currentValue;
        const totalCredit = bagFee * bagCount;
        document.getElementById('bagCreditAmount').textContent = `$${totalCredit.toFixed(2)}`;
      }
    })
    .catch(error => {
      console.error('Error fetching bag fee:', error);
      // Keep default $10.00 if fetch fails
    });
  ```

  Replace with nothing (delete the block and its preceding blank line).

- [ ] Scrub consumer 3 — `public/assets/js/customer-success-embed.js` (**skip if PR 1/2 deleted the file**). Inside the `if (bagsPurchasedEl) { … }` block, delete lines 161–179:

  ```javascript
        // Fetch bag fee from system config to calculate credit (only for v1)
        const baseUrl = window.EMBED_CONFIG?.baseUrl || window.location.origin;
        fetch(`${baseUrl}/api/v1/system/config/public`, {
          credentials: 'include'
        })
          .then(response => response.json())
          .then(configs => {
            const bagFeeConfig = configs.find(c => c.key === 'laundry_bag_fee');
            if (bagFeeConfig && bagFeeConfig.currentValue) {
              const bagFee = bagFeeConfig.currentValue;
              const totalCredit = bagFee * bagCount;
              const bagCreditEl = document.getElementById('bagCreditAmount');
              if (bagCreditEl) bagCreditEl.textContent = `$${totalCredit.toFixed(2)}`;
            }
          })
          .catch(error => {
            console.error('Error fetching bag fee:', error);
            // Keep default $10.00 if fetch fails
          });
  ```

  Replace with nothing — keep the surrounding `if (bagsPurchasedEl) { … }` braces and the bag-count lines above it intact.

- [ ] Grep for dangling references — must return **no output**:

  ```bash
  grep -rn "laundry_bag_fee" server/ public/ tests/ scripts/ docs/refactor/ --include="*.js" --include="*.html" --include="*.json"
  ```

  (References inside `docs/superpowers/specs/` and this plan are documentation, not code — the command above deliberately excludes them.)

- [ ] Run the directly-affected suites:

  ```bash
  npm test -- tests/unit/systemConfig.test.js tests/integration/v2-complete-payment-flow.test.js
  ```

  Expected: both green. (The v2 flow test never asserted on the bag fee; removing the seed is inert.)

- [ ] Commit:

  ```bash
  git add server/models/SystemConfig.js tests/unit/systemConfig.test.js tests/integration/v2-complete-payment-flow.test.js public/assets/js/customer-success.js public/assets/js/customer-success-embed.js
  git commit -m "chore(config): delete laundry_bag_fee and scrub consumers

Bags are durable infrastructure in the redesign, not a purchased line
item (spec §7). Removes the seed, the test fixture row, and the V1
bag-credit fetch in the customer-success pages. Adds a guard test that
the retired payment_check_* keys are never seeded."
  ```

  (If the `customer-success` files were already deleted by PR 1/2, drop them from the `git add` list.)

---

## Task 3: Retire `payment_check_interval` — new-key-first fallback read in `paymentVerificationJob` + ops script

Spec §8: "Retire `payment_check_interval` and `payment_check_max_attempts` … Read the old names as fallbacks for one cleanup commit, then delete." This task is that one cleanup commit for the **interval**: the job now prefers `payment_scan_interval_ms` (seeded at 120000 → 2-minute detection cadence) and falls back to the legacy key. **`maxAttempts` deliberately keeps reading `payment_check_max_attempts`** — see the PR 8 handoff note in the header; the reminder-cap key (`payment_reminder_max_attempts`, 8) has different semantics and is wired up only when PR 8 decouples the detection/reminder counters.

**Files:**
- Modify: `tests/unit/paymentVerificationJob.test.js` (the `Job initialization` describe, lines 105–116)
- Modify: `server/jobs/paymentVerificationJob.js` (lines 27–30 in `start()`)
- Modify: `scripts/ops/update-payment-interval.js` (lines 22–37)

**Hook-ordering fact this task relies on (verified in `tests/setup.js`):** the global `beforeEach` seeds `initializeDefaults()` (which after Task 1 includes `payment_scan_interval_ms = 120000`) and the global `afterEach` wipes every collection. The legacy keys created in this test file's `beforeAll` (`payment_check_interval = 300000`, `payment_check_max_attempts = 48`, lines 21–25) therefore exist **only for the first test in the file** — which is exactly the `Job initialization` test. The second (fallback) test must create its own legacy row.

**Steps:**

- [ ] Update/add the tests. In `tests/unit/paymentVerificationJob.test.js`, replace the existing first test (lines 105–116):

  ```javascript
    describe('Job initialization', () => {
      it('should start when V2 payment system is enabled', async () => {
        await paymentVerificationJob.start();
        
        expect(paymentVerificationJob.job).toBeDefined();
        expect(paymentVerificationJob.checkInterval).toBe(5);
        expect(paymentVerificationJob.maxAttempts).toBe(48);
        
        paymentVerificationJob.stop();
      });

    });
  ```

  with:

  ```javascript
    describe('Job initialization', () => {
      it('should prefer payment_scan_interval_ms over the legacy payment_check_interval', async () => {
        // initializeDefaults (tests/setup.js beforeEach) seeds the canonical
        // payment_scan_interval_ms = 120000 (2 min); this file's beforeAll seeded
        // the legacy payment_check_interval = 300000 (5 min). The new key wins.
        await paymentVerificationJob.start();

        expect(paymentVerificationJob.job).toBeDefined();
        expect(paymentVerificationJob.checkInterval).toBe(2);
        // Detection cap still reads the legacy key — PR 8 decouples the counters.
        expect(paymentVerificationJob.maxAttempts).toBe(48);

        paymentVerificationJob.stop();
      });

      it('should fall back to legacy payment_check_interval when payment_scan_interval_ms is absent', async () => {
        // The global afterEach wiped the beforeAll rows; recreate only the legacy key
        // and remove the canonical one that initializeDefaults just seeded.
        await SystemConfig.deleteMany({ key: 'payment_scan_interval_ms' });
        await SystemConfig.create({ key: 'payment_check_interval', value: 300000, dataType: 'number', category: 'payment' });

        await paymentVerificationJob.start();

        expect(paymentVerificationJob.checkInterval).toBe(5);

        paymentVerificationJob.stop();
      });

    });
  ```

- [ ] Run and confirm the red/green split is exactly right:

  ```bash
  npm test -- tests/unit/paymentVerificationJob.test.js -t "Job initialization"
  ```

  Expected: the **precedence** test fails with `Expected: 2, Received: 5` (the job still reads only the legacy key — the right reason). The **fallback** test passes already (it describes current behavior; it is the regression guard that survives the implementation).

- [ ] Implement: in `server/jobs/paymentVerificationJob.js` `start()`, replace lines 27–30:

  ```javascript
      // Get check interval from config (in milliseconds, convert to minutes for cron)
      const intervalMs = await SystemConfig.getValue('payment_check_interval', 300000);
      this.checkInterval = Math.max(1, Math.round(intervalMs / 60000)); // Convert to minutes, minimum 1
      this.maxAttempts = await SystemConfig.getValue('payment_check_max_attempts', 48);
  ```

  with:

  ```javascript
      // PR 3 (redesign spec §8): payment_scan_interval_ms is the canonical IMAP
      // detection cadence; the retired payment_check_interval is read only as a
      // fallback until PR 8 rewrites this job.
      const legacyIntervalMs = await SystemConfig.getValue('payment_check_interval', 300000);
      const intervalMs = await SystemConfig.getValue('payment_scan_interval_ms', legacyIntervalMs);
      this.checkInterval = Math.max(1, Math.round(intervalMs / 60000)); // Convert to minutes, minimum 1
      // PR 8 handoff: maxAttempts is the DETECTION cap (48 IMAP scans), NOT the
      // reminder cap (payment_reminder_max_attempts = 8). Keep the legacy read here;
      // PR 8 decouples detection vs reminder counters and deletes both legacy reads.
      this.maxAttempts = await SystemConfig.getValue('payment_check_max_attempts', 48);
  ```

- [ ] Re-run — expected: both `Job initialization` tests pass. Then run the whole file to catch collateral damage (the `Job status` describe sets `checkInterval` manually, so it is unaffected):

  ```bash
  npm test -- tests/unit/paymentVerificationJob.test.js
  ```

- [ ] Update the ops script `scripts/ops/update-payment-interval.js` to operate on the canonical key. Replace lines 22–26:

  ```javascript
    // Update payment check interval to 60 seconds (60000 milliseconds)
    const intervalMs = 60000; // 1 minute
    
    await SystemConfig.setValue('payment_check_interval', intervalMs);
    console.log(`Payment check interval updated to ${intervalMs}ms (${intervalMs / 1000} seconds)`);
  ```

  with:

  ```javascript
    // Update the IMAP payment-detection scan interval to 60 seconds (the
    // canonical key seeded by initializeDefaults; min 60000 per spec §8)
    const intervalMs = 60000; // 1 minute

    await SystemConfig.setValue('payment_scan_interval_ms', intervalMs);
    console.log(`Payment scan interval updated to ${intervalMs}ms (${intervalMs / 1000} seconds)`);
  ```

  and replace line 33:

  ```javascript
    const currentInterval = await SystemConfig.getValue('payment_check_interval');
  ```

  with:

  ```javascript
    const currentInterval = await SystemConfig.getValue('payment_scan_interval_ms');
  ```

  (`setValue` throws on unknown keys; after Task 1 the canonical key is always seeded, so the script no longer depends on a hand-created legacy row. 60000 sits exactly on the §8 minimum, so validation passes.)

- [ ] Grep that no production code still *writes* the legacy names, and that reads survive only at the two sanctioned fallback sites:

  ```bash
  grep -rn "payment_check_interval\|payment_check_max_attempts" server/ scripts/ tests/ --include="*.js"
  ```

  Expected output — exactly these sites and no others: `server/jobs/paymentVerificationJob.js` (the two fallback reads + comment), `tests/unit/paymentVerificationJob.test.js` (beforeAll fixture, fallback test, afterAll cleanup list).

- [ ] Commit:

  ```bash
  git add server/jobs/paymentVerificationJob.js scripts/ops/update-payment-interval.js tests/unit/paymentVerificationJob.test.js
  git commit -m "refactor(config): retire payment_check_interval behind payment_scan_interval_ms

paymentVerificationJob now prefers the canonical 2-minute detection key
and reads the retired payment_check_interval only as a fallback (deleted
in PR 8 when the job is rewritten). maxAttempts intentionally keeps the
legacy detection cap — payment_reminder_max_attempts has reminder
semantics and is wired in PR 8. Ops script repointed at the new key."
  ```

---

## Task 4: Full-suite green + tick the spec §12 checklist

**Files:**
- Modify: `docs/superpowers/specs/2026-06-08-invite-bag-workflow-redesign-design.md` (§12 checklist, line 829)

**Steps:**

- [ ] Run the full suite — must be green with no `--forceExit`:

  ```bash
  npm test
  ```

  Expected: all suites pass. The only suites with PR-3-sensitive assertions are the three already updated (`tests/unit/systemConfig.test.js`, `tests/unit/paymentVerificationJob.test.js`, `tests/integration/v2-complete-payment-flow.test.js`). Pre-verified non-risks: `tests/unit/systemConfigRoutes.test.js` fully mocks the model; `tests/integration/systemConfig.test.js` uses `toBeGreaterThan(0)`-style assertions (no exact public-config counts), so the new `store_pickup_address` public key cannot break it. If anything else fails, triage per house rules — fix before advancing, do not skip.

- [ ] Run lint (the touched server files must stay `console.*`-free; the ops script is `scripts/`, where `console` is allowed):

  ```bash
  npx eslint server/models/SystemConfig.js server/jobs/paymentVerificationJob.js
  ```

  Expected: no errors.

- [ ] In `docs/superpowers/specs/2026-06-08-invite-bag-workflow-redesign-design.md`, line 829, change:

  ```markdown
  - [ ] PR 3 — SystemConfig keys seeded; legacy keys retired; `laundry_bag_fee` deleted
  ```

  to:

  ```markdown
  - [x] PR 3 — SystemConfig keys seeded; legacy keys retired; `laundry_bag_fee` deleted
  ```

- [ ] Commit:

  ```bash
  git add docs/superpowers/specs/2026-06-08-invite-bag-workflow-redesign-design.md
  git commit -m "docs(spec): tick PR 3 (SystemConfig keys) in the redesign build checklist"
  ```

---

## Verification

**Full suite (must pass without `--forceExit`):**

```bash
npm test
```

**Targeted re-runs:**

```bash
npm test -- tests/unit/systemConfig.test.js
npm test -- tests/unit/paymentVerificationJob.test.js
npm test -- tests/integration/v2-complete-payment-flow.test.js
npm test -- tests/integration/systemConfig.test.js
```

**Manual smoke checks:**

1. Seeding sanity against a throwaway in-memory DB (proves `initializeDefaults` + `getValue` outside Jest):

   ```bash
   node -e "
   (async () => {
     const { MongoMemoryServer } = require('mongodb-memory-server');
     const mongoose = require('mongoose');
     const mem = await MongoMemoryServer.create();
     await mongoose.connect(mem.getUri('smoke'));
     const SystemConfig = require('./server/models/SystemConfig');
     await SystemConfig.initializeDefaults();
     console.log('scan_ms   =', await SystemConfig.getValue('payment_scan_interval_ms'));
     console.log('reminders =', await SystemConfig.getValue('payment_reminder_max_attempts'));
     console.log('store     =', await SystemConfig.getValue('store_pickup_address'));
     console.log('bag_fee   =', await SystemConfig.getValue('laundry_bag_fee', 'GONE'));
     console.log('alias     =', await SystemConfig.getValue('w9_earnings_threshold'));
     console.log('canonical =', await SystemConfig.getValue('w9_threshold_usd'));
     await mongoose.disconnect(); await mem.stop();
   })().catch(e => { console.error(e); process.exit(1); });
   "
   ```

   Expected: `120000`, `8`, `825 E Rundberg Ln F1, Austin, TX 78753`, `GONE`, `600`, `600`.

2. Grep gates (all three must hold):

   ```bash
   grep -rn "laundry_bag_fee" server/ public/ tests/ scripts/ --include="*.js" --include="*.html" --include="*.json"   # no output
   grep -rn "payment_check_interval" server/ scripts/ --include="*.js"                                                  # only the 2 fallback lines in paymentVerificationJob.js
   grep -c "key: '" server/models/SystemConfig.js                                                                       # 31 (15 original − 1 deleted + 17 new), assuming PR 1/2 left the seed list untouched
   ```

3. `store_pickup_address` is exposed publicly (it is the one new `isPublic:true` key): start the app locally and `curl -s localhost:3000/api/v1/system/config/public | grep -o 'store_pickup_address'` → one hit; confirm **none** of the other 16 new keys appear in that response.

**Interfaces this PR exposes for later PRs** (read via `await SystemConfig.getValue(key, default)`): `payment_scan_interval_ms` + `payment_reminder_interval_minutes` + `payment_reminder_max_attempts` + `payment_hold_notice_enabled` + `store_pickup_address` (PR 8); `invite_token_ttl_hours` (PR 5); `bag_mint_max_batch`, `bag_token_bytes`, `bag_label_columns`, `bag_label_qr_size_px` (PR 6); `delivery_code_max_attempts`, `operator_scan_code_max_attempts`, `operator_scan_code_length`, `customer_delivery_pin_length`, `affiliate_delivery_code_length` (PR 9); `w9_max_upload_mb`, `w9_threshold_usd` (+ legacy alias `w9_earnings_threshold`) (PR 10).

**PR description text:**

> ## PR 3 — SystemConfig key additions/retirements (redesign spec §8, §12)
>
> Pure configuration plumbing for the invite/bag/workflow redesign. No behavior change other than the payment-detection cadence default moving from 5 min to the spec's 2 min.
>
> **Added (17 keys, seeded in `initializeDefaults()` with §8 defaults/ranges):** `payment_scan_interval_ms` (120000, 60000–600000), `payment_reminder_interval_minutes` (60, 15–240), `payment_reminder_max_attempts` (8, 1–24), `payment_hold_notice_enabled` (true), `invite_token_ttl_hours` (72, 1–336), `w9_max_upload_mb` (10, 1–25), `w9_threshold_usd` (600, 0–10000), `bag_mint_max_batch` (200, 1–500), `bag_token_bytes` (16, 12–32), `bag_label_columns` (3, 1–6), `bag_label_qr_size_px` (300, 150–600), `store_pickup_address` (public), `delivery_code_max_attempts` (5, 3–10), `operator_scan_code_max_attempts` (5, 3–10), `operator_scan_code_length` (8, 6–12), `customer_delivery_pin_length` (6, 4–10), `affiliate_delivery_code_length` (6, 4–10).
>
> **Retired:** `payment_check_interval` — `paymentVerificationJob` now prefers `payment_scan_interval_ms` and reads the old name only as a fallback (fallback deleted in PR 8). `payment_check_max_attempts` is still read as the IMAP **detection** cap on purpose; PR 8 decouples detection vs reminder counters. Ops script repointed.
>
> **Deleted:** `laundry_bag_fee` (V1 bag-purchase artifact) — seed, test fixture, and the V1 customer-success bag-credit fetch removed; repo-wide grep is clean.
>
> **Alias:** `w9_earnings_threshold` stays seeded as the accepted legacy alias of `w9_threshold_usd`. Note for PR 10: `affiliatePaymentLockService` reads **no** config key today (lock/unlock is admin-manual), so the threshold consumer built in PR 10 must read `w9_threshold_usd` with `w9_earnings_threshold` as the DB fallback.
>
> Tests: table-driven seed assertions + §8 range enforcement + retired-key guards (`tests/unit/systemConfig.test.js`); precedence + fallback tests for the job interval (`tests/unit/paymentVerificationJob.test.js`). Full suite green without `--forceExit`.
>
> 🤖 Generated with [Claude Code](https://claude.com/claude-code)
