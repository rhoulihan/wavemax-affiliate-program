(function() {
    'use strict';

    // Landing page specific initialization
    console.log('[embed-landing-init] Initializing landing page');
    
    // The i18n and language switcher are already initialized by embed-app-v2.js
    // Just ensure navigation handlers are set up
    
    // Ensure embed navigation is initialized
    if (window.EmbedNavigation && window.EmbedNavigation.init) {
        window.EmbedNavigation.init();
    }
    
    // Initialize revenue calculator if available
    if (window.RevenueCalculator && window.RevenueCalculator.init) {
        window.RevenueCalculator.init();
    }
})();