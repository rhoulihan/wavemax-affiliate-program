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

1. **Bump `?v=` on any changed `/assets/*` file.** Static assets are served `immutable,
   max-age=1y`; without a new query string, the old copy is served from the browser/CF edge
   forever. Bump the stamp in **every** referencing page (`grep -rl`).
2. **`git pull --ff-only` on BOTH boxes** (OCI primary `161.153.71.201` + Ultahost failover via
   `wavemax-promo`). Keep them lockstep — same commit.
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
- **Valid `robots.txt`** — Lighthouse flags unknown directives. ⚠ Cloudflare's "Managed
  robots.txt / Content Signals" injects a `Content-Signal:` line that Lighthouse reports as
  invalid (`robots.txt is not valid`), capping SEO at ~92. To get SEO 100 **and** keep AI
  governance, keep the AI-crawler `Disallow` blocks (valid directives) but drop the
  `Content-Signal` directive (Google ignores it anyway; it's a CF dashboard toggle). See the
  decision log in the refactor/ops notes.
- Per-host `sitemap.xml` (self-canonical multi-domain), descriptive `<title>`/meta description,
  canonical link, valid structured data, legible font sizes, tap targets.

---

## Current baseline (rundberglaundry.com landing, 2026-05-24)

| | Performance | Accessibility | Best Practices | SEO |
|---|---|---|---|---|
| Desktop | ~92 | **100** | **100** | 92 *(robots.txt / Content-Signal)* |
| Mobile  | ~90–96 | **100** | **100** | 92 *(robots.txt / Content-Signal)* |

Open levers: render-blocking CSS (perf), and the Cloudflare `Content-Signal` decision (SEO).
