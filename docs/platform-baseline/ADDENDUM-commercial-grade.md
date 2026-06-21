# Addendum — decisions + commercial-grade gap resolution

This addendum makes [EXTRACTION-PLAN.md](EXTRACTION-PLAN.md) **decision-complete**. It records the
four kickoff decisions and folds every accepted finding from
[COMPLETENESS-GAPS.md](COMPLETENESS-GAPS.md) into a specific phase with a resolution. Where it
conflicts with the base spec/plan, **this addendum wins.**

---

## 1. Decisions applied

| # | Decision | Plan impact |
|---|---|---|
| 1 | **Sellable / OSS starter** | Ship `LICENSE` (see §4 — open item), `README`, `CONTRIBUTING.md`, `docs/ARCHITECTURE.md` + ADRs, a module-authoring guide, and polished DX (Husky, Prettier, `.nvmrc`, examples). Documentation is a first-class deliverable, not an afterthought. |
| 2 | **Full commercial-grade scope** | The 8 base phases **plus** all P0 and P1 items below are in the first build. Revised effort ≈ **30–38 engineer-days**. |
| 3 | **Docker-first + PM2/nginx** | A multi-stage `Dockerfile` + dev `docker-compose.yml` (app + mongo + optional mongo-express) ship **and** the PM2/nginx/Cloudflare HA path. Both are tested/ documented. |
| 4 | **Oracle ADB first-class** | `mongoCursorRetry` + `mongoOracleDiagnostics` ship **on by default**; `ensure-indexes` (no `syncIndexes`), the **no-TTL-index** rule for Oracle, and `autoIndex:false` are baseline defaults. Standard MongoDB/Atlas works by flipping `ORACLE_BACKEND=false`. The migration runner (P0-5) and any TTL-style cleanup must use interval-purge, not Mongo TTL indexes. |

---

## 2. P0 — folded into phases (all in scope)

| ID | Gap | Phase | Resolution |
|---|---|---|---|
| P0-1 | No graceful shutdown / drain | **A** | Add `platform/boot/lifecycle.js`: trap `SIGTERM`/`SIGINT` → `server.close()` (stop new conns) → drain timeout → close Mongo + teardown monitoring/jobs → exit. Integration test: `/health/ready` returns 503 while draining. Required for safe `pm2 reload` and container rolling deploys. |
| P0-2 | Liveness-only health check | **A** | Keep `/health` as pure liveness (no DB, before session). Add `GET /health/ready` = Mongo ping + critical-config present + no pending migrations + not-draining, for the LB origin-pool monitor. Document which CF LB monitor uses which. |
| P0-3 | No boot-time env validation; insecure `'default-dev-secret'` fallback | **A** | `platform/boot/validateEnv.js` runs first: assert presence + format of `JWT_SECRET`/`ENCRYPTION_KEY`(64-hex)/`SESSION_SECRET`/`CSRF_SECRET`; **refuse to boot in production** on missing/known-default; warn on dev fallbacks. **Strip** the `'default-dev-secret'` fallback (gate to non-prod with a loud warning). Home for the HA `check-secrets-match` concern. |
| P0-4 | Encryption key rotation omitted (tooling already exists in-source) | **B** (engine) + **G** (ops) | Carry a generalized `scripts/rotate-encryption-key.js` (re-encrypt all `encryptField` data old→new) and add a `keyVersion` envelope to `encryptField` output so mixed-version data decrypts during rotation. Document the ceremony in `docs/SECURITY-OPERATIONS.md`. Reclassified: **platform-core ops**, not out-of-scope. |
| P0-5 | No DB migration framework | **A/B** | Adopt a lightweight runner (`migrate-mongo` or hand-rolled `scripts/migrate.js` + an `applied_migrations` collection — **no Mongo TTL index**, Oracle-safe). `npm run migrate`; readiness (P0-2) fails on pending migrations. The base `User`/`Invite` extraction ships as **migration #1** to model the pattern. |
| P0-6 | Containerization dropped (exists in-source) | **A** (dev) + **G** (prod docs) | Generalized multi-stage `Dockerfile` (build/runtime split, non-root, `npm ci --omit=dev`, runs `build:assets`), dev `docker-compose.yml` (app + mongo + optional mongo-express, env from `.env`), `.dockerignore`. Genericize the in-source compose (strip `wavemax` DB name, dummy `email_password_here`). PM2/nginx remains the documented prod path; containers are the dev + cloud-portable path. |

---

## 3. P1 — folded into phases (all in scope)

| ID | Gap | Phase | Resolution |
|---|---|---|---|
| P1-1 | No request-ID / observability | **A** | `platform/middleware/requestId.js`: accept inbound `x-request-id` or mint one; attach to `req`, a Winston child logger (every log line carries it), and the response header. Ship an **optional** OTel/Prometheus seam (`platform/observability/`, off by default) with a `/metrics` hook. |
| P1-2 | CI under-built for "commercial" | **F** | Extend `ci.yml`: `npm audit --audit-level=high`, **gitleaks** secret-scan, **CodeQL** SAST, **Lighthouse-CI** against the booted sample landing (asserts the documented score band → makes §7.1 an executable gate), `.github/dependabot.yml`. |
| P1-3 | No commit-time enforcement | **F** | Husky `pre-commit` (lint-staged → eslint + prettier + `check-no-brand` on staged) + `pre-push` (`check:i18n` + fast unit subset); add `.prettierrc`, `.nvmrc` (Node 20). |
| P1-4 | File-upload primitive dropped, orphaned Multer error branch | **E** | Generic `platform/services/fileStore.js` + `platform/middleware/upload.js` (Multer size/mime allowlist, virus-scan seam, pluggable backend: local-encrypted | S3-compatible), feature-flagged off. Resolves the dangling Multer error mapping coherently. |
| P1-5 | Webhook ingestion seam missing | **A/B** | `platform/routes/webhooks/` mounted **before** the JSON body parser with `express.raw()` + a `verifyWebhookSignature` HMAC helper. One sample, off by default. Pre-solves the body-parser-ordering gotcha the frozen middleware order would otherwise create. |
| P1-6 | No realtime push (SSE/WebSocket) | **D** | Ship a thin SSE helper (the SPA `api-client` already does polling-with-backoff); document the `compression` ↔ streaming conflict (exclude streaming routes). WebSocket left as a documented seam. |

---

## 4. P2 — corrections (apply during the relevant phase)

- **P2-1 Keep username login.** Ship **both** `email` **and** `username` strategies in the baseline (Phase B); a registry with one strategy can't prove extensibility. PIN stays the documented opt-in example.
- **P2-2 Keep the preview-unlock primitive.** Reconcile spec↔plan: extract the Turnstile + attestation + email-OTP + signed-cookie **mechanism** into `platform/middleware/previewUnlock.js`, feature-flagged off (Phase C) — do **not** downgrade to docs-only. (Genuinely reusable: waitlists, beta access, lead-gated content.)
- **P2-3 Audit-log immutability.** Add a pluggable Winston transport seam for audit/`security-critical` logs (syslog/CloudWatch/Datadog) + a `docs/SECURITY-OPERATIONS.md` note that local-only audit logs are insufficient for compliance (Phase B/F).
- **P2-4 Hash password history.** In the base `User` model, store password history as salted PBKDF2 hashes; `isPasswordInHistory` compares via verify. Fix **once**, before the model is copied (Phase B).
- **P2-5 Bake the session-store gotcha as a tested default.** `boot/session.js` ships the 10-min TTL + **interval-purge (not Mongo TTL index)** with an inline comment citing the 2026-05-25 bloat incident; integration test asserts `/health` creates no session document (Phase A).

---

## 5. P3 — polish (Phase F/G/H, in scope given "sellable starter")

`docs/ARCHITECTURE.md` + ADRs (strategy-pattern login, custom rate-limit store + "re-evaluate when
`express-rate-limit` upstream is patched" tripwire, standalone-first SPA) · `CONTRIBUTING.md` +
a module-authoring guide walking all ~12 seams with the sample `app/Widget` as the worked example ·
**axe-core** a11y assertion in the e2e template · wire `codeAttemptLockout` into the generic login
strategy (Phase B, not a dangling util) · `.well-known/security.txt` templated off `brand.config.js` ·
generalized `scripts/ops/{backup,restore}-database.js` + a **DR/restore procedure** in the HA docs ·
roadmap item to migrate `style-src 'unsafe-inline'` → nonce'd/hashed styles for *fully* strict CSP.

---

## 6. Remaining kickoff items (need a decision before Phase A)

1. **Repo name** — placeholder `stack-baseline`. Nothing hardcodes it, but the `git init` needs a final name.
2. **License specifics** — "sellable/OSS" → **MIT** (permissive, maximal adoption) vs a **commercial EULA** (you retain control / sell licenses). Pick one; it sets the `LICENSE` file and README framing.
3. **Target location** — local path for the new repo + the GitHub org/visibility (private first, per "internal now" leanings, or public).

Once these three are set, Phase A (bootstrap + security + config skeleton + the P0 deploy-safety
items + Docker dev path) is the first build increment.
