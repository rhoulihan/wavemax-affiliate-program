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

- ✅ **Live Google Places reviews per store.** 5-star reviews fetched directly via the Places API (New) using each store's `place_id`. Each franchise landing page displays its actual customer reviews. Server-side calls explicitly set the Referer header so the production API key's referer restriction (wavemax.promo) accepts them — without it, Places returned `API_KEY_HTTP_REFERRER_BLOCKED` and reviews silently rendered empty.

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
- ✅ **Extreme-SEO sweep across all 10 corporate pages (2026-05-05).** Brought every page (`/franchise/`, `/about/`, `/testimonials/`, `/why-invest-in-wavemax/`, `/wavemax-vs-zombiemat/`, `/virtual-tour/`, `/become-a-franchisee/`, `/faq/`, `/contact/`, `/laundromat-investment-guide/`) up to the `franchise-host.html` gold-standard pattern: full Jacksonville HQ geo signals (`geo.region`/`geo.placename`/`geo.position`/`ICBM`), `og:type="business.business"` + `og:locale:alternate` for es_MX/pt_BR/de_DE + `business:contact_data:*` block + `place:location:lat/lng`, complete Twitter card (was missing on `about`), 5-entry hreflang block (en-US/es/pt/de/x-default with `?lang=` URL params), full favicon set (32/192/180/270 + `theme-color` + `msapplication-TileImage`), upgraded robots directive (`max-snippet:-1, max-video-preview:-1`), keywords + author + revisit-after meta, plus site-wide `Organization` and `WebSite`+`SearchAction` JSON-LD on every page (38 valid JSON-LD blocks total across 10 pages). `corporate-i18n.js` updated to honor `?lang=` URL param so hreflang alternates resolve to actually-translated content on first load. `about.html` was the largest delta (was missing keywords/Twitter/geo/all JSON-LD).
- ✅ **Per-franchise SEO already shipped via `FranchisePage.buildSeo()`** — generates per-franchise meta + OG + Twitter + LocalBusiness schema + breadcrumb schema + alternate-language hreflangs from each store's registry data; runs on every franchise page render.
- ✅ **Lighthouse SEO 100/100 on `/franchise/` and `/about/` (2026-05-06).** Closed the only failing audit (`link-text` flagging the chrome's "Learn More" link as non-descriptive) by appending an `.wm-sr-only` span to each Learn More link carrying "about becoming a WaveMAX franchisee" — visible label stays "Learn More" but crawlers + screen readers see the full descriptive text. Lighthouse reads `textContent`, not `aria-label`, so the descriptive text must live in the DOM.
- ✅ **Lighthouse Accessibility fixes (2026-05-06).** Closed the three weighted-failure audits flagged on `/about/`: (1) `[aria-*] attributes match roles` — added `role="combobox"` + `aria-haspopup="listbox"` + `aria-label="Language selector"` to every `.wm-lang-switcher` wrapper (4 spots: corporate-chrome.js × 2 instances, franchise-host.html × 2 instances) so the `aria-expanded` state attribute is valid for the element's role; (2) `color-contrast` — bumped chrome b2 nav links (`#wmlnav-nav > a` and `.wmlnav-drop > a`) from `rgba(255,255,255,.85)` to `#ffffff` over the `#1e72ba` background (was 3.79:1 — failed AA; now 4.59:1 — passes); (3) `heading-order` — corporate footer column headings changed from `<h4>` to `<h3>` (CSS selector and JS template both updated) so the page's heading hierarchy is sequentially-descending (h1 → h2 → h3, no skip). **Follow-up contrast fixes:** active-nav state (`#wmlnav-nav > a.wmlnav-on` and `.wmlnav-drop.wmlnav-on > a`) background flipped from `rgba(255,255,255,.15)` (effective 3.57:1 — failed) to `rgba(0,0,0,.20)` (effective 6.25:1 — passes); base `.wm-fr-eyebrow` color on white-background sections darkened from `#f5a623` (1.93:1 — failed) to `#a05a00` (5.4:1 — passes), preserving brand-amber on dark-bg overrides (`.wm-fr-cta-strip`, `.wm-fr-qual`, `.wm-fr-invest`, `.wm-fr-hero`).
- ✅ **Site-independence sweep (2026-05-06) — full image self-hosting.** Removed every runtime dependency on `wavemaxlaundry.com`. The site now runs fully independent at runtime; the only remaining tie to the corporate site is **build-time** scraping for LOCATION_DATA refreshes, fully isolated to `scripts/franchise-build/`.

  **Abstraction layers + endpoint configurations (designed for easy CDN / origin swap):**

  - **`public/assets/js/wm-image-config.js`** — single-source-of-truth for per-franchise image URLs. Exposes `window.WM_LOCATION_IMAGE_BASE` (currently `/assets/images/locations`), `wmLocationImage(path)` helper, and a declarative `data-wm-location-image="..."` HTML resolver. **To repoint at a CDN later (e.g. `https://cdn.wavemax.promo/locations` or an S3 origin), change exactly ONE line.** Every consumer — 7 init scripts (`austin-{about,commercial,contact,landing,self-serve,wdf}-init.js`, `corporate-hero-backdrop.js`) plus any future page using the helper — picks up the change. `<script src="/assets/js/wm-image-config.js">` is loaded on 18 host pages, config-first in document order.

  - **`scripts/franchise-build/`** — the build-time data dependency boundary. Contains the scraper (`fetch-corporate-data.js`, `fetch-emails.js`, `fetch-place-ids.js`, `fetch-street-view.js`, `fetch-landmarks.js`, `probe-images.js`) that pulls from `wavemaxlaundry.com` plus the new `mirror-location-images.js` that downloads every per-franchise photo URL referenced in `public/data/franchises/*.json` into `public/assets/images/locations/{slug}/`. Output: `public/data/franchises*.json` and `public/assets/images/locations/` — both consumed by the runtime site, both rebuildable from any future authoritative source. **Migration plan documented in `scripts/franchise-build/README.md`**: replace the `fetch-*.js` scripts with one that reads from the new source (matching `build-registry.js`'s expected schema), repoint `mirror-location-images.js`'s URL pattern (one regex change), re-run the refresh workflow. Runtime code unaffected.

  - **`server.js` CSP `img-src`** — pruned `https://www.wavemaxlaundry.com` and `https://wavemaxlaundry.com` from the allowlist now that no images load from those origins. (`frame-ancestors` and CORS allowlist retain wavemaxlaundry.com because the WordPress parent at that domain still embeds wavemax.promo iframes — that's the corporate-site embedding US, not a dependency on it.)

  **What was actually changed in this sweep:**

  - **Brand assets mirrored to `/public/assets/images/brand/`**: 4 favicons (32/180/192/270) + WaveMAX logo. 69 references across 19 HTML files repointed from `wavemaxlaundry.com/wp-content/uploads/2026/03/...` to local `/assets/images/brand/...`. JSON-LD `"logo"` properties use absolute `https://wavemax.promo/assets/images/brand/logo-wavemax.png` (Schema.org requires absolute).
  - **All 437 per-franchise photos mirrored** to `/public/assets/images/locations/{slug}/{file}` (~470 MB across 75 franchises) via `mirror-location-images.js`. Every reference in `public/data/franchises*.json` (75 files) and every inline `og:image` / `twitter:image` / `<img src>` / `<style>url(...)` reference in HTML repointed from `wavemaxlaundry.com/wp-content/uploads/locations/...` to `wavemax.promo/assets/images/locations/...`.
  - **External page links removed/replaced**: corporate-chrome.js footer "Full Location Map" link deleted (in-page locations modal covers it); franchise-host.html + austin-host-mock.html footer Privacy/Terms repointed to local `/privacy-policy.html` + `/terms-and-conditions.html`; test-operator-scan.html "Production Customer Login" host-swapped to `wavemax.promo`; server email template (`server/templates/v2/payment-request.html`) logo URL repointed.
  - **`<link rel="preconnect" href="https://wavemaxlaundry.com">`** removed from all HTML pages (no longer beneficial — nothing connects there at runtime).
  - **JSON-LD knowledge-graph references** to `wavemaxlaundry.com` retained where they describe brand entity relationships (`sameAs`, parent organization @id, breadcrumb home for the legacy site) — these are descriptive metadata for Google's knowledge graph, not navigation or asset loads.

  **Remaining wavemaxlaundry.com touch-points (intentional, documented):**

  - `scripts/franchise-build/` — build-time scraper (the LOCATION_DATA boundary).
  - `server.js` `frame-ancestors` + CORS allowlist — for the WordPress parent embedding wavemax.promo iframes.
  - `privacy-policy.html` contact emails (privacy@/dpo@wavemaxlaundry.com) — these are real corporate inboxes, not URLs.
  - JSON-LD knowledge-graph entity references — Google-facing metadata, not runtime resource loads.
  - Documentation files referencing the corporate URL as historical context.

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

- ✅ **`/franchise/`** — franchise opportunity overview, redesigned as a tab-control interface (Why · Numbers · Model · Equipment · Process · FAQ) replacing the long-scroll body. Hero with photo-card rotator (5 network images cycling at 3.5s) and randomized storefront backdrop on every load. Stats band (75+ / ~9 hrs / $471K / 5–7 yr). Why tab: 6 owner-benefit tiles + 3-cell trust strip + **live customer-review slider** pulling real 5-star Google reviews from `/api/v1/location/network-reviews` aggregated across operating WaveMAX franchises (each card deep-links to the source store) + "prideful ownership / not a passive franchise" framing. Numbers tab: full Item 19 disclosure table + Jacksonville cash-flow snapshot + FDD source disclaimer. Model tab: 4-up Right Site/Size/Service/Systems + 3-pillar location strategy + WaveMAX Solutions formula band (Right Location + Right Size + Right Equipment Mix = Maximum Profits). Equipment tab: 4-stat band (<45m / 450G / 80lb / UV) + Electrolux partnership benefits + Lux sanitization benefits + embedded Matterport 3D walkthrough iframe. Process tab: 6-step horizontal flow with HowTo JSON-LD. FAQ tab: 6-question accordion. Sticky tab bar + hash-deeplinking + keyboard nav + ARIA tabs. Full i18n (en/es/pt/de) on every visible string.
- ✅ **`/become-a-franchisee/`** — buying-process page (hero, Path Forward narrative, 4-card qualifications band, 6-step process timeline, investment breakdown, 6 support pillars, 6-question FAQ, closing CTA)
- ✅ **Shared corporate chrome** applied to both pages above
- ✅ **`/about/`** — founding story (2012, Jacksonville, AU Hydro LLC dba WaveMAX Laundry), Mike Roberts as Founder & CEO with the verifiable framing, Sheila as CFO (no surname per the public source), Brittany Horner as Franchise Development, mission statement quote, brand thesis, Awards & Recognition section (Entrepreneur Franchise 500 #485 in 2026, #1 Laundromat Franchise category 2026, #416 in 2024)
- ✅ **`/testimonials/`** — 4 verifiable franchisees (Stephanie Lewis / Caleb Allen / Phillip Kennedy / Sean Hansen) with attributed quotes from corporate's testimonials page. Includes credentials band ($471K avg gross / 2026 #1 laundromat ranking), per-franchisee Person + Review structured data, a **live network customer reviews section** that pulls 5-star Google reviews aggregated across the franchise network (each card tagged with the city/state and deep-linked to that store's landing page), and a callout listing verifiable Item 19 figures with cross-links to /why-invest-in-wavemax/. Designed to expand as additional cleared franchisees come online.
- ✅ **`/why-invest-in-wavemax/`** — Item 19 figures ($471,201 average gross / $436,114 median / $713,934 top performer from 50-store 2024 sample, per 2025 FDD), Jacksonville flagship cash-flow snapshot ($217,762 net cash flow / $113,074 net income with full equipment financing), 25–35% EBITDA, 5–7 year payback, ~9 hrs/wk owner involvement. Total investment range per FDD: $356,455 – $1,556,350. Six "why this category" tiles (recession-resistant demand, no inventory risk, cash-pay business, lean staffing, SBA-eligible financing, multi-unit pathway), Entrepreneur Franchise 500 validation cards (#485 in 2026, #1 Laundromat 2026, #416 in 2024), comprehensive Organization + BreadcrumbList JSON-LD structured data, FDD disclosure language, dual closing CTA to investment guide and qualification form.
- ✅ **`/wavemax-vs-zombiemat/`** — 10-point differentiation matrix (location / operational burden / equipment / marketing / customer experience / logistics / pricing / training / scaling / exit). Two-column intro band contrasting the legacy independent coin-laundry against the modern franchise model, full 10-row matrix table with mobile-responsive layout, bottom-line stats band ($471K avg / ~9hrs/wk / 5–7yr payback), Organization + BreadcrumbList JSON-LD, full OG/Twitter SEO, dual closing CTA (investment guide + qualification form).
- ✅ **`/virtual-tour/`** — Cross-network image gallery curated from corporate's three featured WaveMAX locations (Jacksonville flagship / Kent WA equipment showcase / Omaha store-tour). Brand-philosophy band (6 design-language tiles), featured-locations card row, 12-tile gallery with location attribution badges, equipment-spec callout band (<45min cycle / 450G extract / 80lb large-format / UV sanitization with the equipment-profile gating disclaimer), ImageGallery + BreadcrumbList JSON-LD with full image schema, full OG/Twitter SEO, dual closing CTA.
- ✅ **`/faq/`** — comprehensive franchise FAQ aggregating questions from /franchise/, /become-a-franchisee/, and corporate /faq-new/. Six grouped sections (Money · Process · Operations · Equipment · Growth & Exit · About WaveMAX) totalling 18 Q/A pairs with accordion expansion. Sticky category-anchor nav. Full FAQPage + BreadcrumbList JSON-LD. Routed at `/faq/` (top-level). i18n markers in place; full body translations to land alongside the next page-content i18n pass.
- ✅ **Corporate chrome unification** — corporate-content pages (`/franchise/`, `/about/`, `/testimonials/`, etc.) now render the same wmlnav-wrap chrome (b1 utility / b2 logo+CTAs / b3 nav) used by per-franchise host pages, picking up the same `wavemax-mhr-chrome.css` styling. Eliminates the two-different-chromes problem corporate's site has.
- ✅ **Per-franchise "Franchise" link** — repointed from `wavemaxlaundry.com/franchise` (target=_blank) to local `/franchise/` so per-store visitors stay on wavemax.promo during the test deploy.
- ✅ **Random storefront backdrop on every corporate hero** — shared `corporate-hero-backdrop.js` script picks a random storefront from a curated 8-image showcase pool (Jacksonville flagship / Kent WA / Omaha) at page load and applies it to `.wm-fr-hero`. `/virtual-tour/` opts out (uses interior shots intentionally).
- ✅ **Corporate i18n infrastructure** — `corporate-i18n.js` translation engine + `wm-lang-switcher` widget injected into b1, persists to localStorage, fetches `/locales/{lang}/corporate.json` per locale. Chrome (b1 award / b2 buttons / b3 nav / breadcrumb / footer) translates live across en/es/pt/de. Body content i18n keys defined for franchise.html in all four locales (chrome.* + franchise.* namespaces). Breadcrumb meta uses pipe-separated `key:label` pairs so segments translate alongside the rest.
- ✅ **Breadcrumb styling parity** — `.wm-bc-host` styles lifted from `austin-host-mock.css` into `corporate-chrome.css` so corporate and per-store breadcrumbs render identically (white band, navy text, amber separators).
- ✅ **Body-content i18n: `/faq/`** — every visible string in the body marked with `data-i18n` and translated to en/es/pt/de in the same commit. New `faqp.*` namespace (63 leaf keys) covers hero, six-link category nav (Money / Process / Operations / Equipment / Growth & Exit / About WaveMAX), six group heads + group sub-leads, 18 questions across the six groups, 18 answers (inline `<strong>`/`<a>` tags rewritten to plain prose since the i18n engine uses textContent), and closing CTA. Top-level key is `faqp` to avoid collision with the existing `faq` sub-blocks under `franchise/about/become`. Structurally identical across all four locales.
- ✅ **Body-content i18n shipped on all 7 corporate pages** — `/franchise/`, `/about/`, `/testimonials/`, `/why-invest-in-wavemax/`, `/wavemax-vs-zombiemat/`, `/virtual-tour/`, `/become-a-franchisee/`, `/faq/`. Every visible string marked with `data-i18n` and translated to en/es/pt/de. The lang switcher in the chrome (#wm-lang) now changes the entire page content live, persists via localStorage, and matches the four-language coverage already present on per-franchise pages.
- ✅ **Body-content i18n: `/become-a-franchisee/`** — every visible string in the body marked with `data-i18n` and translated to en/es/pt/de in the same commit. New `become.*` namespace (83 leaf keys) covers hero, three-paragraph "Path Forward" narrative, four-card qualifications band ($400K liquidity / $1M net worth / ~10 hrs/wk / coachable mindset), six-step process timeline (Initial Conversation → Discovery & FDD Review → Validation Calls → Discovery Day → Award & Site Selection → Build, Train & Launch), four-card investment breakdown (what's included / what's required / lender network / full pro forma), six-tile support pillars grid (Site Selection / Equipment & Build-Out / Training / Marketing / Operations Coaching / Owner Network), six-question FAQ accordion, and closing CTA. CTA repointed from external corporate apply URL to local `/laundromat-investment-guide/`. Structurally identical across all four locales.
- ✅ **Body-content i18n: `/virtual-tour/`** — every visible string in the body marked with `data-i18n` and translated to en/es/pt/de in the same commit. New `tour.*` namespace (66 leaf keys) covers hero, six brand-philosophy tiles (X-not-Y antithesis pattern), three featured-locations cards (Jacksonville flagship / Kent WA / Omaha), 12-tile cross-network gallery (4 location tags + 12 captions), 4-stat fleet specs band (<45min / 450G / 80lb / UV) plus equipment-profile gating disclaimer, and closing CTA. Structurally identical across all four locales.
- ✅ **Body-content i18n: `/wavemax-vs-zombiemat/`** — every visible string in the body marked with `data-i18n` and translated to en/es/pt/de in the same commit. New `vs.*` namespace (64 leaf keys) covers hero, two-column intro band (Zombiemat / WaveMAX cards), full 10-row comparison matrix (Dimension / Zombiemat (legacy) / WaveMAX (modern) per row), bottom-line stats band (3 stats + disclaimer), and closing CTA. Structurally identical across all four locales.
- ✅ **Mobile chrome on corporate pages** — `corporate-chrome.js` now also emits the `wmv3-header` (mobile-only) used by per-franchise host pages: 3-cell info strip (#1 Laundromat / 75+ Locations / Item 19), centered logo, action row (Learn More + Locations + burger), and slide-down `wmv3-drawer` with the full corporate nav. Burger toggles drawer; tapping a drawer link closes the drawer and navigates. CSS at <900px hides the desktop wmlnav-wrap and shows the wmv3-header — same breakpoint behavior as per-franchise pages.
- ✅ **Body-content i18n: `/why-invest-in-wavemax/`** — every visible string in the body marked with `data-i18n` and translated to en/es/pt/de in the same commit. New `whyInvest.*` namespace (61 leaf keys) covers hero, headline number band (4 stats), Item 19 disclosure table (3 statistics + source attribution), Jacksonville flagship cash-flow snapshot (2 cards + disclaimer), six structural-reasons category tiles (recession-resistant demand / no inventory risk / cash-pay business / lean staffing / SBA-eligible financing / multi-unit pathway), Entrepreneur Franchise 500 validation cards (4 ranked stats), and closing CTA. Structurally identical across all four locales.
- ✅ **Body-content i18n: `/testimonials/`** — every visible string in the body marked with `data-i18n` and translated to en/es/pt/de in the same commit. New `testimonials.*` namespace covers hero, credentials band (4 stats), four franchisee testimonial cards (Stephanie Lewis / Caleb Allen / Phillip Kennedy / Sean Hansen with quotes + role attribution), live customer reviews block (loading/error/attribution states), and verifiable-numbers callout (5-item list + dual CTA). 38 leaf keys per locale, structurally identical across all four.
- ✅ **Body-content i18n: `/about/`** — every visible string in the body marked with `data-i18n` and translated to en/es/pt/de in the same commit. New `about.*` namespace covers hero, founding facts band, founding narrative, founder mission quote, awards & recognition cards, leadership team bios (Mike Roberts / Sheila / Brittany Horner), values tiles (Cleaner / Safer / Faster / Brand integrity / Owner outcomes first / Operating discipline), and closing CTA. 58 leaf keys per locale, structurally identical across all four.
- ✅ **`/contact/`** — corporate HQ (929 McDuff Ave S, Suite 107, Jacksonville FL 32205) + general inquiry form. Sidebar has mailing address with Google Maps directions link, embedded map iframe, franchise development email (franchise@wavemax.com), general inquiries email (administrator@wavemax.promo), and office hours (M–F 9 AM – 5 PM ET). Form has topic selector (Franchise / Customer / Press / Vendor / General), name, email, phone (optional), message; AJAX-submits to `POST /api/v1/corporate-contact` which sends a notification email to administrator@wavemax.promo. Joi validation, rate-limited (contactFormBurstLimiter + contactFormLimiter). Organization + ContactPage + BreadcrumbList JSON-LD, full OG/Twitter SEO. en/es/pt/de translations across all 29 visible-string keys.
- ✅ **`/laundromat-investment-guide/` + lead capture** — split-hero with "What's inside" 5-bullet TOC on the left and a sticky lead-capture form card on the right (name / email / phone / market / timeline / liquid capital). AJAX-submits to `POST /api/v1/franchise-lead` which generates a cryptographic reference token, sends two emails (admin notification to administrator@wavemax.promo + visitor thank-you with token), and swaps the form to a thank-you state showing the token. Joi validation, rate-limited. 6-tile "What's inside" section + 4-cell trust strip + closing CTA. DigitalDocument + Organization + BreadcrumbList JSON-LD, full OG/Twitter SEO. en/es/pt/de translations across all 61 visible-string keys. PDF generation deferred — the visitor thank-you email currently sends a confirmation + link to /why-invest-in-wavemax/; Puppeteer-rendered personalized PDF with watermarking is the planned follow-up.
- ✅ **Corporate-content `Find a Location` modal** — extracted the per-franchise locations modal into a self-contained `corporate-locations-modal.js` and wired it into corporate-chrome.js (modal markup auto-injected after chrome). New `GET /api/v1/maps-config` endpoint exposes the browser-restricted Google Maps API key for client-side fetch (referer-locked, safe to surface). Modal opens in-page on `[data-action="open-locations"]` clicks instead of redirecting to wavemaxlaundry.com/locations/. CSS reuses `wavemax-mhr-modal.css`.

---

## 6. Lead Capture and Conversion (new)

- ✅ **Lead-capture form on `/laundromat-investment-guide/`** — full name, email, phone, market interest, timeline, liquid capital range. Validates client-side then POSTs JSON to `/api/v1/franchise-lead`. On success, swaps to a thank-you state showing the reference token returned by the server.
- ✅ **`/api/v1/franchise-lead` endpoint** — express-validator schema (firstName/lastName/email/phone required, market optional, timeline + capital required from a fixed enum). Rate-limited (contactFormBurstLimiter + contactFormLimiter). Generates a 6-byte base64url reference token and returns it to the client. Backed by `corporateInquiryService.sendFranchiseLead` which sends the two-email pair (admin + visitor). Companion `/api/v1/corporate-contact` endpoint built with the same pattern for the general /contact/ form.
- ☐ **Personalized PDF generation** — 8–12 page V3-branded Investment Guide rendered from HTML template via Puppeteer; per-download personalization (cover page "Prepared exclusively for {Name}", footer "Reference: {token}")
- ☐ **Unique download token per submission** — short cryptographic token stamped into the PDF for download tracking
- ✅ **Two-email delivery** — visitor receives a thank-you note with reference token + Why Invest deep-link (PDF attachment is deferred to follow-up); `administrator@wavemax.promo` receives full lead notification (name, email, phone, market, timeline, capital, token, source page, timestamp). Sent via existing `emailService` (Mailcow SMTP).
- ✅ **Unique download token per submission** — short cryptographic token (`crypto.randomBytes(6).toString('base64url')`) generated on the server and surfaced both in the admin email and on the thank-you state. Once Puppeteer PDF generation lands, the same token will be stamped into the PDF footer.
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

## 9. crhsent sales page (crhsent.com/wavemax) — comparison-claim governance

- ✅ "Proof you can verify" accuracy audit (2026-05-24) — every comparison claim re-checked against live public data (curl, headless Chrome Lighthouse, Google PSI API, dig/whois). Corrected drift: our own page weight 1.76 → 0.98 MB (WebP + deferred-pixel work landed since the claim), competitor Charlotte 3.40 → 2.90 MB, Franchise 2.19 → 2.35 MB, franchise page 28 → 41 scripts / 23 → 21 stylesheets, MHR HTML 429 → 437 KB; removed an overstated "1 redirect on every page" row (canonical page has 0); re-attributed the FCP/LCP rows to Chrome Lighthouse (DevTools) rather than mislabeling them as Google PSI.
- ✅ Verified accurate, left unchanged — CORS reflects-any-origin-with-credentials (confirmed on `wavemaxlaundry.com/wp-json/`), all security headers (CSP/HSTS/frame-ancestors/X-Content-Type/Referrer/Permissions), hosting/IPs (GoDaddy secureserver.net vs OCI), TTFB ~0.2 s vs ~0.8 s, console errors 0 vs 1, home-page weight 66 vs 203 KB, Google PSI scores (MHR 82 desktop / 59 mobile).
- 📌 Standing rule — a verifiable claim is only true at the moment measured; re-audit the full comparison on a cadence (both sites drift, and our own optimizations move our numbers). Byte counts + A11y/BP/SEO scores are tool-independent; Performance score + FCP/LCP/SI are throttling-dependent, so local Lighthouse ≠ Google PSI — keep each number attributed to the tool that reproduces it.

---

## Tracking

This file is updated as items ship. Source: `docs/CORPORATE-REBUILD-CHECKLIST.md` in the wavemax-affiliate-program repo. Live status verifiable against `wavemax.promo`.
