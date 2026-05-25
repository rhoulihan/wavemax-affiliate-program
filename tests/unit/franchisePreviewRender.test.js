const gbpToLocationData = require('../../server/services/gbpToLocationData');
const { renderPreviewHost } = require('../../server/services/franchisePreviewRender');

const GBP = {
  placeId: 'P1',
  name: 'WaveMAX Laundry Austin',
  formattedAddress: '825 E Rundberg Ln, Austin, TX 78753',
  phone: '+1 512-553-1674',
  hours: ['Monday: 7 AM–9 PM'],
  location: { latitude: 30.356606, longitude: -97.686748 },
  mapsUri: 'https://maps.google.com/?cid=1'
};

describe('franchisePreviewRender', () => {
  let html;
  beforeAll(() => {
    const data = gbpToLocationData(GBP, { slug: 'austin-tx' });
    html = renderPreviewHost(data, { nonce: 'TESTNONCE', slug: 'austin-tx' });
  });

  it('injects LOCATION_DATA with the business identity intact (escJson not mangling spaces)', () => {
    expect(html).toContain('window.LOCATION_DATA');
    expect(html).toContain('WaveMAX Laundry Austin'); // spaces preserved → escJson is correct
    expect(html).toContain('austin-tx');
  });

  it('embeds the franchise-default landing iframe (the localized content surface)', () => {
    expect(html).toContain('/franchise-default/landing.html');
  });

  it('applies the CSP nonce to the injected data script', () => {
    expect(html).toContain('nonce="TESTNONCE"');
  });

  it('forces noindex and shows the preview banner', () => {
    expect(html).toContain('noindex,nofollow');
    expect(html).toContain('PRIVATE PREVIEW');
  });

  it('leaves no unfilled template placeholders', () => {
    expect(html).not.toMatch(/\{\{[A-Z_]+\}\}/);
  });

  it('produces a complete HTML document', () => {
    expect(html).toMatch(/<!doctype html>/i);
    expect(html).toContain('</html>');
  });
});
