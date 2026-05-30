// tests/unit/design-explorer/build.test.js
const fs = require('fs');
const path = require('path');
const os = require('os');
const { buildAll } = require('../../../design-explorer/build');
const serviceOs = require('../../../design-explorer/skins/service-os');

describe('buildAll', () => {
  it('writes a file per state and a manifest', () => {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'dsbuild-'));
    const res = buildAll({ outDir: out, skins: [serviceOs] });
    // 1 skin x 2 intensities x 6 pages x 2 langs = 24
    expect(res.count).toBe(24);
    expect(fs.existsSync(path.join(out, 'service-os-heavy-home-en.html'))).toBe(true);
    expect(fs.existsSync(path.join(out, 'service-os-light-contact-es.html'))).toBe(true);
    const manifest = JSON.parse(fs.readFileSync(path.join(out, 'manifest.json'), 'utf8'));
    expect(manifest.states.length).toBe(24);
    expect(manifest.states[0]).toHaveProperty('skin');
    expect(manifest.states[0]).toHaveProperty('intensity');
  });
});
