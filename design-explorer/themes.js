// design-explorer/themes.js
// Intensity = how prominent the WaveMAX brand is. Both keep the brand and §12.2.
const themes = {
  heavy: {
    id: 'heavy',
    logoScale: 1.0,            // full-size logo, brand leads
    brandTitle: 'WaveMAX Austin',
    noticePlacement: 'footer',
    vars: {
      '--brand': '#0c93ad', '--brand-deep': '#0b1f43', '--accent': '#1bcaa3',
      '--ink': '#0b1f43', '--paper': '#ffffff', '--lead': 'brand', // brand leads
    },
  },
  light: {
    id: 'light',
    logoScale: 0.62,           // smaller logo, local identity leads
    brandTitle: 'WaveMAX Austin · independently owned',
    noticePlacement: 'footer',
    vars: {
      '--brand': '#0c93ad', '--brand-deep': '#7a3b2e', // brand recedes to accent; warm local lead
      '--accent': '#c8612f', '--ink': '#2a211c', '--paper': '#faf4ec', '--lead': 'local',
    },
  },
};
module.exports = { themes };
