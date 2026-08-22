# Phase 1 — Build `crhs-web-core` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a new, standalone `crhs-web-core` package repo containing the shared security/infrastructure core, built greenfield by copying modules out of the existing `wavemax-affiliate-program` monorepo (which is left untouched), each verified under strict TDD.

**Architecture:** An extraction, not a rewrite. For each module: port its existing unit test into the new repo (it fails — module absent), copy the module and rewrite its internal `require` paths to the package layout, run the test (green), commit. Code currently *inline* in `server.js` (the CSP directive builder, the Helmet/custom-header block, CORS) is modularized into new functions pinned by a golden-master test that asserts byte-identical header output vs. the live server.

**Tech Stack:** Node ≥16, CommonJS, Jest 29.7 (`--runInBand`), mongodb-memory-server, supertest, node-mocks-http, jsdom, helmet 7.1.0, cors 2.8.5, express-rate-limit 7.1.4, express-mongo-sanitize, express-session, connect-mongo, winston, mongoose 8, nodemailer.

**Spec:** [`docs/superpowers/specs/2026-08-22-service-corporate-split-program-design.md`](../specs/2026-08-22-service-corporate-split-program-design.md) (§3.C defines the module set; this is Phase 1).

## Global Constraints

- **Do not modify the existing monorepo.** All new work lands in a NEW repo at `/mnt/c/Users/rickh/GitHub/crhs-web-core`. Source files are **copied**, never moved. Acceptance includes `git -C /mnt/c/Users/rickh/GitHub/wavemax-affiliate-program status` showing no new changes to tracked app code.
- **Strict TDD:** red → green → refactor. Write/port the failing test first; confirm it fails for the right reason before copying the module.
- Package name `@crhs/web-core`; `"license": "UNLICENSED"`, `"private": true`; `© 2025–2026 CRHS Enterprises, LLC`.
- CommonJS (`require`/`module.exports`) to match the source modules.
- `logger` (winston) only — no `console.*` in `src/`.
- Tests run clean; each task ends green before the next begins.
- No behavior change: ported modules keep identical exports/signatures; the CSP/header output must be byte-identical to the current server (golden-master).
- Source paths below are relative to the monorepo `SRC=/mnt/c/Users/rickh/GitHub/wavemax-affiliate-program`; destination paths relative to `DST=/mnt/c/Users/rickh/GitHub/crhs-web-core`.

---

### Task 1: Repo scaffold + test harness

**Files:**
- Create: `crhs-web-core/package.json`, `crhs-web-core/jest.config.js`, `crhs-web-core/tests/setup.js`, `crhs-web-core/.gitignore`, `crhs-web-core/.eslintrc.js`, `crhs-web-core/README.md`, `crhs-web-core/LICENSE`, `crhs-web-core/src/index.js`
- Test: `crhs-web-core/tests/scaffold.test.js`

**Interfaces:**
- Produces: package `@crhs/web-core`; `require('@crhs/web-core')` resolves to `src/index.js` (an object, initially `{}`).

- [ ] **Step 1: Create the repo and directory structure**

```bash
mkdir -p /mnt/c/Users/rickh/GitHub/crhs-web-core/src /mnt/c/Users/rickh/GitHub/crhs-web-core/tests
cd /mnt/c/Users/rickh/GitHub/crhs-web-core && git init -q
```

- [ ] **Step 2: Write `package.json`**

```json
{
  "name": "@crhs/web-core",
  "version": "0.1.0",
  "description": "Shared security & infrastructure core for CRHS web apps",
  "main": "src/index.js",
  "scripts": {
    "test": "TZ=America/Chicago jest --runInBand",
    "test:watch": "TZ=America/Chicago jest --watch",
    "lint": "eslint src tests"
  },
  "author": "CRHS Enterprises, LLC",
  "license": "UNLICENSED",
  "private": true,
  "files": ["src", "assets"],
  "dependencies": {
    "cors": "2.8.5",
    "express-mongo-sanitize": "^2.2.0",
    "express-rate-limit": "7.1.4",
    "express-session": "^1.18.1",
    "connect-mongo": "^5.1.0",
    "helmet": "7.1.0",
    "ipaddr.js": "1.9.1",
    "mongoose": "^8.15.0",
    "nodemailer": "^8.0.7",
    "winston": "^3.10.0",
    "xss": "^1.0.15"
  },
  "devDependencies": {
    "eslint": "^8.54.0",
    "jest": "^29.7.0",
    "jsdom": "^26.1.0",
    "mongodb-memory-server": "^10.1.4",
    "node-mocks-http": "^1.17.2",
    "supertest": "^6.3.3",
    "express": "^4.21.2"
  },
  "engines": { "node": ">=16.0.0" }
}
```

- [ ] **Step 3: Write `jest.config.js`, `tests/setup.js`, `.gitignore`, `.eslintrc.js`, `LICENSE`, `README.md`**

`jest.config.js`:
```js
module.exports = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  clearMocks: true,
};
```
`tests/setup.js` (env the modules expect):
```js
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'a'.repeat(64);
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-session-secret';
process.env.NODE_ENV = 'test';
jest.setTimeout(30000);
```
`.gitignore`: `node_modules/\ncoverage/\n.env\n*.log`
`.eslintrc.js`: copy `SRC/.eslintrc.js` if present; else `module.exports = { env: { node: true, jest: true, es2021: true }, parserOptions: { ecmaVersion: 2021 }, rules: { 'no-console': 'error' } };`
`LICENSE`: copy `SRC/LICENSE` verbatim.
`README.md`: one paragraph — what the package is, `© 2025–2026 CRHS Enterprises, LLC`, that it is consumed by `wdf-affiliate-program` (service) and `crhs-corporate`.

- [ ] **Step 4: Write `src/index.js` stub**

```js
// @crhs/web-core — shared security & infrastructure core.
// Modules are attached here as they are extracted (see the Phase 1 plan).
module.exports = {};
```

- [ ] **Step 5: Write the failing scaffold test**

`tests/scaffold.test.js`:
```js
const core = require('../src/index');
test('package entry resolves to an object', () => {
  expect(typeof core).toBe('object');
});
```

- [ ] **Step 6: Install deps and run**

Run: `cd /mnt/c/Users/rickh/GitHub/crhs-web-core && npm install && npm test`
Expected: PASS (1 test).

- [ ] **Step 7: Commit**

```bash
cd /mnt/c/Users/rickh/GitHub/crhs-web-core
git add -A && git commit -m "chore: scaffold @crhs/web-core package + jest harness"
```

---

### Task 2: `encryption` module (representative pure-util pattern)

**Files:**
- Create: `crhs-web-core/src/utils/encryption.js`, `crhs-web-core/src/utils/logger.js`
- Test: `crhs-web-core/tests/utils/encryption.test.js`

**Interfaces:**
- Produces: `encryption.encrypt(text: string) -> { iv, encryptedData, authTag } | null`; `encryption.decrypt({iv,encryptedData,authTag}) -> string | null`. Reads `process.env.ENCRYPTION_KEY` (64-hex). Depends on `./logger`.

- [ ] **Step 1: Port the failing test**

Copy `SRC/tests/unit/encryption.test.js` → `DST/tests/utils/encryption.test.js`. Rewrite the module import at the top to `require('../../src/utils/encryption')`. Do not change assertions.

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- tests/utils/encryption.test.js`
Expected: FAIL — `Cannot find module '../../src/utils/encryption'`.

- [ ] **Step 3: Copy `logger` then `encryption`**

Copy `SRC/server/utils/logger.js` → `DST/src/utils/logger.js` (winston; verify it has no `require` into app-specific paths — if it references a log dir via env, keep as-is). Copy `SRC/server/utils/encryption.js` → `DST/src/utils/encryption.js`; its only internal require is `./logger`, which now resolves. Change the header comment "WaveMAX Laundry Affiliate Program" → "CRHS web-core".

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- tests/utils/encryption.test.js`
Expected: PASS.

- [ ] **Step 5: Wire into the package index**

In `src/index.js`: `module.exports = { encryption: require('./utils/encryption') };`

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: extract encryption + logger into web-core"
```

---

### Task 3: Pure-util cluster (clientIp, storeIPs, controllerHelpers, validateSecrets, auditLogger, previewUnlockCookie)

Apply the Task-2 pattern to each module below **one at a time** (port test → fail → copy module + rewrite requires → pass → attach to `src/index.js` → commit). All are leaf or near-leaf utils; the only cross-requires are to `./logger` and, for `auditLogger`, `./logger` (verify no Mongoose model imports — if `auditLogger` writes to a model, keep the write path but the test mocks it as the source test does).

**Files (source → dest), each with its ported test:**
- `SRC/server/utils/clientIp.js` → `DST/src/utils/clientIp.js` · test `SRC/tests/unit/clientIp.test.js`
- `SRC/server/config/storeIPs.js` → `DST/src/config/storeIPs.js` · test `SRC/tests/unit/storeIPs.test.js`
- `SRC/server/utils/controllerHelpers.js` → `DST/src/utils/controllerHelpers.js` · test `SRC/tests/unit/controllerHelpers.test.js`
- `SRC/server/utils/validateSecrets.js` → `DST/src/utils/validateSecrets.js` · test `SRC/tests/unit/validateSecrets.test.js`
- `SRC/server/utils/auditLogger.js` → `DST/src/utils/auditLogger.js` · test `SRC/tests/unit/auditLogger.test.js`
- `SRC/server/utils/previewUnlockCookie.js` → `DST/src/utils/previewUnlockCookie.js` · test `SRC/tests/unit/previewUnlockCookie.test.js`

**Interfaces:**
- Produces on `src/index.js`: `clientIp`, `storeIPs`, `controllerHelpers`, `validateSecrets`, `auditLogger`, `previewUnlockCookie` (exports unchanged from source).

- [ ] **Step 1–N (per module):** For each row: (a) copy its test to `DST/tests/<area>/<name>.test.js`, fix the import path, run → **FAIL**; (b) copy the module to its dest, rewrite internal `require('./x')`/`require('../utils/x')` to the web-core layout, fix the header comment, run → **PASS**; (c) add to `src/index.js`; (d) `git commit -m "feat: extract <name> into web-core"`.

- [ ] **Final step: run the whole suite**

Run: `npm test`
Expected: all green (encryption + the six utils).

---

### Task 4: CSP nonce + `cspHelper`

**Files:**
- Create: `crhs-web-core/src/middleware/cspNonce.js`, `crhs-web-core/src/utils/cspHelper.js`
- Test: `crhs-web-core/tests/utils/cspHelper.test.js`

**Interfaces:**
- Produces: `cspNonce` (Express middleware setting `res.locals.cspNonce`/`req.cspNonce`); `cspHelper.injectNonce(html, nonce)`, `cspHelper.readHTMLWithNonce(path, nonce)`, `cspHelper.serveHTMLWithNonce(relPath)`.

- [ ] **Step 1: Port `cspHelper` test** — copy `SRC/tests/unit/cspHelper.test.js` → `DST/tests/utils/cspHelper.test.js`, fix import. Run → FAIL.
- [ ] **Step 2: Copy modules** — `SRC/server/middleware/cspNonce.js` → `DST/src/middleware/cspNonce.js`; `SRC/server/utils/cspHelper.js` → `DST/src/utils/cspHelper.js` (require of `./logger` → `../utils/logger`). Note: `serveHTMLWithNonce` hardcodes `path.join(__dirname, '../../public', htmlPath)` — change to accept a base dir: `serveHTMLWithNonce(relPath, baseDir)`. Update the ported test to pass a `baseDir` (tmp fixture) accordingly.
- [ ] **Step 3: Run → PASS.**
- [ ] **Step 4: Attach to `src/index.js` (`cspNonce`, `cspHelper`). Commit** `feat: extract cspNonce + cspHelper into web-core`.

---

### Task 5: Modularize the CSP builder + security-header block (GOLDEN-MASTER — linchpin)

The CSP directive object, the Helmet config, and the custom security-header block are currently **inline** in `SRC/server.js` (~L207-466) with the `strictCSPPages` list and the `isFranchiseHostPage`/`isDocumentationPage`/`isClickjackingDemo` logic. Extract them into pure functions and pin the output byte-for-byte.

**Files:**
- Read: `SRC/server.js:207-466`, `SRC/tests/integration/securityHeaders.test.js`, `SRC/tests/integration/crhsentCsp.test.js`
- Create: `crhs-web-core/src/security/cspDirectives.js`, `crhs-web-core/src/security/securityHeaders.js`, `crhs-web-core/src/security/corsConfig.js`
- Test: `crhs-web-core/tests/security/cspGolden.test.js`

**Interfaces:**
- Produces: `buildCspDirectives({ path, nonce, useStrictCSP, isClickjackingDemo }) -> directivesObject`; `securityHeadersMiddleware(options)` (Helmet + custom headers); `corsConfig -> corsOptions`. `useStrictCSP` is computed by an exported helper `isStrictCspPath(path, { strictCSPPages, isDocumentationPage, isFranchiseHostPage })`.

- [ ] **Step 1: Write the golden-master test FIRST**

`tests/security/cspGolden.test.js` — mount a minimal express app using the new `securityHeadersMiddleware` + a route that emits CSP via `buildCspDirectives`, and assert the header values equal the exact strings the current server emits. Seed the expected strings by copying the concrete assertions out of `SRC/tests/integration/securityHeaders.test.js` and `crhsentCsp.test.js` (e.g. `expect(res.headers['content-security-policy']).toContain("default-src 'self'")`, the `script-src` nonce/allowlist, `frame-ancestors`, HSTS `max-age=31536000; includeSubDomains; preload`, `Referrer-Policy`, the `/assets` + `/locales` CRP overrides). Include one case per branch: a strict-CSP embed path, a franchise-host path, and the clickjacking-demo exception.

Run → FAIL (modules absent).

- [ ] **Step 2: Extract `cspDirectives.js`** — lift the directive object builder from `server.js` verbatim into `buildCspDirectives(...)`, parameterizing `nonce`, `path`, `useStrictCSP`, `isClickjackingDemo`; move `strictCSPPages` into the module as an exported constant and `isStrictCspPath(...)`. No value changes.
- [ ] **Step 3: Extract `securityHeaders.js` + `corsConfig.js`** — lift the Helmet config + custom-header block (~L207-285) into `securityHeadersMiddleware`; lift the CORS options (~L471-522) into `corsConfig`.
- [ ] **Step 4: Run the golden-master → PASS.** If any header differs, fix the extraction (not the test) until byte-identical.
- [ ] **Step 5: Attach to `src/index.js` (`buildCspDirectives`, `isStrictCspPath`, `securityHeadersMiddleware`, `corsConfig`). Commit** `feat: modularize CSP directives + security headers + CORS (golden-master pinned)`.

---

### Task 6: Request hygiene (sanitization, errorHandler, rateLimiting + rateLimitMongoStore, ipGate factory)

Apply the port-test-then-copy pattern per module.

**Files (source → dest, ported test):**
- `SRC/server/middleware/sanitization.js` → `DST/src/middleware/sanitization.js` · `SRC/tests/unit/sanitization.test.js`
- `SRC/server/middleware/errorHandler.js` → `DST/src/middleware/errorHandler.js` · `SRC/tests/unit/errorHandler.test.js`
- `SRC/server/middleware/rateLimitMongoStore.js` → `DST/src/middleware/rateLimitMongoStore.js` · `SRC/tests/unit/rateLimitMongoStore.test.js`
- `SRC/server/middleware/rateLimiting.js` → `DST/src/middleware/rateLimiting.js` · assertions from `SRC/tests/unit/rateLimitKeyGen.test.js`
- `SRC/server/middleware/ipGate.js` → `DST/src/middleware/ipGate.js` · `SRC/tests/unit/adminIpGate.test.js` (adapt: the factory is what moves; `adminIpGate`/`operatorIpGate` stay in the service repo and will consume `ipGate` from web-core)

**Interfaces:**
- Produces: `sanitization` (`mongoSanitize`, `sanitizeRequest`), `errorHandler`, `rateLimiting` (limiter factories), `rateLimitMongoStore`, `ipGate` (factory `ipGate({ allowlistEnv, ... }) -> middleware`).

- [ ] **Steps (per module):** port test → FAIL → copy + rewrite requires (rateLimiting/rateLimitMongoStore require `./logger`/`clientIp`/`SystemConfig`; wire `SystemConfig` after Task 7 or inject it — if `rateLimiting` imports `SystemConfig`, defer its `src/index.js` wiring until Task 7 and mark the test `.skip` with a comment, un-skip in Task 7) → PASS → attach → commit.
- [ ] **Final:** `npm test` all green (skips noted).

---

### Task 7: Data/infra (SystemConfig model, mongoCursorRetry, mongoOracleDiagnostics)

**Files (source → dest, ported test):**
- `SRC/server/models/SystemConfig.js` → `DST/src/models/SystemConfig.js` · `SRC/tests/unit/systemConfig.test.js`
- `SRC/server/utils/mongoCursorRetry.js` → `DST/src/utils/mongoCursorRetry.js` · `SRC/tests/unit/mongoCursorRetry.test.js`
- `SRC/server/utils/mongoOracleDiagnostics.js` → `DST/src/utils/mongoOracleDiagnostics.js` · `SRC/tests/unit/mongoOracleDiagnostics.test.js`

**Interfaces:**
- Produces: `SystemConfig` (mongoose model, `getValue`, `setValue`, `initializeDefaults`, `getByCategory`), `mongoCursorRetry`, `mongoOracleDiagnostics`.

- [ ] **Step 1: Extend `tests/setup.js`** to start mongodb-memory-server for model tests:
```js
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
let mongod;
beforeAll(async () => { mongod = await MongoMemoryServer.create(); await mongoose.connect(mongod.getUri()); });
afterAll(async () => { await mongoose.disconnect(); if (mongod) await mongod.stop(); });
afterEach(async () => { const c = mongoose.connection.collections; for (const k in c) await c[k].deleteMany({}); });
```
(Guard so pure-util tests that don't touch mongoose still run — this setup is cheap; keep it global.)
- [ ] **Steps (per module):** port test → FAIL → copy + rewrite requires → PASS → attach → commit.
- [ ] **Step: un-skip** the `rateLimiting` test from Task 6 now that `SystemConfig` resolves; wire `rateLimiting` into `src/index.js`. Run → PASS. Commit.

---

### Task 8: Email framework

**Files (source → dest, ported test):**
- `SRC/server/services/email/transport.js` → `DST/src/email/transport.js`
- `SRC/server/services/email/template-manager.js` → `DST/src/email/template-manager.js`
- `SRC/server/utils/emailService.js` → `DST/src/email/emailService.js` (the shim/dispatcher entry) · `SRC/tests/unit/emailService.test.js`

**Interfaces:**
- Produces: `email` = `{ transport, templateManager, emailService }`. `emailService` sends via nodemailer (mocked in tests).

- [ ] **Steps:** port `emailService.test.js` (mock `nodemailer` as the source test does) → FAIL → copy the three files, rewrite requires (`./logger`, template dir path → parameterize base dir like cspHelper) → PASS → attach `email` to index → commit. NOTE: the per-domain operational dispatchers (`email/dispatcher/*`) stay in the **service** repo; only transport + template-manager + the send shim are shared.

---

### Task 9: Session/CSRF config + geocodingService

**Files (source → dest, ported test):**
- `SRC/server/config/csrf-config.js` → `DST/src/config/csrf-config.js` · assertions from any existing csrf test (else write a unit test asserting `conditionalCsrf` is a function and `csrfTokenEndpoint` returns a token)
- session/`connect-mongo` store setup (inline in `SRC/server.js` ~L622-703) → `DST/src/config/sessionStore.js` as `buildSessionMiddleware({ mongoUrl, secret, ttlSeconds })`
- `SRC/server/services/geocodingService.js` → `DST/src/services/geocodingService.js` · `SRC/tests/unit/geocodingService.test.js`

**Interfaces:**
- Produces: `csrf` (`conditionalCsrf`, `csrfTokenEndpoint`), `buildSessionMiddleware(opts)`, `geocodingService`.

- [ ] **Steps:** per module, test-first → copy/extract → green → attach → commit. For `sessionStore`, write a unit test that calls `buildSessionMiddleware` with a memory-server URI and asserts it returns an Express middleware function (and that TTL default matches the current 10-minute value from the memory note — verify against `server.js`).

---

### Task 10: Client shared static assets

**Files:**
- Create dir `crhs-web-core/assets/js/` and copy: `SRC/public/assets/js/i18n.js`, `language-switcher.js`, `iframe-bridge-v2.js`, `parent-iframe-bridge-v3.js`, `css-async.js` → `DST/assets/js/`
- Copy legal pages `SRC/public/terms-and-conditions.html`, `privacy-policy.html`, `refund-policy.html` → `DST/assets/legal/`
- Copy shared fonts/vendor referenced by both (enumerate from `SRC/public/assets/fonts/`, `vendor/`) → `DST/assets/`
- Test: `crhs-web-core/tests/assets/i18n.test.js`

**Interfaces:**
- Produces: static assets served by both apps from the package (path exported as `require('@crhs/web-core').assetsDir`). Add `assetsDir: path.join(__dirname, '../assets')` to `src/index.js`.

- [ ] **Step 1: Write a jsdom test** for `i18n.js` interpolation: load the file into jsdom, initialize with a stub locale `{ greeting: 'Hi {{brandName}}' }`, set `brandName`, assert `translate('greeting')` → `Hi <value>`. (This also proves the Phase-3 `{{brandName}}` token mechanism works in the shared loader.) Run → FAIL if asset absent.
- [ ] **Step 2: Copy the assets.** Run → PASS.
- [ ] **Step 3: Add `assetsDir` to index. Commit** `feat: bundle shared client assets + legal pages in web-core`.

---

### Task 11: Package index smoke test + publish

**Files:**
- Test: `crhs-web-core/tests/index.smoke.test.js`
- Modify: `crhs-web-core/src/index.js` (final export surface), `crhs-web-core/package.json` (version bump)

**Interfaces:**
- Produces: the complete `@crhs/web-core` export surface consumed by Phase 2.

- [ ] **Step 1: Write the smoke test** asserting every expected key is present and of the right type:
```js
const core = require('../src/index');
const expected = ['encryption','logger','clientIp','storeIPs','controllerHelpers','validateSecrets',
  'auditLogger','previewUnlockCookie','cspNonce','cspHelper','buildCspDirectives','isStrictCspPath',
  'securityHeadersMiddleware','corsConfig','sanitization','errorHandler','rateLimiting',
  'rateLimitMongoStore','ipGate','SystemConfig','mongoCursorRetry','mongoOracleDiagnostics','email',
  'csrf','buildSessionMiddleware','geocodingService','assetsDir'];
test.each(expected)('exports %s', (k) => { expect(core[k]).toBeDefined(); });
```
- [ ] **Step 2: Run the FULL suite** `npm test` → all green.
- [ ] **Step 3: Verify the monorepo is untouched** — `git -C /mnt/c/Users/rickh/GitHub/wavemax-affiliate-program status --porcelain` shows no changes to `server/`, `public/`, or `server.js`.
- [ ] **Step 4: Tag + prepare publish.** Bump version to `0.1.0` (already), `git tag v0.1.0`. **USER ACTION REQUIRED:** create the GitHub repo `rhoulihan/crhs-web-core` (gh token is currently invalid, so Claude cannot create it); then `git remote add origin https://github.com/rhoulihan/crhs-web-core.git && git push -u origin main --tags`. Phase 2 consumes it via a git dependency (`"@crhs/web-core": "github:rhoulihan/crhs-web-core#v0.1.0"`) or a local `file:` path during dev.
- [ ] **Step 5: Commit** `chore: v0.1.0 — complete web-core export surface + smoke test`.

---

## Self-Review

**Spec coverage (§3.C):** every listed module maps to a task — encryption/logger (T2), clientIp/storeIPs/controllerHelpers/validateSecrets/auditLogger/previewUnlockCookie (T3), cspNonce/cspHelper (T4), CSP builder + headers + CORS (T5), sanitization/errorHandler/rateLimiting/rateLimitMongoStore/ipGate (T6), SystemConfig/mongoCursorRetry/mongoOracleDiagnostics (T7), email transport/template-manager/emailService (T8), csrf/session/geocoding (T9), i18n/bridges/css-async/legal (T10), index+publish (T11). **Gate coverage:** the shared `ipGate` factory (T6) is the foundation every IP gate builds on (`adminIpGate`, `operatorIpGate`, and corporate `mediatorGate`'s admin check all instantiate from it). All other content gates migrate in **Phase 2** per the spec's **Gate Migration Matrix (§3.E)** — each verified by an allow/deny integration test in its destination repo. `mediatorGate`/`accessGate`/`franchisePreview`/`explorerGuard`/`partnerLanding` → corporate; `adminIpGate`/`operatorIpGate`/`scanAuth`/`expediterGuard` → service. Correctly excluded from web-core. The per-domain email *dispatchers* stay in the service repo (noted in T8).

**Placeholder scan:** no TBD/TODO; per-module "copy the source file" is concrete (exact source + dest paths given) because this is an extraction — the code exists in `SRC`; the executor copies it rather than re-authoring. Golden-master and jsdom tests have real assertions.

**Type consistency:** export names in the T11 smoke test match those attached to `src/index.js` across T2–T10 (`encryption`, `cspHelper`, `buildCspDirectives`, `securityHeadersMiddleware`, `SystemConfig`, `email`, `assetsDir`, …). `serveHTMLWithNonce` and `emailService`/`sessionStore` base-dir parameterization is called out where the source hardcodes paths.

**Risks flagged inline:** `rateLimiting`→`SystemConfig` ordering (T6 skip → T7 un-skip); hardcoded `public`/template dirs parameterized (T4/T8); GitHub repo creation needs the user (T11).
