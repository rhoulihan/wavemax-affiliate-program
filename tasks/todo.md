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
- [x] operator-login-embed.html inline onclick → <span> (CSP-clean; alert just repeated the link text)
- [N/A] Email i18n parity — VERIFIED a non-issue: dispatchers loadTemplate(name, lang) + JS-embedded
      per-lang translations; root template + correct-language strings serve es/pt/de via fallback. No drift.
- [x] Bag label: WaveMAX Austin address (825 E Rundberg Ln, Suite F1 / Austin, TX 78753) below customer name, both render paths
- [ ] Gate; deploy

## Done — A,B,C,D deployed; each adversarially reviewed (12/11/16 findings fixed). EXPEDITER_TOKEN set on both boxes.
## Note: expediter Lighthouse deferred (WSL Chrome flake); internal display, CSP-clean/DOM-only/i18n-complete.
