# Iframe Content Integration — Proposal & Reference Build

**Prepared by:** WaveMAX Austin (Colin & Rick Houlihan)
**For:** WaveMAX Laundry corporate / MHR Marketing
**Date:** May 3, 2026
**Demo URL:** [https://wavemax.promo/dev/austin-host-mock.html](https://wavemax.promo/dev/austin-host-mock.html)

---

## 1. Executive Summary

Until recently, Austin had two franchisee-maintained pages live and
embedded as iframes inside Walibu's location page: the
**Self-Serve Laundry** information page and the **Affiliate Program**
sign-up flow. A third — **Wash-Dry-Fold** — was implemented, tested,
and queued to go live when the cutover from Walibu to corporate's
WordPress + Divi stack interrupted the rollout. The long-running
plan was to extend the same iframe-embed pattern to cover the rest
of the location content (landing, contact, commercial, about) so
the franchisee owned the full surface inside corporate's chrome.
The cutover removed the two live embeds and stranded the third.
This proposal **restores that capability, ships the WDF page that
was about to go live, and completes the planned extension** —
re-embedding the franchisee-maintained iframes into the corporate
location page so we get back the functionality we relied on under
Walibu. The reference build at the URL above demonstrates the
pattern end-to-end with the WaveMAX Austin location, and is ready for
WaveMAX corporate / MHR Marketing review.

This document is the package we'd like reviewed:

- **Section 2** — why iframe-embedded vs. continued parent-page fixes
- **Section 3** — what we built (a feature-by-feature inventory of
  improvements over the existing `/austin-tx` page)
- **Section 4** — architecture diagram and how corporate adopts it
- **Section 5** — how to evaluate the demo
- **Section 6** — proposed next steps to restore Austin's
  iframe-embedded content

This proposal is **about WaveMAX Austin specifically.** It restores
functionality the Austin franchise was actively using under Walibu,
ships the page that was queued to go live when the cutover
happened, and completes the extension we'd been building toward.
If the work has spillover value for corporate, MHR, or other
franchisees who want to look at it later, that's a fine outcome —
but it's not what we're asking for. The ask is restoration for
Austin.

---

## 2. Why Iframe-Embedded Content

### Background

### What we had

Austin's location presence on Walibu included two franchisee-maintained
pages embedded via iframe and a third about to go live:

- **Self-Serve Laundry** (live) — hours, equipment specs, pricing,
  attendant info
- **Affiliate Program** (live) — sign-up flow, terms, commission
  schedule, dashboard link
- **Wash-Dry-Fold** (queued) — drop-off process, turnaround,
  pricing, policies. Implemented, tested, and ready to go live when
  the cutover happened.

We maintained all three ourselves — copy, hours, pricing, photos,
SEO meta — and we did it securely (versioned source control, code
review, no plaintext secrets, the usual hygiene), iterating directly
without round-tripping through a marketing vendor. The pattern was
clean: corporate's chrome wrapped the page; the iframe carried our
content; a small bridge handled language, location-data, and
content-height between the two.

### What was planned

The two embeds were the proof point. The extensions were
facilitated by **Walibu**, WaveMAX's marketing partner who
provisioned the integration on our behalf, and were also walked
through with our **WaveMAX area representative** at the time.
Neither raised concerns, and the plan stayed on the record as we
built toward the Wash-Dry-Fold page going live. The end state we
were working toward: the full location page rendered as
franchisee-maintained content inside corporate's chrome, with one
consistent integration contract.

### What changed

The Walibu → corporate WordPress cutover replaced the entire
location page (including our two embeds) with content that
corporate's marketing vendor (MHR Marketing) maintains directly.
Three checklists subsequently documented ~38 distinct defects on
the new corporate version — broken phone numbers, hardcoded
Jacksonville address bleed-through into the Austin footer, missing
mobile breakpoints, broken footer anchors, untranslated copy,
stale business data, SEO gaps, and other content-migration issues.
Many of these are routine errors that get introduced when the
franchisee's location data flows through a third party that
isn't the source of truth for it.

### What this proposal does

Restore the iframe-embedded pages we had live on Walibu, ship the
Wash-Dry-Fold page that was queued to go live, and complete the
already-agreed extension to the rest of the location content. Same
integration model, same separation of responsibilities corporate
and franchisee already operated under during the Walibu period.

> **Turn-key for corporate &amp; MHR.** WaveMAX Austin will do all
> the required work. The reference build is already running; the
> remaining pages (contact, refreshed WDF, refreshed Self-Serve,
> commercial, about) will be delivered by Austin without consuming
> MHR engineering time. We will also provide MHR with **detailed
> integration guidance** — the iframe embed snippet, the bridge
> protocol contract, frame-ancestors policy, allowed-origins list,
> and any WordPress-side configuration MHR needs to put the iframe
> in the right slot on the location-page template. The ask on
> corporate / MHR is review, sign-off, and a small WordPress
> template change — not net-new development work.

### Proposal

Restore the integration model we were already using under Walibu:

1. **Corporate** continues to own the parent page chrome on
   `www.wavemaxlaundry.com` — header, footer, brand styling. Same
   WordPress + Divi stack, no platform change required.
2. **Austin** serves an iframe-mounted content area at an
   Austin-controlled origin (`wavemax.promo`).
3. A small **PostMessage bridge** carries language preference, location
   data, breadcrumbs, and content-height up to the corporate parent;
   carries chrome events (language switches, modal triggers) down to
   the iframe. Same iframe-embed contract Austin's existing
   Self-Serve and WDF pages used inside Walibu, now updated to a
   versioned protocol for forward compatibility.
4. Each iframe page can be developed, tested, deployed by Austin
   — without involving MHR — and corporate retains brand control
   over the visible chrome around it.

This decouples Austin's release cadence from corporate / MHR's,
lets us tune the content for our local search intent, and keeps
corporate's chrome unchanged. As a side effect it also gives
corporate a clean re-platform path later — if the parent site
moves off WordPress, the iframe contract does not have to
change — but that is a downstream consequence, not the reason
we are proposing this.

### What this is **not**

- **Not a parent-site replacement.** Corporate continues to own
  `www.wavemaxlaundry.com`. This proposal targets one slot inside
  each location page, not the page itself.
- **Not a hosting cost shift.** Each franchisee already pays for their
  own marketing presence. Hosting the iframe content on franchisee
  infrastructure isn't new cost, just new control.
- **Not a multi-tenancy commitment from corporate.** Corporate doesn't
  have to host or maintain the iframe content. The bridge contract is
  versioned; corporate can lock to a specific bridge version and the
  franchisee handles compatibility.

---

## 3. What We Built — Improvements Inventory

Each subsection below compares what's on the live
`www.wavemaxlaundry.com/austin-tx` page today against what's in the
reference build at `https://wavemax.promo/dev/austin-host-mock.html`.

### 3.1. Parent-Page Chrome (the host envelope)

The chrome is a faithful recreation of the existing MHR template, but
with every defect identified in the prior audits closed:

| Element                | Existing `/austin-tx`                | Reference build                                            |
|------------------------|--------------------------------------|------------------------------------------------------------|
| **Top phone number**   | Hibu tracking number `(512) 309-0430` hardcoded *and* `(512) 553-1674` hardcoded as fallback (E2 audit defect — Hibu fails open to wrong number)  | Single source of truth — `LOCATION_DATA.contact.phone`; Hibu swaps cleanly with no hardcoded fallback |
| **Phone `tel:` links** | Mixed: some use `tel:5125531674`, some `tel:+15125531674`, some missing the `+1` prefix (E3 defect) | Every `tel:` anchor uses `tel:+15125531674` consistently   |
| **Address**            | Hardcoded "825 E Rundberg Ln F1" — but with Jacksonville address visible in some footer paths (F2 defect) | Bound to `LOCATION_DATA.contact.address` everywhere; no other-location bleed |
| **Get-Directions URLs**| Several broken: missing `?destination=`, raw `&` not encoded, point at corporate locations page instead (D1 defect) | All point at `https://www.google.com/maps/dir/?api=1&destination=825+E+Rundberg+Ln+F1+Austin+TX+78753` |
| **Footer "Local Links"** | 6 anchors but only 2 navigated (4 had `href="#"` — F1 defect) | All 6 anchors navigate; no `href="#"` placeholders anywhere |
| **Hours display**      | "Open 7am-10pm" but rendered without space, breaks at narrow widths | Bound to `LOCATION_DATA.hours.display`; mobile-tested at 6 viewports |
| **Last-wash time**     | Static "9pm" inline, not bound | `LOCATION_DATA.hours.lastWash`; can be edited per-franchisee in one place |
| **Locations modal**    | TranslatePress switcher in this slot — confusing UX, didn't actually translate | Native modal that lists franchisee locations and routes to them |
| **Language switcher**  | TranslatePress widget, en/es only | Native flag-based switcher, en/es/pt/de, with localStorage persistence and PostMessage broadcast to iframe |
| **Mobile breakpoints** | Hero phone link broke at 375px; nav stacked behind logo at 414px | Tested clean at 375 / 414 / 768 / 901 / 1280 / 1920 |
| **Map preview (footer)** | Static image of Jacksonville office (J1 defect) | Procedurally drawn map with Austin pin + interactive Get Directions / All Locations buttons |
| **Embed-page bridge**  | None — chrome is one HTML doc | PostMessage protocol with strict origin validation, language sync, location-data sync, content-height auto-resize |

### 3.2. Landing-Page Content (what fills the iframe)

The reference landing replaces the existing `/austin-tx` body content
with a one-page-app composition tuned for local-search intent:

```
┌──────────────────────────────────────────────────────────────┐
│ Hero band (690px)                                            │
│   • Rotating Austin landmark watermarks (5 photos)           │
│   • Brand logo + headline + subhead + 2 CTAs (call, dirs)    │
├──────────────────────────────────────────────────────────────┤
│ Stat rail (5 tiles, navy band)                               │
│   4.8★ Google · 7am-10pm · <45min full load                  │
│   $1.20/lb WDF · 24hr Turnaround                             │
├──────────────────────────────────────────────────────────────┤
│ Service tabs                                                 │
│   Wash-Dry-Fold | Self-Serve | Commercial                    │
│   3 feature blocks per tab                                   │
├──────────────────────────────────────────────────────────────┤
│ Live 5★ Google Reviews                                       │
│   Pulled from Places API (New) — real customers              │
├──────────────────────────────────────────────────────────────┤
│ CTA strip (sticky bottom)                                    │
│   Call · Get Directions                                      │
└──────────────────────────────────────────────────────────────┘
```

Hero rotator photos are licensed from Wikimedia Commons (CC-BY-SA) and
include: Pennybacker Bridge, Texas State Capitol, Mount Bonnell, Lady
Bird Lake, South Congress, Austin skyline. Each is captioned in-place
with a small attribution badge so the page reads as "WaveMAX in Austin"
rather than "WaveMAX, photo of unrelated landmark."

Equipment + amenity copy reflects the actual store:

- 42 Electrolux CompassPro 450G washers
- 42 high-velocity dryers
- Hospital-grade UV-sanitized water (Omni LUX UV Water Sanitization)
- Free WiFi, free parking, fully attended, wheelchair accessible
- $1.20/lb WDF, 10-lb minimum
- Self-serve range $2.75–$10.50, 20-min wash + 20-min dry

### 3.3. SEO Expansion

The existing `/austin-tx` page ships ~30 SEO meta tags and 1 JSON-LD
block (`FAQPage`). The reference build ships ~50 meta tags and **9
JSON-LD blocks**, all emitted directly in the host page where Google
can see them on first parse:

#### Meta block

- Title, description, keywords, robots (`index, follow,
  max-image-preview:large, max-snippet:-1, max-video-preview:-1`)
- Geo signals: `geo.region`, `geo.placename`, `geo.position`, `ICBM`
- Open Graph including `business.business` properties
  (`business:contact_data:*`, `place:location:*`)
- Twitter card (`summary_large_image`)
- Canonical URL + 4-locale `hreflang` (en-US / es / pt / de) +
  `x-default`. Existing page only declares `hreflang` for en/es.
- Favicon set: 32 / 192 / 180 / 270 + `msapplication-TileImage` +
  `theme-color`
- Performance hints: `preconnect` / `dns-prefetch` for fonts, store-photo
  CDN, Wikimedia, Hibu, Google Places (saves ~150–300ms on cold visits)

#### Structured data (JSON-LD)

| Schema                 | Purpose                                                     |
|------------------------|-------------------------------------------------------------|
| `LaundryOrDryCleaner`  | Hours, geo, address, phone, areaServed (6 cities), amenityFeature (5), makesOffer (3) — opens the Google Local Pack + GBP linkage |
| `Organization`         | Links the location to the franchise parent so Google can resolve the brand → location relationship |
| `WebSite` + `SearchAction` | Eligible for sitelinks search box                       |
| `BreadcrumbList`       | Breadcrumb rich result                                       |
| `Service` (×3)         | Wash-Dry-Fold / Self-Service / Commercial — each with description, area served, offer/pricing |
| `FAQPage` (10 Q&A)     | Eligible for "People Also Ask" rich results. **All 10 questions are location-specific** (not generic copy that would compete with sister locations) |
| `ParkingFacility`      | Surfaces the "free parking" amenity in Google Maps cards     |

The location-specific FAQs alone are a meaningful improvement:
generic FAQ blocks (the existing page uses 24 generic Q&As about "what
is wash-dry-fold") get treated by Google as low-quality and rarely
surface. Location-specific FAQs (hours, address, pricing for *this*
store, sanitation specifics) are much more likely to win the rich
result.

### 3.4. Internationalization

| Capability             | Existing `/austin-tx`             | Reference build                                  |
|------------------------|-----------------------------------|--------------------------------------------------|
| **Languages supported**| 2 (English, Spanish)              | 4 (English, Spanish, Portuguese, German)         |
| **Implementation**     | TranslatePress (WordPress plugin) — translates DOM client-side; doesn't translate `<title>` or meta (SEO-bad) | Native `data-i18n` / `data-bind` attributes; translations in versioned JSON dicts under `public/locales/` |
| **Persistence**        | Cookie, server-side               | `localStorage` + `storage` event for cross-tab sync |
| **Cross-frame sync**   | N/A                               | PostMessage broadcast — host sets language → iframe re-translates immediately |
| **Maintainability**    | Translation strings live in WordPress admin UI | Translation strings live in source-controlled JSON; reviewable per-PR |
| **Hreflang declared**  | en-US, es-MX, en, es              | en-US, es, pt, de + x-default                    |

Spanish, Portuguese, and German cover the three biggest non-English
language groups in the WaveMAX service area (per the franchisor's
2025 customer-demographic data). Adding additional languages is
mechanically a JSON-file plus one line in the language switcher
config — no code change.

### 3.5. Live Google Reviews (Places API New)

The existing page hardcodes "4.8★" as a static badge. The reference
build pulls the real number live, plus the actual review text and
authors, by calling the **Places API (New)** directly from the
visitor's browser with the WaveMAX Austin Place ID
(`ChIJOUs5BpHJRIYRTjv0UotLg0o`). Implementation:

- Server-rendered config endpoint at `/api/austin-tx/places-config`
  reads `GOOGLE_PLACES_API_KEY` and `GOOGLE_PLACES_LOCATION_PLACE_ID`
  from server env at request time. Values are never committed to
  source control.
- Browser issues `POST https://places.googleapis.com/v1/places/{id}`
  with `X-Goog-Api-Key` header and a field mask requesting
  `reviews,rating,userRatingCount`.
- Response is filtered to 5★ reviews only and rendered into the
  reviews block with author attribution + relative publish time
  (e.g. "2 weeks ago").
- API key is locked down in Google Cloud Console:
  - **Application restrictions:** HTTP referrers — `wavemax.promo`,
    `*.wavemax.promo`, `wavemaxlaundry.com`, `*.wavemaxlaundry.com`,
    plus `localhost:*` for development. A leaked key is unusable
    outside our domains.
  - **API restrictions:** Places API (New) only.
- Falls back gracefully to a "View on Google" link if the API is
  unreachable (configuration missing, quota exhausted, network down).
- Cached at the browser for the session; subsequent visits within the
  same session don't re-call the API.

Free-tier headroom: 10,000 calls / month. At Austin's current visit
rate (~2,000 unique visitors / month) we're at 20% utilization with
significant runway. Once the franchise rolls this out broadly,
edge-side caching can extend the free tier further if needed.

The displayed rating is computed from `userRatingCount` and `rating`
on the Places response and updates without a redeploy as new reviews
land. **Today: 4.8 ★, 48 reviews.**

### 3.6. Hibu Dynamic Phone Insertion (call tracking)

Hibu's source-indexed phone-swap script — the same one already on
`www.wavemaxlaundry.com/austin-tx` — is integrated, with two
improvements over the existing setup:

1. **CSP-compliant.** The existing page emits Hibu's init logic
   inline, which makes the page incompatible with strict
   Content-Security-Policy. The reference build extracts the init to
   `/assets/js/austin-hibu-phone-swap.js` (loaded with the per-request
   nonce) so the same call-tracking behavior ships behind a strict CSP.
2. **Loaded in both host AND iframe.** Hibu's loader scans the
   document it runs in, so the iframe content (where most of the
   tel: anchors live: hero CTA, CTA strip, in-tab buttons) needed its
   own copy. The existing page only loads Hibu on the chrome, so
   in-content tel: anchors get the local number, not the tracking
   number — meaning Hibu attribution undercounts inbound calls today.

Source-indexed map matches the existing production exactly:

| Source channel | Tracking number    |
|----------------|--------------------|
| Organic search | `(512) 309-1004`   |
| Paid search    | `(512) 309-1415`   |
| Google Business Profile | `(512) 359-7929` |
| Direct         | `(512) 360-8337`   |
| Referral       | `(512) 360-8339`   |
| Fallback (no source match) | `(512) 309-0430` |

### 3.7. Security Baseline

Before recommending the URL for corporate review, we engaged an
independent security audit of the deployed app (the audit report is
checked in at `docs/security/wavemax-promo-prelaunch-audit-2026-05-03.md`
in the repo and available on request). The audit identified 24 findings
across CRITICAL / HIGH / MEDIUM / LOW / INFO severity. Before publishing
the demo URL we closed:

- **All 4 CRITICAL findings** — production NODE_ENV correctly set,
  test routes that leaked password hashes disabled, Mailcow admin
  ports closed at the firewall, MongoDB TLS validation re-enabled.
- **3 of 7 HIGH findings** — proper `SameSite=None; Secure`
  cookies for the iframe-embed use case, CSRF Phase 2 enforcement,
  HTTPS redirect for cleartext requests.
- The remaining 4 HIGHs (CSRF bearer-token bypass, refresh token in
  URL query string, legacy bridge migration, Node-as-root) are tracked
  with assignees and target dates; none affect demo security.

The deployed page ships with:

- Strict Content-Security-Policy with nonce-based script-src
- HTTP Strict Transport Security: 1 year, includeSubDomains, preload
- Referrer-Policy: same-origin
- X-Content-Type-Options: nosniff
- frame-ancestors restricting embedding to `wavemax.promo`,
  `wavemaxlaundry.com`, and `*.wavemaxlaundry.com` (corporate can lock
  this down further per their policy)
- Cookie flags: HttpOnly, Secure, SameSite=None
- TLS 1.2+ enforced via Cloudflare in front
- 36 automated end-to-end Playwright tests at 6 responsive viewports

### 3.8. Performance & Operations

- **Cloudflare proxy** in front for static-asset edge caching, TLS
  termination, DDoS protection
- **PM2 cluster mode** — 3 workers across the box
- **MongoDB Atlas** managed — TLS-validated connections, IP-restricted
- **Mailcow stack** independent — admin UI now firewalled to
  ops-IPs only post-audit
- **Backups** scheduled — encrypted MongoDB dumps + filesystem
  snapshot to a separate region

---

## 4. Architecture

```
                ┌────────────────────────────────────────────────┐
                │   Visitor browser                              │
                │                                                │
                │   www.wavemaxlaundry.com/austin-tx             │
                │   ┌──────────────────────────────────────┐    │
                │   │ Corporate WordPress + Divi chrome    │    │
                │   │  · Brand header / footer             │    │
                │   │  · TranslatePress (or native repl.)  │    │
                │   │                                      │    │
                │   │  ┌────────────────────────────────┐  │    │
                │   │  │ <iframe                        │  │    │
                │   │  │   src="https://wavemax.promo/  │  │    │
                │   │  │     embed-app-v2.html?route=/  │  │    │
                │   │  │     austin-tx" >               │  │    │
                │   │  │                                │  │    │
                │   │  │ ←── PostMessage protocol ──→   │  │    │
                │   │  │                                │  │    │
                │   │  │ ┌────────────────────────────┐ │  │    │
                │   │  │ │ Franchisee landing page    │ │  │    │
                │   │  │ │  · Hero / stat / tabs      │ │  │    │
                │   │  │ │  · Live Google reviews     │ │  │    │
                │   │  │ │  · CTAs with Hibu numbers  │ │  │    │
                │   │  │ └────────────────────────────┘ │  │    │
                │   │  └────────────────────────────────┘  │    │
                │   └──────────────────────────────────────┘    │
                └────────────────────────────────────────────────┘
                            ▲                       ▲
                            │                       │
                  Corporate │                       │ Franchisee
                  controls  │                       │ controls
                  this page │                       │ this iframe
                  (chrome)  │                       │ (content)
```

### Bridge protocol (PostMessage)

| Direction         | Message type        | Payload                                     |
|-------------------|---------------------|---------------------------------------------|
| parent → iframe   | `parent-ready`      | (signal that bridge is up)                  |
| parent → iframe   | `current-language`  | `{ language: "en"\|"es"\|"pt"\|"de" }`      |
| parent → iframe   | `location-data`     | `{ contact, hours, owner, pricing, ... }`   |
| parent → iframe   | `language-change`   | `{ language: "es" }`                        |
| iframe → parent   | `iframe-ready`      | (signal iframe bridge is up)                |
| iframe → parent   | `resize`            | `{ height: 2840, page: "/austin-tx" }`      |
| iframe → parent   | `seo-data`          | `{ title, description, canonical, ... }`    |
| iframe → parent   | `hide-page-header`  | (legacy v2 — kept for backward compat)      |

Origin validation is strict on the parent side (the iframe origin must
match a whitelist + dev-host pattern); the iframe accepts any origin
but treats the payloads as untrusted (only well-typed messages with
known shapes are processed).

### Content-update workflow

```
Franchisee dev makes change
         │
         ▼
      git push
         │
         ▼
  GitHub Actions CI runs:
   • 36 Playwright e2e tests
   • Server-side test suite
         │
         ▼
   Auto-deploy to wavemax.promo
   (PM2 cluster reload, zero-downtime)
         │
         ▼
   Visitor sees the update on next request
   (CDN cache is configured for instant
    propagation on iframe content)
```

Corporate doesn't need to be in the loop for content changes.
Corporate only re-deploys their parent page when the chrome itself
needs to change (and that's rare — the chrome contract is versioned).

---

## 5. How to Evaluate the Demo

URL: **[https://wavemax.promo/dev/austin-host-mock.html](https://wavemax.promo/dev/austin-host-mock.html)**

### A 5-minute walkthrough

1. **Load the page.** Verify chrome looks like the existing
   `/austin-tx` page — it should, faithfully.
2. **Click the language switcher (top right, with the EN flag).**
   Pick Spanish, Portuguese, or German. Both the chrome and the
   iframe content should re-translate without a page reload.
3. **Scroll the iframe content.** Verify hero / stat rail / service
   tabs / reviews / CTA strip render.
4. **Click any "Call (512) ..." button.** Your phone should offer to
   dial; the number should be a Hibu tracking number (`309-`,
   `359-`, or `360-` prefix), not the local `553-1674`.
5. **Click any "Get Directions" link.** Should open Google Maps with
   "825 E Rundberg Ln F1" as the destination.
6. **Resize the browser** down to mobile width (375px) and back to
   desktop. Layout should reflow cleanly at every size.
7. **Click "Locations"** in the chrome. A modal should slide in
   showing nearby franchisee locations.
8. **Open dev tools** → Console. There should be no errors.
9. **Open dev tools** → Network → filter "places.googleapis.com".
   You should see one POST request returning the live Google reviews
   on first visit; the cards on the page should match the API
   response.
10. **View page source.** Search for `application/ld+json`. You should
    see 9 JSON-LD blocks covering LaundryOrDryCleaner, Organization,
    WebSite, BreadcrumbList, three Service entities, FAQPage, and
    ParkingFacility.

### Useful evaluation tools

- **Google's Rich Results Test:**
  https://search.google.com/test/rich-results — paste the URL; it
  should report 9 enhancements detected with no errors.
- **PageSpeed Insights:**
  https://pagespeed.web.dev/ — paste the URL; baseline at
  Performance > 85, Accessibility > 95, Best Practices = 100, SEO =
  100 on desktop.
- **WAVE accessibility:**
  https://wave.webaim.org/ — paste the URL; should report 0 errors.
- **Mobile-friendly test:**
  https://search.google.com/test/mobile-friendly — paste the URL;
  should report mobile-friendly with no usability issues.

---

## 6. Proposed Next Steps

Phasing assumes corporate / MHR sign-off so Austin can re-embed.
All work below is done by Austin.

| Phase | Scope                                                        | Owner       | Estimate  |
|------:|--------------------------------------------------------------|-------------|-----------|
| **Decision** | Corporate / MHR review demo and confirm the iframe-embed restoration | Corporate   | 1–2 weeks |
| **2c**  | Build `contact-embed.html` (form + map + hours)              | Austin      | 3 days    |
| **2d**  | Refresh `wash-dry-fold-embed.html` (the page that was queued) | Austin      | 2 days    |
| **2e**  | Refresh `self-serve-laundry-embed.html`                       | Austin      | 2 days    |
| **3**   | Commercial cluster (4 sub-pages: hospitality, restaurant, salon, gym) | Austin    | 1 week    |
| **4**   | About-us page, additional locales, end-to-end QA              | Austin      | 1 week    |
| **5**   | Integration package handed to MHR (snippet + bridge spec + walkthrough); WordPress template change deployed | MHR + Austin | ~1 week round-trip |
| **Live** | Austin's iframes back in production on `/austin-tx`         | —           | —         |

> **Note on broader use.** If, after seeing the Austin restoration
> work, corporate or MHR want to look at applying any of it
> elsewhere — to the wider site, to other locations who ask for
> it, or to MHR's own template-build process — we are happy to
> share what we've built and answer questions. That is **not what
> we are proposing here.** Austin is more technically equipped
> than the typical franchisee, and what works for us doesn't
> automatically work for everyone. The phasing above stops at
> Austin live; anything beyond that is corporate's call, on
> corporate's timeline.

### What we'd need from corporate / MHR

WaveMAX Austin handles the build, hosting, content, and ongoing
maintenance for the Austin iframe pages. The ask on corporate /
MHR is narrow and one-time:

1. **Sign-off** on restoring Austin's iframe-embedded pages.
2. **Content slot** identified on the `/austin-tx` page template
   — i.e. confirmation of where the iframe goes (currently mocked
   as "between the chrome and the footer; full width").
3. **Bridge contract version lock** — corporate commits to a
   specific bridge protocol version for the Austin pages; Austin
   publishes breaking changes under a new version with a
   deprecation window.
4. **Allowed-origins list** confirmed — which domains corporate
   wants to permit in the `frame-ancestors` policy for the iframe
   on `/austin-tx`. Currently we have `wavemaxlaundry.com` and
   `*.wavemaxlaundry.com`; corporate may want to lock that down
   further.
5. **WordPress template change** to add the iframe + a small
   bridge include to the `/austin-tx` page template. Austin will
   provide the exact snippet, bridge protocol spec, and
   integration walkthrough so MHR can drop it in without writing
   it from scratch.

### Integration package Austin will deliver to MHR

To make the WordPress-side change above as low-friction as possible,
Austin's handoff to MHR will include:

- **Iframe embed snippet** ready to paste into the Divi page
  template, with the right `src`, `loading`, `referrerpolicy`, and
  responsive sizing attributes.
- **Bridge contract spec** — every PostMessage type, payload shape,
  origin requirements, error handling, and version-bump policy.
- **`frame-ancestors` configuration** notes — what to set if MHR
  controls CSP at the WordPress / Cloudflare layer.
- **Walkthrough doc** with screenshots of the WordPress admin steps,
  including how to roll back if anything looks wrong post-deploy.
- **A working preview** at `wavemax.promo/dev/austin-host-mock.html`
  that MHR can compare against to verify the WordPress
  implementation matches the reference behavior.
- **Direct support** from Rick Houlihan (Engineering) during the
  WordPress integration to answer questions in real time.

Net effort on MHR: review the package, paste the snippet, ship the
WordPress change, confirm the page renders. No net-new development.

### What corporate / MHR get out of this

This is a win-win, not a concession:

- **MHR keeps the Austin subscription.** The Austin location stays
  on the corporate WordPress page; MHR's revenue from Austin doesn't
  go anywhere. The iframe is a content slot inside the page MHR
  already manages.
- **Minimal ongoing maintenance for MHR.** The Austin iframe assets
  are versioned, tested, and maintained by Austin's engineering
  team. Once the iframe is in place, MHR's day-to-day workload on
  Austin drops to roughly zero — no ticket queue for routine Austin
  content updates, no defect cycles, no chase-the-data problems
  from sources MHR doesn't own.
- **A reference implementation MHR can learn from — and potentially
  resell.** Austin will package the reference build, bridge
  contract, integration walkthrough, and source for each iframe
  page *specifically for MHR consumption and redistribution.* If
  MHR sees value, MHR can offer the same pattern as a paid service
  to other franchisees who ask for it. That's a new revenue line
  for MHR, not a competing one. **WaveMAX Austin will not build
  this for anyone else** — we don't have the bandwidth to operate
  a network-wide platform team. If the model gets reused, MHR is
  the natural party to package and resell it, and Austin is happy
  to make the redistribution package as polished as MHR needs.
- **Better outcomes on the Austin page** — richer structured data,
  location-specific FAQs, proper canonical / hreflang, live Google
  reviews, business hours bound to a source of truth, source-indexed
  call tracking, en/es/pt/de coverage with no WordPress plugin
  overhead. All accrue to the Austin page that's already on
  corporate's domain, so the corporate site benefits too.
- **A clean re-platform path off WordPress later** if/when corporate
  wants one — the iframe contract is platform-agnostic.

The proposal is structured so corporate retains brand control, MHR
retains the customer relationship, Austin gets its iframe pages
back, and any cross-network upside MHR can capture from what we
build is theirs to take.

---

## 7. Risks & Mitigations

| Risk                                               | Likelihood | Mitigation                                                |
|----------------------------------------------------|:----------:|-----------------------------------------------------------|
| Google de-prioritizes iframed content for SEO      | Low        | The corporate parent is the indexable canonical; iframe is `noindex` + canonical → host. Google's documented position is that iframed content from same-/sister-origin is fine for ranking. We've also tested this pattern at scale on past projects. |
| PostMessage bridge breaks if iframe origin changes | Medium     | Strict origin whitelist on the parent side; bridge auto-resolves on late-mounted iframes; CI tests cover the bridge protocol. |
| Franchisee infra outage                            | Medium     | Iframe content is decoupled from corporate. If wavemax.promo goes down, the chrome continues to render; iframe shows an empty area. Cloudflare uptime + monitoring + automated failover (planned) keeps this <10min/yr. |
| Hibu / Places API quota / billing                  | Low        | Browser-side caching keeps Places calls minimal; Hibu billing is unchanged from existing setup. Quota alarms are configured. |
| MHR doesn't like ceding the page slot              | Medium     | This is the conversation. The reference build is the artifact for that conversation. |

---

## 8. Appendix — Repository & Audit Trail

- **Source repo:** github.com/rhoulihan/wavemax-affiliate-program
  *(franchisee-controlled; corporate read access available on request)*
- **Branch:** `main` (commits since 2026-04-01 are all
  reference-build work; ~50 commits, all reviewed)
- **Reference build URL:** https://wavemax.promo/dev/austin-host-mock.html
- **Iframe content URL (direct):** https://wavemax.promo/austin-landing-v3-embed.html
  *(loaded inside the iframe; carries `noindex` to avoid duplicate-content)*
- **Server-rendered config endpoint:** https://wavemax.promo/api/austin-tx/places-config
  *(visible in the page source as proof of architecture; safe to GET)*
- **Independent security audit:**
  `docs/security/wavemax-promo-prelaunch-audit-2026-05-03.{md,html}`
  *(24 findings; pre-handoff status: 4/4 CRITICAL closed, 3/7 HIGH
  closed, remainder tracked; full report on request)*

### Demo screenshot

A screenshot of the live reference build at the time of writing is
available at `/tmp/austin-reviews-live.png` in our workspace and can
be exported to a deck on request.

### Estimated read time for this document

About 12 minutes. If you're skimming, sections 1–3 cover the proposal
+ what's built; sections 4–6 cover architecture, evaluation, and
next steps; sections 7–8 are appendices.

---

*Prepared by WaveMAX Austin (Colin Houlihan, Owner; Rick Houlihan,
Engineering). For questions, replies, or to schedule a walkthrough:
john@austinwavemax.com or rick.houlihan@gmail.com.*

*© 2026 CRHS Enterprises, LLC. Internal — for review by WaveMAX
Laundry corporate and MHR Marketing.*
