#!/usr/bin/env node
/* eslint-disable no-console */

/*
 * Scrape per-franchise owner emails from wavemaxlaundry.com.
 *
 * Corporate publishes each franchise's owner email inside its page JSON-LD
 * block, but encoded with HTML numeric entities (anti-scraper obfuscation).
 * Pattern looks like:
 *   "email":"j&#x6f;&#104;&#x6e;&#64;a&#117;&#x73;&#x74;&#x69;&#110;..."
 * Some franchises list multiple emails (comma-separated) — we keep the first
 * since the registry's contact.email field is single-valued; owners can
 * author both via known-overrides if they want a multi-recipient inbox.
 *
 * Output: writes the decoded email into known-overrides.json under
 *   <slug>.contact.email and <slug>.contact.emailMailto
 *
 * Skips entries already authored manually unless --force is passed.
 *
 * Usage:
 *   node scripts/franchise-build/fetch-emails.js [--force]
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const FORCE = process.argv.includes('--force');

const LOCATIONS_FILE = path.join(__dirname, 'locations.with-images.json');
const OVERRIDES_FILE = path.join(__dirname, 'known-overrides.json');
const RATE_LIMIT_MS = 250;

// One-hop redirect follower. Corporate 301s www → bare domain, which
// node's https.get doesn't auto-follow.
function httpGet(url, hops = 0) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WaveMAX-Affiliate-Build/1.0)' }
    }, (res) => {
      if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location && hops < 3) {
        res.resume();
        return resolve(httpGet(res.headers.location, hops + 1));
      }
      let chunks = '';
      res.on('data', d => chunks += d);
      res.on('end', () => resolve(chunks));
    }).on('error', reject);
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Decode &#xNN; (hex) and &#NNN; (decimal) numeric character references.
// Corporate's encoding mixes both forms in the same email string.
function decodeEntities(s) {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)));
}

(async () => {
  const records = JSON.parse(fs.readFileSync(LOCATIONS_FILE, 'utf8'));
  const overrides = JSON.parse(fs.readFileSync(OVERRIDES_FILE, 'utf8'));

  let added = 0, skipped = 0, failed = 0;

  for (const r of records) {
    const slug = r.slug;
    const existing = overrides[slug] && overrides[slug].contact && overrides[slug].contact.email;
    if (existing && !FORCE) {
      console.log('  skip', slug, '— already authored:', existing);
      skipped++;
      continue;
    }
    try {
      const html = await httpGet(`https://www.wavemaxlaundry.com/${slug}/`);
      // Find all "email":"..." values in JSON-LD blocks. Could be multiple
      // (some stores list co-owners); take the first.
      const matches = html.match(/"email"\s*:\s*"([^"]+)"/g) || [];
      let email = null;
      for (const m of matches) {
        const raw = m.match(/"email"\s*:\s*"([^"]+)"/)[1];
        const decoded = decodeEntities(raw).split(',')[0].trim();
        // Sanity-check: must look like an email and not be the corporate
        // catch-all (which appears in the cookie-banner footer block).
        if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(decoded)
            && decoded.toLowerCase() !== 'customer-care@wavemax.com'
            && !/no-reply/i.test(decoded)) {
          email = decoded;
          break;
        }
      }
      if (!email) {
        console.warn('  no email found for', slug);
        failed++;
        await sleep(RATE_LIMIT_MS);
        continue;
      }
      console.log(`  ${slug.padEnd(28)} ${email}`);
      overrides[slug] = overrides[slug] || {};
      overrides[slug].contact = overrides[slug].contact || {};
      overrides[slug].contact.email = email;
      overrides[slug].contact.emailMailto = `mailto:${email}`;
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
