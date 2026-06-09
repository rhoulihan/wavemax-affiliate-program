# PR 4 — Order Model Redesign + State Machine + Ready Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the legacy order lifecycle (`pending/processing/processed/complete/cancelled`) with the redesigned one (`in_progress/processed/ready_for_pickup/picked_up/delivered/cancelled`), introduce the single shared `orderStateMachine` + canonical `orderReadyGateService.applyReadyGate` gate, and rewrite `server/models/Order.js` to the spec §4.4 shape (bag reference, intake snapshot, proof-of-delivery, payment-hold fields, no estimates/scheduling/multi-bag machinery).

**Architecture:** `server/modules/orders/orderStateMachine.js` becomes the only transition map (killing the two duplicates in `orderController` and the hardcoded lists in `orderBulkService`); `server/services/orderReadyGateService.js` becomes the only path into `ready_for_pickup` and the sole writer of `readyForPickupAt`. The Order pre-save *reads* pricing inputs (`feeBreakdown.totalFee`, operator-entered add-ons) and computes totals from `actualWeight` only — the estimated-total and weight-variance branches are deleted. Downstream services that still write/query the old enum get a mechanical literal re-map (their structural rework is PR 7/8/9).

**Tech Stack:** Node 20 / Express 4 / Mongoose / Jest 29 + Supertest + mongodb-memory-server fallback (`tests/setup.js` owns the connection and runs `SystemConfig.initializeDefaults()` per-file patterns).

**Assumed starting state (PRs 1–3 of `docs/superpowers/specs/2026-06-08-invite-bag-workflow-redesign-design.md` §12 are merged):**

- **PR 1 (Paygistix removal):** `server/controllers/paymentController.js`, `server/services/{callbackPoolManager,customerPaymentService,orderPaymentService}.js`, `server/services/paygistix/`, `server/models/{Payment,PaymentToken,CallbackPool}.js`, `server/routes/{paymentRoutes,paymentCallbackRoute,generalPaymentCallback}.js` and their tests (`tests/unit/payment*.test.js`, `tests/unit/generalPaymentCallback.test.js`, `tests/unit/v2PaymentModels.test.js`, `tests/integration/payment.test.js`) are **gone**. The Order `refund*` block may or may not have been dropped by PR 1 — this PR's model rewrite drops it regardless.
- **PR 2 (scheduling / Pickup Now / Beta removal):** `orderController.createOrder`, `createImmediateOrder`, `checkImmediateAvailability`, `checkActiveOrders` and their routes (`POST /`, `/immediate*`, `/check-active` in `orderRoutes.js`), `server/services/orderImmediatePickupHours.js`, `affiliateScheduleController/Routes`, BetaRequest, and their tests (`tests/unit/affiliateSchedule.test.js`, `tests/integration/{affiliateSchedule,immediate-pickup,orderScheduleValidation}.test.js`, `tests/frontend/schedulePickupAddOns.test.js`) are **gone**. The Order **model** still has the scheduling fields — removing them is THIS PR's job (§4.4).
- **PR 3 (SystemConfig):** new keys seeded; `laundry_bag_fee` deleted. No interface this PR consumes beyond `wdf_base_rate_per_pound` (pre-existing).

All line numbers below refer to current `main` for files PRs 1–3 don't touch (`Order.js`, `orderBulkService.js`, operator services, dashboards, formatters, fieldFilter, test factories). For `orderController.js`/`orderRoutes.js`, line numbers will have shifted after PR 2's deletions — every Modify step therefore quotes the **exact code to find**, not just a line number. Task 0 verifies all of this before any change.

**Execution contract (read first):** Tasks 1–7 are one breaking wave. The **full** suite is expected red from the moment Task 2's model lands until Task 7 completes; each task's own scoped test command must be green as stated before its commit. Do not merge mid-wave; the PR merges once Task 8's full-suite gate passes. This is the §12 "biggest-risk PR" — the enum change touches ~35 surviving test files (enumerated in Task 7 from live greps).

---

## Canonical status-mapping table (used by every task)

| Old (orders) | New | Notes |
|:---|:---|:---|
| `pending` | `in_progress` | Order is now born at intake — there is no pre-intake state |
| `processing` | `in_progress` | |
| `processed` | `processed` | unchanged |
| `complete` | `delivered` | Old `complete` = terminal success; commission realizes at `delivered` |
| `scheduled` | *(delete)* | Was never in the model enum — only in dead controller maps |
| *(new)* | `ready_for_pickup` | ONLY via `applyReadyGate`; direct PUT rejected |
| *(new)* | `picked_up` | Operator scan-OUT (wired in PR 9; reachable via PUT here) |

| Old (bags[] sub-status / keys) | New |
|:---|:---|
| `processing` | `intake` |
| `processed` | `processed` |
| `completed` | `picked_up` |
| `bags[].bagId` | `bags[].bagToken` (NEVER `bagId` inside `bags[]`) |
| `scannedAt.processing` / `scannedBy.processing` | `scannedAt.intake` / `scannedBy.intake` |
| `scannedAt.completed` / `scannedBy.completed` | `scannedAt.picked_up` / `scannedBy.picked_up` |

| Old field | New |
|:---|:---|
| `completedAt` | `deliveredAt` |
| `processingStartedAt` | *(deleted; `intakeAt` is the new start-of-life stamp)* |
| `estimatedWeight`, `estimatedTotal`, `weightDifference` | *(deleted — no estimate exists)* |
| `numberOfBags`, `bagsWeighed`, `bagsProcessed`, `bagsPickedUp`, `bagWeights[]` | *(deleted — one bag = one order)* |
| `pickupDate`, `pickupTime`, `specialPickupInstructions` | *(deleted — no scheduling)* |
| `isImmediatePickup`, `pickupDeadline`, `immediatePickupRequestedAt` | *(deleted)* |
| `refundAmount/Reason/Reference/refundedAt` | *(deleted — Paygistix-only)* |

---

## Task 0: Preflight — verify the assumed starting state

**Files:** none (verification only).

- [ ] Confirm PR 1/PR 2 deletions actually happened:

  ```bash
  cd /mnt/c/Users/rickh/GitHub/wavemax-affiliate-program
  ls server/controllers/paymentController.js server/services/paygistix 2>&1 | grep -c "No such file"   # expect 2
  grep -c "createImmediateOrder\|checkActiveOrders\|createOrder = " server/controllers/orderController.js  # expect 0
  grep -c "post('/'," server/routes/orderRoutes.js   # expect 0
  ```

  **Contingency:** if any of these still exist, PR 2 was not fully merged. Do NOT absorb its scope silently — stop and reconcile with the PR 2 plan (`git log --oneline -20` to see what landed). The only acceptable local fix is deleting a small straggler (e.g. a leftover route line) that PR 2's plan clearly owns, noted in this PR's description.

- [ ] Confirm the suite is green at the starting commit (records the baseline):

  ```bash
  npm test 2>&1 | tail -5
  ```

- [ ] Confirm the files this plan modifies exist with the expected anchors:

  ```bash
  grep -n "enum: \['pending', 'processing', 'processed', 'complete', 'cancelled'\]" server/models/Order.js   # 1 hit
  grep -n "const validStatuses = \['pending', 'scheduled', 'processing', 'processed', 'complete', 'cancelled'\]" server/services/orderBulkService.js  # 1 hit
  grep -n "sendOrderReadyNotification" server/services/email/dispatcher/ops.js  # exports at ~L73
  ```

No commit for this task.

---

## Task 1: `server/modules/orders/orderStateMachine.js` (new module, pure logic)

**Files:**
- Create: `tests/unit/orderStateMachine.test.js`
- Create: `server/modules/orders/orderStateMachine.js`

- [ ] **Write the failing test first** — `tests/unit/orderStateMachine.test.js` (full file):

  ```javascript
  // Unit tests for the single shared order-status transition map (design §6.4).
  // Pure logic — no DB needed. `{ virtual: true }` lets this mock exist before
  // the real orderReadyGateService file is created in Task 4.
  jest.mock(
    '../../server/services/orderReadyGateService',
    () => ({ applyReadyGate: jest.fn().mockResolvedValue({ promoted: true, held: false }) }),
    { virtual: true }
  );

  const {
    TRANSITIONS,
    canTransition,
    applyTransition,
    maybeReadyForPickup,
    TransitionError
  } = require('../../server/modules/orders/orderStateMachine');
  const { applyReadyGate } = require('../../server/services/orderReadyGateService');

  describe('orderStateMachine', () => {
    describe('TRANSITIONS', () => {
      it('defines the canonical map from design §6.4', () => {
        expect(TRANSITIONS).toEqual({
          in_progress: ['processed', 'cancelled'],
          processed: ['ready_for_pickup', 'cancelled'],
          ready_for_pickup: ['picked_up'],
          picked_up: ['delivered'],
          delivered: [],
          cancelled: []
        });
      });
    });

    describe('canTransition', () => {
      it.each([
        ['in_progress', 'processed'],
        ['in_progress', 'cancelled'],
        ['processed', 'ready_for_pickup'],
        ['processed', 'cancelled'],
        ['ready_for_pickup', 'picked_up'],
        ['picked_up', 'delivered']
      ])('allows %s -> %s', (from, to) => {
        expect(canTransition(from, to)).toBe(true);
      });

      it.each([
        ['in_progress', 'ready_for_pickup'], // must pass through processed
        ['in_progress', 'picked_up'],
        ['in_progress', 'delivered'],
        ['processed', 'picked_up'],          // must pass through the gate
        ['processed', 'delivered'],
        ['ready_for_pickup', 'cancelled'],   // cancel only from in_progress/processed
        ['picked_up', 'cancelled'],
        ['delivered', 'cancelled'],
        ['cancelled', 'in_progress'],
        ['pending', 'processing'],           // old enum values are dead
        [undefined, 'processed']
      ])('rejects %s -> %s', (from, to) => {
        expect(canTransition(from, to)).toBe(false);
      });
    });

    describe('applyTransition', () => {
      it('sets the status and stamps processedAt set-once', () => {
        const order = { status: 'in_progress' };
        applyTransition(order, 'processed');
        expect(order.status).toBe('processed');
        expect(order.processedAt).toBeInstanceOf(Date);
        const first = order.processedAt;
        order.status = 'in_progress'; // contrived re-run to prove set-once
        applyTransition(order, 'processed');
        expect(order.processedAt).toBe(first);
      });

      it('stamps pickedUpAt on picked_up', () => {
        const order = { status: 'ready_for_pickup' };
        applyTransition(order, 'picked_up');
        expect(order.status).toBe('picked_up');
        expect(order.pickedUpAt).toBeInstanceOf(Date);
      });

      it('stamps deliveredAt and realizes commission exactly once on delivered', () => {
        const order = { status: 'picked_up' };
        applyTransition(order, 'delivered');
        expect(order.deliveredAt).toBeInstanceOf(Date);
        expect(order.commissionRealized).toBe(true);
        expect(order.commissionRealizedAt).toBeInstanceOf(Date);
      });

      it('stamps cancelledAt on cancel from processed', () => {
        const order = { status: 'processed' };
        applyTransition(order, 'cancelled');
        expect(order.status).toBe('cancelled');
        expect(order.cancelledAt).toBeInstanceOf(Date);
      });

      it('does NOT stamp readyForPickupAt (sole writer is the ready gate)', () => {
        const order = { status: 'processed' };
        applyTransition(order, 'ready_for_pickup');
        expect(order.status).toBe('ready_for_pickup');
        expect(order.readyForPickupAt).toBeUndefined();
      });

      it('throws TransitionError on an invalid transition and leaves the order untouched', () => {
        const order = { status: 'delivered' };
        expect(() => applyTransition(order, 'cancelled')).toThrow(TransitionError);
        expect(order.status).toBe('delivered');
        expect(order.cancelledAt).toBeUndefined();
      });
    });

    describe('maybeReadyForPickup', () => {
      it('delegates to orderReadyGateService.applyReadyGate', async () => {
        const order = { status: 'processed' };
        const result = await maybeReadyForPickup(order, { trigger: 'unit_test' });
        expect(applyReadyGate).toHaveBeenCalledWith(order, { trigger: 'unit_test' });
        expect(result).toEqual({ promoted: true, held: false });
      });
    });
  });
  ```

- [ ] Run it — must fail on module resolution:

  ```bash
  npm test -- tests/unit/orderStateMachine.test.js
  ```

  **Expected failure:** `Cannot find module '../../server/modules/orders/orderStateMachine'`.

- [ ] **Implement** `server/modules/orders/orderStateMachine.js` (full file):

  ```javascript
  // Single source of truth for order-status transitions (design §6.4).
  // Replaces the duplicate maps that previously lived in orderController
  // (updateOrderStatus validTransitions + checkStatusTransition) and the
  // hardcoded status lists in orderBulkService.

  const TRANSITIONS = {
    in_progress: ['processed', 'cancelled'],
    processed: ['ready_for_pickup', 'cancelled'],
    ready_for_pickup: ['picked_up'],
    picked_up: ['delivered'],
    delivered: [],
    cancelled: []
  };

  class TransitionError extends Error {
    constructor(from, to) {
      super(`Invalid status transition from ${from} to ${to}`);
      this.code = 'invalid_transition';
      this.statusCode = 400;
      Error.captureStackTrace(this, this.constructor);
    }
  }

  function canTransition(from, to) {
    return Array.isArray(TRANSITIONS[from]) && TRANSITIONS[from].includes(to);
  }

  /**
   * Validate + apply a transition on an order document and stamp the matching
   * lifecycle timestamp (set-once). Does NOT save — callers own persistence.
   *
   * readyForPickupAt is deliberately NOT stamped here: its sole writer is
   * orderReadyGateService.applyReadyGate (design §4.4, settled decision §13 #3).
   *
   * @param {Object} order - mongoose Order doc (or plain object in unit tests)
   * @param {string} to - target status
   * @returns {Object} the mutated order
   * @throws {TransitionError} when TRANSITIONS does not allow the move
   */
  function applyTransition(order, to) {
    if (!canTransition(order.status, to)) {
      throw new TransitionError(order.status, to);
    }
    order.status = to;
    const now = new Date();
    switch (to) {
    case 'processed':
      if (!order.processedAt) order.processedAt = now;
      break;
    case 'picked_up':
      if (!order.pickedUpAt) order.pickedUpAt = now;
      break;
    case 'delivered':
      if (!order.deliveredAt) order.deliveredAt = now;
      if (!order.commissionRealized) {
        order.commissionRealized = true;
        order.commissionRealizedAt = now;
      }
      break;
    case 'cancelled':
      if (!order.cancelledAt) order.cancelledAt = now;
      break;
    }
    return order;
  }

  /**
   * The GATE — thin delegate (design §6.4). orderReadyGateService.applyReadyGate
   * owns the logic: promotes processed+verified to ready_for_pickup, stamps
   * readyForPickupAt (sole writer), toggles heldAtStore, saves, and reuses
   * sendOrderReadyNotification. Lazy require avoids a load-time cycle (the gate
   * service requires this module for applyTransition).
   */
  function maybeReadyForPickup(order, ctx) {
    return require('../../services/orderReadyGateService').applyReadyGate(order, ctx);
  }

  module.exports = { TRANSITIONS, canTransition, applyTransition, maybeReadyForPickup, TransitionError };
  ```

- [ ] Run again — expect **11+ passing, 0 failing**:

  ```bash
  npm test -- tests/unit/orderStateMachine.test.js
  ```

- [ ] Full suite is still green (new module is not yet imported anywhere):

  ```bash
  npm test 2>&1 | tail -3
  ```

- [ ] Commit:

  ```bash
  git add server/modules/orders/orderStateMachine.js tests/unit/orderStateMachine.test.js
  git commit -m "feat(orders): add shared orderStateMachine (TRANSITIONS, applyTransition, gate delegate)

  Single transition map per design §6.4; replaces controller/bulk duplicates
  in the next commits. maybeReadyForPickup delegates to the canonical
  orderReadyGateService.applyReadyGate (settled §13 #3).

  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```

---

## Task 2: Rewrite `server/models/Order.js` (THE breaking change)

**Files:**
- Create: `tests/unit/order.model.test.js` (spec §11's canonical name)
- Modify: `server/models/Order.js` (full rewrite, 273 lines today)
- Delete: `tests/unit/orderModel.test.js`, `tests/unit/orderModelSimple.test.js`, `tests/unit/orderWithSystemConfig.test.js`, `tests/unit/wdfCreditModel.test.js` — all four are line-coverage suites for the **old** pre-save (estimatedTotal branch, `processingStartedAt`/`completedAt` stamps, estimate-based pricing). Their still-relevant coverage (SystemConfig fallback, commission math, credit application, set-once stamps) is reproduced in the new file below.

> From this commit until Task 7 completes, the full suite is red (expected — see Execution contract). The scoped command for this task must be green.

- [ ] **Write the failing test first** — `tests/unit/order.model.test.js` (full file):

  ```javascript
  // Order model — redesigned schema + pre-save engine (design §4.4).
  // Replaces orderModel.test.js / orderModelSimple.test.js /
  // orderWithSystemConfig.test.js / wdfCreditModel.test.js.
  const { v4: uuidv4 } = require('uuid');
  const Order = require('../../server/models/Order');
  const SystemConfig = require('../../server/models/SystemConfig');

  function buildOrder(overrides = {}) {
    return new Order({
      customerId: 'CUST-model-test',
      affiliateId: 'AFF-model-test',
      bagId: 'BAG-' + uuidv4(),
      bagToken: 'a1b2c3d4e5f60718293a4b5c6d7e8f90', // 32-hex scan key
      actualWeight: 20,
      feeBreakdown: { numberOfBags: 1, minimumFee: 10, perBagFee: 2, totalFee: 10, minimumApplied: true },
      ...overrides
    });
  }

  describe('Order model (redesigned)', () => {
    beforeAll(async () => {
      await SystemConfig.initializeDefaults();
    });

    afterEach(async () => {
      await Order.deleteMany({});
    });

    describe('schema shape', () => {
      it('defaults status to in_progress', async () => {
        const order = await buildOrder().save();
        expect(order.status).toBe('in_progress');
      });

      it('rejects the old enum values', async () => {
        for (const dead of ['pending', 'processing', 'complete']) {
          await expect(buildOrder({ status: dead }).save())
            .rejects.toThrow(/is not a valid enum value/);
        }
      });

      it('accepts every new enum value', async () => {
        for (const status of ['in_progress', 'processed', 'ready_for_pickup', 'picked_up', 'delivered', 'cancelled']) {
          const order = await buildOrder({ status }).save();
          expect(order.status).toBe(status);
          await Order.deleteMany({});
        }
      });

      it('requires top-level bagId (the BAG-uuid join key)', async () => {
        const order = buildOrder();
        order.bagId = undefined;
        await expect(order.save()).rejects.toThrow(/bagId.*required/i);
      });

      it('bags[] sub-doc uses bagToken (never bagId) and the new sub-status enum', async () => {
        const order = await buildOrder({
          bags: [{
            bagToken: 'a1b2c3d4e5f60718293a4b5c6d7e8f90',
            bagNumber: 1,
            scannedAt: { intake: new Date() }
          }]
        }).save();
        expect(order.bags[0].bagToken).toBe('a1b2c3d4e5f60718293a4b5c6d7e8f90');
        expect(order.bags[0].status).toBe('intake'); // default
        expect(order.schema.path('bags').schema.path('bagId')).toBeUndefined();

        await expect(buildOrder({
          bags: [{ bagToken: 'b'.repeat(32), bagNumber: 1, status: 'processing' }] // old value
        }).save()).rejects.toThrow(/is not a valid enum value/);
      });

      it('has dropped the estimate / scheduling / multi-bag / refund fields', () => {
        for (const gone of [
          'estimatedWeight', 'estimatedTotal', 'weightDifference',
          'numberOfBags', 'bagsWeighed', 'bagsProcessed', 'bagsPickedUp', 'bagWeights',
          'pickupDate', 'pickupTime', 'specialPickupInstructions',
          'isImmediatePickup', 'pickupDeadline', 'immediatePickupRequestedAt',
          'refundAmount', 'refundReason', 'refundReference', 'refundedAt',
          'processingStartedAt', 'completedAt'
        ]) {
          expect(Order.schema.path(gone)).toBeUndefined();
        }
      });

      it('validates proofOfDelivery method + confirmedByRole enums', async () => {
        const ok = await buildOrder({
          proofOfDelivery: {
            method: 'customer_pin', confirmedByRole: 'customer',
            confirmedById: 'CUST-model-test', confirmedAt: new Date(),
            geo: { type: 'Point', coordinates: [-97.7431, 30.2672] }
          }
        }).save();
        expect(ok.proofOfDelivery.method).toBe('customer_pin');
        expect(ok.proofOfDelivery.geo.coordinates).toEqual([-97.7431, 30.2672]);

        await expect(buildOrder({
          proofOfDelivery: { method: 'carrier_photo', confirmedByRole: 'customer' }
        }).save()).rejects.toThrow(/is not a valid enum value/);
      });

      it('defaults the new payment-hold fields', async () => {
        const order = await buildOrder().save();
        expect(order.paymentEscalated).toBe(false);
        expect(order.heldAtStore).toBe(false);
        expect(order.holdNoticeSentAt).toBeUndefined();
        expect(order.commissionRealized).toBe(false);
      });
    });

    describe('pre-save pricing engine (actualWeight only)', () => {
      it('fetches baseRate from SystemConfig and computes totals from actualWeight', async () => {
        // defaults: wdf_base_rate_per_pound = 1.25
        const order = await buildOrder({ actualWeight: 20 }).save();
        expect(order.baseRate).toBe(1.25);
        // wdf 20*1.25=25.00; fee 10.00; no add-ons
        expect(order.actualTotal).toBeCloseTo(35.00, 2);
        expect(order.paymentAmount).toBeCloseTo(35.00, 2);
        // commission = wdf*0.1 + fee = 2.50 + 10.00
        expect(order.affiliateCommission).toBeCloseTo(12.50, 2);
      });

      it('falls back to the 1.25 default when SystemConfig.getValue throws', async () => {
        const original = SystemConfig.getValue;
        SystemConfig.getValue = jest.fn().mockRejectedValue(new Error('boom'));
        const order = await buildOrder().save();
        expect(order.baseRate).toBe(1.25);
        SystemConfig.getValue = original;
      });

      it('prices add-ons at 10c/lb each off actualWeight', async () => {
        const order = await buildOrder({
          actualWeight: 20,
          addOns: { premiumDetergent: true, fabricSoftener: true, stainRemover: false }
        }).save();
        // 2 add-ons * 20 lbs * 0.10 = 4.00
        expect(order.addOnTotal).toBeCloseTo(4.00, 2);
        expect(order.actualTotal).toBeCloseTo(25 + 10 + 4, 2);
        // add-ons are NOT in commission
        expect(order.affiliateCommission).toBeCloseTo(12.50, 2);
      });

      it('applies carry-in wdfCreditApplied to actualTotal but not paymentAmount-free commission', async () => {
        const order = await buildOrder({ actualWeight: 20, wdfCreditApplied: 5 }).save();
        expect(order.actualTotal).toBeCloseTo(30.00, 2);      // 35 - 5 credit
        expect(order.paymentAmount).toBeCloseTo(35.00, 2);    // gross, credit-free
        expect(order.affiliateCommission).toBeCloseTo(12.50, 2);
      });

      it('applies a negative credit (debit) by increasing the total', async () => {
        const order = await buildOrder({ actualWeight: 20, wdfCreditApplied: -5 }).save();
        expect(order.actualTotal).toBeCloseTo(40.00, 2);
      });

      it('never generates variance credit (wdfCreditGenerated stays 0)', async () => {
        const order = await buildOrder({ actualWeight: 47.3 }).save();
        expect(order.wdfCreditGenerated).toBe(0);
      });

      it('reads feeBreakdown.totalFee — does not compute the delivery fee', async () => {
        const order = await buildOrder({
          actualWeight: 10,
          feeBreakdown: { numberOfBags: 1, minimumFee: 25, perBagFee: 5, totalFee: 25, minimumApplied: true }
        }).save();
        // wdf 12.50 + fee 25
        expect(order.actualTotal).toBeCloseTo(37.50, 2);
        expect(order.affiliateCommission).toBeCloseTo(1.25 + 25, 2);
      });

      it('recomputes totals when add-ons are entered after creation', async () => {
        const order = await buildOrder({ actualWeight: 20 }).save();
        order.addOns.premiumDetergent = true;
        await order.save();
        expect(order.addOnTotal).toBeCloseTo(2.00, 2);
        expect(order.actualTotal).toBeCloseTo(37.00, 2);
      });
    });

    describe('pre-save lifecycle timestamps', () => {
      it('stamps intakeAt on creation', async () => {
        const order = await buildOrder().save();
        expect(order.intakeAt).toBeInstanceOf(Date);
      });

      it('stamps processedAt / pickedUpAt set-once', async () => {
        const order = await buildOrder().save();
        order.status = 'processed';
        await order.save();
        expect(order.processedAt).toBeInstanceOf(Date);
        const firstProcessedAt = order.processedAt;

        order.status = 'ready_for_pickup'; // direct write (gate normally does this)
        await order.save();
        order.status = 'picked_up';
        await order.save();
        expect(order.pickedUpAt).toBeInstanceOf(Date);
        expect(order.processedAt).toEqual(firstProcessedAt);
      });

      it('does NOT stamp readyForPickupAt (sole writer = applyReadyGate)', async () => {
        const order = await buildOrder({ status: 'processed' }).save();
        order.status = 'ready_for_pickup';
        await order.save();
        expect(order.readyForPickupAt).toBeUndefined();
      });

      it('stamps deliveredAt + commissionRealized/At once on delivered', async () => {
        const order = await buildOrder({ status: 'picked_up' }).save();
        order.status = 'delivered';
        await order.save();
        expect(order.deliveredAt).toBeInstanceOf(Date);
        expect(order.commissionRealized).toBe(true);
        const stamp = order.commissionRealizedAt;
        order.operatorNotes = 'touch';
        await order.save();
        expect(order.commissionRealizedAt).toEqual(stamp); // set-once
      });

      it('stamps cancelledAt on cancelled', async () => {
        const order = await buildOrder().save();
        order.status = 'cancelled';
        await order.save();
        expect(order.cancelledAt).toBeInstanceOf(Date);
      });

      it('stamps paymentVerifiedAt when paymentStatus flips to verified', async () => {
        const order = await buildOrder({ paymentStatus: 'awaiting' }).save();
        order.paymentStatus = 'verified';
        await order.save();
        expect(order.paymentVerifiedAt).toBeInstanceOf(Date);
      });
    });
  });
  ```

- [ ] Run it — must fail on the OLD schema (missing `pickupDate`/`pickupTime`/`estimatedWeight` required validators fire, old enum accepted):

  ```bash
  npm test -- tests/unit/order.model.test.js
  ```

  **Expected failure:** `ValidationError: Order validation failed: pickupDate: Path \`pickupDate\` is required.` (plus `pickupTime`, `estimatedWeight`) on the first `buildOrder().save()`.

- [ ] **Implement** — replace the entire contents of `server/models/Order.js` with:

  ```javascript
  // Order Model for WaveMAX Laundry Affiliate Program
  //
  // Redesigned per docs/superpowers/specs/2026-06-08-invite-bag-workflow-redesign-design.md §4.4:
  // orders are created at store intake (one durable bag = one order), priced from
  // actualWeight only (no customer estimate exists), and move through
  // in_progress -> processed -> ready_for_pickup -> picked_up -> delivered.
  // ready_for_pickup is gated on payment (orderReadyGateService.applyReadyGate is
  // the SOLE writer of readyForPickupAt — never this pre-save, never a direct PUT).

  const mongoose = require('mongoose');
  const { v4: uuidv4 } = require('uuid');
  const SystemConfig = require('./SystemConfig');

  const orderSchema = new mongoose.Schema({
    orderId: {
      type: String,
      default: () => 'ORD-' + uuidv4(),
      unique: true
    },
    customerId: { type: String, required: true, ref: 'Customer' },
    affiliateId: { type: String, required: true, ref: 'Affiliate' },

    // Durable bag reference (one bag = one order) — design §4.1 "one identifier per role":
    bagId: { type: String, required: true, ref: 'Bag', index: true },  // == Bag.bagId (BAG-uuid); the JOIN key
    bagToken: { type: String, index: true },                           // == Bag.token (32 hex); denormalized SCAN key

    // Order status
    status: {
      type: String,
      enum: ['in_progress', 'processed', 'ready_for_pickup', 'picked_up', 'delivered', 'cancelled'],
      default: 'in_progress'
    },

    // Laundry details
    actualWeight: Number,
    washInstructions: String,

    // Per-order intake snapshot (resets every order; lives here, NOT on the durable Bag)
    intake: {
      weight: { type: Number, default: 0 },
      weighedAt: Date,
      weighedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Operator' },
      processedAt: Date,
      processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Operator' },
      pickedUpAt: Date,                                                // operator scans bag OUT of store
      pickedUpBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Operator' },
      deliveredAt: Date,                                               // affiliate scans at customer door
      deliveredBy: { type: String, ref: 'Affiliate' },                 // affiliateId string
      addOnFormPlaced: { type: Boolean, default: false },              // operator ack: fresh form in pocket
      addOnFormPlacedAt: Date
    },

    // One-element bags[] kept as an array so the 3-stage scanner can iterate.
    // The reference field is bagToken — NEVER bagId — and carries Bag.token (32 hex).
    bags: [{
      bagToken: { type: String, required: true, index: true },
      bagNumber: { type: Number, required: true },                     // always 1 (one bag = one order)
      status: {
        type: String,
        enum: ['intake', 'processed', 'picked_up', 'delivered'],
        default: 'intake'
      },
      weight: { type: Number, default: 0 },
      scannedAt: { intake: Date, processed: Date, picked_up: Date, delivered: Date },
      scannedBy: {
        intake: { type: mongoose.Schema.Types.ObjectId, ref: 'Operator' },
        processed: { type: mongoose.Schema.Types.ObjectId, ref: 'Operator' },
        picked_up: { type: mongoose.Schema.Types.ObjectId, ref: 'Operator' },
        delivered: { type: String, ref: 'Affiliate' }                  // affiliate door-scan
      }
    }],

    // Add-on services — entered by the operator at intake from the paper form
    addOns: {
      premiumDetergent: { type: Boolean, default: false },
      fabricSoftener: { type: Boolean, default: false },
      stainRemover: { type: Boolean, default: false }
    },
    addOnTotal: { type: Number, default: 0 },
    addOnsEnteredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Operator' },
    addOnsEnteredAt: Date,
    freshAddOnsFormPlaced: { type: Boolean, default: false },          // operator ack: fresh form in pocket
    freshAddOnsFormAckBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Operator' },
    freshAddOnsFormAckAt: Date,

    // Pricing
    baseRate: { type: Number },                                        // per-pound WDF rate from SystemConfig
    feeBreakdown: {
      numberOfBags: Number,
      minimumFee: Number,
      perBagFee: Number,
      totalFee: Number,                                                // the actual fee charged
      minimumApplied: Boolean
    },
    actualTotal: Number,
    wdfCreditApplied: { type: Number, default: 0 },                    // carry-in credit applied at intake
    wdfCreditGenerated: { type: Number, default: 0 },                  // always 0 — no estimate variance exists
    affiliateCommission: { type: Number, default: 0 },

    // Commission realization (realized at 'delivered', not 'picked_up')
    commissionRealized: { type: Boolean, default: false },
    commissionRealizedAt: Date,

    // Operator processing fields
    assignedOperator: { type: mongoose.Schema.Types.ObjectId, ref: 'Operator' },
    operatorNotes: String,
    qualityCheckPassed: { type: Boolean, default: null },
    qualityCheckBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Operator' },
    qualityCheckNotes: String,
    processingTimeMinutes: Number,

    // WDF / delivery fee breakdown extras
    wdfAmount: Number,
    mdfAmount: Number,

    // Post-weigh payment state (enum unchanged — escalation is the boolean below, §4.4)
    paymentStatus: {
      type: String,
      enum: ['pending', 'awaiting', 'confirming', 'verified', 'failed'],
      default: 'pending'
    },
    paymentMethod: {
      type: String,
      enum: ['venmo', 'paypal', 'cashapp', 'multiple', 'pending', 'credit_card'],
      default: 'pending'
    },
    paymentAmount: { type: Number, default: 0 },
    paymentRequestedAt: Date,
    paymentConfirmedAt: Date,                                          // customer clicked "already paid"
    paymentVerifiedAt: Date,
    paymentTransactionId: String,
    paymentLinks: { venmo: String, paypal: String, cashapp: String },
    paymentQRCodes: { venmo: String, paypal: String, cashapp: String },
    paymentCheckAttempts: { type: Number, default: 0 },                // IMAP detection counter (PR 8 decouples cadence)
    lastPaymentCheck: Date,
    paymentNotes: String,
    paymentReminderCount: { type: Number, default: 0 },                // reminder counter (PR 8: hourly, cap 8)
    paymentLastReminderAt: Date,
    paymentReminders: [{
      sentAt: { type: Date, required: true },
      reminderNumber: { type: Number, required: true },
      sentBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Administrator' },
      method: { type: String, enum: ['email', 'sms'], default: 'email' }
    }],
    lastReminderSentAt: Date,
    reminderCount: { type: Number, default: 0 },

    // Payment-hold escalation (design §4.4 — escalated is NOT a paymentStatus value)
    paymentEscalated: { type: Boolean, default: false },               // set true after the 8th reminder (PR 8)
    holdNoticeSentAt: { type: Date },                                  // "come to store" notice sent once (PR 8)
    heldAtStore: { type: Boolean, default: false },                    // processed but unpaid -> physically held

    // Proof of delivery (design §4.4)
    proofOfDelivery: {
      method: { type: String, enum: ['customer_pin', 'affiliate_code', 'reintake', 'manual_confirm'] },
      confirmedByRole: { type: String, enum: ['customer', 'affiliate', 'operator', 'admin'] },
      confirmedById: { type: String },                                 // customerId / affiliateId / operatorId
      confirmedAt: Date,
      geo: { type: { type: String, enum: ['Point'] }, coordinates: { type: [Number] } }, // [lng, lat], optional
      photoKey: String,                                                // FUTURE hook — not built now
      note: { type: String, maxlength: 500 }
    },

    // Test order flag for cleanup
    isTestOrder: { type: Boolean, default: false },

    // Lifecycle timestamps
    createdAt: { type: Date, default: Date.now },
    intakeAt: Date,                                                    // == createdAt for the new flow; explicit for clarity
    processedAt: Date,
    readyForPickupAt: Date,  // SOLE writer = orderReadyGateService.applyReadyGate — never this pre-save, never a direct PUT
    pickedUpAt: Date,                                                  // operator scan-OUT
    deliveredAt: Date,                                                 // renames completedAt
    cancelledAt: Date
  }, { timestamps: true });

  // Pricing + lifecycle pre-save engine (design §4.4 rewrite).
  // Pricing inputs (feeBreakdown, addOns, actualWeight, wdfCreditApplied) must be
  // set BEFORE the first .save() — this hook READS feeBreakdown.totalFee, it does
  // not compute the delivery fee (intake owns that via orderPricingService, PR 7).
  orderSchema.pre('save', async function(next) {
    // Fetch current WDF rate from system config if not explicitly set
    if (this.isNew && !this.baseRate) {
      try {
        this.baseRate = await SystemConfig.getValue('wdf_base_rate_per_pound', 1.25);
      } catch (error) {
        // If SystemConfig is not available, use default
        this.baseRate = 1.25;
      }
    }

    if (this.isNew && !this.intakeAt) {
      this.intakeAt = this.createdAt || new Date();
    }

    // Add-on total — based on actualWeight ONLY (no estimate exists in the at-intake flow)
    if (this.isNew || this.isModified('addOns') || this.isModified('actualWeight')) {
      const weight = this.actualWeight || 0;
      const selectedAddOns = Object.values(this.addOns || {}).filter(selected => selected === true).length;
      this.addOnTotal = parseFloat((selectedAddOns * weight * 0.10).toFixed(2));
    }

    // Actual total / payment amount / commission — actualWeight only; fee READ from feeBreakdown
    if (this.actualWeight &&
        (this.isNew || this.isModified('actualWeight') || this.isModified('addOns') ||
         this.isModified('feeBreakdown') || this.isModified('wdfCreditApplied') || this.isModified('baseRate'))) {
      const totalFee = this.feeBreakdown?.totalFee || 0;
      const wdfTotal = this.actualWeight * this.baseRate;
      const subtotal = wdfTotal + totalFee + (this.addOnTotal || 0);
      // Apply carry-in WDF credit (subtract if positive credit, add if negative/debit)
      this.actualTotal = parseFloat((subtotal - (this.wdfCreditApplied || 0)).toFixed(2));
      // Payment amount is the gross total without credits (credits apply to the customer, not the invoice)
      this.paymentAmount = parseFloat((wdfTotal + totalFee + (this.addOnTotal || 0)).toFixed(2));
      // Affiliate commission = (WDF x 10%) + delivery fee. Add-ons and credits are NOT included.
      this.affiliateCommission = parseFloat(((wdfTotal * 0.1) + totalFee).toFixed(2));
      // No estimate-vs-actual variance exists in the at-intake flow.
      this.wdfCreditGenerated = 0;
    }

    // Stamp paymentVerifiedAt when payment becomes verified
    if (this.isModified('paymentStatus') && this.paymentStatus === 'verified' && !this.paymentVerifiedAt) {
      this.paymentVerifiedAt = new Date();
    }

    // Lifecycle timestamps, set-once. 'ready_for_pickup' is deliberately absent:
    // readyForPickupAt has a single writer — orderReadyGateService.applyReadyGate
    // (design §4.4 / settled §13 #3).
    if (this.isModified('status')) {
      const now = new Date();
      switch (this.status) {
      case 'processed':
        if (!this.processedAt) this.processedAt = now;
        break;
      case 'picked_up':
        if (!this.pickedUpAt) this.pickedUpAt = now;
        break;
      case 'delivered':
        if (!this.deliveredAt) this.deliveredAt = now;
        if (!this.commissionRealized) {
          this.commissionRealized = true;
          this.commissionRealizedAt = now;
        }
        break;
      case 'cancelled':
        if (!this.cancelledAt) this.cancelledAt = now;
        break;
      }
    }

    next();
  });

  // Create model
  const Order = mongoose.model('Order', orderSchema);

  module.exports = Order;
  ```

- [ ] Run the new model tests — expect **all passing**:

  ```bash
  npm test -- tests/unit/order.model.test.js
  ```

- [ ] Delete the superseded model test files and confirm nothing else requires them:

  ```bash
  git rm tests/unit/orderModel.test.js tests/unit/orderModelSimple.test.js tests/unit/orderWithSystemConfig.test.js tests/unit/wdfCreditModel.test.js
  grep -rn "orderModelSimple\|orderWithSystemConfig\|wdfCreditModel" tests/ server/ --include="*.js"   # expect 0 hits
  ```

- [ ] Re-run the two suites this task owns (green), acknowledge the rest of the suite is now red until Task 7:

  ```bash
  npm test -- tests/unit/order.model.test.js tests/unit/orderStateMachine.test.js
  ```

- [ ] Commit:

  ```bash
  git add server/models/Order.js tests/unit/order.model.test.js
  git commit -m "feat(orders)!: redesign Order model — new status enum, bag reference, intake snapshot, no estimates

  Per design §4.4: status enum in_progress/processed/ready_for_pickup/picked_up/
  delivered/cancelled; top-level bagId+bagToken; one-element bags[] keyed by
  bagToken; intake{} snapshot; paymentEscalated/holdNoticeSentAt/heldAtStore;
  proofOfDelivery; commissionRealized at delivered; deliveredAt renames
  completedAt. Pre-save rewritten: pricing from actualWeight only, reads
  feeBreakdown.totalFee, estimated-total + weightDifference branches deleted,
  wdfCreditGenerated pinned to 0, readyForPickupAt NOT stamped here (sole
  writer = applyReadyGate). Removes scheduling/PickupNow/multi-bag/refund fields.
  Supersedes orderModel/orderModelSimple/orderWithSystemConfig/wdfCreditModel tests.

  BREAKING CHANGE: old status values are rejected; remaining suite is repointed
  in the follow-up commits of this PR.

  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```

---

## Task 3: Re-point the shared test factories

**Files:**
- Modify: `tests/testUtils.js` (lines 102–122, `createTestOrder`)
- Modify: `tests/helpers/v2TestHelpers.js` (lines 108–220, `createTestOrder` + `setupV2PaymentScenario`)

These two factories feed most surviving suites; fixing them first shrinks Task 7 dramatically.

- [ ] In `tests/testUtils.js`, replace `createTestOrder` (currently lines 102–122):

  **Old (find this exactly):**

  ```javascript
  async function createTestOrder(customerId, affiliateId, data = {}) {
    const orderData = {
      orderId: `TEST_ORD_${Date.now()}`,
      customerId: customerId,
      affiliateId: affiliateId,
      pickupDate: data.pickupDate || new Date(Date.now() + 86400000),
      pickupTime: data.pickupTime || 'morning',
      estimatedWeight: data.estimatedWeight || 20,
      numberOfBags: data.numberOfBags || 2,
      estimatedTotal: data.estimatedTotal || 30.00,
      bagCreditApplied: data.bagCreditApplied || 0,
      wdfCreditApplied: data.wdfCreditApplied || 0,
      status: data.status || 'pending',
      ...data
    };
  ```

  **New:**

  ```javascript
  async function createTestOrder(customerId, affiliateId, data = {}) {
    const bagToken = data.bagToken || require('crypto').randomBytes(16).toString('hex');
    const orderData = {
      orderId: `TEST_ORD_${Date.now()}`,
      customerId: customerId,
      affiliateId: affiliateId,
      bagId: data.bagId || `BAG-${require('uuid').v4()}`,
      bagToken,
      actualWeight: data.actualWeight !== undefined ? data.actualWeight : 20,
      feeBreakdown: data.feeBreakdown || {
        numberOfBags: 1, minimumFee: 10, perBagFee: 2, totalFee: 10, minimumApplied: true
      },
      wdfCreditApplied: data.wdfCreditApplied || 0,
      status: data.status || 'in_progress',
      ...data
    };
  ```

  (the trailing `const order = new Order(orderData); await order.save(); ...` block is unchanged)

- [ ] In `tests/helpers/v2TestHelpers.js`, inside `createTestOrder` (lines 119–152) replace the `orderData` literal:

  **Old keys to delete:** `pickupDate`, `pickupTime`, `numberOfBags`, `estimatedWeight`, `bagsWeighed`, `bagsProcessed`, `bagsPickedUp`, `isPaid`.
  **Old defaults to change:** `status: options.status || 'pending'` → `status: options.status || 'in_progress'`.
  **New keys to add** (top of the literal, after `affiliateId`):

  ```javascript
      bagId: options.bagId || `BAG-${require('uuid').v4()}`,
      bagToken: options.bagToken || require('crypto').randomBytes(16).toString('hex'),
      feeBreakdown: options.feeBreakdown || {
        numberOfBags: 1, minimumFee: 10, perBagFee: 2, totalFee: 10, minimumApplied: true
      },
  ```

- [ ] In the same file, `setupV2PaymentScenario` (lines 195–217): replace the order options —

  **Old (find this exactly):**

  ```javascript
    const order = await createTestOrder({
      ...options.order,
      customerId: customer.customerId,
      affiliateId: affiliate.affiliateId,
      status: 'processing',
      actualWeight: 10,
      actualTotal: 12.50,
      bagsWeighed: 2,
      paymentStatus: 'awaiting',
  ```

  **New:**

  ```javascript
    const order = await createTestOrder({
      ...options.order,
      customerId: customer.customerId,
      affiliateId: affiliate.affiliateId,
      status: 'in_progress',
      actualWeight: 10,
      actualTotal: 12.50,
      paymentStatus: 'awaiting',
  ```

  and replace the two-element `bags` array:

  **Old:**

  ```javascript
      bags: [
        { bagId: 'bag-001', weight: 5, status: 'processing', bagNumber: 1 },
        { bagId: 'bag-002', weight: 5, status: 'processing', bagNumber: 2 }
      ],
  ```

  **New (one bag = one order; token matches the order's own bagToken):**

  ```javascript
      bags: [
        { bagToken: 'f0e1d2c3b4a5968778695a4b3c2d1e0f', weight: 10, status: 'intake', bagNumber: 1 }
      ],
      bagToken: 'f0e1d2c3b4a5968778695a4b3c2d1e0f',
  ```

- [ ] Sanity-run a factory consumer (it may still have its own literals to fix in Task 7 — the factory itself must no longer throw `ValidationError` on `pickupDate`/enums):

  ```bash
  npm test -- tests/unit/v2-payment-core.test.js 2>&1 | tail -15
  ```

- [ ] Commit:

  ```bash
  git add tests/testUtils.js tests/helpers/v2TestHelpers.js
  git commit -m "test: re-point shared order factories to the redesigned Order schema

  createTestOrder now supplies bagId/bagToken/feeBreakdown/actualWeight and
  defaults status to in_progress; v2 scenario uses a single intake-stage bag.

  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```

---

## Task 4: `server/services/orderReadyGateService.js` — the canonical gate

**Files:**
- Create: `tests/unit/orderReadyGateService.test.js`
- Create: `server/services/orderReadyGateService.js`

- [ ] **Write the failing test first** — `tests/unit/orderReadyGateService.test.js` (full file):

  ```javascript
  // The canonical ready-for-pickup gate (design §6.5, settled §13 #3).
  // jest.mock BEFORE require (house rule).
  jest.mock('../../server/utils/emailService', () => ({
    sendOrderReadyNotification: jest.fn().mockResolvedValue(true)
  }));

  const { applyReadyGate } = require('../../server/services/orderReadyGateService');
  const emailService = require('../../server/utils/emailService');
  const Order = require('../../server/models/Order');
  const {
    ensureTestAffiliate,
    ensureTestCustomer,
    createTestOrder,
    cleanupV2TestData
  } = require('../helpers/v2TestHelpers');

  describe('orderReadyGateService.applyReadyGate', () => {
    let affiliate;
    let customer;

    beforeEach(async () => {
      jest.clearAllMocks();
      affiliate = await ensureTestAffiliate({});
      customer = await ensureTestCustomer({ affiliateId: affiliate.affiliateId });
    });

    afterEach(async () => {
      await cleanupV2TestData();
    });

    function gateOrder(overrides = {}) {
      return createTestOrder({
        customerId: customer.customerId,
        affiliateId: affiliate.affiliateId,
        ...overrides
      });
    }

    it('promotes processed + verified to ready_for_pickup, stamps readyForPickupAt, clears heldAtStore, notifies the affiliate', async () => {
      const order = await gateOrder({ status: 'processed', paymentStatus: 'verified', heldAtStore: true });
      const result = await applyReadyGate(order, { trigger: 'unit_test' });

      expect(result).toEqual({ promoted: true, held: false });
      expect(order.status).toBe('ready_for_pickup');
      expect(order.readyForPickupAt).toBeInstanceOf(Date);
      expect(order.heldAtStore).toBe(false);

      const persisted = await Order.findById(order._id);
      expect(persisted.status).toBe('ready_for_pickup');
      expect(persisted.readyForPickupAt).toBeInstanceOf(Date);

      expect(emailService.sendOrderReadyNotification).toHaveBeenCalledTimes(1);
      const [email, data] = emailService.sendOrderReadyNotification.mock.calls[0];
      expect(email).toBe(affiliate.email);
      expect(data.orderId).toBe(order.orderId);
      expect(data.numberOfBags).toBe(1);
    });

    it('holds a processed + unpaid order at the store (no promote, no email)', async () => {
      const order = await gateOrder({ status: 'processed', paymentStatus: 'awaiting' });
      const result = await applyReadyGate(order, { trigger: 'unit_test' });

      expect(result).toEqual({ promoted: false, held: true });
      expect(order.status).toBe('processed');
      expect(order.heldAtStore).toBe(true);
      expect(order.readyForPickupAt).toBeUndefined();
      expect(emailService.sendOrderReadyNotification).not.toHaveBeenCalled();

      const persisted = await Order.findById(order._id);
      expect(persisted.heldAtStore).toBe(true);
    });

    it('is a no-op for non-processed orders', async () => {
      const order = await gateOrder({ status: 'in_progress', paymentStatus: 'verified' });
      const result = await applyReadyGate(order, { trigger: 'unit_test' });
      expect(result).toEqual({ promoted: false, held: false });
      expect(order.status).toBe('in_progress');
      expect(emailService.sendOrderReadyNotification).not.toHaveBeenCalled();
    });

    it('is idempotent — second call on a ready order is a no-op and does not re-notify', async () => {
      const order = await gateOrder({ status: 'processed', paymentStatus: 'verified' });
      await applyReadyGate(order, { trigger: 'first' });
      const firstStamp = order.readyForPickupAt;

      const second = await applyReadyGate(order, { trigger: 'second' });
      expect(second).toEqual({ promoted: false, held: false });
      expect(order.readyForPickupAt).toEqual(firstStamp);
      expect(emailService.sendOrderReadyNotification).toHaveBeenCalledTimes(1);
    });

    it('still promotes when the notification email throws (best-effort)', async () => {
      emailService.sendOrderReadyNotification.mockRejectedValueOnce(new Error('smtp down'));
      const order = await gateOrder({ status: 'processed', paymentStatus: 'verified' });
      const result = await applyReadyGate(order, { trigger: 'unit_test' });
      expect(result.promoted).toBe(true);
      expect((await Order.findById(order._id)).status).toBe('ready_for_pickup');
    });
  });
  ```

  > `v2TestHelpers` exports `cleanupV2TestData` — verify with `grep -n "module.exports" -A 12 tests/helpers/v2TestHelpers.js`; if the export is named differently (e.g. `cleanupTestData`), use that name in the test.

- [ ] Run it — must fail on module resolution:

  ```bash
  npm test -- tests/unit/orderReadyGateService.test.js
  ```

  **Expected failure:** `Cannot find module '../../server/services/orderReadyGateService'`.

- [ ] **Implement** `server/services/orderReadyGateService.js` (full file):

  ```javascript
  // THE canonical "ready for pickup" gate (design §6.5; settled decision §13 #3).
  //
  //   ready_for_pickup  IFF  status === 'processed'  AND  paymentStatus === 'verified'
  //
  // This service is the SOLE writer of Order.readyForPickupAt (never the model
  // pre-save, never a direct PUT) and the only path into 'ready_for_pickup'.
  // orderStateMachine.maybeReadyForPickup is a thin delegate onto applyReadyGate.
  // Callers (this PR): orderController.updateOrderStatus (processed transition)
  // and orderController.verifyPaymentManually. PR 7 adds the kiosk processed scan;
  // PR 8 adds the IMAP scanner / verification-job verify path.

  const Customer = require('../models/Customer');
  const Affiliate = require('../models/Affiliate');
  const emailService = require('../utils/emailService');
  const logger = require('../utils/logger');
  const { applyTransition } = require('../modules/orders/orderStateMachine');

  /**
   * Apply the ready gate to an order. Idempotent.
   * - processed + verified  -> ready_for_pickup, stamp readyForPickupAt,
   *                            heldAtStore=false, save, notify affiliate
   *                            (reuses the existing sendOrderReadyNotification
   *                            dispatcher — Notification A, design §6.6).
   * - processed + !verified -> heldAtStore=true, save (physically held).
   * - anything else         -> no-op.
   *
   * @param {Object} order - mongoose Order document
   * @param {Object} [ctx]
   * @param {string} [ctx.trigger] - caller tag for logs ('status_put',
   *   'manual_verify', 'scanner_verify', 'processed_scan', ...)
   * @returns {Promise<{promoted: boolean, held: boolean}>}
   */
  async function applyReadyGate(order, { trigger } = {}) {
    if (order.status === 'ready_for_pickup' || order.status !== 'processed') {
      return { promoted: false, held: false };
    }

    if (order.paymentStatus !== 'verified') {
      if (!order.heldAtStore) {
        order.heldAtStore = true;
        await order.save();
      }
      logger.info('Ready gate: processed but unpaid — held at store', {
        orderId: order.orderId,
        trigger
      });
      return { promoted: false, held: true };
    }

    applyTransition(order, 'ready_for_pickup');
    if (!order.readyForPickupAt) order.readyForPickupAt = new Date(); // SOLE writer
    order.heldAtStore = false;
    await order.save();

    logger.info('Ready gate: promoted to ready_for_pickup', {
      orderId: order.orderId,
      trigger
    });

    // Notification A — reuse the existing dispatcher; best-effort, never blocks the gate.
    try {
      const affiliate = await Affiliate.findOne({ affiliateId: order.affiliateId });
      if (affiliate && affiliate.email) {
        let customerName = 'N/A';
        const customer = await Customer.findOne({ customerId: order.customerId });
        if (customer) customerName = `${customer.firstName} ${customer.lastName}`;
        await emailService.sendOrderReadyNotification(affiliate.email, {
          affiliateName: affiliate.contactPerson || affiliate.businessName,
          orderId: order.orderId,
          customerName,
          numberOfBags: 1,            // one bag = one order
          totalWeight: order.actualWeight
        });
      }
    } catch (emailError) {
      logger.error('Ready gate: order-ready notification failed', {
        orderId: order.orderId,
        error: emailError.message
      });
    }

    return { promoted: true, held: false };
  }

  module.exports = { applyReadyGate };
  ```

  > Signature note: `sendOrderReadyNotification(affiliateEmail, data)` is the existing dispatcher at `server/services/email/dispatcher/ops.js:73`, re-exported through `server/utils/emailService.js` (`module.exports = require('../services/email/dispatcher')`). It consumes `{ affiliateName, orderId, customerName, numberOfBags, totalWeight }` — exactly what's passed above. Existing callers (`operatorBagWorkflowService.js:377,475`, `operatorPickupService.js:84`) use the same shape.

- [ ] Run again — expect **6 passing**:

  ```bash
  npm test -- tests/unit/orderReadyGateService.test.js
  ```

- [ ] Also re-run the state-machine suite (its `{ virtual: true }` mock now coexists with the real file — must stay green):

  ```bash
  npm test -- tests/unit/orderStateMachine.test.js
  ```

- [ ] Commit:

  ```bash
  git add server/services/orderReadyGateService.js tests/unit/orderReadyGateService.test.js
  git commit -m "feat(orders): add orderReadyGateService.applyReadyGate — canonical ready gate

  Sole writer of readyForPickupAt; promotes processed+verified, holds
  processed+unpaid at the store, idempotent, reuses the existing
  sendOrderReadyNotification dispatcher (Notification A).

  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```

---

## Task 5: Re-point `orderController`, `orderRoutes`, `orderBulkService` to the shared machine

**Files:**
- Create: `tests/integration/readyForPickupGate.test.js`
- Modify: `server/controllers/orderController.js` (`updateOrderStatus`, `cancelOrder`, `verifyPaymentManually`, `updatePaymentStatus`, `getOrderStatistics`, `searchOrders`/`getOrderDetails` formatting, delete `checkStatusTransition`)
- Modify: `server/routes/orderRoutes.js` (bulk status validator, line 87 today)
- Modify: `server/services/orderBulkService.js` (lines 25–33, 53, 105)

- [ ] **Write the failing integration test first** — `tests/integration/readyForPickupGate.test.js` (full file). This is the §11 "gate via both paths" load-bearing test:

  ```javascript
  jest.setTimeout(90000);

  // Mock email BEFORE requiring the app (house rule) — the gate and status
  // updates send mail; we assert on the ready notification only.
  jest.mock('../../server/utils/emailService', () => ({
    sendOrderReadyNotification: jest.fn().mockResolvedValue(true),
    sendOrderStatusUpdateEmail: jest.fn().mockResolvedValue(true),
    sendAffiliateCommissionEmail: jest.fn().mockResolvedValue(true),
    sendOrderCancellationEmail: jest.fn().mockResolvedValue(true),
    sendAffiliateOrderCancellationEmail: jest.fn().mockResolvedValue(true)
  }));

  const jwt = require('jsonwebtoken');
  const app = require('../../server');
  const Order = require('../../server/models/Order');
  const emailService = require('../../server/utils/emailService');
  const { getCsrfToken, createAgent } = require('../helpers/csrfHelper');
  const {
    ensureTestAffiliate,
    ensureTestCustomer,
    createTestOrder
  } = require('../helpers/v2TestHelpers');

  describe('ready_for_pickup gate (PUT /api/v1/orders/:orderId/status + verify-payment)', () => {
    let adminToken;
    let affiliate;
    let customer;
    let agent;
    let csrfToken;

    beforeEach(async () => {
      jest.clearAllMocks();
      await Order.deleteMany({});
      // House pattern (see tests/integration/order.test.js): /orders/:orderId/status
      // and /:orderId/cancel are CRITICAL_ENDPOINTS in csrf-config — CSRF is
      // ALWAYS enforced (even under NODE_ENV=test), and verify-payment hits the
      // default-enforce branch. Every mutation below needs agent + x-csrf-token.
      agent = createAgent(app);
      csrfToken = await getCsrfToken(app, agent);
      affiliate = await ensureTestAffiliate({});
      customer = await ensureTestCustomer({ affiliateId: affiliate.affiliateId });
      adminToken = jwt.sign(
        { id: 'admin-test-id', role: 'admin' },
        process.env.JWT_SECRET || 'test-secret'
      );
    });

    function makeOrder(overrides = {}) {
      return createTestOrder({
        customerId: customer.customerId,
        affiliateId: affiliate.affiliateId,
        ...overrides
      });
    }

    it('Path A (processed-then-paid): PUT processed holds an unpaid order, manual verify promotes it', async () => {
      const order = await makeOrder({ status: 'in_progress', paymentStatus: 'awaiting' });

      const putRes = await agent
        .put(`/api/v1/orders/${order.orderId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-csrf-token', csrfToken)
        .send({ status: 'processed' });
      expect(putRes.status).toBe(200);

      let persisted = await Order.findById(order._id);
      expect(persisted.status).toBe('processed');
      expect(persisted.heldAtStore).toBe(true);
      expect(persisted.readyForPickupAt).toBeUndefined();
      expect(emailService.sendOrderReadyNotification).not.toHaveBeenCalled();

      const verifyRes = await agent
        .put(`/api/v1/orders/${order._id}/verify-payment`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-csrf-token', csrfToken)
        .send({ notes: 'venmo screenshot checked' });
      expect(verifyRes.status).toBe(200);

      persisted = await Order.findById(order._id);
      expect(persisted.status).toBe('ready_for_pickup');
      expect(persisted.paymentStatus).toBe('verified');
      expect(persisted.readyForPickupAt).toBeInstanceOf(Date);
      expect(persisted.heldAtStore).toBe(false);
      expect(emailService.sendOrderReadyNotification).toHaveBeenCalledTimes(1);
    });

    it('Path B (paid-then-processed): PUT processed on a verified order promotes immediately', async () => {
      const order = await makeOrder({ status: 'in_progress', paymentStatus: 'verified' });

      const res = await agent
        .put(`/api/v1/orders/${order.orderId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-csrf-token', csrfToken)
        .send({ status: 'processed' });
      expect(res.status).toBe(200);

      const persisted = await Order.findById(order._id);
      expect(persisted.status).toBe('ready_for_pickup');
      expect(persisted.readyForPickupAt).toBeInstanceOf(Date);
      expect(emailService.sendOrderReadyNotification).toHaveBeenCalledTimes(1);
    });

    it('rejects a direct PUT to ready_for_pickup (gate is the only writer)', async () => {
      const order = await makeOrder({ status: 'processed', paymentStatus: 'verified' });
      const res = await agent
        .put(`/api/v1/orders/${order.orderId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-csrf-token', csrfToken)
        .send({ status: 'ready_for_pickup' });
      expect(res.status).toBe(400);
      expect((await Order.findById(order._id)).status).toBe('processed');
    });

    it('rejects transitions the shared map forbids (in_progress -> delivered)', async () => {
      const order = await makeOrder({ status: 'in_progress' });
      const res = await agent
        .put(`/api/v1/orders/${order.orderId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-csrf-token', csrfToken)
        .send({ status: 'delivered' });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Invalid status transition/);
    });

    it('cancelOrder allows in_progress and processed, rejects ready_for_pickup', async () => {
      const inProgress = await makeOrder({ status: 'in_progress' });
      const resA = await agent
        .post(`/api/v1/orders/${inProgress.orderId}/cancel`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-csrf-token', csrfToken)
        .send({});
      expect(resA.status).toBe(200);
      expect((await Order.findById(inProgress._id)).status).toBe('cancelled');

      const processed = await makeOrder({ status: 'processed', orderId: undefined, _id: undefined });
      const resB = await agent
        .post(`/api/v1/orders/${processed.orderId}/cancel`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-csrf-token', csrfToken)
        .send({});
      expect(resB.status).toBe(200);

      const ready = await makeOrder({ status: 'ready_for_pickup', orderId: undefined, _id: undefined });
      const resC = await agent
        .post(`/api/v1/orders/${ready.orderId}/cancel`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-csrf-token', csrfToken)
        .send({});
      expect(resC.status).toBe(400);
      expect((await Order.findById(ready._id)).status).toBe('ready_for_pickup');
    });
  });
  ```

  > Note: `createTestOrder` in `v2TestHelpers` uses a fixed `TEST_IDS.order` `_id` — pass `_id: new (require('mongoose').Types.ObjectId)()` in `makeOrder` overrides for the multi-order test if the helper rejects duplicates (it deletes-then-creates by `_id`, so distinct `_id`s are required when two orders must coexist; `TEST_IDS.order2/order3` exist for this).

- [ ] Run it — must fail against the old controller:

  ```bash
  npm test -- tests/integration/readyForPickupGate.test.js
  ```

  **Expected failure mode:** `Invalid status transition from in_progress to processed` is NOT the error — the old controller's map has no `in_progress` key, so `validTransitions[order.status]` is `undefined` and `.includes` throws → 500s; the direct-PUT test gets 500/200 instead of 400. Any of these counts as "fails for the right reason" (old duplicate map in place). A 403 on every mutation means the CSRF wiring above is wrong (missing agent/`x-csrf-token`) — that is NOT a valid red; fix the test plumbing before proceeding.

- [ ] **Implement — `server/controllers/orderController.js`.** Add the new requires after the existing `const { calculateDeliveryFee } = require('../services/orderPricingService');` line:

  ```javascript
  const { canTransition } = require('../modules/orders/orderStateMachine');
  const { applyReadyGate } = require('../services/orderReadyGateService');
  ```

- [ ] Replace the body of `exports.updateOrderStatus` between the authorization check and the final response. **Delete** this block (the duplicate map + inline payment-trigger, currently lines 363–439):

  ```javascript
      // Check for valid status transition
      const validTransitions = {
        pending: ['processing', 'cancelled'],
        ...
      if (!validTransitions[order.status].includes(status)) { ... }
      ...
      // Update actual weight when transitioning to processing or processed
      if ((status === 'processing' || status === 'processed') && actualWeight) {
        ...
        // Generate post-weigh payment request if this order is still pending payment
        if (customer && order.paymentStatus === 'pending') {
          ... paymentLinkService.generatePaymentLinks(...) ...
          ... emailService.sendV2PaymentRequest({...}) ...
        }
      }

      await order.save();

      // Send status update email to customer
      if (customer && ['scheduled', 'processing', 'processed', 'complete'].includes(status)) {
        await emailService.sendOrderStatusUpdateEmail(customer, order, status);

        // If order is complete, also notify affiliate of commission
        if (status === 'complete' && affiliate) {
          await emailService.sendAffiliateCommissionEmail(affiliate, order, customer);
        }
      }
  ```

  **Replace with:**

  ```javascript
      // ready_for_pickup has exactly one writer — orderReadyGateService.applyReadyGate.
      // A direct PUT to it is always rejected (design §6.4).
      if (status === 'ready_for_pickup') {
        return res.status(400).json({
          success: false,
          message: 'ready_for_pickup is set by the payment gate and cannot be set directly'
        });
      }

      if (!canTransition(order.status, status)) {
        return res.status(400).json({
          success: false,
          message: `Invalid status transition from ${order.status} to ${status}`
        });
      }

      // Find customer and affiliate first
      const customer = await Customer.findOne({ customerId: order.customerId });
      const affiliate = await Affiliate.findOne({ affiliateId: order.affiliateId });

      // Update order status (pre-save stamps the lifecycle timestamp set-once).
      // Payment links/QRs are generated ONCE at intake (PR 7) — the inline
      // payment-trigger block that used to live here is gone (design §6.4).
      order.status = status;
      if (actualWeight) {
        order.actualWeight = parseFloat(actualWeight);
      }

      await order.save();

      // The processed transition runs the canonical ready gate:
      // verified -> ready_for_pickup (Path B), unpaid -> held at store.
      if (status === 'processed') {
        await applyReadyGate(order, { trigger: 'status_put' });
      }

      // Send status update email to customer
      if (customer && ['processed', 'picked_up', 'delivered'].includes(status)) {
        await emailService.sendOrderStatusUpdateEmail(customer, order, status);

        // Commission realizes at delivered (design §6.4)
        if (status === 'delivered' && affiliate) {
          await emailService.sendAffiliateCommissionEmail(affiliate, order, customer);
        }
      }
  ```

  Keep the existing `// Find customer and affiliate first` lines only once (the old code had them above the deleted block — the replacement re-includes them; make sure they are not duplicated).

- [ ] **`exports.cancelOrder`** — replace the status guard (current lines 472–478):

  **Old:**

  ```javascript
    // Check if order can be cancelled - only pending orders can be cancelled
    if (order.status !== 'pending') {
      return ControllerHelpers.sendError(res, 
        `Orders in ${order.status} status cannot be cancelled. Only pending orders can be cancelled.`, 
        400
      );
    }
  ```

  **New:**

  ```javascript
    // Cancellable only from in_progress or processed (shared TRANSITIONS map).
    if (!canTransition(order.status, 'cancelled')) {
      return ControllerHelpers.sendError(res,
        `Orders in ${order.status} status cannot be cancelled. Only in_progress or processed orders can be cancelled.`,
        400
      );
    }

    // PR 6 HANDOFF (explicit, do not implement here): when the durable Bag module
    // lands (PR 6), cancellation must release this order's bag back to 'active'
    // via bagService.releaseForCancelledOrder({ bagId: order.bagId }). The Bag
    // model does not exist in this PR, so there is deliberately no call here —
    // PR 6's plan adds it and its test.
  ```

- [ ] **`exports.verifyPaymentManually`** — after `await order.save();` (current line 996), replace the dead block:

  **Old:**

  ```javascript
      // If order is ready, send pickup notification
      if (order.status === 'processed') {
        const customer = await Customer.findOne({ customerId: order.customerId });
        const affiliate = await Affiliate.findOne({ affiliateId: order.affiliateId });
        
        // Send notifications
        logger.info(`Sending pickup notification after manual verification for order ${orderId}`);
        // await emailService.sendPickupReadyNotification(order, customer, affiliate);
      }
  ```

  **New:**

  ```javascript
      // Run the canonical ready gate (Path B: paid-then-processed; idempotent;
      // notifies the affiliate via sendOrderReadyNotification when it promotes).
      await applyReadyGate(order, { trigger: 'manual_verify' });
  ```

- [ ] **Delete the local `checkStatusTransition`** function (current lines 1027–1041, the map with `'scheduled'`) and remove it from the `bulkUpdateOrderStatus` call:

  **Old (in `exports.bulkUpdateOrderStatus`):**

  ```javascript
      const summary = await orderBulkService.bulkUpdateStatus({
        orderIds: req.body.orderIds,
        status: req.body.status,
        user: req.user,
        checkStatusTransition
      });
  ```

  **New:**

  ```javascript
      const summary = await orderBulkService.bulkUpdateStatus({
        orderIds: req.body.orderIds,
        status: req.body.status,
        user: req.user
      });
  ```

- [ ] **Status-literal sweep in the same file** (these survive PR 2):
  - `exports.updatePaymentStatus`: `if (order.status !== 'complete') {` → `if (order.status !== 'delivered') {` and the message `'Cannot update payment status for non-complete orders'` → `'Cannot update payment status for non-delivered orders'`.
  - `exports.getOrderStatistics`: replace the init object

    ```javascript
      const ordersByStatus = {
        pending: 0,
        scheduled: 0,
        processing: 0,
        processed: 0,
        complete: 0,
        cancelled: 0
      };
    ```

    with

    ```javascript
      const ordersByStatus = {
        in_progress: 0,
        processed: 0,
        ready_for_pickup: 0,
        picked_up: 0,
        delivered: 0,
        cancelled: 0
      };
    ```

    and the revenue branch

    ```javascript
        if (order.status === 'complete') {
          totalRevenue += order.actualTotal || order.estimatedTotal || 0;
    ```

    with

    ```javascript
        if (order.status === 'delivered') {
          totalRevenue += order.actualTotal || 0;
    ```

    and the weight average block

    ```javascript
        if (order.estimatedWeight) {
          totalEstimatedWeight += order.estimatedWeight;
          orderWithWeightCount++;
        }
    ```

    with

    ```javascript
        if (order.actualWeight) {
          totalActualWeight += order.actualWeight;
          orderWithWeightCount++;
        }
    ```

    renaming the accumulators (`let totalEstimatedWeight = 0;` → `let totalActualWeight = 0;`, `averageEstimatedWeight` → `averageWeight` in both the computation and the `statistics` response object).
  - Response formatting: in `getOrderDetails` delete the line `weightDifference: Formatters.weight(order.weightDifference),` and the line `estimatedTotal: Formatters.currency(order.estimatedTotal),`; in `searchOrders` delete `estimatedWeight: Formatters.weight(order.estimatedWeight),`, `estimatedTotal: Formatters.currency(order.estimatedTotal),`, and `weightDifference: Formatters.weight(order.weightDifference)` (mind the trailing comma on the now-last `wdfCreditGenerated` line).
  - Verify no old literals remain:

    ```bash
    grep -n "'pending'\|'processing'\|'complete'\|'scheduled'" server/controllers/orderController.js
    ```

    Remaining hits must be **paymentStatus** usages only (`paymentStatus === 'pending'`, `paymentMethod || 'pending'`, the `validPaymentStatuses` array) — those enums are unchanged.

- [ ] **`server/routes/orderRoutes.js`** — replace the bulk-status validator (line 87 today):

  **Old:**

  ```javascript
    body('status').isIn(['scheduled', 'picked_up', 'processing', 'ready_for_delivery', 'complete', 'cancelled']).withMessage('Invalid status')
  ```

  **New (`ready_for_pickup` and `in_progress` deliberately absent — gate-only / birth-only):**

  ```javascript
    body('status').isIn(['processed', 'picked_up', 'delivered', 'cancelled']).withMessage('Invalid status')
  ```

- [ ] **`server/services/orderBulkService.js`** — three edits:

  1. Top of file, add the shared-machine require under `const Order = require('../models/Order');`:

     ```javascript
     const { canTransition } = require('../modules/orders/orderStateMachine');
     ```

  2. `bulkUpdateStatus`: drop the `checkStatusTransition` param and the duplicate list —

     **Old:**

     ```javascript
     async function bulkUpdateStatus({ orderIds, status, user, checkStatusTransition }) {
       if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
         throw new BulkError('Order IDs must be provided as an array');
       }

       const validStatuses = ['pending', 'scheduled', 'processing', 'processed', 'complete', 'cancelled'];
       if (!validStatuses.includes(status)) {
         throw new BulkError('Invalid status');
       }
     ```

     **New:**

     ```javascript
     async function bulkUpdateStatus({ orderIds, status, user }) {
       if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
         throw new BulkError('Order IDs must be provided as an array');
       }

       // ready_for_pickup is gate-only; in_progress is birth-only (shared TRANSITIONS).
       const validStatuses = ['processed', 'picked_up', 'delivered', 'cancelled'];
       if (!validStatuses.includes(status)) {
         throw new BulkError('Invalid status');
       }
     ```

     and inside the loop replace `if (!checkStatusTransition(order.status, status)) {` with `if (!canTransition(order.status, status)) {`.

  3. `bulkCancel`: replace the duplicate skip-list —

     **Old:**

     ```javascript
       if (['processing', 'processed', 'complete', 'cancelled'].includes(order.status)) {
     ```

     **New (cancel allowed from in_progress AND processed, per design §6.4):**

     ```javascript
       if (!canTransition(order.status, 'cancelled')) {
     ```

- [ ] Run the gate integration suite — expect **all 5 passing**:

  ```bash
  npm test -- tests/integration/readyForPickupGate.test.js
  ```

- [ ] Confirm zero duplicate transition maps remain:

  ```bash
  grep -rn "validTransitions\|checkStatusTransition" server/ --include="*.js"   # expect 0 hits
  ```

- [ ] Commit:

  ```bash
  git add server/controllers/orderController.js server/routes/orderRoutes.js server/services/orderBulkService.js tests/integration/readyForPickupGate.test.js
  git commit -m "refactor(orders): route controller + bulk service through shared TRANSITIONS and applyReadyGate

  updateOrderStatus uses the single state machine, rejects direct PUT to
  ready_for_pickup, drops the inline payment-trigger block (links are minted
  once at intake, PR 7); processed transition + verifyPaymentManually both run
  the canonical gate; cancelOrder allows in_progress|processed (bag release is
  PR 6's explicit handoff); orderBulkService duplicate maps deleted.
  Adds the §11 both-paths gate integration test.

  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```

---

## Task 6: Mechanical literal re-map in surviving services (keep them loadable + queryable)

These services are structurally reworked in PR 7 (kiosk), PR 8 (payment job), PR 9 (pickup/delivery). This PR only swaps dead literals so nothing writes a rejected enum value or queries a value that can no longer exist. Apply the **Canonical status-mapping table** exactly.

**Files (all Modify):**
- `server/services/operatorBagWorkflowService.js`
- `server/services/operatorPickupService.js`
- `server/jobs/paymentVerificationJob.js`
- `server/services/adminDashboardService.js`
- `server/services/email/dispatcher/payment.js`
- `server/controllers/affiliateController.js`
- `server/controllers/quickbooksController.js`
- `server/routes/testRoutes.js`
- `server/utils/formatters.js`
- `server/utils/fieldFilter.js`

No new tests in this task (TDD exception: pure literal renames on PR 7/8/9 throwaway code; behavior coverage arrives with those PRs). The verification is grep-zero + the Task 7 suite runs.

- [ ] **`server/services/operatorBagWorkflowService.js`** — apply these replacements (use grep to find each; some appear twice):

  | Find (exact) | Replace with |
  |:---|:---|
  | `status: { $in: ['pending', 'processing', 'processed'] }` (lines 108, 214) | `status: { $in: ['in_progress', 'processed'] }` |
  | `status: { $in: ['processing', 'processed'] }` (line 421) | `status: { $in: ['in_progress', 'processed'] }` |
  | `order.status = 'processing';` (lines 239, 296) | `order.status = 'in_progress';` |
  | `order.processingStartedAt = new Date();` (line 242) | *(delete the line)* |
  | `if (!order.processingStartedAt) order.processingStartedAt = new Date();` (line 298) | *(delete the line)* |
  | `order.weightDifference = order.actualWeight - order.estimatedWeight;` (line 305) | *(delete the line — no estimate exists)* |
  | `b.bagId === effectiveBagId` (line 139) | `b.bagToken === effectiveBagId` |
  | `bagId: effectiveBagId,` (line 142, inside `bags.push`) | `bagToken: effectiveBagId,` |
  | `status: 'processing',` (lines 144, 287 — bag sub-doc pushes) | `status: 'intake',` |
  | `scannedAt: { processing: new Date() },` | `scannedAt: { intake: new Date() },` |
  | `scannedBy: { processing: operatorId }` | `scannedBy: { intake: operatorId }` |
  | `order.bags[existingBagIndex].status = 'processing';` (line 276) | `order.bags[existingBagIndex].status = 'intake';` |
  | every `b.status === 'completed'` / `bag.status === 'completed'` | `=== 'picked_up'` |
  | every `b.status === 'processing'` (remaining-bag filters, e.g. line 441) | `=== 'intake'` |
  | every `scannedAt.completed` / `scannedBy.completed` write | `.picked_up` |

  Then verify:

  ```bash
  grep -n "'pending'\|'processing'\|'completed'\|processingStartedAt\|estimatedWeight\|weightDifference\|\.bagId" server/services/operatorBagWorkflowService.js
  ```

  Remaining acceptable hits: none for the patterns above (`paymentStatus` literals in this file, if any, stay). The multi-bag counter logic (`bagsWeighed`/`numberOfBags` reads) **stays as-is** — those fields now read `undefined`, the kiosk flow is quarantined behind the Task 7 `describe.skip` of `bagTracking.test.js`, and PR 7 deletes this logic (`createOrderFromBag`/`advance` re-point). Do not half-rewrite it here.

- [ ] **`server/services/operatorPickupService.js`** — replace the three legacy functions' literals (file read in full; PR 9 folds `completePickup` into `orderAdvanceService.advance` and deletes `markOrderReady`/`confirmPickup`):

  - In `markOrderReady` (lines 63–105): delete `order.bagsProcessed = order.numberOfBags;` (line 69); replace `const affiliateNotified = order.affiliateId && order.bagsProcessed === order.numberOfBags;` (line 73) with `const affiliateNotified = Boolean(order.affiliateId);`; replace `numberOfBags: order.numberOfBags,` (line 88) with `numberOfBags: 1,`; in the audit payload (lines 94–102) replace

    ```javascript
        affiliateNotified: order.bagsProcessed === order.numberOfBags,
        bagsProcessed: order.bagsProcessed,
        totalBags: order.numberOfBags,
    ```

    with

    ```javascript
        affiliateNotified,
    ```

  - In `completePickup` (lines 107–177): `order.bags.map(b => b.bagId)` (line 119) → `order.bags.map(b => b.bagToken)`; the per-bag stamp loop (lines 129–133)

    ```javascript
      for (const bag of order.bags) {
        bag.status = 'completed';
        bag.scannedAt.completed = now;
        bag.scannedBy.completed = operatorId;
      }
    ```

    becomes

    ```javascript
      for (const bag of order.bags) {
        bag.status = 'picked_up';
        bag.scannedAt.picked_up = now;
        bag.scannedBy.picked_up = operatorId;
      }
    ```

    and the order stamp (lines 135–137)

    ```javascript
      order.status = 'complete';
      order.completedAt = now;
      order.bagsPickedUp = order.bags.length;
    ```

    becomes (pre-save stamps `deliveredAt`; PR 9 will split this into picked_up → delivered)

    ```javascript
      order.status = 'delivered';
    ```

    and the audit literal `newStatus: 'complete'` (line 173) → `newStatus: 'delivered'`.

  - In `confirmPickup` (lines 179–226): replace the counter-driven body with the one-bag equivalent —

    **Old (lines 183–188):**

    ```javascript
      const bagsToPickup = numberOfBags || 1;
      order.bagsPickedUp = Math.min(order.bagsPickedUp + bagsToPickup, order.numberOfBags);

      if (order.bagsPickedUp >= order.numberOfBags) {
        order.status = 'complete';
        order.completedAt = new Date();
    ```

    **New:**

    ```javascript
      // One bag = one order: any confirm completes the order (legacy path; PR 9 deletes this).
      {
        order.status = 'delivered';
    ```

    keep the email block inside unchanged except `numberOfBags: order.numberOfBags,` → `numberOfBags: 1,`; then replace the audit payload (lines 211–219) and return (lines 221–225):

    ```javascript
      await logAuditEvent(AuditEvents.ORDER_STATUS_CHANGED, {
        operatorId,
        orderId,
        action: 'bags_pickup_confirmed',
        orderComplete: order.status === 'delivered',
        newStatus: order.status
      }, req);

      return {
        bagsPickedUp: 1,
        totalBags: 1,
        orderComplete: order.status === 'delivered'
      };
    ```

- [ ] **`server/jobs/paymentVerificationJob.js`** — one literal (line 106):

  **Old:** `status: { $in: ['processing', 'processed'] }, // Order has been weighed`
  **New:** `status: { $in: ['in_progress', 'processed'] }, // Order has been weighed (born at intake)`

  Leave everything else (counters, `failed` escalation) — PR 8 rewrites this job (`shouldSendReminder` 60/8, escalation boolean, `{ $in: ['awaiting','confirming'] }` widening). `paymentEmailScanner.js:370` checks `order.status === 'processed'` which is still a live value — no change.

- [ ] **`server/services/adminDashboardService.js`** — five spots:

  | Find (exact) | Replace with |
  |:---|:---|
  | `status: 'complete',` + `processingStartedAt: { $exists: true },` + `completedAt: { $exists: true }` (lines 51–53) | `status: 'delivered',` + `intakeAt: { $exists: true },` + `deliveredAt: { $exists: true }` |
  | `{ $subtract: ['$completedAt', '$processingStartedAt'] },` (line 58) | `{ $subtract: ['$deliveredAt', '$intakeAt'] },` |
  | `status: { $in: ['pending', 'scheduled', 'processing', 'processed'] }` (line 131) | `status: { $in: ['in_progress', 'processed', 'ready_for_pickup', 'picked_up'] }` |
  | `completedOrders: await Order.countDocuments({ status: 'complete' }),` (line 133) | `completedOrders: await Order.countDocuments({ status: 'delivered' }),` |
  | `status: 'processing',` + `processingStartedAt: { $lte: ... }` (lines 136–137) | `status: 'in_progress',` + `intakeAt: { $lte: ... }` |
  | `{ $eq: ['$status', 'complete'] },` (line 190) | `{ $eq: ['$status', 'delivered'] },` |
  | `completedOrders: { $sum: { $cond: [{ $eq: ['$status', 'complete'] }, 1, 0] } },` (line 205) | same with `'delivered'` |
  | `$avg: { $cond: [{ $eq: ['$status', 'complete'] }, '$completionTimeMinutes', null] }` (line 210) | same with `'delivered'` |

- [ ] **`server/services/email/dispatcher/payment.js`** (lines 213–218):

  | Find | Replace |
  |:---|:---|
  | `numberOfBags: order.numberOfBags,` | `numberOfBags: 1,` |
  | `isProcessing: order.status === 'processing',` | `isProcessing: order.status === 'in_progress',` |
  | `subtotal: ((order.actualWeight || order.estimatedWeight) * (order.baseRate || 1.25)).toFixed(2),` | `subtotal: ((order.actualWeight || 0) * (order.baseRate || 1.25)).toFixed(2),` |

  Then sweep the rest of the dispatcher files for removed-field reads that would render `undefined` **only if a Task 7 test asserts on them**; cosmetic email copy is PR 7/9/11 scope:

  ```bash
  grep -n "estimatedWeight\|numberOfBags\|pickupDate" server/services/email/dispatcher/*.js
  ```

- [ ] **`server/controllers/affiliateController.js`** — `getAffiliateYtdStats` (lines 816–824):

  **Old:**

  ```javascript
      // Order schema uses `completedAt` for final pickup + `status: 'complete'`
      // (see Order.js). `deliveredAt` isn't a real field — dashboard stats above
      // filter on it anyway and silently get zero. Use completedAt as the
      // ground truth for YTD.
      const orders = await Order.find({
        affiliateId,
        status: 'complete',
        completedAt: { $gte: yearStart }
      }).select('affiliateCommission actualTotal completedAt');
  ```

  **New:**

  ```javascript
      // deliveredAt (renames completedAt) is the ground truth for YTD —
      // commission realizes at 'delivered' (design §4.4/§6.4).
      const orders = await Order.find({
        affiliateId,
        status: 'delivered',
        deliveredAt: { $gte: yearStart }
      }).select('affiliateCommission actualTotal deliveredAt');
  ```

  Also sweep the rest of this controller for old order-status literals (dashboard blocks):

  ```bash
  grep -n "status.*'complete'\|status.*'processing'\|status.*'pending'\|completedAt\|estimatedWeight" server/controllers/affiliateController.js
  ```

  and map each order-status hit per the table (customer/affiliate `isActive`-style hits and **paymentStatus** literals stay).

- [ ] **`server/controllers/quickbooksController.js`** — global rename in this file: `status: 'complete',` → `status: 'delivered',` (lines 141, 314); `completedAt` → `deliveredAt` everywhere (lines 142, 184, 315, 318, 360, 387 — both query keys and `order.completedAt` reads). Verify:

  ```bash
  grep -n "complete" server/controllers/quickbooksController.js   # only res.status(...) / words like 'completed export' may remain
  ```

- [ ] **`server/routes/testRoutes.js`** — the order-simulation switch (~lines 380–460):

  | Find | Replace |
  |:---|:---|
  | `order.bagsProcessed = order.numberOfBags;` | *(delete)* |
  | `order.bagsPickedUp = order.numberOfBags;` | *(delete)* |
  | `bag.status = 'completed';` | `bag.status = 'picked_up';` |
  | `bag.scannedAt.completed = new Date();` | `bag.scannedAt.picked_up = new Date();` |
  | `order.status = 'complete';` | `order.status = 'delivered';` |
  | `order.completedAt = new Date();` | *(delete — pre-save stamps deliveredAt)* |
  | `order.wdfCredit = 0;` (line 388 — never was a schema path) | *(delete)* |

  Then sweep the whole file:

  ```bash
  grep -n "'pending'\|'processing'\|'complete'\|'completed'\|estimatedWeight\|numberOfBags\|pickupDate\|bagsWeighed" server/routes/testRoutes.js
  ```

  and map any remaining order-status/bag-status/order-creation hits per the table (order creations in test routes need `bagId`/`bagToken`/`actualWeight`/`feeBreakdown` like the Task 3 factories; copy that literal shape).

- [ ] **`server/utils/formatters.js`** — replace the `order` and `bag` maps inside `static status(...)` (lines 354–383):

  ```javascript
      const statusMaps = {
        order: {
          in_progress: 'In Progress',
          processed: 'Processed',
          ready_for_pickup: 'Ready for Pickup',
          picked_up: 'Picked Up',
          delivered: 'Delivered',
          cancelled: 'Cancelled'
        },
        payment: {
          pending: 'Pending',
          awaiting: 'Awaiting Payment',
          confirming: 'Confirming',
          verified: 'Verified',
          failed: 'Failed',
          refunded: 'Refunded',
          partial: 'Partial Payment',
          overpaid: 'Overpaid'
        },
        bag: {
          intake: 'Checked In',
          processed: 'Processed',
          picked_up: 'Picked Up',
          delivered: 'Delivered'
        }
      };
  ```

  (the `payment` map is unchanged — shown for placement).

- [ ] **`server/utils/fieldFilter.js`** — replace the three order field lists (lines 69–87):

  ```javascript
    // Order fields visible to different roles
    order: {
      customer: ['orderId',
        'status', 'actualWeight', 'actualTotal',
        'deliveryFee', 'paymentStatus', 'createdAt', 'intakeAt',
        'readyForPickupAt', 'pickedUpAt', 'deliveredAt',
        'wdfCreditApplied', 'wdfCreditGenerated'],
      affiliate: ['orderId', 'customerId',
        'status', 'actualWeight', 'baseRate',
        'deliveryFee', 'actualTotal', 'affiliateCommission',
        'paymentStatus', 'heldAtStore',
        'washInstructions', 'createdAt', 'intakeAt', 'pickedUpAt',
        'processedAt', 'readyForPickupAt', 'deliveredAt',
        'wdfCreditApplied', 'wdfCreditGenerated'],
      admin: ['_id', 'orderId', 'customerId', 'affiliateId',
        'status', 'actualWeight',
        'baseRate', 'deliveryFee', 'actualTotal', 'affiliateCommission',
        'paymentStatus', 'paymentEscalated', 'heldAtStore',
        'washInstructions', 'createdAt', 'intakeAt', 'pickedUpAt',
        'processedAt', 'readyForPickupAt', 'deliveredAt', 'cancelledAt',
        'wdfCreditApplied', 'wdfCreditGenerated']
    },
  ```

  (Drops `pickupDate`/`pickupTime`/`specialPickupInstructions`/`estimatedSize`/`estimatedTotal`/`weightDifference`/`readyForDeliveryAt`; the **customer**-model list with `numberOfBags` at line 64 stays — that's a Customer field removed in PR 6, not here.)

- [ ] Global verification sweep — no server file writes/queries a dead order-status value or removed field:

  ```bash
  grep -rn "status: 'pending'\|status: 'processing'\|status: 'complete'\|status === 'complete'\|status === 'processing'\|'pending', 'processing'" server/ --include="*.js"
  # expect 0 hits (paymentStatus 'pending' uses the key paymentStatus, not status)
  grep -rn "completedAt\|processingStartedAt\|estimatedWeight\|weightDifference\|bagsWeighed\|bagsPickedUp\|bagsProcessed" server/ --include="*.js" | grep -v "DataDeletionRequest\|facebookDataController"
  # acceptable hits ONLY in operatorBagWorkflowService.js (quarantined kiosk counters, PR 7)
  # and operatorOrderQueueService.js estimatedWeight read (renders undefined; PR 7 rework)
  ```

  (`DataDeletionRequest.completedAt` / `facebookDataController` are a different model's field — leave.)

- [ ] Commit:

  ```bash
  git add server/services/operatorBagWorkflowService.js server/services/operatorPickupService.js server/jobs/paymentVerificationJob.js server/services/adminDashboardService.js server/services/email/dispatcher/payment.js server/controllers/affiliateController.js server/controllers/quickbooksController.js server/routes/testRoutes.js server/utils/formatters.js server/utils/fieldFilter.js
  git commit -m "refactor(orders): mechanical re-map of legacy status literals to the new enum

  pending/processing->in_progress, complete->delivered, bag completed->picked_up,
  completedAt->deliveredAt, processingStartedAt->intakeAt across kiosk services,
  payment job query, dashboards, quickbooks, test routes, formatters, fieldFilter.
  Structural rework of these surfaces is PR 7/8/9; this keeps them loadable and
  the queries truthful under the redesigned model.

  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```

---

## Task 7: Test-suite remediation (the enumerated blast radius)

The affected files below were enumerated by grepping current `main` for
`status: 'pending'|'processing'|'complete'|'scheduled'`, `bagsWeighed`, `estimatedWeight`, `pickupDate`, `completedAt`
across `tests/` and removing the files PR 1/PR 2 already deleted. Re-run the inventory first — PR 1–3 may have shifted it:

```bash
grep -rc "status: 'pending'\|status: 'processing'\|status: 'complete'\|status: 'scheduled'\|bagsWeighed\|estimatedWeight\|pickupDate\|completedAt" tests/ --include="*.js" | grep -v ":0$" | sort -t: -k2 -rn
```

**Per-file remediation recipe (apply the Canonical mapping table):**

1. Order **creations** (`new Order({...})`, `Order.create`, factory `data`/`options` literals): delete `pickupDate`/`pickupTime`/`estimatedWeight`/`estimatedTotal`/`numberOfBags`/`bagsWeighed`/`bagsProcessed`/`bagsPickedUp` keys; add `bagId: 'BAG-<any-uuid>'` (+ `bagToken: '<32 hex>'` where the test touches `bags[]`); add `actualWeight` + `feeBreakdown` where the test asserts money; map `status` per the table. Creations through the Task 3 factories usually need only the `status` option mapped.
2. `bags: [{ bagId: ... , status: 'processing' ... }]` literals: rename to `bagToken`, map sub-statuses (`processing→intake`, `completed→picked_up`), rename `scannedAt/scannedBy` keys the same way.
3. **Assertions**: `expect(...status).toBe('processing')` etc. — map per table. `completedAt` → `deliveredAt`. Money assertions that relied on `estimatedTotal` move to `actualTotal` (recompute the expected number from `actualWeight × 1.25 + feeBreakdown.totalFee + addOns − credit`, `toBeCloseTo(x, 2)`).
4. API-level status payloads (`.send({ status: 'processing' })`): map per table; payloads sending `'ready_for_pickup'` must now expect **400**.
5. Tests of **deleted behavior** (estimate-variance credit generation, multi-bag counters, "last bag weighed" triggers, the inline payment-trigger in `updateOrderStatus`): delete the `it`/`describe`, or `describe.skip` with a PR-pointer comment when the surface itself survives until PR 7 (only `bagTracking.test.js` qualifies).

Work the files in this order, running `npm test -- <file>` after each (command shown once; repeat per file):

```bash
npm test -- tests/unit/<file> 2>&1 | tail -15
```

- [ ] **Skip (PR 7-coupled kiosk machinery):** `tests/unit/bagTracking.test.js` — change every top-level `describe(` to `describe.skip(` and add at the top of the file:

  ```javascript
  // SKIPPED in PR 4 (order-model redesign): this suite exercises the kiosk
  // multi-bag machinery (numberOfBags/bagsWeighed counters, customer-QR parse)
  // that the redesigned Order model removed. operatorBagWorkflowService is
  // re-pointed to orderIntakeService/orderAdvanceService in PR 7, which ships
  // replacement coverage (tests/integration/operatorIntake.test.js).
  // See docs/superpowers/specs/2026-06-08-invite-bag-workflow-redesign-design.md §6.4.
  ```

- [ ] **Delete (coupled to removed estimate-variance generation / removed endpoints):**

  ```bash
  git rm tests/unit/wdfCredit.test.js tests/integration/wdfCreditIntegration.test.js tests/integration/wdfCreditSimple.test.js
  ```

  Coverage note for the PR description: credit **application** is covered by `tests/unit/order.model.test.js` ("applies carry-in wdfCreditApplied…"); credit **generation** no longer exists (`wdfCreditGenerated` pinned to 0 — also asserted there); the end-to-end intake-applies-credit flow lands with PR 7's `operatorIntake.test.js`. `tests/unit/customerDashboardWdfCredit.test.js` and `tests/unit/fieldFilterWdfCredit.test.js` are **kept** (mechanical remap — they test display/filtering of the surviving `wdfCredit`/`wdfCreditApplied` fields).

- [ ] **Mechanical remap — unit:** `orderController.test.js`, `orderControllerAdditional.test.js`, `orderControllerUncovered.test.js`, `orderRoutes.isolated.test.js`, `orderRoutesSimple.test.js`, `orderAddOns.test.js`, `affiliateController.test.js`, `customerController.test.js`, `adminDashboard.test.js`, `administratorControllerUncovered.test.js`, `authControllerAdditional.test.js`, `controllersAdditional.test.js`, `customerDashboardWdfCredit.test.js`, `fieldFilter.test.js`, `fieldFilterWdfCredit.test.js`, `formatters.test.js`, `modelMethods.test.js`, `models.test.js`, `modelsAdditional.test.js`, `paymentEmailScanner.test.js`, `paymentVerificationJob.test.js`, `quickbooksController.test.js`, `testRoutes.test.js`, `v2-payment-core.test.js`, `v2ControllerLogic.test.js`, `emailServiceAdditional.test.js`.

  File-specific notes:
  - `orderController*.test.js`: tests of the **old** `updateOrderStatus` payment-trigger block (asserting `generatePaymentLinks`/`sendV2PaymentRequest` were called on `processing` with weight) test deleted behavior → delete those `it`s; add nothing (the replacement behavior is covered by `readyForPickupGate.test.js`). Bulk-status tests: valid set is now `['processed','picked_up','delivered','cancelled']`; transitions per the shared map.
  - `formatters.test.js`: update the order/bag status display expectations to the new maps from Task 6.
  - `fieldFilter*.test.js`: expectations must match the Task 6 field lists (no `pickupDate`/`estimatedTotal`/`weightDifference`; `readyForPickupAt`/`heldAtStore` present per role as listed).
  - `paymentVerificationJob.test.js` / `paymentEmailScanner.test.js`: only the order **factory/status literals** change (`processing→in_progress`); the job's reminder/escalation behavior is untouched until PR 8 — do not add assertions for the new cadence here.
  - `quickbooksController.test.js`: fixtures move `status:'complete'`+`completedAt` → `status:'delivered'`+`deliveredAt`.
  - `adminDashboard.test.js`: fixture statuses per table; assertions on `completedOrders`/`ordersInProgress` follow the Task 6 query changes.

- [ ] **Mechanical remap — integration:** `order.test.js`, `orderAddOns.test.js`, `customer.test.js`, `affiliate.test.js`, `quickbooks.test.js`, `v2-complete-payment-flow.test.js`, `v2-payment-flow.test.js`, `venmo-payment-parsing.test.js`, `operator.test.js` (if red).

  File-specific notes:
  - `order.test.js` (largest, 65 hits on main): any leftover `POST /api/v1/orders` / `check-active` describes are PR 2 stragglers — delete them (note in the PR description). `PUT /:orderId/status` tests: map transitions (`pending→processing` becomes `in_progress→processed`, etc.); a test asserting `processed→complete` becomes `ready_for_pickup→picked_up→delivered` (two PUTs) or asserts the 400 on `processed→delivered`. Cancel tests: `pending`-only becomes in_progress|processed-allowed (mirror the assertions from `readyForPickupGate.test.js` rather than duplicating them — keep what tests authorization/404 paths).
  - `v2-*-payment-flow.test.js`: scenario factories now produce `in_progress`; steps that flipped orders to `'processing'` before requesting payment just stay `in_progress`; assertions that the order reaches `processed`+`verified` should now ALSO expect the gate to have promoted to `ready_for_pickup` wherever the manual-verify endpoint is the verifier (Path A).
  - `quickbooks.test.js`: as the unit file — `delivered`/`deliveredAt` fixtures.

- [ ] Run the **full** suite; iterate file-by-file until green (skips allowed only as specified above):

  ```bash
  npm test 2>&1 | tail -20
  ```

  Triage rule for any failure not covered above: find the literal via the mapping table; if the asserted behavior was deleted by the spec (§4.4/§7), delete the test with a one-line comment in the commit message; never paper over a real regression in kept behavior (pricing, commission, credit application, auth, CSRF).

- [ ] Commit (split into 2–3 commits if the diff is huge — e.g. unit / integration / deletions):

  ```bash
  git add tests/
  git commit -m "test: re-point surviving suites to the redesigned order lifecycle

  Mechanical enum/field remap per the PR 4 mapping table; deletes
  estimate-variance credit-generation suites (feature removed, application
  coverage lives in order.model.test.js); skips bagTracking kiosk suite
  pending PR 7's intake/advance replacement coverage.

  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```

---

## Task 8: Final gate — lint, cycles, full suite, hygiene greps

**Files:** none new (fixes only if the gates fail).

- [ ] ESLint on everything this PR touched (no `console.*` snuck in):

  ```bash
  npx eslint server/modules/orders/orderStateMachine.js server/services/orderReadyGateService.js server/models/Order.js server/controllers/orderController.js server/services/orderBulkService.js
  ```

- [ ] Zero circular dependencies (the lazy require in `maybeReadyForPickup` exists exactly for this):

  ```bash
  npx madge --circular server/
  ```

  **Expected:** `No circular dependency found!`

- [ ] Full suite, clean exit, no `--forceExit`:

  ```bash
  npm test 2>&1 | tail -10
  ```

  **Expected:** 0 failures; skipped = the `bagTracking.test.js` suite only (plus any pre-existing skips from PRs 1–3).

- [ ] Hygiene greps (the §12 merge bar):

  ```bash
  grep -rn "ready_for_delivery\|'scheduled'" server/ --include="*.js"                      # 0 hits
  grep -rn "validTransitions\|checkStatusTransition" server/ --include="*.js"              # 0 hits
  grep -rn "readyForPickupAt" server/ --include="*.js"
  # writers: orderReadyGateService.js ONLY (Order.js declares the path; fieldFilter lists it; no other assignment)
  ```

- [ ] Commit anything the gates required, then stop (no push — PR assembly is the orchestrator's step):

  ```bash
  git add -A && git commit -m "chore(orders): post-redesign lint/cycle gate fixes

  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```

  (Skip this commit if the gates passed with no changes.)

---

## Verification

**Full-suite command:**

```bash
npm test 2>&1 | tail -10        # 0 failures, no --forceExit
npx madge --circular server/    # no cycles
npx eslint server/              # clean on touched files
```

**Manual smoke checks (local dev server, `npm start` or `node server.js` with a test DB):**

1. Create an order via the Task 3 factory shape in a Node REPL (`node -e` with `require('./server/models/Order')`): saving with `status:'pending'` must throw `ValidationError`; default must be `in_progress`; `actualTotal`/`affiliateCommission` must be non-zero when `actualWeight` + `feeBreakdown.totalFee` are set.
2. `PUT /api/v1/orders/:orderId/status {status:'ready_for_pickup'}` (admin JWT) → 400.
3. `PUT /api/v1/orders/:orderId/status {status:'processed'}` on an unpaid order → 200, order has `heldAtStore:true`, no `readyForPickupAt`; then `PUT /:orderId/verify-payment` → order is `ready_for_pickup` with `readyForPickupAt` stamped (Path A end-to-end).
4. `POST /api/v1/orders/:orderId/cancel` on an `in_progress` and on a `processed` order → 200; on `ready_for_pickup` → 400.

**Interfaces this PR exposes for later PRs (do not change without re-reading §12):**

- `server/modules/orders/orderStateMachine.js` → `{ TRANSITIONS, canTransition(from,to), applyTransition(order,to), maybeReadyForPickup(order,ctx), TransitionError }` — consumed by PR 7 (`orderIntakeService`/`orderAdvanceService`), PR 8 (job), PR 9 (advance/delivery).
- `server/services/orderReadyGateService.js` → `applyReadyGate(order, { trigger }) -> { promoted, held }` — wired by PR 7 (processed scan) and PR 8 (scanner/job verify paths).
- Redesigned `Order` schema fields per §4.4 — PR 6 reads `order.bagId` for cancel-release; PR 7 populates `bagId/bagToken/intake/bags[0]/feeBreakdown` at intake; PR 8 uses `paymentEscalated/holdNoticeSentAt/heldAtStore`; PR 9 writes `proofOfDelivery` + `intake.pickedUp*/delivered*`.
- **Explicit handoff:** `cancelOrder` does NOT yet release the bag — PR 6 adds `bagService.releaseForCancelledOrder({ bagId })` at the commented hook in `orderController.cancelOrder`.

**PR description text:**

> ## PR 4 — Order model redesign + state machine + ready gate
>
> Implements §4.4 + §6.4/§6.5 of the invite/bag/workflow redesign spec (PR 4 of 11, after the Paygistix/scheduling/SystemConfig removals).
>
> **What changed**
> - `Order` model rewritten: status enum `in_progress → processed → ready_for_pickup → picked_up → delivered` (+`cancelled`); durable-bag reference (`bagId` join key + `bagToken` scan key, one-element `bags[]` keyed by `bagToken`); `intake{}` snapshot; `proofOfDelivery`; `paymentEscalated/holdNoticeSentAt/heldAtStore`; `deliveredAt` renames `completedAt`; commission realizes at `delivered`. Removed: estimates (`estimatedWeight/estimatedTotal/weightDifference`), scheduling, Pickup-Now, multi-bag counters, refunds. Pre-save prices from `actualWeight` only and **reads** `feeBreakdown.totalFee`; `wdfCreditGenerated` pinned to 0; `readyForPickupAt` is never stamped by the pre-save.
> - New `server/modules/orders/orderStateMachine.js` — the single `TRANSITIONS` map (controller + bulk-service duplicates deleted).
> - New `server/services/orderReadyGateService.js` — canonical, idempotent gate; sole writer of `readyForPickupAt`; holds processed-but-unpaid orders at the store; reuses `sendOrderReadyNotification`. Wired into the `processed` PUT transition and `verifyPaymentManually` (both §3 gate paths integration-tested).
> - Direct `PUT status=ready_for_pickup` rejected; `cancelOrder` allows `in_progress|processed` (bag release back to `active` is PR 6's explicit handoff).
> - Mechanical enum re-map across kiosk/payment/dashboard/quickbooks surfaces pending their structural rework in PR 7/8/9; `bagTracking.test.js` skipped pending PR 7's replacement coverage; estimate-variance credit-generation suites deleted (feature removed).
>
> **Tests:** new `orderStateMachine`, `order.model`, `orderReadyGateService` unit suites + `readyForPickupGate` integration (both gate paths, direct-PUT rejection, cancel rules); ~30 surviving suites re-pointed. Suite green without `--forceExit`; `madge --circular server/` clean.
>
> 🤖 Generated with [Claude Code](https://claude.com/claude-code)




