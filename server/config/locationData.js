/* Server-side LOCATION_DATA loader.
 *
 * Single source of truth for per-location business data is the same
 * IIFE the browser loads — public/assets/js/austin-host-mock-data.js
 * (and equivalents per slug). The server reads that file at startup,
 * sandbox-evaluates the IIFE in a vm context, and pulls
 * `window.LOCATION_DATA` out. That keeps client and server pinned to
 * the same definition without a build step, a JSON intermediary, or
 * duplicated data.
 *
 * Used by:
 *   - contactController — to resolve the contact-form recipient email
 *     from `LOCATION_DATA.contact.email`
 *
 * Future locations: register their data file in LOCATION_FILES below
 * and the rest of the system picks them up automatically.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const logger = require('../utils/logger');

const LOCATION_FILES = {
  'austin-tx': path.join(__dirname, '..', '..', 'public', 'assets', 'js', 'austin-host-mock-data.js')
};

const cache = new Map();

function loadLocationData(slug) {
  if (cache.has(slug)) return cache.get(slug);
  const file = LOCATION_FILES[slug];
  if (!file) return null;

  let code;
  try {
    code = fs.readFileSync(file, 'utf8');
  } catch (err) {
    logger.error('LOCATION_DATA file unreadable', { slug, file, error: err.message });
    return null;
  }

  // Sandbox: only `window` is exposed, no globals, no require, no fs.
  // The IIFE in the data file does `window.LOCATION_DATA = {...}`.
  const sandbox = { window: {} };
  try {
    vm.runInNewContext(code, sandbox, { filename: file, timeout: 100 });
  } catch (err) {
    logger.error('LOCATION_DATA file eval failed', { slug, file, error: err.message });
    return null;
  }

  const data = sandbox.window.LOCATION_DATA || null;
  if (!data) {
    logger.error('LOCATION_DATA file did not set window.LOCATION_DATA', { slug, file });
    return null;
  }
  cache.set(slug, data);
  return data;
}

// Test-only: forget what we cached so a hot file edit takes effect on the
// next call. Real prod refresh is via pm2 restart.
function clearCache() { cache.clear(); }

module.exports = {
  loadLocationData,
  clearCache,
  // Surface the registry shape so callers (and unit tests) can assert
  // which slugs are wired without grepping.
  getKnownSlugs: () => Object.keys(LOCATION_FILES)
};
