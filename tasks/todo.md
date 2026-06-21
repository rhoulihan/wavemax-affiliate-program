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

## PR 3 — Operator: delivery-fee pricing at intake + required final total at send-out + persistence — CODE DONE
- [x] Order model: orderTotal + deliveryFeeCharged (snapshot at out_for_delivery)
- [x] resolveScan returns effective deliveryFee; advanceOrder records orderTotal + snapshots partner fee; validates ≥0
- [x] operator-scan: delivery-fee line w/ price at intake; required total input at send-out (client-gated); add-ons price-less
- [x] tests (transition snapshot/freeze + operator modal + i18n); 6 scan suites green; deploy with wave

## PR 4 — Revenue/commission surfacing + emails — CODE DONE
- [x] adminDashboardService.getAffiliateAnalytics: totalRevenue + totalCommission sums
- [x] affiliateController earnings/dashboard/ytd: commission = Σ deliveryFeeCharged (commission-only)
- [x] affiliate dashboard delivery-fee display (flat fee / WaveMAX Associates); emails effective fee + unit-aware add-on price
- [x] i18n; tests (partnerRevenue + email-extras + fixed controller mocks)

## Bag sticker (interjected) — DONE
- [x] partner address printed under the customer-name write-in line (labelSheetService + bag-labels.css + test)

## Wave deploy + final
- [x] asset rebuild + cache-bumps (claim.js / admin-init via embed pageScripts + min 20260621) + adminIpAuthz ?v=
- [x] full gate run: 2787 passed, 3 fails — all stale test mocks/assertions (claimPageWiring operator-undo + 2 dashboard-stats Order.aggregate mocks), fixed + reverified
- [ ] commit asset bumps + test fixes + deploy both boxes (pm2 reload — server code changed)
- [ ] adversarial review workflow; e2e verify; update memory

## NEXT FEATURE — /scanbag mobile PWA (queued, build after the wave deploys)
Decisions (2026-06-21): scope = START + COMPLETE orders only (hand off to /claim&bag=<token>, which already permits create-pending + advance→complete and blocks store-middle steps); iOS supported (jsQR fallback + Add-to-Home-Screen hint); Android primary (native BarcodeDetector + beforeinstallprompt Install button); STANDALONE /scanbag mini-app (own manifest + icon + minimal service worker).
- [ ] /scanbag route (server) + camera Permissions-Policy carve-out for that route only
- [ ] camera scan page: BarcodeDetector + jsQR fallback; decode bag QR → redirect to embedded claim URL
- [ ] PWA: manifest.json (standalone, start_url /scanbag, icon), minimal service worker, install button (Android) + iOS A2HS hint
- [ ] tests; deploy

## Final
- [ ] Adversarial review workflow over the whole diff; fix confirmed findings
- [ ] End-to-end verify on prod; update memory
