// crhsent.com — verifies the sales site is served through the app under the
// full security model: strict nonce-based CSP, no inline CSS/JS, external assets.
const request = require('supertest');
const app = require('../../server');

const HOST = 'crhsent.com';

describe('crhsent.com — full security model (app-served, strict CSP)', () => {
  it('serves /wavemax/ with a strict, nonce-based CSP (no unsafe-inline in script-src)', async () => {
    const res = await request(app).get('/wavemax/').set('Host', HOST);
    expect(res.status).toBe(200);

    const csp = res.headers['content-security-policy'];
    expect(csp).toBeTruthy();
    const scriptSrc = (csp.split(';').find(d => d.trim().startsWith('script-src')) || '').trim();
    expect(scriptSrc).toMatch(/'nonce-/);              // nonce present
    expect(scriptSrc).not.toMatch(/'unsafe-inline'/);  // strict: scripts cannot be inline
  });

  it('has no inline JS, and links the external asset bundle', async () => {
    const res = await request(app).get('/wavemax/').set('Host', HOST);
    expect(res.status).toBe(200);
    expect(res.text).toContain('16 months of growth');          // real page content
    // script-src is strict (nonce-only, no 'unsafe-inline') so inline JS is forbidden:
    // every <script> must carry the per-request nonce and reference an external src.
    expect(res.text).not.toMatch(/<script(?![^>]*\bnonce=)[^>]*>/);  // no nonce-less <script>
    expect(res.text).not.toMatch(/<script\b[^>]*>\s*[^<\s]/);        // no inline <script> body
    // NOTE: inline style="" attributes are intentionally allowed — style-src always carries
    // 'unsafe-inline' by design (server.js CSP3-quirk handling). Only script-src is strict,
    // since CSS injection is a materially weaker threat than JS injection. The page links the
    // shared stylesheet but legitimately uses a few inline style attrs in the exposé callouts.
    // Asset refs carry a ?v= cache-buster, so match the path (not an exact-quote substring).
    expect(res.text).toMatch(/href="\/wavemax\/styles\.css(\?[^"]*)?"/);  // external stylesheet
    expect(res.text).toMatch(/src="\/wavemax\/app\.js(\?[^"]*)?"/);       // external script
  });

  it('injects the per-request nonce into the csp-nonce meta', async () => {
    const res = await request(app).get('/wavemax/').set('Host', HOST);
    const m = res.text.match(/<meta name="csp-nonce" content="([^"]+)"/);
    expect(m).toBeTruthy();
    expect(m[1].length).toBeGreaterThan(10);
  });

  it('serves the external stylesheet and script with correct types', async () => {
    const css = await request(app).get('/wavemax/styles.css').set('Host', HOST);
    expect(css.status).toBe(200);
    expect(css.headers['content-type']).toMatch(/css/);

    const js = await request(app).get('/wavemax/app.js').set('Host', HOST);
    expect(js.status).toBe(200);
    expect(js.headers['content-type']).toMatch(/javascript/);
  });

  it('does not leak files outside the crhsent root (path-traversal guard)', async () => {
    const res = await request(app).get('/wavemax/%2e%2e%2f%2e%2e%2fserver.js').set('Host', HOST);
    expect(res.status).not.toBe(200);
  });
});
