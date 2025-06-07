/**
 * Parent-Iframe Communication Bridge - Inline Version v2
 * More robust version with better element detection
 */

(function() {
    'use strict';
    
    let chromeHidden = false;
    let attemptCount = 0;
    const maxAttempts = 10;
    
    // Hide chrome function with better logging
    function hideChrome() {
        if (chromeHidden) return;
        
        console.log('[WaveMAX Bridge] Attempt', attemptCount + 1, 'to hide chrome elements');
        
        // Find all elements to hide
        const elements = [
            { selector: '.topbar', style: 'display: none' },
            { selector: '.wrapper', style: 'display: none' },
            { selector: '.navbar', style: 'display: none' },
            { selector: '.page-header', style: 'display: none' },
            { selector: '.page-header.page-header-modern', style: 'display: none' },
            { selector: '.page-header.page-header-modern.bg-color-light-scale-1', style: 'display: none' },
            { selector: '.footer', style: 'display: none' }
        ];
        
        let hiddenCount = 0;
        
        elements.forEach(({selector, style}) => {
            const element = document.querySelector(selector);
            if (element && !element.hasAttribute('data-wavemax-hidden')) {
                console.log('[WaveMAX Bridge] Found and hiding:', selector);
                element.setAttribute('style', style);
                element.setAttribute('data-wavemax-hidden', 'true');
                hiddenCount++;
            }
        });
        
        // Adjust iframe container
        const iframe = document.querySelector('iframe[src*="affiliate.wavemax.promo"]') || 
                      document.querySelector('iframe#wavemax-affiliate-iframe');
                      
        if (iframe) {
            const container = iframe.parentElement;
            if (container) {
                container.style.minHeight = '100vh';
                container.style.paddingTop = '0';
                container.style.paddingBottom = '0';
            }
            iframe.style.minHeight = '100vh';
        }
        
        if (hiddenCount > 0) {
            chromeHidden = true;
            console.log('[WaveMAX Bridge] Successfully hidden', hiddenCount, 'elements');
        } else if (attemptCount < maxAttempts) {
            // Keep trying if we haven't hidden anything yet
            attemptCount++;
            setTimeout(hideChrome, 200 * attemptCount); // Exponential backoff
        } else {
            console.log('[WaveMAX Bridge] No elements found to hide after', maxAttempts, 'attempts');
        }
    }
    
    // Start hiding process
    console.log('[WaveMAX Bridge] Inline script v2 loaded');
    
    // Try immediately
    hideChrome();
    
    // Try when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            console.log('[WaveMAX Bridge] DOM ready, attempting to hide chrome');
            hideChrome();
        });
    }
    
    // Try when window loads
    window.addEventListener('load', function() {
        console.log('[WaveMAX Bridge] Window loaded, attempting to hide chrome');
        hideChrome();
    });
    
    // Use MutationObserver to catch dynamically added elements
    const observer = new MutationObserver(function(mutations) {
        if (!chromeHidden) {
            // Check if any of our target elements were added
            for (let mutation of mutations) {
                if (mutation.type === 'childList') {
                    for (let node of mutation.addedNodes) {
                        if (node.nodeType === 1) { // Element node
                            if (node.matches && (
                                node.matches('.page-header') || 
                                node.matches('.topbar') || 
                                node.matches('.wrapper') ||
                                node.matches('.navbar') ||
                                node.matches('.footer')
                            )) {
                                console.log('[WaveMAX Bridge] Target element added to DOM:', node.className);
                                hideChrome();
                                return;
                            }
                        }
                    }
                }
            }
        }
    });
    
    // Start observing when DOM is ready
    if (document.body) {
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    } else {
        document.addEventListener('DOMContentLoaded', function() {
            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        });
    }
    
    // Listen for messages from iframe
    window.addEventListener('message', function(event) {
        if (event.data && event.data.type === 'hide-page-header') {
            console.log('[WaveMAX Bridge] Received hide-page-header message from iframe');
            hideChrome();
        }
    });
    
    // Also provide global function for testing
    window.WaveMaxHideChrome = hideChrome;
})();