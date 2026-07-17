# WaveMAX Austin (`/austin-tx/`) — indexing collapse: root cause + fix

Prepared for the corporate webmaster. Diagnosis is grounded in **your own Google Search
Console export** (Page Indexing for `www.wavemaxlaundry.com/austin-tx/`, pulled 2026-07-10)
plus live-URL testing on 2026-06-29. **The primary problem is a broken URL migration, not
structured data.** Read §1–§3 first.

---

## 0. TL;DR

1. **A language-URL-scheme change was shipped without 301 redirects**, orphaning ~40+
   previously-indexed URLs. That triggered a **deindexing collapse**: Austin went from
   **123 indexed / ~1,000 impressions per day** to **13 indexed / 0 impressions** between
   early May and mid-June 2026. → **§1, §2**
2. **The fix is a set of 301 redirects** from the old locale paths to the new ones, then a
   GSC validation. → **§3**
3. The structured-data mis-scoping is real and worth fixing, but it is **secondary** and
   was never the cause of the collapse. → **§5**

---

## 1. What the Search Console data shows (this is not "never indexed" — it's a regression)

From your Page-Indexing export, indexed-page count and impressions for `/austin-tx/`:

| Date | Indexed | Not indexed | Impressions/day |
|---|---:|---:|---:|
| 2026-04-12 | **123** | 119 | ~1,065 |
| 2026-04-27 | 105 | 128 | ~913  ← first drop (−14) |
| **2026-05-04** | **63** | 156 | **377 → 27** ← cliff (−34, impressions crater) |
| 2026-06-05 | 40 | 147 | **0** |
| **2026-06-12** | **13** | 150 | ~0 ← second cliff (−25) |
| 2026-06-29 | **13** | 150 | **0** |

These pages **were** indexed and ranking (~1,000 impressions/day in April). They were
progressively dropped to **13 indexed / 0 impressions**. Something broke; it did not "fail
to start."

**"Why pages aren't indexed" (critical issues, from the same export):**

| Reason | Pages | Meaning |
|---|---:|---|
| **Not found (404)** | **60** | URLs Google had indexed now return 404 |
| Page with redirect | 12 | indexed URL now redirects elsewhere |
| Soft 404 | 1 | thin/empty page returning 200 |
| **Crawled – currently not indexed** | **68** | crawled, quality/dup, not kept |
| Duplicate, Google chose different canonical | 9 | Google overrode the declared canonical |
| Discovered – currently not indexed | 0 | — |

The **60 × 404** is the trigger. When a large block of previously-indexed URLs starts
404-ing, Google drops them **and** loses trust in the surrounding folder — which is exactly
the shape of this collapse.

---

## 2. Root cause (verified by live testing)

**The language URL scheme was changed from full-locale to short-code, with no redirects.**

| Old path (was indexed) | New path (now live) | Old path status today |
|---|---|---|
| `/es-mx/austin-tx/…` | `/es/austin-tx/…` | **404** |
| `/pt-br/austin-tx/…` | `/pt/austin-tx/…` | **404** |
| `/de-de/austin-tx/…` | `/de/austin-tx/…` | **404** |
| `/zh-cn/austin-tx/…` | `/zh/austin-tx/…` | **404** |
| `/fr-fr/austin-tx/…` | `/fr/austin-tx/…` | **404** |
| `/ko-kr/austin-tx/…` | `/ko/austin-tx/…` | **404** |

Tested the 6 region-coded locales × the Austin page set: **42 returned 404**, and the
matching new short-code URLs all return `200`. 6 old-locale locales × ~7 Austin pages ≈ the
"60 Not found (404)" bucket (the rest are other restructured URLs — see §4). The new pages
are healthy; the **old URLs were simply abandoned instead of redirected**.

Compounding it: the current pages still declare `hreflang` values with the **old** region
codes (`hreflang="es-MX"`, `"pt-BR"`, `"de-DE"`, …) while pointing `href` at the **new**
short paths — a mismatch that should be reconciled (use `es`/`es-MX` consistently on both
sides).

> Redirects/canonical/robots/https are otherwise **correct** (`www`→apex 301, `http`→`https`
> 301, self-referential canonicals, clean robots + sitemap). Don't spend time there.

---

## 3. THE FIX — 301-redirect the old locale paths → the new ones

This is site-wide (every location, not just Austin). Add these six rules; they are
all-or-nothing regex maps that preserve the rest of the path.

**Apache / `.htaccess`:**
```apache
RewriteEngine On
RewriteRule ^es-mx/(.*)$ /es/$1 [R=301,L]
RewriteRule ^pt-br/(.*)$ /pt/$1 [R=301,L]
RewriteRule ^de-de/(.*)$ /de/$1 [R=301,L]
RewriteRule ^zh-cn/(.*)$ /zh/$1 [R=301,L]
RewriteRule ^fr-fr/(.*)$ /fr/$1 [R=301,L]
RewriteRule ^ko-kr/(.*)$ /ko/$1 [R=301,L]
```

**nginx:**
```nginx
rewrite ^/es-mx/(.*)$ /es/$1 permanent;
rewrite ^/pt-br/(.*)$ /pt/$1 permanent;
rewrite ^/de-de/(.*)$ /de/$1 permanent;
rewrite ^/zh-cn/(.*)$ /zh/$1 permanent;
rewrite ^/fr-fr/(.*)$ /fr/$1 permanent;
rewrite ^/ko-kr/(.*)$ /ko/$1 permanent;
```

**WordPress (Rank Math → Redirections, or the Redirection plugin), Regex, 301:**
```
^/es-mx/(.*)  →  /es/$1
^/pt-br/(.*)  →  /pt/$1
^/de-de/(.*)  →  /de/$1
^/zh-cn/(.*)  →  /zh/$1
^/fr-fr/(.*)  →  /fr/$1
^/ko-kr/(.*)  →  /ko/$1
```

Then:
1. **Export the full "Not found (404)" URL list** from GSC (§4) and confirm every 404 is
   covered by a redirect (or is intentionally gone). Any old URL that once ranked should
   `301` to its current equivalent, not 404.
2. Fix the `hreflang` code mismatch (old region code in the attribute, new path in `href`).
3. **Resubmit the sitemap** and click **Validate Fix** on the "Not found (404)" and
   "Page with redirect" issues in GSC.

---

## 4. The other buckets — and the one export you must send

The summary CSV only gives **counts**. To finish the job, export the **per-URL** lists:

In GSC → **Page indexing** → click each reason → **Export** (top-right):
- **Not found (404)** → the 60 URLs. Redirect each (most are covered by §3; export catches the rest).
- **Duplicate, Google chose different canonical** → the 9 URLs. Use **URL Inspection** on
  each to see *which* URL Google chose, then reconcile (usually a duplicate path or a
  sitemap/internal link disagreeing with the declared canonical).
- **Crawled – currently not indexed** → the 68 URLs. These recover once the 404 bleed stops
  and the folder regains trust; then **Request Indexing** and differentiate thin pages.

_Send those three exports and they can be turned into an exact per-URL redirect/action list._

---

## 5. Secondary — structured-data mis-scoping (fix after the redirects)

Separate from the collapse, the Austin pages' schema (generated by **Rank Math**) is
mis-scoped: **no first-class `LocalBusiness`**; the only page-level entity is a `WebSite`
named "WaveMAX Austin TX" whose `url` is the **site root**. Corrected `@graph` files are in
this folder — one per page, all anchored to a single Austin entity
(`…/austin-tx/#localbusiness`):

| File | Page |
|---|---|
| `austin-tx-home.json` | `/austin-tx/` |
| `austin-tx-wash-dry-fold.json` | `/austin-tx/wash-dry-fold/` |
| `austin-tx-self-serve-laundry.json` | `/austin-tx/self-serve-laundry/` |
| `austin-tx-commercial.json` | `/austin-tx/commercial/` (+ 8-vertical OfferCatalog) |
| `austin-tx-about-us.json` · `austin-tx-contact.json` | About / Contact |
| `…commercial-vertical.TEMPLATE.json` | the 8 `/commercial/<slug>/` pages |

Install: emit exactly **one** `<script type="application/ld+json">` per page (turn off Rank
Math's competing auto-schema or configure its Local SEO module), remove the old "WaveMAX
Austin TX" `WebSite` block + duplicate `<meta name="robots">`, keep your `FAQPage`.
`aggregateRating` is **intentionally omitted** (Google requires the rating be visible
on-page; these pages show none). Apply the same graph to each language variant with its own
self-referential `@id`.

---

## 6. Verify + realistic recovery timeline

1. After the redirects deploy: `curl -I https://wavemaxlaundry.com/es-mx/austin-tx/wash-dry-fold/`
   → expect **301** to `/es/…` (not 404).
2. GSC → **Validate Fix** on "Not found (404)" + "Page with redirect".
3. Watch **Page indexing**: the "Not found" bucket should shrink and **Indexed** climb back
   over the following **2–6 weeks** as Google recrawls. Impressions follow indexing.
4. Then apply the structured data (§5) and re-run the Rich Results Test.

_NAP source of truth: `(512) 553-1674` · 825 E Rundberg Ln F1, Austin TX 78753 · open daily 07:00–22:00._
