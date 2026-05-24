// Performance: the franchise host page is served from the franchise's own
// domain (e.g. rundberglaundry.com), but per-franchise image data carries
// ABSOLUTE https://wavemax.promo/... URLs. Browser-rendered <img>/background
// images using those absolute URLs trigger a wasted cross-domain 301 round-trip
// (fetch from wavemax.promo → 301 → re-fetch same-origin). Relativizing the
// browser-rendered images to a path-only URL makes them load same-origin.
//
// Crawler-facing SEO image fields (og:image, twitter:image, JSON-LD image) MUST
// stay absolute — those are read by bots that don't know the serving domain.
// This suite exercises the pure relativizer used by the client render path.
//
// The helper lives in a browser IIFE (public/assets/js/franchise-page-helpers.js)
// that assigns to window.FranchisePage. We evaluate it in a vm sandbox with a
// window stub so the pure functions are testable under jest's node environment
// (jsdom is not installed in this project).
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadFranchisePage() {
  const file = path.join(__dirname, '..', '..', 'public', 'assets', 'js', 'franchise-page-helpers.js');
  const code = fs.readFileSync(file, 'utf8');
  const sandbox = { window: {}, document: undefined, Image: function () {} };
  vm.runInNewContext(code, sandbox, { filename: file, timeout: 1000 });
  return sandbox.window.FranchisePage;
}

describe('FranchisePage.relativizeAssetUrl — same-origin browser images', () => {
  let FP;
  beforeAll(() => { FP = loadFranchisePage(); });

  it('exposes the relativizer', () => {
    expect(typeof FP.relativizeAssetUrl).toBe('function');
  });

  it('strips a leading https://wavemax.promo host → path-only', () => {
    expect(FP.relativizeAssetUrl('https://wavemax.promo/assets/images/locations/austin-tx/hero-1.jpg'))
      .toBe('/assets/images/locations/austin-tx/hero-1.jpg');
  });

  it('preserves the cache-buster query string', () => {
    expect(FP.relativizeAssetUrl('https://wavemax.promo/assets/images/locations/austin-tx/hero-1.jpg?v=20260520'))
      .toBe('/assets/images/locations/austin-tx/hero-1.jpg?v=20260520');
  });

  it('strips the www. variant too', () => {
    expect(FP.relativizeAssetUrl('https://www.wavemax.promo/assets/images/locations/austin-tx/interior-2.jpg'))
      .toBe('/assets/images/locations/austin-tx/interior-2.jpg');
  });

  it('leaves an already-relative path untouched', () => {
    expect(FP.relativizeAssetUrl('/assets/images/locations/austin-tx/hero-1.jpg'))
      .toBe('/assets/images/locations/austin-tx/hero-1.jpg');
  });

  it('leaves external (non-wavemax.promo) absolute URLs untouched — e.g. Wikimedia landmarks', () => {
    const wiki = 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/60/PennybackerBridge.jpg';
    expect(FP.relativizeAssetUrl(wiki)).toBe(wiki);
  });

  it('handles empty / nullish input gracefully', () => {
    expect(FP.relativizeAssetUrl('')).toBe('');
    expect(FP.relativizeAssetUrl(null)).toBe('');
    expect(FP.relativizeAssetUrl(undefined)).toBe('');
  });

  it('heroUrl() returns a same-origin (relative) URL for the hero background', () => {
    const data = { images: { hero: ['https://wavemax.promo/assets/images/locations/austin-tx/hero-1.jpg?v=1'] } };
    expect(FP.heroUrl(data)).toBe('/assets/images/locations/austin-tx/hero-1.jpg?v=1');
  });

  it('ogImage() stays ABSOLUTE (crawler-facing — must not be relativized)', () => {
    const data = {
      images: {
        ogImage: 'https://wavemax.promo/assets/images/locations/austin-tx/hero-1.jpg?v=1',
        hero: ['https://wavemax.promo/assets/images/locations/austin-tx/hero-1.jpg?v=1']
      }
    };
    expect(FP.ogImage(data)).toMatch(/^https:\/\/wavemax\.promo\//);
  });

  it('buildSeo() keeps og/twitter/JSON-LD image ABSOLUTE', () => {
    const data = {
      slug: 'austin-tx',
      brand: { name: 'WaveMAX Laundry Austin', parent: 'WaveMAX Laundry' },
      contact: { city: 'Austin', state: 'TX', address: '825 E Rundberg Ln F1' },
      images: {
        ogImage: 'https://wavemax.promo/assets/images/locations/austin-tx/hero-1.jpg?v=1',
        hero: ['https://wavemax.promo/assets/images/locations/austin-tx/hero-1.jpg?v=1']
      },
      seo: {}
    };
    const seo = FP.buildSeo(data, 'landing');
    expect(seo.openGraph.image).toMatch(/^https:\/\/wavemax\.promo\//);
    expect(seo.twitter.image).toMatch(/^https:\/\/wavemax\.promo\//);
    expect(seo.structuredData.localBusiness.image[0]).toMatch(/^https:\/\/wavemax\.promo\//);
  });
});
