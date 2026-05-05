#!/usr/bin/env node
/**
 * Backfill hero images for franchises whose corporate-CDN image probe
 * came back empty (11 franchises in the current registry: boulder-co,
 * indianapolis-in, jacksonvillefl, peoria-az, sacramento-ca, etc.).
 *
 * Uses Google Static Street View at the franchise's lat/lng to grab a
 * storefront photo. Saves locally so we don't pay per pageload.
 *
 * Requires GOOGLE_PLACES_API_KEY in env (the same key the live reviews
 * call uses on dev — Static Street View runs on the same Maps Platform
 * billing account, free tier covers ~28k req/mo).
 *
 * Output:
 *   public/data/franchises/streetview/<slug>.jpg  (1200×630)
 *
 * Patches locations.with-images.json in place: each backfilled franchise
 * gets the new image URL prepended to images.hero[]. Re-run build-registry.js
 * after this to regenerate the per-franchise files.
 */

const fs   = require('fs');
const https = require('https');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const SRC  = path.join(__dirname, 'locations.with-images.json');
const OUT_DIR = path.join(ROOT, 'public/data/franchises/streetview');

const API_KEY = process.env.GOOGLE_PLACES_API_KEY || '';
if (!API_KEY) {
  console.error('GOOGLE_PLACES_API_KEY required. Source it from .env first:');
  console.error('  export GOOGLE_PLACES_API_KEY=$(grep ^GOOGLE_PLACES_API_KEY .env | cut -d= -f2)');
  process.exit(1);
}

const SIZE = '1200x630';   // matches og:image proportions
const FOV = 90;            // wider than the 90 default to capture storefront context

function streetViewUrl(lat, lng) {
  const params = new URLSearchParams({
    size:     SIZE,
    location: `${lat},${lng}`,
    fov:      String(FOV),
    pitch:    '0',
    key:      API_KEY,
    return_error_code: 'true'   // 404 instead of empty placeholder if no SV here
  });
  return `https://maps.googleapis.com/maps/api/streetview?${params.toString()}`;
}

function metadataUrl(lat, lng) {
  // Free metadata check — tells us whether SV imagery exists at this
  // location WITHOUT counting against the photo quota.
  const params = new URLSearchParams({
    location: `${lat},${lng}`,
    key:      API_KEY
  });
  return `https://maps.googleapis.com/maps/api/streetview/metadata?${params.toString()}`;
}

function getJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let body = '';
      res.on('data', (c) => body += c);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      const out = fs.createWriteStream(dest);
      res.pipe(out);
      out.on('finish', () => out.close(resolve));
      out.on('error', reject);
    }).on('error', reject);
  });
}

(async () => {
  const locations = JSON.parse(fs.readFileSync(SRC, 'utf8'));
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const targets = locations.filter(l =>
    (!l.images || !l.images.hero || l.images.hero.length === 0) &&
    typeof l.lat === 'number' && typeof l.lng === 'number'
  );
  console.log(`Backfilling ${targets.length} franchises with Street View imagery…`);

  let backfilled = 0;
  let noImagery = 0;
  for (const loc of targets) {
    process.stdout.write(`  ${loc.slug.padEnd(30)} `);
    try {
      // Step 1: free metadata check
      const meta = await getJSON(metadataUrl(loc.lat, loc.lng));
      if (meta.status !== 'OK') {
        console.log(`(no SV imagery: ${meta.status})`);
        noImagery++;
        continue;
      }
      // Step 2: paid photo fetch
      const dest = path.join(OUT_DIR, `${loc.slug}.jpg`);
      await downloadFile(streetViewUrl(loc.lat, loc.lng), dest);
      const url = `/data/franchises/streetview/${loc.slug}.jpg`;
      // Patch the source file so build-registry.js picks it up next run
      const idx = locations.findIndex(x => x.slug === loc.slug);
      if (!locations[idx].images) locations[idx].images = { hero: [], interior: [], owner: [], landmarks: [], ogImage: '', ogImageAlt: '', mapPreview: '' };
      locations[idx].images.hero = [url];
      locations[idx].images.ogImage = url;
      locations[idx].images.ogImageAlt = `${loc.name} storefront (Google Street View)`;
      backfilled++;
      const stat = fs.statSync(dest);
      console.log(`OK (${(stat.size/1024).toFixed(0)} KB)`);
    } catch (err) {
      console.log(`FAIL (${err.message})`);
    }
  }

  fs.writeFileSync(SRC, JSON.stringify(locations, null, 2));
  console.log(`\nBackfilled ${backfilled} franchises. ${noImagery} have no Street View coverage and will keep the kent-wa fallback.`);
  console.log(`Re-run build-registry.js to push these into the per-franchise JSON files.`);
})();
