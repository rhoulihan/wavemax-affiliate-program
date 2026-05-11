# Parent-Site Defect Audit — wavemaxlaundry.com / austin-tx — 2026-05-08

**Baseline:** `parent-site-fix-checklist.md` (2026-05-02), incorporating
`post-cutover-report-2026-04-30.md` and the user-testing/footer-defects
sub-checklists.

**This audit:** rendered-DOM capture of every Austin sub-page on
`https://www.wavemaxlaundry.com/austin-tx/*` taken 2026-05-08, programmatic
verification of every previously-documented defect, plus inspection for
new issues introduced since the prior audit.

**Author:** John Richard Houlihan, Authorized Officer, CRHS Enterprises LLC

---

## TL;DR

- **Fixed (Austin only):** 5 of 12 catalogued defects (E1, E2, E3, E4,
  E7/E8, U4) — but in 4 of those, the "fix" is a runtime patch that
  applies to Austin only; non-Austin franchises still ship the broken
  template.
- **Remediated by runtime patch (workaround, not fix):** 2 (E11, E1
  via `data-wm-austin-fix` markers; both Austin-only).
- **Still defective:** 6 (B3 map shows "F1" not "WaveMAX" — third
  attempt — plus the original E5, E6, E10, F1, U3; F2 is removed
  not fixed; E12 not verifiable).
- **New issues introduced since 2026-05-02:** **6**, including a
  catastrophic regression where every non-Austin franchise's "Get
  Directions" button now sends customers to **Austin's** physical
  address (1100+ miles away in some cases). Other new issues: review
  widget active site-wide except Austin; non-Austin Send-a-Message
  forms POST directly to Zoho CRM with no CAPTCHA / no client rate
  limiting; the runtime-patch architecture itself ships Austin's
  customizations to every franchise.
- **Method note:** the "fixes" applied since 2026-05-02 use a runtime
  DOM-patching JavaScript (`isAustin()`-gated WPCode block) that
  rewrites broken markup at page-load time rather than fixing the
  underlying templates. This works for Austin; **for every other
  franchise it is worse than no fix at all** — broken templates
  remain in the static HTML, the runtime script's `isAustin()` gate
  causes it to do nothing, AND the script's hardcoded Austin
  address gets baked into shared global elements (see N0 below).

---

## Items fixed since 2026-05-02

### E1 — Footer "Get Directions" hardcoded Jacksonville → **fixed** (runtime patch)

Three "Get Directions" anchor variants on the landing page now point at
Austin's address:

```
https://www.google.com/maps/dir/?api=1&destination=825%20E%20Rundberg%20Ln%20Suite%20F1%2C%20Austin%2C%20TX%2078753
```

Each carries a `data-wm-austin-fix="directions"` attribute marker
indicating the runtime patch script applied the correction. Pre-patch,
the underlying template still hardcodes Jacksonville's "12959 Beach
Blvd" address (3 mentions remain in the page source), but the runtime
script overwrites the `href` before any user interacts with the link.

**Verdict:** customer-facing behavior is correct on Austin's pages.
Underlying template defect (hardcoded Jacksonville) persists.

### E2 — Landing-page hero "Call" button empty `tel:` href → **fixed**

Previously `<a href="tel:">Call</a>` (no number). Now:

```html
<a href="tel:512-309-0430" ...>Call (512) 309-0430</a>
```

`(512) 309-0430` is the Hibu tracking number assigned to Austin's web
landing source. Empty `tel:` count on landing page: **0**.

### E3 — Self-serve-laundry hero "Call" button empty `tel:` href → **fixed**

Same fix as E2 applied to the self-serve sub-page. Empty `tel:` count: **0**.

### E4 — Commercial-niche subpages missing SEO instrumentation → **fixed**

Previously the niche pages (medical, gym, Airbnb, restaurants,
contractors) shipped with no `<title>`, no meta description, and no
canonical. Now (verified 2026-05-08):

- `commercial/medical-offices/`
  - title: "Medical Offices Laundry in Austin, TX | WaveMAX | WaveMAX Laundry"
  - canonical: `https://wavemaxlaundry.com/austin-tx/commercial/medical-offices/`
  - meta description: present
- `commercial/health-clubs/`
  - title: "Health Clubs Laundry in Austin, TX | WaveMAX | WaveMAX Laundry"
  - canonical: `https://wavemaxlaundry.com/austin-tx/commercial/health-clubs/`
  - meta description: present

Comparable instrumentation applied to airbnb, restaurants, contractors
(spot-checked).

**Verdict:** SEO basics now present on niche pages.

### E7 / E8 — `LOCATIONS` array stale + duplicate `var locations` array → **fixed**

Previously two parallel JS arrays declared on the same page (one with
the typed structure, one with a flatter struct, both stale). Today:
**one** `var LOCATIONS = [...]` declaration on the landing page; the
duplicate `var locations` array is gone.

### U4 — Empty address placeholder on about-us → **fixed**

Previously the Austin about-us page rendered with literal placeholder
strings (e.g. `[wm address]`) where dynamic location data should have
substituted. Today: zero literal placeholder strings remain on
`about-us.html`.

---

## Items remediated by runtime patch (workaround, not fix)

These items would, in a properly-templated site, be fixed at the
template level (Divi page builder, theme functions). Instead, the
parent site's `WPCode` plugin injects a JavaScript block on every
page-load that rewrites the broken markup *after* it renders. The
behaviour is correct from the user's perspective; the underlying
template is still broken.

### E11 — Send-a-Message form white-on-white → **runtime-replaced** with MHR GHL iframe

The original `<form class="wm-cform">` (still present in the SSR HTML,
still with the white-on-white CSS) is replaced at load-time by the
runtime patch script with a MHR-controlled GoHighLevel form iframe
(`https://api.mhrmarketing.com/widget/form/cqVwTCtviazPnV1m38us`).
4 `data-wm-austin-ghl="1"` markers found on `contact.html` confirm the
runtime replacement fired.

**Implication:** customer-form submissions on Austin's contact page
now flow to MHR Marketing's CRM rather than corporate WordPress
(separate finding documented in Exhibit F supplement and the 2026-05-07
forensic capture). The original white-on-white form is bypassed but
not fixed; data routing is changed without disclosure to the user.

### E1 (mechanism) — Get Directions destination → **runtime-rewritten**

See E1 in the Fixed section. Same pattern: original Jacksonville
href is replaced at load-time via a runtime patch.

---

## Items still defective

### E5 — JSON-LD `@type` is `FAQPage` + `WebSite`, not `LocalBusiness` → **STILL DEFECTIVE**

Captured types on `landing.html` and `contact.html`:

```
"@type":"Answer"
"@type":"FAQPage"
"@type":"Question"
"@type":"SearchAction"
"@type":"WebSite"
```

No `LocalBusiness` / `LaundryOrDryCleaner` schema present. Without it,
Google cannot construct the rich-result business card (hours, phone,
address, geo, opening hours, payment methods) for the local pack — a
significant SEO defect for a brick-and-mortar service.

### E6 — Stale `es` hreflang → **STILL DEFECTIVE**

```html
<link rel="alternate" hreflang="es-MX" href="https://wavemaxlaundry.com/es/austin-tx/">
<link rel="alternate" hreflang="es"    href="https://wavemaxlaundry.com/es/austin-tx/">
```

Both `es-MX` and `es` point at `/es/austin-tx/`. Original concern was
that `/es/austin-tx/` is unhealthy / not properly translated; not
verified today, but the hreflang pair pointing at a thinly-translated
Spanish path remains.

### E10 — Direct-to-Google review widget → **STILL DEFECTIVE on non-Austin franchises; Austin remains gated by page-id-2025 CSS hide rule**

Austin's contact page still ships the `wm-reviews` widget HTML +
script + the `body.parent-pageid-2025 .wm-reviews { display: none }`
override that visually hides it on Austin's pages only. Other
franchises ship the widget unmodified (see Exhibit J §3). The
"replace with filtered review-solicitation flow" suggestion from the
prior audit is unaddressed system-wide.

### E12 — Breadcrumb "Home" link target → **NOT VERIFIABLE** (no breadcrumb element rendered today)

The current rendered DOM does not contain a recognisable breadcrumb
markup pattern (`itemprop="item"` on a "Home" anchor, `class="breadcrumb"`
nav). Either the breadcrumb has been removed entirely, or it is now
rendered via JavaScript after our 10-second virtual-time-budget
window. Cannot confirm fixed/broken status; **flagged as needs
manual review**.

### F1 — Footer "Local Links" panel — every link a no-op → **STILL DEFECTIVE**

5 `href="#"` anchors remain on the landing page. Footer-block presence
confirmed at offset ~218 KB into the rendered DOM. The "no-op local
links" pattern was a footer-template defect; it persists.

### F2 — Footer contact form — modal blocks selection, location not captured, white-on-white → **REMOVED ENTIRELY**

The first 8 KB after the `<footer>` tag contains no `<form>` element.
This may indicate the footer contact form was removed (rather than
fixed). Functionally, footer-form submissions are no longer possible;
that closes the bug but at the cost of removing the affordance.
**Verdict:** the path is no longer broken because it doesn't exist.
Whether that's an acceptable resolution is a content-strategy
question, not a defect-status question.

### B3 — Embedded map shows "F1" instead of "WaveMAX"; "Open in Maps" doesn't surface the business → **STILL DEFECTIVE after three MHR fix attempts**

The embedded Google Maps iframe on `/austin-tx/contact/` and the
"Open in Maps" handler that opens it full-screen continue to label
the pin **"F1"** — the suite number — rather than the business name
"WaveMAX Laundry." This is the third audit cycle in which this
specific item has been flagged.

**Why it happens** — examining the iframe `src` on the corporate
page (captured 2026-05-08T21-07-28Z, `contact-rendered-dom.html`):

```
https://www.google.com/maps?q=825%20E%20Rundberg%20Ln%20Suite%20F1%2C%20Austin%2C%20TX%2078753&output=embed
```

The query string is **address-only**. Google Maps interprets a query
of that shape as an address search, labels the resulting pin with
the most distinctive component of the address (the suite identifier
"F1"), and produces a "directions to this address" experience —
not a "you're at WaveMAX Laundry" experience. There is no
WaveMAX-branded result anywhere on the resulting map. Clicking
the pin or "Open in Maps" surfaces "F1" as the destination name,
not the business.

The iframe carries `data-wm-austin-mapfix="1"`, indicating that
the runtime fix-up script *did* run and *did* substitute the
query string. But the substitution is the wrong substitution —
it fixed the earlier broken `[wm address]` placeholder by
inserting the address, without adding the business name that
makes Google Maps render WaveMAX as the destination.

**Compare against `wavemax.promo/austin-tx/contact/`** — same
location, same Austin franchisee, same Google Maps embed pattern,
correct query construction (verified 2026-05-08, same audit
session):

```
https://www.google.com/maps?q=WaveMAX+Laundry+825+E+Rundberg+Ln+f1+Austin+TX+78753&output=embed
```

The business name leads the query. Google Maps resolves it as a
business search, labels the pin **"WaveMAX Laundry"**, and the
"Open in Maps" handler surfaces WaveMAX as the destination.

**Pattern-of-conduct context.** This specific defect was flagged
in the original `parent-site-fix-checklist.md` as item B3 on
2026-05-02. Per the franchisee's records, MHR Marketing has
made **three separate attempts** to fix it since that date.
Each attempt has produced the same residual outcome: the runtime
patch substitutes the literal address but does not include the
business name. The result, after three iterations, is a map
that prominently displays "F1" — a suite identifier — to every
visitor of Austin's contact page, with WaveMAX's brand name
absent from the map experience entirely.

A correct fix takes one line of substitution: change the query
construction from `${address}` to `WaveMAX Laundry ${address}`,
or — preferably — query by Google Place ID (`?q=place_id:...`)
which routes to the canonical business listing. Either change is
~5 minutes of work. That this remains broken after three
remediation cycles, while less significant items elsewhere on the
site receive no attention at all, is itself diagnostic of the
operational pattern documented in Exhibit J.

**Worse — non-Austin franchises ship the original broken
template untouched.** The runtime patch script is gated by an
`isAustin()` check (it inspects the body class for
`parent-pageid-2025` / `page-id-2025`). For every other
franchise's contact page, the script returns early without
applying any of its fixes — including this one. Verifying via
the multi-franchise capture from 2026-05-08T14-02-22Z (Capture
3 in the forensic-evidence chain-of-custody):

| Franchise | Map iframe `src` |
|---|---|
| `austin-tx` | runtime-patched: `…?q=825 E Rundberg Ln Suite F1, Austin, TX 78753&output=embed` (mislabeled "F1") |
| `temple-tx` | static template: `…?q=[wm address]&output=embed` |
| `charlotte-nc` | static template: `…?q=[wm address]&output=embed` |
| `jacksonville-fl` | static template: `…?q=[wm address]&output=embed` |
| `camelback-phoenix-az` | static template: `…?q=[wm address]&output=embed` |

On the four non-Austin franchise contact pages, Google Maps is
literally being asked to search for the **string `[wm address]`**.
There is no address substitution at all — the template
placeholder is sitting in the rendered query, unsubstituted, on
every contact page that isn't Austin's. Customers visiting
Charlotte's, Jacksonville's, Temple's, or Phoenix's contact pages
see a map that does not show their location, does not show
their store, and does not show any business named WaveMAX. They
see whatever fallback Google Maps renders for an unparseable
bracketed query.

This is the same defect class as Austin's "F1" mislabel — but at
a far worse severity. Austin's customers see the wrong label;
the other four franchises' customers see no useful map at all.
The corporate runtime-patch architecture has produced a state in
which **fixing one franchise's specific defect by special-casing
their body class leaves every other franchise's instance of the
same defect entirely unaddressed.** This is the inverse of how a
well-templated CMS would work — a template fix would propagate;
the special-case patch does not.

The full catalogue of runtime-patched-for-Austin-only items
(E1 directions, E2/E3 phone, E11 form-replace, B3 map-query)
follows the same pattern: every fix is Austin-scoped, every
non-Austin franchise still ships the broken template. This is a
direct corollary of the no-per-franchise-isolation finding
documented in Exhibit J §3.

### U3 — Fabricated testimonials on about-us → **STILL DEFECTIVE**

Search for the three names called out in the original U3 finding
(Tim S., Taneisha, Omar L.) on `about-us.html`:

```
"Tim S."   mentions: 1
"Taneisha" mentions: 1
"Omar L."  mentions: 1
```

All three fabricated testimonials still present on Austin's about-us
page, including the one that plagiarises a real Google review. **No
remediation since the prior audit.**

---

## New issues introduced since 2026-05-02

### N0 — "Get Directions" on every non-Austin franchise's contact page now sends customers to Austin's address

This is the most severe regression discovered in this audit.

The original 2026-05-02 baseline catalogued (E1) that the footer
"Get Directions" link hardcoded **Jacksonville's** address on every
franchise's pages — clearly wrong, but at least one specific wrong
location. After MHR's remediation work, the situation has been
*replaced*, not fixed.

Examining the post-remediation rendered DOM on each franchise's
contact page (Capture 3, 2026-05-08T14-02-22Z):

| Franchise | "Get Directions" href destination |
|---|---|
| `austin-tx` | `825 E Rundberg Ln f1 Austin TX 78753` (Austin — correct) |
| `temple-tx` | `825 E Rundberg Ln f1 Austin TX 78753` (**Austin — wrong, should be Temple**) |
| `charlotte-nc` | `825 E Rundberg Ln f1 Austin TX 78753` (**Austin — wrong, should be Charlotte**) |
| `jacksonville-fl` | `825 E Rundberg Ln f1 Austin TX 78753` (**Austin — wrong, should be Jacksonville**) |
| `camelback-phoenix-az` | `825 E Rundberg Ln f1 Austin TX 78753` (**Austin — wrong, should be Phoenix**) |

Every single non-Austin franchise's contact page now routes
customer-clicked "Get Directions" requests to **Austin's** physical
location instead of the customer's local franchise. A customer in
Phoenix who clicks Get Directions on Phoenix's contact page is
literally being sent to Austin, ~1,100 miles away.

This appears to be a direct consequence of the runtime-patch
architecture documented in §3.2 of Exhibit J: when MHR fixed E1
(the Jacksonville hardcode) for Austin, they did so by hardcoding
Austin's address into the global template. The Jacksonville
hardcode was replaced with an Austin hardcode. Same defect class,
new wrong location, applied site-wide.

Severity: **catastrophic**. Customer is being misrouted by a
multi-state distance from their intended destination. This will
result in immediate customer-facing failure — the customer will
arrive at a navigation experience that takes them to the wrong
state. Unlike most defects, this one cannot be ignored by users:
any customer using "Get Directions" gets a wrong destination.

### N1 — Austin-specific runtime patch script + CSS now ships on every franchise's pages (no per-franchise isolation)

This is the principal architectural finding documented in
**Exhibit J — Operational Pattern of Negligence**. Forensically captured
in `forensic-evidence/page-captures/multi-franchise-comparison-2026-05-08T14-02-22Z/`.

Summary, since this audit's scope is the Austin pages specifically:
the runtime fix-up script that "fixes" Austin's defects (E1 mechanism,
E11 mechanism, plus three numbered "ISSUE" headers) is embedded in
every franchise's pages, gated only by a `body.parent-pageid-2025` CSS
class check. Charlotte, Jacksonville, Temple, and Phoenix's pages all
ship the same Austin-specific code, including the GHL form ID
`cqVwTCtviazPnV1m38us` (which routes customer-form submissions to
Austin's MHR CRM) and the comment "Per Austin franchisee request — do
not facilitate unfiltered Google reviews from contact page" embedded
in plain visible source. See Exhibit J for the full architectural
implication.

### N2 — Customer-message form data routing changed without user disclosure

The runtime patch (per E11 above) replaces the corporate Send-a-Message
form with a MHR-controlled GoHighLevel iframe at
`api.mhrmarketing.com/widget/form/cqVwTCtviazPnV1m38us`. The user-facing
consent/Privacy-Policy text inside the GHL iframe names "WaveMAX Laundry"
as the data recipient, while the data is being collected on
`mhrmarketing.com` infrastructure. This is a material disclosure
question separate from the form-rendering defect E11 was originally
catalogued as. Forensically captured in
`forensic-evidence/page-captures/austin-tx-contact-2026-05-07T23-33-19Z/`.

### N3 — Review widget active on every non-Austin franchise; "Per Austin franchisee" CSS hide is the only protection against unfiltered reviews

The `wm-reviews` 5-star rating widget on the contact page —
which on a 5-star tap opens Google Search prefilled to leave a
public Google review, and on a <5-star tap scrolls to the
contact form — ships on every franchise's contact page in
identical form. Across all 5 captured franchises:

| Franchise | `wm-reviews` block present | `handleRating` function present |
|---|---|---|
| `austin-tx` | yes | yes |
| `temple-tx` | yes | yes |
| `charlotte-nc` | yes | yes |
| `jacksonville-fl` | yes | yes |
| `camelback-phoenix-az` | yes | yes |

The only thing that differs between Austin's contact page and
the other four is a single CSS rule, scoped by body-class:

```css
body.parent-pageid-2025 .wm-reviews,
body.page-id-2025 .wm-reviews {
  display: none !important;
}
```

This rule applies only on Austin (parent-pageid `2025`). The
plain-text comment that introduces it — *"Hide Google Review
widget on Austin pages only. Per Austin franchisee request — do
not facilitate unfiltered Google reviews from contact page"* —
is shipped on every franchise's HTML as visible source text.

**Implication:** every non-Austin franchise's customers see and
interact with the unfiltered-review-gating widget. Customers
who tap 5 stars are sent directly to Google Reviews (without the
review-solicitation filter the original audit recommended).
Customers who tap fewer stars are routed to the contact form to
"tell us more so we can make it right" — a structure that
funnels low-rating customers into private channels and high-
rating customers to public Google. This is the textbook pattern
the FTC has repeatedly identified as **review-gating**, the
same pattern that the original 2026-05-02 audit (item E10) flagged
as needing system-wide replacement with a balanced
review-solicitation flow.

The status one week post-audit: nothing system-wide has been
done. Only one franchisee (Austin) has the widget hidden, and
only because that franchisee specifically requested the hide
rule. Charlotte, Jacksonville, Temple, and Phoenix have not
been notified that their contact pages are still gating reviews,
nor have they been given the option to apply the same hide rule
to their own pages.

### N4 — Send-a-Message form on non-Austin franchises now POSTs to Zoho CRM directly; missing CAPTCHA, missing rate limiting

On non-Austin franchise contact pages, the original
`<form class="wm-cform">` (white-on-white legacy WordPress form
catalogued as E11) is no longer rendered (`wm-cform` class count =
0 on the four non-Austin captures). What renders instead is two
**Zoho CRM Webform** instances:

| Form | id / name | Purpose |
|---|---|---|
| Form 1 | `formLaundry` / `WebToContacts5380807000108894017` | Customer "Laundry Service Inquiry" |
| Form 2 | `formFranchise` / (custom) | Franchise-prospect inquiry |

These forms POST customer-supplied data **directly to Zoho CRM's
WebToContacts endpoint** (`crm.zoho.com/crm/WebToContactForm.do`
or equivalent) without going through corporate WordPress.

**Anti-spam / anti-bot review of the Zoho forms:**

| Protection | Status | Notes |
|---|---|---|
| Honeypot field | ✓ present | Hidden field `name="aG9uZXlwb3Q"` (base64 → "honeypot") with empty value; Zoho rejects submissions where this is filled. |
| Zoho WebForm Analytics fingerprint | ✓ present | `wfa_instance_id="1"`, plus `wf_tr_div_1` block carrying `te`, `rw`, `la`, `eo`, `wbfIanaFrD` device-fingerprinting tokens. Used by Zoho's anti-fraud, not for rate limiting. |
| Google reCAPTCHA | ✗ absent | No `grecaptcha`, no reCAPTCHA Enterprise, no client-script load from `gstatic.com/recaptcha/`. |
| hCaptcha / Cloudflare Turnstile | ✗ absent | No vendor refs in the rendered DOM. |
| WordPress CSRF nonce | ✗ absent (and would not apply — form bypasses WP entirely) | Form action targets Zoho directly. |
| Client-side dwell-time gate | ✗ absent | No Date.now()-based timer or comparable signal. |
| Server-side rate limiting | unknown | Cannot be confirmed from client-side inspection. Zoho's WebToContacts API may impose internal per-source rate limits, but those would not be exposed to the page; verification would require attempting submissions and observing throttle behaviour. |

**Verdict:** the Zoho honeypot + WebForm Analytics fingerprinting
is enough to deter the lowest-effort spam bots, but the absence
of CAPTCHA and the unknown rate-limiting posture leaves the form
exposed to:

  - **Volumetric automated submissions** — a moderately-capable
    bot that knows to leave the `aG9uZXlwb3Q` field empty can
    submit at whatever rate Zoho's server-side limits allow,
    which the corporate site has no visibility into.
  - **Lead-list spamming** — without CAPTCHA, a competitor
    could submit a high volume of fake "Laundry Service Inquiry"
    leads to fill the franchisee's CRM with garbage and make
    real leads harder to surface.
  - **Cross-site form injection** — without WP CSRF, form-
    submission CSRF on this endpoint is governed entirely by
    Zoho's own protections (which they do implement, but it's
    not a layered defense).

By contrast, the franchisee's own form on `wavemax.promo` (a
direct comparable) ships with: per-IP server-side rate limiting
(via `contactFormBurstLimiter` + `contactFormLimiter` middleware
with MongoDB-backed state), CSRF token, server-side validators,
honeypot field, dwell-time gate (3-second floor), and silent-
reject of anti-spam trips so attackers cannot iterate.

**Recommendation:** at minimum, add reCAPTCHA Enterprise or
Cloudflare Turnstile to the corporate Zoho forms, and confirm
with MHR / Zoho what rate-limiting posture the WebToContacts
endpoint enforces.

### N5 — "ISSUE 1 / ISSUE 2 / ISSUE 4" numbered comment headers in runtime patch (with ISSUE 3 missing)

The runtime fix-up script's comment structure exhibits the
prompt-driven AI-assisted authorship pattern documented in
Exhibit J §3.3 (numbered issue headers, missing ISSUE 3, defensive
multi-stage retries, vendor-specific knowledge). The script
itself is on every franchise's pages.

---

## Programmatic evidence (this audit's measurements)

```
File                                     | data-wm-austin-* markers | Jacksonville mentions
landing.html                             | 10                       | 3 (in source, runtime-overridden)
contact.html                             | 10                       | (not measured)
wash-dry-fold.html                       | 8                        | (not measured)
self-serve-laundry.html                  | 9                        | (not measured)
commercial.html                          | 7                        | (not measured)
about-us.html                            | 7                        | (not measured)

Empty tel: links — landing                                         | 0
Empty tel: links — self-serve                                      | 0
LOCATIONS / var locations declarations on landing                  | 1
Tim S. / Taneisha / Omar L. mentions on about-us                   | 1 each
Literal placeholder strings on about-us                            | 0
JSON-LD @type set on landing                                       | Answer, FAQPage, Question, SearchAction, WebSite (no LocalBusiness)
parent-pageid-2025 / page-id-2025 references on landing            | 9
parent-pageid-2025 / page-id-2025 references on contact            | 9
```

---

## Audit forensic preservation

This audit document and the underlying captured pages will be hashed
and added to `forensic-evidence/page-captures/austin-pages-audit-2026-05-08T<timestamp>/`
for chain-of-custody preservation.

---

## Items requiring corporate/MHR action

Severity legend: **CRITICAL** = customer-facing, demonstrably wrong;
**High** = SEO / privacy / brand; **Medium** = quality;
**Low** = polish.

| ID | Item | Severity |
|---|---|---|
| **N0** | **Get Directions on Phoenix / Charlotte / Jacksonville / Temple all route customers to Austin's address (1100+ miles wrong in some cases)** | **CRITICAL** |
| B3 | Map iframe shows "F1" not "WaveMAX" on Austin (third MHR attempt has not corrected this); non-Austin franchises ship literal `[wm address]` placeholder in map query — they don't even render their own location | High (brand + customer-facing) |
| N3 | Review-gating widget active on Phoenix / Charlotte / Jacksonville / Temple contact pages (Austin alone is hidden by CSS rule) — FTC review-gating concern site-wide | High (legal / brand) |
| U3 | Fabricated testimonials Tim S. / Taneisha / Omar L. still on about-us — one plagiarises a real Google review, third audit cycle in which this is flagged | High (legal — plagiarism) |
| N4 | Non-Austin Send-a-Message forms POST directly to Zoho CRM with no CAPTCHA, no client-side rate limiting; only protection is Zoho's built-in honeypot — add reCAPTCHA Enterprise or Cloudflare Turnstile | High (anti-spam) |
| N2 | Disclose MHR Marketing as a data processor/recipient on the Austin contact-form GHL consent text | High (privacy compliance) |
| E5 | Add LocalBusiness / LaundryOrDryCleaner JSON-LD schema | High (SEO) |
| N1 | Refactor runtime fix-up script into per-franchise opt-in scoping; today's hardcoded-for-Austin pattern is the proximate cause of N0 (every Austin "fix" pollutes the global template for every other franchise) | High (architectural) |
| F1 | Footer "Local Links" panel — replace 5x `href="#"` no-ops with real targets | Medium |
| E6 | Audit /es/austin-tx/ Spanish translation completeness | Medium |
| E12 | Verify breadcrumb behavior — confirm whether removed or moved to client-side render | Low |

---

*End of audit. See Exhibit J for the broader operational-pattern
narrative this audit feeds into.*
