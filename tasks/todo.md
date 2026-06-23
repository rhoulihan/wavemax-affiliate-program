# Active todo — Partner-opt-in customer geolocation radius gate (bag registration)

Feature: partners opt into customer geolocation; specify a radius (miles) from the partner address;
bag-registration (customer claim) is allowed only if the customer's supplied address is within radius.

## Locked decisions (Rick, 2026-06-22)
- **Provider:** Google **Address Validation API** (validate + geocode in one server call). Haversine for distance (radius = circle). NOT Distance Matrix.
- **Opt-in control:** **Admin-managed** per affiliate (affiliate-edit modal, where deliveryFee/serviceType live). Not partner self-service.
- **Failure mode:** **Fail-open** — if geocoding errors/times out/no result, ALLOW the registration + log/audit (an API outage never blocks signups).
- **Autocomplete:** **Deferred** (radius gate first; Places Autocomplete is a later polish PR).

## Research findings (key)
- Claim form ALREADY collects customer address (address/city/state/zip, required) → no new capture fields.
- Gate seam: `server/services/customerRegistrationService.js` `registerCustomer()`, right after the affiliate is resolved from the bag (~line 69), before customer build/save + bag claim. Throw `RegistrationError('outside_service_area', 422)`; controller `claimRegister` already maps it to JSON.
- Reusable: Haversine `calculateDistance` (miles, R=3959) in `server/services/addressValidationService.js`. The old Nominatim radius gate was client-side only (bypassable) — this MUST be server-side.
- `Affiliate.serviceLocation`/`serviceRadius` were removed in redesign (f3c8422); we add fresh fields.
- AV response paths: `result.geocode.location.latitude/longitude`, `result.geocode.placeId`, `result.address.formattedAddress`, `result.verdict.{addressComplete,validationGranularity,hasUnconfirmedComponents}`.
- ToS: cache lat/lng ≤30 days; placeId storable indefinitely; no map-display/attribution for backend-only use. Need a SEPARATE server-side, IP-restricted key (oci1/oci2) — do NOT reuse the referrer-restricted GOOGLE_PLACES_API_KEY.

## PREREQUISITE (Rick / ops) — Google Cloud server key
- In the existing GCP project: enable **Address Validation API**; create a NEW API key, **IP-restricted** to oci1 `161.153.71.201` + oci2 `144.24.4.202`, **API-restricted** to Address Validation API.
- Add `GOOGLE_GEOCODING_API_KEY=…` to `.env` on both boxes (and `.env.example` — needs Rick's confirm). Code reads it server-side only; no CSP change.
- Not needed for dev/tests (mocked). Required before live use / deploy.

## PR 1 — Affiliate geo fields + geocoding service + admin opt-in UI
- [ ] `server/models/Affiliate.js`: add `geoValidationEnabled` (bool, default false), `geoRadiusMiles` (Number, min 1, max 50), `geoLat`, `geoLng`, `geoPlaceId` (String), `geocodedAt` (Date). Tests.
- [ ] `server/services/geocodingService.js`: `geocodeAddress({address,city,state,zipCode})` → Google AV (`v1:validateAddress`), returns `{ ok, lat, lng, placeId, formatted, granularity }` or `{ ok:false, reason }`. Defensive parsing; timeout; never throws (fail-open caller). Reuse/keep Haversine. Unit test with mocked fetch (no live calls).
- [ ] Partner geocode-on-save: when admin enables geo + saves with an address (new/changed), geocode the partner → store geoLat/geoLng/geoPlaceId/geocodedAt; warn if it won't geocode. (`manualAffiliateController.updateAffiliateSettings`.)
- [ ] Admin UI: opt-in toggle (`affEditGeoValidation`) + radius input (`affEditGeoRadius`) in `#affiliateSettingsModal`; load+save in `administrator-dashboard-init.js`; validation in `administratorRoutes.js` PATCH; whitelist + return in `manualAffiliateController` (`updateAffiliateSettings` + `getAffiliateForEdit`). i18n labels en/es/pt/de. SPA cache-bust if admin JS changes.
- [ ] Tests: affiliate model fields; `affiliateSettings.test.js` (toggle+radius persist + validation); geocodingService unit.

## PR 2 — Server-side radius gate at registration
- [ ] `customerRegistrationService.registerCustomer()`: if `affiliate.geoValidationEnabled` → ensure partner geocode fresh (re-geocode if missing/stale >30d) → geocode customer address → Haversine vs partner geo → if > `geoRadiusMiles`, throw `RegistrationError('outside_service_area', 422)`. **Fail-open** on any geocoding error (allow + audit log).
- [ ] Customer-facing rejection message in claim.js / claim-embed (i18n en/es/pt/de).
- [ ] Tests: inside allows / outside blocks (422) / disabled bypasses / geocode-failure fail-open (mock geocodingService). Extend `tests/integration/customerClaim.test.js`.

## PR 3 — (deferred) Places Autocomplete on the claim form (typo reduction). Browser key + CSP entry.

## Process
- Strict TDD (red→green). i18n parity 0 errors. Full jest gate green per PR. Commit + deploy per PR (git pull both boxes; pm2 reload — server code changes). Lighthouse re-check /claim if the form changes (it shouldn't, only an error path).
