# crhsent.com/wavemax — claim verification

**Verified: 2026-05-25 ~15:05 UTC.**
Methods: Google PageSpeed Insights API (mobile + desktop), `curl` (headers, sizes, TTFB, CORS), `dig`/`whois` (hosting), and the Google Rich Results Test (structured data, last run 2026-05-24 — the RRT is CAPTCHA-walled and can't be scripted). "Platform" = `wavemaxlaundry.com/austin-tx`; "marketing vendor site" = `mhrmarketing.com`; "ours" = `rundberglaundry.com`.

---

## ✅ Verified accurate

### Performance — Google PSI, 2026-05-25
| crhsent claim | Measured 2026-05-25 | Status |
|---|---|---|
| Mobile perf **99 vs 59** | rundberg **99**, platform **59** | ✅ |
| Desktop perf **98 vs 82** | rundberg **98**, platform **83** | ✅ (platform 82–83, run variance) |
| Mobile LCP **1.8 s vs 14.4 s** | rundberg **1.8 s**, platform **14.4 s** | ✅ |
| Mobile FCP **1.1 s vs 5.9 s** | rundberg 1.1 s, platform 5.9 s | ✅ |
| First byte **~0.2 s vs ~0.7–0.9 s** | curl **0.17 s** vs **0.74 s** | ✅ |
| "~2.5 s, **4.5 MB**, render-blocking" / "**400 KB+** page" | platform HTML 422 KB, total ~4.3–4.5 MB, render-blocking confirmed | ✅ |

*Bonus (not on the page, supports the thesis): the corporate **home** page is even worse — mobile Perf **9** / LCP **15.9 s**, desktop Perf **35**.*

### Weights — 2026-05-25
| crhsent claim | Measured | Status |
|---|---|---|
| HTML **66 KB vs 437 KB** | rundberg **64 KB**, platform **422 KB** | ✅ within variance (platform fluctuates 420–440 KB) |
| Total weight **0.98 MB vs 4.51 MB** | rundberg 0.98 MB, platform ~4.3–4.5 MB | ✅ within variance |
| Network: ours 0.98 / austin 4.51 / Charlotte 2.90 / franchise 2.35 MB; franchise **41 scripts / 21 stylesheets** | confirmed via PSI network logs (this session) | ✅ |
| Home-page weight **66 KB vs 203 KB** | rundberg 64 KB, mhrmarketing **197 KB** | ✅ |

### Security — 2026-05-25
| crhsent claim | Verified | Status |
|---|---|---|
| Platform ships **no** security headers (CSP/HSTS/frame-ancestors/X-Content-Type/Referrer/Permissions) | curl `wavemaxlaundry.com` → none present | ✅ |
| **CORS reflects any origin with credentials** | `wavemaxlaundry.com/wp-json/` returns `access-control-allow-origin: https://evil.example.com` + `access-control-allow-credentials: true` | ✅ |
| FTC review-gating penalty **~$53,000/violation** | FTC 16 CFR Part 465 (eff. Oct 2024); max civil penalty per violation is inflation-adjusted: $51,744 (2024) → ~$53,088 (2025) | ✅ accurate |

### Deployment footprint — dig/whois, 2026-05-25
| crhsent claim | Verified | Status |
|---|---|---|
| `wavemaxlaundry.com` on GoDaddy (160.153.0.155 → secureserver.net) | dig → 160.153.0.155, rev `host.secureserver.net`, whois **GoDaddy.com, LLC** | ✅ |
| `mhrmarketing.com` on GoDaddy (160.153.0.197 → secureserver.net) | dig → 160.153.0.197, rev `host.secureserver.net`, whois **GoDaddy.com, LLC** | ✅ |
| Ours: OCI active-active dual-AZ (Phoenix) + Autonomous DB on Exadata | our infrastructure (oci1 161.153.71.201 / oci2 144.24.4.202, ADB) | ✅ |

### SEO / structured data
| crhsent claim | Verified | Status |
|---|---|---|
| Rich results **14 valid items vs 2**; **4.8★** review-snippet | Google Rich Results Test, **2026-05-24** (un-scriptable, not re-run today) | ✅ as of 2026-05-24 |
| Platform: "breadcrumb-only markup, no local-business schema" | RRT 2026-05-24 — 2 generic items, no LocalBusiness | ✅ as of 2026-05-24 |

---

## ⚠ Not independently re-verified this pass (recommend verifying or softening before relying on them)

- **Privacy Policy "8 of 11 markers missing" / Terms "10 of 11 missing"** — the specific legal-marker counts were not re-counted this pass (requires rendering MHR's policy pages and applying the marker checklist). Directionally certain (MHR's legal pages are thin) but the exact counts are unconfirmed.
- **"23 / 23 passing vs ~10 / 23"** security roll-up — the individual security-header rows above are verified; the overall count depends on the privacy/ToS marker tallies, so it inherits their uncertainty.
- **"$300/mo package" scorecard rows** — "language switcher force-hidden" and "trashed & duplicate pages left live and indexed" are specific platform claims not re-checked today.
- **Review-gating narrative** ("the vendor published a review-gating control on every franchise page") — a case-file/historical claim, not a live-measurable fact.

## Notes
- The platform's HTML size and total weight are **dynamic WordPress values** and fluctuate run-to-run (~420–440 KB HTML, ~4.3–4.5 MB total). The "~6× heavier / ~2–5× across the network" comparison holds at every measurement; only the exact figures drift. Consider "~" framing on those two numbers if you want them bulletproof against re-runs.
- Platform desktop perf measured **83** today vs the page's **82** — within normal run-to-run variance; no change needed.

## Reproduce it yourself / shareable PageSpeed links

These numbers were captured via the **PageSpeed Insights API** (`pagespeedonline/v5/runPagespeed`), which returns JSON but does **not** create a persistent shareable result URL — those `/analysis/<id>` links are only minted by the pagespeed.web.dev **web UI**.

**Captured (persistent share links):**
- **Ours — rundberglaundry.com** (analysis `0xcgxs4tyv`, 2026-05-25; corroborates the API's mobile 99 / desktop 98):
  - Mobile: https://pagespeed.web.dev/analysis/https-rundberglaundry-com/0xcgxs4tyv?form_factor=mobile
  - Desktop: https://pagespeed.web.dev/analysis/https-rundberglaundry-com/0xcgxs4tyv?form_factor=desktop
- **Platform — wavemaxlaundry.com/austin-tx** (analysis `s3gp0elj96`, 2026-05-25; corroborates the API's mobile 59 / desktop 83 — the UI run is slow/timeout-prone *because* the page is so heavy, which is itself the point):
  - Mobile: https://pagespeed.web.dev/analysis/https-wavemaxlaundry-com-austin-tx/s3gp0elj96?form_factor=mobile
  - Desktop: https://pagespeed.web.dev/analysis/https-wavemaxlaundry-com-austin-tx/s3gp0elj96?form_factor=desktop
- **Platform home — wavemaxlaundry.com** (analysis `tp2sfwhlzf`, 2026-05-25; corroborates the API's mobile 9 / desktop 35, mobile LCP 15.9 s):
  - Mobile: https://pagespeed.web.dev/analysis/https-wavemaxlaundry-com/tp2sfwhlzf?form_factor=mobile
  - Desktop: https://pagespeed.web.dev/analysis/https-wavemaxlaundry-com/tp2sfwhlzf?form_factor=desktop
- **Marketing vendor — mhrmarketing.com** (analysis `yw5alru833`, 2026-05-25; corroborates the API's mobile 66 / desktop 92):
  - Mobile: https://pagespeed.web.dev/analysis/https-mhrmarketing-com/yw5alru833?form_factor=mobile
  - Desktop: https://pagespeed.web.dev/analysis/https-mhrmarketing-com/yw5alru833?form_factor=desktop

*All four sites now have persistent Google PSI share links (above), captured 2026-05-25.*

*Next re-audit recommended on any material change to either site, and before any new external sharing of the page.*
