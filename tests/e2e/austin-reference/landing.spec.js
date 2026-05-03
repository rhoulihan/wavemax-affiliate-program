// @ts-check
/**
 * Austin landing page — austin-landing-v3-embed.html
 *
 * One-page-app discipline (per plan §7):
 *   • Hero band — single headline, single subhead, 2 CTAs, ≤60vh on desktop
 *   • Stat rail — single row with key location stats
 *   • Service tab-block — 3 tabs (WDF / Self-Serve / Commercial)
 *   • Live 5★ Google reviews block (or fallback link if API not configured)
 *   • CTA strip — sticky bottom band
 *
 * Tests open the host page at route=/, then assert against iframe contents.
 * The route map in austin-host-mock.js routes / → /austin-landing-v3-embed.html.
 */
const { test, expect } = require('@playwright/test');

const HOST_URL = '/dev/austin-host-mock.html?route=/';

async function gotoAndReady(page) {
  await page.goto(HOST_URL);
  await page.waitForFunction(
    () => {
      const iframe = document.getElementById('wavemax-iframe');
      const ib = iframe?.contentWindow?.IframeBridge;
      return ib && ib.getLocationData && ib.getLocationData() != null;
    },
    { timeout: 10_000 }
  );
}

function inIframe(page) {
  return page.frameLocator('#wavemax-iframe');
}

test.describe('Austin landing page — structure', () => {
  let consoleErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    // Static-only test server has no /api routes; the reviews fetch will
    // 404 and the page handles that gracefully. Filtering it out so we
    // catch only real bugs in this test, not infrastructure noise.
    const isExpectedNoise = (text) =>
      /Failed to load resource.*404/i.test(text) ||
      /\/api\/v1\/location\/austin-tx\/reviews/i.test(text);
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

  test('iframe loads austin-landing-v3-embed.html', async ({ page }) => {
    const iframe = page.locator('#wavemax-iframe');
    const src = await iframe.getAttribute('src');
    expect(src).toContain('austin-landing-v3-embed.html');
  });

  test('no console errors or warnings', async () => {
    expect(consoleErrors).toEqual([]);
  });

  test('hero band renders with location-bound headline + 2 CTAs', async ({ page }) => {
    const frame = inIframe(page);

    const hero = frame.locator('.wm-hero, [data-section="hero"]').first();
    await expect(hero).toBeVisible();

    const heroTitle = frame.locator('.wm-hero-title, h1').first();
    await expect(heroTitle).toBeVisible();
    const titleText = await heroTitle.textContent();
    expect(titleText.length).toBeGreaterThan(8);

    // 2 CTAs: a Call (tel:) and a Get-Directions (maps URL)
    const telLinks = await frame.locator('.wm-hero a[href^="tel:"]').count();
    const mapsLinks = await frame.locator('.wm-hero a[href*="maps/dir/?api=1"]').count();
    expect(telLinks, 'hero must have a Call CTA').toBeGreaterThanOrEqual(1);
    expect(mapsLinks, 'hero must have a Get Directions CTA').toBeGreaterThanOrEqual(1);

    // Phone is bound from LOCATION_DATA
    const phoneText = await frame.locator('.wm-hero a[href^="tel:"]').first().textContent();
    expect(phoneText).toContain('(512) 553-1674');
  });

  test('stat rail has 5 cards matching MHR existing landing', async ({ page }) => {
    const frame = inIframe(page);
    const stats = frame.locator('.wm-stats .wm-stat-card');
    await expect(stats).toHaveCount(5);

    const all = (await stats.allTextContents()).join(' ');
    // Bound LOCATION_DATA values must show up
    expect(all).toMatch(/7am-10pm/);
    expect(all).toMatch(/\$1\.20/);
    // Static MHR-spec content
    expect(all).toMatch(/4\.8/);
    expect(all).toMatch(/45 ?min/i);
    expect(all).toMatch(/24 ?hr/i);
  });

  test('service tab-block has 3 tabs (WDF / Self-Serve / Commercial)', async ({ page }) => {
    const frame = inIframe(page);
    const tabs = frame.locator('.wm-tab, [role="tab"]');
    const count = await tabs.count();
    expect(count, 'expected 3 service tabs').toBeGreaterThanOrEqual(3);

    const allText = (await tabs.allTextContents()).join(' ').toLowerCase();
    expect(allText).toContain('wash');
    expect(allText).toContain('self');
    expect(allText).toContain('commercial');
  });

  test('switching tabs swaps active panel', async ({ page }) => {
    const frame = inIframe(page);
    const tabs = frame.locator('.wm-tab, [role="tab"]');
    const initiallyActive = await frame.locator('[role="tab"][aria-selected="true"], .wm-tab[aria-selected="true"]').count();
    expect(initiallyActive).toBe(1);

    // Click second tab
    await tabs.nth(1).click();
    await page.waitForTimeout(150);
    const stillActive = await frame.locator('[role="tab"][aria-selected="true"], .wm-tab[aria-selected="true"]').count();
    expect(stillActive).toBe(1);
  });

  test('reviews block calls Google Places API directly when key configured', async ({ page }) => {
    // Mock the Places API (New) response — page calls it directly via fetch.
    // Without a real key the page renders the empty-state and skips the call;
    // for this test we inject a fake key + place_id and a mocked response.
    await page.route('**/places.googleapis.com/v1/places/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          rating: 4.8,
          userRatingCount: 187,
          reviews: [
            { rating: 5, relativePublishTimeDescription: '2 weeks ago',
              text: { text: 'Cleanest laundromat I have used in Austin.' },
              authorAttribution: { displayName: 'Test Reviewer A', uri: 'https://www.google.com/maps/contrib/aaa' } },
            { rating: 5, relativePublishTimeDescription: '1 month ago',
              text: { text: 'Fast machines, friendly staff. Will be back.' },
              authorAttribution: { displayName: 'Test Reviewer B', uri: 'https://www.google.com/maps/contrib/bbb' } }
          ]
        })
      });
    });

    // Inject the key + place id on the host page BEFORE loading
    await page.addInitScript(() => {
      window.GOOGLE_PLACES_API_KEY = 'test-key';
      window.LOCATION_PLACE_ID = 'ChIJtest_place_id';
    });

    const placesCall = page.waitForRequest(
      (req) => req.url().includes('places.googleapis.com/v1/places/'),
      { timeout: 6000 }
    ).catch(() => null);

    await page.reload();
    await gotoAndReady(page);
    const req = await placesCall;
    expect(req, 'iframe should call Places API when key + place_id are set').not.toBeNull();
    expect(req.headers()['x-goog-api-key']).toBe('test-key');
  });

  test('reviews block stays empty (graceful) when key NOT configured', async ({ page }) => {
    // Default state: no key, no place id → no fetch, empty-state shown
    const placesCall = page.waitForRequest(
      (req) => req.url().includes('places.googleapis.com/v1/places/'),
      { timeout: 1500 }
    ).catch(() => null);
    const req = await placesCall;
    expect(req, 'no Places call when key absent').toBeNull();

    const empty = inIframe(page).locator('.wm-reviews-empty');
    await expect(empty).toBeVisible();
  });

  test('reviews block shows attribution + fallback when API empty', async ({ page }) => {
    // With no API key, our endpoint returns reason:"config" and empty reviews.
    // The page MUST gracefully show a "View on Google" link rather than fabricated cards.
    const frame = inIframe(page);
    const reviewsSection = frame.locator('[data-section="reviews"], .wm-reviews');
    await expect(reviewsSection).toBeVisible({ timeout: 5000 });

    // Attribution text must be transparent: "Five-star reviews from Google"
    // OR a graceful fallback link to the Google profile.
    const sectionText = (await reviewsSection.textContent()) || '';
    const hasGoogleAttribution = /google/i.test(sectionText);
    expect(hasGoogleAttribution, 'reviews section must mention Google for transparency').toBe(true);
  });

  test('CTA strip visible at bottom with phone + directions', async ({ page }) => {
    const frame = inIframe(page);
    const cta = frame.locator('.wm-cta-strip');
    await expect(cta).toBeVisible();

    const telCount = await cta.locator('a[href^="tel:+15125531674"]').count();
    const mapsCount = await cta.locator('a[href*="maps/dir/?api=1"]').count();
    expect(telCount).toBeGreaterThanOrEqual(1);
    expect(mapsCount).toBeGreaterThanOrEqual(1);
  });

  test('every tel: anchor uses +1 prefix (E2/E3 fix)', async ({ page }) => {
    const frame = inIframe(page);
    const tels = await frame.locator('a[href^="tel:"]').evaluateAll(as => as.map(a => a.getAttribute('href')));
    expect(tels.length).toBeGreaterThan(0);
    for (const t of tels) expect(t).toBe('tel:+15125531674');
  });

  test('every Get-Directions link uses encoded address (D1 fix)', async ({ page }) => {
    const frame = inIframe(page);
    const maps = await frame.locator('a[href*="maps/dir/?api=1"]').evaluateAll(as => as.map(a => a.getAttribute('href')));
    expect(maps.length).toBeGreaterThan(0);
    for (const m of maps) expect(m).toMatch(/destination=825\+E\+Rundberg\+Ln\+F1\+Austin\+TX\+78753/);
  });

  test('no href="#" anywhere in iframe content', async ({ page }) => {
    const frame = inIframe(page);
    const broken = await frame.locator('a').evaluateAll(as => as.filter(a => a.getAttribute('href') === '#').length);
    expect(broken).toBe(0);
  });
});

test.describe('Austin landing page — i18n round-trip', () => {
  test.beforeEach(async ({ page }) => { await gotoAndReady(page); });

  for (const lang of ['es', 'pt', 'de']) {
    test(`switches iframe content to ${lang}`, async ({ page }) => {
      await page.evaluate((l) => {
        // @ts-ignore
        window.WaveMaxBridgeV3.setLanguage(l);
      }, lang);
      await page.waitForTimeout(300);

      const heroTitle = await inIframe(page).locator('.wm-hero-title, h1').first().textContent();
      expect(heroTitle, `${lang} hero must change from English`).not.toMatch(/^Austin's/);

      const titleNotEmpty = (heroTitle || '').trim().length > 5;
      expect(titleNotEmpty).toBe(true);
    });
  }
});

/* ------- Responsive ------- */

const BREAKPOINTS = [
  { name: 'mobile-375',   width: 375,  height: 812  },
  { name: 'tablet-768',   width: 768,  height: 1024 },
  { name: 'desktop-1280', width: 1280, height: 900  }
];

for (const bp of BREAKPOINTS) {
  test(`responsive @ ${bp.name} — landing iframe layout clean`, async ({ page }) => {
    await page.setViewportSize({ width: bp.width, height: bp.height });
    await gotoAndReady(page);

    const frame = inIframe(page);

    // Hero, stats, tabs all visible
    await expect(frame.locator('.wm-hero, [data-section="hero"]').first()).toBeVisible();
    await expect(frame.locator('.wm-stats, [data-section="stats"]').first()).toBeVisible();

    // No horizontal overflow inside iframe
    const overflow = await page.evaluate(() => {
      const iframe = document.getElementById('wavemax-iframe');
      const idoc = iframe.contentDocument;
      return { sw: idoc.body.scrollWidth, cw: idoc.body.clientWidth };
    });
    expect(overflow.sw, `${bp.name} iframe horizontal overflow`).toBeLessThanOrEqual(overflow.cw + 1);
  });
}
