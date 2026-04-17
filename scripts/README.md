# `scripts/` — Operational Scripts

Categorized utilities for running, maintaining, and diagnosing a WaveMAX deployment. None of these scripts are loaded by the application at runtime; they are CLI tools invoked by humans or by `package.json` npm scripts.

## Layout

| Directory | Purpose | Example contents |
|---|---|---|
| `admin/` | Production admin tools — account management, password resets, backup/restore, rate-limit reset | `backup-database.js`, `create-admin-directly.js`, `reset-admin-password.js`, `rotate-credentials.sh` |
| `setup/` | Development-environment and first-deploy bootstrap | `setup-database.js`, `init-defaults.js`, `init-mongo.js`, `generate-sample-data.js` |
| `security/` | Security-critical utilities (rarely run) | `encrypt-oauth-tokens.js`, `decrypt-oauth-tokens.js`, `extract-public-key.js` |
| `ops/` | Operational config — email (Mailcow), IMAP, log cleanup, payment interval tuning | `configure-mailcow.js`, `update-mailcow-url.js`, `clean-logs.sh`, `update-payment-interval.js` |
| `diagnostics/` | Read-only data checks | `check-data-distribution.js`, `check-initialization.js`, `check-order-distribution.js` |

## Running scripts

Most scripts load `.env` from the project root. Run from any working directory:

```sh
node scripts/setup/init-defaults.js
node scripts/admin/backup-database.js
```

Or via npm scripts (defined in `package.json`):

```sh
npm run setup:database
npm run init:defaults
npm run generate:sample-data
```

## What was deleted

During the Phase 1 refactor (2026-04-17), the following categories of scripts were deleted — they have no ongoing operational value:

- **One-time migration scripts** (`migrate-*`, `add-*-config`, `csrf-rollout`, `remove-*`, `complete-migration*`). Clean-slate redeploy means no historical data to migrate.
- **DocuSign utilities** (`docusign-*`, `generate-docusign-keys`, `test-docusign-*`, `verify-docusign-setup`). DocuSign integration is being deprecated in favor of admin manual unlock.
- **Dev-debug one-offs** (`debug-jwt-*`, `check-customer`, `check-user-rhoulihan`, `test-admin-login`, `test-email`, etc.). Any coverage worth keeping lives in `tests/`.

If you find yourself wanting one of these back, check `docs/archive/migrations/` (if preserved) or the pre-2026-04-17 git history.

## Adding new scripts

- Put the script in the right subdirectory by purpose.
- `.env` loading: `require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });` (two levels up to project root).
- Model requires: `require('../../server/models/XYZ')`.
- Always include a `// Usage:` comment with the invocation command.
- Favor idempotence — a rerun should either succeed or fail loudly; never partially mutate data in a way that can't be retried.
