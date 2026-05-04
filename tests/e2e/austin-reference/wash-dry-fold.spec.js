// @ts-check
/**
 * Phase 2d — Austin Wash-Dry-Fold page (`wash-dry-fold-embed.html`)
 *
 * Refresh of the legacy Bootstrap + AOS page to v3 conventions
 * (shared theme/components stylesheets, data-bind, data-i18n,
 * iframe-bridge-v2, Hibu loader). Page content:
 *
 *   • Hero band — eyebrow + headline + subhead + 2 CTAs
 *   • Pricing card — $1.20/lb · 10lb min · what's included
 *   • 3-step "How it works" block — drop off / we wash-dry-fold /
 *     pick up next day
 *   • CTA strip — Call + Get Directions
 *
 * Tests open the host page at route=/wash-dry-fold and assert
 * against the iframe contents. Strict TDD red phase — all assertions
 * are written before the v3 page exists, and they expect the v3
 * conventions (LOCATION_DATA-bound phone/pricing/hours, single
 * source-of-truth tel anchors, en/es/pt/de i18n round-trip, no
 * horizontal overflow).
 */
const { test, expect } = require('@playwright/test');

const HOST_URL = '/dev/austin-host-mock.html?route=/wash-dry-fold';

async function gotoAndReady(page) {
  await page.goto(HOST_URL);
  await page.waitForFunction(
    () => {
      const iframe = document.getElementById('wavemax-iframe');
      const src = iframe?.getAttribute('src') || '';
      const ib = iframe?.contentWindow?.IframeBridge;
      return src.includes('wash-dry-fold-embed.html')
          && ib && ib.getLocationData && ib.getLocationData() != null;
    },
    { timeout: 10_000 }
  );
}

function inIframe(page) {
  return page.frameLocator('#wavemax-iframe');
}

/* ------------------------------------------------------------------ */
/*  Structure                                                         */
/* ------------------------------------------------------------------ */

test.describe('Austin WDF page — structure', () => {
  let consoleErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    const isExpectedNoise = (text) =>
      /Failed to load resource.*404/i.test(text) ||
      // The host page loads /api/austin-tx/places-config to seed the
      // Places-API key; the static test server doesn't implement that
      // route so it 404s with HTML and the browser warns about the
      // strict-MIME mismatch. Real bug iff this stops being filtered.
      /api\/austin-tx\/places-config/i.test(text) ||
      /strict MIME type checking is enabled/i.test(text);
    page.on('console', (msg) => {
      if ((msg.type() === 'error' || msg.type() === 'warn') && !isExpectedNoise(msg.text())) {
        consoleErrors.push(msg.text());
      }
    });
    page.on('pageerror', (err) => {
      if (!isExpectedNoise(err.message)) consoleErrors.push(err.message);
    });
    await gotoAndReady(page);
  });

  test('iframe loads wash-dry-fold-embed.html when host route is /wash-dry-fold', async ({ page }) => {
    const src = await page.locator('#wavemax-iframe').getAttribute('src');
    expect(src).toContain('wash-dry-fold-embed.html');
  });

  test('no console errors or warnings', async () => {
    expect(consoleErrors).toEqual([]);
  });

  test('page heading is visible', async ({ page }) => {
    const h1 = inIframe(page).locator('h1').first();
    await expect(h1).toBeVisible();
    const text = (await h1.textContent() || '').trim();
    expect(text.length).toBeGreaterThan(2);
  });

  test('hero band has 2 CTAs (call + directions)', async ({ page }) => {
    const frame = inIframe(page);
    const hero = frame.locator('.wm-hero, [data-section="hero"]').first();
    await expect(hero).toBeVisible();

    const tels = await frame.locator('.wm-hero a[href^="tel:"]').count();
    const maps = await frame.locator('.wm-hero a[href*="maps/dir/?api=1"]').count();
    expect(tels, 'hero must have a Call CTA').toBeGreaterThanOrEqual(1);
    expect(maps, 'hero must have a Get-Directions CTA').toBeGreaterThanOrEqual(1);
  });

  test('pricing block shows WDF rate from LOCATION_DATA', async ({ page }) => {
    const frame = inIframe(page);
    const rate = frame.locator('[data-bind="pricing.wdf.display"]').first();
    await expect(rate).toBeVisible();
    expect((await rate.textContent() || '').trim()).toContain('$1.20');
  });

  test('pricing block shows 10lb minimum from LOCATION_DATA', async ({ page }) => {
    const frame = inIframe(page);
    const minLb = frame.locator('[data-bind="pricing.wdf.minLb"]').first();
    await expect(minLb).toBeVisible();
    expect((await minLb.textContent() || '').trim()).toContain('10');
  });

  test('hours bound from LOCATION_DATA', async ({ page }) => {
    const frame = inIframe(page);
    const hours = frame.locator('[data-bind="hours.display"]').first();
    await expect(hours).toBeVisible();
    expect((await hours.textContent() || '').trim()).toContain('7am-10pm');
  });

  test('every tel: anchor uses tel:+15125531674 (single source of truth)', async ({ page }) => {
    const tels = await inIframe(page).locator('a[href^="tel:"]').evaluateAll(
      as => as.map(a => a.getAttribute('href')));
    expect(tels.length).toBeGreaterThan(0);
    for (const t of tels) expect(t).toBe('tel:+15125531674');
  });

  test('every Get-Directions link uses the encoded Austin address', async ({ page }) => {
    const maps = await inIframe(page).locator('a[href*="maps/dir/?api=1"]').evaluateAll(
      as => as.map(a => a.getAttribute('href')));
    expect(maps.length).toBeGreaterThan(0);
    for (const m of maps) expect(m).toMatch(/destination=825\+E\+Rundberg\+Ln\+F1\+Austin\+TX\+78753/);
  });

  test('no href="#" anywhere in iframe content', async ({ page }) => {
    const broken = await inIframe(page).locator('a').evaluateAll(
      as => as.filter(a => a.getAttribute('href') === '#').length);
    expect(broken).toBe(0);
  });

  test('CTA strip visible at bottom', async ({ page }) => {
    const cta = inIframe(page).locator('.wm-cta-strip');
    await expect(cta).toBeVisible();
    const tels = await cta.locator('a[href^="tel:+15125531674"]').count();
    const maps = await cta.locator('a[href*="maps/dir/?api=1"]').count();
    expect(tels).toBeGreaterThanOrEqual(1);
    expect(maps).toBeGreaterThanOrEqual(1);
  });

  test('page uses v3 shared theme/components stylesheets (not Bootstrap)', async ({ page }) => {
    // Refresh from the legacy Bootstrap-based page is the whole point of
    // this phase. The new page must NOT pull bootstrap.min.css from a CDN.
    const sheets = await inIframe(page).locator('link[rel="stylesheet"]').evaluateAll(
      ls => ls.map(l => l.getAttribute('href') || ''));
    const hasBootstrap = sheets.some(h => /bootstrap.*\.css/i.test(h));
    expect(hasBootstrap, 'WDF page should not depend on Bootstrap CDN after the v3 refresh').toBe(false);
    const hasTheme = sheets.some(h => /wavemax-theme\.css/i.test(h));
    const hasComponents = sheets.some(h => /wavemax-components\.css/i.test(h));
    expect(hasTheme, 'must load the shared wavemax-theme.css').toBe(true);
    expect(hasComponents, 'must load the shared wavemax-components.css').toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/*  i18n round-trip                                                   */
/* ------------------------------------------------------------------ */

test.describe('Austin WDF page — i18n round-trip', () => {
  test.beforeEach(async ({ page }) => { await gotoAndReady(page); });

  for (const lang of ['es', 'pt', 'de']) {
    test(`switches iframe content to ${lang}`, async ({ page }) => {
      await page.evaluate((l) => {
        // @ts-ignore
        window.WaveMaxBridgeV3?.setLanguage(l);
      }, lang);
      await page.waitForTimeout(300);

      const heading = await inIframe(page).locator('h1').first().textContent();
      // Heading should not still match common English defaults — any
      // change from the English literal proves the bridge re-translated.
      expect(heading, `${lang} heading should differ from English default`)
        .not.toMatch(/^(Wash-?Dry-?Fold|Drop[- ]off)\s*$/i);
      expect((heading || '').trim().length).toBeGreaterThan(2);
    });
  }
});

/* ------------------------------------------------------------------ */
/*  Responsive                                                        */
/* ------------------------------------------------------------------ */

const BREAKPOINTS = [
  { name: 'mobile-375',   width: 375,  height: 812  },
  { name: 'tablet-768',   width: 768,  height: 1024 },
  { name: 'desktop-1280', width: 1280, height: 900  }
];

for (const bp of BREAKPOINTS) {
  test(`responsive @ ${bp.name} — WDF iframe layout clean`, async ({ page }) => {
    await page.setViewportSize({ width: bp.width, height: bp.height });
    await gotoAndReady(page);

    const frame = inIframe(page);
    await expect(frame.locator('h1').first()).toBeVisible();
    await expect(frame.locator('[data-bind="pricing.wdf.display"]').first()).toBeVisible();

    const overflow = await page.evaluate(() => {
      const iframe = document.getElementById('wavemax-iframe');
      const idoc = iframe.contentDocument;
      return { sw: idoc.body.scrollWidth, cw: idoc.body.clientWidth };
    });
    expect(overflow.sw, `${bp.name} iframe horizontal overflow`).toBeLessThanOrEqual(overflow.cw + 1);
  });
}
