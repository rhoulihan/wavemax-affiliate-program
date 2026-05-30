// design-explorer/skins/_stub/index.js
module.exports = {
  id: 'stub',
  css: '/* STUB-CSS */ body{margin:0}',
  renderPage(page /*, content, intensity, lang */) {
    return `<main>STUB-BODY-${page}</main>`;
  },
};
