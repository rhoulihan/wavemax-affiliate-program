# WaveMAX Corporate Site Rebuild — Scope & Status

**Status as of:** 2026-05-05
**Domain:** wavemax.promo
**Legal entity:** AU Hydro LLC dba WaveMAX Laundry
**Scope:** Rebuild of the corporate web presence and per-franchise infrastructure as a parallel implementation to the existing wavemaxlaundry.com site.

---

## Summary

The rebuild covers the corporate-level marketing pages, all 75 franchise location pages, a per-franchise data registry, Google Maps integration, live Google Places reviews, and a lead-capture pipeline. Items below are organized into:

1. Data fidelity and accuracy
2. Privacy and PII handling
3. Architecture and infrastructure
4. Per-franchise content
5. Corporate content
6. Lead capture
7. Operational tooling
8. Deferred items

Legend: **✅ shipped** · **🔧 in progress** · **☐ queued**

---

## 1. Data Fidelity and Accuracy

### Per-store equipment claims

- ✅ **Equipment claims standardized across stores in the legacy templates.** All 75 franchise pages on the legacy site display the same equipment claims (e.g., "42 Electrolux CompassPro 450G washers, 80-lb capacity, hospital-grade Omni LUX UV-sanitized water"). Some stores do not have this equipment configuration. The rebuild introduces an equipment-profile system: a catalog of equipment configurations, per-franchise profile assignment, and conditional rendering. Stores not explicitly verified to have premium equipment fall to a default profile that makes brand-level claims only (Electrolux fleet, 18–80 lb capacity range, ~45 min full load) and suppresses UV / 450G / 80-lb / Omni LUX claims.

- ✅ **Pricing references standardized to Austin's pricing in the legacy templates.** "$1.20/lb / 10-lb minimum" (WDF), "$2.75–$10.50" (self-serve), "From $0.95/lb" (commercial) appeared on every franchise's pages. The rebuild data-binds all pricing displays to a per-franchise pricing block. Stores without published pricing render "Call for pricing" / "Call for a quote." Where corporate's site publishes per-store rates, those are scraped into the registry and flow through.

- ✅ **City and address references hardcoded to Austin in the legacy templates.** "Austin", "North Austin", "Rundberg Lane", "Austin, TX 78753" appeared in hero subtitles, KPI labels, FAQ content, contact form heading, about-us stats labels, breadcrumb, and Open Graph meta description across all franchise pages. The rebuild parameterizes city / state / address references via `{{contact.city}}` / `{{contact.state}}` placeholders and `data-bind="contact.address"` attributes; values resolve at render time from the per-franchise registry. Applied across English, Spanish, Portuguese, and German translations.

### Customer reviews

- ✅ **Identical customer testimonials on every store page in the legacy templates.** The same three testimonials ("Jessica M.", "Tony R.", "Amanda L.") and the same 4.8★ rating appear across all franchise pages on the legacy site. The rebuild replaces these with live Google Places API reviews fetched per-franchise via the store's own `place_id`. Verified Google Place IDs were auto-fetched for 70 of 75 stores.

### Geographic coordinates

- ✅ **Lat/lng coordinates were city centroids, not store addresses.** Errors ranged from 0.5 mi to 6.4 mi (Thornton CO). On the locations modal map, pins did not align with the actual buildings. The rebuild re-geocoded all 75 stores via the Google Places API and replaced centroids with verified business locations. Average shift: ~1.4 miles per store.

### Per-store imagery

- ✅ **Stores without probed images fell back to a single placeholder (Kent, WA).** On the legacy site, 74 of 75 stores cycled Kent's photos in their rotators. The rebuild ran an image probe across the corporate CDN per slug; when actual store photos exist they are used, otherwise the rotator hides instead of displaying another store's photos.

- ✅ **No city-level imagery on franchise pages.** The legacy hero rotators showed only generic store interiors. The rebuild fetches 4–5 city-level landmark photos per franchise from Wikipedia / Wikimedia Commons (filtered to exclude flags, maps, heraldry); 73 of 75 cities populated. Rotator interleaves at a 2:1 cadence (two store interiors, one landmark).

---

## 2. Privacy and PII Handling

- ✅ **Owner email addresses present in the rendered HTML.** The legacy site embeds franchisee emails inside JSON-LD blocks with HTML-entity encoding (e.g., `&#x6a;&#111;&#x68;&#x6e;...`). The encoding is reversible by trivial string transformation. The rebuild scrapes these addresses, uses them server-side for routing the contact-form to the right inbox, but strips them from the rendered HTML and the client-side data payload via `sanitizeForClient()`. View-source, browser dev tools, and the LOCATION_DATA blob no longer contain owner emails for any of the 75 stores.

- ✅ **Contact form delivery routed to a single franchise.** The legacy iframe's contact form had `SLUG = 'austin-tx'` hardcoded as a constant; every franchise's "Send a message" form submitted to `/api/v1/contact/austin-tx`, delivering notifications to one inbox regardless of source. The rebuild reads `window.parent.FRANCHISE_SLUG` per request so each store's form delivers to that store's recipient.

---

## 3. Architecture and Infrastructure

- ✅ **Per-franchise data registry (75 JSON files).** Each franchise has a per-store JSON file (`public/data/franchises/<slug>.json`) containing brand, contact (address / phone / geo / maps URLs), hours, pricing (WDF / self-serve / commercial), equipment profile, amenities, hero / interior / landmark images, owner names, Google Place ID, SEO metadata, and i18n availability. A central `franchises.json` index lists all franchises for the locations modal. mtime-based caching means updates flow through without process restarts.

- ✅ **Dynamic per-franchise routing.** `/{slug}/`, `/{slug}/wash-dry-fold/`, `/{slug}/self-serve-laundry/`, `/{slug}/commercial/`, `/{slug}/about-us/`, `/{slug}/contact/` all resolve through a single Express controller that loads the per-franchise registry, enriches with equipment profile data, sanitizes PII, and injects data into the host page template.

- ✅ **Equipment profile system.** Catalog of standardized equipment configurations (currently `electrolux-mixed-fleet-default` and `electrolux-450g-80lb-premium`); each franchise references a profile id. Server-side resolver merges profile metrics (cycle time, spin G, capacity, UV system, marketing claims) into the franchise's data before injection. Client-side `applyEquipment()` helper conditionally renders premium-only content based on which profile applies. New profiles can be added to the catalog as additional store configurations are verified.

- ✅ **Locations modal — Google Maps.** Tile list + interactive Google Maps view (dark navy theme), custom franchise pin, click-to-zoom-and-info-window per store, search-by-city / state / zip filter, scroll-snap card list. Auto-centers on the active franchise on open.

- ✅ **Live Google Places reviews per store.** 5-star reviews fetched directly via the Places API (New) using each store's `place_id`. Each franchise landing page displays its actual customer reviews.

- ✅ **Network-wide live customer reviews aggregator.** New `networkReviewsService` samples 18 franchise Place IDs per refresh, calls the cached `googleReviewsService` for each, filters to 5-star, tags each review with the source franchise's city / state / brand / URL, and serves an aggregated rotating sample of up to 24 customer reviews via `GET /api/v1/location/network-reviews`. 6-hour aggregator cache + per-place 24h cache means the Places API is hit infrequently. Used on `/testimonials/` to render a live customer-side credibility layer alongside the franchisee owner quotes. Each card surfaces the actual customer's name, the city/state of the store they reviewed, and a deep-link to that franchise's landing page.

- ✅ **Owner-email scraping pipeline.** Scrapes and decodes the HTML-entity-encoded emails on each corporate franchise page. Populates the registry's `contact.email` field for server-side delivery routing.

- ✅ **Corporate-data scraping pipeline.** Per-store hours, WDF rate, self-serve range, owner name, neighborhood, and social handles scraped from a JSON literal embedded on each corporate page (brace-matching parser handles HTML-entity contamination in the JSON). Populated 74 of 75 stores' registry entries.

- ✅ **Geocoding pipeline.** Re-geocodes all 75 stores via Places API; populates verified lat/lng plus Google Maps directions URLs and Google Maps embed URLs into the registry.

- ✅ **Landmark image pipeline.** Fetches city-level landmark photos from Wikipedia / Wikimedia Commons; filters out flags, heraldry, maps, SVG icons; ranks by filename relevance; picks top 4–5 per city.

- ✅ **Place ID pipeline.** Auto-fetches Google Places `place_id` for each franchise via Places API text search. Populated 70 of 75 stores; reviews integration uses these IDs.

- ✅ **PII-safe data injection.** Server-side `sanitizeForClient()` strips owner emails (and any future PII fields) from the data object before it's serialized into the rendered HTML. Server-side delivery routing reads from the un-sanitized registry directly.

- ✅ **Corporate-content chrome.** Single source of truth for header (logo + Franchise dropdown + About + Contact + Find a Location CTA) and footer (3-column links + copyright + privacy / terms) across corporate-content pages. Active-link highlighting, mobile drawer, dropdown / drawer interactions. Adding a new corporate page requires only editing the nav config in `corporate-chrome.js`.

- ✅ **i18n parameterization.** All four supported languages (en / es / pt / de) carry city placeholder substitution in equipment-aware copy, hero subtitles, contact titles, about-us stats, breadcrumb labels, and commercial subnav.

### SEO foundations

- ✅ **Detailed SEO across corporate-content pages.** Every corporate page (`/franchise/`, `/become-a-franchisee/`, `/about/`, `/testimonials/` — and all subsequent ones) ships with: keyword-targeted `<title>`, meta description, meta keywords, canonical URL, robots directives, full Open Graph block (type, title, description, url, image, image:width/height/alt, site_name, locale), Twitter card (summary_large_image with image:alt), geo metadata, theme-color, schema.org JSON-LD structured data appropriate to the page type (Organization / Person / Review / BreadcrumbList / LocalBusiness / FAQPage), and complete heading hierarchy.
- ✅ **Per-franchise SEO already shipped via `FranchisePage.buildSeo()`** — generates per-franchise meta + OG + Twitter + LocalBusiness schema + breadcrumb schema + alternate-language hreflangs from each store's registry data; runs on every franchise page render.

- ✅ **Locations modal click handler resilient to third-party DOM rewrites.** The Hibu dynamic-phone-insertion script replaces innerHTML on subtrees containing the local phone number, which orphans event handlers attached at the element level. The rebuild uses event delegation on `document` so click handlers survive subtree rewrites.

- ✅ **Footer "All Locations" button switched from external redirect to in-page modal.** Previously linked to `wavemaxlaundry.com/locations/`, removing visitors from the site flow. Now opens the in-page locations modal.

---

## 4. Per-Franchise Content (75 stores)

For each of 75 franchises, the following pages are parameterized so that every per-store value is data-driven from the registry:

- ✅ **Landing (`/<slug>/`)** — hero, KPI stat rail (5 tiles), services tabs (WDF / self-serve / commercial summary), reviews block, contact CTA strip
- ✅ **Wash-Dry-Fold (`/<slug>/wash-dry-fold/`)** — hero, KPI rail, pricing display, "what's included" list, how-it-works timeline, why-WaveMAX tile grid, who-it's-for personas, sanitization deep-dive (gated to UV-equipped stores), FAQ
- ✅ **Self-Serve (`/<slug>/self-serve-laundry/`)** — hero, KPI rail, pricing range, includes list, machines walkthrough, sanitization deep-dive (gated), FAQ
- ✅ **Commercial (`/<slug>/commercial/`)** — hero, KPI rail (turnaround / capacity / UV / contracts / days), volume pricing, includes list, why-tile grid, segment tabs (medical / gym / Airbnb / restaurant / contractors), FAQ
- ✅ **About-us (`/<slug>/about-us/`)** — hero, owner team grid, mission / values cards, community section, KPI rail, CTA strip — Austin-specific narrative flows through `aboutContent` override; non-Austin stores fall to generic copy
- ✅ **Contact (`/<slug>/contact/`)** — hero title with city, info card (address / hours / phone), Google Map iframe (per-franchise embed URL), tile grid, send-a-message form (server-routed per slug)

### Premium-claim conditional rendering

- ✅ Hospital-grade UV / Omni LUX UV claims gated on `equipment.hasUVSanitization`
- ✅ 450G / High-Spin claims gated on `equipment.marketingClaims.highSpin`
- ✅ "<45min full load" stat tile gated on `equipment.marketingClaims.fast`
- ✅ "80-lb capacity" claims gated on `equipment.capacityLb` being non-null
- ✅ Equipment-counted claims (e.g., "42 commercial Electrolux machines") use `data-bind="equipment.washers"` so non-audited stores hide those tiles
- ✅ LUX deep-dive section + tab on WDF and self-serve gated on `hasUVSanitization`
- ✅ Pricing displays use `data-bind` to per-franchise pricing or to "Call for pricing" / "Call for a quote" defaults

### Stream C — Detail-tile reformatting (queued)

- ☐ Reformat commercial page tab content (medical / gym / Airbnb / restaurant / contractors) into V3 tile arrays + accordions
- ☐ Audit WDF + self-serve detail tile copy for similar reformatting
- ☐ Audit landing page services tabs

---

## 5. Corporate Content (non-franchise pages)

Each rebuilt page is hand-authored V3-styled HTML, ~30KB each, mirroring the content arc of its corporate-site equivalent. All pages use the shared corporate-chrome (header + footer).

- ✅ **`/franchise/`** — franchise opportunity overview (hero, stat band, 6 why-owners-love tiles, 4-up Secret Sauce grid, sanitation split, 3 investment-detail cards, 6-question FAQ, closing CTA)
- ✅ **`/become-a-franchisee/`** — buying-process page (hero, Path Forward narrative, 4-card qualifications band, 6-step process timeline, investment breakdown, 6 support pillars, 6-question FAQ, closing CTA)
- ✅ **Shared corporate chrome** applied to both pages above
- ✅ **`/about/`** — founding story (2012, Jacksonville, AU Hydro LLC dba WaveMAX Laundry), Mike Roberts as Founder & CEO with the verifiable framing, Sheila as CFO (no surname per the public source), Brittany Horner as Franchise Development, mission statement quote, brand thesis, Awards & Recognition section (Entrepreneur Franchise 500 #485 in 2026, #1 Laundromat Franchise category 2026, #416 in 2024)
- ✅ **`/testimonials/`** — 4 verifiable franchisees (Stephanie Lewis / Caleb Allen / Phillip Kennedy / Sean Hansen) with attributed quotes from corporate's testimonials page. Includes credentials band ($471K avg gross / 2026 #1 laundromat ranking), per-franchisee Person + Review structured data, a **live network customer reviews section** that pulls 5-star Google reviews aggregated across the franchise network (each card tagged with the city/state and deep-linked to that store's landing page), and a callout listing verifiable Item 19 figures with cross-links to /why-invest-in-wavemax/. Designed to expand as additional cleared franchisees come online.
- ☐ **`/why-invest-in-wavemax/`** — Item 19 figures ($471,201 avg gross from 50-store 2024 sample, per 2025 FDD), Jacksonville flagship cash-flow snapshot ($217K net cash flow / $113K net income), 25–35% EBITDA, 5–7 year payback. Total investment range per FDD: $356,455 – $1,556,350 (2025 FDD); typical builds $1M–$1.5M.
- ☐ **`/wavemax-vs-zombiemat/`** — 10-point differentiation matrix (location / operational burden / equipment / marketing / customer experience / logistics / pricing / training / scaling / exit)
- ☐ **`/virtual-tour/`** — Austin store image gallery + brand philosophy narrative
- ☐ **`/faq/`** — comprehensive franchise FAQ aggregating questions from /franchise/, /become-a-franchisee/, and corporate /faq-new/
- ☐ **`/contact/`** — corporate HQ (929 McDuff Ave S, Suite 107, Jacksonville FL 32205), general inquiry form, phone number (TBD)

---

## 6. Lead Capture and Conversion (new)

- ☐ **Lead-capture form on `/laundromat-investment-guide/`** — full name, email, phone, market interest, timeline, liquid capital range
- ☐ **`/api/v1/franchise-lead` endpoint** — Joi validation, CSRF, rate limiting
- ☐ **Personalized PDF generation** — 8–12 page V3-branded Investment Guide rendered from HTML template via Puppeteer; per-download personalization (cover page "Prepared exclusively for {Name}", footer "Reference: {token}")
- ☐ **Unique download token per submission** — short cryptographic token stamped into the PDF for download tracking
- ☐ **Two-email delivery** — visitor receives thank-you note with PDF attached; `administrator@wavemax.promo` receives full lead notification (name, email, phone, market, timeline, capital, token, source page, timestamp)
- ☐ **PDF content** — distilled from corporate's investment guide, Item 19 figures, Roberts mission quote, 6-step process, lender network info

---

## 7. Operational Tooling

Every dataset that drives the site is regenerable from scripts:

- ✅ `scripts/franchise-build/probe-images.js` — HEAD-checks corporate CDN for hero / interior / owner images per slug
- ✅ `scripts/franchise-build/build-registry.js` — generates per-franchise JSON files plus index from raw locations + image probes + known-overrides
- ✅ `scripts/franchise-build/regeocode-locations.js` — re-geocodes all stores via Places API
- ✅ `scripts/franchise-build/fetch-emails.js` — scrapes owner emails from corporate JSON-LD
- ✅ `scripts/franchise-build/fetch-corporate-data.js` — scrapes per-store hours / pricing / owner / neighborhood / social
- ✅ `scripts/franchise-build/fetch-landmarks.js` — fetches city-level landmark photos from Wikipedia
- ✅ `scripts/franchise-build/fetch-place-ids.js` — auto-fetches Google Place IDs for the reviews integration
- ✅ `scripts/franchise-build/equipment-profiles.json` + `known-overrides.json` — hand-edited override layer for verified per-store specs
- ✅ Hot-reload in production — registry mtime-based caching; updates flow through without process restarts
- ✅ Deploy automation — git pull on the production server picks up registry changes; PM2 reload required for server-code or template changes (in-memory template caching)

---

## 8. Deferred Items

- ☐ Per-franchise email mailbox provisioning on Mailcow (config change, not code)
- ☐ Roberts cleared bio expansion — public sources are too generic for a detailed profile
- ✅ Awards / rankings verified and integrated — Entrepreneur Franchise 500 #485 (2026), #1 Laundromat Franchise (2026), #416 (2024). Sources: franchisechatter.com, entrepreneur.com, franzy.com.
- ☐ Year-by-year unit growth chart — no public source data available; would require internal MHR records
- ☐ Multi-language (es / pt / de) for new corporate pages — per-franchise pages cover all 4 languages; corporate pages currently English-only

---

## Tracking

This file is updated as items ship. Source: `docs/CORPORATE-REBUILD-CHECKLIST.md` in the wavemax-affiliate-program repo. Live status verifiable against `wavemax.promo`.
