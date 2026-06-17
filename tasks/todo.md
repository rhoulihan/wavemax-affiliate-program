# UI polish pass — logo headers, spinner, code modal (2026-06-17)

Scope (Rick): every form + every email gets a clean WaveMAX logo header.
The **claim registration form** additionally gets a swirl spinner on every server
round-trip (send email OTP / send SMS / verify / submit) and a **modal dialog** for
the email + phone confirmation codes (replacing the inline fields).
Workflow changes to follow after this.

## A. Claim registration form (me — centerpiece) — DONE
- [x] Logo header on claim-embed.html (replace text-only blue bar)
- [x] Static code-entry modal (#claimCodeModal) reusing modal-utils styling/wiring
- [x] Load swirl-spinner.js + modal-utils.js (+ CSS) on /claim
- [x] claim.js: spinner on send-email-otp / send-sms / verify / submit; open code modal on send; verify in modal; close + show verified badge
- [x] Remove inline #email-otp-block / #phone-otp-block fields
- [x] i18n claim.verify.modalTitleEmail/Phone ×4
- [x] claimPageWiring.test.js updated — 190 pass

## B. Emails — logo header (subagents)
- [x] Lang-subfolder templates (en/es/pt/de) — subagent done (14 files)
- [~] ROOT-level templates (the live fallback set: password resets, order status/cancel,
      new-customer/order, admin/operator welcomes, pin reset, etc.) — subagent running
- NOTE drift: en/ missing customer-on-the-way + customer-order-delivered; es/pt/de missing affiliate-welcome (pre-existing)

## C. Other forms — logo header (subagent running)
- [~] admin login, affiliate login, affiliate register, forgot/reset password,
      operator login, operator-login-store, operator scan, contact
      (shared .embed-brand-header class added to theme.css)

## Gate
- [ ] Full-suite gate clean (⊆ environmental baseline)
- [ ] Lighthouse on /claim (mobile+desktop) holds the bar
- [ ] Deploy both boxes; then Rick's workflow changes

---
## Background (not blocking)
- [ ] Remove diagnostic `X-Origin-Box` header before declaring OCI migration fully done
- [ ] Mail flip to OCI — gated on Oracle SRs (PTR #4-0002859947/#4-0002859970, port-25 #CAM-266605)
