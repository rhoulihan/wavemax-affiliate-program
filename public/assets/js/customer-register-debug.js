// Customer Registration Debug Script
// Logs script loading status for debugging purposes

document.addEventListener('DOMContentLoaded', function() {
    console.log('[Page Load Debug] Scripts loaded');
    console.log('[Page Load Debug] window.SwirlSpinner:', !!window.SwirlSpinner);
    console.log('[Page Load Debug] window.SwirlSpinnerUtils:', !!window.SwirlSpinnerUtils);
    
    // Check if swirl-spinner.js loaded properly
    setTimeout(() => {
        console.log('[After 500ms] window.SwirlSpinner:', !!window.SwirlSpinner);
        console.log('[After 500ms] window.SwirlSpinnerUtils:', !!window.SwirlSpinnerUtils);
    }, 500);
});

// Handle script loading errors
window.addEventListener('error', function(event) {
    if (event.target && event.target.tagName === 'SCRIPT') {
        console.error('[Script Load Error] Failed to load:', event.target.src);
    }
}, true);