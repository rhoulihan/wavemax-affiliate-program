/**
 * Parent-Iframe Communication Bridge - Inline Version
 * This script should be embedded directly in the parent page that contains the WaveMAX iframe
 * Add this script AFTER the iframe element in your HTML
 */

(function() {
    'use strict';
    
    let chromeHidden = false;
    
    // Hide chrome function (same as in full parent-iframe-bridge.js)
    function hideChrome() {
        if (chromeHidden) return;

        console.log('[WaveMAX Bridge] Hiding header/footer');
        
        // Find all elements to hide - WaveMAX CMS specific selectors
        const topbar = document.querySelector('.topbar');
        const wrapper = document.querySelector('.wrapper');
        const header = document.querySelector('.navbar');
        const pageHeader = document.querySelector('.page-header');
        const footer = document.querySelector('.footer');

        // Hide topbar
        if (topbar) {
            topbar.style.display = 'none';
            topbar.setAttribute('data-mobile-hidden', 'true');
        }

        // Hide wrapper (contains navbar) or navbar directly
        if (wrapper) {
            wrapper.style.display = 'none';
            wrapper.setAttribute('data-mobile-hidden', 'true');
        } else if (header) {
            // Fallback if wrapper not found
            header.style.transition = 'transform 0.3s ease-in-out';
            header.style.transform = 'translateY(-100%)';
            header.setAttribute('data-mobile-hidden', 'true');
        }

        // Hide page header
        if (pageHeader) {
            pageHeader.style.display = 'none';
            pageHeader.setAttribute('data-mobile-hidden', 'true');
        }

        // Hide footer
        if (footer) {
            footer.style.transition = 'transform 0.3s ease-in-out';
            footer.style.transform = 'translateY(100%)';
            footer.setAttribute('data-mobile-hidden', 'true');
        }

        // Adjust iframe container to full viewport
        const iframe = document.querySelector('iframe[src*="affiliate.wavemax.promo"]') || 
                      document.querySelector('iframe#wavemax-affiliate-iframe');
                      
        if (iframe) {
            const container = iframe.parentElement;
            if (container) {
                container.style.transition = 'all 0.3s ease-in-out';
                container.style.minHeight = '100vh';
                container.style.paddingTop = '0';
                container.style.paddingBottom = '0';
            }
            
            // Make iframe full height
            iframe.style.minHeight = '100vh';
        }

        chromeHidden = true;
        console.log('[WaveMAX Bridge] Chrome hidden successfully');
    }
    
    // Try to hide immediately
    hideChrome();
    
    // Try again when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', hideChrome);
    }
    
    // Also try after a delay for dynamically loaded content
    setTimeout(hideChrome, 500);
    setTimeout(hideChrome, 1000);
    
    // Listen for messages from the iframe
    window.addEventListener('message', function(event) {
        // Check if message is from WaveMAX iframe
        if (event.data && event.data.type === 'hide-page-header') {
            hideChrome();
        }
    });
    
    // Also hide when window loads completely
    window.addEventListener('load', hideChrome);
})();