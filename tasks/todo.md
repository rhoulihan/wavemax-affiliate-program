# Active task — bag-registration: phone-only verification + order-start panel rework

User request (2026-06-17):
1. Bag registration requires **phone** verification only; **email optional + unverified**.
2. Swirl spinner → **full-page** (global) during server actions (send SMS / verify / submit).
3. **Remove the Send (SMS) button after the code verifies** (badge replaces it).
4. Order-start panel: **customer on top**; **staff entry behind a link → staff-code modal**.

Decisions (confirmed): email dupes = **block when provided** (sparse unique index, many no-email allowed); send button = **hide after verified**.

## Backend — phone required, email optional+unverified, drop email-OTP
- [x] customerClaim.test.js: reworked (20/20 green) — email optional, phone gate, dup when provided, OTP endpoints 404.
- [x] customerRegistrationService.js: removed email-OTP; email optional; dup-check only when present; phone block is the gate.
- [x] customerController.js: removed requestEmailOtp/verifyEmailOtp + emailOtpService require.
- [x] customerRoutes.js: removed email-otp routes; register validators → email optional, dropped emailVerificationToken.
- [x] Customer model: email required:false, unique+sparse. (phone stays required.)
- [~] Leave emailOtpService.js / EmailVerification / dispatcher as DEAD code (follow-up cleanup; keeps blast radius small + CSRF exemption keeps removed routes returning 404 not 403).
- [ ] PROD index migration: drop non-sparse `email_1`, recreate sparse unique (data already wiped → safe).

## Frontend — claim-embed.html + claim.js
- [x] claim-embed.html: phone first (required) + Send SMS + badge; email plain optional (no send btn / badge); code modal phone-only.
- [x] claim.js: dropped email-OTP fns; code modal phone-only; gate submit on phone (when enabled); spin()→showGlobal() full-page; hide Send-SMS btn after verify.

## Order-start panel — customer top, staff behind link→modal
- [x] claim-embed.html: customer self-start on top; "Staff? Enter your code" link → #staffCodeModal (code + Start scanning).
- [x] claim.js: startSession reads modal code input; link→open modal; close on mint; reopen on session-expiry; spinner.

## Cross-cutting
- [x] i18n en/es/pt/de: staff link/modal title, email-optional hint, customerStartTitle (SMS modal title key existed).
- [x] claimPageWiring.test.js: +structure assertions; bump claim.css ?v=; claim.js NOT in ASSETS → no min rebuild.
- [x] Adversarial review Workflow (ultracode): 7 confirmed → fixed:
      - CRIT/HIGH: added Customer to scripts/ensure-indexes.js (sparse+unique email idx). Prod customers has ONLY _id_ (no old email_1) → no drop needed, just run ensure-indexes.
      - HIGH: claim.js hard-gate — phoneRequired (server-driven) gates submit, not SDK-load; SDK failure → visible error (onPhoneSetupFailed + claim.verify.phoneUnavailable ×4).
      - MED: Enter key on #scan-customer-contact.
      - LOW: no-email welcome email log error→info.
- [ ] Full-suite gate (⊆ env baseline) → commit/push → deploy both boxes + `node scripts/ensure-indexes.js` on prod + verify live.
