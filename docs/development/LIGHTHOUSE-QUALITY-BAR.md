# Lighthouse Quality Bar — Project Standard

> **Standard:** every user-facing page targets **as close to 100 as possible across all four
> Lighthouse categories — Performance, Accessibility, Best Practices, SEO — on BOTH mobile
> and desktop.** This is a release gate, not a nice-to-have. For a properly governed,
> AI-built app it is table stakes: the same PSI work that used to mean a dozen tickets and
> 2–3 developer-days now closes in under an hour, so there is no excuse to ship a page that
> doesn't clear the bar.

A change to a user-facing page is not "done" until it has been measured on mobile **and**
desktop and the four scores are at/near 100 (any regression from the previous measured
state must be explained or fixed).

---

## How to measure (local Lighthouse, system Chrome)

```bash
# Desktop
CHROME_PATH=/opt/google/chrome/chrome npx --yes lighthouse "https://rundberglaundry.com/?lh=$(date +%s)" \
  --preset=desktop --output=json --output-path=/tmp/lh-desktop.json \
  --chrome-flags="--headless=new --no-sandbox --disable-dev-shm-usage" --quiet

# Mobile
CHROME_PATH=/opt/google/chrome/chrome npx --yes lighthouse "https://rundberglaundry.com/?lh=$(date +%s)" \
  --form-factor=mobile --screenEmulation.mobile=true --output=json --output-path=/tmp/lh-mobile.json \
  --chrome-flags="--headless=new --no-sandbox --disable-dev-shm-usage" --quiet
```

- **Always append `?lh=<timestamp>`** so any edge/proxy cache key misses and you measure the
  real origin output. Performance scores have run-to-run variance (±3–5 on mobile is normal);
  re-run if a number looks off, and trust the median.
- The PageSpeed Insights API (`runPagespeed`) needs an API key; the keyless quota is small and
  exhausts quickly. Local Lighthouse against the live origin is the day-to-day tool.

### Prove the new code is actually live before trusting the score

In-memory template caching + immutable asset caching both mask deploys. After deploying, before
measuring:

```bash
curl -s "https://rundberglaundry.com/?lh=$(date +%s)" -o /tmp/p.html
grep -o "wavemax-mhr-chrome.css?v=[0-9a-z]*" /tmp/p.html   # new ?v= stamp present?
grep -c 'aria-label="Choose language"' /tmp/p.html          # changed markup gone?
```

---

## Deploy procedure (so the fix actually reaches users)

0. **If you edited a minified-source asset** (anything listed in `scripts/build-assets.js`), run
   `npm run build:assets` and commit the regenerated `.min` files — `git pull` only ships what's
   committed; the boxes don't run the build.
1. **Bump `?v=` on any changed `/assets/*` file.** Static assets are served `immutable,
   max-age=1y`; without a new query string, the old copy is served from the browser/CF edge
   forever. Bump the stamp in **every** referencing page (`grep -rl`).
2. **`git pull --ff-only` on BOTH web boxes** — dual-AZ active-active: oci1 `161.153.71.201` +
   oci2 `144.24.4.202` (`ssh -i ~/.ssh/oci_wavemax ubuntu@<ip>`). Keep them lockstep — same commit.
   (Ultahost is mail-only now, not a web box.) Full sequence: `docs`/memory "Deployment procedure".
3. **`pm2 reload wavemax` on BOTH boxes if you touched a server-rendered template**
   (`franchise-host.html` is cached in memory in prod — `git pull` alone won't deploy it).
   Pure `express.static` assets don't need a reload. See `tasks/lessons.md`.

---

## Per-category playbook (patterns already in this codebase)

### Performance
- **Defer non-critical JS** (`defer` on chrome/pixel/phone-swap scripts) — keeps them off the
  critical path while preserving execution order.
- **Async non-critical CSS** (modal, spinner) CSP-safely (`media="print"` + an external swapper
  script — no inline `onload` handler). Keep layout-critical CSS (chrome, host-mock) blocking to
  avoid FOUC.
- **Images:** WebP (q82), explicit `width`/`height` (CLS), lazy-load the rotator by setting `src`
  only on the first slide and carrying the rest in `data-src` (a stacked rotator defeats
  `loading="lazy"` / IntersectionObserver — everything counts as in-viewport).
- **Caching:** `/assets/*` immutable 1y (bump `?v=`); HTML short-lived (`max-age=60`); let
  Cloudflare edge-cache cleanly (no `Set-Cookie` on asset responses).
- **Minify our own CSS/JS** — `npm run build:assets` (terser + csso) emits `.min.css`/`.min.js`
  siblings for the assets on the indexable critical path; reference the `.min` file in the page(s)
  that load it and keep the readable source authoritative (edit source → `npm run build:assets` →
  commit both). The generated files carry a "GENERATED" banner — never hand-edit them. Manifest +
  scope live in `scripts/build-assets.js`. Note: post-Brotli the wire saving is small — this
  mainly clears Lighthouse's "Minify CSS/JavaScript" lines.
- **Accepted third-party warnings — don't chase these.** The Hibu/Meta retargeting pixel
  (`connect.facebook.net/.../fbevents.js`) and the Cloudflare Insights beacon are third-party:
  their `unused-javascript`, `legacy-javascript`, and short `cache-TTL` flags (~180 KiB on mobile)
  can't be minified or re-cached by us. The pixel is intentional marketing (deferred to post-load,
  disclosed in the privacy policy with opt-out) — confirmed keep (2026-05-24). The only lever is
  removing them, which we won't.

### Accessibility (target 100)
- **Contrast ≥ 4.5:1** (normal text). White-on-brand-cyan `#29b6d4` is only 2.4:1 — use the
  darkened `#0e7490` (5.36:1) for solid CTAs. Verify with a contrast calc, don't eyeball.
- **Label in name (WCAG 2.5.3):** a control's accessible name must contain its visible text.
  Don't put `aria-label="Choose language"` on a button that visibly reads "EN" — drop the
  override and let the visible text be the name; carry context on the wrapper.
- Logo/img `width`+`height`; `alt` on meaningful images, `aria-hidden` on decorative icons.

### Best Practices (target 100)
- **Zero console errors** (a failed third-party fetch / `ERR_TIMED_OUT` will ding this).
- Strict nonce-based CSP, no inline scripts/handlers, HTTPS everywhere, no deprecated APIs.

### SEO (target 100)
- **Valid `robots.txt`** — Lighthouse flags unknown directives. ✅ RESOLVED 2026-05-24:
  Cloudflare's "Manage robots.txt" was injecting a `Content-Signal:` line Lighthouse rejects
  (`robots.txt is not valid`), capping SEO at 92. Fix: moved the AI-crawler `Disallow` list into
  our own origin `/robots.txt` route (`server.js` — valid directives, NO Content-Signal) and
  disabled CF's "Manage robots.txt" (per-zone dashboard toggle; the LB/billing API token can't
  reach that setting). Result: **SEO 100 on all zones, AI-bot governance preserved.** Don't
  re-enable CF's managed robots.txt — it re-adds the Content-Signal line.
- **Structured data** — measure it with a tool that RENDERS JavaScript (Google's Rich Results
  Test, or headless Chrome `--dump-dom`), never `curl`/view-source: some platforms inject JSON-LD
  client-side, so a raw fetch under-counts it (this bit us — a curl scan reported a competitor at
  0 schema when a rendered scan showed 7). Note Lighthouse's `structured-data` audit is manual/
  unscored — schema richness never moves the SEO number; it's pure SERP advantage (rich results).
- Per-host `sitemap.xml` (self-canonical multi-domain), descriptive `<title>`/meta description,
  canonical link, valid structured data, legible font sizes, tap targets.

---

## Current baseline (rundberglaundry.com landing, 2026-05-24)

| | Performance | Accessibility | Best Practices | SEO |
|---|---|---|---|---|
| Desktop | ~95 | **100** | **100** | **100** |
| Mobile  | **98** | **100** | **100** | **100** |

All four categories at/near 100 on real Google PSI (2026-05-24). Performance is bound by the
iframe + marketing 3rd-parties (Meta pixel deferred to post-load); our own code scores
`bootup-time` and `main-thread-work` = 1. SEO reached 100 once CF's managed robots.txt was
disabled (see SEO section).
