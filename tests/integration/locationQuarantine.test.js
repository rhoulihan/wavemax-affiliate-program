/**
 * Integration tests for the location quarantine middleware.
 *
 * Behavior under test:
 *   - When QUARANTINE_NON_AUSTIN is not 'true', all paths pass through (no
 *     change from baseline behavior).
 *   - When QUARANTINE_NON_AUSTIN === 'true':
 *       * Austin pages (/austin-tx/*, /api/austin-tx/*) pass through.
 *       * Affiliate-program app paths (/api/*, embed pages, assets, locales) pass.
 *       * Legal pages (/privacy-policy, /terms-*, /refund-policy) pass.
 *       * Everything else 302-redirects to the corporate site, preserving the
 *         original path (e.g., /about/ → wavemaxlaundry.com/about/).
 *       * Base URL '/' redirects to corporate root.
 *
 * The middleware reads QUARANTINE_NON_AUSTIN at request time, so tests can
 * flip the env var per-describe to exercise both modes.
 */

const request = require('supertest');
const app = require('../../server');

const CORPORATE = 'https://www.wavemaxlaundry.com';

describe('Location quarantine middleware', () => {
  let originalEnv;

  beforeEach(() => {
    originalEnv = process.env.QUARANTINE_NON_AUSTIN;
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.QUARANTINE_NON_AUSTIN;
    } else {
      process.env.QUARANTINE_NON_AUSTIN = originalEnv;
    }
  });

  describe('when QUARANTINE_NON_AUSTIN is unset (default)', () => {
    beforeEach(() => {
      delete process.env.QUARANTINE_NON_AUSTIN;
    });

    it('does not redirect / to corporate', async () => {
      const response = await request(app).get('/').redirects(0);
      // Existing behavior: / redirects to /franchise/. Just assert NOT corporate.
      expect(response.headers.location || '').not.toMatch(/wavemaxlaundry\.com/);
    });

    it('does not redirect /about/ to corporate', async () => {
      const response = await request(app).get('/about/').redirects(0);
      expect(response.headers.location || '').not.toMatch(/wavemaxlaundry\.com/);
    });

    it('does not redirect /dallas-tx/ to corporate', async () => {
      const response = await request(app).get('/dallas-tx/').redirects(0);
      expect(response.headers.location || '').not.toMatch(/wavemaxlaundry\.com/);
    });
  });

  describe('when QUARANTINE_NON_AUSTIN=false', () => {
    beforeEach(() => {
      process.env.QUARANTINE_NON_AUSTIN = 'false';
    });

    it('does not redirect /about/ to corporate', async () => {
      const response = await request(app).get('/about/').redirects(0);
      expect(response.headers.location || '').not.toMatch(/wavemaxlaundry\.com/);
    });
  });

  describe('when QUARANTINE_NON_AUSTIN=true', () => {
    beforeEach(() => {
      process.env.QUARANTINE_NON_AUSTIN = 'true';
    });

    // ── Allowlist: Austin ─────────────────────────────────────────────
    describe('Austin allowlist', () => {
      it('allows /austin-tx/ (does not 302 to corporate)', async () => {
        const response = await request(app).get('/austin-tx/').redirects(0);
        expect(response.headers.location || '').not.toMatch(/wavemaxlaundry\.com/);
      });

      it('allows /austin-tx (no trailing slash)', async () => {
        const response = await request(app).get('/austin-tx').redirects(0);
        expect(response.headers.location || '').not.toMatch(/wavemaxlaundry\.com/);
      });

      it('allows /austin-tx/wash-dry-fold/', async () => {
        const response = await request(app).get('/austin-tx/wash-dry-fold/').redirects(0);
        expect(response.headers.location || '').not.toMatch(/wavemaxlaundry\.com/);
      });

      it('allows /austin-tx/self-serve-laundry/', async () => {
        const response = await request(app).get('/austin-tx/self-serve-laundry/').redirects(0);
        expect(response.headers.location || '').not.toMatch(/wavemaxlaundry\.com/);
      });

      it('allows /api/austin-tx/places-config', async () => {
        const response = await request(app).get('/api/austin-tx/places-config').redirects(0);
        expect(response.status).toBe(200);
      });
    });

    // ── Allowlist: affiliate-program app ──────────────────────────────
    describe('Affiliate-program app allowlist', () => {
      it('allows /api/v1/* endpoints (may return 401, but not 302 to corporate)', async () => {
        const response = await request(app).get('/api/v1/affiliates/AFF-test/public').redirects(0);
        expect(response.headers.location || '').not.toMatch(/wavemaxlaundry\.com/);
      });

      it('allows /api/csrf-token', async () => {
        const response = await request(app).get('/api/csrf-token').redirects(0);
        expect(response.headers.location || '').not.toMatch(/wavemaxlaundry\.com/);
      });

      it('allows /api/health', async () => {
        const response = await request(app).get('/api/health').redirects(0);
        expect(response.headers.location || '').not.toMatch(/wavemaxlaundry\.com/);
      });

      it('allows /health', async () => {
        const response = await request(app).get('/health').redirects(0);
        expect(response.status).toBe(200);
      });

      it('allows /embed-app-v2.html', async () => {
        const response = await request(app).get('/embed-app-v2.html').redirects(0);
        expect(response.headers.location || '').not.toMatch(/wavemaxlaundry\.com/);
      });

      it('allows /affiliate-login-embed.html', async () => {
        const response = await request(app).get('/affiliate-login-embed.html').redirects(0);
        expect(response.headers.location || '').not.toMatch(/wavemaxlaundry\.com/);
      });

      it('allows /customer-register-embed.html', async () => {
        const response = await request(app).get('/customer-register-embed.html').redirects(0);
        expect(response.headers.location || '').not.toMatch(/wavemaxlaundry\.com/);
      });

      it('allows /operator-scan-embed.html', async () => {
        const response = await request(app).get('/operator-scan-embed.html').redirects(0);
        expect(response.headers.location || '').not.toMatch(/wavemaxlaundry\.com/);
      });

      it('allows /administrator-dashboard-embed.html', async () => {
        const response = await request(app).get('/administrator-dashboard-embed.html').redirects(0);
        expect(response.headers.location || '').not.toMatch(/wavemaxlaundry\.com/);
      });

      it('allows /assets/* static files', async () => {
        const response = await request(app).get('/assets/css/styles.css').redirects(0);
        expect(response.headers.location || '').not.toMatch(/wavemaxlaundry\.com/);
      });

      it('allows /locales/* translation files', async () => {
        const response = await request(app).get('/locales/en/common.json').redirects(0);
        expect(response.headers.location || '').not.toMatch(/wavemaxlaundry\.com/);
      });

      it('allows /franchise-default/* internal iframe content', async () => {
        const response = await request(app).get('/franchise-default/landing.html').redirects(0);
        expect(response.headers.location || '').not.toMatch(/wavemaxlaundry\.com/);
      });
    });

    // ── Allowlist: legal pages ────────────────────────────────────────
    describe('Legal allowlist', () => {
      it('allows /privacy-policy', async () => {
        const response = await request(app).get('/privacy-policy').redirects(0);
        expect(response.headers.location || '').not.toMatch(/wavemaxlaundry\.com/);
      });

      it('allows /terms-and-conditions', async () => {
        const response = await request(app).get('/terms-and-conditions').redirects(0);
        expect(response.headers.location || '').not.toMatch(/wavemaxlaundry\.com/);
      });

      it('allows /terms-of-service', async () => {
        const response = await request(app).get('/terms-of-service').redirects(0);
        expect(response.headers.location || '').not.toMatch(/wavemaxlaundry\.com/);
      });

      it('allows /refund-policy', async () => {
        const response = await request(app).get('/refund-policy').redirects(0);
        expect(response.headers.location || '').not.toMatch(/wavemaxlaundry\.com/);
      });
    });

    // ── Redirect: non-Austin franchise slugs ──────────────────────────
    describe('Non-Austin franchise slugs', () => {
      it('redirects /dallas-tx/ to corporate (preserve path)', async () => {
        const response = await request(app).get('/dallas-tx/').redirects(0);
        expect(response.status).toBe(302);
        expect(response.headers.location).toBe(`${CORPORATE}/dallas-tx/`);
      });

      it('redirects /houston-tx (no trailing slash)', async () => {
        const response = await request(app).get('/houston-tx').redirects(0);
        expect(response.status).toBe(302);
        expect(response.headers.location).toBe(`${CORPORATE}/houston-tx`);
      });

      it('redirects /dallas-tx/wash-dry-fold/ to corporate (preserve full path)', async () => {
        const response = await request(app).get('/dallas-tx/wash-dry-fold/').redirects(0);
        expect(response.status).toBe(302);
        expect(response.headers.location).toBe(`${CORPORATE}/dallas-tx/wash-dry-fold/`);
      });
    });

    // ── Redirect: corporate marketing pages ───────────────────────────
    describe('Corporate marketing pages', () => {
      it('redirects / (base URL) to corporate root', async () => {
        const response = await request(app).get('/').redirects(0);
        expect(response.status).toBe(302);
        expect(response.headers.location).toBe(`${CORPORATE}/`);
      });

      it('redirects /about/ to corporate', async () => {
        const response = await request(app).get('/about/').redirects(0);
        expect(response.status).toBe(302);
        expect(response.headers.location).toBe(`${CORPORATE}/about/`);
      });

      it('redirects /franchise/ to corporate', async () => {
        const response = await request(app).get('/franchise/').redirects(0);
        expect(response.status).toBe(302);
        expect(response.headers.location).toBe(`${CORPORATE}/franchise/`);
      });

      it('redirects /faq/ to corporate', async () => {
        const response = await request(app).get('/faq/').redirects(0);
        expect(response.status).toBe(302);
        expect(response.headers.location).toBe(`${CORPORATE}/faq/`);
      });

      it('redirects /contact/ to corporate', async () => {
        const response = await request(app).get('/contact/').redirects(0);
        expect(response.status).toBe(302);
        expect(response.headers.location).toBe(`${CORPORATE}/contact/`);
      });

      it('redirects /testimonials/ to corporate', async () => {
        const response = await request(app).get('/testimonials/').redirects(0);
        expect(response.status).toBe(302);
        expect(response.headers.location).toBe(`${CORPORATE}/testimonials/`);
      });

      it('redirects /virtual-tour/ to corporate', async () => {
        const response = await request(app).get('/virtual-tour/').redirects(0);
        expect(response.status).toBe(302);
        expect(response.headers.location).toBe(`${CORPORATE}/virtual-tour/`);
      });

      it('redirects /become-a-franchisee/ to corporate', async () => {
        const response = await request(app).get('/become-a-franchisee/').redirects(0);
        expect(response.status).toBe(302);
        expect(response.headers.location).toBe(`${CORPORATE}/become-a-franchisee/`);
      });
    });

    // ── Redirect: unknown paths ───────────────────────────────────────
    describe('Unknown paths', () => {
      it('redirects an unknown path to corporate (preserve path)', async () => {
        const response = await request(app).get('/some-unknown-marketing-page').redirects(0);
        expect(response.status).toBe(302);
        expect(response.headers.location).toBe(`${CORPORATE}/some-unknown-marketing-page`);
      });

      it('redirects a stale .html path to corporate', async () => {
        const response = await request(app).get('/about.html').redirects(0);
        expect(response.status).toBe(302);
        expect(response.headers.location).toBe(`${CORPORATE}/about.html`);
      });

      it('preserves query string when redirecting', async () => {
        const response = await request(app).get('/about/?lang=es').redirects(0);
        expect(response.status).toBe(302);
        expect(response.headers.location).toBe(`${CORPORATE}/about/?lang=es`);
      });
    });
  });
});
