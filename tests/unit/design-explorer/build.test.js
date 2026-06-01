// tests/unit/design-explorer/build.test.js
const fs = require('fs');
const path = require('path');
const os = require('os');
const { buildAll } = require('../../../design-explorer/build');
const serviceOs = require('../../../design-explorer/skins/service-os');
const neighborhoodEditorial = require('../../../design-explorer/skins/neighborhood-editorial');
const austinBold = require('../../../design-explorer/skins/austin-bold');

describe('buildAll', () => {
  it('writes a file per state and a manifest', () => {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'dsbuild-'));
    const res = buildAll({ outDir: out, skins: [serviceOs, neighborhoodEditorial, austinBold] });
    // 3 skins x 2 intensities x 6 pages x 4 langs = 144
    expect(res.count).toBe(144);
    // service-os (Direction 1)
    expect(fs.existsSync(path.join(out, 'service-os-heavy-home-en.html'))).toBe(true);
    expect(fs.existsSync(path.join(out, 'service-os-light-contact-es.html'))).toBe(true);
    expect(fs.existsSync(path.join(out, 'service-os-heavy-home-pt.html'))).toBe(true);
    expect(fs.existsSync(path.join(out, 'service-os-light-contact-de.html'))).toBe(true);
    // neighborhood-editorial (Direction 2)
    expect(fs.existsSync(path.join(out, 'neighborhood-editorial-heavy-home-en.html'))).toBe(true);
    expect(fs.existsSync(path.join(out, 'neighborhood-editorial-light-contact-de.html'))).toBe(true);
    // austin-bold (Direction 3 — "RUNDBERG PRESS")
    expect(fs.existsSync(path.join(out, 'austin-bold-heavy-home-en.html'))).toBe(true);
    expect(fs.existsSync(path.join(out, 'austin-bold-light-wash-dry-fold-pt.html'))).toBe(true);
    const manifest = JSON.parse(fs.readFileSync(path.join(out, 'manifest.json'), 'utf8'));
    expect(manifest.states.length).toBe(144);
    expect(manifest.states[0]).toHaveProperty('skin');
    expect(manifest.states[0]).toHaveProperty('intensity');
  });
});
