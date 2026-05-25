# Franchise self-serve content preview on crhsent.com — implementation plan

**Goal:** Let a franchise owner preview a localized version of "their" site on `crhsent.com/<location>`, gated behind an emailed key + password, after attesting they're an authorized representative and authorizing CRHS Enterprises, LLC to temporarily host marketing content for that location.

**Decisions locked (2026-05-25):**
- **Authorization = attestation + emailed unlock** (automated, no human gatekeeper). We can't verify the email against the GBP (Google doesn't expose owner emails), so the authorized-rep checkbox + disclaimer is the legal authorization; we still resolve the GBP link to a real listing and show it back for confirmation, and the franchisee must control the email we send to.
- **Preview content = light auto-localization** — the proven franchise-default template auto-filled with what GBP exposes (name, address, hours, map, live reviews); sensible placeholders for the rest (pricing, equipment, owner bios). Full customization happens on the onboarding call.

---

## Reuse from the existing access-gate (the template)
- `server/middleware/accessGate.js` — fork the patterns: 32-byte `crypto.randomBytes` token, **GET-confirm-page → POST-confirm** (defeats email-scanner prefetch), cluster-safe in-memory cache + DB fallback, fail-closed, per-IP throttle, CSP-nonce page rendering, `clientIp(req)` (Cloudflare-aware).
- `server.js:443-469` — the **crhsent.com host handler** (serves `/crhsent/<dir>/` with CSP nonce, mounted before gate/quarantine, exempt from gating). New preview endpoints + the gating shim mount here, mirroring how `accessGate` self-handles `/__gate/*`.
- `server/services/email/transport.js` `sendEmail()` + `template-manager.js` — the unlock email.
- `server/services/googleReviewsService.js` + `server/controllers/locationController.js` — Places fetch by `placeId` (reviews/rating; extend the field mask for name/address/hours/phone).
- `server/services/franchiseRegistryService.js` + `controllers/franchiseController.js` + `public/franchise-host.html` + `/franchise-default/*` — the localization rendering pipeline (`LOCATION_DATA` injection + iframe content). Reuse to render the preview.
- `server/utils/encryption.js` — `hashPassword` / `verifyPassword` (PBKDF2) for the per-request password.

## Hard constraint (already designed around)
Google Places / GBP exposes name, address, phone, website, hours, reviews — **never an owner email**. So "email matches the GBP" is impossible; the model is attestation + email-control + showing the resolved listing back.

---

## Data model

### `FranchisePreviewRequest` (the reusable grant)
| field | purpose |
|---|---|
| `token` (unique, 32-byte hex) | the URL **key**; gates the route (404 without it); **reusable** |
| `locationSlug` | preview path segment, derived from GBP (city/name), uniqueness-checked |
| `placeId` | resolved Google place id |
| `businessName`, `formattedAddress` | from Places — confirmation + localization |
| `email` | where the key + password were sent |
| `passwordSalt`, `passwordHash` | per-request password (PBKDF2), reused on each unlock |
| `gbpData` (Mixed) | cached GBP-derived data for light localization (name/address/hours/phone/reviews snapshot) |
| `attestation` { acceptedAt, ip, version } | legal audit of the checkbox + disclaimer acceptance |
| `createdAt`, `lastUnlockedAt`, `revokedAt?` | audit + revocation |

Indexes: unique `token`; `locationSlug`+`email`. No TTL index (ADB rejects them — prune via a small job or leave; grants are low-volume).

### 1-hour unlock = **signed cookie, no DB**
After a correct password, set an HMAC/JWT-signed cookie `{ loc: slug, exp: now+1h }` scoped to `crhsent.com`, path `/<location>`. Checked on each request; expires in 1h. Stateless — deliberately avoids the session/TTL bloat we just fixed. The **key link stays valid**, so after the hour they reopen it, re-enter the password, get a fresh hour.

---

## Endpoints (all under the crhsent.com host handler, like `/__gate/*`)
1. **POST `crhsent.com/__preview/request`** — modal submit (GBP link + email + attestation). Resolves GBP → confirms real listing → creates `FranchisePreviewRequest` (token + hashed password) → emails the key link + password → returns "check your email." Per-IP + per-email throttle (reuse access-gate's 60s pattern); lightweight bot check.
2. **GET `crhsent.com/<location>`** — **404 unless** `?key=<token>` matches a valid grant **or** a valid unlock cookie is present. With a valid key (no cookie) → render the **password form** (carrying the same disclaimer + "you own the right to market your content; you're confirming you're authorized" reminder). With a valid unlock cookie → render the localized preview.
3. **POST `crhsent.com/<location>/__unlock`** — password submit. Correct → set the 1-hour signed cookie → redirect to `crhsent.com/<location>`. Wrong → re-render the form with an error (throttled).

## GBP link → placeId resolution (the fiddly bit)
GBP links vary (`maps.app.goo.gl`, `g.co/kgs`, full `/maps/place/…`, `?cid=`). Approach: follow redirects to the expanded maps URL → extract name/coords/`cid`/`ftid` → Places **Find Place from Text** (name + location bias) or **Place Details** → canonical `placeId` + details. **Fallback:** if auto-resolve is ambiguous/fails, ask the franchisee to confirm business name + city, then Find Place. Always show the resolved business back ("We found … — is this you?") before sending.

## Light auto-localization
Map `gbpData` → `LOCATION_DATA` (name, address, hours, phone, neighborhood from address, live reviews, map embed from placeId) + defaults/placeholders for pricing, equipment, owners, about copy, SEO. Render `public/franchise-host.html` (or a crhsent-scoped variant) with that `LOCATION_DATA`, on the `crhsent.com/<location>` path. crhsent.com is `noindex`, so no preview leaks to search.

---

## Build phases
- **Phase 1 — request + email.** `FranchisePreviewRequest` model; GBP resolver (+ Places details, extended field mask); `POST /__preview/request` (resolve → attest → create → email key+password); unlock-email template; the **"See it for yourself"** modal on `crhsent.com/wavemax` (GBP link + email + attestation checkbox + disclaimer + reminder), replacing the book-a-call email CTA. Throttle + bot check.
- **Phase 2 — gated route + 1-hour unlock.** crhsent `<location>` gating shim (404 without key; key → password form with disclaimer; `POST __unlock` → verify → signed 1h cookie; serve when unlocked). Reusable-link + re-unlock behavior.
- **Phase 3 — light auto-localization.** `gbpData → LOCATION_DATA` mapping; render the franchise-host template with it on the preview path.
- **Phase 4 — hardening.** Abuse prevention (throttle/CAPTCHA on the public request form so we're not a spam relay), attestation audit, grant revocation, legal-review the disclaimer copy, tests at each seam (TDD), Lighthouse on the new pages, deploy.

## Open sub-decisions (defaults chosen; easy to change)
- Grant lifetime: long-lived + revocable (vs N-day TTL). **Default: long-lived, revocable.**
- Request-form abuse prevention: per-IP + per-email throttle (reuse access-gate). **CAPTCHA optional** — recommend adding one since the form triggers an email to a user-supplied address.
- Disclaimer copy: needs your/legal sign-off before launch (placeholder drafted in Phase 1).
