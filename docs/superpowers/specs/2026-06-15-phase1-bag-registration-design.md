# Phase 1 — Bag Registration + Scan-Gate Order State (Design Spec)

> Status: **DRAFT for review** (2026-06-15). Supersedes the payment/processing scope of the
> 2026-06-08 invite/bag redesign for Phase 1. Phase 2 work (payment, W-9, commissions,
> Paygistix) is preserved on the git tag `phase2-reference` and returns later.

## 1. Phase 1 in one breath

The application becomes a **bag-tracking state machine**. Administrators add affiliates
(partner drop-off locations) manually with no commissions. Bags are minted/issued to an
affiliate and printed as 4×6 labels. A customer scans an issued bag to **register** it,
confirming a **verified email and phone**. From then on the app records four scan events as
a bag shuttles partner → store → partner. **All money, weight, pricing, and payment live in
Cents (external, manual entry); this app holds no financial or processing data.** Pickup and
delivery logistics are out of scope — we only stamp state when bags are scanned.

## 2. Locked decisions (do not relitigate)

- **No Cents API in Phase 1** — operators key orders into Cents by hand; our order is a thin
  state record only.
- **Scan model = state-driven (Option A)** — a bag's current order state determines the next
  transition; no operator mode-picking.
- **Email + phone both fully verified at registration**, and **registration is blocked until
  the phone is verified** (no fallback bypass in Phase 1).
- **Phone verification = Firebase Phone Auth** (Google); **email verification = in-house SMTP
  OTP**. Wired behind a feature flag so email-only works until Firebase keys land.
- **Affiliate fee fields are kept** (dormant) — commissions return in Phase 2.
- **Customer portal removed** — registration only, no customer login/dashboard.
- **Undo** on the scan UI is in scope.
- **Partner scan auth reuses the existing affiliate delivery code**; the store uses the
  operator kiosk (JWT) or operator code.
- **Remove payment + W-9 code from Phase 1**, preserved on the `phase2-reference` tag.

## 3. Order state machine (4 scan gates)

State-driven: each scan resolves the bag, looks at its current open order, and applies the
single next transition.

| # | Scan event | Where / who | From → To | Side effects |
|---|---|---|---|---|
| 1 | Pickup at partner | partner or operator | *(no open order)* → **pending** | order created, linked to the registered customer + affiliate |
| 2 | Intake at store | operator (kiosk) | pending → **in_progress** | UI shows registered user info for manual Cents entry |
| 3 | Pickup at store | operator (kiosk) | in_progress → **out_for_delivery** | operator manually confirms payment (a checkbox; no payment data stored) |
| 4 | Delivery at partner | partner or operator | out_for_delivery → **complete** | `completedAt` stamped |

Plus `cancelled` (via undo / explicit cancel).

**Double-scan guards:**
- **Pickup re-scan** (bag already has an open order): warn "an order is already in progress"; no duplicate created.
- **Delivery re-scan** (order already `complete`): if `completedAt` is **within 4 hours**, prompt "create a new order for this bag?" (yes → new `pending`; no → no-op). **Beyond 4 hours**, a scan on a completed bag starts a new `pending` order normally (next cycle).
- **Undo:** the scan UI can reverse the last transition it applied within the session (e.g. a mis-scan), including deleting a just-created order or rolling a status back one step, with an audit entry.

**At-partner sessions mix pickup + delivery naturally:** in one visit a driver/partner both drops clean bags and collects dirty ones. Because transitions are state-driven, one session handles both — an `out_for_delivery` bag completes; a fresh/complete bag opens a new `pending`.

## 4. Scan-session engine

One **authenticate-once, then batch-scan** model:

- **Store (kiosk):** the operator is already authenticated (JWT). Scans are state-driven; intake shows the registered user info.
- **Field (partner/operator on a phone):** scanning a bag opens the bag URL; the partner enters their **affiliate delivery code** (or operator their code) **once** to mint a short-lived **scan-session token** (held in the browser). Subsequent scans in the session apply transitions with a simple **yes/no confirm** until the session expires (configurable TTL, e.g. 15 min) or is closed.
- Each scan: resolve bag (must be registered) → compute next transition from current order state → confirm → apply → show result + running session tally.
- Errors: unregistered bag → "bag not registered"; double-scan → the guards above; expired session → re-authenticate.

Reused primitives: the existing operator/affiliate code hashing + the `codeAttemptLockout` service (rate-limit/lockout) gate the session-auth step.

## 5. Registration + verification

Bag-claim registration (existing) gains a verification gate:

- **Email:** server generates a 6-digit OTP, sent via existing mailcow SMTP (DKIM already set up); verified server-side. No new provider.
- **Phone:** Firebase Phone Auth — client SDK + reCAPTCHA Enterprise sends the OTP SMS; the client returns a Firebase ID token; the server verifies it via the Firebase Admin SDK and extracts the verified E.164 phone. **Registration cannot complete until the phone token verifies.**
- **Feature flag** `PHONE_VERIFICATION_ENABLED`: off → email-only (phone collected but not verified) so the flow works before Firebase keys are provisioned; on → phone verification required.
- **Registration-only:** no customer account/portal afterward. The customer record stores the verified contact info + bag linkage; there is no customer login or dashboard.

New env/config: `FIREBASE_*` client config (public), the Firebase Admin service-account credential (secret, on-box), `PHONE_VERIFICATION_ENABLED`. CSP allowlist additions for Firebase/reCAPTCHA origins.

## 6. Data model changes

**Order (slim to a state record):** `orderId, bagId, customerId, affiliateId, status
∈ {pending, in_progress, out_for_delivery, complete, cancelled}`, per-scan
`{at, by, role}` for pickup/intake/storePickup/delivery, `paymentConfirmedManually` (bool, set
at store-pickup), `completedAt`, `cancelledAt`. **Removed:** all payment fields, weight,
add-ons, WDF credit, commission, fee breakdown, base rate, estimated/actual totals, the
pricing pre-save hooks, the old status enum values.

**Customer:** registration-only; keep verified `email`/`phone` (+ `emailVerifiedAt`,
`phoneVerifiedAt`), bag/affiliate linkage. Remove portal/auth surface usage, WDF credit,
payment prefs.

**Affiliate:** keep fee fields (dormant), `affiliateType` (standard/location), manual-add
path. Remove W-9 fields, delivery-code stays (now the partner scan-session code).

**Removed models/modules:** payment subsystem (links/scanner/reminder job/dispatcher/gate),
W-9 subsystem (module, secureFileStore, uploadW9, w9Routes, w9ThresholdService, admin review),
the order advance/ready-gate/confirm-delivery/re-intake services, customer delivery-PIN.

## 7. Removals → `phase2-reference` tag

Before teardown, tag current `main` as `phase2-reference` so payment, W-9, commissions, and the
Paygistix reconstruction are recoverable for Phase 2. Then remove (feature-level):

- Payment: `paymentLinkService`, `paymentEmailScanner`, `imapEmailScanner`,
  `paymentVerificationJob`, `email/dispatcher/payment.js`, the scheduler payment job, Order
  payment fields, payment SystemConfig keys, `orderReadyGateService` (payment gate),
  held-at-store.
- W-9: `server/modules/onboarding/w9*`, `secureFileStore`, `uploadW9`, `w9Routes`,
  `w9ThresholdService`, Affiliate w9 fields, admin W-9 review UI, registration W-9 upload,
  `W9_STORAGE_PATH`, i18n w9 keys.
- Order processing: weight, add-ons, WDF credit (Customer + Order), commission + realization,
  fee math + pricing hooks.
- Old lifecycle: `processed/ready_for_pickup/picked_up/delivered`, `orderAdvanceService`,
  the bag-URL advance/confirm-delivery/re-intake, customer delivery PIN.
- Customer portal: dashboard + login pages/routes → registration-only.

## 8. PR breakdown (proposed)

| PR | Scope |
|---|---|
| 0 | Tag `phase2-reference`; add the spec |
| 1 | Remove payment subsystem (services, job, emails, gate, Order fields, config) |
| 2 | Remove W-9 subsystem (module, file store, Affiliate fields, admin UI, registration upload) |
| 3 | Remove order-processing (weight/add-ons/WDF/commission/fees) + slim Order model |
| 4 | New 4-state machine (rewrite `orderStateMachine`; pickup-creates / intake / store-pickup / delivery; double-scan guards) |
| 5 | Scan-session engine + endpoints (state-driven, auth-once session token, undo) |
| 6 | Scan UIs — store kiosk (state-driven, intake shows user info) + field phone session (code-once, batch confirm) |
| 7 | Remove customer portal → registration-only |
| 8 | Registration verification — email OTP (SMTP) + phone (Firebase, flagged), block until phone verified |
| 9 | i18n (en/es/pt/de) + cleanup + Lighthouse on the registration + scan pages |

Each PR: red→green TDD, two-stage review, full-suite gate, merge --no-ff. Detailed per-PR
task lists authored at execution time (as in the prior redesign).

## 9. Open risks / notes

- **Firebase is client-driven + needs a GCP project + Blaze billing + reCAPTCHA Enterprise**;
  toll-fraud is the main cost risk → budget alert + rate-limit registration starts.
- **Blocking on phone verification** means a bad/un-deliverable number stops registration with
  no in-app fallback (per decision); admin-side remediation is out of scope for Phase 1 —
  revisit if it causes support load.
- **State-driven scanning** depends on accurate bag→order state; the **undo** path and clear
  double-scan dialogs are the safety net for mis-scans.
- Order created at pickup requires the bag to be **registered** (claimed with a verified
  customer); scanning an unregistered bag at pickup is an error.
- Much of the recent redesign (PR 7 weight intake, PR 8 payment, PR 9 delivery codes, PR 10
  W-9) is removed here; that's intentional and preserved on the tag.
