/**
 * Franchise registry service.
 *
 * Loads + caches per-franchise LOCATION_DATA (from public/data/franchises/*.json)
 * and the franchise index (public/data/franchises.json). The cache reloads
 * automatically when the underlying files change so franchise edits take
 * effect on the next request — no server restart needed.
 *
 * Public API:
 *   getFranchise(slug)        → LOCATION_DATA or null
 *   listFranchises()          → array of index entries
 *   resolvePage(slug, page)   → { kind: 'iframe'|'default'|'notfound', iframeUrl?, defaultPage? }
 */

const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

const ROOT = path.resolve(__dirname, '../..');
const DATA_DIR = path.join(ROOT, 'public/data/franchises');
const INDEX_PATH = path.join(ROOT, 'public/data/franchises.json');

// Default content surface — what the franchise framework ships out of the
// box. A page key here means /franchise-default/<key>.html exists. The
// resolver will return one of these when no iframe override is registered.
const DEFAULT_PAGES = new Set([
  '/',
  '/wash-dry-fold',
  '/self-serve-laundry',
  '/commercial',
  '/about-us',
  '/contact'
]);

const cache = {
  index: null,
  franchises: new Map(),
  mtimes: new Map()  // slug → mtimeMs of last load
};

function loadIndex() {
  try {
    const stat = fs.statSync(INDEX_PATH);
    if (cache.index && cache.indexMtime === stat.mtimeMs) return cache.index;
    const raw = fs.readFileSync(INDEX_PATH, 'utf8');
    cache.index = JSON.parse(raw);
    cache.indexMtime = stat.mtimeMs;
    return cache.index;
  } catch (err) {
    logger.error('[franchiseRegistry] failed to load index', { err: err.message });
    return [];
  }
}

function loadFranchise(slug) {
  if (typeof slug !== 'string' || !/^[a-z0-9-]+$/.test(slug)) return null;
  const file = path.join(DATA_DIR, `${slug}.json`);
  try {
    const stat = fs.statSync(file);
    const cached = cache.franchises.get(slug);
    const cachedMtime = cache.mtimes.get(slug);
    if (cached && cachedMtime === stat.mtimeMs) return cached;
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    cache.franchises.set(slug, data);
    cache.mtimes.set(slug, stat.mtimeMs);
    return data;
  } catch (err) {
    if (err.code !== 'ENOENT') {
      logger.error(`[franchiseRegistry] failed to load ${slug}`, { err: err.message });
    }
    return null;
  }
}

function listFranchises() {
  return loadIndex();
}

function getFranchise(slug) {
  return loadFranchise(slug);
}

/**
 * Resolve a (slug, page) request to either an iframe override URL or a
 * franchise-default page key. Page is a path-style string ('/' for landing,
 * '/wash-dry-fold' for service pages).
 */
function resolvePage(slug, page = '/') {
  const data = loadFranchise(slug);
  if (!data) return { kind: 'notfound' };

  // Normalize: strip trailing slash, ensure leading slash
  const normalized = page === '' || page === '/' ? '/' : ('/' + page.replace(/^\/+/, '').replace(/\/+$/, ''));

  // 1) Iframe override registered? Always wins.
  const overrides = data.iframeOverrides || {};
  if (overrides[normalized]) {
    return { kind: 'iframe', iframeUrl: overrides[normalized], data, page: normalized };
  }

  // 2) Default content available?
  if (DEFAULT_PAGES.has(normalized)) {
    // /commercial gated by nav.commercialEnabled flag
    if (normalized === '/commercial' && data.nav && data.nav.commercialEnabled === false) {
      return { kind: 'notfound', reason: 'commercial-disabled' };
    }
    const defaultPage = normalized === '/' ? 'landing' : normalized.slice(1);
    return { kind: 'default', defaultPage, data, page: normalized };
  }

  // 3) Custom nav extension without a registered override → coming-soon placeholder
  const isCustomLink = (data.nav?.additional || []).some(item => item.href === normalized) ||
                        Object.values(data.nav?.sublinkExtensions || {}).flat().some(s => s.href === normalized);
  if (isCustomLink) {
    return { kind: 'placeholder', data, page: normalized };
  }

  return { kind: 'notfound' };
}

module.exports = {
  listFranchises,
  getFranchise,
  resolvePage,
  DEFAULT_PAGES
};
