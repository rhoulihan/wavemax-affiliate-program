# Austin Subsite Reference Build — Implementation Plan

**Date:** 2026-05-03 (open questions resolved 2026-05-03)
**Author:** Rick Houlihan (with Claude)
**Status:** **APPROVED.** Open questions §12.1–12.5 resolved (see §12). Ready to start Phase 0.

**Resolution summary (2026-05-03):**
- Reviews: live Google Places API, server-side fetch, filter to 5-star, TOS-compliant attribution. (See §6.5.)
- Affiliate program: **out of scope** — defer until Phase 2 refactor completes.
- Contact form: Option (b) — `POST /api/v1/contact/austin-tx` to a new server endpoint.
- Demo route: live but **unlisted** (`<meta name="robots" content="noindex,nofollow">`, no nav entry, no sitemap).

**Direction additions (2026-05-03 follow-up):**
- **Strict TDD throughout** — red → green → refactor on every server change. Failing test first; no code lands without a test that would have caught the regression. (Project default per `CLAUDE.md` — reinforced here because this build is the showcase.)
- **Faithfully recreate the parent page**, not a generic mock — the host page is a high-fidelity reproduction of MHR's actual current Austin template (header, breadcrumbs, footer, location-finder modal, fonts, colors, spacing) with our improvements applied. MHR should see exactly how their page would look done right. (See §2 row H and §6.7.)
- **Austin-local theming layer** — beyond the corporate WaveMAX brand tokens, the build incorporates Austin-specific imagery and identity: neighborhood references (North Austin / Rundberg), Austin skyline / Hill Country accents in hero photography, locally-tuned copy. This is the "shine" layer. (See new §6.6.)
- **Local dev deployment is part of the definition of done** — every page must run on `localhost:3000` and be verified end-to-end with Playwright + Chrome DevTools MCP at every phase gate. (See §11.)

### Binding workflow guidelines (apply to every change in this build)

These are the global + project rules, restated here so they're visible and not subject to drift mid-build:

1. **Plan-mode-default for non-trivial steps.** Anything 3+ steps or with architectural decisions gets a plan first; pivot only after a re-plan, never silently.
2. **TDD, no exceptions.** Red → green → refactor. Confirm a test fails for the right reason before writing implementation. No production code without a regression-protecting test.
3. **Verification before done.** A task is not complete until I've proven it works against the real system — `npm test` clean, page loads in browser via Playwright/Chrome DevTools MCP, no console errors, every interactive control exercised. "Looks right" is not done.
4. **Subagents liberally.** Independent investigations / parallel page builds / scoped audits run as subagents to keep main context clean.
5. **Sound elegance over cleverness.** Before writing code, ask "is there a simpler way?" If the answer is yes, do that.
6. **Simplicity first.** Make every change as small as possible to achieve the goal. No premature abstractions, no speculative flexibility.
7. **Admit uncertainty.** Say "I'm not sure" rather than guessing — and check before guessing.
8. **No file > 800 lines, no controller > 500 lines.** One concern per module. Split by domain.
9. **`logger`, never `console.*`** in `server/`. ESLint blocks it.
10. **i18n parity at all times** — en / es / pt / de move together; English fallback never masks missing production copy.
11. **No hardcoded secrets, no hardcoded business values.** Secrets via `process.env.*`. Business values via `SystemConfig.getValue(key, default)`.
12. **CSP-clean.** No inline `<script>` without nonce, no inline styles outside theme tokens.
13. **Auto-commit logical units.** Each completed sub-task commits + pushes with a descriptive message. Destructive git ops still confirm.
14. **One concern per PR, ≤500-line diffs** — split if a single change grows past this.
15. **Move-then-delete, not rewrite-in-place** — old file becomes a shim until next sprint, never an instant rewrite that breaks consumers.
16. **Self-improvement loop** — every correction from Rick gets a line in `tasks/lessons.md` so we don't repeat it.
17. **No fallbacks for impossible cases.** Trust internal callers; validate at system boundaries only.
18. **No comments except for non-obvious "why"** — well-named identifiers carry the "what."

---

## 1. Goals

Build a complete, polished, production-quality reference of every Austin subsite page as iframe-embedded one-page apps, plus a sample MHR-style host page that demonstrates how the parent-iframe bridge should work end-to-end. Deliverables will be deployed in our app so we can show MHR working code, not just a checklist.

**Success bar:** every page loads on the host page with no broken links, no `href="#"`, working forms, working language switching across en/es/pt/de, working bridge-driven SEO injection, single source of truth for all location data, page-resize working, and the visual style reads as a continuous part of MHR's brand (their tokens, refined typography hierarchy, our UX/UI discipline).

---

## 2. Page inventory (9 iframe pages + 1 host page)

| # | Page | Source | Status | Pattern |
|---|---|---|---|---|
| 1 | `/` Landing (Austin home) | NEW `austin-landing-v3-embed.html` | Build new | Hero · stats · services grid · "why us" · live 5★ Google reviews · contact strip |
| 2 | `/wash-dry-fold/` | UPDATE `wash-dry-fold-embed.html` | Refresh | Hero · stats · tabs (How it works / UV / Pricing+FAQ / Why us) — already exists, polish |
| 3 | `/self-serve-laundry/` | UPDATE `self-serve-laundry-embed.html` | Refresh | Hero · stats · tabs (Features / Sanitization / Amenities / Pricing) — already exists, polish |
| 4 | `/commercial/` | NEW `commercial-embed.html` | Build new | Hero · industries grid (Airbnb / Medical / Health Clubs / Hospitality / Salon-Spa) · pricing model · contact CTA |
| 5 | `/commercial/airbnb-rentals/` | NEW `commercial-airbnb-embed.html` | Build new | Hero · turnaround timeline · pricing · case-study card |
| 6 | `/commercial/medical-offices/` | NEW `commercial-medical-embed.html` | Build new | Hero · sanitization detail · compliance card · contact form |
| 7 | `/commercial/health-clubs/` | NEW `commercial-health-clubs-embed.html` | Build new | Hero · towel-program flow · capacity card |
| 8 | `/about-us/` | NEW `about-us-embed.html` | Build new | Hero · neighborhood/owner card · MAX advantage · live 5★ Google reviews (server-fetched, properly attributed) |
| 9 | `/contact/` | NEW `contact-embed.html` | Build new | Hero · embedded Maps (correct address) · hours table · clickable phone/email/directions · `Send a message` form posting to `POST /api/v1/contact/austin-tx` |
| H | Host page (sample MHR parent) | NEW `dev/austin-host-mock.html` | Build new | Header · breadcrumbs · iframe slot · footer — wires bridge + single data source · `<meta name="robots" content="noindex,nofollow">` |

**Out of scope for this build:** `/affiliate-program/` — deferred until Phase 2 refactor completes. Existing `affiliate-landing-embed.html` is not touched and not exposed in the host page nav.

All 9 iframe pages will use the same component vocabulary (hero, stat-row, tab-block, card-grid, CTA-strip) so they read as one product.

---

## 3. Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│  HOST PAGE (austin-host-mock.html)                                        │
│  ─ single LOCATION_DATA object (one source of truth)                      │
│  ─ chrome (header, nav, breadcrumbs, footer) reads ONLY from LOCATION_DATA│
│  ─ language switcher (en/es/pt/de) — pure data-i18n, no Google Translate │
│  ─ <script src="parent-iframe-bridge-v3.js"></script>                     │
│  ─ <iframe id="wavemax-iframe" src="https://wavemax.promo/embed-app-v2... │
└─────────────────────────────────┬────────────────────────────────────────┘
                                  │ PostMessage protocol
                                  │
                  ┌───────────────┼───────────────────────────────┐
                  │ parent → iframe                                │
                  │  • parent-ready                                │
                  │  • current-language { lang }                   │
                  │  • language-change   { lang }                  │
                  │  • location-data    { ...LOCATION_DATA }   NEW │
                  │                                                │
                  │ iframe → parent                                │
                  │  • iframe-ready  { page, timestamp }           │
                  │  • request-language                            │
                  │  • request-location-data                   NEW │
                  │  • resize { height }                           │
                  │  • seo-data { meta, og, twitter, jsonld, alt } │
                  │  • navigate { href }                       NEW │
                  └────────────────┬───────────────────────────────┘
                                   │
┌──────────────────────────────────▼───────────────────────────────────────┐
│  IFRAME PAGE (e.g. wash-dry-fold-embed.html)                              │
│  ─ iframe-bridge-v2.js (light extension for new message types)            │
│  ─ Receives LOCATION_DATA → fills any "address / phone / hours / owner"   │
│    placeholders in the iframe content from the SAME source as the chrome  │
│  ─ Sends seo-data on load → bridge injects meta/OG/Twitter/JSON-LD on top │
│  ─ Sends resize on every content change                                   │
│  ─ Sends navigate {href} when user clicks a top-level nav link inside it  │
└──────────────────────────────────────────────────────────────────────────┘
```

The key new contract: **`location-data` is broadcast once on `iframe-ready` and re-broadcast if the host data changes.** Both chrome and iframe content render from the same object, eliminating drift between hero phone, footer phone, modal phone, JSON-LD phone, body-copy phone, etc.

---

## 4. Single-data-source design

```javascript
// Defined ONCE at the top of austin-host-mock.html
window.LOCATION_DATA = {
  slug: "austin-tx",
  brand: { name: "WaveMAX Laundry Austin", parent: "WaveMAX Laundry" },

  contact: {
    phone:        "(512) 553-1674",
    phoneTel:     "+15125531674",
    email:        "john@austinwavemax.com",
    address:      "825 E Rundberg Ln F1",
    city:         "Austin",
    state:        "TX",
    zip:          "78753",
    country:      "US",
    geo:          { lat: 30.3564789, lng: -97.6858016 },
    mapsUrl:      "https://www.google.com/maps/dir/?api=1&destination=825+E+Rundberg+Ln+F1+Austin+TX+78753",
    placeId:      ""   // populated when franchisee provides
  },

  hours: {
    open:  "07:00",
    close: "22:00",
    display: "7am – 10pm",
    lastWash: "9pm",
    days:  "Every day, 365 days a year"
  },

  owner: {
    name: "Colin Houlihan",
    bio:  "...",
    neighborhood: "North Austin"
  },

  pricing: {
    wdf:      { rate: 1.20, minLb: 10, currency: "USD", display: "$1.20/lb" },
    selfServe:{ minLoad: 2.50, maxLoad: 4.00 }
  },

  equipment: { washers: 20, dryers: 20, capacityLb: 80 },

  amenities: ["Free WiFi", "UV Sanitization", "Touchless Payment", "Free Parking", "Wheelchair Accessible"],

  social: { facebook: "", instagram: "" },

  google: {
    placeId: "",                    // populated in Phase 0 via Find Place From Text
    profileUrl: "",                 // canonical Google Business Profile URL
    reviewsUrl: ""                  // direct link to "all reviews" page
  },

  // Reviews are NOT inlined here — fetched live by /api/v1/location/austin-tx/reviews
  // (see §6.5). Schema reference only:
  // reviews: [{ author, rating, text, relativeTime, photoUrl, googleProfileUrl }]

  i18n: {
    languagesAvailable: ["en", "es", "pt", "de"]   // host advertises full set on iframe pages
  }
};
```

Every chrome element on the host page reads from this object via a tiny `mount()` helper that fills `data-bind="contact.phone"` / `data-bind="hours.display"` slots. The iframe receives the same object and binds the same way. **No second copy. No `LOCATIONS` array. No `var locations`.** Future: replace the inline object with `fetch('/api/v1/location/austin-tx')` to a single REST endpoint without changing any consumers.

---

## 5. Theme system — MHR-aligned

I extracted MHR's actual current tokens from the live site (CSS vars present today). The reference build uses these exact tokens so the iframe content reads as continuous with MHR's chrome:

```css
/* Tokens — sourced from MHR's live site, re-organized */
--wm-primary:        #1e72ba;   /* royal blue (their primary) */
--wm-secondary:      #27aae1;   /* sky cyan (their secondary) */
--wm-accent:         #29b6d4;   /* electric cyan (CTA accent) */
--wm-navy:           #1e3a5f;   /* navy (hero bg) */
--wm-navy-deep:      #0f2035;   /* navy-deep (footer bg) */
--wm-navy-mid:       #254876;
--wm-text:           #143852;
--wm-text-soft:      #3a4a5c;
--wm-bg:             #ffffff;
--wm-bg-soft:        #f7fafc;
--wm-border:         #e2e8f0;
--wm-success:        #16a34a;
--wm-warning:        #f5a623;
--wm-danger:         #ef4444;

--wm-font-heading: 'Barlow Condensed', system-ui, sans-serif;
--wm-font-body:    'Poppins', system-ui, sans-serif;

--wm-radius-sm: 6px;
--wm-radius:    10px;
--wm-radius-lg: 16px;
--wm-shadow-sm: 0 1px 2px rgba(15,32,53,.08);
--wm-shadow:    0 4px 12px rgba(15,32,53,.10);
--wm-shadow-lg: 0 12px 32px rgba(15,32,53,.18);
```

A single shared CSS file at `public/assets/css/wavemax-theme.css` defines the tokens + a small set of components (hero, stat-row, card, tab-strip, button, form-field, breadcrumb, footer-strip). All ten iframe pages and the host page consume from this one file. No per-page color forks.

---

## 6. i18n strategy

- **One translation dictionary per page**, namespaced by page id, in `public/locales/{en,es,pt,de}/common.json` (extending the existing structure — keys: `austin.landing.*`, `austin.wdf.*`, `austin.selfServe.*`, `austin.commercial.*`, `austin.about.*`, `austin.contact.*`, plus `austin.chrome.*` for header/breadcrumb/footer/switcher).
- **Switcher control on host page** writes to `localStorage['wavemax-language']` and dispatches `languageChanged` — bridge picks it up and broadcasts to iframe.
- **Iframe receives `language-change`** → re-renders all `data-i18n` elements + `data-i18n-attr` attributes via the existing `iframe-bridge-v2.js` `translatePage()` (already implemented, just needs new dictionaries).
- **Bridge-fed parent chrome translations for pt/de.** Per checklist §C3: the host page only ships en/es chrome strings; iframe sends `chrome-translations` { pt: {...}, de: {...} } on load, bridge merges into host's i18n dictionary. Switcher hides pt/de when no iframe is present (non-iframe pages — n/a for our reference build but honored by the protocol).
- **Translations cover all 4 languages from day one** for our 10 pages — no English-only fallbacks for production keys.

---

## 6.5. Google Reviews integration

### Architecture

```
about-us-embed.html (or landing)
   │ on load
   ▼
GET https://wavemax.promo/api/v1/location/austin-tx/reviews?minRating=5&limit=5
   │
   ▼
locationController.getReviews()
   ├── check 24-hour cache (key: `reviews:austin-tx:5star`)
   │   └── hit → return cached payload
   ├── googleReviewsService.fetchPlaceReviews(placeId)
   │   └── Google Places API (New) — Place Details with `reviews` field
   │       (https://places.googleapis.com/v1/places/{placeId}?fields=reviews,rating,userRatingCount)
   ├── filter reviews by rating ≥ minRating
   ├── shape per-review: { author, rating, text, relativeTime, photoUrl, googleProfileUrl }
   ├── append section-level metadata: { totalReviewsAtSource, averageRatingAtSource, attributionHref, lastFetchedAt }
   ├── cache + return
   ▼
client renders the reviews block with TOS-compliant attribution
```

### Why server-side, not client

- API key never reaches the browser
- 24-hour server cache stays inside Google's caching policy and shields us from rate limits regardless of client volume
- One filtering implementation (server) instead of every page reimplementing it
- Trivial to swap to a different review source later without changing client code

### TOS compliance — what we do, what we don't

**Required by Google's Places API ToS** (and what we will do):
- Display reviewer's name and profile photo as returned by the API
- Display each review's star rating unmodified
- Display each review's text unmodified
- Show the date or relative time of the review
- Attribute the source: each card carries a "Reviews from Google" / "View on Google" affordance
- Provide a clear path to view all reviews on the franchisee's Google profile (via `google.reviewsUrl`)
- Section heading transparently labels the filter: **"Five-star reviews from Google"** — not "Customer Reviews," not "Google Reviews," not anything that implies the displayed set is a complete or representative sample

**Explicitly NOT doing** — these are the things that violate Google's policies and that the prior MHR template was doing:
- Inventing reviewer names
- Re-attributing real reviews to fictional bylines (the U3 defect)
- Hiding the filter or pretending we're showing all reviews
- Modifying review text
- Caching past Google's allowed window (24h is safe)

### Failure modes

| Condition | Behavior |
|---|---|
| API key missing or invalid | Return `{ reviews: [], reason: "config" }`; client shows "View customer reviews on Google →" link only, no fabricated cards |
| Place not found | Same as above |
| API timeout / 5xx from Google | Serve last-known-good cached payload (stale-while-revalidate); if no cache, same fallback as above |
| Zero 5★ reviews after filter | Section auto-hides on the page; replaced by "View all customer reviews on Google →" link to `google.reviewsUrl` |
| Fewer than `limit` 5★ reviews | Show what we have — no padding, no fabrication |

### Endpoint contract

```
GET /api/v1/location/:slug/reviews
  ?minRating=5    (optional, default: 1, valid: 1-5)
  &limit=5        (optional, default: 5, max: 5 — Google API ceiling)

200 OK
{
  "success": true,
  "data": {
    "source": "google",
    "placeId": "ChIJ...",
    "totalReviewsAtSource": 187,
    "averageRatingAtSource": 4.8,
    "attributionHref": "https://www.google.com/maps/place/?q=place_id:ChIJ...",
    "lastFetchedAt": "2026-05-03T18:42:11Z",
    "reviews": [
      {
        "author": "Taneisha T.",
        "rating": 5,
        "text": "Alex was absolutely amazing...",
        "relativeTime": "3 weeks ago",
        "publishTime": "2026-04-12T14:30:22Z",
        "photoUrl": "https://lh3.googleusercontent.com/...",
        "googleProfileUrl": "https://www.google.com/maps/contrib/..."
      }
    ]
  }
}
```

### Configuration

Env vars (added to `.env.example`):
```
GOOGLE_PLACES_API_KEY=         # server-side key, restricted to Places API + our server IPs
```

Place ID lookup is a one-time Phase 0 task — call Find Place From Text with `"WaveMAX Laundry Austin 825 E Rundberg"` and persist the resulting `placeId` to `LOCATION_DATA.google.placeId`.

---

## 6.6. Austin-local theming layer

The corporate WaveMAX tokens (§5) cover the brand surface. On top of that, every page in this build carries Austin-specific identity so it doesn't read as a generic franchise template repainted with a name swap. The local layer is what makes a Round Rock customer recognize this is *their* WaveMAX, not a stock page.

**Austin identity sources we'll incorporate:**

- **Neighborhood pin:** North Austin / Rundberg corridor — surface in landing copy ("Your North Austin laundromat"), about-us neighborhood card, and breadcrumb subtitle.
- **Hero photography palette:** Austin skyline at golden hour for the landing hero alternate; Hill Country / Lady Bird Lake greenery for the about-us hero; the actual store interior (`sua1.jpg`–`sua4.jpg` already in the repo's image references) on service pages. Photography choices are sequenced so adjacent pages don't reuse the same image.
- **Local-color accent stripe:** a single accent stripe (Texas burnt-orange `#bf5700` *no* — too UT-specific; we use a heat-of-the-sun `#f5a623` already in the MHR palette as `--wm-warning`) in narrow doses (CTA underlines, stat-card top-stripes, breadcrumb separator) so the page reads as warmer than a pure cool-blue corporate site.
- **Service-area chips:** a row of "We serve" chips on landing + commercial pages — Austin · Round Rock · Cedar Park · Pflugerville · Georgetown · Leander — driven from `LOCATION_DATA.serviceArea`.
- **Local-business voice:** copy is first-person plural and specific. "We open at 7am — earlier than anywhere else on Rundberg" instead of "Convenient hours." "We've been the busiest WaveMAX in Texas three years running" if/when the franchisee confirms a stat we can stand behind.
- **Owner spotlight:** about-us page has a small owner card (name, neighborhood, single sentence) — humanizes the franchise vs. the chain.
- **Locally-translated content:** Austin's high Spanish-language population means `es` content is not an afterthought — proper TX-localized Spanish, not Castilian, with copy reviewed for natural readability.
- **Map embed centered on the actual store**, with the store photo as a custom map marker (not a generic red pin).

**What we're NOT doing:**
- No kitsch (no longhorns, no boots, no "Howdy"). The brand stays modern and professional; the local layer is restraint, not theme-park.
- No Austin keywords stuffed for SEO — they should land naturally in the copy or not at all.
- No fake-localized claims ("Voted Best Laundromat in Austin 2025" without the actual award). Honest, specific, verifiable.

**Files affected:** the local layer is a thin overlay on top of the shared theme — it lives in `wavemax-theme.css` (color/typographic accents), `wavemax-components.css` (chip / stripe / owner-card components), per-page hero images, and the page-specific i18n dictionaries (`austin.*` keys). No structural change to the architecture.

---

## 6.7. Faithful parent-page recreation

The host page is no longer a thin mock — it's a high-fidelity reproduction of MHR's actual current Austin template. The point: when MHR opens the demo URL, they should be looking at *their* page, with the things they ship today, plus our fixes applied. Side-by-side, they see the exact same chrome they authored, but every defect from the three checklists is gone, every link works, the data is consistent, and the iframe-embedded content reads as continuous brand.

**What "faithful" means in scope:**

- **Persistent header**: their `wmv3-header` stripe stack (logo + info row + actions row), built from the same components but reading from `LOCATION_DATA` instead of `var d`. One `Call` CTA, not two (U2 fix). Matching fonts (Poppins / Barlow Condensed), matching color tokens, matching spacing.
- **Location-aware navbar**: the Home / Self-Serve Laundry / Wash-Dry-Fold / Commercial / About Us / Contact tabs. Implemented via `buildNav()`-equivalent that reads from `LOCATION_DATA.slug` so the navbar is correct on day one. Affiliate Program absent (per §2).
- **Breadcrumb trail**: matching style, with `Home` href correctly bound to `<base>/` (E12 fix baked in from the start).
- **Location-finder modal**: matching layout, matching distance-sort UI, but with a working selection handler (F2a fix), `navigator.geolocation` fallback ahead of `ipapi.co` (F2b fix), and a layered fallback to manual ZIP entry.
- **Footer**: matching three-panel layout with the existing shape but: `Local Links` panel anchors all wired (F1 fix), Get-Directions reads from `LOCATION_DATA.contact.mapsUrl` (E1 fix — no more Jacksonville hardcode), embedded contact form has a location field (F2c) and dark-on-light styling (F2d).
- **CSS tokens**: every variable from the live MHR site that we identified in the verification (`--gcid-primary-color`, `--navy`, `--accent`, etc.) is reproduced 1:1 so visual regressions across host ↔ MHR are zero. We extend, never replace.
- **Bridge wiring**: the host loads `parent-iframe-bridge-v3.js` and listens for the full message protocol. Inside the iframe slot is a real franchisee-managed embedded page (one of our 9), not a placeholder.
- **Page-render parity**: the host page renders correctly without JS for the chrome (progressive enhancement), and with JS for the dynamic bits — same as MHR's site does today. No regression in bot-crawler accessibility.

**What it provides MHR:**

- A drop-in template they can adopt with minimal change to their WP/Divi setup.
- A spec-by-example for the `LOCATION_DATA` contract — they can see what fields it consumes and where each one renders.
- A reference implementation of `parent-iframe-bridge-v3.js` they can deploy alongside their existing one.
- A measurable diff: every checklist item resolved on a single URL, demonstrable in 10 minutes of clicking.

**What it does NOT provide (intentionally):**

- A WordPress import. The host is plain HTML. MHR ports it to their CMS.
- Their actual editorial copy. We use representative content; they retain editorial ownership.
- Any chatbot integration (out of scope per §13 non-goals).

---

## 7. One-page-app interaction patterns

Each iframe page is a single viewport-sized "screen" with progressive disclosure inside it — not a long scroll. Specific patterns we'll use across all 10 pages:

- **Hero band** — fixed-height (60–70vh on desktop, fluid on mobile), one headline, one subhead, ≤2 CTAs, one image/illustration. No mega-galleries.
- **Stat rail** — 3–4 numeric callouts horizontally, mobile stacks 2-up.
- **Tab block (the workhorse)** — primary content surface for each page is a tabbed/segmented control with 3–5 sections; only one is visible at a time. Saves ~70% of vertical space vs scrolling stack.
- **Card grids** for industries / services / amenities — consistent dimensions, max one row on desktop.
- **CTA strip** — one persistent bottom band with primary action ("Get Directions") + secondary ("Call (512) 553-1674"). Phone is always anchored to a working `tel:+15125531674`.
- **Forms (contact, message)** — single column, inline validation, submit-disabled-until-valid, dark text on light card (E11 fix baked in from the start), success/error states defined.

Mobile: tabs become an accordion or a swipeable carousel based on count; everything stays single-column.

---

## 8. Bridge protocol — v2 → v2.1

`iframe-bridge-v2.js` is already clean — extend it (don't rewrite). Two additions on each side:

| Direction | Type | Payload | Purpose |
|---|---|---|---|
| iframe→parent | `request-location-data` | — | iframe asks for canonical location object |
| iframe→parent | `navigate` | `{ href }` | iframe asks parent to navigate (for top-level nav links emitted from iframe content) |
| parent→iframe | `location-data` | `{ ...LOCATION_DATA }` | parent broadcasts canonical data |
| parent→iframe | `chrome-translations` | `{ pt:{...}, de:{...} }` (optional response) | parent ack of bridge-fed translations |

We keep all v2 messages (`iframe-ready`, `language-change`, `current-language`, `seo-data`, `resize`, `hide-page-header`, `parent-ready`) — no breakage. The ten pages will use the extended client. The host page ships the parent half.

The existing `parent-iframe-bridge-v2.js` has Walibu-specific logic (Google Translate dropdown injection, `dropdown-cs` selector, `doGTranslate` hook). For the host page I'll write a clean `parent-iframe-bridge-v3.js` that drops the Walibu/Google-Translate scaffolding and uses our native i18n — and document the diff so MHR can adopt it cleanly.

---

## 9. Files we'll create / modify

```
public/
├── dev/
│   └── austin-host-mock.html                     ← NEW host/test page (noindex,nofollow)
├── assets/
│   ├── css/
│   │   ├── wavemax-theme.css                     ← NEW shared theme
│   │   └── wavemax-components.css                ← NEW shared components
│   └── js/
│       ├── parent-iframe-bridge-v3.js            ← NEW clean parent bridge
│       ├── iframe-bridge-v2.js                   ← EXTEND (v2 stays, +location-data,+navigate)
│       ├── seo-config-landing.js                 ← NEW
│       ├── seo-config-self-serve.js              ← UPDATE (already exists)
│       ├── seo-config-wash-dry-fold.js           ← UPDATE (already exists)
│       ├── seo-config-commercial.js              ← NEW
│       ├── seo-config-commercial-airbnb.js       ← NEW
│       ├── seo-config-commercial-medical.js      ← NEW
│       ├── seo-config-commercial-health-clubs.js ← NEW
│       ├── seo-config-about.js                   ← NEW
│       └── seo-config-contact.js                 ← NEW
├── austin-landing-v3-embed.html                  ← NEW
├── self-serve-laundry-embed.html                 ← UPDATE (refine + bridge wiring)
├── wash-dry-fold-embed.html                      ← UPDATE (refine + bridge wiring)
├── commercial-embed.html                         ← NEW
├── commercial-airbnb-embed.html                  ← NEW
├── commercial-medical-embed.html                 ← NEW
├── commercial-health-clubs-embed.html            ← NEW
├── about-us-embed.html                           ← NEW
├── contact-embed.html                            ← NEW
└── locales/{en,es,pt,de}/common.json             ← UPDATE (add austin.* namespace, all 4 langs)

server/                                            ← NEW server work (Phase 0)
├── controllers/
│   ├── locationController.js                     ← NEW (getReviews, getLocation)
│   └── contactController.js                      ← NEW (POST /contact/:slug)
├── routes/
│   ├── locationRoutes.js                         ← NEW (GET /api/v1/location/:slug/...)
│   └── contactRoutes.js                          ← NEW (POST /api/v1/contact/:slug)
├── services/
│   ├── googleReviewsService.js                   ← NEW (Places API client + cache)
│   └── contactNotificationService.js             ← NEW (SMTP fan-out to franchisee)
└── utils/
    └── memoryCache.js                            ← NEW or reuse if present (24h TTL)

tests/                                             ← NEW test coverage
├── unit/
│   └── googleReviewsService.test.js              ← NEW (with mocked Google API)
└── integration/
    ├── location-reviews.test.js                  ← NEW (endpoint behavior + cache)
    └── contact-submit.test.js                    ← NEW (endpoint behavior + email)

.env.example                                       ← UPDATE: + GOOGLE_PLACES_API_KEY
                                                              + AUSTIN_PLACE_ID (or LOCATION_DATA-resident)
                                                              + CONTACT_RECIPIENT_AUSTIN
docs/
└── parent-page-integration-guide.md              ← NEW: deliverable for MHR
                                                    (what to add to their template,
                                                     the bridge contract, the data shape)
```

Plus `public/assets/js/embed-app-v2.js` route map updates so the new pages are routable.

**Affiliate program is intentionally absent** — `affiliate-landing-embed.html` and the `/affiliate-program/` route stay as-is, untouched, until the Phase 2 refactor lands.

---

## 10. Phasing

### Phase 0 — server prep (~10% of effort) **[NEW]**
- [ ] Create / select Google Cloud project and enable **Places API (New)**
- [ ] Issue server-side API key restricted to Places API + our server IPs
- [ ] Add `GOOGLE_PLACES_API_KEY`, `CONTACT_RECIPIENT_AUSTIN` to `.env` and `.env.example`
- [ ] One-time: call Find Place From Text for `"WaveMAX Laundry Austin 825 E Rundberg"`; persist `placeId` + `profileUrl` + `reviewsUrl` into the `LOCATION_DATA` constant
- [ ] `googleReviewsService.js` — Places API client, 24h cache, stale-while-revalidate, rating filter
- [ ] `locationController.js` + `locationRoutes.js` — `GET /api/v1/location/:slug/reviews`
- [x] `contactController.js` + `contactRoutes.js` — `POST /api/v1/contact/:slug` with rate limit + CSRF (Phase 0d, 2026-05-03)
- [x] `contactNotificationService.js` — SMTP fan-out via existing `emailService.js` to franchisee inbox (Phase 0d, 2026-05-03)
- [x] Tests: `googleReviewsService.test.js` (mock Google), `location-reviews.test.js` (cache behavior, 5★ filter, fallback paths), `contact-submit.test.js` (validation, rate limit, email dispatch) — all green (16 contact + 9 reviews + 15 service = 40 tests)
- [ ] Verify endpoints from `curl` before any iframe page consumes them

### Phase 1 — foundation (~25% of effort)
- [ ] Create `wavemax-theme.css` and `wavemax-components.css` with all tokens + components
- [ ] Create `parent-iframe-bridge-v3.js` (clean parent bridge)
- [ ] Extend `iframe-bridge-v2.js` with `location-data` + `navigate` message types
- [ ] Build `austin-host-mock.html` — chrome only, no iframe yet, but switcher works against `data-i18n`
- [ ] Wire bridge end-to-end with one stub iframe page; verify resize, language-broadcast, location-data flow in DevTools

### Phase 2 — flagship pages (~35% of effort)
- [ ] `austin-landing-v3-embed.html` (consumes `/api/v1/location/austin-tx/reviews?minRating=5&limit=3` for the social-proof strip)
- [ ] Update `wash-dry-fold-embed.html` to v3 theme + bridge contract
- [ ] Update `self-serve-laundry-embed.html` to v3 theme + bridge contract
- [ ] `contact-embed.html` (highest defect-density on live site — biggest win for the demo; form posts to `POST /api/v1/contact/austin-tx`)

### Phase 3 — commercial cluster (~12%)
- [ ] `commercial-embed.html`
- [ ] `commercial-airbnb-embed.html`
- [ ] `commercial-medical-embed.html`
- [ ] `commercial-health-clubs-embed.html`

### Phase 4 — about + locales + polish (~13%)
- [ ] `about-us-embed.html` (live 5★ Google reviews block from the Phase 0 endpoint, full-width — the contrast piece against U3)
- [ ] Translation pass: en/es/pt/de complete for all `austin.*` keys
- [ ] SEO config files for all 8 new pages with full LocalBusiness JSON-LD per page
- [ ] End-to-end QA pass: every link, every form, every CTA, every language, every resize

### Phase 5 — handoff package (~5%)
- [ ] `docs/parent-page-integration-guide.md` — what MHR needs to do on their parent
- [ ] Update root README with the demo URL + what it proves
- [ ] Final verification matrix vs the three checklists — most §A/§B/§C/§D/§E items become "demonstrated working in our reference"

---

## 11. Verification gates (per phase)

Each phase ends with a hard checklist before moving on — won't advance until clean. Verification happens against `localhost:3000` (`npm run dev`) using Playwright + Chrome DevTools MCP, not against the live MHR site (we don't deploy there).

**Static / code gates** (run automated):
- [ ] `npm test` clean — zero failures, zero `--forceExit` needed by end of phase
- [ ] No `href="#"` anywhere — `grep -rn 'href="#"' public/` returns nothing in our new files
- [ ] All `tel:` hrefs populated with `+1` prefix
- [ ] All Get-Directions wired to encoded address from `LOCATION_DATA.contact.mapsUrl`
- [ ] Footer address NOT hardcoded — bound to `LOCATION_DATA.contact`
- [ ] No file > 800 lines; no controller > 500 lines (`wc -l` check)
- [ ] No `console.*` in `server/` (ESLint already enforces)
- [ ] CSP-clean: no inline `<script>` w/o nonce, no inline styles outside theme tokens
- [ ] All 4 locales present for every visible string (i18n-lint script in repo)
- [ ] `searchfit-seo:seo-check` clean on every page (≥ 90 score)
- [ ] `searchfit-seo:technical-seo` clean (no critical issues)

**Browser / interactive gates** (Playwright scripts in `tests/e2e/austin-reference/`):
- [ ] Every page loads on `localhost:3000` with no console errors and no 404s in network tab
- [ ] Every interactive control works — every button, every link, every form submit
- [ ] Form text is dark-on-light, focus state visible (a11y test)
- [ ] Tab content has no orphan empty states
- [ ] Mobile breakpoints (375 / 414 / 768) clean — Playwright snapshot per breakpoint
- [ ] Bridge: `resize` fires within 100ms of content change
- [ ] Bridge: `language-change` re-renders all visible strings end-to-end
- [ ] Bridge: SEO meta tags injected correctly — verified by reading parent `<head>` after iframe load
- [ ] Bridge: `location-data` round-trip — iframe receives the same data the host renders from
- [ ] Lighthouse SEO ≥ 95, Accessibility ≥ 95, Performance ≥ 85 (run via `chrome-devtools-mcp`)
- [ ] `chrome-devtools-mcp:a11y-debugging` clean

**Phase-completion ritual:**
1. Run `npm test` → must be clean.
2. Run the phase's Playwright suite → must be clean.
3. Run `searchfit-seo:seo-audit` against the affected URLs → must be clean.
4. Run `code-review:code-review` against the phase's commits → no unaddressed comments.
5. Auto-commit logical units (per CLAUDE.md), push, mark phase tasks completed.

---

## 12. Open questions — resolved 2026-05-03

1. ~~**Reviews on About Us.**~~ **RESOLVED:** pull live from Google Places API, filter to 5-star, properly attributed. Replaces both the franchisee-supplied option and the placeholder-copy option. See §6.5 for the architecture and TOS-compliance details.
2. ~~**Affiliate program nav placement.**~~ **RESOLVED:** affiliate program is **out of scope** for this build. Defer until Phase 2 refactor completes. Existing `affiliate-landing-embed.html` is untouched and not exposed in host nav.
3. ~~**Contact form submit target.**~~ **RESOLVED:** Option (b) — `POST /api/v1/contact/austin-tx` to a new server endpoint. Server fan-outs via existing `emailService.js` to a franchisee recipient address (env: `CONTACT_RECIPIENT_AUSTIN`).
4. ~~**Affiliate-program embed.**~~ **RESOLVED (subsumed by Q2):** not embedded; no work in this build.
5. ~~**Demo URL.**~~ **RESOLVED:** `https://wavemax.promo/dev/austin-host-mock.html`, **available but unlisted** — no auth gate, but `<meta name="robots" content="noindex,nofollow">` on the host page and no entry in any sitemap or nav. Reachable to anyone holding the URL.

### New questions (Phase 0 prep — easy answers, surfaced in case)

6. **Google Cloud project.** We have an existing project for OAuth (Google sign-in via `GOOGLE_CLIENT_ID`/`SECRET`). Two options for Places API:
   (a) reuse the same project (one billing record, single API key surface, slightly broader blast radius if compromised),
   (b) create a separate project (cleaner isolation, separate billing, easier to revoke/rotate independently).
   **Default:** I'll create a separate project per least-privilege; tell me to use the existing one if you'd prefer.
7. **Contact-form recipient.** Default routing: `CONTACT_RECIPIENT_AUSTIN` set to the franchisee's monitored inbox. Want CC to operations or just the single recipient?

---

## 13. Risks / non-goals

**Risks:**
- **Theme drift** — if MHR refactors their tokens (colors/fonts) after we ship the reference, our build looks dated. Mitigation: the reference uses CSS custom properties, so a single-file theme update tracks any change.
- **Bridge protocol divergence** — if MHR ships their own bridge changes without coordination, our protocol diverges. Mitigation: §5 of the integration guide is a frozen contract spec; we treat any unilateral MHR change as a coordination ticket.
- **i18n maintenance burden** — four locales × nine pages × ~50 strings ≈ 1,800 translation cells. Mitigation: namespace by page so per-page edits don't touch unrelated dictionaries; lint script flags missing keys.
- **Google Places API cost / rate limits.** Places API New is $0.005–$0.017 per request depending on field set; with a 24h server cache and one location, we expect ≤2 requests/day in practice (forced refresh on cache miss). Mitigation: hard cap on cache-miss frequency, monitoring alarm if requests exceed 50/day for one location.
- **5★ filter producing empty result set.** If Austin has a recent run of low-star reviews, the 5★ section might be sparse (≤2 cards) or empty. Mitigation: empty-state already designed into the failure modes (§6.5). Long-term mitigation is the franchisee's actual review-acquisition pipeline, not a UX trick.
- **Google API key compromise.** If the server-side key leaks (logs, error pages, accidentally committed), an attacker can run up our quota. Mitigation: key is restricted at the Google Cloud Console level (Places API only + our server IPs only), rotated through env var, never logged.
- **Contact form abuse.** Open `POST /contact/:slug` invites spam. Mitigation: existing rate-limit middleware (`server/middleware/rateLimiting.js`) at `sensitiveOperationLimiter` tier (10/hour/IP), CSRF required, server-side validation, optional CAPTCHA if abuse appears.

**Non-goals:**
- We are NOT rebuilding MHR's WordPress chrome. The host page is a demonstration; MHR adopts the bridge + data contract on their existing template.
- We are NOT migrating the chatbot. That's a separate workstream tied to its own data source per fix-checklist §E9.
- We are NOT addressing the system-wide cross-franchisee defects (Charlotte phone, Phoenix Gmail, etc.). Reference build is Austin-only; the patterns it establishes can be applied per-location later.
- We are NOT integrating the affiliate program. Defer until Phase 2 refactor completes — see §2 and §12.2.
- We are NOT building a "submit a review" / private-feedback funnel on the reference build. That's the §E10 workstream and stays separate.

---

*Plan opened 2026-05-03. Pending review before Phase 1 begins.*
