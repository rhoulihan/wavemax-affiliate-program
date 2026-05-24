# Active Todo — Lighthouse quality bar + OCI HA expansion (2026-05-24)

## Lighthouse "~100 across all 4 categories, mobile + desktop" — project standard
- [x] Accessibility → 100 (contrast: `.wmv3-btn-sol` #29b6d4→#0e7490 5.36:1; label-in-name: drop button `aria-label="Choose language"`) — deployed both boxes
- [x] Best Practices → 100 (no console errors)
- [x] Workflow guideline: `docs/development/LIGHTHOUSE-QUALITY-BAR.md` + CLAUDE.md release-gate rule
- [x] Performance: async render-blocking Google Fonts + spinner CSS (css-async.js) — mobile 90→98
- [x] Home-page diet: swirl-spinner lazy-loaded via bridge (off all non-contact pages); removed stale wikimedia preconnect + places.googleapis dns-prefetch
- [x] crhsent PSI-speed callout (40-years framing) — live on crhsent.com/wavemax
- [x] SEO → 100: user disabled CF "Manage robots.txt" on all 6 zones; origin `/robots.txt` route ships AI-crawler Disallow (no Content-Signal). SEO 100 all zones. See `seo_robots_control` memory.
- [x] MHR comparison (rundberg vs crhsent vs wavemaxlaundry.com/austin-tx) — Google PSI: rundberg high-90s/96-100, MHR 82/59; rich-results 14 valid items vs 2.
- [x] crhsent page perf baseline — Perf 100 desktop / 99 mobile (A11y 92, BP 93; SEO n/a, private pitch page)
- [x] **crhsent "proof you can verify" accuracy audit** — every claim checked vs live data (curl/Lighthouse/PSI/dig). Fixed: ours weight 1.76→0.98MB, dropped overstated redirect row, Charlotte 3.40→2.90MB, Franchise 2.19→2.35MB, franchise scripts 28→41/styles 23→21, HTML theirs 429→437KB; re-attributed FCP/LCP to Chrome Lighthouse (not PSI). Verified-accurate left as-is: CORS reflect-any-origin (wp-json), security headers, hosting/IPs, TTFB, console errors, home-page weight, PSI scores. Deployed both boxes, verified live.

## OCI HA expansion — 2nd Phoenix AZ, deprecate Ultahost web (mail-only)
- [x] Account confirmed PAYG (A1 limit 250/AD) — old Free-Tier 4/24 caveat obsolete; both boxes 2/12
- [x] Launched oci2 A1.Flex in PHX-AD-1 (reserved static IP 144.24.4.202); opened iptables :443 (security list alone insufficient)
- [x] Installed stack on oci2; added oci2's IP to ADB ACL (caused ORA-03113 storm → capped Mongo pools mongoose 5/2 + connect-mongo 3/1)
- [x] CF LB round-robin oci1+oci2 (no fallback, per user); health green both
- [x] Shut down web on Ultahost (mail only); downsized oci1 to 2 OCPU/12GB (pm2 → 2 workers)
- [ ] Remove diagnostic `X-Origin-Box` header before declaring migration fully done

## Background (not blocking)
- [ ] Mail flip to OCI — gated on Oracle SRs (PTR #4-0002859947/#4-0002859970, port-25 #CAM-266605)
