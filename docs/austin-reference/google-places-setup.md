# Google Places API setup — Austin reference build

This is a one-time per-franchisee setup. The Austin reference build pulls
live 5-star Google reviews directly from the **Places API (New)** in the
visitor's browser. The browser-direct call requires the API key to be
visible in the page — which is fine **as long as the key is properly
restricted** to our domains and the Places API only.

---

## What you'll end up with

Two strings in the prod `.env` file at
`/var/www/wavemax/wavemax-affiliate-program/.env`:

```bash
GOOGLE_PLACES_API_KEY=AIzaSy…           # ~39-char string
GOOGLE_PLACES_LOCATION_PLACE_ID=ChIJ…   # ~27-char `ChIJ`-prefixed token
```

The server-rendered route at
[`/api/austin-tx/places-config`](../../public/dev/austin-host-mock.html)
reads both at request time and injects them into the browser. No build
step, no commits to source. Rotation = edit `.env` + `pm2 restart wavemax`.

---

## Step 1 — Google Cloud project

If WaveMAX Austin already has a Google Cloud project, use it. Otherwise:

1. Go to [console.cloud.google.com](https://console.cloud.google.com/).
2. Top bar → project picker → **New Project**.
   - Name: `wavemax-austin-prod` (or `wavemax-prod` if franchise-wide).
   - Org: leave at "No organization" if you don't have a Workspace org.
3. Click into the new project once it's created.

---

## Step 2 — Enable Places API (New)

1. Left nav → **APIs & Services → Library**.
2. Search for **"Places API (New)"** — there are two: the legacy
   "Places API" and "Places API (New)". **Pick the New one.** It's the
   only one our code targets (uses `places.googleapis.com/v1/...`).
3. Click **Enable**.

> **Pricing:** the New API has a free tier — first 10,000 Place Details
> requests per month are free, then ~$17 per 1,000. Our page caches in
> the browser for the session, so a single visitor = 1 call max. At
> 1,000 unique visitors per day → ~30K calls/month → ~$340/month
> *unmitigated*. Mitigate by adding short-TTL caching at our edge if
> traffic grows; for now we're under the free tier.

---

## Step 3 — Create the API key

1. Left nav → **APIs & Services → Credentials**.
2. Top bar → **+ Create credentials → API key**.
3. Copy the key that appears in the modal (`AIzaSy…`). Save it
   somewhere safe — you'll paste it into `.env` in Step 5.

---

## Step 4 — Restrict the key (CRITICAL)

This is the only thing standing between us and someone scraping
reviews on our dime. Don't skip.

1. Click the key in the Credentials list to open it.
2. **Application restrictions → HTTP referrers (websites)**. Add:
   - `https://wavemax.promo/*`
   - `https://*.wavemax.promo/*`
   - `https://wavemaxlaundry.com/*`
   - `https://*.wavemaxlaundry.com/*`
   - `http://localhost:*/*` (dev only — drop if you don't run e2e against the prod key)
   - `http://127.0.0.1:*/*` (dev only — same caveat)
3. **API restrictions → Restrict key → Places API (New)** only.
4. **Save**.

Restrictions take ~5 minutes to propagate.

---

## Step 5 — Find the Place ID

You need the `ChIJ…` token Google uses to reference WaveMAX Austin.
Two ways:

### Easy: Google Maps share link

1. Search Google Maps for "WaveMAX Laundry 825 E Rundberg Ln F1 Austin".
2. Click the result so it opens the location pane.
3. Click **Share → Copy link**.
4. The link looks like
   `https://www.google.com/maps/place/WaveMAX+Laundry/data=!4m...!3m...!1s0x...:0x...`.
   The Place ID is **NOT** the `0x...:0x...` part — that's a different
   ID format. Instead, paste the URL into the
   [Place ID Finder tool](https://developers.google.com/maps/documentation/javascript/examples/places-placeid-finder)
   and copy the `ChIJ…` value it returns.

### Programmatic: Find Place From Text

Once you have the API key from Step 3, you can run:

```bash
curl -X POST 'https://places.googleapis.com/v1/places:searchText' \
  -H 'Content-Type: application/json' \
  -H "X-Goog-Api-Key: $GOOGLE_PLACES_API_KEY" \
  -H 'X-Goog-FieldMask: places.id,places.displayName,places.formattedAddress' \
  -d '{ "textQuery": "WaveMAX Laundry 825 E Rundberg Ln F1 Austin TX" }'
```

The `places[0].id` field is the Place ID.

---

## Step 6 — Drop the values into prod `.env`

```bash
sudo ssh -i ~/.ssh/wavemax_promo_ed25519 root@158.62.198.7
cd /var/www/wavemax/wavemax-affiliate-program

# Append (or edit if present)
echo "GOOGLE_PLACES_API_KEY=AIzaSy……" >> .env
echo "GOOGLE_PLACES_LOCATION_PLACE_ID=ChIJ……" >> .env

pm2 restart wavemax --update-env
```

Verify:

```bash
curl -s https://wavemax.promo/api/austin-tx/places-config
```

Should now return JS with the values populated, not empty strings.

Visit `https://wavemax.promo/dev/austin-host-mock.html` and confirm the
"What our customers say" section renders 5-star reviews instead of the
"We're collecting reviews" empty state.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Empty-state "collecting reviews" still shows | Either `apiKey` or `placeId` is empty in the rendered JS | Re-check `.env`, make sure pm2 picked it up (`pm2 restart wavemax --update-env`) |
| Browser console: `places_api_403` | Referrer restriction not matching | Add the actual referrer (check Network tab Origin header) |
| Browser console: `places_api_429` | Quota hit | Bump quota in Cloud Console, or implement edge caching |
| Reviews show but average rating is wrong | API field mask is too narrow | Edit `austin-landing-init.js` to include `rating` + `userRatingCount` (already does) |
| Test runs fail with `places.googleapis.com` requests | Test isn't mocking the new endpoint shape | Check `tests/e2e/austin-reference/landing.spec.js` lines 133-150 for the mock pattern |

---

## Rotation

If the key is ever leaked or compromised:

1. In Cloud Console, find the key → **Regenerate**.
2. Old key invalidates immediately.
3. Update `.env` with the new key.
4. `pm2 restart wavemax --update-env`.
5. The 5-minute browser cache on `/api/austin-tx/places-config`
   means the very-recently-loaded pages will keep the old key for a few
   minutes; everything after that gets the new key automatically.

---

## Future: multi-location

When this pattern is rolled out to more franchisees, swap the single
`GOOGLE_PLACES_LOCATION_PLACE_ID` for a per-slug map:

```bash
GOOGLE_PLACES_LOCATION_PLACE_ID_AUSTIN_TX=ChIJ...
GOOGLE_PLACES_LOCATION_PLACE_ID_HOUSTON_TX=ChIJ...
```

And resolve in the route based on the URL path. The
`/api/austin-tx/places-config` route already accepts a
location parameter that defaults to `austin-tx`; it just doesn't read
it yet.

---

*© 2026 CRHS Enterprises, LLC. Internal documentation — not for redistribution.*
