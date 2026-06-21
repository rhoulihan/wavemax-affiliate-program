# platform-baseline — design docs

Design artifacts for extracting a **content-free, commercial-grade, white-label full-stack
starter** from this repo. Produced by a multi-agent analysis of the whole stack (2026-06-20).

## Documents

| Doc | What it is |
|---|---|
| [SPEC.md](SPEC.md) | The specification — vision, architecture, full component catalog (every platform subsystem carried over + how it's generalized), the theming/content model, multi-tenant rollout model, what's out, the plug-in seams, and the baked-in quality bar. |
| [EXTRACTION-PLAN.md](EXTRACTION-PLAN.md) | The phased implementation plan — repo scaffold/layout, the greenfield-copy strategy, 8 phases (A–H) with per-file copy/strip/parameterize/acceptance, the domain-removal checklist, the genericization table, CI/CD + runbook, risks + effort. |
| [COMPLETENESS-GAPS.md](COMPLETENESS-GAPS.md) | The completeness critic's findings — material gaps for "commercial-grade" (P0–P3), mis-classifications, and carried-over weaknesses to fix before copying. |
| [ADDENDUM-commercial-grade.md](ADDENDUM-commercial-grade.md) | **Decision-resolved.** Folds every accepted gap into a specific phase, records the four kickoff decisions, and lists the remaining concrete kickoff items. **Read this with the plan.** |

## Kickoff decisions (locked 2026-06-20)

1. **Positioning:** sellable / OSS starter — full docs, CONTRIBUTING, ADRs, polished DX.
2. **Scope:** full commercial-grade — the 8 base phases **plus** all P0/P1 hardening from the critic.
3. **Runtime:** Docker-first **and** PM2/nginx/Cloudflare HA — both paths ship.
4. **Database:** Oracle ADB (Mongo API) is **first-class** — the cursor-retry/autoIndex/no-TTL-index shims ship on by default; standard MongoDB also supported.

## Headline findings

- **Highly extractable, audit-proven.** Reusability by subsystem: security ~100% · auth/RBAC + gates ~85% · deploy/ops ~85% · SEO ~80% · testing ~70% · SPA ~60% · email ~40% as-is. The work is parameterization + content-stripping, not rewriting.
- **Greenfield-copy, not clone-and-strip** — ~7,500 brand-string occurrences across 192 files, a 1,294-line `server.js`, and a committed compromised private key in history make a clean repo the right call; a `check-no-brand.js` CI guard enforces it.
- **Standalone-first SPA**, iframe-embeddable behind `EMBED_MODE`.
- **Framework with ~12 plug-in seams** + config-driven theming — rebranding a customer touches zero `server/` code.

## Status

Research + spec + plan complete and decision-resolved. **Not yet scaffolded** — awaiting final
repo name, license choice (MIT vs commercial EULA), and target location/GitHub org before Phase A.
