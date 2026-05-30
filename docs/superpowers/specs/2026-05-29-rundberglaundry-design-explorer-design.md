# rundberglaundry.com Design Explorer — Design Spec

**Date:** 2026-05-29
**Status:** Approved (brainstorming) → pending implementation plan
**Owner:** CRHS / Rick Houlihan

---

## 1. Purpose

Produce **three distinct website design directions** for the WaveMAX Austin
(rundberglaundry.com) local-marketing site, each in **two brand intensities**
(brand-heavy and brand-light), and deliver them to the franchisor for review as a
single **interactive explorer** hosted at a private URL on CRHS infrastructure.

The goal is to give the franchisor real, polished options — not to compete with the
corporate site. Each design must:

- **Integrate and enhance the WaveMAX brand** (never remove it), at two intensities.
- **Deliberately diverge from the corporate site's chrome/structure**, so it does not
  read to a consumer as the same site (this is the anti-confusion requirement, and it
  is also what defuses any "you are competing with us" objection).
- Carry the **FA §12.2** trademark / license / independently-owned notices in every state.
- Demonstrably exceed the corporate platform on quality (performance, accessibility,
  semantic structure, working i18n, real reviews).

**Strategic context (for counsel, not consumer-facing):** this deliverable doubles as the
FA §6.1(a) local-marketing-plan submission. Offering six compliant, branded,
demonstrably-superior, deliberately-non-corporate options operationalizes CRHS's stated
willingness to "conform to whatever reasonable presentation the franchisor specifies,"
and makes a further denial harder to defend. Margolis should be looped on the framing.

## 2. Deliverable: the explorer

A single-page web app at a private, tokened URL on CRHS infra
(e.g. `https://wavemax.promo/design-explorer?k=<token>`). It is a **review tool**, not
just a gallery.

**Controls (top/side bar):**
- Direction: `1 Service OS` · `2 Neighborhood Editorial` · `3 Austin Bold`
- Intensity: `Brand-Heavy` · `Brand-Light`
- Page: `Home` · `Self-Serve` · `Wash-Dry-Fold` · `Commercial` · `About` · `Contact`
- Language: `EN` · `ES` (the working toggle is itself a feature vs. the corporate site)
- Device: `Desktop` · `Mobile` (renders the selected viewport in a frame)

**Live preview:** renders the selected (direction × intensity × page × lang × device).

**Rationale rail (collapsible):** per-state notes — "what is WaveMAX here," "§12.2
placement," "how this differs from corporate," conversion + performance notes. This is
what makes it a franchisor review tool.

**Concierge:** the AI concierge is embedded in each rendered design and is **live**
(calls the CRHS backend, which proxies to the Claude API).

Total rendered states: 3 directions × 2 intensities × 6 pages = **36**, all driven from
one shared content model.

## 3. Architecture

```
content model (1)  ──┐
                     ├──►  render(skin, intensity, page, lang)  ──►  live preview
3 design skins ──────┤
2 intensity themes ──┘
```

- **Content model (one):** the existing rundberglaundry copy, lifted from
  `public/franchise-default/*.html` and the i18n JSON (`public/locales/{en,es,pt,de}/`),
  restructured as structured data (sections, cards, NAP, FAQ, reviews). Shared across all
  designs — "mostly the same content" means the *content* is constant; only presentation
  changes.
- **Three design skins:** each is a template set + CSS that renders the shared content
  model in its own layout/typographic/visual language.
- **Two intensity themes:** CSS-variable sets (palette, logo prominence, §12.2 placement)
  layered on top of any skin.
- **Explorer shell:** orchestrates control state → `render()` → preview frame + rationale.

This keeps 36 states DRY (no 36 hand-authored files) and means the winning direction is
~80% production-ready.

**Stack & constraints (CRHS standards):**
- Vanilla JS (ES6+), CSS. No framework dependency for the rendered designs.
- **Strict CSP**: nonce-based, no inline executable scripts. `style-src` may use the
  existing documented `'unsafe-inline'` trade-off only where required.
- **i18n** via the existing `data-i18n` mechanism; maintain EN/ES at minimum for the
  explorer, with PT/DE carried in the content model for production parity.
- **Lighthouse target ~100** on **mobile and desktop** for each rendered design (explicit
  contrast with the corporate site's 38-mobile / 20.5s-LCP).
- Reuse the existing brand asset (`public/assets/images/brand/logo-wavemax.png`) and the
  §12.2 notice text already used in `public/terms-and-conditions.html`.

## 4. The three directions

All three are genuinely different UI philosophies (not recolors), each mapped to a
current design axis.

### Direction 1 — "Service OS" (agentic · bento · utility-first)
- **Philosophy:** the site behaves like a product, not a brochure.
- **Layout:** bento grid; hero is a grid of live tiles (Self-Serve · WDF · Commercial ·
  Open-now status · Map · Book-a-pickup).
- **Signature UI:** AI concierge front-and-center ("What are you washing today?") that
  routes to the right service and *starts* a pickup booking; sticky mobile action bar
  (Call / Directions / Book); open-now status chip; WDF turnaround chip.
- **Type:** a characterful geometric grotesk (proposal; not Inter/Roboto).
- **Why it wins:** showcases CRHS's engineering edge; maximally unlike a brochure.

### Direction 2 — "Neighborhood Editorial" (warm · photography-led · minimalism)
- **Philosophy:** a beloved local institution, told as a magazine.
- **Layout:** editorial, asymmetric grid; big warm photography of the store + the
  Rundberg block; generous whitespace.
- **Signature UI:** story-driven hero; **real** local Google reviews via the Places API
  (honest, and a pointed contrast to the corporate site's fabricated/templated reviews);
  a language toggle that visibly works; "from the Rundberg neighborhood" framing.
- **Type:** a distinctive display serif over a clean sans body.
- **Why it wins:** highest trust/emotional pull; authentically local.

### Direction 3 — "Austin Bold" (expressive · character-forward · controlled-brutalist edge)
- **Philosophy:** memorable and high-energy.
- **Layout:** bold color blocks, big expressive type, intentional asymmetry, CSS
  wave-motion.
- **Signature UI:** expressive headlines; CSS wave animation; tactile micro-interactions;
  tasteful North-Austin mural/hand-lettering accents; confident voice.
- **Type:** an expressive heavy display + a readable sans.
- **Why it wins:** strongest brand recall; unmistakably not a generic laundromat and not
  the corporate site.

Specific fonts, exact palettes, and motion details are proposed during implementation
(the frontend-design skill) and shown in the explorer for selection.

## 5. Brand-intensity system

Applied identically across all three skins, as a theme layer.

- **Brand-Heavy:** WaveMAX is the visual lead — logo prominent, WaveMAX teal/navy
  dominant, wave motif throughout, "WaveMAX Austin" as the name. Still CRHS's own design
  system — **never the corporate Divi chrome.**
- **Brand-Light:** WaveMAX clearly present but supporting — local North-Austin identity
  leads visually (terracotta / cream / ink), WaveMAX logo present but smaller,
  "independently owned · licensed WaveMAX," teal as accent. **Endorsed, not erased.**
- **Both** carry the §12.2 trademark/license/independently-owned notice and **both**
  visibly diverge from the corporate chrome.

## 6. The concierge (live Claude)

- Shared component, styled per skin.
- Flow: client → `POST /api/concierge` (CRHS Express backend) → Claude API.
- **Prompt caching** on the system prompt (per the claude-api skill): cached context =
  WaveMAX Austin services, hours, pricing, NAP, FAQ.
- **Capabilities:** answer questions; route the user to the correct service page; *start*
  a pickup booking (agentic — pre-fills the existing schedule-pickup flow). Handles
  Spanish naturally.
- **Security:** Anthropic key server-side only; never in client code or CSP allowlist;
  rate-limited; input sanitized; responses constrained to the store's domain of
  knowledge. CSP-clean (no inline scripts).
- Model: a current Claude model (selected at build; default to the latest cost-appropriate
  tier for a concierge — e.g. Haiku/Sonnet class — confirmed during implementation).

## 7. North-Austin / Rundberg character

Authentic to the actual neighborhood — diverse, multilingual, working-community — **not**
touristy 6th-Street Austin. Expressed as: genuine bilingual treatment, community/local-
pride copy, a warm practical tone, and tasteful local visual cues (terracotta warmth,
neighborhood photography). Consistent intent across all three skins; expressed differently
per skin.

## 8. Page set

All six rundberglaundry marketing pages, each in every direction × intensity:
`Home/Landing` · `Self-Serve Laundry` · `Wash-Dry-Fold` · `Commercial` · `About Us` ·
`Contact`. Content lifted from `public/franchise-default/*` and the i18n JSON.

## 9. Build phases (for the implementation plan)

1. Content model (extract + structure existing copy/i18n) + explorer shell + theming
   system (skin/intensity/page/lang/device switching, rationale rail).
2. Direction 1 (Service OS), both intensities, all 6 pages.
3. Direction 2 (Neighborhood Editorial), both intensities, all 6 pages.
4. Direction 3 (Austin Bold), both intensities, all 6 pages.
5. Concierge backend (`/api/concierge`, Claude + prompt caching) + integration into all
   skins.
6. Polish: Lighthouse ~100 mobile+desktop per design; accessibility pass; deploy to the
   private explorer URL on both OCI boxes.

## 10. Out of scope (YAGNI)

- No production cut-over of rundberglaundry.com (it remains the noindex coming-soon page
  until the franchisor approves a direction). The explorer is a review artifact.
- No new backend features beyond the concierge proxy (reuse the existing schedule-pickup
  flow for booking).
- PT/DE are carried in the content model for production parity but the explorer's language
  toggle ships EN/ES (the two that matter for North Austin and for demonstrating a working
  toggle); PT/DE can be added if the franchisor asks.
- No A/B testing, analytics dashboards, or CMS. Static content model is sufficient.

## 11. Skills for implementation

`frontend-design` (the three looks), `claude-api` (concierge + prompt caching),
`playground` (explorer-shell pattern), `chrome-devtools`/Lighthouse (verify ~100).

## 12. Success criteria

- Explorer renders all 36 states correctly, EN/ES, desktop/mobile, behind the private URL.
- Each design is visibly distinct from the other two **and** from the corporate site.
- Both intensities present WaveMAX appropriately and carry §12.2 notices.
- The concierge answers, routes, and can start a booking — live — in at least one design.
- Each direction hits ~100 Lighthouse on mobile and desktop (or a documented, justified
  exception).
