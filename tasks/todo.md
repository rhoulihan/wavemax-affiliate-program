# Active task — partner pickup instructions + "Request pickup now" on claim confirmation

Decisions (confirmed): ONE per-partner `pickupInstructions` field, shown to the customer on the
registration confirmation. **Required for all partners** at the ADMIN config (create + settings modal).
- full_service → "Request pickup now" button starts the order (reuse customer-initiated scan flow:
  mint customer session w/ registered phone → resolve → apply create-pending), THEN show the partner's
  pickup instructions.
- pickup_location → show the partner's instructions directly (follow to drop off). No button.
- Self-registration unchanged (doesn't collect it); model field OPTIONAL so self-reg still works;
  confirmation falls back gracefully if a not-yet-configured affiliate has none. Backfill the live affiliate.

## Backend (TDD)
- [ ] Affiliate.js: add `pickupInstructions` (String, trim) — optional at schema (self-reg safe).
- [ ] administratorRoutes.js: POST create validator → pickupInstructions required+notEmpty; PATCH → optional, notEmpty if present.
- [ ] manualAffiliateController.createAffiliateManually: accept + persist pickupInstructions (400 if missing).
- [ ] manualAffiliateController.updateAffiliateSettings: whitelist pickupInstructions; reject empty-if-provided.
- [ ] customerController.claimRegister: affiliateData += serviceType, pickupInstructions.
- [ ] tests: create requires it; PATCH updates it; claimRegister returns serviceType+pickupInstructions.

## Frontend
- [ ] claim-embed.html #claim-state-registered: "Request pickup now" button + instructions block + pickup-requested success.
- [ ] claim.js: capture affiliateData+phone on success → renderRegistered (conditional); requestPickupNow() reuses ScanSession (full-page spinner); show instructions after.
- [ ] admin settings modal (+ create form if present): pickupInstructions field, required.
- [ ] claim.css if needed; claimPageWiring assertions.

## Backend ✅ (67 tests green across locationAffiliate/affiliateSettings/customerClaim/claimPageWiring)
- [x] Affiliate.pickupInstructions; routes require on create + non-empty on PATCH; controller persists; claimRegister + bagClaimService return serviceType+pickupInstructions.
## Frontend ✅
- [x] claim confirmation: Request-pickup button + instructions block; renderRegistered/requestPickupNow (reuse ScanSession create-pending, full-page spinner); claim.css ?v=c.
- [x] admin settings modal: pickupInstructions textarea (required on save); list projections (+controller, +adminDashboardService); admin-init ?v=b + embed-app-v2 rebuilt + shell ?v=20260619b.
- [x] i18n en/es/pt/de: claim.pickup.* + admin.affiliateSettings pickup keys.
## Cross-cutting
- [ ] Adversarial review Workflow → fix → full gate → deploy both boxes → backfill prod affiliate → verify.
