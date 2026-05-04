# Franchise tracking setup — Search Console + GA4

**Audience:** franchise owners deploying their own copy of the WaveMAX iframe-embed reference build.

**Why this matters:** Google's crawler reads tracking and verification tags on first paint, *before* any JavaScript runs. That means these tags **cannot** be injected by the iframe bridge, the host-mock script, or any other client-side code. They must live in the parent host page's HTML at deploy time.

If you skip this, you'll see one or more of the following silently fail:

- **Search Console** refuses to verify domain ownership → no indexing reports, no manual-action visibility, no sitemap submission, no Core Web Vitals.
- **GA4** records nothing for the host page → no traffic data, no conversion attribution.
- **Google Tag Manager** (if you swap GA4 for GTM) will not load.

## What to add

The host page (`public/dev/austin-host-mock.html` in this reference build, or whatever filename your franchise's parent page is) already has placeholder markers in the `<head>`. Replace them with your real tokens.

### 1. Search Console verification meta tag

```html
<meta name="google-site-verification" content="REPLACE_WITH_FRANCHISE_SEARCH_CONSOLE_TOKEN">
```

**Where to get the token:**
1. Sign in to <https://search.google.com/search-console>.
2. **Add property** → choose **URL prefix** (not Domain).
3. Enter your full host URL (e.g. `https://lubbock.wavemax-franchise.com/`).
4. Pick **HTML tag** as the verification method.
5. Google shows a `<meta name="google-site-verification" content="abc123…">` snippet — copy the `content` value.
6. Paste it into the host page meta tag (replacing the placeholder), commit, deploy.
7. Click **Verify** in Search Console. It should succeed within 30 seconds of deploy.

The tag stays in the HTML forever — removing it after verification will un-verify the property.

### 2. GA4 / gtag.js

The host page contains a commented-out gtag.js block. Uncomment it and replace `G-XXXXXXXXXX` (in two places) with your franchise's GA4 Measurement ID.

**Where to get the Measurement ID:**
1. Sign in to <https://analytics.google.com>.
2. **Admin** → **Data Streams** → click your web stream (or create one).
3. Copy the **Measurement ID** — format is `G-XXXXXXXXXX` (10 alphanumerics after `G-`).

**Before you uncomment**, update the Content Security Policy on your origin server. The reference build's CSP is set in `server/server.js` and Nginx; you need to add three host allowances:

| Directive    | Add                                                                |
|:-------------|:-------------------------------------------------------------------|
| `script-src` | `https://www.googletagmanager.com`                                 |
| `connect-src`| `https://www.google-analytics.com https://*.google-analytics.com`  |
| `img-src`    | `https://www.google-analytics.com`                                 |

If you skip the CSP update the inline `gtag('config', …)` call gets blocked, the data layer never initializes, and traffic silently doesn't record. Browser console will log the CSP violation.

### 3. Optional: Google Tag Manager

If your franchise prefers GTM (single container, easier to add Facebook Pixel / LinkedIn Insight / TikTok later without re-deploying), swap the gtag block for the GTM snippet. CSP additions:

| Directive    | Add                                                                |
|:-------------|:-------------------------------------------------------------------|
| `script-src` | `https://www.googletagmanager.com`                                 |
| `connect-src`| `https://www.googletagmanager.com`                                 |

The `<noscript>` GTM iframe goes immediately after the opening `<body>` tag, not in `<head>`.

## Iframe content does not need separate verification

The iframe pages (`*-embed.html`) carry `<meta name="robots" content="noindex">` so Google does not index them as duplicates of the host page. You **do not** need a separate Search Console property for the iframe content, and you **do not** want GA4 firing inside the iframe — it would double-count visits.

If you ever decide to track iframe-internal events (tab clicks, CTA taps, etc.) the right pattern is to send them out to the parent via the bridge protocol (`postMessage`), then have the parent fire the GA4 event. The bridge already has the plumbing; ask in Slack before adding new event types so we keep the contract clean.

## Verifying after deploy

1. **Search Console:** click **Verify** in the property setup flow. Within seconds you should see "Ownership auto-verified" or similar.
2. **GA4:** open <https://analytics.google.com> → your property → **Realtime**. Open your franchise host URL in another tab. Within ~30 seconds you should see one active user.
3. **CSP:** open Chrome DevTools → Console while loading the host page. Any `Refused to connect to … because it violates the following Content Security Policy directive` lines mean your CSP additions are missing. Fix the directive, redeploy, retest.

## Reference build status

The reference build's host page (`public/dev/austin-host-mock.html`) contains placeholder tokens, **not** real ones. Real franchise deployments must replace them. The CI pipeline does **not** validate that the placeholders have been replaced — that's on the deploying owner.
