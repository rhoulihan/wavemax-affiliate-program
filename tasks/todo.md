# Active todo — affiliate editing + instructions + delivery fee + priced add-ons

Plan: `~/.claude/plans/parsed-spinning-unicorn.md` (approved 2026-06-20).

## PR 1 — Affiliate model + full admin edit
- [x] Affiliate model: add `deliveryInstructions`, `deliveryFee`; mark V1 fees deprecated
- [x] `updateAffiliateSettings`: full editable-field whitelist + email-uniqueness 409
- [x] administratorRoutes PATCH validation: new/expanded fields; drop min/perBag
- [x] GET /affiliates/:affiliateId raw-record endpoint for the edit form
- [x] Admin dashboard: full affiliate-edit form (username read-only) + save
- [x] Tests (model + integration); i18n for new field labels (0 parity errors)
- [x] Gate green (170 suites / 2743 tests) → commit → deploy

## PR 2 — Add-on pricing
- [x] AddOn model: add `price`; flip the no-price model test
- [x] addonController + routes: accept/return `price`
- [x] Admin add-on modal: Price input + list column
- [x] Tests; gate → commit → deploy

## PR 3 — Order form Premium/Free tables
- [x] claim.js renderOrderOptions: Premium (price>0) + Free tables, price column
- [x] claim.css table layout + `?v=` bump (+ embed-app-v2 SPA bumps + rebuild)
- [x] i18n `claim.order.*`; tests
- [ ] Lighthouse `/claim` (post-deploy)
- [x] clean full gate (169 suites green; 1 version-string test updated)

## PR 4 — Emails + notification routing
- [ ] notifyTransition: affiliate notify on ANY start (opted-in), drop out_for_delivery affiliate email; resolve add-ons for email
- [ ] customer order-status email: pickup instr + delivery fee + paid add-ons (pending); delivery instr (out_for_delivery)
- [ ] Tests (transition/email seam); i18n email copy
- [ ] gate → commit → deploy

## Final
- [ ] Adversarial review workflow over the whole diff; fix confirmed findings
- [ ] End-to-end verify on prod; update memory
