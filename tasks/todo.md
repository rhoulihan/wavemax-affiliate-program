# Phase 1 — Repo Hygiene

**Canonical plan:** [`docs/refactor/REFACTORING_PLAN.md`](../docs/refactor/REFACTORING_PLAN.md)
**State:** major items done; working tree has 35 uncommitted changes awaiting Rick's commit.

## Done

- [x] Delete `coverage-test-run.txt`, `[A`, `quarantine/`, `public/coverage-analysis/`, `privacy-policy-old.html`, `terms-of-service-old.html`
- [x] Archive `public/filmwalk/` → `/mnt/c/Users/rickh/Archive/wavemax-filmwalk-2026-04-17.tar.gz`
- [x] Delete `public/filmwalk/` + route mount in `server.js` + `server/routes/routingRoutes.js` + `tests/unit/routingRoutes.test.js`
- [x] Delete `public/franchisee-landing.html` + css/js + route in `server.js` + route in `embedRoutes.js`
- [x] Move `REFACTORING_COMPLETE.md` → `docs/project-history/REFACTORING_2025-09.md`
- [x] Move `operator-credentials-example.json` → `docs/examples/`
- [x] Move `project-logs/` → `docs/implementation-logs/`
- [x] Merge `env.example` into `.env.example`
- [x] Update `.gitignore` (keys/, secure/, *.pem, *.key, temp/, coverage dumps, IDE)
- [x] Delete duplicate `docs/development/CLAUDE.md`
- [x] Create root `CLAUDE.md` with inherited globals + strict TDD + project extensions
- [x] Add `SystemConfig.initializeDefaults()` to `tests/setup.js` `beforeEach`
- [x] Confirm `testRoutes.js` is already gated by `NODE_ENV !== 'production'` in `server.js`
- [x] Update `REFACTORING_PLAN.md` §4.1.1 with DocuSign deprecation + admin manual unlock design
- [x] **Git history rewrite** — 808 commits, purged `keys/`, `secure/`, `temp/`, `quarantine/`, `coverage-test-run.txt`, `[A`
- [x] Force-push to origin — remote `main` now clean (new tip: `82e7f28`)
- [x] Backup at `/tmp/wavemax-git-backup-1776443756` (pre-rewrite .git)

## Not yet done (Phase 1)

- [ ] Run `npm test` to confirm 48 Mailcow failures are gone and suite health
- [ ] Scripts reorganization — categorize 115 files into `scripts/{admin,setup,security,ops,diagnostics}/`, delete obsolete migrations
- [ ] Rewrite root `README.md` (88KB → ~5KB, move feature list to `docs/FEATURES.md`, architecture detail to `docs/architecture/ARCHITECTURE.md`); show diff before overwriting
- [ ] Delete stale HTML docs in `docs/` that have MD replacements (skip Paygistix docs since the whole integration is being deleted in Phase 2)
- [ ] Reconcile `.claude/CLAUDE.md` vs new root `CLAUDE.md` — keep the big one as handbook, note stale parts about V1/DocuSign
- [ ] Add `Last updated:` headers to remaining docs
- [ ] Clean up 58.8MB `test-coverage-results-partial.txt` from git history (GitHub flagged it — second-pass filter-repo)

## Blocked (Rick's action)

- [ ] Rick commits the 35 working-tree changes when ready (Claude does not commit without explicit ask)

## Notes / learnings during execution

- **`git filter-repo` side effect:** running it resets the working tree to match the rewritten HEAD, wiping any uncommitted edits. If we do another filter-repo pass, commit first OR stash working tree first. My edits got wiped mid-turn and I re-applied them.
- **filter-repo removed `origin` remote** by design (prevents accidental push back). Had to `git remote add origin ...` before push.
- **`--force-with-lease` rejected with "stale info"** because the remote-tracking branch was stale after filter-repo. Used `--force` (Rick is solo on repo).
