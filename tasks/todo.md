# Active task — email confirm-link verification + edit-my-info + operator Cents warning

Decisions (confirmed 2026-06-18):
- Email REQUIRED at registration; phone is the ONLY gate that blocks completion; email stored UNVERIFIED.
- Email verified by a CONFIRM LINK in the welcome email (token, single-use, ~30-day expiry) — not an OTP.
- ONLY the welcome email goes to unverified addresses; every other customer email suppressed until verified.
- Self-start (scan bag + phone) shows TWO buttons: [Edit my info] [Start an order].
- Edit my info: name/email/address + PHONE (option a: SMS re-verify the new number on the spot).
  - email change → set unverified + resend confirm link; phone change → set Cents-sync flag.
- Phone change → operator warning at scan ("update in Cents"); clears on next operator/affiliate apply.
- Remove the dead email-OTP code (emailOtpService, EmailVerification model, /email-otp routes, csrf entries, tests).

## PR 1 — email required + confirm-link verification + notification gating + OTP cleanup
- [ ] Customer model: emailVerified(bool default false) + emailVerifyTokenHash + emailVerifyTokenExpires (drop the legacy emailVerifiedAt usage or reuse as the verified-at).
- [ ] customerRoutes register validator: email REQUIRED (notEmpty + isEmail).
- [ ] customerRegistrationService: require email; store unverified; mint a verify token (sha256 hash stored, raw in welcome link).
- [ ] verify-email route: GET /api/v1/customers/verify-email/:token → consume (single-use, expiry) → mark verified → redirect to a small landing page (CSP-clean).
- [ ] welcome email dispatcher+template: add "Confirm your email" link ([VERIFY_URL]); keep the Request-a-pickup button.
- [ ] notification gate: canEmailCustomer(customer)=email&&emailVerified; apply to ALL customer emails EXCEPT welcome (orderTransitionService.notifyTransition + any other customer sends). Affiliate emails unaffected.
- [ ] REMOVE email-OTP: emailOtpService.js, EmailVerification model, csrf-config email-otp entries, emailOtpService/emailOtpModel tests, customer-email-otp template+dispatcher.
- [ ] tests: email required (400 without), registration stores unverified, verify-link verifies (+ expired/used → fail), gating (unverified → no order email; verified → email).

## PR 2 — edit my info + operator Cents-sync warning
- [ ] self-start panel: after phone mints session, show [Edit my info] [Start an order].
- [ ] GET/PATCH /api/v1/customers/me (scanAuth, actorType=customer, own record only): read + update name/email/address/phone.
  - phone change requires a fresh Firebase phoneIdToken (re-verify); email change → unverified + resend confirm link; phone change → centsSyncNeeded=true.
- [ ] edit form UI (claim page) with Firebase SMS re-verify for phone; CSP-clean.
- [ ] Customer.centsSyncNeeded(+newPhone) flag; resolveScan (operator/affiliate) surfaces it; kiosk + claim staff confirm panel show a prominent warning; clears on next operator/affiliate apply.
- [ ] i18n ×4 for all new copy; tests; adversarial review; gate; deploy.

## Process: TDD per PR, adversarial review Workflow, full gate ⊆ env baseline, deploy both boxes, verify.
