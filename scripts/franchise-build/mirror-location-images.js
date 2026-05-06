#!/usr/bin/env node
/* eslint-disable no-console */

/*
 * Mirror per-franchise location images from wavemaxlaundry.com to
 * public/assets/images/locations/{slug}/{file}.
 *
 * Reads every URL referenced in public/data/franchises/*.json, downloads
 * the file, and writes it under public/assets/images/locations/.
 *
 * This is a BUILD-TIME dependency on the corporate site. The runtime site
 * reads only from the local mirror via wm-image-config.js. When an
 * authoritative LOCATION_DATA source comes online, this script (along with
 * fetch-corporate-data.js and friends in this directory) is replaced with
 * one that pulls from the new source — runtime code is unaffected.
 *
 * Usage:
 *   node scripts/franchise-build/mirror-location-images.js [--force] [--limit=N]
 *
 *   --force   Re-download files that already exist locally
 *   --limit=N Stop after downloading N images (for testing)
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const REPO_ROOT  = path.join(__dirname, '..', '..');
const DATA_DIR   = path.join(REPO_ROOT, 'public', 'data', 'franchises');
const OUTPUT_DIR = path.join(REPO_ROOT, 'public', 'assets', 'images', 'locations');

const URL_PATTERN = /https:\/\/wavemaxlaundry\.com\/wp-content\/uploads\/locations\/([^"\s]+)/g;

const FORCE = process.argv.includes('--force');
const LIMIT_ARG = process.argv.find((a) => a.startsWith('--limit='));
const LIMIT = LIMIT_ARG ? parseInt(LIMIT_ARG.split('=')[1], 10) : Infinity;

function collectUrls() {
  const files = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith('.json'));
  const urls = new Set();
  for (const f of files) {
    const text = fs.readFileSync(path.join(DATA_DIR, f), 'utf8');
    let m;
    while ((m = URL_PATTERN.exec(text)) !== null) {
      urls.add('https://wavemaxlaundry.com/wp-content/uploads/locations/' + m[1]);
    }
  }
  return Array.from(urls).sort();
}

function urlToLocalPath(url) {
  // url: https://wavemaxlaundry.com/wp-content/uploads/locations/<slug>/<file>
  const rel = url.replace(/^https:\/\/wavemaxlaundry\.com\/wp-content\/uploads\/locations\//, '');
  return path.join(OUTPUT_DIR, rel);
}

function ensureDir(p) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
}

function download(url, dest) {
  return new Promise((resolve) => {
    const req = https.get(url, { timeout: 30000 }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return download(res.headers.location, dest).then(resolve);
      }
      if (res.statusCode !== 200) {
        res.resume();
        return resolve({ ok: false, status: res.statusCode });
      }
      ensureDir(dest);
      const tmp = dest + '.tmp';
      const out = fs.createWriteStream(tmp);
      res.pipe(out);
      out.on('finish', () => {
        out.close(() => {
          fs.renameSync(tmp, dest);
          resolve({ ok: true, status: 200 });
        });
      });
      out.on('error', (e) => resolve({ ok: false, error: e.message }));
    });
    req.on('error', (e) => resolve({ ok: false, error: e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, error: 'timeout' }); });
  });
}

async function main() {
  const urls = collectUrls();
  console.log(`Found ${urls.length} unique image URLs across ${fs.readdirSync(DATA_DIR).length} franchise JSON files`);

  let okCount = 0;
  let skipCount = 0;
  let errCount = 0;
  const errors = [];

  for (let i = 0; i < urls.length && i < LIMIT; i++) {
    const url = urls[i];
    const dest = urlToLocalPath(url);
    if (!FORCE && fs.existsSync(dest)) {
      skipCount++;
      continue;
    }
    process.stdout.write(`[${i + 1}/${urls.length}] ${url.split('/').slice(-2).join('/')} ... `);
    const r = await download(url, dest);
    if (r.ok) {
      okCount++;
      console.log('OK');
    } else {
      errCount++;
      errors.push({ url, ...r });
      console.log(`FAIL (${r.status || r.error})`);
    }
  }

  console.log(`\nSummary: ${okCount} downloaded, ${skipCount} already present, ${errCount} failed`);
  if (errors.length) {
    const errFile = path.join(__dirname, 'mirror-location-images.errors.json');
    fs.writeFileSync(errFile, JSON.stringify(errors, null, 2));
    console.log(`Failures written to ${errFile}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
