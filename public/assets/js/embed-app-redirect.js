(function() {
    'use strict';

    // Redirect to embed-app-v2.html while preserving all URL parameters
    function redirectToV2() {
        const currentUrl = new URL(window.location);
        const newUrl = new URL('/embed-app-v2.html', window.location.origin);
        
        // Copy all search parameters
        currentUrl.searchParams.forEach((value, key) => {
            newUrl.searchParams.set(key, value);
        });
        
        // Copy hash if present
        if (currentUrl.hash) {
            newUrl.hash = currentUrl.hash;
        }
        
        console.log('Redirecting from embed-app.html to embed-app-v2.html');
        console.log('Original URL:', currentUrl.toString());
        console.log('Redirect URL:', newUrl.toString());
        
        // Immediate redirect
        window.location.replace(newUrl.toString());
    }
    
    // Redirect immediately when script loads
    redirectToV2();
    
    // Fallback redirect after 2 seconds in case the immediate redirect fails
    setTimeout(redirectToV2, 2000);
})();