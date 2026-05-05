#!/usr/bin/env node
/* eslint-disable no-console */

/*
 * Fetch 4-5 landmark photos per franchise city from Wikipedia.
 *
 * Strategy:
 *   1. Build Wikipedia page title from city + state (e.g. "Austin, Texas").
 *   2. Query the page for images (generator=images), pulling URL + license
 *      metadata in a single call.
 *   3. Filter out non-landmark images: flags, coats of arms, maps, seals,
 *      locator templates, navbox icons. Reject SVG (usually heraldry).
 *   4. Score what's left by filename — score-up if 'skyline', 'downtown',
 *      'capitol', 'bridge', 'park', 'plaza', or the city name appears;
 *      score-down if 'category', 'panel', 'logo' appears.
 *   5. Pick top 5, write to known-overrides.json under <slug>.images.landmarks.
 *
 * Output writes to known-overrides.json with deep merge (no clobber of
 * existing landmarks). Existing entries (austin-tx already has 3) are
 * left in place unless --force is passed.
 *
 * Usage:
 *   node scripts/franchise-build/fetch-landmarks.js [--force]
 *
 * No API key needed; Wikipedia API is open. Rate-limit at 4 req/sec.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const FORCE = process.argv.includes('--force');

const LOCATIONS_FILE = path.join(__dirname, 'locations.with-images.json');
const OVERRIDES_FILE = path.join(__dirname, 'known-overrides.json');
const RATE_LIMIT_MS = 250;

// US state abbreviation → full name (Wikipedia titles use the full name).
const STATE_NAMES = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
  HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
  KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri',
  MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
  NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio',
  OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont',
  VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
  DC: 'District of Columbia'
};

// Skip these filename fragments — heraldry, maps, navboxes, etc.
const SKIP_PATTERNS = [
  /flag/i, /coat[_ ]of[_ ]arms/i, /seal/i,
  /locator/i, /map/i, /plat[_ ]of/i,
  /commons[_ -]logo/i, /wiktionary/i, /wikiquote/i, /wikiversity/i, /wikinews/i,
  /question[_ ]book/i, /symbol[_ ]/i,
  /panel\.svg$/i, /^icon[_ ]/i,
  /\.svg$/i,                     // most svgs in city pages are seals/flags
  /diagram/i, /chart/i, /demographics/i
];

// Score-up keywords (more relevant landmarks)
const RELEVANCE_KEYWORDS = [
  'skyline', 'downtown', 'capitol', 'city[_ ]hall', 'courthouse',
  'bridge', 'tower', 'park', 'plaza', 'square', 'fountain',
  'museum', 'station', 'cathedral', 'church', 'historic',
  'street', 'avenue', 'boulevard', 'memorial', 'monument',
  'arena', 'stadium', 'theater', 'theatre', 'building',
  'aerial', 'panorama', 'view'
];

function httpGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: { 'User-Agent': 'WaveMAX-Affiliate-Program-LandmarkFetcher/1.0 (rick.houlihan@gmail.com)' }
    }, (res) => {
      let chunks = '';
      res.on('data', d => chunks += d);
      res.on('end', () => {
        try { resolve(JSON.parse(chunks)); }
        catch (e) { reject(new Error('Parse error: ' + chunks.slice(0, 200))); }
      });
    }).on('error', reject);
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Choose a Wikipedia page title that's most likely to be a real city article.
// Some franchise cities are ambiguous ("St. Paul" → MN; "Phoenix" → AZ);
// the state suffix disambiguates. Special-case a couple of known nuances.
function pageTitleFor(city, stateAbbr) {
  if (!city || !stateAbbr) return null;
  const stateName = STATE_NAMES[stateAbbr] || stateAbbr;
  // Wikipedia disambiguates 'Saint' / 'St.' inconsistently — use Saint form
  // since that's how MOST state articles are titled (e.g. "Saint Paul, Minnesota").
  let cityForTitle = city.replace(/^St\.\s+/, 'Saint ').replace(/^St\s+/, 'Saint ');
  return `${cityForTitle}, ${stateName}`;
}

function score(filename, city) {
  const f = filename.toLowerCase();
  let s = 0;
  for (const kw of RELEVANCE_KEYWORDS) {
    if (new RegExp(kw, 'i').test(f)) s += 2;
  }
  if (city && f.includes(city.toLowerCase().replace(/[^a-z0-9]+/g, ''))) s += 3;
  if (city && f.includes(city.toLowerCase().split(/\s+/).join('_'))) s += 3;
  if (f.includes('aerial') || f.includes('skyline') || f.includes('panorama')) s += 4;
  return s;
}

async function fetchLandmarksFor(city, stateAbbr) {
  const title = pageTitleFor(city, stateAbbr);
  if (!title) return [];

  // Single round-trip: generator=images returns image pages with imageinfo
  // populated. iiurlwidth scales the URL to a 1280-wide thumb.
  const url = `https://en.wikipedia.org/w/api.php?` + new URLSearchParams({
    action: 'query',
    format: 'json',
    titles: title,
    redirects: '1',                 // follow 'Saint Paul, Minnesota' → 'Saint Paul'
    generator: 'images',
    gimlimit: '50',
    prop: 'imageinfo',
    iiprop: 'url|size|mime|extmetadata',
    iiurlwidth: '1280'
  });

  const data = await httpGet(url);
  if (!data || !data.query || !data.query.pages) return [];

  const candidates = [];
  for (const pageId of Object.keys(data.query.pages)) {
    const p = data.query.pages[pageId];
    const filename = (p.title || '').replace(/^File:/, '');
    if (SKIP_PATTERNS.some(re => re.test(filename))) continue;
    const ii = p.imageinfo && p.imageinfo[0];
    if (!ii) continue;
    if (ii.mime && !/jpeg|png|webp/i.test(ii.mime)) continue;
    if (ii.width && ii.width < 800) continue;          // tiny crops are usually icons
    candidates.push({
      filename,
      url: ii.thumburl || ii.url,
      width: ii.thumbwidth || ii.width,
      height: ii.thumbheight || ii.height,
      score: score(filename, city)
    });
  }

  // Top 5 by score, breaking ties by larger image width.
  candidates.sort((a, b) => (b.score - a.score) || (b.width - a.width));
  const picked = candidates.slice(0, 5).map((c) => ({
    url: c.url,
    alt: `${c.filename.replace(/_/g, ' ').replace(/\.[a-z]+$/i, '')} — ${city}`
  }));
  return picked;
}

(async () => {
  const records = JSON.parse(fs.readFileSync(LOCATIONS_FILE, 'utf8'));
  const overrides = JSON.parse(fs.readFileSync(OVERRIDES_FILE, 'utf8'));

  let added = 0, skipped = 0, failed = 0;

  for (const r of records) {
    const slug = r.slug;
    const existing = overrides[slug] && overrides[slug].images && overrides[slug].images.landmarks;
    if (existing && existing.length && !FORCE) {
      console.log('  skip', slug, '— already have', existing.length, 'landmarks');
      skipped++;
      continue;
    }
    if (!r.city || !r.state) {
      console.log('  skip', slug, '— missing city/state');
      skipped++;
      continue;
    }
    try {
      const lms = await fetchLandmarksFor(r.city, r.state);
      if (lms.length === 0) {
        console.warn('  no landmarks for', slug, `(${r.city}, ${r.state})`);
        failed++;
        await sleep(RATE_LIMIT_MS);
        continue;
      }
      console.log(`  ${slug.padEnd(30)} ${lms.length} landmarks  e.g. ${lms[0].alt.slice(0, 60)}`);
      overrides[slug] = overrides[slug] || {};
      overrides[slug].images = overrides[slug].images || {};
      overrides[slug].images.landmarks = lms;
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
