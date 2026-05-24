// Performance + SEO regression guards for the franchise host page and the
// franchise-default iframe content pages.
//
// 1. Crawler-facing SEO image URLs (og:image, twitter:image, JSON-LD image)
//    rendered server-side MUST stay absolute (https://wavemax.promo/...), even
//    though browser-rendered gallery/hero images load same-origin at runtime.
// 2. The franchise-default landing page must reference the SAME version of
//    wm-image-config.js as the host page (no ?v= skew that double-loads it).
// 3. The Google Maps embed must be lazy (not eagerly fetched on first paint).
const fs = require('fs');
const path = require('path');
const request = require('supertest');
const app = require('../../server');

const PUB = path.join(__dirname, '..', '..', 'public');

describe('Franchise host page — SEO images stay absolute', () => {
  let html;
  beforeAll(async () => {
    const res = await request(app).get('/austin-tx/').set('Host', 'rundberglaundry.com');
    expect(res.status).toBe(200);
    html = res.text;
  });

  it('og:image is an absolute wavemax.promo URL', () => {
    const m = html.match(/<meta property="og:image" content="([^"]+)"/);
    expect(m).not.toBeNull();
    expect(m[1]).toMatch(/^https:\/\/wavemax\.promo\//);
  });

  it('twitter:image is an absolute wavemax.promo URL', () => {
    const m = html.match(/<meta name="twitter:image" content="([^"]+)"/);
    expect(m).not.toBeNull();
    expect(m[1]).toMatch(/^https:\/\/wavemax\.promo\//);
  });

  it('JSON-LD image array entries are absolute wavemax.promo URLs', () => {
    // The DryCleaningOrLaundry block ships an "image": [ ... ] array.
    const m = html.match(/"image":\s*\[\s*"([^"]+)"/);
    expect(m).not.toBeNull();
    expect(m[1]).toMatch(/^https:\/\/wavemax\.promo\//);
  });

  it('still injects window.LOCATION_DATA (chrome data path intact)', () => {
    expect(html).toContain('window.LOCATION_DATA');
  });
});

describe('Franchise pages — de-duplicated assets (no version skew)', () => {
  function wmImageConfigVersion(file) {
    const src = fs.readFileSync(path.join(PUB, file), 'utf8');
    const m = src.match(/wm-image-config\.js\?v=([0-9a-z]+)/i);
    return m ? m[1] : null;
  }

  it('host page and franchise-default/landing.html load the same wm-image-config.js version', () => {
    const hostV = wmImageConfigVersion('franchise-host.html');
    const landingV = wmImageConfigVersion('franchise-default/landing.html');
    expect(hostV).not.toBeNull();
    expect(landingV).not.toBeNull();
    expect(landingV).toBe(hostV);
  });
});

describe('Franchise pages — lazy Google Maps embed', () => {
  function read(file) { return fs.readFileSync(path.join(PUB, file), 'utf8'); }

  it('host page footer map iframe is NOT eagerly src-bound (data-bind src deferred until lazy-load)', () => {
    const html = read('franchise-host.html');
    // The map iframe should carry the deferred src in a data-src attr and be
    // wired for lazy loading, not bound straight to src on first paint.
    const mapBlock = html.match(/<iframe[^>]*Map to this WaveMAX location[\s\S]*?<\/iframe>/);
    expect(mapBlock).not.toBeNull();
    const frame = mapBlock[0];
    // Lazy facade: src must NOT be eagerly data-bound; the deferred URL lives
    // in data-src and a lazy loader attaches it on scroll/interaction.
    expect(frame).toMatch(/data-map-src|data-src/);
    expect(frame).toMatch(/loading="lazy"/);
  });

  it('a lazy-map loader script is wired into the host page', () => {
    const html = read('franchise-host.html');
    expect(html).toMatch(/franchise-map-lazy\.js/);
  });

  it('contact page map iframe is lazy and wires the lazy-map loader', () => {
    // contact.html is a symlink to contact-embed.html (the real file).
    const html = read('contact-embed.html');
    const mapBlock = html.match(/<iframe[^>]*Map to this WaveMAX location[\s\S]*?<\/iframe>/);
    expect(mapBlock).not.toBeNull();
    expect(mapBlock[0]).toMatch(/data-map-src-bind/);
    expect(mapBlock[0]).not.toMatch(/data-bind="contact\.mapsEmbedUrl"/);
    expect(html).toMatch(/franchise-map-lazy\.js/);
  });
});

describe('Localized landmark images (no external Wikimedia round-trips)', () => {
  const data = require('../../public/data/franchises/austin-tx.json');

  it('austin-tx landmarks reference local optimized assets, not upload.wikimedia.org', () => {
    const urls = (data.images.landmarks || []).map((l) => l.url);
    expect(urls.length).toBe(3);
    urls.forEach((u) => {
      expect(u).not.toMatch(/upload\.wikimedia\.org/);
      expect(u).toMatch(/\/assets\/images\/locations\/austin-tx\/landmarks\//);
    });
  });

  it('each localized landmark file exists on disk', () => {
    (data.images.landmarks || []).forEach((l) => {
      const rel = l.url.replace(/^https?:\/\/[^/]+/, '').split('?')[0];
      const file = path.join(PUB, rel);
      expect(fs.existsSync(file)).toBe(true);
    });
  });

  it('landmarks keep their alt text', () => {
    (data.images.landmarks || []).forEach((l) => {
      expect(typeof l.alt).toBe('string');
      expect(l.alt.length).toBeGreaterThan(0);
    });
  });
});
