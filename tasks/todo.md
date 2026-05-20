# Phase 1 — Repo Hygiene (COMPLETE)

**Canonical plan:** [`docs/refactor/REFACTORING_PLAN.md`](../docs/refactor/REFACTORING_PLAN.md)
**Status:** complete and merged to `main`. Ready for Phase 2.

## Commits (chronological)

- `f1ff1f9` — `refactor: phase 1 — repo hygiene + clean-slate scope`
- `13c5bb6` — `refactor: phase 1 (continued) — scripts reorg, lean README, doc cleanup`
- `8a7a1c9` — `refactor: correct plan — paygistix stays + harden test setup`
- `a0e5ba5` — `refactor: drop coverage-analysis route, fix admin-script test path`

## Done

- [x] Delete cruft (`coverage-test-run.txt`, `[A`, `quarantine/`, `public/coverage-analysis/`, old policy pages, `env.example`)
- [x] Archive `public/filmwalk/` → `/mnt/c/Users/rickh/Archive/wavemax-filmwalk-2026-04-17.tar.gz`, then delete route + files
- [x] Delete `public/franchisee-landing.html` + css/js + 2 route mounts
- [x] Move `REFACTORING_COMPLETE.md`, `operator-credentials-example.json`, `project-logs/` into `docs/`
- [x] Merge `env.example` → `.env.example`
- [x] `.gitignore` hardening (`keys/`, `secure/`, `*.pem`, `temp/`, coverage dumps, IDE)
- [x] Delete duplicate `docs/development/CLAUDE.md`; create root `CLAUDE.md` with inherited globals + strict TDD + project extensions
- [x] `tests/setup.js` seeds `SystemConfig.initializeDefaults()` before each test (with try/catch for unit suites that mock mongoose)
- [x] `testRoutes.js` already gated by `NODE_ENV !== 'production'` (no change needed)
- [x] Git history rewrite #1 — purged `keys/`, `secure/`, `temp/`, `quarantine/`, `coverage-test-run.txt`, `[A` from all 808 commits; force-push
- [x] Git history rewrite #2 — purged `test-coverage-results-partial.txt` (58.8 MB); force-push
- [x] Scripts reorg — 115 → 43 files organized into `scripts/{admin,setup,security,ops,diagnostics}/`; package.json + docker-compose.yml paths updated; relative requires fixed
- [x] README rewrite — 2,345 lines → 88 lines; original at `docs/archive/README-2026-04-17-full.md`; feature list extracted to `docs/FEATURES.md`
- [x] Delete 27 stale HTML docs in `docs/`
- [x] Plan correction after "Paygistix stays" direction — `docs/refactor/REFACTORING_PLAN.md` §4.1 / §4.8 / §6.1 / §6.5 updated; `docs/refactor/DESIGN.md` Appendix D rewritten
- [x] Drop `/coverage-analysis` route + tests (artifact of deleted `public/coverage-analysis/`)
- [x] Fix `createAdminScript.test.js` hardcoded path to moved script

## Test suite outcome

Starting baseline: 48 failures (`Configuration key not found` cascade).

Post-Phase-1 (run 3 + self-inflicted fixes, projected):
- ~2,659 passing, ~31 failing, 70 skipped
- 0 `Configuration key not found` failures — target achieved
- 0 `buffering timed out` failures — regression resolved

The ~31 remaining failures are pre-existing test drift in:
- `integration/order.test.js`, `payment.test.js`, `immediate-pickup.test.js`, `affiliateSchedule.test.js` (integration + unit) — 400 where 201 expected, likely validation / fixture drift
- `formatters.test.js` — 1-2 assertion mismatches
- `passportCustomerOAuth.test.js` — slow run (94 s), possible timeout
- Affiliate model day-of-week tests — suspect timezone

**Decision (2026-04-17):** park these for Phase 2 and address as we touch the affected code paths, rather than fix in Phase 1.

## Notes / learnings

- `git filter-repo` resets the working tree to match the rewritten HEAD. Any uncommitted edits are wiped. **Always commit or stash before running filter-repo.** Lost one batch of edits to this; pattern now documented in REFACTORING_PLAN.md.
- `filter-repo --force-with-lease` can fail with "stale info" right after filter-repo because the remote-tracking ref is stale. Use `--force` when you're sole collaborator.
- `pip3 install git-filter-repo` on Debian 12 / WSL needs `--user --break-system-packages` (PEP 668).
- `beforeEach` hooks that `require()` Mongoose-dependent modules break unit suites that mock `mongoose` — wrap in try/catch.
- Paygistix is NOT V1-specific. The callback pool is how the payment processor returns status for *all* payments regardless of when capture happens. V1 was the *upfront-capture-at-registration* workflow; V2 is post-weigh. Both use Paygistix.

---

# Phase 2 — next up

See [`docs/refactor/REFACTORING_PLAN.md`](../docs/refactor/REFACTORING_PLAN.md) §4. Scope:

- V1 upfront-capture workflow deletion (keep Paygistix, drop V1-only pages/JS/registration branching)
- DocuSign deprecation + admin manual unlock (§4.1.1)
- emailService.js decomposition (3,618 → three focused modules)
- Circular dep resolution (`customerController ↔ paymentController`)
- God-controller splits (admin, auth, operator, order, customer)
- RBAC middleware consolidation
- Logging standardization

---

# Deferred — major dependency upgrades (open items, post-Phase-2)

**Status as of 2026-05-20:** `npm audit` is clean (0 vulnerabilities). The bumps below are not security-driven; they're modernization to keep the dep graph from stagnating. Each is a major-version bump with documented breaking changes, so each needs its own PR with code review + targeted tests + at least one round of smoke testing on staging.

**Prerequisite gate:** test suite must run clean without `--forceExit` (root `CLAUDE.md` rule). Today it doesn't (CSRF / order / marketing tests fail pre-existing — Phase-1 known drift). Until tests are green, dep bumps can't be safely verified.

**Suggested order — lowest risk first, save highest-blast-radius for last:**

| # | Package | Bump | Risk | What to review |
|:---:|:---|:---|:---:|:---|
| 1 | `dotenv` | 16 → 17 | low | warning behavior on missing vars; new `quiet: true` option to suppress; check `dotenv.config()` call sites |
| 2 | `helmet` | 7 → 8 | medium | CORP / COEP defaults changed; review our manual CSP middleware in `server.js`; new `crossOriginEmbedderPolicy` default may affect iframe embed |
| 3 | `express-rate-limit` | 7 → 8 | medium | `Store` interface changed (`init`, `prefix`, `localKeys`); also touches our `createMongoStore` swap when affiliate program comes back online |
| 4 | `joi` | 17 → 18 | medium | `.required().messages(...)` re-validation across every schema in `server/middleware/sanitization.js` + every controller; dropped `.error()` legacy signature |
| 5 | `connect-mongo` | 5 → 6 | medium | session-cookie encoding changed; existing sessions will invalidate (log all users out at deploy); review `MongoStore.create()` options shape |
| 6 | `nodemailer` SMTP transport audit | 8 (already on) | low | already on 8.0.7; double-check Mailcow STARTTLS handshake + Brevo API-key path against the 7/8 transport refactor; no code changes expected but worth a manual deliverability test |
| 7 | `uuid` | 9 → 14 | **high** | v14 is ESM-only — every `require('uuid')` becomes `await import('uuid')` or needs a CJS shim. Touch surface: ~20+ files generating affiliateId/customerId/orderId. Big refactor unless we add a `uuid-cjs-shim` indirection. |
| 8 | `mongoose` | 8 → 9 | **high** | Every query, every `findOneAndUpdate`, every `populate`, every `.lean()`, every middleware hook. Highest blast radius in the codebase. Save for a dedicated sprint. Migration guide: review carefully. |
| 9 | `express` | 4 → 5 | **highest** | Error-handling moves to promise-based by default; `req.body` parsing behavior changes; route parameter syntax has subtle changes; `res.redirect()` semantics tweaked; middleware signature for async handlers no longer needs `asyncWrapper`. Effectively its own multi-week project. Should NOT be combined with any other major bump in the same PR. |

**Sub-tasks worth tracking independently:**

- [ ] Replace `createMongoStore` no-op (currently returns `undefined` → in-memory store) with a maintained shared store (`@express-rate-limit/mongo-store` or `rate-limit-redis`) **before** re-enabling the affiliate-program auth surface publicly. Per-worker in-memory means rate limits are effectively 3× looser in production (3 PM2 workers).
- [ ] Replace `imap` consumers (`imapEmailScanner`, `mark-emails-unread`) — already done 2026-05-20 (migrated to `imapflow`). Listed here for completeness; no further work needed.
- [ ] Add CI gate that runs `npm test` + `npm audit --audit-level=high` on every PR — without this, drift comes back within months.
- [ ] Stand up a staging environment (port 3001, separate Mongo db) so major dep bumps can be tested without touching prod. Today there is no staging — every dep bump is "test in production."
- [ ] Add `npm outdated` to monthly maintenance checklist; review any package that's >12 months behind its latest semver-compatible release.

**Reference:** the post-mortem of this maintenance pass (24 vulns → 0 in a single day) is in this todo's git history (commits `8956464` compression, `4fb2b52` nodemailer, `cd95298` imapflow, `bc56cf6` rate-limit-mongo, prior kernel reboot also same date). The bumps above are the items that were too high-risk to include in that same-day sweep.
