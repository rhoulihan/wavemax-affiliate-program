# Migration plan — `csurf` → modern CSRF protection

**Status:** PLAN (not yet executed)
**Owner:** TBD on next security sprint
**Closes audit finding:** SEC M-5

## Why migrate

`csurf` was deprecated in September 2022 and is no longer maintained. The package's own README warns against new use. Open issues and CVEs sit unfixed (most notably the cookie-mode token-fixation behaviour around `sameSite=none`, which we don't currently use but constrains future deployments).

The package still works, and we are not under active CSRF attack. Migration is a tech-debt cleanup, not an emergency. The reason it sits on the audit list is that staying on a dead dep increases the cost of every future CSRF-adjacent change (CSP, cookies, OAuth, mobile/native API).

## Current architecture (where the dependency lives)

`csurf` is wired in exactly two places:

1. **`server/config/csrf-config.js`** — wraps `csurf({ cookie: false })` in our `conditionalCsrf` middleware. The conditional logic (public allowlist, auth/registration exemptions, CRITICAL endpoint enforcement, HIGH-priority phased rollout) is all ours; `csurf` only provides token generation + validation.
2. **`server.js`** — mounts `conditionalCsrf` after the `express-session` middleware (line ~440).

Token plumbing on the client lives in `public/assets/js/csrf-utils.js`. Token transport is the standard double-submit pattern: `GET /api/csrf-token` → `x-csrf-token` header on mutations.

The `express-session` dependency exists almost entirely to back `csurf`'s session-bound secret. Authentication itself uses JWT bearer tokens (`server/middleware/auth.js`) — sessions carry only the CSRF secret and OAuth state.

## Replacement options

### Option 1 (recommended): `csrf-csrf`

[`csrf-csrf`](https://www.npmjs.com/package/csrf-csrf) (~25k weekly downloads, actively maintained, published by the openwallet-foundation org) is the closest drop-in. Same double-submit-cookie pattern, no session backing required, configurable cookie attributes, type-safe.

Migration shape:

```js
// server/config/csrf-config.js
const { doubleCsrfProtection, generateToken } = require('csrf-csrf')({
  getSecret: () => process.env.CSRF_SECRET,        // dedicated 64-char hex
  cookieName: '__Host-x-csrf',                     // host-only, no domain leak
  cookieOptions: {
    httpOnly: true,
    secure: true,                                  // requires HTTPS in prod
    sameSite: 'strict',                            // OK for embedded iframe
    path: '/'
  },
  size: 64,
  ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
  getTokenFromRequest: (req) =>
    req.headers['x-csrf-token'] ||
    req.headers['x-xsrf-token'] ||
    req.body?._csrf ||
    req.query?._csrf
});
```

The `conditionalCsrf` wrapper around `doubleCsrfProtection` keeps our allowlist logic intact.

### Option 2: write our own

A double-submit-cookie HMAC-bound implementation is roughly 80–120 lines (see `server/utils/oauthStateUtils.js` for a reference HMAC pattern). Pros: zero dependency footprint, exact behaviour we want. Cons: the maintenance burden lands on us.

Pick this only if `csrf-csrf` blocks us on a deal-breaker (e.g., cookie attributes we can't override).

### Option 3: `lusca`

Older, broader Express security middleware suite. Includes CSRF but also XSS/HSTS/CSP that we already get from helmet. Net add of features we already have. Skip.

## Compatibility considerations

- **Session removal.** Once `csurf` is gone, `express-session` is left only carrying `passport`/OAuth state during the social-login round-trip. Investigate whether that can move to a TTL'd `OAuthSession` Mongo doc (we already have the model) and drop `express-session` entirely. Material reduction in moving parts; defer to a follow-up sprint.
- **Cookie name.** Today's CSRF token rides in headers, no cookie. `csrf-csrf` writes a host-only cookie. Confirm the franchise host page CSP allows `__Host-` cookies (helmet defaults are fine; test on iframe-embed setup).
- **Client changes.** None expected — the `x-csrf-token` header transport stays the same. The `getTokenFromRequest` shim above accepts the same headers `csurf` was reading.
- **Test surface.** `tests/unit/csrfConfig.test.js` covers the conditional-enforcement matrix and is library-agnostic. `tests/helpers/csrfHelper.js` calls `GET /api/csrf-token` — also library-agnostic. No integration tests should need to change.
- **Behavioural delta.** `csrf-csrf` rejects requests where the cookie token and header token diverge. `csurf` rejects when the header doesn't match the session-bound secret. The user-visible failure mode (403 `EBADCSRFTOKEN`) is identical.

## Migration steps

1. **Add dependency.** `npm install csrf-csrf` (drops `csurf` and `@types/csurf` if present).
2. **Add `CSRF_SECRET` env var.** 64-char hex, generated with `openssl rand -hex 32`. Document in `.env.example`. Distinct from `JWT_SECRET` and `SESSION_SECRET` so it can rotate independently.
3. **Rewrite `server/config/csrf-config.js`** per Option 1 above. Keep `shouldEnforceCsrf` unchanged. Wrap `doubleCsrfProtection` with the same `conditionalCsrf` shape so the rest of the codebase doesn't notice.
4. **Update the `csrfTokenEndpoint` handler** to call `generateToken(req, res)` instead of `req.csrfToken()`.
5. **Run the test suite.** `tests/unit/csrfConfig.test.js` + every integration test under `tests/integration/`. Expect zero changes; if any test depends on `req.csrfToken()` directly, port it to use the helper from `tests/helpers/csrfHelper.js`.
6. **Smoke test in dev.** Manual round-trip: load a dashboard, trigger a CSRF-protected mutation (e.g. operator status change), verify it succeeds. Re-test after deploying to staging.
7. **Deploy.** No flag needed — a clean swap. Watch logs for any `EBADCSRFTOKEN` spikes for the first hour; rollback is a single revert + pm2 reload.
8. **Drop `express-session`** in a follow-up commit once we confirm OAuth/Passport state can move to the OAuthSession model. This is the cleanup that actually pays for itself; staying on session-store middleware costs us free-tier MongoDB writes on every request.

## Estimated effort

- Step 1–4: ~2 hours.
- Step 5: ~1 hour to triage any flaky tests.
- Step 6: ~30 min manual.
- Step 7: deploy + 1 hour observation.
- Step 8 (separate commit): ~3 hours including verifying no other code reads `req.session.*`.

Total: ~7 hours, single sprint.

## Out of scope (what this plan does NOT do)

- It does **not** change which endpoints enforce CSRF (the allowlist in `csrf-config.js` is library-agnostic and stays as-is).
- It does **not** address the H-1 bearer-only bypass (already closed in commit `649d09a`).
- It does **not** unify the CSRF token storage with the OAuth state token (different threat models — keeping them in separate code paths is correct).
- It does **not** introduce SameSite=None cross-site cookies for franchisee parent-page deployments. If a future franchise needs that, revisit.

## Why this is M-5 not H-N

The risk from staying on `csurf` is operational, not exploitable: no live CVE that affects our deployment, just a maintenance drag. Hence Medium priority, treat as a planned cleanup.
