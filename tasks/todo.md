# Active todo — add-on price units + delivery-fee line item + operator order-total + partner revenue/commission

Plan: `~/.claude/plans/parsed-spinning-unicorn.md` (approved 2026-06-21).

## PR 1 — Add-on price unit (flat | per-pound, display-only) — CODE DONE (deploy with wave)
- [x] AddOn model: `priceUnit` enum (flat|per_lb); resolveKeys carries it
- [x] addonController present/listPublic/create/update + routes validation
- [x] Admin modal: unit select; list shows `$5.00` vs `$0.50/lb`
- [x] claim.js formatPrice unit-aware
- [x] i18n en/es/pt/de; tests green (49); i18n parity 0
- [ ] asset rebuild + cache-bump + full gate + deploy (batched at end of wave)

## PR 2 — Partner delivery fee line item (order form + confirmation summary) — CODE DONE
- [x] effectiveDeliveryFee util + seeded SystemConfig `default_delivery_fee` ($10, WaveMAX Associates)
- [x] resolveScan + claimRegister return the EFFECTIVE fee
- [x] claim.js renderOrderOptions: non-optional delivery-fee line; confirmation summary shows fee + pickup instructions
- [x] i18n; tests (form + util, 6 scan/claim suites green); deploy with wave

## PR 3 — Operator: delivery-fee pricing at intake + required final total at send-out + persistence
- [ ] Order model: orderTotal + deliveryFeeCharged (snapshot at out_for_delivery)
- [ ] scanService.resolveScan returns deliveryFee for operator; advanceOrder/applyScan record orderTotal + snapshot; require total at out_for_delivery
- [ ] operator-scan: delivery-fee line w/ price at intake; required total input at send-out; add-ons price-less
- [ ] scanRoutes validation; tests; gate → commit → deploy

## PR 4 — Revenue/commission surfacing + emails
- [ ] adminDashboardService.getAffiliateAnalytics: totalRevenue + totalCommission sums
- [ ] affiliateController earnings/dashboard/ytd: commission = Σ deliveryFeeCharged (commission-only)
- [ ] affiliate dashboard Earnings relabel + wire; emails unit-aware add-on price
- [ ] i18n; tests; gate → commit → deploy

## Final
- [ ] Adversarial review workflow over the whole diff; fix confirmed findings
- [ ] End-to-end verify on prod; update memory
