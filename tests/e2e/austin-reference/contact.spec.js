// @ts-check
/**
 * Phase 2c — Austin contact page (`contact-embed.html`)
 *
 * The contact page is loaded into the same iframe shell as the landing
 * page — host route `/contact` → `/contact-embed.html`. Page content:
 *
 *   • Eyebrow + heading + intro paragraph
 *   • Contact-info card — address, phone, hours, "Get Directions"
 *   • Contact form — firstName, lastName, email, phone (optional), message
 *     POSTs to /api/v1/contact/austin-tx
 *   • Submit returns the user-visible success message from the API
 *   • Inline validation error block on 400 responses
 *
 * Tests open the host page at route=/contact then assert against iframe
 * contents. They are deliberately written BEFORE the page exists — strict
 * TDD red phase, expected to fail until contact-embed.html is shipped
 * and the host route map has /contact wired in.
 */
const { test, expect } = require('@playwright/test');

const HOST_URL = '/dev/austin-host-mock.html?route=/contact';

async function gotoAndReady(page) {
  await page.goto(HOST_URL);
  // Wait for the iframe to be navigated to the contact page AND for the
  // iframe-side bridge to hand off LOCATION_DATA. The bridge is the same
  // bridge the landing page uses, so this guard is identical to landing.spec.
  await page.waitForFunction(
    () => {
      const iframe = document.getElementById('wavemax-iframe');
      const src = iframe?.getAttribute('src') || '';
      const ib = iframe?.contentWindow?.IframeBridge;
      return src.includes('contact-embed.html')
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

test.describe('Austin contact page — structure', () => {
  let consoleErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    // The contact form POSTs to /api/v1/contact/austin-tx + GETs a CSRF
    // token from /api/csrf-token. The static-only test server has neither,
    // so the in-test mock fulfills both. Filter out any unexpected 404s
    // from those paths so we only see real bugs in console.
    const isExpectedNoise = (text) =>
      /Failed to load resource.*404/i.test(text) ||
      /\/api\/v1\/contact\/austin-tx/i.test(text) ||
      /\/api\/csrf-token/i.test(text) ||
      // The host page loads /api/austin-tx/places-config to seed the
      // browser-direct Places-API call. The static test server does
      // not implement that endpoint, so it 404s with HTML and the
      // browser's strict-MIME check warns. Only matters in test.
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

  test('iframe loads contact-embed.html when host route is /contact', async ({ page }) => {
    const src = await page.locator('#wavemax-iframe').getAttribute('src');
    expect(src).toContain('contact-embed.html');
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

  test('contact-info card shows address bound from LOCATION_DATA', async ({ page }) => {
    const frame = inIframe(page);
    const addr = frame.locator('[data-bind="contact.address"]').first();
    await expect(addr).toBeVisible();
    const text = (await addr.textContent() || '').trim();
    expect(text).toContain('825 E Rundberg Ln F1');
  });

  test('contact-info card shows phone bound from LOCATION_DATA', async ({ page }) => {
    const frame = inIframe(page);
    const phone = frame.locator('[data-bind="contact.phone"]').first();
    await expect(phone).toBeVisible();
    const text = (await phone.textContent() || '').trim();
    expect(text).toContain('(512) 553-1674');
  });

  test('contact-info card shows hours bound from LOCATION_DATA', async ({ page }) => {
    const frame = inIframe(page);
    const hours = frame.locator('[data-bind="hours.display"]').first();
    await expect(hours).toBeVisible();
    const text = (await hours.textContent() || '').trim();
    expect(text).toContain('7am-10pm');
  });

  test('every tel: anchor uses tel:+15125531674', async ({ page }) => {
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

  test('contact form has all required fields', async ({ page }) => {
    const frame = inIframe(page);
    const form = frame.locator('form[data-contact-form], form#contact-form, .wm-contact-form form');
    await expect(form.first()).toBeVisible();
    await expect(frame.locator('[name="firstName"]').first()).toBeVisible();
    await expect(frame.locator('[name="lastName"]').first()).toBeVisible();
    await expect(frame.locator('[name="email"]').first()).toBeVisible();
    await expect(frame.locator('[name="phone"]').first()).toBeVisible();
    await expect(frame.locator('[name="message"]').first()).toBeVisible();
    await expect(frame.locator('button[type="submit"], input[type="submit"]').first()).toBeVisible();
  });
});

/* ------------------------------------------------------------------ */
/*  Submit flow — happy path + validation error                       */
/* ------------------------------------------------------------------ */

test.describe('Austin contact page — submit flow', () => {
  test.beforeEach(async ({ page }) => {
    // Stub the CSRF endpoint and the contact endpoint so the page can
    // submit without a real server. Both are mocked at the parent-page
    // level so requests from inside the iframe (same origin) are caught.
    await page.route('**/api/csrf-token', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ csrfToken: 'test-csrf-token-stub' }) }));
  });

  test('happy path — submit shows success message', async ({ page }) => {
    await page.route('**/api/v1/contact/austin-tx', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: "Your message has been sent — we'll be in touch shortly."
        }) }));

    await gotoAndReady(page);
    const frame = inIframe(page);
    await frame.locator('[name="firstName"]').first().fill('Sample');
    await frame.locator('[name="lastName"]').first().fill('Customer');
    await frame.locator('[name="email"]').first().fill('sample@example.com');
    await frame.locator('[name="phone"]').first().fill('5125550000');
    await frame.locator('[name="message"]').first().fill('Hello — quick question about WDF pricing.');
    await frame.locator('button[type="submit"], input[type="submit"]').first().click();

    // Success surface — text or aria-live region containing the API message
    const success = frame.locator(
      '[data-contact-status="success"], .wm-contact-success, [role="status"]'
    ).first();
    await expect(success).toBeVisible({ timeout: 5000 });
    const text = (await success.textContent() || '').toLowerCase();
    expect(text).toContain('sent');
  });

  test('validation error path — server 400 surfaces inline', async ({ page }) => {
    await page.route('**/api/v1/contact/austin-tx', (route) =>
      route.fulfill({ status: 400, contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          message: 'Validation failed',
          errors: [{ field: 'email', msg: 'Valid email is required' }]
        }) }));

    await gotoAndReady(page);
    const frame = inIframe(page);
    await frame.locator('[name="firstName"]').first().fill('Sample');
    await frame.locator('[name="lastName"]').first().fill('Customer');
    await frame.locator('[name="email"]').first().fill('not-an-email'); // browser validation may also catch
    await frame.locator('[name="message"]').first().fill('Hello — quick test.');
    await frame.locator('button[type="submit"], input[type="submit"]').first().click();

    const errBox = frame.locator(
      '[data-contact-status="error"], .wm-contact-error, [role="alert"]'
    ).first();
    await expect(errBox).toBeVisible({ timeout: 5000 });
    const text = (await errBox.textContent() || '').toLowerCase();
    expect(text.length).toBeGreaterThan(0);
  });
});

/* ------------------------------------------------------------------ */
/*  i18n round-trip                                                   */
/* ------------------------------------------------------------------ */

test.describe('Austin contact page — i18n round-trip', () => {
  test.beforeEach(async ({ page }) => { await gotoAndReady(page); });

  for (const lang of ['es', 'pt', 'de']) {
    test(`switches iframe content to ${lang}`, async ({ page }) => {
      await page.evaluate((l) => {
        // @ts-ignore
        window.WaveMaxBridgeV3?.setLanguage(l);
      }, lang);
      await page.waitForTimeout(300);

      const heading = await inIframe(page).locator('h1').first().textContent();
      // Heading should not still be the English default — at minimum, it
      // should not start with "Contact" or "Get in touch" (the two most
      // likely English defaults). Any of those failing the negative match
      // means the language switched.
      expect(heading, `${lang} heading should differ from English default`)
        .not.toMatch(/^(Contact( us)?|Get in touch)\s*$/i);
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
  test(`responsive @ ${bp.name} — contact iframe layout clean`, async ({ page }) => {
    await page.setViewportSize({ width: bp.width, height: bp.height });
    await gotoAndReady(page);

    const frame = inIframe(page);
    await expect(frame.locator('h1').first()).toBeVisible();
    await expect(frame.locator('[name="email"]').first()).toBeVisible();

    const overflow = await page.evaluate(() => {
      const iframe = document.getElementById('wavemax-iframe');
      const idoc = iframe.contentDocument;
      return { sw: idoc.body.scrollWidth, cw: idoc.body.clientWidth };
    });
    expect(overflow.sw, `${bp.name} iframe horizontal overflow`).toBeLessThanOrEqual(overflow.cw + 1);
  });
}
