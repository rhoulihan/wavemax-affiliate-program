// @ts-check
/**
 * Austin host-mock smoke tests.
 *
 * Locks in the foundation contract:
 *   1. Page loads cleanly (no console errors, no failed network)
 *   2. MHR-faithful chrome renders with correct backgrounds
 *   3. LOCATION_DATA bindings populate every visible chrome surface
 *   4. Iframe handshake fires; bridge delivers location-data to iframe
 *   5. Language switcher cycles all 4 langs (en/es/pt/de) and re-translates
 *      every visible chrome string
 *   6. No href="#" anywhere on the host page
 *   7. Footer Local Links are all wired (F1 fix)
 *   8. Tel/maps links are correct (E1/E2/E3/D1 fixes)
 */
const { test, expect } = require('@playwright/test');

const HOST_URL = '/dev/austin-host-mock.html';

test.describe('Austin host-mock — foundation', () => {
  let consoleErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    // Expected console noise from running against the static-only test
    // server (no API): the landing page's reviews fetch 404s and is
    // gracefully handled with an empty-state Google link. Filtering it
    // here so the host-mock smoke tests stay specific to real bugs.
    const EXPECTED_NOISE = [
      /Failed to load resource.*404/i,
      /\/api\/v1\/location\/austin-tx\/reviews/i
    ];
    function isExpectedNoise(text) {
      return EXPECTED_NOISE.some(re => re.test(text));
    }
    page.on('console', (msg) => {
      if ((msg.type() === 'error' || msg.type() === 'warn') && !isExpectedNoise(msg.text())) {
        consoleErrors.push({ type: msg.type(), text: msg.text() });
      }
    });
    page.on('pageerror', (err) => {
      if (!isExpectedNoise(err.message)) {
        consoleErrors.push({ type: 'pageerror', text: err.message });
      }
    });
    await page.goto(HOST_URL);
    // Wait for the bridge handshake to complete: iframe's IframeBridge
    // global exists AND location-data has been delivered. The location-data
    // round-trip is what every other test depends on.
    await page.waitForFunction(
      () => {
        const iframe = document.getElementById('wavemax-iframe');
        const ib = iframe?.contentWindow?.IframeBridge;
        return ib && ib.getLocationData && ib.getLocationData() != null;
      },
      { timeout: 10_000 }
    );
  });

  test('loads with no console errors or warnings', async () => {
    expect(consoleErrors).toEqual([]);
  });

  test('three-bar nav renders with MHR-exact backgrounds', async ({ page }) => {
    const b1bg = await page.evaluate(() => getComputedStyle(document.querySelector('#wmlnav-wrap .wmlnav-b1')).backgroundColor);
    const b2bg = await page.evaluate(() => getComputedStyle(document.querySelector('#wmlnav-wrap .wmlnav-b2')).backgroundColor);
    const b3bg = await page.evaluate(() => getComputedStyle(document.querySelector('#wmlnav-wrap .wmlnav-b3')).backgroundColor);
    expect(b1bg).toBe('rgb(21, 79, 130)');   // #154f82
    expect(b2bg).toBe('rgb(30, 114, 186)');  // #1e72ba
    expect(b3bg).toBe('rgb(25, 118, 210)');  // #1976d2
  });

  test('all chrome bindings populate from LOCATION_DATA', async ({ page }) => {
    const phone = await page.locator('#wmlnav-phone-left span[data-bind="contact.phone"]').first().textContent();
    expect(phone?.trim()).toBe('(512) 553-1674');

    const address = await page.locator('#wmlnav-address span[data-bind="contact.address"]').first().textContent();
    expect(address?.trim()).toBe('825 E Rundberg Ln F1');

    const hours = await page.locator('#wmlnav-hours span[data-bind="hours.display"]').first().textContent();
    expect(hours?.trim()).toBe('7am-10pm');
  });

  test('every tel: anchor uses +1 prefix and correct number (E2/E3 fix)', async ({ page }) => {
    const tels = await page.$$eval('a[href^="tel:"]', as => as.map(a => a.getAttribute('href')));
    expect(tels.length).toBeGreaterThan(0);
    for (const t of tels) {
      expect(t).toBe('tel:+15125531674');
    }
  });

  test('every Get-Directions link uses encoded address (D1 fix)', async ({ page }) => {
    const maps = await page.$$eval('a[href*="maps/dir/?api=1"]', as => as.map(a => a.getAttribute('href')));
    expect(maps.length).toBeGreaterThan(0);
    for (const m of maps) {
      expect(m).toMatch(/destination=825\+E\+Rundberg\+Ln\+F1\+Austin\+TX\+78753/);
    }
  });

  test('no href="#" anywhere on the host page', async ({ page }) => {
    const broken = await page.$$eval('a[href]', as =>
      as.filter(a => a.getAttribute('href') === '#').map(a => a.outerHTML.slice(0, 120))
    );
    expect(broken).toEqual([]);
  });

  test('footer Local Links has all 6 anchors wired (F1 fix)', async ({ page }) => {
    const links = await page.$$eval('#wm-links a[href]', as => as.map(a => a.getAttribute('href')));
    expect(links).toHaveLength(6);
    expect(links.every(h => h.startsWith('?route='))).toBe(true);
  });

  test('iframe receives LOCATION_DATA via bridge', async ({ page }) => {
    const data = await page.evaluate(() => {
      const iframe = document.getElementById('wavemax-iframe');
      // @ts-ignore
      return iframe.contentWindow.IframeBridge?.getLocationData();
    });
    expect(data).toBeTruthy();
    expect(data.slug).toBe('austin-tx');
    expect(data.contact.phone).toBe('(512) 553-1674');
    expect(data.contact.address).toBe('825 E Rundberg Ln F1');
  });

  test('language switcher menu shows 4 flags and drops above b2', async ({ page }) => {
    await page.click('#wm-lang .wm-lang-btn');
    const items = page.locator('#wm-lang .wm-lang-item');
    await expect(items).toHaveCount(4);

    // Each item carries a flag span with one of the four flag classes
    const flagClasses = await items.evaluateAll(els =>
      els.map(el => Array.from(el.querySelector('.wm-lang-flag').classList).filter(c => c.startsWith('wm-flag-')))
    );
    expect(flagClasses).toEqual([['wm-flag-en'], ['wm-flag-es'], ['wm-flag-pt'], ['wm-flag-de']]);

    // Menu z-index above wmlnav-b2 (which is 100005)
    const menuZ = await page.evaluate(() =>
      parseInt(getComputedStyle(document.querySelector('#wm-lang .wm-lang-menu')).zIndex, 10)
    );
    expect(menuZ).toBeGreaterThan(100005);
  });

  test('cycling all 4 languages re-translates the chrome', async ({ page }) => {
    const expectations = {
      en: { home: 'Home',   wdf: 'Wash-Dry-Fold',          contact: 'Contact Us',  submit: 'SUBMIT →' },
      es: { home: 'Inicio', wdf: 'Lavado · Secado · Doblado', contact: 'Contáctenos', submit: 'ENVIAR →' },
      pt: { home: 'Início', wdf: 'Lavar · Secar · Dobrar',     contact: 'Fale Conosco', submit: 'ENVIAR →' },
      de: { home: 'Start',  wdf: 'Waschen · Trocknen · Falten', contact: 'Kontakt',      submit: 'SENDEN →' }
    };

    for (const [lang, exp] of Object.entries(expectations)) {
      await page.evaluate((l) => {
        // @ts-ignore
        window.WaveMaxBridgeV3.setLanguage(l);
      }, lang);
      await page.waitForTimeout(150);

      const home = await page.locator('#wmlnav-nav a[data-route="/"]').textContent();
      const wdf  = await page.locator('#wmlnav-nav a[data-route="/wash-dry-fold"]').textContent();
      const contactUs = await page.locator('.wm-pgfooter-contact h2').textContent();
      const submit = await page.locator('#wm-pgfooter-submit').textContent();

      expect(home?.trim(),    `${lang}.home`).toBe(exp.home);
      expect(wdf?.trim(),     `${lang}.wdf`).toBe(exp.wdf);
      expect(contactUs?.trim(),`${lang}.contactUs`).toBe(exp.contact);
      expect(submit?.trim(),  `${lang}.submit`).toBe(exp.submit);
    }
  });

  test('iframe-side language broadcast updates iframe content', async ({ page }) => {
    // Switch parent to Spanish, verify iframe re-renders
    await page.evaluate(() => {
      // @ts-ignore
      window.WaveMaxBridgeV3.setLanguage('es');
    });
    await page.waitForTimeout(300);

    const iframeHeroTitle = await page.evaluate(() => {
      const iframe = document.getElementById('wavemax-iframe');
      return iframe.contentDocument?.querySelector('.wm-hero-title')?.textContent?.trim();
    });
    // Route / loads austin-landing-v3-embed.html → Spanish hero title
    expect(iframeHeroTitle).toBe('La lavandería más limpia de Austin');

    // Reset to English
    await page.evaluate(() => {
      // @ts-ignore
      window.WaveMaxBridgeV3.setLanguage('en');
    });
  });
});

/* ============================================================
 * RESPONSIVE — verify the host renders cleanly at every breakpoint.
 * The plan §11 verification gate calls for 375 / 414 / 768 / 1280.
 * ============================================================ */

const BREAKPOINTS = [
  { name: 'mobile-375',  width: 375,  height: 812,  expectMobileChrome: true  },
  { name: 'mobile-414',  width: 414,  height: 896,  expectMobileChrome: true  },
  { name: 'tablet-768',  width: 768,  height: 1024, expectMobileChrome: true  },
  { name: 'tablet-901',  width: 901,  height: 1024, expectMobileChrome: false },
  { name: 'desktop-1280',width: 1280, height: 900,  expectMobileChrome: false },
  { name: 'desktop-1920',width: 1920, height: 1080, expectMobileChrome: false }
];

for (const bp of BREAKPOINTS) {
  test(`responsive @ ${bp.name} (${bp.width}×${bp.height}) — chrome layout`, async ({ page }) => {
    const errs = [];
    page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    page.on('pageerror', e => errs.push(e.message));

    await page.setViewportSize({ width: bp.width, height: bp.height });
    await page.goto(HOST_URL);
    await page.waitForFunction(
      () => {
        const ib = document.getElementById('wavemax-iframe')?.contentWindow?.IframeBridge;
        return ib && ib.getLocationData() != null;
      },
      { timeout: 10_000 }
    );

    // No horizontal scroll on body
    const bodyOverflow = await page.evaluate(() => {
      const html = document.documentElement;
      const body = document.body;
      return {
        html: { sw: html.scrollWidth, cw: html.clientWidth },
        body: { sw: body.scrollWidth, cw: body.clientWidth }
      };
    });
    expect(bodyOverflow.body.sw, `${bp.name} body horizontal overflow`).toBeLessThanOrEqual(bodyOverflow.body.cw + 1);

    // Either wmlnav-wrap (desktop) OR wmv3-header (mobile) is visible — never both
    const desktopNavVisible = await page.locator('#wmlnav-wrap').isVisible();
    const mobileHeaderVisible = await page.locator('.wmv3-header').isVisible();

    if (bp.expectMobileChrome) {
      expect(desktopNavVisible, `${bp.name} desktop nav should be hidden`).toBe(false);
      expect(mobileHeaderVisible, `${bp.name} mobile header should be visible`).toBe(true);
    } else {
      expect(desktopNavVisible, `${bp.name} desktop nav should be visible`).toBe(true);
      expect(mobileHeaderVisible, `${bp.name} mobile header should be hidden`).toBe(false);
    }

    // Iframe is full-width and visible
    const iframeBox = await page.locator('#wavemax-iframe').boundingBox();
    expect(iframeBox.width).toBeGreaterThanOrEqual(bp.width - 20);

    // No console errors at this breakpoint
    expect(errs, `${bp.name} console errors`).toEqual([]);
  });
}

