#!/usr/bin/env node
/* eslint-disable no-console */

/*
 * Scrape per-franchise data from wavemaxlaundry.com.
 *
 * Each corporate franchise page (https://wavemaxlaundry.com/<slug>/) has
 * a single JSON literal embedded in an inline script under `var d = {...}`
 * with the store's hours, pricing, owner, neighborhood, social handles,
 * and testimonials. We pull what's useful into known-overrides.json:
 *
 *   - hours.open / hours.close / hours.display / hours.lastWash
 *     ("7am-10pm" → open 07:00, close 22:00, display "7am-10pm")
 *   - pricing.wdf.rate / minLb / display
 *     ("1.20" / "10" → $1.20/lb)
 *   - pricing.selfServe.minLoad / maxLoad / rangeDisplay
 *     ("2.5" / "4" → $2.50 – $4.00)
 *   - owners[0].name (just the name; role / bio / tag stay empty so the
 *     about-us card renders 'Owner / Operator' default)
 *   - contact.neighborhood ("North Austin", "South Loop", etc. — NEW)
 *   - socialMedia.facebook / .instagram (NEW)
 *
 * We DO NOT pull num_washers/num_dryers — corporate's value is stale
 * on Austin (says 20, real is 42), so we don't trust it for other stores.
 * Equipment counts come from the equipment-profile system + manual
 * overrides only.
 *
 * Existing entries in known-overrides.json are preserved unless --force.
 *
 * Usage:
 *   node scripts/franchise-build/fetch-corporate-data.js [--force]
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const FORCE = process.argv.includes('--force');

const LOCATIONS_FILE = path.join(__dirname, 'locations.with-images.json');
const OVERRIDES_FILE = path.join(__dirname, 'known-overrides.json');
const RATE_LIMIT_MS = 250;

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

function decodeEntities(s) {
  return String(s)
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)));
}

// Extract corporate's `var d = {"phone":...};` JSON literal. Can't
// regex this — the object's `email` value contains HTML entity refs
// like `&#xNN;` whose semicolons trip a simple [^;]+ stop. Brace-match
// from the opening `{` instead, ignoring braces that appear inside
// double-quoted strings.
function extractCorpData(html) {
  const anchor = html.indexOf('={"phone"');
  if (anchor < 0) return null;
  const start = anchor + 1;
  let depth = 0, inStr = false, esc = false, end = -1;
  for (let i = start; i < html.length; i++) {
    const c = html[i];
    if (esc) { esc = false; continue; }
    if (inStr) {
      if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }
  if (end < 0) return null;
  try { return JSON.parse(html.slice(start, end + 1)); }
  catch (_) { return null; }
}

// 'd.times' is "7am-10pm" / "7:00am-10:00pm" / "Open 24/7" / etc.
// Parse to {open:'HH:MM', close:'HH:MM', display:original}. Returns null
// for unparsable forms (we just keep the display string then).
function parseHoursTimes(times) {
  if (!times || typeof times !== 'string') return null;
  const t = times.trim();
  if (/24\/7|24 ?hours/i.test(t)) {
    return { open: '00:00', close: '23:59', display: t };
  }
  // Match patterns like '7am-10pm' or '7:00am – 10:00 pm'
  const m = t.match(/^\s*(\d{1,2})(?::(\d{2}))?\s*([ap]m)\s*[-––to]+\s*(\d{1,2})(?::(\d{2}))?\s*([ap]m)\s*$/i);
  if (!m) return { display: t };
  const to24 = (h, mm, ampm) => {
    h = parseInt(h, 10);
    if (/pm/i.test(ampm) && h !== 12) h += 12;
    if (/am/i.test(ampm) && h === 12) h = 0;
    return `${String(h).padStart(2,'0')}:${(mm || '00').padStart(2,'0')}`;
  };
  return {
    open:    to24(m[1], m[2], m[3]),
    close:   to24(m[4], m[5], m[6]),
    display: t
  };
}

function fmtMoney(n) {
  const num = Number(n);
  if (!isFinite(num)) return null;
  return '$' + num.toFixed(2);
}

function buildOverride(d, prevOverride) {
  const out = JSON.parse(JSON.stringify(prevOverride || {}));
  out.contact = out.contact || {};
  out.hours = out.hours || {};
  out.pricing = out.pricing || {};
  out.pricing.wdf = out.pricing.wdf || {};
  out.pricing.selfServe = out.pricing.selfServe || {};
  out.owners = out.owners || [];
  out.socialMedia = out.socialMedia || {};

  // --- Neighborhood
  if (d.neighborhood && !out.contact.neighborhood) {
    out.contact.neighborhood = String(d.neighborhood).trim();
  }

  // --- Hours
  if (d.times) {
    const h = parseHoursTimes(d.times);
    if (h) {
      if (h.open  != null && !out.hours.open)    out.hours.open  = h.open;
      if (h.close != null && !out.hours.close)   out.hours.close = h.close;
      if (h.display       && !out.hours.display) out.hours.display = h.display;
    }
    if (!out.hours.days) out.hours.days = 'Open daily';
  }
  if (d.last_wash && !out.hours.lastWash) out.hours.lastWash = String(d.last_wash);

  // --- WDF pricing
  if (d.wdf && !out.pricing.wdf.rate) {
    const rate = parseFloat(d.wdf);
    if (isFinite(rate)) {
      out.pricing.wdf.rate = rate;
      out.pricing.wdf.currency = 'USD';
      out.pricing.wdf.display = `${fmtMoney(rate)}/lb`;
    }
  }
  if (d.wdf_min && !out.pricing.wdf.minLb) {
    const min = parseInt(d.wdf_min, 10);
    if (isFinite(min)) out.pricing.wdf.minLb = min;
  }

  // --- Self-serve pricing range
  if (d.ss_min && d.ss_max && !out.pricing.selfServe.rangeDisplay) {
    const lo = parseFloat(d.ss_min), hi = parseFloat(d.ss_max);
    if (isFinite(lo) && isFinite(hi)) {
      out.pricing.selfServe.minLoad = lo;
      out.pricing.selfServe.maxLoad = hi;
      out.pricing.selfServe.minLoadDisplay = fmtMoney(lo);
      out.pricing.selfServe.maxLoadDisplay = fmtMoney(hi);
      out.pricing.selfServe.rangeDisplay = `${fmtMoney(lo)} – ${fmtMoney(hi)}`;
    }
  }

  // --- Owner name (no role / bio / tag — those need authoring)
  if (d.owner && (!out.owners.length || !out.owners[0].name)) {
    out.owners = [{
      name:        String(d.owner).trim(),
      role:        'Owner / Operator',
      tag:         '',
      bio:         '',
      avatarStyle: 'primary'
    }];
  }

  // --- Social
  if (d.facebook  && !out.socialMedia.facebook)  out.socialMedia.facebook  = String(d.facebook);
  if (d.instagram && !out.socialMedia.instagram) out.socialMedia.instagram = String(d.instagram);

  return out;
}

(async () => {
  const records = JSON.parse(fs.readFileSync(LOCATIONS_FILE, 'utf8'));
  const overrides = JSON.parse(fs.readFileSync(OVERRIDES_FILE, 'utf8'));

  let updated = 0, partial = 0, failed = 0;

  for (const r of records) {
    const slug = r.slug;
    try {
      const html = await httpGet(`https://wavemaxlaundry.com/${slug}/`);
      const d = extractCorpData(html);
      if (!d) {
        console.warn('  no corporate data found for', slug);
        failed++;
        await sleep(RATE_LIMIT_MS);
        continue;
      }
      const next = buildOverride(d, overrides[slug]);
      const fields = [];
      if (d.times)        fields.push(`hours=${d.times}`);
      if (d.wdf)          fields.push(`wdf=$${d.wdf}/lb`);
      if (d.ss_min)       fields.push(`ss=${d.ss_min}-${d.ss_max}`);
      if (d.owner)        fields.push(`owner=${d.owner}`);
      if (d.neighborhood) fields.push(`hood=${d.neighborhood}`);
      console.log(`  ${slug.padEnd(28)} ${fields.join('  ')}`);
      overrides[slug] = next;
      updated++;
    } catch (e) {
      console.warn('  error for', slug, '—', e.message);
      failed++;
    }
    await sleep(RATE_LIMIT_MS);
  }

  fs.writeFileSync(OVERRIDES_FILE, JSON.stringify(overrides, null, 2));
  console.log('\nUpdated', updated, '· partial', partial, '· failed', failed);
  console.log('Now rebuild the registry:');
  console.log('  node scripts/franchise-build/build-registry.js');
})();
