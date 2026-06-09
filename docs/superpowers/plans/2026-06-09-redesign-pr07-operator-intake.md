# PR 7 — Operator Intake Creates the Order — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Orders are created by the operator at store intake (scan durable bag → weigh → enter add-ons from the paper form → ack a fresh form placed) — one bag = one order — with payment links generated exactly once and the payment request emailed immediately.

**Architecture:** A new `server/modules/orders/orderIntakeService.js` owns order birth (`createOrderFromBag`), consuming the PR 6 `bagService` for token resolution and the PR 4 `orderStateMachine`/`orderReadyGateService` for transitions. A new kiosk endpoint `POST /api/v1/operators/intake` (operator JWT + CSRF) fronts it; the legacy `operatorBagWorkflowService` kiosk seams (`scanCustomer`/`weighBags`) become thin delegates and `scanProcessed` is re-pointed to resolve by bag token and run the ready gate. The kiosk frontend stops parsing `customerId#bagId` and instead extracts the 32-hex bag token (raw or from the printed claim URL), branches on `GET /api/v1/bags/resolve/:token`, and submits an intake modal (weight + add-on checkboxes + fresh-form ack).

**Tech Stack:** Node/Express, Mongoose (MongoMemoryServer in tests), Jest + Supertest, vanilla JS frontend (strict nonce CSP), Winston logger, `qrcode` lib via existing `paymentLinkService`.

**Assumed starting state (PRs 1–6 of `docs/superpowers/specs/2026-06-08-invite-bag-workflow-redesign-design.md` §12 are merged):**

- **PR 1/2:** V1 Paygistix, scheduling, Pickup Now, BetaRequest, `?affid` removed. `Order` no longer has `pickupDate`/`pickupTime`/`estimatedWeight`/`numberOfBags`/`bagsWeighed`/`bagsProcessed`/`bagsPickedUp`/`bagWeights[]`/immediate-pickup/refund fields.
- **PR 3:** SystemConfig keys per spec §8 seeded by `SystemConfig.initializeDefaults()` (runs in `tests/setup.js`).
- **PR 4:** `Order` redesigned per spec §4.4: status enum `['in_progress','processed','ready_for_pickup','picked_up','delivered','cancelled']` (default `in_progress`); top-level `bagId` (BAG-uuid join key) + `bagToken` (32-hex scan key); `intake{weight,weighedAt,weighedBy,processedAt,processedBy,pickedUpAt,pickedUpBy,deliveredAt,deliveredBy,addOnFormPlaced,addOnFormPlacedAt}`; one-element `bags[]` whose sub-doc reference field is **`bagToken`** (never `bagId`), sub-status enum `['intake','processed','picked_up','delivered']`, `scannedAt/scannedBy` keyed by those stages; `paymentEscalated`/`holdNoticeSentAt`/`heldAtStore`; `intakeAt`/`readyForPickupAt`/`pickedUpAt`/`deliveredAt`; `addOnsEnteredBy/At`; `freshAddOnsFormPlaced/AckBy/AckAt`; `commissionRealized/At`; `proofOfDelivery{method,confirmedByRole,confirmedById,confirmedAt,geo,photoKey,note}`. Pre-save computes `addOnTotal`/`actualTotal`/`paymentAmount`/`affiliateCommission` from **`actualWeight` only**, reads the delivery fee from `this.feeBreakdown?.totalFee || 0` (it does NOT compute it), stamps `processedAt`/`pickedUpAt`/`deliveredAt`+`commissionRealizedAt`/`cancelledAt` set-once on status change, and does **not** stamp `readyForPickupAt`.
  `server/modules/orders/orderStateMachine.js` exists exporting `{ TRANSITIONS, canTransition, applyTransition, maybeReadyForPickup }`; `applyTransition(order, to)` validates against `TRANSITIONS` and mutates `order.status` (caller saves); `maybeReadyForPickup(order, ctx)` is a thin delegate to `server/services/orderReadyGateService.js` `applyReadyGate(order, { trigger })`, which is idempotent, the sole writer of `readyForPickupAt`, toggles `heldAtStore`, **saves internally**, and sends `sendOrderReadyNotification`.
- **PR 5:** `server/modules/onboarding/` invites exist (not consumed by this PR).
- **PR 6:** `server/modules/bags/Bag.js` exists (`bagId` 'BAG-'+uuid, raw `token` 32-hex, `tokenHash` HMAC-SHA256 unique-indexed, `affiliateId`, `customerId`, status `['minted','issued','active','retired']`, statics `hashToken(raw)` and `claim(token, customerId)`); `server/modules/bags/bagService.js` exports `mintBatch`, `issueBatch`, `resolveByToken(token)` → `{ bag, outcome }` or `null`, `claim`, `linkToOrderAtIntake({ token, operatorId })` → resolves the **active** bag, increments `orderCount`/`lastIntakeAt`, returns `{ bag, customerId, affiliateId }`, throws its typed error when the bag is not active, plus `getInventory`; public `GET /api/v1/bags/resolve/:token` returns `{ outcome:'unclaimed'|'claimed', affiliate:{name}, order: null }` — PR 6 deliberately hard-codes `order: null`. **This PR's Task 8b populates the claimed branch with `nextAction` + `order:{ status, awaitingDelivery, nextAction }`** (`nextAction ∈ intake|advance|deliver-or-reintake`; `claim` is the unclaimed outcome) — Task 10's kiosk switch depends on it. PR 9 Task 11 adds the same context to the customer claim resolver.
- Existing on main and unchanged by PRs 1–6: `server/services/orderPricingService.js` (`calculateDeliveryFee(numberOfBags, affiliate)` returning the `feeBreakdown` shape), `server/services/paymentLinkService.js` (singleton, `generatePaymentLinks(orderId, amount, customerName)` → `{ links, qrCodes, shortOrderId, note, amount }`), `server/utils/emailService.js` (re-exports `server/services/email/dispatcher`), `server/utils/auditLogger.js` (`logAuditEvent(eventType, details, req)`, `AuditEvents`), `server/utils/controllerHelpers.js` (`asyncWrapper`, `sendSuccess(res, data, message, statusCode)`, `sendError(res, message, statusCode, errors)`), CSRF default-enforcement in `server/config/csrf-config.js` (any unlisted mutating endpoint requires the token — so the new `/api/v1/operators/intake` is CSRF-protected with zero config change).
- **NOT in this PR (PR 9):** `orderAdvanceService`, the overloaded bag-URL `POST /api/v1/bags/:bagToken/intake|advance`, operator scan codes, `POST /api/v1/operators/advance`, delivery confirm, kiosk scan-out (`ready_for_pickup → picked_up`). PR 7's `scanProcessed` re-point is the interim stage-2 path; PR 9 replaces it with a thin delegate to `orderAdvanceService`.

**Conventions for every task below:** strict TDD (write the failing test, run it, see it fail for the right reason, implement minimally, run again, commit). Test command shape: `npm test -- tests/unit/whatever.test.js`. Money assertions use `toBeCloseTo(x, 2)`. `jest.mock` before `require`. Winston `logger` only in `server/` (no `console.*`). Do not push.

---

## Task 0 — Preflight: verify the assumed PR 1–6 surface exists

No commit. If any check fails, STOP — the assumed starting state is wrong; reconcile with the actual merged interfaces before executing Tasks 1–11 (incl. 8b) (adapt require paths/return shapes to what PR 4/PR 6 actually merged, keeping the spec canon names).

- [ ] Verify the PR 4/PR 6 modules exist:
  ```bash
  ls server/modules/orders/orderStateMachine.js server/services/orderReadyGateService.js server/modules/bags/Bag.js server/modules/bags/bagService.js
  ```
  Expected: all four paths print (no `No such file`).
- [ ] Verify the exported names match the canon this plan consumes:
  ```bash
  grep -n "applyTransition\|maybeReadyForPickup\|TRANSITIONS" server/modules/orders/orderStateMachine.js | head
  grep -n "applyReadyGate" server/services/orderReadyGateService.js | head
  grep -n "resolveByToken\|linkToOrderAtIntake\|hashToken" server/modules/bags/bagService.js server/modules/bags/Bag.js | head
  ```
  Expected: each name appears in an `exports`/function definition. **Specifically confirm**: (a) whether `linkToOrderAtIntake` itself performs an open-order check (if it does, Task 2's service must read the open order from its return value instead of querying separately — keep the external behavior identical: at-store open order → 409, `picked_up` → re-intake), and (b) the exact `resolveByToken` return shape (`{ bag, outcome }` per spec §6.1).
- [ ] Verify the Order model post-PR 4 shape:
  ```bash
  grep -n "in_progress\|bagToken\|freshAddOnsFormPlaced\|commissionRealized\|proofOfDelivery\|intakeAt" server/models/Order.js | head -20
  grep -c estimatedWeight server/models/Order.js
  ```
  Expected: all new fields present; the `estimatedWeight` count is `0`.
- [ ] Verify the suite is green at the starting point:
  ```bash
  npm test 2>&1 | tail -5
  ```
  Expected: 0 failures.

---

## Task 1 — `sendCustomerDeliveredEmail` dispatcher + `customer-order-delivered.html` template (Notification B)

The re-intake auto-deliver (Task 4) sends the customer "your laundry was delivered" email, so the dispatcher ships first. Spec §6.6 Notification B: dispatcher `sendCustomerDeliveredEmail`, template `customer-order-delivered.html`. This codebase's i18n pattern for emails is one shared `[PLACEHOLDER]` template + per-language translation maps inside the dispatcher (see `sendAffiliateCommissionEmail` in `server/services/email/dispatcher/affiliate.js:715` and `loadTemplate` fallback in `server/services/email/template-manager.js:24` — language dir first, then `server/templates/emails/<name>.html`). All four languages ship in this same commit.

**Files:**
- Create: `server/templates/emails/customer-order-delivered.html`
- Modify: `server/services/email/dispatcher/customer.js` (append a new export at end of file; current exports end with `sendCustomerPasswordResetEmail` at line 880)
- Create: `tests/unit/emailCustomerDelivered.test.js`

**Steps:**

- [ ] Write the failing test `tests/unit/emailCustomerDelivered.test.js`:
  ```javascript
  // Notification B — customer "your laundry was delivered" (spec §6.6).
  // Mocks the transport; asserts per-language subject + filled template.

  jest.mock('../../server/services/email/transport', () => ({
    sendEmail: jest.fn().mockResolvedValue(true)
  }));

  const { sendEmail } = require('../../server/services/email/transport');
  const emailService = require('../../server/utils/emailService');

  describe('sendCustomerDeliveredEmail', () => {
    beforeEach(() => {
      sendEmail.mockClear();
    });

    const order = {
      orderId: 'ORD-test-1234',
      deliveredAt: new Date('2026-06-09T15:30:00Z'),
      actualTotal: 23.5
    };

    it('exports the dispatcher', () => {
      expect(typeof emailService.sendCustomerDeliveredEmail).toBe('function');
    });

    it('sends the English email with filled placeholders', async () => {
      const customer = {
        firstName: 'Jane', lastName: 'Doe',
        email: 'jane@example.com', languagePreference: 'en'
      };
      await emailService.sendCustomerDeliveredEmail(customer, order);

      expect(sendEmail).toHaveBeenCalledTimes(1);
      const [to, subject, html] = sendEmail.mock.calls[0];
      expect(to).toBe('jane@example.com');
      expect(subject).toContain('Delivered');
      expect(html).toContain('Jane');
      expect(html).toContain('ORD-test-1234');
      expect(html).not.toMatch(/\[[A-Z_]+\]/); // no unfilled placeholders
    });

    it.each([
      ['es', 'entregada'],
      ['pt', 'entregue'],
      ['de', 'geliefert']
    ])('sends the %s subject', async (lang, fragment) => {
      const customer = {
        firstName: 'Jane', lastName: 'Doe',
        email: 'jane@example.com', languagePreference: lang
      };
      await emailService.sendCustomerDeliveredEmail(customer, order);
      const [, subject] = sendEmail.mock.calls[0];
      expect(subject.toLowerCase()).toContain(fragment);
    });

    it('does not throw when transport fails (best-effort)', async () => {
      sendEmail.mockRejectedValueOnce(new Error('smtp down'));
      const customer = { firstName: 'J', lastName: 'D', email: 'j@example.com', languagePreference: 'en' };
      await expect(emailService.sendCustomerDeliveredEmail(customer, order)).resolves.toBe(false);
    });
  });
  ```
- [ ] Run it and confirm it fails for the right reason:
  ```bash
  npm test -- tests/unit/emailCustomerDelivered.test.js
  ```
  Expected failure: `expect(typeof ...).toBe('function')` → received `'undefined'` (and the other cases fail with `emailService.sendCustomerDeliveredEmail is not a function`).
- [ ] Create `server/templates/emails/customer-order-delivered.html` (mirrors the structure/styling of `server/templates/emails/affiliate-commission.html`):
  ```html
  <!DOCTYPE html>
  <html>
  <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>[EMAIL_TITLE]</title>
      <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #1e3a8a; color: #ffffff !important; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; }
          .delivery-details { background-color: #e8f5e9; padding: 15px; margin: 15px 0; border-radius: 5px; border: 1px solid #4caf50; }
          .footer { background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; border-radius: 0 0 5px 5px; }
          .detail-row { margin: 10px 0; }
          .detail-label { font-weight: bold; color: #555; }
      </style>
  </head>
  <body>
      <div class="container">
          <div class="header">
              <h1>[EMAIL_HEADER]</h1>
          </div>
          <div class="content">
              <p>[GREETING]</p>
              <p>[DELIVERED_MESSAGE]</p>
              <div class="delivery-details">
                  <div class="detail-row">
                      <span class="detail-label">[ORDER_ID_LABEL]:</span> [ORDER_ID]
                  </div>
                  <div class="detail-row">
                      <span class="detail-label">[DELIVERED_AT_LABEL]:</span> [DELIVERED_AT]
                  </div>
              </div>
              <p>[THANKS_MESSAGE]</p>
              <p>[CLOSING_MESSAGE]</p>
          </div>
          <div class="footer">
              <p>&copy; [CURRENT_YEAR] CRHS Enterprises, LLC. [FOOTER_RIGHTS]</p>
              <p>[FOOTER_AUTOMATED_MESSAGE]</p>
          </div>
      </div>
  </body>
  </html>
  ```
- [ ] Append the dispatcher to `server/services/email/dispatcher/customer.js` (after `sendCustomerPasswordResetEmail`, end of file). The file already imports `loadTemplate`, `fillTemplate`, `sendEmail` at the top — reuse them. If it does not already import `logger`, add `const logger = require('../../../utils/logger');` to the top imports (check: `grep -n "require" server/services/email/dispatcher/customer.js | head`):
  ```javascript
  /**
   * Notification B (spec §6.6) — customer "your laundry was delivered".
   * Sent at order `delivered`: affiliate door confirm, customer PIN
   * confirm, or the re-intake auto-deliver (method 'reintake').
   * Best-effort: returns false on failure, never throws.
   */
  exports.sendCustomerDeliveredEmail = async (customer, order) => {
    try {
      const language = customer.languagePreference || 'en';
      const template = await loadTemplate('customer-order-delivered', language);

      const translations = {
        en: {
          EMAIL_TITLE: 'Your Laundry Was Delivered',
          EMAIL_HEADER: 'Laundry Delivered!',
          GREETING: `Hello ${customer.firstName},`,
          DELIVERED_MESSAGE: 'Your clean laundry has been delivered. The bag is back with you and ready for next time.',
          ORDER_ID_LABEL: 'Order ID',
          DELIVERED_AT_LABEL: 'Delivered',
          THANKS_MESSAGE: 'Thank you for choosing WaveMAX Laundry!',
          CLOSING_MESSAGE: 'Best regards,<br>The WaveMAX Laundry Team',
          FOOTER_RIGHTS: 'All rights reserved.',
          FOOTER_AUTOMATED_MESSAGE: 'This is an automated message. Please do not reply to this email.'
        },
        es: {
          EMAIL_TITLE: 'Su ropa fue entregada',
          EMAIL_HEADER: '¡Ropa entregada!',
          GREETING: `Hola ${customer.firstName},`,
          DELIVERED_MESSAGE: 'Su ropa limpia ha sido entregada. La bolsa está de vuelta con usted y lista para la próxima vez.',
          ORDER_ID_LABEL: 'ID del Pedido',
          DELIVERED_AT_LABEL: 'Entregado',
          THANKS_MESSAGE: '¡Gracias por elegir WaveMAX Laundry!',
          CLOSING_MESSAGE: 'Saludos cordiales,<br>El Equipo de WaveMAX Laundry',
          FOOTER_RIGHTS: 'Todos los derechos reservados.',
          FOOTER_AUTOMATED_MESSAGE: 'Este es un mensaje automatizado. Por favor no responda a este correo.'
        },
        pt: {
          EMAIL_TITLE: 'Sua roupa foi entregue',
          EMAIL_HEADER: 'Roupa entregue!',
          GREETING: `Olá ${customer.firstName},`,
          DELIVERED_MESSAGE: 'Sua roupa limpa foi entregue. A sacola está de volta com você e pronta para a próxima vez.',
          ORDER_ID_LABEL: 'ID do Pedido',
          DELIVERED_AT_LABEL: 'Entregue',
          THANKS_MESSAGE: 'Obrigado por escolher a WaveMAX Laundry!',
          CLOSING_MESSAGE: 'Atenciosamente,<br>Equipe WaveMAX Laundry',
          FOOTER_RIGHTS: 'Todos os direitos reservados.',
          FOOTER_AUTOMATED_MESSAGE: 'Esta é uma mensagem automática. Por favor, não responda a este e-mail.'
        },
        de: {
          EMAIL_TITLE: 'Ihre Wäsche wurde geliefert',
          EMAIL_HEADER: 'Wäsche geliefert!',
          GREETING: `Hallo ${customer.firstName},`,
          DELIVERED_MESSAGE: 'Ihre saubere Wäsche wurde geliefert. Der Beutel ist wieder bei Ihnen und bereit für das nächste Mal.',
          ORDER_ID_LABEL: 'Auftragsnummer',
          DELIVERED_AT_LABEL: 'Geliefert',
          THANKS_MESSAGE: 'Vielen Dank, dass Sie WaveMAX Laundry gewählt haben!',
          CLOSING_MESSAGE: 'Mit freundlichen Grüßen,<br>Ihr WaveMAX Laundry Team',
          FOOTER_RIGHTS: 'Alle Rechte vorbehalten.',
          FOOTER_AUTOMATED_MESSAGE: 'Dies ist eine automatische Nachricht. Bitte antworten Sie nicht auf diese E-Mail.'
        }
      };
      const t = translations[language] || translations.en;

      const deliveredAt = order.deliveredAt ? new Date(order.deliveredAt) : new Date();
      const html = fillTemplate(template, {
        ...t,
        ORDER_ID: order.orderId,
        DELIVERED_AT: deliveredAt.toLocaleString(),
        CURRENT_YEAR: String(new Date().getFullYear())
      });

      await sendEmail(customer.email, t.EMAIL_TITLE, html);
      logger.info(`Customer delivered email sent to ${customer.email} for order ${order.orderId}`);
      return true;
    } catch (error) {
      logger.error('Error sending customer delivered email:', error);
      return false;
    }
  };
  ```
- [ ] Run the test again:
  ```bash
  npm test -- tests/unit/emailCustomerDelivered.test.js
  ```
  Expected: all 6 pass. If the `no unfilled placeholders` assertion fails, check `fillTemplate`'s `Email template placeholder [X] not found` warning for the missing key and add it to the data object.
- [ ] Commit:
  ```bash
  git add server/templates/emails/customer-order-delivered.html server/services/email/dispatcher/customer.js tests/unit/emailCustomerDelivered.test.js
  git commit -m "feat(orders): customer delivered email dispatcher + template (Notification B, en/es/pt/de)"
  ```

## Task 2 — `orderIntakeService.createOrderFromBag`: happy path + the MANDATORY silent-zero guard

Spec §6.4 steps 1–7. The critical trap (spec §6.4 step 4, quoted): *"**Omitting this silently sets `totalFee=0`, zeroing commission and the emailed payment amount.**"* — the Order pre-save **reads** `this.feeBreakdown?.totalFee || 0`; it does not compute the delivery fee. So `calculateDeliveryFee(1, affiliate)` is spread into `order.feeBreakdown` **before** the first `.save()`, and the regression guard asserts non-zero `feeBreakdown.totalFee`, `affiliateCommission`, and `paymentAmount` on the saved order.

**Files:**
- Create: `server/modules/orders/orderIntakeService.js`
- Create: `tests/unit/orderIntakeService.test.js`

**Steps:**

- [ ] Write the failing test `tests/unit/orderIntakeService.test.js` (uses real Mongo via `tests/setup.js`, real `Bag`/`Order`/pricing/state-machine; mocks only the email service; spies on `paymentLinkService.generatePaymentLinks` to prove links are generated exactly once):
  ```javascript
  // orderIntakeService — order birth at store intake (spec §6.4).
  // MANDATORY: the silent-zero regression guard (non-zero totalFee /
  // affiliateCommission / paymentAmount after intake).

  jest.mock('../../server/utils/emailService', () => ({
    sendV2PaymentRequest: jest.fn().mockResolvedValue(true),
    sendCustomerDeliveredEmail: jest.fn().mockResolvedValue(true),
    sendAffiliateCommissionEmail: jest.fn().mockResolvedValue(true),
    sendOrderReadyNotification: jest.fn().mockResolvedValue(true)
  }));

  const mongoose = require('mongoose');
  const emailService = require('../../server/utils/emailService');
  const paymentLinkService = require('../../server/services/paymentLinkService');
  const Order = require('../../server/models/Order');
  const Customer = require('../../server/models/Customer');
  const Affiliate = require('../../server/models/Affiliate');
  const Bag = require('../../server/modules/bags/Bag');
  const { createOrderFromBag } = require('../../server/modules/orders/orderIntakeService');
  const { ensureTestAffiliate, ensureTestCustomer } = require('../helpers/v2TestHelpers');

  describe('orderIntakeService.createOrderFromBag', () => {
    let affiliate, customer, bag, operatorId, linkSpy;
    const TOKEN = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'; // 32 hex chars

    beforeEach(async () => {
      await Promise.all([
        Order.deleteMany({}), Customer.deleteMany({}),
        Affiliate.deleteMany({}), Bag.deleteMany({})
      ]);
      jest.clearAllMocks();

      affiliate = await ensureTestAffiliate();           // minimumDeliveryFee 10, perBagDeliveryFee 2.50
      customer = await ensureTestCustomer({ affiliateId: affiliate.affiliateId });
      operatorId = new mongoose.Types.ObjectId();

      bag = await Bag.create({
        token: TOKEN,
        tokenHash: Bag.hashToken(TOKEN),
        affiliateId: affiliate.affiliateId,
        customerId: customer.customerId,
        status: 'active',
        batchId: 'BATCH-test'
      });

      linkSpy = jest.spyOn(paymentLinkService, 'generatePaymentLinks');
    });

    afterEach(() => {
      linkSpy.mockRestore();
    });

    it('creates exactly one in_progress order with ids derived from the bag', async () => {
      const { order } = await createOrderFromBag({
        bagToken: TOKEN, weight: 10,
        addOns: { premiumDetergent: true, fabricSoftener: false, stainRemover: false },
        freshAddOnsFormPlaced: true, operatorId
      });

      expect(order.status).toBe('in_progress');
      expect(order.customerId).toBe(customer.customerId);   // from the bag, not from input
      expect(order.affiliateId).toBe(affiliate.affiliateId);
      expect(order.bagId).toBe(bag.bagId);                  // BAG-uuid join key
      expect(order.bagToken).toBe(TOKEN);                   // 32-hex scan key
      expect(order.bags).toHaveLength(1);
      expect(order.bags[0].bagToken).toBe(TOKEN);           // sub-doc uses bagToken, never bagId
      expect(order.bags[0].bagNumber).toBe(1);
      expect(order.bags[0].status).toBe('intake');
      expect(order.bags[0].scannedAt.intake).toBeInstanceOf(Date);
      expect(String(order.bags[0].scannedBy.intake)).toBe(String(operatorId));
      expect(order.intake.weight).toBe(10);
      expect(String(order.intake.weighedBy)).toBe(String(operatorId));
      expect(order.intakeAt).toBeInstanceOf(Date);
      expect(order.actualWeight).toBe(10);
      expect(order.freshAddOnsFormPlaced).toBe(true);
      expect(String(order.freshAddOnsFormAckBy)).toBe(String(operatorId));
      expect(order.freshAddOnsFormAckAt).toBeInstanceOf(Date);
      expect(String(order.addOnsEnteredBy)).toBe(String(operatorId));

      expect(await Order.countDocuments({ bagId: bag.bagId })).toBe(1);
    });

    it('SILENT-ZERO GUARD: saved order has non-zero totalFee, affiliateCommission, paymentAmount', async () => {
      await createOrderFromBag({
        bagToken: TOKEN, weight: 10,
        addOns: { premiumDetergent: true }, freshAddOnsFormPlaced: true, operatorId
      });

      const saved = await Order.findOne({ bagId: bag.bagId });
      // 10 lbs @ 1.25 = 12.50 WDF; fee = max(10, 1×2.50) = 10.00 (min applied);
      // add-on = 1 × 10 × 0.10 = 1.00; total = 23.50; commission = 1.25 + 10 = 11.25
      expect(saved.feeBreakdown.totalFee).toBeGreaterThan(0);
      expect(saved.feeBreakdown.totalFee).toBeCloseTo(10.0, 2);
      expect(saved.feeBreakdown.minimumApplied).toBe(true);
      expect(saved.addOnTotal).toBeCloseTo(1.0, 2);
      expect(saved.actualTotal).toBeCloseTo(23.5, 2);
      expect(saved.paymentAmount).toBeGreaterThan(0);
      expect(saved.paymentAmount).toBeCloseTo(23.5, 2);
      expect(saved.affiliateCommission).toBeGreaterThan(0);
      expect(saved.affiliateCommission).toBeCloseTo(11.25, 2);
    });

    it('generates payment links exactly ONCE, flips paymentStatus to awaiting, emails the request', async () => {
      const { order } = await createOrderFromBag({
        bagToken: TOKEN, weight: 10, addOns: {}, freshAddOnsFormPlaced: true, operatorId
      });

      expect(linkSpy).toHaveBeenCalledTimes(1);
      expect(linkSpy).toHaveBeenCalledWith(order.orderId, expect.any(Number), expect.any(String));
      expect(order.paymentStatus).toBe('awaiting');
      expect(order.paymentRequestedAt).toBeInstanceOf(Date);
      expect(order.paymentLinks.venmo).toBeTruthy();
      expect(order.paymentQRCodes.venmo).toMatch(/^data:image\/png/);
      expect(emailService.sendV2PaymentRequest).toHaveBeenCalledTimes(1);
      const callArg = emailService.sendV2PaymentRequest.mock.calls[0][0];
      expect(callArg.customer.customerId).toBe(customer.customerId);
      expect(callArg.paymentAmount).toBeCloseTo(order.paymentAmount, 2);
    });

    it('applies carry-in WDF credit at intake and resets the customer balance', async () => {
      customer.wdfCredit = 5;
      await customer.save();

      await createOrderFromBag({
        bagToken: TOKEN, weight: 10, addOns: {}, freshAddOnsFormPlaced: false, operatorId
      });

      const saved = await Order.findOne({ bagId: bag.bagId });
      expect(saved.wdfCreditApplied).toBeCloseTo(5, 2);
      // actualTotal nets the credit (12.50 + 10 − 5 = 17.50); paymentAmount stays gross (22.50)
      expect(saved.actualTotal).toBeCloseTo(17.5, 2);
      expect(saved.paymentAmount).toBeCloseTo(22.5, 2);

      const freshCustomer = await Customer.findOne({ customerId: customer.customerId });
      expect(freshCustomer.wdfCredit).toBe(0);
    });
  });
  ```
- [ ] Run it and confirm it fails for the right reason:
  ```bash
  npm test -- tests/unit/orderIntakeService.test.js
  ```
  Expected failure: `Cannot find module '../../server/modules/orders/orderIntakeService'`.
- [ ] Create `server/modules/orders/orderIntakeService.js`:
  ```javascript
  // Order intake service — the single place a new-flow order is born (spec §6.4).
  //
  // createOrderFromBag: resolve the durable bag, guard open orders (Task 3/4
  // add the guards + re-intake), set EVERY pricing input before the first
  // save (the Order pre-save READS feeBreakdown.totalFee, it does not
  // compute the delivery fee), save, generate payment links exactly once,
  // email the payment request, audit.

  const mongoose = require('mongoose');
  const Order = require('../../models/Order');
  const Customer = require('../../models/Customer');
  const Affiliate = require('../../models/Affiliate');
  const bagService = require('../bags/bagService');
  const { calculateDeliveryFee } = require('../../services/orderPricingService');
  const paymentLinkService = require('../../services/paymentLinkService');
  const emailService = require('../../utils/emailService');
  const { logAuditEvent, AuditEvents } = require('../../utils/auditLogger');
  const logger = require('../../utils/logger');

  class IntakeError extends Error {
    constructor(code, message, status = 400, details = {}) {
      super(message);
      this.code = code;
      this.status = status;
      this.details = details;
      this.isIntakeError = true;
    }
  }

  /**
   * Create exactly one order from a bag intake.
   * @param {Object} args
   * @param {string} args.bagToken - the opaque 32-hex Bag.token (scan key)
   * @param {number} args.weight - actual weight in lbs (operator-entered)
   * @param {Object} [args.addOns] - { premiumDetergent, fabricSoftener, stainRemover }
   * @param {boolean} [args.freshAddOnsFormPlaced] - operator ack: fresh form in the pocket
   * @param {ObjectId|string} args.operatorId - kiosk JWT operator (PR 9 adds scan-code resolution)
   * @param {Object} [args.req] - Express request for audit context
   * @returns {Promise<{order: Order, reIntake: boolean}>}
   * @throws {IntakeError} invalid_weight(400) | invalid_bag(404) | bag_not_active(409)
   *                       | order_already_open(409) | bag_links_broken(409)
   */
  async function createOrderFromBag({ bagToken, weight, addOns, freshAddOnsFormPlaced, operatorId, req }) {
    const parsedWeight = parseFloat(weight);
    if (!parsedWeight || parsedWeight <= 0) {
      throw new IntakeError('invalid_weight', 'A positive weight is required', 400);
    }

    // 1. Resolve the bag (generic 404 — anti-enumeration, spec §9).
    const resolved = await bagService.resolveByToken(bagToken);
    if (!resolved || !resolved.bag) {
      throw new IntakeError('invalid_bag', 'Bag not recognized', 404);
    }
    const bag = resolved.bag;
    if (bag.status !== 'active') {
      throw new IntakeError('bag_not_active', 'Bag is not active', 409);
    }

    // Open-order check BEFORE counters are bumped (Task 3 adds the 409,
    // Task 4 adds the picked_up re-intake auto-deliver).
    const openOrder = await Order.findOne({
      bagId: bag.bagId,
      status: { $in: ['in_progress', 'processed', 'ready_for_pickup', 'picked_up'] }
    }).sort({ createdAt: -1 });
    const reIntake = !!(openOrder && openOrder.status === 'picked_up');

    // Lifetime counters (++orderCount / lastIntakeAt) — PR 6 static.
    await bagService.linkToOrderAtIntake({ token: bagToken, operatorId });

    // 2. Relationship comes from the bag — never from client input (spec §9).
    const customer = await Customer.findOne({ customerId: bag.customerId });
    const affiliate = await Affiliate.findOne({ affiliateId: bag.affiliateId });
    if (!customer || !affiliate) {
      throw new IntakeError('bag_links_broken', 'Bag is not linked to an active customer/affiliate', 409);
    }

    // 3. Delivery fee for exactly one bag (one bag = one order).
    const feeCalculation = await calculateDeliveryFee(1, affiliate);

    // Carry-in WDF credit applies at intake (spec §4.4).
    let wdfCreditToApply = 0;
    if (customer.wdfCredit && customer.wdfCredit !== 0) {
      wdfCreditToApply = customer.wdfCredit;
      logger.info(`Applying WDF credit of $${wdfCreditToApply} at intake for customer ${customer.customerId}`);
    }

    const now = new Date();

    // 4. EVERY pricing input set before the first save.
    const order = new Order({
      customerId: customer.customerId,
      affiliateId: affiliate.affiliateId,
      bagId: bag.bagId,        // BAG-uuid join key
      bagToken: bag.token,     // 32-hex scan key
      status: 'in_progress',
      actualWeight: parsedWeight,
      addOns: {
        premiumDetergent: !!(addOns && addOns.premiumDetergent),
        fabricSoftener: !!(addOns && addOns.fabricSoftener),
        stainRemover: !!(addOns && addOns.stainRemover)
      },
      addOnsEnteredBy: operatorId,
      addOnsEnteredAt: now,
      freshAddOnsFormPlaced: !!freshAddOnsFormPlaced,
      freshAddOnsFormAckBy: freshAddOnsFormPlaced ? operatorId : undefined,
      freshAddOnsFormAckAt: freshAddOnsFormPlaced ? now : undefined,
      feeBreakdown: { ...feeCalculation },   // pre-save READS totalFee — omit and everything zeroes
      wdfCreditApplied: wdfCreditToApply,
      intakeAt: now,
      assignedOperator: operatorId,
      intake: {
        weight: parsedWeight,
        weighedAt: now,
        weighedBy: operatorId,
        addOnFormPlaced: !!freshAddOnsFormPlaced,
        addOnFormPlacedAt: freshAddOnsFormPlaced ? now : undefined
      },
      bags: [{
        bagToken: bag.token,   // canon: bags[] uses bagToken, NEVER bagId
        bagNumber: 1,
        status: 'intake',
        weight: parsedWeight,
        scannedAt: { intake: now },
        scannedBy: { intake: operatorId }
      }]
    });

    // 5. Save — pre-save computes actualTotal / paymentAmount / affiliateCommission.
    await order.save();

    if (wdfCreditToApply !== 0) {
      customer.wdfCredit = 0;
      customer.wdfCreditUpdatedAt = now;
      await customer.save();
    }

    // 6. Payment links/QR generated exactly ONCE (spec §6.4 step 6).
    const customerName = `${customer.firstName} ${customer.lastName}`;
    const { links, qrCodes } = await paymentLinkService.generatePaymentLinks(
      order.orderId, order.paymentAmount, customerName
    );
    order.paymentLinks = links;
    order.paymentQRCodes = qrCodes;
    order.paymentStatus = 'awaiting';
    order.paymentRequestedAt = new Date();
    await order.save();

    // 7. Payment request email (best-effort) + audit.
    try {
      await emailService.sendV2PaymentRequest({
        customer, order,
        paymentAmount: order.paymentAmount,
        paymentLinks: links,
        qrCodes
      });
    } catch (emailError) {
      logger.error(`Failed to send payment request for order ${order.orderId}:`, emailError);
    }

    await logAuditEvent(AuditEvents.ORDER_STATUS_CHANGED, {
      operatorId,
      orderId: order.orderId,
      bagId: bag.bagId,
      action: 'order_created_at_intake',
      weight: parsedWeight,
      paymentAmount: order.paymentAmount
    }, req);

    logger.info(`Order ${order.orderId} created at intake for bag ${bag.bagId} (${parsedWeight} lbs, $${order.paymentAmount})`);
    return { order, reIntake };
  }

  module.exports = { createOrderFromBag, IntakeError };
  ```
  Note: `mongoose` is imported for future use by Task 4 (ObjectId stringification); if ESLint flags it unused after Task 2, drop the import here and let Task 4 re-add what it needs.
- [ ] Run again:
  ```bash
  npm test -- tests/unit/orderIntakeService.test.js
  ```
  Expected: all 4 pass. If the money assertions are off, print the saved order and check (a) `feeBreakdown` was set pre-save, (b) `SystemConfig.initializeDefaults()` ran (it does in `tests/setup.js`), (c) the affiliate overrides from `ensureTestAffiliate` (minimumDeliveryFee 10 / perBagDeliveryFee 2.50).
- [ ] Commit:
  ```bash
  git add server/modules/orders/orderIntakeService.js tests/unit/orderIntakeService.test.js
  git commit -m "feat(orders): orderIntakeService.createOrderFromBag — order born at store intake with silent-zero pricing guard"
  ```

---

## Task 3 — Intake guards: invalid token, non-active bag, at-store open order, invalid weight

Spec §6.4 step 1: at-store open order (`in_progress`/`processed`/`ready_for_pickup`) → `409 order_already_open` (advance it, don't re-intake); cancelled/delivered don't count. Spec §6.1 edge cases: lost/unknown token → generic 404; non-active bag → `409 bag_not_active`.

**Files:**
- Modify: `server/modules/orders/orderIntakeService.js` (add the `order_already_open` throw inside the existing open-order block)
- Modify: `tests/unit/orderIntakeService.test.js` (append a `describe('guards')` block)

**Steps:**

- [ ] Append the failing tests to `tests/unit/orderIntakeService.test.js` (inside the top-level `describe`, after the existing `it`s — it can reuse `affiliate`/`customer`/`bag`/`operatorId`/`TOKEN` from `beforeEach`):
  ```javascript
  describe('guards', () => {
    it('rejects an unknown token with a generic 404 (anti-enumeration)', async () => {
      await expect(createOrderFromBag({
        bagToken: 'f'.repeat(32), weight: 10, addOns: {}, freshAddOnsFormPlaced: false, operatorId
      })).rejects.toMatchObject({ isIntakeError: true, code: 'invalid_bag', status: 404 });
    });

    it('rejects a non-active (issued) bag with 409 bag_not_active', async () => {
      bag.status = 'issued';
      bag.customerId = null;
      await bag.save();
      await expect(createOrderFromBag({
        bagToken: TOKEN, weight: 10, addOns: {}, freshAddOnsFormPlaced: false, operatorId
      })).rejects.toMatchObject({ isIntakeError: true, code: 'bag_not_active', status: 409 });
    });

    it.each(['in_progress', 'processed', 'ready_for_pickup'])(
      'rejects intake while an at-store order is open (%s) with 409 order_already_open',
      async (openStatus) => {
        await createOrderFromBag({
          bagToken: TOKEN, weight: 10, addOns: {}, freshAddOnsFormPlaced: false, operatorId
        });
        // Force the open order into the at-store status under test.
        await Order.updateOne({ bagId: bag.bagId }, { $set: { status: openStatus } });

        await expect(createOrderFromBag({
          bagToken: TOKEN, weight: 12, addOns: {}, freshAddOnsFormPlaced: false, operatorId
        })).rejects.toMatchObject({ isIntakeError: true, code: 'order_already_open', status: 409 });

        expect(await Order.countDocuments({ bagId: bag.bagId })).toBe(1); // no second order
      }
    );

    it('allows intake when prior orders are delivered or cancelled', async () => {
      await createOrderFromBag({
        bagToken: TOKEN, weight: 10, addOns: {}, freshAddOnsFormPlaced: false, operatorId
      });
      await Order.updateOne({ bagId: bag.bagId }, { $set: { status: 'delivered' } });

      const { order } = await createOrderFromBag({
        bagToken: TOKEN, weight: 8, addOns: {}, freshAddOnsFormPlaced: false, operatorId
      });
      expect(order.status).toBe('in_progress');
      expect(await Order.countDocuments({ bagId: bag.bagId })).toBe(2);
    });

    it.each([0, -1, 'abc', undefined])('rejects invalid weight %p with 400', async (badWeight) => {
      await expect(createOrderFromBag({
        bagToken: TOKEN, weight: badWeight, addOns: {}, freshAddOnsFormPlaced: false, operatorId
      })).rejects.toMatchObject({ isIntakeError: true, code: 'invalid_weight', status: 400 });
    });
  });
  ```
- [ ] Run:
  ```bash
  npm test -- tests/unit/orderIntakeService.test.js
  ```
  Expected: the `order_already_open` cases FAIL (Task 2's service computed `openOrder` but did not throw — a second order gets created or the `rejects` assertion fails). `invalid_bag`, `bag_not_active`, and `invalid_weight` already pass from Task 2 — that is fine; the red phase here is specifically the open-order guard.
- [ ] Implement the guard. In `server/modules/orders/orderIntakeService.js`, replace:
  ```javascript
  const reIntake = !!(openOrder && openOrder.status === 'picked_up');
  ```
  with:
  ```javascript
  const reIntake = !!(openOrder && openOrder.status === 'picked_up');
  if (openOrder && !reIntake) {
    // Bag never left the store — advance the existing order, don't re-intake.
    throw new IntakeError(
      'order_already_open',
      `Order ${openOrder.orderId} is already open for this bag (${openOrder.status})`,
      409,
      { orderId: openOrder.orderId, status: openOrder.status }
    );
  }
  ```
- [ ] Run again:
  ```bash
  npm test -- tests/unit/orderIntakeService.test.js
  ```
  Expected: all pass (Tasks 2+3 cases).
- [ ] Commit:
  ```bash
  git add server/modules/orders/orderIntakeService.js tests/unit/orderIntakeService.test.js
  git commit -m "feat(orders): intake guards — generic 404, bag_not_active, order_already_open, invalid weight"
  ```

## Task 4 — Re-intake: a `picked_up` open order is auto-delivered first

Spec §6.4 step 1 (quoted): *"**if it is `picked_up`** (out for delivery, never confirmed) → **auto-deliver it first** (`status='delivered'`, `proofOfDelivery{method:'reintake', confirmedByRole:'operator', confirmedById:operatorId}`, realize commission, "delivered" email) — Rick's re-intake rule — then create the new order"*. Audit constant `ORDER_REINTAKE` comes from spec §9's audit-event list.

**Files:**
- Modify: `server/utils/auditLogger.js` (add `ORDER_REINTAKE` to `AuditEvents` — the "Order events" block currently reads, at lines 72–75: `ORDER_CREATED`, `ORDER_CANCELLED`, `ORDER_STATUS_CHANGED`)
- Modify: `server/modules/orders/orderIntakeService.js` (add `autoDeliverPickedUpOrder` + call it in the open-order block)
- Modify: `tests/unit/orderIntakeService.test.js` (append a `describe('re-intake')` block)

**Steps:**

- [ ] Append the failing tests to `tests/unit/orderIntakeService.test.js`:
  ```javascript
  describe('re-intake (picked_up open order)', () => {
    let priorOrder;

    beforeEach(async () => {
      const { order } = await createOrderFromBag({
        bagToken: TOKEN, weight: 10, addOns: {}, freshAddOnsFormPlaced: false, operatorId
      });
      // Simulate operator scan-out (PR 9 owns the real path): force picked_up.
      await Order.updateOne({ orderId: order.orderId }, { $set: { status: 'picked_up' } });
      priorOrder = await Order.findOne({ orderId: order.orderId });
      jest.clearAllMocks();
    });

    it('auto-delivers the prior order with method reintake, realizes commission once, then opens a new order', async () => {
      const { order: newOrder, reIntake } = await createOrderFromBag({
        bagToken: TOKEN, weight: 7, addOns: {}, freshAddOnsFormPlaced: true, operatorId
      });

      expect(reIntake).toBe(true);

      const delivered = await Order.findOne({ orderId: priorOrder.orderId });
      expect(delivered.status).toBe('delivered');
      expect(delivered.deliveredAt).toBeInstanceOf(Date);
      expect(delivered.proofOfDelivery.method).toBe('reintake');
      expect(delivered.proofOfDelivery.confirmedByRole).toBe('operator');
      expect(delivered.proofOfDelivery.confirmedById).toBe(String(operatorId));
      expect(delivered.commissionRealized).toBe(true);
      expect(delivered.commissionRealizedAt).toBeInstanceOf(Date);
      expect(delivered.bags[0].status).toBe('delivered');

      expect(newOrder.status).toBe('in_progress');
      expect(newOrder.orderId).not.toBe(priorOrder.orderId);
      expect(await Order.countDocuments({ bagId: bag.bagId })).toBe(2);

      // Delivered email (Notification B) + commission email fire on auto-deliver.
      expect(emailService.sendCustomerDeliveredEmail).toHaveBeenCalledTimes(1);
      expect(emailService.sendAffiliateCommissionEmail).toHaveBeenCalledTimes(1);
    });

    it('does not double-close on a double scan (one delivered + one in_progress)', async () => {
      await createOrderFromBag({
        bagToken: TOKEN, weight: 7, addOns: {}, freshAddOnsFormPlaced: false, operatorId
      });
      // Second scan now hits the NEW open in_progress order -> 409, not another auto-deliver.
      await expect(createOrderFromBag({
        bagToken: TOKEN, weight: 7, addOns: {}, freshAddOnsFormPlaced: false, operatorId
      })).rejects.toMatchObject({ code: 'order_already_open', status: 409 });

      expect(await Order.countDocuments({ bagId: bag.bagId, status: 'delivered' })).toBe(1);
      expect(await Order.countDocuments({ bagId: bag.bagId, status: 'in_progress' })).toBe(1);
    });

    it('still delivers the prior order when emails throw (best-effort)', async () => {
      emailService.sendCustomerDeliveredEmail.mockRejectedValueOnce(new Error('smtp down'));
      const { order: newOrder } = await createOrderFromBag({
        bagToken: TOKEN, weight: 7, addOns: {}, freshAddOnsFormPlaced: false, operatorId
      });
      const delivered = await Order.findOne({ orderId: priorOrder.orderId });
      expect(delivered.status).toBe('delivered');
      expect(newOrder.status).toBe('in_progress');
    });
  });
  ```
- [ ] Run:
  ```bash
  npm test -- tests/unit/orderIntakeService.test.js
  ```
  Expected failure: the first re-intake case throws — Task 3's guard… does NOT fire for `picked_up` (the `reIntake` flag exempts it), but no auto-deliver happens yet, so `delivered.status` is still `'picked_up'` → `expect(delivered.status).toBe('delivered')` fails. Confirm that exact failure.
- [ ] Add the audit constant. In `server/utils/auditLogger.js`, change:
  ```javascript
  // Order events
  ORDER_CREATED: 'ORDER_CREATED',
  ORDER_CANCELLED: 'ORDER_CANCELLED',
  ORDER_STATUS_CHANGED: 'ORDER_STATUS_CHANGED',
  ```
  to:
  ```javascript
  // Order events
  ORDER_CREATED: 'ORDER_CREATED',
  ORDER_CANCELLED: 'ORDER_CANCELLED',
  ORDER_STATUS_CHANGED: 'ORDER_STATUS_CHANGED',
  ORDER_REINTAKE: 'ORDER_REINTAKE',
  ```
- [ ] Implement the auto-deliver. In `server/modules/orders/orderIntakeService.js`, add above `createOrderFromBag` (it uses the already-imported `applyTransition` — add `const { applyTransition } = require('./orderStateMachine');` to the top imports now):
  ```javascript
  /**
   * Re-intake rule (spec §6.4 step 1): a picked_up order whose bag is being
   * scanned back IN was delivered but never confirmed — close it as
   * delivered exactly once, realize commission, notify, then the caller
   * opens the new order.
   */
  async function autoDeliverPickedUpOrder(order, operatorId, req) {
    applyTransition(order, 'delivered'); // validates picked_up -> delivered; pre-save stamps deliveredAt + commissionRealizedAt set-once
    order.commissionRealized = true;
    order.proofOfDelivery = {
      method: 'reintake',
      confirmedByRole: 'operator',
      confirmedById: String(operatorId),
      confirmedAt: new Date()
    };
    if (order.bags && order.bags[0]) {
      order.bags[0].status = 'delivered';
      order.bags[0].scannedAt.delivered = new Date();
      // bags[].scannedBy.delivered is typed String ref Affiliate (door scans);
      // re-intake is operator-confirmed, recorded in proofOfDelivery instead.
    }
    if (order.intake) {
      order.intake.deliveredAt = new Date();
    }
    await order.save();

    const customer = await Customer.findOne({ customerId: order.customerId });
    const affiliate = await Affiliate.findOne({ affiliateId: order.affiliateId });
    try {
      if (customer) {
        await emailService.sendCustomerDeliveredEmail(customer, order);
      }
      if (affiliate && customer) {
        await emailService.sendAffiliateCommissionEmail(affiliate, order, customer);
      }
    } catch (emailError) {
      logger.error(`Re-intake delivery emails failed for order ${order.orderId}:`, emailError);
    }

    await logAuditEvent(AuditEvents.ORDER_REINTAKE, {
      operatorId,
      orderId: order.orderId,
      bagId: order.bagId,
      action: 'auto_delivered_on_reintake'
    }, req);

    logger.info(`Re-intake: order ${order.orderId} auto-delivered (bag ${order.bagId})`);
  }
  ```
  Then, in `createOrderFromBag`, extend the open-order block so it reads:
  ```javascript
  const reIntake = !!(openOrder && openOrder.status === 'picked_up');
  if (openOrder && !reIntake) {
    // Bag never left the store — advance the existing order, don't re-intake.
    throw new IntakeError(
      'order_already_open',
      `Order ${openOrder.orderId} is already open for this bag (${openOrder.status})`,
      409,
      { orderId: openOrder.orderId, status: openOrder.status }
    );
  }
  if (reIntake) {
    await autoDeliverPickedUpOrder(openOrder, operatorId, req);
  }
  ```
- [ ] Run again:
  ```bash
  npm test -- tests/unit/orderIntakeService.test.js
  ```
  Expected: all pass (Tasks 2+3+4 cases). If `applyTransition` throws on `picked_up -> delivered`, re-check Task 0's confirmation of the PR 4 `TRANSITIONS` map (`picked_up: ['delivered']`).
- [ ] Run the touched-area suites to catch fallout:
  ```bash
  npm test -- tests/unit/emailCustomerDelivered.test.js tests/unit/orderIntakeService.test.js
  ```
  Expected: green.
- [ ] Commit:
  ```bash
  git add server/utils/auditLogger.js server/modules/orders/orderIntakeService.js tests/unit/orderIntakeService.test.js
  git commit -m "feat(orders): re-intake auto-delivers a picked_up order (method reintake, commission once) before opening the new one"
  ```

---

## Task 5 — Retune `sendV2PaymentRequest` for intake-born orders

`server/services/email/dispatcher/payment.js:18` (`sendV2PaymentRequest`) still fills two pre-redesign fields in its `emailData` (lines 43–44 of the current file):

```javascript
      numberOfBags: order.numberOfBags,
      pickupDate: new Date(order.pickupDate).toLocaleDateString(),
```

Post-PR 4 the Order has neither field, so the email renders `undefined` bags and `Invalid Date`. (PR 2/PR 4 may already have touched this — **check first**: `grep -n "pickupDate\|numberOfBags" server/services/email/dispatcher/payment.js`. If already fixed, skip this task entirely.)

**Files:**
- Modify: `server/services/email/dispatcher/payment.js` (lines 43–44)
- Create: `tests/unit/emailPaymentRequestIntake.test.js`

**Steps:**

- [ ] Write the failing test `tests/unit/emailPaymentRequestIntake.test.js`:
  ```javascript
  // sendV2PaymentRequest must render cleanly for intake-born orders
  // (no pickupDate/numberOfBags on the redesigned Order).

  jest.mock('../../server/services/email/transport', () => ({
    sendEmail: jest.fn().mockResolvedValue(true)
  }));

  const { sendEmail } = require('../../server/services/email/transport');
  const { sendV2PaymentRequest } = require('../../server/utils/emailService');

  describe('sendV2PaymentRequest (intake-born order)', () => {
    beforeEach(() => sendEmail.mockClear());

    it('renders without Invalid Date or undefined for an order with no pickupDate', async () => {
      const customer = { firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com', languagePreference: 'en' };
      const order = {
        orderId: 'ORD-test-5678',
        actualWeight: 10,
        baseRate: 1.25,
        addOnTotal: 1,
        feeBreakdown: { totalFee: 10 },
        paymentAmount: 23.5,
        intakeAt: new Date('2026-06-09T10:00:00Z'),
        affiliateId: 'AFF-test'
      };
      const paymentLinks = { venmo: 'v', paypal: 'p', cashapp: 'c' };
      const qrCodes = { venmo: 'data:image/png;base64,x', paypal: 'data:image/png;base64,x', cashapp: 'data:image/png;base64,x' };

      await sendV2PaymentRequest({ customer, order, paymentAmount: 23.5, paymentLinks, qrCodes });

      expect(sendEmail).toHaveBeenCalledTimes(1);
      const [, , html] = sendEmail.mock.calls[0];
      expect(html).not.toContain('Invalid Date');
      expect(html).not.toContain('undefined');
    });
  });
  ```
- [ ] Run it:
  ```bash
  npm test -- tests/unit/emailPaymentRequestIntake.test.js
  ```
  Expected failure: `expect(html).not.toContain('Invalid Date')` fails (the template fills `{{pickupDate}}` with `Invalid Date`). If instead it passes because the template no longer references those placeholders, verify with `grep -n "pickupDate\|numberOfBags" server/templates/emails/v2/payment-request.html` — if genuinely unused, delete the two `emailData` lines anyway and keep the test as a regression guard.
- [ ] Implement: in `server/services/email/dispatcher/payment.js`, replace:
  ```javascript
      numberOfBags: order.numberOfBags,
      pickupDate: new Date(order.pickupDate).toLocaleDateString(),
  ```
  with:
  ```javascript
      numberOfBags: 1, // one bag = one order (redesign)
      pickupDate: new Date(order.intakeAt || order.createdAt || Date.now()).toLocaleDateString(),
  ```
- [ ] Run again:
  ```bash
  npm test -- tests/unit/emailPaymentRequestIntake.test.js
  ```
  Expected: pass.
- [ ] Commit:
  ```bash
  git add server/services/email/dispatcher/payment.js tests/unit/emailPaymentRequestIntake.test.js
  git commit -m "fix(email): payment request renders intake date / single bag for intake-born orders"
  ```

## Task 6 — Kiosk endpoint: `POST /api/v1/operators/intake` (operator JWT + CSRF)

Spec §5: *"POST `/api/v1/operators/intake` | operator JWT (kiosk, CSRF) | Scan + weigh + add-ons + ack → CREATE one order (`in_progress`), email payment request; if the bag's open order is `picked_up`, auto-deliver it first (re-intake)"*. CSRF needs no config: `csrf-config.js`'s default branch enforces it for any unlisted mutating route. RBAC comes from the existing `router.use(checkRole(['operator']))` at `server/routes/operatorRoutes.js:53`.

**Files:**
- Modify: `server/controllers/operatorController.js` (add `exports.intake`; add the `orderIntakeService` require next to the existing service requires at lines 6–10)
- Modify: `server/routes/operatorRoutes.js` (add the route in the "Scanner Interface Routes" block, lines 73–83)
- Create: `tests/integration/operatorIntake.test.js`

**Steps:**

- [ ] Write the failing integration test `tests/integration/operatorIntake.test.js` (setup mirrors `tests/integration/operator.test.js`: PIN login via `process.env.OPERATOR_PIN`, agents + CSRF via `tests/helpers/csrfHelper.js`):
  ```javascript
  const request = require('supertest');
  const app = require('../../server');
  const mongoose = require('mongoose');
  const Operator = require('../../server/models/Operator');
  const Administrator = require('../../server/models/Administrator');
  const Order = require('../../server/models/Order');
  const Customer = require('../../server/models/Customer');
  const Affiliate = require('../../server/models/Affiliate');
  const Bag = require('../../server/modules/bags/Bag');
  const { getCsrfToken, createAgent } = require('../helpers/csrfHelper');
  const { ensureTestAffiliate, ensureTestCustomer } = require('../helpers/v2TestHelpers');
  const encryptionUtil = require('../../server/utils/encryption');

  jest.setTimeout(90000);

  describe('POST /api/v1/operators/intake (kiosk)', () => {
    let operatorAgent, adminAgent;
    let operatorToken, operatorCsrfToken, adminToken, adminCsrfToken;
    let testAdmin, testOperator, affiliate, customer, bag;
    const TOKEN = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'; // 32 hex chars

    beforeEach(async () => {
      await Promise.all([
        Operator.deleteMany({}), Administrator.deleteMany({}), Order.deleteMany({}),
        Customer.deleteMany({}), Affiliate.deleteMany({}), Bag.deleteMany({})
      ]);

      operatorAgent = createAgent(app);
      adminAgent = createAgent(app);

      const { salt, hash } = encryptionUtil.hashPassword('CompletelyUniquePassword417!');
      testAdmin = await Administrator.create({
        adminId: 'ADMIN001', firstName: 'Super', lastName: 'User',
        email: 'superuser@wavemax.com', passwordSalt: salt, passwordHash: hash,
        permissions: ['all']
      });
      const adminLogin = await adminAgent
        .post('/api/v1/auth/administrator/login')
        .send({ email: 'superuser@wavemax.com', password: 'CompletelyUniquePassword417!' });
      adminToken = adminLogin.body.token;
      adminCsrfToken = await getCsrfToken(app, adminAgent);

      process.env.OPERATOR_PIN = '1234';
      process.env.DEFAULT_OPERATOR_ID = 'OPR001';
      testOperator = await Operator.create({
        operatorId: 'OPR001', firstName: 'Test', lastName: 'Operator',
        email: 'operator@wavemax.com', username: 'testoperator',
        password: 'OperatorStrongPassword951!',
        shiftStart: '00:00', shiftEnd: '23:59', createdBy: testAdmin._id
      });
      const operatorLogin = await operatorAgent
        .post('/api/v1/auth/operator/login')
        .send({ pinCode: '1234' });
      operatorToken = operatorLogin.body.token;
      operatorCsrfToken = await getCsrfToken(app, operatorAgent);

      affiliate = await ensureTestAffiliate();
      customer = await ensureTestCustomer({ affiliateId: affiliate.affiliateId });
      bag = await Bag.create({
        token: TOKEN, tokenHash: Bag.hashToken(TOKEN),
        affiliateId: affiliate.affiliateId, customerId: customer.customerId,
        status: 'active', batchId: 'BATCH-int'
      });
    });

    function intakeBody(overrides = {}) {
      return {
        bagToken: TOKEN,
        weight: 10,
        addOns: { premiumDetergent: true, fabricSoftener: false, stainRemover: false },
        freshAddOnsFormPlaced: true,
        ...overrides
      };
    }

    it('creates an in_progress order with non-zero totals (silent-zero guard at the API seam)', async () => {
      const res = await operatorAgent
        .post('/api/v1/operators/intake')
        .set('Authorization', `Bearer ${operatorToken}`)
        .set('x-csrf-token', operatorCsrfToken)
        .send(intakeBody());

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.order.status).toBe('in_progress');
      expect(res.body.order.feeBreakdown.totalFee).toBeGreaterThan(0);
      expect(res.body.order.affiliateCommission).toBeGreaterThan(0);
      expect(res.body.order.paymentAmount).toBeGreaterThan(0);
      expect(res.body.order.paymentStatus).toBe('awaiting');

      const saved = await Order.findOne({ orderId: res.body.order.orderId });
      expect(saved.bagId).toBe(bag.bagId);
      expect(saved.bagToken).toBe(TOKEN);
      expect(String(saved.intake.weighedBy)).toBe(String(testOperator._id));
      expect(saved.freshAddOnsFormPlaced).toBe(true);
    });

    it('rejects without a CSRF token (403)', async () => {
      const res = await operatorAgent
        .post('/api/v1/operators/intake')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send(intakeBody());
      expect(res.status).toBe(403);
      expect(await Order.countDocuments({})).toBe(0);
    });

    it('rejects a non-operator role (403)', async () => {
      const res = await adminAgent
        .post('/api/v1/operators/intake')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-csrf-token', adminCsrfToken)
        .send(intakeBody());
      expect(res.status).toBe(403);
    });

    it('rejects unauthenticated requests (401)', async () => {
      const agent = createAgent(app);
      const csrf = await getCsrfToken(app, agent);
      const res = await agent
        .post('/api/v1/operators/intake')
        .set('x-csrf-token', csrf)
        .send(intakeBody());
      expect(res.status).toBe(401);
    });

    it('maps service errors: 409 bag_not_active', async () => {
      bag.status = 'issued';
      bag.customerId = null;
      await bag.save();
      const res = await operatorAgent
        .post('/api/v1/operators/intake')
        .set('Authorization', `Bearer ${operatorToken}`)
        .set('x-csrf-token', operatorCsrfToken)
        .send(intakeBody());
      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.errors.code).toBe('bag_not_active');
    });

    it('maps service errors: 409 order_already_open on a second intake', async () => {
      await operatorAgent
        .post('/api/v1/operators/intake')
        .set('Authorization', `Bearer ${operatorToken}`)
        .set('x-csrf-token', operatorCsrfToken)
        .send(intakeBody());
      const res = await operatorAgent
        .post('/api/v1/operators/intake')
        .set('Authorization', `Bearer ${operatorToken}`)
        .set('x-csrf-token', operatorCsrfToken)
        .send(intakeBody({ weight: 12 }));
      expect(res.status).toBe(409);
      expect(res.body.errors.code).toBe('order_already_open');
      expect(await Order.countDocuments({})).toBe(1);
    });

    it('re-intake: picked_up open order is auto-delivered, new order created (201 + reIntake)', async () => {
      const first = await operatorAgent
        .post('/api/v1/operators/intake')
        .set('Authorization', `Bearer ${operatorToken}`)
        .set('x-csrf-token', operatorCsrfToken)
        .send(intakeBody());
      await Order.updateOne({ orderId: first.body.order.orderId }, { $set: { status: 'picked_up' } });

      const res = await operatorAgent
        .post('/api/v1/operators/intake')
        .set('Authorization', `Bearer ${operatorToken}`)
        .set('x-csrf-token', operatorCsrfToken)
        .send(intakeBody({ weight: 8 }));

      expect(res.status).toBe(201);
      expect(res.body.reIntake).toBe(true);
      const prior = await Order.findOne({ orderId: first.body.order.orderId });
      expect(prior.status).toBe('delivered');
      expect(prior.proofOfDelivery.method).toBe('reintake');
      expect(await Order.countDocuments({ status: 'in_progress' })).toBe(1);
    });

    it('400 when bagToken is missing', async () => {
      const res = await operatorAgent
        .post('/api/v1/operators/intake')
        .set('Authorization', `Bearer ${operatorToken}`)
        .set('x-csrf-token', operatorCsrfToken)
        .send(intakeBody({ bagToken: undefined }));
      expect(res.status).toBe(400);
    });
  });
  ```
- [ ] Run it:
  ```bash
  npm test -- tests/integration/operatorIntake.test.js
  ```
  Expected failure: every case gets `404` (route does not exist yet — Express falls through). Confirm the 404s, not crashes.
- [ ] Add the controller method. In `server/controllers/operatorController.js`, add the require after line 10 (`const bagWorkflowService = require('../services/operatorBagWorkflowService');`):
  ```javascript
  const orderIntakeService = require('../modules/orders/orderIntakeService');
  ```
  and add the handler after the existing `exports.scanProcessed` block (which ends at line 297):
  ```javascript
  // Kiosk intake — operator JWT + CSRF. One bag = one order (spec §6.4 / §5).
  exports.intake = ControllerHelpers.asyncWrapper(async (req, res) => {
    const { bagToken, weight, addOns, freshAddOnsFormPlaced } = req.body;
    if (!bagToken) {
      return ControllerHelpers.sendError(res, 'bagToken is required', 400);
    }
    try {
      const { order, reIntake } = await orderIntakeService.createOrderFromBag({
        bagToken,
        weight,
        addOns,
        freshAddOnsFormPlaced: !!freshAddOnsFormPlaced,
        operatorId: req.user.id,
        req
      });
      ControllerHelpers.sendSuccess(res, {
        order: {
          orderId: order.orderId,
          status: order.status,
          customerId: order.customerId,
          affiliateId: order.affiliateId,
          actualWeight: order.actualWeight,
          addOns: order.addOns,
          addOnTotal: order.addOnTotal,
          feeBreakdown: order.feeBreakdown,
          actualTotal: order.actualTotal,
          paymentAmount: order.paymentAmount,
          affiliateCommission: order.affiliateCommission,
          paymentStatus: order.paymentStatus
        },
        reIntake
      }, 'Order created at intake', 201);
    } catch (err) {
      if (err.isIntakeError || err.isBagWorkflowError) {
        return ControllerHelpers.sendError(res, err.message, err.status, { code: err.code, ...err.details });
      }
      throw err;
    }
  });
  ```
- [ ] Add the route. In `server/routes/operatorRoutes.js`, in the Scanner Interface block, after line 74 (`router.post('/scan-customer', operatorController.scanCustomer);`):
  ```javascript
  router.post('/intake', operatorController.intake); // Kiosk order-at-intake (spec §5)
  ```
- [ ] Run again:
  ```bash
  npm test -- tests/integration/operatorIntake.test.js
  ```
  Expected: all 8 pass. If the CSRF case returns 201 instead of 403, the route accidentally matched a CSRF-exempt pattern — re-check `CSRF_CONFIG` in `server/config/csrf-config.js` (it should NOT list `/api/v1/operators/intake` anywhere; the default branch enforces).
- [ ] Commit:
  ```bash
  git add server/controllers/operatorController.js server/routes/operatorRoutes.js tests/integration/operatorIntake.test.js
  git commit -m "feat(operators): kiosk POST /api/v1/operators/intake creates the order at intake (JWT + CSRF + RBAC)"
  ```

## Task 7 — Re-point `operatorBagWorkflowService`: `scanCustomer`/`weighBags` delegate; delete `parseCustomerQr` and friends

Spec §6.4 service re-points (quoted): *"`parseCustomerQr` deleted; `scanCustomer`/`weighBags` delegate to `orderIntakeService.createOrderFromBag`"*. Move-then-delete house rule: the exported names stay alive one sprint as thin shims with the NEW argument shapes (their production caller — the kiosk client — switches to `/intake` + `/bags/resolve` in Task 10, so no caller still uses the old shapes). The local `generatePaymentURLs` (the ad-hoc link builder, `operatorBagWorkflowService.js:30-54`), `parseCustomerQr` (`:56-72`), `findCustomerFlexible` (`:74-82`), and `deriveScanAction` (`:84-89`) are deleted — `paymentLinkService.generatePaymentLinks` is the canonical generator (spec §6.4 step 6) and the customer-ID parsing has no place in the token flow. `scanBag`, `receiveOrder`, and `markBagProcessed` are stranded legacy (they reference fields PR 4 removed); PR 9's kiosk re-point deletes them — leave them with a deprecation comment, do not fix them.

**Files:**
- Modify: `server/services/operatorBagWorkflowService.js`
- Modify: `server/controllers/operatorController.js` (`scanCustomer` at lines 166–186, `weighBags` at lines 231–247)
- Create: `tests/unit/operatorBagWorkflowDelegates.test.js`

**Steps:**

- [ ] Write the failing test `tests/unit/operatorBagWorkflowDelegates.test.js`:
  ```javascript
  // scanCustomer/weighBags are now thin delegates over the bag-token flow
  // (spec §6.4 service re-points). parseCustomerQr & co. are gone.

  jest.mock('../../server/modules/orders/orderIntakeService', () => ({
    createOrderFromBag: jest.fn().mockResolvedValue({ order: { orderId: 'ORD-x' }, reIntake: false }),
    IntakeError: class IntakeError extends Error {}
  }));
  jest.mock('../../server/modules/bags/bagService', () => ({
    resolveByToken: jest.fn().mockResolvedValue({
      bag: { bagId: 'BAG-1', status: 'active', customerId: 'CUST-1', affiliateId: 'AFF-1' },
      outcome: 'claimed'
    })
  }));

  const orderIntakeService = require('../../server/modules/orders/orderIntakeService');
  const bagService = require('../../server/modules/bags/bagService');
  const workflow = require('../../server/services/operatorBagWorkflowService');

  describe('operatorBagWorkflowService delegates', () => {
    beforeEach(() => jest.clearAllMocks());

    it('no longer exports the customer-QR helpers', () => {
      expect(workflow.parseCustomerQr).toBeUndefined();
      expect(workflow.generatePaymentURLs).toBeUndefined();
    });

    it('weighBags delegates to orderIntakeService.createOrderFromBag with the token shape', async () => {
      const args = {
        bagToken: 'c'.repeat(32), weight: 10,
        addOns: { premiumDetergent: true }, freshAddOnsFormPlaced: true,
        operatorId: 'op-1', req: undefined
      };
      const result = await workflow.weighBags(args);
      expect(orderIntakeService.createOrderFromBag).toHaveBeenCalledWith(args);
      expect(result.order.orderId).toBe('ORD-x');
    });

    it('scanCustomer delegates to bagService.resolveByToken', async () => {
      const result = await workflow.scanCustomer({ bagToken: 'c'.repeat(32), operatorId: 'op-1' });
      expect(bagService.resolveByToken).toHaveBeenCalledWith('c'.repeat(32));
      expect(result.outcome).toBe('claimed');
      expect(result.bag.bagId).toBe('BAG-1');
    });

    it('scanCustomer throws bag_not_found for an unknown token', async () => {
      bagService.resolveByToken.mockResolvedValueOnce(null);
      await expect(workflow.scanCustomer({ bagToken: 'd'.repeat(32), operatorId: 'op-1' }))
        .rejects.toMatchObject({ isBagWorkflowError: true, code: 'bag_not_found', status: 404 });
    });
  });
  ```
- [ ] Run it:
  ```bash
  npm test -- tests/unit/operatorBagWorkflowDelegates.test.js
  ```
  Expected failures: `workflow.parseCustomerQr` is defined (exported today at `operatorBagWorkflowService.js:527-536`), `weighBags` ignores `bagToken` and queries by `orderId` (mock not called), `scanCustomer` queries Customer by `customerId`.
- [ ] Implement in `server/services/operatorBagWorkflowService.js`:
  1. **Delete** these four functions and the export entries for the first two: `generatePaymentURLs` (lines 28–54 incl. its comment), `parseCustomerQr` (lines 56–72), `findCustomerFlexible` (lines 74–82), `deriveScanAction` (lines 84–89). Also delete the now-unused `const QRCode = require('qrcode');` (line 15).
  2. **Replace the whole `scanCustomer` function** (lines 91–195) with:
     ```javascript
     // DEPRECATED kiosk shim (move-then-delete; PR 9 removes it).
     // Scan context now comes from GET /api/v1/bags/resolve/:token — this
     // shim keeps the export alive one sprint for stragglers.
     async function scanCustomer({ bagToken, operatorId, req }) {
       const resolved = await bagService.resolveByToken(bagToken);
       if (!resolved || !resolved.bag) {
         throw new BagWorkflowError('bag_not_found', 'Bag not found', 404, {
           message: 'Bag not recognized'
         });
       }
       await logAuditEvent(AuditEvents.SENSITIVE_DATA_ACCESS, {
         operatorId,
         bagId: resolved.bag.bagId,
         action: 'bag_scanned',
         outcome: resolved.outcome
       }, req);
       return {
         outcome: resolved.outcome,
         bag: {
           bagId: resolved.bag.bagId,
           status: resolved.bag.status,
           customerId: resolved.bag.customerId,
           affiliateId: resolved.bag.affiliateId
         }
       };
     }
     ```
  3. **Replace the whole `weighBags` function** (lines 268–354) with:
     ```javascript
     // DEPRECATED kiosk shim (move-then-delete; PR 9 removes it).
     // Order birth lives in orderIntakeService.createOrderFromBag.
     async function weighBags({ bagToken, weight, addOns, freshAddOnsFormPlaced, operatorId, req }) {
       return orderIntakeService.createOrderFromBag({
         bagToken, weight, addOns, freshAddOnsFormPlaced, operatorId, req
       });
     }
     ```
  4. Add the requires at the top (after `const pickupService = require('./operatorPickupService');` at line 16):
     ```javascript
     const bagService = require('../modules/bags/bagService');
     const orderIntakeService = require('../modules/orders/orderIntakeService');
     ```
  5. Update `module.exports` (lines 527–536) to:
     ```javascript
     module.exports = {
       scanCustomer,
       scanBag,        // LEGACY — stranded, deleted in PR 9
       receiveOrder,   // LEGACY — stranded, deleted in PR 9
       weighBags,
       markBagProcessed, // LEGACY — stranded, deleted in PR 9
       scanProcessed,
       BagWorkflowError
     };
     ```
- [ ] Update the controller pass-throughs in `server/controllers/operatorController.js`:
  - In `exports.scanCustomer` (line 166), replace the service call args:
    ```javascript
    const result = await bagWorkflowService.scanCustomer({
      customerId: req.body.customerId,
      bagId: req.body.bagId,
      operatorId: req.user.id,
      req
    });
    res.json({ success: true, currentOrder: true, ...result });
    ```
    with:
    ```javascript
    const result = await bagWorkflowService.scanCustomer({
      bagToken: req.body.bagToken || req.body.customerId, // tolerate old field name one sprint
      operatorId: req.user.id,
      req
    });
    res.json({ success: true, ...result });
    ```
  - In `exports.weighBags` (line 231), replace:
    ```javascript
    const { order, orderProgress } = await bagWorkflowService.weighBags({
      orderId: req.body.orderId,
      bags: req.body.bags,
      operatorId: req.user.id,
      req
    });
    res.json({ success: true, order, orderProgress, message: 'Bags weighed successfully' });
    ```
    with:
    ```javascript
    const { order, reIntake } = await bagWorkflowService.weighBags({
      bagToken: req.body.bagToken,
      weight: req.body.weight,
      addOns: req.body.addOns,
      freshAddOnsFormPlaced: !!req.body.freshAddOnsFormPlaced,
      operatorId: req.user.id,
      req
    });
    res.json({ success: true, order, reIntake, message: 'Order created at intake' });
    ```
    and extend its `catch` to also map intake errors — replace `if (err.isBagWorkflowError) {` with `if (err.isBagWorkflowError || err.isIntakeError) {`.
- [ ] Run the new test + the intake suites:
  ```bash
  npm test -- tests/unit/operatorBagWorkflowDelegates.test.js tests/unit/orderIntakeService.test.js tests/integration/operatorIntake.test.js
  ```
  Expected: green.
- [ ] Grep for dangling references to the deleted helpers:
  ```bash
  grep -rn "parseCustomerQr\|findCustomerFlexible\|generatePaymentURLs\|deriveScanAction" server/ tests/ --include="*.js" | grep -v testRoutes.js
  ```
  Expected: no hits (the `testRoutes.js` copy of `generatePaymentURLs` is its own local function, untouched). Fix or delete any test still importing them (see Task 11 for the systematic sweep).
- [ ] Commit:
  ```bash
  git add server/services/operatorBagWorkflowService.js server/controllers/operatorController.js tests/unit/operatorBagWorkflowDelegates.test.js
  git commit -m "refactor(operators): scanCustomer/weighBags delegate to bag-token flow; delete parseCustomerQr/generatePaymentURLs"
  ```

---

## Task 8 — Re-point `scanProcessed`: resolve by bag token, `applyTransition`, run the ready gate, stop direct notifications

PR 7 scope for `scanProcessed` (PR 9 later replaces it with the `orderAdvanceService` delegate): resolve by bag token; `in_progress → processed` via `applyTransition`; call `maybeReadyForPickup` (the gate owns `ready_for_pickup`, `heldAtStore`, and the affiliate notify); **no longer** sends `pickupService.sendPaymentReminder` (the PR 8 job owns reminders) and **no longer** emails the affiliate directly (current code does both — `operatorBagWorkflowService.js:470-491`).

**Files:**
- Modify: `server/services/operatorBagWorkflowService.js` (replace `scanProcessed`, lines 407–525; remove the `pickupService` require at line 16 if `scanProcessed` was its last user in this file — check: `grep -n "pickupService" server/services/operatorBagWorkflowService.js`)
- Modify: `server/controllers/operatorController.js` (`exports.scanProcessed`, lines 272–297: pass the token)
- Create: `tests/unit/operatorScanProcessed.test.js`

**Steps:**

- [ ] Write the failing test `tests/unit/operatorScanProcessed.test.js` (real models + real PR 4 state machine/gate; email service mocked so the gate's notify is observable):
  ```javascript
  // scanProcessed re-point (PR 7 interim): token-resolved, applyTransition,
  // gate-driven. No direct reminders, no direct affiliate email.

  jest.mock('../../server/utils/emailService', () => ({
    sendV2PaymentRequest: jest.fn().mockResolvedValue(true),
    sendCustomerDeliveredEmail: jest.fn().mockResolvedValue(true),
    sendAffiliateCommissionEmail: jest.fn().mockResolvedValue(true),
    sendOrderReadyNotification: jest.fn().mockResolvedValue(true)
  }));
  jest.mock('../../server/services/operatorPickupService', () => ({
    sendPaymentReminder: jest.fn().mockResolvedValue(true),
    completePickup: jest.fn(),
    markOrderReady: jest.fn(),
    confirmPickup: jest.fn()
  }));

  const mongoose = require('mongoose');
  const emailService = require('../../server/utils/emailService');
  const pickupService = require('../../server/services/operatorPickupService');
  const Order = require('../../server/models/Order');
  const Customer = require('../../server/models/Customer');
  const Affiliate = require('../../server/models/Affiliate');
  const Bag = require('../../server/modules/bags/Bag');
  const { createOrderFromBag } = require('../../server/modules/orders/orderIntakeService');
  const workflow = require('../../server/services/operatorBagWorkflowService');
  const { ensureTestAffiliate, ensureTestCustomer } = require('../helpers/v2TestHelpers');

  describe('operatorBagWorkflowService.scanProcessed (token re-point)', () => {
    let affiliate, customer, bag, operatorId, order;
    const TOKEN = 'dddddddddddddddddddddddddddddddd';

    beforeEach(async () => {
      await Promise.all([
        Order.deleteMany({}), Customer.deleteMany({}),
        Affiliate.deleteMany({}), Bag.deleteMany({})
      ]);
      jest.clearAllMocks();

      affiliate = await ensureTestAffiliate();
      customer = await ensureTestCustomer({ affiliateId: affiliate.affiliateId });
      operatorId = new mongoose.Types.ObjectId();
      bag = await Bag.create({
        token: TOKEN, tokenHash: Bag.hashToken(TOKEN),
        affiliateId: affiliate.affiliateId, customerId: customer.customerId,
        status: 'active', batchId: 'BATCH-sp'
      });
      ({ order } = await createOrderFromBag({
        bagToken: TOKEN, weight: 10, addOns: {}, freshAddOnsFormPlaced: false, operatorId
      }));
      jest.clearAllMocks(); // discard the intake-time email calls
    });

    it('unpaid: in_progress -> processed, HELD at store, no reminder, no affiliate email', async () => {
      const result = await workflow.scanProcessed({ bagToken: TOKEN, operatorId });

      const saved = await Order.findOne({ orderId: order.orderId });
      expect(saved.status).toBe('processed');
      expect(saved.processedAt).toBeInstanceOf(Date);
      expect(saved.heldAtStore).toBe(true);               // gate's held branch
      expect(saved.readyForPickupAt).toBeUndefined();
      expect(saved.bags[0].status).toBe('processed');
      expect(String(saved.bags[0].scannedBy.processed)).toBe(String(operatorId));
      expect(String(saved.intake.processedBy)).toBe(String(operatorId));

      // The workflow service no longer notifies anyone directly.
      expect(pickupService.sendPaymentReminder).not.toHaveBeenCalled();
      expect(emailService.sendOrderReadyNotification).not.toHaveBeenCalled();
      expect(result.order.status).toBe('processed');
      expect(result.order.heldAtStore).toBe(true);
    });

    it('paid: in_progress -> processed -> gate promotes to ready_for_pickup + affiliate notified BY THE GATE', async () => {
      await Order.updateOne({ orderId: order.orderId }, { $set: { paymentStatus: 'verified' } });

      const result = await workflow.scanProcessed({ bagToken: TOKEN, operatorId });

      const saved = await Order.findOne({ orderId: order.orderId });
      expect(saved.status).toBe('ready_for_pickup');
      expect(saved.readyForPickupAt).toBeInstanceOf(Date); // sole writer = applyReadyGate
      expect(saved.heldAtStore).toBe(false);
      expect(emailService.sendOrderReadyNotification).toHaveBeenCalledTimes(1);
      expect(pickupService.sendPaymentReminder).not.toHaveBeenCalled();
      expect(result.order.status).toBe('ready_for_pickup');
    });

    it('duplicate scan on an already-processed order returns a warning, no state change', async () => {
      await workflow.scanProcessed({ bagToken: TOKEN, operatorId });
      jest.clearAllMocks();

      const result = await workflow.scanProcessed({ bagToken: TOKEN, operatorId });
      expect(result.warning).toBe('duplicate_scan');
      expect(emailService.sendOrderReadyNotification).not.toHaveBeenCalled();
      const saved = await Order.findOne({ orderId: order.orderId });
      expect(saved.status).toBe('processed');
    });

    it('unknown token -> 404 bag_not_found', async () => {
      await expect(workflow.scanProcessed({ bagToken: 'e'.repeat(32), operatorId }))
        .rejects.toMatchObject({ isBagWorkflowError: true, code: 'bag_not_found', status: 404 });
    });

    it('no open in_progress/processed order -> 404 no_active_order', async () => {
      await Order.updateOne({ orderId: order.orderId }, { $set: { status: 'delivered' } });
      await expect(workflow.scanProcessed({ bagToken: TOKEN, operatorId }))
        .rejects.toMatchObject({ isBagWorkflowError: true, code: 'no_active_order', status: 404 });
    });
  });
  ```
- [ ] Run it:
  ```bash
  npm test -- tests/unit/operatorScanProcessed.test.js
  ```
  Expected failure: current `scanProcessed` throws `invalid_qr` ('Expected format: customerId#bagId') because the call passes `bagToken`, not `qrCode` — every case fails on that. Confirm.
- [ ] Replace the whole `scanProcessed` function in `server/services/operatorBagWorkflowService.js` (current lines 407–525) with:
  ```javascript
  // Stage-2 scan: WDF done. Token-resolved; the ready gate owns promotion,
  // held-at-store, and the affiliate notification (spec §6.4/§6.5).
  // PR 9 replaces this with a thin delegate to orderAdvanceService.advance.
  async function scanProcessed({ bagToken, operatorId, req }) {
    const resolved = await bagService.resolveByToken(bagToken);
    if (!resolved || !resolved.bag) {
      throw new BagWorkflowError('bag_not_found', 'Bag not found', 404, {
        message: 'Bag not recognized'
      });
    }
    const bag = resolved.bag;

    const order = await Order.findOne({
      bagId: bag.bagId,
      status: { $in: ['in_progress', 'processed'] }
    }).sort({ createdAt: -1 });

    if (!order) {
      throw new BagWorkflowError('no_active_order', 'No active order for this bag', 404, {
        message: 'This bag has no order awaiting processing'
      });
    }

    if (order.status === 'processed') {
      return {
        warning: 'duplicate_scan',
        message: 'This bag has already been processed.',
        order: {
          orderId: order.orderId,
          status: order.status,
          heldAtStore: order.heldAtStore
        }
      };
    }

    const now = new Date();
    if (order.bags && order.bags[0]) {
      order.bags[0].status = 'processed';
      order.bags[0].scannedAt.processed = now;
      order.bags[0].scannedBy.processed = operatorId;
    }
    if (order.intake) {
      order.intake.processedAt = now;
      order.intake.processedBy = operatorId;
    }
    applyTransition(order, 'processed'); // validates in_progress -> processed; pre-save stamps processedAt
    await order.save();

    // Gate owns ready_for_pickup / heldAtStore / affiliate notify. It saves internally.
    await maybeReadyForPickup(order, { trigger: 'processed_scan' });

    await logAuditEvent(AuditEvents.ORDER_STATUS_CHANGED, {
      operatorId,
      orderId: order.orderId,
      bagId: bag.bagId,
      action: 'bag_processed',
      newStatus: order.status,
      heldAtStore: order.heldAtStore
    }, req);

    return {
      order: {
        orderId: order.orderId,
        status: order.status,
        heldAtStore: order.heldAtStore,
        readyForPickupAt: order.readyForPickupAt
      }
    };
  }
  ```
  Add the state-machine require at the top of the file, with the other Task 7 requires:
  ```javascript
  const { applyTransition, maybeReadyForPickup } = require('../modules/orders/orderStateMachine');
  ```
  Then check whether `pickupService` is still referenced in this file (`grep -n "pickupService" server/services/operatorBagWorkflowService.js`) — if `scanProcessed` was its last user, delete `const pickupService = require('./operatorPickupService');` (line 16). Same check for the `Customer`/`Affiliate`/`emailService` requires at lines 10–12; delete any now unused (ESLint `no-unused-vars` will also flag them).
- [ ] Update `exports.scanProcessed` in `server/controllers/operatorController.js` (lines 272–297). Replace the service call:
  ```javascript
  const result = await bagWorkflowService.scanProcessed({
    qrCode: req.body.qrCode,
    operatorId: req.user.id,
    req
  });
  ```
  with:
  ```javascript
  const result = await bagWorkflowService.scanProcessed({
    bagToken: req.body.bagToken || req.body.qrCode, // tolerate old field name one sprint
    operatorId: req.user.id,
    req
  });
  ```
  and replace the success-shape branches:
  ```javascript
  if (result.action === 'show_pickup_modal') {
    return res.json({ success: true, ...result, message: 'All bags processed - ready for pickup' });
  }
  res.json({ success: true, ...result, message: `Bag ${result.bag.bagNumber} marked as processed` });
  ```
  with:
  ```javascript
  res.json({ success: true, ...result, message: 'Bag marked as processed' });
  ```
  (keep the `if (result.warning)` early-return above it unchanged).
- [ ] Run:
  ```bash
  npm test -- tests/unit/operatorScanProcessed.test.js tests/unit/operatorBagWorkflowDelegates.test.js tests/integration/operatorIntake.test.js
  ```
  Expected: green. If the paid case ends at `processed` with `readyForPickupAt` unset, the gate didn't run — verify `maybeReadyForPickup` delegates to `applyReadyGate` (Task 0 check) and that `paymentStatus` really was `verified` before the scan.
- [ ] Lint the touched server files:
  ```bash
  npx eslint server/services/operatorBagWorkflowService.js server/controllers/operatorController.js server/modules/orders/orderIntakeService.js
  ```
  Expected: clean (no `console.*`, no unused vars).
- [ ] Commit:
  ```bash
  git add server/services/operatorBagWorkflowService.js server/controllers/operatorController.js tests/unit/operatorScanProcessed.test.js
  git commit -m "refactor(operators): scanProcessed resolves by bag token, transitions via state machine, ready gate owns promotion/notify"
  ```

## Task 8b — Populate open-order context in `GET /api/v1/bags/resolve/:token` (`status`/`awaitingDelivery`/`nextAction`)

PR 6's `bagController.resolveBag` deliberately hard-codes `order: null` on the claimed branch. Task 10's kiosk branches on `resolveData.order.nextAction` — without this task, every claimed-bag scan with an open order would default to `'intake'`, show the intake modal, and 409 (`order_already_open`), leaving the stage-2 `processed` scan and the re-intake confirm as dead UI until PR 9. The context only needs `Order.bagId` (PR 4 schema), so it ships HERE. PR 9 Task 11 reuses the helper created below for the customer claim resolver (`bagClaimService`).

**Files:**
- Create: `server/modules/orders/openOrderContext.js`
- Create: `tests/integration/bagResolveContext.test.js` (PR 9 Task 11 extends/replaces it to also cover `/api/v1/customers/claim/:token`)
- Modify: `server/modules/bags/bagService.js` (`resolveByToken` claimed branch)
- Modify: `server/modules/bags/bagController.js` (`resolveBag` claimed branch passes the context through)

**Steps:**

- [ ] Write the failing integration test `tests/integration/bagResolveContext.test.js`:
  ```javascript
  jest.mock('../../server/utils/emailService');

  const request = require('supertest');
  const app = require('../../server');
  const Order = require('../../server/models/Order');
  const Bag = require('../../server/modules/bags/Bag');
  const { ensureTestAffiliate, ensureTestCustomer } = require('../helpers/v2TestHelpers');

  jest.setTimeout(90000);

  describe('GET /api/v1/bags/resolve/:token exposes open-order context (PR 7)', () => {
    const TOKEN = 'cccccccccccccccccccccccccccccccc'; // 32 hex chars
    let affiliate, customer, bag;

    beforeEach(async () => {
      await Promise.all([Order.deleteMany({}), Bag.deleteMany({})]);
      affiliate = await ensureTestAffiliate();
      customer = await ensureTestCustomer({ affiliateId: affiliate.affiliateId });
      bag = await Bag.create({
        token: TOKEN, tokenHash: Bag.hashToken(TOKEN),
        affiliateId: affiliate.affiliateId, customerId: customer.customerId,
        status: 'active', batchId: 'BATCH-ctx', claimedAt: new Date()
      });
    });

    function createOrder(status) {
      return Order.create({
        customerId: customer.customerId,
        affiliateId: affiliate.affiliateId,
        bagId: bag.bagId,
        bagToken: bag.token,
        status,
        paymentStatus: 'verified',
        actualWeight: 15,
        feeBreakdown: { numberOfBags: 1, minimumFee: 25, perBagFee: 5, totalFee: 25, minimumApplied: true }
      });
    }

    test.each([
      ['in_progress', false, 'advance'],
      ['processed', false, 'advance'],
      ['ready_for_pickup', false, 'advance'],
      ['picked_up', true, 'deliver-or-reintake']
    ])('claimed bag with a %s order -> awaitingDelivery=%s, nextAction=%s', async (status, awaiting, nextAction) => {
      await createOrder(status);
      const res = await request(app).get(`/api/v1/bags/resolve/${TOKEN}`);
      expect(res.status).toBe(200);
      expect(res.body.order.status).toBe(status);
      expect(res.body.order.awaitingDelivery).toBe(awaiting);
      expect(res.body.order.nextAction).toBe(nextAction);
      expect(res.body.nextAction).toBe(nextAction);
    });

    test('claimed bag with NO open order -> nextAction intake, no order object', async () => {
      const res = await request(app).get(`/api/v1/bags/resolve/${TOKEN}`);
      expect(res.status).toBe(200);
      expect(res.body.nextAction).toBe('intake');
      expect(res.body.order).toBeFalsy();
    });

    test('delivered orders are not "open" -> nextAction intake', async () => {
      await createOrder('delivered');
      const res = await request(app).get(`/api/v1/bags/resolve/${TOKEN}`);
      expect(res.body.nextAction).toBe('intake');
      expect(res.body.order).toBeFalsy();
    });

    test('no customer PII leaks through the resolver', async () => {
      await createOrder('picked_up');
      const res = await request(app).get(`/api/v1/bags/resolve/${TOKEN}`);
      const body = JSON.stringify(res.body);
      expect(body).not.toContain(customer.email);
      expect(body).not.toContain(customer.lastName);
    });
  });
  ```
- [ ] Run it:
  ```bash
  npm test -- tests/integration/bagResolveContext.test.js
  ```
  Expected failure: `res.body.order` is `null` on every claimed case (PR 6 hard-codes it) and `res.body.nextAction` is `undefined`.
- [ ] Create `server/modules/orders/openOrderContext.js`:
  ```javascript
  // Order context for the bag resolvers (spec §5 resolve row, §6.3/§6.6 d).
  // Drives the kiosk + claim-page branch: claim | intake | advance |
  // deliver-or-reintake. Deliberately PII-free — status words only.

  const Order = require('../../models/Order');

  const OPEN_STATUSES = ['in_progress', 'processed', 'ready_for_pickup', 'picked_up'];

  function nextActionFor(order) {
    if (!order) return 'intake';
    return order.status === 'picked_up' ? 'deliver-or-reintake' : 'advance';
  }

  /**
   * @param {string} bagId - the BAG-uuid join key (Order.bagId == Bag.bagId)
   * @returns {Promise<{order: {status, awaitingDelivery, nextAction}|null, nextAction: string}>}
   */
  async function getOpenOrderContext(bagId) {
    const order = await Order.findOne({ bagId, status: { $in: OPEN_STATUSES } })
      .select('status');
    if (!order) return { order: null, nextAction: 'intake' };
    const ctx = {
      status: order.status,
      awaitingDelivery: order.status === 'picked_up',
      nextAction: nextActionFor(order)
    };
    return { order: ctx, nextAction: ctx.nextAction };
  }

  module.exports = { getOpenOrderContext, nextActionFor, OPEN_STATUSES };
  ```
- [ ] Wire `server/modules/bags/bagService.js` — in `resolveByToken`'s claimed branch (where it builds the `{ outcome: 'claimed', customerId }` result), attach the context (hoist the require to the top imports):
  ```javascript
  const { getOpenOrderContext } = require('../orders/openOrderContext');
  // ... claimed branch:
  const ctx = await getOpenOrderContext(bag.bagId);
  return {
    bag,
    outcome: 'claimed',
    customerId: bag.customerId,
    nextAction: ctx.nextAction,
    ...(ctx.order ? { order: ctx.order } : {})
  };
  ```
- [ ] Wire `server/modules/bags/bagController.js` — `resolveBag`'s claimed return changes from
  ```javascript
  return sendSuccess(res, { outcome, customerId: bag.customerId, order: null });
  ```
  to
  ```javascript
  return sendSuccess(res, {
    outcome,
    customerId: bag.customerId,
    nextAction: resolved.nextAction,
    order: resolved.order || null
  });
  ```
  (Update the controller's doc comment: the `order` slot is populated HERE for open orders; the customer claim resolver gains the same context in PR 9.)
- [ ] Run again — expect PASS — then the PR 6 bag suites for no-regression:
  ```bash
  npm test -- tests/integration/bagResolveContext.test.js
  npm test -- $(ls tests/integration | grep -i "bag" | sed 's|^|tests/integration/|' | tr '\n' ' ')
  ```
- [ ] Commit:
  ```bash
  git add server/modules/orders/openOrderContext.js server/modules/bags/bagService.js server/modules/bags/bagController.js tests/integration/bagResolveContext.test.js
  git commit -m "feat(bags): resolve endpoint returns open-order context (status/awaitingDelivery/nextAction) for the kiosk branch"
  ```

## Task 9 — Frontend bag-token parser (`extractBagToken`) + unit tests

The kiosk scans either the raw 32-hex token (hand-typed / re-encoded labels) or the full printed claim URL `https://wavemax.promo/embed-app-v2.html?route=/claim&bag=<token>` (spec §6.1). Small standalone file with the repo's dual-export pattern (see `public/assets/js/v2-payment-modal.js:850` — `if (typeof module !== 'undefined' && module.exports)`), so Jest (testEnvironment `node`) can require it directly.

**Files:**
- Create: `public/assets/js/bag-token-parser.js`
- Create: `tests/unit/bagTokenParser.test.js`

**Steps:**

- [ ] Write the failing test `tests/unit/bagTokenParser.test.js`:
  ```javascript
  // extractBagToken — kiosk scan-input parser (raw 32-hex or claim URL).

  const { extractBagToken } = require('../../public/assets/js/bag-token-parser');

  describe('extractBagToken', () => {
    const TOKEN = '0123456789abcdef0123456789abcdef';

    it('accepts a raw lowercase 32-hex token', () => {
      expect(extractBagToken(TOKEN)).toBe(TOKEN);
    });

    it('lowercases an uppercased scan of the token', () => {
      expect(extractBagToken(TOKEN.toUpperCase())).toBe(TOKEN);
    });

    it('trims scanner whitespace/newlines', () => {
      expect(extractBagToken(`  ${TOKEN}\n`)).toBe(TOKEN);
    });

    it('extracts the token from the full printed claim URL', () => {
      expect(extractBagToken(
        `https://wavemax.promo/embed-app-v2.html?route=/claim&bag=${TOKEN}`
      )).toBe(TOKEN);
    });

    it('extracts when bag is the first query param', () => {
      expect(extractBagToken(`https://wavemax.promo/claim?bag=${TOKEN}`)).toBe(TOKEN);
    });

    it('extracts when more params follow the bag param', () => {
      expect(extractBagToken(
        `https://wavemax.promo/embed-app-v2.html?route=/claim&bag=${TOKEN}&lang=es`
      )).toBe(TOKEN);
    });

    it('lowercases a token inside a URL', () => {
      expect(extractBagToken(`https://x.test/?bag=${TOKEN.toUpperCase()}`)).toBe(TOKEN);
    });

    it.each([
      ['legacy customer#bag QR', 'CUST-123abc#BAG001'],
      ['bare customer id', 'CUST-7f3a2b1c-aaaa-bbbb-cccc-1234567890ab'],
      ['31 hex chars', '0123456789abcdef0123456789abcde'],
      ['33 hex chars', '0123456789abcdef0123456789abcdef0'],
      ['non-hex 32 chars', 'zzzz456789abcdef0123456789abcdef'],
      ['URL without bag param', 'https://wavemax.promo/embed-app-v2.html?route=/claim'],
      ['URL with malformed bag value', 'https://x.test/?bag=nothex'],
      ['empty string', ''],
      ['null', null],
      ['number', 42]
    ])('returns null for %s', (_label, input) => {
      expect(extractBagToken(input)).toBeNull();
    });
  });
  ```
- [ ] Run it:
  ```bash
  npm test -- tests/unit/bagTokenParser.test.js
  ```
  Expected failure: `Cannot find module '../../public/assets/js/bag-token-parser'`.
- [ ] Create `public/assets/js/bag-token-parser.js`:
  ```javascript
  // Bag-token extraction for the operator kiosk scanner.
  // Accepts either the raw 32-hex Bag.token or the full claim URL printed
  // in the bag QR (…?route=/claim&bag=<token>). Returns the lowercase
  // token, or null when the scan is not a bag (spec §4.1 token canon).
  // Dual-export: window global for the kiosk page, CommonJS for Jest.
  (function (root) {
    'use strict';

    var TOKEN_RE = /^[a-f0-9]{32}$/;
    var URL_BAG_RE = /[?&]bag=([A-Fa-f0-9]{32})(?:[&#]|$)/;

    function extractBagToken(scanData) {
      if (!scanData || typeof scanData !== 'string') {
        return null;
      }
      var trimmed = scanData.trim();

      var lowered = trimmed.toLowerCase();
      if (TOKEN_RE.test(lowered)) {
        return lowered;
      }

      var match = trimmed.match(URL_BAG_RE);
      if (match) {
        return match[1].toLowerCase();
      }

      return null;
    }

    if (typeof module !== 'undefined' && module.exports) {
      module.exports = { extractBagToken: extractBagToken };
    }
    if (root) {
      root.BagTokenParser = { extractBagToken: extractBagToken };
    }
  })(typeof window !== 'undefined' ? window : null);
  ```
- [ ] Run again:
  ```bash
  npm test -- tests/unit/bagTokenParser.test.js
  ```
  Expected: all pass.
- [ ] Commit:
  ```bash
  git add public/assets/js/bag-token-parser.js tests/unit/bagTokenParser.test.js
  git commit -m "feat(kiosk): bag-token parser — raw 32-hex or printed claim URL"
  ```

---

## Task 10 — Kiosk frontend: token scan flow + intake modal + i18n (en/es/pt/de in the SAME commit)

Rework `public/assets/js/operator-scan-init.js`: delete the `customerId#bagId` parsing (current lines 895–929 inside `processScan`), branch on `GET /api/v1/bags/resolve/:token` (PR 6 endpoint, open-order context populated by Task 8b of THIS PR; `nextAction ∈ intake|advance|deliver-or-reintake` on claimed bags), and submit the new intake modal (weight + add-on checkboxes the operator ENTERS from the paper form + a required fresh-form-placed ack) to `POST /api/v1/operators/intake`. Strict CSP: no inline handlers/styles — the file already uses `addEventListener` after `innerHTML` injection; keep that pattern. Server-sourced strings (affiliate name) are injected via `textContent`, never interpolated into `innerHTML`. i18n via `window.i18n.t(key)` (`public/assets/js/i18n.js:120`; the page loads `i18n.js` — `public/operator-scan-embed.html:104`).

**Files:**
- Modify: `public/assets/js/operator-scan-init.js`
- Modify: `public/operator-scan-embed.html` (add the parser script before `operator-scan-init.js` at line 114)
- Modify: `public/assets/js/embed-app-v2.js` (`pageScripts['/operator-scan']` array at line 593 — add `/assets/js/bag-token-parser.js` before `/assets/js/operator-scan-init.js`; `EMBED_PAGES` already maps `/operator-scan` at line 49, no change there)
- Modify: `public/locales/en/common.json`, `public/locales/es/common.json`, `public/locales/pt/common.json`, `public/locales/de/common.json` (add `operator.intake` — the `operator` object currently holds only `login`: en line 798, es 762, pt 769, de 769)
- Create: `tests/unit/operatorIntakeI18n.test.js`

**Steps:**

- [ ] Write the failing i18n-parity test `tests/unit/operatorIntakeI18n.test.js`:
  ```javascript
  // operator.intake.* must exist in all four locales (spec §10).
  const fs = require('fs');
  const path = require('path');

  const REQUIRED_KEYS = [
    'operator.intake.title',
    'operator.intake.weightLabel',
    'operator.intake.weightPlaceholder',
    'operator.intake.addOnsHeading',
    'operator.intake.addOns.premiumDetergent',
    'operator.intake.addOns.fabricSoftener',
    'operator.intake.addOns.stainRemover',
    'operator.intake.freshFormAck',
    'operator.intake.submit',
    'operator.intake.cancel',
    'operator.intake.created',
    'operator.intake.processedScan',
    'operator.intake.alreadyProcessed',
    'operator.intake.reintakePrompt',
    'operator.intake.reintakeConfirm',
    'operator.intake.error.bagNotActive',
    'operator.intake.error.orderAlreadyOpen',
    'operator.intake.error.bagNotFound'
  ];

  function dig(obj, dotted) {
    return dotted.split('.').reduce((o, k) => (o ? o[k] : undefined), obj);
  }

  describe.each(['en', 'es', 'pt', 'de'])('locale %s', (lang) => {
    const file = path.join(__dirname, `../../public/locales/${lang}/common.json`);
    const json = JSON.parse(fs.readFileSync(file, 'utf8'));

    it.each(REQUIRED_KEYS)('has %s', (key) => {
      const value = dig(json, key);
      expect(typeof value).toBe('string');
      expect(value.length).toBeGreaterThan(0);
    });
  });
  ```
- [ ] Run it:
  ```bash
  npm test -- tests/unit/operatorIntakeI18n.test.js
  ```
  Expected failure: every key undefined in every locale (72 failing cases).
- [ ] Add the `intake` object to each locale, as a sibling of `login` **inside the existing `"operator"` object** (after `login`'s closing `}`, add a comma then the block). English (`public/locales/en/common.json`, `operator` at line 798):
  ```json
  "intake": {
    "title": "Bag Intake",
    "weightLabel": "Weight (lbs)",
    "weightPlaceholder": "Enter weight in pounds",
    "addOnsHeading": "Add-ons (from the paper form)",
    "addOns": {
      "premiumDetergent": "Premium Detergent",
      "fabricSoftener": "Fabric Softener",
      "stainRemover": "Stain Remover"
    },
    "freshFormAck": "A fresh add-ons form has been placed in the bag pocket",
    "submit": "Create Order",
    "cancel": "Cancel",
    "created": "Order created — payment request sent",
    "processedScan": "Bag marked processed",
    "alreadyProcessed": "This bag has already been processed",
    "reintakePrompt": "This bag's last order is still out for delivery. Mark it delivered and start a new order?",
    "reintakeConfirm": "Mark delivered & start new order",
    "error": {
      "bagNotActive": "This bag has not been claimed by a customer yet",
      "orderAlreadyOpen": "An order is already open for this bag",
      "bagNotFound": "Bag not recognized"
    }
  }
  ```
  Spanish (`public/locales/es/common.json`, `operator` at line 762):
  ```json
  "intake": {
    "title": "Recepción de Bolsa",
    "weightLabel": "Peso (lbs)",
    "weightPlaceholder": "Ingrese el peso en libras",
    "addOnsHeading": "Servicios adicionales (del formulario en papel)",
    "addOns": {
      "premiumDetergent": "Detergente Premium",
      "fabricSoftener": "Suavizante de Telas",
      "stainRemover": "Quitamanchas"
    },
    "freshFormAck": "Se colocó un formulario de adicionales nuevo en el bolsillo de la bolsa",
    "submit": "Crear Pedido",
    "cancel": "Cancelar",
    "created": "Pedido creado — solicitud de pago enviada",
    "processedScan": "Bolsa marcada como procesada",
    "alreadyProcessed": "Esta bolsa ya fue procesada",
    "reintakePrompt": "El último pedido de esta bolsa sigue en reparto. ¿Marcarlo como entregado y comenzar un pedido nuevo?",
    "reintakeConfirm": "Marcar entregado y crear pedido nuevo",
    "error": {
      "bagNotActive": "Esta bolsa aún no ha sido reclamada por un cliente",
      "orderAlreadyOpen": "Ya existe un pedido abierto para esta bolsa",
      "bagNotFound": "Bolsa no reconocida"
    }
  }
  ```
  Portuguese (`public/locales/pt/common.json`, `operator` at line 769):
  ```json
  "intake": {
    "title": "Recebimento de Sacola",
    "weightLabel": "Peso (lbs)",
    "weightPlaceholder": "Digite o peso em libras",
    "addOnsHeading": "Adicionais (do formulário em papel)",
    "addOns": {
      "premiumDetergent": "Detergente Premium",
      "fabricSoftener": "Amaciante de Roupas",
      "stainRemover": "Removedor de Manchas"
    },
    "freshFormAck": "Um novo formulário de adicionais foi colocado no bolso da sacola",
    "submit": "Criar Pedido",
    "cancel": "Cancelar",
    "created": "Pedido criado — solicitação de pagamento enviada",
    "processedScan": "Sacola marcada como processada",
    "alreadyProcessed": "Esta sacola já foi processada",
    "reintakePrompt": "O último pedido desta sacola ainda está em entrega. Marcar como entregue e iniciar um novo pedido?",
    "reintakeConfirm": "Marcar entregue e criar novo pedido",
    "error": {
      "bagNotActive": "Esta sacola ainda não foi reivindicada por um cliente",
      "orderAlreadyOpen": "Já existe um pedido aberto para esta sacola",
      "bagNotFound": "Sacola não reconhecida"
    }
  }
  ```
  German (`public/locales/de/common.json`, `operator` at line 769):
  ```json
  "intake": {
    "title": "Beutel-Annahme",
    "weightLabel": "Gewicht (lbs)",
    "weightPlaceholder": "Gewicht in Pfund eingeben",
    "addOnsHeading": "Zusatzleistungen (vom Papierformular)",
    "addOns": {
      "premiumDetergent": "Premium-Waschmittel",
      "fabricSoftener": "Weichspüler",
      "stainRemover": "Fleckenentferner"
    },
    "freshFormAck": "Ein neues Zusatzleistungs-Formular wurde in die Beuteltasche gelegt",
    "submit": "Auftrag erstellen",
    "cancel": "Abbrechen",
    "created": "Auftrag erstellt — Zahlungsaufforderung gesendet",
    "processedScan": "Beutel als bearbeitet markiert",
    "alreadyProcessed": "Dieser Beutel wurde bereits bearbeitet",
    "reintakePrompt": "Der letzte Auftrag dieses Beutels ist noch in Zustellung. Als zugestellt markieren und neuen Auftrag starten?",
    "reintakeConfirm": "Zugestellt markieren & neuen Auftrag starten",
    "error": {
      "bagNotActive": "Dieser Beutel wurde noch nicht von einem Kunden beansprucht",
      "orderAlreadyOpen": "Für diesen Beutel ist bereits ein Auftrag offen",
      "bagNotFound": "Beutel nicht erkannt"
    }
  }
  ```
- [ ] Run the parity test again:
  ```bash
  npm test -- tests/unit/operatorIntakeI18n.test.js
  ```
  Expected: all pass. (If a locale file fails to parse, check the comma you added after `login`'s closing brace.)
- [ ] Register the parser script. In `public/operator-scan-embed.html`, before line 114 (`<script src="/assets/js/operator-scan-init.js"></script>`), add:
  ```html
  <script src="/assets/js/bag-token-parser.js"></script>
  ```
  In `public/assets/js/embed-app-v2.js` line 593, in `pageScripts['/operator-scan']`, insert `'/assets/js/bag-token-parser.js'` immediately before `'/assets/js/operator-scan-init.js'` (PITFALLS #3 — both access paths must load it).
- [ ] Rework `public/assets/js/operator-scan-init.js`. **(a)** Add a tiny i18n helper near the top of the IIFE (after the `// State` block ending at line 18):
  ```javascript
  // i18n helper — i18n.js returns the key itself when a translation is
  // missing; fall back to readable English in that case.
  function t(key, fallback) {
      var translated = (window.i18n && typeof window.i18n.t === 'function') ? window.i18n.t(key) : key;
      return (translated && translated !== key) ? translated : (fallback || key);
  }
  ```
  **(b)** Inside `processScan` (line 883), replace the parsing + scan-customer block — everything from the comment at line 895 (`// Parse the scan data - supports multiple formats:`) through the closing of the `if (data.success) { … } else { … }` at line 946 — with:
  ```javascript
  // Extract the durable-bag token (raw 32-hex or printed claim URL).
  const bagToken = window.BagTokenParser.extractBagToken(scanData);
  if (!bagToken) {
      hideConfirmation();
      showError(t('operator.intake.error.bagNotFound', 'Bag not recognized'));
      return;
  }

  // Canonical scan-context resolver (PR 6). Drives the kiosk branch.
  const resolveData = await ApiClient.get(`/api/v1/bags/resolve/${bagToken}`, { showError: false });
  hideConfirmation();

  if (!resolveData || resolveData.success === false) {
      showError(t('operator.intake.error.bagNotFound', 'Bag not recognized'));
      return;
  }
  if (resolveData.outcome === 'unclaimed') {
      showError(t('operator.intake.error.bagNotActive', 'This bag has not been claimed by a customer yet'));
      return;
  }

  const nextAction = resolveData.order && resolveData.order.nextAction
      ? resolveData.order.nextAction
      : 'intake'; // claimed bag with no open order -> intake

  switch (nextAction) {
      case 'intake':
          showIntakeModal(bagToken, resolveData, false);
          break;
      case 'advance':
          await sendScanProcessed(bagToken);
          break;
      case 'deliver-or-reintake':
          // Kiosk = operator context: the bag is physically back at the
          // store. Explicit confirm before closing the picked_up order.
          showReintakeConfirm(bagToken, resolveData);
          break;
      default:
          showError(t('operator.intake.error.bagNotActive', 'This bag has not been claimed by a customer yet'));
  }
  ```
  (The surrounding `try { … } catch (error) { … }` of `processScan` stays.)
  **(c)** Add the three new functions after `processScan` (i.e., replacing nothing — insert before `handleScanResponse` at line 955; `handleScanResponse` itself becomes dead code retained one sprint, same move-then-delete rule as the service shims):
  ```javascript
  // Intake modal — weight + add-ons (operator ENTERS from the paper form)
  // + required fresh-form-placed ack (spec §6.4).
  function showIntakeModal(bagToken, resolveData, isReintake) {
      modalTitle.textContent = t('operator.intake.title', 'Bag Intake');
      modalBody.innerHTML = `
          <div class="order-info">
              <div class="info-item">
                  <div class="info-label" data-role="affiliate-label"></div>
                  <div class="info-value" id="intakeAffiliateName"></div>
              </div>
          </div>
          <div class="weight-input-section">
              <div class="bag-weight-input">
                  <label for="intakeWeight" id="intakeWeightLabel"></label>
                  <input type="number" id="intakeWeight" class="weight-input" step="0.1" min="0.1">
              </div>
          </div>
          <div class="add-ons-confirmation">
              <h5 id="intakeAddOnsHeading"></h5>
              <label><input type="checkbox" id="intakeAddOnDetergent"> <span id="intakeAddOnDetergentLabel"></span></label><br>
              <label><input type="checkbox" id="intakeAddOnSoftener"> <span id="intakeAddOnSoftenerLabel"></span></label><br>
              <label><input type="checkbox" id="intakeAddOnStain"> <span id="intakeAddOnStainLabel"></span></label>
          </div>
          <div class="add-ons-confirmation">
              <label><input type="checkbox" id="intakeFreshFormAck"> <span id="intakeFreshFormAckLabel"></span></label>
          </div>
          <div class="action-buttons">
              <button class="btn btn-secondary" id="intakeCancelBtn"></button>
              <button class="btn btn-primary" id="intakeSubmitBtn" disabled></button>
          </div>
      `;

      // Translated copy + server-sourced strings via textContent (CSP/XSS-safe).
      document.getElementById('intakeAffiliateName').textContent =
          (resolveData.affiliate && resolveData.affiliate.name) ? resolveData.affiliate.name : '';
      document.getElementById('intakeWeightLabel').textContent = t('operator.intake.weightLabel', 'Weight (lbs)');
      document.getElementById('intakeWeight').setAttribute('placeholder', t('operator.intake.weightPlaceholder', 'Enter weight in pounds'));
      document.getElementById('intakeAddOnsHeading').textContent = t('operator.intake.addOnsHeading', 'Add-ons (from the paper form)');
      document.getElementById('intakeAddOnDetergentLabel').textContent = t('operator.intake.addOns.premiumDetergent', 'Premium Detergent');
      document.getElementById('intakeAddOnSoftenerLabel').textContent = t('operator.intake.addOns.fabricSoftener', 'Fabric Softener');
      document.getElementById('intakeAddOnStainLabel').textContent = t('operator.intake.addOns.stainRemover', 'Stain Remover');
      document.getElementById('intakeFreshFormAckLabel').textContent = t('operator.intake.freshFormAck', 'A fresh add-ons form has been placed in the bag pocket');
      document.getElementById('intakeCancelBtn').textContent = t('operator.intake.cancel', 'Cancel');
      document.getElementById('intakeSubmitBtn').textContent = t('operator.intake.submit', 'Create Order');

      orderModal.classList.add('weight-input-modal-active', 'active');
      toggleActionBar(false);

      const weightInput = document.getElementById('intakeWeight');
      const ackBox = document.getElementById('intakeFreshFormAck');
      const submitBtn = document.getElementById('intakeSubmitBtn');

      function validate() {
          const w = parseFloat(weightInput.value);
          submitBtn.disabled = !(w > 0 && ackBox.checked);
      }
      weightInput.addEventListener('input', validate);
      ackBox.addEventListener('change', validate);
      document.getElementById('intakeCancelBtn').addEventListener('click', closeModal);
      submitBtn.addEventListener('click', function() { submitIntake(bagToken, isReintake); });

      setTimeout(function() { weightInput.focus(); }, 100);
  }

  async function submitIntake(bagToken, isReintake) {
      const submitBtn = document.getElementById('intakeSubmitBtn');
      if (submitBtn) submitBtn.disabled = true;

      const body = {
          bagToken: bagToken,
          weight: parseFloat(document.getElementById('intakeWeight').value),
          addOns: {
              premiumDetergent: document.getElementById('intakeAddOnDetergent').checked,
              fabricSoftener: document.getElementById('intakeAddOnSoftener').checked,
              stainRemover: document.getElementById('intakeAddOnStain').checked
          },
          freshAddOnsFormPlaced: document.getElementById('intakeFreshFormAck').checked
      };

      try {
          const token = localStorage.getItem('operatorToken');
          const data = await ApiClient.post('/api/v1/operators/intake', body, {
              showError: false,
              headers: { 'Authorization': `Bearer ${token}` }
          });
          if (data && data.success) {
              closeModal();
              showConfirmation(t('operator.intake.created', 'Order created — payment request sent'), '✅', 'success');
              setTimeout(hideConfirmation, 3000);
              await loadStats();
          } else {
              const code = data && data.errors ? data.errors.code : null;
              if (submitBtn) submitBtn.disabled = false;
              if (code === 'order_already_open') {
                  showError(t('operator.intake.error.orderAlreadyOpen', 'An order is already open for this bag'));
              } else if (code === 'bag_not_active') {
                  showError(t('operator.intake.error.bagNotActive', 'This bag has not been claimed by a customer yet'));
              } else {
                  showError((data && data.message) || t('operator.intake.error.bagNotFound', 'Bag not recognized'));
              }
          }
      } catch (error) {
          console.error('Intake submit error:', error);
          if (submitBtn) submitBtn.disabled = false;
          showError('Network error. Please try again.');
      }
  }

  // Stage-2 scan: WDF done. PR 9 swaps this to /api/v1/operators/advance.
  async function sendScanProcessed(bagToken) {
      try {
          const token = localStorage.getItem('operatorToken');
          const data = await ApiClient.post('/api/v1/operators/scan-processed',
              { bagToken: bagToken },
              { showError: false, headers: { 'Authorization': `Bearer ${token}` } }
          );
          if (data && data.success) {
              showConfirmation(t('operator.intake.processedScan', 'Bag marked processed'), '✅', 'success');
          } else if (data && data.warning === 'duplicate_scan') {
              showConfirmation(t('operator.intake.alreadyProcessed', 'This bag has already been processed'), '⚠️', 'warning');
          } else {
              showError((data && data.message) || 'Scan failed');
          }
          setTimeout(hideConfirmation, 3000);
          await loadStats();
      } catch (error) {
          console.error('scan-processed error:', error);
          showError('Network error. Please try again.');
      }
  }

  // picked_up bag back at the store: explicit confirm, then intake
  // (the server auto-delivers the prior order — spec §6.4 re-intake).
  function showReintakeConfirm(bagToken, resolveData) {
      modalTitle.textContent = t('operator.intake.title', 'Bag Intake');
      modalBody.innerHTML = `
          <div class="process-confirm-section">
              <h5 id="reintakePromptText"></h5>
          </div>
          <div class="action-buttons">
              <button class="btn btn-secondary" id="reintakeCancelBtn"></button>
              <button class="btn btn-primary" id="reintakeConfirmBtn"></button>
          </div>
      `;
      document.getElementById('reintakePromptText').textContent =
          t('operator.intake.reintakePrompt', "This bag's last order is still out for delivery. Mark it delivered and start a new order?");
      document.getElementById('reintakeCancelBtn').textContent = t('operator.intake.cancel', 'Cancel');
      document.getElementById('reintakeConfirmBtn').textContent = t('operator.intake.reintakeConfirm', 'Mark delivered & start new order');

      orderModal.classList.add('active');
      toggleActionBar(false);

      document.getElementById('reintakeCancelBtn').addEventListener('click', closeModal);
      document.getElementById('reintakeConfirmBtn').addEventListener('click', function() {
          showIntakeModal(bagToken, resolveData, true);
      });
  }
  ```
  Note on `console.*`: the ESLint `no-console` block applies to `server/` only; this file already logs via `console.log`/`console.error` throughout — the two `console.error` calls above match the file's existing error-path convention.
- [ ] Manual smoke (no automated UI harness for this page):
  ```bash
  npm start
  ```
  Open `http://localhost:3000/embed-app-v2.html?route=/operator-scan`, log in as an operator, and into the scan input paste (1) garbage text → "Bag not recognized"; (2) a known active bag's claim URL → intake modal appears with translated labels, submit disabled until weight + ack, submit → success toast; (3) the same URL again → "An order is already open for this bag". Switch the language picker to `es` and re-open the modal → Spanish labels.
- [ ] Run the frontend-adjacent suites:
  ```bash
  npm test -- tests/unit/bagTokenParser.test.js tests/unit/operatorIntakeI18n.test.js
  ```
  Expected: green.
- [ ] Commit (code + all four locales together — house i18n rule):
  ```bash
  git add public/assets/js/operator-scan-init.js public/operator-scan-embed.html public/assets/js/embed-app-v2.js public/locales/en/common.json public/locales/es/common.json public/locales/pt/common.json public/locales/de/common.json tests/unit/operatorIntakeI18n.test.js
  git commit -m "feat(kiosk): token-driven scan flow + intake modal (weight, add-ons, fresh-form ack) with en/es/pt/de copy"
  ```

## Task 11 — Legacy-seam test sweep + full suite + lint

PRs 2/4 should already have updated or removed tests built on the old multi-bag/estimate flow, but the kiosk seams this PR re-pointed (`scan-customer`, `weigh-bags` payload shape, `scan-processed` `qrCode`, `customerId#bagId`) may still be exercised somewhere (on pre-PR-1 main, `tests/integration/wdfCreditIntegration.test.js` posts the old `weigh-bags` shape at lines 173/261/371/399/409/452/459 — verify what survived PRs 1–6).

**Files:**
- Modify/Delete: whatever the greps below surface (test files only; production code is already converted)

**Steps:**

- [ ] Sweep for old-seam usage:
  ```bash
  grep -rln "scan-customer\|weigh-bags\|customerId#\|parseCustomerQr\|qrCode.*#" tests/ --include="*.js"
  grep -rn "scanCustomer\|weighBags\|scanProcessed" tests/ --include="*.js" | grep -v operatorIntake | grep -v operatorScanProcessed | grep -v operatorBagWorkflowDelegates
  ```
- [ ] For each hit, triage per the house rule (surgical assertion updates where the change was intentional; delete only tests coupled to removed functionality):
  - Tests posting `{ orderId, bags: [{bagId, weight}] }` to `/api/v1/operators/orders/weigh-bags` → rewrite to the new shape `{ bagToken, weight, addOns, freshAddOnsFormPlaced }` (creating an active `Bag` first, as in `tests/integration/operatorIntake.test.js`) **or** delete if the test's real subject (e.g. multi-bag weight accumulation) no longer exists. WDF-credit behavior now lives at intake — if `wdfCreditIntegration.test.js` survived PRs 1–6, port its credit-application assertions onto `createOrderFromBag` (Task 2 already covers apply+reset; keep any uncovered scenario, e.g. negative-credit debit).
  - Tests posting `{ qrCode: 'CUST-x#BAG1' }` to `/scan-processed` → rewrite to `{ bagToken }`.
  - Tests asserting the old `scanCustomer` response (`action: 'weight_input'`, `bagsWeighed`, …) → delete; that contract is gone.
- [ ] Run the FULL suite and lint:
  ```bash
  npm test 2>&1 | tail -10
  npx eslint server/ public/assets/js/bag-token-parser.js
  npx madge --circular server/
  ```
  Expected: 0 test failures; ESLint clean; `madge` reports zero cycles (the new module edges are `operatorBagWorkflowService → modules/orders/orderIntakeService → modules/bags/bagService`, all acyclic).
- [ ] Update the refactor checklist: mark `PR 7 — operator intake creates the order (one bag = one order, idempotent)` done in `docs/superpowers/specs/2026-06-08-invite-bag-workflow-redesign-design.md` §12 (line 833) if the team is tracking checkboxes in the spec, and tick the corresponding item in `tasks/todo.md`.
- [ ] Commit:
  ```bash
  git add -A tests/ tasks/todo.md docs/superpowers/specs/2026-06-08-invite-bag-workflow-redesign-design.md
  git commit -m "test(operators): port legacy kiosk-seam tests to the bag-token intake flow; suite green"
  ```

---

## Verification

- [ ] **Full suite, clean exit:**
  ```bash
  npm test 2>&1 | tail -10
  ```
  Expected: 0 failures. Spot-check that the run does not rely on `--forceExit` masking open handles for the NEW tests: `npx jest tests/unit/orderIntakeService.test.js tests/integration/operatorIntake.test.js --runInBand --detectOpenHandles 2>&1 | tail -5` (no open-handle warnings attributable to PR 7 code).
- [ ] **The mandatory silent-zero guard is present and meaningful:** temporarily comment out the `feeBreakdown: { ...feeCalculation },` line in `orderIntakeService.js`, run `npm test -- tests/unit/orderIntakeService.test.js`, and confirm the SILENT-ZERO GUARD test FAILS (totalFee 0 / commission 0 / paymentAmount loses the fee). Restore the line, re-run, green. This proves the guard guards.
- [ ] **Lint + cycles:** `npx eslint server/` and `npx madge --circular server/` both clean.
- [ ] **Manual smoke (kiosk):** with `npm start`, operator logs in at `?route=/operator-scan`; paste an active bag's claim URL → intake modal (i18n labels in all 4 languages via the switcher) → submit weight 10 + one add-on + ack → success; check the Mongo order: `status in_progress`, `paymentStatus awaiting`, non-zero `feeBreakdown.totalFee`/`paymentAmount`/`affiliateCommission`, one `bags[]` element keyed by `bagToken`; the customer received (console transport in dev) the payment-request email with no `Invalid Date`. Re-paste the URL → "order already open". Set the order `picked_up` in Mongo, re-paste → re-intake confirm → new order created, prior order `delivered` with `proofOfDelivery.method='reintake'`.
- [ ] **Out-of-scope confirmation:** `git diff main --stat` shows no changes to `paymentVerificationJob` (PR 8), no `orderAdvanceService`/bag-URL endpoints/operator scan codes (PR 9), no W-9 surface (PR 10).

### PR description

```
PR 7/11 — Operator intake creates the order (redesign §6.4, §12)

One bag = one order. Orders are now born at store intake:

- NEW server/modules/orders/orderIntakeService.js — createOrderFromBag:
  resolves the durable bag by token, derives customer/affiliate from the
  bag (never client input), guards open orders (at-store -> 409
  order_already_open; picked_up -> auto-deliver first with
  proofOfDelivery.method='reintake', commission realized once, delivered
  email), sets EVERY pricing input before the first save (delivery fee via
  calculateDeliveryFee(1, affiliate) spread into feeBreakdown), generates
  payment links exactly once, flips paymentStatus to 'awaiting', emails
  the V2 payment request, audits (ORDER_STATUS_CHANGED
  order_created_at_intake / new ORDER_REINTAKE).
- NEW kiosk endpoint POST /api/v1/operators/intake (operator JWT + CSRF + RBAC).
- operatorBagWorkflowService re-pointed: parseCustomerQr/findCustomerFlexible/
  generatePaymentURLs deleted; scanCustomer/weighBags are deprecated thin
  delegates (removed in PR 9); scanProcessed resolves by bag token, uses
  orderStateMachine.applyTransition, and defers ready_for_pickup/held/
  affiliate-notify to orderReadyGateService (no direct reminders/emails).
- NEW Notification B: sendCustomerDeliveredEmail + customer-order-delivered
  template (en/es/pt/de) — consumed here by re-intake; reused (and extended
  with affiliateName) by PR 9.
- NEW server/modules/orders/openOrderContext.js — GET /api/v1/bags/resolve/:token
  now returns { status, awaitingDelivery, nextAction } for claimed bags with an
  open order (the kiosk switch depends on it; PR 9 reuses the helper for the
  customer claim resolver).
- Kiosk frontend: customerId#bagId parsing deleted; scans extract the bag
  token (raw 32-hex or printed claim URL — new bag-token-parser.js),
  branch on GET /api/v1/bags/resolve/:token nextAction, and submit the new
  intake modal (weight + operator-entered add-ons + fresh-form ack), i18n'd
  in all four languages.
- sendV2PaymentRequest no longer renders Invalid Date / undefined for
  intake-born orders.

Mandatory regression guard included: after intake the saved order has
non-zero feeBreakdown.totalFee, affiliateCommission, and paymentAmount
(the Order pre-save READS the fee; omitting it silently zeroes pricing).

Out of scope (later PRs): orderAdvanceService + scan-out + overloaded
bag-URL endpoints + operator scan codes (PR 9), payment job retune (PR 8),
W-9 (PR 10).

Tests: unit (intake service, re-intake, scanProcessed re-point, delegates,
token parser, i18n parity, delivered email, payment-request render) +
integration (kiosk endpoint: 201/400/401/403 CSRF/403 RBAC/409s,
re-intake). Suite green; eslint clean; madge zero cycles.
```

