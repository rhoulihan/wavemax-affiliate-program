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
1. [~] **cf-connecting-ip rate-limit keyGen** — CODE-COMPLETE, awaiting full gate → commit + deploy.
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
2. [ ] **Delivery-fee single source of truth** — collapse to the flat per-affiliate `deliveryFee`;
   remove the V1 `minimumDeliveryFee`/`perBagDeliveryFee` fee fields end-to-end.
3. [ ] **Order-status snapshot consistency** + DELETE the unused bulk order endpoints + monitoring
   `/status` mock removal.
4. [ ] **Service-area / Nominatim cluster removal** front-to-back — delete `serviceAreaService`, the
   `locationValidation` validator fns + import, any remaining Nominatim/geocode-by-radius legacy.
5. [ ] **Orphan sweep** — server: dead payment-email/mailcow service, OAuth/DocuSign scripts, 3 dead
   `server.js` requires, retire `generate-sample-data.js`, remove `testRoutes` + `qrCodeGenerator` demo;
   frontend: registration-success page, ~2.7 MB dead CSS, jspdf, dead bundles, embed-app redirect trio.
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
