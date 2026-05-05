#!/usr/bin/env node
/**
 * Per-franchise image probe.
 *
 * For each franchise slug, HEAD-checks the corporate CDN for the standard
 * image set (hero-1..3, interior-1..6, owners) in jpg + webp. Records
 * which URLs return 200 so the per-franchise LOCATION_DATA can populate
 * `images.hero[]`, `images.interior[]`, `images.owner` from real assets.
 *
 * Concurrency: per-franchise sequential, N franchises in parallel.
 * Existing kent-wa fallback chain is preserved by the runtime resolver,
 * so it is fine for some slots to come back empty here.
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const RAW_PATH = path.join(__dirname, 'locations.raw.json');
const OUT_PATH = path.join(__dirname, 'locations.with-images.json');
const CDN_BASE = 'https://wavemaxlaundry.com/wp-content/uploads/locations';
const CONCURRENCY = 5;
const TIMEOUT_MS = 4000;

function head(url) {
  return new Promise((resolve) => {
    const req = https.request(url, { method: 'HEAD', timeout: TIMEOUT_MS }, (res) => {
      resolve({ url, status: res.statusCode });
      res.resume();
    });
    req.on('error', () => resolve({ url, status: 0 }));
    req.on('timeout', () => { req.destroy(); resolve({ url, status: 0 }); });
    req.end();
  });
}

async function probeSlot(slug, kind, idx) {
  // Try jpg first, then webp. Both 404 → slot is empty for this franchise.
  for (const ext of ['jpg', 'webp']) {
    const file = idx == null ? `${kind}.${ext}` : `${kind}-${idx}.${ext}`;
    const url = `${CDN_BASE}/${slug}/${file}`;
    const r = await head(url);
    if (r.status >= 200 && r.status < 300) return url;
  }
  return null;
}

async function probeFranchise(loc) {
  const slug = loc.slug;
  const hero = [];
  const interior = [];

  for (let i = 1; i <= 3; i++) {
    const u = await probeSlot(slug, 'hero', i);
    if (u) hero.push(u);
  }
  for (let i = 1; i <= 6; i++) {
    const u = await probeSlot(slug, 'interior', i);
    if (u) interior.push(u);
  }
  // Owner photo — try `owners` first (corporate convention), fallback to `owner`.
  let ownerUrl = await probeSlot(slug, 'owners', null);
  if (!ownerUrl) ownerUrl = await probeSlot(slug, 'owner', null);

  return {
    ...loc,
    images: {
      hero,
      interior,
      owner: ownerUrl ? [ownerUrl] : [],
      landmarks: [],
      ogImage: hero[0] || '',
      ogImageAlt: `${loc.name} storefront`,
      mapPreview: ''
    }
  };
}

async function runWithConcurrency(items, worker, n) {
  const results = new Array(items.length);
  let next = 0;
  async function lane() {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      const start = Date.now();
      results[i] = await worker(items[i]);
      const ms = Date.now() - start;
      const r = results[i];
      const counts = `hero=${r.images.hero.length} interior=${r.images.interior.length} owner=${r.images.owner.length}`;
      console.log(`[${i + 1}/${items.length}] ${r.slug.padEnd(28)} ${counts.padEnd(40)} (${ms}ms)`);
    }
  }
  await Promise.all(Array.from({ length: n }, lane));
  return results;
}

(async () => {
  const locations = JSON.parse(fs.readFileSync(RAW_PATH, 'utf8'));
  console.log(`Probing ${locations.length} franchises (concurrency=${CONCURRENCY})…`);
  const t0 = Date.now();
  const enriched = await runWithConcurrency(locations, probeFranchise, CONCURRENCY);
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  fs.writeFileSync(OUT_PATH, JSON.stringify(enriched, null, 2));

  // Summary
  const stats = {
    totalFranchises: enriched.length,
    withAnyHero:     enriched.filter(f => f.images.hero.length > 0).length,
    withAnyInterior: enriched.filter(f => f.images.interior.length > 0).length,
    withOwner:       enriched.filter(f => f.images.owner.length > 0).length,
    withNothing:     enriched.filter(f => f.images.hero.length === 0 && f.images.interior.length === 0 && f.images.owner.length === 0).length
  };
  console.log(`\nDone in ${elapsed}s. Wrote ${OUT_PATH}.`);
  console.log('Summary:', JSON.stringify(stats, null, 2));
  if (stats.withNothing > 0) {
    const dark = enriched.filter(f => f.images.hero.length === 0 && f.images.interior.length === 0 && f.images.owner.length === 0).map(f => f.slug);
    console.log('Franchises with zero images (will use kent-wa fallback at runtime):');
    dark.forEach(s => console.log('  -', s));
  }
})();
