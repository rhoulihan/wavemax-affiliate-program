# Active todo — CRHS Enterprises corporate site (crhsent.com), RED BUREAU constructivism

Proposal + locked decisions: `docs/crhsent-proposal/` (PROPOSAL.md, DESIGN-DIRECTIONS.md, DECISIONS.md, WORK-SURVEY.json).
Locked: RED BUREAU (editorial/technical) · 5 pages · **DB/AI IP-dominant** (WaveMAX = one exhibit) · public+indexable, generic competitor framing.

## Phase 1 — design system + Home (review gate)
- [x] `crhsent/assets/css/site.css` — RED BUREAU tokens (palette/type/grid) + components (FIG-plate, kicker-bar, diagonal divider, stat rail, pillar cards, buttons, mobile hamburger nav, focus-visible); AA contrast; reduced-motion safe
- [x] `crhsent/index.html` — Home (IP-dominant): hero + proof strip + 4 pillars (benchmarks→UMT→AppliedAI→WaveMAX) + operator + CTA; SEO meta + Organization/Person JSON-LD; noindex REMOVED; generic competitor framing ("single-purpose engines")
- [x] `crhsent/assets/js/site.js` — external, nonce-clean: count-up + scroll reveals (IntersectionObserver, prefers-reduced-motion + no-IO fallback) + accessible mobile nav toggle
- [x] hero SVG motif — constructivist UMT diagram (one canonical form → document/graph/time-series/relational projections) + crop marks; system-font fallbacks (Archivo Expanded/Inter/IBM Plex Mono) until webfonts self-hosted
- [x] `crhsent/assets/img/favicon.svg` (same-origin; avoids the /favicon.ico → wavemaxlaundry redirect CSP trip)
- [x] Self-hosted webfonts — Archivo Expanded (Archivo variable pinned to 125% width axis), Inter, IBM Plex Mono; latin-subset woff2 under `crhsent/assets/fonts/`, `font-display:swap`, 3 above-the-fold faces preloaded (`crossorigin`), CSP `font-src 'self'` (no external origins). Verified rendering.
- [x] **REV 2 — repositioned per Rick (2026-06-22):** sole proprietor + AI-driven development + enterprise architecture → secure, highly-available, enterprise-grade systems **without the enterprise price tag**. H1 kept. New hero lede + stat rail (40/09/2/1); NEW "FIG.01 / The offer" section; proof strip reframed (17× · 8-layer · Dual-AZ · 99/98); pillars reframed (Enterprise architecture · AI-driven delivery · Secure & HA · Without the price tag); first-person operator section + creds (pulled from existing owners page); CTA "Tell me what you need built." Copy produced + adversarially fact-checked via Workflow (40 yrs reconciled from owners page; generic competitors; nothing legal/personal). SEO/JSON-LD updated.
- [~] GATE: **awaiting Rick's review of REV 2** — Home (desktop+mobile). Lighthouse re-run (local preview, both devices): **A11y 100 · Best Practices 100 · SEO 100 · Agentic 100**, perf LCP 63ms / CLS 0.00. NOT deployed (public-facing → deploy only after approval at P4).

## Phase 2 — Work/Proof — BUILT (2026-06-22), awaiting gate review
- [x] `crhsent/work/index.html` — intro (FIG.00) → WaveMAX flagship (FIG.01, dual-AZ topology blueprint FIG.02 + sub-exhibits FIG.03 Lighthouse / FIG.04 Security / FIG.05 Engineering) → exhibit grid (FIG.06–15: 7 enterprise-architecture + 3 applied-AI plates) → CTA. Content produced + adversarially fact-checked via Workflow (13 ok / 1 softened / 0 cut; generic competitors; topology IP-free; tenure 30+).
- [x] Dual-AZ topology SVG — constructivist blueprint, **AZs/roles only, NO IPs/hostnames/infra paths** (EDGE Cloudflare LB → active-active APP zones A/B Phoenix → DATA Oracle ADB Exadata). Authored + visually verified.
- [x] Lighthouse (local, both devices): **A11y 100 · BP 100 · SEO 100 · Agentic 100**. Reveal IntersectionObserver hardened (dropped negative bottom rootMargin → last card always reveals).
- [~] GATE: **awaiting Rick** — topology + plates review. **OPEN:** per-exhibit GitHub links rendered as TEXT (not links) pending Rick confirming which repos are public. NOT deployed.
## Phase 3 — Capabilities + Contact BUILT (2026-06-22); About pending Rick's inputs
- [x] Work page: per-repo GitHub links wired LIVE (Rick: all public) — `target=_blank rel=noopener`.
- [x] `crhsent/capabilities/index.html` — intro + 3 practice areas (FIG.01 Data at scale · FIG.02 Applied AI · FIG.03 Product & delivery), each desc + service bullets + "see the Work →" proof link; CTA. Adversarially fact-checked (CLEAN: figures supported, generic competitors, 30+, no legal/IP). Lighthouse 100×4 both devices.
- [x] `crhsent/contact/index.html` — mailto CTA + fineprint (email/github/LLC) + "helpful to include" list. ContactPage JSON-LD. Lighthouse 100×4 both devices.
- [x] a11y fix (shared): prose links (`p a:not(.btn)`) now underlined — fixes WCAG link-in-text-block on the "see the Work →" inline links.
- [x] `crhsent/about/index.html` — hero (real headshot → `assets/img/rick-houlihan.webp`, 29KB) + first-person bio + creds; career arc; **9-patent dossier** (verified via Google Patents inventor "John Richard Houlihan" — IBM ×7, Zenoss ×1, Amazon ×1 incl. the DynamoDB key-overloading patent; each links to patents.google.com); UMT thesis; CTA. Book omitted (unpublished, per Rick). ProfilePage+Person JSON-LD. Lighthouse 100×4 both devices (fixed a patent-grid auto-placement bug). 

## ALL 5 PAGES BUILT — Home · Capabilities · Work · About · Contact — each Lighthouse A11y/BP/SEO 100 desktop+mobile, CLS 0, self-hosted fonts, nonce-clean. NOT deployed.

## Phase 4 — SEO/robots + deploy
- [x] OG share images — 5 on-brand 1200×630 cards (`crhsent/assets/img/og-{home,work,capabilities,about,contact}.png`), generated from a temp generator (since removed). Wired og:image + og:image:width/height + twitter:card=summary_large_image + twitter:image on all 5 pages.
- [x] `crhsent/robots.txt` (allow all + sitemap) + `crhsent/sitemap.xml` (5 URLs). Served by the crhsent host handler (runs before the main L1144 robots route) when the gate is off. Verified 200 + valid; Home SEO still 100.
- [x] Access-gate investigation: **`accessGate` IS the crhsent.com password gate** (GATED_HOSTS=crhsent.com/www; only `/owners/` exempt). `comingSoon` only gates rundberglaundry.com (crhsent unaffected). **Single launch toggle = SystemConfig `access_gate_enabled`** (runtime, no redeploy): false ⇒ crhsent.com fully public; true ⇒ password-gated. Defaults false (fail-open).
- [ ] **DEPLOY (needs Rick's go-ahead + the gate decision):** (a) ensure `access_gate_enabled=false` to make crhsent.com public — NOTE this opens ALL of crhsent.com (corporate + /wavemax/ + /owners/); or (b) keep gate on + add corporate routes to accessGate isExempt() (server change). Then: git pull both OCI boxes (static → NO pm2 reload), live-verify both, PSI spot-check, validate share cards (no `pm2` unless server.js changes).
## Phase 4 — SEO/JSON-LD + OG, robots flip, full Lighthouse ×4 ×2, access-gate verify, deploy both boxes, live verify

## Inputs needed from Rick (block About/final, not P1): 9 patent IDs+titles · bio confirmations · hi-res portrait · webfont .woff2 (Archivo Expanded/Inter/IBM Plex Mono) approval · book title+co-author
