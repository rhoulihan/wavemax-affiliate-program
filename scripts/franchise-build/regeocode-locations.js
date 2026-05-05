#!/usr/bin/env node
/* eslint-disable no-console */

/*
 * Re-geocode all franchises in locations.with-images.json using Google's
 * Places API (New). The lat/lng we inherited from corporate is imprecise —
 * up to ~1 mile off — so the locator-modal pin lands blocks away from the
 * actual store. Places API gives us the verified business location.
 *
 * Usage:
 *   GOOGLE_PLACES_API_KEY=... node scripts/franchise-build/regeocode-locations.js
 *
 * The API key must be referrer-restricted to wavemax.promo (it is the
 * same key the in-page reviews + maps use). We send the referer header
 * explicitly so the request passes the restriction check.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const KEY = process.env.GOOGLE_PLACES_API_KEY;
if (!KEY) { console.error('GOOGLE_PLACES_API_KEY not set'); process.exit(1); }

const LOCATIONS_FILE = path.join(__dirname, 'locations.with-images.json');
const REFERER = 'https://wavemax.promo/';
const RATE_LIMIT_MS = 250;  // ~4 req/sec — well under Places quota

function searchText(query) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ textQuery: query });
    const req = https.request({
      hostname: 'places.googleapis.com',
      path: '/v1/places:searchText',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'X-Goog-Api-Key': KEY,
        'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location',
        'Referer': REFERER
      }
    }, (res) => {
      let chunks = '';
      res.on('data', d => chunks += d);
      res.on('end', () => {
        try { resolve(JSON.parse(chunks)); }
        catch (e) { reject(new Error('Parse error: ' + chunks.slice(0, 200))); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
  const records = JSON.parse(fs.readFileSync(LOCATIONS_FILE, 'utf8'));
  console.log('Loaded', records.length, 'records');

  let updated = 0, skipped = 0, failed = 0;

  for (const r of records) {
    // Skip records without a street address — Places searchText would
    // fall through to "WaveMAX Laundry <city> <state>" and return an
    // unrelated WaveMAX in the same chain (this happened on nashville-tn,
    // which returned Austin's coords). Without a street address we have
    // no way to verify the right store, so leave the existing centroid.
    if (!r.address || !r.address.trim()) {
      console.log('  skip', r.slug, '— no street address');
      skipped++;
      continue;
    }
    const query = `WaveMAX Laundry ${r.address} ${r.city || ''} ${r.state || ''} ${r.zip || ''}`.trim();
    try {
      const resp = await searchText(query);
      const place = resp.places && resp.places[0];
      if (!place || !place.location) {
        console.warn('  no result for', r.slug, '—', query);
        failed++;
        await sleep(RATE_LIMIT_MS);
        continue;
      }
      const newLat = +place.location.latitude.toFixed(6);
      const newLng = +place.location.longitude.toFixed(6);
      const oldLat = r.lat;
      const oldLng = r.lng;
      const distMi = Math.sqrt(((newLat - oldLat) * 69) ** 2 + ((newLng - oldLng) * 54.6) ** 2);

      // Sanity bound: if the "match" is more than ~50mi from the prior
      // centroid, Places probably returned a different store in the same
      // chain. Keep the original.
      if (distMi > 50) {
        console.warn(`  ${r.slug.padEnd(25)} REJECT ${distMi.toFixed(0)}mi jump — keeping original. result was ${place.formattedAddress}`);
        failed++;
      } else if (distMi > 0.05) {
        console.log(`  ${r.slug.padEnd(25)} ${oldLat},${oldLng} → ${newLat},${newLng} (${distMi.toFixed(2)}mi off)`);
        r.lat = newLat;
        r.lng = newLng;
        updated++;
      } else {
        skipped++;
      }
    } catch (e) {
      console.warn('  error for', r.slug, '—', e.message);
      failed++;
    }
    await sleep(RATE_LIMIT_MS);
  }

  fs.writeFileSync(LOCATIONS_FILE, JSON.stringify(records, null, 2));
  console.log('\nDone. Updated', updated, '· skipped (close enough)', skipped, '· failed', failed);
  console.log('Now rebuild the registry:');
  console.log('  node scripts/franchise-build/build-registry.js');
})();
