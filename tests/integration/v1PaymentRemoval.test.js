// V1 Paygistix removal regression tests (PR 1 of the invite/bag/workflow redesign).
// Spec: docs/superpowers/specs/2026-06-08-invite-bag-workflow-redesign-design.md §7, §11, §12.
// Pins the removal: the V1 payment surface must be gone (404) and server.js must
// no longer whitelist the Paygistix gateway origin in CSP. This file grows by one
// describe block per task of the PR-1 plan.
const fs = require('fs');
const path = require('path');
const request = require('supertest');
const app = require('../../server');
const { getCsrfToken, createAgent } = require('../helpers/csrfHelper');

describe('V1 Paygistix removal', () => {
  // POST probes MUST carry a CSRF token. conditionalCsrf is mounted globally
  // and default-enforces unlisted mutation paths even under NODE_ENV=test, so
  // a tokenless POST returns 403 before routing and never reaches the 404
  // handler. Sending the token also keeps the create-token probe green after
  // Task 5 removes its REGISTRATION_ENDPOINTS exemption (tokenless, it would
  // flip 404 -> 403 at that commit).
  let agent;
  let csrfToken;

  beforeAll(async () => {
    agent = createAgent(app);
    csrfToken = await getCsrfToken(app, agent);
  });

  describe('unmounted V1 payment routes return 404', () => {
    it('GET /api/v1/payments/config -> 404', async () => {
      const res = await request(app).get('/api/v1/payments/config');
      expect(res.status).toBe(404);
    });

    it('POST /api/v1/payments/create-token -> 404', async () => {
      const res = await agent
        .post('/api/v1/payments/create-token')
        .set('x-csrf-token', csrfToken)
        .send({});
      expect(res.status).toBe(404);
    });

    it('GET /api/v1/payments/check-status/:token -> 404', async () => {
      const res = await request(app).get('/api/v1/payments/check-status/sometoken');
      expect(res.status).toBe(404);
    });

    it('GET /api/v1/payments/pool-stats -> 404', async () => {
      const res = await request(app).get('/api/v1/payments/pool-stats');
      expect(res.status).toBe(404);
    });

    it('GET /api/v1/payment_callback -> 404 (Paygistix callback unmounted)', async () => {
      const res = await request(app).get('/api/v1/payment_callback');
      expect(res.status).toBe(404);
    });
  });

  describe('CSP / server.js scrub', () => {
    it('server.js no longer references the Paygistix gateway origin', () => {
      const src = fs.readFileSync(path.join(__dirname, '../../server.js'), 'utf8');
      expect(src).not.toMatch(/safepay\.paymentlogistics\.net/);
      expect(src).not.toMatch(/callbackPoolManager/);
      expect(src).not.toMatch(/paymentRoutes/);
      expect(src).not.toMatch(/payment_callback/);
      expect(src).not.toMatch(/ENABLE_TEST_PAYMENT_FORM/);
    });

    it('live CSP header carries no Paygistix origin', async () => {
      const res = await request(app).get('/api/v1/environment');
      const csp = res.headers['content-security-policy'] || '';
      expect(csp).not.toMatch(/safepay\.paymentlogistics\.net/);
    });
  });

  describe('V1 customer payment endpoints are gone', () => {
    it('POST /api/v1/customers/initiate-payment -> 404', async () => {
      // /api/v1/customers/initiate-payment is on NO csrf-config exemption list,
      // so the global conditionalCsrf default-enforces it: a tokenless POST
      // would 403 before AND after the route removal (the probe could never
      // pass). The agent + x-csrf-token (from the file-level beforeAll) lets
      // the request reach routing, so removal genuinely yields 404.
      const res = await agent
        .post('/api/v1/customers/initiate-payment')
        .set('x-csrf-token', csrfToken)
        .send({ orderId: 'ORD-x' });
      expect(res.status).toBe(404);
    });

    it('GET /api/v1/customers/payment-status/:orderId -> 404', async () => {
      const res = await request(app).get('/api/v1/customers/payment-status/ORD-x');
      expect(res.status).toBe(404);
    });
  });
});
