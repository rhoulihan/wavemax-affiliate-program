# CRHS site — locked decisions (2026-06-21) + build plan

Decisions from Rick's review of PROPOSAL.md:

| # | Decision | Choice |
|---|---|---|
| Design | constructivism direction | **RED BUREAU** — editorial/technical (dossier; FIG.NN plates frame diagrams/benchmarks as the hero artwork; Archivo Expanded + Inter + IBM Plex Mono; restrained Bureau Red on paper/ink) |
| Scope | pages | **5**: Home · Capabilities · Work · About Rick · Contact |
| Emphasis | what leads | **DB/AI IP DOMINANT** — converged-database research + benchmarks + Unified Model Theory are the lead story; **WaveMAX is ONE exhibit among the IP**, not the flagship hero (reweighted from the proposal default) |
| Publish | posture | **Public + indexable** (flip the noindex); benchmark numbers on the record; competitor comparisons kept **generic** ("specialized engines", not naming MongoDB/vendors) |

Defaults carried from the proposal (override anytime): contact = `mailto:admin@crhsent.com` (no form for v1); **English-only v1** (i18n deferrable); strict exclusions — nothing legal/litigation/tax/personal; topology diagram shows AZs/roles, NOT IPs/infra paths.

## Reweight for IP-DOMINANT
- **Home pillars** lead with the IP: `01 / MEASURED, NOT MARKETED` (benchmarks) · `02 / UNIFIED MODEL THEORY` (+ migration engine) · `03 / APPLIED AI` (agents/RAG/CaseForge) · `04 / WAVEMAX` (production proof — last, as the "we also ship & operate" exhibit).
- **Work/Proof** leads with the **benchmark/IP exhibit grid** (the research is the star); WaveMAX is a strong exhibit within it, not the full-width flagship.
- **Capabilities** order: Data at Scale → Applied AI → Product & Delivery (WaveMAX under the last).

## Tech (this repo's model)
Static files under `crhsent/` served on crhsent.com by the host handler in server.js (~L564): HTML via `readHTMLWithNonce` (nonce auto-injected into `<link>`/`<style>`/`<script>`), assets via sendFile, traversal-guarded, folders→index.html, `no-cache` HTML. Pages: `crhsent/index.html` + `crhsent/{capabilities,work,about,contact}/index.html`; shared `crhsent/assets/{css,js,fonts,img}/`. NO inline scripts (external nonce'd JS). Deploy = git pull both OCI boxes (no pm2 reload for content). **Access gate:** confirm corporate routes are reachable when `access_gate_enabled=true` (launch gate). Best-practices: Lighthouse ~100 ×4 ×2, SEO + JSON-LD (Organization/Person), AA contrast, self-hosted+subset+preload fonts.

## Build plan (phased, review gate each)
- **P1 — design system + Home** (RED BUREAU tokens CSS + FIG-plate/kicker/diagonal components + Home with real IP-dominant copy + hero SVG + nonce-clean count-up/reveal JS). GATE: Rick reviews Home (desktop+mobile) + Lighthouse spot-check.
- **P2 — Work/Proof** (benchmark/IP exhibit grid leads; WaveMAX exhibit; topology SVG showing AZs/roles only). GATE: diagrams/plates review.
- **P3 — Capabilities + About + Contact** (patent table, UMT, book, writing links). GATE: copy accuracy (numbers/patents/bio) + exclusions.
- **P4 — SEO/JSON-LD + OG, robots flip, full Lighthouse, access-gate verify, deploy both boxes, live verify**. GATE: measured scores + Rick walk-through. (Public-facing → confirm before publishing.)

## Inputs needed from Rick (block About / final copy, NOT P1)
1. **9 patent IDs + titles** (for the dossier table) + which credentials to state verbatim (Field CTO Oracle / AWS WW NoSQL lead / Zenoss VP Eng).
2. **Bio confirmations** + anything to NOT state publicly.
3. **High-grade portrait** source (current `crhsent/owners/rick.webp` is reusable but low-res — a better cut-out helps the hero).
4. **Webfonts**: confirm self-hosting Archivo Expanded + Inter + IBM Plex Mono (I'll need the .woff2 files or approval to fetch+subset them); P1 builds with strong system fallbacks until then.
5. **The book** title/subtitle + co-author credit to state.
