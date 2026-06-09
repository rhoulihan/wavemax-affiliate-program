# PR 8 — Payment Job Retune (60-min/8-cap reminders, come-to-store, gate wiring) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retune the V2 payment stack per spec §6.5 — decouple IMAP-detection from reminder cadence (60-min interval, cap 8 from SystemConfig), escalate to a one-time "come to the store" notice + `paymentEscalated`/`heldAtStore` (never `failed`), widen the three exact-match `paymentStatus: 'awaiting'` queries to `$in: ['awaiting','confirming']`, and run the canonical `applyReadyGate` from every verify path.

**Architecture:** `paymentVerificationJob` (cron, leader box only via `RUN_BACKGROUND_JOBS`) is rewritten as the single owner of the reminder cadence; `paymentEmailScanner` keeps detection and now calls `orderReadyGateService.applyReadyGate` after verify (Path B); the email dispatcher gains `sendV2ComeToStoreNotice` (template `v2/come-to-store.html`) and `sendV2PaymentReminder` is fixed to load its template via `loadTemplate` and source its cap from SystemConfig. `orderController.confirmPayment` stops escalating; `escalateToAdmin` becomes the admin-visibility hook fired alongside the hold notice.

**Tech Stack:** Node/Express, Mongoose, node-cron, Jest + Supertest + MongoMemoryServer (`tests/setup.js` runs `SystemConfig.initializeDefaults()`), Winston logger, `server/utils/auditLogger.js`.

**Assumed starting state (PRs 1–7 of `docs/superpowers/specs/2026-06-08-invite-bag-workflow-redesign-design.md` §12 are merged):**

- **PR 1/2:** V1 Paygistix, scheduling, Pickup Now, BetaRequest removed. `orderController` no longer has `createOrder`/`createImmediateOrder`/`checkImmediateAvailability`/`checkActiveOrders`.
- **PR 3:** `SystemConfig.initializeDefaults()` seeds `payment_scan_interval_ms` (120000), `payment_reminder_interval_minutes` (60), `payment_reminder_max_attempts` (8), `payment_hold_notice_enabled` (true), `store_pickup_address`; `payment_check_interval` / `payment_check_max_attempts` are retired; `laundry_bag_fee` deleted. **`admin_notification_email` is deliberately NOT seeded** (PR 3 Task 1's recorded decision, deviating from the spec §8 table) — its reader carries an inline default via `getValue(key, fallback)`. Do NOT "fix" this mid-PR-8 by seeding it; keep using the inline default.
- **PR 4:** `server/models/Order.js` redesigned — `status` enum `['in_progress','processed','ready_for_pickup','picked_up','delivered','cancelled']` (default `in_progress`); top-level `bagId` (required) + `bagToken`; one-element `bags[]` with `bagToken` (never `bagId` inside `bags[]`), sub-status enum `['intake','processed','picked_up','delivered']`; `heldAtStore`, `readyForPickupAt` exist; `estimatedWeight`/`estimatedTotal`/`numberOfBags`/`pickupDate`/`pickupTime`/refund block removed; pre-save prices from `actualWeight` only. `server/modules/orders/orderStateMachine.js` (TRANSITIONS, `canTransition`, `applyTransition`, `maybeReadyForPickup` thin delegate) and **`server/services/orderReadyGateService.js`** exist; `applyReadyGate(order, { trigger })` is idempotent, the SOLE writer of `readyForPickupAt`, toggles `heldAtStore`, saves, and sends `sendOrderReadyNotification`. `orderController.verifyPaymentManually` is already wired to the gate (Task 6 confirms; wires if PR 4 missed it).
- **PR 6/7:** `Bag` model exists; `orderIntakeService.createOrderFromBag` creates the order at intake and calls `generatePaymentLinks` **once**, storing `paymentLinks`/`paymentQRCodes` on the order; `operatorBagWorkflowService` no longer sends reminders.
- Test suite green without `--forceExit`. `tests/helpers/csrfHelper.js` exports `getCsrfToken(app, agent)` + `createAgent(app)`.

**Interfaces taken VERBATIM from the spec for not-yet-inspectable PR-4 code:** `orderReadyGateService.applyReadyGate(order, { trigger })`. Trigger strings used by this PR: `'payment_verified'` (cron), `'scanner_verify'` (IMAP scanner), `'manual_verify'` (admin). The gate only logs the trigger; if PR 4 named its param differently, adapt the call sites in Tasks 4–6, nothing else.

**Files in current `main` that this PR modifies were read at these anchors** (re-locate by content if PRs 1–7 shifted lines): `server/jobs/paymentVerificationJob.js` (whole-file rewrite), `server/services/paymentEmailScanner.js` `findOrderById` (~L278–291, exact-match `'awaiting'` at ~L283), `processAllPendingPayments` (~L470–472), `verifyAndUpdateOrder` (~L298–379), `server/services/email/dispatcher/payment.js` `sendV2PaymentReminder` (~L100–194), `server/controllers/orderController.js` `confirmPayment` (~L868–965, escalate call at ~L936–938) and `verifyPaymentManually` (~L970–1025).

---

## Task 1 — Guarantee the Order escalation fields (`paymentEscalated`, `holdNoticeSentAt`, `heldAtStore`)

Spec §4.4 names exactly three "GENUINELY NEW fields on the payment path." PR 4 (Order redesign) should have added them; this task proves it and adds them only if missing.

**Files:**
- Create: `tests/unit/orderEscalationFields.test.js`
- Modify (only if the test fails): `server/models/Order.js` — insert after `paymentLastReminderAt: Date,` (current main ~L169)

**Steps:**

- [ ] Write the test:

```javascript
// tests/unit/orderEscalationFields.test.js
// PR 8 precondition (spec §4.4): the three payment-escalation fields exist.
const Order = require('../../server/models/Order');

describe('Order payment-escalation fields (spec §4.4)', () => {
  afterEach(async () => {
    await Order.deleteMany({});
  });

  it('defaults paymentEscalated/heldAtStore to false and persists holdNoticeSentAt', async () => {
    const token = 'a'.repeat(32);
    const order = await Order.create({
      customerId: 'CUST-esc-1',
      affiliateId: 'AFF-esc-1',
      bagId: 'BAG-esc-1',
      bagToken: token,
      bags: [{ bagToken: token, bagNumber: 1 }],
      actualWeight: 10,
      status: 'in_progress',
      paymentStatus: 'awaiting',
      feeBreakdown: { minimumFee: 10, perBagFee: 2, totalFee: 10, minimumApplied: true }
    });

    expect(order.paymentEscalated).toBe(false);
    expect(order.heldAtStore).toBe(false);

    order.paymentEscalated = true;
    order.holdNoticeSentAt = new Date();
    order.heldAtStore = true;
    await order.save();

    const reread = await Order.findById(order._id);
    expect(reread.paymentEscalated).toBe(true);
    expect(reread.holdNoticeSentAt).toBeInstanceOf(Date);
    expect(reread.heldAtStore).toBe(true);
  });
});
```

- [ ] Run it: `npm test -- tests/unit/orderEscalationFields.test.js`
  - **If it PASSES:** PR 4 already added the fields. Commit the test only (it pins the contract) and skip the schema edit.
  - **If it FAILS** (expected failure: `expect(order.paymentEscalated).toBe(false)` receives `undefined`, or strict-mode save drops the unknown paths so the reread assertions get `undefined`): proceed to the schema edit.
- [ ] Minimal implementation (only on failure) — in `server/models/Order.js`, directly after the line `paymentLastReminderAt: Date,` add:

```javascript
  // Escalation after the reminder cap (spec §4.4 / §6.5).
  // NEVER collapses into paymentStatus='failed' — a late payment must still
  // flow awaiting -> verified, so escalation is a separate boolean.
  paymentEscalated: { type: Boolean, default: false }, // set true after the final reminder
  holdNoticeSentAt: { type: Date },                    // "come to store" notice sent once
  heldAtStore: { type: Boolean, default: false },      // processed but unpaid -> physically held
```

- [ ] Re-run: `npm test -- tests/unit/orderEscalationFields.test.js` — expect PASS.
- [ ] Run the model's existing tests to prove no regression: `npm test -- tests/unit/order.model.test.js` (use the actual Order-model test file name present after PR 4; locate with `ls tests/unit | grep -i order`). Expect PASS.
- [ ] Commit:

```bash
git add tests/unit/orderEscalationFields.test.js server/models/Order.js
git commit -m "fix(orders): pin payment escalation fields on Order (paymentEscalated, holdNoticeSentAt, heldAtStore)"
```

(If the schema edit was skipped, `git add` only the test file and use `test(orders): pin payment escalation field contract` as the message.)

---

## Task 2 — `sendV2ComeToStoreNotice` dispatcher + `v2/come-to-store.html` template + 4-lang `payment.holdNotice.*` keys

The `v2/` template directory is language-agnostic (it holds only `payment-request.html` and `payment-reminder.html`, English). `loadTemplate('v2/come-to-store', lang)` in `server/services/email/template-manager.js` (L24–38) tries `templates/emails/{lang}/v2/come-to-store.html` first and falls back to `templates/emails/v2/come-to-store.html` — so one English file resolves for all four languages, exactly like the existing v2 templates. The client-facing `payment.holdNotice.*` keys ship in all four `common.json` files in the SAME commit (project i18n rule).

**Files:**
- Create: `tests/unit/email-come-to-store.test.js`
- Create: `server/templates/emails/v2/come-to-store.html`
- Modify: `server/services/email/dispatcher/payment.js` — append the new export before the final `module.exports = exports;` (current last line, L380–381)
- Modify: `public/locales/en/common.json`, `public/locales/es/common.json`, `public/locales/pt/common.json`, `public/locales/de/common.json` — add a top-level `"payment"` object (none exists today; top-level keys are currently `administrator, affiliate, common, customer, deletionStatus, emails, errors, landing, navigation, operator, orders, spinner`)

**Steps:**

- [ ] Write the failing test:

```javascript
// tests/unit/email-come-to-store.test.js
// Spec §6.5 hold notice: one-time "come to the store" email after the final
// payment reminder. Template lives in the lang-agnostic v2/ dir and must
// resolve for all four languages; locale keys ship in the same commit.
jest.mock('../../server/services/email/transport', () => ({
  sendEmail: jest.fn().mockResolvedValue(true)
}));

const { sendEmail } = require('../../server/services/email/transport');
const SystemConfig = require('../../server/models/SystemConfig');
const emailService = require('../../server/utils/emailService');

describe('sendV2ComeToStoreNotice (spec §6.5)', () => {
  const order = {
    orderId: 'ORD-12345678-1234-1234-1234-123456789012',
    paymentAmount: 42.5,
    actualWeight: 18
  };

  beforeAll(async () => {
    await SystemConfig.findOneAndUpdate(
      { key: 'store_pickup_address' },
      { $set: { value: '123 Rundberg Ln, Austin, TX 78753', dataType: 'string', category: 'payment', isPublic: true } },
      { upsert: true }
    );
  });

  beforeEach(() => jest.clearAllMocks());

  it.each(['en', 'es', 'pt', 'de'])('resolves the template and sends for language %s', async (lang) => {
    const customer = { firstName: 'Pat', lastName: 'Doe', email: 'pat@test.com', languagePreference: lang };

    const result = await emailService.sendV2ComeToStoreNotice({ customer, order });

    expect(result).toBe(true);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const [to, subject, html] = sendEmail.mock.calls[0];
    expect(to).toBe('pat@test.com');
    expect(subject).toContain('12345678');
    expect(html).toContain('Pat Doe');
    expect(html).toContain('123 Rundberg Ln, Austin, TX 78753');
    expect(html).toContain('42.50');
    expect(html).not.toContain('[EMAIL_CONTENT]'); // not the fallback container
    expect(html).not.toMatch(/{{\w+}}/);           // every placeholder filled
  });

  it('ships payment.holdNotice keys in all four locales (i18n parity)', () => {
    ['en', 'es', 'pt', 'de'].forEach((lang) => {
      const dict = require(`../../public/locales/${lang}/common.json`);
      const hold = dict.payment && dict.payment.holdNotice;
      expect(hold).toBeDefined();
      ['subject', 'heading', 'body', 'amountDue', 'orderNumber', 'storeContact', 'cta'].forEach((k) => {
        expect(typeof hold[k]).toBe('string');
        expect(hold[k].length).toBeGreaterThan(0);
      });
    });
  });
});
```

- [ ] Run it: `npm test -- tests/unit/email-come-to-store.test.js` — expect FAIL with `TypeError: emailService.sendV2ComeToStoreNotice is not a function` (first 4 cases) and `expect(hold).toBeDefined()` receiving `undefined` (locale case).
- [ ] Create `server/templates/emails/v2/come-to-store.html` (English; same visual system as `v2/payment-reminder.html`; placeholders `{{customerName}} {{orderId}} {{shortOrderId}} {{amount}} {{actualWeight}} {{storeAddress}}` only):

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Pick Up Your Laundry In Store - WaveMAX Laundry</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #c62828; color: #ffffff !important; padding: 30px 20px; text-align: center; border-radius: 5px 5px 0 0; }
        .header h1 { margin: 0; color: #ffffff !important; font-size: 28px; }
        .content { background-color: #f9f9f9; padding: 30px 20px; border: 1px solid #ddd; }
        .order-details { background-color: #ffffff !important; padding: 20px; margin: 20px 0; border-radius: 8px; border: 2px solid #c62828; }
        .order-details h2 { color: #c62828; margin-top: 0; font-size: 24px; }
        .detail-row { margin: 15px 0; font-size: 16px; }
        .detail-label { font-weight: bold; color: #555; display: inline-block; min-width: 140px; }
        .amount-due { background-color: #ffebee; padding: 20px; margin: 25px 0; border-radius: 8px; text-align: center; border: 2px solid #c62828; }
        .amount-due h2 { color: #c62828; margin: 0 0 10px 0; font-size: 20px; }
        .amount-value { font-size: 48px; font-weight: bold; color: #c62828; margin: 10px 0; }
        .store-box { background-color: #e8f5e9; padding: 20px; margin: 25px 0; border-radius: 8px; border-left: 4px solid #2e7d32; }
        .store-box h3 { color: #2e7d32; margin-top: 0; font-size: 18px; }
        .instructions { background-color: #fff3cd; padding: 20px; margin: 25px 0; border-radius: 8px; border-left: 4px solid #ffc107; }
        .instructions p { color: #856404; margin: 10px 0; }
        .footer { background-color: #f5f5f5; padding: 20px; text-align: center; font-size: 12px; color: #666; border-radius: 0 0 5px 5px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Please Pick Up Your Laundry In Store</h1>
        </div>
        <div class="content">
            <p style="font-size: 18px; margin-bottom: 10px;">Hello {{customerName}},</p>

            <p style="font-size: 16px;">We haven't been able to confirm payment for your order, so your clean
            laundry is being held safely at the store. Payment reminders have now stopped — no further emails
            will be sent for this order.</p>

            <div class="order-details">
                <h2>Order Summary</h2>
                <div class="detail-row">
                    <span class="detail-label">Order ID:</span> <strong>{{orderId}}</strong>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Weight:</span> <strong>{{actualWeight}} lbs</strong>
                </div>
            </div>

            <div class="amount-due">
                <h2>Amount Due</h2>
                <div class="amount-value">${{amount}}</div>
            </div>

            <div class="store-box">
                <h3>Come to the store to pay and collect your laundry</h3>
                <p style="font-size: 16px; margin: 0;"><strong>{{storeAddress}}</strong></p>
            </div>

            <div class="instructions">
                <p><strong>What happens now?</strong></p>
                <p>Your laundry stays safe with us until you come by. Pay in store (or use any of the payment
                links from your earlier emails) and we'll hand your bag right over. If you already paid,
                no action is needed — our system will confirm it shortly and your delivery will resume.</p>
            </div>
        </div>
        <div class="footer">
            <p>&copy; 2025 CRHS Enterprises, LLC. All rights reserved.</p>
            <p>Order #{{shortOrderId}}</p>
        </div>
    </div>
</body>
</html>
```

- [ ] Append the dispatcher to `server/services/email/dispatcher/payment.js`, immediately BEFORE the final `module.exports = exports;` line:

```javascript
/**
 * Send the V2 "come to the store" hold notice (spec §6.5).
 *
 * Fired exactly once, after the final payment reminder. Reuses the stored
 * order state — never regenerates payment links. The template lives in the
 * language-agnostic v2/ directory; loadTemplate() falls back to it for every
 * languagePreference (same convention as v2/payment-request).
 *
 * @param {Object} opts
 * @param {Object} opts.customer - Customer doc (email, names, languagePreference)
 * @param {Object} opts.order    - Order doc (orderId, paymentAmount, actualWeight)
 * @returns {Promise<boolean>} true on send
 */
exports.sendV2ComeToStoreNotice = async ({ customer, order }) => {
  try {
    const SystemConfig = require('../../../models/SystemConfig');
    const language = customer.languagePreference || 'en';
    const template = await loadTemplate('v2/come-to-store', language);

    const storeAddress = await SystemConfig.getValue('store_pickup_address', '');
    const amount = (order.paymentAmount || order.actualTotal || 0).toFixed(2);

    const emailData = {
      customerName: customer.name || `${customer.firstName} ${customer.lastName}`,
      orderId: order.orderId,
      shortOrderId: order.orderId.replace('ORD-', '').replace('ORD', ''),
      amount,
      actualWeight: order.actualWeight,
      storeAddress
    };

    let html = template;
    Object.keys(emailData).forEach((key) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      html = html.replace(regex, emailData[key]);
    });

    const subject = `Action Needed: Pick Up Your Laundry In Store - Order #${emailData.shortOrderId}`;

    await sendEmail(customer.email, subject, html);
    logger.info(`V2 come-to-store notice sent to ${customer.email} for order ${order.orderId}`);
    return true;
  } catch (error) {
    logger.error('Error sending V2 come-to-store notice:', error);
    throw error;
  }
};
```

(`loadTemplate`, `sendEmail`, and `logger` are already imported at the top of the file — L4–8.)

- [ ] Add the locale keys. In **`public/locales/en/common.json`**, add a new top-level key (alphabetical placement after `"orders"` is fine; valid JSON — mind the commas):

```json
"payment": {
  "holdNotice": {
    "subject": "Action needed: pick up your laundry in store",
    "heading": "Please pick up your laundry in store",
    "body": "We haven't been able to confirm payment for your order, so your clean laundry is being held safely at the store. Reminders have stopped. Come by, pay, and collect your bag whenever suits you.",
    "amountDue": "Amount due",
    "orderNumber": "Order number",
    "storeContact": "Store address",
    "cta": "Pay & pick up in store"
  }
}
```

In **`public/locales/es/common.json`**:

```json
"payment": {
  "holdNotice": {
    "subject": "Acción necesaria: recoja su ropa en la tienda",
    "heading": "Por favor recoja su ropa en la tienda",
    "body": "No hemos podido confirmar el pago de su pedido, por lo que su ropa limpia se guarda de forma segura en la tienda. Los recordatorios se han detenido. Pase por la tienda, pague y recoja su bolsa cuando le convenga.",
    "amountDue": "Importe a pagar",
    "orderNumber": "Número de pedido",
    "storeContact": "Dirección de la tienda",
    "cta": "Pagar y recoger en la tienda"
  }
}
```

In **`public/locales/pt/common.json`**:

```json
"payment": {
  "holdNotice": {
    "subject": "Ação necessária: retire sua roupa na loja",
    "heading": "Por favor, retire sua roupa na loja",
    "body": "Não conseguimos confirmar o pagamento do seu pedido, por isso sua roupa limpa está guardada com segurança na loja. Os lembretes foram interrompidos. Passe na loja, pague e retire sua sacola quando for conveniente.",
    "amountDue": "Valor devido",
    "orderNumber": "Número do pedido",
    "storeContact": "Endereço da loja",
    "cta": "Pagar e retirar na loja"
  }
}
```

In **`public/locales/de/common.json`**:

```json
"payment": {
  "holdNotice": {
    "subject": "Handlung erforderlich: Holen Sie Ihre Wäsche im Geschäft ab",
    "heading": "Bitte holen Sie Ihre Wäsche im Geschäft ab",
    "body": "Wir konnten die Zahlung für Ihre Bestellung nicht bestätigen, daher wird Ihre saubere Wäsche sicher im Geschäft aufbewahrt. Die Erinnerungen wurden gestoppt. Kommen Sie vorbei, bezahlen Sie und holen Sie Ihre Tasche ab, wann es Ihnen passt.",
    "amountDue": "Fälliger Betrag",
    "orderNumber": "Bestellnummer",
    "storeContact": "Adresse des Geschäfts",
    "cta": "Im Geschäft bezahlen & abholen"
  }
}
```

- [ ] Validate the four JSON files parse: `node -e "['en','es','pt','de'].forEach(l => require('/mnt/c/Users/rickh/GitHub/wavemax-affiliate-program/public/locales/' + l + '/common.json'))" && echo OK` — expect `OK`.
- [ ] Re-run: `npm test -- tests/unit/email-come-to-store.test.js` — expect PASS (5 tests).
- [ ] Commit:

```bash
git add tests/unit/email-come-to-store.test.js server/templates/emails/v2/come-to-store.html server/services/email/dispatcher/payment.js public/locales/en/common.json public/locales/es/common.json public/locales/pt/common.json public/locales/de/common.json
git commit -m "feat(email): v2 come-to-store hold notice — dispatcher, template, 4-lang holdNotice keys"
```

---

## Task 3 — Retune `sendV2PaymentReminder` (real template path, config-driven cap, drop the 24h-deadline framing)

Three defects in `server/services/email/dispatcher/payment.js` `sendV2PaymentReminder` (current main L100–194):

1. **Broken template path.** L105–106 reads `path.join(__dirname, '../templates/emails/v2/payment-reminder.html')`, which resolves to `server/services/email/templates/emails/v2/payment-reminder.html` — a directory that does not exist (only `dispatcher/`, `template-manager.js`, `transport.js` live under `server/services/email/`). Every reminder send throws ENOENT today (silently swallowed by the job's catch). Fix: `loadTemplate('v2/payment-reminder', language)` like `sendV2PaymentRequest` does at L21.
2. **Stale `maxReminders: 3`** (L149) — source from the `maxReminders` param, falling back to `SystemConfig.getValue('payment_reminder_max_attempts', 8)`.
3. **24h-deadline framing** — `paymentDeadlineHours = 24` / `hoursRemaining` (L118–119) and the `isUrgent: reminderNumber >= 2 || hoursRemaining <= 6` rule (L148). The deadline is now "after the final nudge, come to the store": urgency = the last two reminders (`reminderNumber >= cap - 1`).

The template itself (`server/templates/emails/v2/payment-reminder.html`) only uses `{{customerName}} {{orderId}} {{shortOrderId}} {{amount}} {{actualWeight}} {{numberOfBags}} {{reminderNumber}} {{venmoLink/QR}} {{paypalLink/QR}} {{cashappLink/QR}}` — no deadline placeholders — so this is a dispatcher-only change. (`{{numberOfBags}}` renders as `1` via emailData below; the field is gone from Order, the order is one bag.)

**Files:**
- Create: `tests/unit/email-payment-reminder.test.js`
- Modify: `server/services/email/dispatcher/payment.js` L100–194

**Steps:**

- [ ] Write the failing test:

```javascript
// tests/unit/email-payment-reminder.test.js
// Spec §6.5: fix the broken v2 template path, source the reminder cap from
// SystemConfig (8, not the stale 3), drop the 24h-deadline framing.
jest.mock('../../server/services/email/transport', () => ({
  sendEmail: jest.fn().mockResolvedValue(true)
}));

const { sendEmail } = require('../../server/services/email/transport');
const emailService = require('../../server/utils/emailService');

describe('sendV2PaymentReminder retune (spec §6.5)', () => {
  const order = {
    orderId: 'ORD-12345678-1234-1234-1234-123456789012',
    affiliateId: 'AFF-1',
    paymentAmount: 42.5,
    actualWeight: 18,
    baseRate: 1.25,
    addOnTotal: 0,
    feeBreakdown: { totalFee: 10 },
    paymentRequestedAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
    paymentLinks: { venmo: 'venmo://pay/stored', paypal: 'https://paypal.me/stored', cashapp: 'https://cash.app/stored' },
    paymentQRCodes: { venmo: 'data:image/png;base64,v', paypal: 'data:image/png;base64,p', cashapp: 'data:image/png;base64,c' }
  };
  const customer = { firstName: 'Pat', lastName: 'Doe', email: 'pat@test.com', languagePreference: 'en' };

  beforeEach(() => jest.clearAllMocks());

  it('loads the real v2 template and sends (broken-path regression)', async () => {
    const ok = await emailService.sendV2PaymentReminder({ customer, order, reminderNumber: 1, maxReminders: 8 });
    expect(ok).toBe(true);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const [to, subject, html] = sendEmail.mock.calls[0];
    expect(to).toBe('pat@test.com');
    expect(html).toContain('Reminder #1');
    expect(html).toContain('venmo://pay/stored'); // stored links, passed through
    expect(subject).not.toMatch(/^URGENT/);
  });

  it('is NOT urgent at reminder 2 of 8 (old rule marked >=2 urgent; deadline framing dropped)', async () => {
    await emailService.sendV2PaymentReminder({ customer, order, reminderNumber: 2, maxReminders: 8 });
    const [, subject] = sendEmail.mock.calls[0];
    expect(subject).not.toMatch(/^URGENT/);
  });

  it('IS urgent on the last two reminders of the cap', async () => {
    await emailService.sendV2PaymentReminder({ customer, order, reminderNumber: 7, maxReminders: 8 });
    expect(sendEmail.mock.calls[0][1]).toMatch(/^URGENT/);
    await emailService.sendV2PaymentReminder({ customer, order, reminderNumber: 8, maxReminders: 8 });
    expect(sendEmail.mock.calls[1][1]).toMatch(/^URGENT/);
  });

  it('falls back to the SystemConfig cap when maxReminders is not passed', async () => {
    // payment_reminder_max_attempts defaults to 8 via initializeDefaults (PR 3)
    await emailService.sendV2PaymentReminder({ customer, order, reminderNumber: 2 });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail.mock.calls[0][1]).not.toMatch(/^URGENT/); // 2 < 8-1 — would be URGENT under the stale cap of 3
  });
});
```

- [ ] Run it: `npm test -- tests/unit/email-payment-reminder.test.js` — expect FAIL: test 1 rejects with `ENOENT: no such file or directory ... server/services/email/templates/emails/v2/payment-reminder.html`; tests 2 and 4 fail on `subject` matching `/^URGENT/` (old `reminderNumber >= 2` rule).
- [ ] Implement. In `server/services/email/dispatcher/payment.js`, replace the head of `sendV2PaymentReminder` — current L100–150 reading:

```javascript
exports.sendV2PaymentReminder = async ({ customer, order, reminderNumber, paymentAmount, paymentLinks, qrCodes }) => {
  try {
    const language = customer.languagePreference || 'en';

    // Load V2 reminder template (correct path with emails directory)
    const v2TemplatePath = path.join(__dirname, '../templates/emails/v2/payment-reminder.html');
    let template = await readFile(v2TemplatePath, 'utf8');
```

with:

```javascript
exports.sendV2PaymentReminder = async ({ customer, order, reminderNumber, paymentAmount, paymentLinks, qrCodes, maxReminders }) => {
  try {
    const SystemConfig = require('../../../models/SystemConfig');
    const language = customer.languagePreference || 'en';

    // v2/ templates are language-agnostic; loadTemplate falls back to
    // templates/emails/v2/payment-reminder.html for every language.
    let template = await loadTemplate('v2/payment-reminder', language);

    // Reminder cap comes from SystemConfig (spec §8) unless the caller
    // (paymentVerificationJob) already resolved it.
    const reminderCap = maxReminders || await SystemConfig.getValue('payment_reminder_max_attempts', 8);
```

then replace the time-based block (current L114–119):

```javascript
    // Calculate time-based values
    const paymentRequestedAt = order.paymentRequestedAt ? new Date(order.paymentRequestedAt) : new Date();
    const now = new Date();
    const hoursElapsed = Math.floor((now - paymentRequestedAt) / (1000 * 60 * 60));
    const paymentDeadlineHours = 24; // 24 hour payment window
    const hoursRemaining = Math.max(0, paymentDeadlineHours - hoursElapsed);
```

with:

```javascript
    // Elapsed time only — there is no 24h deadline. The end of the road is
    // the come-to-store notice after the final reminder (spec §6.5).
    const paymentRequestedAt = order.paymentRequestedAt ? new Date(order.paymentRequestedAt) : new Date();
    const now = new Date();
    const hoursElapsed = Math.floor((now - paymentRequestedAt) / (1000 * 60 * 60));
```

and in the `emailData` object replace the three stale lines (current L137–138 `hoursElapsed: hoursElapsed,` / `hoursRemaining: hoursRemaining,` and L148–149 `isUrgent: reminderNumber >= 2 || hoursRemaining <= 6,` / `maxReminders: 3`):

```javascript
      hoursElapsed: hoursElapsed,
      isUrgent: (reminderNumber || 1) >= reminderCap - 1, // last two reminders are urgent
      maxReminders: reminderCap
```

(Also add `numberOfBags: 1,` to `emailData` if it is not already present after the PR 4 field removal — the template still renders `{{numberOfBags}}`.) Everything else in the function — the breakdown amounts, the `{{#if}}` conditional handling, the placeholder loop, the `URGENT: ` subject prefix on `emailData.isUrgent`, the stored-links fallbacks (`paymentLinks?.venmo || order.paymentLinks?.venmo || '#'`) — stays exactly as-is.

- [ ] Re-run: `npm test -- tests/unit/email-payment-reminder.test.js` — expect PASS (4 tests).
- [ ] Guard against dangling references: `grep -n "paymentDeadlineHours\|hoursRemaining" server/services/email/dispatcher/payment.js` — expect no hits.
- [ ] Run the dispatcher's other suites to confirm no collateral: `npm test -- tests/unit/email-come-to-store.test.js tests/unit/emailService.test.js` — expect PASS.
- [ ] Commit:

```bash
git add tests/unit/email-payment-reminder.test.js server/services/email/dispatcher/payment.js
git commit -m "fix(email): retune sendV2PaymentReminder — real template path, config-driven cap, drop 24h deadline framing"
```

---

## Task 4 — Scanner retune: widen the two exact-match `'awaiting'` queries + run `applyReadyGate` on verify

`server/services/paymentEmailScanner.js` has two of the three exact-match lookups the spec orders widened (§4.4 note / §6.5): `findOrderById` (L281–284) and `processAllPendingPayments` (L470–472). The third is the cron query (Task 5). `verifyAndUpdateOrder` (L298–379) must call the canonical gate after setting `verified` (Path B), replacing its placeholder `sendPickupNotification`.

**Files:**
- Create: `tests/unit/paymentEmailScannerRetune.test.js`
- Modify: `server/services/paymentEmailScanner.js` (three edits + one method deletion)

**Steps:**

- [ ] Write the failing test:

```javascript
// tests/unit/paymentEmailScannerRetune.test.js
// Spec §6.5: widen exact-match 'awaiting' to $in ['awaiting','confirming'];
// verifyAndUpdateOrder runs the canonical ready gate (Path B).
jest.mock('../../server/services/orderReadyGateService', () => ({
  applyReadyGate: jest.fn().mockResolvedValue(undefined)
}));
jest.mock('../../server/services/mailcowService', () => ({
  searchEmails: jest.fn().mockResolvedValue([]),
  markEmailAsProcessed: jest.fn().mockResolvedValue(true)
}));
jest.mock('../../server/utils/emailService', () => ({
  sendAdminNotification: jest.fn().mockResolvedValue(true)
}));

const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const paymentEmailScanner = require('../../server/services/paymentEmailScanner');
const orderReadyGateService = require('../../server/services/orderReadyGateService');
const Order = require('../../server/models/Order');
const Customer = require('../../server/models/Customer');

async function createOrder(overrides = {}) {
  const token = crypto.randomBytes(16).toString('hex');
  return Order.create({
    customerId: 'CUST-scan-1',
    affiliateId: 'AFF-scan-1',
    bagId: 'BAG-' + uuidv4(),
    bagToken: token,
    bags: [{ bagToken: token, bagNumber: 1 }],
    actualWeight: 20,
    status: 'in_progress',
    paymentStatus: 'awaiting',
    paymentAmount: 50,
    paymentRequestedAt: new Date(),
    feeBreakdown: { minimumFee: 10, perBagFee: 2, totalFee: 10, minimumApplied: true },
    ...overrides
  });
}

describe('paymentEmailScanner retune (spec §6.5)', () => {
  beforeEach(() => jest.clearAllMocks());
  afterEach(async () => {
    await Order.deleteMany({});
    await Customer.deleteMany({});
  });

  describe('findOrderById widening', () => {
    it('matches an awaiting order', async () => {
      const order = await createOrder({ paymentStatus: 'awaiting' });
      const found = await paymentEmailScanner.findOrderById(order.orderId);
      expect(found).not.toBeNull();
      expect(found.orderId).toBe(order.orderId);
    });

    it('matches a confirming order (customer self-reported — the regression)', async () => {
      const order = await createOrder({ paymentStatus: 'confirming' });
      const found = await paymentEmailScanner.findOrderById(order.orderId);
      expect(found).not.toBeNull();
      expect(found.orderId).toBe(order.orderId);
    });

    it('does not match a verified order', async () => {
      const order = await createOrder({ paymentStatus: 'verified' });
      const found = await paymentEmailScanner.findOrderById(order.orderId);
      expect(found).toBeNull();
    });
  });

  describe('verifyAndUpdateOrder gate wiring', () => {
    const paymentFor = (order, amount) => ({
      orderId: order.orderId, orderNumber: order.orderId, provider: 'venmo',
      amount, sender: 'Pat Doe', transactionId: 'TX-1',
      emailId: 1, emailSubject: 'paid', emailDate: new Date(), verifiedAt: new Date()
    });

    it('verifies and runs applyReadyGate (Path B)', async () => {
      const order = await createOrder({ status: 'processed', paymentStatus: 'awaiting' });
      const ok = await paymentEmailScanner.verifyAndUpdateOrder(paymentFor(order, 50));
      expect(ok).toBe(true);
      const updated = await Order.findById(order._id);
      expect(updated.paymentStatus).toBe('verified');
      expect(orderReadyGateService.applyReadyGate).toHaveBeenCalledTimes(1);
      expect(orderReadyGateService.applyReadyGate.mock.calls[0][0].orderId).toBe(order.orderId);
      expect(orderReadyGateService.applyReadyGate.mock.calls[0][1]).toEqual({ trigger: 'scanner_verify' });
    });

    it('still verifies an escalated-but-awaiting order (payment after the 8th reminder)', async () => {
      const order = await createOrder({
        status: 'processed', paymentStatus: 'awaiting',
        paymentEscalated: true, heldAtStore: true, holdNoticeSentAt: new Date()
      });
      const ok = await paymentEmailScanner.verifyAndUpdateOrder(paymentFor(order, 50));
      expect(ok).toBe(true);
      expect((await Order.findById(order._id)).paymentStatus).toBe('verified');
      expect(orderReadyGateService.applyReadyGate).toHaveBeenCalledTimes(1);
    });

    it('does not verify or run the gate on underpayment', async () => {
      const order = await createOrder({ status: 'processed', paymentStatus: 'awaiting' });
      const ok = await paymentEmailScanner.verifyAndUpdateOrder(paymentFor(order, 10));
      expect(ok).toBe(false);
      expect((await Order.findById(order._id)).paymentStatus).toBe('awaiting');
      expect(orderReadyGateService.applyReadyGate).not.toHaveBeenCalled();
    });
  });
});
```

- [ ] Run it: `npm test -- tests/unit/paymentEmailScannerRetune.test.js` — expect FAIL: "matches a confirming order" gets `null`; the gate-wiring tests fail on `applyReadyGate` never called (0 calls).
- [ ] Edit 1 — `findOrderById` (current L278–291). Replace:

```javascript
      // Find order with matching orderId and paymentStatus = 'awaiting'
      const order = await Order.findOne({
        orderId: orderId,
        paymentStatus: 'awaiting'
      });
```

with:

```javascript
      // Match awaiting AND confirming — a customer-self-reported ('confirming')
      // order must still be auto-verified (spec §4.4 / §6.5 widening).
      const order = await Order.findOne({
        orderId: orderId,
        paymentStatus: { $in: ['awaiting', 'confirming'] }
      });
```

- [ ] Edit 2 — `processAllPendingPayments` (current L469–472). Replace:

```javascript
      // Get all orders awaiting payment
      const pendingOrders = await Order.find({
        paymentStatus: 'awaiting'
      });
```

with:

```javascript
      // Awaiting AND confirming (spec §6.5 widening)
      const pendingOrders = await Order.find({
        paymentStatus: { $in: ['awaiting', 'confirming'] }
      });
```

- [ ] Edit 3 — `verifyAndUpdateOrder` (current L364–374). Replace:

```javascript
      logger.info(`Payment verified for order ${payment.orderId}`);
      
      // Send payment confirmation to customer
      await this.sendPaymentConfirmation(order);
      
      // If WDF is complete, send pickup notification
      if (order.status === 'processed') {
        await this.sendPickupNotification(order);
      }
      
      return true;
```

with:

```javascript
      logger.info(`Payment verified for order ${payment.orderId}`);

      // Send payment confirmation to customer
      await this.sendPaymentConfirmation(order);

      // Path B (paid-then-processed): run the canonical ready gate. Idempotent;
      // sole writer of readyForPickupAt; sends the affiliate "collect from
      // store" notification itself (spec §6.5). Inline require avoids a cycle
      // if the gate ever pulls in scanner-adjacent modules.
      const orderReadyGateService = require('./orderReadyGateService');
      await orderReadyGateService.applyReadyGate(order, { trigger: 'scanner_verify' });

      return true;
```

- [ ] Edit 4 — delete the now-unused `sendPickupNotification` method (current L405–418, the block starting `/** Send pickup ready notification to affiliate` through its closing `}`). Verify nothing else references it: `grep -rn "sendPickupNotification" server/ tests/ --include=*.js | grep -v paymentVerificationJob` — expect no hits in `paymentEmailScanner.js` (the job's own copy goes away in Task 5; ignore hits there for now, and ignore matches in old job tests that Task 5 rewrites).
- [ ] Re-run: `npm test -- tests/unit/paymentEmailScannerRetune.test.js` — expect PASS (6 tests).
- [ ] Run the scanner's existing suite and fix surgically if it pinned the old exact-match query or the placeholder notification: `npm test -- tests/unit/paymentEmailScanner.test.js`. Intentional behavior changes (widened query, gate call instead of placeholder) get assertion updates in that file, nothing else.
- [ ] Commit:

```bash
git add tests/unit/paymentEmailScannerRetune.test.js server/services/paymentEmailScanner.js tests/unit/paymentEmailScanner.test.js
git commit -m "feat(payments): widen scanner matches to awaiting+confirming and run the ready gate on verify"
```

---

## Task 5 — Rewrite `paymentVerificationJob` (decoupled counters, time-based 60/8 reminders, escalate-and-hold, widened cron query, `payment_scan_interval_ms`) + `AuditEvents.PAYMENT_ESCALATED`

Whole-file rewrite of `server/jobs/paymentVerificationJob.js` per spec §6.5, and a wholesale replacement of `tests/unit/paymentVerificationJob.test.js` (the old file tests attempts-based reminders, fresh-link regeneration, and `failed`-on-timeout — all intentionally removed behavior). The singleton-class shape, `start/stop/runVerification/getStatus/triggerManual` surface, and the `scheduler.js` integration (`server/jobs/scheduler.js:36` calls `paymentVerificationJob.start()`) are preserved.

What changes, mapped to spec bullets:
- **Counters decoupled:** `paymentCheckAttempts` = IMAP detection only (incremented every cron tick); `paymentReminderCount` = reminders, cap `payment_reminder_max_attempts`.
- **`shouldSendReminder(order)` time-based:** false if `paymentEscalated`; false if `paymentReminderCount >= cap`; else due when `(now − (paymentLastReminderAt || paymentRequestedAt)) >= payment_reminder_interval_minutes`.
- **`maybeSendReminderOrHold(order, customer)`:** if due → `sendPaymentReminder` (reuses STORED `paymentLinks`/`paymentQRCodes`; `generatePaymentLinks` is never imported, let alone called) + `paymentReminderCount++` + `paymentLastReminderAt=now`. When count reaches the cap and `!paymentEscalated` → hold notice once (`sendV2ComeToStoreNotice`, guarded by `holdNoticeSentAt` + `payment_hold_notice_enabled`), `paymentEscalated=true`, `heldAtStore=true`, audit `PAYMENT_ESCALATED`, `escalateToAdmin` fired as the admin-visibility hook. **`paymentStatus` is never set to `failed`.**
- **Cron query (the third widening):** `{ paymentStatus: { $in: ['awaiting','confirming'] }, status: { $in: ['in_progress','processed'] }, paymentEscalated: { $ne: true } }`. The escalation filter is on the reminder path only — `scanForPayments` still scans the whole inbox, so a post-escalation payment verifies via the scanner (Task 4).
- **Scan cadence** from `payment_scan_interval_ms` (default 120000); `payment_check_interval`/`payment_check_max_attempts` are no longer read.
- **On successful verify → `applyReadyGate`** (Path B; idempotent on top of the scanner's own gate call).
- **`escalateToAdmin` repurposed:** sends the existing `sendV2PaymentTimeoutEscalation` dispatcher for real (the old code only logged a placeholder), keyed off `paymentReminderCount`, fired alongside the hold notice — no longer implies failure. Old `sendPickupNotification`/`sendReminderEmail` methods deleted (the gate owns the ready notification; the dispatcher owns the email body).

**Files:**
- Modify: `server/utils/auditLogger.js` — add `PAYMENT_ESCALATED` to `AuditEvents` (after `PAYMENT_PROCESSED: 'PAYMENT_PROCESSED',` in the `// Financial events` group, current main ~L79)
- Rewrite: `tests/unit/paymentVerificationJob.test.js`
- Rewrite: `server/jobs/paymentVerificationJob.js`

**Steps:**

- [ ] Add the audit constant. In `server/utils/auditLogger.js`, in the `AuditEvents` object's `// Financial events` group, after the line `PAYMENT_PROCESSED: 'PAYMENT_PROCESSED',` add:

```javascript
  PAYMENT_ESCALATED: 'PAYMENT_ESCALATED',
```

- [ ] Replace `tests/unit/paymentVerificationJob.test.js` wholesale with:

```javascript
// tests/unit/paymentVerificationJob.test.js
// Rewritten for the spec §6.5 retune: decoupled detection/reminder counters,
// time-based 60-min reminders capped at 8, escalate-and-hold (never 'failed'),
// widened cron query, stored-links reuse, applyReadyGate on verify.
jest.mock('../../server/services/paymentEmailScanner', () => ({
  scanForPayments: jest.fn().mockResolvedValue([]),
  checkOrderPayment: jest.fn().mockResolvedValue(false)
}));
jest.mock('../../server/services/paymentLinkService', () => ({
  generatePaymentLinks: jest.fn()
}));
jest.mock('../../server/services/orderReadyGateService', () => ({
  applyReadyGate: jest.fn().mockResolvedValue(undefined)
}));
jest.mock('../../server/utils/emailService', () => ({
  sendV2PaymentReminder: jest.fn().mockResolvedValue(true),
  sendV2ComeToStoreNotice: jest.fn().mockResolvedValue(true),
  sendV2PaymentTimeoutEscalation: jest.fn().mockResolvedValue(true)
}));
jest.mock('../../server/utils/auditLogger', () => ({
  logAuditEvent: jest.fn(),
  AuditEvents: { PAYMENT_ESCALATED: 'PAYMENT_ESCALATED' }
}));

const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const paymentVerificationJob = require('../../server/jobs/paymentVerificationJob');
const paymentEmailScanner = require('../../server/services/paymentEmailScanner');
const paymentLinkService = require('../../server/services/paymentLinkService');
const orderReadyGateService = require('../../server/services/orderReadyGateService');
const emailService = require('../../server/utils/emailService');
const { logAuditEvent } = require('../../server/utils/auditLogger');
const Order = require('../../server/models/Order');
const Customer = require('../../server/models/Customer');
const Affiliate = require('../../server/models/Affiliate');
const SystemConfig = require('../../server/models/SystemConfig');

const HOUR = 60 * 60 * 1000;
let testAffiliate;
let testCustomer;

async function createAwaitingOrder(overrides = {}) {
  const token = crypto.randomBytes(16).toString('hex');
  return Order.create({
    customerId: testCustomer.customerId,
    affiliateId: testAffiliate.affiliateId,
    bagId: 'BAG-' + uuidv4(),
    bagToken: token,
    bags: [{ bagToken: token, bagNumber: 1 }],
    actualWeight: 20,
    status: 'in_progress',
    paymentStatus: 'awaiting',
    paymentAmount: 50,
    paymentRequestedAt: new Date(Date.now() - 2 * HOUR),
    paymentLinks: { venmo: 'venmo://stored', paypal: 'https://paypal.me/stored', cashapp: 'https://cash.app/stored' },
    paymentQRCodes: { venmo: 'data:image/png;base64,v', paypal: 'data:image/png;base64,p', cashapp: 'data:image/png;base64,c' },
    feeBreakdown: { minimumFee: 10, perBagFee: 2, totalFee: 10, minimumApplied: true },
    ...overrides
  });
}

describe('PaymentVerificationJob (spec §6.5 retune)', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    // Deterministic instance config (start() would read the same from SystemConfig)
    paymentVerificationJob.scanIntervalMs = 120000;
    paymentVerificationJob.reminderIntervalMinutes = 60;
    paymentVerificationJob.maxReminders = 8;
    paymentVerificationJob.holdNoticeEnabled = true;

    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync('testpass123', salt, 1000, 64, 'sha512').toString('hex');
    testAffiliate = await Affiliate.create({
      firstName: 'Test', lastName: 'Affiliate', email: 'affiliate@test.com', phone: '555-0001',
      address: '123 Test St', city: 'Austin', state: 'TX', zipCode: '78753',
      username: `affiliate${Date.now()}`, passwordHash: hash, passwordSalt: salt, paymentMethod: 'check'
    });
    testCustomer = await Customer.create({
      firstName: 'Test', lastName: 'Customer', email: 'customer@test.com', phone: '555-0002',
      address: '456 Customer St', city: 'Austin', state: 'TX', zipCode: '78753',
      username: `customer${Date.now()}`, passwordHash: hash, passwordSalt: salt,
      affiliateId: testAffiliate.affiliateId
    });
  });

  afterEach(async () => {
    paymentVerificationJob.stop();
    await Order.deleteMany({});
    await Customer.deleteMany({});
    await Affiliate.deleteMany({});
  });

  describe('start()', () => {
    it('reads the retuned SystemConfig keys (payment_scan_interval_ms, not payment_check_interval)', async () => {
      await paymentVerificationJob.start();
      expect(paymentVerificationJob.scanIntervalMs).toBe(120000);
      expect(paymentVerificationJob.reminderIntervalMinutes).toBe(60);
      expect(paymentVerificationJob.maxReminders).toBe(8);
      expect(paymentVerificationJob.job).not.toBeNull();
    });
  });

  describe('shouldSendReminder (time-based)', () => {
    it('is false when escalated, capped, not yet due, or without a clock base', () => {
      const job = paymentVerificationJob;
      const twoHoursAgo = new Date(Date.now() - 2 * HOUR);
      expect(job.shouldSendReminder({ paymentEscalated: true, paymentReminderCount: 0, paymentRequestedAt: twoHoursAgo })).toBe(false);
      expect(job.shouldSendReminder({ paymentReminderCount: 8, paymentRequestedAt: twoHoursAgo })).toBe(false);
      expect(job.shouldSendReminder({ paymentReminderCount: 0, paymentRequestedAt: new Date(Date.now() - 59 * 60 * 1000) })).toBe(false);
      expect(job.shouldSendReminder({ paymentReminderCount: 0 })).toBe(false);
    });

    it('is true once the interval elapses, clocked from the LAST reminder when one exists', () => {
      const job = paymentVerificationJob;
      expect(job.shouldSendReminder({ paymentReminderCount: 0, paymentRequestedAt: new Date(Date.now() - 61 * 60 * 1000) })).toBe(true);
      // requested 4h ago but reminded 30min ago -> not due
      expect(job.shouldSendReminder({
        paymentReminderCount: 3,
        paymentRequestedAt: new Date(Date.now() - 4 * HOUR),
        paymentLastReminderAt: new Date(Date.now() - 30 * 60 * 1000)
      })).toBe(false);
    });
  });

  describe('maybeSendReminderOrHold', () => {
    it('sends a due reminder reusing STORED links and never calls generatePaymentLinks', async () => {
      const order = await createAwaitingOrder();
      await paymentVerificationJob.maybeSendReminderOrHold(order, testCustomer);
      await order.save();

      expect(emailService.sendV2PaymentReminder).toHaveBeenCalledTimes(1);
      const args = emailService.sendV2PaymentReminder.mock.calls[0][0];
      expect(args.reminderNumber).toBe(1);
      expect(args.maxReminders).toBe(8);
      expect(args.paymentLinks.venmo).toBe('venmo://stored');
      expect(args.qrCodes.venmo).toBe('data:image/png;base64,v');
      expect(paymentLinkService.generatePaymentLinks).not.toHaveBeenCalled();

      const updated = await Order.findById(order._id);
      expect(updated.paymentReminderCount).toBe(1);
      expect(updated.paymentLastReminderAt).toBeInstanceOf(Date);
      expect(updated.paymentEscalated).toBe(false);
    });

    it('does nothing when not due', async () => {
      const order = await createAwaitingOrder({ paymentLastReminderAt: new Date(Date.now() - 10 * 60 * 1000), paymentReminderCount: 2 });
      await paymentVerificationJob.maybeSendReminderOrHold(order, testCustomer);
      expect(emailService.sendV2PaymentReminder).not.toHaveBeenCalled();
      expect(emailService.sendV2ComeToStoreNotice).not.toHaveBeenCalled();
    });

    it('8th reminder escalates: come-to-store once, flags set, admin hook, audit, stays awaiting (NEVER failed)', async () => {
      const order = await createAwaitingOrder({
        status: 'processed',
        paymentReminderCount: 7,
        paymentLastReminderAt: new Date(Date.now() - 2 * HOUR)
      });
      await paymentVerificationJob.maybeSendReminderOrHold(order, testCustomer);
      await order.save();

      expect(emailService.sendV2PaymentReminder).toHaveBeenCalledTimes(1); // reminder #8
      expect(emailService.sendV2ComeToStoreNotice).toHaveBeenCalledTimes(1);
      expect(emailService.sendV2PaymentTimeoutEscalation).toHaveBeenCalledTimes(1); // admin-visibility hook
      expect(logAuditEvent).toHaveBeenCalledWith('PAYMENT_ESCALATED', expect.objectContaining({ orderId: order.orderId }));

      const updated = await Order.findById(order._id);
      expect(updated.paymentReminderCount).toBe(8);
      expect(updated.paymentEscalated).toBe(true);
      expect(updated.holdNoticeSentAt).toBeInstanceOf(Date);
      expect(updated.heldAtStore).toBe(true);
      expect(updated.paymentStatus).toBe('awaiting'); // never 'failed'
    });

    it('escalated orders never get another reminder or a second hold notice', async () => {
      const order = await createAwaitingOrder({
        paymentEscalated: true, heldAtStore: true,
        holdNoticeSentAt: new Date(), paymentReminderCount: 8,
        paymentLastReminderAt: new Date(Date.now() - 5 * HOUR)
      });
      await paymentVerificationJob.maybeSendReminderOrHold(order, testCustomer);
      expect(emailService.sendV2PaymentReminder).not.toHaveBeenCalled();
      expect(emailService.sendV2ComeToStoreNotice).not.toHaveBeenCalled();
      expect(emailService.sendV2PaymentTimeoutEscalation).not.toHaveBeenCalled();
    });

    it('payment_hold_notice_enabled=false suppresses the notice but still escalates and holds', async () => {
      paymentVerificationJob.holdNoticeEnabled = false;
      const order = await createAwaitingOrder({
        paymentReminderCount: 7,
        paymentLastReminderAt: new Date(Date.now() - 2 * HOUR)
      });
      await paymentVerificationJob.maybeSendReminderOrHold(order, testCustomer);
      await order.save();
      expect(emailService.sendV2ComeToStoreNotice).not.toHaveBeenCalled();
      const updated = await Order.findById(order._id);
      expect(updated.paymentEscalated).toBe(true);
      expect(updated.heldAtStore).toBe(true);
      expect(updated.holdNoticeSentAt).toBeUndefined();
    });
  });

  describe('checkPendingPayments cron query', () => {
    it('includes awaiting/in_progress and confirming/processed; excludes escalated, verified, and post-processed statuses', async () => {
      const included1 = await createAwaitingOrder({ status: 'in_progress', paymentStatus: 'awaiting' });
      const included2 = await createAwaitingOrder({ status: 'processed', paymentStatus: 'confirming' });
      await createAwaitingOrder({ status: 'processed', paymentStatus: 'awaiting', paymentEscalated: true });
      await createAwaitingOrder({ status: 'processed', paymentStatus: 'verified' });
      await createAwaitingOrder({ status: 'ready_for_pickup', paymentStatus: 'awaiting' });

      const spy = jest.spyOn(paymentVerificationJob, 'processOrder').mockResolvedValue(undefined);
      await paymentVerificationJob.checkPendingPayments();

      const processedIds = spy.mock.calls.map(([o]) => o.orderId).sort();
      expect(processedIds).toEqual([included1.orderId, included2.orderId].sort());
      spy.mockRestore();
    });
  });

  describe('processOrder', () => {
    it('on verify: runs applyReadyGate with trigger payment_verified and sends no reminder', async () => {
      const order = await createAwaitingOrder({ status: 'processed' });
      paymentEmailScanner.checkOrderPayment.mockResolvedValue(true);

      await paymentVerificationJob.processOrder(order);

      expect(orderReadyGateService.applyReadyGate).toHaveBeenCalledTimes(1);
      expect(orderReadyGateService.applyReadyGate.mock.calls[0][0].orderId).toBe(order.orderId);
      expect(orderReadyGateService.applyReadyGate.mock.calls[0][1]).toEqual({ trigger: 'payment_verified' });
      expect(emailService.sendV2PaymentReminder).not.toHaveBeenCalled();
    });

    it('on no-payment: increments ONLY the detection counter and never flips to failed', async () => {
      const order = await createAwaitingOrder({
        paymentCheckAttempts: 999,                       // huge detection count is irrelevant
        paymentLastReminderAt: new Date(Date.now() - 10 * 60 * 1000), // reminder not due
        paymentReminderCount: 2
      });
      paymentEmailScanner.checkOrderPayment.mockResolvedValue(false);

      await paymentVerificationJob.processOrder(order);

      const updated = await Order.findById(order._id);
      expect(updated.paymentCheckAttempts).toBe(1000);   // detection counter
      expect(updated.paymentReminderCount).toBe(2);      // reminder counter untouched
      expect(updated.paymentStatus).toBe('awaiting');    // NEVER 'failed'
      expect(emailService.sendV2PaymentReminder).not.toHaveBeenCalled();
    });
  });
});
```

- [ ] Run it: `npm test -- tests/unit/paymentVerificationJob.test.js` — expect FAIL across the board for the right reasons: `start()` still reads `payment_check_interval` (so `scanIntervalMs` is `undefined`), `shouldSendReminder` is attempts-based (`(attempts - 6) % 12`), `maybeSendReminderOrHold` doesn't exist (`TypeError: ... is not a function`), the cron query is the old exact-match + old status names, and `processOrder` regenerates links / can set `failed`.
- [ ] Rewrite `server/jobs/paymentVerificationJob.js` with exactly:

```javascript
/**
 * Payment Verification Cron Job — retuned per the redesign spec §6.5.
 *
 * Two decoupled cadences:
 *  - DETECTION: every cron tick (payment_scan_interval_ms, default 2 min) the
 *    IMAP scanner looks for inbound payment emails. `paymentCheckAttempts`
 *    counts detection scans only.
 *  - REMINDERS: time-based, every payment_reminder_interval_minutes (default
 *    60), capped at payment_reminder_max_attempts (default 8).
 *    `paymentReminderCount` is the authoritative reminder counter.
 *
 * After the final reminder the order escalates: one "come to the store"
 * notice (sendV2ComeToStoreNotice, guarded by holdNoticeSentAt and the
 * payment_hold_notice_enabled master switch), paymentEscalated=true,
 * heldAtStore=true, admin-visibility hook (escalateToAdmin), audit event.
 * paymentStatus is NEVER set to 'failed' — the inbox keeps being scanned and
 * a late payment still verifies and promotes through applyReadyGate (Path B).
 *
 * Runs on the leader box only (RUN_BACKGROUND_JOBS gate in scheduler.js).
 */

const cron = require('node-cron');
const Order = require('../models/Order');
const Customer = require('../models/Customer');
const SystemConfig = require('../models/SystemConfig');
const paymentEmailScanner = require('../services/paymentEmailScanner');
const orderReadyGateService = require('../services/orderReadyGateService');
const emailService = require('../utils/emailService');
const logger = require('../utils/logger');
const { logAuditEvent, AuditEvents } = require('../utils/auditLogger');

class PaymentVerificationJob {
  constructor() {
    this.running = false;
    this.job = null;
    this.scanIntervalMs = 120000;       // payment_scan_interval_ms
    this.reminderIntervalMinutes = 60;  // payment_reminder_interval_minutes
    this.maxReminders = 8;              // payment_reminder_max_attempts
    this.holdNoticeEnabled = true;      // payment_hold_notice_enabled
  }

  /**
   * Initialize config from SystemConfig and start the cron schedule.
   */
  async start() {
    try {
      this.scanIntervalMs = await SystemConfig.getValue('payment_scan_interval_ms', 120000);
      this.reminderIntervalMinutes = await SystemConfig.getValue('payment_reminder_interval_minutes', 60);
      this.maxReminders = await SystemConfig.getValue('payment_reminder_max_attempts', 8);
      this.holdNoticeEnabled = await SystemConfig.getValue('payment_hold_notice_enabled', true);

      const intervalMinutes = Math.max(1, Math.round(this.scanIntervalMs / 60000));
      const cronPattern = `*/${intervalMinutes} * * * *`;

      logger.info(`Starting payment verification job - scan every ${intervalMinutes} min, reminders every ${this.reminderIntervalMinutes} min, cap ${this.maxReminders}`);

      this.job = cron.schedule(cronPattern, async () => {
        await this.runVerification();
      });

      // Run immediately on startup
      await this.runVerification();

      logger.info('Payment verification job started successfully');
    } catch (error) {
      logger.error('Error starting payment verification job:', error);
    }
  }

  stop() {
    if (this.job) {
      this.job.stop();
      this.job = null;
      logger.info('Payment verification job stopped');
    }
  }

  /**
   * One tick: scan the inbox (detection), then walk pending orders
   * (per-order detection + reminder cadence).
   */
  async runVerification() {
    if (this.running) {
      logger.info('Payment verification already running, skipping...');
      return;
    }

    this.running = true;
    const startTime = Date.now();

    try {
      // Inbox-wide scan first — this path has NO escalation filter, so a
      // post-escalation payment still verifies (spec §6.5).
      const scannedPayments = await paymentEmailScanner.scanForPayments();
      if (scannedPayments.length > 0) {
        logger.info(`Verified ${scannedPayments.length} payments from email scan`);
      }

      await this.checkPendingPayments();

      logger.info(`Payment verification completed in ${Date.now() - startTime}ms`);
    } catch (error) {
      logger.error('Error in payment verification job:', error);
    } finally {
      this.running = false;
    }
  }

  /**
   * Orders still on the reminder cadence. Escalated orders are excluded —
   * they only leave the held state via the scanner/manual verify paths.
   */
  async checkPendingPayments() {
    try {
      const pendingOrders = await Order.find({
        paymentStatus: { $in: ['awaiting', 'confirming'] },
        status: { $in: ['in_progress', 'processed'] },
        paymentEscalated: { $ne: true }
      });

      if (pendingOrders.length === 0) {
        return;
      }

      logger.info(`Found ${pendingOrders.length} orders awaiting payment`);

      for (const order of pendingOrders) {
        try {
          await this.processOrder(order);
        } catch (error) {
          logger.error(`Error processing order ${order._id}:`, error);
        }
      }
    } catch (error) {
      logger.error('Error checking pending payments:', error);
    }
  }

  /**
   * Per-order tick: one targeted IMAP detection check, then the time-based
   * reminder/escalation cadence. Never sets paymentStatus='failed'.
   */
  async processOrder(order) {
    try {
      if (order.paymentStatus === 'verified') {
        return;
      }

      const customer = await Customer.findOne({ customerId: order.customerId });
      if (!customer) {
        return;
      }

      // DETECTION — targeted check for this order's payment email.
      const verified = await paymentEmailScanner.checkOrderPayment(order._id);
      if (verified) {
        logger.info(`Payment verified for order ${order._id}`);
        // Path B: run the canonical gate on a fresh document (idempotent;
        // the scanner's verifyAndUpdateOrder also gates — double-gating is a
        // deliberate no-op by design).
        const fresh = await Order.findById(order._id);
        if (fresh) {
          await orderReadyGateService.applyReadyGate(fresh, { trigger: 'payment_verified' });
        }
        return;
      }

      order.paymentCheckAttempts = (order.paymentCheckAttempts || 0) + 1; // detection counter ONLY
      order.lastPaymentCheck = new Date();

      // REMINDERS — time-based cadence + escalation.
      await this.maybeSendReminderOrHold(order, customer);

      await order.save();
    } catch (error) {
      logger.error(`Error processing order ${order._id}:`, error);
    }
  }

  /**
   * Time-based reminder gate (spec §6.5):
   *  - never when escalated
   *  - never past the cap
   *  - due when the interval has elapsed since the last reminder
   *    (or since paymentRequestedAt when none was sent yet).
   */
  shouldSendReminder(order) {
    if (order.paymentEscalated) {
      return false;
    }
    if ((order.paymentReminderCount || 0) >= this.maxReminders) {
      return false;
    }
    const clockBase = order.paymentLastReminderAt || order.paymentRequestedAt;
    if (!clockBase) {
      return false;
    }
    const elapsedMs = Date.now() - new Date(clockBase).getTime();
    return elapsedMs >= this.reminderIntervalMinutes * 60 * 1000;
  }

  /**
   * Send a due reminder; when the count reaches the cap, escalate-and-hold
   * exactly once. Mutates `order`; the caller saves.
   */
  async maybeSendReminderOrHold(order, customer) {
    if (this.shouldSendReminder(order)) {
      await this.sendPaymentReminder(order, customer);
    }
    if ((order.paymentReminderCount || 0) >= this.maxReminders && !order.paymentEscalated) {
      await this.escalateAndHold(order, customer);
    }
  }

  /**
   * Send one reminder reusing the STORED paymentLinks/paymentQRCodes generated
   * once at intake — links are never regenerated (spec §6.4/§6.5).
   */
  async sendPaymentReminder(order, customer) {
    try {
      if (!customer || !customer.email) {
        logger.error('Cannot send reminder - customer not found or email missing');
        return;
      }

      const reminderNumber = (order.paymentReminderCount || 0) + 1;

      await emailService.sendV2PaymentReminder({
        customer,
        order,
        reminderNumber,
        paymentAmount: order.paymentAmount,
        paymentLinks: order.paymentLinks,
        qrCodes: order.paymentQRCodes,
        maxReminders: this.maxReminders
      });

      order.paymentReminderCount = reminderNumber;
      order.paymentLastReminderAt = new Date();
      order.paymentReminders.push({ sentAt: new Date(), reminderNumber, method: 'email' });

      logger.info(`Payment reminder #${reminderNumber}/${this.maxReminders} sent to ${customer.email} for order ${order.orderId}`);
    } catch (error) {
      logger.error('Error sending payment reminder:', error);
    }
  }

  /**
   * Escalate after the final reminder: one come-to-store notice (master
   * switch payment_hold_notice_enabled; double-send guarded by
   * holdNoticeSentAt), flags, audit, admin hook. Mutates `order`; caller saves.
   */
  async escalateAndHold(order, customer) {
    try {
      if (this.holdNoticeEnabled && !order.holdNoticeSentAt && customer && customer.email) {
        await emailService.sendV2ComeToStoreNotice({ customer, order });
        order.holdNoticeSentAt = new Date();
      }

      order.paymentEscalated = true;
      order.heldAtStore = true; // physically held until payment verifies

      logAuditEvent(AuditEvents.PAYMENT_ESCALATED, {
        orderId: order.orderId,
        paymentReminderCount: order.paymentReminderCount,
        holdNoticeSentAt: order.holdNoticeSentAt
      });

      await this.escalateToAdmin(order);

      logger.info(`Order ${order.orderId} escalated after ${order.paymentReminderCount} reminders - held at store, paymentStatus stays '${order.paymentStatus}'`);
    } catch (error) {
      logger.error('Error escalating order:', error);
    }
  }

  /**
   * Admin-visibility hook fired alongside the hold notice (spec §6.5).
   * No longer implies failure — paymentStatus is never set to 'failed'.
   */
  async escalateToAdmin(order) {
    try {
      const Affiliate = require('../models/Affiliate');
      const customer = await Customer.findOne({ customerId: order.customerId });
      const affiliate = await Affiliate.findOne({ affiliateId: order.affiliateId });
      const adminEmail = await SystemConfig.getValue('admin_notification_email', 'admin@wavemax.promo');

      const hoursSinceRequest = order.paymentRequestedAt
        ? Math.round((Date.now() - order.paymentRequestedAt.getTime()) / (1000 * 60 * 60))
        : 0;

      const escalationDetails = {
        orderId: order.orderId,
        orderMongoId: order._id,
        customerName: customer ? `${customer.firstName} ${customer.lastName}` : 'Unknown',
        customerEmail: customer?.email || 'Unknown',
        customerPhone: customer?.phone || 'Unknown',
        affiliateName: affiliate ? `${affiliate.firstName} ${affiliate.lastName}` : 'Unknown',
        affiliateEmail: affiliate?.email || 'Unknown',
        paymentAmount: order.paymentAmount || order.actualTotal || 'Unknown',
        hoursSinceRequest,
        paymentRequestedAt: order.paymentRequestedAt,
        attemptsMade: order.paymentReminderCount || 0
      };

      await emailService.sendV2PaymentTimeoutEscalation(order, adminEmail, escalationDetails);
      logger.info(`Admin escalation sent to ${adminEmail} for order ${order.orderId}`);
    } catch (error) {
      logger.error('Error escalating to admin:', error);
    }
  }

  getStatus() {
    return {
      running: this.running,
      scheduled: this.job !== null,
      scanIntervalMs: this.scanIntervalMs,
      reminderIntervalMinutes: this.reminderIntervalMinutes,
      maxReminders: this.maxReminders
    };
  }

  /**
   * Manually trigger verification (admin/testing).
   */
  async triggerManual() {
    logger.info('Manual payment verification triggered');
    await this.runVerification();
  }
}

// Singleton
const paymentVerificationJob = new PaymentVerificationJob();

module.exports = paymentVerificationJob;
```

- [ ] Re-run: `npm test -- tests/unit/paymentVerificationJob.test.js` — expect PASS (10 tests).
- [ ] Dangling-reference sweep (the rewrite removed `sendReminderEmail`, `sendPickupNotification`, `checkInterval`, `maxAttempts`):

```bash
grep -rn "payment_check_interval\|payment_check_max_attempts" server/ | grep -v node_modules   # expect: no hits
grep -rn "sendReminderEmail\|paymentVerificationJob.sendPickupNotification" server/ tests/ --include=*.js   # expect: no hits
grep -rn "\.checkInterval\|\.maxAttempts" server/ tests/ --include=*.js | grep -i payment   # expect: no hits (getStatus consumers)
grep -rn "generatePaymentLinks" server/jobs/ --include=*.js   # expect: no hits — links generated only at intake (PR 7)
```

- [ ] Run the touching suites: `npm test -- tests/unit/paymentVerificationJob.test.js tests/unit/paymentEmailScannerRetune.test.js tests/unit/paymentEmailScanner.test.js` — expect PASS. Then run any integration suites that exercised the old job behavior (e.g. `npm test -- tests/integration/v2-payment-flow.test.js tests/integration/v2-complete-payment-flow.test.js`) and apply surgical assertion updates ONLY where they pinned removed behavior (attempts-based reminders, fresh-link regeneration, `failed` on timeout, old `getStatus` keys).
- [ ] Commit:

```bash
git add server/jobs/paymentVerificationJob.js tests/unit/paymentVerificationJob.test.js server/utils/auditLogger.js tests/integration/v2-payment-flow.test.js tests/integration/v2-complete-payment-flow.test.js
git commit -m "feat(payments): rewrite paymentVerificationJob — 60-min/8-cap reminders, escalate-and-hold, scan-interval config"
```

---

## Task 6 — `orderController`: `confirmPayment` stops escalating; `verifyPaymentManually` confirmed wired to the gate

Spec §6.5: "`confirmPayment` no longer calls `escalateToAdmin`" (the customer clicking "already paid?" is normal flow, not an incident) and "both verify paths call `applyReadyGate`" — PR 4 should already have wired `verifyPaymentManually`; this task proves it with an integration test and wires it if PR 4 missed it. This task also creates `tests/integration/payment-ready-gate.test.js`, which Task 7 extends.

**Files:**
- Create: `tests/integration/payment-ready-gate.test.js`
- Modify: `server/controllers/orderController.js` — `confirmPayment` (escalate call at current main L936–938) and, only if needed, `verifyPaymentManually` (placeholder block at current main L998–1006)

**Steps:**

- [ ] Create the integration file with the shared scaffolding and the two controller tests:

```javascript
// tests/integration/payment-ready-gate.test.js
// PR 8 integration: both verify paths run the canonical ready gate; the
// reminder cadence escalates-and-holds; confirmPayment no longer escalates.
// Real scanner + real gate + real dispatchers (console transport); only the
// IMAP/mailcow leaf services are mocked.
jest.setTimeout(90000);

jest.mock('../../server/services/mailcowService', () => ({
  searchEmails: jest.fn().mockResolvedValue([]),
  markEmailAsProcessed: jest.fn().mockResolvedValue(true)
}));
jest.mock('../../server/services/imapEmailScanner', () => ({
  connect: jest.fn().mockResolvedValue(false),
  getUnreadEmails: jest.fn().mockResolvedValue([]),
  markAsRead: jest.fn().mockResolvedValue(true),
  disconnect: jest.fn()
}));

const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const app = require('../../server');
const Order = require('../../server/models/Order');
const Customer = require('../../server/models/Customer');
const Affiliate = require('../../server/models/Affiliate');
const Administrator = require('../../server/models/Administrator');
const mailcowService = require('../../server/services/mailcowService');
const paymentEmailScanner = require('../../server/services/paymentEmailScanner');
const paymentVerificationJob = require('../../server/jobs/paymentVerificationJob');
const orderReadyGateService = require('../../server/services/orderReadyGateService');
const emailService = require('../../server/utils/emailService');
const encryptionUtil = require('../../server/utils/encryption');
const { getCsrfToken, createAgent } = require('../helpers/csrfHelper');

const HOUR = 60 * 60 * 1000;
let agent;
let csrfToken;
let adminToken;
let testAffiliate;
let testCustomer;

async function createOrder(overrides = {}) {
  const token = crypto.randomBytes(16).toString('hex');
  return Order.create({
    customerId: testCustomer.customerId,
    affiliateId: testAffiliate.affiliateId,
    bagId: 'BAG-' + uuidv4(),
    bagToken: token,
    bags: [{ bagToken: token, bagNumber: 1 }],
    actualWeight: 20,
    status: 'in_progress',
    paymentStatus: 'awaiting',
    paymentAmount: 50,
    paymentRequestedAt: new Date(Date.now() - 2 * HOUR),
    paymentLinks: { venmo: 'venmo://stored', paypal: 'https://paypal.me/stored', cashapp: 'https://cash.app/stored' },
    paymentQRCodes: { venmo: 'data:image/png;base64,v', paypal: 'data:image/png;base64,p', cashapp: 'data:image/png;base64,c' },
    feeBreakdown: { minimumFee: 10, perBagFee: 2, totalFee: 10, minimumApplied: true },
    ...overrides
  });
}

// A Venmo notification email that the real parser matches for `order`:
// amount pattern /\$\s*(\d+)\s*[\.\n\s]+(\d{2})/, note pattern
// /WaveMAX\s+Order\s+(ORD-[uuid])/, sender /([A-Za-z\s]+)\s+paid\s+you/.
function venmoEmailFor(order, dollars = '50', cents = '00') {
  return {
    uid: 1,
    id: 1,
    from: 'Venmo <venmo@venmo.com>',
    fromAddress: 'venmo@venmo.com',
    subject: 'John Smith paid you',
    date: new Date().toISOString(),
    text: `John Smith paid you $ ${dollars} . ${cents}\nNote: WaveMAX Order ${order.orderId}\nTransaction ID 1234567890`
  };
}

describe('Payment ready gate (PR 8 integration)', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    mailcowService.searchEmails.mockResolvedValue([]);
    paymentVerificationJob.reminderIntervalMinutes = 60;
    paymentVerificationJob.maxReminders = 8;
    paymentVerificationJob.holdNoticeEnabled = true;

    agent = createAgent(app);
    csrfToken = await getCsrfToken(app, agent);

    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync('testpass123', salt, 1000, 64, 'sha512').toString('hex');
    testAffiliate = await Affiliate.create({
      firstName: 'Gate', lastName: 'Affiliate', email: 'gate-affiliate@test.com', phone: '555-0001',
      address: '123 Test St', city: 'Austin', state: 'TX', zipCode: '78753',
      username: `gateaff${Date.now()}`, passwordHash: hash, passwordSalt: salt, paymentMethod: 'check'
    });
    testCustomer = await Customer.create({
      firstName: 'Gate', lastName: 'Customer', email: 'gate-customer@test.com', phone: '555-0002',
      address: '456 Customer St', city: 'Austin', state: 'TX', zipCode: '78753',
      username: `gatecust${Date.now()}`, passwordHash: hash, passwordSalt: salt,
      affiliateId: testAffiliate.affiliateId
    });

    // Admin for the manual-verify path
    const adminPw = encryptionUtil.hashPassword('GateAdmin2026!Strong');
    await Administrator.create({
      adminId: 'ADM-PR8-1', firstName: 'Gate', lastName: 'Admin',
      email: 'gate-admin@test.com', passwordSalt: adminPw.salt, passwordHash: adminPw.hash,
      permissions: ['all'], isActive: true
    });
    const loginRes = await agent
      .post('/api/v1/auth/administrator/login')
      .set('x-csrf-token', csrfToken)
      .send({ email: 'gate-admin@test.com', password: 'GateAdmin2026!Strong' });
    adminToken = loginRes.body.token;
  });

  afterEach(async () => {
    await Order.deleteMany({});
    await Customer.deleteMany({});
    await Affiliate.deleteMany({});
    await Administrator.deleteMany({});
  });

  describe('confirmPayment (customer "already paid?")', () => {
    it('marks the order confirming WITHOUT escalating to admin (spec §6.5)', async () => {
      const escalateSpy = jest.spyOn(paymentVerificationJob, 'escalateToAdmin');
      const order = await createOrder({ status: 'in_progress', paymentStatus: 'awaiting' });

      const res = await agent
        .post('/api/v1/orders/confirm-payment')
        .set('x-csrf-token', csrfToken)
        .send({ orderId: order._id.toString(), paymentMethod: 'venmo', paymentDetails: 'paid via app' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const updated = await Order.findById(order._id);
      expect(updated.paymentStatus).toBe('confirming');
      expect(escalateSpy).not.toHaveBeenCalled();
      escalateSpy.mockRestore();
    });
  });

  describe('verifyPaymentManually (admin)', () => {
    it('verifies a processed order and promotes it through the gate', async () => {
      const order = await createOrder({ status: 'processed', paymentStatus: 'awaiting', heldAtStore: true });

      const res = await agent
        .put(`/api/v1/orders/${order._id}/verify-payment`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-csrf-token', csrfToken)
        .send({ transactionId: 'MANUAL-TEST-1', notes: 'verified by phone' });

      expect(res.status).toBe(200);
      const updated = await Order.findById(order._id);
      expect(updated.paymentStatus).toBe('verified');
      expect(updated.status).toBe('ready_for_pickup');
      expect(updated.readyForPickupAt).toBeInstanceOf(Date);
      expect(updated.heldAtStore).toBe(false);
    });
  });
});
```

- [ ] Run it: `npm test -- tests/integration/payment-ready-gate.test.js` — expect FAIL: the confirmPayment test fails on `expect(escalateSpy).not.toHaveBeenCalled()` (current code calls it at L936–938). The manual-verify test PASSES if PR 4 wired the gate; if it FAILS on `expect(updated.status).toBe('ready_for_pickup')` (got `'processed'`), PR 4 missed the wiring — apply the `verifyPaymentManually` edit below.
- [ ] Edit `confirmPayment`. In `server/controllers/orderController.js`, delete these three lines (current main L936–938):

```javascript
    // Immediately escalate to admin for manual verification
    const paymentVerificationJob = require('../jobs/paymentVerificationJob');
    await paymentVerificationJob.escalateToAdmin(order);
```

The immediate scanner check right below them stays:

```javascript
    // Also trigger an immediate payment check
    const paymentEmailScanner = require('../services/paymentEmailScanner');
    const verified = await paymentEmailScanner.checkOrderPayment(order._id);
```

The response body (`escalated: true`) is intentionally unchanged — it is a client contract meaning "queued for verification," and `tests/unit/v2ControllerLogic.test.js:297` pins it. Only the side effect is removed.

- [ ] Edit `verifyPaymentManually` **only if its test failed**. Replace the placeholder block (current main L998–1006):

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

with:

```javascript
    // Run the canonical ready gate (Path B). Idempotent; sole writer of
    // readyForPickupAt; sends the affiliate notification itself (spec §6.5).
    const orderReadyGateService = require('../services/orderReadyGateService');
    await orderReadyGateService.applyReadyGate(order, { trigger: 'manual_verify' });
```

- [ ] Re-run: `npm test -- tests/integration/payment-ready-gate.test.js` — expect PASS (2 tests).
- [ ] Confirm no other caller still leans on confirm-time escalation: `grep -rn "escalateToAdmin" server/ --include=*.js | grep -v node_modules` — expect hits ONLY inside `server/jobs/paymentVerificationJob.js` (definition + `escalateAndHold` call).
- [ ] Run the controller's existing suites: `npm test -- tests/unit/v2ControllerLogic.test.js` — expect PASS (response shape unchanged). If any test pinned the `escalateToAdmin` side effect itself, update that assertion surgically (the change is intentional).
- [ ] Commit:

```bash
git add tests/integration/payment-ready-gate.test.js server/controllers/orderController.js tests/unit/v2ControllerLogic.test.js
git commit -m "fix(orders): confirmPayment no longer escalates; manual verify promotes through the ready gate"
```

---

## Task 7 — End-to-end regression tests (confirming auto-verify, payment-after-escalation, held-at-store, full escalation run)

These are the spec's mandatory regressions (§6.5 / §11), exercised through the REAL job + REAL scanner + REAL gate with only the IMAP/mailcow leaves mocked. They are regression proofs for Tasks 1–6: a failure here means a bug in a prior task — debug there, do not weaken the assertion.

**Files:**
- Modify: `tests/integration/payment-ready-gate.test.js` — append three describe blocks inside the top-level `describe('Payment ready gate (PR 8 integration)')`, after the `verifyPaymentManually` block

**Steps:**

- [ ] Append the regression blocks:

```javascript
  describe('REGRESSION: confirming order auto-verifies and promotes (the $in widening)', () => {
    it('cron run on a confirming+processed order with a matching inbound payment -> verified + ready_for_pickup', async () => {
      const order = await createOrder({ status: 'processed', paymentStatus: 'confirming' });
      mailcowService.searchEmails.mockResolvedValue([venmoEmailFor(order)]);

      await paymentVerificationJob.checkPendingPayments();

      const updated = await Order.findById(order._id);
      expect(updated.paymentStatus).toBe('verified');           // findOrderById matched 'confirming'
      expect(updated.status).toBe('ready_for_pickup');          // gate promoted (Path B)
      expect(updated.readyForPickupAt).toBeInstanceOf(Date);
      expect(updated.heldAtStore).toBe(false);
    });
  });

  describe('REGRESSION: payment after escalation still verifies and promotes', () => {
    it('escalated order is skipped by the reminder cadence but a late payment verifies via the scanner', async () => {
      const order = await createOrder({
        status: 'processed', paymentStatus: 'awaiting',
        paymentEscalated: true, heldAtStore: true,
        holdNoticeSentAt: new Date(Date.now() - HOUR),
        paymentReminderCount: 8,
        paymentLastReminderAt: new Date(Date.now() - 5 * HOUR)
      });

      // 1) Reminder cadence excludes it — no reminder, no second hold notice.
      const reminderSpy = jest.spyOn(emailService, 'sendV2PaymentReminder');
      const holdSpy = jest.spyOn(emailService, 'sendV2ComeToStoreNotice');
      await paymentVerificationJob.checkPendingPayments();
      expect(reminderSpy).not.toHaveBeenCalled();
      expect(holdSpy).not.toHaveBeenCalled();
      reminderSpy.mockRestore();
      holdSpy.mockRestore();

      // 2) ...but the inbox path still verifies the late payment (no "too late" state).
      mailcowService.searchEmails.mockResolvedValue([venmoEmailFor(order)]);
      const verified = await paymentEmailScanner.checkOrderPayment(order._id);
      expect(verified).toBe(true);

      const updated = await Order.findById(order._id);
      expect(updated.paymentStatus).toBe('verified');
      expect(updated.status).toBe('ready_for_pickup');
      expect(updated.heldAtStore).toBe(false);
    });
  });

  describe('REGRESSION: held-at-store and the full escalation run', () => {
    it('processed + unpaid -> heldAtStore=true, NOT ready_for_pickup, readyForPickupAt unset', async () => {
      const order = await createOrder({ status: 'processed', paymentStatus: 'awaiting' });

      const fresh = await Order.findById(order._id);
      await orderReadyGateService.applyReadyGate(fresh, { trigger: 'processed' });

      const updated = await Order.findById(order._id);
      expect(updated.status).toBe('processed');
      expect(updated.heldAtStore).toBe(true);
      expect(updated.readyForPickupAt).toBeUndefined();
    });

    it('a full cron run at reminder 7-of-8 due sends the 8th reminder + hold notice, then goes quiet — never failed', async () => {
      const order = await createOrder({
        status: 'processed', paymentStatus: 'awaiting',
        paymentReminderCount: 7,
        paymentLastReminderAt: new Date(Date.now() - 2 * HOUR)
      });
      const reminderSpy = jest.spyOn(emailService, 'sendV2PaymentReminder').mockResolvedValue(true);
      const holdSpy = jest.spyOn(emailService, 'sendV2ComeToStoreNotice').mockResolvedValue(true);
      const adminSpy = jest.spyOn(emailService, 'sendV2PaymentTimeoutEscalation').mockResolvedValue(true);

      await paymentVerificationJob.checkPendingPayments();   // run 1: 8th reminder + escalation
      await paymentVerificationJob.checkPendingPayments();   // run 2: must be a no-op

      expect(reminderSpy).toHaveBeenCalledTimes(1);
      expect(holdSpy).toHaveBeenCalledTimes(1);
      expect(adminSpy).toHaveBeenCalledTimes(1);

      const updated = await Order.findById(order._id);
      expect(updated.paymentReminderCount).toBe(8);
      expect(updated.paymentEscalated).toBe(true);
      expect(updated.holdNoticeSentAt).toBeInstanceOf(Date);
      expect(updated.heldAtStore).toBe(true);
      expect(updated.paymentStatus).toBe('awaiting');        // NEVER 'failed'

      reminderSpy.mockRestore();
      holdSpy.mockRestore();
      adminSpy.mockRestore();
    });
  });
```

- [ ] Run: `npm test -- tests/integration/payment-ready-gate.test.js` — expect PASS (6 tests total). If the confirming regression fails with `paymentStatus` still `'confirming'`, the Task 4 `findOrderById` widening or the Task 5 cron query is wrong; if `status` stays `'processed'` with `paymentStatus` `'verified'`, the gate wiring (Task 4/5) is wrong. Fix at the source.
- [ ] Run the FULL suite to close the PR: `npm test` — expect green, no `--forceExit`, no open-handle warnings (the job's `stop()` is called in `afterEach`; the cron is only started by the one `start()` unit test which stops it).
- [ ] Commit:

```bash
git add tests/integration/payment-ready-gate.test.js
git commit -m "test(payments): end-to-end ready-gate regressions — confirming auto-verify, post-escalation payment, held-at-store"
```

---

## Task 8 — Admin payment surface: `GET /api/v1/orders/held` + `POST /api/v1/orders/:orderId/resend-payment-request` (spec §5 / §9)

Spec §5 names both endpoints and §9's RBAC matrix pins them ("Held-orders view": admin ✅ / affiliate (own, scoped) / customer ❌ / operator ✅; "Resend payment request": admin only). No other PR implements them — PR 8 owns `heldAtStore` and the reminder clock, so they land here. The resend handler reuses the STORED `paymentLinks`/`paymentQRCodes` (never regenerates — same rule as the reminder cadence) and resets the reminder clock (`paymentReminderCount=0`, `paymentLastReminderAt=now`, `paymentEscalated=false` so the cadence resumes; `holdNoticeSentAt` is left set so the one-time hold notice never re-sends).

**Files:**
- Create: `tests/integration/heldOrdersEndpoints.test.js`
- Modify: `server/controllers/orderController.js` (add `getHeldOrders`, `resendPaymentRequest`)
- Modify: `server/routes/orderRoutes.js` (`/held` BEFORE the `/:orderId` param routes; resend next to `verify-payment`)

**Steps:**

- [ ] Write the failing integration test `tests/integration/heldOrdersEndpoints.test.js`:

```javascript
// Spec §5 + §9: held-at-store list view + admin resend of the stored-link
// payment request. CSRF: both paths are unlisted in csrf-config, so the POST
// is default-enforced (token required); the GET is exempt by method.
jest.setTimeout(90000);

jest.mock('../../server/utils/emailService', () => ({
  sendV2PaymentRequest: jest.fn().mockResolvedValue(true)
}));

const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const app = require('../../server');
const Order = require('../../server/models/Order');
const Customer = require('../../server/models/Customer');
const Affiliate = require('../../server/models/Affiliate');
const emailService = require('../../server/utils/emailService');
const { getCsrfToken, createAgent } = require('../helpers/csrfHelper');

let agent;
let csrfToken;
let adminToken, operatorToken, customerToken;
let affiliateA, affiliateB, affiliateAToken;
let customer;

function signToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET || 'test-secret');
}

async function createAffiliate(tag) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync('testpass123', salt, 1000, 64, 'sha512').toString('hex');
  return Affiliate.create({
    firstName: 'Held', lastName: tag, email: `held-${tag}-${Date.now()}@test.com`,
    phone: '555-0001', address: '123 Test St', city: 'Austin', state: 'TX', zipCode: '78753',
    username: `held${tag}${Date.now()}`, passwordHash: hash, passwordSalt: salt, paymentMethod: 'check'
  });
}

async function createOrder(affiliate, overrides = {}) {
  const token = crypto.randomBytes(16).toString('hex');
  return Order.create({
    customerId: customer.customerId,
    affiliateId: affiliate.affiliateId,
    bagId: 'BAG-' + uuidv4(),
    bagToken: token,
    bags: [{ bagToken: token, bagNumber: 1 }],
    actualWeight: 20,
    status: 'processed',
    paymentStatus: 'awaiting',
    heldAtStore: true,
    paymentAmount: 50,
    paymentRequestedAt: new Date(),
    paymentLinks: { venmo: 'venmo://stored', paypal: 'https://paypal.me/stored', cashapp: 'https://cash.app/stored' },
    paymentQRCodes: { venmo: 'data:image/png;base64,v', paypal: 'data:image/png;base64,p', cashapp: 'data:image/png;base64,c' },
    feeBreakdown: { minimumFee: 10, perBagFee: 2, totalFee: 10, minimumApplied: true },
    ...overrides
  });
}

describe('Held-orders view + resend payment request (PR 8)', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await Promise.all([Order.deleteMany({}), Customer.deleteMany({}), Affiliate.deleteMany({})]);

    agent = createAgent(app);
    csrfToken = await getCsrfToken(app, agent);

    affiliateA = await createAffiliate('A');
    affiliateB = await createAffiliate('B');

    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync('testpass123', salt, 1000, 64, 'sha512').toString('hex');
    customer = await Customer.create({
      firstName: 'Held', lastName: 'Customer', email: `held-cust-${Date.now()}@test.com`,
      phone: '555-0002', address: '456 Customer St', city: 'Austin', state: 'TX', zipCode: '78753',
      username: `heldcust${Date.now()}`, passwordHash: hash, passwordSalt: salt,
      affiliateId: affiliateA.affiliateId
    });

    adminToken = signToken({ id: 'admin-held-1', role: 'admin' });
    operatorToken = signToken({ id: 'op-held-1', role: 'operator' });
    customerToken = signToken({ id: customer._id, customerId: customer.customerId, role: 'customer' });
    affiliateAToken = signToken({ id: affiliateA._id, affiliateId: affiliateA.affiliateId, role: 'affiliate' });
  });

  describe('GET /api/v1/orders/held', () => {
    it('admin sees every processed+held order and nothing else', async () => {
      const held = await createOrder(affiliateA);
      await createOrder(affiliateB, { heldAtStore: true });
      await createOrder(affiliateA, { status: 'ready_for_pickup', heldAtStore: false, paymentStatus: 'verified' });
      await createOrder(affiliateA, { status: 'in_progress', heldAtStore: false });

      const res = await request(app)
        .get('/api/v1/orders/held')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.orders).toHaveLength(2);
      expect(res.body.orders.map(o => o.orderId)).toContain(held.orderId);
      for (const o of res.body.orders) {
        expect(o.status).toBe('processed');
        expect(o.heldAtStore).toBe(true);
      }
    });

    it('operator gets the same unscoped view (spec §9)', async () => {
      await createOrder(affiliateA);
      const res = await request(app)
        .get('/api/v1/orders/held')
        .set('Authorization', `Bearer ${operatorToken}`);
      expect(res.status).toBe(200);
      expect(res.body.orders).toHaveLength(1);
    });

    it('affiliate is scoped to own orders', async () => {
      await createOrder(affiliateA);
      await createOrder(affiliateB);
      const res = await request(app)
        .get('/api/v1/orders/held')
        .set('Authorization', `Bearer ${affiliateAToken}`);
      expect(res.status).toBe(200);
      expect(res.body.orders).toHaveLength(1);
      expect(res.body.orders[0].affiliateId).toBe(affiliateA.affiliateId);
    });

    it('customer role is rejected (403)', async () => {
      const res = await request(app)
        .get('/api/v1/orders/held')
        .set('Authorization', `Bearer ${customerToken}`);
      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/v1/orders/:orderId/resend-payment-request', () => {
    it('admin resend reuses the STORED links and resets the reminder clock', async () => {
      const order = await createOrder(affiliateA, {
        paymentReminderCount: 8,
        paymentLastReminderAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
        paymentEscalated: true,
        holdNoticeSentAt: new Date()
      });

      const res = await agent
        .post(`/api/v1/orders/${order.orderId}/resend-payment-request`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-csrf-token', csrfToken)
        .send({});
      expect(res.status).toBe(200);

      expect(emailService.sendV2PaymentRequest).toHaveBeenCalledTimes(1);
      const callArg = emailService.sendV2PaymentRequest.mock.calls[0][0];
      expect(callArg.paymentLinks.venmo).toBe('venmo://stored'); // never regenerated
      expect(callArg.paymentAmount).toBeCloseTo(50, 2);

      const updated = await Order.findById(order._id);
      expect(updated.paymentReminderCount).toBe(0);
      expect(updated.paymentLastReminderAt.getTime()).toBeGreaterThan(Date.now() - 60 * 1000);
      expect(updated.paymentEscalated).toBe(false);              // cadence resumes
      expect(updated.holdNoticeSentAt).toBeInstanceOf(Date);     // hold notice stays one-time
      expect(updated.paymentLinks.venmo).toBe('venmo://stored');
    });

    it('rejects without a CSRF token (403, default-enforce)', async () => {
      const order = await createOrder(affiliateA);
      const res = await request(app)
        .post(`/api/v1/orders/${order.orderId}/resend-payment-request`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});
      expect(res.status).toBe(403);
      expect(emailService.sendV2PaymentRequest).not.toHaveBeenCalled();
    });

    it('rejects non-admin roles (403)', async () => {
      const order = await createOrder(affiliateA);
      for (const token of [affiliateAToken, operatorToken, customerToken]) {
        const res = await agent
          .post(`/api/v1/orders/${order.orderId}/resend-payment-request`)
          .set('Authorization', `Bearer ${token}`)
          .set('x-csrf-token', csrfToken)
          .send({});
        expect(res.status).toBe(403);
      }
      expect(emailService.sendV2PaymentRequest).not.toHaveBeenCalled();
    });

    it('400 on an already-verified order; 404 on an unknown orderId', async () => {
      const paid = await createOrder(affiliateA, { paymentStatus: 'verified', heldAtStore: false });
      const resPaid = await agent
        .post(`/api/v1/orders/${paid.orderId}/resend-payment-request`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-csrf-token', csrfToken)
        .send({});
      expect(resPaid.status).toBe(400);

      const resMissing = await agent
        .post('/api/v1/orders/ORD-does-not-exist/resend-payment-request')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-csrf-token', csrfToken)
        .send({});
      expect(resMissing.status).toBe(404);
    });
  });
});
```

- [ ] Run it: `npm test -- tests/integration/heldOrdersEndpoints.test.js` — expect FAIL for the right reason: `GET /api/v1/orders/held` returns **whatever `GET /:orderId` does for an orderId of "held"** (404 from `getOrderDetails`, not the list shape) and the resend POSTs 404 (route unmounted).

- [ ] **Controller.** In `server/controllers/orderController.js`, add two exports (next to `verifyPaymentManually`; reuse the existing `asyncWrapper`/`ControllerHelpers` and `emailService` imports):

```javascript
/**
 * GET /api/v1/orders/held — held-at-store list (spec §5).
 * RBAC (spec §9): admin/administrator/operator see all; affiliate sees own;
 * customers are rejected at the route (checkRole).
 */
exports.getHeldOrders = ControllerHelpers.asyncWrapper(async (req, res) => {
  const filter = { status: 'processed', heldAtStore: true };
  if (req.user.role === 'affiliate') {
    filter.affiliateId = req.user.affiliateId; // own only — ignore query params
  }
  const orders = await Order.find(filter).sort({ processedAt: 1 });
  return ControllerHelpers.sendSuccess(res, { orders }, 'Held orders retrieved');
});

/**
 * POST /api/v1/orders/:orderId/resend-payment-request — admin re-send of the
 * payment request using the STORED links/QRs (never regenerated, spec §6.5),
 * resetting the reminder clock so the cadence restarts.
 */
exports.resendPaymentRequest = ControllerHelpers.asyncWrapper(async (req, res) => {
  const order = await Order.findOne({ orderId: req.params.orderId });
  if (!order) return ControllerHelpers.sendError(res, 'Order not found', 404);
  if (order.paymentStatus === 'verified') {
    return ControllerHelpers.sendError(res, 'Order is already paid', 400);
  }
  if (!order.paymentLinks || !order.paymentLinks.venmo) {
    return ControllerHelpers.sendError(res, 'Order has no stored payment links', 400);
  }

  const customer = await Customer.findOne({ customerId: order.customerId });
  if (!customer) return ControllerHelpers.sendError(res, 'Customer not found', 404);

  await emailService.sendV2PaymentRequest({
    customer,
    order,
    paymentAmount: order.paymentAmount,
    paymentLinks: order.paymentLinks,
    qrCodes: order.paymentQRCodes
  });

  // Reset the reminder clock (spec §5): count back to zero, cadence restarts
  // from now, escalation cleared so reminders resume. holdNoticeSentAt is
  // deliberately NOT cleared — the come-to-store notice is one-time forever.
  order.paymentReminderCount = 0;
  order.paymentLastReminderAt = new Date();
  order.paymentEscalated = false;
  await order.save();

  logger.info('Payment request re-sent', { orderId: order.orderId, by: req.user.id });
  return ControllerHelpers.sendSuccess(res, { orderId: order.orderId }, 'Payment request re-sent');
});
```

  (Check the file's existing imports: `Order`, `Customer`, `emailService`, `logger` are already required on main — verify with `grep -n "require" server/controllers/orderController.js | head -15` and add any missing.)

- [ ] **Routes.** In `server/routes/orderRoutes.js`:
  - Add `/held` with the OTHER static GET routes (`/export`, `/search`, `/statistics`) — it MUST be registered before `router.get('/:orderId', ...)` or the param route swallows it:

```javascript
/**
 * @route   GET /api/v1/orders/held
 * @desc    Held-at-store orders (processed + unpaid) — spec §5
 * @access  admin / administrator / operator (all), affiliate (own)
 */
router.get('/held',
  authenticate,
  checkRole(['admin', 'administrator', 'operator', 'affiliate']),
  orderController.getHeldOrders);
```

  - Add the resend route next to `verify-payment` (CSRF needs no config: an unlisted mutating path is default-enforced):

```javascript
/**
 * @route   POST /api/v1/orders/:orderId/resend-payment-request
 * @desc    Re-send the stored-link payment request; reset reminder clock — spec §5
 * @access  admin / administrator (CSRF default-enforced)
 */
router.post('/:orderId/resend-payment-request',
  authenticate,
  checkRole(['admin', 'administrator']),
  orderController.resendPaymentRequest);
```

- [ ] Run again: `npm test -- tests/integration/heldOrdersEndpoints.test.js` — expect PASS (8 tests). Then `npm test -- tests/integration/order.test.js tests/integration/payment-ready-gate.test.js` for no-regression on the order routes.
- [ ] Lint: `npx eslint server/controllers/orderController.js server/routes/orderRoutes.js` — clean.
- [ ] Commit:

```bash
git add server/controllers/orderController.js server/routes/orderRoutes.js tests/integration/heldOrdersEndpoints.test.js
git commit -m "feat(payments): held-orders view + admin resend-payment-request (stored links, reminder-clock reset)"
```

---

## Verification

- [ ] **Full suite:** `npm test` — green, exits cleanly without `--forceExit`.
- [ ] **Lint:** `npx eslint server/` — no `console.*` violations introduced (everything logs via `logger`).
- [ ] **Spec-conformance greps:**

```bash
# The three widened queries — no remaining exact-match auto-verification gates.
# The ONLY allowed `paymentStatus: 'awaiting'` exact match left is the short-ID
# search inside orderController.confirmPayment (~L876) — a UI lookup helper,
# deliberately outside the spec's three named queries.
grep -rn "paymentStatus: 'awaiting'" server/ --include=*.js | grep -v node_modules

# Retired config keys gone:
grep -rn "payment_check_interval\|payment_check_max_attempts" server/ --include=*.js | grep -v node_modules   # no hits

# Reminders never regenerate links:
grep -rn "generatePaymentLinks" server/jobs/ server/services/email/ --include=*.js   # no hits

# Job never writes 'failed':
grep -n "'failed'" server/jobs/paymentVerificationJob.js   # no hits

# Gate is called from all three verify paths:
grep -rn "applyReadyGate" server/jobs/paymentVerificationJob.js server/services/paymentEmailScanner.js server/controllers/orderController.js
```

- [ ] **Manual smoke (dev box, `EMAIL_PROVIDER=console`):** start the app with `RUN_BACKGROUND_JOBS=true`; confirm the startup log line reads `scan every 2 min, reminders every 60 min, cap 8`; create a test order with `paymentStatus='awaiting'`, `paymentRequestedAt` backdated 2h, run `paymentVerificationJob.triggerManual()` in a node REPL, and confirm exactly one reminder email logs to console with the STORED venmo/paypal/cashapp links.
- [ ] **i18n:** the four `common.json` files parse and `payment.holdNotice.*` parity holds (covered by the Task 2 unit test).
- [ ] **No circulars:** `npx madge --circular server/` — zero cycles.

### PR description

> **PR 8 — Payment job retune: 60-min/8-cap reminders + come-to-store + gate wiring**
>
> Implements spec §6.5 (`docs/superpowers/specs/2026-06-08-invite-bag-workflow-redesign-design.md`):
>
> - **`paymentVerificationJob` rewritten.** Detection (`paymentCheckAttempts`, IMAP scan every `payment_scan_interval_ms`=2 min) is decoupled from reminders (`paymentReminderCount`, time-based every `payment_reminder_interval_minutes`=60, capped at `payment_reminder_max_attempts`=8). Reminders reuse the payment links/QRs stored at intake — `generatePaymentLinks` is never called by the job.
> - **Escalation, not failure.** After the 8th reminder: one `sendV2ComeToStoreNotice` (new dispatcher + `v2/come-to-store.html` template + 4-lang `payment.holdNotice.*` keys), `paymentEscalated=true`, `holdNoticeSentAt`, `heldAtStore=true`, `PAYMENT_ESCALATED` audit event, and `escalateToAdmin` repurposed as the admin-visibility hook. `paymentStatus` is **never** set to `failed`, so a late payment still verifies.
> - **Query widening.** The three exact-match `paymentStatus: 'awaiting'` lookups (`paymentEmailScanner.findOrderById`, `paymentEmailScanner.processAllPendingPayments`, the cron query) now match `$in: ['awaiting','confirming']`, so customer-self-reported orders auto-verify. Cron query: `{ paymentStatus: {$in:['awaiting','confirming']}, status: {$in:['in_progress','processed']}, paymentEscalated: {$ne:true} }`.
> - **Gate wiring.** All verify paths run the canonical `orderReadyGateService.applyReadyGate` (scanner `verifyAndUpdateOrder`, the cron verify path, admin `verifyPaymentManually`). `confirmPayment` no longer escalates to admin.
> - **`sendV2PaymentReminder` fixed:** loads its template via `loadTemplate` (the old hardcoded path pointed at a nonexistent directory — reminders were silently failing), caps from SystemConfig instead of the stale `maxReminders: 3`, and the 24h-deadline framing is gone.
> - **Admin payment surface (spec §5/§9):** `GET /api/v1/orders/held` (processed + heldAtStore list; admin/operator full, affiliate own-scoped, customer 403) and `POST /api/v1/orders/:orderId/resend-payment-request` (admin-only, CSRF; reuses STORED links, resets `paymentReminderCount`/`paymentLastReminderAt`, clears `paymentEscalated`; `holdNoticeSentAt` stays one-time).
>
> **Tests:** unit (job cadence/escalation/query, scanner widening + gate, both dispatchers, locale parity) + integration (`payment-ready-gate.test.js`: confirming auto-verify regression, payment-after-escalation, held-at-store, full escalation run, confirmPayment no-escalate, manual-verify promotion; `heldOrdersEndpoints.test.js`: RBAC-scoped held view + resend with reminder-clock reset). Suite green without `--forceExit`.
>
> Depends on PRs 3 (SystemConfig keys) and 4 (order enum + `orderReadyGateService`). Next: PR 9 (advance/scan-out + delivery + re-intake).

