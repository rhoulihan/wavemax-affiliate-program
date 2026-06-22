# CRHS site — constructivism design directions (3 variants)

Three directions from the design panel. The proposal RECOMMENDS the editorial/technical one ("RED BUREAU"); runner-up is the refined one ("Red Square").


---

## Red Square  _(variant: refined)_

**Concept:** A near-monochrome ink-on-white page governed by a strict 12-column modular grid, with a single disciplined Signal Red used structurally — rule-lines, one hero diagonal, eyebrow bars, numbered section markers, and stat numerals — never as decoration. It reads as a serious holding company / engineering practice with impeccable taste, not a 1920s poster pastiche. It deliberately pivots off the current slate/blue CRHS palette toward the red/black/white heritage while keeping the existing external-CSS-only, strict-CSP discipline.

**Palette:** Ink #111418 (primary text, dark bands) | Paper #FFFFFF (page bg) | Bone #F4F2EE (warm off-white alt bands) | Signal Red #C8102E (heritage accent: rules, hero diagonal, key numerals, on-ink elements — reserved for large/bold/on-dark use) | Red-Ink #9E0C24 (darker red for body-size links; clears WCAG AA 4.5:1 on white) | Steel #5B6470 (secondary/muted text, AA on white) | Hairline #DDD9D2 (1px grid dividers).

**Typography:** Display: Archivo / Archivo Expanded (Google Fonts, self-hostable) — a blunt geometric grotesque with engineered, constructivist character; set UPPERCASE with tight tracking for the wordmark, H1, H2. Body + UI: Inter — neutral, highly legible workhorse for long credibility copy. Numerals: Archivo tabular in stat blocks so the grid stays true. Fallback: -apple-system, Segoe UI, Roboto, sans-serif. Both are web-safe, self-hostable, zero exotic deps — CSP-clean and Lighthouse-100 friendly. A single blunt geometric sans paired with a neutral workhorse delivers propaganda-poster authority without costume.

**Layout language:** 12-column modular grid, 1080px max, hard left baseline for all headings (no centering). Devices used sparingly and structurally: (1) one 3-degree red diagonal slicing the hero band, echoed once as a section transition; (2) a thick-then-thin red rule pair above every eyebrow label; (3) a recurring large outlined circle + vertical red bar motif on dark bands; (4) asymmetric balance — heading column heavy-left, figure offset right; (5) numbered section markers 01/02/03 in red tabular numerals sitting on a gridline; (6) photomontage reserved for the founder block — Rick hard-cropped into a grid cell with a red registration bar. Generous whitespace keeps it boardroom, not busy.

**Motifs:** Thick-then-thin red rule pair above each eyebrow label, Single 3-degree red hero diagonal, echoed once mid-page as a section transition, Numbered section markers (01/02/03) in red tabular numerals on a gridline, Large outlined circle + vertical red bar on dark bands, Hard-cropped photomontage founder cell with a red registration bar, Tabular-numeral stat blocks aligned to the modular grid


**Homepage wireframe:**
```
+--------------------------------------------------------------+
|  CRHS ENTERPRISES                              ABOUT  WORK    |  <- masthead: Archivo Expanded wordmark, thin red underline
+--------------------------------------------------------------+
|                                                              |
|  == (thick red rule)                                         |
|  -  (thin red rule)                                          |
|  HOLDING + ENGINEERING            \                          |
|                                     \   <- 3deg red diagonal  |
|  BUILT TO SHIP.                      \      slicing hero band |
|  PRICED TO SCALE.                     \                       |
|                                        \                     |
|  Steel-grey lede, max 60ch, left-set.   \                    |
|                                          \                   |
|  [ SEE THE WORK ]   [ CONTACT ]           \                  |
|                                                              |
|  01 / 9 PATENTS    02 / 40 YRS    03 / FIELD CTO  (tabular)  |
+--------------------------------------------------------------+
| BONE BAND                                                    |
|  == -                                                        |
|  01  WHAT CRHS IS                                            |
|  -------------------------------+----------------------------|
|  Heavy-left heading column      |  Right-offset body copy +  |
|  (asymmetric grid)              |  3 short capability lines  |
+--------------------------------------------------------------+
| PAPER                                                        |
|  == -                                                        |
|  02  THE PORTAL  (flagship product)                          |
|  +----------------+ +----------------+ +----------------+     |
|  | screenshot     | | screenshot     | | inline-SVG     |     |
|  | (browser bar)  | | (browser bar)  | | process flow   |     |
|  +----------------+ +----------------+ +----------------+     |
|  caption            caption            caption              |
+--------------------------------------------------------------+
| INK BAND (dark)                                              |
|   (O) | <- outlined circle + vertical red bar motif          |
|  == -                                                        |
|  03  THE OPERATOR                                            |
|  +-------------+  RICK HOULIHAN                               |
|  | photo cell  |== Field CTO . 40-yr veteran . WaveMAX owner |
|  | red reg bar |  Steel-on-ink bio, 2 short paragraphs.      |
|  +-------------+  creds: Oracle AI DB . MongoDB . AWS NoSQL  |
|                  . Zenoss VP Eng . 9 US patents             |
+--------------------------------------------------------------+
| BONE BAND - CTA                                              |
|  == -                                                        |
|  WANT THIS BUILT?              [ GET IN TOUCH -> ]           |
|  One line, operator-to-investor.                            |
+--------------------------------------------------------------+
| FOOTER (ink): (c) 2026 CRHS Enterprises, LLC   . red mark   |
+--------------------------------------------------------------+
```

**Pros:** Maximally investor-safe: ink-on-white plus restrained red reads as established, governed, and senior — credibility first, novelty second.; The single structural-red discipline differentiates sharply against the sea of slate/blue SaaS pages without risking taste.; Buildable with zero exotic dependencies (two self-hostable fonts, plain CSS grid, inline-SVG diagonals) — fully CSP-clean and Lighthouse-100 friendly.; The grid + rule-line system scales cleanly to the existing /owners product page, giving CRHS one coherent design language.; A dedicated founder dossier (40 yrs, 9 patents, Field CTO Oracle/MongoDB, AWS NoSQL leader) serves both the investor and the technical-consultant reader.

**Cons:** Restraint is the point and the risk: executed timidly it drifts toward generic minimalism — the red diagonals and numbered markers must be committed to or the constructivist signal disappears.; Heritage red on white needs WCAG AA care for small text (mitigated by the darker Red-Ink token and reserving Signal Red for large/bold/on-ink use).; Uppercase Archivo Expanded headings demand tight tracking and line-length QA to read authoritative rather than shouty.; A near-monochrome palette puts heavy weight on copy quality and a high-grade founder photo; weak content would show immediately.


---

## RED FORMATION — A Constructivist Corporate System for CRHS Enterprises  _(variant: bold)_

**Concept:** A disciplined, high-contrast take on Russian Constructivism rebuilt as a modern engineering brand: red/black/white, a hard modular grid, oversized geometric headlines set on bold diagonals, angled section dividers, and a single photomontage hero (Rick + system diagrams + data). It reads as CLEAN/CORPORATE because the propaganda-poster energy is rationed — one diagonal gesture and one accent color per screen, generous whitespace, and a strict grid carry the senior tone, so the result feels like a precision instrument (a data-architecture firm) rather than a 1920s pastiche. The whole site says one thing: this person builds the real thing, and has for 30 years.

**Palette:** Ink Black #0A0A0A (primary text, bars, masthead) · Pure White #FFFFFF (canvas, knockout type on red/black) · Signal Red #D8232A (single accent: diagonals, rule-bars, key numbers, links — WCAG: white-on-red 4.7:1 AA for ≥18px/bold, black-on-red 4.5:1; reserve red for large/bold or on black) · Paper #F4F1EA (warm off-white alt-section ground, softens the poster glare for body-heavy areas) · Steel #5B5F66 (captions, metadata, secondary text on white — 5.9:1 AA) · Hairline #1A1A1A (1–2px rule-lines, grid ticks). Strictly tri-color discipline: red is never decorative, only structural/emphatic. Body copy is always Ink-on-White or White-on-Ink, never red-on-white at small sizes.

**Typography:** Display: "Archivo" (Google Fonts, weights 700/800/900, plus Archivo Expanded for the masthead) — a geometric grotesque with the squared, mechanical authority of constructivist lettering but engineered for screen legibility; set huge, tight tracking (-0.02em), UPPERCASE for hero/section numbers, often rotated on the diagonal. Alt display: "Oswald" if a more condensed propaganda-banner feel is wanted for kickers. Body/UI: "Inter" (400/500/600) for paragraphs, captions, nav — neutral, highly legible, carries the "senior/corporate" register and keeps long technical copy comfortable. Numerals: Archivo tabular for stat blocks (30 YEARS / 87% / 11M ROWS). Why it fits: geometric sans + extreme weight contrast + uppercase mechanical headers is the literal constructivist type voice, while Inter body keeps it premium and readable — both are free, self-hostable (CSP-clean, no external font CDN required), and need no JS.

**Layout language:** 12-column modular grid with a visible 1px hairline tick system (the grid is part of the aesthetic, lightly shown at section edges). Devices, used one-at-a-time per section so it never gets noisy: (1) a single dominant DIAGONAL — a red wedge or a -8°/-15° angled band that slices the hero and recurs as angled section dividers (clip-path, pure CSS); (2) RULE-BARS — thick red/black horizontal bars that label sections like a poster ("01 / WHO", "02 / WHAT I'VE BUILT"); (3) oversized SECTION NUMERALS set in the margin (01–06) for rhythm; (4) CIRCLES + BARS as a small geometric motif kit (concentric rings, dots, a quarter-circle) anchoring stat callouts; (5) ASYMMETRIC BALANCE — headline hard-left, supporting block offset right, never centered; (6) one PHOTOMONTAGE hero — Rick cut out hard-edged over a black field with a faint system-diagram/data layer and a red bar behind. Motion is restrained: bars wipe in, numerals count up, diagonal reveals on scroll — all CSS/IntersectionObserver, no libraries. Everything snaps to the grid; the diagonal is the only thing allowed to break it.

**Motifs:** Single red diagonal wedge / -8°–-15° angled section dividers (CSS clip-path, the one allowed grid-breaker), Thick red & black rule-bars as poster-style section labels ('02 / PROOF'), Oversized margin numerals 01–06 setting page rhythm, Geometric kit: concentric circles, dots, quarter-circles, vertical red ▌ tick before the wordmark and copyright, Hard-edged photomontage hero (subject cut out over black, faint data/diagram layer, red bar behind), Tabular Archivo numerals for stat callouts that count up on scroll, Visible 1px hairline grid ticks at section edges — the grid as ornament, Mono/uppercase kickers on case cards with a red rule-top


**Homepage wireframe:**
```
┌──────────────────────────────────────────────────────────────────────┐
│ ▌CRHS ENTERPRISES            WORK   APPROACH   WRITING   CONTACT  [→]   │  ← masthead: red ▌tick + Archivo Expanded wordmark, hairline under
├──────────────────────────────────────────────────────────────────────┤
│██████ RED DIAGONAL WEDGE ████╲                                          │
│ 01 ─────────────────────────  ╲      ┌───────────────────┐             │
│                                ╲     │  PHOTOMONTAGE      │             │
│  WE BUILD THE                   ╲    │  Rick (hard cut)   │             │
│  REAL THING.                     ╲   │  over black + data │             │  ← HERO: huge Archivo 900 uppercase, hard-left,
│  ───────────────                  ╲  │  layer, red bar    │             │     asymmetric; diagonal slices toward montage
│  30 years of data architecture.   ╲ │  behind subject    │             │
│  Systems that ship, scale, and    ╲ └───────────────────┘              │
│  outperform the incumbents.        ╲                                    │
│  [ SEE THE WORK → ]   [ APPROACH ]  ╲                                   │
├═══════════════ thick black rule-bar ═══════════════════════════════════┤
│ 02 / PROOF              ▮ 30 YRS   ▮ 87% FASTER   ▮ 11M ROWS  ▮ DUAL-AZ │  ← stat strip: tabular Archivo numerals, red ▮ ticks, circles motif
├──────────────────────────────────────────────────────────────────────┤
│ ╱ ANGLED DIVIDER -8° ╱                                                  │
│ 03 / WHO                                                                │
│  RICK HOULIHAN              │  Field CTO, Oracle. Inventor of DynamoDB  │
│  ●○ concentric motif       │  Single-Table Design. Author, Unified     │  ← asymmetric two-col, numeral in margin
│                            │  Model Theory. 30 yrs: Amazon→Mongo→Oracle│
├──────────────────────────────────────────────────────────────────────┤
│ 04 / WHAT I'VE BUILT          (Paper #F4F1EA ground — calmer band)      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                              │
│  │ WAVEMAX  │  │ HELIX    │  │ JRDM /   │   ← case cards: red rule-top, │
│  │ dual-AZ  │  │ -87% q   │  │ UMT      │     mono kicker, hard corners,│
│  │ OCI/ADB  │  │ latency  │  │ tooling  │     hover = red bar wipe      │
│  └──────────┘  └──────────┘  └──────────┘                              │
├──────────────────────────────────────────────────────────────────────┤
│ ╲ ANGLED DIVIDER ╲                                                      │
│ 05 / APPROACH         TDD · access-pattern modeling · measured          │
│  Big numbered list 01–04, red bars as bullets, poster rhythm           │  ← method as manifesto, restrained
├═══════════════ black footer slab ══════════════════════════════════════┤
│ 06  CRHS ENTERPRISES, LLC — Texas        admin@crhsent.com    [ ↑ TOP ] │
│     ▌ © 2025 CRHS Enterprises, LLC. White-on-ink, red ▌tick, hairline. │
└──────────────────────────────────────────────────────────────────────┘
```

**Pros:** Most distinctive and memorable of the corporate-site options — investors and architects will remember it; nobody else in data-architecture consulting looks like this; The poster discipline (one diagonal, one accent, hard grid) reads as precision/engineering rigor, reinforcing the 'we build the real thing' thesis; Tri-color + heavy type contrast photographs and screenshots beautifully — works for decks, LinkedIn, and the keynote brand halo; Zero exotic dependencies: self-hosted Archivo/Inter, pure CSS diagonals/animation, IntersectionObserver — CSP-clean and consistent with the existing inline-style crhsent pages and Lighthouse-100 bar; Heritage red/black/white at large/bold sizes hits WCAG AA comfortably when red is kept structural, not body text; Scales to subpages (Work, Approach, Writing) with the same numeral+rule-bar system — a real system, not a one-off hero

**Cons:** High-contrast/bold is polarizing — if executed even slightly heavy-handed it tips from 'senior' to 'loud'; needs ruthless restraint (rationing red, whitespace) to stay premium; Red is contrast-fragile: it must never be used for small body text or thin lines on white, which constrains the palette and demands AA spot-checks on every red surface; Diagonals/clip-paths need careful responsive handling (mobile reflow, text never crossing the wedge) or they clip content and hurt accessibility/Lighthouse; Photomontage hero depends on one strong cut-out portrait of Rick + a tasteful data layer; a weak asset undercuts the whole direction; The propaganda-poster lineage carries political connotations — must stay clearly abstract/corporate (no slogans, fists, stars) to avoid misreading; Bold geometric uppercase display can reduce scannability if overused; long technical copy must live in calm Inter body bands (the Paper sections) to stay readable


---

## RED BUREAU — Editorial / Technical Constructivism  _(variant: editorial)_

**Concept:** A precise Swiss-International system wearing a constructivist accent: a strict 12-column grid and flush-left typographic hierarchy do the "clean corporate" work, while a single load-bearing red, hard angled dividers, and rule-lines/circle motifs supply the constructivist energy — restrained to ~10% of the surface so it reads as engineering rigor, not poster pastiche. The page treats data and schematics as the hero artwork (the patents, the architecture diagrams, the dual-region topology become framed "plates" with monospace figure-numbers and captions), which is exactly how a technical consultant evaluates capability and how an investor reads track record. It's a dossier, not a brochure — confident, senior, and provably real.

**Palette:** Heritage three-color core, extended just enough for WCAG-AA on a light surface and a dark "plate" surface.
- Paper White `#F7F5F0` — primary background (warm, archival, not clinical #fff). Role: page canvas.
- Carbon `#141414` — primary ink + headings + the constructivist black blocks. Contrast on Paper = 15.8:1.
- Bureau Red `#C8102E` — THE accent: rules, the diagonal slash, active states, figure numbers, one word per heading max. On Paper = 5.4:1 (AA for text ≥normal, AAA large); on Carbon = 4.0:1 (use for large/bold only or as fills, never small body). Reserve red for ≤10% of pixels.
- Ink Slate `#3A4452` — secondary body text / captions on Paper = 8.9:1. (Ties to the existing site's slate so it's not a hard brand break.)
- Hairline `#D9D5CC` — 1px modular grid rules, table borders, plate frames.
- Signal Off-White `#EDEAE3` — alternating band / table-zebra on Paper.
- Plate Black `#0F1115` — dark schematic plates (architecture/topology figures) so diagrams read as backlit blueprints; text on it is Paper White (14.6:1) with Bureau Red figure labels.
Accessibility rule baked in: red is never the only signal (always paired with weight, an underline, or a "▸" / "■" glyph), and never used for small body copy on dark.

**Typography:** Three-voice system, all Google Fonts or system — zero exotic deps, self-hostable for CSP/perf.
- DISPLAY — `Archivo Expanded` (Google), 700/800, wide constructivist grotesque. Used for H1/H2 in ALL-CAPS with tight tracking (-0.5px) and one red word. Geometric, bold, propaganda-poster proportions made corporate. Fallback: `Arial Narrow`→system.
- BODY / UI — `Inter` (Google) 400/500/600, the Swiss neutral workhorse. Captions, lede, nav, cards. Excellent hinting = high Lighthouse + crisp AA contrast. (If avoiding all webfonts for perf, the existing `-apple-system,"Segoe UI"` stack substitutes cleanly.)
- TECHNICAL — `IBM Plex Mono` (Google) 400/600 — the signature voice for the technical-consultant audience: figure numbers (FIG. 01), patent IDs, the dual-region topology labels, metrics, kicker eyebrows, footer. Monospace = "this person ships systems," not marketing.
Why it fits: constructivism prized bold sans display + utilitarian secondary type. Archivo Expanded gives the heroic geometry; Plex Mono gives the technical/blueprint register; Inter keeps it senior and readable. Type does the heavy lifting so ornament stays minimal.
Scale (modular, 1.25): H1 clamp(40px,6vw,68px) / H2 32px / H3 20px / lede 19px / body 16px / mono-label 12px tracked +0.14em.

**Layout language:** Devices, used surgically (the rule: structure is Swiss; accents are constructivist):
- GRID: strict 12-col, 1140px max, 24px gutter; everything snaps. Flush-left text blocks, generous asymmetry (content often sits in cols 1–8, a mono "stat rail" or figure caption in 9–12).
- DIAGONAL: ONE governing diagonal — a Bureau Red slash that cuts the hero corner and recurs as a 4° angled section-divider (clip-path, CSS only) between major bands. Never tilt body text (keeps it legible + AA).
- RULE-LINES & BARS: 2px Carbon hairlines open every section; a short 48px Bureau Red bar above each H2 (the "kicker bar"). Numbered section index down the left margin in mono (01 / 02 / 03 …) — constructivist enumeration as nav.
- CIRCLE/BAR MOTIF: a thin outlined circle + filled square as a repeating wordmark/bullet glyph; a quarter-circle red arc anchors the hero and the footer (balances the diagonal). Decorative only, aria-hidden.
- PLATES (the signature): diagrams/credentials presented as bordered "plates" — Hairline frame, mono FIG. number top-left, red caption rule bottom; architecture/topology plates invert to Plate Black. This is where "schematics as art" lives.
- PHOTOMONTAGE, restrained: Rick's portrait duotoned (Carbon + Paper) inset into a hard-edged grid block with a red corner notch — montage energy without collage clutter.
- MOTION: minimal, reduced-motion-safe — a 1px rule "drawing" in on scroll, number count-up on the metrics. No parallax.

**Motifs:** Bureau Red diagonal slash — one governing 4° angle, reused as the hero corner cut and the section dividers (clip-path, pure CSS), Mono section-index numerals (01–06) running down the left margin as constructivist enumeration / wayfinding, The 48px red 'kicker bar' stacked above every H2 — the page's most repeated signature, Outlined-circle + filled-square wordmark/bullet glyph (◯■) — the constructivist geometry distilled to one mark, FIG.NN plates: Hairline-framed figures with monospace figure numbers and a red caption rule — turns diagrams/credentials into archival exhibits, Plate-Black blueprint band — architecture & dual-region topology rendered as backlit schematics (schematics-as-art), Duotone (Carbon/Paper) portrait with a hard red corner notch — restrained photomontage, Red quarter-circle arc anchoring hero + footer to balance the diagonal, Monospace stat/credential rails with hairline dividers (40 YRS · 09 PATENTS · …)


**Homepage wireframe:**
```
┌────────────────────────────────────────────────────────────────────┐
│ ●■ CRHS ENTERPRISES                          CAPABILITIES  WORK  ▸CONTACT│  sticky, Paper bg, 1px Carbon underline
├────────────────────────────────────────────────────────────────────┤
│ 01 ──                                                          ╱╱╱╱╱╱ │  ← red diagonal slash, top-right corner
│                                                              ╱╱╱╱╱╱   │
│  FIG.00 / DOSSIER                          ┌───────────────┐         │
│  ┌───────────────────────────────────┐    │  ◜            │         │
│  │ ENGINEERING AT                     │    │  duotone       │         │  H1 Archivo Expanded, caps
│  │ ENTERPRISE  S C A L E.             │    │  portrait      │         │  "SCALE." word = Bureau Red
│  │              ───────[red]          │    │  (Carbon/Paper)│         │
│  └───────────────────────────────────┘    │            ◞  │ ◤notch  │
│  Lede (Inter, slate, 60ch): A Texas        └───────────────┘         │
│  technology holding company. Production     ╲ red quarter-arc anchor  │
│  systems, applied AI, and shipped product.                            │
│  [ ▸ SEE THE WORK ]  [ DOWNLOAD CAPABILITIES ]   ← btns: filled / ghost│
│                                                                        │
│  ── mono stat rail ───────────────────────────────────────────────── │
│  40 YRS │ 09 US PATENTS │ FIELD CTO ×2 │ AWS WW TECH LEADER, NoSQL    │  IBM Plex Mono, hairline-divided
├════════════════════════ 4° red angled divider ══════════════════════┤
│ 02 ──  ▌WHO WE ARE                                                    │  kicker: 48px red bar + caps H2
│                                                                        │
│  CRHS Enterprises, LLC is the practice of Rick Houlihan — four        │  2-col asym: text cols 1-7,
│  decades building and operating data systems at global scale...       │  mono pull-quote card cols 9-12
│  ┌──────────────────────────────────────────┐  ┌─────────────────┐  │
│  │ Oracle AI Database · MongoDB · AWS · Amazon │  │ "9 PATENTS.      │  │
│  │ Zenoss — leadership across the NoSQL era    │  │  GRANTED, NOT    │  │
│  └──────────────────────────────────────────┘  │  PENDING."  ■    │  │
├──────────────────────────────────────────────── └─────────────────┘ ┤
│ 03 ──  ▌CAPABILITIES                                                  │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐   3-up plate grid     │
│  │ ◯  FIG.01  │ │ ◯  FIG.02  │ │ ◯  FIG.03  │   Hairline frames,    │
│  │ DATA AT    │ │ APPLIED AI │ │ PRODUCT &  │   mono FIG no.,        │
│  │ SCALE      │ │ SYSTEMS    │ │ DELIVERY   │   red caption rule     │
│  │ ─[red]     │ │ ─[red]     │ │ ─[red]     │                        │
│  └────────────┘ └────────────┘ └────────────┘                        │
├──────────────────────────────────────────────────────────────────────┤
│ 04 ──  ▌PROOF OF WORK            ◜ PLATE BLACK (dark schematic band) ◞ │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │ FIG.04  DUAL-REGION ACTIVE-ACTIVE TOPOLOGY      [red labels]   │    │  blueprint plate:
│  │   ┌──oci1──┐        ┌──CF LB──┐        ┌──oci2──┐              │    │  the WaveMAX/HA system
│  │   │ PHX-2  │◄──────►│  round  │◄──────►│ PHX-1  │   schematic   │    │  as ART — Plate Black bg,
│  │   └───┬────┘        │  robin  │        └───┬────┘  as art       │    │  Paper-white strokes,
│  │       └─────────► Oracle ADB (Exadata) ◄───┘                   │    │  red figure callouts
│  └──────────────────────────────────────────────────────────────┘    │
│  ▸ Case: WaveMAX owner portal — built & operated solo. [READ →]        │
├════════════════════════ 4° red angled divider ══════════════════════┤
│ 05 ──  ▌SELECTED PATENTS & RECOGNITION                                │
│  09 │ US-XXXXXXX  Distributed indexing ............... mono table     │  zebra Signal Off-White rows,
│  08 │ US-XXXXXXX  ...                                                  │  Plex Mono, red row-number col
│  ...                                                                   │
├──────────────────────────────────────────────────────────────────────┤
│ 06 ──  ▌ENGAGE                                                        │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │  ╲red arc      BUILD SOMETHING                                  │    │  Carbon block, red arc,
│  │                THAT  S H I P S.   [red]    [ ▸ START A CONVO ]  │    │  single CTA
│  └──────────────────────────────────────────────────────────────┘    │
├──────────────────────────────────────────────────────────────────────┤
│ ●■ CRHS ENTERPRISES, LLC  · TEXAS    © 2026   admin@crhsent.com  [mono]│  footer, hairline top
└────────────────────────────────────────────────────────────────────┘
```

**Pros:** Audience fit is exact: the FIG-plate/schematic treatment gives the technical consultant real engineering proof (topology, patents, the HA system) while the stat rails + 'proof of work' framing give the investor track record and credibility at a glance.; Reads premium and senior, not hypey — restraint (red ≤10%, no tilted body text, no collage clutter) is what separates corporate constructivism from a 1920s pastiche.; Buildable today within crhsent's constraints: self-contained, external-CSS-only, strict-CSP-clean (the diagonals are clip-path, motifs are CSS/inline SVG — no inline scripts, no exotic libs), deploys via the existing git-pull-on-prod static flow.; Accessibility is designed in, not bolted on: every palette pair meets WCAG AA (most AAA), red is never the sole signal, supports prefers-reduced-motion — keeps the Lighthouse A11y/BP/SEO 100s the project demands.; Distinctive and ownable — almost no competitor corporate/consultant site looks like an engineering dossier; it's memorable without being loud.; Continuity with the existing brand: keeps the slate/ink tones already on crhsent.com, so it's an elevation, not a jarring rebrand.; Diagram-forward system scales — new case studies/patents drop straight into the plate + mono-table components.

**Cons:** Constructivism done badly slides into 'edgy startup' or political-poster cosplay; the whole direction lives or dies on disciplined restraint — needs an art-direction guardrail (the ≤10% red / no-tilt rules must be enforced, not optional).; Archivo Expanded + IBM Plex Mono + Inter is three webfont families; left unmanaged that's a perf/CLS risk against the 'as close to 100' Lighthouse bar — must self-host, subset, preload, and font-display:swap (or fall back to the existing system stack for body).; The schematic/FIG-plate concept only sings if the diagrams are genuinely good — it raises the bar on the SVGs (a weak architecture figure undermines the whole 'technical depth' claim).; All-caps Archivo Expanded headings can hurt readability and screen-reader pronunciation if overused — must cap heading length and keep accessible (text-transform via CSS, real sentence-case in the DOM).; The dark Plate-Black band is the one place to watch contrast/red-on-dark — small red text there fails AA, so red is fills/large-only on that surface (a constraint to police).; Wide-display type + strict grid needs careful mobile reflow (the left mono index and asymmetric columns must collapse gracefully) — more responsive QA than a centered single-column brochure.
