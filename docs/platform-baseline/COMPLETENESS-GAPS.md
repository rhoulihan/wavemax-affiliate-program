<!-- Generated from a multi-agent analysis of wavemax-affiliate-program (2026-06-20).
     Decisions applied: sellable/OSS starter · full commercial-grade scope ·
     Docker-first + PM2/nginx · Oracle ADB first-class. See README.md + ADDENDUM. -->

---

# COMPLETENESS CRITIQUE — `platform-baseline` spec + plan

The spec and plan are strong on what they cover (security, auth, gates, SPA, i18n, SEO, the extraction mechanics). But a "truly commercial-grade baseline" has material gaps. Findings are prioritized P0 (blocks a credible commercial baseline) → P3 (polish). Each is grounded in verified repo state.

---

## P0 — Blockers for a commercial-grade baseline

### P0-1. No graceful shutdown / lifecycle management
**Gap.** Verified: `server.js` has `uncaughtException`/`unhandledRejection` handlers but **zero** `SIGTERM`/`SIGINT`/`server.close()`/`mongoose.disconnect()` handling. The plan's `boot/` split (Phase A) never adds it. A PM2-cluster, Cloudflare-LB, rolling-deploy topology (the spec's own §5.3 / Phase G) **requires** graceful drain: on `pm2 reload`, in-flight requests must complete, the LB `/health` must flip to draining, and Mongo/session-store connections must close cleanly. Without it, every deploy drops connections and can corrupt the connect-mongo session store mid-write.
**Add.** A `platform/boot/lifecycle.js`: trap `SIGTERM`/`SIGINT` → stop accepting new connections (`server.close`) → drain timeout → `mongoose.connection.close()` + monitoring/jobs teardown → exit. Wire a **readiness vs. liveness** split (see P0-2). Add an integration test asserting `/health` returns 503 during drain.

### P0-2. Health check is liveness-only — no readiness/dependency check
**Gap.** Verified: `/health` (line 644) returns `{status:'UP'}` with no DB check (correct for LB liveness, and the spec keeps it that way deliberately). But there is **no readiness endpoint** that verifies Mongo connectivity, migrations applied, and required config present. A commercial baseline behind an LB needs both: liveness (is the process up?) and readiness (can it serve traffic?). The connectivity-monitor (`/monitoring/status`) exists but is not an LB-consumable readiness probe and the plan only "wires it to real data."
**Add.** `GET /health/ready` (Mongo ping + critical-config present + not-draining) for LB origin-pool gating; keep `/health` as pure liveness. Document which Cloudflare LB monitor uses which.

### P0-3. No boot-time environment/secret validation — and an insecure default exists
**Gap.** Verified: `session secret: process.env.SESSION_SECRET || process.env.JWT_SECRET || 'default-dev-secret'` (line 654). There is **no fail-fast env validation** anywhere (`grep` for envalid/validateEnv = nothing). For a baseline that hands `.env.example` to junior teams, the #1 production incident is a missing/short `ENCRYPTION_KEY` (must be 64-hex) or a fallen-back-to-`'default-dev-secret'` session secret silently shipping to prod. The spec's §7.5 "secrets only via `process.env`" doesn't validate them.
**Add.** `platform/boot/validateEnv.js` run **before** anything else: assert presence + format of `JWT_SECRET`/`ENCRYPTION_KEY` (64-hex)/`SESSION_SECRET`/`CSRF_SECRET`; **refuse to boot in production** if any is missing or equals a known-default; warn on insecure dev fallbacks. This is the natural home for the plan's `check-secrets-match.js` HA concern too. Mis-classification note: the plan keeps the `'default-dev-secret'` fallback implicitly — it should be **stripped** (or gated to `NODE_ENV!=='production'` with a loud warning).

### P0-4. Encryption key rotation is unaddressed — and the spec ships AES-GCM field encryption as a core feature
**Gap.** Verified: `encryption.js` reads `ENCRYPTION_KEY` directly with **no key versioning** (no `keyVersion`, no `ENCRYPTION_KEY_OLD`). Yet the source repo has `scripts/admin/rotate-credentials.sh` + `scripts/security/{encrypt,decrypt}-oauth-tokens.js` — i.e., WaveMAX **already built a key-rotation/migration capability** that the inventory, spec, and plan all omit. A commercial baseline that encrypts data at rest without a rotation story is a compliance non-starter (SOC2/PCI/GDPR all expect key rotation).
**Add.** Carry over a generalized `scripts/rotate-encryption-key.js` (re-encrypt all `encryptField` columns old→new) + document the ceremony in `docs/SECURITY-OPERATIONS.md`. Optionally add a `keyVersion` envelope to `encryptField` output so mixed-version data is decryptable during rotation. This was **mis-classified as out-of-scope by omission** — it's platform-core ops.

### P0-5. No database migration framework
**Gap.** Verified: no migration tooling (`grep migrate` = nothing; no `scripts/migrations/`). `ensure-indexes.js` handles indexes only. A baseline whose explicit value-prop is "ship in days and evolve" needs a schema/data migration path from day one — otherwise every customer reinvents it, and the very real pain the source app described (Customer-model removal, `acceptedAffiliateId` rename) recurs with no safety net.
**Add.** Adopt a lightweight migration runner (`migrate-mongo` or a hand-rolled `scripts/migrate.js` with an applied-migrations collection), a `migrations/` dir with a sample, an `npm run migrate` script, and a readiness check (P0-2) that fails if pending migrations exist. The base `User`/`Invite` extraction (Phase B) should ship as migration #1 to model the pattern.

### P0-6. Containerization is ignored despite existing in the source
**Gap.** Verified: the repo has a working `Dockerfile` and `docker-compose.yml` (full app + mongo + mongo-express). The spec/plan **never mention containers** — they assume bare-metal PM2 + nginx only. For a 2026 commercial starter, a clean multi-stage `Dockerfile` + `docker-compose.yml` (app + mongo) is table-stakes DX and the fastest "clone-and-run" path. The existing compose also hardcodes `wavemax` DB name, `noreply@wavemax.promo`, and `email_password_here` (a committed dummy secret) — needs genericization, not deletion.
**Add.** Phase A or G: a generalized multi-stage `Dockerfile` (separate build/runtime, non-root user, `npm ci --omit=dev`, runs `build:assets`), a dev `docker-compose.yml` (app + mongo + optional mongo-express) with env from `.env`, and `.dockerignore`. Keep PM2/nginx as the production path; containers as the local/dev + cloud-portable path.

---

## P1 — Significant gaps for "commercial-grade"

### P1-1. No observability beyond logs — no metrics, no tracing, no request correlation
**Gap.** Verified: no Prometheus/OTel/statsd/`/metrics`; no request-ID/correlation-ID middleware (`grep` clean). Winston structured logs + audit log are good, but a commercial baseline needs (a) a **request-ID** stamped on every log line and returned as `x-request-id` (essential for debugging distributed/clustered deploys — the spec's own HA topology makes this acute), and (b) at minimum a `/metrics` hook or a documented seam for APM. Lighthouse-100 is front-stage observability; backend observability is absent.
**Add.** `platform/middleware/requestId.js` (accept inbound `x-request-id` or mint one; attach to `req`, all `logger` calls via child logger, and response header). Provide an **optional** OTel/Prometheus seam (`platform/observability/`) off by default. Lighter than full APM, but the hooks must exist.

### P1-2. CI/CD plan is under-built for a "commercial" product
**Gap.** Verified: no existing `.github/workflows/`. The plan's `ci.yml` covers lint/brand-guard/i18n/test — good — but a commercial baseline CI should also include: **`npm audit`/dependency-vulnerability scan** (the whole pitch leans on the audit-proven posture; CI must keep deps clean), **secret scanning** (gitleaks/trufflehog — especially given the source repo's committed-private-key history), **CodeQL/SAST**, **Dependabot/Renovate** config, and a **Lighthouse-CI** job so the §7.1 "release gate" is actually a *gate* and not a doc. Right now Lighthouse is only ever run manually.
**Add.** Extend `ci.yml`: `npm audit --audit-level=high`, gitleaks, CodeQL, Lighthouse-CI (against the booted sample landing, asserting the documented score band), plus `.github/dependabot.yml`. Make the §7.1 gate executable.

### P1-3. No commit-time quality enforcement (DX gap)
**Gap.** Verified: no Husky, no lint-staged, no `.prettierrc`, no `.nvmrc`. The brand-guard, i18n-parity, lint, and "no `console.*` in server" rules only fire in CI — a contributor discovers failures after pushing. For a starter teams will clone and extend, fast local feedback matters.
**Add.** Husky `pre-commit` (lint-staged → eslint + prettier + `check-no-brand` on staged files) and `pre-push` (`check:i18n` + fast unit subset); add `.prettierrc`, `.nvmrc` (Node 20). Cheap, high-leverage.

### P1-4. File-upload / object-storage subsystem entirely dropped, no generic replacement
**Gap.** Verified: the only `multer` reference left is in `errorHandler.js`'s error mapping — i.e., the platform **handles Multer errors but ships no upload capability**. WaveMAX had `secureFileStore.js` (AES-encrypted W-9 uploads). The plan strips it as domain (correct for W-9) but provides **no generic secure file-upload primitive**. Almost every real customer app needs authenticated upload (avatars, attachments, documents) with size/type limits and at-rest encryption. Leaving an orphaned Multer error-handler with no upload path is incoherent.
**Add.** A generic `platform/services/fileStore.js` + `platform/middleware/upload.js` (Multer with size/mime allowlist, virus-scan seam, pluggable backend: local-encrypted | S3-compatible), feature-flagged off. Or, if truly out of scope, **document it as a named seam** and remove the dangling Multer error branch.

### P1-5. Webhook ingestion pattern missing
**Gap.** Verified: no webhook routes in the baseline (WaveMAX's were DocuSign, already removed). Commercial apps integrate Stripe/Twilio/etc., all of which need **raw-body signature verification** — which conflicts with the global `express.json()` + `mongoSanitize` middleware order the spec freezes. A baseline with a locked middleware order but no documented webhook seam will force every customer to fight the body-parser ordering.
**Add.** A documented `platform/routes/webhooks/` seam mounted **before** the JSON body parser with `express.raw()` + an HMAC-signature-verify helper (`verifyWebhookSignature`). One sample, off by default. This is exactly the kind of "audit-proven gotcha" the baseline should pre-solve.

### P1-6. CORS / null-origin / SSE / WebSocket realtime story
**Gap.** The spec carries CORS hardening (good) but a baseline has **no realtime push** (SSE or WebSocket) primitive, and the iframe postMessage protocol is the only async channel. Many modern apps need server-push (notifications, live status). Also `compression` + SSE/streaming interact badly (must exclude streaming routes).
**Add.** At minimum document the seam; ideally a thin SSE helper that the §3.4 SPA `api-client` already half-supports (it has polling-with-backoff but no push). Low priority to *build*, but flag the absence so customers aren't surprised by the compression/streaming conflict.

---

## P2 — Mis-classifications and correctness issues

### P2-1. Polymorphic-login collapse is riskier than the plan admits — keep username strategy
**Issue.** The plan strips username login and operator PIN entirely, shipping only `email+password`. But username-based login is a **mainstream, reusable** auth pattern (not laundry-specific). Collapsing three flows into a strategy registry is right; **deleting the username strategy is over-stripping**. The PIN strategy is genuinely domain-ish (shared env PIN) — strip that. Username should ship as a second built-in strategy to prove the registry actually generalizes (a registry with one entry doesn't demonstrate extensibility, and Phase B's `AuthFlow.integration.test.js` can't meaningfully test the seam with a single strategy).
**Fix.** Ship `email` + `username` strategies in baseline; PIN as the documented opt-in example.

### P2-2. `franchisePreview` unlock-flow: spec keeps the primitive, plan deletes it — contradiction
**Issue.** Spec §3.3 says ship "the unlock-flow primitive" (Turnstile + attestation + emailed one-time password + signed cookie) as a reusable content-gate. Plan Phase C **drops `franchisePreview.js` entirely** (moves to `docs/patterns/`). These conflict. The Turnstile-gated, email-OTP, time-boxed unlock is a genuinely reusable "self-serve gated access" primitive (waitlists, beta access, lead-gated content) — more broadly useful than the access-gate magic-link it sits beside.
**Fix.** Reconcile: extract the **mechanism** (sans GBP/franchise glue) into `platform/middleware/previewUnlock.js`, keep it feature-flagged-off, as the spec intends. The plan's "docs-only" downgrade loses real value.

### P2-3. Audit-log immutability / shipping not addressed
**Issue.** Audit logger writes to local files + (in WaveMAX) Mongo. The inventory's own risk note flagged that "a compromised MongoDB can erase audit trails." The spec keeps the audit logger as core but **never addresses log shipping/immutability**. A commercial security baseline that advertises audit logging must at least document the seam to ship logs to an append-only/external sink (syslog/CloudWatch/Datadog) and warn that local-only audit logs are insufficient for compliance.
**Fix.** Add a pluggable Winston transport seam for audit/security-critical logs + a `docs/SECURITY-OPERATIONS.md` note. Cheap; closes a stated risk.

### P2-4. `passwordHistory` stored as plaintext-equivalent is carried over without fixing a flagged risk
**Issue.** The auth-rbac inventory explicitly flagged: "Password history: Stored as plaintext in user model. If DB is breached, old passwords are readable." The plan re-authors `User` from `Administrator` **carrying the same pattern**. A baseline shouldn't propagate a known weakness into its foundational `User` model.
**Fix.** Store password history as salted hashes; `isPasswordInHistory` compares via the same PBKDF2 verify. Fix it once, in the base `User`, before it's copied everywhere.

### P2-5. `connect-mongo` session store + the 2026-05-25 incident gotcha must be a baseline default, not tribal knowledge
**Issue.** The spec mentions the session-bloat incident and the `/health`-before-session fix, but the **root cause** (sessions TTL 24h→10min; never `drop()` the sessions collection on Oracle ADB; interval-purge not TTL-index) lives only in Rick's memory file. A baseline must encode this as a tested default + an inline comment, or the next clone re-creates the outage.
**Fix.** Bake the 10-min TTL + interval-purge config into `boot/session.js` with a comment citing the incident, and an integration test asserting `/health` does not create a session document.

---

## P3 — Polish / completeness

- **`docs/ARCHITECTURE.md` + ADRs.** The plan ships runbooks and quality docs but no top-level architecture overview or Architecture Decision Records (why strategy-pattern login, why custom rate-limit store, why standalone-first SPA). A commercial starter needs the "why" captured or the next team relitigates it. The custom `rateLimitMongoStore` (built to dodge `underscore@1.12.1`) especially needs an ADR + a "re-evaluate when express-rate-limit upstream is patched" tripwire.
- **CONTRIBUTING.md + module-authoring guide.** The §6 plug-in seams are the product's core extensibility story but there's no single "how to author a domain module" doc walking all 12 seams end-to-end with the sample `app/Widget` as the worked example.
- **Accessibility testing in CI.** Spec mandates Lighthouse A11y=100 but there's no automated a11y assertion (axe-core) in the test harness — only manual Lighthouse. Add an axe-core check to the e2e template.
- **Rate-limit / brute-force on the generic `login` beyond IP.** The plan keeps `codeAttemptLockout` (per-key+IP) — good — but should explicitly wire it into the generic login strategy in Phase B, not leave it as a Phase-C utility that nothing calls.
- **`.well-known/security.txt`** — trivial, expected on a security-forward commercial product; template it off `brand.config.js`.
- **Backup/restore tooling generalization.** Source has `scripts/admin/{backup,restore}-database.js`. The plan mentions neither. Carry generalized versions into `scripts/ops/` and reference them in the HA/DR docs (the spec has HA but **no documented DR/restore procedure** — a gap for "commercial-grade").
- **CSP `style-src 'unsafe-inline'` exception** is carried as documented-and-permanent. Flag a roadmap item to migrate to nonce'd/hashed styles so the baseline can eventually claim *fully* strict CSP — a real differentiator.

---

## Summary of the highest-impact additions
1. **Graceful shutdown + readiness probe + boot-time env validation** (P0-1/2/3) — the deploy topology the spec mandates is unsafe without these.
2. **Migration framework + encryption-key-rotation** (P0-5/4) — "evolve in days" and "encrypt at rest" are hollow without them; rotation tooling *already existed* and was dropped.
3. **Containerization** (P0-6) — a working Dockerfile/compose exists in-source and was silently omitted.
4. **Request-ID/observability seam + executable CI gates (audit, secret-scan, Lighthouse-CI) + Husky** (P1-1/2/3) — the difference between "audit-proven posture" as marketing vs. as an enforced, debuggable system.
5. **Reconcile the spec↔plan contradictions** (P2-1 username login, P2-2 previewUnlock) and **fix the two carried-over known weaknesses** (P2-4 plaintext password history, P2-5 session-store gotcha) before they're copied into the foundational `User`/`session` modules.

Mis-classifications to correct: encryption-key-rotation tooling (wrongly omitted as out-of-scope → it's platform-core ops); username login strategy (wrongly stripped → reusable, keep); `franchisePreview` unlock primitive (plan deletes, spec keeps → keep per spec); the `'default-dev-secret'` session fallback (silently kept → strip/gate).