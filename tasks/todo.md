# Active todo — Codebase audit remediation (2026-06-23)

Full audit: `docs/refactor/CODEBASE-AUDIT-2026-06-23.md` (47 findings → 28 items / 8 workstreams).
Locked decisions: quick wins first; remove the WHOLE service-area/Nominatim cluster; bulk order
endpoints unused → remove; cf-connecting-ip keyGen = next fast follow; `--forceExit` → hunt+close the
leaked handle; breaking deps = own careful PR; pre-approved deletions (.env.example Stripe/AWS/SERVICE_*,
dead SystemConfig keys, retire generate-sample-data.js, remove testRoutes + qrCodeGenerator demo).

## PASS 1 — 5 quick wins (P1) — CODE-COMPLETE, awaiting gate → commit + deploy
Targeted tests green (64): validateSecrets, rateLimitMongoStore, customerClaim, affiliateInvites.
Full gate running (bg4n48i8n). NOT yet committed.
- [x] QW1 — `npm audit fix` (critical + 8/9 highs cleared in-range; 1 high needs breaking bump → PASS 9).
- [x] QW2 — Claim confirmation uses partner's OWN fee: `deliveryFee` added to `bagClaimService.select()` + test.
- [x] QW3 — Austin service-area validators removed from registration + profile (format checks + handleValidationErrors kept; validator fns still exported, deleted in PASS 4) + tests.
- [x] QW4 — Secret fail-fast at boot (`validateSecrets.js`: JWT_SECRET/SESSION_SECRET present, ENCRYPTION_KEY=64hex; prod-only `process.exit(1)`) + dev-default HMAC literals gated to non-prod (server.js session secret + previewUnlockCookie). Prod env confirmed to carry all three → won't brick boot.
- [x] QW5 — ADB rate-limit window reset (rateLimitMongoStore.increment two-step: $inc only in active window, else $set reset) + window-boundary test.

### Deploy gate (PASS 1) — ✅ DONE & LIVE (2026-06-23, commit 7f30797)
- [x] Full jest gate green (177 suites / 2847 passed, 6 skipped) → committed + pushed main.
- [x] `git pull --ff-only` + `npm ci` (applies QW1 patched deps) + secret-preflight-gated `pm2 reload --update-env` on BOTH OCI boxes.
- [x] Live-verify: /health 200 both boxes; secret preflight `[]` both (no boot exit); CF edge — claim route 200, health 200.

## REMAINING WORKSTREAMS — sequenced, each its own PR (decisions locked)
1. [x] **cf-connecting-ip rate-limit keyGen** — ✅ DONE & LIVE (2026-06-23, commit 0d80d73). Full gate
   179 suites / 2890 passed / 6 skipped. Deployed both OCI boxes (git pull + npm ci + pm2 reload);
   live-verified /health 200 + CF claim route 200.
   Canonical `server/utils/clientIp.js` (`clientIp` + `ipBucketKey`: cf-connecting-ip first, IPv6
   collapsed to /64 via pinned `ipaddr.js`), wired into all 13 limiters + `createCustomLimiter` default;
   `scanRoutes` inherits it; `codeAttemptLockout` lockout counter migrated to `ipBucketKey` (defeats
   IPv6 /64 rotation), audit log keeps full IP. Adversarial-reviewed (4 lenses, 21 agents) — fixed:
   whitespace-header empty-bucket regression, garbage-header → req.ip fallback, the stale
   `rateLimitingMiddleware.test.js` assertions, trust-comment correction. New tests: clientIp (18),
   rateLimitKeyGen (11), wiring-identity guards, IPv6 /64 lockout guard.
   - Deploy note: store keys shift (::ffff:/IPv6 forms change) → old IPv6 / IPv4-mapped rate-limit +
     lockout buckets orphan; pure-IPv4 unaffected; self-heals in one window. No action needed.
   - Backlog surfaced by the review (fold into the listed workstreams):
     - WS6: migrate the 6 IP gates (accessGate/adminIpGate/operatorIpGate/comingSoon/locationQuarantine/
       franchisePreview) onto canonical `clientIp` — they inline divergent `::ffff:` handling.
     - WS5/6: 3 limiters wired to no route (emailVerification/fileUpload/adminOperation) — wire or remove.
     - WS9: when express-rate-limit bumps to a version exporting `ipKeyGenerator`/`ipv6Subnet`, adopt it
       (canonical IPv6 key form; one-time bucket orphan).
     - Infra (needs Rick): nginx `set_real_ip_from <CF ranges>; real_ip_header CF-Connecting-IP;` so the
       trust is protocol-enforced, not firewall-only. Production nginx edit — confirm first.
2. [x] **Delivery-fee single source of truth** — ✅ DONE & LIVE (2026-06-23, commit a1c2b0d). Full gate
   179 suites / 2890 passed (+ migration suite 6/6). Deployed both boxes; migration ran on the shared
   ADB (0 backfills — the 1 affiliate's $10 preserved; 1 orphan-V1 doc cleaned → 0 V1-bearing docs).
   CF-edge verified: register/claim/dashboard render 200; register has the flat deliveryFee input + 0 V1;
   pricing-preview + bundle live at ?v=20260623a.
   Removed V1 `minimumDeliveryFee`/`perBagDeliveryFee` end-to-end → flat `deliveryFee` (DECISION Rick:
   flat-fee input on registration; one atomic PR). Model; affiliate/admin routes; affiliate/admin/
   manualAffiliate controllers (2 public endpoints now use effectiveDeliveryFee); bagClaimService;
   testRoutes; register+dashboard+landing HTML/JS; PricingPreviewComponent rewritten flat-fee; i18n×4
   (parity 0); SPA cache-bust ?v=20260623a; factories + asserting suites flipped; ~12 test files cleaned.
   - Adversarial review (23 agents, 4 lenses): 1 BLOCKER fixed → **legacy affiliates have deliveryFee=0
     + real V1 values; effectiveDeliveryFee would flip them to the $10 default.** FIX: one-time backfill
     `scripts/migrate/backfill-delivery-fee.js` (deliveryFee = perBag||min||0, then $unset V1; dry-run
     default; tested 6/6). **DEPLOY GATE: run `npm run migrate:delivery-fee` (dry-run) then
     `:confirm` on ONE box after git pull, before/with reload.**
   - Review nits deferred (not blocking): orphaned V1 i18n keys → WS7; generate-sample-data.js (already
     broken, dev-only) → WS5; manual-create defaults deliveryFee 0 (admin-managed, intentional);
     affiliate self-update of deliveryFee still allowed (pre-existing; "read-only" is a dashboard UI
     convenience); pre-existing dashboard JS smells (#deliveryFee dead read, listener re-init on a
     disabled input) → opportunistic.
3. [x] **Order-status snapshot consistency + bulk removal + monitoring mock** — ✅ DONE & LIVE
   (2026-06-23, commit 3e16fa9). Full gate 180 suites / 2885 passed. Deployed both boxes (pull + reload);
   CF-edge verified (claim/health 200; /monitoring/status no longer serves data unauthenticated). (A) Monitoring: mock `/status` (random metrics + phantom Payment Gateway)
   replaced by real connectivity-monitor; shadowed server.js duplicate removed → one source; **gated
   behind adminIpGate** (was public — real infra data). (B) Bulk endpoints removed (locked unused→remove):
   PUT /bulk/status, POST /bulk/cancel, controller handlers, orderBulkService.js, tests; stale CSRF entry
   removed. (C) Snapshot consistency: shared `recordSendOutSnapshot` in orderTransitionService (advanceOrder
   + updateOrderStatus both use it; out_for_delivery freezes deliveryFeeCharged+orderTotal, 400 on bad
   total). Single-order PUT/cancel KEPT+fixed (external callers unverifiable). Adversarial review (13
   agents): 1 blocker (monitoring exposure) fixed; nit (dead test-scaffolding bulk refs) left.
4. [x] **Service-area / Nominatim cluster removal** — ✅ DONE & LIVE (2026-06-24, commit 1aa286e). Mapped
   (3-lens workflow) + adversarially reviewed (3-lens, SOUND). Deleted 10 files (serviceAreaRoutes,
   serviceAreaService, addressValidationService, data/service-area.json, generate-service-area.js, 3
   frontend JS, 2 tests); edited server.js/csrf/locationValidation (kept shared format validators +
   handleValidationErrors) + register form (address step → synchronous "Continue", no /service-area) +
   pageScripts/min/i18n. KEEP-set (Google geo gate, gbpToLocationData, claim.outsideServiceArea) intact.
   Full gate 178 suites / 2841 passed. Deployed both boxes; verified: /service-area 404, register page
   loads clean in browser (0 console errors, 0 cluster scripts, 0 /service-area calls, 0 404s), invite
   gate intact, new bundle ?v=20260624a live. (Address-step click-through not browser-tested — form is
   invite-gated — but rewire reviewed + load clean.)
5. [x] **Orphan sweep** — ✅ DONE & LIVE (2026-06-24, commits 9bed2c7 + earlier batch). Verified via
   2-workflow map + per-item adversarial verification; 43 dead files removed (mailcow/payment + OAuth/
   DocuSign scripts + generate-sample-data; helpers.js, qrCodeGenerator, testRoutes + gate + CSRF /test
   exemptions, server/assets logos, 2 dead server.js requires [only 2 existed, not 3]; registration-success
   + quarantine entry; 2.7 MB self-serve-laundry.css, jspdf.min.js, thermal-print-utils.js, 4 customer/
   scheduling CSS; embed-app redirect trio + site-page-embed; 5 owner-confirmed direct-URL pages +
   companions). Kept (verified live): affiliate/customerController, qrcode.min.js, swirl-spinner,
   label-print-utils, self-serve-laundry-modern.css. Full gate 175 suites / 2791 passed; madge 0 cycles;
   deployed both boxes; verified /api/v1/test/* 404, deleted bundles 404, admin jspdf CDN intact, SPA 200.
6. [ ] **Redundancy consolidation** — IP-gate factory + canonical `clientIp`/`reqHost`; delete the dead
   `auth.js` XFF block; dedup `escapeHtml`/`escapeJsonForScript`/`isExempt`.
7. [ ] **Deprecated email/config/i18n** — rewrite `sendAffiliateNewCustomerEmail` V1 copy (en/es/pt/de);
   remove dead dispatcher fns/templates; remove dead SystemConfig keys; `.env.example` Stripe/AWS/SERVICE_* removal.
8. [ ] **Docs/tests** — handbook + EMBED_PAGES refresh; README/tests-README stats; re-enable 6 skipped
   tests; HUNT + close the `--forceExit` leaked handle; claim.js email-optional drift.
9. [ ] **Breaking-deps upgrade** (own careful PR) — nodemailer 9 / uuid 14 / joi 17.

## Process
Strict TDD (red→green) per PR. `node scripts/check-i18n-parity.js` = 0 errors. Full jest gate green per
PR (suite is 0-fail; any failure is real). SPA cache-bust when admin/claim JS changes (bump page `?v=`
+ pageScripts entry + `npm run build:assets` + min `?v=` + adminIpAuthz pinned assertion). Commit +
deploy per PR (git pull both OCI boxes; `pm2 reload` for server-code). Maintain en/es/pt/de in-commit.
Production config edits (.env.example, Dockerfile, ecosystem, CI) confirm with Rick first.

---

## (prior) Partner-opt-in customer geolocation radius gate — ✅ COMPLETE & LIVE (2026-06-22, e4a66d3 + eff78f0)
Google Address Validation + Haversine radius gate; admin opt-in per affiliate; fail-open. Full gate green
(176 suites / 2843 tests). Deployed both boxes; live-verified geocoding from oci1; GOOGLE_GEOCODING_API_KEY
live on both. Detail in git history + `docs/refactor/CODEBASE-AUDIT-2026-06-23.md`.
