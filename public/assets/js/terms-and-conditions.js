// Terms and Conditions Page JavaScript
console.log('[Terms Script] Loading terms-and-conditions.js');

// Function to initialize the page
function initializeTermsPage() {
    console.log('[Terms Script] Initializing terms page');
    
    // Check if we're in an iframe
    const isInIframe = window.parent !== window;
    console.log('[Terms Script] Is in iframe:', isInIframe);
    
    // Handle back button click
    const backButton = document.getElementById('backButton');
    console.log('[Terms Script] Back button found:', !!backButton);
    
    if (backButton) {
        backButton.addEventListener('click', function(e) {
            console.log('[Terms Script] Back button clicked');
            e.preventDefault();
            
            if (isInIframe) {
                // In iframe context, use postMessage to go back
                console.log('[Terms Script] Sending navigate-back message to parent');
                window.parent.postMessage({
                    type: 'navigate-back'
                }, '*');
            } else {
                // In direct access, use browser history
                console.log('[Terms Script] Using history.back()');
                history.back();
            }
        });
    }
    
    // Listen for navigation events in iframe context
    if (isInIframe) {
        document.querySelectorAll('[data-navigate]').forEach(link => {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                const route = this.getAttribute('data-navigate');
                window.parent.postMessage({
                    type: 'navigate',
                    data: { page: route }
                }, '*');
            });
        });
    }
}

// Try multiple initialization strategies for dynamically loaded content
// 1. If DOM is already ready
if (document.readyState === 'loading') {
    console.log('[Terms Script] DOM still loading, waiting for DOMContentLoaded');
    document.addEventListener('DOMContentLoaded', initializeTermsPage);
} else {
    console.log('[Terms Script] DOM already loaded, initializing with delay');
    // Add a small delay for dynamically inserted content
    setTimeout(initializeTermsPage, 100);
}

// 2. Also try when script loads
initializeTermsPage();