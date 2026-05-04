# An Iframe-Embed Platform for the WaveMAX Network

**A modular, hosting-agnostic content architecture for corporate and franchise sites**

> **Prepared for:** WaveMAX Laundry corporate · MHR engineering team
> **Prepared by:** WaveMAX Laundry Austin · Rick Houlihan / Colin Houlihan
> **Date:** 2026-05-04
> **Status:** Concrete offer — turnkey reference build at zero cost, 10-day delivery

---

## TL;DR

The WaveMAX brand currently lives inside one monolithic WordPress site that every franchise must inherit, share, and contend with. **It does not have to.** The reference build at `wavemax.promo/dev/austin-host-mock.html?route=…` demonstrates a different model:

- A **shared content library** (the iframe pages) hosted by corporate
- An **iframe bridge** that pushes branding, theme tokens, translations, and SEO down to any host page
- **Per-franchise host pages** that can live anywhere — WordPress, static HTML, WIX, Squarespace, Shopify, custom — all consuming the same library
- **Complete isolation** between franchises while corporate keeps unbreakable brand control

We have already built this end-to-end for Austin in **a single day** of focused work — 100 commits, 21 defects fixed, 21 new features shipped, 96+ e2e tests passing. We are offering to **package it as a fully documented, turnkey reference repository for the entire WaveMAX network at zero cost** — ready for MHR's team to own and extend on day one. Optional paid integration + training engagement is available if MHR staff would benefit from hands-on ramp-up support. The economics, the development velocity, and the operational risk profile all favor this model over the current monolith. Section 1 makes the case for executives. Section 2 explains how it works. Section 3 lays out what we are offering and what we'd ask in return.

---

# Section 1 — Executive Summary

## The pattern, in one paragraph

Every page a customer sees is a **host page** (WordPress, static, WIX — whatever the franchise prefers). Each host page mounts a small iframe that loads a corporate-controlled content page from `wavemax.promo`. A **bridge script** running on both sides of the iframe synchronizes language, theme, location data, SEO metadata, and modal popups in real time. The corporate library defines what a "WaveMAX page" looks like. The franchise host page provides location-specific data and any custom content above or below the embed. Neither side can break the other.

```
┌────────────────────────────────────────────────────────────────────────┐
│  HOST PAGE                                                             │
│  (WordPress / static / WIX — wherever the franchise lives)             │
│                                                                        │
│   ┌──────────────────────────────────────────────────────────────┐    │
│   │  parent-iframe-bridge-v3.js                                  │    │
│   │  · sets language · pushes LOCATION_DATA · receives           │    │
│   │    SEO updates · receives modal open requests                │    │
│   └──────────────────────────────────────────────────────────────┘    │
│                              ▲ ▼  postMessage                          │
│   ┌──────────────────────────────────────────────────────────────┐    │
│   │   <iframe src="https://wavemax.promo/wash-dry-fold-embed">   │    │
│   │                                                              │    │
│   │   Corporate-controlled content                               │    │
│   │   · CSS theme tokens · Translations · Layout · SEO schema    │    │
│   │   · Pricing logic · Forms + rate limiting                    │    │
│   └──────────────────────────────────────────────────────────────┘    │
└────────────────────────────────────────────────────────────────────────┘
```

## Why this is the right architecture

**1. Corporate keeps brand and quality control without owning every site.**
Every iframe page is served from corporate infrastructure. The CSS theme, the heading hierarchy, the schema.org structured data, the four-language translations, the form-validation rules, the rate limits, the security headers — all of it is enforced from one place. A franchise that wants "their own page" can still use the iframe and inherit corporate styling, no matter where they host the page itself.

**2. Franchises are not locked into corporate hosting.**
Today, "have a WaveMAX presence" means "be on `wavemaxlaundry.com`." That coupling is the source of every coordination cost: every franchise sharing one CMS, one deploy pipeline, one DNS, one hosting bill, one set of permissions. With this pattern, a franchise that wants their own WordPress, their own static landing page, their own WIX/Squarespace, or their own Shopify storefront just embeds the iframe. They get corporate-grade chrome **without paying for corporate infrastructure or asking corporate to deploy on their behalf**.

**3. Updates ship instantly to every franchise, with no per-site deploy.**
A pricing change, a new feature, a translation fix, a security patch — corporate ships it once to `wavemax.promo`, and every franchise's host page picks it up on the next page load. No franchise-side action required, no risk of outdated copies in the wild.

**4. Isolation: a franchise compromise can't reach the corporate site, and vice versa.**
Each franchise host page lives in its own DNS, its own hosting environment, its own admin perimeter. The iframe is the only attack surface that crosses, and `frame-ancestors` in CSP locks down where the embed can be loaded. A WordPress plugin vulnerability on one franchise's site doesn't put the corporate brand at risk — the iframe content is independent.

**5. Built-in internationalization for everyone.**
The Austin reference build ships in English, Spanish, Portuguese, and German out of the box. Every franchise that adopts the pattern gets the same coverage automatically. Adding more languages is a single corporate-side change that propagates everywhere.

**6. Modular SEO at scale.**
Each iframe page emits its own `JSON-LD` (LocalBusiness, Service, FAQPage, ContactPage, BreadcrumbList) into the host page via the bridge. Google indexes the host page as the canonical URL, but the rich-results metadata comes from the corporate library. Every franchise gets first-class SEO schema with zero work on their end.

## Proof: what a single franchise can do in a week

In **the last 24 hours**, working alone, we shipped **100 commits** to this codebase:

| Category | Count | Example |
|:---|:---:|:---|
| Bug fixes (incl. reverts) | 21 | Rate-limiter MongoDB collection collision, contact-form submit handler being wiped by translation pass, stale-CSS cache problems, hero-height inheritance |
| New features | 21 | Tabbed info section, swirl-spinner modal, persona panel, sanitization deep-dive, watermark hero, stat rail, contact rate limiters, Austin reviews via Places API |
| Style + copy refinements | 11 | Color treatment, on-dark button visibility, FAQ centering, UV stat copy |
| Refactors, chores, docs | 47 | Cache-busting roll-out, SEO config schema fix, test infrastructure |

This velocity is **only possible because the architecture decouples content from infrastructure**. Each commit ships in seconds. There is no franchise-side deploy. There is no CMS to log into. There is no "wait for the corporate WordPress maintenance window."

## Visual: monolith vs modular

### Today — monolithic wavemaxlaundry.com

```
                    ┌─────────────────────────────────┐
                    │   wavemaxlaundry.com (WordPress)│
                    │   ─────────────────────────────  │
                    │   /austin-tx/        /dallas-tx/ │
                    │   /houston-tx/       /denver-co/ │
                    │   /charlotte-nc/     /...        │
                    │                                  │
                    │   ONE codebase, ONE plugin set,  │
                    │   ONE security perimeter,        │
                    │   ONE deploy pipeline            │
                    └─────────────────────────────────┘
                              ▲     ▲     ▲     ▲
                              │     │     │     │
                              │     │     │     │
                          ───┴─── ───┴─── ───┴─── ───┴───
                          franch.  franch.  franch.  franch.
                          (no choice in hosting, branding, or release cadence)
```

### Proposed — modular network

```
                    ┌─────────────────────────────────┐
                    │   wavemax.promo (CONTENT LIB.)  │
                    │   ─────────────────────────────  │
                    │   landing  ·  WDF  ·  self-serve │
                    │   contact  ·  commercial  ·  …   │
                    │   theme tokens  ·  translations  │
                    │   bridge JS  ·  SEO schema       │
                    └─────────────────────────────────┘
                              │     │     │     │
                              │ iframe embeds (postMessage bridge)
                              ▼     ▼     ▼     ▼
              ┌──────────┬──────────┬──────────┬──────────┐
              │ Austin   │ Dallas   │ Houston  │ Denver   │
              │ self-host│ MHR-host │ WIX      │ static   │
              │ WordPress│ WordPress│          │ HTML     │
              └──────────┴──────────┴──────────┴──────────┘
                Each franchise picks its own host. Corporate
                still controls every pixel of brand chrome.
```

## Visual: hosting flexibility

```
   THE BRIDGE IS HOST-AGNOSTIC

   <iframe src="…wavemax.promo/wash-dry-fold-embed.html">
                       │
        ┌──────────────┼──────────────┬──────────────┬──────────────┐
        │              │              │              │              │
        ▼              ▼              ▼              ▼              ▼
   ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
   │WordPress│    │  Static │    │  WIX    │    │ Squarespace│  │ Custom  │
   │         │    │  HTML   │    │         │    │            │  │  app    │
   │(Elementor│   │(any CDN)│    │(HTML    │    │(code block)│  │(React/  │
   │ block)  │    │         │    │ embed) │    │            │  │ Vue/etc)│
   └─────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘

   Same iframe URL. Same CSS. Same translations. Same SEO. Same forms.
   The bridge JS in each host pushes LOCATION_DATA into the iframe.
   Nothing else differs.
```

## What corporate gains

- **Centralized brand enforcement** — CSS tokens, type scale, copy voice, schema all in one repo
- **Centralized security** — CSRF, rate limiting, XSS sanitization, encrypted at-rest storage all live behind the iframe API, not duplicated per franchise
- **Faster iteration** — corporate ships a fix to `wavemax.promo` and every franchise sees it on the next page load
- **Lower hosting bill** — franchises pay for their own host pages
- **Lower coordination cost** — franchises can self-serve their content schedule instead of competing for corporate's CMS attention
- **An obvious upsell tier** — managed hosting, integrations, custom development — sold to franchises who don't want to host themselves (more on this below)

## What franchises gain

- **Their own brand presence** — franchises that want a custom domain, custom homepage, custom blog, custom locality content can have it without leaving the WaveMAX umbrella
- **Hosting choice** — pick what fits their team's skills and budget
- **No deploy waits** — they push their own host page changes; corporate iframe content updates flow in automatically
- **Cleaner permission model** — franchise admins manage only their own host; corporate owns the iframe library

## Risk profile vs the monolith

| Risk | Monolith today | Modular pattern |
|:---|:---|:---|
| One franchise's WP plugin gets compromised | Corporate site at risk | Isolated to that franchise's host |
| Corporate WordPress is down | All franchise pages dead | Iframe content unavailable; host pages still serve |
| Franchise wants a custom landing | Corporate-side ticket; weeks | Franchise edits their own host page; minutes |
| New language launch | Cross-team coordination | Single corporate change ripples to all |
| Pricing rate change | CMS edits across N pages | One LOCATION_DATA value; reflected everywhere immediately |
| Franchise leaves the network | Their WP user gets disabled, content stays | Franchise stops loading the iframe; corporate library unaffected |

---

# Section 2 — Technical Proposal

## Architecture overview

Three logical layers. Each layer has a clean interface to the next, and each can evolve independently.

### Layer 1: Host pages (per-franchise)

Whatever the franchise wants. WordPress, static HTML, WIX, custom. The minimum bar is a page that:

1. Loads `parent-iframe-bridge-v3.js` from corporate
2. Defines a `LOCATION_DATA` object with the franchise's address, hours, pricing, phone, email, etc.
3. Embeds an `<iframe>` pointing at one of the corporate library URLs

**Total host-side code:** typically 30–80 lines of HTML/JS. The bridge handles the rest.

### Layer 2: The iframe bridge

A small (~9 KB), CSP-compliant, postMessage-based message broker. Two sibling files:

| File | Loads on | Responsibilities |
|:---|:---|:---|
| `parent-iframe-bridge-v3.js` | Host page | Find iframe, push LOCATION_DATA + language to it, receive resize/SEO/modal/navigate messages back, render parent-side modals + spinners |
| `iframe-bridge-v2.js` | Each iframe page | Receive LOCATION_DATA + language, apply data-bind translations, send SEO + modal messages up |

The bridge protocol is small and stable:

```
host → iframe   { type: 'parent-ready' }
host → iframe   { type: 'current-language', data: { language } }
host → iframe   { type: 'location-data',    data: LOCATION_DATA }

iframe → host   { type: 'iframe-ready' }
iframe → host   { type: 'resize',            data: { height } }
iframe → host   { type: 'seo-data',          data: { meta, openGraph, twitter, structuredData, alternateLanguages } }
iframe → host   { type: 'show-modal' / 'hide-modal', data: { kind, title, body, ok } }
iframe → host   { type: 'navigate',          data: { href } }
```

Adding a new message type is additive — old hosts ignore unknown types.

### Layer 3: The corporate content library

A flat collection of standalone HTML pages:

- `wash-dry-fold-embed.html`
- `self-serve-laundry-embed.html`
- `commercial-embed.html`
- `contact-embed.html`
- `austin-landing-v3-embed.html`
- *(and one per service / page type the network needs)*

Each page is fully self-contained: HTML structure, CSS reference, JS init, translation dictionary, SEO config, structured-data schemas. They consume `LOCATION_DATA` from the host via the bridge. They never assume a specific host — the same page renders identically inside WordPress, WIX, or a static `<html>` document.

Backed by Express on the corporate side for:

- Per-IP rate limiting on contact-form / sensitive operations (MongoDB-backed, distributed-safe)
- CSRF protection where needed
- Mailcow SMTP relay for form submissions
- Encrypted-at-rest storage for OAuth tokens / W-9 documents
- Centralized logging + audit trail

## Hosting integration patterns

### WordPress (any host — corporate, MHR-managed, self-hosted)

```html
<!-- WordPress page or custom HTML block -->
<script>
  window.LOCATION_DATA = {
    slug: 'austin-tx',
    contact: { phone: '(512) 553-1674', address: '825 E Rundberg Ln F1', /* … */ },
    hours:   { open: '07:00', close: '22:00', display: '7am-10pm' },
    pricing: { wdf: { rate: 1.20, minLb: 10 } },
    /* … */
  };
</script>
<script src="https://wavemax.promo/assets/js/parent-iframe-bridge-v3.js?v=20260504"></script>
<iframe id="wavemax-iframe"
        src="https://wavemax.promo/wash-dry-fold-embed.html?v=20260504"
        style="width:100%;border:0"></iframe>
```

Drop into a Gutenberg "Custom HTML" block, an Elementor "HTML widget," or a Divi "Code module." No theme work, no plugin install required.

### Static HTML (any CDN / S3 / Cloudflare Pages)

Same pattern — a single `index.html` with the script tags above plus whatever local content the franchise wants around the iframe.

### WIX / Squarespace / Shopify

These platforms expose an "embed code" / "HTML block" widget. Paste the same three tags. The platform handles the rest.

### Custom application (React / Vue / etc.)

The bridge is a vanilla-JS UMD module. Mount the iframe inside whatever component framework the franchise prefers; the bridge will discover it via `MutationObserver` if the iframe arrives late.

## Per-franchise content management

The corporate library exposes the page **chrome and behavior**. Franchise-specific content goes through one of three channels:

1. **`LOCATION_DATA`** — set once on the host page. Phone, address, hours, pricing, language preferences, business name, service area.
2. **Host-page sections** — anything outside the iframe. Local blogs, owner photos, neighborhood content, custom hero — all rendered by the franchise's host CMS.
3. **Override content per slug** — corporate-side YAML/JSON keyed by slug for franchise-specific overrides (e.g. specific add-on services, equipment differences). Optional, escape hatch only.

This means a franchise can:

- Write their own blog and run it on their own WP install
- Have a unique hero image and tagline above the embed
- Run their own promotions in their own host-page promotional banner
- Localize copy if their market warrants it
- All while inheriting corporate WDF / contact / commercial pages from the iframe

## Operational guarantees baked in

The reference build already enforces these without any per-franchise effort:

- **Strict CSP** with nonce-based script-src — no inline `<script>` allowed anywhere
- **CSRF protection** on every state-changing endpoint
- **Distributed rate limiting** via MongoDB store (each limiter in its own collection — collision-free)
- **PBKDF2-SHA512 password hashing** (100k iterations) where authentication is involved
- **AES-256-GCM at-rest encryption** for OAuth tokens, payment data, W-9 documents
- **Helmet.js** with HSTS, frame-ancestors, no-sniff, referrer-policy
- **Audit logging** for every privileged action
- **Test bypass switches** so dev/test environments don't hit production rate limits
- **Cache-busting via versioned query strings** on every script + style reference

## Performance

- **Static assets** served by Cloudflare from corporate's edge — same network as `cdn.jsdelivr.net`
- **Images** served from `wavemaxlaundry.com/wp-content/uploads/` (existing corporate asset host)
- **Iframe content** ~50–80 KB gzipped per page; cached aggressively after first load
- **Cold-start parent → iframe handshake** completes in under 50 ms in browser tests
- **No franchise-side rendering load** beyond the host page itself

## SEO mechanics

- The host page is the indexable canonical
- Iframe pages emit `<meta name="robots" content="noindex">` (Google indexes the host, not the iframe)
- The bridge injects rich structured data into the **host page's** `<head>`:
  - `LocalBusiness` (LaundryOrDryCleaner, anchored by `@id` to a stable corporate identity)
  - `Service` with `Offer` + `UnitPriceSpecification`
  - `FAQPage` with the on-page FAQ Q&As (Google rich results)
  - `BreadcrumbList`
  - `ContactPage` with `PotentialAction` (CallAction, CommunicateAction)
- `alternateLanguages` (`hreflang`) for `en/es/pt/de` per page
- `<title>`, `description`, `keywords`, `og:*`, `twitter:*` — all bridged

A franchise gets a Google rich-result-eligible page **without writing a single line of schema markup**.

## What changes for MHR

The MHR engineering team transitions from "we are the only path to ship a WaveMAX page" to "we own the corporate library and the per-franchise managed-hosting tier." That is a healthier role:

- They keep direct ownership of the corporate-controlled content (the highest-value surface)
- They sell **managed host pages** as a paid service tier to franchises that don't want to host themselves
- They sell **custom integrations** (Salesforce, Mailchimp, scheduling, white-label apps) on top of the iframe API
- They retire the per-franchise WordPress drama (themes, plugins, admin escalations) — that overhead moves to the franchise that chose self-hosting

The framework itself becomes a competitive moat for MHR: **nobody else is offering franchise networks a hosting-agnostic, multi-language, SEO-rich, security-hardened embed library**.

---

# Section 3 — The Offer

## What we will build at zero cost

A **turnkey reference repository** for the WaveMAX network, derived from the production-ready Austin build, including:

- All five flagship iframe pages (landing, WDF, self-serve, commercial, contact) with full color treatment, four-language translations, structured-data schemas, and accessibility-tested controls
- The parent + iframe bridge scripts (v3 / v2 contracts)
- A reusable theme + components stylesheet (CSS tokens, button library, modal, swirl-spinner, FAQ accordion, tab control, stat rail, tile grids)
- Express backend for contact-form submission with stacked rate limiting + CSRF + Mailcow SMTP
- A `LOCATION_DATA` template schema with example values for one franchise
- Cache-busting + versioning conventions consistent with the existing affiliate-app pattern
- Playwright e2e test suite (96+ tests covering host chrome, embed rendering, i18n round-trip, contact submission, and responsive breakpoints)
- A reference WordPress plugin / shortcode that drops the host-page bootstrap into any WP site in two clicks
- Reference embed snippets for static HTML, WIX, and Squarespace
- Operational runbook covering deploys, asset versioning, cache invalidation, locale additions, and per-franchise onboarding

**Timeline: 10 working days from go-ahead to handoff.**

| Day | Milestone |
|:---:|:---|
| 1–2 | Repository scaffold, theme + components extraction from Austin build, bridge contract docs |
| 3–4 | Iframe library — landing, WDF, self-serve, commercial, contact pages |
| 5–6 | LOCATION_DATA schema + example, host-page templates (WP plugin, static, WIX) |
| 7–8 | Backend (rate limit, CSRF, mail relay), structured-data layer, e2e test suite |
| 9 | Integration testing with MHR's existing assets, security review |
| 10 | Handoff session, training, written runbook |

## Optional · paid integration & training

The repo handoff is **complete on its own**. Documentation, runbook, e2e tests, and a `CLAUDE.md`-style operational handbook ship with it. An MHR engineer who knows the codebase can pick it up and run with it without us in the room.

If MHR's staff would benefit from hands-on ramp-up support, we're available for a paid engagement. Scope to what the team actually needs — anything from a half-day Q&A through a full integration sprint:

- **Pair-programming sessions** with MHR's engineering leads
- **On-site working week** at MHR's office for hands-on integration with their existing tooling and franchise onboarding pipeline
- **Six-month support window** for incident response and architecture questions
- **Custom franchise onboardings** beyond the reference repo

**Compensation:** between **$15,000 and $25,000** depending on engagement depth and the seniority of MHR's technical team. **Plus reasonable expenses** if on-site time is requested (flight + lodging — Austin to wherever MHR is based, one trip).

This is intentionally below market rate. We want this to work. The Austin franchise benefits directly from a healthier corporate-network architecture, and we're prepared to subsidize getting it across the line if MHR wants the help.

## Why this is the right move now

- **The work is already done.** The Austin build is production-grade, deployed, and battle-tested. We are offering to package what exists, not to start over.
- **Velocity is unmatched.** The 100-commit / 24-hour cadence above is what is possible when the architecture stops fighting the developer. That cadence stays available to corporate forever.
- **The monolith is not free.** Every coordination round-trip between corporate and a franchise is a hidden cost on this codebase. The longer the network stays monolithic, the more those costs accumulate — both in dev hours and in lost franchise opportunity.
- **The competitive landscape rewards this pattern.** Franchise networks with better corporate-to-local content velocity outperform peers in local SEO, conversion, and franchise satisfaction. WaveMAX is well-positioned to lead.
- **There is a clear paid product layer for MHR on top of this.** Managed hosting, custom integrations, multi-location dashboards, white-label apps — all become natural offerings once the iframe contract is the universal interface.

## Decision points for the executive group

1. **Approve the turnkey reference build** — Austin commits to deliver in 10 working days at no cost
2. **Optionally engage Austin for the integration phase** — $15K–$25K + expenses, scoped to whatever MHR's team actually needs (skip if MHR engineering is comfortable owning the repo from the handoff)
3. **Pilot with two or three franchises** — recommend Austin + one MHR-managed location + one currently struggling location, so we exercise all three host scenarios at once
4. **Set the network rollout timeline** — Austin can support 1–2 onboardings per week post-handoff for whichever franchises opt in

## Closing

We have already proven this works. We have a working reference build, a deployed iframe library, four languages, comprehensive SEO schema, a polished modal-and-spinner system, a security-hardened backend, and 96 passing e2e tests. **We are offering to give all of it to the network.**

If corporate and MHR see the same value we do, we'll have a turnkey repo on a branch in MHR's hands inside two weeks. The network gets faster, more flexible, and more secure. MHR gets a defensible product layer to sell on top. Franchises stop competing for CMS attention. And every customer landing on a WaveMAX page — wherever it's hosted — gets the same first-class experience.

We want this to work. Let's build it.

---

*Contact for questions, access to the reference build, or to schedule the kickoff meeting:*

- **Rick Houlihan** — `rick.houlihan@gmail.com` *(implementation lead)*
- **Colin Houlihan** — *(Austin franchise owner / decision contact)*

*Reference build live at:* https://wavemax.promo/dev/austin-host-mock.html?route=/

*This proposal and all derivatives may be redistributed by MHR and corporate to franchise stakeholders.*
