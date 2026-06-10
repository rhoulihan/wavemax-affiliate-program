// PR 2 removal regressions (spec §7 / §11 "Removal regressions").
// Every route deleted in this PR must 404 (or the static file must be gone).
const request = require('supertest');
const app = require('../../server');
const { getCsrfToken, createAgent } = require('../helpers/csrfHelper');

describe('PR 2 removed routes return 404', () => {
  // POST probes must carry a CSRF token: this same task deletes the
  // beta-request entries from csrf-config REGISTRATION_ENDPOINTS, after which
  // the global conditionalCsrf default-enforces the path. A tokenless POST
  // would 403 before routing and never reach the 404 handler. (Same trap
  // Task 6 dodges by using GET probes on /api/v1/orders.)
  let agent;
  let csrfToken;

  beforeAll(async () => {
    agent = createAgent(app);
    csrfToken = await getCsrfToken(app, agent);
  });

  it('POST /api/v1/affiliates/beta-request is gone', async () => {
    const res = await agent
      .post('/api/v1/affiliates/beta-request')
      .set('x-csrf-token', csrfToken)
      .send({
        firstName: 'A', lastName: 'B', email: 'x@y.com', phone: '1',
        address: '123 Test St', city: 'Austin', state: 'TX', zipCode: '78701'
      });
    expect(res.status).toBe(404);
  });

  it('GET /api/v1/affiliates/:affiliateId/schedule is gone', async () => {
    // Route had per-route `authenticate`: before removal an anonymous request
    // gets 401; after removal nothing matches the two-segment path → global 404.
    const res = await request(app).get('/api/v1/affiliates/AFF-test/schedule');
    expect(res.status).toBe(404);
  });

  it('order creation / Pickup Now / check-active routes are unregistered', () => {
    // Route-table assertion instead of HTTP probes: /check-active falls
    // through to GET /:orderId (authenticate → 401 anonymous, same as before
    // removal), and the POSTs would 403 on CSRF before routing — neither
    // probe can observe the removal over HTTP.
    const orderRoutes = require('../../server/routes/orderRoutes');
    const registered = orderRoutes.stack
      .filter((layer) => layer.route)
      .map((layer) => `${Object.keys(layer.route.methods).join(',')} ${layer.route.path}`);
    // Canary: a route that DOES exist must appear, proving the introspection
    // sees real routes — otherwise the not.toContain checks pass vacuously
    // if a future Express version changes the layer shape.
    expect(registered).toContain('get /export');
    expect(registered).not.toContain('get /check-active');
    expect(registered).not.toContain('get /immediate/availability');
    expect(registered).not.toContain('post /immediate');
    expect(registered).not.toContain('post /');
  });

  it('GET /api/v1/orders/immediate/availability is gone', async () => {
    // Two path segments — nothing left matches → global 404.
    const res = await request(app).get('/api/v1/orders/immediate/availability');
    expect(res.status).toBe(404);
  });

  it('schedule-pickup-embed.html is gone', async () => {
    const res = await request(app).get('/schedule-pickup-embed.html');
    expect(res.status).toBe(404);
  });
});
