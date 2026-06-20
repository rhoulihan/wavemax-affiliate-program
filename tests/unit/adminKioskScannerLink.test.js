// Admin console → kiosk scanner "Data Transmission Speed" barcodes link.
// Lets store staff slow the BCST-75S output interval (fixes dropped-character
// "bag not registered" scans) without the Bluetooth-only Inateck app.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const html = fs.readFileSync(path.join(ROOT, 'public/administrator-dashboard-embed.html'), 'utf8');

describe('admin console: kiosk scanner transmission-speed link', () => {
  it('has the kiosk-scanner card linking to the Data Transmission Speed barcodes', () => {
    expect(html).toContain('id="kioskScannerCard"');
    expect(html).toContain('BCST-54_Complete'); // the manual page with the barcodes
    expect(html).toMatch(/#page=9/);            // deep-links to the Data Transmission Speed page
    expect(html).toContain('data-i18n="admin.kioskScanner.link"');
    expect(html).toMatch(/target="_blank"[\s\S]{0,40}rel="noopener"|rel="noopener"/); // safe external link
  });

  it('ships admin.kioskScanner.* in all four languages', () => {
    for (const lang of ['en', 'es', 'pt', 'de']) {
      const dict = JSON.parse(fs.readFileSync(path.join(ROOT, `public/locales/${lang}/common.json`), 'utf8'));
      for (const k of ['title', 'intro', 'link', 'note']) {
        expect(`${lang}:admin.kioskScanner.${k}:${typeof (dict.admin.kioskScanner && dict.admin.kioskScanner[k])}`)
          .toBe(`${lang}:admin.kioskScanner.${k}:string`);
      }
    }
  });
});
