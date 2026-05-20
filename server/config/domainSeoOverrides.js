/**
 * Per-domain SEO overrides.
 *
 * The 4 per-location domains all proxy the same Austin franchise content,
 * so without per-domain tuning Google would treat them as duplicate-content
 * variants of wavemax.promo and pick exactly one to surface. To rank
 * independently for different query intents, each domain ships a distinct
 * title, description, keyword set, H1, lead paragraph, FAQ subset, and
 * LocalBusiness schema entity — and self-canonicals.
 *
 * Targeting:
 *   - rundberglaundry.com  →  "wavemax austin" branded queries
 *   - atxwashdryfold.com   →  "wash dry fold austin" service queries
 *   - atxwashateria.com    →  "austin washateria / laundromat" generic queries
 *   - runberglaundry.com   →  "rundberg laundry" hyper-local queries
 *
 * Differentiation levers (in order of dedup-impact, per research):
 *   1. Title + meta description (highest)
 *   2. H1 + opening 150 words (Google fingerprints lead paragraph)
 *   3. FAQ subset selection
 *   4. Schema.org name / alternateName / description
 *
 * Keep keys lowercase. www.foo.com matches foo.com via the stripWww helper.
 */

// Shared FAQ pool — every Q&A is hyperlocal, factual, and answers a real
// People-Also-Ask query for North Austin laundromat intent. Each domain
// picks a curated 6-question subset emphasizing its target intent. AI
// Overviews (Google SGE, Perplexity, ChatGPT Search) heavily cite FAQPage
// schema in 2026 even though FAQ rich-result snippets were deprecated.
const FAQ_POOL = {
  wdf_cost: {
    q: 'How much does wash and fold cost per pound in Austin?',
    a: 'WaveMAX Austin charges $1.20 per pound for wash-dry-fold drop-off with a 10-pound minimum. We use hospital-grade UV-sanitized water and eco-friendly hypoallergenic detergent. Pickup and delivery is available within our service area.'
  },
  wdf_turnaround: {
    q: 'How long does wash, dry, and fold service take in Austin?',
    a: 'Standard wash-dry-fold turnaround at WaveMAX Austin is 24 hours. Same-day service is available for orders dropped off before 10 AM, depending on volume. Commercial accounts get priority scheduling.'
  },
  hours_247: {
    q: 'Are you open 24 hours? When can I do laundry in North Austin?',
    a: 'WaveMAX Austin at 825 E Rundberg Ln is open every day from 7 AM to 10 PM, 365 days a year. The last wash starts at 9 PM. We are fully attended every shift — no after-hours unsupervised access.'
  },
  payment_methods: {
    q: 'What payment methods do you accept?',
    a: 'WaveMAX Austin accepts all major credit and debit cards, plus Venmo, PayPal, and CashApp for wash-dry-fold orders. The self-service machines are card-payment only — no coins required, no cash needed.'
  },
  pickup_delivery: {
    q: 'Do you offer laundry pickup and delivery in North Austin?',
    a: 'Yes — WaveMAX Austin offers free pickup and delivery within a defined service area covering North Austin, Round Rock, Cedar Park, Pflugerville, Georgetown, and Leander. The minimum order is 20 pounds for delivery service.'
  },
  oversized_items: {
    q: 'Can you wash comforters, rugs, and oversized items?',
    a: 'Yes. Our Electrolux CompassPro 450G washers handle up to 80 pounds per load — large enough for king comforters, area rugs, sleeping bags, and oversized bedding. Wash-dry-fold pricing applies by weight.'
  },
  commercial_accounts: {
    q: 'Do you handle commercial laundry for businesses?',
    a: 'WaveMAX Austin runs recurring commercial laundry accounts from $0.95 per pound for restaurants, gyms, salons, Airbnb hosts, medical offices, and small hospitality. Volume pricing and same-day pickup are available — call (512) 553-1674 for a quote.'
  },
  self_serve_pricing: {
    q: 'How much does self-service laundry cost at WaveMAX Austin?',
    a: 'Self-service wash cycles at WaveMAX Austin run $2.75 to $10.50 depending on machine capacity (up to 80 pounds). Dry cycles match the same range. We have 42 Electrolux washers and 42 high-velocity dryers — almost always a machine open.'
  },
  service_area: {
    q: 'What neighborhoods do you serve from 825 E Rundberg Ln?',
    a: 'WaveMAX Austin serves all of North Austin including Georgian Acres, North Lamar, Wooten, Crestview, and Highland, plus surrounding cities Round Rock, Cedar Park, Pflugerville, Georgetown, and Leander for pickup-and-delivery service.'
  },
  uv_water: {
    q: 'What is "hospital-grade UV-sanitized water" and why does it matter?',
    a: 'Our Omni LUX UV-C sanitization system treats every gallon of wash water with germicidal ultraviolet light before it enters the machine. It kills bacteria, viruses, and mold in the water supply — the same sanitization standard used by hospitals and medical laundries.'
  },
  detergent: {
    q: 'What detergent do you use? Do you offer free-and-clear options?',
    a: 'WaveMAX Austin uses an eco-friendly hypoallergenic detergent on every wash-dry-fold order at no extra charge. Free-and-clear (no dyes, no perfumes) is available for sensitive-skin customers — just note the request when dropping off.'
  },
  rundberg_address: {
    q: 'Where is WaveMAX Laundry Austin located on Rundberg Lane?',
    a: 'WaveMAX Laundry Austin is at 825 E Rundberg Ln F1, Austin TX 78753, in the same shopping plaza as Walmart and the H-E-B on Rundberg. Free parking on-site. Look for the bright blue WaveMAX signage facing Rundberg Lane.'
  }
};

const OVERRIDES = {
  // ── rundberglaundry.com — primary target: "wavemax austin" ────────
  'rundberglaundry.com': {
    // Which page the apex (/) actually serves. Nginx rewrites apex on each
    // domain to a slug page; the controller compares against this to decide
    // whether to apply the override (since req.path no longer says "/").
    landingPath: '/',
    title: 'WaveMAX Austin Laundromat at Rundberg | Self-Service & Wash-Dry-Fold',
    description: 'WaveMAX Austin\'s Rundberg location — North Austin\'s premier laundromat. Self-service & wash-dry-fold drop-off. 825 E Rundberg Ln. Open daily 7am–10pm.',
    h1: 'WaveMAX Austin — Rundberg\'s Laundromat',
    keywords: 'wavemax austin, wavemax laundry austin, wavemax austin rundberg, north austin laundromat, rundberg laundromat, austin laundromat, wash dry fold austin, self service laundry austin',
    ogImageHint: 'hero-1.jpg',
    schemaName: 'WaveMAX Laundry Austin',
    schemaAlternateName: 'WaveMAX Austin · Rundberg',
    schemaDescription: 'WaveMAX Laundry Austin at Rundberg — North Austin\'s premier self-service and wash-dry-fold laundromat. 42 Electrolux 80lb washers, hospital-grade UV-sanitized water, fully attended every shift.',
    leadParagraph: 'WaveMAX Laundry Austin is North Austin\'s premier laundromat, located at 825 E Rundberg Lane in the heart of the Rundberg corridor. We operate the largest fleet of commercial-grade Electrolux washers in Central Austin — 42 machines up to 80 pounds — paired with Omni LUX UV-sanitized water and a fully attended staff. Walk in for self-service, drop off for wash-dry-fold at $1.20/lb, or schedule pickup and delivery anywhere in North Austin. Open 7 days a week, 7am to 10pm, 365 days a year.',
    faqKeys: ['rundberg_address', 'hours_247', 'wdf_cost', 'self_serve_pricing', 'service_area', 'uv_water']
  },

  // ── atxwashdryfold.com — primary target: "wash dry fold austin" ──
  'atxwashdryfold.com': {
    // Apex deep-links to /austin-tx/wash-dry-fold/ via nginx rewrite.
    landingPath: '/wash-dry-fold',
    title: 'Wash-Dry-Fold Austin | Drop-Off Laundry $1.20/lb | ATX Wash Dry Fold',
    description: 'Austin\'s best wash-dry-fold drop-off laundry service. Drop off, we wash, dry, and fold. $1.20/lb. Hospital-grade UV-sanitized water. Open daily 7am–10pm.',
    h1: 'Austin\'s Wash-Dry-Fold Drop-Off Laundry',
    keywords: 'wash dry fold austin, austin wash dry fold, drop off laundry austin, atx wash dry fold, fluff and fold austin, laundry service austin, wash and fold austin, drop off wash dry fold austin, same day wash and fold austin, wash and fold pickup and delivery austin',
    ogImageHint: 'hero-2.jpg',
    schemaName: 'ATX Wash Dry Fold',
    schemaAlternateName: 'Austin Wash-Dry-Fold by WaveMAX',
    schemaDescription: 'Austin\'s premier wash-dry-fold drop-off laundry service. $1.20/lb, 10-lb minimum, 24-hour turnaround. Hospital-grade UV-sanitized water, eco-friendly hypoallergenic detergent.',
    leadParagraph: 'ATX Wash Dry Fold by WaveMAX Austin is Austin\'s top-rated drop-off laundry service. We wash, dry, and fold your clothes for $1.20 per pound — no contracts, no subscriptions, no hidden fees. Drop off any time between 7am and 10pm, daily, at 825 E Rundberg Lane in North Austin. Standard turnaround is 24 hours; same-day available for orders placed by 10am. Free pickup and delivery across North Austin, Round Rock, Cedar Park, Pflugerville, Georgetown, and Leander. Hospital-grade UV-sanitized water and hypoallergenic detergent on every order.',
    faqKeys: ['wdf_cost', 'wdf_turnaround', 'pickup_delivery', 'oversized_items', 'detergent', 'commercial_accounts']
  },

  // ── atxwashateria.com — primary target: "austin washateria" ──────
  'atxwashateria.com': {
    landingPath: '/',
    title: 'ATX Washateria | Modern Austin Laundromat | WaveMAX Austin',
    description: 'ATX Washateria — Austin\'s modern laundromat. Self-service, wash-dry-fold, commercial. 42 Electrolux washers, hospital-grade UV water. Open daily 7am–10pm.',
    h1: 'ATX Washateria — North Austin\'s Modern Laundromat',
    keywords: 'atx washateria, austin washateria, austin laundromat, north austin laundromat, self service laundromat austin, wavemax austin, washateria near me, washateria austin tx, 24 hour laundromat near me, fully attended laundromat austin',
    ogImageHint: 'hero-1.jpg',
    schemaName: 'ATX Washateria',
    schemaAlternateName: 'WaveMAX Austin Washateria',
    schemaDescription: 'ATX Washateria — Austin\'s modern self-service laundromat with 42 Electrolux CompassPro 450G washers, hospital-grade UV-sanitized water, free WiFi, free parking, and fully attended service.',
    leadParagraph: 'ATX Washateria is Austin\'s modern laundromat — the way a washateria should be in 2026. 42 Electrolux CompassPro 450G washers, 42 high-velocity dryers, hospital-grade UV-sanitized water, free WiFi, free parking, and a fully attended staff on every shift. No coins, no card kiosks, no nonsense — pay your way at the door. We are open every single day from 7am to 10pm at 825 E Rundberg Lane in North Austin, the largest, cleanest, and fastest washateria the city has. Wash-dry-fold, self-service, and commercial laundry, all under one roof.',
    faqKeys: ['hours_247', 'self_serve_pricing', 'payment_methods', 'uv_water', 'rundberg_address', 'service_area']
  },

  // ── runberglaundry.com — primary target: "rundberg laundry" ──────
  'runberglaundry.com': {
    landingPath: '/',
    title: 'Rundberg Laundry | North Austin Laundromat at Rundberg Lane | WaveMAX',
    description: 'Rundberg Laundry by WaveMAX — North Austin\'s premier laundromat at 825 E Rundberg Ln. Self-service, wash-dry-fold, commercial. Open daily 7am–10pm.',
    h1: 'Rundberg Laundry — North Austin\'s Premier Laundromat',
    keywords: 'rundberg laundry, rundberg laundromat, north austin laundromat, rundberg lane laundry, austin laundromat near rundberg, wavemax rundberg, laundry rundberg, laundromat rundberg lane, 78753 laundromat, georgian acres laundromat',
    ogImageHint: 'hero-3.jpg',
    schemaName: 'Rundberg Laundry',
    schemaAlternateName: 'WaveMAX Laundry at Rundberg',
    schemaDescription: 'Rundberg Laundry — North Austin\'s neighborhood laundromat at 825 E Rundberg Lane. Self-service, wash-dry-fold, and commercial laundry. Family-owned, fully attended.',
    leadParagraph: 'Rundberg Laundry is the neighborhood laundromat at 825 E Rundberg Ln in North Austin — the same friendly, family-owned WaveMAX Laundry Austin location that Rundberg-area residents have relied on for self-service and wash-dry-fold service since 2025. We serve the 78753 ZIP code and surrounding neighborhoods including Georgian Acres, North Lamar, Wooten, and Crestview from a single bright, attended storefront. Walk in for self-service on any of our 42 commercial Electrolux washers, or drop off your laundry for our $1.20-per-pound wash-dry-fold service. Hospital-grade UV-sanitized water on every cycle.',
    faqKeys: ['rundberg_address', 'service_area', 'hours_247', 'wdf_cost', 'self_serve_pricing', 'oversized_items']
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

/**
 * Resolve a domain's FAQ entries from its faqKeys list (or a default set
 * if the host isn't in the override map). Returns an array of {q,a} pairs
 * ready to render as a FAQPage @graph node.
 */
function getFaq(hostname) {
  const ov = getOverride(hostname);
  const keys = (ov && ov.faqKeys) || ['wdf_cost', 'hours_247', 'self_serve_pricing', 'pickup_delivery', 'rundberg_address', 'uv_water'];
  return keys.map((k) => FAQ_POOL[k]).filter(Boolean);
}

module.exports = {
  OVERRIDES,
  ALL_HOSTS,
  FAQ_POOL,
  stripWww,
  getOverride,
  getSameAs,
  getFaq,
  isManagedHost
};
