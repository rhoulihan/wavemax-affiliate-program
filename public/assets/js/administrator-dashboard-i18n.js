// Administrator Dashboard i18n initialization
document.addEventListener('DOMContentLoaded', async function() {
    await window.i18n.init({ debugMode: false });
    window.LanguageSwitcher.createSwitcher('language-switcher-container', {
        style: 'dropdown',
        showLabel: false
    });
});