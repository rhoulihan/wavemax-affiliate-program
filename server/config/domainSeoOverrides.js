/**
 * Per-domain SEO overrides.
 *
 * The 4 per-location domains all proxy the same Austin franchise content,
 * so without per-domain tuning Google would treat them as duplicate-content
 * variants of wavemax.promo and pick exactly one to surface. To rank
 * independently for different query intents, each domain ships a distinct
 * title, description, keyword set, H1, and LocalBusiness schema entity —
 * and self-canonicals (no longer points back at wavemax.promo).
 *
 * Targeting:
 *   - rundberglaundry.com  →  "wavemax austin" queries
 *   - atxwashdryfold.com   →  "wash dry fold austin" queries
 *   - atxwashateria.com    →  "austin washateria / laundromat" queries
 *   - runberglaundry.com   →  "rundberg laundry" queries
 *
 * The franchise controller calls getOverride(req.hostname); if a match is
 * found it merges the override into the rendered SEO. wavemax.promo and
 * any unmapped host fall through to the default austin-tx.json + page-
 * level SEO computed by buildPageSeo() in franchiseController.
 *
 * Keep keys lowercase. www.foo.com matches foo.com via the stripWww helper.
 */

const OVERRIDES = {
  // ── rundberglaundry.com — primary target: "wavemax austin" ────────
  'rundberglaundry.com': {
    title: 'WaveMAX Austin Laundromat at Rundberg | Self-Service & Wash-Dry-Fold',
    description: 'WaveMAX Austin\'s Rundberg location — North Austin\'s premier laundromat. Self-service & wash-dry-fold drop-off. 825 E Rundberg Ln. Open daily 7am–10pm.',
    h1: 'WaveMAX Austin — Rundberg\'s Laundromat',
    keywords: 'wavemax austin, wavemax laundry austin, wavemax austin rundberg, north austin laundromat, rundberg laundromat, austin laundromat, wash dry fold austin, self service laundry austin',
    ogImageHint: 'hero-1.jpg',
    schemaName: 'WaveMAX Laundry Austin',
    schemaAlternateName: 'WaveMAX Austin · Rundberg',
    schemaDescription: 'WaveMAX Laundry Austin at Rundberg — North Austin\'s premier self-service and wash-dry-fold laundromat. 42 Electrolux 80lb washers, hospital-grade UV-sanitized water, fully attended every shift.'
  },

  // ── atxwashdryfold.com — primary target: "wash dry fold austin" ──
  'atxwashdryfold.com': {
    title: 'Wash-Dry-Fold Austin | Drop-Off Laundry $1.20/lb | ATX Wash Dry Fold',
    description: 'Austin\'s best wash-dry-fold drop-off laundry service. Drop off, we wash, dry, and fold. $1.20/lb. Hospital-grade UV-sanitized water. Open daily 7am–10pm.',
    h1: 'Austin\'s Wash-Dry-Fold Drop-Off Laundry',
    keywords: 'wash dry fold austin, austin wash dry fold, drop off laundry austin, atx wash dry fold, fluff and fold austin, laundry service austin, wash and fold austin, drop off wash dry fold austin',
    ogImageHint: 'hero-2.jpg',
    schemaName: 'ATX Wash Dry Fold',
    schemaAlternateName: 'Austin Wash-Dry-Fold by WaveMAX',
    schemaDescription: 'Austin\'s premier wash-dry-fold drop-off laundry service. $1.20/lb, 10-lb minimum, 24-hour turnaround. Hospital-grade UV-sanitized water, eco-friendly hypoallergenic detergent.'
  },

  // ── atxwashateria.com — primary target: "austin washateria" ──────
  'atxwashateria.com': {
    title: 'ATX Washateria | Modern Austin Laundromat | WaveMAX Austin',
    description: 'ATX Washateria — Austin\'s modern laundromat. Self-service, wash-dry-fold, commercial. 42 Electrolux washers, hospital-grade UV water. Open daily 7am–10pm.',
    h1: 'ATX Washateria — North Austin\'s Modern Laundromat',
    keywords: 'atx washateria, austin washateria, austin laundromat, north austin laundromat, self service laundromat austin, wavemax austin, washateria near me, washateria austin tx',
    ogImageHint: 'hero-1.jpg',
    schemaName: 'ATX Washateria',
    schemaAlternateName: 'WaveMAX Austin Washateria',
    schemaDescription: 'ATX Washateria — Austin\'s modern self-service laundromat with 42 Electrolux CompassPro 450G washers, hospital-grade UV-sanitized water, free WiFi, free parking, and fully attended service.'
  },

  // ── runberglaundry.com — primary target: "rundberg laundry" ──────
  // Note: also captures the common rundberg-vs-runberg typo.
  'runberglaundry.com': {
    title: 'Rundberg Laundry | North Austin Laundromat at Rundberg Lane | WaveMAX',
    description: 'Rundberg Laundry by WaveMAX — North Austin\'s premier laundromat at 825 E Rundberg Ln. Self-service, wash-dry-fold, commercial. Open daily 7am–10pm.',
    h1: 'Rundberg Laundry — North Austin\'s Premier Laundromat',
    keywords: 'rundberg laundry, rundberg laundromat, north austin laundromat, rundberg lane laundry, austin laundromat near rundberg, wavemax rundberg, laundry rundberg, laundromat rundberg lane',
    ogImageHint: 'hero-3.jpg',
    schemaName: 'Rundberg Laundry',
    schemaAlternateName: 'WaveMAX Laundry at Rundberg',
    schemaDescription: 'Rundberg Laundry — North Austin\'s neighborhood laundromat at 825 E Rundberg Lane. Self-service, wash-dry-fold, and commercial laundry. Family-owned, fully attended.'
  }
};

const ALL_HOSTS = Object.keys(OVERRIDES);

function stripWww(hostname) {
  if (!hostname) return '';
  return hostname.toLowerCase().replace(/^www\./, '');
}

function getOverride(hostname) {
  return OVERRIDES[stripWww(hostname)] || null;
}

/**
 * For a given host, return the cross-domain sameAs array used in JSON-LD:
 * the other registered hosts. Cross-linking helps Google understand the
 * domains share an entity without flagging duplicate content.
 */
function getSameAs(hostname) {
  const self = stripWww(hostname);
  return ALL_HOSTS.filter((h) => h !== self).map((h) => `https://${h}/`);
}

function isManagedHost(hostname) {
  return ALL_HOSTS.includes(stripWww(hostname));
}

module.exports = {
  OVERRIDES,
  ALL_HOSTS,
  stripWww,
  getOverride,
  getSameAs,
  isManagedHost
};
