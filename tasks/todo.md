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
