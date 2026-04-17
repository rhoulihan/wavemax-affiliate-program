# WaveMAX Affiliate Program — Project Instructions

Global operating rules from `~/.claude/CLAUDE.md` apply here (plan mode default, subagents liberally, simplicity first, verification before done, task management via `tasks/todo.md`, lessons logged to `tasks/lessons.md`). Below are the project-specific extensions.

---

## Project State (active refactor)

This codebase is mid-refactor. Canonical documents:

- **Design:** [`docs/refactor/DESIGN.md`](docs/refactor/DESIGN.md) — current state + target state
- **Plan:** [`docs/refactor/REFACTORING_PLAN.md`](docs/refactor/REFACTORING_PLAN.md) — phased execution
- **Active todo:** [`tasks/todo.md`](tasks/todo.md) — current phase checklist

**Scope context:** clean-slate redeploy. Production data is **not** being preserved. V1 payment code (Paygistix, `Payment` model, `CallbackPool`, `PaymentToken`, `v1` registration/pickup pages) is being **deleted**, not migrated. The `.claude/CLAUDE.md` handbook still describes V1 as live — treat it as current-state reference until Phase 2 removes V1 code.

**Critical security finding:** `keys/docusign_private.pem` is committed to a public GitHub repo. Treat as compromised. See plan §0.1.

---

## Project Rules (extensions to global)

### Testing — strict TDD

- Red → green → refactor for every non-trivial change.
- **Write the failing test first.** Confirm it fails for the right reason before writing implementation.
- No production code lands without a test that would have caught the regression.
- Prefer integration tests at controller/route seams; reserve unit tests for pure logic (pricing, encryption, formatters).
- Tests run clean without `--forceExit` after Phase 1.
- `SystemConfig.initializeDefaults()` is required in `tests/setup.js` — tests that depend on config will fail until this runs.

### Code organization (post-refactor targets)

- No file in `server/` exceeds 800 lines.
- No controller exceeds 500 lines.
- One concern per module. Split by domain (`modules/<domain>/`) not by layer.
- `logger` (Winston) only; `console.*` is blocked by ESLint in `server/`.
- `madge --circular server/` must return zero cycles.

### Internationalization

- Maintain all four languages (en / es / pt / de) whenever adding or changing user-facing copy.
- Translation files: `public/locales/{lang}/common.json`.
- English is the fallback; don't let it mask missing translations in production copy.

### Security

- `keys/`, `temp/`, `secure/`, `*.pem`, `*.key` — never committed.
- Third-party tokens (DocuSign, OAuth access/refresh) encrypted at rest via `server/utils/encryption.js` (AES-256-GCM).
- `testRoutes.js` gated behind `NODE_ENV !== 'production'`.
- No inline scripts/styles; nonce-based CSP only.

### Configuration

- Runtime business values live in `SystemConfig` (MongoDB), not in code.
- Use `await SystemConfig.getValue(key, defaultValue)` — never hardcode rates, fees, limits.

### Commits

- Don't commit without explicit authorization.
- Destructive git operations (force-push, `filter-repo`, `reset --hard`) require explicit authorization.
- Never use `--no-verify` or skip hooks.

### When refactoring

- One concern per PR. Target ≤ 500-line diffs.
- Move-then-delete, not rewrite-in-place. Old file stays as a shim until next sprint.
- Every controller split includes at least one new integration test at the seam.

---

## Reference Documentation

- **`.claude/CLAUDE.md`** — detailed architecture handbook (2,000 lines). Covers models, routes, security, business logic. Note: parts describe V1 payment system being removed in Phase 2.
- **`init.prompt`** — dev persona + working style (active, read at session start).
- **`docs/development/OPERATING_BEST_PRACTICES.md`** — known issues and workarounds.
- **`docs/guides/i18n-best-practices.md`** — translation patterns.
- **`tests/README.md`** — test-suite layout.

---

## Session Startup

1. Read this file + `.claude/CLAUDE.md` (handbook).
2. Read `tasks/todo.md` for the active phase's checklist.
3. Check `git status` and recent commits.
4. If mid-phase work was paused, resume from the todo checklist.
