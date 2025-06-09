// Page-specific initialization for affiliate registration
(function() {
  'use strict';
  
  // Initialize i18n
  document.addEventListener('DOMContentLoaded', async function() {
    console.log('[DOMContentLoaded] Event fired');
    console.log('[DOMContentLoaded] SwirlSpinner available?', !!window.SwirlSpinner);
    
    if (window.i18n) {
      await window.i18n.init({ debugMode: false });
    }
    
    if (window.LanguageSwitcher) {
      window.LanguageSwitcher.createSwitcher('language-switcher-container', {
        style: 'dropdown',
        showLabel: false
      });
    }
    
  });
})();