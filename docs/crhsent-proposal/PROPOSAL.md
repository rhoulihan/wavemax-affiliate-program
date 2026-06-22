# CRHS Enterprises — Corporate Site Proposal
**crhsent.com · for Rick's review before build**
*Prepared by the creative + technical director · v1 (review draft)*

---

## 0. TL;DR

Build a tight, five-page corporate site for CRHS Enterprises that reads as a **senior engineering practice and holding company**, not a consultancy brochure. Lead with one sentence — *CRHS builds and operates production data systems and applied-AI products, and proves it with measured benchmarks and shipped software.* Back it with four proof pillars (converged-database benchmarking IP, the MongoDB→Oracle translation engine + Unified Model Theory, the WaveMAX production SaaS, and the AI-agent / tooling portfolio), and anchor the whole thing on Rick's 30-year operator credibility (DynamoDB Single-Table Design, Field CTO at Oracle, 9 patents).

**Design recommendation:** **RED BUREAU — Editorial / Technical Constructivism** (the dossier direction). It is the only one of the three that turns the actual assets — topology diagrams, benchmark tables, patent lists — into the hero artwork, which is exactly what both audiences read to assess capability. Runner-up: **Red Square** (safer, simpler, ships faster).

**Ships in the existing model:** static HTML/CSS/SVG under `crhsent/`, served through Express on the `crhsent.com` host via `readHTMLWithNonce`, strict-CSP-clean (external CSS only, no inline scripts), deployed by git-pull on both OCI boxes. No new infrastructure.

---

## 1. Positioning & Narrative

### What CRHS is
CRHS Enterprises, LLC is a Texas technology holding company and engineering practice. It builds production data systems, applied-AI tooling, and shipped software products — and it operates them in production, not just advises on them. The throughline across every asset is the same thesis Rick has spent a career proving: **converged data architecture beats polyglot persistence, and the right way to prove that is to measure it and ship it.**

### One-line value prop (lead candidate + alternates)
- **Lead:** *"We build the real thing — production data systems and applied AI, proven by measurement, shipped at scale."*
- **Alt (investor-leaning):** *"A 30-year data-architecture practice that ships production systems and defensible IP."*
- **Alt (technical-leaning):** *"Converged-database engineering and applied AI — benchmarked, shipped, operated."*

### The four proof pillars
These are deliberately drawn so each one carries credibility for **both** audiences (investor = track record/defensibility; consultant = real engineering).

1. **Measured, not marketed — converged-database benchmarking IP.**
   A rigorous, publicly-licensed benchmarking program proving converged engines beat specialized ones at their own workloads: **17× faster recursive graph traversal, ~7× memory-bound aggregation, 6.2× faster JSON schema validation** (matched-compute, SHA-256 result-equivalence methodology). *Investor read:* defensible IP and thought-leadership moat. *Consultant read:* honest, reproducible engineering — methodology that eliminates the "more hardware" confound.

2. **From theory to tool — Unified Model Theory + the migration engine.**
   UMT (documents, graphs, time-series and relational as projections of one canonical form) made operational: the **MongoDB→Oracle translation engine** (205 cross-database validation tests, 20+ pipeline stages, scale-tested to 4.5M docs) and the **JRDM** visual designer for Duality Views. *Investor read:* a framework + working tooling that de-risks enterprise migration. *Consultant read:* an AST-to-SQL translator and a property-tested designer that actually run.

3. **WaveMAX — production SaaS, built with AI, operated at HA.**
   A live, revenue-earning, dual-AZ multi-role platform: **Lighthouse 99 mobile / 98 desktop** (vs vendor 59/83), defense-in-depth security (PBKDF2-SHA512, AES-256-GCM, CSP v2 nonces), **2:1 test-to-code ratio**, on Oracle Autonomous Database behind Cloudflare. *Investor read:* commercial-grade SaaS shipped at AI-assisted velocity by one operator. *Consultant read:* the flagship case study — schematics, scores, and a security architecture you can audit.

4. **Applied AI that's defensible — agents, RAG, and document intelligence.**
   Production agentic-AI infrastructure (Ben-Ten context persistence / MCP), enterprise RAG reference implementations on Oracle 26ai, and **CaseForge** — deterministic sizing + fail-closed anonymization for regulated proposal workflows. *Investor read:* a portfolio of patent-relevant AI IP. *Consultant read:* the determinism boundary (LLM never produces the authoritative numbers) is real, rare engineering.

### The operator
Every pillar resolves to one person: **Rick Houlihan** — 30 years across Amazon → MongoDB → Oracle, inventor of DynamoDB Single-Table Design, Field CTO at Oracle, co-author (with Oracle distinguished engineer Zhen Hua Liu) of *The Elements of Data*, **9 US patents**. This is the credibility spine; the work is the proof.

---

## 2. Site Map

A tight five-page set. Resist sprawl — every page earns its place.

| Page | URL | Purpose | Primary audience |
|---|---|---|---|
| **Home** | `/` | The thesis, the four pillars, the operator, one CTA. The whole story scannable in 90 seconds. | Both |
| **Capabilities** | `/capabilities` | What CRHS does, as three practice areas (Data at Scale · Applied AI · Product & Delivery), each with proof. | Consultant-leaning |
| **Work / Proof** | `/work` | The portfolio: WaveMAX as flagship case study + the benchmark/IP exhibits as "plates." | Both |
| **About Rick** | `/about` | The dossier — career, patents, UMT, the book, thought leadership. | Investor-leaning |
| **Contact** | `/contact` | Single clear path to engage. (Could be a section on Home for v1.) | Both |

**Notes:**
- **WaveMAX is the flagship case study on `/work`**, with a dedicated deep-dive sub-page (`/work/wavemax`) if we want the full security + Lighthouse + topology exhibit. The existing **`/wavemax/` sales page and `/owners/` product page stay untouched** — they serve franchise owners ($500/mo motion), a different audience. The corporate site links to WaveMAX as a *case study*, never competes with the sales funnel. (See Open Questions on URL coexistence.)
- v1 can fold Contact into Home and ship four pages; I recommend the five-page set as the target.
- A `/writing` index (curated articles/posts) is an optional Phase-2 addition — strong for SEO and thought-leadership, but not required for launch.

---

## 3. Page-by-Page Content Outline

### HOME — the 90-second story

**§ Hero**
- Eyebrow (mono): `FIG.00 / CRHS ENTERPRISES`
- H1: **"WE BUILD THE REAL THING."** (one red word: *REAL*)
- Lede (≤60ch lines): *A Texas technology holding company. Production data systems, applied AI, and shipped product — engineered, measured, and operated at scale.*
- CTAs: `[ ▸ SEE THE WORK ]` (filled) · `[ ABOUT RICK ]` (ghost)
- Right: duotone portrait of Rick (the existing `rick.webp` asset, re-treated) with a red corner notch.
- Stat rail (mono, hairline-divided): `30 YRS · 09 US PATENTS · FIELD CTO · DynamoDB STD INVENTOR`

**§ Proof strip** (the credibility hook, above the fold's edge)
- `17× FASTER` graph traversal · `6.2× FASTER` schema validation · `2:1` test-to-code · `DUAL-AZ` HA
- Each numeral count-ups on scroll (CSS/IntersectionObserver, reduced-motion safe). Each tied to a one-line claim with a link to where it's proven.

**§ The four pillars** (`01–04`, the spine)
- Four-up plate grid, red rule-top per card, mono kicker:
  `01 / MEASURED, NOT MARKETED` — converged-DB benchmarking IP
  `02 / THEORY TO TOOL` — UMT + the migration engine
  `03 / WAVEMAX` — production SaaS, built with AI
  `04 / APPLIED AI` — agents, RAG, document intelligence
- Each card: one sentence + one proof number + "READ →".

**§ Who** (the operator, condensed)
- `RICK HOULIHAN — Field CTO, Oracle. Inventor of DynamoDB Single-Table Design. Co-author, The Elements of Data. 30 years: Amazon → MongoDB → Oracle.` → link to `/about`.

**§ CTA slab** (Carbon block, red arc)
- **"BUILD SOMETHING THAT SHIPS."** · `[ ▸ START A CONVERSATION ]`

---

### CAPABILITIES — what CRHS does

Frame as **three practice areas**, each a plate (FIG.01–03), each ending in a proof link so it never reads as a capabilities-deck of empty verbs.

- **FIG.01 / DATA AT SCALE** — converged-database architecture, performance benchmarking, migration. Proof: the benchmark suite numbers + the translation engine. Sub-bullets: schema validation, aggregation/CTE, BSON/OSON, Duality Views.
- **FIG.02 / APPLIED AI SYSTEMS** — agentic infrastructure, enterprise RAG, defensible document automation. Proof: Ben-Ten, the RAG workshop, CaseForge's determinism boundary.
- **FIG.03 / PRODUCT & DELIVERY** — production SaaS engineering with AI, end to end. Proof: WaveMAX (TDD, security, Lighthouse, HA). The "we operate it, not just build it" line lives here.

Headline direction: *"Three practices. One discipline: measure it, then ship it."*

---

### WORK / PROOF — the portfolio

The dossier's center of gravity. Two tiers:

1. **Flagship case study — WaveMAX** (full-width, leads the page)
   - The **Plate-Black dual-region topology diagram** as hero artwork (oci1/oci2 active-active, Cloudflare LB, Oracle ADB/Exadata) — `FIG.04`.
   - Three sub-plates: **Lighthouse** (99/98 vs 59/83, page weight 0.98MB vs 4.5MB, LCP 1.8s vs 14.4s) · **Security** (the 8-module defense-in-depth table) · **Engineering** (2:1 test ratio, 800-line ceiling, zero circular deps).
   - Existing screenshots reusable: `portal-admin.png`, `portal-claim.png`, `portal-expediter.png`.
   - One honest line on the method: *built with Claude as pair-programmer, governed by strict TDD + security + Lighthouse gates.*

2. **IP & benchmark exhibits** (plate grid — each a repo / framework)
   - Converged-database benchmarking program (BSON-JSON-bakeoff, DocBench, schemaBench, sbe-cte-bench) → the headline performance numbers.
   - MongoPLSQL-Bridge (the migration engine) · JRDM · converged-database-lab (nightly-validated proofs) · Unified Model Theory.
   - Ben-Ten · the Oracle RAG workshop · CaseForge.
   - Each exhibit: FIG.NN, one-line "what it is," one proof metric, GitHub link.

Headline direction: *"Proof of work. Every claim on this page is a repo, a benchmark, or a live system."*

---

### ABOUT RICK — the dossier

This is the investor's page; let it run long and substantive.

- **§ The operator** — 30-year arc: Amazon (DynamoDB patterns, the 3,000-Oracle-instance migration story), MongoDB (deep product), Oracle (Field CTO, JSON standards, convergent strategy). Earlier: Zenoss VP Eng, AWS WW NoSQL tech leader.
- **§ Patents & recognition** — mono table, red row-number column, `09 US PATENTS — granted, not pending`. (Need the patent IDs/titles from Rick — see Open Questions.)
- **§ Unified Model Theory** — the thesis, explained for an executive: one source of truth vs 5+ databases + CDC pipelines; why eventual consistency = hallucination risk for AI. Link to the canonical UMT explainer article.
- **§ The book** — *The Elements of Data: Model the Domain. Project the Access.* — co-authored with Zhen Hua Liu (Oracle distinguished engineer, 100+ papers). Position as in-progress marquee asset.
- **§ Selected writing** — 2–3 curated, link-out articles (BSON-vs-OSON benchmark proof; enterprise-workloads-need-enterprise-databases; the UMT pattern-catalog deep-dive). Optional "Download technical briefing" lead magnet (the presentation deck PDF).

Headline direction: *"Four decades building data systems at global scale."*

---

### CONTACT — one clear path

- Single mailto CTA to `admin@crhsent.com` (matches the current placeholder) — **no form for v1** (a form means CSRF/rate-limit/spam plumbing; defer unless Rick wants inbound capture).
- One line of positioning: *Engineering engagements, advisory, and product partnerships.*
- LLC line: `CRHS Enterprises, LLC · Texas · © 2026`.

---

## 4. Design System — recommendation

### ✅ RECOMMENDED: **RED BUREAU — Editorial / Technical Constructivism**

**Why this one wins for CRHS specifically:**

1. **It makes the assets the hero.** CRHS's differentiator is *evidence* — topology diagrams, benchmark tables, patent lists, a security-module matrix. RED BUREAU's signature move is the **FIG.NN "plate"**: a hairline-framed exhibit with a monospace figure number and a red caption rule, plus a **Plate-Black blueprint band** for schematics-as-art. That is purpose-built for a body of work that *is* diagrams and numbers. The other two directions decorate; this one **frames the proof**. For a reader assessing capability (consultant) or track record (investor), that's the whole game.

2. **Right register for both audiences.** The IBM Plex Mono "technical voice" (FIG numbers, patent IDs, stat rails) signals *this person ships systems* to the consultant; the Archivo Expanded display + restrained red signals *senior and established* to the investor. It reads as a **dossier, not a brochure** — which is the brief.

3. **Continuity, not a jarring rebrand.** It keeps the slate/ink tones already on `crhsent.com` (Ink Slate `#3A4452` ties to the current palette) and elevates rather than replaces — lower risk than a hard pivot to red/black.

4. **It's the most ownable.** Almost no data-architecture or consultant site looks like an engineering dossier. Memorable without being loud.

**The honest risk:** RED BUREAU's plates only sing if the diagrams are genuinely good, and it carries three webfont families (Archivo Expanded + Inter + IBM Plex Mono) — a perf/CLS risk against the Lighthouse bar if mishandled. **Mitigation is non-negotiable and baked into the build plan:** self-host + subset + preload all three with `font-display:swap`, and we already have strong SVG-authoring discipline (house SVG guidelines) to make the plates excellent. The ≤10%-red and no-tilted-body-text rules are enforced as art-direction guardrails, not suggestions.

### Summary of the recommended system

- **Palette:** Paper White `#F7F5F0` (canvas) · Carbon `#141414` (ink/headings/blocks) · **Bureau Red `#C8102E`** (the single load-bearing accent — rules, the one diagonal slash, figure numbers, ≤10% of pixels, never small body text) · Ink Slate `#3A4452` (body/captions, ties to current brand) · Hairline `#D9D5CC` (grid/frames) · Plate Black `#0F1115` (dark schematic bands). Every pair meets WCAG AA (most AAA); red is never the *only* signal.
- **Type:** Display **Archivo Expanded** (700/800, ALL-CAPS H1/H2, one red word) · Body/UI **Inter** (the senior, readable workhorse) · Technical **IBM Plex Mono** (figure numbers, patent IDs, stat rails, kickers). All free, self-hostable.
- **Layout:** strict 12-col grid (1140px), flush-left, asymmetric. **One** governing red diagonal slash (CSS clip-path) at the hero corner, recurring as a 4° section divider. 48px red "kicker bar" above every H2. Mono section index (01–06) down the left margin. FIG-plate components for all exhibits. Restrained motion (rule "draw-in," number count-up), `prefers-reduced-motion` safe.

### 🥈 Runner-up: **Red Square**

If Rick wants the **fastest, lowest-risk** path, Red Square is the call: near-monochrome ink-on-white with structural red, **two** fonts (Archivo + Inter — half the webfont risk), no Plate-Black band to police, no FIG-plate system to perfect. It's maximally investor-safe and ships quicker. The trade: it's less distinctive and doesn't turn the diagrams into the hero the way RED BUREAU does — the proof becomes content *inside* the page rather than *the artwork of* the page.

*(The third direction, RED FORMATION, is the boldest — the photomontage-hero, count-up, full-poster treatment. I'd hold it in reserve: highest reward, highest "tips from senior to loud" risk, and it's the most asset-dependent on a single strong cut-out portrait. Not my recommendation for a corporate site whose job is credibility-first.)*

---

## 5. Tech Approach (ships in *this* repo, today)

The site drops straight into the proven model already serving `crhsent.com`. No new infrastructure.

- **Location & routing.** Static files under `crhsent/` (alongside the existing `crhsent/wavemax/` and `crhsent/owners/`). The existing host handler in `server.js` (lines ~556–583) intercepts `host === 'crhsent.com'`, resolves the path, and serves HTML through **`readHTMLWithNonce`** (auto-injects the per-request nonce into `<style>`/stylesheet `<link>`/`<script>` tags), with assets sent via `sendFile` and **path-traversal already guarded** (`full.startsWith(CRHSENT_ROOT + sep)`). New pages = new files; the handler picks them up. Folder URLs resolve to `index.html` automatically.
- **Strict CSP discipline.** External CSS only (the handler nonces our stylesheet links). **No inline `<script>`** — all behavior (count-up, scroll reveals, nav) in an external nonce-injected JS file using IntersectionObserver; this matches the project's hard "no inline scripts/styles, nonce-based CSP only" rule. SVGs inline in the HTML (constructivist plates/diagrams) are CSP-safe.
- **Flip the `noindex`.** The current apex `index.html` is a `noindex,nofollow` placeholder. The new corporate site is **public and indexable** — remove the robots meta on corporate pages and serve real SEO (title, meta description, Open Graph, Twitter Card, schema.org `Organization`/`Person` JSON-LD). Robots.txt control already lives at our origin (CF "Manage robots.txt" stays off on all zones).
- **Access-gate / quarantine considerations.** The crhsent handler is mounted **after** the access gate (so the gate *can* front it when `access_gate_enabled=true`) and **before** the location quarantine. For a public launch the corporate pages must be reachable with the gate enabled — confirm the gate exempts `crhsent.com` corporate routes (the `/wavemax/` and `/__preview/*` paths already have explicit handling; corporate routes need the same exemption). **This is a launch gate to verify, not assume.**
- **Lighthouse-100 + SEO bar.** Same release gate as the rest of the platform: target ~100 across Performance/Accessibility/Best-Practices/SEO on mobile **and** desktop. Self-host/subset/preload the three fonts (`font-display:swap`), WebP imagery with explicit dimensions (CLS), minified critical-path CSS/JS via the existing `npm run build:assets` pipeline, immutable 1y caching on assets with `?v=` cache-busting. Measure with a `?lh=<ts>` cache-buster post-deploy. (The existing `/wavemax/` page already hits this bar — same playbook.)
- **i18n: optional / deferred.** The platform standard is en/es/pt/de, but a *corporate* site for an English-speaking investor/consultant audience is reasonably English-only at launch. Recommend **English-only for v1**, structured so i18n can be added later if Rick wants it (mark for a Phase-2 decision — see Open Questions).
- **Assets & deploy.** Author locally, send Rick screenshots/renders for each gate. Deploy by the canonical sequence: `npm run build:assets` → bump `?v=` on changed assets → push → `git pull --ff-only` on **both** OCI boxes (oci1/oci2). HTML is served `no-cache` by the handler, and `crhsent.com` is `cf-cache-status: DYNAMIC`, so **no `pm2 reload` is needed for content/asset changes** — only if `server.js` routing changes. Verify live on both boxes after pull.

---

## 6. Build Plan (phased, with review gates)

**Phase 0 — Approval & inputs (this proposal).**
Rick approves: design direction, page set, WaveMAX-vs-IP emphasis, public/indexable, English-only, contact = mailto. Rick supplies: patent IDs/titles, confirmed bio/title details, any numbers he wants on/off the public record, a high-grade portrait source.
**Gate:** sign-off on direction + inputs before any code.

**Phase 1 — Design system + Home (one page, real content).**
Build the RED BUREAU token set (palette/type/grid as external CSS), the FIG-plate + kicker-bar + diagonal-divider components, and a fully-built **Home** page with real copy. Self-host/subset fonts.
**Gate:** Rick reviews Home rendered (desktop + mobile screenshots) — does the system *feel* right? Cheaper to pivot here than after five pages. Lighthouse spot-check on Home.

**Phase 2 — Work/Proof + the flagship plates.**
The WaveMAX case study + the dual-region topology blueprint (the marquee SVG) + the IP/benchmark exhibit grid. This is where the "schematics as art" bar gets met.
**Gate:** Rick reviews the topology diagram + benchmark plates specifically — these are load-bearing for the technical-consultant read.

**Phase 3 — Capabilities + About Rick + Contact.**
The remaining three pages on the established system. Patent table, UMT section, book, curated writing links.
**Gate:** Full-site content review — copy accuracy (especially numbers, patents, bio), nothing private/legal/financial surfaced.

**Phase 4 — Hardening, SEO, Lighthouse, access-gate verification, deploy.**
Schema.org JSON-LD, OG/Twitter, robots flip, full Lighthouse pass (mobile + desktop, all pages), verify the access gate exempts corporate routes, deploy to both boxes, verify live.
**Gate:** Measured Lighthouse scores + live-on-both-boxes confirmation before declaring done. Final Rick walk-through.

Each phase is one reviewable unit; nothing advances past a broken gate.

---

## 7. Open Questions for Rick

1. **Design direction.** RED BUREAU (recommended — dossier, makes the diagrams the hero, 3 fonts) vs Red Square (safer/faster, 2 fonts, less distinctive)? Or do you want to see RED FORMATION's bolder poster treatment before deciding?
2. **WaveMAX vs DB/AI IP balance.** My instinct: lead the *thesis* with the **benchmarking IP + UMT** (that's your unique, defensible intellectual territory), and use **WaveMAX as the flagship "we ship and operate it" proof.** Agree, or do you want WaveMAX more front-and-center (it's the most visually demoable), or the IP more dominant?
3. **Page set.** Five pages (Home / Capabilities / Work / About / Contact) as proposed? Or tighter for v1 — e.g., a strong **single-page** site (everything on Home, anchor-linked) that's faster to ship and review? Add `/writing` now or defer?
4. **Public vs gated.** Confirm the corporate site is **public and indexable** (flip the current `noindex`), and that it should be reachable even when the access gate is enabled. Any reason to keep it gated/dark at first (soft launch)?
5. **Patents & specifics.** Can you provide the **9 patent IDs/titles** (for the dossier table), and confirm which credentials/titles you want stated verbatim (Field CTO at Oracle, AWS WW NoSQL tech leader, Zenoss VP Eng)? Anything you'd rather *not* state publicly?
6. **Numbers on the record.** The benchmark deltas (17×, 6.2×, etc.) and WaveMAX Lighthouse/HA specifics are publishable per the survey — confirm you're comfortable with them on a public marketing site, and whether to name MongoDB/competitors explicitly or keep comparisons generic.
7. **Contact / CTA.** Mailto-only (`admin@crhsent.com`) for v1, or do you want an inbound form (means CSRF + rate-limit + spam plumbing) and/or a "download technical briefing" lead magnet?
8. **Domain / URL coexistence.** Confirm the plan: **corporate site at `crhsent.com/` (and `/capabilities`, `/work`, `/about`, `/contact`)**, leaving the existing **`/wavemax/` sales page and `/owners/` product page untouched**. Should the corporate site link out to the WaveMAX sales page anywhere, or keep the franchise-owner funnel fully separate from the investor/consultant story?
9. **i18n.** English-only for v1 (my recommendation for this audience), with i18n deferrable to Phase 2 — agree?
10. **Strict exclusions confirmed.** I've kept everything legal/litigation/tax/personal **off** this proposal and out of scope (the survey flags WaveMAX security as "audit-proven in litigation context" — I'll surface only the *security engineering*, never the litigation framing). Confirm that's the right line, and flag anything else you consider off-limits for public copy (e.g., the specific OCI IPs, internal infra paths — I'd keep those out of the topology diagram, showing AZs/roles, not addresses).

---

*Files referenced (absolute paths):*
- Serving model: `/mnt/c/Users/rickh/GitHub/wavemax-affiliate-program/server.js` (crhsent host handler, lines ~556–583)
- Nonce injection: `/mnt/c/Users/rickh/GitHub/wavemax-affiliate-program/server/utils/cspHelper.js`
- Current apex placeholder: `/mnt/c/Users/rickh/GitHub/wavemax-affiliate-program/crhsent/index.html`
- Existing sales/product pages (leave untouched): `/mnt/c/Users/rickh/GitHub/wavemax-affiliate-program/crhsent/wavemax/`, `/mnt/c/Users/rickh/GitHub/wavemax-affiliate-program/crhsent/owners/`
- Reusable assets: `crhsent/owners/rick.webp`, `crhsent/owners/portal-{admin,claim,expediter}.png`