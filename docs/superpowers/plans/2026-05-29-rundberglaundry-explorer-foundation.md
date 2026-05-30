# rundberglaundry Design Explorer — Foundation + Direction 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the design-explorer engine (shared content model + theming + pure render + build), a private explorer shell, and Direction 1 ("Service OS") fully skinned in both brand intensities across all 6 pages — a working explorer demoing one complete direction.

**Architecture:** A build-time pure render function combines one shared content model, a per-direction "skin" (contract: `renderPage(page, content, intensity, lang) → bodyHTML` + a CSS string), and an intensity theme (CSS-variable token set) to emit static, CSP-clean HTML files under `public/design-explorer/render/`. The explorer shell (static, served behind a token guard) swaps an iframe `src` to preview any (direction × intensity × page × lang) at a chosen device width, with a rationale rail. The concierge appears as a styled visual stub here; its live Claude backend is a later plan.

**Tech Stack:** Node (CommonJS, matching repo), Jest, vanilla JS/CSS, Express static + a token-guard middleware. No frontend framework. Strict nonce-based CSP; working `data-i18n`; Lighthouse ~100 target (mobile + desktop).

---

## File Structure

**Build source (repo root, NOT served):**
- `design-explorer/content-model.js` — shared content model (extracted from `public/locales/en|es/common.json` + `public/franchise-default/*`). One responsibility: provide structured content for all 6 pages in EN/ES.
- `design-explorer/themes.js` — intensity theme token sets (`heavy`, `light`): palette, logo prominence, §12.2 placement, as CSS-variable maps.
- `design-explorer/render.js` — pure core: `renderState({skin, intensity, page, lang, nonce}) → htmlString`. Wraps document shell, head, theme class, §12.2 footer; delegates body to the skin.
- `design-explorer/skins/service-os/index.js` — Direction 1 skin: `renderPage(page, content, intensity, lang) → bodyHTML` + exported `css`.
- `design-explorer/skins/_stub/index.js` — tiny fixture skin used to unit-test the core render independent of creative work.
- `design-explorer/build.js` — enumerates states, writes static files to `public/design-explorer/render/`, plus a `manifest.json`.

**Served (output + shell):**
- `public/design-explorer/index.html` — explorer shell markup.
- `public/design-explorer/explorer.css` — shell styling.
- `public/design-explorer/explorer.js` — shell logic (control state → iframe src + rationale).
- `public/design-explorer/render/*.html` — generated states (build output; gitignored).
- `public/design-explorer/manifest.json` — generated state index (build output).

**Server:**
- `server/middleware/explorerGuard.js` — token guard for `/design-explorer/*`.
- `server.js` — register the guard before the static handler (one small edit).

**Tests:**
- `tests/unit/design-explorer/content-model.test.js`
- `tests/unit/design-explorer/render.test.js`
- `tests/unit/design-explorer/build.test.js`
- `tests/unit/design-explorer/explorerGuard.test.js`

---

## Task 1: Content model

**Files:**
- Create: `design-explorer/content-model.js`
- Test: `tests/unit/design-explorer/content-model.test.js`

The content model is skin-agnostic. Shape (one entry per page; `pages` keyed by page id):

```js
// design-explorer/content-model.js
const NAP = {
  name: 'WaveMAX Laundry Austin',
  street: '825 E Rundberg Ln F1',
  city: 'Austin', state: 'TX', zip: '78753',
  phone: '(512) 553-1674', phoneTel: '+15125531674',
  hours: 'Open daily · 7:00 am – 10:00 pm',
  mapsDir: 'https://www.google.com/maps/dir/?api=1&destination=825+E+Rundberg+Ln+F1+Austin+TX+78753',
  mapsEmbed: 'https://www.google.com/maps?q=WaveMAX+Laundry,+825+E+Rundberg+Ln,+Austin,+TX+78753&output=embed&t=k&z=16',
};

// §12.2 notice (mirrors public/terms-and-conditions.html), per intensity placement.
const TRADEMARK_NOTICE =
  'WaveMAX™ and the WaveMAX logo are trademarks of WaveMAX Franchise, LLC. ' +
  'This location is independently owned and operated by CRHS Enterprises, LLC ' +
  'under a franchise license from WaveMAX Franchise, LLC.';

const PAGES = ['home', 'self-serve', 'wash-dry-fold', 'commercial', 'about', 'contact'];

// content[lang].pages[page] = { hero:{title,sub}, sections:[{id,kind,title,items?,body?}], cta:{...} }
// Strings sourced from public/locales/<lang>/common.json (landing.*, about.*, contact.*,
// commercial.*, selfserve.*, wdf.*). Extraction helper below reads those JSON files.
const content = buildContent(); // reads locales JSON at module load

module.exports = { NAP, TRADEMARK_NOTICE, PAGES, LANGS: ['en', 'es'], content };
```

- [ ] **Step 1: Write the failing test**

```js
// tests/unit/design-explorer/content-model.test.js
const model = require('../../../design-explorer/content-model');

describe('content-model', () => {
  it('exposes the 6 pages and EN/ES', () => {
    expect(model.PAGES).toEqual(['home','self-serve','wash-dry-fold','commercial','about','contact']);
    expect(model.LANGS).toEqual(['en','es']);
  });
  it('carries correct NAP', () => {
    expect(model.NAP.street).toBe('825 E Rundberg Ln F1');
    expect(model.NAP.phone).toBe('(512) 553-1674');
    expect(model.NAP.mapsEmbed).toContain('output=embed');
    expect(model.NAP.mapsEmbed).toContain('t=k'); // satellite
  });
  it('carries the §12.2 trademark + license notice', () => {
    expect(model.TRADEMARK_NOTICE).toMatch(/trademarks of WaveMAX Franchise, LLC/);
    expect(model.TRADEMARK_NOTICE).toMatch(/independently owned and operated by CRHS/);
  });
  it('provides a hero title for every page in every language', () => {
    for (const lang of model.LANGS) {
      for (const page of model.PAGES) {
        expect(typeof model.content[lang].pages[page].hero.title).toBe('string');
        expect(model.content[lang].pages[page].hero.title.length).toBeGreaterThan(0);
      }
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/unit/design-explorer/content-model.test.js`
Expected: FAIL — `Cannot find module '../../../design-explorer/content-model'`.

- [ ] **Step 3: Implement the content model**

Create `design-explorer/content-model.js` with the structure above. Implement `buildContent()` to read `public/locales/en/common.json` and `public/locales/es/common.json` and map the existing `landing.*`, `about.*`, `contact.*`, `commercial.*`, `selfserve.*`, `wdf.*` keys into the per-page shape. Where a string is missing in ES, fall back to EN (do not silently emit an empty string). Keep `buildContent` in this file but factor the JSON read into a small local helper `loadLocale(lang)`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/unit/design-explorer/content-model.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add design-explorer/content-model.js tests/unit/design-explorer/content-model.test.js
git commit -m "feat(explorer): shared content model (6 pages, EN/ES, NAP, §12.2)"
```

---

## Task 2: Intensity theme tokens

**Files:**
- Create: `design-explorer/themes.js`
- Test: covered via render.test.js in Task 3 (themes are pure data).

- [ ] **Step 1: Implement theme tokens**

```js
// design-explorer/themes.js
// Intensity = how prominent the WaveMAX brand is. Both keep the brand and §12.2.
const themes = {
  heavy: {
    id: 'heavy',
    logoScale: 1.0,            // full-size logo, brand leads
    brandTitle: 'WaveMAX Austin',
    noticePlacement: 'footer',
    vars: {
      '--brand': '#0c93ad', '--brand-deep': '#0b1f43', '--accent': '#1bcaa3',
      '--ink': '#0b1f43', '--paper': '#ffffff', '--lead': 'brand', // brand leads
    },
  },
  light: {
    id: 'light',
    logoScale: 0.62,           // smaller logo, local identity leads
    brandTitle: 'WaveMAX Austin · independently owned',
    noticePlacement: 'footer',
    vars: {
      '--brand': '#0c93ad', '--brand-deep': '#7a3b2e', // brand recedes to accent; warm local lead
      '--accent': '#c8612f', '--ink': '#2a211c', '--paper': '#faf4ec', '--lead': 'local',
    },
  },
};
module.exports = { themes };
```

- [ ] **Step 2: Commit**

```bash
git add design-explorer/themes.js
git commit -m "feat(explorer): brand-heavy / brand-light intensity theme tokens"
```

---

## Task 3: Core render function (skin-agnostic)

**Files:**
- Create: `design-explorer/render.js`
- Create: `design-explorer/skins/_stub/index.js`
- Test: `tests/unit/design-explorer/render.test.js`

The core wraps the document, applies the theme, injects the §12.2 footer, sets lang, and delegates the body to the skin. CSP: a `{{NONCE}}` placeholder is emitted for any `<style>`/`<script>` so the server (or build) can substitute a nonce; rendered files contain no inline event handlers.

- [ ] **Step 1: Write the failing test**

```js
// tests/unit/design-explorer/render.test.js
const { renderState } = require('../../../design-explorer/render');
const stub = require('../../../design-explorer/skins/_stub');

describe('renderState (core)', () => {
  const base = { skin: stub, page: 'home', lang: 'en', nonce: 'TESTNONCE' };

  it('produces a full HTML document with correct lang', () => {
    const html = renderState({ ...base, intensity: 'heavy' });
    expect(html).toMatch(/^<!DOCTYPE html>/);
    expect(html).toContain('<html lang="en"');
  });
  it('includes the §12.2 trademark notice in every state', () => {
    for (const intensity of ['heavy', 'light']) {
      const html = renderState({ ...base, intensity });
      expect(html).toContain('trademarks of WaveMAX Franchise, LLC');
      expect(html).toContain('independently owned and operated by CRHS');
    }
  });
  it('applies the intensity theme class and brand title', () => {
    const heavy = renderState({ ...base, intensity: 'heavy' });
    const light = renderState({ ...base, intensity: 'light' });
    expect(heavy).toContain('data-intensity="heavy"');
    expect(light).toContain('data-intensity="light"');
    expect(heavy).toContain('WaveMAX Austin');
    expect(light).toContain('independently owned');
  });
  it('delegates the body to the skin and carries the skin css', () => {
    const html = renderState({ ...base, intensity: 'heavy' });
    expect(html).toContain('STUB-BODY-home');   // from the stub skin
    expect(html).toContain('STUB-CSS');          // skin css injected
  });
  it('emits the nonce placeholder substitution (no raw {{NONCE}})', () => {
    const html = renderState({ ...base, intensity: 'heavy' });
    expect(html).toContain('nonce="TESTNONCE"');
    expect(html).not.toContain('{{NONCE}}');
  });
  it('contains no inline event handlers (CSP-clean)', () => {
    const html = renderState({ ...base, intensity: 'heavy' });
    expect(html).not.toMatch(/\son\w+=/);  // onclick=, onload=, etc.
  });
});
```

- [ ] **Step 2: Create the stub skin**

```js
// design-explorer/skins/_stub/index.js
module.exports = {
  id: 'stub',
  css: '/* STUB-CSS */ body{margin:0}',
  renderPage(page /*, content, intensity, lang */) {
    return `<main>STUB-BODY-${page}</main>`;
  },
};
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx jest tests/unit/design-explorer/render.test.js`
Expected: FAIL — `Cannot find module '../../../design-explorer/render'`.

- [ ] **Step 4: Implement the core render**

```js
// design-explorer/render.js
const { themes } = require('./themes');
const model = require('./content-model');

function cssVars(vars) {
  return Object.entries(vars).map(([k, v]) => `${k}:${v}`).join(';');
}

function renderState({ skin, intensity, page, lang, nonce }) {
  const theme = themes[intensity];
  if (!theme) throw new Error(`unknown intensity: ${intensity}`);
  const c = model.content[lang];
  const body = skin.renderPage(page, c, intensity, lang);
  const html = `<!DOCTYPE html>
<html lang="${lang}" data-intensity="${theme.id}" data-skin="${skin.id}">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${model.NAP.name} — ${page}</title>
<style nonce="{{NONCE}}">:root{${cssVars(theme.vars)}}
${skin.css}</style>
</head>
<body>
${body}
<footer class="ds-tm" role="contentinfo">
  <p class="ds-tm-notice">${model.TRADEMARK_NOTICE}</p>
  <p class="ds-tm-copy">&copy; 2026 CRHS Enterprises, LLC.</p>
</footer>
</body></html>`;
  return html.replace(/\{\{NONCE\}\}/g, nonce);
}

module.exports = { renderState };
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest tests/unit/design-explorer/render.test.js`
Expected: PASS (6 tests).

- [ ] **Step 6: Commit**

```bash
git add design-explorer/render.js design-explorer/skins/_stub/index.js tests/unit/design-explorer/render.test.js
git commit -m "feat(explorer): CSP-clean core render with §12.2 + intensity theming"
```

---

## Task 4: Build script

**Files:**
- Create: `design-explorer/build.js`
- Test: `tests/unit/design-explorer/build.test.js`
- Modify: `.gitignore` (add `public/design-explorer/render/`)

The build enumerates `directions × intensities × pages × langs`, renders each via `renderState` (using a literal build-time nonce placeholder `DSNONCE` since these are static files served with a CSP that allows a matching style nonce — see Task 6 note), and writes `public/design-explorer/render/<skin>-<intensity>-<page>-<lang>.html` plus `manifest.json`.

- [ ] **Step 1: Write the failing test**

```js
// tests/unit/design-explorer/build.test.js
const fs = require('fs');
const path = require('path');
const os = require('os');
const { buildAll } = require('../../../design-explorer/build');
const serviceOs = require('../../../design-explorer/skins/service-os');

describe('buildAll', () => {
  it('writes a file per state and a manifest', () => {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'dsbuild-'));
    const res = buildAll({ outDir: out, skins: [serviceOs] });
    // 1 skin x 2 intensities x 6 pages x 2 langs = 24
    expect(res.count).toBe(24);
    expect(fs.existsSync(path.join(out, 'service-os-heavy-home-en.html'))).toBe(true);
    expect(fs.existsSync(path.join(out, 'service-os-light-contact-es.html'))).toBe(true);
    const manifest = JSON.parse(fs.readFileSync(path.join(out, 'manifest.json'), 'utf8'));
    expect(manifest.states.length).toBe(24);
    expect(manifest.states[0]).toHaveProperty('skin');
    expect(manifest.states[0]).toHaveProperty('intensity');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/unit/design-explorer/build.test.js`
Expected: FAIL — cannot find `design-explorer/build` (and/or `skins/service-os`, created in Task 7; until then this test fails — that is expected and this task is re-run green after Task 7).

> NOTE: This test imports the real `service-os` skin (Task 7). Write `build.js` now against the skin contract; the build test goes green once Task 7's skin exists. Until then, verify `build.js` with the `_stub` skin by temporarily importing it in a scratch run; do not commit the scratch import.

- [ ] **Step 3: Implement the build**

```js
// design-explorer/build.js
const fs = require('fs');
const path = require('path');
const { renderState } = require('./render');
const model = require('./content-model');

const INTENSITIES = ['heavy', 'light'];
const BUILD_NONCE = 'DSNONCE'; // static style nonce; server CSP for /design-explorer allows it

function buildAll({ outDir, skins }) {
  fs.mkdirSync(outDir, { recursive: true });
  const states = [];
  for (const skin of skins) {
    for (const intensity of INTENSITIES) {
      for (const page of model.PAGES) {
        for (const lang of model.LANGS) {
          const html = renderState({ skin, intensity, page, lang, nonce: BUILD_NONCE });
          const file = `${skin.id}-${intensity}-${page}-${lang}.html`;
          fs.writeFileSync(path.join(outDir, file), html);
          states.push({ skin: skin.id, intensity, page, lang, file });
        }
      }
    }
  }
  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify({ states }, null, 2));
  return { count: states.length };
}

if (require.main === module) {
  const serviceOs = require('./skins/service-os');
  const outDir = path.join(__dirname, '..', 'public', 'design-explorer', 'render');
  const { count } = buildAll({ outDir, skins: [serviceOs] });
  // eslint-disable-next-line no-console
  console.log(`built ${count} states -> ${outDir}`);
}

module.exports = { buildAll, INTENSITIES, BUILD_NONCE };
```

- [ ] **Step 4: Add gitignore + npm script**

Append to `.gitignore`:
```
public/design-explorer/render/
```
Add to `package.json` scripts: `"build:explorer": "node design-explorer/build.js"`.

- [ ] **Step 5: Defer green-run to Task 7**

The build test goes green after Task 7 creates the `service-os` skin. Proceed to Task 5; return to run:
Run: `npx jest tests/unit/design-explorer/build.test.js`
Expected (after Task 7): PASS.

- [ ] **Step 6: Commit**

```bash
git add design-explorer/build.js tests/unit/design-explorer/build.test.js .gitignore package.json
git commit -m "feat(explorer): build script renders all states + manifest"
```

---

## Task 5: Explorer shell (controls + iframe + rationale rail)

**Files:**
- Create: `public/design-explorer/index.html`
- Create: `public/design-explorer/explorer.css`
- Create: `public/design-explorer/explorer.js`

This is UI work — use the **frontend-design** skill for the shell's look. The shell reads `render/manifest.json`, renders controls (direction/intensity/page/lang/device), sets the preview iframe `src` to the matching `render/<file>.html`, and shows a rationale rail. `explorer.js` is an external (nonce-loaded) module; no inline handlers.

**Acceptance criteria (verification, not pre-written CSS):**
- [ ] Loads `manifest.json` and populates all controls from it (no hardcoded state list).
- [ ] Selecting any (direction × intensity × page × lang) updates the iframe `src` to the correct file; default = `service-os / heavy / home / en / desktop`.
- [ ] Device toggle sets the iframe wrapper width (desktop ~1280px, mobile 390px) with a device frame.
- [ ] Rationale rail shows per-state notes (source: a `rationale` field added to manifest states, or a sibling `rationale.json`); collapsible.
- [ ] `explorer.js` loaded with `nonce`; **zero inline scripts / handlers** (grep check below).
- [ ] Keyboard accessible (controls are real `<button>`/`<select>`, focus-visible).

- [ ] **Step 1: Build the shell with frontend-design**

Invoke the frontend-design skill to author `index.html` + `explorer.css` + `explorer.js` to the criteria above. The shell aesthetic is a neutral "review tool" chrome (not one of the three product skins) so it never competes visually with the previews.

- [ ] **Step 2: Verify CSP-cleanliness + structure**

Run:
```bash
grep -nE "<script(?![^>]*src)|\son\w+=" public/design-explorer/index.html || echo "no inline scripts/handlers"
node -e "const m=require('./public/design-explorer/manifest.json'); console.log('states', m.states.length)"
```
Expected: "no inline scripts/handlers"; states 24 (after Task 7 build).

- [ ] **Step 3: Commit**

```bash
git add public/design-explorer/index.html public/design-explorer/explorer.css public/design-explorer/explorer.js
git commit -m "feat(explorer): review-tool shell (controls, device frame, rationale rail)"
```

---

## Task 6: Token guard for the private URL

**Files:**
- Create: `server/middleware/explorerGuard.js`
- Modify: `server.js` (register guard immediately before the `public` static handler, ~line 851)
- Test: `tests/unit/design-explorer/explorerGuard.test.js`

`/design-explorer/*` must not be publicly discoverable. Guard: allow only if `?k=<EXPLORER_TOKEN>` matches (env), else 404. Also set `X-Robots-Tag: noindex`. CSP for these paths must allow the static `DSNONCE` style nonce — reuse the existing nonce mechanism by serving the guard-approved request through the standard pipeline; the rendered files already carry `nonce="DSNONCE"`, so add `'nonce-DSNONCE'` to `style-src` for `/design-explorer/render/*` only (documented, scoped).

- [ ] **Step 1: Write the failing test**

```js
// tests/unit/design-explorer/explorerGuard.test.js
const explorerGuard = require('../../../server/middleware/explorerGuard');

const mkRes = () => {
  const res = { headers: {} };
  res.status = jest.fn(() => res);
  res.set = jest.fn((k, v) => { res.headers[k] = v; return res; });
  res.send = jest.fn(() => res);
  res.type = jest.fn(() => res);
  return res;
};
const mkReq = (over = {}) => ({ path: '/design-explorer/index.html', query: {}, ...over });

describe('explorerGuard', () => {
  const OLD = process.env.EXPLORER_TOKEN;
  beforeAll(() => { process.env.EXPLORER_TOKEN = 'secret123'; });
  afterAll(() => { process.env.EXPLORER_TOKEN = OLD; });

  it('passes through non-explorer paths untouched', () => {
    const req = mkReq({ path: '/austin-tx/' }); const res = mkRes(); const next = jest.fn();
    explorerGuard(req, res, next);
    expect(next).toHaveBeenCalled();
  });
  it('404s an explorer path without the token', () => {
    const req = mkReq({ query: {} }); const res = mkRes(); const next = jest.fn();
    explorerGuard(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
  });
  it('allows an explorer path with the correct token and marks noindex', () => {
    const req = mkReq({ query: { k: 'secret123' } }); const res = mkRes(); const next = jest.fn();
    explorerGuard(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.headers['X-Robots-Tag']).toBe('noindex, nofollow');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/unit/design-explorer/explorerGuard.test.js`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Implement the guard**

```js
// server/middleware/explorerGuard.js
function explorerGuard(req, res, next) {
  if (!req.path.startsWith('/design-explorer')) return next();
  const token = process.env.EXPLORER_TOKEN;
  if (!token || req.query.k !== token) {
    return res.status(404).type('html').send('<!doctype html><title>Not found</title>Not found');
  }
  res.set('X-Robots-Tag', 'noindex, nofollow');
  return next();
}
module.exports = explorerGuard;
```

- [ ] **Step 4: Register in server.js**

Add immediately before `app.use(express.static(path.join(__dirname, 'public')));` (~line 851):
```js
app.use(require('./server/middleware/explorerGuard'));
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest tests/unit/design-explorer/explorerGuard.test.js`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add server/middleware/explorerGuard.js server.js tests/unit/design-explorer/explorerGuard.test.js
git commit -m "feat(explorer): token-guard /design-explorer (noindex, 404 without key)"
```

---

## Task 7: Direction 1 — "Service OS" skin (both intensities, 6 pages)

**Files:**
- Create: `design-explorer/skins/service-os/index.js` (skin contract: `renderPage` + `css`)
- Create supporting partials as needed under `design-explorer/skins/service-os/`

This is the creative core — use the **frontend-design** skill. The skin renders the shared content model in the bento/utility "Service OS" language for all 6 pages, themed by intensity via the CSS variables from Task 2. The concierge appears here as a **styled visual stub** (a card/launcher with sample prompt + disabled input labelled "Live in production"); live Claude wiring is a later plan.

**Acceptance criteria (per state, verified):**
- [ ] `renderPage(page, content, intensity, lang)` returns valid body HTML for all 6 pages; consumes only the shared content model (no new copy invented beyond microcopy/labels).
- [ ] Bento hero on Home with live-style tiles (Self-Serve, WDF, Commercial, Open-now status, Map, Book); sticky mobile action bar (Call/Directions/Book).
- [ ] Concierge launcher present on every page (visual stub).
- [ ] Brand-heavy vs brand-light are visibly different (palette/logo prominence) yet both carry the WaveMAX logo and the §12.2 footer (the §12.2 footer is emitted by the core, not the skin).
- [ ] Visibly distinct from the corporate site: no Divi chrome, no jQuery, no inline handlers.
- [ ] EN and ES both render with translated strings from the content model.

- [ ] **Step 1: Author the skin with frontend-design**

Invoke frontend-design to implement `service-os/index.js` (+ partials) to the criteria above. Keep `renderPage` a pure function returning a string; keep all CSS in the exported `css` string (or concatenated from partials at module load). No inline scripts; any interactivity stub is CSS-only or a nonce-loaded external file referenced by the shell, not the rendered page.

- [ ] **Step 2: Build all Service OS states**

Run: `npm run build:explorer`
Expected: `built 24 states -> .../public/design-explorer/render`.

- [ ] **Step 3: Run the build + render + content tests green**

Run: `npx jest tests/unit/design-explorer/`
Expected: PASS (content-model, render, build, explorerGuard).

- [ ] **Step 4: Structural verification of generated states**

Run:
```bash
node -e '
const fs=require("fs"),p="public/design-explorer/render";
let bad=0;
for(const f of fs.readdirSync(p).filter(x=>x.endsWith(".html"))){
  const h=fs.readFileSync(p+"/"+f,"utf8");
  if(!/trademarks of WaveMAX Franchise, LLC/.test(h)){console.log("MISSING §12.2:",f);bad++}
  if(/\son\w+=/.test(h)){console.log("INLINE HANDLER:",f);bad++}
  if(/jquery/i.test(h)){console.log("JQUERY:",f);bad++}
}
console.log(bad?("FAIL "+bad):"OK all states clean");
'
```
Expected: `OK all states clean`.

- [ ] **Step 5: Lighthouse + a11y spot-check (frontend-design quality bar)**

Per `docs/development/LIGHTHOUSE-QUALITY-BAR.md`, run Lighthouse on at least `service-os-heavy-home-en` and `service-os-light-home-en` (mobile + desktop) against a local server instance. Target ~100 across categories; fix or document any gap. (Full 24-state sweep can wait for the polish task in a later plan.)

- [ ] **Step 6: Commit**

```bash
git add design-explorer/skins/service-os tests/unit/design-explorer/
git commit -m "feat(explorer): Direction 1 'Service OS' skin — both intensities, 6 pages"
```

---

## Task 8: Local end-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Serve and open the explorer locally**

Set `EXPLORER_TOKEN` in `.env`, start the app, and open:
`http://localhost:3000/design-explorer/index.html?k=<EXPLORER_TOKEN>`
Verify: controls populate from manifest; switching intensity/page/lang/device updates the preview; rationale rail shows notes; §12.2 footer visible in every state; no console errors.

- [ ] **Step 2: Confirm the guard**

Open `http://localhost:3000/design-explorer/index.html` (no `k`): expect 404.

- [ ] **Step 3: Full explorer test suite**

Run: `npx jest tests/unit/design-explorer/`
Expected: PASS (all suites).

- [ ] **Step 4: Commit any final fixes**

```bash
git add -A
git commit -m "chore(explorer): foundation + Direction 1 end-to-end verified"
```

---

## Self-Review

- **Spec coverage:** content model (§3) → Task 1; intensity system (§5) → Task 2 + carried through render/skin; render+build engine (§2,§3) → Tasks 3–4; explorer shell + controls + rationale (§2) → Task 5; private URL/token (§2) → Task 6; Direction 1 + concierge-stub + §12.2 + non-corporate + i18n + Lighthouse (§4,§5,§6,§8) → Task 7; e2e (§12) → Task 8. **Deferred to later plans (by design):** Direction 2 (incl. live Places-API reviews), Direction 3, live concierge backend, full 24×3-direction Lighthouse sweep, deploy to OCI. Noted in the spec's build phases.
- **Placeholder scan:** engine tasks carry complete code; creative tasks (5,7) intentionally delegate to frontend-design with explicit acceptance criteria + verification commands rather than pre-written CSS (the honest representation of design work) — not "TODO" placeholders.
- **Type consistency:** skin contract is `{ id, css, renderPage(page, content, intensity, lang) }` in Tasks 3, 4, 7; `renderState({skin,intensity,page,lang,nonce})` consistent across render.js, build.js, and tests; file-naming `<skin>-<intensity>-<page>-<lang>.html` consistent in build.js + build.test.js + verification.
- **Build-test ordering caveat** is called out explicitly in Task 4 (build test imports the real skin from Task 7).
