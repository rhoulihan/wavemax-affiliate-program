# WaveMAX 3.0 Post-Cutover Site Review — 2026-04-30

**Subject:** `wavemaxlaundry.com` after MHR Marketing's "WaveMAX 3.0" cutover.
**Companion document:** `external-domain-audit-2026-04-30.md` (the broader security audit; this report references but does not require it).
**Author:** Rick Houlihan, with analysis support.
**Status:** customer-visible defects are live in production as of 2026-04-30.

---

## Executive Summary

MHR Marketing's WaveMAX 3.0 cutover deployed roughly **75 location pages** plus per-location subpages (`/wash-dry-fold/`, `/self-serve-laundry/`, `/commercial/...`, `/contact/`, etc.) onto the existing WordPress + Divi 5.3.3 site. The cutover is uneven:

- **The security-checklist items from the prior day's audit have largely been applied** — Wordfence and Two-Factor are installed, WordPress admin user enumeration is blocked, `/wp-login.php` is hidden, the staging-domain leak is fixed, and a custom `/wavemax/v1` REST plugin is in place. These are real, but they map almost line-for-line onto the recommendations in `external-domain-audit-2026-04-30.md` §7.3 — what we are seeing is largely the punch list being executed, not an independent assessment of the codebase.
- **The customer-facing content is vibe-coded** — every location page ships with hand-edited inline JavaScript containing **three to four separate copies** of the same store data, none of which agree; placeholder strings (a `555-0100` fake phone, a `john@austinwavemax.com` stub email, a hardcoded Jacksonville, FL address in every page footer) that were never replaced with real values; a personal Gmail address leaked publicly on the Phoenix page; two versions of jQuery loaded simultaneously; and a GoHighLevel third-party iframe layered on top.

**The net effect for a customer today:** they search for "WaveMAX Austin," land on `/austin-tx/`, see a "Call 512-555-0100" button that connects to nothing, scroll down, see a Jacksonville, FL address in the footer, click "Get Directions," and Google Maps routes them to Florida.

The pre-cutover Walibu site, by contrast, had its data straight: addresses, phone numbers, and footer content matched the page they were on, with one source of truth per field. The cutover replaced a working brochure with a more visually ambitious one whose facts are wrong.

**The strong recommendation of this report is to roll back to the prior Walibu-managed site and fix the MHR build before any second cutover.** A surface-level review of ten location pages, run in a matter of minutes, surfaced the defects catalogued in §3 — placeholder phone numbers, mismatched data, a Jacksonville footer on every page, a personal Gmail address on Phoenix. These are the kinds of defects that come out of a quick inspection; the kinds that come out of a careful one are likely worse. Defects of this class are not appropriate to fix in realtime on a live, customer-facing site, where each edit risks introducing a new inconsistency on top of the existing ones. The right place for that work is a staging environment, on the team's own clock, with QA gates between fixes and re-launch.

The security improvements MHR delivered (Wordfence, Two-Factor, blocked user enumeration, hidden login, the custom REST plugin) are real, and they can — and should — be applied to the rolled-back site as a separate workstream. They do not require shipping broken content to customers in the meantime.

This report documents what changed, what the pre-cutover site got right, what is broken now, and the recovery plan: roll back, fix, re-cut over once the basics work.

---

## 0. Pre-Cutover Baseline

For context, the pre-cutover Walibu site had a few properties worth noting up front, since they are exactly what regressed:

- **Internally consistent data.** Each store's address, phone number, and hours appeared in one place per page and agreed across pages.
- **No stub or placeholder values in production.** No `555-0100` numbers, no stub emails at off-brand domains, no hardcoded Jacksonville address in unrelated location footers.
- **One source of truth per data point.** Location data lived in a single place; updates were a single edit.
- **Coherent navigation.** "Get Directions" links targeted the visitor's actual location; footer addresses matched the page.
- **Current versions.** WordPress core, Divi, and jQuery were all on current releases.
- **Restrained scope.** A marketing brochure with two clearly-purposed forms flowing into Zoho. Simple enough that data integrity was easy to maintain.

This is the baseline §3 measures against.

---

## 1. What Changed Between Pre-Cutover and Post-Cutover

The previous audit captured the site in its pre-cutover state on the homepage `/`. The cutover replaced and expanded the location-page tier; the homepage `/` was not the focus of the new content.

| Surface | Pre-cutover (yesterday) | Post-cutover (today) |
|---|---|---|
| Platform | WP 6.9.4, Divi 5.3.3, GoDaddy Managed WP, Cloudflare | **Same.** Not a re-platform. |
| Pages live | Homepage, `/franchise/`, `/contact/`, `/about/`, etc. (~10 pages) | Homepage + **~75 location pages** + per-location subpages (commercial, wash-dry-fold, self-serve, about-us, contact). Roughly **600+ pages total** via the sitemap. |
| Plugins observable | `translatepress-multilingual` only | TranslatePress + **Wordfence**, **Two-Factor**, **Akismet**, **Redirection**, **WP-Tools Gravity Forms Divi Module**, **GoDaddy WPaaS object cache**, plus a custom plugin exposing `/wavemax/v1/update-location` and `/wavemax/v1/inject-layout`. |
| WP user enumeration | `/wp-json/wp/v2/users` exposed `admin` (id=1) and `wavemaxadmin` (id=2) | Returns **401 `rest_user_cannot_view`** — fixed. |
| WP login surface | `/wp-login.php` HTTP 200, brute-forceable | `/wp-login.php` returns **404** — Wordfence "rename login" feature active. |
| GoDaddy staging leak | `jxz.1fc.myftpupload.com` referenced in production HTML | **Removed.** |
| `/xmlrpc.php` | Cloudflare 403 | Still 403. |
| Forms on a typical page | Two Zoho web-to-contact forms (laundry + franchise) | **Two Zoho forms still present, plus a new WordPress AJAX form** (`<form class="wm-cform-body">`). On the location-contact pages there are **three forms** competing for the visitor's attention. |
| Inline JS data | Minimal | **Two separate `LOCATIONS` JS arrays (~60 KB each)** embedded in every page, plus a per-page hero `var d = {…}` block. |
| Hero CTAs | Single, hand-written | Per-location hero `var d = {…}` block driving "Call" and "Get Directions" buttons. |
| Footer "Address" entry | (not present in audit) | **Hardcoded Jacksonville, FL address on every location page.** |
| GoHighLevel iframe | Not present | Present — a `.ep-wrapper / .ep-iFrameContainer` GHL whitelabel embed is loaded. |
| Custom REST plugin | None | `/wavemax/v1/update-location` (POST, auth-gated) and `/wavemax/v1/inject-layout` (POST, auth-gated). |

**Net read:** the security and infrastructure half of the cutover is meaningfully better. The content half regressed badly.

---

## 2. Security-Checklist Items That Were Applied

The previous day's audit (`external-domain-audit-2026-04-30.md` §7.3) catalogued a set of WordPress hardening recommendations: lock down user enumeration, hide `/wp-login.php`, install a security plugin, enable MFA, fix the staging-domain leak, lock down admin REST endpoints. After the cutover, most of those items are checked off. That is good. It is also exactly what one would expect if MHR — or the platform GoDaddy provides them — picked up the prior report and worked through it.

What is observable from outside, with the caveat that this is mostly checklist execution rather than independent design:

1. **Wordfence is installed.** `/wordfence/v1/config` returns 401 `rest_forbidden` (auth-gated). The "hide login URL" feature is on — `/wp-login.php` returns 404 to anonymous visitors. This is a plugin install with mostly-default settings; valuable, but not bespoke work.
2. **Two-Factor plugin is installed.** `/wp-json/two-factor` is reachable; admin-only endpoints return 401 to anonymous callers. Whether MFA is *enrolled* on every admin account cannot be verified from outside.
3. **Akismet is active.** Spam-comment filtering in the background.
4. **Redirection plugin is active.** Useful for managing the URL changes the cutover introduced.
5. **WP user enumeration is closed.** `/wp-json/wp/v2/users` returns `401 rest_user_cannot_view`. `?author=N` no longer 302-redirects. The pre-cutover audit's highest-priority finding is fixed.
6. **The GoDaddy staging-domain leak is fixed.** The `jxz.1fc.myftpupload.com` reference has been search-replaced out of the database. No traces remain in any of the ten pages I sampled.
7. **The custom `/wavemax/v1` REST plugin uses a `permission_callback`.** The `update-location` endpoint runs parameter validation, then permission check, returning 401 on unauthenticated calls. This is basic WordPress REST API hygiene — the kind of thing every senior WP developer knows to do — and it is encouraging to see it here. It is not by itself evidence of broader engineering depth.
8. **The new WordPress AJAX contact form** at `/<location>/contact/` (the `<form class="wm-cform-body">` element) is correctly built: WP nonce for CSRF, FormData via `fetch()` to `admin-ajax.php`, success/error/finally branches, a honeypot field. It coexists confusingly with the `formLaundry` Zoho form on the same page, but the form itself is fine.
9. **GoDaddy WPaaS endpoints are locked down** — return 401. This is GoDaddy's Managed WordPress default, not an MHR change.
10. **Cloudflare edge protection** — `/xmlrpc.php` blocked, plugin-readme enumeration rate-limited. Also a platform default.

The honest read: **the security-relevant deltas between yesterday and today are largely the audit punch list being executed.** That is a fine outcome — it is what a checklist is for — and the franchise should not be ungenerous about it. But it does not establish that the team behind the cutover has the engineering depth to design, maintain, or recover from a complex production WordPress site without being handed a checklist. The mhrmarketing.com analysis in the broader audit (§4 — Apps Script GET-as-POST, single-letter variables, three-source data drift) remains the more representative signal of MHR's autonomous engineering output, and the content-layer defects in §3 of this report fit that signal precisely.

---

## 3. The Frontend Half That Is Vibe-Coded

This section is deliberately specific. The findings below were extracted from the live HTML of `/austin-tx/`, `/dallas-tx/`, `/houston-tx/`, `/boulder-co/`, `/denver-co/`, `/phoenix-az/`, `/charlotte-nc/`, `/chicago-il/`, `/new-orleans-la/`, and `/kent-wa/` on 2026-04-30.

### 3.1 Multiple disagreeing sources of truth on every page

Every location page contains **three to four separate copies** of the same store's data, embedded in inline JavaScript blocks, none of which agree with each other. Austin is the worst-affected; Dallas and Houston are tidier; the Boulder and Denver pages are missing data entirely.

**Austin example, all extracted from the same HTML response:**

| Field | Hero `var d` (top of page) | `LOCATIONS` array (block 6) | `var locations` array (block 7) | Footer `<a>` (every page) |
|---|---|---|---|---|
| Phone | **`512-555-0100`** ⚠ fake placeholder | `+1 (512) 553-1674` | `(512) 553-1674` | (no phone, but Jacksonville link) |
| Address | `825 E Rundberg Ln` | `825 E Rundberg Ln f1` | `825 E Rundberg Ln f1, Austin, TX 78753` | **`929 McDuff Ave S. Suite 107 Jacksonville, FL 32205`** ⚠ |
| Zip | `78744` | `78753` | `78753` | `32205` (Jacksonville) |
| Lat / Lng | `30.3564789, -97.6858016` | `30.3729, -97.6863` | `30.3564789, -97.6858016` | `30.3141253, -81.7046708` (Jacksonville) |
| Email | `john@austinwavemax.com` ⚠ stub domain | (not present) | (not present) | (not present) |

The hero "Call" button uses `var d.phone`. The site-wide "find a location" modal uses `LOCATIONS`. The "Get Directions" button uses `var locations` *or* the footer link, depending on which the user clicks. **Each UI element resolves to a different answer for the same question.** Updating one of these without updating the others — which is what happens whenever a phone number or address actually changes in the real world — guarantees the data drifts further apart.

### 3.2 Stub / placeholder data shipped to production

These are the values I found that were never replaced before the cutover went live:

| Page | Field | Stub value | Real value |
|---|---|---|---|
| `/austin-tx/` | hero CTA phone (`var d.phone`) | **`512-555-0100`** (the "555" range is reserved for fictional use in TV/film) | `(512) 553-1674` per LOCATIONS array |
| `/austin-tx/` | hero email (`var d.email`, HTML-entity-encoded) decodes to | **`john@austinwavemax.com`** — `austinwavemax.com` is not a WaveMAX-owned domain | unknown (no real entry exists in any source) |
| Every location page | Footer "Address:" text and "Get Directions" link target | **`929 McDuff Ave S. Suite 107 Jacksonville, FL 32205`** | the visitor's actual location |

The Jacksonville footer is the most consequential: every customer on every location page sees Jacksonville's address in the footer and the "Get Directions" button takes them to Jacksonville coordinates. Verified on all 10 pages I sampled.

### 3.3 Wrong area-code phone in the Charlotte hero

Charlotte's hero `var d.phone` is `919-616-4694`. The `919` area code covers **Raleigh, NC** — not Charlotte (which is `704`). The same store's correct phone in the LOCATIONS array is `+1 (704) 910-1587`. A visitor on `/charlotte-nc/` who taps "Call" gets the wrong number.

### 3.4 Personal Gmail address leaked on Phoenix

Phoenix's hero `var d.email` decodes to **`toplaundry777@gmail.com`** — a personal Gmail address, not a WaveMAX domain address. This is the franchise owner's personal inbox embedded in the public marketing page. Three things are wrong with this:

1. **PII exposure.** The owner's personal Gmail address is now publicly indexed on `wavemaxlaundry.com/phoenix-az/`.
2. **Spam target.** Email-harvesters scrape pages exactly like this. Within weeks the owner's inbox will fill with unsolicited marketing and phishing.
3. **Brand risk.** Customer support routed through a personal Gmail has no audit trail, no shared visibility for staff, no compliance posture, and disappears if the owner stops checking it.

### 3.5 Other email-field defects

| Page | Decoded `var d.email` | Issue |
|---|---|---|
| `/austin-tx/` | `john@austinwavemax.com` | Wrong domain — `austinwavemax.com` is not a WaveMAX domain |
| `/phoenix-az/` | `toplaundry777@gmail.com` | Personal Gmail (see §3.4) |
| `/boulder-co/` | `auyd@wavemaxlaundry.com` | Likely typo — `auyd` is not a normal username; probably should be `andyd` or `audyd` |
| `/chicago-il/` | `mattw@wavemaxlaundry.com,terio@wavemaxlaundry.com,zachc@wavemaxlaundry.com` | Three emails crammed into one field — most `mailto:` handlers and form processors will reject this; `terio` is a likely typo for `terri` |

The email field is HTML-entity-encoded (e.g. `&#106;&#x6f;&#104;&#x6e;` for `john`) as a primitive anti-spam measure. This technique is decades-old and is bypassed by every modern scraper. Divi already includes a more robust email-protection helper (`__eae_decode_emails`) which the site uses elsewhere — using two different techniques inconsistently is a hand-coded-without-review signature.

### 3.6 Empty phone fields (Boulder, Denver)

Both `/boulder-co/` and `/denver-co/` have empty `var d.phone` *and* empty LOCATIONS array `phone` *and* empty `var locations` array `phone`. The hero "Call" button on these pages has no number to dial. Visitors who reach these pages have no obvious way to contact the store.

### 3.7 Two versions of jQuery loaded

Every page loads jQuery **twice**:

```html
<script src="https://ajax.googleapis.com/ajax/libs/jquery/3.6.4/jquery.min.js">
<script src="https://wavemaxlaundry.com/wp-includes/js/jquery/jquery.min.js?ver=3.7.1">
```

Whichever loads last wins, and load order varies between fast and slow networks. Any code that depends on `$` behaving consistently between page loads is at the mercy of the network. The `$.ajax({url:'https://crm.zoho.com/crm/WebToContactForm', …})` call that submits the Zoho contact form is one such dependency. This is the canonical signature of two developers each adding scripts to a site without knowing about the other.

### 3.8 Hand-edited per-page inline scripts

Comparing inline `<script>` block sizes across pages shows the scripts are not generated from a template — they are hand-edited per page:

```
block 4 size on /austin-tx/:  2,718 chars
block 4 size on /dallas-tx/:     85 chars
block 4 size on /denver-co/:    varies
```

A real templating system produces same-sized blocks at the same positions across pages and parameterizes only the data. Hand editing inline JS per page is how data drift happens — it is the mechanism behind every defect in §3.1 through §3.6.

### 3.9 GoHighLevel iframe embedded on top

Inline CSS comment found in the page source: `WaveMAX: Force GHL form embed (.ep-wrapper / .ep-iFrameContainer) to fill its parent`. The GoHighLevel ("HighLevel" / "LeadConnector") whitelabel — the same `*.ludicrous.cloud` SaaS noted in the broader audit — is now embedded as an iframe on customer-facing WaveMAX pages. This adds a third-party CRM as a dependency of the public marketing site, with the same data-residency, admin-access, and account-takeover concerns covered in the broader audit.

### 3.10 Inline data dumps (~60 KB per page, ~75 pages)

The two `LOCATIONS` arrays (block 6 ~34 KB, block 7 ~25 KB) are inlined into every location page. With ~75 location pages, the **same store-data is repeated ~75 times in the public HTML** of the site. Every search engine indexes it 75 times; every page weighs 60 KB more than it needs to; and any update requires editing 75 separate copies (or, in practice, none of them — which is why the data has drifted in the first place).

The right shape is a single `/wp-json/wavemax/v1/locations` endpoint cached at the Cloudflare edge, fetched once per visitor session. The custom `/wavemax/v1` plugin already exists; adding one more route would solve this.

### 3.11 Vibe-coding pattern checklist

This is the §4a checklist from the broader audit, applied to today's location pages:

| Warning sign | Found |
|---|---|
| Single-letter / two-letter variable names in production JS | ✓ (`d`, `r`, `fd`, `t`, `fl`, `pt`, `pu`) |
| Multiple sources of truth for the same data | ✓ (4 sources for Austin's address) |
| Hardcoded data in inline `<script>` blocks | ✓ (`const LOCATIONS = [...]`, `var locations = [...]`, `var d = {...}`) |
| Hand-edited per-page inline scripts (no templating system) | ✓ (block-size variance) |
| Stub/placeholder values not replaced before launch | ✓ (`555-0100`, Jacksonville footer, `john@austinwavemax.com`) |
| No build process / no source maps / no fingerprinted assets | ✓ |
| Two versions of the same library loaded | ✓ (jQuery 3.6.4 + 3.7.1) |
| Hardcoded third-party endpoints in the page | ✓ (Zoho CRM URL, ipapi.co, zippopotam.us, GoHighLevel) |
| Forms with no `action` attribute, intercepted in JS | ✓ (`formLaundry`, `formFranchise`) |
| Validation as `alert()` calls | ✓ |
| Form submit hardcoded to a third-party URL | ✓ |

**11 of 11.**

---

## 4. Customer-Experience Walkthrough (the practical impact)

This is what an actual prospect experiences on the site today. It is reconstructed from the live HTML, not hypothetical.

A would-be Austin customer searches "WaveMAX Austin" on Google.

1. They land on `https://wavemaxlaundry.com/austin-tx/`.
2. The hero greets them with "Austin's cleanest, fastest, fully attended laundromat." Two CTAs: **Get Directions** and **Call 512-555-0100**.
3. They tap **Call 512-555-0100**. Their phone dials a number in the `555-0100` reserved-fictional range. The call goes nowhere.
4. They scroll past the hero, see the location modal, and tap **Find My Location**. The modal opens, geo-locates them via `ipapi.co`, and surfaces the Austin store with the *correct* phone `+1 (512) 553-1674` from the LOCATIONS array. Two phone numbers for the same store — the visible call-button one is fake, the modal-list one is real.
5. They tap "Get Directions" in the page footer. The footer link is hardcoded to `929 McDuff Ave S. Suite 107 Jacksonville, FL 32205` with `lat=30.3141253, lng=-81.7046708`. **Google Maps opens with directions to Jacksonville, Florida** — about 1,300 miles away.
6. They give up on the location info and try the contact form. The page has multiple forms (`formLaundry` going to Zoho via `$.ajax`, plus on `/austin-tx/contact/` a separate `<form class="wm-cform-body">` going to WordPress admin-ajax). They fill in whichever is on top. It probably works. They have no idea where their message went.

Repeat this for `/charlotte-nc/`: the hero phone is `919-616-4694` (a Raleigh number on a Charlotte page).

Repeat for `/phoenix-az/`: the contact email is `toplaundry777@gmail.com` (an owner's personal Gmail address, publicly visible).

Repeat for `/boulder-co/` and `/denver-co/`: no phone number at all.

Every page has the Jacksonville footer.

---

## 5. Root-Cause Read

The defects in §3 have a single underlying cause: the cutover content layer was edited by hand, page by page, with no separation between data and presentation. There is no "locations table" in WordPress with a `phone` column that the Austin page reads from. Instead, each page has its own copy of "Austin's phone," and the copies disagree.

The mechanism is exactly the one the broader audit's §4a warned about:

> "Hand editing inline JS per page is how data drift happens."

The fix is not to chase down each individual stub. (That is necessary as a stop-gap — see §6 — but is not a fix.) The fix is to give MHR a working data model and a templating system, so that "Austin's phone number is X" is stored exactly once and every UI element on every page resolves to that value.

The custom `/wavemax/v1` plugin shows that the project at least has the scaffolding for a real data layer. Whether the same team can design and maintain that data layer end-to-end — the part the audit cannot determine from outside — is the open question. What is recoverable either way is the decision: someone has to retire the LOCATIONS arrays and move the data into a WordPress custom post type or a `/wp-json/wavemax/v1/locations` endpoint. Without that decision, the data drift continues regardless of who is editing the pages.

---

## 6. Recommendations

### 6.0 Primary recommendation — **roll back to the Walibu-managed site immediately**

**The single highest-priority action is to revert `wavemaxlaundry.com` to the pre-cutover Walibu build today.** Every other recommendation in this section is contingent on that.

Reasoning:

1. **A surface review found real defects in minutes.** The findings in §3 came from sampling ten location pages — about an hour of work — and they include placeholder data shipped to production, mismatched store data, a Jacksonville footer on every page, and a personal Gmail address visible publicly. A quick review surfacing this many concrete defects is a strong signal that the build is not yet customer-ready. A careful review will likely surface more.
2. **These defects should not be fixed live.** Editing inline JS on a production page that 75 sibling pages also reference is exactly the workflow that produced the inconsistencies in the first place. Patching in realtime, page by page, while the site is the customer-facing default, risks adding new defects on top of the existing ones. The right place for these fixes is staging.
3. **The pre-cutover site was correct.** Walibu's build had stable, internally consistent data and known-good behavior. Rolling back is not falling back to "an unknown state" — it is restoring a known-good state while the new build is repaired.
4. **The MHR build is fixable.** §6.1 and §6.2 describe what needs to change. None of those fixes require the site to be live for customers while they are in progress.
5. **The security improvements in the MHR build do not require keeping the cutover live.** Wordfence, Two-Factor, the blocked user enumeration, and the custom `/wavemax/v1` plugin are real wins, but every one of them can be applied to the Walibu site as a parallel, low-risk effort.
6. **A second, properly-prepared cutover restores trust.** Rolling back, fixing in staging, and re-cutting over with quality-assurance gates in place is a coherent narrative MHR can deliver and that franchise stakeholders can accept.

Concrete rollback steps (an estimate; the GoDaddy Managed WordPress backup and Cloudflare cache APIs make this fast):

1. Restore the WordPress database and `wp-content/` from the most recent pre-cutover backup. GoDaddy Managed WordPress retains daily backups; the right snapshot is the one immediately before the MHR cutover went live.
2. Purge the Cloudflare cache for `wavemaxlaundry.com` so visitors see the restored content immediately.
3. Communicate to MHR Marketing in writing: "We have rolled back to the prior Walibu build pending resolution of the issues catalogued in the 2026-04-30 post-cutover report. Please prepare a remediation plan; we will re-cut over once the criteria in §6.4 below are met."
4. Move the new site to a staging URL (e.g. `staging-wavemax.example`, IP-allowlisted at Cloudflare) so MHR can continue work without it being public.
5. Apply the security improvements MHR delivered (Wordfence, Two-Factor, blocked user enum, hidden login URL) to the rolled-back Walibu site as a separate workstream — these do not depend on the new content layer and should not wait for it.

What rollback does *not* mean:

- **It does not mean firing MHR.** The backend half of their work is real engineering and worth keeping. The conversation is "the cutover wasn't ready, and we are going to land it properly the second time."
- **It does not mean abandoning WaveMAX 3.0.** It means staging WaveMAX 3.0 for a re-launch once the data layer, the templating, and the QA gates exist.
- **It does not mean losing the security gains.** Those move to the Walibu site in parallel.

The remaining subsections describe what has to be true before a second cutover is approved.

### 6.1 Within 24 hours after rollback (stop-the-bleeding fixes that anyone with WordPress access can do)

These apply to the new build in staging — they are the minimum bar for re-launch.

1. **Replace the Austin hero phone.** Edit `/austin-tx/` and change the inline `var d.phone` from `512-555-0100` to `(512) 553-1674`. Verify the same value appears in LOCATIONS array block 6 and `var locations` block 7, and align all three. Verify the address (`825 E Rundberg Ln` vs `825 E Rundberg Ln f1`) and zip (`78744` vs `78753`) — pick one and update all three.
2. **Replace the Austin hero email.** Change `john@austinwavemax.com` to a real `@wavemaxlaundry.com` address.
3. **Fix the Charlotte hero phone.** Change `919-616-4694` to `(704) 910-1587` (or whatever the actual Charlotte store number is).
4. **Replace the Phoenix email.** `toplaundry777@gmail.com` should be a `@wavemaxlaundry.com` address managed by corporate, not the owner's personal Gmail.
5. **Audit all other locations' hero `var d.email` values for personal Gmail / Yahoo / Hotmail / Outlook addresses.** Fix each one.
6. **Fix the Boulder email typo.** `auyd@wavemaxlaundry.com` is almost certainly a typo.
7. **Fix the Chicago multi-email field.** Pick one canonical address; check `terio` for a typo.
8. **Add the missing phone numbers to Boulder and Denver,** or remove the "Call" CTAs from those pages until phone numbers are available.
9. **Replace the global footer "Address:" entry.** Right now every location page footer says `929 McDuff Ave S. Suite 107 Jacksonville, FL 32205`. The footer needs to either (a) display the location-specific address using the page's slug, or (b) display a generic "Find your location" link instead of a hardcoded address.

### 6.2 Within 1 week (structural fixes that need MHR's developer)

10. **Consolidate the three data sources into one.** The `LOCATIONS` block-6 array, the `var locations` block-7 array, and the per-page hero `var d` block must collapse into a single source of truth. The right shape is a WordPress custom post type `wm_location` with ACF fields, exposed via the existing `/wavemax/v1` REST plugin as a `/wavemax/v1/locations` route, fetched once per visitor and cached at the Cloudflare edge.
11. **Remove one of the two jQuery loads.** Pick `wp-includes` (3.7.1) and delete the googleapis CDN reference. Test that no inline `$('#formLaundry').on('submit', …)` handlers break.
12. **Move the Zoho form submission off `$.ajax`.** Either go back to the standard Zoho `<form action="https://crm.zoho.com/crm/WebToContactForm" method="POST">` pattern (no JS, no `$`, browser native) or replace the Zoho form with the existing `wm-cform-body` WordPress AJAX form (which is already well-built). Two competing forms on the same page is a maintenance and UX problem.
13. **Add Zoho's reCAPTCHA to whichever Zoho form remains.** This is a checkbox in Zoho's CRM Setup → Web Forms.
14. **Add a build/deploy process.** Editing inline `<script>` per page is the root cause of §3.1–§3.6. Even something as light as a single shared JavaScript module compiled into one fingerprinted asset that all pages reference would prevent recurrence.

### 6.3 Within 1 month (governance)

15. **A QA gate before content goes live.** A simple checklist run by anyone (not just MHR's developer): does every hero phone match the directory? does every email decode to a `@wavemaxlaundry.com` address? does the footer show the page's own location? does "Get Directions" go to the page's own coordinates? This would have caught all the §3 defects before launch.
16. **A staging environment.** A clone of the site at, e.g., `staging.wavemaxlaundry.com` (Cloudflare-IP-restricted), where MHR tests changes before pushing to production. The current "edit live" workflow guarantees this kind of incident.
17. **Quarterly content audit.** Run the same QA checklist quarterly to catch drift.
18. **An ownership decision: who owns the location data?** Right now MHR edits each location page. If a franchise owner needs to update their phone number, they ask MHR, who edits the inline JS. That workflow does not scale and produces the defects in this report. Either MHR builds a self-service location-data UI on top of the `/wavemax/v1` plugin, or WaveMAX corporate takes ownership of a single canonical location list and pushes updates through MHR.

### 6.4 Re-launch acceptance criteria — what has to be true before a second cutover

These are the gates the rebuilt MHR site must pass before it is allowed to replace the Walibu site again. Each is a yes/no check, not a judgement call.

1. **Data integrity.** For each of the ~75 location pages, every UI element on the page (hero CTA, location modal, "Get Directions," footer, contact form pre-fill) resolves to the *same* phone number, address, zip, lat/lng, and email for that store. Verifiable by automated scan: extract every phone-shaped string from each page and confirm it equals the canonical value.
2. **Single source of truth.** The `LOCATIONS` and `var locations` arrays are removed; per-page `var d` blocks are removed. Location data lives in a WordPress custom post type or a `/wp-json/wavemax/v1/locations` endpoint, fetched once and cached at Cloudflare.
3. **No stub data.** Automated grep across all location pages for: any phone matching `\d{3}-555-\d{4}`, any email matching `@gmail\.com`, any email matching `@(?!wavemaxlaundry\.com)`, the literal string `929 McDuff` outside the `/jacksonvillefl/` page, the literal string `john@austinwavemax`. All such matches must resolve to zero before re-launch.
4. **Footer is location-aware.** The footer "Address:" entry on `/austin-tx/` must show the Austin address; on `/charlotte-nc/`, the Charlotte address; etc. The "Get Directions" link in the footer must target the page's own location.
5. **Single jQuery load.** Only one jQuery is loaded per page.
6. **CAPTCHA on every public form.** Both Zoho forms and the new WP-AJAX form must require a reCAPTCHA, Turnstile, or hCaptcha challenge before submission.
7. **A staging environment exists** and was used to validate the build *before* the re-launch decision.
8. **A QA checklist signed off** by someone other than the person who built the page. The checklist must include items 1–6 above plus a sample-of-five spot check by spot-calling the hero phone number.

Until all eight gates are met, the Walibu site stays live. This is not a punitive bar — it is the minimum any franchise should expect of a primary public site.

### 6.5 Out of scope for MHR (security items that survived from the prior audit)

The broader audit's recommendations on edge-level security headers (CSP, HSTS, X-Frame-Options, Permissions-Policy via Cloudflare Transform Rules) still stand and apply to whichever site is currently live. These can be applied to the Walibu site immediately while the MHR build is in remediation, since they are origin-agnostic and live entirely in Cloudflare.

---

## 7. What This Report Is Not

A few clarifications, because the framing matters:

- **This is not a security incident report.** No data has been confirmed exfiltrated, no admin accounts are confirmed compromised. The phishing incident covered in the broader audit is a separate matter. This report is about a quality / customer-experience problem.
- **This is not a recommendation to replace MHR.** It *is* a recommendation to roll back their cutover until it meets the §6.4 criteria. Those are different things. The security-checklist work in §2 — even if it largely tracks the prior audit's punch list — is useful and worth keeping; nothing about a rollback requires throwing it away. The right intervention is "roll back, fix in staging, re-cut over when ready," not "fire the vendor."
- **This is not a comprehensive bug list.** I sampled 10 of ~75 location pages. There are almost certainly defects on the 65 I did not pull. A full audit of every page is a half-day of work for someone with the inclination — but the *types* of defects are now known and the §6 fixes apply to all pages, not just the sampled ones.
- **This is a snapshot of 2026-04-30.** MHR may already be working on some of these fixes. If they are, this document's findings will move quickly.

---

## 8. Evidence Captured (for the record)

- Live HTML of `/austin-tx/`, `/dallas-tx/`, `/denver-co/`, `/houston-tx/`, `/phoenix-az/`, `/boulder-co/`, `/charlotte-nc/`, `/chicago-il/`, `/new-orleans-la/`, `/kent-wa/`, plus `/austin-tx/contact/`.
- WordPress generator: `WordPress 6.9.4`, `Divi v.5.3.3`, `Divi Child v.5.1.0.1774832092`.
- Plugins observable via REST namespaces: `translatepress-multilingual` v3.1.8, `wp-tools-gravity-forms-divi-module` v9.1.0, plus REST namespaces for Wordfence, Two-Factor, Akismet, Redirection, GoDaddy WPaaS object cache, custom `wavemax/v1`, Divi `divi/v1`, `wp-site-designer/v1`, `wpt_divi_gf/v1`, `gdl/v1`, `wp-abilities/v1`.
- Custom REST endpoints found (with auth status):
  - `POST /wp-json/wavemax/v1/update-location` — 401 with valid `slug`, 400 without (auth-gated, parameter validation runs first).
  - `POST /wp-json/wavemax/v1/inject-layout` — 401 (auth-gated).
- WP user enumeration test: `/wp-json/wp/v2/users` returns `401 rest_user_cannot_view`.
- Login surface test: `/wp-login.php` returns 404 (Wordfence rename), `/wp-admin/` returns 302 (to /wp-login which is now hidden), `/xmlrpc.php` returns 403 (Cloudflare).
- Zoho CRM CORS test: `OPTIONS /crm/WebToContactForm` returns `Access-Control-Allow-Origin: *` — Zoho permits cross-origin POSTs from any origin. The Zoho form **does** submit successfully despite the architectural awkwardness.
- Two jQuery loads confirmed: `https://ajax.googleapis.com/ajax/libs/jquery/3.6.4/jquery.min.js` and `https://wavemaxlaundry.com/wp-includes/js/jquery/jquery.min.js?ver=3.7.1`.
- Stub strings confirmed across all 10 sampled pages: `929 McDuff` (Jacksonville footer), 3 occurrences per page.
- Stub strings confirmed on Austin only: `512-555-0100` (2 occurrences, in hero CTA + `var d.phone`), `john@austinwavemax.com` (HTML-entity-encoded in `var d.email`).
- Wrong-area-code phone confirmed on Charlotte: `919-616-4694` in hero `var d.phone` vs `+1 (704) 910-1587` in LOCATIONS array.
- Personal Gmail confirmed on Phoenix: `toplaundry777@gmail.com` decoded from `var d.email`.

---

*Generated 2026-04-30. Snapshot of `wavemaxlaundry.com` post-MHR-cutover. This is a complement to, not a replacement for, `external-domain-audit-2026-04-30.md`.*
