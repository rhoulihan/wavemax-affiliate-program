# Workflow expansion (2026-06-17) — plan: ~/.claude/plans/parsed-spinning-unicorn.md

Locked: omit WDF pounds; customer scan = start-only; new serviceType field; expediter = read-only token.
Process: TDD, one concern/PR, full gate per PR (⊆ baseline), deploy both boxes per PR.

## PR A — Affiliate serviceType + per-affiliate notifications (model + admin) ✅ committed
- [x] Affiliate.js: serviceType + orderNotificationsEnabled (full_service→on default, explicit wins)
- [x] PATCH /administrators/affiliates/:id (manage_affiliates) → updateAffiliateSettings
- [x] Admin dashboard: per-affiliate Settings modal + badges; i18n ×4
- [x] Adversarial review (12 findings) → XSS-escape titles, serviceType re-default, cache-bust; tests 14/14
- [ ] full gate (A+B) + deploy

## PR B — Order transition notifications ✅ committed
- [x] Customer email on every state change; affiliate email on customer-create + ready (gated)
- [x] Adapt sendAffiliateNewOrderEmail (slim); new affiliate-order-ready template; Order role enum +customer
- [x] orderTransitionService tests 17/17
- [ ] full gate (A+B) + deploy

## PR C — Customer-initiated start (phone/email), START ONLY
- [ ] mintSession customer branch (phone/email match); scanAuth forward 'customer'; Order role enum +customer
- [ ] Start-only enforcement (customer actor → only create-pending else 403)
- [ ] claim UI: "or enter phone/email" path in scan-code panel
- [ ] Tests; gate; deploy

## PR D — Order Expediter (read-only token)
- [ ] EXPEDITER_TOKEN guard; expediterService aggregations (active by affiliate, counters, daily completed summary — NO pounds)
- [ ] GET /api/v1/expediter/summary; /order-expediter page (EMBED_PAGES + pageScripts + rebuild min)
- [ ] Tests; Lighthouse; gate; deploy; set EXPEDITER_TOKEN on both boxes

## PR E — Follow-ups
- [ ] operator-login-embed.html inline onclick → addEventListener (CSP)
- [ ] Email i18n parity: en/customer-on-the-way, en/customer-order-delivered, es|pt|de/affiliate-welcome
- [ ] Bag label: add WaveMAX Austin address below customer name (labelSheet4x6 / label-print-utils)
- [ ] Gate; deploy
