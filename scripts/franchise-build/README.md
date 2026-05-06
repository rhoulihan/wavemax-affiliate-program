# Franchise Build Toolchain

The site at `wavemax.promo` runs **fully independent** of `wavemaxlaundry.com` at runtime — every image, asset, and link resolves to the local origin or to a non-corporate third party (Google Maps, OpenStreetMap, etc.).

The single remaining dependency on the corporate site is **build-time only**: the per-franchise LOCATION_DATA (addresses, hours, owner emails, hero/interior photos, place IDs, street-view tiles) is currently sourced by scraping `wavemaxlaundry.com` because that is the only place it is currently published. The scripts in this directory are the dependency boundary.

When an authoritative source for LOCATION_DATA is wired up (an internal API, a franchisee portal, an S3 sync, etc.), **only the scripts in this directory change**. The runtime site, the JSON files in `public/data/franchises/*.json`, and the mirror in `public/assets/images/locations/` keep working unchanged.

## Refresh workflow

```bash
# 1. Pull location metadata from the corporate site
node scripts/franchise-build/fetch-corporate-data.js
node scripts/franchise-build/fetch-emails.js
node scripts/franchise-build/fetch-place-ids.js
node scripts/franchise-build/fetch-street-view.js
node scripts/franchise-build/fetch-landmarks.js
node scripts/franchise-build/probe-images.js

# 2. Mirror the per-franchise photos to the local origin
node scripts/franchise-build/mirror-location-images.js

# 3. Rebuild the registry into public/data/franchises*.json
node scripts/franchise-build/build-registry.js

# 4. Commit the regenerated JSON + new image files
git add public/data/franchises public/assets/images/locations
git commit -m "chore(data): refresh LOCATION_DATA from upstream"
```

## Files in this directory

| File | Purpose |
|---|---|
| `fetch-corporate-data.js` | Scrape per-franchise structured data (LD-JSON, page text) |
| `fetch-emails.js` | Decode obfuscated owner emails from JSON-LD |
| `fetch-place-ids.js` | Resolve Google Maps Place IDs for each location |
| `fetch-street-view.js` | Pull street-view thumbnails |
| `fetch-landmarks.js` | Cache nearby landmark POIs |
| `probe-images.js` | Detect which heroes / interiors exist per location |
| `mirror-location-images.js` | Download every per-franchise photo URL referenced in `public/data/franchises/*.json` to `public/assets/images/locations/` |
| `build-registry.js` | Assemble final `public/data/franchises*.json` |
| `build-franchise-host.js` | (legacy?) build-time variant of the franchise host |
| `known-overrides.json` | Per-slug fields authored manually that override scraper output |
| `equipment-profiles.json` | Equipment data not present on the corporate site |
| `locations.raw.json` / `locations.with-images.json` | Intermediate scraper output |

## Migration to authoritative source

When LOCATION_DATA migrates off of `wavemaxlaundry.com`:

1. Replace the `fetch-*.js` scripts with one that reads from the new source. Output schema must match what `build-registry.js` expects.
2. Repoint `mirror-location-images.js`'s URL pattern at the new image host (one regex change).
3. Re-run the refresh workflow above.
4. Once verified, delete this README's references to `wavemaxlaundry.com` — the migration is complete.

The runtime site has no other awareness of where this data came from.
