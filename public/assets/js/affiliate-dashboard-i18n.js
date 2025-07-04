(function() {
    'use strict';

    // Initialize i18n
    document.addEventListener('DOMContentLoaded', async function() {
        await window.i18n.init({ debugMode: false });
        window.LanguageSwitcher.createSwitcher('language-switcher-container', {
            style: 'dropdown',
            showLabel: false
        });
    });
})();