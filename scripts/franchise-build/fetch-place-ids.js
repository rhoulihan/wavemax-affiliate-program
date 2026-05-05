#!/usr/bin/env node
/* eslint-disable no-console */

/*
 * Fetch Google Place IDs for every franchise via the Places API (New).
 * Reviews on the landing page need the franchise's place_id to query
 * the Places Reviews endpoint; without it the reviews-empty fallback
 * link is what users see. We have it for Austin (manually copied);
 * this script populates the other 74.
 *
 * Output: writes place IDs into known-overrides.json under
 *   <slug>.google.placeId
 * That way build-registry.js picks them up on the next rebuild and
 * they survive locations.with-images.json changes.
 *
 * Usage:
 *   GOOGLE_PLACES_API_KEY=... node scripts/franchise-build/fetch-place-ids.js
 *
 * Skips entries that already have a placeId in known-overrides.json.
 * Skips entries with no street address (Places API would return a
 * sibling location, like nashville-tn returning Austin's place).
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const KEY = process.env.GOOGLE_PLACES_API_KEY;
if (!KEY) { console.error('GOOGLE_PLACES_API_KEY not set'); process.exit(1); }

const LOCATIONS_FILE = path.join(__dirname, 'locations.with-images.json');
const OVERRIDES_FILE = path.join(__dirname, 'known-overrides.json');
const REFERER = 'https://wavemax.promo/';
const RATE_LIMIT_MS = 250;

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
        'X-Goog-FieldMask': 'places.id,places.formattedAddress,places.location',
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
  const overrides = JSON.parse(fs.readFileSync(OVERRIDES_FILE, 'utf8'));

  let added = 0, skipped = 0, failed = 0;

  for (const r of records) {
    const slug = r.slug;
    const existing = overrides[slug] && overrides[slug].google && overrides[slug].google.placeId;
    if (existing) {
      console.log('  skip', slug, '— already have', existing);
      skipped++;
      continue;
    }
    if (!r.address || !r.address.trim()) {
      console.log('  skip', slug, '— no street address');
      skipped++;
      continue;
    }
    const query = `WaveMAX Laundry ${r.address} ${r.city || ''} ${r.state || ''} ${r.zip || ''}`.trim();
    try {
      const resp = await searchText(query);
      const place = resp.places && resp.places[0];
      if (!place || !place.id) {
        console.warn('  no result for', slug);
        failed++;
        await sleep(RATE_LIMIT_MS);
        continue;
      }

      // Sanity-check: the formattedAddress should at least share the city
      // with what we asked for. If Places returned something far away
      // (e.g. nashville-tn returning Austin), reject.
      const fmt = (place.formattedAddress || '').toLowerCase();
      const expectedCity = (r.city || '').toLowerCase();
      if (expectedCity && !fmt.includes(expectedCity)) {
        console.warn(`  REJECT ${slug} — Places returned '${place.formattedAddress}' (no '${r.city}' match)`);
        failed++;
        await sleep(RATE_LIMIT_MS);
        continue;
      }

      console.log(`  ${slug.padEnd(28)} ${place.id}`);
      overrides[slug] = overrides[slug] || {};
      overrides[slug].google = overrides[slug].google || {};
      overrides[slug].google.placeId = place.id;
      added++;
    } catch (e) {
      console.warn('  error for', slug, '—', e.message);
      failed++;
    }
    await sleep(RATE_LIMIT_MS);
  }

  fs.writeFileSync(OVERRIDES_FILE, JSON.stringify(overrides, null, 2));
  console.log('\nAdded', added, '· skipped', skipped, '· failed', failed);
  console.log('Now rebuild the registry:');
  console.log('  node scripts/franchise-build/build-registry.js');
})();
