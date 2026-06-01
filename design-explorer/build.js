// design-explorer/build.js
const fs = require('fs');
const path = require('path');
const { renderState } = require('./render');
const model = require('./content-model');

const INTENSITIES = ['heavy', 'light'];
const BUILD_NONCE = 'DSNONCE'; // static style nonce; server CSP for /design-explorer allows it

function buildAll({ outDir, skins }) {
  fs.mkdirSync(outDir, { recursive: true });
  const states = [];
  for (const skin of skins) {
    for (const intensity of INTENSITIES) {
      for (const page of model.PAGES) {
        for (const lang of model.LANGS) {
          const html = renderState({ skin, intensity, page, lang, nonce: BUILD_NONCE });
          const file = `${skin.id}-${intensity}-${page}-${lang}.html`;
          fs.writeFileSync(path.join(outDir, file), html);
          states.push({ skin: skin.id, intensity, page, lang, file });
        }
      }
    }
  }
  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify({ states }, null, 2));
  return { count: states.length };
}

if (require.main === module) {
  const serviceOs = require('./skins/service-os');
  const neighborhoodEditorial = require('./skins/neighborhood-editorial');
  const austinBold = require('./skins/austin-bold');
  const outDir = path.join(__dirname, '..', 'public', 'design-explorer', 'render');
  const { count } = buildAll({ outDir, skins: [serviceOs, neighborhoodEditorial, austinBold] });
  // eslint-disable-next-line no-console
  console.log(`built ${count} states -> ${outDir}`);
}

module.exports = { buildAll, INTENSITIES, BUILD_NONCE };
