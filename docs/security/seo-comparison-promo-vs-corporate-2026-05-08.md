# SEO discrepancies — wavemax.promo vs wavemaxlaundry.com (Austin)

**Captured:** 2026-05-08, side-by-side rendered-DOM extraction of every
Austin page from both sites.

**Method:** chrome `--headless=new --dump-dom` with 10-second virtual time
budget, programmatic head-tag extraction (title, meta, link, JSON-LD),
SSR-state structural inspection, hreflang and OpenGraph completeness
audit, robots.txt validity check.

---

## Executive summary

The two sites optimize for different things. **Corporate's pages are
better at the surface SEO basics** that crawlers reward in the
indexing pipeline (long keyword-dense titles, full-length descriptions,
server-rendered H1s). **Our pages are better at structured-data
richness, internationalization breadth, and rich-result eligibility**
that crawlers reward in the rich-card / Knowledge Graph pipeline.

If we want to outrank corporate on Austin queries, the levers are
mostly on our side. If corporate wants to outrank a hypothetical
competitor, their levers are mostly on theirs. The two are
complementary in a way that suggests neither side has a complete SEO
posture today.

---

## Where corporate is ahead (and we should fix)

### 1. Title tags — corporate's are 2–3× longer and more keyword-rich

| Page | corp title (chars) | promo title (chars) |
|---|---|---|
| landing | 84 — "Laundromat in Austin, TX \| Self-Service Laundry & Wash Dry Fold \| WaveMAX Austin" | 27 — "Austin's premier laundromat" |
| contact | 46 — "Contact \| WaveMAX® Laundry \| WaveMAX Austin TX" | 22 — "WaveMAX Laundry Austin" |
| wash-dry-fold | 79 — "Wash and Fold Laundry in Austin, TX …" | 44 — "Austin Wash-Dry-Fold • WaveMAX Laundry" |
| self-serve-laundry | 73 | 32 |
| commercial | 76 | 48 |
| about-us | 68 | 20 — "About WaveMAX Austin" |

The Google-recommended title-tag sweet spot is 50–60 characters of
descriptive content + brand. Corporate is at 70–84; we're at 20–48.
Their titles surface "Laundromat in Austin TX," "Wash and Fold,"
"Self-Service Laundry," "Commercial," etc. — directly matching
high-intent search queries. Our titles read as brand statements
("Austin's premier laundromat") without the keyword density that
ranks.

**Fix:** Rewrite our `<title>` strings to match the
`{primary keyword} in {city}, {state} | {differentiator} | WaveMAX Austin`
shape. For example: `Self-Service Laundromat in Austin, TX | 42 Electrolux 450G Washers | WaveMAX Austin`.

### 2. Meta descriptions — corporate hits the 150-char sweet spot; ours don't

| Page | corp desc (chars) | promo desc (chars) |
|---|---|---|
| landing | 149 | 73 |
| contact | 151 | 86 |
| wash-dry-fold | 162 | 87 |
| self-serve-laundry | 158 | 75 |
| commercial | 159 | 49 |
| about-us | 161 | 42 |

The optimal description length for Google's snippet is 150–160
characters. Corporate is hitting it; ours are about half that, leaving
SERP real-estate on the table. Our `commercial` description is 49
characters: *"Commercial laundry service for Austin businesses."*
That's a placeholder, not a description.

**Fix:** Rewrite each description to land in the 150–160 character
range, with the primary keyword + a value prop + a secondary
qualifier. The corporate descriptions are good models to mirror.

### 3. H1 server-side rendering — corporate has 1–3 per page; we have 0

| Page | SSR `<h1>` count corp | SSR `<h1>` count promo |
|---|---|---|
| landing | 3 | 0 |
| contact | 1 | 0 |
| wash-dry-fold | 1 | 0 |
| self-serve-laundry | 2 | 0 |
| commercial | 1 | 0 |
| about-us | 1 | 0 |

Our H1 elements only appear after JavaScript renders them client-side.
Crawlers that don't execute JS (or execute it with low budget) see no
H1 at all on our pages. Google's main crawler does render JS, but its
mobile-first indexer has stricter budgets, and most third-party SEO
tools (Bing, Yandex, ChatGPT-search, Perplexity) don't render JS
fully. They see corporate's H1; they see nothing where ours should be.

**Fix:** Move the per-page H1 into the static HTML (server-rendered)
rather than letting it materialize via the data-bind pass. The H1
content can still be dynamic per-franchise via the
`{{contact.city}}` template substitution; we just need it to land in
the SSR DOM, not after JS.

### 4. "Links not crawlable" Lighthouse audit — both sides flag, we flag worse

| Page | corp aria-current page anchors with no href | promo |
|---|---|---|
| landing | 1 | 3 |
| contact | 1 | 3 |

These are the navbar's "current page" indicators (`aria-current="page"`
on a clickable element with no `href`). Both sides have them; both
sides trigger Lighthouse's "Links are not crawlable" SEO audit. Ours
is worse because our chrome puts three of them in (the redundant
nav-link variants).

**Fix:** Either give the active-state anchor a real href (point it at
itself — `href="/austin-tx/"` etc.) or convert it from `<a>` to
`<button>` so it isn't audited as a non-crawlable link.

---

## Where we are ahead (and corporate should fix)

### 1. JSON-LD structured-data richness — overwhelming gap

| Page | corp distinct @types | promo distinct @types |
|---|---|---|
| landing | 5 (Answer, FAQPage, Question, SearchAction, WebSite) | **21** (BreadcrumbList, City, FAQPage, GeoCoordinates, **LaundryOrDryCleaner**, ListItem, LocationFeatureSpecification, Offer, OpeningHoursSpecification, **Organization**, **ParkingFacility**, **Person**, PostalAddress, PriceSpecification, Service, State, UnitPriceSpecification, WebSite, …) |
| contact | 5 (same) | 21 (same) |
| commercial | 8 (now includes LocalBusiness + Service — added today) | 21 |
| wash-dry-fold | 7 | 21 |
| self-serve-laundry | 5 | 21 |
| about-us | 8 | 21 |

The most consequential difference: **corporate's landing and contact
pages have no `LocalBusiness` or `LaundryOrDryCleaner` schema at all.**
Those are the schemas that open Google's local-pack rich result —
the box at the top of search that displays the business's hours,
phone, address, reviews, and a map. Without them, the local-pack
result can only be assembled from Google's Knowledge Graph and Google
Business Profile, neither of which corporate's pages contribute to.
Our pages do.

**The architectural gap:** corporate ships `WebSite` + `FAQPage` +
`SearchAction`, which is what a generic blog or content site would
ship. They do not ship the bricks-and-mortar service-business
schema set. Their commercial page now ships `LocalBusiness +
Service` (added today), but landing/contact don't.

**For corporate to close this:** add `LaundryOrDryCleaner` schema with
hours, geo, address, phone, payment methods, openingHoursSpecification,
amenityFeature, makesOffer to landing and contact at minimum. ~30
minutes of work for a copy from our existing implementation.

### 2. International-SEO coverage — we have 4 languages, corp has 2 dressed up as 4

| Site | hreflang languages |
|---|---|
| corp | en-US, es-MX, en, es (all four pages) |
| promo | en, es, pt, de, x-default (all four pages) |

Corporate's hreflang declares four entries but they're actually two
languages (English + Spanish) with regional variants. We declare four
genuine languages plus an `x-default`. Critically, **we have a
working `/es/`, `/pt/`, and `/de/` translation surface;** corporate's
`es` hreflang points at `/es/austin-tx/` which from prior audit was
either a thin copy or non-existent.

`og:locale:alternate` count tells the same story — we declare 3 alternate
locales (`es_MX`, `pt_BR`, `de_DE`); corporate declares 0.

**For corporate to close this:** verify the `/es/` Spanish path is
working content, and either build out the other languages or remove
the hreflang declarations that point at non-functional paths.

### 3. Per-page meta polish — theme-color, OG locale alternates

Small but cumulative:

- **theme-color**: present on every promo page (`#1a3f7a`); absent on every corp page. Used by mobile Chrome and PWA installers.
- **og:locale:alternate ×3**: declared by promo, not by corp.
- **business:contact_data:phone_number**: declared by promo (`+1-512-553-1674`), not by corp.

### 4. Map iframe query construction — pin label

The map iframe on Austin's contact page builds its Google Maps query
differently on each side:

- corp: `?q=825%20E%20Rundberg%20Ln%20Suite%20F1%2C%20Austin%2C%20TX%2078753`
  → Google labels the pin **"F1"** (the suite identifier)
- promo: `?q=WaveMAX+Laundry+825+E+Rundberg+Ln+f1+Austin+TX+78753`
  → Google labels the pin **"WaveMAX Laundry"**

The corporate query construction is the third audit cycle in which
this has been flagged. One-line fix: prepend "WaveMAX Laundry " to
the q-string.

### 5. Plagiarised testimonials on corporate about-us — Google penalty risk

Corporate's `/austin-tx/about-us/` page ships three customer
testimonials (Tim S., Taneisha, Omar L.), one of which is a verbatim
copy of a real Google review (per the original 2026-05-02 audit
finding). Plagiarised content is a manual-action risk on the
linking domain and a brand-trust risk independent of any SEO
implication. We do not ship fabricated testimonials.

### 6. JSON-LD validity & rich-result eligibility — measurable rich-result gap

Each schema type a page ships becomes a candidate for a different
Google rich result:

| Schema type | Rich result it enables | corp landing | promo landing |
|---|---|---|---|
| LocalBusiness / LaundryOrDryCleaner | Local pack card (hours, address, phone) | ✗ | ✓ |
| Organization | Knowledge panel (logo, founder, parent brand) | ✗ | ✓ |
| Service | Service rich result | ✗ | ✓ |
| BreadcrumbList | Breadcrumb in SERP | ✗ | ✓ |
| FAQPage | "People Also Ask" card | ✓ | ✓ |
| ParkingFacility | Amenity highlights in maps | ✗ | ✓ |

Corporate is leaving 5 of 6 rich-result types unclaimed on landing.

---

## Where there's parity

- Geo signals (`geo.region`, `geo.position`, `ICBM`) — both have `US-TX` and the same lat/lng.
- Twitter card type (both `summary_large_image`).
- Canonical URL declarations — both clean and self-referential.
- Robots meta — both `index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1`.

---

## Robots.txt — both sides flag in Lighthouse, neither is a real problem

Lighthouse runs against both sites flagged a robots.txt SEO failure:

- corp: not currently failing (was clean as of last test)
- promo: failing on `Content-Signal: search=yes,ai-train=no` — the
  Cloudflare-managed Content-Signal directive used to opt-out of AI
  training under EU DSM Article 4. Lighthouse's parser hasn't caught
  up; the directive is real, the parser is out of date.

This is a parser-currency issue and not a real SEO defect on either
side.

---

## Lighthouse SEO scores (desktop, prior measurements, for context)

| Page | corp | promo |
|---|---|---|
| /austin-tx/ (landing) | 92 | 92 |
| /austin-tx/contact/ | 100 | 92 |

Corporate's contact page scores 100; ours is held at 92 by the
Cloudflare Content-Signal robots.txt issue. **Score parity is
misleading**, however — Lighthouse audits a narrow subset of SEO
signals (it does not check schema richness, hreflang validity,
description depth, or H1 SSR). The deeper audit above is more
informative than the Lighthouse number.

---

## Headline conclusion

If both sides fix only the items called out in this document — corporate
fixes title length, description length, H1 SSR, plus adds
`LocalBusiness` schema and removes the fabricated testimonials; we
add the H1s to SSR, lengthen titles and descriptions, and clean up
the active-page nav anchors — the corporate site will have stronger
classical SEO and our site will have stronger rich-result SEO. They
will outrank for "laundromat austin" general queries; we will outrank
for "wash dry fold austin" / "self serve laundromat 80 lb austin" /
"commercial laundry austin" / "laundromat with parking austin" — the
queries our richer schema is positioned to win.

The right strategy is not to copy corporate verbatim or to demand
they copy us. It's to recognize that the bridge architecture
described in `iframe-platform-proposal-2026-05-04.md` lets BOTH SIDES
exist without competing — corporate's host page handles classical
SEO and the canonical URL; our iframe content carries the rich-result
schema and the multilingual depth. Together that's a substantially
stronger SEO posture than either side has today.

---

*End of comparison. Captures preserved at
`/tmp/seo-deep-compare/` — should be moved into
`forensic-evidence/page-captures/` if this report becomes evidentiary.*
